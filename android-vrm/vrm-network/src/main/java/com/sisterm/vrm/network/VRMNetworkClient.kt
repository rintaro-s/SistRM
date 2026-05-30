package com.sisterm.vrm.network

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

    fun sendDelta(delta: AvatarDeltaMessage) {
        send(delta)
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
