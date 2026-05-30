class_name VRMAnimationPlayer
extends RefCounted

var _vrm_instance: Node3D
var _humanoid: VRMHumanoid


func _init(vrm_instance: VRMInstance) -> void:
	_vrm_instance = vrm_instance
	var skeleton = vrm_instance.get_general_skeleton()
	if skeleton != null:
		_humanoid = VRMHumanoid.new(vrm_instance, skeleton)


func load_vrma(path: String) -> bool:
	var gltf := GLTFDocument.new()
	var state := GLTFState.new()

	var vrm_anim_ext := preload("../1.0/VRMC_vrm_animation.gd").new()
	GLTFDocument.register_gltf_document_extension(vrm_anim_ext)

	var err := gltf.append_from_file(path, state)
	if err != OK:
		push_error("VRMAnimationPlayer: Failed to load VRMA file: " + path)
		GLTFDocument.unregister_gltf_document_extension(vrm_anim_ext)
		return false

	var scene := gltf.generate_scene(state)
	GLTFDocument.unregister_gltf_document_extension(vrm_anim_ext)

	var src_anim_player := _find_anim_player(scene)
	if src_anim_player == null:
		push_error("VRMAnimationPlayer: No AnimationPlayer found in VRMA")
		scene.queue_free()
		return false

	var target_anim_player := _find_anim_player(_vrm_instance)
	if target_anim_player == null:
		target_anim_player = AnimationPlayer.new()
		target_anim_player.name = "AnimationPlayer"
		_vrm_instance.add_child(target_anim_player, true)

	var bone_map: BoneMap = null
	if _vrm_instance.vrm_meta != null and _vrm_instance.vrm_meta.has_method("get_humanoid_bone_mapping"):
		bone_map = _vrm_instance.vrm_meta.get("humanoid_bone_mapping")
	if bone_map == null:
		push_error("VRMAnimationPlayer: No bone map available for retargeting")
		scene.queue_free()
		return false

	for anim_name in src_anim_player.get_animation_list():
		var anim: Animation = src_anim_player.get_animation(anim_name)
		if anim == null:
			continue
		var retargeted := _retarget_animation(anim, bone_map)
		if retargeted != null:
			target_anim_player.add_animation(anim_name, retargeted)

	scene.queue_free()
	return true


func _find_anim_player(root: Node) -> AnimationPlayer:
	if root.has_node("AnimationPlayer"):
		return root.get_node("AnimationPlayer") as AnimationPlayer
	for child in root.get_children():
		if child is AnimationPlayer:
			return child
	return null


func _retarget_animation(anim: Animation, bone_map: BoneMap) -> Animation:
	var retargeted: Animation = anim.duplicate(true)
	for i in range(retargeted.get_track_count()):
		var track_type := retargeted.track_get_type(i)
		if track_type != Animation.TYPE_ROTATION_3D and track_type != Animation.TYPE_POSITION_3D and track_type != Animation.TYPE_SCALE_3D:
			continue
		var track_path := retargeted.track_get_path(i)
		var path_str := str(track_path)
		var colon_idx := path_str.rfind(":")
		if colon_idx == -1:
			continue
		var vrm_bone_name := path_str.substr(colon_idx + 1)
		var skel_bone_name := bone_map.get_skeleton_bone_name(vrm_bone_name)
		if skel_bone_name.is_empty():
			# Try common aliases
			skel_bone_name = bone_map.get_skeleton_bone_name(_map_bone_name(vrm_bone_name))
		if skel_bone_name.is_empty():
			continue
		var new_path := path_str.substr(0, colon_idx) + ":" + skel_bone_name
		retargeted.track_set_path(i, NodePath(new_path))
	return retargeted


func _map_bone_name(vrm_name: String) -> String:
	# VRMA may use VRM 1.0 preset names directly; BoneMap uses SkeletonProfileHumanoid names.
	# The bone_map.get_skeleton_bone_name already maps from profile name to skeleton name.
	# vrm_name here is expected to be the profile name (e.g. "hips" -> "Hips").
	# If the VRMA uses different casing, try to normalize.
	return vrm_name
