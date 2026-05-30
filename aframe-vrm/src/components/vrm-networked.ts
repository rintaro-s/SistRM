import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AvatarDeltaState } from '../utils/network-client';
import { packToSSCS } from '../utils/coordinates';

interface VRMNetworkedComponent extends AFrameComponent {
  _sendInterval: ReturnType<typeof setInterval> | null;
  _lastSent: number;
  _cachedExpressions: Record<string, number>;
  sendDelta(): void;
}

AFRAME.registerComponent('vrm-networked', {
  schema: {
    server: { type: 'string' },
    room: { type: 'string' },
    userId: { type: 'string' },
  },

  dependencies: ['vrm-model'],

  init(this: VRMNetworkedComponent): void {
    this._sendInterval = null;
    this._lastSent = 0;
    this._cachedExpressions = {};

    const isLocal = !!(this.data.server && this.data.room && this.data.userId);

    if (isLocal) {
      const system = this.el.sceneEl.systems['vrm-network-system'] as {
        connect(url: string): void;
        joinRoom(roomId: string, userId: string, avatarUrl: string): void;
      } | undefined;

      if (system) {
        system.connect(this.data.server);

        // Wait for model load to get avatar URL
        const vrmModel = this.el.components['vrm-model'] as { data?: { src?: string } } | undefined;
        const avatarUrl = vrmModel?.data?.src || '';
        system.joinRoom(this.data.room, this.data.userId, avatarUrl);
      }

      // Send delta at 20Hz
      this._sendInterval = setInterval(() => {
        this.sendDelta();
      }, 50);
    }
  },

  sendDelta(this: VRMNetworkedComponent): void {
    const system = this.el.sceneEl.systems['vrm-network-system'] as {
      client?: { sendDelta(state: AvatarDeltaState): void };
    } | undefined;

    if (!system?.client) return;

    const obj = this.el.object3D;
    obj.updateMatrixWorld();

    const pos = new THREE.Vector3();
    const rot = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    obj.matrixWorld.decompose(pos, rot, scale);

    // Gather expressions
    const expressionsComp = this.el.components['vrm-expressions'] as { data?: Record<string, number> } | undefined;
    const expressions: Record<string, number> = {};
    if (expressionsComp?.data) {
      for (const [key, value] of Object.entries(expressionsComp.data)) {
        if (typeof value === 'number' && value !== 0) {
          expressions[key] = value;
        }
      }
    }

    // Gather lookAt target
    const lookAtComp = this.el.components['vrm-look-at'] as { _targetEntity?: AFrameEntity | null; data?: { target?: AFrameEntity | null } } | undefined;
    let lookAtPos = new THREE.Vector3();
    if (lookAtComp?._targetEntity) {
      lookAtComp._targetEntity.object3D.getWorldPosition(lookAtPos);
    } else {
      // Default forward direction
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyQuaternion(rot);
      lookAtPos.copy(pos).add(forward);
    }

    const sscsTransform = packToSSCS(pos, rot, scale);

    const state: AvatarDeltaState = {
      transform: sscsTransform,
      expressions,
      look_at: [lookAtPos.x, lookAtPos.y, lookAtPos.z],
    };

    system.client.sendDelta(state);
  },

  remove(this: VRMNetworkedComponent): void {
    if (this._sendInterval) {
      clearInterval(this._sendInterval);
      this._sendInterval = null;
    }
  },
});
