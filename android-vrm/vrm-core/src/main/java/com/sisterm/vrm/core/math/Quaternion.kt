package com.sisterm.vrm.core.math

import kotlin.math.abs
import kotlin.math.acos
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
        this.x = x
        this.y = y
        this.z = z
        this.w = w
        return this
    }

    fun copy(q: Quaternion): Quaternion {
        this.x = q.x
        this.y = q.y
        this.z = q.z
        this.w = q.w
        return this
    }

    fun identity(): Quaternion {
        x = 0.0f
        y = 0.0f
        z = 0.0f
        w = 1.0f
        return this
    }

    fun multiply(q: Quaternion): Quaternion {
        val qax = x
        val qay = y
        val qaz = z
        val qaw = w
        val qbx = q.x
        val qby = q.y
        val qbz = q.z
        val qbw = q.w
        x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby
        y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz
        z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx
        w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz
        return this
    }

    fun premultiply(q: Quaternion): Quaternion {
        val px = q.x
        val py = q.y
        val pz = q.z
        val pw = q.w
        x = px * w + pw * x + py * z - pz * y
        y = py * w + pw * y + pz * x - px * z
        z = pz * w + pw * z + px * y - py * x
        w = pw * w - px * x - py * y - pz * z
        return this
    }

    fun invert(): Quaternion {
        val dot = x * x + y * y + z * z + w * w
        if (dot == 0.0f) {
            return identity()
        }
        val invDot = 1.0f / dot
        x *= -invDot
        y *= -invDot
        z *= -invDot
        w *= invDot
        return this
    }

    fun normalize(): Quaternion {
        var len = sqrt(x * x + y * y + z * z + w * w)
        if (len == 0.0f) {
            return identity()
        }
        len = 1.0f / len
        x *= len
        y *= len
        z *= len
        w *= len
        return this
    }

    fun setFromUnitVectors(from: Vector3, to: Vector3): Quaternion {
        var r = from.dot(to) + 1.0f
        if (r < 0.000001f) {
            r = 0.0f
            if (abs(from.x) > abs(from.z)) {
                x = -from.y
                y = from.x
                z = 0.0f
                w = r
            } else {
                x = 0.0f
                y = -from.z
                z = from.y
                w = r
            }
        } else {
            x = from.y * to.z - from.z * to.y
            y = from.z * to.x - from.x * to.z
            z = from.x * to.y - from.y * to.x
            w = r
        }
        return normalize()
    }

    fun setFromAxisAngle(axis: Vector3, angle: Float): Quaternion {
        val halfAngle = angle * 0.5f
        val s = sin(halfAngle)
        x = axis.x * s
        y = axis.y * s
        z = axis.z * s
        w = cos(halfAngle)
        return this
    }

    fun slerp(q: Quaternion, t: Float): Quaternion {
        var cosHalfTheta = w * q.w + x * q.x + y * q.y + z * q.z
        if (cosHalfTheta < 0.0f) {
            w = -q.w
            x = -q.x
            y = -q.y
            z = -q.z
            cosHalfTheta = -cosHalfTheta
        } else {
            copy(q)
        }
        if (cosHalfTheta >= 1.0f) {
            w = w
            x = x
            y = y
            z = z
            return this
        }
        val sqrSinHalfTheta = 1.0f - cosHalfTheta * cosHalfTheta
        if (sqrSinHalfTheta <= 0.000001f) {
            val s = 1.0f - t
            w = s * w + t * w
            x = s * x + t * x
            y = s * y + t * y
            z = s * z + t * z
            return normalize()
        }
        val sinHalfTheta = sqrt(sqrSinHalfTheta)
        val halfTheta = acos(cosHalfTheta)
        val ratioA = sin((1.0f - t) * halfTheta) / sinHalfTheta
        val ratioB = sin(t * halfTheta) / sinHalfTheta
        w = w * ratioA + w * ratioB
        x = x * ratioA + x * ratioB
        y = y * ratioA + y * ratioB
        z = z * ratioA + z * ratioB
        return this
    }

    fun clone(): Quaternion = Quaternion(x, y, z, w)

    companion object {
        val IDENTITY = Quaternion(0f, 0f, 0f, 1f)
    }
}
