package com.sisterm.vrm.filament

import android.content.res.AssetManager
import android.view.SurfaceHolder
import android.view.SurfaceView
import com.google.android.filament.Camera
import com.google.android.filament.Engine
import com.google.android.filament.EntityManager
import com.google.android.filament.RenderableManager
import com.google.android.filament.View
import com.google.android.filament.Viewport
import com.google.android.filament.gltfio.Animator
import com.google.android.filament.gltfio.AssetLoader
import com.google.android.filament.gltfio.FilamentAsset
import com.google.android.filament.gltfio.MaterialProvider
import com.google.android.filament.gltfio.ResourceLoader
import com.google.android.filament.gltfio.UbershaderProvider
import com.google.android.filament.utils.Manipulator
import com.sisterm.vrm.loader.GlbExtractor
import com.sisterm.vrm.loader.GltfParser
import com.sisterm.vrm.loader.VrmData
import com.sisterm.vrm.loader.VrmVersion
import com.sisterm.vrm.springbone.MutSpringTransform
import com.sisterm.vrm.springbone.SpringBoneRuntime
import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.core.math.Vector3
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.ByteBuffer

/**
 * Filament-based implementation of [VRMController].
 *
 * Uses Google Filament's AssetLoader and gltfio to load and render VRM (GLB).
 */
