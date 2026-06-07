package com.nbks.vrm_sync.tracker

import android.content.Context
import android.graphics.Bitmap
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.sqrt

data class PoseTrack(
    val bones: Map<String, Triple<Float, Float, Float>> = emptyMap(),
    val hasUpperBody: Boolean = false
)

class PoseTracer(private val ctx: Context) {

    private var landmarker: PoseLandmarker? = null

    fun initModel(taskPath: String) {
        try {
            val opts = PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath(taskPath).build())
                .setRunningMode(RunningMode.IMAGE)
                .setNumPoses(1)
                .build()
            landmarker = PoseLandmarker.createFromOptions(ctx, opts)
        } catch (e: Exception) {
            android.util.Log.e("PoseTracer", "Init failed", e)
        }
    }

    fun detect(bitmap: Bitmap): PoseTrack {
        val lm = landmarker ?: return PoseTrack(emptyMap())
        val mp = com.google.mediapipe.framework.image.BitmapImageBuilder(bitmap).build()
        return try {
            val res = lm.detect(mp)
            val landmarks = res.landmarks()
            if (landmarks.isEmpty()) PoseTrack(emptyMap())
            else extractPose(res)
        } catch (e: Exception) {
            android.util.Log.e("PoseTracer", "Detect failed", e)
            PoseTrack(emptyMap())
        }
    }

    private fun extractPose(result: PoseLandmarkerResult): PoseTrack {
        val lm = result.landmarks().firstOrNull() ?: return PoseTrack(emptyMap())
        if (lm.size < 33) return PoseTrack(emptyMap())

        val bones = mutableMapOf<String, Triple<Float, Float, Float>>()

        val lHip = lm[23]
        val rHip = lm[24]
        val hipCenterX = (lHip.x() + rHip.x()) / 2f

        val lShoulder = lm[11]
        val rShoulder = lm[12]
        if (!isTracked(lShoulder) || !isTracked(rShoulder)) return PoseTrack(emptyMap())

        val shoulderCenterX = (lShoulder.x() + rShoulder.x()) / 2f

        if (isTracked(lHip) && isTracked(rHip)) {
            val torsoLean = (shoulderCenterX - hipCenterX) * 0.9f
            val shoulderRoll = atan2(
                rShoulder.y() - lShoulder.y(),
                rShoulder.x() - lShoulder.x()
            ).toFloat()
            val spineZ = (torsoLean + shoulderRoll * 0.18f).coerceIn(-0.12f, 0.12f)

            bones["chest"] = Triple(0f, 0f, spineZ * 0.45f)
            bones["upperChest"] = Triple(0f, 0f, spineZ * 0.55f)
        }

        addArmPose(
            bones = bones,
            side = Side.Left,
            shoulder = lShoulder,
            elbow = lm[13],
            wrist = lm[15]
        )
        addArmPose(
            bones = bones,
            side = Side.Right,
            shoulder = rShoulder,
            elbow = lm[14],
            wrist = lm[16]
        )

        return PoseTrack(bones, hasUpperBody = true)
    }

    private enum class Side {
        Left,
        Right
    }

    private fun addArmPose(
        bones: MutableMap<String, Triple<Float, Float, Float>>,
        side: Side,
        shoulder: com.google.mediapipe.tasks.components.containers.NormalizedLandmark,
        elbow: com.google.mediapipe.tasks.components.containers.NormalizedLandmark,
        wrist: com.google.mediapipe.tasks.components.containers.NormalizedLandmark
    ) {
        val upperDx = elbow.x() - shoulder.x()
        val upperDy = elbow.y() - shoulder.y()
        val lowerDx = wrist.x() - elbow.x()
        val lowerDy = wrist.y() - elbow.y()
        if (!isTracked(shoulder) || !isTracked(elbow) || !isTracked(wrist)) return
        if (length2d(upperDx, upperDy) < 0.02f || length2d(lowerDx, lowerDy) < 0.02f) return

        val upperAngle = atan2(upperDy, upperDx).toFloat()
        val wholeArmAngle = atan2(wrist.y() - shoulder.y(), wrist.x() - shoulder.x()).toFloat()
        val restAngle = if (side == Side.Left) PI.toFloat() else 0f
        val upperRaise = wrapRadians(upperAngle - restAngle)
        val wholeRaise = wrapRadians(wholeArmAngle - restAngle)
        val raise = (upperRaise * 0.55f + wholeRaise * 0.35f).coerceIn(-0.95f, 0.95f)
        val forward = ((wrist.y() - shoulder.y()) * 0.35f).coerceIn(-0.2f, 0.2f)

        if (side == Side.Left) {
            bones["leftUpperArm"] = Triple(forward, 0f, raise)
        } else {
            bones["rightUpperArm"] = Triple(forward, 0f, raise)
        }
    }

    private fun wrapRadians(value: Float): Float {
        var v = value
        val twoPi = (PI * 2.0).toFloat()
        while (v > PI) v -= twoPi
        while (v < -PI) v += twoPi
        return v
    }

    private fun length2d(x: Float, y: Float): Float {
        return sqrt(x * x + y * y)
    }

    private fun isTracked(
        landmark: com.google.mediapipe.tasks.components.containers.NormalizedLandmark
    ): Boolean {
        val visibility = landmark.visibility().orElse(1f)
        val presence = landmark.presence().orElse(1f)
        return visibility >= 0.55f &&
            presence >= 0.55f &&
            landmark.x() in -0.05f..1.05f &&
            landmark.y() in -0.05f..1.05f
    }

    fun release() {
        landmarker?.close()
        landmarker = null
    }
}
