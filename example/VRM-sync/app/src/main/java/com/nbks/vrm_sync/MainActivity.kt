package com.nbks.vrm_sync

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.SurfaceView
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import kotlin.math.abs
import com.nbks.vrm_sync.tracker.AvatarDriver
import com.nbks.vrm_sync.tracker.FaceTrack
import com.nbks.vrm_sync.tracker.FaceTracer
import com.nbks.vrm_sync.tracker.PoseTrack
import com.nbks.vrm_sync.tracker.PoseTracer
import com.nbks.vrm_sync.ui.theme.VRMSyncTheme
import com.sisterm.vrm.filament.VRMFilamentController
import com.sisterm.vrm.filament.VRMControllerListener
import java.util.concurrent.Executors

class MainActivity : ComponentActivity() {

    private lateinit var vrmController: VRMFilamentController
    private lateinit var avatarDriver: AvatarDriver
    private lateinit var faceTracer: FaceTracer
    private lateinit var poseTracer: PoseTracer
    private var cameraPreviewView: PreviewView? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private val analysisExecutor = Executors.newSingleThreadExecutor()

    private var faceTrack by mutableStateOf(FaceTrack())
    private var poseTrack by mutableStateOf(PoseTrack(emptyMap()))
    private var statusText by mutableStateOf("Initializing...")
    private var faceFps by mutableFloatStateOf(0f)
    private var poseFps by mutableFloatStateOf(0f)
    private var latestFaceTrack = FaceTrack()
    private var latestPoseTrack = PoseTrack(emptyMap())

    private var faceFrameCount = 0
    private var poseFrameCount = 0
    private var lastFpsTime = System.currentTimeMillis()

    private var modelsReady = false

