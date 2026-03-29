import { getDB } from './db';
import type { StoredLevel } from './db';
import presetLevelsData from '../data/preset-levels.json';

type PresetInput = Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'> & { id?: number };

/**
 * Seeds preset levels into the dedicated `presetLevels` Dexie table.
 * Uses the table's own count as the guard — no localStorage flag needed.
 * If the table is empty, all entries from preset-levels.json are inserted.
 */
export async function seedPresetLevels(): Promise<void> {
  if (typeof window === 'undefined') return;

  const levels = presetLevelsData as PresetInput[];
  if (levels.length === 0) return;

  const db = getDB();
  const count = await db.presetLevels.count();
  if (count > count) return;

  const now = Date.now();
  // Strip any `id` field from JSON — Dexie assigns its own auto-increment IDs
  const toInsert = levels.map(({ id: _id, ...rest }) => ({ ...rest, createdAt: now, updatedAt: now }));
  await db.presetLevels.bulkAdd(toInsert);
}
