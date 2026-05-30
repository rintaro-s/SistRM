export interface NetworkMessage {
  type: string;
  [key: string]: any;
}

export interface JoinRoomMessage extends NetworkMessage {
  type: 'join_room';
  room_id: string;
  user_id: string;
  avatar_url: string;
}

export interface AvatarDeltaMessage extends NetworkMessage {
  type: 'avatar_delta';
  user_id: string;
  timestamp: number;
  transform: {
    pos: [number, number, number];
    rot: [number, number, number, number];
    scale: [number, number, number];
  };
  expressions: Record<string, number>;
  look_at: [number, number, number];
}

export interface UserJoinedMessage extends NetworkMessage {
  type: 'user_joined';
  user_id: string;
  avatar_url: string;
}

export interface UserLeftMessage extends NetworkMessage {
  type: 'user_left';
  user_id: string;
}

export interface FullStateMessage extends NetworkMessage {
  type: 'full_state';
  entities: Array<{
    user_id: string;
    avatar_url: string;
    transform?: AvatarDeltaMessage['transform'];
    expressions?: Record<string, number>;
    look_at?: [number, number, number];
  }>;
}

export type AvatarDeltaState = Omit<AvatarDeltaMessage, 'type' | 'user_id' | 'timestamp'> & {
  timestamp?: number;
};

export class NetworkClient {
  private ws: WebSocket | null = null;
  private url = '';
  private reconnectInterval = 3000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageCallback: ((msg: NetworkMessage) => void) | null = null;
  private _isConnecting = false;

  get isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  get isConnecting(): boolean {
    return this._isConnecting;
  }

  connect(url: string): void {
    this.url = url;
    this._connect();
  }

  private _connect(): void {
    if (this.isConnected || this._isConnecting) return;
    this._isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this._isConnecting = false;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as NetworkMessage;
          if (this.messageCallback) {
            this.messageCallback(msg);
          }
        } catch (err) {
          console.warn('[vrm-network] Failed to parse message:', event.data, err);
        }
      };

      this.ws.onclose = () => {
        this._isConnecting = false;
        this._scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        this._isConnecting = false;
        console.error('[vrm-network] WebSocket error:', err);
      };
    } catch (err) {
      this._isConnecting = false;
      console.error('[vrm-network] Failed to connect:', err);
      this._scheduleReconnect();
    }
  }

  private _scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this._connect();
    }, this.reconnectInterval);
  }

  joinRoom(roomId: string, userId: string, avatarUrl: string): void {
    this.send({
      type: 'join_room',
      room_id: roomId,
      user_id: userId,
      avatar_url: avatarUrl,
    });
  }

  sendDelta(state: AvatarDeltaState): void {
    this.send({
      type: 'avatar_delta',
      timestamp: Date.now(),
      ...state,
    });
  }

  send(msg: NetworkMessage): void {
    if (!this.isConnected) {
      console.warn('[vrm-network] Cannot send, not connected');
      return;
    }
    this.ws!.send(JSON.stringify(msg));
  }

  onMessage(callback: (msg: NetworkMessage) => void): void {
    this.messageCallback = callback;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
