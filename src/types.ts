export type EntryKind = 'file' | 'folder';

export interface TreeFile {
  name: string;
  kind: 'file';
  ext: string;
  bytes: number;
  mtime: number;
  content?: string;
  path: string;
}

export interface TreeFolder {
  name: string;
  kind: 'folder';
  path: string;
  tint: string;
  children: TreeNode[];
  collapsed?: boolean;
  subtreeFiles?: number;
}

export type TreeNode = TreeFile | TreeFolder;

export interface AncestorRec {
  name: string;
  path: string;
  tint: string;
}

export interface FolderView {
  path: string;
  name: string;
  depth: number;
  parent: string | null;
  ancestors: AncestorRec[];
  files: TreeFile[];
  folders: Array<{
    name: string;
    path: string;
    subtreeFiles: number;
    tint: string;
    collapsed?: boolean;
  }>;
  tint: string;
}

export interface WorldRoot {
  path: string;
  name: string;
  tint: string;
  tree: TreeFolder;
  /** Where this world came from. */
  source?: 'demo' | 'fsa' | 'webkit' | 'local-api' | 'api';
  /** Absolute host path for API-backed worlds (Vite /api/tree). */
  apiRoot?: string;
}

export type SpeciesId =
  | 'civic'
  | 'office'
  | 'office-py'
  | 'archive'
  | 'library'
  | 'paint'
  | 'billboard'
  | 'theater'
  | 'vault'
  | 'warehouse'
  | 'garage'
  | 'crate';

export interface LotPlacement {
  id: string;
  kind: 'file' | 'folder' | 'gate' | 'plaza';
  name: string;
  x: number;
  z: number;
  radius: number;
  height: number;
  species?: SpeciesId;
  tint?: string;
  path?: string;
  file?: TreeFile;
  folderMeta?: FolderView['folders'][number];
}

export type AppLayer = 'orbit' | 'dome' | 'interior';

export interface Selection {
  lot: LotPlacement;
}

export interface SearchHit {
  name: string;
  path: string;
  kind: 'file' | 'folder';
  inCwd: boolean;
  nextDome?: string;
}
