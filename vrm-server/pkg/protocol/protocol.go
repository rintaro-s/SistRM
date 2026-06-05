package protocol

import (
	"encoding/json"
	"fmt"
)

// MessageType defines the WebSocket message types.
type MessageType string

const (
	TypeJoinRoom          MessageType = "join_room"
	TypeLeaveRoom         MessageType = "leave_room"
	TypeFullState         MessageType = "full_state"
	TypeAvatarDelta       MessageType = "avatar_delta"
	TypeRoomEvent         MessageType = "room_event"
	TypeHeartbeat         MessageType = "heartbeat"
	TypeError             MessageType = "error"
	TypeSpringBoneParams  MessageType = "spring_bone_params"
	TypeMaterialParams    MessageType = "material_params"
	TypeConstraintParams  MessageType = "constraint_params"
)

// Vec3 represents a 3D vector.
// JSON serialization uses compact array format [x, y, z].
type Vec3 struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
}

// MarshalJSON serializes Vec3 as [x, y, z].
func (v Vec3) MarshalJSON() ([]byte, error) {
	return json.Marshal([3]float64{v.X, v.Y, v.Z})
}

// UnmarshalJSON deserializes Vec3 from [x, y, z] or {"x":x,"y":y,"z":z}.
func (v *Vec3) UnmarshalJSON(data []byte) error {
	var arr [3]float64
	if err := json.Unmarshal(data, &arr); err == nil {
		v.X, v.Y, v.Z = arr[0], arr[1], arr[2]
		return nil
	}
	var obj struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
		Z float64 `json:"z"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return err
	}
	v.X, v.Y, v.Z = obj.X, obj.Y, obj.Z
	return nil
}

// Quaternion represents a 4D rotation.
// JSON serialization uses compact array format [x, y, z, w].
type Quaternion struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
	Z float64 `json:"z"`
	W float64 `json:"w"`
}

// MarshalJSON serializes Quaternion as [x, y, z, w].
func (q Quaternion) MarshalJSON() ([]byte, error) {
	return json.Marshal([4]float64{q.X, q.Y, q.Z, q.W})
}

// UnmarshalJSON deserializes Quaternion from [x, y, z, w] or {"x":x,"y":y,"z":z,"w":w}.
func (q *Quaternion) UnmarshalJSON(data []byte) error {
	var arr [4]float64
	if err := json.Unmarshal(data, &arr); err == nil {
		q.X, q.Y, q.Z, q.W = arr[0], arr[1], arr[2], arr[3]
		return nil
	}
	var obj struct {
		X float64 `json:"x"`
		Y float64 `json:"y"`
		Z float64 `json:"z"`
		W float64 `json:"w"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return err
	}
	q.X, q.Y, q.Z, q.W = obj.X, obj.Y, obj.Z, obj.W
	return nil
}

// Transform represents position, rotation, and scale.
type Transform struct {
	Position Vec3       `json:"pos"`
	Rotation Quaternion `json:"rot"`
	Scale    Vec3       `json:"scale"`
}

// CoordinateSystem identifies the source coordinate system.
type CoordinateSystem string

const (
	CoordSSCS     CoordinateSystem = "SSCS"
	CoordUnity    CoordinateSystem = "UNITY"
	CoordVrm0Raw  CoordinateSystem = "VRM0_RAW"
)

// SpringBoneParams controls spring bone dynamics for VRM avatars.
type SpringBoneParams struct {
	Gravity   Vec3    `json:"gravity"`
	Wind      Vec3    `json:"wind"`
	Stiffness float64 `json:"stiffness"`
	DragForce float64 `json:"drag_force"`
}

// ConstraintParams controls look-at / aim / roll constraints.
type ConstraintParams struct {
	Type       string  `json:"type"`
	SourceNode int     `json:"source_node"`
	Weight     float64 `json:"weight"`
	AimAxis    string  `json:"aim_axis,omitempty"`
	RollAxis   string  `json:"roll_axis,omitempty"`
}

// MaterialParams controls MToon material properties.
type MaterialParams struct {
	MaterialIndex int       `json:"material_index"`
	RenderMode    string    `json:"render_mode,omitempty"`
	ShadeColor    [4]float64 `json:"shade_color"`
	ShadingShift  float64   `json:"shading_shift"`
	MatcapFactor  [3]float64 `json:"matcap_factor,omitempty"`
	RimFactor     [3]float64 `json:"rim_factor,omitempty"`
	OutlineWidth  float64   `json:"outline_width,omitempty"`
}

