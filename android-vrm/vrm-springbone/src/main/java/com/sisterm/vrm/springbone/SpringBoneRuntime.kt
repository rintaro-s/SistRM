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

    fun getHitRadius(): Float = radius

    fun getWorldCenter(parentTransform: MutSpringTransform): Vector3 {
        return parentTransform.transformPoint(offset.clone())
    }

    fun getWorldTail(parentTransform: MutSpringTransform): Vector3 {
        return if (isCapsule) parentTransform.transformPoint(tail!!.clone()) else getWorldCenter(parentTransform)
    }

    fun collide(particlePos: Vector3, particleRadius: Float, parentTransform: MutSpringTransform): Vector3 {
        val center = getWorldCenter(parentTransform)
        val totalR = radius + particleRadius
        if (isCapsule) {
            val tailPt = getWorldTail(parentTransform)
            val ab = tailPt.clone().sub(center)
            val abl2 = ab.lengthSq()
            if (abl2 < 1e-8f) {
                val diff = particlePos.clone().sub(center)
                val dist = diff.length()
                if (dist < totalR && dist > 1e-4f) {
                    return center.clone().addScaledVector(diff.normalize(), totalR)
                }
                return particlePos
            }
            val ap = particlePos.clone().sub(center)
            val t = (ap.dot(ab) / abl2).coerceIn(0f, 1f)
            val closest = center.clone().addScaledVector(ab, t)
            val diff = particlePos.clone().sub(closest)
            val dist = diff.length()
            if (dist < totalR && dist > 1e-4f) {
                return closest.clone().addScaledVector(diff.normalize(), totalR)
            }
        } else {
            val diff = particlePos.clone().sub(center)
            val dist = diff.length()
            if (dist < totalR && dist > 1e-4f) {
                return center.clone().addScaledVector(diff.normalize(), totalR)
            }
        }
        return particlePos
    }
}

data class SpringBoneJoint(
    val node: Int,
    val parentNode: Int? = null,
    val boneLength: Float,
    val boneAxis: Vector3 = Vector3(0f, -1f, 0f),
    val hitRadius: Float = 0.02f,
    val stiffness: Float = 1.0f,
    val gravityPower: Float = 0f,
    val gravityDir: Vector3 = Vector3(0f, -1f, 0f),
    val dragForce: Float = 0.4f,
    val localBindRotation: Quaternion = Quaternion.IDENTITY.clone()
)

data class MutSpringTransform(
    var position: Vector3,
    var rotation: Quaternion
) {
    fun transformPoint(pt: Vector3): Vector3 =
        pt.clone().applyQuaternion(rotation).add(position)

    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other == null || other !is MutSpringTransform) return false
        return position == other.position && rotation == other.rotation
    }

    override fun hashCode(): Int {
        var result = position.hashCode()
        result = 31 * result + rotation.hashCode()
        return result
    }

    companion object {
        val IDENTITY = MutSpringTransform(Vector3.ZERO, Quaternion.IDENTITY.clone())
    }
}

