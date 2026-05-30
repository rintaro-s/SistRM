# Godot SisterRM Runtime

Thin wrapper around the godot-vrm addon's imported VRM scene.

## Classes

| Class | Purpose |
|-------|---------|
| `SisterRMRuntime` | Expression control, humanoid bones, look-at, first-person, spring bones |
| `SisterRMNetworkClient` | WebSocket client for vrm-server sync |

## Usage

```gdscript
# After importing a VRM model into your scene:
var vrm: VRMTopLevel = $VRMModel
var runtime = SisterRMRuntime.new()
vrm.add_child(runtime)
runtime.init()

# Expressions
runtime.set_expression("happy", 0.8)
runtime.set_expression("blink", 1.0)

# Humanoid bones
runtime.set_bone_rotation("leftUpperArm", Quaternion.from_euler(Vector3(0, 0, 1)))

# LookAt
runtime.set_look_at_target($Player.global_position)

# First-person
runtime.set_first_person_enabled(true)

# Network sync
var client = SisterRMNetworkClient.new()
client.server_url = "ws://localhost:8080/ws"
client.room_id = "lobby"
client.user_id = "player-1"
client.remote_avatar_scene = preload("res://remote_vrm.tscn")
client.connect_to_server()
```

## Network Protocol

Connects to `vrm-server` and sends/receives:
- `avatar_delta`: position, rotation (quaternion), expressions, look_at
- `full_state`: room snapshot with all remote avatars
- `user_joined` / `user_left`: presence events

Transforms use quaternion arrays `[x, y, z, w]` and SSCS coordinates.
