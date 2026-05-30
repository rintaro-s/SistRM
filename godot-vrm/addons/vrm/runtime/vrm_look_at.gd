class_name VRMLookAt
extends RefCounted

enum LookAtType {
	NONE,
	BONE,
	EXPRESSION
}

var _vrm_instance: Node3D
var _humanoid: VRMHumanoid
var _expression_manager: VRMExpressionManager = null

var target: Node3D = null
var target_position: Vector3 = Vector3.ZERO
var look_at_type: LookAtType = LookAtType.BONE

# Parsed max rotations for bone look-at (look_rot = base.inverse() * quat)
var _left_look_left: Quaternion = Quaternion.IDENTITY
var _left_look_right: Quaternion = Quaternion.IDENTITY
var _left_look_up: Quaternion = Quaternion.IDENTITY
var _left_look_down: Quaternion = Quaternion.IDENTITY
var _right_look_left: Quaternion = Quaternion.IDENTITY
var _right_look_right: Quaternion = Quaternion.IDENTITY
var _right_look_up: Quaternion = Quaternion.IDENTITY
var _right_look_down: Quaternion = Quaternion.IDENTITY

var _left_eye_bone_idx: int = -1
var _right_eye_bone_idx: int = -1
var _head_bone_idx: int = -1
var _eye_bone_horizontal: Quaternion = Quaternion.from_euler(Vector3(PI / 2.0, 0.0, 0.0))

# Range defaults (parsed from animations if available)
var _input_max_yaw: float = 90.0
var _input_max_pitch: float = 90.0


func _init(vrm_instance: Node3D) -> void:
	_vrm_instance = vrm_instance
	_humanoid = VRMHumanoid.new(vrm_instance)
	_parse_look_at_data()


func set_expression_manager(em: VRMExpressionManager) -> void:
	_expression_manager = em


func _find_animation_player() -> AnimationPlayer:
	if _vrm_instance.has_node("AnimationPlayer"):
		return _vrm_instance.get_node("AnimationPlayer") as AnimationPlayer
	for child in _vrm_instance.get_children():
		if child is AnimationPlayer:
			return child
	return null


func _find_skeleton() -> Skeleton3D:
	return _humanoid.get_skeleton()


func _parse_look_at_data() -> void:
	var anim_player: AnimationPlayer = _find_animation_player()
	var skeleton: Skeleton3D = _find_skeleton()
	if skeleton == null:
		return

	# Find head bone
	_head_bone_idx = skeleton.find_bone("Head")
	if _head_bone_idx == -1:
		var bone_map := _humanoid.get_bone_map()
		if bone_map != null and bone_map.profile != null:
			var head_name := bone_map.get_skeleton_bone_name("Head")
			if not head_name.is_empty():
				_head_bone_idx = skeleton.find_bone(head_name)

	# Determine look-at type and parse data from animations
	if anim_player != null:
		if anim_player.has_animation("lookLeft"):
			var anim: Animation = anim_player.get_animation("lookLeft")
			if anim != null and anim.get_track_count() > 0:
				var track_type := anim.track_get_type(0)
				if track_type == Animation.TYPE_ROTATION_3D:
					look_at_type = LookAtType.BONE
					_parse_bone_look_at(anim_player, skeleton)
				else:
					look_at_type = LookAtType.EXPRESSION
					_parse_expression_look_at(anim_player)
		elif anim_player.has_animation("lookUp"):
			var anim: Animation = anim_player.get_animation("lookUp")
			if anim != null and anim.get_track_count() > 0:
				var track_type := anim.track_get_type(0)
				if track_type == Animation.TYPE_ROTATION_3D:
					look_at_type = LookAtType.BONE
					_parse_bone_look_at(anim_player, skeleton)
				else:
					look_at_type = LookAtType.EXPRESSION
					_parse_expression_look_at(anim_player)

	# Fallback eye bone detection
	if look_at_type == LookAtType.BONE and _left_eye_bone_idx == -1:
		_left_eye_bone_idx = skeleton.find_bone("LeftEye")
		_right_eye_bone_idx = skeleton.find_bone("RightEye")
		if _left_eye_bone_idx == -1:
			var bone_map := _humanoid.get_bone_map()
			if bone_map != null:
				var left_name := bone_map.get_skeleton_bone_name("LeftEye")
				var right_name := bone_map.get_skeleton_bone_name("RightEye")
				if not left_name.is_empty():
					_left_eye_bone_idx = skeleton.find_bone(left_name)
				if not right_name.is_empty():
					_right_eye_bone_idx = skeleton.find_bone(right_name)

	# If no animations at all, default to BONE if eyes exist
	if look_at_type == LookAtType.NONE and (_left_eye_bone_idx != -1 or _right_eye_bone_idx != -1):
		look_at_type = LookAtType.BONE


