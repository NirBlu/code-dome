import * as THREE from 'three';
import { speciesColor } from '../species/catalog';
import type { SpeciesId } from '../types';
import type { LotPlacement } from '../types';
import {
  createGlassMaterial,
  createToonBodyMaterial,
  makeNoiseTexture,
} from './shaders';

export function createBuildingMesh(lot: LotPlacement): THREE.Object3D {
  const species = (lot.species ?? 'crate') as SpeciesId;
  const color = speciesColor(species);
  const g = new THREE.Group();
  g.name = lot.id;
  g.userData.lot = lot;

  const h = Math.max(1, lot.height);
  const w = 1.35 + Math.min(0.9, h * 0.04);
  const d = 1.2 + Math.min(0.8, h * 0.035);

  if (species === 'civic') {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      createGlassMaterial(color, 0.62),
    );
    glass.position.y = h / 2;
    g.add(glass);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.05, 0.1, d * 1.05),
      new THREE.MeshStandardMaterial({ color: 0xddeeff, metalness: 0.55, roughness: 0.28 }),
    );
    frame.position.y = h + 0.04;
    g.add(frame);
    const lobby = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.02, Math.min(1.0, h * 0.22), d * 1.02),
      new THREE.MeshStandardMaterial({ color: 0xaad4ee, metalness: 0.12, roughness: 0.38 }),
    );
    lobby.position.y = Math.min(1.0, h * 0.22) / 2;
    g.add(lobby);
  } else if (species === 'office' || species === 'office-py') {
    const mat = createToonBodyMaterial(color, { metalness: 0.14, roughness: 0.52 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    g.add(body);
    const floors = Math.max(2, Math.floor(h / 1.15));
    for (let i = 1; i < floors; i++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.92, 0.07, d * 1.01),
        new THREE.MeshStandardMaterial({
          color: 0x223344,
          emissive: 0x112233,
          emissiveIntensity: 0.35,
        }),
      );
      strip.position.y = (i / floors) * h;
      g.add(strip);
    }
  } else if (species === 'library') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.15, h * 0.85, d * 1.25),
      createToonBodyMaterial(color, { roughness: 0.72 }),
    );
    body.position.y = (h * 0.85) / 2;
    g.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.8, h * 0.22, 4),
      new THREE.MeshStandardMaterial({ color: 0x4a5a4a, roughness: 0.65 }),
    );
    roof.position.y = h * 0.85 + h * 0.1;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  } else if (species === 'archive') {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.5, w * 0.6, h, 8),
      createToonBodyMaterial(color, { metalness: 0.4, roughness: 0.42 }),
    );
    body.position.y = h / 2;
    g.add(body);
  } else if (species === 'vault') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.7, d),
      createToonBodyMaterial(color, { metalness: 0.7, roughness: 0.32 }),
    );
    body.position.y = (h * 0.7) / 2;
    g.add(body);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.07, h * 0.85, 0.07),
          new THREE.MeshStandardMaterial({ color: 0x334455 }),
        );
        post.position.set(sx * w * 0.68, (h * 0.85) / 2, sz * d * 0.68);
        g.add(post);
      }
    }
  } else if (species === 'billboard') {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.35, h * 0.28, d * 0.35),
      new THREE.MeshStandardMaterial({ color: 0x555555 }),
    );
    base.position.y = (h * 0.28) / 2;
    g.add(base);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.3, h * 0.65, 0.1),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18 }),
    );
    board.position.y = h * 0.28 + (h * 0.65) / 2;
    g.add(board);
  } else if (species === 'warehouse') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.4, h * 0.55, d * 1.4),
      createToonBodyMaterial(color, { roughness: 0.82 }),
    );
    body.position.y = (h * 0.55) / 2;
    g.add(body);
  } else if (species === 'paint') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.65, d),
      createToonBodyMaterial(color, { roughness: 0.48 }),
    );
    body.position.y = (h * 0.65) / 2;
    g.add(body);
  } else if (species === 'theater') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.25, h * 0.75, d * 1.25),
      createToonBodyMaterial(color, { roughness: 0.58 }),
    );
    body.position.y = (h * 0.75) / 2;
    g.add(body);
  } else if (species === 'garage') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.3, h * 0.5, d),
      createToonBodyMaterial(color, { roughness: 0.62 }),
    );
    body.position.y = (h * 0.5) / 2;
    g.add(body);
  } else {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.85, Math.min(h, 2.0), d * 0.85),
      createToonBodyMaterial(color, { roughness: 0.78 }),
    );
    body.position.y = Math.min(h, 2.0) / 2;
    g.add(body);
  }

  g.position.set(lot.x, 0, lot.z);
  return g;
}

