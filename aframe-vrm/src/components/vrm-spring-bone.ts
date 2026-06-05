import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

interface VRMSpringBoneComponent extends AFrameComponent {
  _vrm: VRM | null;
  _storedGravity: THREE.Vector3 | null;
  _storedStiffness: number | null;
  applyOverrides(): void;
}

AFRAME.registerComponent('vrm-spring-bone', {
  schema: {
    gravity: { type: 'vec3', default: { x: 0, y: -1, z: 0 } },
    stiffness: { type: 'number', default: 1.0 },
    enabled: { type: 'boolean', default: true },
  },

  dependencies: ['vrm-model'],

  init(this: VRMSpringBoneComponent): void {
    this._vrm = null;
    this._storedGravity = null;
    this._storedStiffness = null;

    this.el.addEventListener('model-loaded', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this._vrm = detail.vrm as VRM | null;
      this.applyOverrides();
    });
  },

  update(this: VRMSpringBoneComponent): void {
    this.applyOverrides();
  },

  applyOverrides(this: VRMSpringBoneComponent): void {
    if (!this._vrm) return;

    const { gravity, stiffness } = this.data;
    this._storedGravity = new THREE.Vector3(gravity.x, gravity.y, gravity.z);
    this._storedStiffness = stiffness;

    const sbm = this._vrm.springBoneManager;
    if (!sbm) return;

    const gravityPower = Math.abs(gravity.y);
    for (const group of sbm.springBones) {
      group.gravityDir.set(gravity.x, gravity.y, gravity.z);
      group.gravityPower = gravityPower;
      group.stiffnessForce = stiffness;
    }
  },
});