func _parse_bone_look_at(anim_player: AnimationPlayer, skeleton: Skeleton3D) -> void:
	for dir_name in ["lookLeft", "lookRight", "lookUp", "lookDown"]:
		if not anim_player.has_animation(dir_name):
			continue
		var anim: Animation = anim_player.get_animation(dir_name)
		if anim == null:
			continue
		for i in range(anim.get_track_count()):
			if anim.track_get_type(i) != Animation.TYPE_ROTATION_3D:
				continue
			var track_path := anim.track_get_path(i)
			var bone_name := str(track_path.get_subname(0))
			var is_left_eye := bone_name.contains_nocase("left") or bone_name == "leftEye"
			var is_right_eye := bone_name.contains_nocase("right") or bone_name == "rightEye"
			var quat: Quaternion = anim.track_get_key_value(i, 0)
			var look_rot := _eye_bone_horizontal.inverse() * quat
			match dir_name:
				"lookLeft":
					if is_left_eye:
						_left_look_left = look_rot
					if is_right_eye:
						_right_look_left = look_rot
				"lookRight":
					if is_left_eye:
						_left_look_right = look_rot
					if is_right_eye:
						_right_look_right = look_rot
				"lookUp":
					if is_left_eye:
						_left_look_up = look_rot
					if is_right_eye:
						_right_look_up = look_rot
				"lookDown":
					if is_left_eye:
						_left_look_down = look_rot
					if is_right_eye:
						_right_look_down = look_rot
			if _left_eye_bone_idx == -1 and is_left_eye:
				_left_eye_bone_idx = skeleton.find_bone(bone_name)
			if _right_eye_bone_idx == -1 and is_right_eye:
				_right_eye_bone_idx = skeleton.find_bone(bone_name)
			# Try to infer input max from key time
			var key_time := anim.track_get_key_time(i, 0)
			if key_time > 0.0:
				_input_max_yaw = maxf(_input_max_yaw, key_time * 180.0)
				_input_max_pitch = maxf(_input_max_pitch, key_time * 180.0)


func _parse_expression_look_at(anim_player: AnimationPlayer) -> void:
	for dir_name in ["lookLeft", "lookRight", "lookUp", "lookDown"]:
		if not anim_player.has_animation(dir_name):
			continue
		var anim: Animation = anim_player.get_animation(dir_name)
		if anim == null or anim.get_track_count() == 0:
			continue
		var key_time := anim.track_get_key_time(0, 0)
		if key_time > 0.0:
			_input_max_yaw = maxf(_input_max_yaw, key_time * 180.0)
			_input_max_pitch = maxf(_input_max_pitch, key_time * 180.0)


