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
export declare class NetworkClient {
    private ws;
    private url;
    private reconnectInterval;
    private reconnectTimer;
    private messageCallback;
    private _isConnecting;
    get isConnected(): boolean;
    get isConnecting(): boolean;
    connect(url: string): void;
    private _connect;
    private _scheduleReconnect;
    joinRoom(roomId: string, userId: string, avatarUrl: string): void;
    sendDelta(state: AvatarDeltaState): void;
    send(msg: NetworkMessage): void;
    onMessage(callback: (msg: NetworkMessage) => void): void;
    disconnect(): void;
}
