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

  ancestors.forEach((a, i) => {
    const t = (i + 1) / Math.max(1, ancestors.length + 1);
    const r = floorRadius * (1.12 + (ancestors.length - i) * 0.32);
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(a.tint || '#7aa'),
        transparent: true,
        opacity: 0.05 + t * 0.05,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    shell.position.y = 7 + i * 3.5;
    g.add(shell);
  });

  // Soft horizon cue (shader wash added separately in DomeScene)
  void depth;
  return g;
}

export function ambientForDepth(depth: number): number {
  return Math.max(0.38, 0.72 - depth * 0.06);
}
