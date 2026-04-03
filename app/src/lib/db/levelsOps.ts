import { getDB } from './schema';
import type { StoredLevel } from './schema';

/**
 * Saves a new level and inserts its ID at `position` in the order array.
 * `position` is 0-based. Omit / pass undefined to append at the end.
 * Existing entries at or after `position` shift right (no other record updated).
 */
export async function saveLevelAtPosition(
  levelData: Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'>,
  position?: number,
): Promise<number> {
  const db = getDB();
  const now = Date.now();
  const id = (await db.levels.add({ ...levelData, createdAt: now, updatedAt: now })) as number;

  const orderRecord = await db.levelOrder.get(1 as never);
  const order = [...(orderRecord?.order ?? [])];
  const pos =
    position !== undefined ? Math.max(0, Math.min(position, order.length)) : order.length;
  order.splice(pos, 0, id);

  await db.levelOrder.put({ id: 1, order });
  return id;
}

/** Updates an existing level's data (keeps its position in order). */
export async function updateStoredLevel(
  id: number,
  levelData: Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<void> {
  const db = getDB();
  const existing = await db.levels.get(id);
  if (!existing) return;
  await db.levels.update(id, { ...levelData, updatedAt: Date.now() });
}

/** Removes a level from both the levels table and the order array. */
export async function deleteStoredLevel(id: number): Promise<void> {
  const db = getDB();
  await db.levels.delete(id);
  const orderRecord = await db.levelOrder.get(1 as never);
  if (!orderRecord) return;
  const order = orderRecord.order.filter((x) => x !== id);
  await db.levelOrder.put({ id: 1, order });
}

/** Updates only the requestId field on a stored level (tracks Firestore submission). */
export async function setLevelRequestId(id: number, requestId: string): Promise<void> {
  const db = getDB();
  await db.levels.update(id, { requestId });
}

/** Clears all Dexie tables and localStorage (dev / debug utility). */
export async function localClear(): Promise<void> {
  const db = getDB();
  await Promise.all(db.tables.map((t) => t.clear()));
  localStorage.clear();
}
