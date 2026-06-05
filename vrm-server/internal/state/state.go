package state

import (
	"math"
	"sync"
	"time"

	"github.com/sisterm/vrm-server/pkg/protocol"
)

const (
	maxPosition = 1e6
	maxRotation = math.Pi * 2
	maxScale    = 1000
	maxBoneRot  = 1.0
	minScale    = 0.001
	maxExpressionValue = 1.0
	minExpressionValue = 0.0
)

// WorldState tracks all entities in an ECS-like manner.
type WorldState struct {
	mu       sync.RWMutex
	entities map[string]*protocol.EntityState
}

// NewWorldState creates a new empty world state.
func NewWorldState() *WorldState {
	return &WorldState{
		entities: make(map[string]*protocol.EntityState),
	}
}

// UpdateEntity applies a delta to an entity's state.
func (ws *WorldState) UpdateEntity(delta protocol.AvatarDeltaMessage) {
	ws.mu.Lock()
	defer ws.mu.Unlock()

	ent, exists := ws.entities[delta.UserID]
	if !exists {
		ent = &protocol.EntityState{
			UserID:           delta.UserID,
			CoordinateSystem: protocol.CoordSSCS,
			Expressions:      make(map[string]float64),
			BoneRotations:    make(map[string]protocol.Quaternion),
		}
		ws.entities[delta.UserID] = ent
	}

	// Normalize coordinates to SSCS
	if delta.Transform != nil {
		t := normalizeToSSCS(*delta.Transform, delta.CoordinateSystem)
		ent.Transform = clampTransform(t)
	}
	if delta.LookAt != nil {
		la := normalizeVec3ToSSCS(*delta.LookAt, delta.CoordinateSystem)
		ent.LookAt = clampVec3(la)
	}
	for k, v := range delta.Expressions {
		clamped := math.Max(minExpressionValue, math.Min(maxExpressionValue, v))
		ent.Expressions[k] = clamped
	}
	for k, v := range delta.BoneRotations {
		ent.BoneRotations[k] = clampQuaternion(v)
	}
	if delta.SpringBone != nil {
		sb := clampSpringBoneParams(*delta.SpringBone)
		ent.SpringBone = &sb
	}
	if delta.Materials != nil {
		ent.Materials = make([]protocol.MaterialParams, len(delta.Materials))
		for i, m := range delta.Materials {
			ent.Materials[i] = clampMaterialParams(m)
		}
	}
	if delta.Constraints != nil {
		ent.Constraints = make([]protocol.ConstraintParams, len(delta.Constraints))
		for i, c := range delta.Constraints {
			ent.Constraints[i] = clampConstraintParams(c)
		}
	}
	ent.CoordinateSystem = protocol.CoordSSCS // Server stores in SSCS
}

// RemoveEntity removes an entity from the world.
func (ws *WorldState) RemoveEntity(userID string) {
	ws.mu.Lock()
	defer ws.mu.Unlock()
	delete(ws.entities, userID)
}

// FullState returns a snapshot of all entity states.
func (ws *WorldState) FullState() []protocol.EntityState {
	ws.mu.RLock()
	defer ws.mu.RUnlock()

	result := make([]protocol.EntityState, 0, len(ws.entities))
	for _, ent := range ws.entities {
		// Deep copy to avoid race conditions on the map fields.
		copyEnt := protocol.EntityState{
			UserID:        ent.UserID,
			Transform:     ent.Transform,
			LookAt:        ent.LookAt,
			Expressions:   make(map[string]float64, len(ent.Expressions)),
			BoneRotations: make(map[string]protocol.Quaternion, len(ent.BoneRotations)),
			SpringBone:    copySpringBoneParams(ent.SpringBone),
		}
		for k, v := range ent.Expressions {
			copyEnt.Expressions[k] = v
		}
		for k, v := range ent.BoneRotations {
			copyEnt.BoneRotations[k] = v
		}
		if ent.Materials != nil {
			copyEnt.Materials = make([]protocol.MaterialParams, len(ent.Materials))
			copy(copyEnt.Materials, ent.Materials)
		}
		if ent.Constraints != nil {
			copyEnt.Constraints = make([]protocol.ConstraintParams, len(ent.Constraints))
			copy(copyEnt.Constraints, ent.Constraints)
		}
		result = append(result, copyEnt)
	}
	return result
}

// RateLimiter provides per-client rate limiting for delta messages.
type RateLimiter struct {
	mu      sync.Mutex
	clients map[string]*clientLimit
}

type clientLimit struct {
	lastUpdate time.Time
	count      int
}

