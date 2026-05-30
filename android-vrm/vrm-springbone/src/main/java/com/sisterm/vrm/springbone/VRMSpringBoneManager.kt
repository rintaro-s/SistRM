package com.sisterm.vrm.springbone

class VRMSpringBoneManager {
    private val _joints = mutableSetOf<VRMSpringBoneJoint>()
    private val _sortedJoints = mutableListOf<VRMSpringBoneJoint>()
    private var _isSortedJointsDirty = false

    val joints: Set<VRMSpringBoneJoint> get() = _joints.toSet()

    fun addJoint(joint: VRMSpringBoneJoint) {
        _joints.add(joint)
        _isSortedJointsDirty = true
    }

    fun removeJoint(joint: VRMSpringBoneJoint) {
        _joints.remove(joint)
        _isSortedJointsDirty = true
    }

    fun setInitState() {
        sortJoints()
        _sortedJoints.forEach { it.reset() }
    }

    fun reset() {
        sortJoints()
        _sortedJoints.forEach { it.reset() }
    }

    fun update(delta: Float) {
        sortJoints()
        _sortedJoints.forEach { joint ->
            joint.update(delta)
        }
    }

    private fun sortJoints() {
        if (!_isSortedJointsDirty) return

        val order = mutableListOf<VRMSpringBoneJoint>()
        val tried = mutableSetOf<VRMSpringBoneJoint>()
        val done = mutableSetOf<VRMSpringBoneJoint>()

        for (joint in _joints) {
            insertJointSort(joint, tried, done, order)
        }

        _sortedJoints.clear()
        _sortedJoints.addAll(order)
        _isSortedJointsDirty = false
    }

    private fun insertJointSort(
        joint: VRMSpringBoneJoint,
        tried: MutableSet<VRMSpringBoneJoint>,
        done: MutableSet<VRMSpringBoneJoint>,
        order: MutableList<VRMSpringBoneJoint>
    ) {
        if (done.contains(joint)) return
        if (tried.contains(joint)) return // circular dependency detected

        tried.add(joint)

        // Simple dependency: parent joints (by node hierarchy) should be updated first
        // In a real implementation, this would check the actual node hierarchy

        order.add(joint)
        done.add(joint)
    }
}
