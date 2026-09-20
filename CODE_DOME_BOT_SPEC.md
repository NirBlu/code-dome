# Code Dome — Bot Build Spec (v0)

Give this entire document to the coding agent as system + product requirements.
Do not invent new metaphors. Do not skip nesting rules. File-manager first.

## One-sentence product

A 3D file viewer: drives are worlds in space, the current folder is a dome you stand inside, child folders are sealed biodomes on the floor, files are typed buildings, and only readable text/source files have interiors whose architecture follows a fixed species per file type.

---

## Non-negotiable rules

1. **Drive = world.** Roots (C:, D:, `/`, `~`, a chosen project root) appear in orbit. Entering a drive lands you on that world’s root dome.
2. **Current folder = one live dome.** Exactly one folder interior is simulated at a time.
3. **Child folders = sealed globes on the current floor.** You see name, size, tint. You do **not** render cities inside them until the camera crosses the membrane.
4. **Files in the current folder only = buildings.** Never draw files that live in child folders onto this floor.
5. **Parent = gate in the outer wall.** Walking through it is `cd ..`.
6. **Siblings live on the parent floor**, not in your sky.
7. **Asset = file type. Paint = status. Plan = code structure.** Do not mix those channels.
8. **Only readable text/source gets an interior.** Binaries, images, lockfiles, etc. are closed props.
9. **Species over novelty.** Each readable type has a fixed skeleton (e.g. HTML always has lobby + body halls + roof). Complexity lengthens halls / adds floors / widens wings. It does not invent new parts.
10. **Roads = references.** Intra-folder refs are streets. Refs into a child folder dock on that globe’s ring. Refs that leave the folder go to the outer gate.
11. **Stable layout.** Same folder + same children should produce the same lot positions across sessions (hash filenames into a layout seed). Cities must not reshuffle every refresh.
12. **List/HUD is allowed.** This does not replace search, sort, or a path bar. It replaces being lost.

If a feature fights these twelve rules, cut the feature.

---

## Scene graph

```
OrbitLayer          worlds = drives / roots
  World
    Dome (cwd)
      FloorDisk
      Plaza (labeled with folder name)
      Buildings[]          // files in cwd only
      ChildDomes[]         // subdirectories, sealed
      OuterWall + ParentGate
      Roads[]              // references visible at this altitude
      SkyStack             // visual breadcrumb of ancestor membranes
```

### Scale

- Floor radius: base 40 units + `8 * log2(1 + entryCount)`.
- Child dome diameter: `2 + 4 * log2(1 + subtreeFileCount)`. Clamp `[2, 18]`.
- Building height (closed shell): `1 + log2(1 + byteSize)` or `1 + log2(1 + loc)` for text.
- Do not use linear scale. `node_modules` must not eat the disk.

### Layout

- Plaza at origin.
- Place child domes first on a ring or packed disks, largest first, seeded by name hash.
- Place buildings in remaining lots, grouped by type species (source quarter, config alley, media row, docs court).
- Parent gate always at `-Z` on the outer wall so “out” is a learned direction.
- If `childCount > 24`, cluster by prefix / type (`test*`, `vendor`, `node_modules` as one industrial globe even if you later allow expanding it).

---

## File species (v0 catalog)

Keep this list small. Unknown extensions → generic crate.

| Extension / kind | Asset (closed) | Interior species (if text) | Skeleton |
|---|---|---|---|
| `.html`, `.htm` | Civic glass building | **Civic** | Lobby=`head`, halls=`body` sections, roof=`footer`+end scripts |
| `.js`, `.ts`, `.jsx`, `.tsx`, `.mjs` | Office | **Office** | Lobby=imports, street floors=exports, courtyard=privates, roof=side effects / main |
| `.py` | Brick workshop | **Office-py** | Lobby=imports, floors=defs/classes, roof=`if __name__` |
| `.go`, `.rs`, `.java`, `.kt` | Concrete office | **Office** | same as JS with language bones |
| `.json`, `.yaml`, `.yml`, `.toml` | Archive / substation | **Archive** | Lobby=root keys, halls=objects, long hall=arrays |
| `.md`, `.txt` | Library | **Library** | Lobby=title/frontmatter, stacks=headings |
| `.css`, `.scss` | Paint shop (closed or shallow) | optional later | — |
| images | Billboard / gallery box | none | facade shows thumbnail if cheap |
| audio / video | Theater box | none | |
| `.env`, `*.pem`, `*secret*` | Vault (fenced) | none | |
| lock / `package-lock` / binaries | Warehouse / bunker | none | |
| executable / `.sh` | Garage | none in v0 | |

