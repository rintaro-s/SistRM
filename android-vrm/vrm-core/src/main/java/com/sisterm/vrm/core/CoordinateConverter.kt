package com.sisterm.vrm.core

import com.sisterm.vrm.core.math.Matrix4
import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.core.math.Vector3

/**
 * SisterRM Standard Coordinate System (SSCS) converter.
 *
 * SSCS: Right-handed, Y-up, -Z forward, meters.
 * Most platforms (Three.js, Godot, Filament, Android) are natively SSCS.
 * Unity is Left-handed Y-up (+Z forward in world space) and requires conversion.
 */
object CoordinateConverter {

    enum class CoordinateSystem {
        SSCS,           // SisterRM Standard: RH, Y-up, -Z forward
        UNITY,          // Unity: LH, Y-up, +Z world forward
        VRM0_RAW,       // VRM 0.0 spec error: RH, Y-up, +Z forward
    }

    // ==================== Position / Vector ====================

    fun convertPosition(
        pos: Vector3,
        from: CoordinateSystem,
        to: CoordinateSystem
    ): Vector3 {
        if (from == to) return pos.clone()
        val standard = toStandardPosition(pos, from)
        return fromStandardPosition(standard, to)
    }

    fun convertDirection(
        dir: Vector3,
        from: CoordinateSystem,
        to: CoordinateSystem
    ): Vector3 {
        if (from == to) return dir.clone()
        val standard = toStandardDirection(dir, from)
        return fromStandardDirection(standard, to)
    }

    // ==================== Rotation (Quaternion) ====================

    fun convertRotation(
        rot: Quaternion,
        from: CoordinateSystem,
        to: CoordinateSystem
    ): Quaternion {
        if (from == to) return rot.clone()
        val standard = toStandardRotation(rot, from)
        return fromStandardRotation(standard, to)
    }

    // ==================== Scale ====================

    fun convertScale(
        scale: Vector3,
        from: CoordinateSystem,
        to: CoordinateSystem
    ): Vector3 {
        // Scale is invariant for handedness changes
        // VRM 0.0 raw doesn't affect scale
        return scale.clone()
    }

    // ==================== Full Transform ====================

    fun convertTransform(
        position: Vector3,
        rotation: Quaternion,
        scale: Vector3,
        from: CoordinateSystem,
        to: CoordinateSystem
    ): TransformData {
        if (from == to) {
            return TransformData(position.clone(), rotation.clone(), scale.clone())
        }
        val stdPos = toStandardPosition(position, from)
        val stdRot = toStandardRotation(rotation, from)
        val stdScale = scale.clone() // invariant

        return TransformData(
            position = fromStandardPosition(stdPos, to),
            rotation = fromStandardRotation(stdRot, to),
            scale = fromStandardScale(stdScale, to)
        )
    }

    // ==================== To Standard (SSCS) ====================

    fun toStandardPosition(pos: Vector3, from: CoordinateSystem): Vector3 {
        return when (from) {
            CoordinateSystem.SSCS -> pos.clone()
            CoordinateSystem.UNITY -> Vector3(-pos.x, pos.y, pos.z)
            CoordinateSystem.VRM0_RAW -> Vector3(-pos.x, pos.y, -pos.z) // 180° Y rotation
        }
    }

    fun toStandardDirection(dir: Vector3, from: CoordinateSystem): Vector3 {
        return when (from) {
            CoordinateSystem.SSCS -> dir.clone()
            CoordinateSystem.UNITY -> Vector3(-dir.x, dir.y, dir.z)
            CoordinateSystem.VRM0_RAW -> Vector3(-dir.x, dir.y, -dir.z)
        }
    }

    fun toStandardRotation(rot: Quaternion, from: CoordinateSystem): Quaternion {
        return when (from) {
            CoordinateSystem.SSCS -> rot.clone()
            CoordinateSystem.UNITY -> convertQuaternionLhToRh(rot)
            CoordinateSystem.VRM0_RAW -> {
                // Apply 180° Y rotation to correct VRM 0.0 +Z forward
                val correction = Quaternion().setFromAxisAngle(Vector3.UP, kotlin.math.PI.toFloat())
                correction.multiply(rot)
                correction
            }
        }
    }

    // ==================== From Standard (SSCS) ====================

