import * as THREE from 'three';

export class WalkControls {
  readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  eyeHeight = 1.7;
  speed = 18;
  runMul = 2.2;
  pointerLocked = false;

  private keys = new Set<string>();
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private enabled = true;
  private yaw = 0;
  private pitch = 0;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('click', this.requestLock);
    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('click', this.requestLock);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v && document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  resetAt(x: number, z: number, lookYaw = 0) {
    this.camera.position.set(x, this.eyeHeight, z);
    this.yaw = lookYaw;
    this.pitch = 0;
    this.applyRotation();
  }

  private requestLock = () => {
    if (!this.enabled) return;
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  };

  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked || !this.enabled) return;
    this.yaw -= e.movementX * 0.0022;
    this.pitch -= e.movementY * 0.0022;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
    this.applyRotation();
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    this.eyeHeight = Math.max(0.6, Math.min(12, this.eyeHeight - e.deltaY * 0.002));
    this.camera.position.y = this.eyeHeight;
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys.add(e.code);
    if (e.code === 'KeyQ') {
      this.eyeHeight = Math.min(12, this.eyeHeight + 0.35);
      this.camera.position.y = this.eyeHeight;
    }
    if (e.code === 'KeyE') {
      this.eyeHeight = Math.max(0.6, this.eyeHeight - 0.35);
      this.camera.position.y = this.eyeHeight;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private applyRotation() {
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }

  update(dt: number, clampRadius: number) {
    if (!this.enabled) return;
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const sp = this.speed * (run ? this.runMul : 1) * dt;

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(forward);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(forward);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(sp);
      this.camera.position.add(move);
    }

    this.camera.position.y = this.eyeHeight;

    const r = Math.hypot(this.camera.position.x, this.camera.position.z);
    const maxR = Math.max(2, clampRadius - 2);
    if (r > maxR) {
      const s = maxR / r;
      this.camera.position.x *= s;
      this.camera.position.z *= s;
    }
  }

  facingYaw(): number {
    return this.yaw;
  }
}
