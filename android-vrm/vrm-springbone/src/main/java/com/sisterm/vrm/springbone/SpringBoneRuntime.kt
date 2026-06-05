package com.sisterm.vrm.springbone

import com.sisterm.vrm.core.math.Vector3
import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.loader.*

class SpringBoneCollider(
    val node: Int,
    val offset: Vector3,
    val radius: Float,
    val tail: Vector3? = null
) {
    val isCapsule: Boolean get() = tail != null

    fun getWorldCenter(parentTransform: SpringBoneTransform): Vector3 {
        return parentTransform.transformPoint(offset)
    }

    fun getWorldTail(parentTransform: SpringBoneTransform): Vector3 {
        return tail?.let { parentTransform.transformPoint(it) } ?: getWorldCenter(parentTransform)
    }

    fun collide(
        particlePos: Vector3,
        particleRadius: Float,
        parentTransform: SpringBoneTransform
    ): Vector3 {
        val center = getWorldCenter(parentTransform)
        val totalRadius = radius + particleRadius

        if (isCapsule) {
            val tailPt = getWorldTail(parentTransform)
            val ab = Vector3().copy(tailPt).sub(center)
            val ap = Vector3().copy(particlePos).sub(center)
            val t = (ap.dot(ab) / ab.lengthSq()).coerceIn(0f, 1f)
            val closest = Vector3().copy(center).add(Vector3().copy(ab).scale(t))
            val diff = Vector3().copy(particlePos).sub(closest)
            val dist = diff.length()
            if (dist < totalRadius && dist > 0.0001f) {
                return Vector3().copy(particlePos).add(diff.normalize().scale(totalRadius - dist))
            }
        } else {
            val diff = Vector3().copy(particlePos).sub(center)
            val dist = diff.length()
            if (dist < totalRadius && dist > 0.0001f) {
                return Vector3().copy(particlePos).add(diff.normalize().scale(totalRadius - dist))
            }
        }
        return particlePos
    }
}

class SpringBoneJoint(
    val node: Int,
    val boneLength: Float,
    val boneAxis: Vector3 = Vector3(0f, -1f, 0f),
    val hitRadius: Float = 0.02f,
    val stiffness: Float = 1.0f,
    val gravityPower: Float = 0f,
    val gravityDir: Vector3 = Vector3(0f, -1f, 0f),
    val dragForce: Float = 0.4f
)

class SpringBoneLogic(
    val joints: List<SpringBoneJoint>,
    val colliders: List<SpringBoneCollider>,
    val centerBone: Int? = null
) {
    data class ParticleState(
        var currentTail: Vector3,
        var prevTail: Vector3,
        var boneAxis: Vector3,
        var boneLength: Float
    )

    val particles = mutableListOf<ParticleState>()
    var initialized = false

    companion object {
        const val GRAVITY_CONSTANT = -1.0f
    }

    fun initialize(transforms: Map<Int, SpringBoneTransform>) {
        particles.clear()
        for (joint in joints) {
            val t = transforms[joint.node] ?: continue
            val parentPos = t.position
            val rotation = t.rotation
            val axis = Vector3().copy(joint.boneAxis).applyQuaternion(rotation).normalize()
            val tail = Vector3().copy(parentPos).add(Vector3().copy(axis).scale(joint.boneLength))
            particles.add(ParticleState(
                currentTail = tail.clone(),
                prevTail = tail.clone(),
                boneAxis = axis.clone(),
                boneLength = joint.boneLength
            ))
        }
        initialized = true
    }

    fun update(
        deltaTime: Float,
        transforms: Map<Int, SpringBoneTransform>,
        externalForce: Vector3 = Vector3(0f, 0f, 0f),
        stiffnessMultiplier: Float = 1.0f,
        gravityMultiplier: Float = 1.0f
    ) {
        if (!initialized) initialize(transforms)

        val dt = deltaTime.coerceAtMost(0.033f)
        val stiffnessScale = stiffnessMultiplier.coerceIn(0f, 10f)
        val gravityScale = gravityMultiplier.coerceIn(0f, 10f)

        for (i in joints.indices) {
            val joint = joints[i]
            val t = transforms[joint.node] ?: continue
            val particle = particles[i]

            val parentPos = t.position
            val rotation = t.rotation
            val boneAxis = Vector3().copy(joint.boneAxis).applyQuaternion(rotation).normalize()

            val verlet = particle.currentTail.clone()
            val prev = particle.prevTail.clone()

            verlet.add(verlet.clone().sub(prev).scale(1.0f - joint.dragForce))

            val gravity = Vector3().copy(joint.gravityDir).normalize()
                .scale(joint.gravityPower * gravityScale * dt * dt)
            verlet.add(gravity)
            verlet.add(Vector3().copy(externalForce).scale(dt * dt))

            particle.prevTail = particle.currentTail.clone()
            particle.currentTail = verlet

            val toParticle = verlet.clone().sub(parentPos)
            toParticle.normalize()
            val toBone = Vector3().copy(boneAxis)

            val diff = toBone.clone().sub(toParticle)
            val stiffnessForce = joint.stiffness * stiffnessScale * dt
            particle.currentTail.add(diff.scale(stiffnessForce))

            val len = particle.currentTail.clone().sub(parentPos).length()
            if (len > 0.0001f) {
                particle.currentTail = parentPos.clone()
                    .add(particle.currentTail.clone().sub(parentPos).normalize().scale(joint.boneLength))
            }

            for (collider in colliders) {
                val parentTransform = centerBone?.let { transforms[it] }
                    ?: SpringBoneTransform.IDENTITY
                particle.currentTail = collider.collide(
                    particle.currentTail, joint.hitRadius, parentTransform
                )
            }

            particle.boneAxis = boneAxis
            particle.boneLength = joint.boneLength
        }
    }

    fun applyRotations(transforms: MutableMap<Int, SpringBoneTransform>) {
        for (i in joints.indices) {
            val joint = joints[i]
            val t = transforms[joint.node] ?: continue
            val particle = particles.getOrNull(i) ?: continue

            val from = particle.boneAxis.clone()
            val to = particle.currentTail.clone().sub(t.position).normalize()

            val rot = Quaternion().setFromUnitVectors(from, to)
            t.rotation = rot.clone().multiply(t.rotation)
        }
    }
}

