import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

interface VRMEntity extends AFrameEntity {
  components: {
    'vrm-model'?: { vrm?: VRM };
  };
}

AFRAME.registerSystem('vrm-system', {
  schema: {},

  init(): void {
    this.clock = new THREE.Clock();
  },

  tick(_time: number, _timeDelta: number): void {
    const delta = this.clock.getDelta();
    const scene = this.sceneEl;

    // Update all VRM models
    const vrms = scene.querySelectorAll('[vrm-model]') as unknown as Array<VRMEntity>;
    for (let i = 0; i < vrms.length; i++) {
      const el = vrms[i];
      const vrm = el.components?.['vrm-model']?.vrm;
      if (vrm) {
        vrm.update(delta);
      }
    }
  },
});
