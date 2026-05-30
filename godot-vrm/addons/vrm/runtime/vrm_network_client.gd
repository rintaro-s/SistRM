class_name VRMNetworkClient
extends Node

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
				_send_join()
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


func _send_join() -> void:
	_send_json({
		"type": "join",
		"room_id": room_id,
		"user_id": user_id,
	})


func _on_timer_timeout() -> void:
	if not _connected or _local_vrm == null:
		return
	var state := _gather_local_state()
	_send_json(state)


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

	return {
		"type": "state",
		"room_id": room_id,
		"user_id": user_id,
		"transform": {
			"position": [_local_vrm.global_position.x, _local_vrm.global_position.y, _local_vrm.global_position.z],
			"rotation": [_local_vrm.global_rotation.x, _local_vrm.global_rotation.y, _local_vrm.global_rotation.z],
			"scale": [_local_vrm.global_scale.x, _local_vrm.global_scale.y, _local_vrm.global_scale.z],
		},
		"expressions": expressions,
		"look_at": {
			"x": look_at_target.x,
			"y": look_at_target.y,
			"z": look_at_target.z,
		},
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
		"room_state":
			_update_room_state(data.get("users", {}))
		"user_left":
			var uid: String = data.get("user_id", "")
			_despawn_remote(uid)


func _update_room_state(users: Dictionary) -> void:
	for uid in users.keys():
		if uid == user_id:
			continue
		var user_data: Dictionary = users[uid]
		if not _remote_avatars.has(uid):
			_spawn_remote(uid)
		_apply_remote_state(uid, user_data)
	# Despawn users no longer in room state
	var to_remove: Array[String] = []
	for uid in _remote_avatars.keys():
		if not users.has(uid):
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
	var pos: Array = transform_data.get("position", [0, 0, 0])
	var rot: Array = transform_data.get("rotation", [0, 0, 0])
	var scl: Array = transform_data.get("scale", [1, 1, 1])
	avatar.global_position = Vector3(pos[0], pos[1], pos[2])
	avatar.global_rotation = Vector3(rot[0], rot[1], rot[2])
	avatar.global_scale = Vector3(scl[0], scl[1], scl[2])

	var expressions: Dictionary = data.get("expressions", {})
	if avatar.has_method("get_expression_manager"):
		var em := avatar.get_expression_manager() as VRMExpressionManager
		if em != null:
			for expr_name in expressions.keys():
				em.set_expression(expr_name, expressions[expr_name])

	var look_at_data: Dictionary = data.get("look_at", {})
	if avatar.has_method("get_look_at"):
		var la := avatar.get_look_at() as VRMLookAt
		if la != null:
			la.target_position = Vector3(
				look_at_data.get("x", 0.0),
				look_at_data.get("y", 0.0),
				look_at_data.get("z", 0.0)
			)


func get_remote_avatars() -> Dictionary:
	return _remote_avatars.duplicate()
