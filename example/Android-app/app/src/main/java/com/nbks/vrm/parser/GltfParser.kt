package com.nbks.vrm.parser

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject

@Serializable
data class GltfAsset(val generator: String? = null, val version: String = "2.0")

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
data class GltfScene(val nodes: List<Int> = emptyList(), val name: String? = null)

@Serializable
data class GltfMesh(val primitives: List<GltfPrimitive> = emptyList(), val weights: List<Float>? = null, val name: String? = null)

@Serializable
data class GltfPrimitive(
    val attributes: Map<String, Int>,
    val indices: Int? = null,
    val material: Int? = null,
    val mode: Int = 4,
    val targets: List<Map<String, Int>>? = null,
    val extensions: JsonObject? = null
)

@Serializable
data class GltfMaterial(
    val name: String? = null,
    val pbrMetallicRoughness: GltfPbrMetallicRoughness? = null,
    val extensions: JsonObject? = null
)

@Serializable
data class GltfPbrMetallicRoughness(
    val baseColorFactor: List<Float> = listOf(1f, 1f, 1f, 1f),
    val metallicFactor: Float = 1f,
    val roughnessFactor: Float = 1f
)

@Serializable
data class GltfBuffer(val uri: String? = null, val byteLength: Int, val name: String? = null)

@Serializable
data class GltfBufferView(val buffer: Int, val byteOffset: Int = 0, val byteLength: Int, val byteStride: Int? = null)

@Serializable
data class GltfAccessor(
    val bufferView: Int? = null, val byteOffset: Int = 0, val componentType: Int,
    val normalized: Boolean = false, val count: Int, val type: String,
    val max: List<Float>? = null, val min: List<Float>? = null
)

@Serializable
data class GltfSkin(val inverseBindMatrices: Int? = null, val skeleton: Int? = null, val joints: List<Int>, val name: String? = null)

@Serializable
data class GltfAnimation(
    val channels: List<GltfAnimationChannel> = emptyList(),
    val samplers: List<GltfAnimationSampler> = emptyList(),
    val name: String? = null
)

@Serializable
data class GltfAnimationChannel(val sampler: Int, val target: GltfAnimationChannelTarget)

@Serializable
data class GltfAnimationChannelTarget(val node: Int? = null, val path: String)

@Serializable
data class GltfAnimationSampler(val input: Int, val interpolation: String = "LINEAR", val output: Int)

@Serializable
data class GltfTexture(val sampler: Int? = null, val source: Int? = null, val name: String? = null)

@Serializable
data class GltfImage(val uri: String? = null, val mimeType: String? = null, val bufferView: Int? = null, val name: String? = null)

@Serializable
data class GltfSampler(
    val magFilter: Int? = null, val minFilter: Int? = null,
    val wrapS: Int = 10497, val wrapT: Int = 10497, val name: String? = null
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
    val extensions: JsonObject? = null
)

object GltfParser {
    private val json = Json { ignoreUnknownKeys = true; isLenient = true }
    fun parse(jsonString: String): GltfRoot = json.decodeFromString(GltfRoot.serializer(), jsonString)
    fun getExtension(root: GltfRoot, name: String): JsonObject? = root.extensions?.get(name)?.let { it as? JsonObject }
}
