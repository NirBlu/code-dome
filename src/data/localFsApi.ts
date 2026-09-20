import { shouldCollapseFolder } from '../species/catalog';
import type { FolderView, TreeFile, TreeFolder, TreeNode, WorldRoot } from '../types';

export interface DriveInfo {
  name: string;
  path: string;
}

export interface ApiTreeResponse {
  path: string;
  name: string;
  files: Array<{ name: string; bytes: number; mtime: number; ext: string }>;
  folders: Array<{
    name: string;
    path: string;
    subtreeFiles: number;
    collapsed: boolean;
  }>;
}

const TINTS = ['#6a9', '#8af', '#fa6', '#c8e', '#9c6', '#6cf'];

/** Probe whether the Vite local-FS bridge is available (dev only). */
export async function probeLocalDrivesApi(): Promise<boolean> {
  try {
    const res = await fetch('/api/drives');
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchDrives(): Promise<DriveInfo[]> {
  const res = await fetch('/api/drives');
  if (!res.ok) throw new Error(`drives ${res.status}`);
  return (await res.json()) as DriveInfo[];
}

export async function fetchTree(absPath: string): Promise<ApiTreeResponse> {
  const res = await fetch(`/api/tree?path=${encodeURIComponent(absPath)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || `tree ${res.status}`);
  }
  return (await res.json()) as ApiTreeResponse;
}

export async function fetchFileContent(absPath: string): Promise<string | undefined> {
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(absPath)}`);
    if (!res.ok) return undefined;
    const body = (await res.json()) as { content?: string };
    return body.content;
  } catch {
    return undefined;
  }
}

function tintFor(path: string): string {
  let h = 2166136261;
  for (let i = 0; i < path.length; i++) {
    h ^= path.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return TINTS[Math.abs(h) % TINTS.length];
}

/** Skeleton world for an API drive — populated on navigate via fetchTree. */
export function worldStubFromDrive(drive: DriveInfo, index = 0): WorldRoot {
  const tree: TreeFolder = {
    name: drive.name,
    kind: 'folder',
    path: drive.path,
    tint: TINTS[index % TINTS.length],
    children: [],
    subtreeFiles: 0,
  };
  return {
    path: drive.path,
    name: drive.name,
    tint: tree.tint,
    tree,
    source: 'api',
    apiRoot: drive.path,
  };
}

/**
 * Fetch one directory listing and merge it into the API world tree.
 * Returns a FolderView ready for the dome.
 */
export async function loadApiFolderView(
  world: WorldRoot,
  absPath: string,
): Promise<FolderView | null> {
  if (world.source !== 'api') return null;

  const data = await fetchTree(absPath);
  const folder = upsertApiFolder(world, data);

  // Ancestors from apiRoot → absPath
  const ancestors = ancestorsBetween(world.apiRoot || world.path, absPath, world);
  const parent =
    absPath === (world.apiRoot || world.path)
      ? null
      : absPath.includes('/')
        ? absPath.slice(0, absPath.lastIndexOf('/')) || '/'
        : null;

  const files: TreeFile[] = [];
  const folders: FolderView['folders'] = [];

  if (!folder.collapsed) {
    for (const c of folder.children) {
      if (c.kind === 'file') files.push(c);
      else {
        folders.push({
          name: c.name,
          path: c.path,
          subtreeFiles: c.subtreeFiles ?? 0,
          tint: c.tint,
          collapsed: c.collapsed || shouldCollapseFolder(c.name),
        });
      }
    }
  }

  return {
    path: folder.path,
    name: folder.name,
    depth: ancestors.length,
    parent,
    ancestors,
    files,
    folders,
    tint: folder.tint,
  };
}

function ancestorsBetween(
  rootPath: string,
  targetPath: string,
  world: WorldRoot,
): Array<{ name: string; path: string; tint: string }> {
  if (targetPath === rootPath) return [];
  const rel = targetPath.startsWith(rootPath + '/')
    ? targetPath.slice(rootPath.length + 1)
    : targetPath.replace(/^\//, '');
  const parts = rel.split('/').filter(Boolean);
  const out: Array<{ name: string; path: string; tint: string }> = [];
  // Include root as first ancestor when we're deeper
  out.push({ name: world.name, path: rootPath, tint: world.tint });
  let cur = rootPath;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = `${cur}/${parts[i]}`.replace(/\/+/g, '/');
    out.push({ name: parts[i], path: cur, tint: tintFor(cur) });
  }
  return out;
}

function upsertApiFolder(world: WorldRoot, data: ApiTreeResponse): TreeFolder {
  const children: TreeNode[] = [];

  for (const f of data.folders) {
    children.push({
      name: f.name,
      kind: 'folder',
      path: f.path,
      tint: tintFor(f.path),
      collapsed: f.collapsed || shouldCollapseFolder(f.name),
      subtreeFiles: f.subtreeFiles,
      children: [], // filled when navigated into
    });
  }

  for (const file of data.files) {
    children.push({
      name: file.name,
      kind: 'file',
      path: `${data.path}/${file.name}`.replace(/\/+/g, '/'),
      ext: file.ext || extOf(file.name),
      bytes: file.bytes,
      mtime: file.mtime,
    });
  }

  children.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const folder: TreeFolder = {
    name: data.name,
    kind: 'folder',
    path: data.path,
    tint: data.path === world.path ? world.tint : tintFor(data.path),
    children,
    subtreeFiles: children.reduce((n, c) => {
      if (c.kind === 'file') return n + 1;
      return n + (c.subtreeFiles ?? 0);
    }, 0),
  };

  // Graft into world.tree
  if (data.path === world.tree.path) {
    world.tree.children = folder.children;
    world.tree.subtreeFiles = folder.subtreeFiles;
    return world.tree;
  }

  const parent = findFolder(world.tree, parentPath(data.path));
  if (parent) {
    const idx = parent.children.findIndex((c) => c.kind === 'folder' && c.path === data.path);
    if (idx >= 0) parent.children[idx] = folder;
    else parent.children.push(folder);
  }
  return folder;
}

function parentPath(p: string): string {
  const i = p.lastIndexOf('/');
  if (i <= 0) return '/';
  return p.slice(0, i) || '/';
}

function findFolder(root: TreeFolder, path: string): TreeFolder | null {
  if (root.path === path) return root;
  for (const c of root.children) {
    if (c.kind === 'folder') {
      const f = findFolder(c, path);
      if (f) return f;
    }
  }
  return null;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1) : '';
}

export function pathTrailFromApiView(
  world: WorldRoot,
  view: FolderView,
): Array<{ name: string; path: string; tint: string }> {
  return [
    ...view.ancestors,
    { name: view.name, path: view.path, tint: view.tint },
  ];
}
