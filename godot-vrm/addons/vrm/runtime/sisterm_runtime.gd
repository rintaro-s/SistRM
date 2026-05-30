class_name SisterRMRuntime
extends Node

## SisterRM Runtime Wrapper for the godot-vrm addon.
## Attaches to an imported VRM scene and provides network-sync-ready
## expression control, look-at, humanoid bone access, and spring bone state.
##
## Usage:
##   var vrm = gltf.generate_scene(state)  # imported VRM
##   var runtime = SisterRMRuntime.new()
##   vrm.add_child(runtime)
##   runtime.init()
##   runtime.set_expression("happy", 0.5)

# Addon component references
var _vrm_top: VRMTopLevel = null
var _anim_player: AnimationPlayer = null
var _skeleton: Skeleton3D = null
var _secondary: Node = null  # VRMSecondary (may be null if no spring bones)

# Expression state
var _expression_bindings: Dictionary = {}  # expr_name -> Array[Binding]
var _expression_values: Dictionary = {}    # expr_name -> float
var _default_values: Dictionary = {}       # track_path -> default value

# Humanoid / LookAt
var _bone_map: BoneMap = null
var _look_at_type: String = "bone"  # "bone" | "expression"
var _look_at_target: Vector3 = Vector3.ZERO
var _head_bone_idx: int = -1
var _left_eye_idx: int = -1
var _right_eye_idx: int = -1

# Network
var network_client: SisterRMNetworkClient = null

# First-Person
var _first_person_enabled: bool = false
var _head_meshes: Array[MeshInstance3D] = []

# Coordinate system
const _SSCS = "SSCS"


# ==================== Initialization ====================

func init() -> void:
	_find_components()
	_parse_expressions_from_animations()
	_find_humanoid_bones()
	_look_at_type = _detect_look_at_type()


func _find_components() -> void:
	# Walk up to find VRMTopLevel
	var node: Node = self
	while node != null:
		if node is VRMTopLevel:
			_vrm_top = node
			break
		node = node.get_parent()

	if _vrm_top == null:
		push_error("SisterRMRuntime: Must be a child of a VRMTopLevel node")
		return

	_anim_player = _vrm_top.get_node_or_null("AnimationPlayer")
	_secondary = _vrm_top.get_node_or_null("secondary")

	# Find Skeleton3D recursively
	_skeleton = _find_skeleton(_vrm_top)

	if _vrm_top.vrm_meta != null:
		_bone_map = _vrm_top.vrm_meta.humanoid_bone_mapping

	_find_head_meshes()


func _find_skeleton(root: Node) -> Skeleton3D:
	if root is Skeleton3D:
		return root
	for child in root.get_children():
		var skel := _find_skeleton(child)
		if skel != null:
			return skel
	return null


# ==================== Expression System ====================

class Binding:
	var node: Node
	var bind_type: String  # "blend_shape" | "material_color" | "material_vector" | "texture_transform"
	var property_path: String
	var default_value: Variant
	var target_value: Variant

	func apply(weight: float) -> void:
		if not is_instance_valid(node):
			return
		match bind_type:
			"blend_shape":
				node.set("blend_shapes/" + property_path, default_value + (target_value - default_value) * weight)
			"material_color", "material_vector":
				var mat := _get_material()
				if mat is ShaderMaterial:
					mat.set_shader_parameter(property_path, _lerp_value(default_value, target_value, weight))
			"texture_transform":
				var mat := _get_material()
				if mat is ShaderMaterial:
					mat.set_shader_parameter(property_path, _lerp_value(default_value, target_value, weight))

	func _get_material() -> Material:
		# property_path format: "surface_N/material:shader_parameter/ParamName"
		# We need to extract surface index and parameter name
		if not node is MeshInstance3D:
			return null
		var parts := property_path.split(":")
		if parts.size() < 2:
			return null
		var surface_part := parts[0]  # "surface_N"
		var param_part := parts[1]    # "shader_parameter/ParamName"
		var surface_idx := int(surface_part.split("_")[1])
		var mi := node as MeshInstance3D
		var mat := mi.get_surface_override_material(surface_idx)
		if mat == null and mi.mesh != null and surface_idx < mi.mesh.get_surface_count():
			mat = mi.mesh.surface_get_material(surface_idx)
		return mat

	func _lerp_value(a: Variant, b: Variant, t: float) -> Variant:
		if typeof(a) != typeof(b):
			return b
		if a is Color and b is Color:
			return a.lerp(b, t)
		if a is Vector3 and b is Vector3:
			return a.lerp(b, t)
		if a is Vector4 and b is Vector4:
			return a.lerp(b, t)
		if typeof(a) == TYPE_FLOAT and typeof(b) == TYPE_FLOAT:
			return lerpf(a, b, t)
		return b


