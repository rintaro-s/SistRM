package com.sisterm.vrm.loader

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Extracts the JSON chunk from a binary GLB file.
 */
object GlbExtractor {
    private const val GLB_MAGIC = 0x46546C67 // "glTF"
    private const val GLB_VERSION = 2
    private const val CHUNK_TYPE_JSON = 0x4E4F534A // "JSON"

    fun extractJson(bytes: ByteArray): String? {
        if (!isGlb(bytes)) return null

        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)

        // Skip magic (4) + version (4) + totalLength (4)
        buffer.position(12)

        // Read first chunk
        val chunkLength = buffer.int
        val chunkType = buffer.int

        if (chunkType != CHUNK_TYPE_JSON) return null

        val jsonBytes = ByteArray(chunkLength)
        buffer.get(jsonBytes)
        return String(jsonBytes, Charsets.UTF_8)
    }

    fun isGlb(bytes: ByteArray): Boolean {
        if (bytes.size < 12) return false
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN)
        val magic = buffer.int
        val version = buffer.int
        return magic == GLB_MAGIC && version == GLB_VERSION
    }
}
