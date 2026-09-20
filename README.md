# Code Dome

A 3D file viewer: **drives are worlds in space**, the current folder is a dome you stand inside, child folders are sealed biodomes on the floor, and files are typed buildings with window-grid facades.

Built from `CODE_DOME_BOT_SPEC.md`. File-manager first — no people, cars, weather, or multiplayer.

## Run locally (real disks)

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

**My computer = ls API.** On boot, if `/api/drives` is available, Code Dome auto-loads your real mounts as orbit worlds and lands on a useful root (e.g. `/home/nirblu`). Folder navigation (enter globe, parent gate, path ribbon) calls `/api/tree?path=…` for fresh cwd JSON — true ls-backed views, not a one-shot upload snapshot.

| Endpoint | Role |
|---|---|
| `GET /api/drives` | Lists mounts under `/home/*`, `/media/*`, `/mnt`, plus home/`/tmp` |
| `GET /api/tree?path=` | FolderView-compatible JSON: files, folders, subtree counts, parent, depth, ancestors. Collapses `node_modules` / `.git` / `dist` / `build` |
| `GET /api/file?path=` | Small text file contents for the editor pane |

Security: only paths under `/home`, `/media`, `/mnt`, `/tmp`.

Production / static preview (`npm run build` + `preview`) has no ls bridge — the HUD shows one line: *Run via npm run dev to browse real disks*, plus **Load demo galaxy**. Upload / Open-folder is never the primary path.

```bash
npm run build
npm run preview
```

## UI

| Control | Role |
|---|---|
| **My computer** | Refresh `/api/drives` and show local disks in orbit (primary in `npm run dev`) |
| **Load demo galaxy** | Optional multi-drive fixture (`C:` `D:` `E:` `~`) |
| **Advanced → Open folder… / Browser pick…** | One-shot browser snapshots (demoted; not live ls) |

## Demo galaxy

Optional fixture only. `D:` is a stand-in so the galaxy isn’t a single mystery planet. Prefer **My computer** for real paths.

Landing puts you on that world’s **root** dome. Child folders are sealed globes; the parent gate / Esc climbs toward orbit.

Depth rings: `D: → project → src → components` = depths `0 → 1 → 2 → 3`.

## Visuals

- Orbit: free pan/orbit/zoom around labeled drive worlds (not a locked cinematic).
- Dome: denser lot packing, mid-rise buildings, procedural **skyscraper window** facades tinted per filename hue.
- Sealed child globes stay glass/fresnel.
- Minimap/navigator: large, high-contrast, always on (Hide toggle), with legend.
- Path ribbon, depth rings, sky stack, one live dome at a time.

## Controls

| Input | Action |
|---|---|
| Orbit: drag / scroll / right-drag | Free orbit, zoom, pan around worlds |
| Click labeled world | Land on that drive root |
| **Click the 3D view** | Pointer-lock look (primary) — mouse always looks while locked |
| **Esc** | Release pointer lock first; Esc again goes up / exits interior |
| Hold right mouse | Backup look without lock |
| Left-drag | Also looks (clicks still select if you don’t drag) |
| WASD · Shift | Walk · run |
| Click child globe | Enter folder (`/api/tree` when on local-api worlds) |
| Click parent gate / Esc / Backspace | `cd ..` (or return to orbit at drive root) |
| Click building | Select + inspector |
| Double-click / Enter | Civic interior or editor pane |
| Q/E or wheel | Eye height |

On-screen while in a dome: **Click view to look around · Esc to release**.

OrbitControls is fully disposed while walking so it cannot steal mouse events or fight camera pitch.

## Interiors

**HTML (`.html` / `.htm`)** ships a civic interior: lobby = `<head>`, halls = body sections, roof = footer/end scripts.

Other readable types use typed closed shells; select them and use **Open in editor**.

## Spec compliance notes

- Stable layout via FNV-1a name hash.
- Floor / globe / building scale uses `log2` with a mid-rise height cap.
- `node_modules`, `.git`, `dist`, `build` collapse to industrial globes.
- Sky stack tints by ancestor depth — no ancestor cities inside shells.
- Only cwd files are buildings; child folders are sealed globes.
- One live dome at a time.

## Stack

Vite + TypeScript + Three.js · HTML/CSS HUD overlay · GLSL sky / glass · OrbitControls in galaxy · Vite local-FS middleware in dev (`/api/drives`, `/api/tree`, `/api/file`).
