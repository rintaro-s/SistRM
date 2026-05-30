package com.sisterm.vrm.loader

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.float
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.floatOrNull
import kotlinx.serialization.json.contentOrNull

// ==================== VRM 0.0 Extension ====================

@Serializable
 data class Vrm0Meta(
    val title: String = "",
    val version: String = "",
    val author: String = "",
    val contactInformation: String = "",
    val reference: String = "",
    val texture: Int = -1,
    val allowedUserName: String = "OnlyAuthor",
    val violentUssageName: String = "Disallow",
    val sexualUssageName: String = "Disallow",
    val commercialUssageName: String = "Disallow",
    val otherPermissionUrl: String = "",
    val licenseName: String = "Redistribution_Prohibited",
    val otherLicenseUrl: String = ""
)

@Serializable
 data class Vrm0HumanoidBone(
    val bone: String,
    val node: Int,
    val useDefaultValues: Boolean = true
)

@Serializable
 data class Vrm0Humanoid(
    val humanBones: List<Vrm0HumanoidBone>,
    val armStretch: Float = 0.05f,
    val legStretch: Float = 0.05f,
    val upperArmTwist: Float = 0.5f,
    val lowerArmTwist: Float = 0.5f,
    val upperLegTwist: Float = 0.5f,
    val lowerLegTwist: Float = 0.5f,
    val feetSpacing: Float = 0f,
    val hasTranslationDoF: Boolean = false
)

@Serializable
 data class Vrm0BlendShapeBind(
    val mesh: Int,
    val index: Int,
    val weight: Float
)

@Serializable
 data class Vrm0BlendShapeMaterialBind(
    val materialName: String,
    val propertyName: String,
    val targetValue: List<Float>
)

@Serializable
 data class Vrm0BlendShapeGroup(
    val name: String,
    val presetName: String = "unknown",
    val binds: List<Vrm0BlendShapeBind> = emptyList(),
    val materialValues: List<Vrm0BlendShapeMaterialBind> = emptyList(),
    val isBinary: Boolean = false
)

@Serializable
 data class Vrm0BlendShapeMaster(
    val blendShapeGroups: List<Vrm0BlendShapeGroup> = emptyList()
)

@Serializable
 data class Vrm0FirstPersonMeshAnnotation(
    val mesh: Int,
    val firstPersonFlag: String = "Auto"
)

@Serializable
 data class Vrm0FirstPerson(
    val firstPersonBone: Int = -1,
    val firstPersonBoneOffset: List<Float> = listOf(0f, 0f, 0f),
    val meshAnnotations: List<Vrm0FirstPersonMeshAnnotation> = emptyList(),
    val lookAtTypeName: String = "Bone",
    val lookAtHorizontalInner: Vrm0LookAtCurve? = null,
    val lookAtHorizontalOuter: Vrm0LookAtCurve? = null,
    val lookAtVerticalDown: Vrm0LookAtCurve? = null,
    val lookAtVerticalUp: Vrm0LookAtCurve? = null
)

@Serializable
 data class Vrm0LookAtCurve(
    val curve: List<Float> = listOf(0f, 0f, 0f, 1f, 1f, 1f),
    val xRange: Float = 90f,
    val yRange: Float = 10f
)

@Serializable
 data class Vrm0SpringBoneCollider(
    val offset: List<Float> = listOf(0f, 0f, 0f),
    val radius: Float = 0f
)

@Serializable
 data class Vrm0SpringBoneColliderGroup(
    val node: Int,
    val colliders: List<Vrm0SpringBoneCollider> = emptyList()
)

@Serializable
 data class Vrm0SpringBoneJoint(
    val boneIndex: Int = -1,
    val hitRadius: Float = 0.02f,
    val stiffnessForce: Float = 1.0f,
    val gravityDir: List<Float> = listOf(0f, -1f, 0f),
    val gravityPower: Float = 0f,
    val dragForce: Float = 0.4f
)

