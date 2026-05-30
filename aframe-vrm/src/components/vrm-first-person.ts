import type { VRM } from '@pixiv/three-vrm';

interface VRMFirstPersonComponent extends AFrameComponent {
  _vrm: VRM | null;
  updateFirstPerson(): void;
}

AFRAME.registerComponent('vrm-first-person', {
  schema: {
    enabled: { type: 'boolean', default: false },
  },

  dependencies: ['vrm-model'],

  init(this: VRMFirstPersonComponent): void {
    this._vrm = null;

    this.el.addEventListener('model-loaded', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this._vrm = detail.vrm;
      this.updateFirstPerson();
    });
  },

  update(this: VRMFirstPersonComponent): void {
    this.updateFirstPerson();
  },

  updateFirstPerson(this: VRMFirstPersonComponent): void {
    if (!this._vrm) return;

    const fp = this._vrm.firstPerson;
    if (!fp) return;

    if (this.data.enabled) {
      // In first-person mode, hide meshes that should not be visible
      // VRMFirstPerson has mesh annotations that control visibility
      fp.setup({ firstPersonOnlyLayer: 1 });
    } else {
      fp.setup({ firstPersonOnlyLayer: 0 });
    }
  },
});
