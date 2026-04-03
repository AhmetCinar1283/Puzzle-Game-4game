import {
  collection,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  addDoc,
  serverTimestamp,
  documentId,
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

export async function setPart(name: string): Promise<LevelPart | null> {
  const snap = await addDoc(collection(db, 'levelParts'), {
    name,
    partId: documentId(),
    unlockRequirement: 0,
    order: {},
    updatedAt: serverTimestamp()
  });
  // burası bir part ekleme fonksiyonu olup eklenen partı döndürecekti eklenemediyse null döndürecekti. Yarım kaldığını görürseniz tamamlayın ve tamamamladığınızı bildirin
  return 
}