export function createChildGlobe(lot: LotPlacement): THREE.Object3D {
  const g = new THREE.Group();
  g.name = lot.id;
  g.userData.lot = lot;
  const tint = new THREE.Color(lot.tint || '#8cf');
  const r = lot.radius;

  if (lot.folderMeta?.collapsed) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(r, 24, 16),
      createToonBodyMaterial(0x555555, { metalness: 0.55, roughness: 0.38 }),
    );
    (sphere.material as THREE.MeshStandardMaterial).transparent = true;
    (sphere.material as THREE.MeshStandardMaterial).opacity = 0.82;
    sphere.position.y = r;
    g.add(sphere);
  } else {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(r, 28, 20),
      createGlassMaterial(tint, 0.42),
    );
    sphere.position.y = r;
    g.add(sphere);
    // Soft core so sealed globe reads as filled, not empty city
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(r * 0.35, 12, 10),
      new THREE.MeshStandardMaterial({
        color: tint.clone().multiplyScalar(0.55),
        emissive: tint,
        emissiveIntensity: 0.15,
        roughness: 0.6,
      }),
    );
    core.position.y = r;
    g.add(core);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.05, 0.07, 8, 36),
    new THREE.MeshStandardMaterial({
      color: tint.clone().multiplyScalar(0.75),
      metalness: 0.55,
      roughness: 0.35,
      emissive: tint,
      emissiveIntensity: 0.08,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.04;
  g.add(ring);
  g.position.set(lot.x, 0, lot.z);
  return g;
}

export function createGate(lot: LotPlacement, floorRadius: number): THREE.Object3D {
  const g = new THREE.Group();
  g.name = lot.id;
  g.userData.lot = lot;

  // Pillars
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x556677,
    metalness: 0.35,
    roughness: 0.45,
    emissive: 0x1a3048,
    emissiveIntensity: 0.25,
  });
  for (const sx of [-2.2, 2.2]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.8, 0.9), pillarMat);
    pillar.position.set(sx, 2.9, 0);
    g.add(pillar);
  }
  // Lintel
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.7, 1.1),
    new THREE.MeshStandardMaterial({
      color: 0x6a8aaa,
      metalness: 0.4,
      roughness: 0.4,
      emissive: 0x224466,
      emissiveIntensity: 0.35,
    }),
  );
  lintel.position.y = 5.5;
  g.add(lintel);

  // Glowing portal membrane
  const opening = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 4.6),
    new THREE.MeshStandardMaterial({
      color: 0x102838,
      emissive: 0x3a8ecc,
      emissiveIntensity: 0.65,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    }),
  );
  opening.position.set(0, 2.5, 0);
  g.add(opening);

  // Chevrons pointing “out” (-Z) so exit is obvious
  const chevronMat = new THREE.MeshBasicMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.55, 3), chevronMat);
    c.rotation.x = Math.PI;
    c.position.set(0, 1.2 + i * 0.7, -0.7);
    g.add(c);
  }

  g.position.set(0, 0, -floorRadius + 1.2);
  return g;
}

export function createFloor(radius: number, tint: string): THREE.Object3D {
  const g = new THREE.Group();
  const baseColor = new THREE.Color(tint).multiplyScalar(0.32);
  const floorMap = makeNoiseTexture(128, '#' + baseColor.getHexString(), true);
  floorMap.repeat.set(radius / 4, radius / 4);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: floorMap,
      roughness: 0.88,
      metalness: 0.06,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  g.add(floor);

  const plazaMap = makeNoiseTexture(64, '#3a4a55', true);
  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 32),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: plazaMap,
      roughness: 0.65,
      metalness: 0.12,
    }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  g.add(plaza);

  // Outer wall — subtle frosted band
  const wallMap = makeNoiseTexture(64, '#2a3540', false);
  wallMap.repeat.set(16, 1);
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 2.0, 64, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0x2a3540,
      map: wallMap,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
      roughness: 0.4,
      metalness: 0.15,
      transmission: 0.15,
    }),
  );
  wall.position.y = 1.0;
  g.add(wall);

  // Thin bright rim on wall top for horizon read
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.06, 6, 64),
    new THREE.MeshBasicMaterial({ color: 0x6a9bbb, transparent: true, opacity: 0.55 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 2.0;
  g.add(rim);

  return g;
}

export function createSelectionDecal(lot: LotPlacement): THREE.Object3D {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(lot.radius * 0.85, lot.radius * 1.2, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffee88,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(lot.x, 0.04, lot.z);
  return ring;
}
