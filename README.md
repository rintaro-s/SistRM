# SisterRM — Multi-Platform VRM Metaverse Foundation

A cross-platform metaverse foundation built on VRM. Provides runtime libraries for
Godot (GDScript), A-Frame/Three.js (TypeScript), and Android (Kotlin + Filament),
plus a Go server for real-time avatar state synchronization.

## Project Structure

```
SisterRM/
├── vrm-server/          # Go WebSocket hub for real-time sync
├── vrm-protocol/        # Shared protocol spec (JSON Schema)
├── aframe-vrm/          # A-Frame components wrapping @pixiv/three-vrm
├── godot-vrm/           # Godot VRM addon + SisterRM runtime wrapper
├── android-vrm/         # Kotlin native VRM library
│   ├── vrm-loader/      # glTF 2.0 + VRM 0.0/1.0 JSON parsing
│   ├── vrm-core/        # Math (Vector3, Quaternion, Matrix4) + CoordinateConverter
│   ├── vrm-filament/    # **VRMController API** — load & control VRM via Filament
│   ├── vrm-network/     # WebSocket client for vrm-server sync
│   ├── vrm-springbone/  # Spring bone physics simulation
│   ├── vrm-constraint/  # Node constraints (Aim, Roll, Rotation)
│   ├── vrm-lookat/      # Look-at system (bone + expression modes)
│   ├── vrm-material/    # MToon material parameter access
│   └── vrm-sample/      # Minimal sample app
├── example/
│   ├── Android-app/     # Full demo: expressions, bones, first-person, API examples
│   ├── web/             # A-Frame demo HTML
│   ├── godot/           # Godot demo scene
│   └── assets/          # avatar.vrm (VRM 1.0)
├── UniVRM/              # Unity reference implementation (upstream)
└── three-vrm/           # Web reference implementation (upstream)
```

## Architecture Philosophy: Native VRM Control

The core value of VRM is **native runtime control** — expressions, humanoid bones,
first-person, look-at, spring bones, materials. SisterRM provides a unified API
for all of these on every platform.

| Platform | Rendering | VRM Library | SisterRM Control API |
|----------|-----------|-------------|----------------------|
| **Android** | Google Filament | android-vrm | `VRMController` — expressions, bones, first-person, look-at |
| **Godot** | Godot 4 Renderer | godot-vrm addon | `SisterRMRuntime` — expressions, bones, first-person, spring bones |
| **A-Frame** | Three.js WebGL | @pixiv/three-vrm | `vrm-model` + `vrm-expressions` + `vrm-look-at` |

## Android Library (Kotlin)

### VRMController API

The heart of the Android library is `VRMController` — a single interface for
loading and controlling any VRM avatar.

```kotlin
// 1. Create controller
val vrm = VRMFilamentController(surfaceView, assetManager)

// 2. Load VRM
vrm.loadVrm("avatar.vrm")

// 3. Control expressions
vrm.setExpression("happy", 0.8f)
vrm.setExpression("blink", 1.0f)

// 4. Pose bones (euler angles in radians, delta from bind pose)
vrm.setBoneRotation("head", 0.2f, 0.1f, 0f)
vrm.setBoneRotation("leftUpperArm", 0f, 0f, 0.5f)

// 5. Toggle first-person mode
vrm.firstPersonEnabled = true

// 6. Move the avatar
vrm.setPosition(0f, 0f, -2f)
vrm.setRotation(0f, 0.5f, 0f)

// 7. Reset
vrm.resetExpressions()
vrm.resetAllBones()
```

### Library Modules

| Module | Purpose |
|--------|---------|
| `vrm-loader` | Parse glTF JSON + VRM 0.0/1.0 extensions |
| `vrm-core` | Vector3, Quaternion, Matrix4, CoordinateConverter (SSCS) |
| `vrm-filament` | **VRMController** — the main API for controlling VRM |
| `vrm-network` | WebSocket client with auto-reconnect |
| `vrm-springbone` | Verlet integration spring bone physics |
| `vrm-constraint` | Node constraints (Aim, Roll, Rotation) |
| `vrm-lookat` | Look-at calculations (bone + expression modes) |
| `vrm-material` | MToon material parameter extraction |

## Platform Libraries

### godot-vrm (GDScript)

Wraps the existing [godot-vrm addon](https://github.com/V-Sekai/godot-vrm) with `SisterRMRuntime`.

```gdscript
var runtime = SisterRMRuntime.new()
vrm.add_child(runtime)
runtime.init()
runtime.set_expression("happy", 0.8)
runtime.set_bone_rotation("leftUpperArm", Quaternion.from_euler(Vector3(0, 0, 0.5)))
runtime.set_first_person_enabled(true)
```

### aframe-vrm (TypeScript)

A-Frame components built on `@pixiv/three-vrm`.

```html
<a-entity vrm-model="src: avatar.vrm"
          vrm-expressions="happy: 0.8; blink: 1.0"
          vrm-look-at="target: #camera">
</a-entity>
```

## Protocol

All platforms communicate via WebSocket to `vrm-server` using a shared JSON protocol.

| Message | Direction | Description |
|---------|-----------|-------------|
| `join_room` | Client → Server | Enter a room with user_id and avatar_url |
| `avatar_delta` | Bidirectional | Transform, expressions, look_at, bone_rotations, spring_bone_params, material_params, constraint_params |
| `full_state` | Server → Client | Snapshot of all entities in room |
| `user_joined` / `user_left` | Server → Client | Presence events |

**Coordinate system**: SSCS (SisterRM Standard Coordinate System) — Y-up, right-handed, meters.

## Building

### Go Server
```bash
cd vrm-server
go build ./...
```

### A-Frame
```bash
cd aframe-vrm
npm install
npm run build
```

### Android Library
```bash
cd android-vrm
./gradlew assembleDebug
```

### Android Example App
```bash
cd example/Android-app
./gradlew :app:assembleDebug
```

### Godot
Import `godot-vrm/` as a Godot 4.x addon.

## Status

| Feature | Godot | A-Frame | Android |
|---------|-------|---------|---------|
| VRM Loading | ✅ | ✅ | ✅ |
| Expressions | ✅ | ✅ | ✅ |
| Look-At | ✅ | ✅ | ✅ |
| Humanoid Bones | ✅ | ✅ | ✅ |
| Spring Bone | ✅ | ✅ | ✅ (library) |
| First-Person | ✅ | ✅ | ✅ |
| VRMA Animation | ⏳ | ✅ | ⏳ |
| Network Sync | ✅ | ✅ | ✅ |
| MToon Materials | ✅ | ✅ | ✅ (library) |
| Node Constraints | ✅ | ✅ | ✅ (library) |

## License

MIT
