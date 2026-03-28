'use client';
import { useEffect } from 'react';
import { seedPresetLevels } from '../lib/seedPresets';

export default function PresetSeeder() {
  useEffect(() => {
    seedPresetLevels().catch(console.error);
  }, []);

  return null;
}