class SpringBoneLogic(
    val joints: List<SpringBoneJoint>,
    val colliders: List<SpringBoneCollider>,
    val centerBone: Int? = null
) {
    class ParticleState(
        var currentTail: Vector3,
        var prevTail: Vector3,
        var boneAxisWorld: Vector3
    )

    val particles = mutableListOf<ParticleState>()
    var initialized = false

    fun initParticles(transforms: Map<Int, MutSpringTransform>) {
        particles.clear()
        for (j in joints) {
            val t = transforms[j.node] ?: continue
            val worldAxis = computeStiffnessDir(j, transforms)
            val initialTail = t.position.clone().addScaledVector(worldAxis, j.boneLength)
            particles.add(ParticleState(
                currentTail = initialTail.clone(),
                prevTail = initialTail.clone(),
                boneAxisWorld = worldAxis.clone()
            ))
        }
        initialized = true
    }

    fun update(
        deltaTime: Float,
        transforms: Map<Int, MutSpringTransform>,
        externalForce: Vector3,
        stiffnessMul: Float,
        gravityMul: Float,
        scalingFactor: Float
    ) {
        if (!initialized || particles.size != joints.size) {
            initParticles(transforms)
        }

        // ISSUE #3: Fix dt clamp threshold to match UniVRM reference = 0.035f
        val dt = deltaTime.coerceAtMost(0.035f)

        for (i in joints.indices) {
            val j = joints[i]
            val particle = particles.getOrNull(i) ?: continue
            val t = transforms[j.node] ?: continue

            // ISSUE #2: Normalize directional error vector magnitude BEFORE scaling stiffness/dt
            // UniVRM: stiffness direction = parentWorldRotation * bindLocalRotation * boneAxis
            val stiffnessDir = computeStiffnessDir(j, transforms)

            val currentTail = particle.currentTail
            val prevTail = particle.prevTail

            // Verlet integration
            var nextTail = currentTail.clone()
            val velocity = currentTail.clone().sub(prevTail)
            nextTail.addScaledVector(velocity, 1.0f - j.dragForce)

            val stiffForce = j.stiffness * stiffnessMul
            nextTail.addScaledVector(stiffnessDir, stiffForce * dt * scalingFactor)

            val gravPower = j.gravityPower * gravityMul
            if (gravPower > 1e-8f) {
                val gDir = j.gravityDir.clone().normalize()
                nextTail.addScaledVector(gDir, gravPower * dt * scalingFactor)
            }

            if (externalForce.lengthSq() > 1e-8f) {
                nextTail.addScaledVector(externalForce, dt * scalingFactor)
            }

            // Enforce bone length
            val parentPos = t.position
            var toTail = nextTail.clone().sub(parentPos)
            val toTailLenSq = toTail.lengthSq()
            if (toTailLenSq > 1e-8f) {
                toTail.normalize()
                nextTail = parentPos.clone().addScaledVector(toTail, j.boneLength)
            } else {
                nextTail = parentPos.clone().addScaledVector(stiffnessDir, j.boneLength)
            }

            // ISSUE #4: Update collider parent Transforms using current root pose live every frame
            // Each collider uses its own node's transform from the transforms map
            for (collider in colliders) {
                val colliderParent = transforms[collider.node] ?: MutSpringTransform.IDENTITY
                val pushed = collider.collide(nextTail, j.hitRadius, colliderParent)
                val postColDir = pushed.clone().sub(parentPos)
                val postColLenSq = postColDir.lengthSq()
                if (postColLenSq > 1e-8f) {
                    postColDir.normalize()
                    nextTail = parentPos.clone().addScaledVector(postColDir, j.boneLength)
                } else {
                    nextTail = parentPos.clone().addScaledVector(stiffnessDir, j.boneLength)
                }
            }

            particle.prevTail = currentTail.clone()
            particle.currentTail = nextTail.clone()
            particle.boneAxisWorld = stiffnessDir.clone()
        }
    }

    fun applyRotationDeltas(transforms: MutableMap<Int, MutSpringTransform>) {
        for (i in joints.indices) {
            val j = joints[i]
            val particle = particles.getOrNull(i) ?: continue
            val t = transforms[j.node] ?: continue

            val toTailDir = particle.currentTail.clone().sub(t.position)
            val toTailLenSq = toTailDir.lengthSq()
            if (toTailLenSq < 1e-6f) continue
            toTailDir.normalize()

            // Use bind rotation to compute the reference axis (same as UniVRM)
            val fromWorldAxis = computeStiffnessDir(j, transforms)

            val dot = fromWorldAxis.dot(toTailDir)
            if (dot > 0.9999f) continue

            val delta = Quaternion().setFromUnitVectors(fromWorldAxis, toTailDir)
            t.rotation = delta.clone().multiply(t.rotation)
        }
    }

    /**
     * Compute stiffness direction matching UniVRM logic:
     * stiffnessDir = normalize(parentWorldRotation * localBindRotation * boneAxis)
     */
    private fun computeStiffnessDir(j: SpringBoneJoint, transforms: Map<Int, MutSpringTransform>): Vector3 {
        val parentRotation = if (j.parentNode != null) {
            transforms[j.parentNode]?.rotation ?: Quaternion.IDENTITY.clone()
        } else {
            Quaternion.IDENTITY.clone()
        }
        return j.boneAxis.clone()
            .applyQuaternion(j.localBindRotation)
            .applyQuaternion(parentRotation)
            .normalize()
    }
}