@Serializable
 data class Vrm0SpringBone(
    val comment: String = "",
    val stiffiness: Float = 1.0f,
    val gravityPower: Float = 0f,
    val gravityDir: List<Float> = listOf(0f, -1f, 0f),
    val dragForce: Float = 0.4f,
    val hitRadius: Float = 0.02f,
    val bones: List<Int> = emptyList(),
    val colliderGroups: List<Int> = emptyList(),
    val joints: List<Vrm0SpringBoneJoint> = emptyList()
)

@Serializable
 data class Vrm0MaterialProperty(
    val name: String = "",
    val shader: String = "",
    val renderQueue: Int = -1,
    val floatProperties: Map<String, Float> = emptyMap(),
    val vectorProperties: Map<String, List<Float>> = emptyMap(),
    val textureProperties: Map<String, Int> = emptyMap(),
    val keywordMap: Map<String, Boolean> = emptyMap(),
    val tagMap: Map<String, String> = emptyMap()
)

@Serializable
 data class Vrm0Extension(
    val exporterVersion: String = "",
    val specVersion: String = "0.0",
    val meta: Vrm0Meta = Vrm0Meta(),
    val humanoid: Vrm0Humanoid = Vrm0Humanoid(emptyList()),
    val blendShapeMaster: Vrm0BlendShapeMaster = Vrm0BlendShapeMaster(),
    val firstPerson: Vrm0FirstPerson = Vrm0FirstPerson(),
    val springBone: List<Vrm0SpringBone> = emptyList(),
    val materialProperties: List<Vrm0MaterialProperty> = emptyList()
)

// ==================== VRM 1.0 Extensions ====================

@Serializable
 data class Vrm1Meta(
    val name: String = "",
    val version: String = "",
    val authors: List<String> = emptyList(),
    val copyrightInformation: String? = null,
    val contactInformation: String? = null,
    val references: List<String> = emptyList(),
    val thirdPartyLicenses: String? = null,
    val thumbnailImage: Int? = null,
    val licenseUrl: String = "",
    val avatarPermission: String = "onlyAuthor",
    val allowExcessivelyViolentUsage: Boolean? = null,
    val allowExcessivelySexualUsage: Boolean? = null,
    val commercialUsage: String? = null,
    val allowPoliticalOrReligiousUsage: Boolean? = null,
    val allowAntisocialOrHateUsage: Boolean? = null,
    val creditNotation: String? = null,
    val allowRedistribution: Boolean? = null,
    val modification: String? = null,
    val otherLicenseUrl: String? = null
)

@Serializable
 data class Vrm1HumanoidBone(
    val bone: String,
    val node: Int,
    val useFirstPersonBone: Boolean = true
)

@Serializable
 data class Vrm1Humanoid(
    val humanBones: List<Vrm1HumanoidBone> = emptyList()
)

@Serializable
 data class Vrm1ExpressionMorphTargetBind(
    val node: Int,
    val index: Int = 0,
    val weight: Float = 0f
)

@Serializable
 data class Vrm1ExpressionMaterialColorBind(
    val material: Int,
    val type: String,
    val targetValue: List<Float> = emptyList()
)

@Serializable
 data class Vrm1ExpressionTextureTransformBind(
    val material: Int,
    val scale: List<Float> = listOf(1f, 1f),
    val offset: List<Float> = listOf(0f, 0f)
)

@Serializable
 data class Vrm1Expression(
    val morphTargetBinds: List<Vrm1ExpressionMorphTargetBind> = emptyList(),
    val materialColorBinds: List<Vrm1ExpressionMaterialColorBind> = emptyList(),
    val textureTransformBinds: List<Vrm1ExpressionTextureTransformBind> = emptyList(),
    val isBinary: Boolean = false,
    val overrideBlink: String = "none",
    val overrideLookAt: String = "none",
    val overrideMouth: String = "none"
)

@Serializable
 data class Vrm1Expressions(
    val preset: Map<String, Vrm1Expression> = emptyMap(),
    val custom: Map<String, Vrm1Expression> = emptyMap()
)

@Serializable
 data class Vrm1LookAtRangeMap(
    val inputMaxValue: Float = 90f,
    val outputScale: Float = 1.0f
)

