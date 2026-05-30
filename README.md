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
├── android-vrm/         # Kotlin parser + network client (reference)
├── example/
│   ├── Android-app/     # Working Android demo with Filament renderer
│   ├── web/             # A-Frame demo HTML
│   └── assets/          # avatar.vrm (VRM 1.0)
├── UniVRM/              # Unity reference implementation (upstream)
└── three-vrm/           # Web reference implementation (upstream)
```

## Architecture Philosophy: Library-First

**Do not reimplement VRM runtime logic.** Every platform already has a mature,
battle-tested VRM library. SisterRM wraps and extends these libraries with
network synchronization.

| Platform | Rendering Library | VRM Library | SisterRM Layer |
|----------|-------------------|-------------|----------------|
| **Godot** | Godot 4 Renderer | godot-vrm addon | `SisterRMRuntime` wrapper + `SisterRMNetworkClient` |
| **A-Frame** | Three.js WebGL | @pixiv/three-vrm | `vrm-model` + `vrm-networked` components |
| **Android** | Google Filament | gltfio + custom VRM mapping | `VRMFilamentRenderer` + `VRMNetworkClient` |

## Platform Libraries

### godot-vrm (GDScript)

Wraps the existing [godot-vrm addon](https://github.com/V-Sekai/godot-vrm) with a thin `SisterRMRuntime` node.

- **Expression control**: Reads/writes blend shapes and material values via the addon's `AnimationPlayer`
- **Humanoid bones**: Direct `Skeleton3D` access via `BoneMap`
- **Look-at**: Bone and expression modes
- **Spring bone**: Gravity and multiplier control
- **First-person**: Head mesh visibility toggle
- **Network**: `SisterRMNetworkClient` WebSocket node

```gdscript
var runtime = SisterRMRuntime.new()
vrm.add_child(runtime)
runtime.init()
runtime.set_expression("happy", 0.8)
runtime.set_first_person_enabled(true)
```

### aframe-vrm (TypeScript)

A-Frame components built on `@pixiv/three-vrm`.

- `vrm-model` — Load VRM via `GLTFLoader` + `VRMLoaderPlugin`
- `vrm-networked` — Send/receive `avatar_delta` at 20Hz
- `vrm-first-person` — Toggle first-person mesh visibility
- `vrm-animation` — Load and play `.vrma` animation files
- `vrm-system` — Tick all VRM instances each frame
- `vrm-network-system` — Spawn remote avatars, interpolate state

```html
<a-entity vrm-model="src: avatar.vrm"
          vrm-networked="server: ws://localhost:8080/ws; room: demo; userId: player-1"
          vrm-animation="src: wave.vrma">
</a-entity>
```

### Android (Kotlin + Filament)

`example/Android-app/` is a complete Compose-based demo with Google Filament rendering.

- **Renderer**: `VRMFilamentRenderer` — loads GLB, drives morph targets, manages camera
- **Expressions**: Maps parsed VRM binds to `RenderableManager.setMorphWeights()`
- **First-person**: Hides head mesh entities based on VRM first-person annotations
- **Network**: `VRMNetworkClient` with coordinate-aware delta sending

```kotlin
val renderer = VRMFilamentRenderer(surfaceView, assetManager)
renderer.loadVrm("avatar.vrm", vrmData)
renderer.setExpression("happy", 0.8f)
renderer.setFirstPersonEnabled(true)
```

## Protocol

All platforms communicate via WebSocket to `vrm-server` using a shared JSON protocol.

| Message | Direction | Description |
|---------|-----------|-------------|
| `join_room` | Client → Server | Enter a room with user_id and avatar_url |
| `avatar_delta` | Bidirectional | Transform (pos, rot, scale), expressions, look_at |
| `full_state` | Server → Client | Snapshot of all entities in room |
| `user_joined` / `user_left` | Server → Client | Presence events |

**Coordinate system**: SSCS (SisterRM Spatial Coordinate System) — Y-up, right-handed, meters.
All platforms are natively Y-up right-handed, so SSCS is an identity mapping for now.

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
# dist/aframe-vrm.js
```

### Android
```bash
cd example/Android-app
./gradlew assembleDebug
# app/build/outputs/apk/debug/app-debug.apk
```

### Godot
Import `godot-vrm/` as a Godot 4.x addon. `SisterRMRuntime` and `SisterRMNetworkClient`
are in `addons/vrm/runtime/`.

## Status

| Feature | Godot | A-Frame | Android |
|---------|-------|---------|---------|
| VRM Loading | ✅ (addon importer) | ✅ (three-vrm) | ✅ (Filament gltfio) |
| Expressions | ✅ | ✅ | ✅ (morph targets) |
| Look-At | ✅ | ✅ | ⏳ (camera only) |
| Humanoid Bones | ✅ | ✅ | ⏳ (transform API) |
| Spring Bone | ✅ (addon) | ✅ (three-vrm) | ⏳ |
| First-Person | ✅ | ✅ | ✅ |
| VRMA Animation | ⏳ | ✅ | ⏳ |
| Network Sync | ✅ | ✅ | ✅ |
| MToon Materials | ✅ (addon) | ✅ (three-vrm) | ⏳ (PBR fallback) |

## License

MIT
