import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';

interface VRMModelComponent extends AFrameComponent {
  vrm?: VRM;
  loader?: GLTFLoader;
}

AFRAME.registerComponent('vrm-model', {
  schema: {
    src: { type: 'string' },
  },

  init(this: VRMModelComponent): void {
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

    if (this.data.src) {
      this.loadModel(this.data.src);
    }
  },

  update(this: VRMModelComponent, oldData: any): void {
    if (oldData.src !== this.data.src && this.data.src) {
      this.removeModel();
      this.loadModel(this.data.src);
    }
  },

  loadModel(this: VRMModelComponent, src: string): void {
    this.loader!.load(
      src,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM | undefined;
        if (!vrm) {
          console.error('vrm-model: Loaded glTF does not contain a VRM');
          return;
        }

        this.vrm = vrm;
        VRMUtils.rotateVRM0(vrm);
        this.el.setObject3D('vrm', vrm.scene);

        const system = this.el.sceneEl.systems['vrm'] as { registerVRM(v: VRM): void } | undefined;
        if (system && system.registerVRM) {
          system.registerVRM(vrm);
        }

        this.el.emit('model-loaded', { format: 'vrm', model: vrm }, false);
      },
      undefined,
      (error) => {
        console.error('vrm-model: Error loading VRM', error);
        this.el.emit('model-error', { format: 'vrm', src }, false);
      },
    );
  },

  removeModel(this: VRMModelComponent): void {
    if (this.vrm) {
      const system = this.el.sceneEl.systems['vrm'] as { unregisterVRM(v: VRM): void } | undefined;
      if (system && system.unregisterVRM) {
        system.unregisterVRM(this.vrm);
      }

      this.el.removeObject3D('vrm');
      VRMUtils.deepDispose(this.vrm.scene);
      this.vrm = undefined;
    }
  },

  remove(this: VRMModelComponent): void {
    this.removeModel();
  },
});