@Serializable
 data class Vrm1LookAt(
    val type: String = "bone",
    val offsetFromHeadBone: List<Float> = listOf(0f, 0f, 0f),
    val rangeMapHorizontalInner: Vrm1LookAtRangeMap = Vrm1LookAtRangeMap(),
    val rangeMapHorizontalOuter: Vrm1LookAtRangeMap = Vrm1LookAtRangeMap(),
    val rangeMapVerticalDown: Vrm1LookAtRangeMap = Vrm1LookAtRangeMap(),
    val rangeMapVerticalUp: Vrm1LookAtRangeMap = Vrm1LookAtRangeMap()
)

@Serializable
 data class Vrm1FirstPersonMeshAnnotation(
    val node: Int,
    val type: String = "auto"
)

@Serializable
 data class Vrm1FirstPerson(
    val meshAnnotations: List<Vrm1FirstPersonMeshAnnotation> = emptyList()
)

@Serializable
 data class Vrm1Vrm(
    val specVersion: String = "1.0",
    val meta: Vrm1Meta = Vrm1Meta(),
    val humanoid: Vrm1Humanoid = Vrm1Humanoid(),
    val expressions: Vrm1Expressions = Vrm1Expressions(),
    val lookAt: Vrm1LookAt = Vrm1LookAt(),
    val firstPerson: Vrm1FirstPerson = Vrm1FirstPerson()
)

// VRMC_springBone

@Serializable
 data class Vrm1SpringBoneColliderShapeSphere(
    val offset: List<Float> = listOf(0f, 0f, 0f),
    val radius: Float = 0f
)

@Serializable
 data class Vrm1SpringBoneColliderShapeCapsule(
    val offset: List<Float> = listOf(0f, 0f, 0f),
    val radius: Float = 0f,
    val tail: List<Float> = listOf(0f, 0f, 0f)
)

@Serializable
 data class Vrm1SpringBoneColliderShape(
    val sphere: Vrm1SpringBoneColliderShapeSphere? = null,
    val capsule: Vrm1SpringBoneColliderShapeCapsule? = null
)

@Serializable
 data class Vrm1SpringBoneCollider(
    val node: Int,
    val shape: Vrm1SpringBoneColliderShape = Vrm1SpringBoneColliderShape()
)

@Serializable
 data class Vrm1SpringBoneColliderGroup(
    val colliders: List<Int> = emptyList()
)

@Serializable
 data class Vrm1SpringBoneJoint(
    val node: Int,
    val hitRadius: Float = 0f,
    val stiffness: Float = 1.0f,
    val gravityPower: Float = 0f,
    val gravityDir: List<Float> = listOf(0f, -1f, 0f),
    val dragForce: Float = 0f
)

@Serializable
 data class Vrm1SpringBoneSpring(
    val joints: List<Vrm1SpringBoneJoint> = emptyList(),
    val colliders: List<Int> = emptyList(),
    val center: Int? = null
)

@Serializable
 data class Vrm1SpringBone(
    val specVersion: String = "1.0",
    val colliders: List<Vrm1SpringBoneCollider> = emptyList(),
    val colliderGroups: List<Vrm1SpringBoneColliderGroup> = emptyList(),
    val springs: List<Vrm1SpringBoneSpring> = emptyList()
)

// VRMC_nodeConstraint

@Serializable
 data class Vrm1RollConstraint(
    val source: Int,
    val rollAxis: String = "X",
    val weight: Float = 1.0f
)

@Serializable
 data class Vrm1AimConstraint(
    val source: Int,
    val aimAxis: String = "PositiveY",
    val weight: Float = 1.0f
)

@Serializable
 data class Vrm1RotationConstraint(
    val source: Int,
    val weight: Float = 1.0f
)

@Serializable
 data class Vrm1NodeConstraint(
    val roll: Vrm1RollConstraint? = null,
    val aim: Vrm1AimConstraint? = null,
    val rotation: Vrm1RotationConstraint? = null
)