    fun fromStandardPosition(pos: Vector3, to: CoordinateSystem): Vector3 {
        return when (to) {
            CoordinateSystem.SSCS -> pos.clone()
            CoordinateSystem.UNITY -> Vector3(-pos.x, pos.y, pos.z)
            CoordinateSystem.VRM0_RAW -> Vector3(-pos.x, pos.y, -pos.z)
        }
    }

    fun fromStandardDirection(dir: Vector3, to: CoordinateSystem): Vector3 {
        return when (to) {
            CoordinateSystem.SSCS -> dir.clone()
            CoordinateSystem.UNITY -> Vector3(-dir.x, dir.y, dir.z)
            CoordinateSystem.VRM0_RAW -> Vector3(-dir.x, dir.y, -dir.z)
        }
    }

    fun fromStandardRotation(rot: Quaternion, to: CoordinateSystem): Quaternion {
        return when (to) {
            CoordinateSystem.SSCS -> rot.clone()
            CoordinateSystem.UNITY -> convertQuaternionLhToRh(rot)
            CoordinateSystem.VRM0_RAW -> {
                val correction = Quaternion().setFromAxisAngle(Vector3.UP, kotlin.math.PI.toFloat())
                correction.multiply(rot)
                correction
            }
        }
    }

    fun fromStandardScale(scale: Vector3, to: CoordinateSystem): Vector3 {
        // Scale is invariant
        return scale.clone()
    }

    // ==================== Unity LH ↔ RH Helpers ====================

    /**
     * Convert quaternion between Left-Handed and Right-Handed Y-up systems.
     * Both directions use the same operation (self-inverse).
     *
     * Derivation: A rotation in LH Y-up is equivalent to the inverse rotation
     * in RH Y-up when the X-axis is mirrored. The quaternion inverse is the
     * conjugate: (-x, -y, -z, w).
     */
    fun convertQuaternionLhToRh(q: Quaternion): Quaternion {
        return Quaternion(-q.x, -q.y, -q.z, q.w)
    }

    /**
     * Convert a 4×4 transform matrix between LH and RH (Y-up).
     * M' = F · M · F where F = diag(-1, 1, 1, 1)
     */
    fun convertMatrixLhToRh(m: Matrix4): Matrix4 {
        val e = m.elements.clone()
        val result = Matrix4().apply {
            val out = this.elements
            // F * M
            val fm0 = -e[0]; val fm1 = -e[1]; val fm2 = -e[2];  val fm3 = -e[3]
            val fm4 =  e[4]; val fm5 =  e[5]; val fm6 =  e[6];  val fm7 =  e[7]
            val fm8 =  e[8]; val fm9 =  e[9]; val fm10 = e[10]; val fm11 = e[11]
            // (F * M) * F
            out[0] = -fm0;  out[1] = -fm1;  out[2] = -fm2;  out[3] = -fm3
            out[4] =  fm4;  out[5] =  fm5;  out[6] =  fm6;  out[7] =  fm7
            out[8] =  fm8;  out[9] =  fm9;  out[10] = fm10; out[11] = fm11
            out[12] = -e[12]; out[13] = e[13]; out[14] = e[14]; out[15] = e[15]
        }
        return result
    }

    // ==================== VRM 0.0 Correction ====================

    /**
     * Correct a VRM 0.0 model's root transform to match SSCS (VRM 1.0 orientation).
     * Applies a 180° rotation around Y axis.
     */
    fun correctVrm0Orientation(position: Vector3, rotation: Quaternion): Pair<Vector3, Quaternion> {
        val y180 = Quaternion().setFromAxisAngle(Vector3.UP, kotlin.math.PI.toFloat())
        val correctedPos = position.clone().applyQuaternion(y180)
        val correctedRot = y180.clone().multiply(rotation)
        return Pair(correctedPos, correctedRot)
    }

    // ==================== Validation ====================

    fun isValidStandardPosition(pos: Vector3): Boolean {
        val max = 1_000_000f
        return pos.x in -max..max && pos.y in -max..max && pos.z in -max..max
    }

    fun isValidStandardRotation(rot: Quaternion): Boolean {
        val len = kotlin.math.sqrt(rot.x * rot.x + rot.y * rot.y + rot.z * rot.z + rot.w * rot.w)
        return kotlin.math.abs(len - 1.0f) < 0.01f
    }

    fun isValidStandardScale(scale: Vector3): Boolean {
        val min = 0.001f
        val max = 1000f
        return scale.x in min..max && scale.y in min..max && scale.z in min..max
    }

    data class TransformData(
        val position: Vector3,
        val rotation: Quaternion,
        val scale: Vector3
    )
}
