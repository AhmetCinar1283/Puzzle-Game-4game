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

  console.log('data, partId, publishedBy')
  console.log(data)
  console.log(partId)
  console.log(publishedBy)

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
    ...(data.difficulty && { difficulty: data.difficulty }),
    ...(data.creatorName && { creatorName: data.creatorName }),
    updatedAt: serverTimestamp(),
  };

  // 3. Append to part order
  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  const currentOrder: Record<string, LevelOrderEntry> = partSnap.exists()
    ? (partSnap.data().order as Record<string, LevelOrderEntry>) ?? {}
    : {};

  if (partSnap.exists()) {
    batch.update(partRef, {
      order: { ...currentOrder, [entry.id]: entry },
      updatedAt: serverTimestamp(),
    });
  } else {
    // Part doesn't exist yet — create it with sensible defaults
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
 * Updates an existing Firestore level's content.
 * Also updates the metadata entry in the part's order array and bumps levelParts.updatedAt
 * so that sync clients know to re-fetch.
 */
export async function updateFirestoreLevel(
  firestoreId: string,
  data: AdminLevelInput,
  publishedBy: string,
  partId: string,
  changePublishedBy: boolean = false
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
    const currentOrder = partSnap.data().order as Record<string, LevelOrderEntry>
    const newOrderEntries = Object.entries(currentOrder).map(([k, e]) => {
      if (entryId(e) !== firestoreId) return [k, e];
      return [k, {
        id: firestoreId,
        name: data.name,
        width: data.width,
        height: data.height,
        ...(data.difficulty && { difficulty: data.difficulty }),
        ...(data.creatorName && { creatorName: data.creatorName }),
        updatedAt: serverTimestamp(),
      }];
    });
    const updatedOrder = Object.fromEntries(newOrderEntries)
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
    const order = (Object.entries(partSnap.data().order) as [string, LevelOrderEntry][])
      .filter(([k, e]) => e.id !== firestoreId);
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
  if (!part || Object.values(part.order).length === 0) return [];

  const levelDocs = await Promise.all(
    Object.keys(part.order).map((k) => getDoc(doc(db, 'levels', k))),
  );

  return levelDocs
    .filter((d) => d.exists())
    .map((d) => ({
      firestoreId: d.id,
      ...(d.data() as Omit<FirestoreLevel, 'firestoreId'>),
    }));
}
