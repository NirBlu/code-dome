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
import {
  createDomeWash,
  createDrivePlanet,
  createSpaceSky,
  tickSpaceMaterials,
} from './shaders';

interface LabelRec {
  sprite: THREE.Sprite;
  baseScale: number;
  y: number;
}

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
  private labels: LabelRec[] = [];
  private spaceSky: THREE.Mesh | null = null;
  private transitioning = false;

  constructor() {
    this.scene.background = new THREE.Color(0x0b1218);
    this.scene.fog = new THREE.FogExp2(0x0b1218, 0.009);
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
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material;
        if (mat) {
          const mats = Array.isArray(mat) ? mat : [mat];
          for (const m of mats) {
            if ((m as THREE.MeshStandardMaterial).map) {
              (m as THREE.MeshStandardMaterial).map?.dispose();
            }
            m.dispose();
          }
        }
      });
      this.content.remove(c);
    }
    this.labels = [];
    this.selectionMark = null;
    this.lots = [];
    this.spaceSky = null;
  }

  buildDome(view: FolderView, trail: AncestorRec[]) {
    this.clearContent();
    const { radius, lots } = layoutFolder(view);
    this.floorRadius = radius;
    this.lots = lots;

    const depth = view.depth;
    this.amb.intensity = ambientForDepth(depth);
    this.hemi.intensity = ambientForDepth(depth);
    const fogCol = new THREE.Color().setHSL(0.55, 0.18, Math.max(0.05, 0.09 - depth * 0.007));
    (this.scene.fog as THREE.FogExp2).color.copy(fogCol);
    (this.scene.fog as THREE.FogExp2).density = 0.008 + depth * 0.0018;
    this.scene.background = fogCol.clone();

    this.content.add(createFloor(radius, view.tint));
    this.content.add(buildSkyStack(view.ancestors, radius, depth));
    this.content.add(createDomeWash(radius, depth));

    for (const lot of lots) {
      if (lot.kind === 'file') {
        this.content.add(createBuildingMesh(lot));
        this.addWorldLabel(lot.name, lot.x, lot.height + 0.55, lot.z, 0.85);
      } else if (lot.kind === 'folder') {
        this.content.add(createChildGlobe(lot));
        this.addWorldLabel(lot.name, lot.x, lot.height + 0.35, lot.z, 1.05);
      } else if (lot.kind === 'gate') {
        this.content.add(createGate(lot, radius));
        // Gate label always prominent — destination is the exit cue
        this.addWorldLabel(lot.name, 0, 6.2, -radius + 1.0, 1.25, true);
      } else if (lot.kind === 'plaza') {
        this.addWorldLabel(view.name, 0, 2.0, 0, 1.25);
      }
    }
  }

  buildOrbit(worlds: WorldRoot[]) {
    this.clearContent();
    this.floorRadius = 80;
    this.scene.background = new THREE.Color(0x03050a);
    (this.scene.fog as THREE.FogExp2).color.set(0x03050a);
    (this.scene.fog as THREE.FogExp2).density = 0.0025;
    this.amb.intensity = 0.55;
    this.hemi.intensity = 0.4;

    this.spaceSky = createSpaceSky(240);
    this.content.add(this.spaceSky);

    const n = Math.max(1, worlds.length);
    const orbitR = n <= 2 ? 22 : n <= 4 ? 30 : 36;
    worlds.forEach((w, i) => {
      const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = Math.sin(ang) * orbitR;
      const z = Math.cos(ang) * orbitR;
      const globe = createDrivePlanet(w.tint, 6.5);
      globe.position.set(x, 0, z);
      globe.userData.world = w;
      globe.userData.isWorld = true;
      this.content.add(globe);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(8.2, 0.12, 8, 64),
        new THREE.MeshBasicMaterial({ color: 0x88bbee, transparent: true, opacity: 0.75 }),
      );
      ring.rotation.x = Math.PI / 2.35;
      ring.position.copy(globe.position);
      this.content.add(ring);

      // Soft atmosphere shell
      const atmo = new THREE.Mesh(
        new THREE.SphereGeometry(7.4, 32, 24),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(w.tint),
          transparent: true,
          opacity: 0.12,
          side: THREE.BackSide,
          depthWrite: false,
        }),
      );
      atmo.position.copy(globe.position);
      this.content.add(atmo);

      // Clear nameplate above world
      this.addWorldLabel(w.name, x, 10.2, z, 2.4, true);
      this.lots.push({
        id: `world:${w.path}`,
        kind: 'folder',
        name: w.name,
        x,
        z,
        radius: 6.5,
        height: 13,
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

  /** Scale all floor labels by camera distance — always on, never culled by proximity. */
  updateLabels(camera: THREE.Camera) {
    const camPos = camera.position;
    for (const rec of this.labels) {
      const d = rec.sprite.position.distanceTo(camPos);
      // Keep readable far away; shrink gently when very close to avoid HUD clutter
      const t = THREE.MathUtils.clamp(d / 28, 0.55, 1.65);
      const s = rec.baseScale * t;
      rec.sprite.scale.set(4.2 * s, 1.05 * s, 1);
      rec.sprite.visible = true;
      const mat = rec.sprite.material as THREE.SpriteMaterial;
      mat.opacity = THREE.MathUtils.clamp(0.55 + (1 - Math.min(d, 50) / 50) * 0.4, 0.55, 0.95);
    }
    tickSpaceMaterials(this.content, performance.now() * 0.001);
  }

  private addWorldLabel(
    text: string,
    x: number,
    y: number,
    z: number,
    scale: number,
    emphasize = false,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 72);

    // Soft chip background
    ctx.fillStyle = emphasize ? 'rgba(20,40,60,0.78)' : 'rgba(8,14,22,0.62)';
    roundRect(ctx, 10, 14, 300, 44, 12);
    ctx.fill();
    if (emphasize) {
      ctx.strokeStyle = 'rgba(140,200,240,0.55)';
      ctx.lineWidth = 2;
      roundRect(ctx, 10, 14, 300, 44, 12);
      ctx.stroke();
    }

    ctx.fillStyle = emphasize ? '#eaf6ff' : '#d8e8f6';
    ctx.font = emphasize ? '600 24px system-ui,sans-serif' : '500 22px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text.slice(0, 32), 160, 36);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const spr = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: true,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    spr.position.set(x, y, z);
    spr.scale.set(4.2 * scale, 1.05 * scale, 1);
    spr.renderOrder = 10;
    this.content.add(spr);
    this.labels.push({ sprite: spr, baseScale: scale, y });
  }

  beginTransition(ms = 450) {
    this.transitioning = true;
    this.content.scale.setScalar(0.9);
    return new Promise<void>((resolve) => {
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / ms);
        const s = 0.9 + 0.1 * ease(t);
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
