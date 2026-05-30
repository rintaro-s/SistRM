package com.nbks.vrm.parser

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Extracts the JSON chunk from a binary GLB file.
 *
 * GLB format:
 *   - Header (12 bytes): magic "glTF" (4), version (4), length (4)
 *   - Chunk 0 (JSON): chunkLength (4), chunkType "JSON" (4), data (chunkLength)
 *   - Chunk 1 (BIN):  chunkLength (4), chunkType "BIN\0" (4), data (chunkLength)
 */
object GlbExtractor {

    private const val MAGIC_GLTF = 0x46546C67
    private const val CHUNK_TYPE_JSON = 0x4E4F534A

    fun extractJson(glbBytes: ByteArray): String? {
        if (glbBytes.size < 20) return null

        val buffer = ByteBuffer.wrap(glbBytes).order(ByteOrder.LITTLE_ENDIAN)

        val magic = buffer.int
        if (magic != MAGIC_GLTF) return null

        val version = buffer.int
        if (version != 2) {
            // Version 1 is also common; attempt anyway
        }

        val length = buffer.int
        if (length != glbBytes.size) {
            // Some files may have trailing data; continue if header is valid
        }

        val chunkLength = buffer.int
        val chunkType = buffer.int

        if (chunkType != CHUNK_TYPE_JSON) return null
        if (buffer.position() + chunkLength > glbBytes.size) return null

        val jsonBytes = ByteArray(chunkLength)
        buffer.get(jsonBytes)
        return jsonBytes.decodeToString()
    }

    fun isGlb(bytes: ByteArray): Boolean {
        if (bytes.size < 4) return false
        val magic = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).int
        return magic == MAGIC_GLTF
    }
}
