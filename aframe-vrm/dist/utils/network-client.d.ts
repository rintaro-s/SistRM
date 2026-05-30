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
export type NetworkMessage = UserJoinedMessage | UserLeftMessage | FullStateMessage | AvatarDeltaMessage | {
    type: 'joined_room';
};
export declare class NetworkClient {
    private _ws;
    private _isConnected;
    private _onMessage;
    get isConnected(): boolean;
    connect(url: string): void;
    onMessage(handler: (msg: NetworkMessage) => void): void;
    joinRoom(roomId: string, userId: string, avatarUrl: string): void;
    sendDelta(state: AvatarDeltaState): void;
    disconnect(): void;
}
