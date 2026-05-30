package com.nbks.vrm.math

import kotlin.math.sqrt

data class Vector3(
    var x: Float = 0.0f,
    var y: Float = 0.0f,
    var z: Float = 0.0f
) {
    fun set(x: Float, y: Float, z: Float): Vector3 {
        this.x = x; this.y = y; this.z = z
        return this
    }
    fun clone(): Vector3 = Vector3(x, y, z)
    fun add(v: Vector3): Vector3 { x += v.x; y += v.y; z += v.z; return this }
    fun sub(v: Vector3): Vector3 { x -= v.x; y -= v.y; z -= v.z; return this }
    fun scale(s: Float): Vector3 { x *= s; y *= s; z *= s; return this }
    fun dot(v: Vector3): Float = x * v.x + y * v.y + z * v.z
    fun length(): Float = sqrt(x * x + y * y + z * z)
    fun normalize(): Vector3 {
        val len = length()
        if (len > 0) { val inv = 1.0f / len; x *= inv; y *= inv; z *= inv }
        return this
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
    operator fun plus(v: Vector3): Vector3 = clone().add(v)
    operator fun minus(v: Vector3): Vector3 = clone().sub(v)
    operator fun times(s: Float): Vector3 = clone().scale(s)
    companion object {
        val ZERO = Vector3(0f, 0f, 0f)
        val ONE = Vector3(1f, 1f, 1f)
        val UP = Vector3(0f, 1f, 0f)
    }
}
