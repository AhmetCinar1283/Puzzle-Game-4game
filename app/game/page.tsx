import type { Metadata } from 'next';
import { LEVELS } from '@/app/src/games/levels';
import GameShell from '@/app/src/games/components/GameShell';

export const metadata: Metadata = {
  title: 'Know & Conquer',
  description: 'A grid-based puzzle game',
};

export default function GamePage() {
  const level = LEVELS[0];
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900">
      <GameShell level={level} />
    </main>
  );
}