HTML species is the reference implementation. Do it first and completely.

### HTML interior mapping (must implement in v0 if interiors ship)

- Lobby floor: `<head>` children as directory board / reception desks (title, meta, link, style).
- Main stair: transition `head` → `body`.
- Each top-level meaningful body child (`header`, `nav`, `main`, `section`, `article`, `footer`, large `div`) = a wing or floor.
- Nested depth = corridor depth, not a new building.
- Scripts at end of body + footer = roof plant.
- More nodes = longer halls / extra floors. Never drop lobby or roof.

If interiors are deferred in v0, buildings are still typed closed shells you can select to open the file in an editor pane.

---

## Navigation

| Input | Action |
|---|---|
| Click / interact child dome | Transition through membrane; cwd = that folder; rebuild floor |
| Click parent gate or Back / Esc at dome level | `cd ..` |
| Click building | Select; show inspector. Double-click or Enter: if species has interior, enter building; else open file in editor pane |
| Esc inside building | Back to dome floor, camera at that lot |
| Orbit layer: click world | Land on that drive’s root dome |
| Mouse look + WASD / stick | Walk. Shift = run. Q/E or wheel = eye height |
| Click road / dock | Optional highlight of the target lot or globe |

Transitions are short (300–600ms) and must not unload the path stack. Keep an in-memory trail of ancestor folder records so Back is instant.

---

## UI: where you are, and how deep

The 3D world already stacks ancestor glass in the sky. The HUD must still say the path in words. Both are required.

### A. Path ribbon (always visible)

Left-to-right chips, root → cwd.

```
[ ⊕ D: ] / [ project ] / [ src ] / [ components ]
```

- Each chip is clickable and runs `cd` to that ancestor (or root).
- Current folder chip is emphasized (solid), ancestors are quieter.
- Long paths collapse middle chips into `…` but **never** collapse root or cwd. Click `…` to expand.
- Tooltip on chip = full absolute path.
- Trailing count: `12 files · 4 folders`.

### B. Depth meter

A vertical stack of rings beside the ribbon (or under it on mobile).

- One ring per ancestor **including cwd**.
- Depth `0` = drive root. `project/src/components` = depth 3.
- Label: `Depth 3` and optional `3 membranes under D:`.
- Rings are literal: outermost ring = root, innermost = you. Fill/tint matches that ancestor dome’s biome tint.
- Hover a ring = highlight that chip and pulse that sky layer.

### C. Sky stack (in-world, not only HUD)

When cwd depth > 0, the dome sky is layered glass:

- Each ancestor adds a faint concentric shell / color wash.
- Deeper = slightly dimmer ambient, slightly tighter horizon fog.
- You should feel “I am under three skies” without reading the HUD.
- Do not draw ancestor *cities* in those shells. Color and rings only.

### D. Minimap

Top-down disk of the current floor: plaza, building dots by type color, child globes as circles, parent gate as a notch at -Z. A triangle is the camera. Click minimap to rotate/move toward that lot.

### E. Inspector drawer

On select:

- Name, kind, size, mtime
- Absolute path + copy button
- For folders: subtree file count
- For source: loc, import count (if parsed)
- Buttons: Open in editor, Reveal in OS, Enter (folder or interior)

### F. Search

A single search field. Matches files/folders **in cwd first**, then subtree. Results are a list; choosing one either selects the lot (if in cwd) or offers “Enter dome toward…” and walks membranes one at a time (do not teleport through 8 layers with no trail). You may also “drop a beacon” on the child globe that contains the hit.

---

## Status paint (buildings and globes)

| Status | Paint |
|---|---|
| Default | species material |
| Git modified / untracked | amber construction netting or warm edge light |
| Git ignored | desaturated |
| Error / broken parse | red beacon on roof |
| Secrets / private perms | fence + cooler metal |
| Recently opened this session | soft interior light |
| Selected | ground decal + nameplate |

