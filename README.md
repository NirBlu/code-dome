# Code Dome v0

A 3D file viewer: drives are worlds in orbit, the current folder is a dome you stand inside, child folders are sealed biodomes on the floor, and files are typed buildings.

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

## Demo fixture

On load the app fetches `/demo-tree.json` (see `public/demo-tree.json`) matching the spec tree:

```
project/
  README.md, package.json, index.html
  src/ → index.ts, app.ts, components/, styles/
  docs/, assets/, node_modules/ (collapsed industrial globe)
```

- **Demo** button reloads the fixture.
- **Open folder** uses the File System Access API when available; otherwise falls back to the demo.

Depth rings go `0 → 1 → 2` as you enter `project → src → components`.

## Controls

| Input | Action |
|---|---|
| Click world (orbit) | Land on project-root dome |
| Click child globe | Enter folder (membrane transition) |
| Click parent gate / Esc / Backspace | `cd ..` (or return to orbit at root) |
| Click building | Select + inspector |
| Double-click / Enter | Enter HTML civic interior, or open editor pane |
| WASD | Walk · Shift run · mouse look (click canvas) |
| Q/E or wheel | Eye height |

## Interiors

**HTML (`.html` / `.htm`)** ships a civic interior: lobby = `<head>`, halls = body sections, roof = footer/end scripts.

Other readable types (TS/JS, JSON, Markdown, …) use typed closed shells; select them and use **Open in editor** for contents. Full office/library/archive interiors are deferred beyond the typed mesh + editor pane.

## Spec compliance notes

- Stable layout via FNV-1a name hash.
- Floor / globe / building scale uses `log2` (no linear megafolder blow-up).
- `node_modules`, `.git`, `dist`, `build` collapse to industrial globes.
- Sky stack tints by ancestor depth — no ancestor cities inside shells.
- Only cwd files are buildings; child folders are sealed globes.

## Stack

Vite + TypeScript + Three.js · HTML/CSS HUD overlay.
