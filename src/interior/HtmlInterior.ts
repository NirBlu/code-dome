import * as THREE from 'three';
import type { TreeFile } from '../types';

export interface HtmlRooms {
  group: THREE.Group;
  /** Spawn position inside lobby */
  spawn: THREE.Vector3;
}

/**
 * Civic HTML interior: lobby = head, halls = body sections, roof = footer/scripts.
 * Complexity lengthens halls / adds floors — never drops lobby or roof.
 */
export function buildHtmlInterior(file: TreeFile): HtmlRooms {
  const group = new THREE.Group();
  group.name = `interior:${file.path}`;

  const html = file.content || '<html><head><title>Empty</title></head><body></body></html>';
  const parsed = parseHtmlSkeleton(html);

  const lobbyH = 3.2;
  const hallLen = Math.max(8, 4 + parsed.bodySections.length * 3);
  const floors = Math.max(1, Math.min(5, Math.ceil(parsed.bodySections.length / 3)));

  // Lobby (head)
  const lobby = new THREE.Mesh(
    new THREE.BoxGeometry(10, lobbyH, 8),
    new THREE.MeshStandardMaterial({
      color: 0x88ccee,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
      metalness: 0.1,
      roughness: 0.4,
    }),
  );
  lobby.position.set(0, lobbyH / 2, 0);
  group.add(lobby);

  const lobbyFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a3a48, roughness: 0.8 }),
  );
  lobbyFloor.rotation.x = -Math.PI / 2;
  lobbyFloor.position.y = 0.01;
  group.add(lobbyFloor);

  // Reception desks for head children
  parsed.headItems.forEach((label, i) => {
    const desk = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xaad4ee }),
    );
    const col = i % 4;
    const row = Math.floor(i / 4);
    desk.position.set(-3 + col * 2, 0.45, -2 + row * 1.5);
    group.add(desk);
    addLabel(group, label.slice(0, 18), desk.position.x, 1.1, desk.position.z);
  });
  addLabel(group, 'LOBBY · <head>', 0, lobbyH - 0.4, 3.2);

  // Main stair / transition to body
  const stair = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 0.25, 3),
    new THREE.MeshStandardMaterial({ color: 0x667788 }),
  );
  stair.position.set(0, 0.2, -5);
  group.add(stair);

  // Body halls / wings
  let z = -8;
  for (let f = 0; f < floors; f++) {
    const y = f * 3.5;
    const sections = parsed.bodySections.slice(f * 3, f * 3 + 3);
    const len = Math.max(6, sections.length * 4);
    const hall = new THREE.Mesh(
      new THREE.BoxGeometry(8, 3.2, len),
      new THREE.MeshStandardMaterial({
        color: 0x6a9aaa,
        transparent: true,
        opacity: 0.28,
        side: THREE.BackSide,
      }),
    );
    hall.position.set(0, y + 1.6, z - len / 2);
    group.add(hall);

    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(8, len),
      new THREE.MeshStandardMaterial({ color: 0x243038 }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.set(0, y + 0.02, z - len / 2);
    group.add(floorMesh);

    sections.forEach((sec, i) => {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(3, 2.4, 2.5),
        new THREE.MeshStandardMaterial({ color: 0x7eb0c8, transparent: true, opacity: 0.5 }),
      );
      wing.position.set(i % 2 === 0 ? -2.2 : 2.2, y + 1.2, z - 2 - i * 3.2);
      group.add(wing);
      addLabel(group, sec, wing.position.x, y + 2.6, wing.position.z);
    });

    z -= len + 1;
  }

  // Roof plant (footer + end scripts) — always present
  const roofY = floors * 3.5 + 0.5;
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(9, 1.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.4, roughness: 0.45 }),
  );
  roof.position.set(0, roofY, -hallLen * 0.3);
  group.add(roof);
  addLabel(group, 'ROOF · footer / scripts', 0, roofY + 1.2, -hallLen * 0.3);
  parsed.roofItems.forEach((item, i) => {
    const plant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.3, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x99aabb, metalness: 0.6 }),
    );
    plant.position.set(-2 + i * 1.2, roofY + 1.1, -hallLen * 0.3);
    group.add(plant);
    addLabel(group, item.slice(0, 14), plant.position.x, roofY + 2, plant.position.z);
  });

  return { group, spawn: new THREE.Vector3(0, 1.7, 2) };
}

function addLabel(parent: THREE.Object3D, text: string, x: number, y: number, z: number) {
  // Lightweight sprite via canvas texture
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(10,20,30,0.75)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#dff';
  ctx.font = '20px system-ui,sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, 128, 40);
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(3, 0.75, 1);
  spr.position.set(x, y, z);
  parent.add(spr);
}

export interface HtmlSkeleton {
  headItems: string[];
  bodySections: string[];
  roofItems: string[];
}

export function parseHtmlSkeleton(html: string): HtmlSkeleton {
  const headItems: string[] = [];
  const bodySections: string[] = [];
  const roofItems: string[] = [];

  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (title) headItems.push(`title: ${title[1].trim() || '(empty)'}`);
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  metas.forEach((m, i) => {
    const name = m.match(/name=["']([^"']+)/i)?.[1] || m.match(/charset=/i) ? 'charset' : `meta${i}`;
    headItems.push(String(name));
  });
  const links = html.match(/<link\b[^>]*>/gi) || [];
  links.forEach((_, i) => headItems.push(`link[${i}]`));
  const styles = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || [];
  styles.forEach((_, i) => headItems.push(`style[${i}]`));
  if (!headItems.length) headItems.push('(head)');

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch?.[1] ?? html;
  const sectionRe = /<(header|nav|main|section|article|footer|div)\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();
  while ((m = sectionRe.exec(body))) {
    const tag = m[1].toLowerCase();
    // Only top-ish: skip tiny divs by requiring later length heuristic via capture next
    const key = `${tag}-${m.index}`;
    if (tag === 'div') {
      // large divs only: look ahead for substantial content
      const slice = body.slice(m.index, m.index + 400);
      if (slice.length < 80) continue;
    }
    if (tag === 'footer') {
      roofItems.push('footer');
      continue;
    }
    if (!seen.has(tag + headItems.length)) {
      bodySections.push(`<${tag}>`);
      seen.add(tag + bodySections.length);
    }
  }

  const scripts = body.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  // Prefer end scripts as roof
  scripts.slice(-3).forEach((_, i) => roofItems.push(`script[${i}]`));
  if (!bodySections.length) bodySections.push('<main>');
  if (!roofItems.length) roofItems.push('roof-plant');

  return { headItems, bodySections, roofItems };
}
