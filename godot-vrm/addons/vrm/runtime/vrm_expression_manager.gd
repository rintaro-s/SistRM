class_name VRMExpressionManager
extends RefCounted

const EXPRESSION_PRESETS: PackedStringArray = [
	"happy", "angry", "sad", "relaxed", "surprised", "neutral",
	"aa", "ih", "ou", "ee", "oh",
	"blink", "blinkLeft", "blinkRight",
	"lookUp", "lookDown", "lookLeft", "lookRight"
]

var _vrm_instance: Node3D
var _expression_values: Dictionary = {}
var _expression_bindings: Dictionary = {}
var _default_blend_shapes: Dictionary = {}
var _default_material_values: Dictionary = {}
var _active_expressions: Dictionary = {}


func _init(vrm_instance: Node3D) -> void:
	_vrm_instance = vrm_instance
	for preset in EXPRESSION_PRESETS:
		_expression_values[preset] = 0.0
	_parse_animations()


func _find_animation_player() -> AnimationPlayer:
	if _vrm_instance.has_node("AnimationPlayer"):
		return _vrm_instance.get_node("AnimationPlayer") as AnimationPlayer
	for child in _vrm_instance.get_children():
		if child is AnimationPlayer:
			return child
	return null


func _parse_animations() -> void:
	var anim_player: AnimationPlayer = _find_animation_player()
	if anim_player == null:
		return

	for anim_name in anim_player.get_animation_list():
		if anim_name == "RESET":
			continue
		var base_name := anim_name
		if anim_name.ends_with("Raw"):
			base_name = anim_name.substr(0, len(anim_name) - 3)
		if not anim_player.has_animation(anim_name):
			continue
		var anim: Animation = anim_player.get_animation(anim_name)
		var bindings := _parse_animation_tracks(anim)
		bindings["is_binary"] = anim.get_meta("vrm_is_binary", false)
		bindings["override_blink"] = anim.get_meta("vrm_override_blink", false)
		bindings["override_look_at"] = anim.get_meta("vrm_override_look_at", false)
		bindings["override_mouth"] = anim.get_meta("vrm_override_mouth", false)
		_expression_bindings[base_name] = bindings
		if not _expression_values.has(base_name):
			_expression_values[base_name] = 0.0


func _parse_animation_tracks(anim: Animation) -> Dictionary:
	var bindings := {
		"blend_shapes": [],
		"material_values": [],
	}
	var root := _vrm_instance
	for i in range(anim.get_track_count()):
		var track_path := anim.track_get_path(i)
		var track_type := anim.track_get_type(i)
		var node_path := NodePath(str(track_path.get_concatenated_names()))
		var node := root.get_node_or_null(node_path)
		if node == null:
			continue

		if track_type == Animation.TYPE_BLEND_SHAPE:
			var blend_shape_name := str(track_path.get_subname(0))
			var weight: float = anim.track_get_key_value(i, 0)
			bindings["blend_shapes"].append({
				"node": node,
				"blend_shape_name": blend_shape_name,
				"weight": weight,
			})
			_store_default_blend_shape(node, blend_shape_name)
		elif track_type == Animation.TYPE_VALUE:
			var subname_count := track_path.get_subname_count()
			if subname_count >= 3 and str(track_path.get_subname(0)) == "mesh" and str(track_path.get_subname(1)).begins_with("surface_") and str(track_path.get_subname(1)).ends_with("/material"):
				var surface_str := str(track_path.get_subname(1))
				var surface_idx := int(surface_str.split("_")[1].split("/")[0])
				var full_subnames := ""
				for j in range(subname_count):
					if j > 0:
						full_subnames += "/"
					full_subnames += str(track_path.get_subname(j))
				var property_path := full_subnames.split("/material:", true, 1)[1]
				var target_value := anim.track_get_key_value(i, 0)
				bindings["material_values"].append({
					"node": node,
					"surface_idx": surface_idx,
					"property_path": property_path,
					"target_value": target_value,
				})
				_store_default_material_value(node, surface_idx, property_path)
	return bindings


