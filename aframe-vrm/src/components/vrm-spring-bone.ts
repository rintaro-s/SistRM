import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

interface VRMSpringBoneComponent extends AFrameComponent {
  _lastGravity?: THREE.Vector3;
  _lastStiffness?: number;
}

AFRAME.registerComponent('vrm-spring-bone', {
  schema: {
    gravity: { type: 'vec3', default: { x: 0, y: -1, z: 0 } },
    stiffness: { type: 'number', default: 1.0 },
  },

  dependencies: ['vrm-model'],

  update(this: VRMSpringBoneComponent): void {
    const vrmModel = this.el.components['vrm-model'] as { vrm?: VRM } | undefined;
    const springBoneManager = vrmModel?.vrm?.springBoneManager;
    if (!springBoneManager) return;

    const gravity = this.data.gravity as THREE.Vector3;
    const stiffness = this.data.stiffness as number;

    const gravityDir = new THREE.Vector3(gravity.x, gravity.y, gravity.z).normalize();
    const gravityPower = Math.sqrt(gravity.x * gravity.x + gravity.y * gravity.y + gravity.z * gravity.z);

    for (const joint of springBoneManager.joints) {
      joint.settings.gravityDir.copy(gravityDir);
      joint.settings.gravityPower = gravityPower;
      joint.settings.stiffness = stiffness;
    }

    this._lastGravity = gravity.clone();
    this._lastStiffness = stiffness;
  },

  remove(): void {
    // Reset to defaults is not strictly required since the VRM may be disposed
  },
});