class SpringBoneRuntime {
    val logics = mutableListOf<SpringBoneLogic>()

    var gravityMultiplier: Float = 1.0f
    var stiffnessMultiplier: Float = 1.0f
    var externalForce: Vector3 = Vector3.ZERO

    fun reset() {
        for (logic in logics) {
            logic.initialized = false
            logic.particles.clear()
        }
        logics.clear()
    }

    fun loadFromVrm1SpringBoneExtension(
        vrmData: VrmData?,
        transformsMap: Map<Int, MutSpringTransform>,
        nodeMap: GltfRoot
    ) {
        if (vrmData == null) return
        when (vrmData.version) {
            VrmVersion.VRM_1_0 -> loadFromVrm1(vrmData.springBone1, transformsMap, nodeMap)
            VrmVersion.VRM_0_0 -> {
                vrmData.vrm0?.let { loadFromVrm0(it, transformsMap, nodeMap) }
            }
            else -> {}
        }
    }

    fun loadFromVrm0(
        vrm0: Vrm0Extension,
        transformsMap: Map<Int, MutSpringTransform>,
        gltfRoot: GltfRoot? = null
    ) {
        logics.clear()
        val parentMap = buildParentMap(gltfRoot)

        for (sb in vrm0.springBone) {
            val boneNodes = sb.bones
            val joints = mutableListOf<SpringBoneJoint>()

            for (jIdx in sb.joints.indices) {
                val vrmJoint = sb.joints[jIdx]
                val nodeId = resolveNodeId(jIdx, boneNodes, vrmJoint.boneIndex)
                if (nodeId < 0) continue

                val boneLength = computeBoneLengthVrm0(jIdx, sb.joints, boneNodes, transformsMap, gltfRoot)
                val boneAxis = computeBoneAxisVrm0(jIdx, sb.joints, boneNodes, transformsMap, gltfRoot)
                val localBindRot = computeLocalBindRotation(nodeId, parentMap, transformsMap)

                joints.add(SpringBoneJoint(
                    node = nodeId,
                    parentNode = parentMap[nodeId],
                    boneLength = boneLength,
                    boneAxis = boneAxis,
                    hitRadius = if (vrmJoint.hitRadius > 0f) vrmJoint.hitRadius else sb.hitRadius,
                    stiffness = if (vrmJoint.stiffnessForce > 0f) vrmJoint.stiffnessForce else sb.stiffiness,
                    gravityPower = if (vrmJoint.gravityPower != 0f) vrmJoint.gravityPower else sb.gravityPower,
                    gravityDir = resolveGravityDir(vrmJoint.gravityDir, sb.gravityDir),
                    dragForce = if (vrmJoint.dragForce > 0f) vrmJoint.dragForce else sb.dragForce,
                    localBindRotation = localBindRot
                ))
            }

            val colliders = buildCollidersVrm0(sb, vrm0)

            if (joints.isNotEmpty()) {
                logics.add(SpringBoneLogic(
                    joints = joints,
                    colliders = colliders,
                    centerBone = null
                ))
            }
        }
    }

