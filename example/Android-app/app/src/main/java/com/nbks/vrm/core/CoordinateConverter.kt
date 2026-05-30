package com.nbks.vrm.core

import com.nbks.vrm.math.Quaternion
import com.nbks.vrm.math.Vector3

object CoordinateConverter {
    enum class CoordinateSystem { SSCS, UNITY, VRM0_RAW }

    data class TransformData(val position: Vector3, val rotation: Quaternion, val scale: Vector3)

    fun convertTransform(
        position: Vector3, rotation: Quaternion, scale: Vector3,
        from: CoordinateSystem, to: CoordinateSystem
    ): TransformData {
        if (from == to) return TransformData(position.clone(), rotation.clone(), scale.clone())
        val stdPos = toStandardPosition(position, from)
        val stdRot = toStandardRotation(rotation, from)
        return TransformData(
            fromStandardPosition(stdPos, to),
            fromStandardRotation(stdRot, to),
            scale.clone()
        )
    }

    private fun toStandardPosition(pos: Vector3, from: CoordinateSystem): Vector3 = when (from) {
        CoordinateSystem.SSCS -> pos.clone()
        CoordinateSystem.UNITY -> Vector3(-pos.x, pos.y, pos.z)
        CoordinateSystem.VRM0_RAW -> Vector3(-pos.x, pos.y, -pos.z)
    }

    private fun toStandardRotation(rot: Quaternion, from: CoordinateSystem): Quaternion = when (from) {
        CoordinateSystem.SSCS -> rot.clone()
        CoordinateSystem.UNITY -> Quaternion(-rot.x, -rot.y, -rot.z, rot.w)
        CoordinateSystem.VRM0_RAW -> {
            val correction = Quaternion().apply { setFromAxisAngle(Vector3.UP, kotlin.math.PI.toFloat()) }
            correction.multiply(rot)
            correction
        }
    }

    private fun fromStandardPosition(pos: Vector3, to: CoordinateSystem): Vector3 = when (to) {
        CoordinateSystem.SSCS -> pos.clone()
        CoordinateSystem.UNITY -> Vector3(-pos.x, pos.y, pos.z)
        CoordinateSystem.VRM0_RAW -> Vector3(-pos.x, pos.y, -pos.z)
    }

    private fun fromStandardRotation(rot: Quaternion, to: CoordinateSystem): Quaternion = when (to) {
        CoordinateSystem.SSCS -> rot.clone()
        CoordinateSystem.UNITY -> Quaternion(-rot.x, -rot.y, -rot.z, rot.w)
        CoordinateSystem.VRM0_RAW -> {
            val correction = Quaternion().apply { setFromAxisAngle(Vector3.UP, kotlin.math.PI.toFloat()) }
            correction.multiply(rot)
            correction
        }
    }
}
