package com.nbks.vrm.math

data class Matrix4(
    val elements: FloatArray = FloatArray(16) { i -> if (i % 5 == 0) 1.0f else 0.0f }
) {
    init { require(elements.size == 16) { "Matrix4 requires exactly 16 elements" } }
    fun compose(position: Vector3, quaternion: Quaternion, scale: Vector3): Matrix4 {
        val te = elements
        val x = quaternion.x; val y = quaternion.y; val z = quaternion.z; val w = quaternion.w
        val x2 = x + x; val y2 = y + y; val z2 = z + z
        val xx = x * x2; val xy = x * y2; val xz = x * z2
        val yy = y * y2; val yz = y * z2; val zz = z * z2
        val wx = w * x2; val wy = w * y2; val wz = w * z2
        val sx = scale.x; val sy = scale.y; val sz = scale.z
        te[0] = (1 - (yy + zz)) * sx; te[1] = (xy + wz) * sx; te[2] = (xz - wy) * sx; te[3] = 0f
        te[4] = (xy - wz) * sy; te[5] = (1 - (xx + zz)) * sy; te[6] = (yz + wx) * sy; te[7] = 0f
        te[8] = (xz + wy) * sz; te[9] = (yz - wx) * sz; te[10] = (1 - (xx + yy)) * sz; te[11] = 0f
        te[12] = position.x; te[13] = position.y; te[14] = position.z; te[15] = 1f
        return this
    }
}
