package com.sisterm.vrm.springbone

import com.sisterm.vrm.core.math.Vector3
import kotlin.math.sqrt

sealed class VRMSpringBoneColliderShape {
    abstract fun calculateCollision(position: Vector3, radius: Float): Float
    abstract fun pushVector(position: Vector3): Vector3
}

class SphereColliderShape(
    val offset: Vector3 = Vector3(),
    val radius: Float = 0f
) : VRMSpringBoneColliderShape() {
    override fun calculateCollision(position: Vector3, hitRadius: Float): Float {
        val diff = position.clone().sub(offset)
        val dist = diff.length()
        return dist - (radius + hitRadius)
    }

    override fun pushVector(position: Vector3): Vector3 {
        val diff = position.clone().sub(offset)
        diff.normalize()
        return diff
    }
}

class CapsuleColliderShape(
    val offset: Vector3 = Vector3(),
    val radius: Float = 0f,
    val tail: Vector3 = Vector3()
) : VRMSpringBoneColliderShape() {
    private val axis = tail.clone().sub(offset)
    private val lengthSq = axis.lengthSq()

    override fun calculateCollision(position: Vector3, hitRadius: Float): Float {
        val closest = closestPointOnSegment(position)
        val diff = position.clone().sub(closest)
        val dist = diff.length()
        return dist - (radius + hitRadius)
    }

    override fun pushVector(position: Vector3): Vector3 {
        val closest = closestPointOnSegment(position)
        val diff = position.clone().sub(closest)
        diff.normalize()
        return diff
    }

    private fun closestPointOnSegment(point: Vector3): Vector3 {
        if (lengthSq == 0f) return offset.clone()
        val t = ((point.x - offset.x) * axis.x +
                (point.y - offset.y) * axis.y +
                (point.z - offset.z) * axis.z) / lengthSq
        val clamped = t.coerceIn(0f, 1f)
        return Vector3(
            offset.x + axis.x * clamped,
            offset.y + axis.y * clamped,
            offset.z + axis.z * clamped
        )
    }
}

class VRMSpringBoneCollider(
    val nodeIndex: Int,
    val shape: VRMSpringBoneColliderShape
) {
    var worldPosition: Vector3 = Vector3()
    var worldRotation: com.sisterm.vrm.core.math.Quaternion = com.sisterm.vrm.core.math.Quaternion.IDENTITY.clone()

    fun calculateCollision(tail: Vector3, hitRadius: Float): Float {
        return shape.calculateCollision(tail, hitRadius)
    }

    fun pushVector(tail: Vector3): Vector3 {
        return shape.pushVector(tail)
    }
}

class VRMSpringBoneColliderGroup(
    val colliders: List<VRMSpringBoneCollider> = emptyList()
)
