package com.sisterm.vrm.core

import com.sisterm.vrm.springbone.VRMSpringBoneManager
import com.sisterm.vrm.constraint.VRMNodeConstraintManager

class VRMInstance(
    val humanoid: VRMHumanoid,
    val expressions: VRMExpressionManager,
    val lookAt: VRMLookAt,
    val firstPerson: VRMFirstPerson,
    val meta: VRMMeta,
    val springBone: VRMSpringBoneManager,
    val nodeConstraint: VRMNodeConstraintManager
) {
    fun update(delta: Float) {
        lookAt.update(delta)
        expressions.update()
        nodeConstraint.update()
        springBone.update(delta)
    }
}