// EntityState represents the full synchronized state of an avatar.
type EntityState struct {
	UserID           string                `json:"user_id"`
	DisplayName      string                `json:"display_name,omitempty"`
	AvatarURL        string                `json:"avatar_url,omitempty"`
	CoordinateSystem CoordinateSystem      `json:"coordinate_system,omitempty"`
	Transform        Transform             `json:"transform"`
	Expressions      map[string]float64    `json:"expressions"`
	BoneRotations    map[string]Quaternion `json:"bone_rotations"`
	LookAt           Vec3                  `json:"look_at"`
	SpringBone       *SpringBoneParams     `json:"spring_bone,omitempty"`
	Materials        []MaterialParams      `json:"materials,omitempty"`
	Constraints      []ConstraintParams    `json:"constraints,omitempty"`
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
	Type             MessageType           `json:"type"`
	UserID           string                `json:"user_id"`
	RoomID           string                `json:"room_id"`
	CoordinateSystem CoordinateSystem      `json:"coordinate_system,omitempty"`
	Transform        *Transform            `json:"transform,omitempty"`
	Expressions      map[string]float64    `json:"expressions,omitempty"`
	BoneRotations    map[string]Quaternion `json:"bone_rotations,omitempty"`
	LookAt           *Vec3                 `json:"look_at,omitempty"`
	SpringBone       *SpringBoneParams     `json:"spring_bone,omitempty"`
	Materials        []MaterialParams      `json:"materials,omitempty"`
	Constraints      []ConstraintParams    `json:"constraints,omitempty"`
	Timestamp        int64                 `json:"timestamp"`
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

// SpringBoneParamsMessage sets spring bone dynamics for an avatar.
type SpringBoneParamsMessage struct {
	Type    MessageType      `json:"type"`
	UserID  string           `json:"user_id"`
	RoomID  string           `json:"room_id"`
	Params  SpringBoneParams `json:"params"`
}

// MaterialParamsMessage sets material properties for an avatar.
type MaterialParamsMessage struct {
	Type    MessageType    `json:"type"`
	UserID  string         `json:"user_id"`
	RoomID  string         `json:"room_id"`
	Params  MaterialParams `json:"params"`
}

// ConstraintParamsMessage sets constraint properties for an avatar.
type ConstraintParamsMessage struct {
	Type    MessageType     `json:"type"`
	UserID  string          `json:"user_id"`
	RoomID  string          `json:"room_id"`
	Params  ConstraintParams `json:"params"`
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
	if d.SpringBone != nil {
		if err := validateSpringBoneParams(*d.SpringBone); err != nil {
			return fmt.Errorf("invalid spring_bone: %w", err)
		}
	}
	for i, m := range d.Materials {
		if err := validateMaterialParams(m); err != nil {
			return fmt.Errorf("invalid material[%d]: %w", i, err)
		}
	}
	for i, c := range d.Constraints {
		if err := validateConstraintParams(c); err != nil {
			return fmt.Errorf("invalid constraint[%d]: %w", i, err)
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
	if err := validateQuaternion(t.Rotation); err != nil {
		return fmt.Errorf("rotation: %w", err)
	}
	if err := validateVec3(t.Scale); err != nil {
		return fmt.Errorf("scale: %w", err)
	}
	return nil
}

func validateSpringBoneParams(p SpringBoneParams) error {
	if err := validateVec3(p.Gravity); err != nil {
		return fmt.Errorf("gravity: %w", err)
	}
	if err := validateVec3(p.Wind); err != nil {
		return fmt.Errorf("wind: %w", err)
	}
	if p.Stiffness < 0 || p.Stiffness > 1 {
		return fmt.Errorf("stiffness must be in [0,1], got %f", p.Stiffness)
	}
	if p.DragForce < 0 || p.DragForce > 1 {
		return fmt.Errorf("drag_force must be in [0,1], got %f", p.DragForce)
	}
	return nil
}

func validateMaterialParams(m MaterialParams) error {
	if m.MaterialIndex < 0 {
		return fmt.Errorf("material_index must be >= 0")
	}
	for i, c := range m.ShadeColor {
		if c < 0 || c > 1 {
			return fmt.Errorf("shade_color[%d] must be in [0,1], got %f", i, c)
		}
	}
	if m.ShadingShift < -1 || m.ShadingShift > 1 {
		return fmt.Errorf("shading_shift must be in [-1,1], got %f", m.ShadingShift)
	}
	return nil
}

func validateConstraintParams(c ConstraintParams) error {
	if c.Type == "" {
		return fmt.Errorf("type is required")
	}
	if c.SourceNode < 0 {
		return fmt.Errorf("source_node must be >= 0")
	}
	if c.Weight < 0 || c.Weight > 1 {
		return fmt.Errorf("weight must be in [0,1], got %f", c.Weight)
	}
	return nil
}
