package com.nbks.vrm.parser

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.decodeFromJsonElement

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
data class Vrm1HumanoidBone(val bone: String, val node: Int, val useFirstPersonBone: Boolean = true)

@Serializable
data class Vrm1Humanoid(val humanBones: List<Vrm1HumanoidBone> = emptyList())

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
data class Vrm1ExpressionMorphTargetBind(val node: Int, val index: Int = 0, val weight: Float = 0f)

@Serializable
data class Vrm1ExpressionMaterialColorBind(val material: Int, val type: String, val targetValue: List<Float> = emptyList())

@Serializable
data class Vrm1ExpressionTextureTransformBind(val material: Int, val scale: List<Float> = listOf(1f, 1f), val offset: List<Float> = listOf(0f, 0f))

@Serializable
data class Vrm1Expressions(val preset: Map<String, Vrm1Expression> = emptyMap(), val custom: Map<String, Vrm1Expression> = emptyMap())

@Serializable
data class Vrm1LookAtRangeMap(val inputMaxValue: Float = 90f, val outputScale: Float = 1.0f)

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
data class Vrm1FirstPersonMeshAnnotation(val node: Int, val type: String = "auto")

@Serializable
data class Vrm1FirstPerson(val meshAnnotations: List<Vrm1FirstPersonMeshAnnotation> = emptyList())

@Serializable
data class Vrm1Vrm(
    val specVersion: String = "1.0",
    val meta: Vrm1Meta = Vrm1Meta(),
    val humanoid: Vrm1Humanoid = Vrm1Humanoid(),
    val expressions: Vrm1Expressions = Vrm1Expressions(),
    val lookAt: Vrm1LookAt = Vrm1LookAt(),
    val firstPerson: Vrm1FirstPerson = Vrm1FirstPerson()
)

@Serializable
data class Vrm0Meta(
    val title: String = "",
    val version: String = "",
    val author: String = "",
    val contactInformation: String = "",
    val reference: String = "",
    val allowedUserName: String = "OnlyAuthor",
    val violentUssageName: String = "Disallow",
    val sexualUssageName: String = "Disallow",
    val commercialUssageName: String = "Disallow",
    val licenseName: String = "Redistribution_Prohibited"
)

@Serializable
data class Vrm0HumanoidBone(val bone: String, val node: Int, val useDefaultValues: Boolean = true)

@Serializable
data class Vrm0Humanoid(val humanBones: List<Vrm0HumanoidBone> = emptyList())

@Serializable
data class Vrm0BlendShapeBind(val mesh: Int, val index: Int, val weight: Float)

@Serializable
data class Vrm0BlendShapeGroup(
    val name: String,
    val presetName: String = "unknown",
    val binds: List<Vrm0BlendShapeBind> = emptyList(),
    val isBinary: Boolean = false
)

@Serializable
data class Vrm0BlendShapeMaster(val blendShapeGroups: List<Vrm0BlendShapeGroup> = emptyList())

@Serializable
data class Vrm0FirstPerson(
    val firstPersonBone: Int = -1,
    val firstPersonBoneOffset: List<Float> = listOf(0f, 0f, 0f),
    val lookAtTypeName: String = "Bone"
)

@Serializable
data class Vrm0Extension(
    val exporterVersion: String = "",
    val specVersion: String = "0.0",
    val meta: Vrm0Meta = Vrm0Meta(),
    val humanoid: Vrm0Humanoid = Vrm0Humanoid(emptyList()),
    val blendShapeMaster: Vrm0BlendShapeMaster = Vrm0BlendShapeMaster(),
    val firstPerson: Vrm0FirstPerson = Vrm0FirstPerson()
)

enum class VrmVersion { VRM_0_0, VRM_1_0, UNKNOWN }

object VrmExtensionParser {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    fun parseVrm0(extensions: JsonObject?): Vrm0Extension? {
        val vrmJson = extensions?.get("VRM") ?: return null
        return json.decodeFromJsonElement(Vrm0Extension.serializer(), vrmJson)
    }

    fun parseVrm1(extensions: JsonObject?): Vrm1Vrm? {
        val vrmJson = extensions?.get("VRMC_vrm") ?: return null
        return json.decodeFromJsonElement(Vrm1Vrm.serializer(), vrmJson)
    }

    fun detectVersion(extensions: JsonObject?): VrmVersion = when {
        extensions?.containsKey("VRMC_vrm") == true -> VrmVersion.VRM_1_0
        extensions?.containsKey("VRM") == true -> VrmVersion.VRM_0_0
        else -> VrmVersion.UNKNOWN
    }
}