    fun loadFromVrm1(
        vrm1: Vrm1SpringBone?,
        transformsMap: Map<Int, MutSpringTransform>,
        gltfRoot: GltfRoot? = null
    ) {
        logics.clear()
        if (vrm1 == null) return
        val parentMap = buildParentMap(gltfRoot)

        for (spring in vrm1.springs) {
            val colliders = buildCollidersVrm1(spring, vrm1)
            val joints = mutableListOf<SpringBoneJoint>()

            for (jIdx in spring.joints.indices) {
                val vrmJoint = spring.joints[jIdx]
                val boneLength = computeBoneLengthVrm1(jIdx, spring.joints, transformsMap, gltfRoot)
                val boneAxis = computeBoneAxisVrm1(jIdx, spring.joints, transformsMap, gltfRoot)
                val localBindRot = computeLocalBindRotation(vrmJoint.node, parentMap, transformsMap)

                joints.add(SpringBoneJoint(
                    node = vrmJoint.node,
                    parentNode = parentMap[vrmJoint.node],
                    boneLength = boneLength,
                    boneAxis = boneAxis,
                    hitRadius = vrmJoint.hitRadius,
                    stiffness = vrmJoint.stiffness,
                    gravityPower = vrmJoint.gravityPower,
                    gravityDir = if (vrmJoint.gravityDir.size >= 3) {
                        Vector3(vrmJoint.gravityDir[0], vrmJoint.gravityDir[1], vrmJoint.gravityDir[2])
                    } else {
                        Vector3(0f, -1f, 0f)
                    },
                    dragForce = vrmJoint.dragForce,
                    localBindRotation = localBindRot
                ))
            }

            if (joints.isNotEmpty()) {
                logics.add(SpringBoneLogic(
                    joints = joints,
                    colliders = colliders,
                    centerBone = spring.center
                ))
            }
        }
    }

    private fun buildParentMap(gltfRoot: GltfRoot?): Map<Int, Int> {
        if (gltfRoot == null) return emptyMap()
        val parentMap = mutableMapOf<Int, Int>()
        for ((parentIdx, node) in gltfRoot.nodes.withIndex()) {
            for (childIdx in node.children) {
                if (childIdx >= 0 && childIdx < gltfRoot.nodes.size) {
                    parentMap[childIdx] = parentIdx
                }
            }
        }
        return parentMap
    }

    private fun computeLocalBindRotation(
        nodeId: Int,
        parentMap: Map<Int, Int>,
        transformsMap: Map<Int, MutSpringTransform>
    ): Quaternion {
        val nodeTransform = transformsMap[nodeId] ?: return Quaternion.IDENTITY.clone()
        val parentId = parentMap[nodeId]
        if (parentId != null) {
            val parentTransform = transformsMap[parentId]
            if (parentTransform != null) {
                // localRotation = inverse(parentWorldRotation) * worldRotation
                val invParentRot = parentTransform.rotation.clone().invert()
                return invParentRot.multiply(nodeTransform.rotation.clone())
            }
        }
        // No parent in transforms map - use world rotation as local
        return nodeTransform.rotation.clone()
    }

    private fun resolveNodeId(jIdx: Int, boneNodes: List<Int>, boneIndex: Int): Int {
        return when {
            jIdx < boneNodes.size && boneNodes[jIdx] >= 0 -> boneNodes[jIdx]
            boneIndex >= 0 -> boneIndex
            else -> -1
        }
    }

    private fun resolveGravityDir(jointDir: List<Float>, springDir: List<Float>): Vector3 {
        if (jointDir.size >= 3) return Vector3(jointDir[0], jointDir[1], jointDir[2])
        if (springDir.size >= 3) return Vector3(springDir[0], springDir[1], springDir[2])
        return Vector3(0f, -1f, 0f)
    }

    private fun buildCollidersVrm0(sb: Vrm0SpringBone, vrm0: Vrm0Extension): List<SpringBoneCollider> {
        val colliders = mutableListOf<SpringBoneCollider>()
        for (cgIdx in sb.colliderGroups) {
            if (cgIdx < 0 || cgIdx >= vrm0.springBoneColliderGroups.size) continue
            val group = vrm0.springBoneColliderGroups[cgIdx]
            for (sphere in group.colliders) {
                val offset = if (sphere.offset.size >= 3) {
                    Vector3(sphere.offset[0], sphere.offset[1], sphere.offset[2])
                } else {
                    Vector3.ZERO
                }
                val radius = if (sphere.radius > 0f) sphere.radius else {
                    val len = offset.length()
                    if (len > 1e-6f) len else 0.1f
                }
                colliders.add(SpringBoneCollider(
                    node = group.node,
                    offset = offset,
                    radius = radius
                ))
            }
        }
        return colliders
    }

