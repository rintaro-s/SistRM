package com.nbks.vrm

import android.os.Bundle
import android.view.SurfaceView
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.sisterm.vrm.filament.VRMController
import com.sisterm.vrm.filament.VRMControllerListener
import com.sisterm.vrm.filament.VRMFilamentController

class MainActivity : ComponentActivity() {

    private lateinit var controller: VRMFilamentController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val surfaceView = SurfaceView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        controller = VRMFilamentController(surfaceView, assets)
        controller.loadVrm("avatar.vrm")

        setContentView(surfaceView)

        val composeView = androidx.compose.ui.platform.ComposeView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        addContentView(composeView, composeView.layoutParams)

        composeView.setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = androidx.compose.ui.graphics.Color.Transparent
                ) {
                    DemoOverlay(controller)
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::controller.isInitialized) {
            controller.destroy()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DemoOverlay(controller: VRMFilamentController) {
    var isLoaded by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var vrmTitle by remember { mutableStateOf("") }
    var vrmAuthor by remember { mutableStateOf("") }
    var vrmVersion by remember { mutableStateOf("") }
    var expressionNames by remember { mutableStateOf(listOf<String>()) }
    var boneNames by remember { mutableStateOf(listOf<String>()) }
    var springBoneEnabled by remember { mutableStateOf(controller.springBoneEnabled) }

    LaunchedEffect(controller) {
        controller.setListener(object : VRMControllerListener {
            override fun onLoaded(metaTitle: String, metaAuthor: String, version: String) {
                vrmTitle = metaTitle
                vrmAuthor = metaAuthor
                vrmVersion = version
                expressionNames = controller.getExpressionNames()
                boneNames = controller.getBoneNames()
                isLoaded = true
                errorMessage = null
            }
            override fun onError(message: String) {
                errorMessage = message
                isLoaded = false
            }
        })
    }

    Column(modifier = Modifier.fillMaxSize()) {
        if (isLoaded) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("VRM Demo", fontWeight = FontWeight.Bold)
                    Text("Model: $vrmTitle")
                    Text("Author: $vrmAuthor")
                    Text("Version: $vrmVersion")
                    Text("Expressions: ${expressionNames.size}, Bones: ${boneNames.size}")
                }
            }
        } else if (errorMessage != null) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(8.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer
                )
            ) {
                Text(
                    "Error: $errorMessage",
                    modifier = Modifier.padding(12.dp),
                    color = MaterialTheme.colorScheme.onErrorContainer
                )
            }
        } else {
            Box(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        if (isLoaded) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 500.dp)
                    .padding(8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(12.dp)
                ) {
                    Text("Controls", fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))

                    // Spring bone toggle
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(
                            checked = springBoneEnabled,
                            onCheckedChange = {
                                springBoneEnabled = it
                                controller.springBoneEnabled = it
                            }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Spring Bone (hair/cloth physics)")
                    }
                    Spacer(modifier = Modifier.height(8.dp))

                    // Expression controls
                    if (expressionNames.isNotEmpty()) {
                        Text("Expressions:", fontWeight = FontWeight.Bold)
                        expressionNames.take(6).forEach { exprName ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(exprName, modifier = Modifier.width(80.dp))
                                Slider(
                                    value = controller.getExpressionWeight(exprName),
                                    onValueChange = { controller.setExpression(exprName, it) },
                                    modifier = Modifier.weight(1f),
                                    valueRange = 0f..1f
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    // Bone rotation controls
                    if (boneNames.isNotEmpty()) {
                        Text("Bone Rotation:", fontWeight = FontWeight.Bold)
                        var selectedBone by remember { mutableStateOf(boneNames.firstOrNull() ?: "") }
                        var rotX by remember { mutableFloatStateOf(0f) }
                        var rotY by remember { mutableFloatStateOf(0f) }
                        var rotZ by remember { mutableFloatStateOf(0f) }

                        // Bone selector
                        var boneDropdownExpanded by remember { mutableStateOf(false) }
                        ExposedDropdownMenuBox(
                            expanded = boneDropdownExpanded,
                            onExpandedChange = { boneDropdownExpanded = it }
                        ) {
                            TextField(
                                value = selectedBone,
                                onValueChange = {},
                                readOnly = true,
                                label = { Text("Select Bone") },
                                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = boneDropdownExpanded) },
                                modifier = Modifier.menuAnchor().fillMaxWidth()
                            )
                            ExposedDropdownMenu(
                                expanded = boneDropdownExpanded,
                                onDismissRequest = { boneDropdownExpanded = false }
                            ) {
                                boneNames.take(50).forEach { boneName ->
                                    DropdownMenuItem(
                                        text = { Text(boneName) },
                                        onClick = {
                                            selectedBone = boneName
                                            boneDropdownExpanded = false
                                        }
                                    )
                                }
                            }
                        }

                        // Rotation sliders
                        Text("X: ${"%.2f".format(rotX)}")
                        Slider(value = rotX, onValueChange = { rotX = it }, valueRange = -3.14f..3.14f)
                        Text("Y: ${"%.2f".format(rotY)}")
                        Slider(value = rotY, onValueChange = { rotY = it }, valueRange = -3.14f..3.14f)
                        Text("Z: ${"%.2f".format(rotZ)}")
                        Slider(value = rotZ, onValueChange = { rotZ = it }, valueRange = -3.14f..3.14f)

                        Row {
                            Button(onClick = {
                                controller.setBoneRotation(selectedBone, rotX, rotY, rotZ)
                            }) {
                                Text("Apply")
                            }
                            Spacer(modifier = Modifier.width(8.dp))
                            Button(onClick = {
                                controller.resetBone(selectedBone)
                                rotX = 0f; rotY = 0f; rotZ = 0f
                            }) {
                                Text("Reset Bone")
                            }
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }

                    // Global reset
                    Button(onClick = {
                        controller.resetAllBones()
                        controller.resetExpressions()
                    }) {
                        Text("Reset All")
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("First Person:", fontWeight = FontWeight.Bold)
                    var fpEnabled by remember { mutableStateOf(controller.firstPersonEnabled) }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Switch(
                            checked = fpEnabled,
                            onCheckedChange = {
                                fpEnabled = it
                                controller.firstPersonEnabled = it
                            }
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Hide head/face/hair")
                    }
                }
            }
        }
    }
}
