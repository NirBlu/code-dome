import { shouldCollapseFolder } from '../species/catalog';
import type {
  AncestorRec,
  FolderView,
  SearchHit,
  TreeFile,
  TreeFolder,
  TreeNode,
  WorldRoot,
} from '../types';

function countSubtreeFiles(node: TreeFolder): number {
  if (typeof node.subtreeFiles === 'number' && node.collapsed) return node.subtreeFiles;
  let n = 0;
  for (const c of node.children) {
    if (c.kind === 'file') n += 1;
    else n += countSubtreeFiles(c);
  }
  return n;
}

function ensurePaths(folder: TreeFolder, parentPath: string): TreeFolder {
  const path = folder.path || `${parentPath}/${folder.name}`.replace(/\/+/g, '/');
  const children: TreeNode[] = folder.children.map((c) => {
    if (c.kind === 'file') {
      const fp = `${path}/${c.name}`.replace(/\/+/g, '/');
      return { ...c, path: fp, ext: c.ext || extOf(c.name) };
    }
    return ensurePaths(
      {
        ...c,
        collapsed: c.collapsed || shouldCollapseFolder(c.name),
      },
      path,
    );
  });
  return {
    ...folder,
    path,
    tint: folder.tint || '#7aa',
    children,
    subtreeFiles: folder.subtreeFiles ?? countSubtreeFiles({ ...folder, path, children }),
  };
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1) : '';
}

export function indexDemoPayload(raw: unknown): WorldRoot[] {
  const data = raw as {
    roots: Array<{
      path: string;
      name: string;
      tint: string;
      kind?: string;
      children: TreeNode[];
    }>;
  };
  return data.roots.map((r) => {
    const tree = ensurePaths(
      {
        name: r.name,
        kind: 'folder',
        path: r.path,
        tint: r.tint,
        children: r.children,
      },
      '',
    );
    return { path: tree.path, name: tree.name, tint: tree.tint, tree, source: 'demo' };
  });
}

export function findFolder(root: TreeFolder, path: string): TreeFolder | null {
  if (root.path === path) return root;
  for (const c of root.children) {
    if (c.kind === 'folder') {
      const f = findFolder(c, path);
      if (f) return f;
    }
  }
  return null;
}

export function findFile(root: TreeFolder, path: string): TreeFile | null {
  for (const c of root.children) {
    if (c.kind === 'file' && c.path === path) return c;
    if (c.kind === 'folder') {
      const f = findFile(c, path);
      if (f) return f;
    }
  }
  return null;
}

function ancestorsOf(root: TreeFolder, path: string): AncestorRec[] {
  const parts: AncestorRec[] = [];
  const walk = (node: TreeFolder, trail: AncestorRec[]): boolean => {
    if (node.path === path) {
      parts.push(...trail);
      return true;
    }
    for (const c of node.children) {
      if (c.kind === 'folder') {
        if (walk(c, [...trail, { name: node.name, path: node.path, tint: node.tint }])) {
          return true;
        }
      }
    }
    return false;
  };
  walk(root, []);
  return parts;
}

export function folderView(world: WorldRoot, path: string): FolderView | null {
  const folder = findFolder(world.tree, path);
  if (!folder) return null;
  const ancestors = ancestorsOf(world.tree, path);
  const depth = ancestors.length; // 0 = drive/project root
  const parent = ancestors.length ? ancestors[ancestors.length - 1].path : null;

  const files: TreeFile[] = [];
  const folders: FolderView['folders'] = [];

  if (!folder.collapsed) {
    for (const c of folder.children) {
      if (c.kind === 'file') {
        files.push(c);
      } else {
        folders.push({
          name: c.name,
          path: c.path,
          subtreeFiles: c.subtreeFiles ?? countSubtreeFiles(c),
          tint: c.tint,
          collapsed: c.collapsed || shouldCollapseFolder(c.name),
        });
      }
    }
  }

  return {
    path: folder.path,
    name: folder.name,
    depth,
    parent,
    ancestors: [
      ...ancestors,
      // cwd itself is not an ancestor for sky; depth meter includes cwd separately
    ].map((a) => a),
    files,
    folders,
    tint: folder.tint,
  };
}