func _parse_expressions_from_animations() -> void:
	if _anim_player == null:
		return

	var anim_lib := _anim_player.get_animation_library("")
	if anim_lib == null:
		return

	# First pass: read RESET animation to get default values
	if anim_lib.has_animation("RESET"):
		var reset_anim: Animation = anim_lib.get_animation("RESET")
		for i in range(reset_anim.get_track_count()):
			var track_path := reset_anim.track_get_path(i)
			var value := reset_anim.track_get_key_value(i, 0)
			_default_values[str(track_path)] = value

	# Second pass: parse expression animations
	for anim_name in anim_lib.get_animation_list():
		if anim_name == "RESET":
			continue
		if anim_name.ends_with("Raw"):
			continue  # Skip raw look-at variants

		var anim: Animation = anim_lib.get_animation(anim_name)
		var bindings: Array[Binding] = []

		for i in range(anim.get_track_count()):
			var track_type := anim.track_get_type(i)
			var track_path := anim.track_get_path(i)
			var target_value := anim.track_get_key_value(i, 0)
			var default_value := _default_values.get(str(track_path), target_value)

			var binding := Binding.new()
			binding.default_value = default_value
			binding.target_value = target_value

			match track_type:
				Animation.TYPE_BLEND_SHAPE:
					binding.bind_type = "blend_shape"
					# track_path format: "MeshInstance3D:BlendShapeName"
					var node_path := track_path.get_concatenated_names()
					binding.node = _vrm_top.get_node_or_null(node_path)
					binding.property_path = str(track_path.get_subname(0))
				Animation.TYPE_VALUE:
					# track_path format: "MeshInstance3D:mesh:surface_N/material:shader_parameter/Name"
					var node_path := track_path.get_concatenated_names()
					binding.node = _vrm_top.get_node_or_null(node_path)
					var subname_count := track_path.get_subname_count()
					var full_subnames := ""
					for j in range(subname_count):
						if j > 0:
							full_subnames += ":"
						full_subnames += str(track_path.get_subname(j))
					if full_subnames.begins_with("mesh:surface_") and full_subnames.contains("/material:shader_parameter/"):
						binding.bind_type = "material_color"
						# Extract parameter name from ".../material:shader_parameter/Name"
						var param_part := full_subnames.split("/material:shader_parameter/", true, 1)
						if param_part.size() == 2:
							binding.property_path = param_part[0] + ":" + param_part[1]
						else:
							binding.property_path = full_subnames
					else:
						binding.bind_type = "texture_transform"
						binding.property_path = full_subnames
			_bindings[anim_name] = bindings
			_expression_values[anim_name] = 0.0


func set_expression(name: String, value: float) -> void:
	value = clampf(value, 0.0, 1.0)
	_expression_values[name] = value


func get_expression(name: String) -> float:
	return _expression_values.get(name, 0.0)


func reset_expressions() -> void:
	for name in _expression_values.keys():
		_expression_values[name] = 0.0


func get_expression_names() -> Array:
	return _expression_bindings.keys()


# ==================== Look-At System ====================

func _detect_look_at_type() -> String:
	# Try to detect from available expression names
	var has_look := false
	for name in _expression_bindings.keys():
		if name in ["lookLeft", "lookRight", "lookUp", "lookDown"]:
			has_look = true
			break
	if has_look:
		return "expression"
	if _left_eye_idx != -1 or _right_eye_idx != -1:
		return "bone"
	return "none"


