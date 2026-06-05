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
import com.sisterm.vrm.loader.VrmData
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
 * - Humanoid bone posing via joint entity transforms
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
                val buffer = ByteBuffer.wrap(bytes)
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
        scope.launch(Dispatchers.Main) {
            try {
                loadModelBuffer(buffer)
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

        filamentAsset?.let { asset ->
            buildExpressionMorphMap(asset, vrmData)
            buildBoneEntityMap(asset, vrmData)
            buildFirstPersonEntities(asset, vrmData)
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
                // Clamp weights to [0, 1] (VRM spec allows some overshoot but let's be safe)
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
            // Use the first matching entity as the bone transform target
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
     * Set the local rotation of a humanoid bone.
     *
     * @param boneName VRM humanoid bone name, e.g. "leftUpperArm", "head"
     * @param rotation Quaternion [x, y, z, w]
     */
    fun setBoneRotation(boneName: String, rotation: FloatArray) {
        val entity = boneEntityMap[boneName.lowercase()] ?: return
        val tcm = modelViewer.engine.transformManager
        val instance = tcm.getInstance(entity)
        if (instance == 0) return

        val rotMatrix = quaternionToMatrix(rotation)
        // Get current transform, replace rotation, preserve position/scale
        val current = FloatArray(16)
        tcm.getTransform(instance, current)
        val pos = floatArrayOf(current[12], current[13], current[14])
        val scl = floatArrayOf(
            kotlin.math.sqrt(current[0]*current[0] + current[1]*current[1] + current[2]*current[2]),
            kotlin.math.sqrt(current[4]*current[4] + current[5]*current[5] + current[6]*current[6]),
            kotlin.math.sqrt(current[8]*current[8] + current[9]*current[9] + current[10]*current[10])
        )

        val matrix = FloatArray(16)
        android.opengl.Matrix.setIdentityM(matrix, 0)
        android.opengl.Matrix.translateM(matrix, 0, pos[0], pos[1], pos[2])
        android.opengl.Matrix.multiplyMM(matrix, 0, matrix, 0, rotMatrix, 0)
        android.opengl.Matrix.scaleM(matrix, 0, scl[0], scl[1], scl[2])
        tcm.setTransform(instance, matrix)
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

    // ========== Utility ==========

    private fun quaternionToMatrix(q: FloatArray): FloatArray {
        val x = q[0]; val y = q[1]; val z = q[2]; val w = q[3]
        val xx = x * x; val yy = y * y; val zz = z * z
        val xy = x * y; val xz = x * z; val yz = y * z
        val wx = w * x; val wy = w * y; val wz = w * z
        return floatArrayOf(
            1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0f,
            2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0f,
            2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0f,
            0f, 0f, 0f, 1f
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
