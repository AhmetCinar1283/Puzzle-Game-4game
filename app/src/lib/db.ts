import Dexie, { type Table } from 'dexie';
import type { LevelEdges, CellType, LevelObjectDef, LevelTargetDef } from '../games/types';

// ─── Stored Types ─────────────────────────────────────────────────────────────

export interface StoredLevel {
  id?: number; // auto-increment Dexie ID
  name: string;
  width: number;
  height: number;
  edges: LevelEdges;
  grid: CellType[][];
  initialObjects: LevelObjectDef[];
  targets: LevelTargetDef[];
  trailCollision?: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * Single record (id: 1) storing the display order of level IDs.
 * Insertion/reorder only touches this one record — no bulk updates needed.
 */
export interface LevelOrderRecord {
  id: 1;
  order: number[]; // StoredLevel IDs in display order
}

// ─── Database ─────────────────────────────────────────────────────────────────

class KnowAndConquerDB extends Dexie {
  levels!: Table<StoredLevel>;
  levelOrder!: Table<LevelOrderRecord>;

  constructor() {
    super('KnowAndConquerDB');
    this.version(1).stores({
      levels: '++id',
      levelOrder: 'id',
    });
  }
}

// Lazy singleton — only instantiated in browser
let _db: KnowAndConquerDB | undefined;
export function getDB(): KnowAndConquerDB {
  if (!_db) _db = new KnowAndConquerDB();
  return _db;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns all levels in their current display order. */
export async function getOrderedLevels(): Promise<(StoredLevel & { id: number })[]> {
  const db = getDB();
  const orderRecord = await db.levelOrder.get(1 as never);
  const order: number[] = orderRecord?.order ?? [];
  if (order.length === 0) return [];

  const levels = await db.levels.bulkGet(order);
  return order
    .map((id, idx) => {
      const lvl = levels[idx];
      return lvl ? { ...lvl, id } : null;
    })
    .filter((x): x is StoredLevel & { id: number } => x !== null);
}

/** Returns the Dexie ID of the level that comes after currentId in the order. */
export async function getNextLevelId(currentId: number): Promise<number | null> {
  const db = getDB();
  const orderRecord = await db.levelOrder.get(1 as never);
  const order: number[] = orderRecord?.order ?? [];
  const idx = order.indexOf(currentId);
  if (idx < 0 || idx >= order.length - 1) return null;
  return order[idx + 1];
}

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

/** Replaces the entire order array (used by drag-and-drop / up-down reorder). */
export async function reorderLevels(newOrder: number[]): Promise<void> {
  const db = getDB();
  await db.levelOrder.put({ id: 1, order: newOrder });
}
