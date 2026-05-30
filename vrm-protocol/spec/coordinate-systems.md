# SisterRM Standard Coordinate System (SSCS)

## Definition

The SisterRM Standard Coordinate System is the canonical reference frame for all cross-platform VRM data exchange.

| Property | Value |
|----------|-------|
| Handedness | Right-handed |
| Up axis | +Y |
| Forward axis | -Z |
| Rotation rule | Right-hand rule |
| Units | Meters |
| Quaternion | `(x, y, z, w)` — right-hand rule |
| Model orientation | Faces `-Z` (VRM 1.0 spec compliant) |

## Rationale

The SSCS matches the **VRM 1.0 specification** and the native coordinate systems of Three.js, Godot, and Filament. This means most platforms require **zero conversion** for VRM 1.0 models.

## Platform Native Coordinate Systems

| Platform | Handedness | Up | Forward | Native ↔ SSCS |
|----------|-----------|-----|---------|---------------|
| **Three.js** | RH | +Y | -Z | **Identity** |
| **A-Frame** | RH | +Y | -Z | **Identity** |
| **Godot 4** | RH | +Y | -Z | **Identity** |
| **Android / Filament** | RH | +Y | -Z | **Identity** |
| **Unity / UniVRM** | LH | +Y | +Z (world) | **Requires conversion** |
| **VRM 0.0 (raw)** | RH | +Y | +Z (spec error) | **Requires pre-correction** |

## Conversion Formulas

### Unity Left-Handed ↔ SSCS Right-Handed

Both are Y-up. The difference is the X-axis direction (mirroring).

#### Position / Vector
```
LH → RH:  (x, y, z) → (-x, y, z)
RH → LH:  (x, y, z) → (-x, y, z)
```

#### Rotation (Quaternion)

The mathematically robust method uses matrix conversion:

```
LH → RH:
  1. Convert quaternion to 3×3 rotation matrix
  2. Apply: R' = F · R · F  where F = diag(-1, 1, 1)
  3. Decompose R' back to quaternion
  
  Simplified matrix effect on R:
    R'[0][0] =  R[0][0]     R'[0][1] = -R[0][1]     R'[0][2] = -R[0][2]
    R'[1][0] = -R[1][0]     R'[1][1] =  R[1][1]     R'[1][2] =  R[1][2]
    R'[2][0] = -R[2][0]     R'[2][1] =  R[2][1]     R'[2][2] =  R[2][2]
  
  Equivalently, decomposed into axis-angle: negate all rotation angles.
  Quaternion: (x, y, z, w) → (-x, -y, -z, w)  [conjugate / inverse rotation]

RH → LH:  Same operation (self-inverse).
```

#### Scale
```
Scale is invariant: (sx, sy, sz) → (sx, sy, sz)
```

#### Transform Matrix (4×4)
```
LH ↔ RH:  M' = F · M · F  where F = diag(-1, 1, 1, 1)
```

### VRM 0.0 Orientation Correction

VRM 0.0 has a specification error where models face `+Z` instead of `-Z`. This is corrected at import time by each library:

| Library | Correction Applied |
|---------|-------------------|
| UniVRM | 180° Y rotation + coordinate adaptation |
| three-vrm | `VRMUtils.rotateVRM0()` — 180° Y rotation |
| Godot-vrm | `offset_flip = Vector3(-1, 1, 1)` + scene rotation |
| android-vrm | Apply 180° Y rotation quaternion to root node |

**After VRM 0.0 correction, the model conforms to SSCS.**

## Network Protocol Coordinates

All WebSocket messages (`avatar_delta`, `full_state`) use **SSCS** natively.

```json
{
  "transform": {
    "pos": [0.0, 1.0, -2.0],
    "rot": [0.0, 0.0, 0.0, 1.0],
    "scale": [1.0, 1.0, 1.0]
  },
  "look_at": [1.0, 1.6, -3.0]
}
```

### Server Validation

The Go server validates that all incoming coordinates are within SSCS bounds:
- Position components: ±1,000,000 meters
- Rotation quaternion: normalized, components in [-1, 1]
- Scale components: [0.001, 1000]

### Client Responsibilities

- **Three.js / A-Frame / Godot / Android clients**: Send/receive coordinates as-is (identity mapping).
- **Unity clients**: Convert LH → RH before sending, RH → LH after receiving.

## Direct Cross-Library Conversion

Libraries can convert directly to each other without the server:

```
Platform A → SSCS → Platform B
```

Since SSCS is the identity for most platforms, the conversion graph is:

```
Unity LH ←→ SSCS/RH ←→ Identity for: Three.js, Godot, Android, A-Frame
```

All libraries provide `toStandard()` and `fromStandard()` utilities. Direct `convert(A, B)` is a composition of these two.