class SpringBoneRuntime {
    val logics = mutableListOf<SpringBoneLogic>()
    var gravityMultiplier = 1.0f
    var stiffnessMultiplier = 1.0f
    var externalForce = Vector3(0f, 0f, 0f)

    fun loadFromVrm0(vrm0: Vrm0Extension, nodeMap: Map<Int, SpringBoneTransform>) {
        logics.clear()
        for (sb in vrm0.springBone) {
            val joints = sb.joints.map { j ->
                SpringBoneJoint(
                    node = j.boneIndex,
                    boneLength = 0.1f,
                    hitRadius = j.hitRadius,
                    stiffness = j.stiffnessForce,
                    gravityPower = j.gravityPower,
                    gravityDir = Vector3(j.gravityDir[0], j.gravityDir[1], j.gravityDir[2]),
                    dragForce = j.dragForce
                )
            }
            val colliders = sb.colliderGroups.flatMap { cgIdx ->
                vrm0.materialProperties.getOrNull(cgIdx)?.let { emptyList<SpringBoneCollider>() } ?: emptyList()
            }
            logics.add(SpringBoneLogic(joints, colliders))
        }
    }

    fun loadFromVrm1(sb1: Vrm1SpringBone, nodeMap: Map<Int, SpringBoneTransform>) {
        logics.clear()
        val colliders = sb1.colliders.map { c ->
            val shape = c.shape
            val offset = shape.sphere?.let { Vector3(it.offset[0], it.offset[1], it.offset[2]) }
                ?: shape.capsule?.let { Vector3(it.offset[0], it.offset[1], it.offset[2]) }
                ?: Vector3(0f, 0f, 0f)
            val radius = shape.sphere?.radius ?: shape.capsule?.radius ?: 0f
            val tail = shape.capsule?.let { Vector3(it.tail[0], it.tail[1], it.tail[2]) }
            SpringBoneCollider(c.node, offset, radius, tail)
        }

        for (spring in sb1.springs) {
            val joints = spring.joints.map { j ->
                SpringBoneJoint(
                    node = j.node,
                    boneLength = 0.1f,
                    hitRadius = j.hitRadius,
                    stiffness = j.stiffness,
                    gravityPower = j.gravityPower,
                    gravityDir = Vector3(j.gravityDir[0], j.gravityDir[1], j.gravityDir[2]),
                    dragForce = j.dragForce
                )
            }
            val springColliders = spring.colliders.mapNotNull { idx ->
                colliders.getOrNull(idx)
            }
            logics.add(SpringBoneLogic(joints, springColliders, spring.center))
        }
    }

    fun update(deltaTime: Float, transforms: MutableMap<Int, SpringBoneTransform>) {
        for (logic in logics) {
            logic.update(deltaTime, transforms, externalForce, stiffnessMultiplier, gravityMultiplier)
            logic.applyRotations(transforms)
        }
    }
}

class SpringBoneTransform(
    val position: Vector3 = Vector3(0f, 0f, 0f),
    var rotation: Quaternion = Quaternion(0f, 0f, 0f, 1f),
    val scale: Vector3 = Vector3(1f, 1f, 1f)
) {
    fun transformPoint(point: Vector3): Vector3 {
        return Vector3().copy(point).applyQuaternion(rotation).add(position)
    }

    companion object {
        val IDENTITY = SpringBoneTransform()
    }
}
