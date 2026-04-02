'use client';
import { useEffect } from 'react';
import { seedPresetLevels } from '../lib/db/seedPresets';

export default function PresetSeeder() {
  useEffect(() => {
    seedPresetLevels().catch(console.error);
  }, []);

  return null;
}
