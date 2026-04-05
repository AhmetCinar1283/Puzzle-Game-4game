'use client';

import { useState } from 'react';
import GameCell from '@/app/src/games/components/GameCell';
import type { CellType } from '@/app/src/games/types';
import {
  CELL_TYPES_BASIC, CELL_TYPES_ICE, CELL_TYPES_POWER,
  CELL_TYPES_CONVEYOR, CELL_TYPES_TELEPORTER,
  CELL_COLOR, CELL_LABEL, type ToolType,
} from '../editorConfig';
import { useEditorContext } from '../EditorContext';

const CELL_SIZE = 36;
const CELL_SIZE_MOB = 28;

interface ToolBtnProps {
  tool: ToolType;
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
  small?: boolean;
  children?: React.ReactNode;
}

function ToolBtn({ tool, active, color, label, onClick, small, children }: ToolBtnProps) {
  const [hov, setHov] = useState(false);
  const sz = small ? CELL_SIZE_MOB : CELL_SIZE;
  return (
    <button
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0,
        width: sz, height: sz,
        padding: 0,
        border: `2px solid ${active ? color : hov ? `${color}60` : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 6,
        background: active ? `${color}1a` : 'transparent',
        boxShadow: active ? `0 0 0 1px ${color}30, 0 0 10px ${color}30` : 'none',
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'border-color 0.1s, box-shadow 0.1s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}
    >
      {children ?? <GameCell cellType={tool as CellType} cellSize={sz - 4} />}
      {active && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: color, opacity: 0.8,
        }} />
      )}
    </button>
  );
}

function GroupLabel({ label, small }: { label: string; small?: boolean }) {
  if (small) return null;
  return (
    <div style={{
      fontSize: 7, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase',
      color: '#1e3a5f', writingMode: 'vertical-lr', userSelect: 'none',
      display: 'flex', alignItems: 'center', paddingRight: 2,
    }}>
      {label}
    </div>
  );
}

function Divider({ small }: { small?: boolean }) {
  if (small) return <div style={{ width: 6 }} />;
  return <div style={{ width: 1, background: 'rgba(30,58,95,0.4)', alignSelf: 'stretch', margin: '4px 4px' }} />;
}

export default function ToolPalette({ isMobile }: { isMobile: boolean }) {
  const { activeTool, setActiveTool, objects, boxes, setBoxes, setActivePlacingBoxId, activePlacingBoxId, undo, canUndo } = useEditorContext();
  const small = isMobile;

  const toolGroups = [
    { label: 'Basic', types: CELL_TYPES_BASIC },
    { label: 'Ice', types: CELL_TYPES_ICE },
    { label: 'Power', types: CELL_TYPES_POWER },
    { label: 'Conveyors', types: CELL_TYPES_CONVEYOR },
    { label: 'Teleporters', types: CELL_TYPES_TELEPORTER },
  ];

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      padding: '6px 10px',
      borderBottom: '1px solid rgba(30,58,95,0.35)',
      background: 'rgba(3,7,18,0.95)',
      overflowX: 'auto',
      overflowY: 'hidden',
      whiteSpace: 'nowrap',
      scrollbarWidth: 'none',
    }}>

      {toolGroups.map(({ label, types }, gi) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          {gi > 0 && <Divider small={small} />}
          <GroupLabel label={label} small={small} />
          {types.map((t) => (
            <ToolBtn
              key={t} tool={t as ToolType}
              active={activeTool === t}
              color={CELL_COLOR[t]}
              label={CELL_LABEL[t]}
              onClick={() => setActiveTool(t as ToolType)}
              small={small}
            />
          ))}
        </div>
      ))}

      <Divider small={small} />

      {/* Undo */}
      <button
        title="Undo (Ctrl+Z)"
        onClick={undo}
        disabled={!canUndo}
        style={{
          flexShrink: 0,
          width: small ? CELL_SIZE_MOB : CELL_SIZE,
          height: small ? CELL_SIZE_MOB : CELL_SIZE,
          padding: 0,
          border: `1px solid ${canUndo ? 'rgba(148,163,184,0.35)' : 'rgba(255,255,255,0.05)'}`,
          borderRadius: 6,
          background: canUndo ? 'rgba(148,163,184,0.07)' : 'transparent',
          color: canUndo ? '#94a3b8' : '#334155',
          cursor: canUndo ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: small ? 14 : 18,
          transition: 'opacity 0.15s',
        }}
      >↩</button>

      {/* Erase */}
      <ToolBtn
        tool="erase" active={activeTool === 'erase'}
        color="#64748b" label="Erase"
        onClick={() => setActiveTool('erase')} small={small}
      >
        <span style={{ fontSize: small ? 14 : 18, color: activeTool === 'erase' ? '#94a3b8' : '#334155' }}>⌫</span>
      </ToolBtn>

      {/* Select */}
      <ToolBtn
        tool="select" active={activeTool === 'select'}
        color="#00c4ff" label="Select & Move"
        onClick={() => setActiveTool('select')} small={small}
      >
        <span style={{ fontSize: small ? 14 : 18, color: activeTool === 'select' ? '#00c4ff' : '#334155' }}>▣</span>
      </ToolBtn>

      <Divider small={small} />

      {/* Players */}
      {[1, 2].map((id) => {
        const tool = `place_obj${id}` as ToolType;
        const color = id === 1 ? '#00ff88' : '#00c4ff';
        const obj = objects.find((o) => o.id === id)!;
        const sz = small ? CELL_SIZE_MOB : CELL_SIZE;
        return (
          <ToolBtn
            key={id} tool={tool} active={activeTool === tool}
            color={color}
            label={`Place Player ${id}${obj.row !== null ? ` (${obj.row},${obj.col})` : ''}`}
            onClick={() => setActiveTool(tool)} small={small}
          >
            <div style={{
              width: sz - 10, height: sz - 10,
              borderRadius: '50%', background: color,
              boxShadow: `0 0 6px ${color}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: (sz - 10) * 0.4, fontWeight: 900, color: id === 1 ? '#003320' : '#002233' }}>
                {id}
              </span>
            </div>
          </ToolBtn>
        );
      })}

      <Divider small={small} />

      {/* Add Box */}
      <button
        title="Add Box"
        onClick={() => {
          const newId = Date.now();
          setBoxes((bs) => [...bs, { id: newId, row: null, col: null, requiresPower: false }]);
          setActivePlacingBoxId(newId);
          setActiveTool('place_box');
        }}
        style={{
          flexShrink: 0,
          padding: '4px 8px', fontSize: 10, fontWeight: 700,
          border: `1px solid ${activeTool === 'place_box' ? 'rgba(249,115,22,0.6)' : 'rgba(249,115,22,0.3)'}`,
          background: activeTool === 'place_box' ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.05)',
          color: '#f97316', borderRadius: 6, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4,
          height: small ? CELL_SIZE_MOB : CELL_SIZE,
        }}
      >
        <span style={{ fontSize: 16 }}>▣</span>
        {!small && <span>+Box</span>}
        {activePlacingBoxId !== null && <span style={{ color: '#fbbf24', fontSize: 9 }}>↙ click</span>}
      </button>

    </div>
  );
}
