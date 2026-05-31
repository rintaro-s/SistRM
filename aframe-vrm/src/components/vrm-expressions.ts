import type { VRM } from '@pixiv/three-vrm';

interface VRMExpressionsComponent extends AFrameComponent {
  _vrm: VRM | null;
  applyExpressions(): void;
}

AFRAME.registerComponent('vrm-expressions', {
  schema: {
    happy: { type: 'number', default: 0 },
    angry: { type: 'number', default: 0 },
    sad: { type: 'number', default: 0 },
    surprised: { type: 'number', default: 0 },
    relaxed: { type: 'number', default: 0 },
    blink: { type: 'number', default: 0 },
    blinkLeft: { type: 'number', default: 0 },
    blinkRight: { type: 'number', default: 0 },
  },

  dependencies: ['vrm-model'],

  init(this: VRMExpressionsComponent): void {
    this._vrm = null;

    this.el.addEventListener('model-loaded', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this._vrm = detail.vrm as VRM | null;
      this.applyExpressions();
    });
  },

  update(this: VRMExpressionsComponent): void {
    this.applyExpressions();
  },

  applyExpressions(this: VRMExpressionsComponent): void {
    if (!this._vrm?.expressionManager) return;
    for (const [name, value] of Object.entries(this.data)) {
      if (typeof value === 'number') {
        this._vrm.expressionManager.setValue(name, value);
      }
    }
  },
});
