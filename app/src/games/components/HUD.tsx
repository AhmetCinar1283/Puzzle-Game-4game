import type { GameObjectState } from '../types';

interface HUDProps {
  levelName: string;
  moveCount: number;
  objects: GameObjectState[];
  onRestart: () => void;
}

const OBJECT_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Green', color: '#10b981' },
  2: { label: 'Blue', color: '#0ea5e9' },
};

export default function HUD({ levelName, moveCount, objects, onRestart }: HUDProps) {
  return (
    <div className="flex items-center justify-between w-full px-4 py-3 bg-slate-800 rounded-t-lg">
      <div className="text-white font-semibold text-sm">{levelName}</div>

      <div className="flex gap-4 items-center">
        {objects.map((obj) => {
          const info = OBJECT_LABELS[obj.id] ?? { label: `Obj ${obj.id}`, color: '#8b5cf6' };
          return (
            <div key={obj.id} className="flex items-center gap-1 text-xs">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: info.color }}
              />
              <span className="text-slate-300">
                {info.label}: {obj.isLocked ? '✓' : obj.mode === 'reversed' ? '↺' : '↻'}
              </span>
            </div>
          );
        })}
        <span className="text-slate-400 text-xs">Moves: {moveCount}</span>
      </div>

      <button
        onClick={onRestart}
        className="text-xs bg-slate-600 hover:bg-slate-500 text-white px-3 py-1 rounded transition-colors"
      >
        Restart
      </button>
    </div>
  );
}
