import type { VRM } from '@pixiv/three-vrm';

interface VRMExpressionsComponent extends AFrameComponent {
  _expressionKeys: string[];
}

AFRAME.registerComponent('vrm-expressions', {
  schema: {},

  dependencies: ['vrm-model'],

  updateSchema(this: VRMExpressionsComponent, data: any): void {
    if (typeof data !== 'object' || data === null) return;
    const newSchema: Record<string, any> = {};
    Object.keys(data).forEach((key) => {
      if (key === '' || key in this.schema) return;
      newSchema[key] = { type: 'number', default: 0 };
    });
    if (Object.keys(newSchema).length > 0) {
      this.extendSchema(newSchema);
    }
  },

  init(this: VRMExpressionsComponent): void {
    this._expressionKeys = [];
  },

  update(this: VRMExpressionsComponent, oldData: any): void {
    const vrmModel = this.el.components['vrm-model'] as { vrm?: VRM } | undefined;
    const expressionManager = vrmModel?.vrm?.expressionManager;
    if (!expressionManager) return;

    const keys = Object.keys(this.data);
    for (const key of keys) {
      if (key === '' || !(key in this.schema)) continue;
      const value = this.data[key];
      if (oldData[key] !== value) {
        expressionManager.setValue(key, value);
      }
    }
  },

  remove(): void {
    const vrmModel = this.el.components['vrm-model'] as { vrm?: VRM } | undefined;
    vrmModel?.vrm?.expressionManager?.resetValues();
  },
});
