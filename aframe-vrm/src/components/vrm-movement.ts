import * as THREE from 'three';

interface VRMMovementComponent extends AFrameComponent {
  velocity: THREE.Vector3;
  keys: { w: boolean; a: boolean; s: boolean; d: boolean; shift: boolean; space: boolean };
  mouseDown: boolean;
  lastMouseX: number;
  lastMouseY: number;
  touchStartData: Map<number, { x: number; y: number }>;
  touchYaw: number;
  touchPitch: number;
  twoFingerStartMid: { x: number; y: number } | null;
  twoFingerStartDist: number;
  onKeyDown: (e: KeyboardEvent) => void;
  onKeyUp: (e: KeyboardEvent) => void;
  onMouseDown: (e: MouseEvent) => void;
  onMouseMove: (e: MouseEvent) => void;
  onMouseUp: (e: MouseEvent) => void;
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: (e: TouchEvent) => void;
  setupKeyListeners(): void;
  removeKeyListeners(): void;
  setupMouseListeners(): void;
  removeMouseListeners(): void;
  setupTouchListeners(): void;
  removeTouchListeners(): void;
}

AFRAME.registerComponent('vrm-movement', {
  schema: {
    speed: { type: 'number', default: 2 },
    verticalSpeed: { type: 'number', default: 1.5 },
    enabled: { type: 'boolean', default: true },
    rotationSpeed: { type: 'number', default: 2 },
  },

  init(this: VRMMovementComponent): void {
    this.velocity = new THREE.Vector3();
    this.keys = { w: false, a: false, s: false, d: false, shift: false, space: false };
    this.mouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.touchStartData = new Map();
    this.touchYaw = 0;
    this.touchPitch = 0;
    this.twoFingerStartMid = null;
    this.twoFingerStartDist = 0;

    this.onKeyDown = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': this.keys.w = true; break;
        case 'a': this.keys.a = true; break;
        case 's': this.keys.s = true; break;
        case 'd': this.keys.d = true; break;
        case 'shift': this.keys.shift = true; break;
        case ' ': this.keys.space = true; break;
      }
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w': this.keys.w = false; break;
        case 'a': this.keys.a = false; break;
        case 's': this.keys.s = false; break;
        case 'd': this.keys.d = false; break;
        case 'shift': this.keys.shift = false; break;
        case ' ': this.keys.space = false; break;
      }
    };

    this.onMouseDown = (e: MouseEvent) => {
      if (!this.data.enabled) return;
      this.mouseDown = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    };

    this.onMouseMove = (e: MouseEvent) => {
      if (!this.data.enabled || !this.mouseDown) return;
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;

      const obj = this.el.object3D;
      obj.rotation.y -= dx * 0.002 * this.data.rotationSpeed;
      obj.rotation.x -= dy * 0.002 * this.data.rotationSpeed;
      obj.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, obj.rotation.x));
    };

    this.onMouseUp = () => {
      this.mouseDown = false;
    };

    this.onTouchStart = (e: TouchEvent) => {
      if (!this.data.enabled) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        this.touchStartData.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        this.twoFingerStartMid = {
          x: (t0.clientX + t1.clientX) / 2,
          y: (t0.clientY + t1.clientY) / 2,
        };
        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        this.twoFingerStartDist = Math.sqrt(dx * dx + dy * dy);
      }
    };

    this.onTouchMove = (e: TouchEvent) => {
      if (!this.data.enabled) return;
      e.preventDefault();
      if (e.touches.length === 1) {
        const t = e.touches[0];
        const start = this.touchStartData.get(t.identifier);
        if (start) {
          const dx = t.clientX - start.x;
          const dy = t.clientY - start.y;
          this.touchYaw -= dx * 0.005 * this.data.rotationSpeed;
          this.touchPitch -= dy * 0.005 * this.data.rotationSpeed;
          this.touchPitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.touchPitch));
          this.el.object3D.rotation.y = this.touchYaw;
          this.el.object3D.rotation.x = this.touchPitch;
          this.touchStartData.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      } else if (e.touches.length === 2) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const midX = (t0.clientX + t1.clientX) / 2;
        const midY = (t0.clientY + t1.clientY) / 2;
        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (this.twoFingerStartMid) {
          const moveX = (midX - this.twoFingerStartMid.x) * 0.01 * this.data.speed;
          const moveY = (this.twoFingerStartDist - dist) * 0.01 * this.data.verticalSpeed;
          const moveZ = (midY - this.twoFingerStartMid.y) * 0.01 * this.data.speed;

          const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.el.object3D.quaternion);
          const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.el.object3D.quaternion);

          this.el.object3D.position.add(right.multiplyScalar(moveX));
          this.el.object3D.position.y += moveY;
          this.el.object3D.position.add(forward.multiplyScalar(moveZ));
        }

        this.twoFingerStartMid = { x: midX, y: midY };
        this.twoFingerStartDist = dist;
      }
    };

    this.onTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        this.touchStartData.delete(e.changedTouches[i].identifier);
      }
      if (e.touches.length < 2) {
        this.twoFingerStartMid = null;
        this.twoFingerStartDist = 0;
      }
    };

    this.setupKeyListeners();
    this.setupMouseListeners();
    this.setupTouchListeners();
  },

  setupKeyListeners(this: VRMMovementComponent): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  },

  removeKeyListeners(this: VRMMovementComponent): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  },

  setupMouseListeners(this: VRMMovementComponent): void {
    const canvas = (this.el.sceneEl as any).canvas as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.addEventListener('mousedown', this.onMouseDown);
      canvas.addEventListener('mousemove', this.onMouseMove);
      canvas.addEventListener('mouseup', this.onMouseUp);
      canvas.addEventListener('mouseleave', this.onMouseUp);
    }
  },

  removeMouseListeners(this: VRMMovementComponent): void {
    const canvas = (this.el.sceneEl as any).canvas as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.removeEventListener('mousedown', this.onMouseDown);
      canvas.removeEventListener('mousemove', this.onMouseMove);
      canvas.removeEventListener('mouseup', this.onMouseUp);
      canvas.removeEventListener('mouseleave', this.onMouseUp);
    }
  },

  setupTouchListeners(this: VRMMovementComponent): void {
    const canvas = (this.el.sceneEl as any).canvas as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
      canvas.addEventListener('touchend', this.onTouchEnd);
      canvas.addEventListener('touchcancel', this.onTouchEnd);
    }
  },

  removeTouchListeners(this: VRMMovementComponent): void {
    const canvas = (this.el.sceneEl as any).canvas as HTMLCanvasElement | undefined;
    if (canvas) {
      canvas.removeEventListener('touchstart', this.onTouchStart);
      canvas.removeEventListener('touchmove', this.onTouchMove);
      canvas.removeEventListener('touchend', this.onTouchEnd);
      canvas.removeEventListener('touchcancel', this.onTouchEnd);
    }
  },

  remove(this: VRMMovementComponent): void {
    this.removeKeyListeners();
    this.removeMouseListeners();
    this.removeTouchListeners();
  },

  tick(_time: number, delta: number): void {
    if (!this.data.enabled) return;
    const dt = delta / 1000;

    // XZ movement relative to entity's Y rotation
    const obj = this.el.object3D;
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), obj.rotation.y);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(yawQ);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(yawQ);
    const move = new THREE.Vector3();
    if (this.keys.w) move.add(forward);
    if (this.keys.s) move.sub(forward);
    if (this.keys.a) move.sub(right);
    if (this.keys.d) move.add(right);
    move.normalize().multiplyScalar(this.data.speed * dt);

    // Vertical
    if (this.keys.space) move.y += this.data.verticalSpeed * dt;
    if (this.keys.shift) move.y -= this.data.verticalSpeed * dt;

    obj.position.add(move);
  },
});
