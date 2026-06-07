package com.nbks.vrm_sync.tracker

import com.sisterm.vrm.filament.VRMController
import kotlin.math.*

class AvatarDriver(private val controller: VRMController) {

    private var sHeadYaw = 0f
    private var sPitch = 0f
    private var smileAmount = 0f
    private var blinkL = 0f
    private var sBlinkR = 0f
    private var sMouthOpen = 0f
    private var sBrowInnerUp = 0f
    private var sBrowDown = 0f
    private var sEyeWide = 0f
    private var sMouthFrown = 0f
    private var sMouthPucker = 0f
    private var sJawOpen = 0f
    private var sNoseSneer = 0f
    private var sMouthDimple = 0f
    private var sMouthLeft = 0f
    private var sMouthRight = 0f
    private var sCheekPuff = 0f

    private val boneCurrent = mutableMapOf<String, Triple<Float, Float, Float>>()
    private val boneTarget = mutableMapOf<String, Triple<Float, Float, Float>>()

    companion object {
        const val SMOOTH_T = 0.35f
        const val POSE_SMOOTH_T = 0.5f
    }

    fun update(pose: PoseTrack?, face: FaceTrack?) {
        if (face != null) {
            sHeadYaw = lerp(sHeadYaw, face.headYaw, SMOOTH_T)
            sPitch = lerp(sPitch, face.headPitch, SMOOTH_T)
            smileAmount = lerp(smileAmount, face.smile.coerceIn(0f, 1f), SMOOTH_T)
            blinkL = lerp(blinkL, face.blinkLeft.coerceIn(0f, 1f), 0.5f)
            sBlinkR = lerp(sBlinkR, face.blinkRight.coerceIn(0f, 1f), 0.5f)
            sMouthOpen = lerp(sMouthOpen, face.mouthOpen.coerceIn(0f, 1f), SMOOTH_T)
            sBrowInnerUp = lerp(sBrowInnerUp, face.browInnerUp.coerceIn(0f, 1f), SMOOTH_T)
            sBrowDown = lerp(sBrowDown, face.browDown.coerceIn(0f, 1f), SMOOTH_T)
            sEyeWide = lerp(sEyeWide, maxOf(face.eyeWideLeft, face.eyeWideRight).coerceIn(0f, 1f), SMOOTH_T)
            sMouthFrown = lerp(sMouthFrown, face.mouthFrown.coerceIn(0f, 1f), SMOOTH_T)
            sMouthPucker = lerp(sMouthPucker, face.mouthPucker.coerceIn(0f, 1f), SMOOTH_T)
            sJawOpen = lerp(sJawOpen, face.jawOpen.coerceIn(0f, 1f), SMOOTH_T)
            sNoseSneer = lerp(sNoseSneer, face.noseSneer.coerceIn(0f, 1f), SMOOTH_T)
            sMouthDimple = lerp(sMouthDimple, face.mouthDimple.coerceIn(0f, 1f), SMOOTH_T)
            sMouthLeft = lerp(sMouthLeft, face.mouthLeft.coerceIn(0f, 1f), SMOOTH_T)
            sMouthRight = lerp(sMouthRight, face.mouthRight.coerceIn(0f, 1f), SMOOTH_T)
            sCheekPuff = lerp(sCheekPuff, face.cheekPuff.coerceIn(0f, 1f), SMOOTH_T)
        } else {
            sHeadYaw *= 0.9f
            sPitch *= 0.9f
            smileAmount *= 0.9f
            blinkL *= 0.9f
            sBlinkR *= 0.9f
            sMouthOpen *= 0.9f
            sBrowInnerUp *= 0.9f
            sBrowDown *= 0.9f
            sEyeWide *= 0.9f
            sMouthFrown *= 0.9f
            sMouthPucker *= 0.9f
            sJawOpen *= 0.9f
            sNoseSneer *= 0.9f
            sMouthDimple *= 0.9f
            sMouthLeft *= 0.9f
            sMouthRight *= 0.9f
            sCheekPuff *= 0.9f
        }

        val blinkVal = maxOf(blinkL, sBlinkR).coerceIn(0f, 1f) * 1.5f
        setExpressions(listOf("blink", "blinkLeft", "blinkRight"), blinkVal.coerceIn(0f, 1f))
        setExpressions(listOf("joy", "happy"), smileAmount.coerceIn(0f, 1f))
        setExpressions(listOf("aa", "a"), maxOf(sMouthOpen, sJawOpen).coerceIn(0f, 1f))
        setExpressions(listOf("ih", "i"), sMouthOpen.coerceIn(0f, 1f) * 0.7f)
        setExpressions(listOf("ou", "u", "o"), sMouthPucker.coerceIn(0f, 1f))
        setExpressions(listOf("ee", "e"), sMouthDimple.coerceIn(0f, 1f))
        setExpressions(listOf("nn"), sNoseSneer.coerceIn(0f, 1f))
        setExpressions(listOf("angry"), sBrowDown.coerceIn(0f, 1f))
        setExpressions(listOf("sorrow", "sad"), sMouthFrown.coerceIn(0f, 1f))
        setExpressions(listOf("surprised", "surprise"), sEyeWide.coerceIn(0f, 1f))
        setExpressions(listOf("relaxed"), smileAmount.coerceIn(0f, 1f) * 0.5f)

        controller.setBoneRotation("head", sPitch, -sHeadYaw, 0f)

        if (pose != null && pose.bones.isNotEmpty()) {
            for ((name, euler) in pose.bones) {
                val cur = boneCurrent[name] ?: Triple(0f, 0f, 0f)
                val target = Triple(euler.first, euler.second, euler.third)
                boneTarget[name] = target
                val smoothed = Triple(
                    lerp(cur.first, target.first, POSE_SMOOTH_T),
                    lerp(cur.second, target.second, POSE_SMOOTH_T),
                    lerp(cur.third, target.third, POSE_SMOOTH_T)
                )
                boneCurrent[name] = smoothed
                controller.setBoneRotation(name, smoothed.first, smoothed.second, smoothed.third)
            }
            for (name in boneCurrent.keys.toList() - pose.bones.keys) {
                decayBone(name)
            }
        } else {
            for (name in boneCurrent.keys.toList()) {
                decayBone(name)
            }
        }
    }

    fun resetAllBones() {
        boneCurrent.clear()
        boneTarget.clear()
        controller.resetAllBones()
    }

    private fun setExpressions(names: List<String>, weight: Float) {
        for (name in names) controller.setExpression(name, weight.coerceIn(0f, 1f))
    }

    private fun decayBone(name: String) {
        val cur = boneCurrent[name] ?: return
        val decayed = Triple(
            cur.first * 0.55f,
            cur.second * 0.55f,
            cur.third * 0.55f
        )
        if (abs(decayed.first) < 0.01f && abs(decayed.second) < 0.01f && abs(decayed.third) < 0.01f) {
            boneCurrent.remove(name)
        } else {
            boneCurrent[name] = decayed
        }
        controller.setBoneRotation(name, decayed.first, decayed.second, decayed.third)
    }

    private fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t
}
