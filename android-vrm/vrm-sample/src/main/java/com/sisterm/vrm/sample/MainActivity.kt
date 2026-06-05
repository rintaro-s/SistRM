package com.sisterm.vrm.sample

import android.app.Activity
import android.os.Bundle
import android.view.SurfaceView
import android.view.ViewGroup
import com.sisterm.vrm.filament.VRMFilamentController

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val surfaceView = SurfaceView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }
        setContentView(surfaceView)

        // Example: Load and control a VRM
        val controller = VRMFilamentController(surfaceView, assets)

        // List available expressions and bones after loading
        controller.loadVrm("avatar.vrm")

        // In a real app, wait for load completion then control the VRM:
        // controller.setExpression("happy", 0.8f)
        // controller.setBoneRotation("head", 0.2f, 0.1f, 0f)
        // controller.firstPersonEnabled = true
    }
}
