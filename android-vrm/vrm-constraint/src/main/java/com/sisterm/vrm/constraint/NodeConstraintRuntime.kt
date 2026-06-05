package com.sisterm.vrm.constraint

import com.sisterm.vrm.core.math.Vector3
import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.loader.*

enum class ConstraintType {
    AIM, ROLL, ROTATION
}

data class NodeConstraint(
    val type: ConstraintType,
    val sourceNode: Int,
    val sourceBone: String? = null,
    val weight: Float = 1.0f,
    val aimAxis: String = "PositiveY",
    val rollAxis: String = "X"
)

class NodeConstraintRuntime {
    val constraints = mutableListOf<NodeConstraint>()

    fun loadFromVrm1(nodes: List<GltfNode>, constraintExtensions: List<Vrm1NodeConstraintExtension>) {
        constraints.clear()
        for ((nodeIdx, ext) in constraintExtensions.withIndex()) {
            val c = ext.constraint
            val sourceNode = nodeIdx

            c.aim?.let {
                constraints.add(NodeConstraint(
                    type = ConstraintType.AIM,
                    sourceNode = it.source,
                    weight = it.weight,
                    aimAxis = it.aimAxis
                ))
            }
            c.roll?.let {
                constraints.add(NodeConstraint(
                    type = ConstraintType.ROLL,
                    sourceNode = it.source,
                    weight = it.weight,
                    rollAxis = it.rollAxis
                ))
            }
            c.rotation?.let {
                constraints.add(NodeConstraint(
                    type = ConstraintType.ROTATION,
                    sourceNode = it.source,
                    weight = it.weight
                ))
            }
        }
    }

    fun evaluate(
        nodeIndex: Int,
        targetRotation: Quaternion,
        transforms: Map<Int, Pair<Vector3, Quaternion>>
    ): Quaternion {
        val result = Quaternion().copy(targetRotation)

        for (constraint in constraints) {
            if (constraint.sourceNode != nodeIndex) continue
            val src = transforms[constraint.sourceNode] ?: continue
            val weight = constraint.weight.coerceIn(0f, 1f)

            when (constraint.type) {
                ConstraintType.AIM -> {
                    val srcPos = src.first
                    val targetPos = transforms[nodeIndex]?.first ?: continue
                    val direction = Vector3().copy(targetPos).sub(srcPos).normalize()
                    val aimRot = Quaternion().setFromUnitVectors(getAimAxis(constraint.aimAxis), direction)
                    result.slerp(aimRot, weight)
                }
                ConstraintType.ROLL -> {
                    val srcRot = src.second
                    val rollAxis = getRollAxis(constraint.rollAxis)
                    val angle = extractAxisAngle(srcRot, rollAxis)
                    val rollRot = Quaternion().setFromAxisAngle(rollAxis, angle)
                    result.slerp(rollRot, weight)
                }
                ConstraintType.ROTATION -> {
                    val srcRot = src.second
                    result.slerp(srcRot, weight)
                }
            }
        }
        return result
    }

    private fun getAimAxis(name: String): Vector3 {
        return when (name) {
            "PositiveX" -> Vector3(1f, 0f, 0f)
            "NegativeX" -> Vector3(-1f, 0f, 0f)
            "PositiveY" -> Vector3(0f, 1f, 0f)
            "NegativeY" -> Vector3(0f, -1f, 0f)
            "PositiveZ" -> Vector3(0f, 0f, 1f)
            "NegativeZ" -> Vector3(0f, 0f, -1f)
            else -> Vector3(0f, 1f, 0f)
        }
    }

    private fun getRollAxis(name: String): Vector3 {
        return when (name) {
            "X" -> Vector3(1f, 0f, 0f)
            "Y" -> Vector3(0f, 1f, 0f)
            "Z" -> Vector3(0f, 0f, 1f)
            else -> Vector3(1f, 0f, 0f)
        }
    }

    private fun extractAxisAngle(q: Quaternion, axis: Vector3): Float {
        val component = when {
            axis.x > 0.5f -> q.x
            axis.y > 0.5f -> q.y
            axis.z > 0.5f -> q.z
            else -> q.x
        }
        return kotlin.math.asin((component * 2f).coerceIn(-1f, 1f))
    }
}