Do not invent weather systems in v0 beyond these.

---

## Data / engineering

### v0 data source

- Start with a **chosen project root directory** (not every real OS drive). Orbit can still *look* like multiple worlds; only one world is wired.
- Walk the tree with a file API (Node `fs`, Tauri, or a small local server). Cap crawl: skip or collapse well-known heavy dirs (`node_modules`, `.git`, `dist`, `build`) into a single sealed industrial globe unless the user explicitly enters them.
- Emit JSON:

```json
{
  "path": "/abs/project/src",
  "name": "src",
  "depth": 1,
  "parent": "/abs/project",
  "ancestors": [{"name": "project", "path": "/abs/project", "tint": "#7aa"}],
  "files": [{"name": "index.ts", "ext": "ts", "bytes": 4200, "mtime": 0}],
  "folders": [{"name": "components", "path": "...", "subtreeFiles": 18, "tint": "#8cf"}]
}
```

- Load **cwd only** plus cheap subtree counts for child globes. Do not parse every file in the repo on enter.
- Parse a file only when selected or when entering its interior.
- HTML parse: DOM or linkedom / parse5. JS/TS parse may wait; v0 interior can be a generic office with floors = top-level functions if AST is easy (tree-sitter or typescript compiler), else skip interiors for JS in v0.

### Stack suggestion (v0)

- Three.js + pointer-lock optional, orbit/walk camera.
- Simple toon / matcap materials, no photoreal city pack.
- HUD: HTML overlay (not world-space text for the ribbon).
- World-space labels only on selected lot + nearby names when camera is close.

### Performance budget

- Entering a folder with ≤ 200 entries: < 200ms to a walkable floor after metadata is in memory.
- No lights per building. Instanced meshes for generic crates.
- Child globes are 1 mesh + 1 label, not mini-cities.

---

## v0 acceptance (ship this, nothing else)

Must have:

- [ ] Land in a project-root dome from a fake orbit with one world.
- [ ] Buildings for files, sealed globes for child folders, gate for parent.
- [ ] Click globe / gate changes cwd and rebuilds the floor.
- [ ] Path ribbon with clickable ancestors + file/folder counts.
- [ ] Depth meter rings matching ancestor count.
- [ ] Sky tint stacked by depth.
- [ ] Minimap.
- [ ] Inspector with path copy.
- [ ] Collapse `node_modules` / `.git` as single globes.
- [ ] Stable layout seed.
- [ ] HTML files use civic mesh; other source uses office mesh; other files use catalog props.
- [ ] Select HTML → optional interior with lobby / halls / roof **or** documented deferral with typed closed shell + editor pane.

Must not have in v0:

- People, cars, day/night cycle, rain, voice, multiplayer.
- Drawing cities inside sealed child globes.
- Linear-scaled megafolders.
- Unique custom architecture per individual file beyond stretching the species skeleton.
- Parsing the entire monorepo on startup.

---

## Prompt wrapper for the bot

Copy this block as the first message, then attach this spec.

```
Build Code Dome v0 from CODE_DOME_BOT_SPEC.md. Follow the twelve non-negotiable rules exactly. Start with Three.js in a single web app that reads a local project via a tiny static manifest or a local folder picker / demo fixture tree if filesystem access is blocked. Implement navigation, path ribbon, depth rings, sky stack, minimap, and typed buildings. Do not add decoration not in the spec. When unsure, prefer a working file manager over a prettier city.
```

## Demo fixture (if no FS access)

Ship `/demo-tree.json` for this tree so the app runs from a static host:

```
project/
  README.md
  package.json
  index.html
  src/
    index.ts
    app.ts
    components/
      Button.tsx
      Modal.tsx
    styles/
      main.css
  docs/
    guide.md
  assets/
    logo.png
```

Root dome must show: buildings README, package.json, index.html + globes src, docs, assets.
Enter src: buildings index.ts, app.ts + globes components, styles.
Depth rings go 0 → 1 → 2 as you enter project → src → components.

---

## Naming in the UI

Product working title: **Code Dome**.
Folder chip uses the directory name, not the word “dome.”
Depth uses “Depth N” in the HUD and membranes only in a tooltip / subtitle so it does not sound like a game to a first-time file user.
