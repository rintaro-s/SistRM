# SisterRM Cross-Platform Demo

This directory contains runnable demos for all SisterRM platforms using the same VRM model (`assets/avatar.vrm`).

## Quick Start

### 1. Start the Server

```bash
cd ../vrm-server
go run ./cmd/server
# Server runs on http://localhost:8080
# WebSocket at ws://localhost:8080/ws
```

### 2. Run the Web Demo (A-Frame)

```bash
cd ../aframe-vrm
npm install
npm run build
cd ../example
python3 -m http.server 3000
# Open http://localhost:3000/web/ in your browser
```

The A-Frame demo loads `aframe-vrm/dist/aframe-vrm.js` and displays a local avatar
with network sync.

### 3. Run the Godot Demo

Import `../godot-vrm/` as a Godot 4.x addon. Create a scene with:
- A `VRMTopLevel` node (import a VRM via the addon)
- A `SisterRMNetworkClient` child node

See `../godot-vrm/addons/vrm/runtime/README.md` for usage.

### 4. Run the Android Demo

```bash
cd Android-app
./gradlew assembleDebug
# Install app/build/outputs/apk/debug/app-debug.apk
```

The Android demo uses Google Filament to render the VRM with Compose UI overlay.
It includes expression sliders, bone display, and network sync.

## What Each Demo Shows

| Feature | Web (A-Frame) | Godot | Android |
|---------|--------------|-------|---------|
| VRM Loading | `@pixiv/three-vrm` | godot-vrm addon | Filament gltfio |
| Expressions | `VRMExpressionManager` | `SisterRMRuntime` | `VRMFilamentRenderer` + morph targets |
| LookAt | `VRMLookAt` | `SisterRMRuntime` | Camera manipulator |
| SpringBone | `VRMSpringBoneManager` | `VRMSecondary` | ⏳ |
| Network Sync | `vrm-network-system` | `SisterRMNetworkClient` | `VRMNetworkClient` |
| First-Person | `vrm-first-person` | `SisterRMRuntime` | `VRMFilamentRenderer` |
| VRMA Animation | `vrm-animation` | ⏳ | ⏳ |
| Coordinate System | Three.js (native SSCS) | Godot (native SSCS) | Filament (native SSCS) |

## Coordinate System

All demos use **SisterRM Standard Coordinate System (SSCS)**:
- Right-handed, Y-up, meters
- VRM 1.0 compliant

All target platforms (Godot, Three.js, Filament) are natively Y-up right-handed,
so SSCS is an identity mapping. The `CoordinateSystem` enum exists for future
Unity support.
