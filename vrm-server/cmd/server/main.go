package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/google/uuid"
	"github.com/sisterm/vrm-server/internal/asset"
	"github.com/sisterm/vrm-server/internal/hub"
	"github.com/sisterm/vrm-server/internal/storage"
)

const (
	defaultAddr   = ":8080"
	dataDir       = "./data"
	assetsDir     = "./assets"
	shutdownGrace = 10 * time.Second
)

func main() {
	log.Println("starting vrm-server...")

	// Initialize storage.
	if err := storage.Init(dataDir); err != nil {
		log.Fatalf("failed to init storage: %v", err)
	}
	defer storage.Close()

	// Ensure assets directory exists.
	if err := asset.EnsureAssetsDir(assetsDir); err != nil {
		log.Fatalf("failed to ensure assets dir: %v", err)
	}

	// Create default rooms if none exist.
	ensureDefaultRooms()

	// Start WebSocket hub.
	h := hub.NewHub()
	go h.Run()

	// Set up HTTP routes.
	mux := http.NewServeMux()

	// WebSocket endpoint.
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		hub.ServeWs(h, w, r)
	})

	// REST API: rooms.
	mux.HandleFunc("/rooms", roomsHandler)
	mux.HandleFunc("/rooms/", roomDetailHandler)

	// Static asset serving.
	assetServer := asset.NewServer(assetsDir)
	mux.Handle("/assets/", assetServer.Handler())

	// Health check.
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	server := &http.Server{
		Addr:         defaultAddr,
		Handler:      mux,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown.
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
		<-sigCh

		log.Println("shutting down server...")
		ctx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
		defer cancel()

		if err := server.Shutdown(ctx); err != nil {
			log.Printf("server shutdown error: %v", err)
		}
	}()

	log.Printf("vrm-server listening on %s", defaultAddr)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server error: %v", err)
	}
	log.Println("server stopped")
}

func roomsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		rooms, err := storage.ListRooms()
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to list rooms: %v", err), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(rooms)

	case http.MethodPost:
		var req struct {
			Name     string `json:"name"`
			Capacity int    `json:"capacity"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			req.Name = "Untitled Room"
		}
		if req.Capacity <= 0 {
			req.Capacity = 50
		}
		room := storage.RoomRecord{
			ID:       uuid.New().String(),
			Name:     req.Name,
			Capacity: req.Capacity,
		}
		saved, err := storage.SaveRoom(room)
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to save room: %v", err), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(saved)

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func roomDetailHandler(w http.ResponseWriter, r *http.Request) {
	// Path is expected to be /rooms/:id
	id := r.URL.Path[len("/rooms/"):]
	if id == "" {
		http.Error(w, "room id required", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		room, err := storage.GetRoom(id)
		if err != nil {
			http.Error(w, fmt.Sprintf("room not found: %v", err), http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(room)

	case http.MethodDelete:
		if err := storage.DeleteRoom(id); err != nil {
			http.Error(w, fmt.Sprintf("failed to delete room: %v", err), http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusNoContent)

	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func ensureDefaultRooms() {
	rooms, err := storage.ListRooms()
	if err != nil {
		log.Printf("failed to list rooms: %v", err)
		return
	}
	if len(rooms) == 0 {
		defaultRoom := storage.RoomRecord{
			ID:       uuid.New().String(),
			Name:     "Main Hub",
			Capacity: 50,
		}
		if _, err := storage.SaveRoom(defaultRoom); err != nil {
			log.Printf("failed to create default room: %v", err)
		} else {
			log.Printf("created default room: %s", defaultRoom.ID)
		}
	}
}
