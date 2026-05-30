import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';
import type { AvatarDeltaState } from '../utils/network-client';

interface VRMNetworkedComponent extends AFrameComponent {
  _sendInterval: ReturnType<typeof setInterval> | null;
  _vrm: VRM | null;
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
    this._vrm = null;

    const isLocal = !!(this.data.server && this.data.room && this.data.userId);

    if (isLocal) {
      const system = this.el.sceneEl.systems['vrm-network-system'] as {
        connect(url: string): void;
        joinRoom(roomId: string, userId: string, avatarUrl: string): void;
      } | undefined;

      if (system) {
        system.connect(this.data.server);
        const vrmModel = this.el.components['vrm-model'] as { data?: { src?: string } } | undefined;
        const avatarUrl = vrmModel?.data?.src || '';
        system.joinRoom(this.data.room, this.data.userId, avatarUrl);
      }

      this.el.addEventListener('model-loaded', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        this._vrm = detail.vrm;
      });

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
    if (!this._vrm) return;

    const obj = this.el.object3D;
    obj.updateMatrixWorld();

    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    obj.matrixWorld.decompose(pos, quat, scale);

    // Gather expressions from VRM
    const expressions: Record<string, number> = {};
    const em = this._vrm.expressionManager;
    if (em) {
      for (const [name, expr] of Object.entries(em.expressionMap)) {
        if (expr.weight > 0.001) {
          expressions[name] = expr.weight;
        }
      }
    }

    // Gather lookAt target
    const lookAt = this._vrm.lookAt;
    let lookAtPos = new THREE.Vector3();
    if (lookAt) {
      // Default: look forward relative to model
      const forward = new THREE.Vector3(0, 0, 1);
      forward.applyQuaternion(quat);
      lookAtPos.copy(pos).add(forward);
    }

    const state: AvatarDeltaState = {
      transform: {
        pos: [pos.x, pos.y, pos.z],
        rot: [quat.x, quat.y, quat.z, quat.w],
        scale: [scale.x, scale.y, scale.z],
      },
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