    private fun buildCollidersVrm1(spring: Vrm1SpringBoneSpring, vrm1: Vrm1SpringBone): List<SpringBoneCollider> {
        val colliders = mutableListOf<SpringBoneCollider>()
        for (colliderIdx in spring.colliders) {
            if (colliderIdx < 0 || colliderIdx >= vrm1.colliders.size) continue
            val vrmCollider = vrm1.colliders[colliderIdx]
            val shape = vrmCollider.shape
            if (shape.sphere != null) {
                val s = shape.sphere!!
                val offset = if (s.offset.size >= 3) Vector3(s.offset[0], s.offset[1], s.offset[2]) else Vector3.ZERO
                val radius = if (s.radius > 0f) s.radius else {
                    val len = offset.length()
                    if (len > 1e-6f) len else 0.1f
                }
                colliders.add(SpringBoneCollider(node = vrmCollider.node, offset = offset, radius = radius))
            } else if (shape.capsule != null) {
                val c = shape.capsule!!
                val offset = if (c.offset.size >= 3) Vector3(c.offset[0], c.offset[1], c.offset[2]) else Vector3.ZERO
                val tail = if (c.tail.size >= 3) Vector3(c.tail[0], c.tail[1], c.tail[2]) else Vector3.ZERO
                val radius = if (c.radius > 0f) c.radius else {
                    val len = offset.length()
                    if (len > 1e-6f) len else 0.1f
                }
                colliders.add(SpringBoneCollider(node = vrmCollider.node, offset = offset, radius = radius, tail = tail))
            }
        }
        return colliders
    }

    // ISSUE #5: Improve bone length fallback order matches UniVRM logic exactly
    private fun computeBoneLengthVrm0(
        jIdx: Int,
        joints: List<Vrm0SpringBoneJoint>,
        boneNodes: List<Int>,
        transformsMap: Map<Int, MutSpringTransform>,
        gltfRoot: GltfRoot? = null
    ): Float {
        val isLast = jIdx >= joints.size - 1
        val curNodeId = resolveNodeId(jIdx, boneNodes, joints[jIdx].boneIndex)

        // 1. Try parent-child dist FIRST via transforms map (if both nodes resolve)
        if (!isLast) {
            val nextNodeId = resolveNodeId(jIdx + 1, boneNodes, joints[jIdx + 1].boneIndex)
            if (nextNodeId >= 0) {
                val curT = transformsMap[curNodeId]
                val nextT = transformsMap[nextNodeId]
                if (curT != null && nextT != null) {
                    val dist = curT.position.distanceTo(nextT.position)
                    if (dist > 0.01f) return dist
                }
            }
        }

        // 2. Then gltf Node.translation.magnitude as last resort before hardcoded constants
        if (gltfRoot != null && curNodeId >= 0 && curNodeId < gltfRoot.nodes.size) {
            val node = gltfRoot.nodes[curNodeId]
            val tx = node.translation.getOrNull(0) ?: 0f
            val ty = node.translation.getOrNull(1) ?: 0f
            val tz = node.translation.getOrNull(2) ?: 0f
            val mag = kotlin.math.sqrt(tx * tx + ty * ty + tz * tz)
            if (mag > 0.01f) return mag
        }

        // 3. Hardcoded constants when nothing else worked yet
        return if (isLast) 0.07f else 0.1f
    }

