# SisterRM Cross-Platform Demo

This directory contains runnable demos for all SisterRM platforms using the same VRM model (`assets/avatar.vrm`).

## Quick Start

### 1. Start the Server

```bash
cd ../vrm-server
go run ./cmd/server
# Server runs on http://localhost:8080
```

### 2. Run the Web Demo (A-Frame)

```bash
cd ../aframe-vrm
npm install
npm run build
cp dist/aframe-vrm.js ../example/web/
cd ../example
python3 -m http.server 3000
# Open http://localhost:3000/web/ in your browser
```

### 3. Run the Godot Demo

Copy the demo files into the Godot VRM project:
```bash
cp godot/demo_scene.tscn godot/demo_script.gd ../godot-vrm/
cp -r assets ../godot-vrm/
```

Open `../godot-vrm/` in Godot 4.2+ and run `demo_scene.tscn`.

### 4. Run the Android Demo

Open `../android-vrm` in Android Studio and run the `:vrm-sample:installDebug` task.

Or use the standalone example activity at `android/MainActivity.kt` — copy it into the sample module and wire it into `AndroidManifest.xml`.

## What Each Demo Shows

| Feature | Web (A-Frame) | Godot | Android |
|---------|--------------|-------|---------|
| VRM Loading | `vrm-model` component | GLTF import + VRMInstance | GltfParser + VrmData |
| Expressions | `vrm-expressions` | VRMExpressionManager | VRMExpressionManager |
| LookAt | `vrm-look-at` | VRMLookAt | VRMLookAt |
| SpringBone | `vrm-spring-bone` | vrm_secondary | VRMSpringBoneManager |
| Network Sync | `vrm-networked` | VRMNetworkClient | VRMNetworkClient |
| Coordinate System | Three.js (native SSCS) | Godot (native SSCS) | Filament-ready (native SSCS) |

## Coordinate System

All demos use **SisterRM Standard Coordinate System (SSCS)**:
- Right-handed, Y-up, -Z forward
- VRM 1.0 compliant

Libraries can convert directly between platform-native coordinates without the server. See `../vrm-protocol/spec/coordinate-systems.md`.
