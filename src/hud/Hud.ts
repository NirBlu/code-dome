import { speciesLabel } from '../species/catalog';
import type { AncestorRec, FolderView, LotPlacement, SearchHit } from '../types';

export interface HudCallbacks {
  onChipClick: (path: string) => void;
  onExpandEllipsis: () => void;
  onCopyPath: (path: string) => void;
  onEnterSelection: () => void;
  onOpenEditor: () => void;
  onCloseInspector: () => void;
  onSearch: (q: string) => void;
  onSearchPick: (hit: SearchHit) => void;
  onOpenFolder: () => void;
  onLoadDemo: () => void;
  onCloseEditor: () => void;
  onDepthHover: (index: number | null) => void;
}

export class Hud {
  private ribbon = document.getElementById('path-ribbon')!;
  private counts = document.getElementById('counts')!;
  private depth = document.getElementById('depth-meter')!;
  private inspector = document.getElementById('inspector')!;
  private inspName = document.getElementById('insp-name')!;
  private inspMeta = document.getElementById('insp-meta')!;
  private inspPath = document.getElementById('insp-path')!;
  private inspActions = document.getElementById('insp-actions')!;
  private searchResults = document.getElementById('search-results')!;
  private searchInput = document.getElementById('search') as HTMLInputElement;
  private orbitHint = document.getElementById('orbit-hint')!;
  private toastEl = document.getElementById('toast')!;
  private editorPane = document.getElementById('editor-pane')!;
  private editorTitle = document.getElementById('editor-title')!;
  private editorBody = document.getElementById('editor-body')!;
  private minimap = document.getElementById('minimap') as HTMLCanvasElement;
  private expandMiddle = false;
  private cb: HudCallbacks;