@Serializable
 data class Vrm1NodeConstraintExtension(
    val specVersion: String = "1.0",
    val constraint: Vrm1NodeConstraint = Vrm1NodeConstraint()
)

// VRMC_materials_mtoon

@Serializable
 data class Vrm1MToonTextureInfo(
    val index: Int,
    val texCoord: Int = 0
)

@Serializable
 data class Vrm1MToonShadingShiftTexture(
    val index: Int,
    val texCoord: Int = 0,
    val scale: Float = 1.0f
)

@Serializable
 data class Vrm1MToon(
    val specVersion: String = "1.0",
    val transparentWithZWrite: Boolean = false,
    val renderQueueOffsetNumber: Int = 0,
    val shadeColorFactor: List<Float> = listOf(0f, 0f, 0f),
    val shadeMultiplyTexture: Vrm1MToonTextureInfo? = null,
    val shadingShiftFactor: Float = 0f,
    val shadingShiftTexture: Vrm1MToonShadingShiftTexture? = null,
    val shadingToonyFactor: Float = 0.9f,
    val giEqualizationFactor: Float = 0.9f,
    val matcapFactor: List<Float> = listOf(1f, 1f, 1f),
    val matcapTexture: Vrm1MToonTextureInfo? = null,
    val parametricRimColorFactor: List<Float> = listOf(0f, 0f, 0f),
    val rimMultiplyTexture: Vrm1MToonTextureInfo? = null,
    val rimLightingMixFactor: Float = 0f,
    val parametricRimFresnelPowerFactor: Float = 1.0f,
    val parametricRimLiftFactor: Float = 0f,
    val outlineWidthMode: String = "none",
    val outlineWidthFactor: Float = 0.5f,
    val outlineWidthMultiplyTexture: Vrm1MToonTextureInfo? = null,
    val outlineColorFactor: List<Float> = listOf(0f, 0f, 0f),
    val outlineLightingMixFactor: Float = 1.0f,
    val uvAnimationMaskTexture: Vrm1MToonTextureInfo? = null,
    val uvAnimationScrollXSpeedFactor: Float = 0f,
    val uvAnimationScrollYSpeedFactor: Float = 0f,
    val uvAnimationRotationSpeedFactor: Float = 0f
)

object VrmExtensionParser {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    fun parseVrm0(extensions: JsonObject?): Vrm0Extension? {
        val vrmJson = extensions?.get("VRM") ?: return null
        return json.decodeFromJsonElement(Vrm0Extension.serializer(), vrmJson)
    }

    fun parseVrm1(extensions: JsonObject?): Vrm1Vrm? {
        val vrmJson = extensions?.get("VRMC_vrm") ?: return null
        return json.decodeFromJsonElement(Vrm1Vrm.serializer(), vrmJson)
    }

    fun parseSpringBone1(extensions: JsonObject?): Vrm1SpringBone? {
        val sbJson = extensions?.get("VRMC_springBone") ?: return null
        return json.decodeFromJsonElement(Vrm1SpringBone.serializer(), sbJson)
    }

    fun parseNodeConstraint1(extensions: JsonObject?): Vrm1NodeConstraintExtension? {
        val ncJson = extensions?.get("VRMC_nodeConstraint") ?: return null
        return json.decodeFromJsonElement(Vrm1NodeConstraintExtension.serializer(), ncJson)
    }

    fun parseMToon1(materialExtensions: JsonObject?): Vrm1MToon? {
        val mtoonJson = materialExtensions?.get("VRMC_materials_mtoon") ?: return null
        return json.decodeFromJsonElement(Vrm1MToon.serializer(), mtoonJson)
    }

    fun detectVersion(extensions: JsonObject?): VrmVersion {
        return when {
            extensions?.containsKey("VRMC_vrm") == true -> VrmVersion.VRM_1_0
            extensions?.containsKey("VRM") == true -> VrmVersion.VRM_0_0
            else -> VrmVersion.UNKNOWN
        }
    }
}

enum class VrmVersion {
    VRM_0_0,
    VRM_1_0,
    UNKNOWN
}
