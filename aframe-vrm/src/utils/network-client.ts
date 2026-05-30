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

export class NetworkClient {
  private _ws: WebSocket | null = null;
  private _isConnected = false;
  private _onMessage: ((msg: NetworkMessage) => void) | null = null;

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(url: string): void {
    this._ws = new WebSocket(url);
    this._ws.onopen = () => {
      this._isConnected = true;
    };
    this._ws.onclose = () => {
      this._isConnected = false;
      this._ws = null;
    };
    this._ws.onerror = (err) => {
      console.error('[vrm-network] WebSocket error:', err);
    };
    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as NetworkMessage;
        if (this._onMessage) {
          this._onMessage(msg);
        }
      } catch (e) {
        console.error('[vrm-network] Failed to parse message:', e);
      }
    };
  }

  onMessage(handler: (msg: NetworkMessage) => void): void {
    this._onMessage = handler;
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
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this._isConnected = false;
  }
}