func update(delta: float) -> void:
	if look_at_type == LookAtType.NONE:
		return

	var target_pos: Vector3 = target_position
	if target != null and is_instance_valid(target):
		target_pos = target.global_position

	if _head_bone_idx == -1:
		return

	var skeleton: Skeleton3D = _find_skeleton()
	if skeleton == null:
		return

	var head_global: Transform3D = skeleton.global_transform * skeleton.get_bone_global_pose(_head_bone_idx)
	var head_to_target: Vector3 = target_pos - head_global.origin
	if head_to_target.is_zero_approx():
		return

	var local_dir: Vector3 = head_global.basis.inverse() * head_to_target
	local_dir = local_dir.normalized()

	var yaw: float = atan2(local_dir.x, local_dir.z)
	var pitch: float = atan2(local_dir.y, sqrt(local_dir.x * local_dir.x + local_dir.z * local_dir.z))

	var yaw_norm: float = clampf(yaw / deg_to_rad(_input_max_yaw), -1.0, 1.0)
	var pitch_norm: float = clampf(pitch / deg_to_rad(_input_max_pitch), -1.0, 1.0)

	if look_at_type == LookAtType.BONE:
		_update_bone_look_at(yaw_norm, pitch_norm)
	elif look_at_type == LookAtType.EXPRESSION:
		_update_expression_look_at(yaw_norm, pitch_norm)


func _update_bone_look_at(yaw_norm: float, pitch_norm: float) -> void:
	var skeleton: Skeleton3D = _find_skeleton()
	if skeleton == null:
		return

	var t_yaw := clampf(abs(yaw_norm), 0.0, 1.0)
	var t_pitch := clampf(abs(pitch_norm), 0.0, 1.0)

	var left_yaw_rot := Quaternion.IDENTITY
	if yaw_norm < 0:
		left_yaw_rot = Quaternion.IDENTITY.slerp(_left_look_left, t_yaw)
	elif yaw_norm > 0:
		left_yaw_rot = Quaternion.IDENTITY.slerp(_left_look_right, t_yaw)

	var left_pitch_rot := Quaternion.IDENTITY
	if pitch_norm > 0:
		left_pitch_rot = Quaternion.IDENTITY.slerp(_left_look_up, t_pitch)
	elif pitch_norm < 0:
		left_pitch_rot = Quaternion.IDENTITY.slerp(_left_look_down, t_pitch)

	var left_rot := _eye_bone_horizontal * left_pitch_rot * left_yaw_rot
	if _left_eye_bone_idx != -1:
		skeleton.set_bone_pose_rotation(_left_eye_bone_idx, left_rot)

	var right_yaw_rot := Quaternion.IDENTITY
	if yaw_norm < 0:
		right_yaw_rot = Quaternion.IDENTITY.slerp(_right_look_left, t_yaw)
	elif yaw_norm > 0:
		right_yaw_rot = Quaternion.IDENTITY.slerp(_right_look_right, t_yaw)

	var right_pitch_rot := Quaternion.IDENTITY
	if pitch_norm > 0:
		right_pitch_rot = Quaternion.IDENTITY.slerp(_right_look_up, t_pitch)
	elif pitch_norm < 0:
		right_pitch_rot = Quaternion.IDENTITY.slerp(_right_look_down, t_pitch)

	var right_rot := _eye_bone_horizontal * right_pitch_rot * right_yaw_rot
	if _right_eye_bone_idx != -1:
		skeleton.set_bone_pose_rotation(_right_eye_bone_idx, right_rot)


func _update_expression_look_at(yaw_norm: float, pitch_norm: float) -> void:
	if _expression_manager == null:
		return
	_expression_manager.set_expression("lookLeft", 0.0)
	_expression_manager.set_expression("lookRight", 0.0)
	_expression_manager.set_expression("lookUp", 0.0)
	_expression_manager.set_expression("lookDown", 0.0)
	if yaw_norm > 0:
		_expression_manager.set_expression("lookRight", yaw_norm)
	elif yaw_norm < 0:
		_expression_manager.set_expression("lookLeft", -yaw_norm)
	if pitch_norm > 0:
		_expression_manager.set_expression("lookUp", pitch_norm)
	elif pitch_norm < 0:
		_expression_manager.set_expression("lookDown", -pitch_norm)


func get_look_at_target() -> Vector3:
	if target != null and is_instance_valid(target):
		return target.global_position
	return target_position
