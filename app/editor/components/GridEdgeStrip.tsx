'use client';

import { useState } from 'react';
import { EDGE_OPTIONS, EDGE_COLOR, EDGE_LABEL } from '../editorConfig';
import type { EdgeBehavior } from '@/app/src/games/types';
import { useEditorContext } from '../EditorContext';

const STRIP = 8; // px width/height of the clickable strip

interface StripProps {
  side: 'top' | 'bottom' | 'left' | 'right';
  behavior: EdgeBehavior;
  onCycle: () => void;
}

function EdgeStrip({ side, behavior, onCycle }: StripProps) {
  const [hovered, setHovered] = useState(false);
  const color = EDGE_COLOR[behavior];
  const label = EDGE_LABEL[behavior];

  const isHoriz = side === 'top' || side === 'bottom';
  const pos: React.CSSProperties = {
    position: 'absolute',
    ...(side === 'top' ? { top: -STRIP - 2, left: 0, right: 0, height: STRIP } : {}),
    ...(side === 'bottom' ? { bottom: -STRIP - 2, left: 0, right: 0, height: STRIP } : {}),
    ...(side === 'left' ? { left: -STRIP - 2, top: 0, bottom: 0, width: STRIP } : {}),
    ...(side === 'right' ? { right: -STRIP - 2, top: 0, bottom: 0, width: STRIP } : {}),
  };

  return (
    <div
      title={`${side}: ${label} — click to cycle`}
      onClick={onCycle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...pos,
        background: color,
        opacity: hovered ? 1 : 0.55,
        cursor: 'pointer',
        borderRadius: isHoriz ? '4px 4px 0 0' : '4px 0 0 4px',
        transition: 'opacity 0.15s',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 5,
      }}
    >
      {hovered && (
        <span style={{
          fontSize: 8, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap',
          textShadow: '0 1px 3px rgba(0,0,0,0.8)',
          transform: isHoriz ? 'none' : 'rotate(-90deg)',
          letterSpacing: '0.06em',
        }}>
          {label}
        </span>
      )}
    </div>
  );
}

export default function GridEdgeStrip() {
  const { edges, setEdges, activeRoomId, setRooms } = useEditorContext();

  const cycleEdge = (side: 'top' | 'bottom' | 'left' | 'right') => {
    setEdges((prevEdges) => {
      const current = prevEdges[side]?.type ?? 'wall';
      const idx = EDGE_OPTIONS.indexOf(current);
      const nextType = EDGE_OPTIONS[(idx + 1) % EDGE_OPTIONS.length] as any;
      const updatedEdges = {
        ...prevEdges,
        [side]: {
          ...prevEdges[side],
          type: nextType,
          ...(nextType !== 'portal' ? { targetRoomId: undefined, targetEdge: undefined } : {})
        }
      };

      // Scan all rooms and disconnect any other room's edge that was pointing to this edge!
      setRooms((prevRooms) => {
        return prevRooms.map((r) => {
          let rChanged = false;
          const nextRoomEdges = { ...r.edges };
          for (const s of ['top', 'bottom', 'left', 'right'] as const) {
            const edge = nextRoomEdges[s];
            if (edge && edge.type === 'portal') {
              if (
                edge.targetRoomId === activeRoomId &&
                edge.targetEdge === side &&
                nextType !== 'portal'
              ) {
                nextRoomEdges[s] = {
                  ...edge,
                  targetRoomId: undefined,
                  targetEdge: undefined,
                };
                rChanged = true;
              }
            }
          }
          if (rChanged) {
            return { ...r, edges: nextRoomEdges };
          }
          return r;
        });
      });

      return updatedEdges;
    });
  };

  return (
    <>
      {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
        <EdgeStrip key={side} side={side} behavior={edges[side]?.type ?? 'wall'} onCycle={() => cycleEdge(side)} />
      ))}
    </>
  );
}
