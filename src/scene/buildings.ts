import * as THREE from 'three';
import { speciesColor } from '../species/catalog';
import type { SpeciesId } from '../types';
import type { LotPlacement } from '../types';

export function createBuildingMesh(lot: LotPlacement): THREE.Object3D {
  const species = (lot.species ?? 'crate') as SpeciesId;
  const color = speciesColor(species);
  const g = new THREE.Group();
  g.name = lot.id;
  g.userData.lot = lot;

  const h = Math.max(1, lot.height);
  const w = 1.6 + Math.min(1.2, h * 0.05);
  const d = 1.4 + Math.min(1.0, h * 0.04);

  if (species === 'civic') {
    // Glass civic: taller translucent box + frame
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({
        color,
        metalness: 0.2,
        roughness: 0.25,
        transparent: true,
        opacity: 0.72,
      }),
    );
    glass.position.y = h / 2;
    g.add(glass);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.05, 0.12, d * 1.05),
      new THREE.MeshStandardMaterial({ color: 0xddeeff, metalness: 0.6, roughness: 0.3 }),
    );
    frame.position.y = h + 0.05;
    g.add(frame);
    // Lobby band
    const lobby = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.02, Math.min(1.2, h * 0.25), d * 1.02),
      new THREE.MeshStandardMaterial({ color: 0xaad4ee, metalness: 0.1, roughness: 0.4 }),
    );
    lobby.position.y = Math.min(1.2, h * 0.25) / 2;
    g.add(lobby);
  } else if (species === 'office' || species === 'office-py') {
    const mat = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.15,
      roughness: 0.55,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    g.add(body);
    // Window strips
    const floors = Math.max(2, Math.floor(h / 1.4));
    for (let i = 1; i < floors; i++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.92, 0.08, d * 1.01),
        new THREE.MeshStandardMaterial({ color: 0x223344, emissive: 0x112233, emissiveIntensity: 0.3 }),
      );
      strip.position.y = (i / floors) * h;
      g.add(strip);
    }
  } else if (species === 'library') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.2, h * 0.85, d * 1.3),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    );
    body.position.y = (h * 0.85) / 2;
    g.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.85, h * 0.25, 4),
      new THREE.MeshStandardMaterial({ color: 0x4a5a4a }),
    );
    roof.position.y = h * 0.85 + h * 0.12;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
  } else if (species === 'archive') {
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(w * 0.55, w * 0.65, h, 8),
      new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.45 }),
    );
    body.position.y = h / 2;
    g.add(body);
  } else if (species === 'vault') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.7, d),
      new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.35 }),
    );
    body.position.y = (h * 0.7) / 2;
    g.add(body);
    // Fence posts
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, h * 0.9, 0.08),
          new THREE.MeshStandardMaterial({ color: 0x334455 }),
        );
        post.position.set(sx * w * 0.7, (h * 0.9) / 2, sz * d * 0.7);
        g.add(post);
      }
    }
  } else if (species === 'billboard') {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.4, h * 0.3, d * 0.4),
      new THREE.MeshStandardMaterial({ color: 0x555555 }),
    );
    base.position.y = (h * 0.3) / 2;
    g.add(base);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.4, h * 0.7, 0.12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.15 }),
    );
    board.position.y = h * 0.3 + (h * 0.7) / 2;
    g.add(board);
  } else if (species === 'warehouse') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.5, h * 0.6, d * 1.5),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    body.position.y = (h * 0.6) / 2;
    g.add(body);
  } else if (species === 'paint') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.7, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.5 }),
    );
    body.position.y = (h * 0.7) / 2;
    g.add(body);
  } else if (species === 'theater') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.3, h * 0.8, d * 1.3),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    );
    body.position.y = (h * 0.8) / 2;
    g.add(body);
  } else if (species === 'garage') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.4, h * 0.55, d * 1.1),
      new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
    );
    body.position.y = (h * 0.55) / 2;
    g.add(body);
  } else {
    // crate
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.9, Math.min(h, 2.2), d * 0.9),
      new THREE.MeshStandardMaterial({ color, roughness: 0.75 }),
    );
    body.position.y = Math.min(h, 2.2) / 2;
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
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(r, 24, 16),
    new THREE.MeshStandardMaterial({
      color: tint,
      transparent: true,
      opacity: 0.45,
      metalness: 0.1,
      roughness: 0.35,
      side: THREE.DoubleSide,
    }),
  );
  sphere.position.y = r;
  g.add(sphere);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(r * 1.05, 0.08, 8, 32),
    new THREE.MeshStandardMaterial({ color: tint.clone().multiplyScalar(0.7), metalness: 0.5 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);
  // Industrial collapsed look
  if (lot.folderMeta?.collapsed) {
    sphere.material = new THREE.MeshStandardMaterial({
      color: 0x555555,
      metalness: 0.6,
      roughness: 0.4,
      transparent: true,
      opacity: 0.7,
    });
  }
  g.position.set(lot.x, 0, lot.z);
  return g;
}

export function createGate(lot: LotPlacement, floorRadius: number): THREE.Object3D {
  const g = new THREE.Group();
  g.name = lot.id;
  g.userData.lot = lot;
  const arch = new THREE.Mesh(
    new THREE.BoxGeometry(5, 6, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x445566, metalness: 0.3, roughness: 0.5 }),
  );
  arch.position.y = 3;
  g.add(arch);
  const opening = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 4.5, 1.4),
    new THREE.MeshStandardMaterial({
      color: 0x102030,
      emissive: 0x1a3048,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.85,
    }),
  );
  opening.position.y = 2.4;
  g.add(opening);
  g.position.set(0, 0, -floorRadius + 1.5);
  return g;
}

export function createFloor(radius: number, tint: string): THREE.Object3D {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 64),
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(tint).multiplyScalar(0.35),
      roughness: 0.9,
      metalness: 0.05,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = false;
  g.add(floor);

  const plaza = new THREE.Mesh(
    new THREE.CircleGeometry(4, 32),
    new THREE.MeshStandardMaterial({ color: 0x3a4a55, roughness: 0.7 }),
  );
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.02;
  g.add(plaza);

  // Outer wall low ring
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 2.2, 64, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x2a3540,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    }),
  );
  wall.position.y = 1.1;
  g.add(wall);

  return g;
}

export function createSelectionDecal(lot: LotPlacement): THREE.Object3D {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(lot.radius * 0.9, lot.radius * 1.25, 32),
    new THREE.MeshBasicMaterial({ color: 0xffee88, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(lot.x, 0.04, lot.z);
  return ring;
}
