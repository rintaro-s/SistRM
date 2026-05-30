package com.sisterm.vrm.springbone

import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.core.math.Vector3
import kotlin.math.sqrt

class VRMSpringBoneJoint(
    val boneNodeIndex: Int,
    val childNodeIndex: Int? = null,
    var stiffness: Float = 1.0f,
    var gravityPower: Float = 0.0f,
    var gravityDir: Vector3 = Vector3(0f, -1f, 0f),
    var dragForce: Float = 0.4f,
    var hitRadius: Float = 0.0f,
    var colliderGroups: List<VRMSpringBoneColliderGroup> = emptyList()
) {
    private val _currentTail = Vector3()
    private val _prevTail = Vector3()
    private val _boneAxis = Vector3()
    private val _initialLocalRotation = Quaternion.IDENTITY.clone()
    private val _initialLocalChildPosition = Vector3()
    private var _worldSpaceBoneLength: Float = 0.0f

    var bonePosition: Vector3 = Vector3()
    var boneRotation: Quaternion = Quaternion.IDENTITY.clone()
    var boneScale: Vector3 = Vector3(1f, 1f, 1f)

    var childPosition: Vector3? = null
    var parentRotation: Quaternion = Quaternion.IDENTITY.clone()
    var parentPosition: Vector3 = Vector3()

    fun setInitState(initialLocalChildPos: Vector3, initialLocalRotation: Quaternion) {
        _initialLocalRotation.copy(initialLocalRotation)
        _initialLocalChildPosition.copy(initialLocalChildPos)
        _boneAxis.copy(initialLocalChildPos).normalize()

        val worldTail = localToWorld(initialLocalChildPos.clone())
        _currentTail.copy(worldTail)
        _prevTail.copy(worldTail)
    }

    fun reset() {
        boneRotation.copy(_initialLocalRotation)
        val worldTail = localToWorld(_initialLocalChildPosition.clone())
        _currentTail.copy(worldTail)
        _prevTail.copy(worldTail)
    }

    fun update(delta: Float) {
        if (delta <= 0f) return

        calcWorldSpaceBoneLength()

        val worldSpaceBoneAxis = _boneAxis.clone()
            .applyQuaternion(parentRotation)

        val nextTail = _currentTail.clone()
            .add(_currentTail.clone().sub(_prevTail).scale(1.0f - dragForce))
            .addScaledVector(worldSpaceBoneAxis, stiffness * delta)
            .addScaledVector(gravityDir, gravityPower * delta)

        // Normalize bone length
        nextTail.sub(bonePosition).normalize().scale(_worldSpaceBoneLength).add(bonePosition)

        // Collision
        collision(nextTail)

        _prevTail.copy(_currentTail)
        _currentTail.copy(nextTail)

        // Apply rotation
        val worldSpaceInitialRotation = parentRotation.clone().multiply(_initialLocalRotation)
        val worldSpaceInitialMatrixInv = Matrix4FromQuaternion(worldSpaceInitialRotation).invert()

        val toDirection = nextTail.clone().sub(bonePosition).normalize()
        val fromDirection = _boneAxis.clone()
        val rot = Quaternion().setFromUnitVectors(fromDirection, toDirection)
        boneRotation.copy(_initialLocalRotation.clone().multiply(rot))
    }

    private fun collision(tail: Vector3) {
        colliderGroups.forEach { group ->
            group.colliders.forEach { collider ->
                val dist = collider.calculateCollision(tail, hitRadius)
                if (dist < 0f) {
                    tail.addScaledVector(collider.pushVector(tail), -dist)
                    tail.sub(bonePosition)
                    val len = tail.length()
                    if (len > 0f) {
                        tail.scale(_worldSpaceBoneLength / len)
                    }
                    tail.add(bonePosition)
                }
            }
        }
    }

    private fun calcWorldSpaceBoneLength() {
        val start = bonePosition.clone()
        val end = if (childPosition != null) {
            childPosition!!.clone()
        } else {
            localToWorld(_initialLocalChildPosition.clone())
        }
        _worldSpaceBoneLength = start.distanceTo(end)
    }

    private fun localToWorld(v: Vector3): Vector3 {
        v.applyQuaternion(parentRotation)
        v.add(bonePosition)
        return v
    }

    private fun Matrix4FromQuaternion(q: Quaternion): com.sisterm.vrm.core.math.Matrix4 {
        val m = com.sisterm.vrm.core.math.Matrix4()
        val e = m.elements
        val x = q.x; val y = q.y; val z = q.z; val w = q.w
        val x2 = x + x; val y2 = y + y; val z2 = z + z
        val xx = x * x2; val xy = x * y2; val xz = x * z2
        val yy = y * y2; val yz = y * z2; val zz = z * z2
        val wx = w * x2; val wy = w * y2; val wz = w * z2
        e[0] = 1 - (yy + zz); e[4] = xy - wz; e[8] = xz + wy; e[12] = 0f
        e[1] = xy + wz; e[5] = 1 - (xx + zz); e[9] = yz - wx; e[13] = 0f
        e[2] = xz - wy; e[6] = yz + wx; e[10] = 1 - (xx + yy); e[14] = 0f
        e[3] = 0f; e[7] = 0f; e[11] = 0f; e[15] = 1f
        return m
    }
}
