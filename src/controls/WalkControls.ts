import * as THREE from 'three';

/**
 * First-person walk: WASD move, look via right-mouse drag (primary)
 * or optional pointer-lock after click. Pitch clamped near ±89° so
 * looking up/down never sticks near the horizon.
 */
export class WalkControls {
  readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  eyeHeight = 1.7;
  speed = 18;
  runMul = 2.2;
  pointerLocked = false;
  /** True while user is actively looking (RMB or pointer-lock). */
  looking = false;

  private keys = new Set<string>();
  private canvas: HTMLCanvasElement;
  private camera: THREE.PerspectiveCamera;
  private enabled = true;
  private yaw = 0;
  private pitch = 0;
  private rmbDown = false;
  private lmbDragLook = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragged = false;
  private readonly pitchMin = -Math.PI / 2 + 0.04;
  private readonly pitchMax = Math.PI / 2 - 0.04;
  private readonly lookSens = 0.0024;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointermove', this.onPointerMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) {
      this.rmbDown = false;
      this.lmbDragLook = false;
      this.looking = false;
      if (document.pointerLockElement === this.canvas) {
        document.exitPointerLock();
      }
    }
  }

  resetAt(x: number, z: number, lookYaw = 0) {
    this.camera.position.set(x, this.eyeHeight, z);
    this.yaw = lookYaw;
    this.pitch = 0;
    this.applyRotation();
  }

  /** Exit pointer lock if active. Returns true if lock was released. */
  unlockPointer(): boolean {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
      return true;
    }
    return false;
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.enabled) return;
    if (e.button === 2) {
      // Right mouse: hold to look (no pointer lock required)
      this.rmbDown = true;
      this.looking = true;
      this.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button === 0) {
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.dragged = false;
      this.lmbDragLook = true;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button === 2) {
      this.rmbDown = false;
      this.looking = this.pointerLocked;
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    if (e.button === 0) {
      // Short click without drag → optional pointer-lock capture
      if (this.lmbDragLook && !this.dragged && !this.pointerLocked) {
        // Don't auto-lock on every click (interferes with select); double-click or
        // explicit "click to look" banner handles lock. Keep drag-look only.
      }
      this.lmbDragLook = false;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.enabled) return;

    if (this.pointerLocked) {
      this.applyLookDelta(e.movementX, e.movementY);
      return;
    }

    if (this.rmbDown) {
      this.applyLookDelta(e.movementX, e.movementY);
      return;
    }

    // Left-drag look when dragging more than a few px (so clicks still select)
    if (this.lmbDragLook && (e.buttons & 1)) {
      const dx = e.clientX - this.dragStartX;
      const dy = e.clientY - this.dragStartY;
      if (!this.dragged && Math.hypot(dx, dy) > 6) {
        this.dragged = true;
        this.looking = true;
      }
      if (this.dragged) {
        this.applyLookDelta(e.movementX, e.movementY);
      }
    }
  };

  private applyLookDelta(dx: number, dy: number) {
    this.yaw -= dx * this.lookSens;
    // Negative pitch = look down (YXZ). Clamp near ±90° so look-down always works.
    this.pitch -= dy * this.lookSens;
    if (this.pitch < this.pitchMin) this.pitch = this.pitchMin;
    if (this.pitch > this.pitchMax) this.pitch = this.pitchMax;
    this.applyRotation();
  }

  /** Request pointer lock (optional alternate look mode). */
  requestLock() {
    if (!this.enabled) return;
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  }

  private onLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    this.looking = this.pointerLocked || this.rmbDown;
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
    if (forward.lengthSq() < 1e-6) {
      // Looking straight up/down — use yaw for movement facing
      forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    }
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

  /** True if the last LMB gesture was a drag-look (suppress click select). */
  wasDragLook(): boolean {
    return this.dragged;
  }
}
