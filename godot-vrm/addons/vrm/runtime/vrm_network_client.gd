class_name VRMNetworkClient
extends Node

## WebSocket client for SisterRM networked avatars.
## Protocol: JSON over WebSocket with SSCS coordinate system.
## Message types: join_room, avatar_delta, full_state, user_left

@export var server_url: String = "ws://localhost:8080"
@export var room_id: String = "default"
@export var user_id: String = ""
@export var update_rate_hz: float = 20.0
@export var avatar_scene: PackedScene = null
@export var local_avatar: NodePath = ^".."

var _websocket: WebSocketPeer = null
var _timer: Timer = null
var _local_vrm: Node3D = null
var _remote_avatars: Dictionary = {}  # user_id -> Node3D
var _connected: bool = false

signal user_joined(user_id: String, avatar: Node3D)
signal user_left(user_id: String)
signal connection_established
signal connection_closed


func _ready() -> void:
	if user_id.is_empty():
		user_id = str(randi())
	_local_vrm = get_node_or_null(local_avatar)
	_timer = Timer.new()
	_timer.wait_time = 1.0 / update_rate_hz
	_timer.timeout.connect(_on_timer_timeout)
	add_child(_timer)


func connect_to_server() -> void:
	if _websocket != null:
		return
	_websocket = WebSocketPeer.new()
	var err := _websocket.connect_to_url(server_url)
	if err != OK:
		push_error("VRMNetworkClient: Failed to connect to " + server_url)
		_websocket = null
		return
	set_process(true)


func disconnect_from_server() -> void:
	if _websocket != null:
		_websocket.close()
		_websocket = null
	_connected = false
	_timer.stop()
	set_process(false)


func _process(_delta: float) -> void:
	if _websocket == null:
		return
	_websocket.poll()
	var state := _websocket.get_ready_state()
	match state:
		WebSocketPeer.STATE_OPEN:
			if not _connected:
				_connected = true
				_send_join_room()
				_timer.start()
				connection_established.emit()
			while _websocket.get_available_packets() > 0:
				var packet := _websocket.get_packet()
				var text := packet.get_string_from_utf8()
				_handle_message(text)
		WebSocketPeer.STATE_CLOSED:
			_connected = false
			_timer.stop()
			connection_closed.emit()
			_websocket = null
			set_process(false)


func _send_join_room() -> void:
	_send_json({
		"type": "join_room",
		"room_id": room_id,
		"user_id": user_id,
		"avatar_url": "",
	})


func _on_timer_timeout() -> void:
	if not _connected or _local_vrm == null:
		return
	var delta := _gather_local_state()
	_send_json(delta)


func _gather_local_state() -> Dictionary:
	var expressions := {}
	var look_at_target := Vector3.ZERO
	if _local_vrm != null and _local_vrm.has_method("get_expression_manager"):
		var em := _local_vrm.get_expression_manager() as VRMExpressionManager
		if em != null:
			expressions = em.get_expression_values()
	if _local_vrm != null and _local_vrm.has_method("get_look_at"):
		var la := _local_vrm.get_look_at() as VRMLookAt
		if la != null:
			look_at_target = la.get_look_at_target()

	# Godot is natively SSCS (RH, Y-up); use converter explicitly for documentation
	var quat := _local_vrm.global_transform.basis.get_rotation_quaternion()
	var sscs := VRMCoordinateConverter.convert_transform(
		_local_vrm.global_position,
		quat,
		_local_vrm.global_scale,
		VRMCoordinateConverter.CoordinateSystem.SSCS,
		VRMCoordinateConverter.CoordinateSystem.SSCS
	)

	return {
		"type": "avatar_delta",
		"room_id": room_id,
		"user_id": user_id,
		"timestamp": Time.get_ticks_msec(),
		"transform": {
			"pos": [sscs.position.x, sscs.position.y, sscs.position.z],
			"rot": [sscs.rotation.x, sscs.rotation.y, sscs.rotation.z, sscs.rotation.w],
			"scale": [sscs.scale.x, sscs.scale.y, sscs.scale.z],
		},
		"expressions": expressions,
		"look_at": [look_at_target.x, look_at_target.y, look_at_target.z],
		"bone_rotations": {},
	}


