import type { LevelData, GameObjectState, Position, EdgeBehavior } from '../types';
import GameCell from './GameCell';
import GameObject from './GameObject';

const CELL_SIZE = 72;

// Neon trail colors per object id
const TRAIL_COLORS: Record<number, string> = {
  1: 'rgba(0, 255, 136, 0.15)',
  2: 'rgba(0, 196, 255, 0.15)',
};

interface GameBoardProps {
  level: LevelData;
  objects: GameObjectState[];
  trail: Record<number, Position[]>;
}

function edgeBorderStyle(behavior: EdgeBehavior): { color: string; glow: string } {
  switch (behavior) {
    case 'portal':
      return { color: '#9333ea', glow: '0 0 8px rgba(147, 51, 234, 0.6)' };
    case 'lava':
      return { color: '#ef4444', glow: '0 0 8px rgba(239, 68, 68, 0.6)' };
    default:
      return { color: 'rgba(30, 58, 138, 0.5)', glow: 'none' };
  }
}

function EdgeLabel({ behavior, axis }: { behavior: EdgeBehavior; axis: 'h' | 'v' }) {
  if (behavior === 'wall') return null;
  const isLava = behavior === 'lava';
  return (
    <div
      className="flex items-center justify-center font-bold select-none"
      style={{
        fontSize: 13,
        color: isLava ? '#ef4444' : '#9333ea',
        textShadow: isLava
          ? '0 0 8px rgba(239,68,68,0.7)'
          : '0 0 8px rgba(147,51,234,0.7)',
      }}
    >
      {isLava ? '☠' : axis === 'h' ? '↕' : '↔'}
    </div>
  );
}

export default function GameBoard({ level, objects, trail }: GameBoardProps) {
  const boardWidth = level.width * CELL_SIZE;
  const boardHeight = level.height * CELL_SIZE;
  const showTrails = !!level.trailCollision;

  // Build trail lookup only when needed
  const trailLookup: Record<string, number[]> = {};
  if (showTrails) {
    for (const [idStr, positions] of Object.entries(trail)) {
      const objectId = Number(idStr);
      for (const pos of positions) {
        const key = `${pos.row}-${pos.col}`;
        if (!trailLookup[key]) trailLookup[key] = [];
        trailLookup[key].push(objectId);
      }
    }
  }

  const topEdge = edgeBorderStyle(level.edges.top);
  const bottomEdge = edgeBorderStyle(level.edges.bottom);
  const leftEdge = edgeBorderStyle(level.edges.left);
  const rightEdge = edgeBorderStyle(level.edges.right);

  const borderStyle: React.CSSProperties = {
    borderTopColor: topEdge.color,
    borderBottomColor: bottomEdge.color,
    borderLeftColor: leftEdge.color,
    borderRightColor: rightEdge.color,
    borderWidth: 3,
    borderStyle: 'solid',
    borderRadius: 6,
    boxShadow: [
      level.edges.top !== 'wall' ? `0 -3px 12px ${topEdge.color}` : '',
      level.edges.bottom !== 'wall' ? `0 3px 12px ${bottomEdge.color}` : '',
      level.edges.left !== 'wall' ? `-3px 0 12px ${leftEdge.color}` : '',
      level.edges.right !== 'wall' ? `3px 0 12px ${rightEdge.color}` : '',
      '0 0 40px rgba(0, 0, 0, 0.8)',
    ]
      .filter(Boolean)
      .join(', '),
    background: '#060d1a',
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <EdgeLabel behavior={level.edges.top} axis="h" />

      <div className="flex items-center gap-1">
        <EdgeLabel behavior={level.edges.left} axis="v" />

        <div className="relative overflow-hidden" style={{ width: boardWidth, height: boardHeight, ...borderStyle }}>
          {/* Grid cells */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${level.width}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(${level.height}, ${CELL_SIZE}px)`,
            }}
          >
            {level.grid.map((row, rowIdx) =>
              row.map((cellType, colIdx) => (
                <GameCell key={`${rowIdx}-${colIdx}`} cellType={cellType} cellSize={CELL_SIZE} />
              )),
            )}
          </div>

          {/* Trail overlays (only rendered when trailCollision is enabled) */}
          {showTrails &&
            Object.entries(trailLookup).map(([key, objectIds]) => {
              const [rowStr, colStr] = key.split('-');
              const row = Number(rowStr);
              const col = Number(colStr);
              const objectId = objectIds[0];
              const color = TRAIL_COLORS[objectId] ?? 'rgba(139,92,246,0.15)';
              return (
                <div
                  key={`trail-${key}`}
                  style={{
                    position: 'absolute',
                    top: row * CELL_SIZE,
                    left: col * CELL_SIZE,
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: color,
                    boxShadow: objectId === 1
                      ? 'inset 0 0 8px rgba(0,255,136,0.2)'
                      : 'inset 0 0 8px rgba(0,196,255,0.2)',
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                />
              );
            })}

          {/* Objects */}
          {objects.map((obj) => (
            <GameObject key={obj.id} object={obj} cellSize={CELL_SIZE} />
          ))}
        </div>

        <EdgeLabel behavior={level.edges.right} axis="v" />
      </div>

      <EdgeLabel behavior={level.edges.bottom} axis="h" />
    </div>
  );
}
