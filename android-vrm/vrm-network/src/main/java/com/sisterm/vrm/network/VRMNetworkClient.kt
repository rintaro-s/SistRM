package com.sisterm.vrm.network

import com.sisterm.vrm.core.CoordinateConverter
import com.sisterm.vrm.core.math.Quaternion
import com.sisterm.vrm.core.math.Vector3
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.java_websocket.client.WebSocketClient
import org.java_websocket.handshake.ServerHandshake
import java.net.URI
import java.util.concurrent.atomic.AtomicBoolean

@Serializable
data class JoinRoomMessage(
    val type: String = "join_room",
    val room_id: String,
    val user_id: String,
    val avatar_url: String = "",
    val display_name: String = ""
)

@Serializable
data class AvatarDeltaMessage(
    val type: String = "avatar_delta",
    val user_id: String,
    val timestamp: Long,
    val transform: TransformData? = null,
    val expressions: Map<String, Float>? = null,
    val bone_rotations: Map<String, List<Float>>? = null,
    val look_at: List<Float>? = null
)

@Serializable
data class TransformData(
    val pos: List<Float>,
    val rot: List<Float>,
    val scale: List<Float>
)

@Serializable
data class RoomEventMessage(
    val type: String = "room_event",
    val room_id: String,
    val user_id: String,
    val event_type: String,
    val payload: Map<String, String> = emptyMap()
)

@Serializable
data class LeaveRoomMessage(
    val type: String = "leave_room",
    val room_id: String,
    val user_id: String
)

sealed class NetworkEvent {
    data class Connected(val handshake: ServerHandshake) : NetworkEvent()
    data class Disconnected(val code: Int, val reason: String, val remote: Boolean) : NetworkEvent()
    data class MessageReceived(val message: String) : NetworkEvent()
    data class Error(val exception: Exception) : NetworkEvent()
}

/**
 * Parsed network delta with platform-native coordinates.
 * Position/rotation are already converted from SSCS to the local coordinate system.
 */
data class ParsedDelta(
    val userId: String,
    val timestamp: Long,
    val position: Vector3,
    val rotation: Quaternion,
    val scale: Vector3,
    val expressions: Map<String, Float>?,
    val lookAt: Vector3?
)

class VRMNetworkClient {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }
    private var webSocket: WebSocketClient? = null
    private val _isConnected = AtomicBoolean(false)
    private val _events = MutableSharedFlow<NetworkEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<NetworkEvent> = _events.asSharedFlow()

    val isConnected: Boolean get() = _isConnected.get()

    fun connect(url: String) {
        disconnect()
        val uri = URI.create(url)
        webSocket = object : WebSocketClient(uri) {
            override fun onOpen(handshake: ServerHandshake) {
                _isConnected.set(true)
                scope.launch { _events.emit(NetworkEvent.Connected(handshake)) }
            }

            override fun onMessage(message: String) {
                scope.launch { _events.emit(NetworkEvent.MessageReceived(message)) }
            }

            override fun onClose(code: Int, reason: String, remote: Boolean) {
                _isConnected.set(false)
                scope.launch { _events.emit(NetworkEvent.Disconnected(code, reason, remote)) }
            }

            override fun onError(ex: Exception) {
                scope.launch { _events.emit(NetworkEvent.Error(ex)) }
            }
        }
        webSocket?.connect()
    }

    fun joinRoom(roomId: String, userId: String, avatarUrl: String = "", displayName: String = "") {
        val msg = JoinRoomMessage(
            room_id = roomId,
            user_id = userId,
            avatar_url = avatarUrl,
            display_name = displayName
        )
        send(msg)
    }

    /** Send a pre-built delta message (assumes coordinates are already in SSCS). */
    fun sendDelta(delta: AvatarDeltaMessage) {
        send(delta)
    }

    /**
     * Send avatar delta from local platform coordinates.
     * Automatically converts position/rotation to SSCS before sending.
     */
    fun sendDeltaFromLocal(
        userId: String,
        position: Vector3,
        rotation: Quaternion,
        scale: Vector3 = Vector3(1f, 1f, 1f),
        expressions: Map<String, Float>? = null,
        lookAt: Vector3? = null
    ) {
        // Android/Filament is natively SSCS; conversion is identity but explicit
        val sscs = CoordinateConverter.convertTransform(
            position, rotation, scale,
            CoordinateConverter.CoordinateSystem.SSCS,
            CoordinateConverter.CoordinateSystem.SSCS
        )
        val delta = AvatarDeltaMessage(
            user_id = userId,
            timestamp = System.currentTimeMillis(),
            transform = TransformData(
                pos = listOf(sscs.position.x, sscs.position.y, sscs.position.z),
                rot = listOf(sscs.rotation.x, sscs.rotation.y, sscs.rotation.z, sscs.rotation.w),
                scale = listOf(sscs.scale.x, sscs.scale.y, sscs.scale.z)
            ),
            expressions = expressions,
            look_at = lookAt?.let { listOf(it.x, it.y, it.z) }
        )
        sendDelta(delta)
    }

    /**
     * Parse a raw JSON message into a [ParsedDelta] with platform-native coordinates.
     * Returns null if the message is not an avatar_delta or cannot be parsed.
     */
    fun parseDeltaSSCS(jsonText: String): ParsedDelta? {
        return try {
            val msg = json.decodeFromString(AvatarDeltaMessage.serializer(), jsonText)
            if (msg.type != "avatar_delta") return null
            val t = msg.transform ?: return null
            val pos = Vector3(t.pos[0], t.pos[1], t.pos[2])
            val rot = Quaternion(t.rot[0], t.rot[1], t.rot[2], t.rot[3])
            val scl = Vector3(t.scale[0], t.scale[1], t.scale[2])
            // Convert from SSCS to Android (identity, but explicit)
            val local = CoordinateConverter.convertTransform(
                pos, rot, scl,
                CoordinateConverter.CoordinateSystem.SSCS,
                CoordinateConverter.CoordinateSystem.SSCS
            )
            val lookAt = msg.look_at?.let { Vector3(it[0], it[1], it[2]) }
            ParsedDelta(
                userId = msg.user_id,
                timestamp = msg.timestamp,
                position = local.position,
                rotation = local.rotation,
                scale = local.scale,
                expressions = msg.expressions,
                lookAt = lookAt
            )
        } catch (_: Exception) {
            null
        }
    }

    fun sendRoomEvent(roomId: String, userId: String, eventType: String, payload: Map<String, String> = emptyMap()) {
        val msg = RoomEventMessage(
            room_id = roomId,
            user_id = userId,
            event_type = eventType,
            payload = payload
        )
        send(msg)
    }

    fun leaveRoom(roomId: String, userId: String) {
        val msg = LeaveRoomMessage(room_id = roomId, user_id = userId)
        send(msg)
    }

    private inline fun <reified T> send(message: T) {
        if (!_isConnected.get()) return
        val text = json.encodeToString(message)
        webSocket?.send(text)
    }

    fun disconnect() {
        _isConnected.set(false)
        webSocket?.close()
        webSocket = null
    }

    fun startReconnect(url: String, intervalMs: Long = 3000) {
        scope.launch {
            while (!_isConnected.get()) {
                try {
                    connect(url)
                    delay(intervalMs)
                } catch (_: Exception) {
                    delay(intervalMs)
                }
            }
        }
    }
}
