import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { WalkControls } from './controls/WalkControls';
import { loadDemoWorlds } from './data/demoLoader';
import {
  clearTreeCache,
  fetchDrives,
  fetchFileContent,
  isLocalApiWorld,
  loadApiFolderView,
  pathTrailFromApiView,
  pickPreferredDrive,
  probeLocalDrivesApi,
  worldStubFromDrive,
} from './data/localFsApi';
import { worldFromWebkitFileList } from './data/webkitDirLoader';
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
renderer.outputColorSpace = THREE.SRGBColorSpace;

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 800);
const dome = new DomeScene();
const controls = new WalkControls(camera, canvas);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/** OrbitControls is disposed while walking so it cannot eat events or fight quaternion. */
let orbitControls: OrbitControls | null = null;

function createOrbitControls(): OrbitControls {
  const oc = new OrbitControls(camera, canvas);
  oc.enableDamping = true;
  oc.dampingFactor = 0.08;
  oc.enablePan = true;
  oc.enableZoom = true;
  oc.minDistance = 12;
  oc.maxDistance = 160;
  oc.maxPolarAngle = Math.PI * 0.92;
  oc.enabled = true;
  return oc;
}

function disposeOrbitControls() {
  if (!orbitControls) return;
  orbitControls.enabled = false;
  orbitControls.dispose();
  orbitControls = null;
}

let worlds: WorldRoot[] = [];
let world: WorldRoot | null = null;
let cwd = '';
let view: FolderView | null = null;
let layer: AppLayer = 'orbit';
let selection: LotPlacement | null = null;
let interiorRoot: THREE.Object3D | null = null;
/** In-memory ancestor trail cache for instant Back */
const folderCache = new Map<string, FolderView>();

/** Track orbit click vs drag so free camera doesn't accidental-land. */
let orbitPtrDown = false;
let orbitPtrMoved = false;
let orbitPtrX = 0;
let orbitPtrY = 0;

const folderInput = document.getElementById('folder-input') as HTMLInputElement | null;
let localDrivesAvailable = false;

const LOOK_HINT = 'Click view to look around · Esc to release';

