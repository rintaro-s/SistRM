import { VRM } from '@pixiv/three-vrm';

interface VRMSystem extends AFrameSystem {
  vrms: Set<VRM>;
  registerVRM(vrm: VRM): void;
  unregisterVRM(vrm: VRM): void;
}

AFRAME.registerSystem('vrm', {
  init(this: VRMSystem): void {
    this.vrms = new Set();
  },

  registerVRM(this: VRMSystem, vrm: VRM): void {
    this.vrms.add(vrm);
  },

  unregisterVRM(this: VRMSystem, vrm: VRM): void {
    this.vrms.delete(vrm);
  },

  tick(this: VRMSystem, _time: number, timeDelta: number): void {
    const delta = timeDelta / 1000;
    for (const vrm of this.vrms) {
      vrm.update(delta);
    }
  },
});
