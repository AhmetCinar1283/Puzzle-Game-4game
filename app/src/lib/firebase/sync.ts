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

// ─── Constants ────────────────────────────────────────────────────────────────

const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const toMs = (v: unknown): number => {
    if (v instanceof Timestamp) return v.toMillis();
    if (typeof v === 'number') return v;
    return Date.now();
  };
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
    creatorName: data.creatorName ?? undefined,
    createdAt: toMs(data.createdAt),
    updatedAt: toMs(data.updatedAt),
  };
}

// ─── Core sync logic ──────────────────────────────────────────────────────────

/**
 * Full re-sync of a single part: clears existing Dexie preset rows for this
 * part and repopulates them from Firestore in order.
 */
async function fullSyncPart(partId: string, order: string[]): Promise<void> {
  if (order.length === 0) return;

  const dexie = getDB();

  // Fetch all level docs in parallel
  const snapshots = await Promise.all(
    order.map((id) => getDoc(doc(db, 'levels', id))),
  );

  // Delete all Dexie rows whose firestoreId was in this part's order
  await dexie.presetLevels
    .where('firestoreId')
    .anyOf(order)
    .delete();

  const now = Date.now();
  const toInsert: Omit<StoredLevel, 'id'>[] = snapshots
    .filter((s) => s.exists())
    .map((s) => firestoreDocToStoredLevel(s.id, s.data() as Record<string, unknown>));

  // Insert sequentially so auto-increment IDs reflect display order
  for (const level of toInsert) {
    await dexie.presetLevels.add({ ...level, createdAt: level.createdAt || now });
  }
}

/**
 * Partial sync: only update Dexie records for levels that changed after lastSync.
 */
async function partialSyncPart(partId: string, lastSyncMs: number): Promise<void> {
  const dexie = getDB();
  const lastSyncTimestamp = Timestamp.fromMillis(lastSyncMs);

  // Query levels in this part that were updated after lastSync
  const q = query(
    collection(db, 'levels'),
    where('part', '==', Number(partId)),
    where('updatedAt', '>', lastSyncTimestamp),
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  for (const d of snap.docs) {
    const incoming = firestoreDocToStoredLevel(d.id, d.data() as Record<string, unknown>);
    const existing = await dexie.presetLevels
      .where('firestoreId')
      .equals(d.id)
      .first();

    if (existing?.id !== undefined) {
      await dexie.presetLevels.update(existing.id, incoming);
    } else {
      await dexie.presetLevels.add(incoming);
    }
  }
}

/**
 * Syncs a single part from Firestore to Dexie.
 *
 * - Respects SYNC_COOLDOWN_MS; skips if called too soon.
 * - Checks `levelParts/{partId}.updatedAt` first:
 *   - If order/metadata changed → full re-sync of the part
 *   - Otherwise → partial sync (only levels whose updatedAt > lastSync)
 */
/**
 * @param force — if true, skips the 24-hour cooldown check (used by manual refresh).
 */
export async function syncPart(partId: string, force = false): Promise<void> {
  const metaKey = `part_${partId}`;
  const lastSyncMs = force ? 0 : await readLastSync(metaKey);

  if (!force && Date.now() - lastSyncMs < SYNC_COOLDOWN_MS) return;

  const partSnap = await getDoc(doc(db, 'levelParts', partId));
  if (!partSnap.exists()) return;

  const partData = partSnap.data();
  const partUpdatedMs =
    partData.updatedAt instanceof Timestamp
      ? partData.updatedAt.toMillis()
      : (partData.updatedAt as number) ?? 0;

  const order: string[] = partData.order ?? [];

  if (force || partUpdatedMs > lastSyncMs) {
    await fullSyncPart(partId, order);
  } else {
    await partialSyncPart(partId, lastSyncMs);
  }

  await writeLastSync(metaKey, Date.now());
}

/**
 * Syncs all parts from Firestore.
 * @param force — if true, skips the 24-hour cooldown (used by manual refresh button).
 */
export async function syncAllParts(force = false): Promise<void> {
  const partsSnap = await getDocs(collection(db, 'levelParts'));
  await Promise.all(partsSnap.docs.map((d) => syncPart(d.id, force)));
}

/**
 * Syncs the current user's playedLevels from Firestore → Dexie.
 * Only fetches records whose updatedAt > lastSync (delta query).
 * @param force — if true, skips the 24-hour cooldown.
 */
export async function syncPlayedLevels(uid: string, force = false): Promise<void> {
  const metaKey = 'playedLevels';
  const lastSyncMs = force ? 0 : await readLastSync(metaKey);

  if (!force && Date.now() - lastSyncMs < SYNC_COOLDOWN_MS) return;

  const dexie = getDB();

  const toMs = (v: unknown): number => {
    if (v instanceof Timestamp) return v.toMillis();
    if (typeof v === 'number') return v;
    return Date.now();
  };

  const colRef = collection(db, 'users', uid, 'playedLevels');
  const q = lastSyncMs > 0
    ? query(colRef, where('updatedAt', '>', Timestamp.fromMillis(lastSyncMs)))
    : colRef;

  const snap = await getDocs(q);

  for (const d of snap.docs) {
    const data = d.data();
    const record: StoredPlayedLevel = {
      levelId: d.id,
      score: data.score ?? 0,
      timeSpent: data.timeSpent ?? 0,
      completedAt: toMs(data.completedAt),
      updatedAt: toMs(data.updatedAt),
    };
    await dexie.playedLevels.put(record);
  }

  await writeLastSync(metaKey, Date.now());
}
