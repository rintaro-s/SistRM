import * as THREE from 'three';
import type { VRM } from '@pixiv/three-vrm';

interface VRMLookAtComponent extends AFrameComponent {
  _targetEntity?: AFrameEntity | null;
  _lookAtPosition?: THREE.Vector3;
}

AFRAME.registerComponent('vrm-look-at', {
  schema: {
    target: { type: 'selector' },
    type: { type: 'string', default: 'expression' },
  },

  dependencies: ['vrm-model'],

  init(this: VRMLookAtComponent): void {
    this._lookAtPosition = new THREE.Vector3();
  },

  update(this: VRMLookAtComponent, oldData: any): void {
    const vrmModel = this.el.components['vrm-model'] as { vrm?: VRM } | undefined;
    const lookAt = vrmModel?.vrm?.lookAt;
    if (!lookAt) return;

    if (oldData.target !== this.data.target) {
      this._targetEntity = this.data.target as AFrameEntity | null | undefined;
    }

    if (!this._targetEntity) {
      lookAt.target = null;
      return;
    }

    lookAt.target = this._targetEntity.object3D;
  },

  tick(this: VRMLookAtComponent): void {
    const vrmModel = this.el.components['vrm-model'] as { vrm?: VRM } | undefined;
    const lookAt = vrmModel?.vrm?.lookAt;
    if (!lookAt) return;

    if (this._targetEntity && this._targetEntity.object3D) {
      // autoUpdate handles tracking when target is set
      // noop: lookAt.update is called by vrm-system
    }
  },

  remove(this: VRMLookAtComponent): void {
    const vrmModel = this.el.components['vrm-model'] as { vrm?: VRM } | undefined;
    const lookAt = vrmModel?.vrm?.lookAt;
    if (lookAt) {
      lookAt.target = null;
      lookAt.reset();
    }
  },
});
