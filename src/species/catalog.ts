import type { SpeciesId, TreeFile } from '../types';

const SOURCE_EXTS = new Set([
  'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  'go', 'rs', 'java', 'kt', 'c', 'cpp', 'h', 'hpp',
]);

const COLLAPSE_NAMES = new Set(['node_modules', '.git', 'dist', 'build']);

export function shouldCollapseFolder(name: string): boolean {
  return COLLAPSE_NAMES.has(name);
}

export function speciesForFile(file: TreeFile): SpeciesId {
  const ext = (file.ext || '').toLowerCase();
  const n = file.name.toLowerCase();

  if (ext === 'html' || ext === 'htm') return 'civic';
  if (ext === 'py') return 'office-py';
  if (SOURCE_EXTS.has(ext)) return 'office';
  if (ext === 'json' || ext === 'yaml' || ext === 'yml' || ext === 'toml') return 'archive';
  if (ext === 'md' || ext === 'txt' || ext === 'rst') return 'library';
  if (ext === 'css' || ext === 'scss' || ext === 'less') return 'paint';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext)) return 'billboard';
  if (['mp3', 'wav', 'ogg', 'mp4', 'webm', 'mov'].includes(ext)) return 'theater';
  if (ext === 'env' || ext === 'pem' || n.includes('secret') || n.startsWith('.env')) return 'vault';
  if (
    n.includes('lock') ||
    n.endsWith('-lock.json') ||
    n === 'package-lock.json' ||
    n === 'yarn.lock' ||
    n === 'pnpm-lock.yaml' ||
    ['exe', 'bin', 'dll', 'so', 'wasm', 'zip', 'tar', 'gz', 'tgz'].includes(ext)
  ) {
    return 'warehouse';
  }
  if (ext === 'sh' || ext === 'bash' || ext === 'zsh' || ext === 'ps1' || n === 'makefile') return 'garage';
  return 'crate';
}

export function speciesColor(id: SpeciesId): number {
  switch (id) {
    case 'civic': return 0x88ccee;
    case 'office': return 0x6a8aaa;
    case 'office-py': return 0xb07050;
    case 'archive': return 0x8a7a5a;
    case 'library': return 0x5a7a6a;
    case 'paint': return 0xc070a0;
    case 'billboard': return 0xd0c060;
    case 'theater': return 0x705090;
    case 'vault': return 0x405060;
    case 'warehouse': return 0x606058;
    case 'garage': return 0x708060;
    default: return 0x7a7a7a;
  }
}

export function speciesLabel(id: SpeciesId): string {
  switch (id) {
    case 'civic': return 'Civic glass';
    case 'office': return 'Office';
    case 'office-py': return 'Brick workshop';
    case 'archive': return 'Archive';
    case 'library': return 'Library';
    case 'paint': return 'Paint shop';
    case 'billboard': return 'Billboard';
    case 'theater': return 'Theater';
    case 'vault': return 'Vault';
    case 'warehouse': return 'Warehouse';
    case 'garage': return 'Garage';
    default: return 'Crate';
  }
}

export function hasInterior(species: SpeciesId): boolean {
  return species === 'civic';
}

export function isTextReadable(file: TreeFile): boolean {
  const s = speciesForFile(file);
  return (
    s === 'civic' ||
    s === 'office' ||
    s === 'office-py' ||
    s === 'archive' ||
    s === 'library' ||
    s === 'paint'
  );
}

/** Log-scaled height with strong compression + low cap for walkable sightlines. */
export function buildingHeight(file: TreeFile): number {
  const locGuess = file.content
    ? file.content.split('\n').length
    : Math.max(1, Math.round(file.bytes / 40));
  const base = isTextReadable(file) ? locGuess : file.bytes;
  const raw = 1 + Math.log2(1 + base);
  // Compress toward mid-rise; never skyscraper
  return Math.min(6.5, 1.15 + raw * 0.42);
}

export function childDomeDiameter(subtreeFiles: number): number {
  const d = 1.8 + 3.2 * Math.log2(1 + subtreeFiles);
  return Math.min(14, Math.max(1.8, d));
}

/** Slightly tighter floor so lots pack denser. */
export function floorRadius(entryCount: number): number {
  return 28 + 6 * Math.log2(1 + entryCount);
}