func set_look_at_target(target: Vector3) -> void:
	_look_at_target = target


func get_look_at_target() -> Vector3:
	return _look_at_target


func _update_look_at() -> void:
	if _look_at_type == "none":
		return
	if _head_bone_idx == -1 or _skeleton == null:
		return

	var head_global: Transform3D = _skeleton.global_transform * _skeleton.get_bone_global_pose(_head_bone_idx)
	var head_to_target: Vector3 = _look_at_target - head_global.origin
	if head_to_target.is_zero_approx():
		return

	var local_dir: Vector3 = head_global.basis.inverse() * head_to_target
	local_dir = local_dir.normalized()

	var yaw: float = atan2(local_dir.x, local_dir.z)
	var pitch: float = atan2(local_dir.y, sqrt(local_dir.x * local_dir.x + local_dir.z * local_dir.z))

	var yaw_norm: float = clampf(yaw / deg_to_rad(90.0), -1.0, 1.0)
	var pitch_norm: float = clampf(pitch / deg_to_rad(90.0), -1.0, 1.0)

	if _look_at_type == "expression":
		_expression_values["lookLeft"] = 0.0
		_expression_values["lookRight"] = 0.0
		_expression_values["lookUp"] = 0.0
		_expression_values["lookDown"] = 0.0
		if yaw_norm > 0:
			_expression_values["lookRight"] = yaw_norm
		elif yaw_norm < 0:
			_expression_values["lookLeft"] = -yaw_norm
		if pitch_norm > 0:
			_expression_values["lookUp"] = pitch_norm
		elif pitch_norm < 0:
			_expression_values["lookDown"] = -pitch_norm
	elif _look_at_type == "bone":
		_update_bone_look_at(yaw_norm, pitch_norm)


func _update_bone_look_at(yaw_norm: float, pitch_norm: float) -> void:
	# Simple bone look-at: rotate eyes toward target
	if _left_eye_idx != -1:
		var left_rot := Quaternion.from_euler(Vector3(pitch_norm * 0.3, yaw_norm * 0.3, 0))
		_skeleton.set_bone_pose_rotation(_left_eye_idx, left_rot)
	if _right_eye_idx != -1:
		var right_rot := Quaternion.from_euler(Vector3(pitch_norm * 0.3, yaw_norm * 0.3, 0))
		_skeleton.set_bone_pose_rotation(_right_eye_idx, right_rot)


# ==================== Humanoid Bones ====================

func _find_humanoid_bones() -> void:
	if _skeleton == null or _bone_map == null:
		return

	var profile: SkeletonProfileHumanoid = _bone_map.profile
	if profile == null:
		return

	_head_bone_idx = _find_humanoid_bone("Head")
	_left_eye_idx = _find_humanoid_bone("LeftEye")
	_right_eye_idx = _find_humanoid_bone("RightEye")


func _find_humanoid_bone(bone_name: String) -> int:
	if _bone_map == null or _skeleton == null:
		return -1
	var skel_name := _bone_map.get_skeleton_bone_name(bone_name)
	if skel_name.is_empty():
		return -1
	return _skeleton.find_bone(skel_name)


func get_bone_index(bone_name: String) -> int:
	return _find_humanoid_bone(bone_name)


func set_bone_rotation(bone_name: String, rotation: Quaternion) -> void:
	var idx := _find_humanoid_bone(bone_name)
	if idx >= 0 and _skeleton != null:
		_skeleton.set_bone_pose_rotation(idx, rotation)


func get_bone_rotation(bone_name: String) -> Quaternion:
	var idx := _find_humanoid_bone(bone_name)
	if idx >= 0 and _skeleton != null:
		return _skeleton.get_bone_pose_rotation(idx)
	return Quaternion.IDENTITY


