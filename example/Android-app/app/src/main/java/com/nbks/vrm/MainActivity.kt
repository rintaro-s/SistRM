package com.nbks.vrm

import android.os.Bundle
import android.view.SurfaceView
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import com.sisterm.vrm.filament.VRMController
import com.sisterm.vrm.filament.VRMControllerListener
import com.sisterm.vrm.filament.VRMFilamentController

class MainActivity : ComponentActivity() {

    private lateinit var controller: VRMController

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Create SurfaceView and controller before Compose setup
        val surfaceView = SurfaceView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        controller = VRMFilamentController(surfaceView, assets)
        controller.loadVrm("avatar.vrm")

        setContentView(surfaceView)

        // Overlay Compose UI on top of the SurfaceView
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

@Composable
fun DemoOverlay(controller: VRMController) {
    var isLoaded by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var vrmTitle by remember { mutableStateOf("") }
    var vrmAuthor by remember { mutableStateOf("") }
    var vrmVersion by remember { mutableStateOf("") }
    var expressionNames by remember { mutableStateOf(listOf<String>()) }
    var boneNames by remember { mutableStateOf(listOf<String>()) }

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
        // Top info panel
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

        // Bottom controls panel
        if (isLoaded) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 400.dp)
                    .padding(8.dp)
            ) {
                Column(
                    modifier = Modifier
                        .verticalScroll(rememberScrollState())
                        .padding(12.dp)
                ) {
                    Text("Controls", fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))

                    // Quick demo buttons
                    Button(onClick = { controller.setExpression("happy", 1.0f) }) {
                        Text("Happy")
                    }
                    Button(onClick = { controller.setExpression("happy", 0.0f) }) {
                        Text("Neutral")
                    }
                    Button(onClick = {
                        controller.setBoneRotation("head", 0.3f, 0.2f, 0f)
                    }) {
                        Text("Turn Head")
                    }
                    Button(onClick = {
                        controller.resetAllBones()
                        controller.resetExpressions()
                    }) {
                        Text("Reset")
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text("API:", fontWeight = FontWeight.Bold)
                    Text("controller.setExpression(\"happy\", 0.8f)")
                    Text("controller.setBoneRotation(\"head\", x, y, z)")
                    Text("controller.firstPersonEnabled = true")
                }
            }
        }
    }
}
