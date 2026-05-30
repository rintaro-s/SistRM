# aframe-vrm

A-Frame components for VRM avatars with metaverse sync, built on `@pixiv/three-vrm`.

## Components

| Component | Purpose |
|-----------|---------|
| `vrm-model` | Load VRM via `GLTFLoader` + `VRMLoaderPlugin` |
| `vrm-networked` | Send/receive `avatar_delta` at 20Hz |
| `vrm-first-person` | Toggle first-person mesh visibility |
| `vrm-animation` | Load and play `.vrma` animation files |

## Systems

| System | Purpose |
|--------|---------|
| `vrm-system` | Tick all VRM instances each frame |
| `vrm-network-system` | Spawn remote avatars, interpolate state |

## Build

```bash
npm install
npm run build
# dist/aframe-vrm.js
```

## Usage

```html
<script src="https://aframe.io/releases/1.5.0/aframe.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="dist/aframe-vrm.js"></script>

<a-scene>
  <a-entity id="avatar"
    vrm-model="src: avatar.vrm"
    vrm-networked="server: ws://localhost:8080/ws; room: demo; userId: player-1"
    vrm-animation="src: wave.vrma"
    position="0 0 -2">
  </a-entity>
</a-scene>
```

## Network Protocol

Connects to `vrm-server` and sends/receives:
- `avatar_delta`: transform (pos, rot, scale), expressions, look_at
- `full_state`: room snapshot with all remote avatars
- `user_joined` / `user_left`: presence events
