import type { GameObjectState } from '../types';

interface HUDProps {
  levelName: string;
  moveCount: number;
  objects: GameObjectState[];
  onRestart: () => void;
}

const OBJECT_NEON: Record<number, { color: string; label: string; glow: string }> = {
  1: { color: '#00ff88', label: 'P1', glow: '0 0 6px rgba(0,255,136,0.7)' },
  2: { color: '#00c4ff', label: 'P2', glow: '0 0 6px rgba(0,196,255,0.7)' },
};

export default function HUD({ levelName, moveCount, objects, onRestart }: HUDProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(3, 7, 18, 0.97)',
        borderBottom: '1px solid rgba(0, 255, 136, 0.15)',
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: '#00ff88',
          textShadow: '0 0 8px rgba(0,255,136,0.5)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {levelName}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {objects.map((obj) => {
          const info = OBJECT_NEON[obj.id] ?? { color: '#bf5fff', label: `P${obj.id}`, glow: '' };
          return (
            <div key={obj.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: info.color,
                  boxShadow: info.glow,
                }}
              />
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                {info.label}:{' '}
                <span style={{ color: info.color }}>
                  {obj.isLocked ? '✓' : obj.mode === 'reversed' ? '↺' : '↻'}
                </span>
              </span>
            </div>
          );
        })}
        <span style={{ fontSize: 12, color: '#475569' }}>
          Moves:{' '}
          <span style={{ color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
            {moveCount}
          </span>
        </span>
      </div>

      <button
        onClick={onRestart}
        style={{
          fontSize: 11,
          padding: '4px 12px',
          background: 'rgba(0,255,136,0.05)',
          border: '1px solid rgba(0,255,136,0.3)',
          color: '#00ff88',
          borderRadius: 6,
          cursor: 'pointer',
          letterSpacing: '0.04em',
          transition: 'all 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.background = 'rgba(0,255,136,0.12)';
          (e.target as HTMLButtonElement).style.boxShadow = '0 0 8px rgba(0,255,136,0.3)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.background = 'rgba(0,255,136,0.05)';
          (e.target as HTMLButtonElement).style.boxShadow = 'none';
        }}
      >
        RESTART
      </button>
    </div>
  );
}
