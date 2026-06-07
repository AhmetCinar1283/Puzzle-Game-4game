import { getDB } from './schema';
import type { StoredLevel } from './schema';

/**
 * Returns all preset levels, deduplicated by firestoreId and ordered by position.
 *
 * Duplicates can occur when syncLevelsMeta runs concurrently or is called
 * multiple times before the first run finishes — the same Firestore entry
 * ends up inserted more than once. We keep the record with the highest Dexie
 * ID (the most recently inserted / updated one) and discard earlier copies.
 * Stale duplicates are asynchronously deleted from Dexie (self-healing).
 */
export async function getPresetLevels(): Promise<(StoredLevel & { id: number })[]> {
  const db = getDB();
  const all = (await db.presetLevels.orderBy('id').toArray()) as (StoredLevel & { id: number })[];

  // Deduplicate: for each firestoreId, keep the record with the highest Dexie id
  const seen = new Map<string, StoredLevel & { id: number }>();
  const duplicateIds: number[] = [];

  for (const level of all) {
    const key = level.firestoreId ?? `__no_fid_${level.id}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, level);
    } else if (level.id > existing.id) {
      // Current record is newer — mark the old one as a duplicate
      duplicateIds.push(existing.id);
      seen.set(key, level);
    } else {
      // This record is the older duplicate
      duplicateIds.push(level.id);
    }
  }

  // Self-heal: delete stale duplicates in the background (fire-and-forget)
  if (duplicateIds.length > 0) {
    db.presetLevels.bulkDelete(duplicateIds).catch((err) =>
      console.warn('[getPresetLevels] Failed to delete duplicate records:', err),
    );
  }

  // Sort by position (ascending), fallback to Dexie id for stability
  return Array.from(seen.values()).sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id,
  );
}

/**
 * Returns the Dexie ID of the preset level that comes after currentId.
 * Uses the same deduplicated + sorted list to ensure correct ordering.
 */
export async function getNextPresetLevelId(currentId: number): Promise<number | null> {
  const sorted = await getPresetLevels();
  const currentLvl = sorted.find((l) => l.id === currentId);
  if (!currentLvl) return null;

  const partLevels = currentLvl.part
    ? sorted.filter((l) => l.part === currentLvl.part)
    : sorted;

  const idx = partLevels.findIndex((l) => l.id === currentId);
  if (idx < 0 || idx >= partLevels.length - 1) return null;
  return partLevels[idx + 1].id;
}
