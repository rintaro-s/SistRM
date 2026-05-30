package com.sisterm.vrm.loader

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject

@Serializable
 data class GltfAsset(
    val generator: String? = null,
    val version: String = "2.0"
)

@Serializable
 data class GltfAccessor(
    val bufferView: Int? = null,
    val byteOffset: Int = 0,
    val componentType: Int,
    val normalized: Boolean = false,
    val count: Int,
    val type: String,
    val max: List<Float>? = null,
    val min: List<Float>? = null,
    val sparse: GltfSparse? = null,
    val name: String? = null
)

@Serializable
 data class GltfSparse(
    val count: Int,
    val indices: GltfSparseIndices,
    val values: GltfSparseValues
)

@Serializable
 data class GltfSparseIndices(
    val bufferView: Int,
    val byteOffset: Int = 0,
    val componentType: Int
)

@Serializable
 data class GltfSparseValues(
    val bufferView: Int,
    val byteOffset: Int = 0
)

@Serializable
 data class GltfAnimation(
    val channels: List<GltfAnimationChannel>,
    val samplers: List<GltfAnimationSampler>,
    val name: String? = null
)

@Serializable
 data class GltfAnimationChannel(
    val sampler: Int,
    val target: GltfAnimationChannelTarget
)

@Serializable
 data class GltfAnimationChannelTarget(
    val node: Int? = null,
    val path: String
)

@Serializable
 data class GltfAnimationSampler(
    val input: Int,
    val interpolation: String = "LINEAR",
    val output: Int
)

@Serializable
 data class GltfBuffer(
    val uri: String? = null,
    val byteLength: Int,
    val name: String? = null
)

@Serializable
 data class GltfBufferView(
    val buffer: Int,
    val byteOffset: Int = 0,
    val byteLength: Int,
    val byteStride: Int? = null,
    val target: Int? = null,
    val name: String? = null
)

@Serializable
 data class GltfCamera(
    val orthographic: GltfCameraOrthographic? = null,
    val perspective: GltfCameraPerspective? = null,
    val type: String,
    val name: String? = null
)

@Serializable
 data class GltfCameraOrthographic(
    val xmag: Float,
    val ymag: Float,
    val znear: Float,
    val zfar: Float
)

@Serializable
 data class GltfCameraPerspective(
    val aspectRatio: Float? = null,
    val yfov: Float,
    val znear: Float,
    val zfar: Float? = null
)

@Serializable
 data class GltfImage(
    val uri: String? = null,
    val mimeType: String? = null,
    val bufferView: Int? = null,
    val name: String? = null
)

@Serializable
 data class GltfMaterial(
    val name: String? = null,
    val pbrMetallicRoughness: GltfPbrMetallicRoughness? = null,
    val normalTexture: GltfNormalTextureInfo? = null,
    val occlusionTexture: GltfOcclusionTextureInfo? = null,
    val emissiveTexture: GltfTextureInfo? = null,
    val emissiveFactor: List<Float> = listOf(0f, 0f, 0f),
    val alphaMode: String = "OPAQUE",
    val alphaCutoff: Float = 0.5f,
    val doubleSided: Boolean = false,
    val extensions: JsonObject? = null,
    val extras: JsonObject? = null
)

@Serializable
 data class GltfPbrMetallicRoughness(
    val baseColorFactor: List<Float> = listOf(1f, 1f, 1f, 1f),
    val baseColorTexture: GltfTextureInfo? = null,
    val metallicFactor: Float = 1f,
    val roughnessFactor: Float = 1f,
    val metallicRoughnessTexture: GltfTextureInfo? = null
)

@Serializable
 data class GltfTextureInfo(
    val index: Int,
    val texCoord: Int = 0,
    val extensions: JsonObject? = null,
    val extras: JsonObject? = null
)

@Serializable
 data class GltfNormalTextureInfo(
    val index: Int,
    val texCoord: Int = 0,
    val scale: Float = 1f,
    val extensions: JsonObject? = null,
    val extras: JsonObject? = null
)

@Serializable
 data class GltfOcclusionTextureInfo(
    val index: Int,
    val texCoord: Int = 0,
    val strength: Float = 1f,
    val extensions: JsonObject? = null,
    val extras: JsonObject? = null
)

@Serializable
 data class GltfMesh(
    val primitives: List<GltfPrimitive>,
    val weights: List<Float>? = null,
    val name: String? = null
)

@Serializable
 data class GltfPrimitive(
    val attributes: Map<String, Int>,
    val indices: Int? = null,
    val material: Int? = null,
    val mode: Int = 4,
    val targets: List<Map<String, Int>>? = null,
    val extensions: JsonObject? = null,
    val extras: JsonObject? = null
)

@Serializable
 data class GltfNode(
    val camera: Int? = null,
    val children: List<Int> = emptyList(),
    val skin: Int? = null,
    val matrix: List<Float>? = null,
    val mesh: Int? = null,
    val rotation: List<Float> = listOf(0f, 0f, 0f, 1f),
    val scale: List<Float> = listOf(1f, 1f, 1f),
    val translation: List<Float> = listOf(0f, 0f, 0f),
    val weights: List<Float>? = null,
    val name: String? = null,
    val extensions: JsonObject? = null,
    val extras: JsonObject? = null
)

@Serializable
 data class GltfSampler(
    val magFilter: Int? = null,
    val minFilter: Int? = null,
    val wrapS: Int = 10497,
    val wrapT: Int = 10497,
    val name: String? = null
)

@Serializable
 data class GltfScene(
    val nodes: List<Int> = emptyList(),
    val name: String? = null
)

@Serializable
 data class GltfSkin(
    val inverseBindMatrices: Int? = null,
    val skeleton: Int? = null,
    val joints: List<Int>,
    val name: String? = null
)

@Serializable
 data class GltfTexture(
    val sampler: Int? = null,
    val source: Int? = null,
    val name: String? = null,
    val extensions: JsonObject? = null,
    val extras: JsonObject? = null
)

@Serializable
 data class GltfRoot(
    val asset: GltfAsset = GltfAsset(),
    val scene: Int? = null,
    val scenes: List<GltfScene> = emptyList(),
    val nodes: List<GltfNode> = emptyList(),
    val meshes: List<GltfMesh> = emptyList(),
    val accessors: List<GltfAccessor> = emptyList(),
    val bufferViews: List<GltfBufferView> = emptyList(),
    val buffers: List<GltfBuffer> = emptyList(),
    val materials: List<GltfMaterial> = emptyList(),
    val textures: List<GltfTexture> = emptyList(),
    val images: List<GltfImage> = emptyList(),
    val samplers: List<GltfSampler> = emptyList(),
    val skins: List<GltfSkin> = emptyList(),
    val animations: List<GltfAnimation> = emptyList(),
    val extensions: JsonObject? = null,
    val extras: JsonObject? = null
)

object GltfParser {
    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    fun parse(jsonString: String): GltfRoot {
        return json.decodeFromString(GltfRoot.serializer(), jsonString)
    }

    fun parseExtensions(node: GltfNode): Map<String, JsonObject> {
        return node.extensions?.let { ext ->
            ext.entries.mapNotNull { (key, value) ->
                if (value is JsonObject) key to value else null
            }.toMap()
        } ?: emptyMap()
    }

    fun getExtension(root: GltfRoot, name: String): JsonObject? {
        return root.extensions?.get(name)?.jsonObject
    }
}
