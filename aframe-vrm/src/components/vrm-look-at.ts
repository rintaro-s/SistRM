import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

interface VRMLookAtComponent extends AFrameComponent {
  _vrm: VRM | null;
}

AFRAME.registerComponent('vrm-look-at', {
  schema: {
    target: { type: 'selector', default: '[camera]' },
    type: { type: 'string', default: 'expression' },
    enabled: { type: 'boolean', default: true },
  },

  dependencies: ['vrm-model'],

  init(this: VRMLookAtComponent): void {
    this._vrm = null;

    this.el.addEventListener('model-loaded', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this._vrm = detail.vrm as VRM | null;
    });
  },

  tick(this: VRMLookAtComponent): void {
    if (!this._vrm || !this.data.enabled) return;
    const target = this.data.target;
    if (!target) return;
    if (!target.object3D) return;
    const targetPos = new THREE.Vector3();
    target.object3D.getWorldPosition(targetPos);
    if (this._vrm.lookAt) {
      this._vrm.lookAt.lookAt(targetPos);
    }
  },
});
