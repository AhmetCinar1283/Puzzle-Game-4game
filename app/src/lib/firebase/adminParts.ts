import {
  collection,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  addDoc,
  deleteDoc,
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

/** Returns a single part's metadata + order map. */
export async function getPart(partId: string): Promise<LevelPart | null> {
  const snap = await getDoc(doc(db, 'levelParts', partId));
  if (!snap.exists()) return null;
  return { partId, ...(snap.data() as Omit<LevelPart, 'partId'>) };
}

/** Creates a new part and returns its data (with the auto-generated Firestore ID). */
export async function setPart(name: string, unlockRequirement = 0): Promise<LevelPart> {
  const ref = await addDoc(collection(db, 'levelParts'), {
    name,
    unlockRequirement,
    order: {},
    updatedAt: serverTimestamp(),
  });
  return {
    partId: ref.id,
    name,
    unlockRequirement,
    order: {},
    updatedAt: Date.now(),
  };
}

/** Updates a part's name and/or unlockRequirement. */
export async function updatePart(
  partId: string,
  data: { name?: string; unlockRequirement?: number },
): Promise<void> {
  await updateDoc(doc(db, 'levelParts', partId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/** Deletes a part document. Associated levels/ docs are NOT deleted. */
export async function deletePart(partId: string): Promise<void> {
  await deleteDoc(doc(db, 'levelParts', partId));
}

/**
 * Updates the position of one or more levels within a part's order map.
 * Uses field-path updates — only the specified levels are touched, so two
 * admins reordering different levels concurrently won't overwrite each other.
 *
 * @param moves  Array of { levelId, position } pairs to update.
 */
export async function moveLevelsInPart(
  partId: string,
  moves: { levelId: string; position: number }[],
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: serverTimestamp() };
  for (const { levelId, position } of moves) {
    update[`order.${levelId}.position`] = position;
  }
  await updateDoc(doc(db, 'levelParts', partId), update);
}
