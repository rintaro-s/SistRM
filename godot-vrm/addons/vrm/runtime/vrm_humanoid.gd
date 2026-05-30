class_name VRMHumanoid
extends RefCounted

# VRM 1.0 humanoid bone names
enum HumanoidBoneName {
	Hips, Spine, Chest, UpperChest, Neck, Head,
	LeftEye, RightEye, Jaw,
	LeftUpperLeg, LeftLowerLeg, LeftFoot, LeftToes,
	RightUpperLeg, RightLowerLeg, RightFoot, RightToes,
	LeftShoulder, LeftUpperArm, LeftLowerArm, LeftHand,
	RightShoulder, RightUpperArm, RightLowerArm, RightHand,
	LeftThumbProximal, LeftThumbIntermediate, LeftThumbDistal,
	LeftIndexProximal, LeftIndexIntermediate, LeftIndexDistal,
	LeftMiddleProximal, LeftMiddleIntermediate, LeftMiddleDistal,
	LeftRingProximal, LeftRingIntermediate, LeftRingDistal,
	LeftLittleProximal, LeftLittleIntermediate, LeftLittleDistal,
	RightThumbProximal, RightThumbIntermediate, RightThumbDistal,
	RightIndexProximal, RightIndexIntermediate, RightIndexDistal,
	RightMiddleProximal, RightMiddleIntermediate, RightMiddleDistal,
	RightRingProximal, RightRingIntermediate, RightRingDistal,
	RightLittleProximal, RightLittleIntermediate, RightLittleDistal,
}

const BONE_NAME_MAP: Dictionary = {
	"hips": HumanoidBoneName.Hips,
	"spine": HumanoidBoneName.Spine,
	"chest": HumanoidBoneName.Chest,
	"upperChest": HumanoidBoneName.UpperChest,
	"neck": HumanoidBoneName.Neck,
	"head": HumanoidBoneName.Head,
	"leftEye": HumanoidBoneName.LeftEye,
	"rightEye": HumanoidBoneName.RightEye,
	"jaw": HumanoidBoneName.Jaw,
	"leftUpperLeg": HumanoidBoneName.LeftUpperLeg,
	"leftLowerLeg": HumanoidBoneName.LeftLowerLeg,
	"leftFoot": HumanoidBoneName.LeftFoot,
	"leftToes": HumanoidBoneName.LeftToes,
	"rightUpperLeg": HumanoidBoneName.RightUpperLeg,
	"rightLowerLeg": HumanoidBoneName.RightLowerLeg,
	"rightFoot": HumanoidBoneName.RightFoot,
	"rightToes": HumanoidBoneName.RightToes,
	"leftShoulder": HumanoidBoneName.LeftShoulder,
	"leftUpperArm": HumanoidBoneName.LeftUpperArm,
	"leftLowerArm": HumanoidBoneName.LeftLowerArm,
	"leftHand": HumanoidBoneName.LeftHand,
	"rightShoulder": HumanoidBoneName.RightShoulder,
	"rightUpperArm": HumanoidBoneName.RightUpperArm,
	"rightLowerArm": HumanoidBoneName.RightLowerArm,
	"rightHand": HumanoidBoneName.RightHand,
	"leftThumbProximal": HumanoidBoneName.LeftThumbProximal,
	"leftThumbIntermediate": HumanoidBoneName.LeftThumbIntermediate,
	"leftThumbDistal": HumanoidBoneName.LeftThumbDistal,
	"leftIndexProximal": HumanoidBoneName.LeftIndexProximal,
	"leftIndexIntermediate": HumanoidBoneName.LeftIndexIntermediate,
	"leftIndexDistal": HumanoidBoneName.LeftIndexDistal,
	"leftMiddleProximal": HumanoidBoneName.LeftMiddleProximal,
	"leftMiddleIntermediate": HumanoidBoneName.LeftMiddleIntermediate,
	"leftMiddleDistal": HumanoidBoneName.LeftMiddleDistal,
	"leftRingProximal": HumanoidBoneName.LeftRingProximal,
	"leftRingIntermediate": HumanoidBoneName.LeftRingIntermediate,
	"leftRingDistal": HumanoidBoneName.LeftRingDistal,
	"leftLittleProximal": HumanoidBoneName.LeftLittleProximal,
	"leftLittleIntermediate": HumanoidBoneName.LeftLittleIntermediate,
	"leftLittleDistal": HumanoidBoneName.LeftLittleDistal,
	"rightThumbProximal": HumanoidBoneName.RightThumbProximal,
	"rightThumbIntermediate": HumanoidBoneName.RightThumbIntermediate,
	"rightThumbDistal": HumanoidBoneName.RightThumbDistal,
	"rightIndexProximal": HumanoidBoneName.RightIndexProximal,
	"rightIndexIntermediate": HumanoidBoneName.RightIndexIntermediate,
	"rightIndexDistal": HumanoidBoneName.RightIndexDistal,
	"rightMiddleProximal": HumanoidBoneName.RightMiddleProximal,
	"rightMiddleIntermediate": HumanoidBoneName.RightMiddleIntermediate,
	"rightMiddleDistal": HumanoidBoneName.RightMiddleDistal,
	"rightRingProximal": HumanoidBoneName.RightRingProximal,
	"rightRingIntermediate": HumanoidBoneName.RightRingIntermediate,
	"rightRingDistal": HumanoidBoneName.RightRingDistal,
	"rightLittleProximal": HumanoidBoneName.RightLittleProximal,
	"rightLittleIntermediate": HumanoidBoneName.RightLittleIntermediate,
	"rightLittleDistal": HumanoidBoneName.RightLittleDistal,
}

