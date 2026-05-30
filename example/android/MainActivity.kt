package com.sisterm.vrm.example

import android.app.Activity
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import com.sisterm.vrm.core.CoordinateConverter
import com.sisterm.vrm.core.HumanoidBoneName
import com.sisterm.vrm.core.VRMExpressionManager
import com.sisterm.vrm.core.VRMHumanoid
import com.sisterm.vrm.core.VRMInstance
import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.core.math.Vector3
import com.sisterm.vrm.loader.GltfParser
import com.sisterm.vrm.loader.VrmData
import com.sisterm.vrm.network.VRMNetworkClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * SisterRM Android Demo Activity.
 *
 * Demonstrates:
 * - VRM 1.0 loading and parsing
 * - Humanoid bone control
 * - Expression control via UI sliders
 * - Spring bone physics update
 * - LookAt target tracking
 * - Network synchronization to vrm-server
 * - Coordinate system conversion (SSCS)
 */
class MainActivity : Activity() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var vrmInstance: VRMInstance? = null
    private var networkClient: VRMNetworkClient? = null
    private var expressionManager: VRMExpressionManager? = null
    private var humanoid: VRMHumanoid? = null

    private lateinit var statusText: TextView
    private lateinit var connectButton: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, 64, 32, 32)
        }

        // Title
        root.addView(TextView(this).apply {
            text = "SisterRM Android Demo"
            textSize = 24f
            setPadding(0, 0, 0, 24)
        })

        // Status
        statusText = TextView(this).apply {
            text = "Status: Loading VRM..."
            textSize = 14f
            setPadding(0, 0, 0, 16)
        }
        root.addView(statusText)

        // Expression sliders
        val expressions = listOf("happy", "surprised", "blink", "aa")
        for (exprName in expressions) {
            root.addView(TextView(this).apply {
                text = exprName
                setPadding(0, 16, 0, 4)
            })
            root.addView(SeekBar(this).apply {
                max = 100
                setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                    override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                        expressionManager?.setValue(exprName, progress / 100f)
                    }
                    override fun onStartTrackingTouch(seekBar: SeekBar?) {}
                    override fun onStopTrackingTouch(seekBar: SeekBar?) {}
                })
            })
        }

        // Network button
        connectButton = Button(this).apply {
            text = "Connect to Server"
            setOnClickListener { toggleNetwork() }
        }
        root.addView(connectButton)

        // Coordinate system info
        root.addView(TextView(this).apply {
            text = "Coordinate System: SSCS (RH, Y-up, -Z forward)"
            textSize = 12f
            setPadding(0, 24, 0, 0)
        })

        setContentView(root)

        // Load VRM
        loadVrm()

        // Start animation loop
        startAnimationLoop()
    }

    private fun loadVrm() {
        scope.launch(Dispatchers.IO) {
            try {
                val jsonString = assets.open("avatar.vrm.gltf").bufferedReader().use { it.readText() }
                val gltfRoot = GltfParser.parse(jsonString)
                val vrmData = VrmData.fromGltf(gltfRoot)

                // Build runtime objects from parsed data
                // In a real app, you would also build the mesh/skeleton from gltfRoot
                expressionManager = buildExpressionManager(vrmData)
                humanoid = buildHumanoid(vrmData)

                // VRMInstance requires all components; create stubs for demo
                vrmInstance = VRMInstance(
                    humanoid = humanoid!!,
                    expressions = expressionManager!!,
                    lookAt = com.sisterm.vrm.core.VRMLookAt(),
                    firstPerson = com.sisterm.vrm.core.VRMFirstPerson(),
                    meta = com.sisterm.vrm.core.VRMMeta(),
                    springBone = com.sisterm.vrm.springbone.VRMSpringBoneManager(),
                    nodeConstraint = com.sisterm.vrm.constraint.VRMNodeConstraintManager()
                )

                launch(Dispatchers.Main) {
                    statusText.text = "Status: VRM loaded (${vrmData.version})"
                }
            } catch (e: Exception) {
                launch(Dispatchers.Main) {
                    statusText.text = "Status: Load failed — ${e.message}"
                }
            }
        }
    }

    private fun buildExpressionManager(vrmData: VrmData): VRMExpressionManager {
        val mgr = VRMExpressionManager()
        val presets = vrmData.vrm1?.expressions?.preset ?: emptyMap()
        for ((name, expr) in presets) {
            mgr.registerExpression(
                com.sisterm.vrm.core.VRMExpression(
                    name = name,
                    isBinary = expr.isBinary
                )
            )
        }
        return mgr
    }

    private fun buildHumanoid(vrmData: VrmData): VRMHumanoid {
        val boneMap = mutableMapOf<HumanoidBoneName, com.sisterm.vrm.core.Bone>()
        val humanoidBones = vrmData.vrm1?.humanoid?.humanBones ?: emptyList()
        for (hb in humanoidBones) {
            val boneName = try {
                HumanoidBoneName.valueOf(hb.bone.uppercase().replace("-", "_"))
            } catch (_: IllegalArgumentException) {
                continue
            }
            boneMap[boneName] = com.sisterm.vrm.core.Bone(name = hb.bone, nodeIndex = hb.node)
        }
        return VRMHumanoid(boneMap)
    }

    private fun toggleNetwork() {
        if (networkClient?.isConnected == true) {
            networkClient?.disconnect()
            networkClient = null
            connectButton.text = "Connect to Server"
            statusText.text = "Status: Network disconnected"
        } else {
            networkClient = VRMNetworkClient().apply {
                connect("ws://10.0.2.2:8080/ws")
                joinRoom("demo", "android-${System.currentTimeMillis()}", "", "Android Player")
            }
            connectButton.text = "Disconnect"
            statusText.text = "Status: Network connected"
        }
    }

    private fun startAnimationLoop() {
        scope.launch {
            while (true) {
                val delta = 0.016f // ~60fps
                vrmInstance?.update(delta)

                // Demo: wave left arm
                humanoid?.getBone(HumanoidBoneName.LEFT_UPPER_ARM)?.let { bone ->
                    val t = System.currentTimeMillis() * 0.003f
                    bone.rotation.setFromAxisAngle(Vector3(0f, 0f, 1f), kotlin.math.sin(t) * 0.5f)
                }

                // Demo: send network state
                if (networkClient?.isConnected == true) {
                    sendNetworkState()
                }

                delay(16)
            }
        }
    }

    private fun sendNetworkState() {
        val h = humanoid ?: return
        val headBone = h.getBone(HumanoidBoneName.HEAD) ?: return

        // sendDeltaFromLocal converts from Android/Filament coordinates to SSCS
        networkClient?.sendDeltaFromLocal(
            userId = "android-player",
            position = headBone.position,
            rotation = headBone.rotation,
            scale = Vector3(1f, 1f, 1f),
            expressions = expressionManager?.expressionMap?.mapValues { it.value.weight }
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        networkClient?.disconnect()
    }
}
