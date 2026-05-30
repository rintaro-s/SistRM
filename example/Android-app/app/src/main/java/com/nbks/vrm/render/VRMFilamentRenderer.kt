package com.nbks.vrm.render

import android.content.res.AssetManager
import android.view.SurfaceView
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.google.android.filament.RenderableManager
import com.google.android.filament.View
import com.google.android.filament.gltfio.Animator
import com.google.android.filament.gltfio.FilamentAsset
import com.google.android.filament.gltfio.FilamentInstance
import com.google.android.filament.utils.Manipulator
import com.google.android.filament.utils.ModelViewer
import com.nbks.vrm.parser.VrmData
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer

/**
 * SisterRM Filament-based VRM renderer.
 *
 * Uses Google Filament's [ModelViewer] to load and render VRM (GLB) files.
 * Provides:
 * - Expression control via morph targets (accumulates multi-expression weights)
 * - Humanoid bone posing via joint entity transforms (preserves bind pose)
 * - First-person mode (hide head/face meshes)
 * - Network transform application
 *
 * Lifecycle: attach to Activity lifecycle via [LifecycleOwner].
 */
class VRMFilamentRenderer(
    private val surfaceView: SurfaceView,
    private val assetManager: AssetManager
) : DefaultLifecycleObserver {

    private val modelViewer: ModelViewer
    private val renderableManager: RenderableManager

    private var filamentAsset: FilamentAsset? = null
    private var filamentInstance: FilamentInstance? = null
    private var animator: Animator? = null
    private var vrmData: VrmData? = null

    // ========== Expression State ==========
    private val expressionMorphMap = mutableMapOf<String, List<MorphTargetInfo>>()
    private val currentExpressionWeights = mutableMapOf<String, Float>()
    // entity -> accumulated morph weights
    private val entityMorphWeights = mutableMapOf<Int, FloatArray>()

    data class MorphTargetInfo(
        val entity: Int,
        val morphIndex: Int,
        val weightScale: Float
    )

    // ========== Bone State ==========
    // humanoid bone name (lowercase) -> entity
    private val boneEntityMap = mutableMapOf<String, Int>()
    // humanoid bone name -> bind pose (px, py, pz, qx, qy, qz, qw, sx, sy, sz)
    private val boneBindPoses = mutableMapOf<String, FloatArray>()

    // ========== First-Person State ==========
    private val firstPersonEntities = mutableSetOf<Int>()
    private var firstPersonEnabled = false

    private val scope = CoroutineScope(Dispatchers.Main)
    private var isAlive = true
    private var isPaused = false
    private var frameCallback: Runnable? = null

    init {
        val manipulator = Manipulator.Builder()
            .viewport(surfaceView.width, surfaceView.height)
            .zoomSpeed(0.5f)
            .orbitHomePosition(0.0f, 1.6f, 3.0f)
            .targetPosition(0.0f, 1.0f, 0.0f)
            .build(Manipulator.Mode.ORBIT)

        modelViewer = ModelViewer(
            surfaceView = surfaceView,
            manipulator = manipulator
        )

        renderableManager = modelViewer.engine.renderableManager

        modelViewer.view.apply {
            dynamicResolutionOptions = View.DynamicResolutionOptions().apply { enabled = true }
            multiSampleAntiAliasingOptions = View.MultiSampleAntiAliasingOptions().apply { enabled = true }
            ambientOcclusionOptions = View.AmbientOcclusionOptions().apply { enabled = true }
            bloomOptions = View.BloomOptions().apply { enabled = true }
        }

        startRenderLoop()
    }

    private fun startRenderLoop() {
        frameCallback = object : Runnable {
            override fun run() {
                if (!isAlive || isPaused) return
                animator?.updateBoneMatrices()
                applyExpressionMorphsToRenderables()
                modelViewer.render(System.nanoTime())
                surfaceView.postOnAnimation(this)
            }
        }
        surfaceView.postOnAnimation(frameCallback!!)
    }

    // ========== Loading ==========

    fun loadVrm(path: String, vrmData: VrmData? = null) {
        this.vrmData = vrmData
        scope.launch(Dispatchers.IO) {
            try {
                val bytes = assetManager.open(path).use { it.readBytes() }
                val buffer = ByteBuffer.allocateDirect(bytes.size).apply {
                    put(bytes)
                    flip()
                }
                withContext(Dispatchers.Main) {
                    loadModelBuffer(buffer)
                }
            } catch (e: Exception) {
                android.util.Log.e("VRMFilamentRenderer", "Failed to load VRM: $path", e)
            }
        }
    }

    fun loadVrmBuffer(buffer: ByteBuffer, vrmData: VrmData? = null) {
        this.vrmData = vrmData
        // Ensure buffer is direct — Filament requires direct ByteBuffer
        val directBuffer = if (buffer.isDirect) buffer else {
            val db = ByteBuffer.allocateDirect(buffer.remaining())
            db.put(buffer.duplicate())
            db.flip()
            db
        }
        scope.launch(Dispatchers.Main) {
            try {
                loadModelBuffer(directBuffer)
            } catch (e: Exception) {
                android.util.Log.e("VRMFilamentRenderer", "Failed to load VRM buffer", e)
            }
        }
    }

    private fun loadModelBuffer(buffer: ByteBuffer) {
        modelViewer.destroyModel()
        modelViewer.loadModelGlb(buffer)
        modelViewer.transformToUnitCube()

        filamentAsset = modelViewer.asset
        filamentInstance = filamentAsset?.getInstance()
        animator = modelViewer.animator

        // Defer map building by one frame — gltfio may not have fully
        // populated entity names until after the first render/update.
        surfaceView.post {
            filamentAsset?.let { asset ->
                buildExpressionMorphMap(asset, vrmData)
                buildBoneEntityMap(asset, vrmData)
                captureBoneBindPoses()
                buildFirstPersonEntities(asset, vrmData)
            }
        }
    }

    // ========== Expressions ==========

    private fun buildExpressionMorphMap(asset: FilamentAsset, vrmData: VrmData?) {
        expressionMorphMap.clear()
        entityMorphWeights.clear()
        if (vrmData == null) return

        val gltf = vrmData.gltf

        // VRM 1.0
        vrmData.vrm1?.expressions?.preset?.forEach { (exprName, expr) ->
            val targets = mutableListOf<MorphTargetInfo>()
            expr.morphTargetBinds?.forEach { bind ->
                val nodeIndex = bind.node
                val nodeName = gltf.nodes.getOrNull(nodeIndex)?.name ?: return@forEach
                val morphIndex = bind.index
                val entities = asset.getEntitiesByName(nodeName)
                for (entity in entities) {
                    targets.add(MorphTargetInfo(entity, morphIndex, bind.weight))
                }
            }
            if (targets.isNotEmpty()) {
                expressionMorphMap[exprName] = targets
            }
        }

        // VRM 0.0
        vrmData.vrm0?.blendShapeMaster?.blendShapeGroups?.forEach { group ->
            val exprName = group.presetName
            val targets = mutableListOf<MorphTargetInfo>()
            group.binds?.forEach { bind ->
                val meshIndex = bind.mesh
                val meshName = gltf.meshes.getOrNull(meshIndex)?.name ?: ""
                val morphIndex = bind.index
                val weight = bind.weight / 100.0f

                val nodeIndex = gltf.nodes.indexOfFirst { it.mesh == meshIndex }
                val nodeName = if (nodeIndex >= 0) gltf.nodes[nodeIndex].name ?: "" else ""
                val entities = if (nodeName.isNotEmpty()) asset.getEntitiesByName(nodeName) else intArrayOf()

                for (entity in entities) {
                    targets.add(MorphTargetInfo(entity, morphIndex, weight))
                }
            }
            if (targets.isNotEmpty()) {
                expressionMorphMap[exprName] = targets
            }
        }

        // Allocate weight buffers for each affected entity
        val allEntities = expressionMorphMap.values.flatten().map { it.entity }.toSet()
        for (entity in allEntities) {
            val instance = renderableManager.getInstance(entity)
            val count = if (instance != 0) renderableManager.getMorphTargetCount(instance) else 0
            if (count > 0) {
                entityMorphWeights[entity] = FloatArray(count)
            }
        }
    }

    fun setExpression(name: String, weight: Float) {
        currentExpressionWeights[name] = weight.coerceIn(0f, 1f)
    }

    /**
     * Recalculate all morph weights from current expression values and apply to renderables.
     * Called once per frame before rendering.
     */
    private fun applyExpressionMorphsToRenderables() {
        // Reset all accumulated weights to 0
        entityMorphWeights.values.forEach { it.fill(0f) }

        // Accumulate expression weights
        expressionMorphMap.forEach { (exprName, targets) ->
            val exprWeight = currentExpressionWeights[exprName] ?: 0f
            if (exprWeight > 0f) {
                targets.forEach { target ->
                    val weights = entityMorphWeights[target.entity] ?: return@forEach
                    if (target.morphIndex < weights.size) {
                        weights[target.morphIndex] += exprWeight * target.weightScale
                    }
                }
            }
        }

        // Clamp and apply to renderables
        entityMorphWeights.forEach { (entity, weights) ->
            val instance = renderableManager.getInstance(entity)
            if (instance != 0) {
                for (i in weights.indices) {
                    weights[i] = weights[i].coerceIn(0f, 1f)
                }
                renderableManager.setMorphWeights(instance, weights, 0)
            }
        }
    }

    fun getExpressionNames(): List<String> = expressionMorphMap.keys.toList()

    // ========== Humanoid Bones ==========

    private fun buildBoneEntityMap(asset: FilamentAsset, vrmData: VrmData?) {
        boneEntityMap.clear()
        if (vrmData == null) return
        val gltf = vrmData.gltf

        // VRM 1.0: humanBones is a map of boneName -> {node}
        vrmData.vrm1?.humanoid?.humanBones?.forEach { (boneName, boneData) ->
            val nodeIndex = boneData.node
            val nodeName = gltf.nodes.getOrNull(nodeIndex)?.name ?: return@forEach
            val entities = asset.getEntitiesByName(nodeName)
            if (entities.isNotEmpty()) {
                boneEntityMap[boneName.lowercase()] = entities[0]
            }
        }

        // VRM 0.0: humanBones is a list of {bone, node}
        vrmData.vrm0?.humanoid?.humanBones?.forEach { boneData ->
            val boneName = boneData.bone
            val nodeIndex = boneData.node
            val nodeName = gltf.nodes.getOrNull(nodeIndex)?.name ?: return@forEach
            val entities = asset.getEntitiesByName(nodeName)
            if (entities.isNotEmpty()) {
                boneEntityMap[boneName.lowercase()] = entities[0]
            }
        }
    }

    /**
     * Capture the bind pose (rest pose) local transform for each bone entity.
     * User rotations will be applied as deltas on top of this bind pose.
     */
    private fun captureBoneBindPoses() {
        boneBindPoses.clear()
        val tcm = modelViewer.engine.transformManager
        boneEntityMap.forEach { (boneName, entity) ->
            val instance = tcm.getInstance(entity)
            if (instance == 0) return@forEach
            val matrix = FloatArray(16)
            tcm.getTransform(instance, matrix)
            val (pos, quat, scl) = decomposeMatrix(matrix)
            boneBindPoses[boneName] = floatArrayOf(
                pos[0], pos[1], pos[2],
                quat[0], quat[1], quat[2], quat[3],
                scl[0], scl[1], scl[2]
            )
        }
    }

    /**
     * Set the local rotation of a humanoid bone as a delta from bind pose.
     *
     * @param boneName VRM humanoid bone name, e.g. "leftUpperArm", "head"
     * @param eulerX Rotation around X axis in radians (delta from bind pose)
     * @param eulerY Rotation around Y axis in radians (delta from bind pose)
     * @param eulerZ Rotation around Z axis in radians (delta from bind pose)
     */
    fun setBoneRotation(boneName: String, eulerX: Float, eulerY: Float, eulerZ: Float) {
        val entity = boneEntityMap[boneName.lowercase()] ?: return
        val bind = boneBindPoses[boneName.lowercase()] ?: return

        // Bind pose: [px, py, pz, qx, qy, qz, qw, sx, sy, sz]
        val bindPos = floatArrayOf(bind[0], bind[1], bind[2])
        val bindQuat = floatArrayOf(bind[3], bind[4], bind[5], bind[6])
        val bindScl = floatArrayOf(bind[7], bind[8], bind[9])

        // User delta rotation in bone's local frame
        val deltaQuat = eulerToQuaternion(eulerX, eulerY, eulerZ)

        // Final rotation = bindPose * delta (delta applied in local frame)
        val finalQuat = quaternionMultiply(bindQuat, deltaQuat)

        // Build TRS matrix: T_bind * R_final * S_bind
        val matrix = FloatArray(16)
        android.opengl.Matrix.setIdentityM(matrix, 0)
        android.opengl.Matrix.translateM(matrix, 0, bindPos[0], bindPos[1], bindPos[2])
        val rotMatrix = quaternionToMatrix(finalQuat)
        android.opengl.Matrix.multiplyMM(matrix, 0, matrix, 0, rotMatrix, 0)
        android.opengl.Matrix.scaleM(matrix, 0, bindScl[0], bindScl[1], bindScl[2])

        val tcm = modelViewer.engine.transformManager
        val instance = tcm.getInstance(entity)
        if (instance != 0) {
            tcm.setTransform(instance, matrix)
        }
    }

    fun getBoneNames(): List<String> = boneEntityMap.keys.toList()

    // ========== First-Person ==========

    private fun buildFirstPersonEntities(asset: FilamentAsset, vrmData: VrmData?) {
        firstPersonEntities.clear()
        if (vrmData == null) return
        val gltf = vrmData.gltf

        // VRM 1.0
        vrmData.vrm1?.firstPerson?.meshAnnotations?.forEach { annotation ->
            val nodeIndex = annotation.node
            val type = annotation.type.lowercase()
            if (type == "firstpersononly" || type == "both") {
                val nodeName = gltf.nodes.getOrNull(nodeIndex)?.name ?: return@forEach
                val entities = asset.getEntitiesByName(nodeName)
                entities.forEach { firstPersonEntities.add(it) }
            }
        }

        // Fallback by name
        if (firstPersonEntities.isEmpty()) {
            gltf.nodes.forEach { node ->
                val name = node.name?.lowercase() ?: ""
                if (name.contains("head") || name.contains("face") || name.contains("hair")) {
                    val entities = asset.getEntitiesByName(node.name ?: "")
                    entities.forEach { firstPersonEntities.add(it) }
                }
            }
        }
    }

    fun setFirstPersonEnabled(enabled: Boolean) {
        if (firstPersonEnabled == enabled) return
        firstPersonEnabled = enabled
        val scene = modelViewer.scene
        firstPersonEntities.forEach { entity ->
            if (enabled) {
                scene.removeEntity(entity)
            } else {
                scene.addEntity(entity)
            }
        }
    }

    // ========== Network / Root Transform ==========

    fun setTransform(position: FloatArray, rotation: FloatArray, scale: FloatArray) {
        val asset = filamentAsset ?: return
        val root = asset.root
        val tcm = modelViewer.engine.transformManager
        val instance = tcm.getInstance(root)
        if (instance == 0) return

        val matrix = FloatArray(16)
        android.opengl.Matrix.setIdentityM(matrix, 0)
        android.opengl.Matrix.translateM(matrix, 0, position[0], position[1], position[2])
        val rotMatrix = quaternionToMatrix(rotation)
        android.opengl.Matrix.multiplyMM(matrix, 0, matrix, 0, rotMatrix, 0)
        android.opengl.Matrix.scaleM(matrix, 0, scale[0], scale[1], scale[2])
        tcm.setTransform(instance, matrix)
    }

    // ========== Matrix Math Utilities ==========

    /**
     * Decompose a 4x4 column-major matrix into (position, quaternion, scale).
     */
    private fun decomposeMatrix(m: FloatArray): Triple<FloatArray, FloatArray, FloatArray> {
        val pos = floatArrayOf(m[12], m[13], m[14])

        val sx = kotlin.math.sqrt(m[0]*m[0] + m[1]*m[1] + m[2]*m[2])
        val sy = kotlin.math.sqrt(m[4]*m[4] + m[5]*m[5] + m[6]*m[6])
        val sz = kotlin.math.sqrt(m[8]*m[8] + m[9]*m[9] + m[10]*m[10])
        val scl = floatArrayOf(sx, sy, sz)

        // Normalized rotation matrix (3x3)
        val r = FloatArray(9)
        if (sx > 0.0001f) { r[0] = m[0]/sx; r[1] = m[1]/sx; r[2] = m[2]/sx }
        if (sy > 0.0001f) { r[3] = m[4]/sy; r[4] = m[5]/sy; r[5] = m[6]/sy }
        if (sz > 0.0001f) { r[6] = m[8]/sz; r[7] = m[9]/sz; r[8] = m[10]/sz }

        val quat = rotationMatrixToQuaternion(r)
        return Triple(pos, quat, scl)
    }

    private fun rotationMatrixToQuaternion(r: FloatArray): FloatArray {
        val trace = r[0] + r[4] + r[8]
        return when {
            trace > 0 -> {
                val s = 0.5f / kotlin.math.sqrt(trace + 1.0f)
                floatArrayOf((r[5] - r[7]) * s, (r[6] - r[2]) * s, (r[1] - r[3]) * s, 0.25f / s)
            }
            r[0] > r[4] && r[0] > r[8] -> {
                val s = 2.0f * kotlin.math.sqrt(1.0f + r[0] - r[4] - r[8])
                floatArrayOf(0.25f * s, (r[3] + r[1]) / s, (r[6] + r[2]) / s, (r[5] - r[7]) / s)
            }
            r[4] > r[8] -> {
                val s = 2.0f * kotlin.math.sqrt(1.0f + r[4] - r[0] - r[8])
                floatArrayOf((r[3] + r[1]) / s, 0.25f * s, (r[7] + r[5]) / s, (r[6] - r[2]) / s)
            }
            else -> {
                val s = 2.0f * kotlin.math.sqrt(1.0f + r[8] - r[0] - r[4])
                floatArrayOf((r[6] + r[2]) / s, (r[7] + r[5]) / s, 0.25f * s, (r[1] - r[3]) / s)
            }
        }
    }

    /**
     * Convert a quaternion [x, y, z, w] to a 4x4 rotation matrix in
     * **column-major** order (the format used by OpenGL / Filament).
     */
    private fun quaternionToMatrix(q: FloatArray): FloatArray {
        val x = q[0]; val y = q[1]; val z = q[2]; val w = q[3]
        val xx = x * x; val yy = y * y; val zz = z * z
        val xy = x * y; val xz = x * z; val yz = y * z
        val wx = w * x; val wy = w * y; val wz = w * z
        // Column-major: m00,m10,m20,m30, m01,m11,m21,m31, m02,m12,m22,m32, m03,m13,m23,m33
        return floatArrayOf(
            1 - 2 * (yy + zz),  // m00
            2 * (xy + wz),      // m10
            2 * (xz - wy),      // m20
            0f,                 // m30
            2 * (xy - wz),      // m01
            1 - 2 * (xx + zz),  // m11
            2 * (yz + wx),      // m21
            0f,                 // m31
            2 * (xz + wy),      // m02
            2 * (yz - wx),      // m12
            1 - 2 * (xx + yy),  // m22
            0f,                 // m32
            0f, 0f, 0f, 1f      // m03,m13,m23,m33
        )
    }

    private fun eulerToQuaternion(x: Float, y: Float, z: Float): FloatArray {
        val cx = kotlin.math.cos(x * 0.5f)
        val sx = kotlin.math.sin(x * 0.5f)
        val cy = kotlin.math.cos(y * 0.5f)
        val sy = kotlin.math.sin(y * 0.5f)
        val cz = kotlin.math.cos(z * 0.5f)
        val sz = kotlin.math.sin(z * 0.5f)
        return floatArrayOf(
            sx * cy * cz - cx * sy * sz,
            cx * sy * cz + sx * cy * sz,
            cx * cy * sz - sx * sy * cz,
            cx * cy * cz + sx * sy * sz
        )
    }

    private fun quaternionMultiply(a: FloatArray, b: FloatArray): FloatArray {
        val ax = a[0]; val ay = a[1]; val az = a[2]; val aw = a[3]
        val bx = b[0]; val by = b[1]; val bz = b[2]; val bw = b[3]
        return floatArrayOf(
            aw*bx + ax*bw + ay*bz - az*by,
            aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw,
            aw*bw - ax*bx - ay*by - az*bz
        )
    }

    // ========== Lifecycle ==========

    override fun onResume(owner: LifecycleOwner) {
        super.onResume(owner)
        isPaused = false
        frameCallback?.let { surfaceView.postOnAnimation(it) }
    }

    override fun onPause(owner: LifecycleOwner) {
        super.onPause(owner)
        isPaused = true
    }

    override fun onDestroy(owner: LifecycleOwner) {
        super.onDestroy(owner)
        isAlive = false
        modelViewer.destroy()
    }

    companion object {
        init {
            System.loadLibrary("filament-jni")
            System.loadLibrary("gltfio-jni")
            System.loadLibrary("filament-utils-jni")
        }
    }
}
