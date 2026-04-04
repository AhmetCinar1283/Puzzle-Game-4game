import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
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
  const batch = writeBatch(db);

  // 1. Create the level document
  const levelRef = doc(collection(db, 'levels'));
  batch.set(levelRef, {
    ...data,
    grid: JSON.stringify(data.grid),
    publishedBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

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

  // 3. Build the order entry
  const entry: Omit<LevelOrderEntry, 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
    id: levelRef.id,
    name: data.name,
    width: data.width,
    height: data.height,
    position: maxPos + 1,
    ...(data.difficulty != undefined && { difficulty: data.difficulty }),
    ...(data.creatorName && { creatorName: data.creatorName }),
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
  const batch = writeBatch(db);

  // 1. Update the level document
  batch.update(doc(db, 'levels', firestoreId), {
    ...data,
    grid: JSON.stringify(data.grid),
    publishedBy,
    updatedAt: serverTimestamp(),
  });

  // 2. Update only the metadata fields in the order entry (field-path, concurrent-safe)
  const entryUpdate: Record<string, unknown> = {
    [`order.${firestoreId}.name`]: data.name,
    [`order.${firestoreId}.width`]: data.width,
    [`order.${firestoreId}.height`]: data.height,
    [`order.${firestoreId}.updatedAt`]: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (data.difficulty) entryUpdate[`order.${firestoreId}.difficulty`] = data.difficulty;
  if (data.creatorName) entryUpdate[`order.${firestoreId}.creatorName`] = data.creatorName;

  batch.update(doc(db, 'levelParts', partId), entryUpdate);

  await batch.commit();
}

/**
 * Deletes a level from Firestore and removes its entry from the part's order map.
 *
 * Uses deleteField() on the specific order key — no stale-read risk.
 */
export async function deleteFirestoreLevel(
  firestoreId: string,
  partId: string,
): Promise<void> {
  const batch = writeBatch(db);

  batch.delete(doc(db, 'levels', firestoreId));

  batch.update(doc(db, 'levelParts', partId), {
    [`order.${firestoreId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
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