func _send_json(data: Dictionary) -> void:
	if _websocket == null or not _connected:
		return
	var json := JSON.stringify(data)
	_websocket.send_text(json)


func _handle_message(text: String) -> void:
	var json := JSON.new()
	var err := json.parse(text)
	if err != OK:
		push_warning("VRMNetworkClient: Failed to parse JSON: " + text)
		return
	var data: Dictionary = json.get_data()
	var msg_type: String = data.get("type", "")
	match msg_type:
		"full_state":
			_update_room_state(data.get("entities", []))
		"user_joined":
			var uid: String = data.get("user_id", "")
			if uid != user_id and not _remote_avatars.has(uid):
				_spawn_remote(uid)
		"user_left":
			var uid: String = data.get("user_id", "")
			_despawn_remote(uid)


func _update_room_state(entities: Array) -> void:
	var present_uids: Dictionary = {}
	for entity in entities:
		var uid: String = entity.get("user_id", "")
		if uid == user_id or uid.is_empty():
			continue
		present_uids[uid] = true
		if not _remote_avatars.has(uid):
			_spawn_remote(uid)
		_apply_remote_state(uid, entity)
	# Despawn users no longer in room state
	var to_remove: Array[String] = []
	for uid in _remote_avatars.keys():
		if not present_uids.has(uid):
			to_remove.append(uid)
	for uid in to_remove:
		_despawn_remote(uid)


func _spawn_remote(uid: String) -> void:
	if avatar_scene == null:
		push_warning("VRMNetworkClient: No avatar_scene set for remote spawning")
		return
	var avatar: Node3D = avatar_scene.instantiate()
	if avatar == null:
		return
	avatar.name = "Remote_" + uid
	get_tree().current_scene.add_child(avatar)
	_remote_avatars[uid] = avatar
	user_joined.emit(uid, avatar)


func _despawn_remote(uid: String) -> void:
	if not _remote_avatars.has(uid):
		return
	var avatar: Node3D = _remote_avatars[uid]
	_remote_avatars.erase(uid)
	if is_instance_valid(avatar):
		avatar.queue_free()
	user_left.emit(uid)


func _apply_remote_state(uid: String, data: Dictionary) -> void:
	if not _remote_avatars.has(uid):
		return
	var avatar: Node3D = _remote_avatars[uid]
	var transform_data: Dictionary = data.get("transform", {})
	var pos_arr: Array = transform_data.get("pos", [0, 0, 0])
	var rot_arr: Array = transform_data.get("rot", [0, 0, 0, 1])
	var scl_arr: Array = transform_data.get("scale", [1, 1, 1])

	var pos := Vector3(pos_arr[0], pos_arr[1], pos_arr[2])
	var rot := Quaternion(rot_arr[0], rot_arr[1], rot_arr[2], rot_arr[3])
	var scl := Vector3(scl_arr[0], scl_arr[1], scl_arr[2])

	# Convert from SSCS to Godot (identity, but explicit)
	var godot := VRMCoordinateConverter.convert_transform(
		pos, rot, scl,
		VRMCoordinateConverter.CoordinateSystem.SSCS,
		VRMCoordinateConverter.CoordinateSystem.SSCS
	)
	avatar.global_transform = Transform3D(Basis(godot.rotation).scaled(godot.scale), godot.position)

	var expressions: Dictionary = data.get("expressions", {})
	if avatar.has_method("get_expression_manager"):
		var em := avatar.get_expression_manager() as VRMExpressionManager
		if em != null:
			for expr_name in expressions.keys():
				em.set_expression(expr_name, expressions[expr_name])

	var look_at_arr: Array = data.get("look_at", [])
	if look_at_arr.size() >= 3 and avatar.has_method("get_look_at"):
		var la := avatar.get_look_at() as VRMLookAt
		if la != null:
			la.target_position = Vector3(look_at_arr[0], look_at_arr[1], look_at_arr[2])


func get_remote_avatars() -> Dictionary:
	return _remote_avatars.duplicate()
