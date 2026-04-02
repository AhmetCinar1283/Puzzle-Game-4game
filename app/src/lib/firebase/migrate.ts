import presetLevelsData from '../../data/preset-levels.json';
import { publishLevel } from './admin';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './config';

const MIGRATED_KEY = 'firestoreMigrated_v1';

type PresetInput = {
  id?: number;
  name: string;
  width: number;
  height: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

/**
 * One-time migration: uploads preset-levels.json to Firestore as Part 1.
 * Guards against re-running via a localStorage flag.
 *
 * Safe to call repeatedly — will no-op if already migrated.
 *
 * @param publishedBy  uid of the admin triggering the migration
 * @param onProgress   optional callback (completedCount, total)
 */
export async function migratePresetsToFirestore(
  publishedBy: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(MIGRATED_KEY)) {
    console.log('[Migrate] Already migrated — skipping.');
    return;
  }

  const levels = presetLevelsData as PresetInput[];
  const PART_ID = '1';

  // Ensure Part 1 document exists (creates with defaults if absent)
  const partRef = doc(db, 'levelParts', PART_ID);
  const partSnap = await getDoc(partRef);
  if (!partSnap.exists()) {
    await setDoc(partRef, {
      name: 'Starter',
      unlockRequirement: 0,
      order: [],
      updatedAt: serverTimestamp(),
    });
  }

  for (let i = 0; i < levels.length; i++) {
    const { id: _id, ...rest } = levels[i];
    void _id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await publishLevel({ ...rest, part: 1 } as any, PART_ID, publishedBy);
    onProgress?.(i + 1, levels.length);
  }

  localStorage.setItem(MIGRATED_KEY, '1');
  console.log(`[Migrate] Done — ${levels.length} levels published to Part ${PART_ID}.`);
}
