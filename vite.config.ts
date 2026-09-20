import fs from 'node:fs';
import path from 'node:path';
import type { Plugin, Connect } from 'vite';
import { defineConfig } from 'vite';

const ALLOWED_PREFIXES = ['/home', '/media', '/mnt', '/tmp'];
const COLLAPSE = new Set(['node_modules', '.git', 'dist', 'build']);
const COUNT_DEPTH = 3;

function resolveSafe(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  let resolved: string;
  try {
    resolved = path.resolve(raw);
  } catch {
    return null;
  }
  // Normalize trailing slash (except root)
  if (resolved.length > 1 && resolved.endsWith('/')) {
    resolved = resolved.slice(0, -1);
  }
  const ok = ALLOWED_PREFIXES.some(
    (p) => resolved === p || resolved.startsWith(p + '/'),
  );
  return ok ? resolved : null;
}

function countSubtree(dir: string, depthLeft: number): number {
  if (depthLeft < 0) return 0;
  let n = 0;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    if (ent.name === '.' || ent.name === '..') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (COLLAPSE.has(ent.name)) {
        n += ent.name === 'node_modules' ? 1000 : 50;
        continue;
      }
      n += countSubtree(full, depthLeft - 1);
    } else if (ent.isFile()) {
      n += 1;
    }
  }
  return n;
}

function listDrives(): Array<{ name: string; path: string }> {
  const out: Array<{ name: string; path: string }> = [];
  const seen = new Set<string>();

  const add = (name: string, p: string) => {
    const safe = resolveSafe(p);
    if (!safe || seen.has(safe)) return;
    try {
      if (!fs.statSync(safe).isDirectory()) return;
    } catch {
      return;
    }
    seen.add(safe);
    out.push({ name, path: safe });
  };

  // Likely home roots
  try {
    for (const user of fs.readdirSync('/home')) {
      add(user === 'nirblu' ? '~ nirblu' : `~ ${user}`, path.join('/home', user));
    }
  } catch {
    /* no /home */
  }
  // Explicit likely paths even if empty listing above missed them
  add('~ nirblu', '/home/nirblu');
  add('home', '/home');

  // /media/<user> mounts
  try {
    for (const user of fs.readdirSync('/media')) {
      const userDir = path.join('/media', user);
      try {
        const mounts = fs.readdirSync(userDir);
        if (mounts.length === 0) {
          add(`media/${user}`, userDir);
        } else {
          for (const m of mounts) {
            add(m, path.join(userDir, m));
          }
        }
      } catch {
        add(`media/${user}`, userDir);
      }
    }
  } catch {
    /* no /media */
  }

  // /mnt children + /mnt itself
  add('mnt', '/mnt');
  try {
    for (const m of fs.readdirSync('/mnt')) {
      add(m, path.join('/mnt', m));
    }
  } catch {
    /* */
  }

  add('tmp', '/tmp');

  return out;
}

function listTree(dirPath: string) {
  const safe = resolveSafe(dirPath);
  if (!safe) {
    return { error: 'path not allowed', status: 403 as const };
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(safe);
  } catch {
    return { error: 'not found', status: 404 as const };
  }
  if (!stat.isDirectory()) {
    return { error: 'not a directory', status: 400 as const };
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(safe, { withFileTypes: true });
  } catch (e) {
    return { error: String((e as Error).message || e), status: 403 as const };
  }

  const files: Array<{ name: string; bytes: number; mtime: number; ext: string }> = [];
  const folders: Array<{
    name: string;
    path: string;
    subtreeFiles: number;
    collapsed: boolean;
  }> = [];

  for (const ent of entries) {
    if (ent.name === '.' || ent.name === '..') continue;
    const full = path.join(safe, ent.name);
    if (ent.isDirectory()) {
      const collapsed = COLLAPSE.has(ent.name);
      let subtreeFiles = 0;
      if (collapsed) {
        subtreeFiles = ent.name === 'node_modules' ? 1000 : 50;
      } else {
        subtreeFiles = countSubtree(full, COUNT_DEPTH);
      }
      folders.push({
        name: ent.name,
        path: full,
        subtreeFiles,
        collapsed,
      });
    } else if (ent.isFile() || ent.isSymbolicLink()) {
      let bytes = 0;
      let mtime = Date.now();
      try {
        const st = fs.statSync(full);
        if (st.isDirectory()) {
          // symlink to dir
          const collapsed = COLLAPSE.has(ent.name);
          folders.push({
            name: ent.name,
            path: full,
            subtreeFiles: collapsed ? 50 : countSubtree(full, COUNT_DEPTH),
            collapsed,
          });
          continue;
        }
        bytes = st.size;
        mtime = st.mtimeMs;
      } catch {
        /* skip unreadable */
        continue;
      }
      const i = ent.name.lastIndexOf('.');
      const ext = i > 0 ? ent.name.slice(i + 1) : '';
      files.push({ name: ent.name, bytes, mtime, ext });
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return {
    path: safe,
    name: path.basename(safe) || safe,
    files,
    folders,
  };
}

function sendJson(res: Connect.ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function localFsPlugin(): Plugin {
  return {
    name: 'code-dome-local-fs',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();

        try {
          if (url === '/api/drives' || url.startsWith('/api/drives?')) {
            if (req.method !== 'GET') {
              sendJson(res, 405, { error: 'method not allowed' });
              return;
            }
            sendJson(res, 200, listDrives());
            return;
          }

          if (url.startsWith('/api/tree')) {
            if (req.method !== 'GET') {
              sendJson(res, 405, { error: 'method not allowed' });
              return;
            }
            const u = new URL(url, 'http://localhost');
            const p = u.searchParams.get('path') || '';
            const result = listTree(p);
            if ('error' in result && result.status) {
              sendJson(res, result.status, { error: result.error });
              return;
            }
            sendJson(res, 200, result);
            return;
          }

          if (url.startsWith('/api/file')) {
            if (req.method !== 'GET') {
              sendJson(res, 405, { error: 'method not allowed' });
              return;
            }
            const u = new URL(url, 'http://localhost');
            const p = u.searchParams.get('path') || '';
            const safe = resolveSafe(p);
            if (!safe) {
              sendJson(res, 403, { error: 'path not allowed' });
              return;
            }
            try {
              const st = fs.statSync(safe);
              if (!st.isFile() || st.size > 200_000) {
                sendJson(res, 400, { error: 'not a readable text file' });
                return;
              }
              const text = fs.readFileSync(safe, 'utf8');
              sendJson(res, 200, { path: safe, content: text, bytes: st.size });
            } catch (e) {
              sendJson(res, 404, { error: String((e as Error).message || e) });
            }
            return;
          }
        } catch (e) {
          sendJson(res, 500, { error: String((e as Error).message || e) });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [localFsPlugin()],
  server: { port: 5173, host: true },
  build: { target: 'es2022' },
});
