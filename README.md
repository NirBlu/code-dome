# Code Dome

A 3D file viewer: **drives are worlds in space**, the current folder is a dome you stand inside, child folders are sealed biodomes on the floor, and files are typed buildings with window-grid facades.

Built from `CODE_DOME_BOT_SPEC.md`. File-manager first — no people, cars, weather, or multiplayer.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

**Local drives** (real Linux paths) only work while `npm run dev` is running — the Vite plugin serves `/api/drives` and `/api/tree`. A static production build keeps Open folder / Browse / Demo.

Production build:

```bash
npm run build
npm run preview
```

## Opening real folders / drives

| Button | When to use | How it works |
|---|---|---|
| **Open folder** | Chromium with File System Access | `showDirectoryPicker` → walks the picked directory into a world |
| **Browse…** | Any browser with `webkitdirectory` | Hidden `<input webkitdirectory>` → tree from `webkitRelativePath` |
| **Local drives** | `npm run dev` on Linux | `GET /api/drives` lists `/home/*`, `/media/*` mounts, `/mnt`, `/tmp`; land on one and navigate with `GET /api/tree?path=…` |
| **Demo** | Always | Multi-drive fixture (`C:` `D:` `E:` `~`) |

If **Open folder** has no picker API, the app does **not** silently load Demo — it offers **Browse…** / **Local drives** instead.

Security for the dev bridge: only paths under `/home`, `/media`, `/mnt`, `/tmp`. Collapsed as sealed industrial globes: `node_modules`, `.git`, `dist`, `build`.

## Demo galaxy (multi-drive)

On load the app fetches `/demo-tree.json`. Orbit shows several labeled worlds:

| World | Role |
|---|---|
| **C:** | System-ish demo tree (`Users`, `Program Files`, …) |
| **D:** | Dev project drive (demo stand-in — not your real D:) |
| **E:** | External / media volume |
| **~** | Home-style tree |

`D:` in the demo is only a **stand-in** so the galaxy isn’t a single mystery planet. Use **Open folder**, **Browse…**, or **Local drives** to map real folders.

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
| Click child globe | Enter folder |
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

Vite + TypeScript + Three.js · HTML/CSS HUD overlay · GLSL sky / glass · OrbitControls in galaxy · optional Vite local-FS middleware in dev.
