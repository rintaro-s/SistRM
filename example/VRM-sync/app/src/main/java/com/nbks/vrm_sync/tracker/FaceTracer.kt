package com.nbks.vrm_sync.tracker

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import kotlin.math.*

data class FaceTrack(
    val headYaw: Float = 0f,
    val headPitch: Float = 0f,
    val smile: Float = 0f,
    val blinkLeft: Float = 0f,
    val blinkRight: Float = 0f,
    val mouthOpen: Float = 0f,
    val browInnerUp: Float = 0f,
    val browDown: Float = 0f,
    val eyeWideLeft: Float = 0f,
    val eyeWideRight: Float = 0f,
    val mouthFrown: Float = 0f,
    val mouthPucker: Float = 0f,
    val jawOpen: Float = 0f,
    val noseSneer: Float = 0f,
    val mouthDimple: Float = 0f,
    val mouthLeft: Float = 0f,
    val mouthRight: Float = 0f,
    val cheekPuff: Float = 0f,
)

class FaceTracer(private val context: Context) {

    private var landmarker: FaceLandmarker? = null
    private var processingOptions: ImageProcessingOptions? = null

    fun initModel(taskPath: String) {
        try {
            val baseOpts = BaseOptions.builder()
                .setModelAssetPath(taskPath)
                .build()
            val opts = FaceLandmarker.FaceLandmarkerOptions.builder()
                .setBaseOptions(baseOpts)
                .setRunningMode(com.google.mediapipe.tasks.vision.core.RunningMode.IMAGE)
                .setOutputFaceBlendshapes(true)
                .setNumFaces(1)
                .build()
            landmarker = FaceLandmarker.createFromOptions(context, opts)
            processingOptions = ImageProcessingOptions.builder().build()
        } catch (e: Exception) {
            android.util.Log.e("FaceTracer", "Init failed", e)
        }
    }

    fun detect(bitmap: Bitmap): FaceTrack {
        val lm = landmarker ?: return FaceTrack()
        val opts = processingOptions ?: return FaceTrack()
        val mpImg = com.google.mediapipe.framework.image.BitmapImageBuilder(bitmap).build()
        var res = FaceTrack()
        try {
            val result = lm.detect(mpImg, opts)
            res = extractFace(result)
        } catch (e: Exception) { android.util.Log.e("FaceTracer", "Detect failed", e) }
        return res
    }

    private fun extractFace(result: com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult): FaceTrack {
        var smile = 0f
        var blinkL = 0f
        var blinkR = 0f
        var mouthOpen = 0f
        var browInnerUp = 0f
        var browDown = 0f
        var eyeWideL = 0f
        var eyeWideR = 0f
        var mouthFrown = 0f
        var mouthPucker = 0f
        var jawOpen = 0f
        var noseSneer = 0f
        var mouthDimple = 0f
        var mouthLeft = 0f
        var mouthRight = 0f
        var cheekPuff = 0f

        val faceBlendshapes = result.faceBlendshapes().orElse(null)
        val categories = faceBlendshapes?.firstOrNull()
        if (categories != null) {
            for (bs in categories) {
                val weight = bs.score()
                when (bs.categoryName().lowercase()) {
                    "mouthsmileleft" -> smile = maxOf(smile, weight)
                    "mouthsmileright" -> smile = maxOf(smile, weight)
                    "eyeblinkleft" -> blinkL = weight
                    "eyeblinkright" -> blinkR = weight
                    "jawopen" -> jawOpen = maxOf(jawOpen, weight)
                    "mouthopen" -> mouthOpen = maxOf(mouthOpen, weight)
                    "browinnerup" -> browInnerUp = maxOf(browInnerUp, weight)
                    "browdownleft", "browdownright" -> browDown = maxOf(browDown, weight)
                    "eyewideleft" -> eyeWideL = maxOf(eyeWideL, weight)
                    "eyewideright" -> eyeWideR = maxOf(eyeWideR, weight)
                    "mouthfrownleft", "mouthfrownright" -> mouthFrown = maxOf(mouthFrown, weight)
                    "mouthpucker" -> mouthPucker = maxOf(mouthPucker, weight)
                    "nosesneerleft", "nosesneerright" -> noseSneer = maxOf(noseSneer, weight)
                    "mouthdimpleleft", "mouthdimpleright" -> mouthDimple = maxOf(mouthDimple, weight)
                    "mouthleft" -> mouthLeft = maxOf(mouthLeft, weight)
                    "mouthright" -> mouthRight = maxOf(mouthRight, weight)
                    "cheekpuff" -> cheekPuff = maxOf(cheekPuff, weight)
                }
            }
        }

        var yaw = 0f
        var pitch = 0f
        val lm = result.faceLandmarks().firstOrNull()
        if (lm != null && lm.size > 5) {
            val noseX = lm[1].x()
            val noseY = lm[1].y()
            yaw = ((noseX - 0.5f) * -PI).toFloat()
            pitch = ((noseY - 0.5f) * PI).toFloat()
        }

        return FaceTrack(
            headYaw = yaw,
            headPitch = pitch,
            smile = smile.coerceIn(0f, 1f),
            blinkLeft = blinkL.coerceIn(0f, 1f),
            blinkRight = blinkR.coerceIn(0f, 1f),
            mouthOpen = mouthOpen.coerceIn(0f, 1f),
            browInnerUp = browInnerUp.coerceIn(0f, 1f),
            browDown = browDown.coerceIn(0f, 1f),
            eyeWideLeft = eyeWideL.coerceIn(0f, 1f),
            eyeWideRight = eyeWideR.coerceIn(0f, 1f),
            mouthFrown = mouthFrown.coerceIn(0f, 1f),
            mouthPucker = mouthPucker.coerceIn(0f, 1f),
            jawOpen = jawOpen.coerceIn(0f, 1f),
            noseSneer = noseSneer.coerceIn(0f, 1f),
            mouthDimple = mouthDimple.coerceIn(0f, 1f),
            mouthLeft = mouthLeft.coerceIn(0f, 1f),
            mouthRight = mouthRight.coerceIn(0f, 1f),
            cheekPuff = cheekPuff.coerceIn(0f, 1f),
        )
    }

    fun release() {
        landmarker?.close()
        landmarker = null
    }
}
