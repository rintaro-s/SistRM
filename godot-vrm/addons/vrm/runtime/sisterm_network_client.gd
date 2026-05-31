class_name SisterRMNetworkClient
extends Node

## WebSocket client for SisterRM networked avatars.
## Works with SisterRMRuntime to send/receive avatar state.

@export var server_url: String = "ws://localhost:8080/ws"
@export var room_id: String = "default"
@export var user_id: String = ""
@export var update_rate_hz: float = 20.0
@export var avatar_scene: PackedScene = null

var _websocket: WebSocketPeer = null
var _timer: Timer = null
var _runtime: SisterRMRuntime = null
var _remote_avatars: Dictionary = {}  # user_id -> {runtime: SisterRMRuntime, node: Node3D}
var _connected: bool = false
var _last_bone_rotations: Dictionary = {}

signal user_joined(user_id: String, avatar: Node3D)
signal user_left(user_id: String)
signal connection_established
signal connection_closed


func _ready() -> void:
	if user_id.is_empty():
		user_id = str(randi())
	_timer = Timer.new()
	_timer.wait_time = 1.0 / update_rate_hz
	_timer.timeout.connect(_on_timer_timeout)
	add_child(_timer)

	# Find runtime in parent
	var parent := get_parent()
	if parent is SisterRMRuntime:
		_runtime = parent
	else:
		# Try to find it as a sibling or in the VRM scene
		for child in parent.get_children():
			if child is SisterRMRuntime:
				_runtime = child
				break


func connect_to_server() -> void:
	if _websocket != null:
		return
	_websocket = WebSocketPeer.new()
	var err := _websocket.connect_to_url(server_url)
	if err != OK:
		push_error("SisterRMNetworkClient: Failed to connect to " + server_url)
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


func send_bone_rotations(bone_rotations: Dictionary) -> void:
	if not _connected:
		return
	_send_json({
		"type": "bone_rotations",
		"room_id": room_id,
		"user_id": user_id,
		"bone_rotations": bone_rotations,
	})


func _on_timer_timeout() -> void:
	if not _connected or _runtime == null:
		return
	var state := _runtime.get_network_state()
	var bone_rots: Dictionary = state.get("bone_rotations", {})
	var include_bones := false
	if bone_rots != _last_bone_rotations:
		_last_bone_rotations = bone_rots.duplicate(true)
		include_bones = true
	var delta := {
		"type": "avatar_delta",
		"room_id": room_id,
		"user_id": user_id,
		"timestamp": Time.get_ticks_msec(),
		"transform": state.transform,
		"expressions": state.expressions,
		"look_at": state.look_at,
		"bone_rotations": bone_rots if include_bones else {},
	}
	_send_json(delta)


func _send_json(data: Dictionary) -> void:
	if _websocket == null or not _connected:
		return
	var json := JSON.stringify(data)
	_websocket.send_text(json)


func _handle_message(text: String) -> void:
	var json := JSON.new()
	var err := json.parse(text)
	if err != OK:
		push_warning("SisterRMNetworkClient: Failed to parse JSON: " + text)
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
		"avatar_delta":
			var uid: String = data.get("user_id", "")
			if uid != user_id:
				_apply_remote_delta(uid, data)


func _update_room_state(entities: Array) -> void:
	var present_uids: Dictionary = {}
	for entity in entities:
		var uid: String = entity.get("user_id", "")
		if uid == user_id or uid.is_empty():
			continue
		present_uids[uid] = true
		if not _remote_avatars.has(uid):
			_spawn_remote(uid)
		_apply_remote_delta(uid, entity)
	# Despawn users no longer in room state
	var to_remove: Array[String] = []
	for uid in _remote_avatars.keys():
		if not present_uids.has(uid):
			to_remove.append(uid)
	for uid in to_remove:
		_despawn_remote(uid)


func _spawn_remote(uid: String) -> void:
	if avatar_scene == null:
		push_warning("SisterRMNetworkClient: No avatar_scene set for remote spawning")
		return
	var avatar: Node3D = avatar_scene.instantiate()
	if avatar == null:
		return
	avatar.name = "Remote_" + uid
	get_tree().current_scene.add_child(avatar)

	# Try to find or attach a SisterRMRuntime
	var runtime: SisterRMRuntime = null
	for child in avatar.get_children():
		if child is SisterRMRuntime:
			runtime = child
			break
	if runtime == null:
		runtime = SisterRMRuntime.new()
		avatar.add_child(runtime)
		runtime.init()

	_remote_avatars[uid] = {"node": avatar, "runtime": runtime}
	user_joined.emit(uid, avatar)


func _despawn_remote(uid: String) -> void:
	if not _remote_avatars.has(uid):
		return
	var data: Dictionary = _remote_avatars[uid]
	var avatar: Node3D = data.node
	_remote_avatars.erase(uid)
	if is_instance_valid(avatar):
		avatar.queue_free()
	user_left.emit(uid)


func _apply_remote_delta(uid: String, data: Dictionary) -> void:
	if not _remote_avatars.has(uid):
		_spawn_remote(uid)
	var remote_data: Dictionary = _remote_avatars[uid]
	var runtime: SisterRMRuntime = remote_data.runtime
	if runtime == null:
		return

	var state: Dictionary = {}

	var transform_data: Dictionary = data.get("transform", {})
	if not transform_data.is_empty():
		state["transform"] = transform_data

	var expressions: Dictionary = data.get("expressions", {})
	if not expressions.is_empty():
		state["expressions"] = expressions

	var look_at: Array = data.get("look_at", [])
	if look_at.size() >= 3:
		state["look_at"] = look_at

	var bone_rots: Dictionary = data.get("bone_rotations", {})
	if not bone_rots.is_empty():
		state["bone_rotations"] = bone_rots

	runtime.apply_network_state(state)


func get_remote_avatars() -> Dictionary:
	var result: Dictionary = {}
	for uid in _remote_avatars.keys():
		result[uid] = _remote_avatars[uid].node
	return result
