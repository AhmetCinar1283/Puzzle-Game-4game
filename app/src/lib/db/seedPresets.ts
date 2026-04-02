import { getDB } from '.';
import type { StoredLevel } from '.';
import presetLevelsData from '../../data/preset-levels.json';
import { userStorageRemove } from '../userStorage';

type PresetInput = Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'> & { id?: number };

const HASH_KEY = 'presetLevelsHash';

function computeHash(levels: PresetInput[]): string {
  const str = JSON.stringify(levels);
  return `${str.length}_${levels.length}_${levels[0]?.name ?? ''}_${levels[levels.length - 1]?.name ?? ''}`;
}

/**
 * Previously seeded preset levels from preset-levels.json.
 * Now a no-op — preset levels come exclusively from Firestore via useFirestoreSync.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function seedPresetLevels(): Promise<void> {
  // Intentionally empty: Firestore sync (syncAllParts) is the sole source of preset levels.
}
