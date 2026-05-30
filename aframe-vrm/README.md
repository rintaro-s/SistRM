# aframe-vrm

A-Frame components for VRM avatars with metaverse synchronization.

## Components

| Component | Purpose |
|-----------|---------|
| `vrm-model` | Load and display a VRM model |
| `vrm-expressions` | Control facial expressions (happy, surprised, blink, etc.) |
| `vrm-look-at` | Eye/head tracking toward a target entity or camera |
| `vrm-spring-bone` | Configure spring bone physics parameters |
| `vrm-networked` | Connect to vrm-server and sync avatar state |

## Systems

| System | Purpose |
|--------|---------|
| `vrm` | Manages all VRM instances, calls `update(delta)` each frame |
| `vrm-network` | WebSocket hub, spawns/interpolates remote avatars |

## Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.7.0/aframe.min.js"></script>
  <script src="./dist/aframe-vrm.js"></script>
</head>
<body>
  <a-scene>
    <a-entity
      position="0 0 -2"
      vrm-model="src: ./avatar.vrm"
      vrm-expressions="happy: 0.5; blink: 1.0"
      vrm-look-at="target: #camera"
      vrm-networked="server: ws://localhost:8080/ws; room: lobby; userId: player-1"
    ></a-entity>
    <a-camera id="camera" look-controls wasd-controls></a-camera>
  </a-scene>
</body>
</html>
```

## Build

```bash
npm install
npm run build
```

## Network Protocol

Communicates with `vrm-server` via WebSocket using JSON messages:
- `join_room` / `leave_room`
- `avatar_delta` (transform, expressions, look_at)
- `full_state` (room snapshot)
- `room_event` (chat, RPC)
