import type { VRM } from '@pixiv/three-vrm';

interface VRMSpringBoneComponent extends AFrameComponent {
  _vrm: VRM | null;
  _storedGravity: { x: number; y: number; z: number } | null;
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
    // @pixiv/three-vrm doesn't expose direct spring bone control in the public API.
    // Store values for future custom spring bone implementations or runtime patching.
    this._storedGravity = this.data.gravity;
    this._storedStiffness = this.data.stiffness;
  },
});
