import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import type { LevelRequest } from './firestore';
import { db } from './config';
import type { StoredLevel } from '../db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdminLevelInput = Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt' | 'firestoreId'> & {
  part: number;
};

export interface FirestoreLevel extends AdminLevelInput {
  firestoreId: string;
  createdAt: number;
  updatedAt: number;
  publishedBy: string;
}

export interface LevelPart {
  partId: string;
  name: string;
  unlockRequirement: number;
  order: string[];
  updatedAt: number;
}

// ─── Part helpers ─────────────────────────────────────────────────────────────

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

// ─── Level CRUD ───────────────────────────────────────────────────────────────

/**
 * Publishes a new level to Firestore and appends it to the end of the
 * specified part's order array.
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

  // 2. Append to part order
  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  const currentOrder: string[] = partSnap.exists()
    ? (partSnap.data().order as string[]) ?? []
    : [];

  if (partSnap.exists()) {
    batch.update(partRef, {
      order: [...currentOrder, levelRef.id],
      updatedAt: serverTimestamp(),
    });
  } else {
    // Part doesn't exist yet — create it with sensible defaults
    batch.set(partRef, {
      name: `Part ${partId}`,
      unlockRequirement: 0,
      order: [levelRef.id],
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return levelRef.id;
}

/**
 * Updates an existing Firestore level's content.
 * The level's position in the part order is NOT changed.
 */
export async function updateFirestoreLevel(
  firestoreId: string,
  data: AdminLevelInput,
  publishedBy: string,
): Promise<void> {
  const ref = doc(db, 'levels', firestoreId);
  await updateDoc(ref, {
    ...data,
    grid: JSON.stringify(data.grid), // Firestore doesn't support nested arrays
    publishedBy,
    updatedAt: serverTimestamp(),
  });
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
    const order = (partSnap.data().order as string[]).filter((id) => id !== firestoreId);
    batch.update(partRef, { order, updatedAt: serverTimestamp() });
  }

  await batch.commit();
}

/**
 * Replaces the order array of a part (used for drag-and-drop reordering).
 */
export async function reorderPartLevels(
  partId: string,
  newOrder: string[],
): Promise<void> {
  await updateDoc(doc(db, 'levelParts', partId), {
    order: newOrder,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Approves a community level request:
 * 1. Creates a new doc in `levels/` with attribution fields
 * 2. Appends the new level ID to `levelParts/{partId}.order`
 * 3. Marks the request as 'approved'
 *
 * Uses a batch write so steps 1+2 are atomic; step 3 updates separately.
 */
export async function approveLevelRequest(
  requestId: string,
  partId: string,
  req: LevelRequest,
  approvedBy: string,
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Create the level document with attribution
  const levelRef = doc(collection(db, 'levels'));
  batch.set(levelRef, {
    name: req.name,
    width: req.width,
    height: req.height,
    edges: req.edges,
    grid: JSON.stringify(req.grid), // Firestore doesn't support nested arrays
    initialObjects: req.initialObjects,
    targets: req.targets,
    trailCollision: req.trailCollision ?? false,
    initialBoxes: req.initialBoxes ?? [],
    conveyorPowerRequired: req.conveyorPowerRequired ?? [],
    part: Number(partId),
    publishedBy: approvedBy,
    createdBy: req.submittedBy,
    creatorName: req.creatorName,
    creatorTag: req.creatorTag,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Append to part order
  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  const currentOrder: string[] = partSnap.exists()
    ? (partSnap.data().order as string[]) ?? []
    : [];
  if (partSnap.exists()) {
    batch.update(partRef, { order: [...currentOrder, levelRef.id], updatedAt: serverTimestamp() });
  } else {
    batch.set(partRef, {
      name: `Part ${partId}`,
      unlockRequirement: 0,
      order: [levelRef.id],
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();

  // 3. Mark request as approved (outside batch — not critical to atomicity)
  await updateDoc(doc(db, 'levelRequests', requestId), {
    status: 'approved',
    updatedAt: serverTimestamp(),
  });
}

/**
 * Rejects a community level request with an optional admin note.
 */
export async function rejectLevelRequest(requestId: string, note?: string): Promise<void> {
  await updateDoc(doc(db, 'levelRequests', requestId), {
    status: 'rejected',
    updatedAt: serverTimestamp(),
    ...(note ? { adminNote: note } : {}),
  });
}

/**
 * Returns all levels in a part, in display order.
 * Fetches all level documents referenced by the part's order array.
 */
export async function getPartLevels(partId: string): Promise<FirestoreLevel[]> {
  const part = await getPart(partId);
  if (!part || part.order.length === 0) return [];

  // Batch fetch all level docs
  const levelDocs = await Promise.all(
    part.order.map((id) => getDoc(doc(db, 'levels', id))),
  );

  return levelDocs
    .filter((d) => d.exists())
    .map((d) => ({
      firestoreId: d.id,
      ...(d.data() as Omit<FirestoreLevel, 'firestoreId'>),
    }));
}
