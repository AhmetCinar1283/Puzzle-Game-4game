import type { LevelData, GameObjectState, Position, EdgeBehavior } from '../types';
import GameCell from './GameCell';
import GameObject from './GameObject';

const CELL_SIZE = 72;

// Semi-transparent trail colors per object id
const TRAIL_COLORS: Record<number, string> = {
  1: 'rgba(16,185,129,0.22)',  // emerald
  2: 'rgba(14,165,233,0.22)',  // sky
};

interface GameBoardProps {
  level: LevelData;
  objects: GameObjectState[];
  trail: Record<number, Position[]>;
}

function edgeBorderColor(behavior: EdgeBehavior): string {
  return behavior === 'portal' ? '#a855f7' : '#64748b';
}

function EdgeLabel({ behavior, axis }: { behavior: EdgeBehavior; axis: 'h' | 'v' }) {
  if (behavior === 'wall') return null;
  return (
    <div
      className="flex items-center justify-center text-purple-400 font-bold select-none"
      style={{ fontSize: 14 }}
    >
      {axis === 'h' ? '↕' : '↔'}
    </div>
  );
}

export default function GameBoard({ level, objects, trail }: GameBoardProps) {
  const boardWidth = level.width * CELL_SIZE;
  const boardHeight = level.height * CELL_SIZE;

  // Build a quick lookup: "row-col" → objectId[] for trail rendering
  const trailLookup: Record<string, number[]> = {};
  for (const [idStr, positions] of Object.entries(trail)) {
    const objectId = Number(idStr);
    for (const pos of positions) {
      const key = `${pos.row}-${pos.col}`;
      if (!trailLookup[key]) trailLookup[key] = [];
      trailLookup[key].push(objectId);
    }
  }

  const borderStyle = {
    borderTopColor: edgeBorderColor(level.edges.top),
    borderBottomColor: edgeBorderColor(level.edges.bottom),
    borderLeftColor: edgeBorderColor(level.edges.left),
    borderRightColor: edgeBorderColor(level.edges.right),
    borderWidth: 3,
    borderStyle: 'solid' as const,
    borderRadius: 4,
  };

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Top label */}
      <EdgeLabel behavior={level.edges.top} axis="h" />

      <div className="flex items-center gap-1">
        {/* Left label */}
        <EdgeLabel behavior={level.edges.left} axis="v" />

        {/* Board */}
        <div className="relative shadow-xl overflow-hidden" style={{ width: boardWidth, height: boardHeight, ...borderStyle }}>
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

          {/* Trail overlays */}
          {Object.entries(trailLookup).map(([key, objectIds]) => {
            const [rowStr, colStr] = key.split('-');
            const row = Number(rowStr);
            const col = Number(colStr);
            // If multiple objects visited same cell, blend colors — just show first for simplicity
            const objectId = objectIds[0];
            const color = TRAIL_COLORS[objectId] ?? 'rgba(139,92,246,0.2)';
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

        {/* Right label */}
        <EdgeLabel behavior={level.edges.right} axis="v" />
      </div>

      {/* Bottom label */}
      <EdgeLabel behavior={level.edges.bottom} axis="h" />
    </div>
  );
}
