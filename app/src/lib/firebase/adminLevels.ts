import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db } from './config';
import type { AdminLevelInput, FirestoreLevel, LevelOrderEntry } from './adminTypes';
import { getPart } from './adminParts';

export type { AdminLevelInput, FirestoreLevel };

/**
 * Publishes a new level to Firestore and appends it to the end of the
 * specified part's order map (as a LevelOrderEntry object).
 *
 * Uses a field-path update for the order entry — so concurrent publishes to
 * the same part from different admins won't overwrite each other's additions.
 *
 * Returns the new Firestore document ID.
 */
export async function publishLevel(
  data: AdminLevelInput,
  partId: string,
  publishedBy: string,
): Promise<string> {
  const cleanData = JSON.parse(JSON.stringify(data));
  if (cleanData.rooms && Array.isArray(cleanData.rooms)) {
    cleanData.rooms = cleanData.rooms.map((r: any) => ({
      ...r,
      grid: typeof r.grid === 'string' ? r.grid : JSON.stringify(r.grid)
    }));
  }
  const batch = writeBatch(db);

  // 1. Create the level document ref (set after computing prevLevelId below)
  const levelRef = doc(collection(db, 'levels'));

  // 2. Determine position (max existing + 1)
  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  const currentOrder: Record<string, LevelOrderEntry> = partSnap.exists()
    ? (partSnap.data().order as Record<string, LevelOrderEntry>) ?? {}
    : {};
  const maxPos = Object.values(currentOrder).reduce(
    (m, e) => Math.max(m, e.position ?? 0),
    -1,
  );

  // Find the current last-position level (becomes prevLevelId for the new level)
  const prevEntry = Object.values(currentOrder).find(
    (e) => (e.position ?? -1) === maxPos,
  );
  const prevLevelId: string | null = prevEntry?.id ?? null;

  // 1a. Set prevLevelId on the new level document
  batch.set(levelRef, {
    ...cleanData,
    grid: JSON.stringify(cleanData.grid),
    publishedBy,
    prevLevelId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 3. Build the order entry
  const entry: Omit<LevelOrderEntry, 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
    id: levelRef.id,
    name: cleanData.name,
    width: cleanData.width,
    height: cleanData.height,
    position: maxPos + 1,
    ...(cleanData.difficulty != undefined && { difficulty: cleanData.difficulty }),
    ...(cleanData.creatorName && { creatorName: cleanData.creatorName }),
    updatedAt: serverTimestamp(),
  };

  // 4. Write to part — field-path update (concurrent-safe)
  if (partSnap.exists()) {
    batch.update(partRef, {
      [`order.${entry.id}`]: entry,
      updatedAt: serverTimestamp(),
    });
  } else {
    batch.set(partRef, {
      name: `Part ${partId}`,
      unlockRequirement: 0,
      order: { [entry.id]: entry },
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return levelRef.id;
}

/**
 * Updates an existing Firestore level's content and bumps its metadata entry
 * in the part's order map.
 *
 * Uses field-path updates for the order entry so position and other fields
 * set by concurrent admins are not overwritten.
 */
export async function updateFirestoreLevel(
  firestoreId: string,
  data: AdminLevelInput,
  publishedBy: string,
  partId: string,
): Promise<void> {
  const cleanData = JSON.parse(JSON.stringify(data));
  if (cleanData.rooms && Array.isArray(cleanData.rooms)) {
    cleanData.rooms = cleanData.rooms.map((r: any) => ({
      ...r,
      grid: typeof r.grid === 'string' ? r.grid : JSON.stringify(r.grid)
    }));
  }
  const batch = writeBatch(db);

  // 1. Update the level document
  batch.update(doc(db, 'levels', firestoreId), {
    ...cleanData,
    grid: JSON.stringify(cleanData.grid),
    publishedBy,
    updatedAt: serverTimestamp(),
  });

  // 2. Update only the metadata fields in the order entry (field-path, concurrent-safe)
  const entryUpdate: Record<string, unknown> = {
    [`order.${firestoreId}.name`]: cleanData.name,
    [`order.${firestoreId}.width`]: cleanData.width,
    [`order.${firestoreId}.height`]: cleanData.height,
    [`order.${firestoreId}.updatedAt`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (cleanData.difficulty) entryUpdate[`order.${firestoreId}.difficulty`] = cleanData.difficulty;
  if (cleanData.creatorName) entryUpdate[`order.${firestoreId}.creatorName`] = cleanData.creatorName;

  batch.update(doc(db, 'levelParts', partId), entryUpdate);

  await batch.commit();
}

/**
 * Deletes a level from Firestore and removes its entry from the part's order map.
 * Also repairs the prevLevelId chain: the successor level (if any) gets its
 * prevLevelId patched to point to the deleted level's predecessor.
 *
 * Uses deleteField() on the specific order key — no stale-read risk.
 */
export async function deleteFirestoreLevel(
  firestoreId: string,
  partId: string,
): Promise<void> {
  // Read the deleted level's own prevLevelId and the part order before deleting
  const [deletedLevelSnap, partSnap] = await Promise.all([
    getDoc(doc(db, 'levels', firestoreId)),
    partId ? getDoc(doc(db, 'levelParts', partId)) : Promise.resolve(null),
  ]);

  const deletedPrevLevelId: string | null = deletedLevelSnap.exists()
    ? (deletedLevelSnap.data().prevLevelId as string | null) ?? null
    : null;

  // Find the successor (the level whose prevLevelId was firestoreId)
  // by finding the order entry with position === deleted level's position + 1
  let successorFirestoreId: string | null = null;
  if (partSnap && partSnap.exists()) {
    const order: Record<string, LevelOrderEntry> = partSnap.data().order ?? {};
    const deletedEntry = order[firestoreId];
    const deletedPos = deletedEntry?.position ?? -1;
    const successorEntry = Object.values(order).find(
      (e) => e.id !== firestoreId && (e.position ?? -1) === deletedPos + 1,
    );
    successorFirestoreId = successorEntry?.id ?? null;
  }

  const batch = writeBatch(db);

  batch.delete(doc(db, 'levels', firestoreId));

  if (partId) {
    batch.update(doc(db, 'levelParts', partId), {
      [`order.${firestoreId}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  // Patch successor's prevLevelId to point to deleted level's predecessor (non-fatal)
  if (successorFirestoreId !== null) {
    try {
      await updateDoc(doc(db, 'levels', successorFirestoreId), {
        prevLevelId: deletedPrevLevelId,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.error('[deleteFirestoreLevel] Failed to patch successor prevLevelId:', e);
    }
  }
}

/**
 * Returns all levels in a part, sorted by their position field.
 * Fetches all level documents referenced by the part's order map.
 */
export async function getPartLevels(partId: string): Promise<FirestoreLevel[]> {
  const part = await getPart(partId);
  if (!part || Object.values(part.order).length === 0) return [];

  const levelDocs = await Promise.all(
    Object.keys(part.order).map((k) => getDoc(doc(db, 'levels', k))),
  );

  return levelDocs
    .filter((d) => d.exists())
    .map((d) => ({
      firestoreId: d.id,
      ...(d.data() as Omit<FirestoreLevel, 'firestoreId'>),
    }))
    .sort((a, b) => {
      const posA = (part.order[a.firestoreId]?.position ?? 0);
      const posB = (part.order[b.firestoreId]?.position ?? 0);
      return posA - posB;
    });
}