const hud = new Hud({
  onChipClick: (path) => void navigateTo(path),
  onExpandEllipsis: () => {
    if (world && view) {
      const trail =
        isLocalApiWorld(world) ? pathTrailFromApiView(world, view) : pathTrail(world, cwd);
      hud.renderPath(trail, view);
    }
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
  onOpenEditor: () => void openEditorForSelection(),
  onCloseInspector: () => {
    selection = null;
    dome.setSelection(null);
    hud.hideInspector();
  },
  onSearch: (q) => {
    if (!world) return;
    if (isLocalApiWorld(world)) {
      // Search within currently loaded tree cache
      hud.showSearch(searchTree(world, cwd, q));
      return;
    }
    hud.showSearch(searchTree(world, cwd, q));
  },
  onSearchPick: (hit) => void onSearchHit(hit),
  onOpenFolder: () => void pickLocalFolder(),
  onBrowseFolder: () => triggerWebkitBrowse(),
  onMyComputer: () => void openMyComputer(),
  onLoadDemo: () => void bootDemo(),
  onCloseEditor: () => hud.hideEditor(),
  onDepthHover: () => {
    /* sky pulse optional — rings already tinted */
  },
});

async function bootDemo() {
  worlds = await loadDemoWorlds();
  enterOrbit();
  hud.toast('Demo galaxy loaded · click a world to land');
}

function enterOrbit(fromDrive = false) {
  layer = 'orbit';
  world = null;
  cwd = '';
  view = null;
  selection = null;
  exitInterior(false);
  controls.setEnabled(false);
  disposeOrbitControls();
  dome.buildOrbit(worlds);
  camera.position.set(0, 28, 55);
  // lookAt only allowed in orbit layer (never while walking)
  camera.lookAt(0, 0, 0);
  orbitControls = createOrbitControls();
  orbitControls.target.set(0, 0, 0);
  orbitControls.update();
  hud.setOrbitMode(true);
  hud.hideInspector();
  hud.hideEditor();
  hud.setLookBanner(false);
  if (fromDrive) hud.toast('Back to orbit · pan/zoom freely · click a world to land');
}

async function landOnWorld(w: WorldRoot) {
  world = w;
  folderCache.clear();
  // Fully disconnect OrbitControls before walk look takes over
  disposeOrbitControls();
  controls.setEnabled(false);
  hud.toast(`Landing on ${w.name}…`);
  await navigateTo(w.path, true);
}

async function navigateTo(path: string, fromOrbit = false) {
  if (!world) return;
  if (layer === 'interior') exitInterior(false);

  let next: FolderView | null = null;

  if (isLocalApiWorld(world)) {
    try {
      next = await loadApiFolderView(world, path);
    } catch (e) {
      console.error(e);
      hud.toast(`Cannot open ${path}`);
      return;
    }
  } else {
    const cached = folderCache.get(path);
    next = cached ?? folderView(world, path);
    if (next) folderCache.set(path, next);
  }

  if (!next) {
    hud.toast('Folder not found');
    return;
  }

  const prevPath = cwd;
  await dome.beginTransition(fromOrbit ? 550 : 400);
  cwd = path;
  view = next;
  layer = 'dome';
  selection = null;
  dome.setSelection(null);
  hud.hideInspector();
  hud.resetExpand();

  const trail =
    isLocalApiWorld(world) ? pathTrailFromApiView(world, view) : pathTrail(world, cwd);
  dome.buildDome(view, trail);
  hud.setOrbitMode(false);
  hud.renderPath(trail, view);
  hud.setLookBanner(true, LOOK_HINT);

  // Ensure orbit is gone; walk owns the camera
  disposeOrbitControls();
  controls.setEnabled(true);
  controls.resetAt(0, 5.5, Math.PI);
  controls.eyeHeight = 1.7;

  if (fromOrbit) {
    hud.toast(`Entered ${view.name} (drive root) · gate ↑ orbit`);
  } else if (prevPath && path.length < prevPath.length) {
    hud.toast(`Up to ${view.name}`);
  } else if (prevPath !== path) {
    hud.toast(`Entered ${view.name}`);
  }
}

async function goUp() {
  if (!world || !view) return;
  if (view.parent) {
    const parentName = view.ancestors[view.ancestors.length - 1]?.name ?? 'parent';
    hud.toast(`Exiting → ${parentName}`);
    await navigateTo(view.parent);
  } else {
    enterOrbit(true);
  }
}

async function activateSelection() {
  if (!selection) return;
  if (selection.kind === 'folder' && selection.path) {
    hud.toast(`Crossing membrane → ${selection.name}`);
    await navigateTo(selection.path);
  } else if (selection.kind === 'gate') {
    await goUp();
  } else if (selection.kind === 'file' && selection.file && selection.species && hasInterior(selection.species)) {
    enterHtmlInterior(selection);
  } else if (selection.kind === 'file') {
    void openEditorForSelection();
  }
}

async function openEditorForSelection() {
  if (!selection?.file) return;
  const f = selection.file;
  let content = f.content;
  if (!content && isLocalApiWorld(world) && f.path) {
    content = await fetchFileContent(f.path);
    if (content) f.content = content;
  }
  hud.showEditor(f.name, content ?? `(binary or empty — ${f.bytes} bytes)`);
}

function enterHtmlInterior(lot: LotPlacement) {
  if (!lot.file) return;
  exitInterior(false);
  layer = 'interior';
  disposeOrbitControls();
  const { group, spawn } = buildHtmlInterior(lot.file);
  interiorRoot = group;
  dome.scene.add(group);
  dome.root.visible = false;
  controls.setEnabled(true);
  controls.resetAt(spawn.x, spawn.z, 0);
  controls.eyeHeight = spawn.y;
  camera.position.y = spawn.y;
  hud.setLookBanner(true, LOOK_HINT);
  hud.toast(`Entered ${lot.name} (civic interior) · Esc to exit`);
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
    hud.toast('Back to dome floor');
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

function triggerWebkitBrowse() {
  if (!folderInput) {
    hud.toast('Browser pick not available');
    return;
  }
  folderInput.value = '';
  folderInput.click();
}

async function ingestWebkitFiles(fileList: FileList | null) {
  if (!fileList || !fileList.length) return;
  try {
    hud.toast('Reading folder…');
    const wr = await worldFromWebkitFileList(fileList);
    upsertWorld(wr);
    await landOnWorld(wr);
    hud.toast(`Mapped “${wr.name}” (browser snapshot) · Esc to orbit`);
  } catch (e) {
    console.error(e);
    hud.toast('Browser pick failed');
  }
}

function upsertWorld(wr: WorldRoot) {
  const idx = worlds.findIndex(
    (x) => x.name === wr.name || x.path === wr.path || x.path === `/${wr.name}`,
  );
  if (idx >= 0) worlds[idx] = wr;
  else worlds.push(wr);
}

async function pickLocalFolder() {
  const w = window as Window & {
    showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (w.showDirectoryPicker) {
    try {
      const handle = await w.showDirectoryPicker();
      const wr = await worldFromDirectoryHandle(handle);
      upsertWorld(wr);
      await landOnWorld(wr);
      hud.toast(`Mapped “${wr.name}” as a world · Esc to orbit`);
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      console.error(e);
      hud.toast('Folder open failed — try My computer (npm run dev) or Browser pick…');
      return;
    }
  }

  if (localDrivesAvailable) {
    hud.toast('Use My computer for live disks (or Browser pick… under Advanced)');
    void openMyComputer();
  } else if (folderInput) {
    hud.toast('Run npm run dev for live disks — or use Browser pick…');
    triggerWebkitBrowse();
  } else {
    hud.toast('Run via npm run dev to browse real disks');
  }
}

async function openMyComputer(opts?: { autoLand?: boolean; quiet?: boolean }) {
  if (!localDrivesAvailable) {
    hud.setStaticHint(true);
    hud.toast('Run via npm run dev to browse real disks');
    return;
  }
  try {
    clearTreeCache();
    const drives = await fetchDrives();
    if (!drives.length) {
      hud.toast('No disks found under /home /media /mnt /tmp');
      return;
    }
    const kept = worlds.filter((w) => !isLocalApiWorld(w));
    const apiWorlds = drives.map((d, i) => worldStubFromDrive(d, i));
    worlds = [...kept, ...apiWorlds];

    const preferred = pickPreferredDrive(drives);
    if (opts?.autoLand && preferred) {
      const wr = apiWorlds.find((w) => w.path === preferred.path) ?? apiWorlds[0];
      if (!opts.quiet) hud.toast(`My computer · landing on ${wr.name}`);
      await landOnWorld(wr);
      return;
    }

    enterOrbit();
    if (!opts?.quiet) {
      hud.toast(`${drives.length} local disks · click one to land (My computer refreshes)`);
    }
  } catch (e) {
    console.error(e);
    hud.toast('Could not list local disks');
  }
}

function onPointer(clientX: number, clientY: number) {
  pointer.x = (clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  return dome.pick(raycaster);
}

let lastClick = 0;
let domePtrDown = false;
let domePtrX = 0;
let domePtrY = 0;

canvas.addEventListener('pointerdown', (e) => {
  if (layer === 'orbit') {
    if (e.button === 0) {
      orbitPtrDown = true;
      orbitPtrMoved = false;
      orbitPtrX = e.clientX;
      orbitPtrY = e.clientY;
    }
    return;
  }

  if (e.button !== 0) return;
  domePtrDown = true;
  domePtrX = e.clientX;
  domePtrY = e.clientY;
});

canvas.addEventListener('pointermove', (e) => {
  if (layer === 'orbit' && orbitPtrDown) {
    if (Math.hypot(e.clientX - orbitPtrX, e.clientY - orbitPtrY) > 5) {
      orbitPtrMoved = true;
    }
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (layer === 'orbit' && e.button === 0 && orbitPtrDown) {
    orbitPtrDown = false;
    if (!orbitPtrMoved) {
      const hit = onPointer(e.clientX, e.clientY);
      if (hit?.world) void landOnWorld(hit.world);
    }
    return;
  }

  if ((layer === 'dome' || layer === 'interior') && e.button === 0 && domePtrDown) {
    domePtrDown = false;
    // Skip select if this was a look-drag
    if (controls.wasDragLook()) return;
    if (Math.hypot(e.clientX - domePtrX, e.clientY - domePtrY) > 6) return;

    const useCenter = controls.pointerLocked;
    const hit = useCenter
      ? (() => {
          pointer.set(0, 0);
          raycaster.setFromCamera(pointer, camera);
          return dome.pick(raycaster);
        })()
      : onPointer(e.clientX, e.clientY);

    if (!hit?.lot) return;
    const now = performance.now();
    const dbl = now - lastClick < 350 && selection?.id === hit.lot.id;
    lastClick = now;
    selectLot(hit.lot);
    if (dbl || hit.lot.kind === 'gate') {
      void activateSelection();
    }
  }
});

if (folderInput) {
  folderInput.addEventListener('change', () => {
    void ingestWebkitFiles(folderInput.files);
  });
}

document.getElementById('minimap')!.addEventListener('click', (e) => {
  if (!view || layer !== 'dome') return;
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const W = rect.width;
  const H = rect.height;
  // Account for legend strip (~28px) matching Hud.drawMinimap layout
  const mapH = H - 28;
  const mapSize = Math.min(W, mapH) - 16;
  const cx = W / 2;
  const cy = mapH / 2 + 4;
  const scale = (mapSize / 2 / dome.floorRadius) * 0.95;
  const x = (mx - cx) / scale;
  const z = (my - cy) / scale;
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
    // Unlock pointer first if locked
    if (controls.unlockPointer()) {
      hud.toast('Pointer unlocked · Esc again to go up');
      return;
    }
    if (layer === 'interior') {
      exitInterior(true);
      if (selection) controls.resetAt(selection.x, selection.z + 3, 0);
      return;
    }
    document.getElementById('editor-pane')!.classList.add('hidden');
    if (layer === 'orbit') return;
    void goUp();
    return;
  }
  if (e.code === 'Enter' && selection) {
    void activateSelection();
  }
  if (e.code === 'Backspace' && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    if (layer !== 'orbit') void goUp();
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
  } else if (layer === 'orbit' && orbitControls) {
    orbitControls.update();
  }

  dome.updateLabels(camera);

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

void findFile;

async function init() {
  requestAnimationFrame(frame);

  localDrivesAvailable = await probeLocalDrivesApi();
  hud.setLocalApiMode(localDrivesAvailable);

  if (localDrivesAvailable) {
    // Primary path: live ls via /api/drives + /api/tree — no upload / Open-folder gate
    await openMyComputer({ autoLand: true });
  } else {
    // Static preview: one-line hint + optional demo — never push upload UI
    worlds = [];
    enterOrbit();
    hud.setStaticHint(true);
    hud.toast('Run via npm run dev to browse real disks');
  }
}

init().catch((err) => {
  console.error(err);
  hud.toast('Boot failed');
  requestAnimationFrame(frame);
});
