import {
  buildingHeight,
  childDomeDiameter,
  floorRadius,
  speciesForFile,
} from '../species/catalog';
import type { FolderView, LotPlacement } from '../types';

/** Stable 32-bit hash of a string (FNV-1a). */
export function hashName(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededAngle(name: string, index: number, total: number): number {
  const h = hashName(name);
  const base = (index / Math.max(1, total)) * Math.PI * 2;
  const jitter = ((h % 1000) / 1000 - 0.5) * (Math.PI * 2) / Math.max(8, total * 2);
  return base + jitter;
}

const SPECIES_QUARTER: Record<string, number> = {
  civic: 0,
  office: Math.PI * 0.25,
  'office-py': Math.PI * 0.35,
  archive: Math.PI * 0.6,
  library: Math.PI * 0.85,
  paint: Math.PI * 1.1,
  billboard: Math.PI * 1.35,
  theater: Math.PI * 1.5,
  vault: Math.PI * 1.65,
  warehouse: Math.PI * 1.8,
  garage: Math.PI * 1.95,
  crate: Math.PI * 2.1,
};

export function layoutFolder(view: FolderView): { radius: number; lots: LotPlacement[] } {
  const entryCount = view.files.length + view.folders.length;
  const radius = floorRadius(entryCount);
  const lots: LotPlacement[] = [];

  const plazaR = 1.8;
  lots.push({
    id: 'plaza',
    kind: 'plaza',
    name: view.name,
    x: 0,
    z: 0,
    radius: plazaR,
    height: 0.05,
  });

  // Parent gate always at -Z — label names the destination clearly
  const parentName = view.ancestors.length
    ? view.ancestors[view.ancestors.length - 1].name
    : null;
  lots.push({
    id: 'gate',
    kind: 'gate',
    name: parentName ? `↑ ${parentName}` : '↑ orbit',
    x: 0,
    z: -radius + 1.0,
    radius: 2.0,
    height: 5.5,
    path: view.parent ?? undefined,
  });

  // Child domes first — largest first, tighter ring
  const folders = [...view.folders].sort((a, b) => {
    if (b.subtreeFiles !== a.subtreeFiles) return b.subtreeFiles - a.subtreeFiles;
    return a.name.localeCompare(b.name);
  });

  const domeRing = radius * 0.42;
  folders.forEach((f, i) => {
    const diam = childDomeDiameter(f.subtreeFiles);
    const ang = seededAngle(f.name, i, Math.max(folders.length, 1)) + hashName(view.path) * 1e-9;
    const r = domeRing + (hashName(f.name) % 5) * 0.12;
    lots.push({
      id: `folder:${f.path}`,
      kind: 'folder',
      name: f.name,
      x: Math.sin(ang) * r,
      z: Math.cos(ang) * r,
      radius: diam / 2,
      height: diam,
      tint: f.tint,
      path: f.path,
      folderMeta: f,
    });
  });

  // Buildings in remaining lots — denser, still no overlap with globes
  const occupied = lots
    .filter((l) => l.kind === 'folder')
    .map((l) => ({ x: l.x, z: l.z, r: l.radius + 0.55 }));

  // Keep plaza clear
  occupied.push({ x: 0, z: 0, r: plazaR + 0.4 });
  // Keep gate approach clear
  occupied.push({ x: 0, z: -radius + 1.0, r: 2.4 });

  const files = [...view.files].sort((a, b) => a.name.localeCompare(b.name));
  const buildRing = radius * 0.22;
  const lotPad = 0.72;

  files.forEach((file, i) => {
    const species = speciesForFile(file);
    const quarter = SPECIES_QUARTER[species] ?? 0;
    const h = hashName(file.name + view.path);
    let placed = false;
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 36 && !placed; attempt++) {
      const ang =
        quarter +
        (((h + attempt * 997) % 1000) / 1000) * (Math.PI * 0.42) -
        Math.PI * 0.21;
      const rad = buildRing + (((h >> (attempt + 3)) % 100) / 100) * (radius * 0.28);
      x = Math.sin(ang) * rad;
      z = Math.cos(ang) * rad;
      const ok = occupied.every((o) => {
        const dx = o.x - x;
        const dz = o.z - z;
        return Math.hypot(dx, dz) > o.r + lotPad;
      });
      if (ok) placed = true;
    }
    if (!placed) {
      const ang = seededAngle(file.name, i, files.length);
      x = Math.sin(ang) * (buildRing + 0.9);
      z = Math.cos(ang) * (buildRing + 0.9);
    }
    const height = buildingHeight(file);
    const lot: LotPlacement = {
      id: `file:${file.path}`,
      kind: 'file',
      name: file.name,
      x,
      z,
      radius: 0.72,
      height,
      species,
      path: file.path,
      file,
    };
    lots.push(lot);
    occupied.push({ x, z, r: 0.95 });
  });

  return { radius, lots };
}
