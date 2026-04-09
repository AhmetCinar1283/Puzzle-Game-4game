import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { getDB } from '../db';
import type { StoredLevel, StoredPlayedLevel } from '../db';
import type { LevelOrderEntry } from './admin';
import type { LevelEdges } from '../../games/types';

// ─── Constants ────────────────────────────────────────────────────────────────

const META_SYNC_COOLDOWN_MS = 5 * 60 * 1000;  // 5 minutes
const PLAYED_SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const LEVELS_META_SYNC_KEY = 'levelsMeta';

// ─── Dexie syncMeta helpers ───────────────────────────────────────────────────

async function readLastSync(key: string): Promise<number> {
  try {
    const record = await getDB().syncMeta.get(key);
    return record?.lastSync ?? 0;
  } catch {
    return 0;
  }
}

async function writeLastSync(key: string, ts: number): Promise<void> {
  try {
    await getDB().syncMeta.put({ collection: key, lastSync: ts });
  } catch { /* ignore write failures */ }
}

// ─── Timestamp helper ─────────────────────────────────────────────────────────

function toMs(v: unknown): number {
  if (v instanceof Timestamp) return v.toMillis();
  if (typeof v === 'number') return v;
  return 0;
}

// ─── Firestore → Dexie helpers ────────────────────────────────────────────────

/**
 * Converts a raw Firestore level document to a StoredLevel for Dexie.
 * Timestamps are converted to ms numbers.
 */
function firestoreDocToStoredLevel(
  firestoreId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
): Omit<StoredLevel, 'id'> {
  return {
    firestoreId,
    name: data.name,
    width: data.width,
    height: data.height,
    edges: data.edges,
    grid: typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid,
    initialObjects: data.initialObjects,
    targets: data.targets,
    trailCollision: data.trailCollision,
    initialBoxes: data.initialBoxes,
    conveyorPowerRequired: data.conveyorPowerRequired,
    conveyorConfig: data.conveyorConfig,
    launcherConfig: data.launcherConfig,
    trampolineConfig: data.trampolineConfig,
    creatorName: data.creatorName ?? undefined,
    difficulty: data.difficulty ?? undefined,
    position: data.position,
    part: data.part,
    isNeedSync: false,
    createdAt: toMs(data.createdAt),
    updatedAt: toMs(data.updatedAt),
  };
}

// ─── Metadata sync (levels page) ─────────────────────────────────────────────

/**
 * Lightweight sync run on every /levels page open (5-minute cooldown).
 *
 * Queries levelParts that changed since last sync, then for each entry in
 * their order arrays: inserts new metadata-only records or marks changed
 * records as isNeedSync=true. Does NOT read the levels/ collection.
 *
 * @param force — skips the 5-minute cooldown (used by manual ↻ button).
 */
