package com.sisterm.vrm.material

import com.sisterm.vrm.loader.*

enum class MToonRenderMode {
    OPAQUE, CUTOUT, TRANSPARENT
}

enum class MToonOutlineMode {
    NONE, WORLD_COORDINATES, SCREEN_COORDINATES
}

data class MToonMaterial(
    val name: String = "",
    val renderMode: MToonRenderMode = MToonRenderMode.OPAQUE,
    val cullBackface: Boolean = true,
    val renderQueueOffset: Int = 0,
    val transparentWithZWrite: Boolean = false,

    val color: FloatArray = floatArrayOf(1f, 1f, 1f, 1f),
    val shadeColor: FloatArray = floatArrayOf(0f, 0f, 0f, 1f),
    val mainTexture: Int = -1,
    val shadeMultiplyTexture: Int = -1,

    val shadingShiftFactor: Float = 0f,
    val shadingShiftTexture: Int = -1,
    val shadingShiftTextureScale: Float = 1.0f,
    val shadingToonyFactor: Float = 0.9f,
    val giEqualizationFactor: Float = 0.9f,

    val matcapColor: FloatArray = floatArrayOf(1f, 1f, 1f, 1f),
    val matcapTexture: Int = -1,

    val parametricRimColor: FloatArray = floatArrayOf(0f, 0f, 0f, 1f),
    val rimMultiplyTexture: Int = -1,
    val rimLightingMixFactor: Float = 0f,
    val parametricRimFresnelPower: Float = 1.0f,
    val parametricRimLift: Float = 0f,

    val outlineMode: MToonOutlineMode = MToonOutlineMode.NONE,
    val outlineWidthFactor: Float = 0.5f,
    val outlineWidthTexture: Int = -1,
    val outlineColor: FloatArray = floatArrayOf(0f, 0f, 0f, 1f),
    val outlineLightingMixFactor: Float = 1.0f,

    val uvAnimationMaskTexture: Int = -1,
    val uvAnimationScrollXSpeed: Float = 0f,
    val uvAnimationScrollYSpeed: Float = 0f,
    val uvAnimationRotationSpeed: Float = 0f,

    val emissionColor: FloatArray = floatArrayOf(0f, 0f, 0f, 1f),
    val emissionMultiplier: Float = 1.0f,
    val emissionTexture: Int = -1,

    val normalTexture: Int = -1,
    val normalScale: Float = 1.0f,

    val receiveShadowTexture: Int = -1,
    val receiveShadowRate: Float = 1.0f,
    val shadingGradeTexture: Int = -1,
    val shadingGradeRate: Float = 1.0f
) {
    companion object {
        fun fromVrm1(mtoon: Vrm1MToon): MToonMaterial {
            val renderMode = when {
                mtoon.transparentWithZWrite -> MToonRenderMode.TRANSPARENT
                else -> MToonRenderMode.OPAQUE
            }
            val outlineMode = when (mtoon.outlineWidthMode) {
                "worldCoordinates" -> MToonOutlineMode.WORLD_COORDINATES
                "screenCoordinates" -> MToonOutlineMode.SCREEN_COORDINATES
                else -> MToonOutlineMode.NONE
            }
            return MToonMaterial(
                name = "",
                renderMode = renderMode,
                renderQueueOffset = mtoon.renderQueueOffsetNumber,
                transparentWithZWrite = mtoon.transparentWithZWrite,
                shadeColor = floatArrayOf(
                    mtoon.shadeColorFactor[0],
                    mtoon.shadeColorFactor[1],
                    mtoon.shadeColorFactor[2],
                    1f
                ),
                shadeMultiplyTexture = mtoon.shadeMultiplyTexture?.index ?: -1,
                shadingShiftFactor = mtoon.shadingShiftFactor,
                shadingShiftTexture = mtoon.shadingShiftTexture?.index ?: -1,
                shadingShiftTextureScale = mtoon.shadingShiftTexture?.scale ?: 1.0f,
                shadingToonyFactor = mtoon.shadingToonyFactor,
                giEqualizationFactor = mtoon.giEqualizationFactor,
                matcapColor = floatArrayOf(
                    mtoon.matcapFactor[0],
                    mtoon.matcapFactor[1],
                    mtoon.matcapFactor[2],
                    1f
                ),
                matcapTexture = mtoon.matcapTexture?.index ?: -1,
                parametricRimColor = floatArrayOf(
                    mtoon.parametricRimColorFactor[0],
                    mtoon.parametricRimColorFactor[1],
                    mtoon.parametricRimColorFactor[2],
                    1f
                ),
                rimMultiplyTexture = mtoon.rimMultiplyTexture?.index ?: -1,
                rimLightingMixFactor = mtoon.rimLightingMixFactor,
                parametricRimFresnelPower = mtoon.parametricRimFresnelPowerFactor,
                parametricRimLift = mtoon.parametricRimLiftFactor,
                outlineMode = outlineMode,
                outlineWidthFactor = mtoon.outlineWidthFactor,
                outlineWidthTexture = mtoon.outlineWidthMultiplyTexture?.index ?: -1,
                outlineColor = floatArrayOf(
                    mtoon.outlineColorFactor[0],
                    mtoon.outlineColorFactor[1],
                    mtoon.outlineColorFactor[2],
                    1f
                ),
                outlineLightingMixFactor = mtoon.outlineLightingMixFactor,
                uvAnimationMaskTexture = mtoon.uvAnimationMaskTexture?.index ?: -1,
                uvAnimationScrollXSpeed = mtoon.uvAnimationScrollXSpeedFactor,
                uvAnimationScrollYSpeed = mtoon.uvAnimationScrollYSpeedFactor,
                uvAnimationRotationSpeed = mtoon.uvAnimationRotationSpeedFactor
            )
        }
    }
}

class MToonMaterialStore {
    val materials = mutableMapOf<Int, MToonMaterial>()

    fun loadFromVrm1(mtoonMap: Map<Int, Vrm1MToon>) {
        materials.clear()
        for ((idx, mtoon) in mtoonMap) {
            materials[idx] = MToonMaterial.fromVrm1(mtoon)
        }
    }

    fun getMaterial(index: Int): MToonMaterial? = materials[index]

    fun getMaterialCount(): Int = materials.size
}
