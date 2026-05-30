package asset

import (
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// Server serves VRM and other static assets from a local directory.
type Server struct {
	root string
}

// NewServer creates a new asset server rooted at the given directory.
func NewServer(root string) *Server {
	return &Server{root: root}
}

// Handler returns an http.Handler for serving assets.
func (s *Server) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Strip the /assets/ prefix to get the relative path.
		cleanPath := path.Clean(r.URL.Path)
		if strings.Contains(cleanPath, "..") {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}

		// Ensure the request path starts with /assets/
		if !strings.HasPrefix(cleanPath, "/assets/") {
			http.Error(w, "not found", http.StatusNotFound)
			return
		}

		relativePath := strings.TrimPrefix(cleanPath, "/assets/")
		fullPath := filepath.Join(s.root, relativePath)

		// Security check: ensure the resolved path is within root.
		resolvedPath, err := filepath.EvalSymlinks(fullPath)
		if err != nil {
			if os.IsNotExist(err) {
				http.Error(w, "not found", http.StatusNotFound)
				return
			}
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		rootResolved, _ := filepath.EvalSymlinks(s.root)
		if !strings.HasPrefix(resolvedPath, rootResolved) {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}

		// Set content type for VRM files.
		if strings.HasSuffix(resolvedPath, ".vrm") {
			w.Header().Set("Content-Type", "application/octet-stream")
			w.Header().Set("Access-Control-Allow-Origin", "*")
		}

		// Set cache headers for static assets.
		w.Header().Set("Cache-Control", "public, max-age=3600")

		http.ServeFile(w, r, resolvedPath)
	})
}

// EnsureAssetsDir ensures the assets directory exists.
func EnsureAssetsDir(root string) error {
	vrmsDir := filepath.Join(root, "vrms")
	if err := os.MkdirAll(vrmsDir, 0755); err != nil {
		return err
	}
	log.Printf("assets directory ready: %s", vrmsDir)
	return nil
}
