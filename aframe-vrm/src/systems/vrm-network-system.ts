import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import {
  NetworkClient,
  type NetworkMessage,
  type UserJoinedMessage,
  type UserLeftMessage,
  type FullStateMessage,
  type AvatarDeltaMessage,
} from '../utils/network-client';

interface RemoteUser {
  entity: AFrameEntity;
  vrm: VRM | null;
  targetPos: THREE.Vector3;
  targetRot: THREE.Quaternion;
  targetScale: THREE.Vector3;
  targetExpressions: Record<string, number>;
  targetLookAt: THREE.Vector3;
  currentPos: THREE.Vector3;
  currentRot: THREE.Quaternion;
  currentScale: THREE.Vector3;
  currentExpressions: Record<string, number>;
  currentLookAt: THREE.Vector3;
}

interface VRMNetworkSystem extends AFrameSystem {
  client: NetworkClient;
  remoteUsers: Map<string, RemoteUser>;
  connect(url: string): void;
  joinRoom(roomId: string, userId: string, avatarUrl: string): void;
  spawnRemoteUser(userId: string, avatarUrl: string): void;
  removeRemoteUser(userId: string): void;
  applyRemoteDelta(userId: string, delta: AvatarDeltaMessage): void;
  handleMessage(msg: NetworkMessage): void;
}

AFRAME.registerSystem('vrm-network-system', {
  schema: {},

  init(this: VRMNetworkSystem): void {
    this.client = new NetworkClient();
    this.remoteUsers = new Map<string, RemoteUser>();

    this.client.onMessage((msg: NetworkMessage) => {
      this.handleMessage(msg);
    });
  },

  connect(this: VRMNetworkSystem, url: string): void {
    this.client.connect(url);
  },

  joinRoom(this: VRMNetworkSystem, roomId: string, userId: string, avatarUrl: string): void {
    const tryJoin = () => {
      if (this.client.isConnected) {
        this.client.joinRoom(roomId, userId, avatarUrl);
      } else {
        setTimeout(tryJoin, 500);
      }
    };
    tryJoin();
  },

  handleMessage(this: VRMNetworkSystem, msg: NetworkMessage): void {
    switch (msg.type) {
      case 'user_joined': {
        const joined = msg as UserJoinedMessage;
        if (!this.remoteUsers.has(joined.user_id)) {
          this.spawnRemoteUser(joined.user_id, joined.avatar_url);
        }
        break;
      }
      case 'user_left': {
        const left = msg as UserLeftMessage;
        this.removeRemoteUser(left.user_id);
        break;
      }
      case 'full_state': {
        const full = msg as FullStateMessage;
        for (const entity of full.entities) {
          if (!this.remoteUsers.has(entity.user_id)) {
            this.spawnRemoteUser(entity.user_id, entity.avatar_url);
          }
          const remote = this.remoteUsers.get(entity.user_id);
          if (remote && entity.transform) {
            remote.targetPos.set(...entity.transform.pos);
            remote.targetRot.set(...entity.transform.rot);
            remote.targetScale.set(...entity.transform.scale);
          }
          if (remote && entity.expressions) {
            Object.assign(remote.targetExpressions, entity.expressions);
          }
          if (remote && entity.look_at) {
            remote.targetLookAt.set(...entity.look_at);
          }
        }
        break;
      }
      case 'avatar_delta': {
        const delta = msg as AvatarDeltaMessage;
        this.applyRemoteDelta(delta.user_id, delta);
        break;
      }
    }
  },

  spawnRemoteUser(this: VRMNetworkSystem, userId: string, avatarUrl: string): void {
    const scene = this.sceneEl;
    const entity = document.createElement('a-entity') as unknown as AFrameEntity;
    entity.setAttribute('vrm-model', `src: ${avatarUrl}`);
    entity.setAttribute('vrm-networked', `userId: ${userId}`);
    entity.setAttribute('id', `vrm-remote-${userId}`);
    scene.appendChild(entity);

    const remote: RemoteUser = {
      entity,
      vrm: null,
      targetPos: new THREE.Vector3(),
      targetRot: new THREE.Quaternion(),
      targetScale: new THREE.Vector3(1, 1, 1),
      targetExpressions: {},
      targetLookAt: new THREE.Vector3(0, 0, 1),
      currentPos: new THREE.Vector3(),
      currentRot: new THREE.Quaternion(),
      currentScale: new THREE.Vector3(1, 1, 1),
      currentExpressions: {},
      currentLookAt: new THREE.Vector3(0, 0, 1),
    };

    entity.addEventListener('model-loaded', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      remote.vrm = detail.vrm;
    });

    this.remoteUsers.set(userId, remote);
  },

  removeRemoteUser(this: VRMNetworkSystem, userId: string): void {
    const remote = this.remoteUsers.get(userId);
    if (remote) {
      remote.entity.parentNode?.removeChild(remote.entity);
      this.remoteUsers.delete(userId);
    }
  },

  applyRemoteDelta(this: VRMNetworkSystem, userId: string, delta: AvatarDeltaMessage): void {
    if (!this.remoteUsers.has(userId)) {
      this.spawnRemoteUser(userId, '');
    }
    const remote = this.remoteUsers.get(userId)!;
    if (delta.transform) {
      remote.targetPos.set(...delta.transform.pos);
      remote.targetRot.set(...delta.transform.rot);
      remote.targetScale.set(...delta.transform.scale);
    }
    if (delta.expressions) {
      Object.assign(remote.targetExpressions, delta.expressions);
    }
    if (delta.look_at) {
      remote.targetLookAt.set(...delta.look_at);
    }
  },

  tick(this: VRMNetworkSystem, _time: number, timeDelta: number): void {
    const dt = timeDelta / 1000;
    const lerpFactor = 1 - Math.exp(-dt * 15);

    for (const remote of this.remoteUsers.values()) {
      // Interpolate transform
      remote.currentPos.lerp(remote.targetPos, lerpFactor);
      remote.currentRot.slerp(remote.targetRot, lerpFactor);
      remote.currentScale.lerp(remote.targetScale, lerpFactor);

      const obj = remote.entity.object3D;
      obj.position.copy(remote.currentPos);
      obj.quaternion.copy(remote.currentRot);
      obj.scale.copy(remote.currentScale);

      // Interpolate lookAt
      remote.currentLookAt.lerp(remote.targetLookAt, lerpFactor);

      // Apply expressions and lookAt if VRM is loaded
      if (remote.vrm) {
        const vrm = remote.vrm;
        if (vrm.expressionManager) {
          for (const [name, targetValue] of Object.entries(remote.targetExpressions)) {
            const current = remote.currentExpressions[name] ?? 0;
            const next = current + (targetValue - current) * lerpFactor;
            remote.currentExpressions[name] = next;
            vrm.expressionManager.setValue(name, next);
          }
        }
        if (vrm.lookAt) {
          vrm.lookAt.lookAt(remote.currentLookAt);
        }
        // Update VRM itself (spring bones, constraints, materials)
        vrm.update(dt);
      }
    }
  },
});
