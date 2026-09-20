import { indexDemoPayload } from './treeIndex';
import type { WorldRoot } from '../types';

export async function loadDemoWorlds(): Promise<WorldRoot[]> {
  const res = await fetch('/demo-tree.json');
  if (!res.ok) throw new Error(`Failed to load demo-tree.json: ${res.status}`);
  const json = await res.json();
  return indexDemoPayload(json);
}
