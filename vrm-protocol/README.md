# VRM Protocol

Shared network protocol for the SisterRM multi-platform metaverse.

## Overview

All platforms (Unity, Godot, Android, Web/A-Frame) communicate with the `vrm-server` using JSON messages over WebSocket.

## Message Types

### Client → Server

| Type | Description |
|------|-------------|
| `join_room` | Join a room with user ID and optional avatar URL |
| `leave_room` | Leave current room |
| `avatar_delta` | Send avatar state update (transform, expressions, bones) |
| `room_event` | Send chat, RPC, or interaction events |
| `heartbeat` | Keep connection alive |

### Server → Client

| Type | Description |
|------|-------------|
| `full_state` | Complete room state snapshot (sent on join and periodically) |
| `avatar_delta` | Another user's avatar state update |
| `room_event` | Broadcast room events (user joined/left, chat, etc.) |
| `error` | Error response |

## Rate Limits

- `avatar_delta`: Max 20 messages/second per client
- `room_event`: Max 5 messages/second per client
- `heartbeat`: Every 30 seconds

## Entity State

Each connected user has an `EntityState`:

```json
{
  "user_id": "uuid-string",
  "display_name": "Player Name",
  "avatar_url": "/assets/avatar.vrm",
  "transform": {
    "pos": [0.0, 1.0, 0.0],
    "rot": [0.0, 0.0, 0.0, 1.0],
    "scale": [1.0, 1.0, 1.0]
  },
  "expressions": {
    "happy": 0.5,
    "blink": 1.0
  },
  "bone_rotations": {
    "leftUpperArm": [0.0, 0.0, 0.0, 1.0]
  },
  "look_at": [1.0, 2.0, 3.0],
  "springbone_params": {
    "gravity": [0.0, -1.0, 0.0],
    "wind": [0.0, 0.0, 0.0]
  }
}
```

## Expression Names (VRM 1.0 Presets)

- `happy`, `angry`, `sad`, `relaxed`, `surprised`, `neutral`
- `aa`, `ih`, `ou`, `ee`, `oh`
- `blink`, `blinkLeft`, `blinkRight`
- `lookUp`, `lookDown`, `lookLeft`, `lookRight`

## Humanoid Bone Names

- `hips`, `spine`, `chest`, `upperChest`, `neck`, `head`
- `leftEye`, `rightEye`, `jaw`
- `leftUpperLeg`, `leftLowerLeg`, `leftFoot`, `leftToes`
- `rightUpperLeg`, `rightLowerLeg`, `rightFoot`, `rightToes`
- `leftShoulder`, `leftUpperArm`, `leftLowerArm`, `leftHand`
- `rightShoulder`, `rightUpperArm`, `rightLowerArm`, `rightHand`
- `leftThumbProximal`, `leftThumbIntermediate`, `leftThumbDistal`
- `leftIndexProximal`, `leftIndexIntermediate`, `leftIndexDistal`
- `leftMiddleProximal`, `leftMiddleIntermediate`, `leftMiddleDistal`
- `leftRingProximal`, `leftRingIntermediate`, `leftRingDistal`
- `leftLittleProximal`, `leftLittleIntermediate`, `leftLittleDistal`
- `rightThumbProximal`, `rightThumbIntermediate`, `rightThumbDistal`
- `rightIndexProximal`, `rightIndexIntermediate`, `rightIndexDistal`
- `rightMiddleProximal`, `rightMiddleIntermediate`, `rightMiddleDistal`
- `rightRingProximal`, `rightRingIntermediate`, `rightRingDistal`
- `rightLittleProximal`, `rightLittleIntermediate`, `rightLittleDistal`
