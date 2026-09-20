import { shouldCollapseFolder } from '../species/catalog';
import type { TreeFile, TreeFolder, TreeNode, WorldRoot } from '../types';

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1) : '';
}

function countSubtreeFiles(node: TreeFolder): number {
  if (typeof node.subtreeFiles === 'number' && node.collapsed) return node.subtreeFiles;
  let n = 0;
  for (const c of node.children) {
    if (c.kind === 'file') n += 1;
    else n += countSubtreeFiles(c);
  }
  return n;
}

interface DirAccum {
  name: string;
  path: string;
  dirs: Map<string, DirAccum>;
  files: TreeFile[];
}

/**
 * Build a WorldRoot from a FileList produced by
 * `<input type="file" webkitdirectory multiple>`.
 * Uses webkitRelativePath (or relativePath) to reconstruct the folder tree.
 */
export async function worldFromWebkitFileList(
  fileList: FileList | File[],
): Promise<WorldRoot> {
  const files = Array.from(fileList);
  if (!files.length) {
    throw new Error('No files selected');
  }

  // Determine root folder name from the first relative path segment
  let rootName = 'folder';
  for (const f of files) {
    const rel =
      (f as File & { webkitRelativePath?: string }).webkitRelativePath ||
      (f as File & { relativePath?: string }).relativePath ||
      f.name;
    const parts = rel.split('/').filter(Boolean);
    if (parts.length >= 1) {
      rootName = parts[0];
      break;
    }
  }

  const rootPath = `/${rootName}`;
  const root: DirAccum = {
    name: rootName,
    path: rootPath,
    dirs: new Map(),
    files: [],
  };

  const ensureDir = (parent: DirAccum, name: string): DirAccum => {
    let d = parent.dirs.get(name);
    if (!d) {
      d = {
        name,
        path: `${parent.path}/${name}`.replace(/\/+/g, '/'),
        dirs: new Map(),
        files: [],
      };
      parent.dirs.set(name, d);
    }
    return d;
  };

  for (const f of files) {
    const rel =
      (f as File & { webkitRelativePath?: string }).webkitRelativePath ||
      (f as File & { relativePath?: string }).relativePath ||
      f.name;
    const parts = rel.split('/').filter(Boolean);
    if (parts.length < 2) {
      // File directly under root (unusual for webkitdirectory)
      await pushFile(root, f, `${rootPath}/${f.name}`);
      continue;
    }
    // parts[0] is rootName
    let cur = root;
    for (let i = 1; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (shouldCollapseFolder(seg)) {
        // Create sealed stub and skip rest of this file's path
        if (!cur.dirs.has(seg)) {
          cur.dirs.set(seg, {
            name: seg,
            path: `${cur.path}/${seg}`.replace(/\/+/g, '/'),
            dirs: new Map(),
            files: [],
          });
        }
        break;
      }
      cur = ensureDir(cur, seg);
    }
    const last = parts[parts.length - 1];
    // If we stopped early due to collapse, skip file
    const collapsedAncestor = parts.slice(1, -1).some((s) => shouldCollapseFolder(s));
    if (collapsedAncestor) continue;

    await pushFile(cur, f, `${cur.path}/${last}`.replace(/\/+/g, '/'), last);
  }

  function toTreeFolder(acc: DirAccum, collapsed = false): TreeFolder {
    const children: TreeNode[] = [];
    for (const [, d] of acc.dirs) {
      const seal = shouldCollapseFolder(d.name);
      if (seal) {
        children.push({
          name: d.name,
          kind: 'folder',
          path: d.path,
          tint: '#666',
          collapsed: true,
          subtreeFiles: d.name === 'node_modules' ? 1000 : 50,
          children: [],
        });
      } else {
        children.push(toTreeFolder(d));
      }
    }
    children.push(...acc.files);
    children.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    const folder: TreeFolder = {
      name: acc.name,
      kind: 'folder',
      path: acc.path,
      tint: '#6a9',
      children,
      collapsed: collapsed || undefined,
    };
    folder.subtreeFiles = countSubtreeFiles(folder);
    return folder;
  }

  async function pushFile(
    dir: DirAccum,
    file: File,
    filePath: string,
    name = file.name,
  ) {
    const ext = extOf(name);
    let content: string | undefined;
    const textLike =
      /^(html?|tsx?|jsx?|mjs|cjs|json|ya?ml|toml|md|txt|css|scss|py|go|rs|java|kt|sh)$/i.test(
        ext,
      );
    if (textLike && file.size < 200_000) {
      try {
        content = await file.text();
      } catch {
        /* binary */
      }
    }
    dir.files.push({
      name,
      kind: 'file',
      path: filePath,
      ext,
      bytes: file.size,
      mtime: file.lastModified,
      content,
    });
  }

  // Mark collapsed stubs' subtree counts already set; seal empty collapse dirs
  for (const [name, d] of root.dirs) {
    if (shouldCollapseFolder(name) && d.files.length === 0 && d.dirs.size === 0) {
      /* already handled in toTreeFolder */
    }
  }

  const tree = toTreeFolder(root);
  tree.tint = '#6a9';
  return { path: tree.path, name: tree.name, tint: tree.tint, tree, source: 'webkit' };
}