export async function syncLevelsMeta(force = false): Promise<void> {
  const lastSyncMs = force ? 0 : await readLastSync(LEVELS_META_SYNC_KEY);
  if (!force && Date.now() - lastSyncMs < META_SYNC_COOLDOWN_MS) return;

  const dexie = getDB();

  // Query only parts that changed since last sync (or all on first run)
  const partsSnap = lastSyncMs > 0
    ? await getDocs(
        query(
          collection(db, 'levelParts'),
          where('updatedAt', '>', Timestamp.fromMillis(lastSyncMs)),
        ),
      )
    : await getDocs(collection(db, 'levelParts'));

  for (const partDoc of partsSnap.docs) {
    const partData = partDoc.data();
    const order: Record<string, LevelOrderEntry> = partData.order ?? {};

    for (const entry of Object.values(order)) {
      const isLegacy = typeof entry === 'string';
      const eid = isLegacy ? entry : entry.id;
      const entryUpdatedAt = isLegacy ? 0 : toMs(entry.updatedAt);

      const existing = await dexie.presetLevels
        .where('firestoreId')
        .equals(eid)
        .first();

      const partNumber = partDoc.id;

      if (!existing) {
        // New level — insert metadata-only placeholder; game page will lazy-fetch full data
        const placeholder: Omit<StoredLevel, 'id'> = {
          firestoreId: eid,
          name: isLegacy ? '' : entry.name,
          width: isLegacy ? 0 : entry.width,
          height: isLegacy ? 0 : entry.height,
          difficulty: isLegacy ? undefined : entry.difficulty,
          creatorName: isLegacy ? undefined : entry.creatorName,
          part: partNumber,
          edges: { top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' } as LevelEdges,
          grid: [],
          initialObjects: [],
          targets: [],
          isNeedSync: true,
          createdAt: Date.now(),
          updatedAt: entryUpdatedAt,
          position: entry.position
        };
        await dexie.presetLevels.add(placeholder);
      } else {
        // Existing record — mark as stale if the entry's updatedAt moved forward
        if (entryUpdatedAt > (existing.updatedAt ?? 0) || isLegacy) {
          await dexie.presetLevels.update(existing.id!, {
            name: isLegacy ? existing.name : entry.name,
            width: isLegacy ? existing.width : entry.width,
            height: isLegacy ? existing.height : entry.height,
            difficulty: isLegacy ? existing.difficulty : entry.difficulty,
            creatorName: isLegacy ? existing.creatorName : entry.creatorName,
            part: partNumber,
            updatedAt: entryUpdatedAt || existing.updatedAt,
            isNeedSync: true,
            position: isLegacy ? existing.position : entry.position,
          });
        } else if (existing.part !== partNumber || (!isLegacy && entry.position !== existing.position)) {
          // Part field or position missing/wrong — patch without marking stale
          await dexie.presetLevels.update(existing.id!, {
            part: partNumber,
            position: isLegacy ? existing.position : entry.position,
          });
        }
      }
    }
  }

  await writeLastSync(LEVELS_META_SYNC_KEY, Date.now());
}

// ─── Lazy level fetch (game page) ─────────────────────────────────────────────

/**
 * Fetches full level data from Firestore and updates the Dexie presetLevels record.
 * Called by game/page.tsx when a level has isNeedSync=true or missing grid data.
 * Clears isNeedSync after a successful fetch.
 */
export async function fetchAndCacheLevel(
  firestoreId: string,
  dexieId: number,
): Promise<void> {
  const snap = await getDoc(doc(db, 'levels', firestoreId));
  if (!snap.exists()) return;

  const data = snap.data() as Record<string, unknown>;
  const level = firestoreDocToStoredLevel(firestoreId, data);

  const dexie = getDB();
  await dexie.presetLevels.update(dexieId, level); // includes isNeedSync: false
}

// ─── Played levels sync ───────────────────────────────────────────────────────

/**
 * Syncs the current user's playedLevels from Firestore → Dexie.
 * Only fetches records whose updatedAt > lastSync (delta query).
 * @param force — if true, skips the 24-hour cooldown.
 */
export async function syncPlayedLevels(uid: string, force = false): Promise<void> {
  const metaKey = 'playedLevels';
  const lastSyncMs = force ? 0 : await readLastSync(metaKey);

  if (!force && Date.now() - lastSyncMs < PLAYED_SYNC_COOLDOWN_MS) return;

  const dexie = getDB();

  const colRef = collection(db, 'users', uid, 'playedLevels');
  const q = lastSyncMs > 0
    ? query(colRef, where('updatedAt', '>', Timestamp.fromMillis(lastSyncMs)))
    : colRef;

  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const raw = d.data();
    const rawStars = raw.stars;
    const record: StoredPlayedLevel = {
      levelId: d.id,
      score: raw.score ?? 0,
      timeSpent: raw.timeSpent ?? 0,
      completedAt: toMs(raw.completedAt),
      updatedAt: toMs(raw.updatedAt),
      stars: (rawStars === 1 || rawStars === 2 || rawStars === 3) ? rawStars : undefined,
      moveCount: typeof raw.moveCount === 'number' ? raw.moveCount : undefined,
    };
    await dexie.playedLevels.put(record);
  }

  await writeLastSync(metaKey, Date.now());
}
