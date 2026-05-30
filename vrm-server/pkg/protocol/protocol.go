package protocol

import (
	"encoding/json"
	"fmt"
)

// MessageType defines the WebSocket message types.
type MessageType string

const (
	TypeJoinRoom    MessageType = "join_room"
	TypeLeaveRoom   MessageType = "leave_room"
	TypeFullState   MessageType = "full_state"
	TypeAvatarDelta MessageType = "avatar_delta"
	TypeRoomEvent   MessageType = "room_event"
	TypeHeartbeat   MessageType = "heartbeat"
	TypeError       MessageType = "error"
)

// Vec3 represents a 3D vector.
type Vec3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// Quaternion represents a 4D rotation.
type Quaternion struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
	W float64 `json:"w"`
}

// Transform represents position, rotation, and scale.
type Transform struct {
	Position Vec3 `json:"pos"`
	Rotation Vec3 `json:"rot"`
	Scale    Vec3 `json:"scale"`
}

// EntityState represents the full synchronized state of an avatar.
type EntityState struct {
	UserID        string                `json:"user_id"`
	Transform     Transform             `json:"transform"`
	Expressions   map[string]float64    `json:"expressions"`
	BoneRotations map[string]Quaternion `json:"bone_rotations"`
	LookAt        Vec3                  `json:"look_at"`
}

// JoinRoomMessage is sent by a client to join a room.
type JoinRoomMessage struct {
	Type   MessageType `json:"type"`
	RoomID string      `json:"room_id"`
	UserID string      `json:"user_id"`
}

// LeaveRoomMessage is sent by a client to leave a room.
type LeaveRoomMessage struct {
	Type   MessageType `json:"type"`
	RoomID string      `json:"room_id"`
	UserID string      `json:"user_id"`
}

// FullStateMessage is broadcast by the server with all entity states.
type FullStateMessage struct {
	Type     MessageType   `json:"type"`
	RoomID   string        `json:"room_id"`
	Entities []EntityState `json:"entities"`
}

// AvatarDeltaMessage is sent by a client to update its avatar state.
type AvatarDeltaMessage struct {
	Type          MessageType          `json:"type"`
	UserID        string               `json:"user_id"`
	RoomID        string               `json:"room_id"`
	Transform     *Transform           `json:"transform,omitempty"`
	Expressions   map[string]float64   `json:"expressions,omitempty"`
	BoneRotations map[string]Quaternion `json:"bone_rotations,omitempty"`
	LookAt        *Vec3                `json:"look_at,omitempty"`
	Timestamp     int64                `json:"timestamp"`
}

// RoomEventMessage is used for chat, RPC, or other room-level events.
type RoomEventMessage struct {
	Type      MessageType    `json:"type"`
	RoomID    string         `json:"room_id"`
	UserID    string         `json:"user_id"`
	EventType string         `json:"event_type"`
	Payload   map[string]any `json:"payload"`
	Timestamp int64          `json:"timestamp"`
}

// HeartbeatMessage is used for connection keep-alive.
type HeartbeatMessage struct {
	Type      MessageType `json:"type"`
	Timestamp int64       `json:"timestamp"`
}

// Message is a generic wrapper to help with initial deserialization.
type Message struct {
	Type MessageType     `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

// Validate checks if a delta message is within acceptable bounds.
func (d *AvatarDeltaMessage) Validate() error {
	if d.UserID == "" {
		return fmt.Errorf("user_id is required")
	}
	if d.RoomID == "" {
		return fmt.Errorf("room_id is required")
	}
	if d.Transform != nil {
		if err := validateTransform(*d.Transform); err != nil {
			return fmt.Errorf("invalid transform: %w", err)
		}
	}
	if d.LookAt != nil {
		if err := validateVec3(*d.LookAt); err != nil {
			return fmt.Errorf("invalid look_at: %w", err)
		}
	}
	return nil
}

func validateQuaternion(q Quaternion) error {
	const max = 1.0
	if q.X > max || q.X < -max || q.Y > max || q.Y < -max || q.Z > max || q.Z < -max || q.W > max || q.W < -max {
		return fmt.Errorf("quaternion component out of bounds")
	}
	return nil
}

func validateVec3(v Vec3) error {
	const max = 1e6
	if v.X > max || v.X < -max || v.Y > max || v.Y < -max || v.Z > max || v.Z < -max {
		return fmt.Errorf("vector component out of bounds")
	}
	return nil
}

func validateTransform(t Transform) error {
	if err := validateVec3(t.Position); err != nil {
		return fmt.Errorf("position: %w", err)
	}
	if err := validateVec3(t.Rotation); err != nil {
		return fmt.Errorf("rotation: %w", err)
	}
	if err := validateVec3(t.Scale); err != nil {
		return fmt.Errorf("scale: %w", err)
	}
	return nil
}
