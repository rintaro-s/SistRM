# SisterRM — Multi-Platform VRM Metaverse Foundation

A cross-platform metaverse foundation built on VRM. Provides runtime libraries for Android (Kotlin), Godot (GDScript), and A-Frame (Web), plus a Go server for real-time avatar state synchronization.

## Project Structure

```
SisterRM/
├── UniVRM/              # Unity reference implementation (existing)
├── three-vrm/           # Web/Three.js reference implementation (existing)
├── vrm-protocol/        # Shared WebSocket protocol spec (JSON Schema)
├── vrm-server/          # Go real-time synchronization hub
├── android-vrm/         # Kotlin VRM runtime library for Android
├── aframe-vrm/          # A-Frame components for WebXR VRM avatars
└── godot-vrm/           # Updated Godot VRM addon with runtime API
```

## Platform Libraries

### android-vrm (Kotlin)
Renderer-agnostic VRM runtime for Android. Pure Kotlin core with optional Filament integration.

- **VRM 0.0/1.0** loading and parsing
- **Humanoid** bone mapping and posing
- **Expressions** (morph targets + material bindings)
- **Spring Bone** physics
- **Node Constraints** (roll, aim, rotation)
- **LookAt** (bone and expression modes)
- **Network client** for vrm-server

### aframe-vrm (TypeScript)
Drop-in A-Frame components wrapping `@pixiv/three-vrm`.

- `vrm-model` — Load VRM
- `vrm-expressions` — Facial expression control
- `vrm-look-at` — Eye/head tracking
- `vrm-spring-bone` — Physics configuration
- `vrm-networked` — Multiplayer sync

### godot-vrm (GDScript)
Updated Godot 4.x addon with new runtime API classes.

- Runtime **expression** control (no AnimationPlayer required)
- **Humanoid** bone access via Skeleton3D
- **LookAt** target tracking
- **Network client** node for vrm-server sync
- **VRMA** animation loading and retargeting

### vrm-server (Go)
WebSocket hub for synchronizing avatar state across all platforms.

- Room-based instances
- 20Hz transform + 10Hz expression broadcasts
- REST API for room management
- Static VRM asset serving
- BoltDB + SQLite persistence

## Unified API Pattern

All platforms share a common conceptual API derived from UniVRM and three-vrm:

```
VRMInstance
├── load(path) -> VRMInstance
├── update(delta)
├── humanoid
│   ├── getBone(name)
│   └── setBoneRotation(name, rot)
├── expressions
│   ├── setValue(name, value)
│   └── getValue(name)
├── lookAt
│   ├── target = ...
│   └── update(delta)
├── springBone
│   └── update(delta)
└── network (optional)
    ├── connect(url)
    └── joinRoom(roomId, userId)
```

## Quick Start

### Server
```bash
cd vrm-server
go run ./cmd/server
# → http://localhost:8080
```

### A-Frame
```html
<a-entity vrm-model="src: ./avatar.vrm"
          vrm-networked="server: ws://localhost:8080/ws; room: lobby">
</a-entity>
```

### Godot
```gdscript
$VRMModel.get_vrm_expression_manager().set_expression("happy", 0.8)
$VRMModel.get_vrm_network_client().setup("ws://localhost:8080/ws", "lobby", "player-1", $VRMModel)
```

### Android
```kotlin
val client = VRMNetworkClient()
client.connect("ws://localhost:8080/ws")
client.joinRoom("lobby", "android-1", "avatar.vrm")
```

## Network Protocol

All platforms communicate via JSON WebSocket messages:

| Message | Direction | Description |
|---------|-----------|-------------|
| `join_room` | C→S | Join a room with user ID and avatar URL |
| `avatar_delta` | C→S, S→C | Avatar state update (transform, expressions, bones) |
| `full_state` | S→C | Complete room snapshot |
| `room_event` | C→S, S→C | Chat, RPC, presence events |

See `vrm-protocol/spec/messages.schema.json` for the full schema.

## Development

Each subproject has its own build system:

| Project | Build | Run |
|---------|-------|-----|
| vrm-server | `go build ./cmd/server` | `./server` |
| aframe-vrm | `npm install && npm run build` | `npm run serve` |
| android-vrm | `./gradlew build` | `./gradlew :vrm-sample:installDebug` |
| godot-vrm | Import `godot-vrm/` in Godot 4.2+ | F5 |

## License

See individual subprojects for their licenses. The new code follows the same licenses as their respective reference implementations where applicable.
