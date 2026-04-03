import type { Timestamp } from 'firebase/firestore';
import type { StoredLevel } from '../db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminLevelInput = Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt' | 'firestoreId' | 'isNeedSync'> & {
  part: number;
};

export interface FirestoreLevel extends AdminLevelInput {
  firestoreId: string;
  createdAt: number;
  updatedAt: number;
  publishedBy: string;
}

/**
 * Metadata embedded in levelParts.order for each level.
 * Provides enough data for the levels list without reading levels/ collection.
 */
export interface LevelOrderEntry {
  id: string;
  name: string;
  width: number;
  height: number;
  difficulty?: 1 | 2 | 3 | 4;
  creatorName?: string;
  updatedAt: Timestamp | number;
}

export interface LevelPart {
  partId: string;
  name: string;
  unlockRequirement: number;
  order: LevelOrderEntry[];  // was string[] — now embeds metadata per level
  updatedAt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalises an order entry that may be a legacy string (old format) or a new object. */
export function entryId(e: string | LevelOrderEntry): string {
  return typeof e === 'string' ? e : e.id;
}
