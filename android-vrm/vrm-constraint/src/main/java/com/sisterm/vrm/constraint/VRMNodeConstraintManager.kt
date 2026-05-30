package com.sisterm.vrm.constraint

import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.core.math.Vector3

class VRMNodeConstraintManager {
    private val _constraints = mutableListOf<VRMNodeConstraint>()

    val constraints: List<VRMNodeConstraint> get() = _constraints

    fun addConstraint(constraint: VRMNodeConstraint) {
        _constraints.add(constraint)
    }

    fun removeConstraint(constraint: VRMNodeConstraint) {
        _constraints.remove(constraint)
    }

    fun update() {
        _constraints.forEach { it.update() }
    }
}

abstract class VRMNodeConstraint(
    val sourceNodeIndex: Int,
    val destinationNodeIndex: Int,
    val weight: Float = 1.0f
) {
    abstract fun update()
}

class VRMRollConstraint(
    sourceNodeIndex: Int,
    destinationNodeIndex: Int,
    weight: Float = 1.0f,
    val rollAxis: RollAxis = RollAxis.X
) : VRMNodeConstraint(sourceNodeIndex, destinationNodeIndex, weight) {

    enum class RollAxis {
        X, Y, Z
    }

    // Placeholder: In a real implementation, this would read source rotation
    // and decompose it to the roll axis, then apply to destination.
    var sourceRotation: Quaternion = Quaternion.IDENTITY
    var destinationRotation: Quaternion = Quaternion.IDENTITY

    override fun update() {
        // Decompose source rotation into swing-twist
        val (swing, twist) = decomposeSwingTwist(sourceRotation, rollAxis)
        // Apply weighted twist to destination
        val weightedTwist = Quaternion().apply {
            x = twist.x * weight
            y = twist.y * weight
            z = twist.z * weight
            w = 1.0f - weight + twist.w * weight
        }.normalize()
        destinationRotation = weightedTwist
    }

    private fun decomposeSwingTwist(rotation: Quaternion, axis: RollAxis): Pair<Quaternion, Quaternion> {
        val twist = Quaternion()
        when (axis) {
            RollAxis.X -> {
                twist.x = rotation.x
                twist.w = rotation.w
                val len = kotlin.math.sqrt(twist.x * twist.x + twist.w * twist.w)
                if (len > 0f) {
                    twist.x /= len
                    twist.w /= len
                }
            }
            RollAxis.Y -> {
                twist.y = rotation.y
                twist.w = rotation.w
                val len = kotlin.math.sqrt(twist.y * twist.y + twist.w * twist.w)
                if (len > 0f) {
                    twist.y /= len
                    twist.w /= len
                }
            }
            RollAxis.Z -> {
                twist.z = rotation.z
                twist.w = rotation.w
                val len = kotlin.math.sqrt(twist.z * twist.z + twist.w * twist.w)
                if (len > 0f) {
                    twist.z /= len
                    twist.w /= len
                }
            }
        }
        // Swing = Twist^-1 * Rotation
        val twistInv = twist.clone().invert()
        val swing = rotation.clone().multiply(twistInv)
        return Pair(swing, twist)
    }
}

class VRMAimConstraint(
    sourceNodeIndex: Int,
    destinationNodeIndex: Int,
    weight: Float = 1.0f,
    val aimAxis: AimAxis = AimAxis.POSITIVE_Y
) : VRMNodeConstraint(sourceNodeIndex, destinationNodeIndex, weight) {

    enum class AimAxis {
        POSITIVE_X, NEGATIVE_X,
        POSITIVE_Y, NEGATIVE_Y,
        POSITIVE_Z, NEGATIVE_Z
    }

    var sourcePosition: Vector3 = Vector3()
    var destinationPosition: Vector3 = Vector3()
    var destinationRotation: Quaternion = Quaternion.IDENTITY

    override fun update() {
        val direction = sourcePosition.clone().sub(destinationPosition).normalize()
        val aimVector = when (aimAxis) {
            AimAxis.POSITIVE_X -> Vector3.RIGHT
            AimAxis.NEGATIVE_X -> Vector3.RIGHT.clone().scale(-1f)
            AimAxis.POSITIVE_Y -> Vector3.UP
            AimAxis.NEGATIVE_Y -> Vector3.UP.clone().scale(-1f)
            AimAxis.POSITIVE_Z -> Vector3.FORWARD
            AimAxis.NEGATIVE_Z -> Vector3.FORWARD.clone().scale(-1f)
        }
        val rot = Quaternion().setFromUnitVectors(aimVector, direction)
        // Apply weight by slerping towards identity
        val identity = Quaternion.IDENTITY
        destinationRotation = slerp(identity, rot, weight)
    }

    private fun slerp(a: Quaternion, b: Quaternion, t: Float): Quaternion {
        return a.clone().slerp(b, t)
    }
}

class VRMRotationConstraint(
    sourceNodeIndex: Int,
    destinationNodeIndex: Int,
    weight: Float = 1.0f
) : VRMNodeConstraint(sourceNodeIndex, destinationNodeIndex, weight) {

    var sourceRotation: Quaternion = Quaternion.IDENTITY
    var destinationRotation: Quaternion = Quaternion.IDENTITY

    override fun update() {
        // Apply weighted rotation
        destinationRotation = Quaternion().apply {
            x = sourceRotation.x * weight
            y = sourceRotation.y * weight
            z = sourceRotation.z * weight
            w = 1.0f - weight + sourceRotation.w * weight
        }.normalize()
    }
}
