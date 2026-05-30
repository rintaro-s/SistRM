package com.nbks.vrm.core

import com.nbks.vrm.math.Vector3
import kotlin.math.atan2
import kotlin.math.sqrt

class VRMLookAt(
    val humanoid: VRMHumanoid
) {
    var target: Vector3 = Vector3()

    fun getLookAtWorldPosition(): Vector3 {
        val head = humanoid.getBone(HumanoidBoneName.HEAD) ?: return Vector3()
        return head.position.clone()
    }

    fun calculateYawPitch(): Pair<Float, Float> {
        val headPos = getLookAtWorldPosition()
        val dir = target.clone().sub(headPos).normalize()
        val yaw = atan2(dir.x, dir.z)
        val pitch = atan2(dir.y, sqrt(dir.x * dir.x + dir.z * dir.z))
        return Pair(yaw, pitch)
    }
}
