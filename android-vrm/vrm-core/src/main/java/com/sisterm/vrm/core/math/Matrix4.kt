package com.sisterm.vrm.core.math

import kotlin.math.abs

data class Matrix4(
    val elements: FloatArray = FloatArray(16) { i -> if (i % 5 == 0) 1.0f else 0.0f }
) {
    init {
        require(elements.size == 16) { "Matrix4 requires exactly 16 elements" }
    }

    fun identity(): Matrix4 {
        val e = elements
        e[0] = 1f; e[4] = 0f; e[8] = 0f; e[12] = 0f
        e[1] = 0f; e[5] = 1f; e[9] = 0f; e[13] = 0f
        e[2] = 0f; e[6] = 0f; e[10] = 1f; e[14] = 0f
        e[3] = 0f; e[7] = 0f; e[11] = 0f; e[15] = 1f
        return this
    }

    fun copy(m: Matrix4): Matrix4 {
        System.arraycopy(m.elements, 0, elements, 0, 16)
        return this
    }

    fun multiply(m: Matrix4): Matrix4 {
        val ae = elements
        val be = m.elements
        val a11 = ae[0]; val a12 = ae[4]; val a13 = ae[8]; val a14 = ae[12]
        val a21 = ae[1]; val a22 = ae[5]; val a23 = ae[9]; val a24 = ae[13]
        val a31 = ae[2]; val a32 = ae[6]; val a33 = ae[10]; val a34 = ae[14]
        val a41 = ae[3]; val a42 = ae[7]; val a43 = ae[11]; val a44 = ae[15]
        val b11 = be[0]; val b12 = be[4]; val b13 = be[8]; val b14 = be[12]
        val b21 = be[1]; val b22 = be[5]; val b23 = be[9]; val b24 = be[13]
        val b31 = be[2]; val b32 = be[6]; val b33 = be[10]; val b34 = be[14]
        val b41 = be[3]; val b42 = be[7]; val b43 = be[11]; val b44 = be[15]
        ae[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41
        ae[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42
        ae[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43
        ae[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44
        ae[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41
        ae[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42
        ae[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43
        ae[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44
        ae[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41
        ae[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42
        ae[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43
        ae[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44
        ae[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41
        ae[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42
        ae[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43
        ae[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44
        return this
    }

    fun invert(): Matrix4 {
        val te = elements
        val n11 = te[0]; val n12 = te[4]; val n13 = te[8]; val n14 = te[12]
        val n21 = te[1]; val n22 = te[5]; val n23 = te[9]; val n24 = te[13]
        val n31 = te[2]; val n32 = te[6]; val n33 = te[10]; val n34 = te[14]
        val n41 = te[3]; val n42 = te[7]; val n43 = te[11]; val n44 = te[15]
        val t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44
        val t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44
        val t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44
        val t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34
        val det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14
        if (det == 0.0f) return identity()
        val detInv = 1.0f / det
        te[0] = t11 * detInv
        te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv
        te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv
        te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv
        te[4] = t12 * detInv
        te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv
        te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv
        te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv
        te[8] = t13 * detInv
        te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv
        te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv
        te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv
        te[12] = t14 * detInv
        te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv
        te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv
        te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv
        return this
    }

    fun setPosition(v: Vector3): Matrix4 {
        val te = elements
        te[12] = v.x
        te[13] = v.y
        te[14] = v.z
        return this
    }

    fun getPosition(target: Vector3): Vector3 {
        val te = elements
        target.x = te[12]
        target.y = te[13]
        target.z = te[14]
        return target
    }

    fun compose(position: Vector3, quaternion: Quaternion, scale: Vector3): Matrix4 {
        val te = elements
        val x = quaternion.x; val y = quaternion.y; val z = quaternion.z; val w = quaternion.w
        val x2 = x + x; val y2 = y + y; val z2 = z + z
        val xx = x * x2; val xy = x * y2; val xz = x * z2
        val yy = y * y2; val yz = y * z2; val zz = z * z2
        val wx = w * x2; val wy = w * y2; val wz = w * z2
        val sx = scale.x; val sy = scale.y; val sz = scale.z
        te[0] = (1 - (yy + zz)) * sx
        te[1] = (xy + wz) * sx
        te[2] = (xz - wy) * sx
        te[3] = 0f
        te[4] = (xy - wz) * sy
        te[5] = (1 - (xx + zz)) * sy
        te[6] = (yz + wx) * sy
        te[7] = 0f
        te[8] = (xz + wy) * sz
        te[9] = (yz - wx) * sz
        te[10] = (1 - (xx + yy)) * sz
        te[11] = 0f
        te[12] = position.x
        te[13] = position.y
        te[14] = position.z
        te[15] = 1f
        return this
    }

    fun decompose(position: Vector3, quaternion: Quaternion, scale: Vector3): Matrix4 {
        val te = elements
        var sx = Vector3(te[0], te[1], te[2]).length()
        val sy = Vector3(te[4], te[5], te[6]).length()
        val sz = Vector3(te[8], te[9], te[10]).length()
        val det = determinant()
        if (det < 0) sx *= -1
        position.x = te[12]
        position.y = te[13]
        position.z = te[14]
        val invSx = 1f / sx
        val invSy = 1f / sy
        val invSz = 1f / sz
        val m00 = te[0] * invSx; val m01 = te[4] * invSy; val m02 = te[8] * invSz
        val m10 = te[1] * invSx; val m11 = te[5] * invSy; val m12 = te[9] * invSz
        val m20 = te[2] * invSx; val m21 = te[6] * invSy; val m22 = te[10] * invSz
        val trace = m00 + m11 + m22
        if (trace > 0f) {
            val s = 0.5f / kotlin.math.sqrt(trace + 1.0f)
            quaternion.w = 0.25f / s
            quaternion.x = (m21 - m12) * s
            quaternion.y = (m02 - m20) * s
            quaternion.z = (m10 - m01) * s
        } else if (m00 > m11 && m00 > m22) {
            val s = 2.0f * kotlin.math.sqrt(1.0f + m00 - m11 - m22)
            quaternion.w = (m21 - m12) / s
            quaternion.x = 0.25f * s
            quaternion.y = (m01 + m10) / s
            quaternion.z = (m02 + m20) / s
        } else if (m11 > m22) {
            val s = 2.0f * kotlin.math.sqrt(1.0f + m11 - m00 - m22)
            quaternion.w = (m02 - m20) / s
            quaternion.x = (m01 + m10) / s
            quaternion.y = 0.25f * s
            quaternion.z = (m12 + m21) / s
        } else {
            val s = 2.0f * kotlin.math.sqrt(1.0f + m22 - m00 - m11)
            quaternion.w = (m10 - m01) / s
            quaternion.x = (m02 + m20) / s
            quaternion.y = (m12 + m21) / s
            quaternion.z = 0.25f * s
        }
        scale.x = sx
        scale.y = sy
        scale.z = sz
        return this
    }

    fun determinant(): Float {
        val te = elements
        val n11 = te[0]; val n12 = te[4]; val n13 = te[8]; val n14 = te[12]
        val n21 = te[1]; val n22 = te[5]; val n23 = te[9]; val n24 = te[13]
        val n31 = te[2]; val n32 = te[6]; val n33 = te[10]; val n34 = te[14]
        val n41 = te[3]; val n42 = te[7]; val n43 = te[11]; val n44 = te[15]
        return (
            n41 * (+n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34)
                + n42 * (+n11 * n23 * n34 - n11 * n24 * n33 + n14 * n21 * n33 - n13 * n21 * n34 + n13 * n24 * n31 - n14 * n23 * n31)
                + n43 * (+n11 * n24 * n32 - n11 * n22 * n34 - n14 * n21 * n32 + n12 * n21 * n34 + n14 * n22 * n31 - n12 * n24 * n31)
                + n44 * (-n13 * n22 * n31 - n11 * n23 * n32 + n11 * n22 * n33 + n13 * n21 * n32 - n12 * n21 * n33 + n12 * n23 * n31)
            )
    }

    companion object {
        fun fromArray(arr: FloatArray): Matrix4 {
            val m = Matrix4()
            System.arraycopy(arr, 0, m.elements, 0, 16)
            return m
        }
    }
}