var _instance: VRMInstance = null
var _skeleton: Skeleton3D = null
var _bone_name_to_idx: Dictionary = {}

func _init(instance: VRMInstance, skeleton: Skeleton3D):
	_instance = instance
	_skeleton = skeleton
	_build_bone_map()

func _build_bone_map():
	_bone_name_to_idx.clear()
	var meta = _instance.vrm_meta
	if meta == null or not meta is Resource:
		return
	var bone_map = meta.get("humanoid_bone_mapping")
	if bone_map == null or not bone_map is BoneMap:
		return
	var profile: SkeletonProfileHumanoid = bone_map.profile
	for i in range(profile.bone_size):
		var bone_name = profile.get_bone_name(i)
		var skeleton_bone_name = bone_map.get_skeleton_bone_name(bone_name)
		if not skeleton_bone_name.is_empty():
			var bone_idx = _skeleton.find_bone(skeleton_bone_name)
			if bone_idx >= 0:
				_bone_name_to_idx[bone_name] = bone_idx

func get_bone_index(bone_name: String) -> int:
	return _bone_name_to_idx.get(bone_name, -1)

func get_bone_transform(bone_name: String) -> Transform3D:
	var idx = get_bone_index(bone_name)
	if idx < 0:
		return Transform3D.IDENTITY
	return _skeleton.get_bone_global_pose(idx)

func set_bone_rotation(bone_name: String, rotation: Quaternion):
	var idx = get_bone_index(bone_name)
	if idx < 0:
		return
	_skeleton.set_bone_pose_rotation(idx, rotation)

func set_bone_position(bone_name: String, position: Vector3):
	var idx = get_bone_index(bone_name)
	if idx < 0:
		return
	_skeleton.set_bone_pose_position(idx, position)

func get_bone_rotation(bone_name: String) -> Quaternion:
	var idx = get_bone_index(bone_name)
	if idx < 0:
		return Quaternion.IDENTITY
	return _skeleton.get_bone_pose_rotation(idx)

func reset_all_bones():
	for bone_name in _bone_name_to_idx.keys():
		var idx = _bone_name_to_idx[bone_name]
		_skeleton.set_bone_pose_rotation(idx, Quaternion.IDENTITY)
		_skeleton.set_bone_pose_position(idx, Vector3.ZERO)
		_skeleton.set_bone_pose_scale(idx, Vector3.ONE)

func get_skeleton() -> Skeleton3D:
	return _skeleton