// NewRateLimiter creates a new rate limiter.
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		clients: make(map[string]*clientLimit),
	}
}

// Allow checks if a delta from the given user is within rate limits.
// Returns true if the delta is allowed.
func (rl *RateLimiter) Allow(userID string, maxPerSecond int) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cl, ok := rl.clients[userID]
	if !ok || now.Sub(cl.lastUpdate) >= time.Second {
		rl.clients[userID] = &clientLimit{
			lastUpdate: now,
			count:      1,
		}
		return true
	}

	if cl.count >= maxPerSecond {
		return false
	}

	cl.count++
	return true
}

func clampVec3(v protocol.Vec3) protocol.Vec3 {
	return protocol.Vec3{
		X: clampFloat(v.X, -maxPosition, maxPosition),
		Y: clampFloat(v.Y, -maxPosition, maxPosition),
		Z: clampFloat(v.Z, -maxPosition, maxPosition),
	}
}

func clampTransform(t protocol.Transform) protocol.Transform {
	return protocol.Transform{
		Position: clampVec3(t.Position),
		Rotation: clampQuaternion(t.Rotation),
		Scale: protocol.Vec3{
			X: clampFloat(t.Scale.X, minScale, maxScale),
			Y: clampFloat(t.Scale.Y, minScale, maxScale),
			Z: clampFloat(t.Scale.Z, minScale, maxScale),
		},
	}
}

func clampQuaternion(q protocol.Quaternion) protocol.Quaternion {
	return protocol.Quaternion{
		X: clampFloat(q.X, -1, 1),
		Y: clampFloat(q.Y, -1, 1),
		Z: clampFloat(q.Z, -1, 1),
		W: clampFloat(q.W, -1, 1),
	}
}

// ==================== Coordinate System Normalization ====================

func normalizeToSSCS(t protocol.Transform, coord protocol.CoordinateSystem) protocol.Transform {
	if coord == protocol.CoordSSCS || coord == "" {
		return t
	}
	pos := normalizeVec3ToSSCS(t.Position, coord)
	rot := normalizeRotationToSSCS(t.Rotation, coord)
	return protocol.Transform{Position: pos, Rotation: rot, Scale: t.Scale}
}

func normalizeVec3ToSSCS(v protocol.Vec3, coord protocol.CoordinateSystem) protocol.Vec3 {
	if coord == protocol.CoordSSCS || coord == "" {
		return v
	}
	switch coord {
	case protocol.CoordUnity:
		return protocol.Vec3{X: -v.X, Y: v.Y, Z: v.Z}
	case protocol.CoordVrm0Raw:
		return protocol.Vec3{X: -v.X, Y: v.Y, Z: -v.Z}
	default:
		return v
	}
}

func normalizeRotationToSSCS(q protocol.Quaternion, coord protocol.CoordinateSystem) protocol.Quaternion {
	if coord == protocol.CoordSSCS || coord == "" {
		return q
	}
	switch coord {
	case protocol.CoordUnity:
		// LH ↔ RH: negate all components (conjugate / inverse rotation)
		return protocol.Quaternion{X: -q.X, Y: -q.Y, Z: -q.Z, W: q.W}
	case protocol.CoordVrm0Raw:
		// 180° Y rotation
		return protocol.Quaternion{X: q.Z, Y: q.Y, Z: -q.X, W: -q.W}
	default:
		return q
	}
}

func clampFloat(v, min, max float64) float64 {
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func clampSpringBoneParams(p protocol.SpringBoneParams) protocol.SpringBoneParams {
	return protocol.SpringBoneParams{
		Gravity:   clampVec3(p.Gravity),
		Wind:      clampVec3(p.Wind),
		Stiffness: clampFloat(p.Stiffness, 0, 1),
		DragForce: clampFloat(p.DragForce, 0, 1),
	}
}

func clampMaterialParams(m protocol.MaterialParams) protocol.MaterialParams {
	for i := range m.ShadeColor {
		m.ShadeColor[i] = clampFloat(m.ShadeColor[i], 0, 1)
	}
	m.ShadingShift = clampFloat(m.ShadingShift, -1, 1)
	m.OutlineWidth = clampFloat(m.OutlineWidth, 0, maxScale)
	return m
}

func clampConstraintParams(c protocol.ConstraintParams) protocol.ConstraintParams {
	c.Weight = clampFloat(c.Weight, 0, 1)
	return c
}

func copySpringBoneParams(p *protocol.SpringBoneParams) *protocol.SpringBoneParams {
	if p == nil {
		return nil
	}
	cp := *p
	return &cp
}
