import type { LevelData } from '../types';
import level001 from './level-001.json';
import level002 from './level-002.json';

export const LEVELS: LevelData[] = [
  level001 as unknown as LevelData,
  level002 as unknown as LevelData,
];

export function getLevelById(id: number): LevelData | undefined {
  return LEVELS.find((l) => l.id === id);
}