func _store_default_blend_shape(node: Node, blend_shape_name: String) -> void:
	var key := str(node.get_path()) + ":" + blend_shape_name
	if _default_blend_shapes.has(key):
		return
	if node is MeshInstance3D:
		_default_blend_shapes[key] = node.get("blend_shapes/" + blend_shape_name)


func _store_default_material_value(node: Node, surface_idx: int, property_path: String) -> void:
	var key := str(node.get_path()) + ":" + str(surface_idx) + ":" + property_path
	if _default_material_values.has(key):
		return
	if node is MeshInstance3D:
		var mat := _get_material(node, surface_idx)
		if mat == null:
			return
		var value = _read_material_property(mat, property_path)
		if value != null:
			_default_material_values[key] = value


func _get_material(node: MeshInstance3D, surface_idx: int) -> Material:
	var mat := node.get_surface_override_material(surface_idx)
	if mat != null:
		return mat
	if node.mesh != null and surface_idx < node.mesh.get_surface_count():
		return node.mesh.surface_get_material(surface_idx)
	return null


func _ensure_writable_material(node: MeshInstance3D, surface_idx: int) -> Material:
	var mat := node.get_surface_override_material(surface_idx)
	if mat != null:
		return mat
	if node.mesh != null and surface_idx < node.mesh.get_surface_count():
		mat = node.mesh.surface_get_material(surface_idx)
		if mat != null:
			var dup := mat.duplicate()
			node.set_surface_override_material(surface_idx, dup)
			return dup
	return null


func _read_material_property(mat: Material, property_path: String):
	if property_path.begins_with("next_pass:"):
		var actual_path := property_path.replace("next_pass:", "")
		if mat.next_pass is ShaderMaterial:
			return _read_shader_parameter(mat.next_pass as ShaderMaterial, actual_path)
	elif property_path.begins_with("shader_parameter/"):
		if mat is ShaderMaterial:
			return _read_shader_parameter(mat as ShaderMaterial, property_path)
	elif mat is BaseMaterial3D:
		match property_path:
			"uv1_offset":
				return (mat as BaseMaterial3D).uv1_offset
			"uv1_scale":
				return (mat as BaseMaterial3D).uv1_scale
			"albedo_color":
				return (mat as BaseMaterial3D).albedo_color
			"emission":
				return (mat as BaseMaterial3D).emission
	return null


func _read_shader_parameter(mat: ShaderMaterial, property_path: String):
	if property_path.begins_with("shader_parameter/"):
		return mat.get_shader_parameter(property_path.replace("shader_parameter/", ""))
	return null


func set_expression(name: String, value: float) -> void:
	value = clampf(value, 0.0, 1.0)
	_expression_values[name] = value
	if value > 0.0:
		_active_expressions[name] = true
	else:
		_active_expressions.erase(name)


func get_expression(name: String) -> float:
	return _expression_values.get(name, 0.0)


func reset_all() -> void:
	for name in _expression_values.keys():
		_expression_values[name] = 0.0
	_active_expressions.clear()
	_apply_expressions()


func update(delta: float) -> void:
	_apply_expressions()


