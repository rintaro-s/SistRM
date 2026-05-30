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
			UserID:        delta.UserID,
			Expressions:   make(map[string]float64),
			BoneRotations: make(map[string]protocol.Quaternion),
		}
		ws.entities[delta.UserID] = ent
	}

	if delta.Transform != nil {
		ent.Transform = clampTransform(*delta.Transform)
	}
	if delta.LookAt != nil {
		ent.LookAt = clampVec3(*delta.LookAt)
	}
	for k, v := range delta.Expressions {
		clamped := math.Max(minExpressionValue, math.Min(maxExpressionValue, v))
		ent.Expressions[k] = clamped
	}
	for k, v := range delta.BoneRotations {
		ent.BoneRotations[k] = clampQuaternion(v)
	}
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
		}
		for k, v := range ent.Expressions {
			copyEnt.Expressions[k] = v
		}
		for k, v := range ent.BoneRotations {
			copyEnt.BoneRotations[k] = v
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
		Rotation: protocol.Vec3{
			X: clampFloat(t.Rotation.X, -maxRotation, maxRotation),
			Y: clampFloat(t.Rotation.Y, -maxRotation, maxRotation),
			Z: clampFloat(t.Rotation.Z, -maxRotation, maxRotation),
		},
		Scale: protocol.Vec3{
			X: clampFloat(t.Scale.X, minScale, maxScale),
			Y: clampFloat(t.Scale.Y, minScale, maxScale),
			Z: clampFloat(t.Scale.Z, minScale, maxScale),
		},
	}
}

func clampQuaternion(q protocol.Quaternion) protocol.Quaternion {
	return protocol.Quaternion{
		X: clampFloat(q.X, -maxBoneRot, maxBoneRot),
		Y: clampFloat(q.Y, -maxBoneRot, maxBoneRot),
		Z: clampFloat(q.Z, -maxBoneRot, maxBoneRot),
		W: clampFloat(q.W, -maxBoneRot, maxBoneRot),
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
