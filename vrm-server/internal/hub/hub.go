package hub

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/sisterm/vrm-server/internal/room"
	"github.com/sisterm/vrm-server/pkg/protocol"
)

const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer.
	maxMessageSize = 65536
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Client is a middleman between the websocket connection and the room.
type Client struct {
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
	RoomID string
	UserID string
}

// Hub maintains the set of active rooms and clients.
type Hub struct {
	rooms      map[string]*room.Room
	register   chan *Client
	unregister chan *Client
	broadcast  chan []byte
}

// NewHub creates a new Hub.
func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]*room.Room),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan []byte),
	}
}

// Run starts the hub's event loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.handleRegister(client)
		case client := <-h.unregister:
			h.handleUnregister(client)
		}
	}
}

func (h *Hub) handleRegister(client *Client) {
	r, ok := h.rooms[client.RoomID]
	if !ok {
		r = room.NewRoom(client.RoomID, 50)
		h.rooms[client.RoomID] = r
		go r.Run()
	}
	r.Register <- &room.ClientConn{
		Send:   client.Send,
		RoomID: client.RoomID,
		UserID: client.UserID,
	}
}

func (h *Hub) handleUnregister(client *Client) {
	if r, ok := h.rooms[client.RoomID]; ok {
		r.Unregister <- &room.ClientConn{
			Send:   client.Send,
			RoomID: client.RoomID,
			UserID: client.UserID,
		}
		close(client.Send)
		if len(r.Clients) == 0 {
			delete(h.rooms, client.RoomID)
		}
	}
}

// ServeWs handles websocket requests from the peer.
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade error:", err)
		return
	}

	client := &Client{
		Hub:  hub,
		Conn: conn,
		Send: make(chan []byte, 256),
	}

	go client.writePump()
	go client.readPump()
}

func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}

		c.handleMessage(message)
	}
}

func (c *Client) handleMessage(raw []byte) {
	var msg protocol.Message
	if err := json.Unmarshal(raw, &msg); err != nil {
		log.Println("unmarshal error:", err)
		return
	}

	switch msg.Type {
	case protocol.TypeJoinRoom:
		var join protocol.JoinRoomMessage
		if err := json.Unmarshal(raw, &join); err != nil {
			log.Println("unmarshal join error:", err)
			return
		}
		c.RoomID = join.RoomID
		c.UserID = join.UserID
		c.Hub.register <- c

	case protocol.TypeAvatarDelta:
		var delta protocol.AvatarDeltaMessage
		if err := json.Unmarshal(raw, &delta); err != nil {
			log.Println("unmarshal delta error:", err)
			return
		}
		if c.RoomID == "" || c.UserID == "" {
			return
		}
		delta.UserID = c.UserID
		delta.RoomID = c.RoomID
		if err := delta.Validate(); err != nil {
			log.Println("validation error:", err)
			return
		}
		if r, ok := c.Hub.rooms[c.RoomID]; ok {
			r.DeltaIn <- delta
		}

	case protocol.TypeRoomEvent:
		var evt protocol.RoomEventMessage
		if err := json.Unmarshal(raw, &evt); err != nil {
			log.Println("unmarshal event error:", err)
			return
		}
		if c.RoomID == "" {
			return
		}
		evt.UserID = c.UserID
		evt.RoomID = c.RoomID
		if r, ok := c.Hub.rooms[c.RoomID]; ok {
			evt.Timestamp = time.Now().UnixMilli()
			data, _ := json.Marshal(evt)
			r.Broadcast <- data
		}

	case protocol.TypeHeartbeat:
		// Pong is handled at connection level; heartbeat can be used for latency measurement.
		var hb protocol.HeartbeatMessage
		if err := json.Unmarshal(raw, &hb); err != nil {
			return
		}
		hb.Type = protocol.TypeHeartbeat
		hb.Timestamp = time.Now().UnixMilli()
		data, _ := json.Marshal(hb)
		select {
		case c.Send <- data:
		default:
		}

	case protocol.TypeLeaveRoom:
		var leave protocol.LeaveRoomMessage
		if err := json.Unmarshal(raw, &leave); err != nil {
			return
		}
		c.Hub.unregister <- c
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
