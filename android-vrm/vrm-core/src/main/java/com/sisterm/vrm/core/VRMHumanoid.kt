package com.sisterm.vrm.core

import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.core.math.Vector3

enum class HumanoidBoneName {
    HIPS,
    SPINE,
    CHEST,
    UPPER_CHEST,
    NECK,
    HEAD,
    LEFT_EYE,
    RIGHT_EYE,
    JAW,
    LEFT_UPPER_LEG,
    LEFT_LOWER_LEG,
    LEFT_FOOT,
    LEFT_TOES,
    RIGHT_UPPER_LEG,
    RIGHT_LOWER_LEG,
    RIGHT_FOOT,
    RIGHT_TOES,
    LEFT_SHOULDER,
    LEFT_UPPER_ARM,
    LEFT_LOWER_ARM,
    LEFT_HAND,
    RIGHT_SHOULDER,
    RIGHT_UPPER_ARM,
    RIGHT_LOWER_ARM,
    RIGHT_HAND,
    LEFT_THUMB_METACARPAL,
    LEFT_THUMB_PROXIMAL,
    LEFT_THUMB_DISTAL,
    LEFT_INDEX_PROXIMAL,
    LEFT_INDEX_INTERMEDIATE,
    LEFT_INDEX_DISTAL,
    LEFT_MIDDLE_PROXIMAL,
    LEFT_MIDDLE_INTERMEDIATE,
    LEFT_MIDDLE_DISTAL,
    LEFT_RING_PROXIMAL,
    LEFT_RING_INTERMEDIATE,
    LEFT_RING_DISTAL,
    LEFT_LITTLE_PROXIMAL,
    LEFT_LITTLE_INTERMEDIATE,
    LEFT_LITTLE_DISTAL,
    RIGHT_THUMB_METACARPAL,
    RIGHT_THUMB_PROXIMAL,
    RIGHT_THUMB_DISTAL,
    RIGHT_INDEX_PROXIMAL,
    RIGHT_INDEX_INTERMEDIATE,
    RIGHT_INDEX_DISTAL,
    RIGHT_MIDDLE_PROXIMAL,
    RIGHT_MIDDLE_INTERMEDIATE,
    RIGHT_MIDDLE_DISTAL,
    RIGHT_RING_PROXIMAL,
    RIGHT_RING_INTERMEDIATE,
    RIGHT_RING_DISTAL,
    RIGHT_LITTLE_PROXIMAL,
    RIGHT_LITTLE_INTERMEDIATE,
    RIGHT_LITTLE_DISTAL
}

class Bone(
    val name: String,
    val nodeIndex: Int
) {
    var position: Vector3 = Vector3()
    var rotation: Quaternion = Quaternion.IDENTITY.clone()
    var scale: Vector3 = Vector3(1f, 1f, 1f)
    var worldMatrix: com.sisterm.vrm.core.math.Matrix4 = com.sisterm.vrm.core.math.Matrix4()

    val localMatrix: com.sisterm.vrm.core.math.Matrix4
        get() {
            val m = com.sisterm.vrm.core.math.Matrix4()
            m.compose(position, rotation, scale)
            return m
        }
}

class VRMHumanoid(
    boneMap: Map<HumanoidBoneName, Bone>
) {
    private val _bones = boneMap.toMutableMap()
    private val _normalizedBones = mutableMapOf<HumanoidBoneName, Bone>()

    val bones: Map<HumanoidBoneName, Bone> get() = _bones

    fun getBone(name: HumanoidBoneName): Bone? = _bones[name]

    fun getNormalizedBone(name: HumanoidBoneName): Bone? {
        return _normalizedBones[name]
    }

    fun setNormalizedBone(name: HumanoidBoneName, bone: Bone) {
        _normalizedBones[name] = bone
    }

    fun getBoneNodeIndex(name: HumanoidBoneName): Int? = _bones[name]?.nodeIndex

    fun getBoneNames(): Set<HumanoidBoneName> = _bones.keys
}
