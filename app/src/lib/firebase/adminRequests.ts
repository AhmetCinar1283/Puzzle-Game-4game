import {
  collection,
  doc,
  updateDoc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { LevelRequest } from './firestore';
import type { LevelOrderEntry } from './adminTypes';

/**
 * Approves a community level request:
 * 1. Creates a new doc in `levels/` with attribution fields
 * 2. Appends the new LevelOrderEntry to `levelParts/{partId}.order`
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
    difficulty: req.difficulty ?? null,
    part: Number(partId),
    publishedBy: approvedBy,
    createdBy: req.submittedBy,
    creatorName: req.creatorName,
    creatorTag: req.creatorTag,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Build order entry and append to part
  const entry: Omit<LevelOrderEntry, 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp> } = {
    id: levelRef.id,
    name: req.name,
    width: req.width,
    height: req.height,
    difficulty: req.difficulty ?? undefined,
    creatorName: req.creatorName ?? undefined,
    updatedAt: serverTimestamp(),
  };

  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  const currentOrder: (string | LevelOrderEntry)[] = partSnap.exists()
    ? (partSnap.data().order as (string | LevelOrderEntry)[]) ?? []
    : [];
  if (partSnap.exists()) {
    batch.update(partRef, { order: [...currentOrder, entry], updatedAt: serverTimestamp() });
  } else {
    batch.set(partRef, {
      name: `Part ${partId}`,
      unlockRequirement: 0,
      order: [entry],
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
