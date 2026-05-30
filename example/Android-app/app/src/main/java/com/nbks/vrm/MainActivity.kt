package com.nbks.vrm

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.lifecycleScope
import com.nbks.vrm.core.*
import com.nbks.vrm.math.Quaternion
import com.nbks.vrm.math.Vector3
import com.nbks.vrm.network.AvatarDeltaMessage
import com.nbks.vrm.network.NetworkEvent
import com.nbks.vrm.network.TransformData
import com.nbks.vrm.network.VRMNetworkClient
import com.nbks.vrm.parser.GltfParser
import com.nbks.vrm.parser.VrmData
import com.nbks.vrm.parser.VrmVersion
import com.nbks.vrm.ui.theme.VRMTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.io.BufferedReader
import java.io.ByteArrayInputStream
import java.io.InputStreamReader
import java.util.zip.GZIPInputStream

class MainActivity : ComponentActivity() {

    private var vrmData: VrmData? = null
    private val expressionManager = VRMExpressionManager()
    private val humanoid: VRMHumanoid by lazy { buildHumanoid() }
    private val networkClient = VRMNetworkClient()
    private var networkJob: kotlinx.coroutines.Job? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        loadVrm()

        setContent {
            VRMTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    VRMDemoScreen()
                }
            }
        }
    }

    private fun loadVrm() {
        try {
            val inputStream = assets.open("avatar.vrm")
            val bytes = inputStream.readBytes()
            inputStream.close()

            // Try GZIP first, then raw
            val jsonString = try {
                GZIPInputStream(ByteArrayInputStream(bytes)).use { gz ->
                    BufferedReader(InputStreamReader(gz)).readText()
                }
            } catch (_: Exception) {
                bytes.decodeToString()
            }

            val gltfRoot = GltfParser.parse(jsonString)
            vrmData = VrmData.fromGltf(gltfRoot)

            // Register expressions
            vrmData?.expressionNames?.forEach { name ->
                val isBinary = when (vrmData?.version) {
                    VrmVersion.VRM_1_0 -> vrmData?.vrm1?.expressions?.preset?.get(name)?.isBinary ?: false
                    else -> false
                }
                expressionManager.registerExpression(VRMExpression(name, isBinary))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun buildHumanoid(): VRMHumanoid {
        val boneMap = mutableMapOf<HumanoidBoneName, Bone>()
        when (vrmData?.version) {
            VrmVersion.VRM_1_0 -> {
                vrmData?.vrm1?.humanoid?.humanBones?.forEach { hb ->
                    val boneName = try {
                        HumanoidBoneName.valueOf(hb.bone.uppercase().replace("-", "_"))
                    } catch (_: IllegalArgumentException) { return@forEach }
                    boneMap[boneName] = Bone(name = hb.bone, nodeIndex = hb.node)
                }
            }
            VrmVersion.VRM_0_0 -> {
                vrmData?.vrm0?.humanoid?.humanBones?.forEach { hb ->
                    val boneName = try {
                        HumanoidBoneName.valueOf(hb.bone.uppercase().replace("-", "_"))
                    } catch (_: IllegalArgumentException) { return@forEach }
                    boneMap[boneName] = Bone(name = hb.bone, nodeIndex = hb.node)
                }
            }
            else -> {}
        }
        // Add head bone for look-at demo
        if (!boneMap.containsKey(HumanoidBoneName.HEAD)) {
            boneMap[HumanoidBoneName.HEAD] = Bone(name = "head", nodeIndex = -1)
        }
        return VRMHumanoid(boneMap)
    }

    private fun connectToNetwork(serverUrl: String, roomId: String, userId: String) {
        networkClient.connect(serverUrl)
        networkClient.joinRoom(roomId, userId, "", "Android Player")

        // Start sending deltas at 20Hz
        networkJob = lifecycleScope.launch {
            while (networkClient.isConnected) {
                val head = humanoid.getBone(HumanoidBoneName.HEAD)
                val expressions = expressionManager.expressions
                    .filter { it.value.weight > 0.001f }
                    .mapValues { it.value.weight }

                networkClient.sendDeltaFromLocal(
                    userId = userId,
                    position = head?.position ?: Vector3(),
                    rotation = head?.rotation ?: Quaternion.IDENTITY.clone(),
                    scale = Vector3(1f, 1f, 1f),
                    expressions = expressions.ifEmpty { null },
                    lookAt = Vector3(0f, 1.6f, -2f)
                )
                delay(50)
            }
        }
    }

    private fun disconnectNetwork() {
        networkJob?.cancel()
        networkClient.disconnect()
    }

    @Composable
    fun VRMDemoScreen() {
        var serverUrl by remember { mutableStateOf("ws://10.0.2.2:8080/ws") }
        var roomId by remember { mutableStateOf("demo") }
        var userId by remember { mutableStateOf("android-${System.currentTimeMillis()}") }
        var isConnected by remember { mutableStateOf(false) }
        var networkStatus by remember { mutableStateOf("Disconnected") }
        var lastReceived by remember { mutableStateOf("") }

        LaunchedEffect(Unit) {
            networkClient.events.collect { event ->
                when (event) {
                    is NetworkEvent.Connected -> {
                        isConnected = true
                        networkStatus = "Connected"
                    }
                    is NetworkEvent.Disconnected -> {
                        isConnected = false
                        networkStatus = "Disconnected"
                    }
                    is NetworkEvent.MessageReceived -> {
                        lastReceived = event.message.take(200)
                    }
                    is NetworkEvent.Error -> {
                        networkStatus = "Error: ${event.exception.message}"
                    }
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Text(
                text = "SisterRM VRM Demo",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(16.dp))

            // VRM Info Card
            VRMInfoCard()
            Spacer(modifier = Modifier.height(16.dp))

            // Expressions
            Text(
                text = "Expressions",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            ExpressionSliders()
            Spacer(modifier = Modifier.height(16.dp))

            // Humanoid Bones
            Text(
                text = "Humanoid Bones (${humanoid.bones.size})",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            BoneList()
            Spacer(modifier = Modifier.height(16.dp))

            // Network Panel
            Text(
                text = "Network",
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))

            OutlinedTextField(
                value = serverUrl,
                onValueChange = { serverUrl = it },
                label = { Text("Server URL") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true
            )
            Spacer(modifier = Modifier.height(4.dp))
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = roomId,
                    onValueChange = { roomId = it },
                    label = { Text("Room") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
                OutlinedTextField(
                    value = userId,
                    onValueChange = { userId = it },
                    label = { Text("User ID") },
                    modifier = Modifier.weight(1f),
                    singleLine = true
                )
            }
            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = {
                    if (isConnected) {
                        disconnectNetwork()
                    } else {
                        connectToNetwork(serverUrl, roomId, userId)
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (isConnected) "Disconnect" else "Connect to Server")
            }
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Status: $networkStatus",
                style = MaterialTheme.typography.bodyMedium,
                color = if (isConnected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
            )
            if (lastReceived.isNotEmpty()) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Last msg: $lastReceived",
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 3
                )
            }
        }
    }

    @Composable
    fun VRMInfoCard() {
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.padding(16.dp)) {
                val data = vrmData
                if (data == null) {
                    Text("Loading VRM...", style = MaterialTheme.typography.bodyLarge)
                } else {
                    Text("Model: ${data.metaTitle}", fontWeight = FontWeight.Bold)
                    Text("Author: ${data.metaAuthor}")
                    Text("Version: ${data.version}")
                    Text("Bones: ${data.humanoidBoneNames.size}")
                    Text("Expressions: ${data.expressionNames.size}")
                    if (data.vrm1?.meta?.licenseUrl?.isNotEmpty() == true) {
                        Text("License: ${data.vrm1.meta.licenseUrl}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }

    @Composable
    fun ExpressionSliders() {
        val expressions = expressionManager.expressions.values.toList()
        if (expressions.isEmpty()) {
            Text("No expressions found", style = MaterialTheme.typography.bodyMedium)
            return
        }
        expressions.forEach { expr ->
            var value by remember(expr.name) { mutableFloatStateOf(0f) }
            Column(modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "${expr.name}${if (expr.isBinary) " (binary)" else ""}",
                    style = MaterialTheme.typography.bodyMedium
                )
                Slider(
                    value = value,
                    onValueChange = {
                        value = it
                        expressionManager.setValue(expr.name, it)
                    },
                    valueRange = 0f..1f,
                    steps = if (expr.isBinary) 0 else 99
                )
            }
        }
    }

    @Composable
    fun BoneList() {
        val bones = humanoid.bones
        if (bones.isEmpty()) {
            Text("No bones found", style = MaterialTheme.typography.bodyMedium)
            return
        }
        FlowRow(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            bones.keys.forEach { boneName ->
                AssistChip(
                    onClick = {},
                    label = { Text(boneName.name.lowercase().replace("_", " ")) }
                )
            }
        }
    }
}
