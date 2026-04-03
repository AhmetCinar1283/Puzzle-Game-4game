import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { AdminLevelInput, FirestoreLevel, LevelOrderEntry } from './adminTypes';
import { entryId } from './adminTypes';
import { getPart } from './adminParts';

export type { AdminLevelInput, FirestoreLevel };

/**
 * Publishes a new level to Firestore and appends it to the end of the
 * specified part's order array (as a LevelOrderEntry object).
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
    grid: JSON.stringify(data.grid), // Firestore doesn't support nested arrays
    publishedBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Build the order entry
  const entry: Omit<LevelOrderEntry, 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
    id: levelRef.id,
    name: data.name,
    width: data.width,
    height: data.height,
    difficulty: data.difficulty ?? undefined,
    creatorName: data.creatorName ?? undefined,
    updatedAt: serverTimestamp(),
  };

  // 3. Append to part order
  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  const currentOrder: (string | LevelOrderEntry)[] = partSnap.exists()
    ? (partSnap.data().order as (string | LevelOrderEntry)[]) ?? []
    : [];

  if (partSnap.exists()) {
    batch.update(partRef, {
      order: [...currentOrder, entry],
      updatedAt: serverTimestamp(),
    });
  } else {
    // Part doesn't exist yet — create it with sensible defaults
    batch.set(partRef, {
      name: `Part ${partId}`,
      unlockRequirement: 0,
      order: [entry],
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return levelRef.id;
}

/**
 * Updates an existing Firestore level's content.
 * Also updates the metadata entry in the part's order array and bumps levelParts.updatedAt
 * so that sync clients know to re-fetch.
 */
export async function updateFirestoreLevel(
  firestoreId: string,
  data: AdminLevelInput,
  publishedBy: string,
  partId: string,
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Update the level document
  const levelRef = doc(db, 'levels', firestoreId);
  batch.update(levelRef, {
    ...data,
    grid: JSON.stringify(data.grid), // Firestore doesn't support nested arrays
    publishedBy,
    updatedAt: serverTimestamp(),
  });

  // 2. Update the metadata entry in the part's order array
  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  if (partSnap.exists()) {
    const currentOrder = partSnap.data().order as (string | LevelOrderEntry)[];
    const updatedOrder = currentOrder.map((e) => {
      if (entryId(e) !== firestoreId) return e;
      return {
        id: firestoreId,
        name: data.name,
        width: data.width,
        height: data.height,
        difficulty: data.difficulty ?? undefined,
        creatorName: data.creatorName ?? undefined,
        updatedAt: serverTimestamp(),
      };
    });
    batch.update(partRef, {
      order: updatedOrder,
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * Deletes a level from Firestore and removes it from the part order array.
 */
export async function deleteFirestoreLevel(
  firestoreId: string,
  partId: string,
): Promise<void> {
  const batch = writeBatch(db);

  batch.delete(doc(db, 'levels', firestoreId));

  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  if (partSnap.exists()) {
    const order = (partSnap.data().order as (string | LevelOrderEntry)[])
      .filter((e) => entryId(e) !== firestoreId);
    batch.update(partRef, { order, updatedAt: serverTimestamp() });
  }

  await batch.commit();
}

/**
 * Returns all levels in a part, in display order.
 * Fetches all level documents referenced by the part's order array.
 */
export async function getPartLevels(partId: string): Promise<FirestoreLevel[]> {
  const part = await getPart(partId);
  if (!part || part.order.length === 0) return [];

  const levelDocs = await Promise.all(
    part.order.map((e) => getDoc(doc(db, 'levels', entryId(e)))),
  );

  return levelDocs
    .filter((d) => d.exists())
    .map((d) => ({
      firestoreId: d.id,
      ...(d.data() as Omit<FirestoreLevel, 'firestoreId'>),
    }));
}
