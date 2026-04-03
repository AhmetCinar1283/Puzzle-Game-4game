import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  serverTimestamp,
  increment,
  Timestamp,
  type FieldValue,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './config';
import type { StoredLevel } from '../db';
import type { LevelData } from '../../games/types';

// ─── Types ────────────────────────────────────────────────────────────────────

/** A community level submission request from a non-anonymous user. */
export interface LevelRequest {
  id: string;
  // Level data fields
  name: string;
  width: number;
  height: number;
  edges: StoredLevel['edges'];
  grid: StoredLevel['grid'];
  initialObjects: StoredLevel['initialObjects'];
  targets: StoredLevel['targets'];
  trailCollision?: boolean;
  initialBoxes?: StoredLevel['initialBoxes'];
  conveyorPowerRequired?: StoredLevel['conveyorPowerRequired'];
  difficulty?: 1 | 2 | 3 | 4;
  // Submission metadata
  submittedBy: string;
  creatorName: string;
  creatorTag: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: number;
  updatedAt: number;
  adminNote?: string;
}

export interface UserDoc {
  uid: string;
  authProvider: 'anonymous' | 'google' | 'email';
  createdAt: FieldValue;
  totalScore: number;
  completedCount: number;
  role: 'user' | 'moderator' | 'admin';
  email?: string;
  displayName?: string;
  tag?: string;
}

export interface PlayedLevelData {
  score: number;
  timeSpent: number; // seconds
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveAuthProvider(user: User): 'anonymous' | 'google' | 'email' {
  if (user.isAnonymous) return 'anonymous';
  const providerIds = user.providerData.map((p) => p.providerId);
  if (providerIds.includes('google.com')) return 'google';
  return 'email';
}

/**
 * Creates the users/{uid} document on first sign-in.
 * If the user has just linked a Google account, merges the new provider info
 * without overwriting existing fields (e.g. totalScore, createdAt).
 */
export async function createOrUpdateUserDoc(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const data: Omit<UserDoc, 'createdAt'> & { createdAt: FieldValue } = {
      uid: user.uid,
      authProvider: resolveAuthProvider(user),
      createdAt: serverTimestamp(),
      totalScore: 0,
      completedCount: 0,
      role: 'user',
    };
    if (user.email) data.email = user.email;
    if (user.displayName) data.displayName = user.displayName;
    await setDoc(ref, data);
  } else if (!user.isAnonymous) {
    // Anonymous → real account upgrade: patch only the identity fields
    const patch: Partial<UserDoc> = { authProvider: resolveAuthProvider(user) };
    if (user.email) patch.email = user.email;
    if (user.displayName) patch.displayName = user.displayName;
    await setDoc(ref, patch, { merge: true });
  }
}

/**
 * Records a completed level under users/{uid}/playedLevels/{levelId}.
 *
 * On first completion: also increments users/{uid}.completedCount.
 * This counter is used for part unlock requirements.
 *
 * Usage:
 *   await savePlayedLevel(user.uid, level.firestoreId ?? String(level.id), { score: 100, timeSpent: 42 });
 */
export async function savePlayedLevel(
  uid: string,
  levelId: string,
  data: PlayedLevelData,
): Promise<void> {
  const ref = doc(db, 'users', uid, 'playedLevels', levelId);
  const snap = await getDoc(ref);
  const isFirstCompletion = !snap.exists();

  await setDoc(
    ref,
    {
      score: data.score,
      timeSpent: data.timeSpent,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );

  if (isFirstCompletion) {
    await updateDoc(doc(db, 'users', uid), { completedCount: increment(1) });
  }
}

/**
 * Submits a community level request. Only callable by non-anonymous users.
 * Returns the new request document ID.
 */
export async function submitLevelRequest(
  uid: string,
  levelData: LevelData,
  creatorTag: string | null,
  difficulty?: 1 | 2 | 3 | 4,
  creatorName?: string,
): Promise<string> {
  const ref = await addDoc(collection(db, 'levelRequests'), {
    name: levelData.name,
    width: levelData.width,
    height: levelData.height,
    edges: levelData.edges,
    grid: JSON.stringify(levelData.grid), // Firestore doesn't support nested arrays
    initialObjects: levelData.initialObjects,
    targets: levelData.targets,
    trailCollision: levelData.trailCollision ?? false,
    initialBoxes: levelData.initialBoxes ?? [],
    conveyorPowerRequired: levelData.conveyorPowerRequired ?? [],
    ...(difficulty && { difficulty }),
    submittedBy: uid,
    ...(creatorName && { creatorName }),
    creatorTag,
    status: 'pending',
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Updates an existing pending level request's content and difficulty.
 * Only the submitter can do this (enforced by Firestore rules).
 */
export async function updateLevelRequest(
  requestId: string,
  levelData: LevelData,
  difficulty?: 1 | 2 | 3 | 4,
): Promise<void> {
  await updateDoc(doc(db, 'levelRequests', requestId), {
    name: levelData.name,
    width: levelData.width,
    height: levelData.height,
    edges: levelData.edges,
    grid: JSON.stringify(levelData.grid),
    initialObjects: levelData.initialObjects,
    targets: levelData.targets,
    trailCollision: levelData.trailCollision ?? false,
    initialBoxes: levelData.initialBoxes ?? [],
    conveyorPowerRequired: levelData.conveyorPowerRequired ?? [],
    difficulty: difficulty ?? null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Returns level requests filtered by status, newest first.
 * Admin-only: Firestore rules enforce this on the server.
 */
export async function getLevelRequests(
  status: 'pending' | 'approved' | 'rejected' = 'pending',
): Promise<LevelRequest[]> {
  const q = query(
    collection(db, 'levelRequests'),
    where('status', '==', status),
    orderBy('submittedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const toMs = (v: unknown): number => {
      if (v instanceof Timestamp) return v.toMillis();
      if (typeof v === 'number') return v;
      return Date.now();
    };
    return {
      id: d.id,
      name: data.name,
      width: data.width,
      height: data.height,
      edges: data.edges,
      grid: typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid,
      initialObjects: data.initialObjects,
      targets: data.targets,
      trailCollision: data.trailCollision,
      initialBoxes: data.initialBoxes,
      conveyorPowerRequired: data.conveyorPowerRequired,
      difficulty: data.difficulty ?? undefined,
      submittedBy: data.submittedBy,
      creatorName: data.creatorName,
      creatorTag: data.creatorTag ?? null,
      status: data.status,
      submittedAt: toMs(data.submittedAt),
      updatedAt: toMs(data.updatedAt),
      adminNote: data.adminNote,
    } as LevelRequest;
  });
}
