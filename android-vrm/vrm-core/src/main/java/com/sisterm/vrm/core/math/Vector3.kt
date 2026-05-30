package com.sisterm.vrm.core.math

import kotlin.math.sqrt

data class Vector3(
    var x: Float = 0.0f,
    var y: Float = 0.0f,
    var z: Float = 0.0f
) {
    fun set(x: Float, y: Float, z: Float): Vector3 {
        this.x = x
        this.y = y
        this.z = z
        return this
    }

    fun copy(v: Vector3): Vector3 {
        this.x = v.x
        this.y = v.y
        this.z = v.z
        return this
    }

    fun add(v: Vector3): Vector3 {
        this.x += v.x
        this.y += v.y
        this.z += v.z
        return this
    }

    fun sub(v: Vector3): Vector3 {
        this.x -= v.x
        this.y -= v.y
        this.z -= v.z
        return this
    }

    fun scale(s: Float): Vector3 {
        this.x *= s
        this.y *= s
        this.z *= s
        return this
    }

    fun multiplyScalar(s: Float): Vector3 = scale(s)

    fun addScaledVector(v: Vector3, s: Float): Vector3 {
        this.x += v.x * s
        this.y += v.y * s
        this.z += v.z * s
        return this
    }

    fun dot(v: Vector3): Float = x * v.x + y * v.y + z * v.z

    fun cross(v: Vector3): Vector3 {
        val ax = x
        val ay = y
        val az = z
        this.x = ay * v.z - az * v.y
        this.y = az * v.x - ax * v.z
        this.z = ax * v.y - ay * v.x
        return this
    }

    fun length(): Float = sqrt(x * x + y * y + z * z)

    fun lengthSq(): Float = x * x + y * y + z * z

    fun normalize(): Vector3 {
        val len = length()
        if (len > 0) {
            val inv = 1.0f / len
            x *= inv
            y *= inv
            z *= inv
        }
        return this
    }

    fun distanceTo(v: Vector3): Float {
        val dx = x - v.x
        val dy = y - v.y
        val dz = z - v.z
        return sqrt(dx * dx + dy * dy + dz * dz)
    }

    fun transformDirection(m: Matrix4): Vector3 {
        val x = this.x
        val y = this.y
        val z = this.z
        val e = m.elements
        this.x = e[0] * x + e[4] * y + e[8] * z
        this.y = e[1] * x + e[5] * y + e[9] * z
        this.z = e[2] * x + e[6] * y + e[10] * z
        return normalize()
    }

    fun applyQuaternion(q: Quaternion): Vector3 {
        val ix = q.w * x + q.y * z - q.z * y
        val iy = q.w * y + q.z * x - q.x * z
        val iz = q.w * z + q.x * y - q.y * x
        val iw = -q.x * x - q.y * y - q.z * z
        x = ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y
        y = iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z
        z = iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
        return this
    }

    fun clone(): Vector3 = Vector3(x, y, z)

    operator fun plus(v: Vector3): Vector3 = clone().add(v)
    operator fun minus(v: Vector3): Vector3 = clone().sub(v)
    operator fun times(s: Float): Vector3 = clone().scale(s)
    operator fun unaryMinus(): Vector3 = Vector3(-x, -y, -z)

    companion object {
        val ZERO = Vector3(0f, 0f, 0f)
        val ONE = Vector3(1f, 1f, 1f)
        val UP = Vector3(0f, 1f, 0f)
        val RIGHT = Vector3(1f, 0f, 0f)
        val FORWARD = Vector3(0f, 0f, 1f)
    }
}
