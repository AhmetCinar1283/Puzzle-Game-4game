import { useEffect, useState } from "react";
import { TickSnapshot, VFXEvent } from "../logic/types";
import { Cell } from "../logic/cellTypes";
import { CELL_RENDERERS } from "./cells/CELL_RENDERERS";
import { Entity } from "../logic/entityTypes";
import { ENTITY_RENDERERS } from "./entities/ENTITY_RENDERERS";

function playAudio(src: string) {
  new Audio(src).play().catch(() => {});
}

const GameBoard = ({ snapshots }: { snapshots: TickSnapshot[] }) => {
  const [currentFrame, setCurrentFrame] = useState(0);
  const snapshot = snapshots[currentFrame];

  useEffect(() => {
    if (currentFrame < snapshots.length - 1) {
      const timer = setTimeout(() => setCurrentFrame(c => c + 1), 300);
      return () => clearTimeout(timer);
    }
  }, [currentFrame, snapshots]);

  useEffect(() => {
    snapshot.vfxEvents.forEach((vfx: VFXEvent) => {
      if (vfx === 'sound_boing')      playAudio('/sounds/boing.mp3');
      if (vfx === 'sound_ice_break')  playAudio('/sounds/ice_break.mp3');
    });
  }, [snapshot]);

  return (
    <div className="grid">
      {snapshot.grid.map((row: Cell[]) =>
        row.map((cell: Cell) => {
          const Renderer = CELL_RENDERERS[cell.type];
          return <Renderer key={cell.id} cell={cell} />;
        })
      )}

      {snapshot.entities.map((entity: Entity) => {
        const Renderer = ENTITY_RENDERERS[entity.type];
        const currentCell = snapshot.grid[entity.position.row][entity.position.col];
        return <Renderer key={entity.id} entity={entity} currentCellType={currentCell.type} />;
      })}
    </div>
  );
};

export default GameBoard;
