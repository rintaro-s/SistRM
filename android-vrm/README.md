# android-vrm

Native Android VRM runtime library written in Kotlin. Designed to work with Google Filament or any custom renderer via a clean interface.

## Modules

| Module | Purpose |
|--------|---------|
| `vrm-loader` | glTF 2.0 + VRM 0.0/1.0 JSON parsing (pure Kotlin) |
| `vrm-core` | Humanoid, Expressions, LookAt, FirstPerson, Meta, math utilities |
| `vrm-springbone` | Spring bone physics simulation (Verlet integration) |
| `vrm-constraint` | Roll, Aim, Rotation node constraints |
| `vrm-material` | MToon material parameter definitions |
| `vrm-network` | WebSocket client for vrm-server sync |
| `vrm-sample` | Sample Android app skeleton |

## Architecture

```
VRMInstance
├── humanoid: VRMHumanoid
│   ├── getBone(HIPS) -> Bone
│   └── getNormalizedBone(HIPS) -> Bone
├── expressions: VRMExpressionManager
│   ├── setValue("happy", 0.5f)
│   └── getValue("happy")
├── lookAt: VRMLookAt
├── firstPerson: VRMFirstPerson
├── springBone: VRMSpringBoneManager
├── nodeConstraint: VRMNodeConstraintManager
└── meta: VRMMeta
```

## Usage

```kotlin
// 1. Parse VRM file
val gltfRoot = GltfParser.parse(jsonString)
val vrmData = VrmData.fromGltf(gltfRoot)

// 2. Build VRMInstance (renderer integration required for mesh/skeleton)
val instance = VRMInstance(
    humanoid = buildHumanoid(vrmData),
    expressions = buildExpressionManager(vrmData),
    lookAt = VRMLookAt(...),
    firstPerson = VRMFirstPerson(...),
    meta = VRMMeta(...),
    springBone = buildSpringBoneManager(vrmData),
    nodeConstraint = buildConstraintManager(vrmData)
)

// 3. Update each frame
instance.update(deltaTime)

// 4. Network sync
val client = VRMNetworkClient()
client.connect("ws://server:8080/ws")
client.joinRoom("lobby", "user-1", "avatar.vrm")
```

## Dependencies

- Kotlin 1.9.22
- kotlinx.serialization 1.6.2
- kotlinx.coroutines 1.7.3
- Java-WebSocket 1.5.6 (network module)

## Integration with Filament

The library is renderer-agnostic. To integrate with Filament:
1. Use `gltfio` to load the glTF binary
2. Map `VRMHumanoid` bone indices to Filament entity transforms
3. Apply expression weights as morph target weights via `RenderableManager`
4. Use Filament's `Material` system for MToon shading