func _apply_expressions() -> void:
	var blend_shape_accum: Dictionary = {}
	var material_accum: Dictionary = {}

	var override_blink := false
	var override_mouth := false
	var override_look_at := false

	for expr_name in _active_expressions.keys():
		var bindings: Dictionary = _expression_bindings.get(expr_name, {})
		if bindings.is_empty():
			continue
		if bindings.get("override_blink", false):
			override_blink = true
		if bindings.get("override_mouth", false):
			override_mouth = true
		if bindings.get("override_look_at", false):
			override_look_at = true

	for expr_name in _expression_values.keys():
		var value: float = _expression_values.get(expr_name, 0.0)
		if is_zero_approx(value):
			continue

		if override_blink and expr_name in ["blink", "blinkLeft", "blinkRight"]:
			if not _expression_bindings.get(expr_name, {}).get("override_blink", false):
				continue
		if override_mouth and expr_name in ["aa", "ih", "ou", "ee", "oh"]:
			if not _expression_bindings.get(expr_name, {}).get("override_mouth", false):
				continue
		if override_look_at and expr_name in ["lookUp", "lookDown", "lookLeft", "lookRight"]:
			if not _expression_bindings.get(expr_name, {}).get("override_look_at", false):
				continue

		var bindings: Dictionary = _expression_bindings.get(expr_name, {})
		if bindings.is_empty():
			continue

		var is_binary: bool = bindings.get("is_binary", false)
		var effective_value := value
		if is_binary:
			effective_value = 1.0 if value >= 0.5 else 0.0

		for bs in bindings.get("blend_shapes", []):
			var node: Node = bs.node
			var bs_name: String = bs.blend_shape_name
			var weight: float = bs.weight
			var key := str(node.get_path()) + ":" + bs_name
			if not blend_shape_accum.has(key):
				blend_shape_accum[key] = {"node": node, "name": bs_name, "value": 0.0}
			blend_shape_accum[key].value += effective_value * weight

		for mv in bindings.get("material_values", []):
			var node: Node = mv.node
			var surface_idx: int = mv.surface_idx
			var property_path: String = mv.property_path
			var target_value = mv.target_value
			var key := str(node.get_path()) + ":" + str(surface_idx) + ":" + property_path
			if not material_accum.has(key):
				var default_val = _default_material_values.get(key, target_value)
				material_accum[key] = {
					"node": node,
					"surface_idx": surface_idx,
					"property_path": property_path,
					"default": default_val,
					"target": target_value,
					"value": 0.0,
				}
			material_accum[key].value = maxf(material_accum[key].value, effective_value)

	for key in blend_shape_accum.keys():
		var data: Dictionary = blend_shape_accum[key]
		var node: Node = data.node
		if node == null or not is_instance_valid(node):
			continue
		var final_value: float = clampf(data.value, 0.0, 1.0)
		node.set("blend_shapes/" + data.name, final_value)

	for key in material_accum.keys():
		var data: Dictionary = material_accum[key]
		var node: Node = data.node
		if node == null or not is_instance_valid(node) or not node is MeshInstance3D:
			continue
		var surface_idx: int = data.surface_idx
		var property_path: String = data.property_path
		var lerp_value: float = clampf(data.value, 0.0, 1.0)
		var default_value = data.default
		var target_value = data.target

		var mat := _ensure_writable_material(node as MeshInstance3D, surface_idx)
		if mat == null:
			continue

		var final_value = _lerp_value(default_value, target_value, lerp_value)
		_set_material_property(mat, property_path, final_value)


func _lerp_value(a, b, t: float):
	if typeof(a) != typeof(b):
		return b
	if a is Color and b is Color:
		return a.lerp(b, t)
	elif a is Vector3 and b is Vector3:
		return a.lerp(b, t)
	elif a is Vector4 and b is Vector4:
		return a.lerp(b, t)
	elif typeof(a) == TYPE_FLOAT and typeof(b) == TYPE_FLOAT:
		return lerpf(a, b, t)
	return b


func _set_material_property(mat: Material, property_path: String, value) -> void:
	if property_path.begins_with("next_pass:"):
		var actual_path := property_path.replace("next_pass:", "")
		if mat.next_pass is ShaderMaterial:
			if actual_path.begins_with("shader_parameter/"):
				(mat.next_pass as ShaderMaterial).set_shader_parameter(actual_path.replace("shader_parameter/", ""), value)
	elif property_path.begins_with("shader_parameter/"):
		if mat is ShaderMaterial:
			mat.set_shader_parameter(property_path.replace("shader_parameter/", ""), value)
	elif mat is BaseMaterial3D:
		match property_path:
			"uv1_offset":
				mat.uv1_offset = value
			"uv1_scale":
				mat.uv1_scale = value
			"albedo_color":
				mat.albedo_color = value
			"emission":
				mat.emission = value


func get_expression_values() -> Dictionary:
	var result: Dictionary = {}
	for name in _expression_values.keys():
		result[name] = _expression_values[name]
	return result
