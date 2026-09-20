import * as THREE from 'three';
import type { AncestorRec } from '../types';

/** Ancestor glass shells only — no cities. */
export function buildSkyStack(
  ancestors: AncestorRec[],
  floorRadius: number,
  depth: number,
): THREE.Object3D {
  const g = new THREE.Group();
  g.name = 'skyStack';

  // Concentric shells: outermost = root ancestor, inward toward cwd
  ancestors.forEach((a, i) => {
    const t = (i + 1) / Math.max(1, ancestors.length + 1);
    const r = floorRadius * (1.15 + (ancestors.length - i) * 0.35);
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(a.tint || '#7aa'),
        transparent: true,
        opacity: 0.06 + t * 0.05,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    shell.position.y = 8 + i * 4;
    g.add(shell);
  });

  // Horizon fog cue via a large dome wash
  const wash = new THREE.Mesh(
    new THREE.SphereGeometry(floorRadius * 2.8, 24, 12),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(0.55, 0.15, Math.max(0.12, 0.35 - depth * 0.04)),
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.35 + Math.min(0.35, depth * 0.06),
      depthWrite: false,
    }),
  );
  wash.position.y = 10;
  g.add(wash);

  return g;
}

export function ambientForDepth(depth: number): number {
  return Math.max(0.35, 0.75 - depth * 0.07);
}
