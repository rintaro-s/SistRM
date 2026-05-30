# Godot VRM Runtime API

New runtime control classes for the Godot VRM addon.

## Classes

| Class | Purpose |
|-------|---------|
| `VRMInstance` | Main runtime controller (extends VRMTopLevel) |
| `VRMHumanoid` | Bone access and normalized posing via Skeleton3D |
| `VRMExpressionManager` | Runtime expression control without AnimationPlayer |
| `VRMLookAt` | Eye/head tracking toward a target |
| `VRMNetworkClient` | WebSocket client for vrm-server sync |
| `VRMAnimationPlayer` | Load and play `.vrma` animation files |

## Usage

```gdscript
# After importing a VRM model, attach VRMInstance script
# or use the existing VRMTopLevel which now supports runtime mode.

var vrm: VRMInstance = $VRMModel

# Expressions
vrm.get_vrm_expression_manager().set_expression("happy", 0.8)
vrm.get_vrm_expression_manager().set_expression("blink", 1.0)

# Humanoid bones
vrm.get_vrm_humanoid().set_bone_rotation("leftUpperArm", Quaternion.from_euler(Vector3(0, 0, 1)))

# LookAt
vrm.get_vrm_look_at().set_target($Player.global_position)
vrm.get_vrm_look_at().set_look_at_type(VRMLookAt.LookAtType.Expression)

# Network sync
vrm.network_sync = true
vrm.server_url = "ws://localhost:8080/ws"
vrm.room_id = "lobby"
vrm.user_id = "player-1"
```

## Network Protocol

Connects to `vrm-server` and sends/receives:
- `avatar_delta`: position, rotation, expressions, look_at
- `full_state`: room snapshot with all remote avatars
- `user_joined` / `user_left`: presence events
