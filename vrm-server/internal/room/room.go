package room

import (
	"encoding/json"
	"log"
	"time"

	"github.com/sisterm/vrm-server/internal/state"
	"github.com/sisterm/vrm-server/pkg/protocol"
)

// ClientConn represents a client's connection within a room.
type ClientConn struct {
	Send   chan []byte
	RoomID string
	UserID string
}

// Room holds all state for a single room.
type Room struct {
	ID         string
	Clients    map[*ClientConn]bool
	Register   chan *ClientConn
	Unregister chan *ClientConn
	Broadcast  chan []byte
	DeltaIn    chan protocol.AvatarDeltaMessage
	Capacity   int

	worldState *state.WorldState
	ticker     *time.Ticker
}

// NewRoom creates a new Room with the given ID and capacity.
func NewRoom(id string, capacity int) *Room {
	return &Room{
		ID:         id,
		Clients:    make(map[*ClientConn]bool),
		Register:   make(chan *ClientConn),
		Unregister: make(chan *ClientConn),
		Broadcast:  make(chan []byte),
		DeltaIn:    make(chan protocol.AvatarDeltaMessage),
		Capacity:   capacity,
		worldState: state.NewWorldState(),
		ticker:     time.NewTicker(500 * time.Millisecond),
	}
}

// Run starts the room's event loop.
func (r *Room) Run() {
	for {
		select {
		case client := <-r.Register:
			r.handleJoin(client)
		case client := <-r.Unregister:
			r.handleLeave(client)
		case delta := <-r.DeltaIn:
			r.handleDelta(delta)
		case message := <-r.Broadcast:
			r.broadcast(message)
		case <-r.ticker.C:
			r.broadcastFullState()
		}
	}
}

func (r *Room) handleJoin(client *ClientConn) {
	if len(r.Clients) >= r.Capacity {
		log.Printf("room %s at capacity", r.ID)
		return
	}
	r.Clients[client] = true
	// Send full state immediately to the new client.
	r.sendFullState(client)
}

func (r *Room) handleLeave(client *ClientConn) {
	if _, ok := r.Clients[client]; ok {
		delete(r.Clients, client)
		r.worldState.RemoveEntity(client.UserID)
	}
}

func (r *Room) handleDelta(delta protocol.AvatarDeltaMessage) {
	r.worldState.UpdateEntity(delta)
	data, err := json.Marshal(delta)
	if err != nil {
		log.Println("marshal delta error:", err)
		return
	}
	r.broadcast(data)
}

func (r *Room) broadcast(message []byte) {
	for client := range r.Clients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(r.Clients, client)
		}
	}
}

func (r *Room) broadcastFullState() {
	if len(r.Clients) == 0 {
		return
	}
	entities := r.worldState.FullState()
	msg := protocol.FullStateMessage{
		Type:     protocol.TypeFullState,
		RoomID:   r.ID,
		Entities: entities,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Println("marshal full state error:", err)
		return
	}
	r.broadcast(data)
}

func (r *Room) sendFullState(client *ClientConn) {
	entities := r.worldState.FullState()
	msg := protocol.FullStateMessage{
		Type:     protocol.TypeFullState,
		RoomID:   r.ID,
		Entities: entities,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Println("marshal full state error:", err)
		return
	}
	select {
	case client.Send <- data:
	default:
	}
}
