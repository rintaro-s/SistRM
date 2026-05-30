package com.sisterm.vrm.core

import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.core.math.Vector3
import kotlin.math.atan2
import kotlin.math.sqrt

enum class LookAtType {
    BONE,
    EXPRESSION
}

class LookAtRangeMap(
    var inputMaxValue: Float = 90.0f,
    var outputScale: Float = 1.0f
) {
    fun map(value: Float): Float {
        return outputScale * (value / inputMaxValue).coerceIn(0.0f, 1.0f)
    }
}

class VRMLookAt(
    val humanoid: VRMHumanoid,
    var lookAtType: LookAtType = LookAtType.BONE,
    var offsetFromHeadBone: Vector3 = Vector3()
) {
    var target: Vector3 = Vector3()
    var autoUpdate: Boolean = true
    var faceFront: Vector3 = Vector3(0f, 0f, 1f)

    private var _yaw: Float = 0.0f
    private var _pitch: Float = 0.0f
    private var _needsUpdate: Boolean = true

    val yaw: Float get() = _yaw
    val pitch: Float get() = _pitch

    var rangeMapHorizontalInner: LookAtRangeMap = LookAtRangeMap()
    var rangeMapHorizontalOuter: LookAtRangeMap = LookAtRangeMap()
    var rangeMapVerticalDown: LookAtRangeMap = LookAtRangeMap()
    var rangeMapVerticalUp: LookAtRangeMap = LookAtRangeMap()

    private val _restHeadWorldQuaternion: Quaternion = Quaternion.IDENTITY.clone()

    fun lookAt(position: Vector3) {
        val headPos = getLookAtWorldPosition(Vector3())
        val lookAtDir = position.clone().sub(headPos).normalize()

        val (_, altitudeFrom) = calcAzimuthAltitude(faceFront)
        val (azimuthTo, altitudeTo) = calcAzimuthAltitude(lookAtDir)

        val yaw = sanitizeAngle(azimuthTo - altitudeFrom)
        val pitch = sanitizeAngle(altitudeFrom - altitudeTo)

        _yaw = yaw
        _pitch = pitch
        _needsUpdate = true
    }

    fun update(delta: Float) {
        if (autoUpdate) {
            lookAt(target)
        }

        if (_needsUpdate) {
            _needsUpdate = false
            applyYawPitch(_yaw, _pitch)
        }
    }

    private fun applyYawPitch(yaw: Float, pitch: Float) {
        // Subclasses or appliers would implement the actual bone/expression application
    }

    fun getLookAtWorldPosition(target: Vector3): Vector3 {
        val head = humanoid.getBone(HumanoidBoneName.HEAD) ?: return target
        return target.copy(offsetFromHeadBone)
    }

    fun reset() {
        _yaw = 0.0f
        _pitch = 0.0f
        _needsUpdate = true
    }

    private fun calcAzimuthAltitude(direction: Vector3): Pair<Float, Float> {
        val azimuth = atan2(direction.x, direction.z)
        val altitude = atan2(direction.y, sqrt(direction.x * direction.x + direction.z * direction.z))
        return Pair(azimuth, altitude)
    }

    private fun sanitizeAngle(angle: Float): Float {
        var result = angle
        while (result > kotlin.math.PI) result -= 2 * kotlin.math.PI.toFloat()
        while (result < -kotlin.math.PI) result += 2 * kotlin.math.PI.toFloat()
        return result
    }
}
