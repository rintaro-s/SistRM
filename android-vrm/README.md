# android-vrm

**Reference parser and network client for VRM on Android.**

This library provides **parsing** and **networking** utilities for VRM 0.0/1.0.
It is intentionally **not a runtime renderer** — rendering is delegated to
Google Filament (via `gltfio`) or another engine of your choice.

The previous stub runtime reimplementations (`VRMHumanoid`, `VRMExpressionManager`,
`VRMInstance`, `VRMSpringBoneManager`, etc.) have been removed. They were
parallel reimplementations that duplicated functionality already present in
mature rendering engines. See `example/Android-app/` for the working Filament
integration.

## Modules

| Module | Purpose |
|--------|---------|
| `vrm-loader` | glTF 2.0 + VRM 0.0/1.0 JSON parsing (pure Kotlin) |
| `vrm-core` | Coordinate converter + math utilities (`Vector3`, `Quaternion`, `Matrix4`) |
| `vrm-network` | WebSocket client for vrm-server sync |

## Architecture

```
Application (example/Android-app/)
├── Google Filament (gltfio)  ← renders the VRM mesh, skinning, morph targets
├── VRMFilamentRenderer       ← SisterRM wrapper: loads GLB, drives expressions
│   ├── AssetLoader.createAsset(buffer)
│   ├── ResourceLoader.loadResources(asset)
│   └── RenderableManager.setMorphWeights(...)  ← expression control
├── Parsed VRM Data
│   ├── VrmData (from GltfParser)
│   └── expression name → (entity, morphIndex, weightScale) mapping
└── VRMNetworkClient          ← WebSocket sync with vrm-server
```

## Usage

```kotlin
// 1. Parse VRM metadata
val gltfRoot = GltfParser.parse(jsonString)
val vrmData = VrmData.fromGltf(gltfRoot)

// 2. Render with Filament (see example/Android-app/)
val renderer = VRMFilamentRenderer(surfaceView, assetManager)
renderer.loadVrm("avatar.vrm", vrmData)
renderer.setExpression("happy", 0.8f)

// 3. Network sync
val client = VRMNetworkClient()
client.connect("ws://server:8080/ws")
client.joinRoom("lobby", "user-1", "avatar.vrm")
client.sendDeltaFromLocal(userId, position, rotation, scale, expressions, lookAt)
```

## Dependencies

- Kotlin 2.2.10
- kotlinx.serialization 1.8.1
- kotlinx.coroutines 1.10.1
- Java-WebSocket 1.5.6 (network module)

## Integration with Filament

1. Use `gltfio.AssetLoader` to load the GLB binary
2. Map parsed VRM expression binds to `RenderableManager.setMorphWeights(entity, weights, offset)`
3. Use Filament's `Material` system for custom shading (MToon can be implemented as a custom Filament material)
4. Drive bone transforms via `TransformManager` for humanoid pose

See `example/Android-app/app/src/main/java/com/nbks/vrm/render/VRMFilamentRenderer.kt`
for a complete working implementation.
