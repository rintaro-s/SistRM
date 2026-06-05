import type { VRM } from '@pixiv/three-vrm';

interface VRMFirstPersonComponent extends AFrameComponent {
  _vrm: VRM | null;
  _initialized: boolean;
  updateFirstPerson(): void;
}

AFRAME.registerComponent('vrm-first-person', {
  schema: {
    enabled: { type: 'boolean', default: false },
  },

  dependencies: ['vrm-model'],

  init(this: VRMFirstPersonComponent): void {
    this._vrm = null;
    this._initialized = false;

    this.el.addEventListener('model-loaded', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this._vrm = detail.vrm;
      this._initialized = false;
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
    if (typeof fp.setup !== 'function') return;

    if (this.data.enabled) {
      fp.setup({ firstPersonOnlyLayer: 2 });
    } else {
      fp.setup({ firstPersonOnlyLayer: 0 });
    }
  },
});
