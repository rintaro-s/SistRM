package com.nbks.vrm.network

import com.nbks.vrm.core.CoordinateConverter
import com.nbks.vrm.math.Quaternion
import com.nbks.vrm.math.Vector3
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
    val look_at: List<Float>? = null
)

@Serializable
data class TransformData(
    val pos: List<Float>,
    val rot: List<Float>,
    val scale: List<Float>
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
        send(JoinRoomMessage(room_id = roomId, user_id = userId, avatar_url = avatarUrl, display_name = displayName))
    }

    fun sendDelta(delta: AvatarDeltaMessage) { send(delta) }

    fun sendDeltaFromLocal(
        userId: String,
        position: Vector3,
        rotation: Quaternion,
        scale: Vector3 = Vector3(1f, 1f, 1f),
        expressions: Map<String, Float>? = null,
        lookAt: Vector3? = null
    ) {
        val sscs = CoordinateConverter.convertTransform(
            position, rotation, scale,
            CoordinateConverter.CoordinateSystem.SSCS,
            CoordinateConverter.CoordinateSystem.SSCS
        )
        sendDelta(AvatarDeltaMessage(
            user_id = userId,
            timestamp = System.currentTimeMillis(),
            transform = TransformData(
                pos = listOf(sscs.position.x, sscs.position.y, sscs.position.z),
                rot = listOf(sscs.rotation.x, sscs.rotation.y, sscs.rotation.z, sscs.rotation.w),
                scale = listOf(sscs.scale.x, sscs.scale.y, sscs.scale.z)
            ),
            expressions = expressions,
            look_at = lookAt?.let { listOf(it.x, it.y, it.z) }
        ))
    }

    fun leaveRoom(roomId: String, userId: String) {
        send(LeaveRoomMessage(room_id = roomId, user_id = userId))
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
                try { connect(url); delay(intervalMs) } catch (_: Exception) { delay(intervalMs) }
            }
        }
    }
}
