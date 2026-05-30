package com.nbks.vrm.parser

import kotlinx.serialization.json.JsonObject

data class VrmData(
    val gltf: GltfRoot,
    val version: VrmVersion,
    val vrm0: Vrm0Extension? = null,
    val vrm1: Vrm1Vrm? = null
) {
    companion object {
        fun fromGltf(gltf: GltfRoot): VrmData {
            val version = VrmExtensionParser.detectVersion(gltf.extensions)
            val vrm0 = VrmExtensionParser.parseVrm0(gltf.extensions)
            val vrm1 = VrmExtensionParser.parseVrm1(gltf.extensions)
            return VrmData(gltf = gltf, version = version, vrm0 = vrm0, vrm1 = vrm1)
        }
    }

    val expressionNames: List<String>
        get() = when (version) {
            VrmVersion.VRM_1_0 -> vrm1?.expressions?.preset?.keys?.toList() ?: emptyList()
            VrmVersion.VRM_0_0 -> vrm0?.blendShapeMaster?.blendShapeGroups?.map { it.presetName } ?: emptyList()
            VrmVersion.UNKNOWN -> emptyList()
        }

    val humanoidBoneNames: List<String>
        get() = when (version) {
            VrmVersion.VRM_1_0 -> vrm1?.humanoid?.humanBones?.map { it.bone } ?: emptyList()
            VrmVersion.VRM_0_0 -> vrm0?.humanoid?.humanBones?.map { it.bone } ?: emptyList()
            VrmVersion.UNKNOWN -> emptyList()
        }

    val metaTitle: String
        get() = when (version) {
            VrmVersion.VRM_1_0 -> vrm1?.meta?.name ?: ""
            VrmVersion.VRM_0_0 -> vrm0?.meta?.title ?: ""
            VrmVersion.UNKNOWN -> ""
        }

    val metaAuthor: String
        get() = when (version) {
            VrmVersion.VRM_1_0 -> vrm1?.meta?.authors?.firstOrNull() ?: ""
            VrmVersion.VRM_0_0 -> vrm0?.meta?.author ?: ""
            VrmVersion.UNKNOWN -> ""
        }
}