    private val requestPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (granted) {
                startCamera()
            } else {
                statusText = "Camera permission denied"
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        faceTracer = FaceTracer(this)
        poseTracer = PoseTracer(this)

        setContent {
            VRMSyncTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    VRMSyncContent(
                        statusText = statusText,
                        faceFps = faceFps,
                        poseFps = poseFps,
                        faceTrack = faceTrack,
                        poseTrack = poseTrack
                    )
                }
            }
        }

        initModels()
    }

    private fun initModels() {
        Executors.newSingleThreadExecutor().execute {
            try {
                faceTracer.initModel("face_landmarker.task")
                poseTracer.initModel("pose_landmarker.task")
                modelsReady = true
                mainHandler.post {
                    statusText = "Models loaded. Requesting camera..."
                    checkCameraPermission()
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Model init failed", e)
                mainHandler.post {
                    statusText = "Model init failed: ${e.message}"
                }
            }
        }
    }

    private fun checkCameraPermission() {
        when {
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED -> {
                startCamera()
            }
            else -> {
                requestPermissionLauncher.launch(Manifest.permission.CAMERA)
            }
        }
    }

    private fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(this)
        cameraProviderFuture.addListener({
            val cameraProvider = cameraProviderFuture.get()

            val imageAnalysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .build()

            imageAnalysis.setAnalyzer(analysisExecutor) { imageProxy ->
                processFrame(imageProxy)
            }

            val preview = Preview.Builder().build()
            cameraPreviewView?.let { preview.setSurfaceProvider(it.surfaceProvider) }

            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA

            try {
                cameraProvider.unbindAll()
                if (cameraPreviewView != null) {
                    cameraProvider.bindToLifecycle(this, cameraSelector, preview, imageAnalysis)
                } else {
                    cameraProvider.bindToLifecycle(this, cameraSelector, imageAnalysis)
                }
                mainHandler.post {
                    statusText = "Camera started"
                }
            } catch (e: Exception) {
                Log.e("MainActivity", "Camera bind failed", e)
                mainHandler.post {
                    statusText = "Camera error: ${e.message}"
                }
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun processFrame(imageProxy: ImageProxy) {
        if (!modelsReady) {
            imageProxy.close()
            return
        }

        val bitmap = imageProxyToBitmap(imageProxy)
        imageProxy.close()

        if (bitmap == null) return

        val faceResult = try {
            faceTracer.detect(bitmap)
        } catch (e: Exception) {
            null
        }

        val poseResult = try {
            poseTracer.detect(bitmap)
        } catch (e: Exception) {
            null
        }

        val nextFaceTrack = faceResult ?: latestFaceTrack
        val nextPoseTrack = poseResult ?: latestPoseTrack
        latestFaceTrack = nextFaceTrack
        latestPoseTrack = nextPoseTrack
        mainHandler.post {
            if (faceResult != null) faceTrack = faceResult
            if (poseResult != null) poseTrack = poseResult
            if (::avatarDriver.isInitialized) {
                avatarDriver.update(nextPoseTrack, nextFaceTrack)
            }
        }

        val now = System.currentTimeMillis()
        if (faceResult != null) faceFrameCount++
        if (poseResult != null) poseFrameCount++
        if (now - lastFpsTime >= 1000) {
            val elapsed = (now - lastFpsTime) / 1000f
            val newFaceFps = faceFrameCount / elapsed
            val newPoseFps = poseFrameCount / elapsed
            faceFrameCount = 0
            poseFrameCount = 0
            lastFpsTime = now
            mainHandler.post {
                faceFps = newFaceFps
                poseFps = newPoseFps
            }
        }

        bitmap.recycle()
    }

    private fun imageProxyToBitmap(imageProxy: ImageProxy): Bitmap? {
        val planes = imageProxy.planes
        if (planes.isEmpty()) return null

        val buffer = planes[0].buffer
        val pixelStride = planes[0].pixelStride
        val rowStride = planes[0].rowStride
        val rowPadding = rowStride - pixelStride * imageProxy.width

        val bitmap = Bitmap.createBitmap(
            imageProxy.width + rowPadding / pixelStride,
            imageProxy.height,
            Bitmap.Config.ARGB_8888
        )
        bitmap.copyPixelsFromBuffer(buffer)

        val sourceBitmap = if (rowPadding > 0) {
            Bitmap.createBitmap(bitmap, 0, 0, imageProxy.width, imageProxy.height)
        } else bitmap

        val matrix = Matrix().apply {
            postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            postScale(-1f, 1f)
        }

        return Bitmap.createBitmap(
            sourceBitmap, 0, 0, sourceBitmap.width, sourceBitmap.height, matrix, true
        )
    }

    override fun onDestroy() {
        super.onDestroy()
        analysisExecutor.shutdownNow()
        if (::faceTracer.isInitialized) faceTracer.release()
        if (::poseTracer.isInitialized) poseTracer.release()
        if (::vrmController.isInitialized) vrmController.destroy()
    }

    @Composable
    private fun VRMSyncContent(
        statusText: String,
        faceFps: Float,
        poseFps: Float,
        faceTrack: FaceTrack,
        poseTrack: PoseTrack
    ) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Top half: VRM model
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        SurfaceView(ctx).also { surfaceView ->
                            surfaceView.layoutParams = FrameLayout.LayoutParams(
                                FrameLayout.LayoutParams.MATCH_PARENT,
                                FrameLayout.LayoutParams.MATCH_PARENT
                            )
                            vrmController = VRMFilamentController(surfaceView, ctx.assets)
                            vrmController.springBoneEnabled = false
                            avatarDriver = AvatarDriver(vrmController)
                            vrmController.setListener(object : VRMControllerListener {
                                override fun onLoaded(
                                    metaTitle: String,
                                    metaAuthor: String,
                                    version: String
                                ) {
                                    mainHandler.post {
                                        this@MainActivity.statusText = "VRM loaded: $metaTitle v$version"
                                    }
                                }

                                override fun onError(message: String) {
                                    mainHandler.post {
                                        this@MainActivity.statusText = "VRM error: $message"
                                    }
                                }
                            })
                            vrmController.loadVrm("avatar.vrm")
                        }
                    }
                )
            }

            // Bottom: camera preview and recognition status
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(220.dp)
                    .background(Color.Black)
            ) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = { ctx ->
                        PreviewView(ctx).also { previewView ->
                            previewView.scaleType = PreviewView.ScaleType.FILL_CENTER
                            cameraPreviewView = previewView
                        }
                    }
                )

                Column(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.72f))
                        .padding(12.dp)
                ) {
                    Text(
                        text = statusText,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = "Face %.1f fps | Pose %.1f fps".format(faceFps, poseFps),
                        color = Color.Cyan,
                        fontSize = 12.sp
                    )
                    Text(
                        text = "Face  smile %.2f  blink %.2f/%.2f  mouth %.2f  jaw %.2f".format(
                            faceTrack.smile,
                            faceTrack.blinkLeft,
                            faceTrack.blinkRight,
                            faceTrack.mouthOpen,
                            faceTrack.jawOpen
                        ),
                        color = Color.Yellow,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 4.dp)
                    )

                    val activeBones = poseTrack.bones.filter { (_, v) ->
                        abs(v.first) > 0.05f || abs(v.second) > 0.05f || abs(v.third) > 0.05f
                    }
                    Text(
                        text = if (activeBones.isNotEmpty()) {
                            "Pose  ${activeBones.keys.joinToString(", ")}"
                        } else {
                            "Pose  waiting for shoulders / elbows / wrists"
                        },
                        color = if (activeBones.isNotEmpty()) Color.Green else Color.LightGray,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }
        }
    }
}
