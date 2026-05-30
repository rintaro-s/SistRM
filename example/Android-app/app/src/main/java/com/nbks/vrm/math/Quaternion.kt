package com.nbks.vrm.math

import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

data class Quaternion(
    var x: Float = 0.0f,
    var y: Float = 0.0f,
    var z: Float = 0.0f,
    var w: Float = 1.0f
) {
    fun set(x: Float, y: Float, z: Float, w: Float): Quaternion {
        this.x = x; this.y = y; this.z = z; this.w = w
        return this
    }
    fun clone(): Quaternion = Quaternion(x, y, z, w)
    fun identity(): Quaternion { x = 0f; y = 0f; z = 0f; w = 1f; return this }
    fun multiply(q: Quaternion): Quaternion {
        val qax = x; val qay = y; val qaz = z; val qaw = w
        val qbx = q.x; val qby = q.y; val qbz = q.z; val qbw = q.w
        x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby
        y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz
        z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx
        w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz
        return this
    }
    fun normalize(): Quaternion {
        var len = sqrt(x * x + y * y + z * z + w * w)
        if (len == 0.0f) return identity()
        len = 1.0f / len
        x *= len; y *= len; z *= len; w *= len
        return this
    }
    fun setFromAxisAngle(axis: Vector3, angle: Float): Quaternion {
        val halfAngle = angle * 0.5f
        val s = sin(halfAngle)
        x = axis.x * s; y = axis.y * s; z = axis.z * s; w = cos(halfAngle)
        return this
    }
    companion object {
        val IDENTITY = Quaternion(0f, 0f, 0f, 1f)
    }
}
