import * as THREE from 'three';
import { WalkControls } from './controls/WalkControls';
import { loadDemoWorlds } from './data/demoLoader';
import {
  findFile,
  folderView,
  pathTrail,
  searchTree,
  worldFromDirectoryHandle,
} from './data/treeIndex';
import { Hud } from './hud/Hud';
import { buildHtmlInterior } from './interior/HtmlInterior';
import { hasInterior } from './species/catalog';
import { DomeScene } from './scene/DomeScene';
import type {
  AppLayer,
  FolderView,
  LotPlacement,
  SearchHit,
  WorldRoot,
} from './types';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
const dome = new DomeScene();
const controls = new WalkControls(camera, canvas);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

let worlds: WorldRoot[] = [];
let world: WorldRoot | null = null;
let cwd = '';
let view: FolderView | null = null;
let layer: AppLayer = 'orbit';
let selection: LotPlacement | null = null;
let interiorRoot: THREE.Object3D | null = null;
/** In-memory ancestor trail cache for instant Back */
const folderCache = new Map<string, FolderView>();

const hud = new Hud({
  onChipClick: (path) => void navigateTo(path),
  onExpandEllipsis: () => {
    if (world) hud.renderPath(pathTrail(world, cwd), view);
  },
  onCopyPath: async (path) => {
    try {
      await navigator.clipboard.writeText(path);
      hud.toast('Path copied');
    } catch {
      hud.toast('Copy failed');
    }
  },
  onEnterSelection: () => void activateSelection(),
  onOpenEditor: () => openEditorForSelection(),
  onCloseInspector: () => {
    selection = null;
    dome.setSelection(null);
    hud.hideInspector();
  },
  onSearch: (q) => {
    if (!world) return;
    hud.showSearch(searchTree(world, cwd, q));
  },
  onSearchPick: (hit) => void onSearchHit(hit),
  onOpenFolder: () => void pickLocalFolder(),
  onLoadDemo: () => void bootDemo(),
  onCloseEditor: () => hud.hideEditor(),
  onDepthHover: () => {
    /* sky pulse optional — rings already tinted */
  },
});

async function bootDemo() {
  worlds = await loadDemoWorlds();
  enterOrbit();
  hud.toast('Demo tree loaded');
}

function enterOrbit() {
  layer = 'orbit';
  world = null;
  cwd = '';
  view = null;
  selection = null;
  exitInterior(false);
  controls.setEnabled(false);
  dome.buildOrbit(worlds);
  camera.position.set(0, 22, 48);
  camera.lookAt(0, 0, 0);
  hud.setOrbitMode(true);
  hud.hideInspector();
  hud.hideEditor();
}

async function landOnWorld(w: WorldRoot) {
  world = w;
  folderCache.clear();
  await navigateTo(w.path, true);
}

async function navigateTo(path: string, fromOrbit = false) {
  if (!world) return;
  if (layer === 'interior') exitInterior(false);

  const cached = folderCache.get(path);
  const next = cached ?? folderView(world, path);
  if (!next) {
    hud.toast('Folder not found');
    return;
  }
  folderCache.set(path, next);

  await dome.beginTransition(fromOrbit ? 550 : 400);
  cwd = path;
  view = next;
  layer = 'dome';
  selection = null;
  dome.setSelection(null);
  hud.hideInspector();
  hud.resetExpand();

  const trail = pathTrail(world, cwd);
  dome.buildDome(view, trail);
  hud.setOrbitMode(false);
  hud.renderPath(trail, view);

  controls.setEnabled(true);
  // Spawn near plaza looking toward +Z (gate is -Z, so “in” faces away from gate initially a bit)
  controls.resetAt(0, 8, Math.PI);
  controls.eyeHeight = 1.7;
}

async function goUp() {
  if (!world || !view) return;
  if (view.parent) {
    await navigateTo(view.parent);
  } else {
    enterOrbit();
  }
}

async function activateSelection() {
  if (!selection) return;
  if (selection.kind === 'folder' && selection.path) {
    await navigateTo(selection.path);
  } else if (selection.kind === 'gate') {
    await goUp();
  } else if (selection.kind === 'file' && selection.file && selection.species && hasInterior(selection.species)) {
    enterHtmlInterior(selection);
  } else if (selection.kind === 'file') {
    openEditorForSelection();
  }
}

function openEditorForSelection() {
  if (!selection?.file) return;
  const f = selection.file;
  hud.showEditor(f.name, f.content ?? `(binary or empty — ${f.bytes} bytes)`);
}

function enterHtmlInterior(lot: LotPlacement) {
  if (!lot.file) return;
  exitInterior(false);
  layer = 'interior';
  const { group, spawn } = buildHtmlInterior(lot.file);
  interiorRoot = group;
  dome.scene.add(group);
  // Hide dome floor content visually by dimming — keep for return
  dome.root.visible = false;
  controls.resetAt(spawn.x, spawn.z, 0);
  controls.eyeHeight = spawn.y;
  camera.position.y = spawn.y;
  hud.toast(`Entered ${lot.name} (civic interior)`);
}

