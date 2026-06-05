package com.sisterm.vrm.lookat

import com.sisterm.vrm.core.math.Vector3
import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.loader.*

enum class LookAtType {
    BONE, EXPRESSION
}

class LookAtRangeMap(
    val inputMaxValue: Float = 90f,
    val outputScale: Float = 1.0f
)

class LookAtRuntime {
    var type: LookAtType = LookAtType.EXPRESSION
    var offsetFromHeadBone: Vector3 = Vector3(0f, 0f, 0f)

    var horizontalInner = LookAtRangeMap(90f, 1.0f)
    var horizontalOuter = LookAtRangeMap(90f, 1.0f)
    var verticalDown = LookAtRangeMap(90f, 1.0f)
    var verticalUp = LookAtRangeMap(90f, 1.0f)

    var target: Vector3 = Vector3(0f, 0f, 0f)
    var enabled = true

    fun loadFromVrm1(lookAt: Vrm1LookAt) {
        type = when (lookAt.type) {
            "bone" -> LookAtType.BONE
            else -> LookAtType.EXPRESSION
        }
        offsetFromHeadBone = Vector3(
            lookAt.offsetFromHeadBone[0],
            lookAt.offsetFromHeadBone[1],
            lookAt.offsetFromHeadBone[2]
        )
        horizontalInner = LookAtRangeMap(
            lookAt.rangeMapHorizontalInner.inputMaxValue,
            lookAt.rangeMapHorizontalInner.outputScale
        )
        horizontalOuter = LookAtRangeMap(
            lookAt.rangeMapHorizontalOuter.inputMaxValue,
            lookAt.rangeMapHorizontalOuter.outputScale
        )
        verticalDown = LookAtRangeMap(
            lookAt.rangeMapVerticalDown.inputMaxValue,
            lookAt.rangeMapVerticalDown.outputScale
        )
        verticalUp = LookAtRangeMap(
            lookAt.rangeMapVerticalUp.inputMaxValue,
            lookAt.rangeMapVerticalUp.outputScale
        )
    }

    fun calculateLookAt(
        headWorldPosition: Vector3,
        headWorldRotation: Quaternion
    ): Pair<Float, Float> {
        if (!enabled) return Pair(0f, 0f)

        val lookFrom = Vector3().copy(headWorldPosition)
            .add(Vector3().copy(offsetFromHeadBone).applyQuaternion(headWorldRotation))

        val direction = Vector3().copy(target).sub(lookFrom).normalize()

        val headForward = Vector3(0f, 0f, -1f).applyQuaternion(headWorldRotation)
        val headRight = Vector3(1f, 0f, 0f).applyQuaternion(headWorldRotation)
        val headUp = Vector3(0f, 1f, 0f).applyQuaternion(headWorldRotation)

        val yaw = Math.toDegrees(Math.atan2(
            direction.dot(headRight).toDouble(),
            direction.dot(headForward).toDouble()
        )).toFloat()

        val pitch = Math.toDegrees(Math.asin(
            (-direction.dot(headUp)).toDouble().coerceIn(-1.0, 1.0)
        )).toFloat()

        val mappedYaw = applyRangeMap(yaw, horizontalInner, horizontalOuter)
        val mappedPitch = applyRangeMap(pitch, verticalDown, verticalUp)

        return Pair(mappedYaw, mappedPitch)
    }

    private fun applyRangeMap(angle: Float, inner: LookAtRangeMap, outer: LookAtRangeMap): Float {
        val absAngle = kotlin.math.abs(angle)
        val sign = if (angle >= 0) 1f else -1f

        if (absAngle <= inner.inputMaxValue) {
            return (angle / inner.inputMaxValue) * inner.outputScale
        }
        val innerPart = inner.outputScale * sign
        val outerPart = ((absAngle - inner.inputMaxValue) / (outer.inputMaxValue - inner.inputMaxValue))
            .coerceIn(0f, 1f) * outer.outputScale * sign
        return (innerPart + outerPart).coerceIn(-1f, 1f)
    }

    fun getExpressionValues(yaw: Float, pitch: Float): Map<String, Float> {
        val result = mutableMapOf<String, Float>()
        result["lookUp"] = (pitch.coerceAtLeast(0f))
        result["lookDown"] = (-pitch.coerceAtMost(0f))
        result["lookLeft"] = (-yaw.coerceAtMost(0f))
        result["lookRight"] = (yaw.coerceAtLeast(0f))
        return result
    }

    fun getEyeRotation(yaw: Float, pitch: Float): Quaternion {
        val yawQ = Quaternion().setFromAxisAngle(Vector3.UP, yaw)
        val pitchQ = Quaternion().setFromAxisAngle(Vector3.RIGHT, pitch)
        return yawQ.clone().multiply(pitchQ)
    }
}
