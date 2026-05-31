# SisterRM Godot VRM Runtime

Godot 4.2 VRM runtime with networked avatar support, spring-bone control, expression system, and Android export presets.

## Opening the Project

1. Install [Godot 4.2+](https://godotengine.org/).
2. Open Godot and click **Import**.
3. Select the `godot-vrm/project.godot` file.
4. The project loads with the VRM addon enabled.

## Scenes

- `vrm_samples/sample_scene.tscn` — Desktop demo with 3 avatars.
- `vrm_samples/mobile_scene.tscn` — Touch-friendly mobile demo with a single avatar, on-screen joystick, expression buttons, bone pose sliders, and network controls.

## Exporting to Android

1. In Godot, go to **Project → Export**.
2. The **Android** preset is already configured in `export_presets.cfg`:
   - Min SDK: 33
   - Target SDK: 36
   - `INTERNET` permission enabled
3. Install the Android build template if prompted (**Project → Install Android Build Template**).
4. Click **Export Project** or **Export PCK/ZIP**.

## SisterRMRuntime API

`SisterRMRuntime` is a `Node` that attaches to a VRM scene and provides high-level control.

### Initialization

```gdscript
var runtime = SisterRMRuntime.new()
avatar.add_child(runtime)
runtime.init()
```

### Expressions

```gdscript
runtime.set_expression("happy", 1.0)
var val = runtime.get_expression("happy")
runtime.reset_expressions()
var names = runtime.get_expression_names()
```

### Look-At

```gdscript
runtime.set_look_at_target(Vector3(0, 1.5, 3))
var target = runtime.get_look_at_target()
```

### Humanoid Bones

```gdscript
runtime.set_bone_rotation("Head", Quaternion.from_euler(Vector3(0, 0.3, 0)))
var rot = runtime.get_bone_rotation("Head")
runtime.reset_all_bones()
var bone_names = runtime.get_bone_names()
```

### Spring Bones

```gdscript
var count = runtime.get_spring_bone_count()
runtime.set_spring_bone_gravity(Vector3(0, -1, 0), 1.0)
runtime.set_spring_bone_stiffness(0.5)
```

### Constraints

```gdscript
runtime.apply_constraints()  # Placeholder for VRM 1.0 node constraints
```

### VRMA Animation Loading

```gdscript
runtime.load_vrma("res://animations/motion.vrma")
```

### Metadata

```gdscript
var meta = runtime.get_vrm_meta()
# Returns { "title": "...", "version": "...", "author": "...", "license": "..." }
```

### First-Person Mode

```gdscript
runtime.set_first_person_enabled(true)
var enabled = runtime.is_first_person_enabled()
```

## Network Protocol

The `SisterRMNetworkClient` node synchronizes avatar state over WebSocket.

### Setup

```gdscript
var client = SisterRMNetworkClient.new()
runtime.add_child(client)
client.server_url = "ws://localhost:8080/ws"
client.room_id = "room_1"
client.connect_to_server()
```

### Delta Messages (client → server)

Sent at `update_rate_hz` (default 20 Hz). Bone rotations are included only when they change.

```json
{
  "type": "avatar_delta",
  "room_id": "default",
  "user_id": "12345",
  "timestamp": 1717000000000,
  "transform": {
    "pos": [0, 0, 0],
    "rot": [0, 0, 0, 1],
    "scale": [1, 1, 1]
  },
  "expressions": { "happy": 0.8 },
  "look_at": [0, 1.5, 3],
  "bone_rotations": {
    "Head": [0, 0.13, 0, 0.99]
  }
}
```

### Server → Client Messages

- `full_state` — Array of all entities in the room.
- `user_joined` / `user_left` — Room membership events.
- `avatar_delta` — Per-user state update.

### Signals

```gdscript
client.connection_established.connect(func(): print("Connected"))
client.connection_closed.connect(func(): print("Disconnected"))
client.user_joined.connect(func(uid, avatar): print("User joined: " + uid))
client.user_left.connect(func(uid): print("User left: " + uid))
```