/** Ancestors including cwd for depth meter / ribbon. */
export function pathTrail(world: WorldRoot, path: string): AncestorRec[] {
  const view = folderView(world, path);
  if (!view) return [];
  const folder = findFolder(world.tree, path)!;
  return [...view.ancestors, { name: folder.name, path: folder.path, tint: folder.tint }];
}

export function searchTree(
  world: WorldRoot,
  cwd: string,
  query: string,
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  const cwdFolder = findFolder(world.tree, cwd);
  if (!cwdFolder) return [];

  const collect = (node: TreeFolder, underCwd: boolean, nextDome: string | undefined) => {
    for (const c of node.children) {
      const match = c.name.toLowerCase().includes(q);
      if (c.kind === 'file') {
        if (match) {
          hits.push({
            name: c.name,
            path: c.path,
            kind: 'file',
            inCwd: underCwd && node.path === cwd,
            nextDome: underCwd && node.path === cwd ? undefined : nextDome,
          });
        }
      } else {
        if (match) {
          hits.push({
            name: c.name,
            path: c.path,
            kind: 'folder',
            inCwd: underCwd && node.path === cwd,
            nextDome: underCwd && node.path === cwd ? undefined : nextDome ?? c.path,
          });
        }
        if (!c.collapsed) {
          const nd =
            node.path === cwd ? c.path : nextDome ?? (underCwd ? c.path : nextDome);
          collect(c, underCwd || node.path === cwd, nd);
        }
      }
    }
  };

  collect(cwdFolder, true, undefined);
  // Prefer cwd matches
  hits.sort((a, b) => Number(b.inCwd) - Number(a.inCwd) || a.name.localeCompare(b.name));
  return hits.slice(0, 40);
}

/** Build a world from a File System Access directory handle (shallow-friendly). */
export async function worldFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<WorldRoot> {
  const rootPath = `/${handle.name}`;

  async function readDir(
    dir: FileSystemDirectoryHandle,
    path: string,
  ): Promise<TreeFolder> {
    const children: TreeNode[] = [];
    for await (const [name, entry] of dir.entries()) {
      if (shouldCollapseFolder(name)) {
        children.push({
          name,
          kind: 'folder',
          path: `${path}/${name}`,
          tint: '#666',
          collapsed: true,
          subtreeFiles: name === 'node_modules' ? 1000 : 50,
          children: [],
        });
        continue;
      }
      if (entry.kind === 'file') {
        const file = await (entry as FileSystemFileHandle).getFile();
        const ext = extOf(name);
        let content: string | undefined;
        const textLike = /^(html?|tsx?|jsx?|mjs|cjs|json|ya?ml|toml|md|txt|css|scss|py|go|rs|java|kt|sh)$/i.test(
          ext,
        );
        if (textLike && file.size < 200_000) {
          try {
            content = await file.text();
          } catch {
            /* binary-ish */
          }
        }
        children.push({
          name,
          kind: 'file',
          path: `${path}/${name}`,
          ext,
          bytes: file.size,
          mtime: file.lastModified,
          content,
        });
      } else {
        const sub = await readDir(entry as FileSystemDirectoryHandle, `${path}/${name}`);
        children.push(sub);
      }
    }
    children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const folder: TreeFolder = {
      name: path === rootPath ? handle.name : path.split('/').pop()!,
      kind: 'folder',
      path,
      tint: '#6a9',
      children,
    };
    folder.subtreeFiles = countSubtreeFiles(folder);
    return folder;
  }

  const tree = await readDir(handle, rootPath);
  tree.tint = '#6a9';
  return { path: tree.path, name: tree.name, tint: tree.tint, tree, source: 'fsa' };
}