    private fun computeBoneLengthVrm1(
        jIdx: Int,
        joints: List<Vrm1SpringBoneJoint>,
        transformsMap: Map<Int, MutSpringTransform>,
        gltfRoot: GltfRoot? = null
    ): Float {
        val isLast = jIdx >= joints.size - 1
        val curNodeId = joints[jIdx].node

        // 1. Try parent-child dist FIRST via transforms map (if both nodes resolve)
        if (!isLast) {
            val nextNodeId = joints[jIdx + 1].node
            if (nextNodeId >= 0) {
                val curT = transformsMap[curNodeId]
                val nextT = transformsMap[nextNodeId]
                if (curT != null && nextT != null) {
                    val dist = curT.position.distanceTo(nextT.position)
                    if (dist > 0.01f) return dist
                }
            }
        }

        // 2. Then gltf Node.translation.magnitude as last resort before hardcoded constants
        if (gltfRoot != null && curNodeId >= 0 && curNodeId < gltfRoot.nodes.size) {
            val node = gltfRoot.nodes[curNodeId]
            val tx = node.translation.getOrNull(0) ?: 0f
            val ty = node.translation.getOrNull(1) ?: 0f
            val tz = node.translation.getOrNull(2) ?: 0f
            val mag = kotlin.math.sqrt(tx * tx + ty * ty + tz * tz)
            if (mag > 0.01f) return mag
        }

        // 3. Hardcoded constants when nothing else worked yet
        return if (isLast) 0.07f else 0.1f
    }

    private fun computeBoneAxisVrm0(
        jIdx: Int,
        joints: List<Vrm0SpringBoneJoint>,
        boneNodes: List<Int>,
        transformsMap: Map<Int, MutSpringTransform>,
        gltfRoot: GltfRoot? = null
    ): Vector3 {
        val curNodeId = resolveNodeId(jIdx, boneNodes, joints[jIdx].boneIndex)

        // Try to derive axis from next joint position
        if (jIdx < joints.size - 1) {
            val nextNodeId = resolveNodeId(jIdx + 1, boneNodes, joints[jIdx + 1].boneIndex)
            if (nextNodeId >= 0) {
                val curT = transformsMap[curNodeId]
                val nextT = transformsMap[nextNodeId]
                if (curT != null && nextT != null) {
                    val diff = nextT.position.clone().sub(curT.position)
                    val len = diff.length()
                    if (len > 1e-6f) {
                        return diff.normalize()
                    }
                }
            }
        }

        // Fall back to gltf node translation
        if (gltfRoot != null && curNodeId >= 0 && curNodeId < gltfRoot.nodes.size) {
            val node = gltfRoot.nodes[curNodeId]
            val tx = node.translation.getOrNull(0) ?: 0f
            val ty = node.translation.getOrNull(1) ?: 0f
            val tz = node.translation.getOrNull(2) ?: 0f
            val mag = kotlin.math.sqrt(tx * tx + ty * ty + tz * tz)
            if (mag > 1e-6f) {
                return Vector3(tx / mag, ty / mag, tz / mag)
            }
        }

        // Default: Y-down (common VRM convention)
        return Vector3(0f, -1f, 0f)
    }

    private fun computeBoneAxisVrm1(
        jIdx: Int,
        joints: List<Vrm1SpringBoneJoint>,
        transformsMap: Map<Int, MutSpringTransform>,
        gltfRoot: GltfRoot? = null
    ): Vector3 {
        val curNodeId = joints[jIdx].node

        // Try to derive axis from next joint position
        if (jIdx < joints.size - 1) {
            val nextNodeId = joints[jIdx + 1].node
            if (nextNodeId >= 0) {
                val curT = transformsMap[curNodeId]
                val nextT = transformsMap[nextNodeId]
                if (curT != null && nextT != null) {
                    val diff = nextT.position.clone().sub(curT.position)
                    val len = diff.length()
                    if (len > 1e-6f) {
                        return diff.normalize()
                    }
                }
            }
        }

        // Fall back to gltf node translation
        if (gltfRoot != null && curNodeId >= 0 && curNodeId < gltfRoot.nodes.size) {
            val node = gltfRoot.nodes[curNodeId]
            val tx = node.translation.getOrNull(0) ?: 0f
            val ty = node.translation.getOrNull(1) ?: 0f
            val tz = node.translation.getOrNull(2) ?: 0f
            val mag = kotlin.math.sqrt(tx * tx + ty * ty + tz * tz)
            if (mag > 1e-6f) {
                return Vector3(tx / mag, ty / mag, tz / mag)
            }
        }

        // Default: Y-down (common VRM convention)
        return Vector3(0f, -1f, 0f)
    }
}
