import {
  collection,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './config';
import type { LevelPart, LevelOrderEntry } from './adminTypes';

export type { LevelPart, LevelOrderEntry };

/** Returns all parts in ascending partId order. */
export async function getAllParts(): Promise<LevelPart[]> {
  const snap = await getDocs(collection(db, 'levelParts'));
  const parts = snap.docs.map((d) => ({
    partId: d.id,
    ...(d.data() as Omit<LevelPart, 'partId'>),
  }));
  return parts.sort((a, b) => Number(a.partId) - Number(b.partId));
}

/** Returns a single part's metadata + order array. */
export async function getPart(partId: string): Promise<LevelPart | null> {
  const snap = await getDoc(doc(db, 'levelParts', partId));
  if (!snap.exists()) return null;
  return { partId, ...(snap.data() as Omit<LevelPart, 'partId'>) };
}

/**
 * Replaces the order array of a part (used for drag-and-drop reordering).
 */
export async function reorderPartLevels(
  partId: string,
  newOrder: (string | LevelOrderEntry)[],
): Promise<void> {
  await updateDoc(doc(db, 'levelParts', partId), {
    order: newOrder,
    updatedAt: serverTimestamp(),
  });
}
