package com.sisterm.vrm.sample

import android.app.Activity
import android.os.Bundle
import com.sisterm.vrm.core.VRMInstance
import com.sisterm.vrm.core.VRMHumanoid
import com.sisterm.vrm.core.HumanoidBoneName
import com.sisterm.vrm.network.VRMNetworkClient

/**
 * Sample Activity demonstrating VRM integration on Android.
 *
 * In a real app, you would:
 * 1. Set up a Filament Engine, Renderer, and SwapChain
 * 2. Load a VRM file using GltfParser and VrmData
 * 3. Build the VRMInstance with humanoid, expressions, spring bones, etc.
 * 4. Connect to vrm-server for multiplayer sync
 * 5. Call vrmInstance.update(delta) each frame
 */
class MainActivity : Activity() {

    private var vrmInstance: VRMInstance? = null
    private var networkClient: VRMNetworkClient? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // TODO: Initialize Filament Engine and load VRM model
        // TODO: Build VRMInstance from parsed VrmData

        // Example network setup
        networkClient = VRMNetworkClient().apply {
            connect("ws://10.0.2.2:8080/ws")
            joinRoom("lobby", "android-user-1", "")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        networkClient?.disconnect()
        // TODO: Dispose Filament resources
    }

    private fun onFrame(delta: Float) {
        vrmInstance?.update(delta)

        // Example: wave hand
        vrmInstance?.humanoid?.getBone(HumanoidBoneName.LEFT_UPPER_ARM)?.let { bone ->
            bone.rotation.setFromAxisAngle(
                com.sisterm.vrm.core.math.Vector3(0f, 0f, 1f),
                kotlin.math.sin(System.currentTimeMillis() * 0.002f) * 0.5f
            )
        }

        // Example: smile
        vrmInstance?.expressions?.setValue("happy", 0.8f)
    }
}
