export interface TransformState {
  pos: [number, number, number];
  rot: [number, number, number, number];
  scale: [number, number, number];
}

export interface AvatarDeltaState {
  transform: TransformState;
  expressions?: Record<string, number>;
  bone_rotations?: Record<string, [number, number, number, number]>;
  look_at?: [number, number, number];
}

export interface UserJoinedMessage {
  type: 'user_joined';
  user_id: string;
  avatar_url: string;
}

export interface UserLeftMessage {
  type: 'user_left';
  user_id: string;
}

export interface FullStateEntity {
  user_id: string;
  avatar_url: string;
  transform?: TransformState;
  expressions?: Record<string, number>;
  look_at?: [number, number, number];
}

export interface FullStateMessage {
  type: 'full_state';
  room_id: string;
  entities: FullStateEntity[];
}

export interface AvatarDeltaMessage {
  type: 'avatar_delta';
  user_id: string;
  timestamp?: number;
  transform?: TransformState;
  expressions?: Record<string, number>;
  look_at?: [number, number, number];
}

export type NetworkMessage =
  | UserJoinedMessage
  | UserLeftMessage
  | FullStateMessage
  | AvatarDeltaMessage
  | { type: 'joined_room' };

export interface NetworkEventHandlers {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (err: Event) => void;
  onMessage?: (msg: NetworkMessage) => void;
}

export class NetworkClient {
  private _ws: WebSocket | null = null;
  private _isConnected = false;
  private _url: string = '';
  private _handlers: NetworkEventHandlers = {};
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private _reconnectAttempts = 0;
  private readonly _maxReconnectAttempts = 10;
  private readonly _baseReconnectDelay = 1000;

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(url: string): void {
    this._url = url;
    this._reconnectAttempts = 0;
    this._connectInternal();
  }

  private _connectInternal(): void {
    if (this._ws) {
      try { this._ws.close(); } catch (_) {}
      this._ws = null;
    }

    try {
      this._ws = new WebSocket(this._url);
    } catch (err) {
      console.error('[vrm-network] Failed to create WebSocket:', err);
      this._scheduleReconnect();
      return;
    }

    this._ws.onopen = () => {
      this._isConnected = true;
      this._reconnectAttempts = 0;
      this._handlers.onConnected?.();
    };

    this._ws.onclose = () => {
      const wasConnected = this._isConnected;
      this._isConnected = false;
      this._ws = null;
      if (wasConnected) {
        this._handlers.onDisconnected?.();
      }
      this._scheduleReconnect();
    };

    this._ws.onerror = (err) => {
      console.error('[vrm-network] WebSocket error:', err);
      this._handlers.onError?.(err);
    };

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as NetworkMessage;
        this._handlers.onMessage?.(msg);
      } catch (e) {
        console.error('[vrm-network] Failed to parse message:', e);
      }
    };
  }

  private _scheduleReconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this._reconnectAttempts >= this._maxReconnectAttempts) {
      console.warn('[vrm-network] Max reconnection attempts reached.');
      return;
    }
    this._reconnectAttempts++;
    const delay = Math.min(
      this._baseReconnectDelay * Math.pow(2, this._reconnectAttempts - 1),
      30000
    );
    console.log(`[vrm-network] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts})...`);
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this._connectInternal();
    }, delay);
  }

  setHandlers(handlers: NetworkEventHandlers): void {
    this._handlers = handlers;
  }

  joinRoom(roomId: string, userId: string, avatarUrl: string): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    this._ws.send(
      JSON.stringify({
        type: 'join_room',
        room_id: roomId,
        user_id: userId,
        avatar_url: avatarUrl,
      })
    );
  }

  sendDelta(state: AvatarDeltaState): void {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    this._ws.send(
      JSON.stringify({
        type: 'avatar_delta',
        ...state,
      })
    );
  }

  disconnect(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._reconnectAttempts = this._maxReconnectAttempts; // prevent auto-reconnect
    if (this._ws) {
      try { this._ws.close(); } catch (_) {}
      this._ws = null;
    }
    this._isConnected = false;
  }
}
