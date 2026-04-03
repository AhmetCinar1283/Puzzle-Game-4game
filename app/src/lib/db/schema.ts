import Dexie, { type Table } from 'dexie';
import type { LevelEdges, CellType, LevelObjectDef, LevelTargetDef, BoxDef, Position } from '../../games/types';

// ─── Stored Types ─────────────────────────────────────────────────────────────

export interface StoredLevel {
  id?: number;           // auto-increment Dexie ID
  firestoreId?: string;  // Firestore document ID (preset levels only)
  name: string;
  width: number;
  height: number;
  edges: LevelEdges;
  grid: CellType[][] | string;
  initialObjects: LevelObjectDef[];
  targets: LevelTargetDef[];
  trailCollision?: boolean;
  initialBoxes?: BoxDef[];
  conveyorPowerRequired?: Position[];
  creatorName?: string;  // Attribution for community-submitted levels
  difficulty?: 1 | 2 | 3 | 4;  // 1=Kolay, 2=Orta, 3=Zor, 4=Çok Zor
  part?: number;          // Firestore part number (preset levels only)
  requestId?: string;     // Firestore levelRequests doc ID (tracks pending submission)
  isNeedSync?: boolean;   // true = fetch fresh full data from Firestore before playing
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

/** Cached record of a completed level, synced from Firestore. */
export interface StoredPlayedLevel {
  levelId: string;     // primary key = Firestore doc ID
  score: number;
  timeSpent: number;   // seconds
  completedAt: number; // ms
  updatedAt: number;   // ms
}

/** Per-collection sync metadata — replaces localStorage-based cooldown tracking. */
export interface SyncMetaRecord {
  collection: string; // primary key (e.g. "part_1", "playedLevels")
  lastSync: number;   // ms timestamp of last successful sync
}

// ─── Database ─────────────────────────────────────────────────────────────────

export class KnowAndConquerDB extends Dexie {
  levels!: Table<StoredLevel>;
  levelOrder!: Table<LevelOrderRecord>;
  presetLevels!: Table<StoredLevel>;
  playedLevels!: Table<StoredPlayedLevel>;
  syncMeta!: Table<SyncMetaRecord>;

  constructor() {
    super('KnowAndConquerDB');
    this.version(1).stores({ levels: '++id', levelOrder: 'id' });
    // Version 2: added initialBoxes and conveyorPowerRequired (optional fields, no migration needed)
    this.version(2).stores({ levels: '++id', levelOrder: 'id' });
    // Version 3: separate table for preset (campaign) levels — read-only for users
    this.version(3).stores({ levels: '++id', levelOrder: 'id', presetLevels: '++id' });
    // Version 4: firestoreId index on presetLevels for fast Firestore sync matching
    this.version(4).stores({ levels: '++id', levelOrder: 'id', presetLevels: '++id, firestoreId' });
    // Version 5: syncMeta (per-collection lastSync) + playedLevels cache from Firestore
    this.version(5).stores({
      levels: '++id',
      levelOrder: 'id',
      presetLevels: '++id, firestoreId',
      syncMeta: 'collection',
      playedLevels: 'levelId, updatedAt',
    });
    // Version 6: creatorName field added to StoredLevel (optional, no destructive migration needed)
    this.version(6).stores({
      levels: '++id',
      levelOrder: 'id',
      presetLevels: '++id, firestoreId',
      syncMeta: 'collection',
      playedLevels: 'levelId, updatedAt',
    });
    // Version 7: difficulty, part, requestId fields (optional, no destructive migration needed)
    this.version(7).stores({
      levels: '++id',
      levelOrder: 'id',
      presetLevels: '++id, firestoreId',
      syncMeta: 'collection',
      playedLevels: 'levelId, updatedAt',
    });
    // Version 8: isNeedSync field for lazy Firestore fetch (optional, no destructive migration needed)
    this.version(8).stores({
      levels: '++id',
      levelOrder: 'id',
      presetLevels: '++id, firestoreId',
      syncMeta: 'collection',
      playedLevels: 'levelId, updatedAt',
    });
  }
}

// Lazy singleton — only instantiated in browser
let _db: KnowAndConquerDB | undefined;
export function getDB(): KnowAndConquerDB {
  if (!_db) _db = new KnowAndConquerDB();
  return _db;
}
