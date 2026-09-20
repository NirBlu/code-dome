import * as THREE from 'three';
import { layoutFolder } from '../layout/layout';
import type { AncestorRec, FolderView, LotPlacement, WorldRoot } from '../types';
import {
  createBuildingMesh,
  createChildGlobe,
  createFloor,
  createGate,
  createSelectionDecal,
} from './buildings';
import { ambientForDepth, buildSkyStack } from './skyStack';

export class DomeScene {
  readonly scene = new THREE.Scene();
  readonly root = new THREE.Group();
  floorRadius = 40;
  lots: LotPlacement[] = [];
  private content = new THREE.Group();
  private selectionMark: THREE.Object3D | null = null;
  private hemi: THREE.HemisphereLight;
  private amb: THREE.AmbientLight;
  private dir: THREE.DirectionalLight;
  private labelSprites: THREE.Sprite[] = [];
  private transition = 0;
  private transitioning = false;

  constructor() {
    this.scene.background = new THREE.Color(0x0b1218);
    this.scene.fog = new THREE.FogExp2(0x0b1218, 0.012);
    this.scene.add(this.root);
    this.root.add(this.content);

    this.hemi = new THREE.HemisphereLight(0x9ec8ff, 0x1a2030, 0.55);
    this.amb = new THREE.AmbientLight(0xffffff, 0.45);
    this.dir = new THREE.DirectionalLight(0xfff2dd, 0.65);
    this.dir.position.set(30, 50, 20);
    this.scene.add(this.hemi, this.amb, this.dir);
  }

  clearContent() {
    while (this.content.children.length) {
      const c = this.content.children.pop()!;
      c.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      });
      this.content.remove(c);
    }
    this.labelSprites = [];
    this.selectionMark = null;
    this.lots = [];
  }

  buildDome(view: FolderView, trail: AncestorRec[]) {
    this.clearContent();
    const { radius, lots } = layoutFolder(view);
    this.floorRadius = radius;
    this.lots = lots;

    const depth = view.depth;
    this.amb.intensity = ambientForDepth(depth);
    this.hemi.intensity = ambientForDepth(depth);
    (this.scene.fog as THREE.FogExp2).density = 0.01 + depth * 0.0025;
    this.scene.background = new THREE.Color().setHSL(0.55, 0.2, Math.max(0.04, 0.08 - depth * 0.008));

    this.content.add(createFloor(radius, view.tint));
    this.content.add(buildSkyStack(view.ancestors, radius, depth));

    for (const lot of lots) {
      if (lot.kind === 'file') {
        const mesh = createBuildingMesh(lot);
        this.content.add(mesh);
        this.addWorldLabel(lot.name, lot.x, lot.height + 0.6, lot.z, 0.9);
      } else if (lot.kind === 'folder') {
        const mesh = createChildGlobe(lot);
        this.content.add(mesh);
        this.addWorldLabel(lot.name, lot.x, lot.height + 0.4, lot.z, 1.1);
      } else if (lot.kind === 'gate') {
        this.content.add(createGate(lot, radius));
        this.addWorldLabel(lot.name, 0, 6.5, -radius + 1.5, 1.0);
      } else if (lot.kind === 'plaza') {
        this.addWorldLabel(view.name, 0, 2.2, 0, 1.4);
      }
    }

    // Fade-in
    this.content.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material) {
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          if ('opacity' in mat) {
            const sm = mat as THREE.MeshStandardMaterial;
            if (sm.transparent || sm.opacity < 1) {
              sm.userData._targetOpacity = sm.opacity;
            }
          }
        }
      }
    });
  }

  buildOrbit(worlds: WorldRoot[]) {
    this.clearContent();
    this.floorRadius = 80;
    this.scene.background = new THREE.Color(0x05070c);
    (this.scene.fog as THREE.FogExp2).density = 0.004;
    this.amb.intensity = 0.5;

    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(900);
    for (let i = 0; i < 900; i++) positions[i] = (Math.random() - 0.5) * 400;
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.content.add(
      new THREE.Points(
        starGeo,
        new THREE.PointsMaterial({ color: 0xaabbcc, size: 0.6, sizeAttenuation: true }),
      ),
    );

    worlds.forEach((w, i) => {
      const ang = (i / Math.max(1, worlds.length)) * Math.PI * 2;
      const x = Math.sin(ang) * 28;
      const z = Math.cos(ang) * 28;
      const globe = new THREE.Mesh(
        new THREE.SphereGeometry(6, 32, 24),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color(w.tint),
          roughness: 0.45,
          metalness: 0.2,
        }),
      );
      globe.position.set(x, 0, z);
      globe.userData.world = w;
      globe.userData.isWorld = true;
      this.content.add(globe);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(8, 0.15, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x88aacc }),
      );
      ring.rotation.x = Math.PI / 2.3;
      ring.position.copy(globe.position);
      this.content.add(ring);
      this.addWorldLabel(w.name, x, 8, z, 2);
      this.lots.push({
        id: `world:${w.path}`,
        kind: 'folder',
        name: w.name,
        x,
        z,
        radius: 6,
        height: 12,
        path: w.path,
        tint: w.tint,
      });
    });
  }

  setSelection(lot: LotPlacement | null) {
    if (this.selectionMark) {
      this.content.remove(this.selectionMark);
      this.selectionMark = null;
    }
    if (lot && (lot.kind === 'file' || lot.kind === 'folder')) {
      this.selectionMark = createSelectionDecal(lot);
      this.content.add(this.selectionMark);
    }
  }

  pick(
    raycaster: THREE.Raycaster,
  ): { lot?: LotPlacement; world?: WorldRoot; object: THREE.Object3D } | null {
    const hits = raycaster.intersectObjects(this.content.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o) {
        if (o.userData.lot) return { lot: o.userData.lot as LotPlacement, object: o };
        if (o.userData.isWorld) return { world: o.userData.world as WorldRoot, object: o };
        o = o.parent;
      }
    }
    return null;
  }

  private addWorldLabel(text: string, x: number, y: number, z: number, scale: number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, 8, 12, 240, 40, 8);
    ctx.fill();
    ctx.fillStyle = '#e8f4ff';
    ctx.font = '22px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text.slice(0, 28), 128, 40);
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: true }),
    );
    spr.position.set(x, y, z);
    spr.scale.set(4 * scale, scale, 1);
    this.content.add(spr);
    this.labelSprites.push(spr);
  }

  beginTransition(ms = 450) {
    this.transitioning = true;
    this.transition = ms;
    this.content.scale.setScalar(0.92);
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / ms);
        const s = 0.92 + 0.08 * ease(t);
        this.content.scale.setScalar(s);
        if (t < 1) requestAnimationFrame(tick);
        else {
          this.transitioning = false;
          this.content.scale.setScalar(1);
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }
}

function ease(t: number) {
  return t * t * (3 - 2 * t);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
