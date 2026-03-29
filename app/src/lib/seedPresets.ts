import { getDB } from './db';
import type { StoredLevel } from './db';
import presetLevelsData from '../data/preset-levels.json';

type PresetInput = Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'> & { id?: number };

const HASH_KEY = 'presetLevelsHash';

function computeHash(levels: PresetInput[]): string {
  const str = JSON.stringify(levels);
  return `${str.length}_${levels.length}_${levels[0]?.name ?? ''}_${levels[levels.length - 1]?.name ?? ''}`;
}

/**
 * Seeds preset levels into the dedicated `presetLevels` Dexie table.
 * Uses a content hash stored in localStorage to detect when preset-levels.json
 * has changed. If the hash differs (or the table is empty), clears and re-seeds.
 */
export async function seedPresetLevels(): Promise<void> {
  if (typeof window === 'undefined') return;

  const levels = presetLevelsData as PresetInput[];
  if (levels.length === 0) return;

  const db = getDB();
  const newHash = computeHash(levels);
  const storedHash = localStorage.getItem(HASH_KEY);
  const count = await db.presetLevels.count();

  // Already up to date — nothing to do
  if (storedHash === newHash && count > 0) return;

  // JSON changed or table empty — re-seed everything
  await db.presetLevels.clear();
  // Clear last-played tracking since IDs will change after re-seed
  localStorage.removeItem('lastPlayedLevelId');
  localStorage.removeItem('lastPlayedSource');

  const now = Date.now();
  const toInsert = levels.map(({ id: _id, ...rest }) => ({ ...rest, createdAt: now, updatedAt: now }));
  await db.presetLevels.bulkAdd(toInsert);
  localStorage.setItem(HASH_KEY, newHash);
}