class VRMFilamentController(
    private val surfaceView: SurfaceView,
    private val assetManager: AssetManager
) : VRMController {

    private val engine: Engine = Engine.create()
    private val materialProvider: MaterialProvider = UbershaderProvider(engine)
    private val assetLoader: AssetLoader = AssetLoader(engine, materialProvider, EntityManager.get())
    private val resourceLoader: ResourceLoader = ResourceLoader(engine)

    private val scene = engine.createScene()
    private val view = engine.createView()
    private val renderer = engine.createRenderer()
    private val camera = engine.createCamera(engine.entityManager.create())

    private var swapChain: Any? = null
    private var filamentAsset: FilamentAsset? = null
    private var animator: Animator? = null
    private var vrmData: VrmData? = null

    private val expressionMorphMap = mutableMapOf<String, List<MorphTargetInfo>>()
    private val currentExpressionWeights = mutableMapOf<String, Float>()
    private val entityMorphWeights = mutableMapOf<Int, FloatArray>()

    data class MorphTargetInfo(
        val entity: Int,
        val morphIndex: Int,
        val weightScale: Float
    )

    private val boneEntityMap = mutableMapOf<String, Int>()
    private val boneBindPoses = mutableMapOf<String, FloatArray>()
    private val firstPersonEntities = mutableSetOf<Int>()
    private var _firstPersonEnabled = false

    private var _positionX = 0f
    private var _positionY = 0f
    private var _positionZ = 0f
    private var _rotationQuat = floatArrayOf(0f, 0f, 0f, 1f)
    private var _scaleX = 1f
    private var _scaleY = 1f
    private var _scaleZ = 1f
    private var transformDirty = true

    private var isAlive = true
    private var isModelLoaded = false
    private var listener: VRMControllerListener? = null
    private var renderLoopRunning = false

    private val mainScope = CoroutineScope(Dispatchers.Main)

    // ========== Node hierarchy maps ==========
    private val nodeEntityMap = mutableMapOf<Int, Int>()      // gltf node index -> Filament entity
    private val nodeParentMap = mutableMapOf<Int, Int>()      // gltf node index -> parent gltf node index
    private val boneNodeMap = mutableMapOf<String, Int>()     // bone name -> gltf node index
    private val allNodeNameEntityMap = mutableMapOf<String, Int>() // node name -> Filament entity (ALL nodes)

    // ========== Spring-bone integration ==========
    private val springBoneRuntime = SpringBoneRuntime()
    private var springBoneNodeEntities = mutableMapOf<Int, Int>() // gltf node index -> Filament entity
    private var springBoneNodeParents = mutableMapOf<Int, Int>()  // gltf node index -> parent gltf node index
    private var springBoneBindLocals = mutableMapOf<Int, Triple<Vector3, Quaternion, Vector3>>() // node -> (pos, rot, scl) local bind
    private val springBoneJointNodes = mutableSetOf<Int>()    // nodes that are actual spring bone joints
    private var springBoneInitialized = false
    var springBoneEnabled = false

    init {
        view.camera = camera
        view.setScene(scene)
        view.dynamicResolutionOptions = View.DynamicResolutionOptions().apply { enabled = true }
        view.multiSampleAntiAliasingOptions = View.MultiSampleAntiAliasingOptions().apply { enabled = true }
        view.ambientOcclusionOptions = View.AmbientOcclusionOptions().apply { enabled = true }
        view.bloomOptions = View.BloomOptions().apply { enabled = true }

        scene.skybox = com.google.android.filament.Skybox.Builder()
            .color(0.1f, 0.1f, 0.2f, 1.0f)
            .build(engine)

        // Position camera
        camera.setExposure(16f, 1f / 125f, 100f)
        camera.lookAt(0.0, 1.6, 3.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0)

        surfaceView.holder.addCallback(object : SurfaceHolder.Callback {
            override fun surfaceCreated(holder: SurfaceHolder) {
                swapChain = engine.createSwapChain(holder.surface)
                if (!renderLoopRunning) {
                    startRenderLoop()
                }
            }
            override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
                view.viewport = Viewport(0, 0, width, height)
                camera.setProjection(45.0, width.toDouble() / height, 0.1, 100.0, Camera.Fov.VERTICAL)
            }
            override fun surfaceDestroyed(holder: SurfaceHolder) {
                (swapChain as? com.google.android.filament.SwapChain)?.let {
                    engine.destroySwapChain(it)
                }
                swapChain = null
            }
        })
    }

    override fun setListener(listener: VRMControllerListener?) {
        this.listener = listener
    }

    private fun startRenderLoop() {
        renderLoopRunning = true
        surfaceView.postOnAnimation(object : Runnable {
            override fun run() {
                if (!isAlive) {
                    renderLoopRunning = false
                    return
                }
                update(0.016f)
                val sc = swapChain as? com.google.android.filament.SwapChain
                if (sc != null && renderer.beginFrame(sc, System.nanoTime())) {
                    renderer.render(view)
                    renderer.endFrame()
                }
                surfaceView.postOnAnimation(this)
            }
        })
    }

    override fun loadVrm(path: String) {
        mainScope.launch(Dispatchers.IO) {
            try {
                android.util.Log.d("VRM", "Loading VRM from path: $path")
                val bytes = assetManager.open(path).use { it.readBytes() }
                android.util.Log.d("VRM", "Read ${bytes.size} bytes")

                val jsonString = GlbExtractor.extractJson(bytes)
                if (jsonString == null) {
                    withContext(Dispatchers.Main) {
                        listener?.onError("Failed to extract JSON from GLB")
                    }
                    return@launch
                }

                val gltfRoot = GltfParser.parse(jsonString)
                val parsedVrmData = VrmData.fromGltf(gltfRoot)
                android.util.Log.d("VRM", "Parsed VRM: ${parsedVrmData.version}, title=${parsedVrmData.metaTitle}")

                val buffer = ByteBuffer.allocateDirect(bytes.size).apply {
                    put(bytes)
                    flip()
                }

                withContext(Dispatchers.Main) {
                    vrmData = parsedVrmData
                    loadModelBuffer(buffer)
                }
            } catch (e: Exception) {
                android.util.Log.e("VRM", "Failed to load VRM", e)
                withContext(Dispatchers.Main) {
                    listener?.onError("Load failed: ${e.message}")
                }
            }
        }
    }

    override fun loadVrm(buffer: ByteBuffer) {
        val directBuffer = if (buffer.isDirect) buffer else {
            val db = ByteBuffer.allocateDirect(buffer.remaining())
            db.put(buffer.duplicate())
            db.flip()
            db
        }
        mainScope.launch(Dispatchers.Main) {
            try {
                loadModelBuffer(directBuffer)
            } catch (e: Exception) {
                android.util.Log.e("VRM", "Failed to load VRM buffer", e)
                listener?.onError("Load failed: ${e.message}")
            }
        }
    }

    private fun loadModelBuffer(buffer: ByteBuffer) {
        android.util.Log.d("VRM", "loadModelBuffer: ${buffer.remaining()} bytes")

        filamentAsset?.let { old ->
            scene.removeEntities(old.entities)
            assetLoader.destroyAsset(old)
        }

        val asset = assetLoader.createAsset(buffer)
        if (asset == null) {
            android.util.Log.e("VRM", "assetLoader.createAsset returned null")
            listener?.onError("Failed to create Filament asset")
            return
        }

        filamentAsset = asset
        isModelLoaded = false

        // Clear node maps for new model
        nodeEntityMap.clear()
        nodeParentMap.clear()
        boneNodeMap.clear()
        allNodeNameEntityMap.clear()
        springBoneJointNodes.clear()
        springBoneNodeEntities.clear()
        springBoneNodeParents.clear()
        springBoneBindLocals.clear()
        springBoneInitialized = false
        springBoneRuntime.reset()

        // Build node entity and parent maps from gltf
        vrmData?.let { vrm ->
            for ((idx, node) in vrm.gltf.nodes.withIndex()) {
                node.name?.let { name ->
                    asset.getEntitiesByName(name).firstOrNull()?.let { entity ->
                        nodeEntityMap[idx] = entity
                        allNodeNameEntityMap[name] = entity
                    }
                }
                for (childIdx in node.children) {
                    if (childIdx >= 0 && childIdx < vrm.gltf.nodes.size) {
                        nodeParentMap[childIdx] = idx
                    }
                }
            }
        }

        // Load resources synchronously
        resourceLoader.loadResources(asset)

        scene.addEntities(asset.entities)
        animator = asset.instance?.animator

        // Build mappings on next frame so entities are ready
        surfaceView.post {
            try {
                buildExpressionMorphMap(asset, vrmData)
                buildBoneEntityMap(asset, vrmData)
                captureBoneBindPoses()
                buildFirstPersonEntities(asset, vrmData)
                buildSpringBoneMappings(asset, vrmData)

                isModelLoaded = true
                android.util.Log.d(
                    "VRM",
                    "Model loaded OK. title=$metaTitle, expressions=${expressionMorphMap.size}, bones=${boneEntityMap.size}"
                )
                listener?.onLoaded(metaTitle, metaAuthor, version)
            } catch (e: Exception) {
                android.util.Log.e("VRM", "Failed to build VRM mappings", e)
                listener?.onError("Mapping failed: ${e.message}")
            }
        }
    }

    override val metaTitle: String get() = vrmData?.metaTitle ?: ""
    override val metaAuthor: String get() = vrmData?.metaAuthor ?: ""
    override val version: String get() = vrmData?.version?.name?.lowercase()?.replace("_", ".") ?: "unknown"

    override fun getExpressionNames(): List<String> = expressionMorphMap.keys.toList()
    override fun setExpression(name: String, weight: Float) {
        currentExpressionWeights[name] = weight.coerceIn(0f, 1f)
    }
    override fun getExpressionWeight(name: String): Float = currentExpressionWeights[name] ?: 0f
    override fun resetExpressions() { currentExpressionWeights.clear() }

    override fun getBoneNames(): List<String> = boneEntityMap.keys.toList()

    override fun setBoneRotation(boneName: String, eulerX: Float, eulerY: Float, eulerZ: Float) {
        val key = boneName.lowercase()
        val entity = boneEntityMap[key]
            ?: allNodeNameEntityMap[boneName]
            ?: allNodeNameEntityMap[key]
            ?: return
        val bind = boneBindPoses[boneName]
            ?: boneBindPoses[key]
            ?: return

        val bindPos = floatArrayOf(bind[0], bind[1], bind[2])
        val bindQuat = floatArrayOf(bind[3], bind[4], bind[5], bind[6])
        val bindScl = floatArrayOf(bind[7], bind[8], bind[9])

        val deltaQuat = eulerToQuaternion(eulerX, eulerY, eulerZ)
        val finalQuat = quaternionMultiply(bindQuat, deltaQuat)

        val matrix = composeTransform(bindPos, finalQuat, bindScl)

        val tcm = engine.transformManager
        val instance = tcm.getInstance(entity)
        if (instance != 0) {
            tcm.setTransform(instance, matrix)
        }
    }

    override fun resetBone(boneName: String) {
        val key = boneName.lowercase()
        val entity = boneEntityMap[key]
            ?: allNodeNameEntityMap[boneName]
            ?: allNodeNameEntityMap[key]
            ?: return
        val bind = boneBindPoses[boneName]
            ?: boneBindPoses[key]
            ?: return
        val bindPos = floatArrayOf(bind[0], bind[1], bind[2])
        val bindQuat = floatArrayOf(bind[3], bind[4], bind[5], bind[6])
        val bindScl = floatArrayOf(bind[7], bind[8], bind[9])

        val matrix = composeTransform(bindPos, bindQuat, bindScl)

        val tcm = engine.transformManager
        val instance = tcm.getInstance(entity)
        if (instance != 0) {
            tcm.setTransform(instance, matrix)
        }
    }

    override fun resetAllBones() {
        boneEntityMap.keys.forEach { resetBone(it) }
        // Also reset spring bone particles so physics starts fresh from bind pose
        springBoneRuntime.resetParticles()
    }

    override var firstPersonEnabled: Boolean
        get() = _firstPersonEnabled
        set(value) {
            if (_firstPersonEnabled == value) return
            _firstPersonEnabled = value
            firstPersonEntities.forEach { entity ->
                if (value) scene.removeEntity(entity)
                else scene.addEntity(entity)
            }
        }

    override fun setLookAtTarget(x: Float, y: Float, z: Float) {
        val headEntity = boneEntityMap["head"]
            ?: allNodeNameEntityMap["head"]
            ?: allNodeNameEntityMap["Head"]
            ?: return
        val tcm = engine.transformManager
        val headInstance = tcm.getInstance(headEntity)
        if (headInstance == 0) return

        val headMatrix = FloatArray(16)
        tcm.getWorldTransform(headInstance, headMatrix)
        val headPos = floatArrayOf(headMatrix[12], headMatrix[13], headMatrix[14])

        val dx = x - headPos[0]
        val dy = y - headPos[1]
        val dz = z - headPos[2]
        val yaw = kotlin.math.atan2(dx, dz).toFloat()
        val pitch = kotlin.math.atan2(dy, kotlin.math.sqrt(dx * dx + dz * dz)).toFloat()

        setBoneRotation("head", pitch, yaw, 0f)
    }

    override fun setPosition(x: Float, y: Float, z: Float) {
        _positionX = x; _positionY = y; _positionZ = z
        transformDirty = true
    }

    override fun setRotation(eulerX: Float, eulerY: Float, eulerZ: Float) {
        _rotationQuat = eulerToQuaternion(eulerX, eulerY, eulerZ)
        transformDirty = true
    }

    override fun setScale(s: Float) { setScale(s, s, s) }

    override fun setScale(x: Float, y: Float, z: Float) {
        _scaleX = x; _scaleY = y; _scaleZ = z
        transformDirty = true
    }

    override fun update(deltaTime: Float) {
        if (!isModelLoaded) return
        animator?.updateBoneMatrices()
        applyExpressionMorphsToRenderables()
        if (springBoneEnabled) {
            applySpringBoneDeltasOnFrame(deltaTime)
            animator?.updateBoneMatrices()
        }
        if (transformDirty) {
            applyRootTransform()
            transformDirty = false
        }
    }

    override fun destroy() {
        isAlive = false
        filamentAsset?.let { assetLoader.destroyAsset(it) }
        materialProvider.destroyMaterials()
        engine.destroy()
    }

    // ==================== Spring Bone Integration ====================

    private fun buildSpringBoneMappings(asset: FilamentAsset, vrmData: VrmData?) {
        springBoneNodeEntities.clear()
        springBoneNodeParents.clear()
        springBoneBindLocals.clear()
        springBoneJointNodes.clear()
        springBoneInitialized = false
        springBoneRuntime.reset()

        if (vrmData == null) return
        val gltf = vrmData.gltf

        // Build parent map from gltf nodes
        val parentMap = mutableMapOf<Int, Int>()
        for ((parentIdx, node) in gltf.nodes.withIndex()) {
            for (childIdx in node.children) {
                if (childIdx >= 0 && childIdx < gltf.nodes.size) {
                    parentMap[childIdx] = parentIdx
                }
            }
        }

        // Collect all spring bone nodes (joints, colliders, and their parents)
        val springNodes = mutableSetOf<Int>()
        when (vrmData.version) {
            VrmVersion.VRM_0_0 -> {
                vrmData.vrm0?.springBone?.forEach { sb ->
                    sb.bones.forEach { if (it >= 0) springNodes.add(it) }
                    sb.joints.forEach { j ->
                        if (j.boneIndex >= 0) {
                            springNodes.add(j.boneIndex)
                            springBoneJointNodes.add(j.boneIndex)
                        }
                    }
                }
                vrmData.vrm0?.springBoneColliderGroups?.forEach { cg ->
                    springNodes.add(cg.node)
                }
            }
            VrmVersion.VRM_1_0 -> {
                vrmData.springBone1?.springs?.forEach { spring ->
                    spring.joints.forEach { j ->
                        springNodes.add(j.node)
                        springBoneJointNodes.add(j.node)
                    }
                }
                vrmData.springBone1?.colliders?.forEach { c ->
                    springNodes.add(c.node)
                }
            }
            else -> {}
        }

        // Add all parent nodes so parent transforms are available for local bind rotation computation
        val nodesToProcess = springNodes.toMutableSet()
        for (nodeIdx in springNodes) {
            var current = nodeIdx
            while (true) {
                val parentIdx = parentMap[current]
                if (parentIdx != null && parentIdx !in nodesToProcess) {
                    nodesToProcess.add(parentIdx)
                    current = parentIdx
                } else {
                    break
                }
            }
        }

        // Map nodes to Filament entities and capture bind local transforms
        val tcm = engine.transformManager
        for (nodeIdx in nodesToProcess) {
            val nodeName = gltf.nodes.getOrNull(nodeIdx)?.name ?: continue
            val entities = asset.getEntitiesByName(nodeName)
            if (entities.isEmpty()) continue
            val entity = entities[0]
            val instance = tcm.getInstance(entity)
            if (instance == 0) continue

            springBoneNodeEntities[nodeIdx] = entity
            parentMap[nodeIdx]?.let { springBoneNodeParents[nodeIdx] = it }

            val localMat = FloatArray(16)
            tcm.getTransform(instance, localMat)
            val (localPosArr, localRot, localSclArr) = decomposeMatrix(localMat)
            val localPos = Vector3(localPosArr[0], localPosArr[1], localPosArr[2])
            val localScl = Vector3(localSclArr[0], localSclArr[1], localSclArr[2])
            springBoneBindLocals[nodeIdx] = Triple(localPos, localRot, localScl)
        }
    }

    private fun applySpringBoneDeltasOnFrame(dt: Float) {
        if (springBoneNodeEntities.isEmpty()) return
        val vrm = vrmData ?: return

        val tcm = engine.transformManager

        // ISSUE #1: Read Filament poses as snapshots each frame
        val transformsMap = mutableMapOf<Int, MutSpringTransform>()
        for ((nodeIdx, entity) in springBoneNodeEntities) {
            val instance = tcm.getInstance(entity)
            if (instance == 0) continue
            val matrix = FloatArray(16)
            tcm.getWorldTransform(instance, matrix)
            val (pos, quat, _) = decomposeMatrix(matrix)
            transformsMap[nodeIdx] = MutSpringTransform(
                position = Vector3(pos[0], pos[1], pos[2]),
                rotation = quat.clone()
            )
        }

        // Initialize spring bone runtime on first frame
        if (!springBoneInitialized) {
            springBoneRuntime.loadFromVrm1SpringBoneExtension(vrm, transformsMap, vrm.gltf)
            springBoneInitialized = true
        }

        // Nothing to simulate
        if (springBoneRuntime.logics.isEmpty()) return

        // Integrate physics step
        for (logic in springBoneRuntime.logics) {
            logic.update(
                deltaTime = dt,
                transforms = transformsMap,
                externalForce = springBoneRuntime.externalForce,
                stiffnessMul = springBoneRuntime.stiffnessMultiplier,
                gravityMul = springBoneRuntime.gravityMultiplier,
                scalingFactor = 1.0f
            )
        }

        // Apply rotation deltas (write rotations back out)
        for (logic in springBoneRuntime.logics) {
            logic.applyRotationDeltas(transformsMap)
        }

        // Write new rotations back to Filament transforms (only for actual joint nodes)
        for (nodeIdx in springBoneJointNodes) {
            val entity = springBoneNodeEntities[nodeIdx] ?: continue
            val newTransform = transformsMap[nodeIdx] ?: continue
            val instance = tcm.getInstance(entity)
            if (instance == 0) continue

            // Get bind local data
            val bindLocal = springBoneBindLocals[nodeIdx]
            val bindPos = bindLocal?.first ?: Vector3.ZERO
            val bindScl = bindLocal?.third ?: Vector3(1f, 1f, 1f)

            // Compute new local rotation from new world rotation and parent world rotation
            val parentIdx = springBoneNodeParents[nodeIdx]
            val newLocalRot: Quaternion
            if (parentIdx != null) {
                val parentEntity = springBoneNodeEntities[parentIdx]
                    ?: nodeEntityMap[parentIdx]
                    ?: filamentAsset?.getEntitiesByName(vrm.gltf.nodes[parentIdx].name ?: "")?.firstOrNull()
                if (parentEntity != null) {
                    val parentInstance = tcm.getInstance(parentEntity)
                    if (parentInstance != 0) {
                        val parentWorldMat = FloatArray(16)
                        tcm.getWorldTransform(parentInstance, parentWorldMat)
                        val (_, parentWorldRot, _) = decomposeMatrix(parentWorldMat)

                        // newLocalRot = inverse(parentWorldRot) * newWorldRot
                        val invParentRot = parentWorldRot.clone().invert()
                        newLocalRot = invParentRot.clone().multiply(newTransform.rotation)
                    } else {
                        newLocalRot = newTransform.rotation.clone()
                    }
                } else {
                    newLocalRot = newTransform.rotation.clone()
                }
            } else {
                newLocalRot = newTransform.rotation.clone()
            }

            // Build local transform matrix: T * R * S
            val matrix = composeTransform(
                floatArrayOf(bindPos.x, bindPos.y, bindPos.z),
                floatArrayOf(newLocalRot.x, newLocalRot.y, newLocalRot.z, newLocalRot.w),
                floatArrayOf(bindScl.x, bindScl.y, bindScl.z)
            )

            tcm.setTransform(instance, matrix)
        }
    }

    // ==================== Internal ====================

    private fun buildExpressionMorphMap(asset: FilamentAsset, vrmData: VrmData?) {
        expressionMorphMap.clear()
        entityMorphWeights.clear()
        if (vrmData == null) return
        val gltf = vrmData.gltf

        vrmData.vrm1?.expressions?.preset?.forEach { (exprName, expr) ->
            val targets = mutableListOf<MorphTargetInfo>()
            expr.morphTargetBinds.forEach { bind ->
                val nodeName = gltf.nodes.getOrNull(bind.node)?.name ?: return@forEach
                asset.getEntitiesByName(nodeName).forEach { entity ->
                    targets.add(MorphTargetInfo(entity, bind.index, bind.weight))
                }
            }
            if (targets.isNotEmpty()) expressionMorphMap[exprName] = targets
        }

        vrmData.vrm0?.blendShapeMaster?.blendShapeGroups?.forEach { group ->
            val targets = mutableListOf<MorphTargetInfo>()
            group.binds.forEach { bind ->
                val nodeIndex = gltf.nodes.indexOfFirst { it.mesh == bind.mesh }
                val nodeName = if (nodeIndex >= 0) gltf.nodes[nodeIndex].name ?: "" else ""
                val entities = if (nodeName.isNotEmpty()) asset.getEntitiesByName(nodeName) else intArrayOf()
                val weight = bind.weight / 100.0f
                entities.forEach { entity ->
                    targets.add(MorphTargetInfo(entity, bind.index, weight))
                }
            }
            if (targets.isNotEmpty()) expressionMorphMap[group.presetName] = targets
        }

        val rm = engine.renderableManager
        expressionMorphMap.values.flatten().map { it.entity }.toSet().forEach { entity ->
            val instance = rm.getInstance(entity)
            val count = if (instance != 0) rm.getMorphTargetCount(instance) else 0
            if (count > 0) entityMorphWeights[entity] = FloatArray(count)
        }
    }

    private fun applyExpressionMorphsToRenderables() {
        entityMorphWeights.values.forEach { it.fill(0f) }
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

        val rm = engine.renderableManager
        entityMorphWeights.forEach { (entity, weights) ->
            val instance = rm.getInstance(entity)
            if (instance != 0) {
                for (i in weights.indices) weights[i] = weights[i].coerceIn(0f, 1f)
                rm.setMorphWeights(instance, weights, 0)
            }
        }
    }

    private fun buildBoneEntityMap(asset: FilamentAsset, vrmData: VrmData?) {
        boneEntityMap.clear()
        boneNodeMap.clear()
        if (vrmData == null) return
        val gltf = vrmData.gltf

        vrmData.vrm1?.humanoid?.humanBones?.forEach { (boneName, boneData) ->
            val nodeName = gltf.nodes.getOrNull(boneData.node)?.name ?: return@forEach
            asset.getEntitiesByName(nodeName).firstOrNull()?.let {
                boneEntityMap[boneName.lowercase()] = it
                boneNodeMap[boneName.lowercase()] = boneData.node
            }
        }

        vrmData.vrm0?.humanoid?.humanBones?.forEach { boneData ->
            val nodeName = gltf.nodes.getOrNull(boneData.node)?.name ?: return@forEach
            asset.getEntitiesByName(nodeName).firstOrNull()?.let {
                boneEntityMap[boneData.bone.lowercase()] = it
                boneNodeMap[boneData.bone.lowercase()] = boneData.node
            }
        }
    }

    private fun captureBoneBindPoses() {
        boneBindPoses.clear()
        val tcm = engine.transformManager
        // Capture bind poses for ALL named nodes, not just humanoid bones
        allNodeNameEntityMap.forEach { (nodeName, entity) ->
            captureBindPoseForNode(nodeName, entity, tcm)
        }
        // Also capture bind poses for humanoid bone names so setBoneRotation works with them
        boneEntityMap.forEach { (boneName, entity) ->
            if (!boneBindPoses.containsKey(boneName)) {
                captureBindPoseForNode(boneName, entity, tcm)
            }
        }
    }

    private fun captureBindPoseForNode(nodeName: String, entity: Int, tcm: com.google.android.filament.TransformManager) {
        val nodeIdx = boneNodeMap[nodeName.lowercase()]
            ?: vrmData?.gltf?.nodes?.indexOfFirst { it.name == nodeName }
            ?: -1
        val node = vrmData?.gltf?.nodes?.getOrNull(nodeIdx)
        val (pos, quat, scl) = if (node != null) {
            val nodeMatrix = node.matrix
            if (nodeMatrix != null && nodeMatrix.size == 16) {
                decomposeMatrix(nodeMatrix.toFloatArray())
            } else {
                Triple(
                    floatArrayOf(
                        node.translation.getOrElse(0) { 0f },
                        node.translation.getOrElse(1) { 0f },
                        node.translation.getOrElse(2) { 0f }
                    ),
                    Quaternion(
                        node.rotation.getOrElse(0) { 0f },
                        node.rotation.getOrElse(1) { 0f },
                        node.rotation.getOrElse(2) { 0f },
                        node.rotation.getOrElse(3) { 1f }
                    ),
                    floatArrayOf(
                        node.scale.getOrElse(0) { 1f },
                        node.scale.getOrElse(1) { 1f },
                        node.scale.getOrElse(2) { 1f }
                    )
                )
            }
        } else {
            val instance = tcm.getInstance(entity)
            if (instance == 0) return
            val localMat = FloatArray(16)
            tcm.getTransform(instance, localMat)
            decomposeMatrix(localMat)
        }
        boneBindPoses[nodeName] = floatArrayOf(
            pos[0], pos[1], pos[2],
            quat.x, quat.y, quat.z, quat.w,
            scl[0], scl[1], scl[2]
        )
        boneBindPoses[nodeName.lowercase()] = boneBindPoses[nodeName]!!
    }

    private fun buildFirstPersonEntities(asset: FilamentAsset, vrmData: VrmData?) {
        firstPersonEntities.clear()
        if (vrmData == null) return
        val gltf = vrmData.gltf

        vrmData.vrm1?.firstPerson?.meshAnnotations?.forEach { annotation ->
            val type = annotation.type.lowercase()
            if (type == "firstpersononly" || type == "both") {
                val nodeName = gltf.nodes.getOrNull(annotation.node)?.name ?: return@forEach
                asset.getEntitiesByName(nodeName).forEach { firstPersonEntities.add(it) }
            }
        }

        if (firstPersonEntities.isEmpty()) {
            gltf.nodes.forEach { node ->
                val name = node.name?.lowercase() ?: ""
                if (name.contains("head") || name.contains("face") || name.contains("hair")) {
                    asset.getEntitiesByName(node.name ?: "").forEach { firstPersonEntities.add(it) }
                }
            }
        }
    }

    private fun applyRootTransform() {
        val asset = filamentAsset ?: return
        val root = asset.root
        val tcm = engine.transformManager
        val instance = tcm.getInstance(root)
        if (instance == 0) return

        val matrix = composeTransform(
            floatArrayOf(_positionX, _positionY, _positionZ),
            _rotationQuat,
            floatArrayOf(_scaleX, _scaleY, _scaleZ)
        )
        tcm.setTransform(instance, matrix)
    }

    private fun decomposeMatrix(m: FloatArray): Triple<FloatArray, Quaternion, FloatArray> {
        val pos = floatArrayOf(m[12], m[13], m[14])
        val sx = kotlin.math.sqrt(m[0]*m[0] + m[1]*m[1] + m[2]*m[2])
        val sy = kotlin.math.sqrt(m[4]*m[4] + m[5]*m[5] + m[6]*m[6])
        val sz = kotlin.math.sqrt(m[8]*m[8] + m[9]*m[9] + m[10]*m[10])
        val scl = floatArrayOf(sx, sy, sz)
        val r = FloatArray(9)
        if (sx > 0.0001f) { r[0] = m[0]/sx; r[1] = m[1]/sx; r[2] = m[2]/sx }
        if (sy > 0.0001f) { r[3] = m[4]/sy; r[4] = m[5]/sy; r[5] = m[6]/sy }
        if (sz > 0.0001f) { r[6] = m[8]/sz; r[7] = m[9]/sz; r[8] = m[10]/sz }
        val quat = rotationMatrixToQuaternion(r)
        return Triple(pos, Quaternion(quat[0], quat[1], quat[2], quat[3]), scl)
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

    private fun composeTransform(position: FloatArray, quaternion: FloatArray, scale: FloatArray): FloatArray {
        val x = quaternion[0]; val y = quaternion[1]; val z = quaternion[2]; val w = quaternion[3]
        val x2 = x + x; val y2 = y + y; val z2 = z + z
        val xx = x * x2; val xy = x * y2; val xz = x * z2
        val yy = y * y2; val yz = y * z2; val zz = z * z2
        val wx = w * x2; val wy = w * y2; val wz = w * z2
        val sx = scale[0]; val sy = scale[1]; val sz = scale[2]
        return floatArrayOf(
            (1 - (yy + zz)) * sx,
            (xy + wz) * sx,
            (xz - wy) * sx,
            0f,
            (xy - wz) * sy,
            (1 - (xx + zz)) * sy,
            (yz + wx) * sy,
            0f,
            (xz + wy) * sz,
            (yz - wx) * sz,
            (1 - (xx + yy)) * sz,
            0f,
            position[0],
            position[1],
            position[2],
            1f
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

    companion object {
        init {
            System.loadLibrary("filament-jni")
            System.loadLibrary("gltfio-jni")
            System.loadLibrary("filament-utils-jni")
        }
    }
}
