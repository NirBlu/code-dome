# Code Dome

A 3D file viewer: **drives are worlds in space**, the current folder is a dome you stand inside, child folders are sealed biodomes on the floor, and files are typed buildings.

Built from `CODE_DOME_BOT_SPEC.md`. File-manager first — no people, cars, weather, or multiplayer.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Demo fixture (drive = world)

On load the app fetches `/demo-tree.json`. Orbit shows drive world **`D:`**. Landing puts you on the **drive root** dome, where `project/` is one child globe among siblings (`Documents/`, `Music/`, `Desktop/`, plus a few drive-level files). From `project` you can go **up** through the parent gate to the whole drive, then up again to orbit.

```
D:                          ← drive root (depth 0)
  project/                  ← child globe
    README.md, package.json, index.html
    src/ → index.ts, app.ts, components/, styles/
    docs/, assets/, node_modules/ (collapsed)
  Documents/, Music/, Desktop/
  readme_drive.txt, config.json
```

Depth rings: `D: → project → src → components` = depths `0 → 1 → 2 → 3`.

- **Demo** reloads the fixture.
- **Open folder** uses the File System Access API when available (that folder becomes the drive/world root).

## Visuals

- Orbit: GLSL starfield + soft nebula sky, shaded drive planet.
- Dome: procedural floor/wall grain, fresnel glass on civic buildings and sealed globes, softer depth fog.
- **All** building and child-globe names stay visible on the current floor (billboard chips, distance-scaled).
- Denser lot packing and compressed building heights for walkable sightlines.

## Controls

| Input | Action |
|---|---|
| Click drive world (orbit) | Land on drive-root dome |
| Click child globe | Enter folder (membrane transition) |
| Click parent gate / Esc / Backspace | `cd ..` (or return to orbit at drive root) |
| Click building | Select + inspector |
| Double-click / Enter | Enter HTML civic interior, or open editor pane |
| WASD | Walk · Shift run · mouse look (click canvas) |
| Q/E or wheel | Eye height |

## Interiors

**HTML (`.html` / `.htm`)** ships a civic interior: lobby = `<head>`, halls = body sections, roof = footer/end scripts.

Other readable types use typed closed shells; select them and use **Open in editor**. Full office/library/archive interiors remain deferred.

## Spec compliance notes

- Stable layout via FNV-1a name hash.
- Floor / globe / building scale uses `log2` with a low height cap (no skyscrapers).
- `node_modules`, `.git`, `dist`, `build` collapse to industrial globes.
- Sky stack tints by ancestor depth — no ancestor cities inside shells.
- Only cwd files are buildings; child folders are sealed globes.
- One live dome at a time.

## Stack

Vite + TypeScript + Three.js · HTML/CSS HUD overlay · GLSL sky / glass.