function exitInterior(restoreCam: boolean) {
  if (interiorRoot) {
    dome.scene.remove(interiorRoot);
    interiorRoot = null;
  }
  dome.root.visible = true;
  if (restoreCam && layer === 'interior') {
    layer = 'dome';
    controls.resetAt(selection?.x ?? 0, (selection?.z ?? 0) + 4, 0);
  }
  if (layer === 'interior') layer = 'dome';
}

async function onSearchHit(hit: SearchHit) {
  if (!world) return;
  if (hit.inCwd) {
    const lot = dome.lots.find((l) => l.path === hit.path);
    if (lot) selectLot(lot);
    return;
  }
  if (hit.nextDome) {
    hud.toast(`Enter dome toward ${hit.name}`);
    await navigateTo(hit.nextDome);
    // After enter, if hit is now in cwd select it; else beacon on containing globe
    const lot = dome.lots.find((l) => l.path === hit.path);
    if (lot) selectLot(lot);
    else {
      const beacon = dome.lots.find(
        (l) => l.kind === 'folder' && hit.path.startsWith(l.path + '/'),
      );
      if (beacon) selectLot(beacon);
    }
  } else if (hit.kind === 'folder') {
    await navigateTo(hit.path);
  }
}

function selectLot(lot: LotPlacement) {
  selection = lot;
  dome.setSelection(lot);
  hud.showInspector(lot);
}

async function pickLocalFolder() {
  const w = window as Window & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (!w.showDirectoryPicker) {
    hud.toast('File System Access not available — loading demo');
    await bootDemo();
    return;
  }
  try {
    const handle = await w.showDirectoryPicker();
    const wr = await worldFromDirectoryHandle(handle);
    worlds = [wr];
    await landOnWorld(wr);
    hud.toast(`Opened ${wr.name}`);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      console.error(e);
      hud.toast('Folder open failed — try Demo');
    }
  }
}

function onPointer(clientX: number, clientY: number) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return dome.pick(raycaster);
}

let lastClick = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  // When pointer lock is on, click is look — use center ray for interact with optional Alt
  const useCenter = controls.pointerLocked;
  const hit = useCenter
    ? (() => {
        pointer.set(0, 0);
        raycaster.setFromCamera(pointer, camera);
        return dome.pick(raycaster);
      })()
    : onPointer(e.clientX, e.clientY);

  if (!hit) return;

  if (layer === 'orbit' && hit.world) {
    void landOnWorld(hit.world);
    return;
  }

  if (hit.lot) {
    const now = performance.now();
    const dbl = now - lastClick < 350 && selection?.id === hit.lot.id;
    lastClick = now;
    selectLot(hit.lot);
    if (dbl || hit.lot.kind === 'gate') {
      void activateSelection();
    }
  }
});

// Minimap click → face/move toward lot
document.getElementById('minimap')!.addEventListener('click', (e) => {
  if (!view || layer !== 'dome') return;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const W = rect.width;
  const H = rect.height;
  const scale = ((W / 2 - 8) / dome.floorRadius) * 0.92;
  const x = (mx - W / 2) / scale;
  const z = (my - H / 2) / scale;
  // Find nearest lot
  let best: LotPlacement | null = null;
  let bestD = Infinity;
  for (const lot of dome.lots) {
    if (lot.kind === 'plaza') continue;
    const d = Math.hypot(lot.x - x, lot.z - z);
    if (d < bestD) {
      bestD = d;
      best = lot;
    }
  }
  if (best && bestD < 8) {
    selectLot(best);
    const yaw = Math.atan2(best.x - camera.position.x, best.z - camera.position.z);
    controls.resetAt(camera.position.x, camera.position.z, yaw);
  }
});

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.code === 'Escape') {
    if (layer === 'interior') {
      exitInterior(true);
      if (selection) controls.resetAt(selection.x, selection.z + 3, 0);
      return;
    }
    if (hud) {
      /* close editor/search */
    }
    document.getElementById('editor-pane')!.classList.add('hidden');
    void goUp();
    return;
  }
  if (e.code === 'Enter' && selection) {
    void activateSelection();
  }
  if (e.code === 'Backspace' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    void goUp();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  if (layer === 'dome' || layer === 'interior') {
    const clamp = layer === 'interior' ? 40 : dome.floorRadius;
    controls.update(dt, clamp);
  } else if (layer === 'orbit') {
    camera.position.x = Math.sin(performance.now() * 0.00008) * 48;
    camera.position.z = Math.cos(performance.now() * 0.00008) * 48;
    camera.position.y = 22;
    camera.lookAt(0, 0, 0);
  }

  if (layer === 'dome' && view) {
    hud.drawMinimap(
      dome.lots,
      dome.floorRadius,
      camera.position.x,
      camera.position.z,
      controls.facingYaw(),
    );
  }

  renderer.render(dome.scene, camera);
  requestAnimationFrame(frame);
}

// Expose findFile for debugging
void findFile;

bootDemo()
  .then(() => {
    requestAnimationFrame(frame);
  })
  .catch((err) => {
    console.error(err);
    hud.toast('Failed to load demo');
    requestAnimationFrame(frame);
  });
