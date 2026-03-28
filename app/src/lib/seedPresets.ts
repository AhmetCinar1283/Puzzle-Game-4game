import { saveLevelAtPosition, getDB } from './db';
import type { StoredLevel } from './db';
import presetLevels from '../data/preset-levels.json';

type PresetLevel = Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'>;

const SEED_KEY = 'kc_preset_seeded_v1';

/**
 * Seeds preset levels into Dexie on first launch.
 * Guarded by a localStorage flag — runs only once per browser.
 * Prepends presets at the beginning of the level order.
 */
export async function seedPresetLevels(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(SEED_KEY)) return;

  const levels = presetLevels as PresetLevel[];
  if (levels.length === 0) {
    localStorage.setItem(SEED_KEY, '1');
    return;
  }

  const db = getDB();
  const existingCount = await db.levels.count();
  if (existingCount > 0) {
    // DB already has data — skip to avoid duplicating on re-install scenarios
    localStorage.setItem(SEED_KEY, '1');
    return;
  }

  for (let i = 0; i < levels.length; i++) {
    await saveLevelAtPosition(levels[i], i);
  }

  localStorage.setItem(SEED_KEY, '1');
}