func reset_all_bones() -> void:
	if _skeleton == null:
		return
	for i in range(_skeleton.get_bone_count()):
		_skeleton.set_bone_pose_rotation(i, Quaternion.IDENTITY)
		_skeleton.set_bone_pose_position(i, Vector3.ZERO)
		_skeleton.set_bone_pose_scale(i, Vector3.ONE)


# ==================== Spring Bone ====================

func get_spring_bone_count() -> int:
	if _vrm_top == null:
		return 0
	return _vrm_top.spring_bones.size()


func set_spring_bone_gravity(dir: Vector3, power: float) -> void:
	if _vrm_top != null:
		_vrm_top.springbone_gravity_rotation = Quaternion.from_euler(dir)
		_vrm_top.springbone_gravity_multiplier = power


# ==================== Network State ====================

func get_network_state() -> Dictionary:
	var pos := _vrm_top.global_position
	var quat := _vrm_top.global_transform.basis.get_rotation_quaternion()
	var scl := _vrm_top.global_scale

	var expressions := {}
	for name in _expression_values.keys():
		var val: float = _expression_values[name]
		if not is_zero_approx(val):
			expressions[name] = val

	return {
		"transform": {
			"pos": [pos.x, pos.y, pos.z],
			"rot": [quat.x, quat.y, quat.z, quat.w],
			"scale": [scl.x, scl.y, scl.z],
		},
		"expressions": expressions,
		"look_at": [_look_at_target.x, _look_at_target.y, _look_at_target.z],
		"bone_rotations": {},
	}


func apply_network_state(state: Dictionary) -> void:
	var transform_data: Dictionary = state.get("transform", {})
	var pos_arr: Array = transform_data.get("pos", [0, 0, 0])
	var rot_arr: Array = transform_data.get("rot", [0, 0, 0, 1])
	var scl_arr: Array = transform_data.get("scale", [1, 1, 1])

	_vrm_top.global_position = Vector3(pos_arr[0], pos_arr[1], pos_arr[2])
	_vrm_top.global_transform.basis = Basis(Quaternion(rot_arr[0], rot_arr[1], rot_arr[2], rot_arr[3]))
	_vrm_top.scale = Vector3(scl_arr[0], scl_arr[1], scl_arr[2])

	var expressions: Dictionary = state.get("expressions", {})
	for name in expressions.keys():
		_expression_values[name] = expressions[name]

	var look_at_arr: Array = state.get("look_at", [])
	if look_at_arr.size() >= 3:
		_look_at_target = Vector3(look_at_arr[0], look_at_arr[1], look_at_arr[2])


# ==================== Process Loop ====================

func _process(_delta: float) -> void:
	if _vrm_top == null:
		return

	_update_look_at()
	_apply_expressions()


func _apply_expressions() -> void:
	for name in _expression_values.keys():
		var val: float = _expression_values[name]
		var bindings: Array = _expression_bindings.get(name, [])
		for binding in bindings:
			if binding is Binding:
				binding.apply(val)


# ==================== First-Person Mode ====================

func _find_head_meshes() -> void:
	_head_meshes.clear()
	if _vrm_top == null:
		return
	for child in _vrm_top.get_children():
		_recurse_find_head_meshes(child)

func _recurse_find_head_meshes(node: Node) -> void:
	if node is MeshInstance3D:
		var lower_name := node.name.to_lower()
		if "head" in lower_name or "face" in lower_name or "hair" in lower_name:
			_head_meshes.append(node)
	for child in node.get_children():
		_recurse_find_head_meshes(child)

func set_first_person_enabled(enabled: bool) -> void:
	_first_person_enabled = enabled
	for mesh in _head_meshes:
		if is_instance_valid(mesh):
			mesh.visible = not enabled

func is_first_person_enabled() -> bool:
	return _first_person_enabled


# ==================== Cleanup ====================

func _exit_tree() -> void:
	# Reset all expressions to default on removal
	for name in _expression_bindings.keys():
		var bindings: Array = _expression_bindings[name]
		for binding in bindings:
			if binding is Binding:
				binding.apply(0.0)
	reset_all_bones()
