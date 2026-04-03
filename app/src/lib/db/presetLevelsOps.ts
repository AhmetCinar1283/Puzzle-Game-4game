import { getDB } from './schema';
import type { StoredLevel } from './schema';

/** Returns all preset levels ordered by their auto-increment ID. */
export async function getPresetLevels(): Promise<(StoredLevel & { id: number })[]> {
  const db = getDB();
  return (await db.presetLevels.orderBy('id').toArray()) as (StoredLevel & { id: number })[];
}

/** Returns the preset level that comes after currentId, or null if it's the last. */
export async function getNextPresetLevelId(currentId: number): Promise<number | null> {
  const db = getDB();
  const keys = (await db.presetLevels.orderBy('id').primaryKeys()) as number[];
  const idx = keys.indexOf(currentId);
  if (idx < 0 || idx >= keys.length - 1) return null;
  return keys[idx + 1];
}
