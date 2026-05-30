import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation';
import type { VRM } from '@pixiv/three-vrm';

interface VRMAAnimationComponent extends AFrameComponent {
  _vrm: VRM | null;
  _loader: GLTFLoader;
  _mixer: THREE.AnimationMixer | null;
  _clock: THREE.Clock;
  loadAnimation(url: string): void;
}

AFRAME.registerComponent('vrm-animation', {
  schema: {
    src: { type: 'string' },
    autoplay: { type: 'boolean', default: true },
    loop: { type: 'boolean', default: true },
  },

  dependencies: ['vrm-model'],

  init(this: VRMAAnimationComponent): void {
    this._vrm = null;
    this._loader = new GLTFLoader();
    this._loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    this._mixer = null;
    this._clock = new THREE.Clock();

    this.el.addEventListener('model-loaded', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      this._vrm = detail.vrm;
      if (this.data.src) {
        this.loadAnimation(this.data.src);
      }
    });
  },

  update(this: VRMAAnimationComponent): void {
    if (this.data.src && this._vrm) {
      this.loadAnimation(this.data.src);
    }
  },

  loadAnimation(this: VRMAAnimationComponent, url: string): void {
    this._loader.load(
      url,
      (gltf: any) => {
        if (!this._vrm) return;

        const vrmAnimations = gltf.userData.vrmAnimations;
        if (!vrmAnimations || vrmAnimations.length === 0) {
          console.error('[vrm-animation] No VRMA animation found in', url);
          return;
        }

        const vrmAnimation = vrmAnimations[0];
        const clip = createVRMAnimationClip(vrmAnimation, this._vrm);

        if (this._mixer) {
          this._mixer.stopAllAction();
        }
        this._mixer = new THREE.AnimationMixer(this._vrm.scene);
        const action = this._mixer.clipAction(clip);
        action.loop = this.data.loop ? THREE.LoopRepeat : THREE.LoopOnce;
        if (this.data.autoplay) {
          action.play();
        }
      },
      undefined,
      (error: any) => {
        console.error('[vrm-animation] Failed to load VRMA:', error);
      }
    );
  },

  tick(this: VRMAAnimationComponent): void {
    if (this._mixer) {
      const delta = this._clock.getDelta();
      this._mixer.update(delta);
    }
  },

  remove(this: VRMAAnimationComponent): void {
    if (this._mixer) {
      this._mixer.stopAllAction();
      this._mixer = null;
    }
  },
});
