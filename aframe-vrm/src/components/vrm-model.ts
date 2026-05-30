import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import type { VRM } from '@pixiv/three-vrm';

interface VRMModelComponent extends AFrameComponent {
  vrm: VRM | null;
  loader: GLTFLoader | null;
  loadModel(src: string): void;
  removeModel(): void;
}

AFRAME.registerComponent('vrm-model', {
  schema: {
    src: { type: 'asset' },
  },

  init(this: VRMModelComponent): void {
    this.vrm = null;
    this.loader = new GLTFLoader();
    this.loader.register((parser) => new VRMLoaderPlugin(parser));

    if (this.data.src) {
      this.loadModel(this.data.src);
    }
  },

  update(this: VRMModelComponent): void {
    if (this.data.src) {
      this.loadModel(this.data.src);
    }
  },

  removeModel(this: VRMModelComponent): void {
    if (this.vrm) {
      VRMUtils.deepDispose(this.vrm.scene);
      this.el.object3D.remove(this.vrm.scene);
      this.vrm = null;
    }
  },

  loadModel(this: VRMModelComponent, src: string): void {
    this.removeModel();

    this.loader!.load(
      src,
      (gltf) => {
        const vrm = gltf.userData.vrm as VRM | undefined;
        if (!vrm) {
          console.error('[vrm-model] No VRM data found in', src);
          return;
        }

        // VRM 0.0 models need Y=180 rotation correction
        VRMUtils.rotateVRM0(vrm);

        this.vrm = vrm;
        this.el.object3D.add(vrm.scene);

        // Emit event for other components
        this.el.emit('model-loaded', { vrm });

        // Resize to reasonable scale if needed
        const box = new THREE.Box3().setFromObject(vrm.scene);
        const size = box.getSize(new THREE.Vector3());
        if (size.y > 3.0 || size.y < 0.3) {
          const scale = 1.6 / size.y;
          vrm.scene.scale.setScalar(scale);
        }
      },
      undefined,
      (err) => {
        console.error('[vrm-model] Failed to load', src, err);
      }
    );
  },
});