  constructor(cb: HudCallbacks) {
    this.cb = cb;
    document.getElementById('insp-close')!.onclick = () => cb.onCloseInspector();
    document.getElementById('insp-copy')!.onclick = () => {
      const p = this.inspPath.textContent || '';
      cb.onCopyPath(p);
    };
    document.getElementById('btn-open-folder')!.onclick = () => cb.onOpenFolder();
    document.getElementById('btn-demo')!.onclick = () => cb.onLoadDemo();
    document.getElementById('editor-close')!.onclick = () => cb.onCloseEditor();
    this.searchInput.addEventListener('input', () => cb.onSearch(this.searchInput.value));
    this.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.searchInput.value = '';
        this.hideSearch();
        this.searchInput.blur();
      }
    });
  }

  setOrbitMode(on: boolean) {
    this.orbitHint.classList.toggle('hidden', !on);
    this.ribbon.classList.toggle('hidden', on);
    this.counts.classList.toggle('hidden', on);
    this.depth.classList.toggle('hidden', on);
    this.minimap.classList.toggle('hidden', on);
  }

  renderPath(trail: AncestorRec[], view: FolderView | null) {
    this.ribbon.innerHTML = '';
    if (!trail.length) return;

    const chips: AncestorRec[] = [...trail];
    let display: Array<AncestorRec | 'ellipsis'> = chips;
    if (!this.expandMiddle && chips.length > 4) {
      display = [chips[0], 'ellipsis', chips[chips.length - 2], chips[chips.length - 1]];
      // Never collapse root or cwd — keep first and last always; if length>4 also keep second-last visible with ellipsis
      display = [chips[0], 'ellipsis', chips[chips.length - 1]];
    }

    display.forEach((item, idx) => {
      if (item === 'ellipsis') {
        const btn = document.createElement('button');
        btn.className = 'chip ellipsis';
        btn.textContent = '…';
        btn.title = 'Expand path';
        btn.onclick = () => {
          this.expandMiddle = true;
          this.cb.onExpandEllipsis();
        };
        this.ribbon.appendChild(btn);
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '/';
        this.ribbon.appendChild(sep);
        return;
      }
      const btn = document.createElement('button');
      const isRoot = idx === 0 && item === chips[0];
      const isCwd = item.path === chips[chips.length - 1].path;
      btn.className = 'chip' + (isCwd ? ' current' : '') + (isRoot ? ' root' : '');
      btn.textContent = isRoot ? `⊕ ${item.name}` : item.name;
      btn.title = item.path;
      btn.onclick = () => this.cb.onChipClick(item.path);
      this.ribbon.appendChild(btn);
      if (item.path !== chips[chips.length - 1].path) {
        const sep = document.createElement('span');
        sep.className = 'sep';
        sep.textContent = '/';
        this.ribbon.appendChild(sep);
      }
    });

    if (view) {
      this.counts.textContent = `${view.files.length} files · ${view.folders.length} folders`;
    } else {
      this.counts.textContent = '';
    }

    this.renderDepth(trail);
  }

  private renderDepth(trail: AncestorRec[]) {
    this.depth.innerHTML = '';
    const label = document.createElement('div');
    label.className = 'depth-label';
    const d = Math.max(0, trail.length - 1);
    label.textContent = `Depth ${d}`;
    label.title =
      d === 0
        ? 'At drive/project root'
        : `${d} membrane${d === 1 ? '' : 's'} under ${trail[0]?.name ?? 'root'}`;
    this.depth.appendChild(label);

    const stack = document.createElement('div');
    stack.className = 'rings';
    // Outermost ring = root (first), innermost = cwd (last)
    trail.forEach((a, i) => {
      const ring = document.createElement('button');
      const size = 28 - i * Math.min(3, 20 / Math.max(1, trail.length));
      ring.className = 'ring' + (i === trail.length - 1 ? ' you' : '');
      ring.style.width = `${size}px`;
      ring.style.height = `${size}px`;
      ring.style.borderColor = a.tint || '#7aa';
      ring.style.background = i === trail.length - 1 ? (a.tint || '#7aa') : 'transparent';
      ring.title = `${a.name} — ${a.path}`;
      ring.onmouseenter = () => this.cb.onDepthHover(i);
      ring.onmouseleave = () => this.cb.onDepthHover(null);
      ring.onclick = () => this.cb.onChipClick(a.path);
      stack.appendChild(ring);
    });
    this.depth.appendChild(stack);
  }

  showInspector(lot: LotPlacement) {
    this.inspector.classList.remove('hidden');
    this.inspName.textContent = lot.name;
    const lines: string[] = [];
    if (lot.kind === 'file' && lot.file) {
      lines.push(`Kind: file · ${lot.species ? speciesLabel(lot.species) : 'file'}`);
      lines.push(`Size: ${formatBytes(lot.file.bytes)}`);
      lines.push(`mtime: ${new Date(lot.file.mtime).toLocaleString()}`);
      if (lot.file.content) {
        lines.push(`LOC: ${lot.file.content.split('\n').length}`);
      }
    } else if (lot.kind === 'folder' && lot.folderMeta) {
      lines.push(`Kind: folder${lot.folderMeta.collapsed ? ' (collapsed industrial)' : ''}`);
      lines.push(`Subtree files: ${lot.folderMeta.subtreeFiles}`);
    } else if (lot.kind === 'gate') {
      lines.push('Kind: parent gate');
    }
    this.inspMeta.innerHTML = lines.map((l) => `<div>${escapeHtml(l)}</div>`).join('');
    this.inspPath.textContent = lot.path || lot.name;

    this.inspActions.innerHTML = '';
    if (lot.kind === 'folder') {
      const enter = document.createElement('button');
      enter.textContent = 'Enter dome';
      enter.onclick = () => this.cb.onEnterSelection();
      this.inspActions.appendChild(enter);
    }
    if (lot.kind === 'file') {
      const open = document.createElement('button');
      open.textContent = 'Open in editor';
      open.onclick = () => this.cb.onOpenEditor();
      this.inspActions.appendChild(open);
      if (lot.species === 'civic') {
        const interior = document.createElement('button');
        interior.textContent = 'Enter interior';
        interior.onclick = () => this.cb.onEnterSelection();
        this.inspActions.appendChild(interior);
      }
    }
    if (lot.kind === 'gate') {
      const back = document.createElement('button');
      back.textContent = 'Go up';
      back.onclick = () => this.cb.onEnterSelection();
      this.inspActions.appendChild(back);
    }
  }

  hideInspector() {
    this.inspector.classList.add('hidden');
  }

  showSearch(hits: SearchHit[]) {
    if (!hits.length) {
      this.hideSearch();
      return;
    }
    this.searchResults.classList.remove('hidden');
    this.searchResults.innerHTML = hits
      .map(
        (h, i) =>
          `<button data-i="${i}" class="search-hit">${escapeHtml(h.name)} <small>${h.kind}${
            h.inCwd ? '' : ' · deeper'
          }</small></button>`,
      )
      .join('');
    this.searchResults.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = Number((btn as HTMLElement).dataset.i);
        this.cb.onSearchPick(hits[i]);
        this.hideSearch();
        this.searchInput.value = '';
      });
    });
  }

  hideSearch() {
    this.searchResults.classList.add('hidden');
    this.searchResults.innerHTML = '';
  }

  toast(msg: string) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    setTimeout(() => this.toastEl.classList.add('hidden'), 1800);
  }

  showEditor(title: string, body: string) {
    this.editorPane.classList.remove('hidden');
    this.editorTitle.textContent = title;
    this.editorBody.textContent = body || '(no text content)';
  }

  hideEditor() {
    this.editorPane.classList.add('hidden');
  }

  resetExpand() {
    this.expandMiddle = false;
  }

  drawMinimap(
    lots: LotPlacement[],
    floorRadius: number,
    camX: number,
    camZ: number,
    yaw: number,
  ) {
    const ctx = this.minimap.getContext('2d')!;
    const W = this.minimap.width;
    const H = this.minimap.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(8,14,20,0.82)';
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a5060';
    ctx.lineWidth = 2;
    ctx.stroke();

    const scale = ((W / 2 - 8) / floorRadius) * 0.92;
    const to = (x: number, z: number) => ({
      x: W / 2 + x * scale,
      y: H / 2 + z * scale,
    });

    // plaza
    {
      const p = to(0, 0);
      ctx.fillStyle = '#4a5a66';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const lot of lots) {
      const p = to(lot.x, lot.z);
      if (lot.kind === 'folder') {
        ctx.strokeStyle = lot.tint || '#8cf';
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(3, lot.radius * scale), 0, Math.PI * 2);
        ctx.stroke();
      } else if (lot.kind === 'file') {
        ctx.fillStyle = speciesDot(lot.species);
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      } else if (lot.kind === 'gate') {
        // notch at -Z
        ctx.fillStyle = '#9ab';
        ctx.fillRect(p.x - 5, p.y - 3, 10, 6);
      }
    }

    // camera triangle
    const c = to(camX, camZ);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function speciesDot(s?: string): string {
  switch (s) {
    case 'civic': return '#88ccee';
    case 'office':
    case 'office-py': return '#6a8aaa';
    case 'library': return '#5a7a6a';
    case 'archive': return '#8a7a5a';
    case 'paint': return '#c070a0';
    case 'billboard': return '#d0c060';
    case 'vault': return '#405060';
    case 'warehouse': return '#606058';
    default: return '#9aa';
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
}
