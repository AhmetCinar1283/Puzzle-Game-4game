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

  // 1. Create the level document ref (prevLevelId computed below after reading part)
  const levelRef = doc(collection(db, 'levels'));

  // 2. Determine position for the new entry
  const partRef = doc(db, 'levelParts', partId);
  const partSnap = await getDoc(partRef);
  const currentOrder: Record<string, LevelOrderEntry> = partSnap.exists()
    ? (partSnap.data().order as Record<string, LevelOrderEntry>) ?? {}
    : {};
  const maxPos = Object.values(currentOrder).reduce(
    (m, e) => Math.max(m, e.position ?? 0),
    -1,
  );

  // Find the current last-position level (becomes prevLevelId for the approved level)
  const prevEntry = Object.values(currentOrder).find(
    (e) => (e.position ?? -1) === maxPos,
  );
  const prevLevelId: string | null = prevEntry?.id ?? null;

  // 1a. Now create the level document with prevLevelId
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
    ...(req.difficulty != undefined && { difficulty: req.difficulty }),
    part: Number(partId),
    publishedBy: approvedBy,
    createdBy: req.submittedBy,
    ...(req.creatorName && { creatorName: req.creatorName }),
    creatorTag: req.creatorTag,
    prevLevelId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(req.rooms && { rooms: req.rooms }),
    ...(req.controlMode && { controlMode: req.controlMode }),
    ...(req.initialControlledRooms && { initialControlledRooms: req.initialControlledRooms }),
  });

  // 3. Build order entry
  const entry: Omit<LevelOrderEntry, 'updatedAt'> & { updatedAt: ReturnType<typeof serverTimestamp>; position: number } = {
    id: levelRef.id,
    name: req.name,
    width: req.width,
    height: req.height,
    position: maxPos + 1,
    ...(req.difficulty != undefined && { difficulty: req.difficulty }),
    ...(req.creatorName && { creatorName: req.creatorName }),
    updatedAt: serverTimestamp(),
  };

  if (partSnap.exists()) {
    // Field-path update — concurrent-safe: only this level's key is written
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
