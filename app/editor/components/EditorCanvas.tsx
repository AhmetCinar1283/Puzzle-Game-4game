import { useState, useEffect, useRef, ReactNode } from 'react';
import GridCore from './GridCore';
import GridEdgeStrip from './GridEdgeStrip';
import SelectionLayer from './SelectionLayer';
import { ColControls, RowControls, COL_CTRL_H, ROW_CTRL_W } from './GridRowColControls';
import { useEditorContext } from '../EditorContext';
import { calculateRoomLayoutOffsets, getEdgePoint, routePortalPath } from '@/app/src/game2/logic/engine/rooms';
import GameCell from '@/app/src/games/components/GameCell';
import { getPlayerColor } from '@/app/src/game2/components/playerColors';
import { EDGE_COLOR } from '../editorConfig';
import type { CellType, EdgeBehavior } from '@/app/src/games/types';

interface EditorCanvasProps {
  isMobile: boolean;
  visible: boolean;
}

export default function EditorCanvas({ isMobile, visible }: EditorCanvasProps) {
  const {
    rooms,
    setRooms,
    activeRoomId,
    controlMode,
    setControlMode,
    switchActiveRoom,
    addRoom,
    deleteRoom,
    updateRoomName,
    updateRoomLayoutPosition,
    objects,
    boxes,
    cellSize,
    grid,
    width,
    height,
    edges,
    setEdges,
    optimalSolutionTrajectory,
    fogOfWar,
    setFogOfWar,
    fogVisibilityDistance,
    setFogVisibilityDistance,
    fogKeepRevealed,
    setFogKeepRevealed,
  } = useEditorContext();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingPortal, setDraggingPortal] = useState<{ roomId: string; side: 'top' | 'bottom' | 'left' | 'right' } | null>(null);
  const [dragMousePos, setDragMousePos] = useState<{ x: number; y: number } | null>(null);

  const liveRooms = rooms.map((r) => {
    if (r.id === activeRoomId) {
      return { ...r, width, height, edges, grid, fogOfWar, fogVisibilityDistance, fogKeepRevealed };
    }
    return r;
  });

  const { roomPositions, totalWidth, totalHeight } = calculateRoomLayoutOffsets(liveRooms, cellSize, 80);

  useEffect(() => {
    if (!draggingPortal) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      setDragMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!canvasRef.current) {
        setDraggingPortal(null);
        setDragMousePos(null);
        return;
      }
      
      const rect = canvasRef.current.getBoundingClientRect();
      const upX = e.clientX - rect.left;
      const upY = e.clientY - rect.top;

      let target: { roomId: string; side: 'top' | 'bottom' | 'left' | 'right' } | null = null;
      let minDistance = 25;

      for (const r of liveRooms) {
        const offset = roomPositions[r.id];
        if (!offset) continue;

        for (const side of ['top', 'bottom', 'left', 'right'] as const) {
          if (r.id === draggingPortal.roomId && side === draggingPortal.side) continue;

          const edge = r.edges[side];
          if (!edge || edge.type !== 'portal') continue;

          const ep = getEdgePoint(offset, side);
          const hpX = ep.x + (side === 'left' ? -5 : side === 'right' ? 5 : 0);
          const hpY = ep.y + (side === 'top' ? -5 : side === 'bottom' ? 5 : 0);

          const dist = Math.sqrt((upX - hpX) ** 2 + (upY - hpY) ** 2);
          if (dist < minDistance) {
            minDistance = dist;
            target = { roomId: r.id, side };
          }
        }
      }

      const draggingRoom = liveRooms.find((r) => r.id === draggingPortal.roomId);
      const prevTargetRoomId = draggingRoom?.edges[draggingPortal.side]?.targetRoomId;
      const prevTargetEdge = draggingRoom?.edges[draggingPortal.side]?.targetEdge;

      setRooms((prevRooms) => {
        return prevRooms.map((room) => {
          let nextEdges = { ...room.edges };
          let changed = false;

          // Disconnect from old target
          if (room.id === draggingPortal.roomId) {
            nextEdges[draggingPortal.side] = {
              ...nextEdges[draggingPortal.side],
              targetRoomId: undefined,
              targetEdge: undefined,
            };
            changed = true;
          }
          if (prevTargetRoomId && room.id === prevTargetRoomId && prevTargetEdge) {
            nextEdges[prevTargetEdge] = {
              ...nextEdges[prevTargetEdge],
              targetRoomId: undefined,
              targetEdge: undefined,
            };
            changed = true;
          }

          // Connect to new target
          if (target) {
            if (room.id === draggingPortal.roomId) {
              nextEdges[draggingPortal.side] = {
                ...nextEdges[draggingPortal.side],
                targetRoomId: target.roomId,
                targetEdge: target.side,
              };
              changed = true;
            }
            if (room.id === target.roomId) {
              nextEdges[target.side] = {
                ...nextEdges[target.side],
                targetRoomId: draggingPortal.roomId,
                targetEdge: draggingPortal.side,
              };
              changed = true;
            }
          }

          if (changed) {
            if (room.id === activeRoomId) {
              setEdges(nextEdges);
            }
            return { ...room, edges: nextEdges };
          }
          return room;
        });
      });

      setDraggingPortal(null);
      setDragMousePos(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingPortal, liveRooms, roomPositions, activeRoomId, setRooms, setEdges]);

  return (
    <div style={{
      flex: 1,
      display: isMobile ? (visible ? 'flex' : 'none') : 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'flex-start', // Fixes overflow alignment cut-off
      overflow: 'auto',
      padding: '12px 8px 8px',
      width: '100%',
    }}>
      {/* Room Switcher Panel */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '8px 16px',
        marginBottom: 16,
        background: 'rgba(30, 41, 59, 0.4)',
        border: '1px solid rgba(0, 196, 255, 0.15)',
        borderRadius: 8,
        width: '100%',
        maxWidth: 700,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', marginRight: 4 }}>ROOMS:</span>
          {rooms.map((r) => {
            const isActive = r.id === activeRoomId;
            return (
              <div
                key={r.id}
                onClick={() => isActive ? null : switchActiveRoom(r.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: isActive ? 'rgba(0, 196, 255, 0.15)' : 'rgba(30, 41, 59, 0.6)',
                  border: `1px solid ${isActive ? '#00c4ff' : 'rgba(148, 163, 184, 0.2)'}`,
                  color: isActive ? '#00c4ff' : '#94a3b8',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: isActive ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: isActive ? '0 0 10px rgba(0, 196, 255, 0.2)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {isActive ? (
                  <input
                    value={r.name}
                    onChange={(e) => updateRoomName(r.id, e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#00c4ff',
                      fontWeight: 600,
                      outline: 'none',
                      width: 80,
                      fontSize: 12,
                      padding: 0,
                    }}
                  />
                ) : (
                  <span>{r.name}</span>
                )}
                {rooms.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteRoom(r.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isActive ? '#ef4444' : '#475569',
                      cursor: 'pointer',
                      fontSize: 10,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    title="Delete room"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
          <button
            onClick={addRoom}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              background: 'rgba(0, 255, 136, 0.05)',
              border: '1px dashed rgba(0, 255, 136, 0.4)',
              color: '#00ff88',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            + Add Room
          </button>
        </div>

        {/* Selected Room Settings */}
        {(() => {
          const activeRoom = rooms.find((r) => r.id === activeRoomId);
          if (!activeRoom) return null;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderLeft: '1px solid rgba(148, 163, 184, 0.15)', paddingLeft: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
              
              {/* X position input container */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(15, 23, 42, 0.5)',
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid rgba(148, 163, 184, 0.15)',
                height: 32,
                boxSizing: 'border-box',
              }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>X:</span>
                <input
                  type="number"
                  value={activeRoom.x}
                  onChange={(e) => updateRoomLayoutPosition(activeRoom.id, Number(e.target.value), activeRoom.y)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    width: 32,
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Y position input container */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(15, 23, 42, 0.5)',
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid rgba(148, 163, 184, 0.15)',
                height: 32,
                boxSizing: 'border-box',
              }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>Y:</span>
                <input
                  type="number"
                  value={activeRoom.y}
                  onChange={(e) => updateRoomLayoutPosition(activeRoom.id, activeRoom.x, Number(e.target.value))}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    width: 32,
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: 'center',
                    outline: 'none',
                  }}
                />
              </div>

              {/* CONTROL mode selector container */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(15, 23, 42, 0.5)',
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid rgba(148, 163, 184, 0.15)',
                height: 32,
                boxSizing: 'border-box',
              }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>CONTROL:</span>
                <select
                  value={controlMode}
                  onChange={(e) => setControlMode(e.target.value as any)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e2e8f0',
                    fontSize: 11,
                    fontWeight: 600,
                    outline: 'none',
                    cursor: 'pointer',
                    paddingRight: 4,
                  }}
                >
                  <option value="all_rooms" style={{ background: '#0f172a' }}>All Rooms</option>
                  <option value="selected_room" style={{ background: '#0f172a' }}>Selected Room</option>
                </select>
              </div>

              {/* FOW premium toggle container */}
              <div 
                onClick={() => setFogOfWar(!fogOfWar)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  userSelect: 'none',
                  padding: '5px 10px',
                  borderRadius: 6,
                  background: 'rgba(30, 41, 59, 0.3)',
                  border: `1px solid ${fogOfWar ? 'rgba(0, 196, 255, 0.3)' : 'rgba(148, 163, 184, 0.15)'}`,
                  height: 32,
                  boxSizing: 'border-box',
                  transition: 'all 0.2s ease',
                  boxShadow: fogOfWar ? '0 0 10px rgba(0, 196, 255, 0.1)' : 'none',
                }}
              >
                <span style={{ fontSize: 10, color: fogOfWar ? '#00c4ff' : '#94a3b8', fontWeight: 800, letterSpacing: '0.05em' }}>FOW:</span>
                <div style={{
                  width: 32,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: fogOfWar ? '#00c4ff' : '#1e293b',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                  boxShadow: fogOfWar ? '0 0 8px rgba(0, 196, 255, 0.4)' : 'none',
                }}>
                  <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                    position: 'absolute',
                    top: 2,
                    left: fogOfWar ? 16 : 2,
                    transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                </div>
              </div>

              {/* Fog of War specific options */}
              {fogOfWar && (
                <>
                  {/* Fog Visibility Distance container */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(15, 23, 42, 0.5)',
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(148, 163, 184, 0.15)',
                    height: 32,
                    boxSizing: 'border-box',
                  }}>
                    <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>DIST:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="10"
                      value={fogVisibilityDistance}
                      onChange={(e) => setFogVisibilityDistance(Number(e.target.value))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#e2e8f0',
                        width: 36,
                        fontSize: 12,
                        fontWeight: 600,
                        textAlign: 'center',
                        outline: 'none',
                      }}
                    />
                  </div>

                  {/* FOW PERSIST toggle container */}
                  <div 
                    onClick={() => setFogKeepRevealed(!fogKeepRevealed)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: '5px 10px',
                      borderRadius: 6,
                      background: 'rgba(30, 41, 59, 0.3)',
                      border: `1px solid ${fogKeepRevealed ? 'rgba(0, 196, 255, 0.3)' : 'rgba(148, 163, 184, 0.15)'}`,
                      height: 32,
                      boxSizing: 'border-box',
                      transition: 'all 0.2s ease',
                      boxShadow: fogKeepRevealed ? '0 0 10px rgba(0, 196, 255, 0.1)' : 'none',
                    }}
                    title="Daha önce açılan yerler hafif görünür kalmaya devam etsin mi? Kapatılırsa sadece anlık görüş alanındaki hücreler görünür, arkası tekrar tamamen kararır."
                  >
                    <span style={{ fontSize: 10, color: fogKeepRevealed ? '#00c4ff' : '#94a3b8', fontWeight: 800, letterSpacing: '0.05em' }}>PERSIST:</span>
                    <div style={{
                      width: 32,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: fogKeepRevealed ? '#00c4ff' : '#1e293b',
                      position: 'relative',
                      transition: 'background-color 0.2s ease',
                      boxShadow: fogKeepRevealed ? '0 0 8px rgba(0, 196, 255, 0.4)' : 'none',
                    }}>
                      <div style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: '#fff',
                        position: 'absolute',
                        top: 2,
                        left: fogKeepRevealed ? 16 : 2,
                        transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Rooms Layout Canvas */}
      <div ref={canvasRef} style={{
        position: 'relative',
        width: totalWidth,
        height: totalHeight,
        margin: '24px auto',
        flexShrink: 0,
      }}>
        {optimalSolutionTrajectory && (() => {
          const getOffsetPoints = (
            points: { roomId?: string; row: number; col: number; stepIndex?: number }[],
            isPlayer2: boolean
          ) => {
            const visitMap: Record<string, number> = {};
            const mapped = points.map((p) => {
              const rId = p.roomId ?? 'main';
              const offset = roomPositions[rId];
              if (!offset) return null;

              const key = `${rId}-${p.row},${p.col}`;
              const visitIndex = visitMap[key] || 0;
              if (p.stepIndex !== undefined) {
                visitMap[key] = visitIndex + 1;
              }

              const baseX = offset.left + p.col * cellSize + cellSize / 2;
              const baseY = offset.top + p.row * cellSize + cellSize / 2;

              let dx = 0;
              let dy = 0;
              if (visitIndex > 0 && p.stepIndex !== undefined) {
                // Symmetrically offset visits. Shift Player 2 by an extra 22.5 degrees (PI/8) to prevent overlaps between player paths.
                const baseAngle = ((visitIndex - 1) * Math.PI / 2) + Math.PI / 4;
                const angle = isPlayer2 ? baseAngle + Math.PI / 8 : baseAngle;
                const dist = cellSize * 0.22;
                dx = Math.cos(angle) * dist;
                dy = Math.sin(angle) * dist;
              }

              return {
                x: baseX + dx,
                y: baseY + dy,
                row: p.row,
                col: p.col,
                stepIndex: p.stepIndex,
              };
            });
            return mapped.filter((pt): pt is NonNullable<typeof pt> => pt !== null);
          };

          const p1Offsets = optimalSolutionTrajectory.player1 ? getOffsetPoints(optimalSolutionTrajectory.player1, false) : [];
          const p2Offsets = optimalSolutionTrajectory.player2 ? getOffsetPoints(optimalSolutionTrajectory.player2, true) : [];

          const getSvgPathFromOffsets = (offsets: { x: number; y: number }[]) => {
            if (offsets.length < 2) return '';
            return offsets.reduce((acc, pt, idx) => {
              return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
            }, '');
          };

          const circleRadius = cellSize * 0.16;
          const fontSize = Math.max(7, Math.round(cellSize * 0.18));

          return (
            <svg
              style={{
                position: 'absolute', top: 0, left: 0,
                width: totalWidth, height: totalHeight,
                pointerEvents: 'none', zIndex: 35
              }}
            >
              <defs>
                <filter id="pathGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes crawlPath {
                  to { stroke-dashoffset: -20; }
                }
              `}} />
              {p1Offsets.length > 1 && (
                <path
                  d={getSvgPathFromOffsets(p1Offsets)}
                  fill="none"
                  stroke="#00ff88"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6, 6"
                  filter="url(#pathGlow)"
                  style={{ animation: 'crawlPath 1.2s linear infinite' }}
                  opacity={0.8}
                />
              )}
              {p2Offsets.length > 1 && (
                <path
                  d={getSvgPathFromOffsets(p2Offsets)}
                  fill="none"
                  stroke="#00c4ff"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6, 6"
                  filter="url(#pathGlow)"
                  style={{ animation: 'crawlPath 1.2s linear infinite' }}
                  opacity={0.8}
                />
              )}

              {/* Player 1 Waypoint Markers */}
              {p1Offsets.filter((pt) => pt.stepIndex !== undefined).map((pt) => (
                <g key={`p1-${pt.stepIndex}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={circleRadius}
                    fill="#060d1a"
                    stroke="#00ff88"
                    strokeWidth={1.5}
                  />
                  <text
                    x={pt.x}
                    y={pt.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#00ff88"
                    fontSize={`${fontSize}px`}
                    fontWeight="bold"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {pt.stepIndex}
                  </text>
                </g>
              ))}

              {/* Player 2 Waypoint Markers */}
              {p2Offsets.filter((pt) => pt.stepIndex !== undefined).map((pt) => (
                <g key={`p2-${pt.stepIndex}`}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={circleRadius}
                    fill="#060d1a"
                    stroke="#00c4ff"
                    strokeWidth={1.5}
                  />
                  <text
                    x={pt.x}
                    y={pt.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#00c4ff"
                    fontSize={`${fontSize}px`}
                    fontWeight="bold"
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {pt.stepIndex}
                  </text>
                </g>
              ))}
            </svg>
          );
        })()}
        {liveRooms.map((room) => {
          const offset = roomPositions[room.id];
          if (!offset) return null;
          const isActive = room.id === activeRoomId;

          if (isActive) {
            return (
              <div
                key={room.id}
                style={{
                  position: 'absolute',
                  left: offset.left,
                  top: offset.top,
                  width: offset.width,
                  height: offset.height,
                  border: '2px solid #00c4ff',
                  boxShadow: '0 0 25px rgba(0, 196, 255, 0.45)',
                  borderRadius: 8,
                  zIndex: 30,
                }}
              >
                {/* Active Room Title */}
                <div style={{
                  position: 'absolute',
                  top: -22,
                  left: 2,
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#00c4ff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  textShadow: '0 0 8px rgba(0, 196, 255, 0.4)',
                }}>
                  {room.name}
                </div>

                {/* Column controls at the top of the active room */}
                <div style={{
                  position: 'absolute',
                  top: -COL_CTRL_H - 12,
                  left: -10,
                  right: -10,
                  display: 'flex',
                  justifyContent: 'center',
                  zIndex: 40,
                }}>
                  <ColControls />
                </div>

                {/* Row controls at the right of the active room */}
                <div style={{
                  position: 'absolute',
                  right: -ROW_CTRL_W - 12,
                  top: -10,
                  bottom: -10,
                  display: 'flex',
                  alignItems: 'center',
                  zIndex: 40,
                }}>
                  <RowControls />
                </div>

                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  <GridEdgeStrip />
                  <GridCore />
                  <SelectionLayer />
                </div>
              </div>
            );
          } else {
            return (
              <div
                key={room.id}
                onClick={() => switchActiveRoom(room.id)}
                style={{
                  position: 'absolute',
                  left: offset.left,
                  top: offset.top,
                  width: offset.width,
                  height: offset.height,
                  border: '2px dashed rgba(148, 163, 184, 0.3)',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: '#040914',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'visible',
                  zIndex: 10,
                }}
              >
                {/* Room Title */}
                <div style={{
                  position: 'absolute',
                  top: -22,
                  left: 2,
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'rgba(148, 163, 184, 0.6)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  whiteSpace: 'nowrap',
                }}>
                  {room.name} <span style={{ color: '#00ff88', fontSize: 9, marginLeft: 6, opacity: 0.8 }}>✎ Edit</span>
                </div>

                {/* Edge strips for inactive room */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderTop: `3px solid ${EDGE_COLOR[room.edges.top.type as EdgeBehavior]}`,
                  borderBottom: `3px solid ${EDGE_COLOR[room.edges.bottom.type as EdgeBehavior]}`,
                  borderLeft: `3px solid ${EDGE_COLOR[room.edges.left.type as EdgeBehavior]}`,
                  borderRight: `3px solid ${EDGE_COLOR[room.edges.right.type as EdgeBehavior]}`,
                  borderRadius: 6,
                  pointerEvents: 'none',
                  zIndex: 20,
                }} />

                {/* Grid cells */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${room.width}, ${cellSize}px)`,
                  width: '100%',
                  height: '100%',
                  opacity: 0.65,
                  borderRadius: 6,
                  overflow: 'hidden',
                }}>
                  {room.grid.map((row: CellType[], rIdx: number) =>
                    row.map((cellType: CellType, cIdx: number) => {
                      const player = objects.find(o => (o.roomId ?? 'main') === room.id && o.row === rIdx && o.col === cIdx);
                      const box = boxes.find(b => (b.roomId ?? 'main') === room.id && b.row === rIdx && b.col === cIdx);

                      return (
                        <div
                          key={`${rIdx}-${cIdx}`}
                          style={{
                            width: cellSize,
                            height: cellSize,
                            position: 'relative',
                          }}
                        >
                          <GameCell
                            cellType={cellType}
                            cellSize={cellSize}
                          />
                          {player && (
                            <div style={{
                              position: 'absolute',
                              top: Math.floor(cellSize * 0.14),
                              left: Math.floor(cellSize * 0.14),
                              width: cellSize - Math.floor(cellSize * 0.14) * 2,
                              height: cellSize - Math.floor(cellSize * 0.14) * 2,
                              borderRadius: '50%',
                              background: getPlayerColor(player.id - 1).hex,
                              boxShadow: `0 0 8px ${getPlayerColor(player.id - 1).hex}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 30,
                            }}>
                              <span style={{ fontSize: cellSize * 0.28, fontWeight: 900, color: '#000' }}>
                                P{player.id}
                              </span>
                            </div>
                          )}
                          {box && (
                            <div style={{
                              position: 'absolute',
                              top: Math.round(cellSize * 0.1),
                              left: Math.round(cellSize * 0.1),
                              width: cellSize - Math.round(cellSize * 0.1) * 2,
                              height: cellSize - Math.round(cellSize * 0.1) * 2,
                              borderRadius: 6,
                              border: '2px solid #f97316',
                              background: 'rgba(15,23,35,0.9)',
                              boxShadow: '0 0 8px rgba(249,115,22,0.5)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 30,
                            }}>
                              <span style={{ fontSize: cellSize * 0.28, color: '#f97316', fontWeight: 'bold' }}>▣</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          }
        })}

        {/* Portal Connection SVG Overlay */}
        {(() => {
          const connections: { fromRoomId: string; fromSide: 'top' | 'bottom' | 'left' | 'right'; toRoomId: string; toSide: 'top' | 'bottom' | 'left' | 'right' }[] = [];
          const seen = new Set<string>();
          for (const room of liveRooms) {
            for (const side of ['top', 'bottom', 'left', 'right'] as const) {
              const edge = room.edges[side];
              if (edge && edge.type === 'portal' && edge.targetRoomId && edge.targetEdge) {
                const targetRoomId = edge.targetRoomId;
                const targetEdge = edge.targetEdge;
                const connectionKey = [`${room.id}:${side}`, `${targetRoomId}:${targetEdge}`].sort().join('--');
                if (!seen.has(connectionKey)) {
                  seen.add(connectionKey);
                  connections.push({ fromRoomId: room.id, fromSide: side, toRoomId: targetRoomId, toSide: targetEdge });
                }
              }
            }
          }

          const connectionPaths: ReactNode[] = [];
          connections.forEach((conn, connIdx) => {
            const pathD = routePortalPath(
              conn.fromRoomId,
              conn.fromSide,
              conn.toRoomId,
              conn.toSide,
              roomPositions,
              liveRooms,
              cellSize,
              80, // gap for editor
              connIdx,
              connections.length
            );

            connectionPaths.push(
              <g key={`${conn.fromRoomId}-${conn.fromSide}-${conn.toRoomId}-${conn.toSide}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="rgba(168, 85, 247, 0.45)"
                  strokeWidth={6}
                  strokeLinecap="round"
                  filter="blur(3px)"
                />
                <path
                  d={pathD}
                  fill="none"
                  stroke="#c084fc"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray="6, 6"
                  style={{
                    animation: 'crawlPath 1.2s linear infinite',
                  }}
                />
              </g>
            );
          });

          let draggingLinePath = '';
          if (draggingPortal && dragMousePos) {
            const offset = roomPositions[draggingPortal.roomId];
            if (offset) {
              const pA = getEdgePoint(offset, draggingPortal.side);
              const controlOffset = 45;
              let cp1x = pA.x;
              let cp1y = pA.y;
              if (draggingPortal.side === 'left') cp1x -= controlOffset;
              else if (draggingPortal.side === 'right') cp1x += controlOffset;
              else if (draggingPortal.side === 'top') cp1y -= controlOffset;
              else if (draggingPortal.side === 'bottom') cp1y += controlOffset;
              
              draggingLinePath = `M ${pA.x} ${pA.y} C ${cp1x} ${cp1y}, ${dragMousePos.x} ${dragMousePos.y}, ${dragMousePos.x} ${dragMousePos.y}`;
            }
          }

          return (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: totalWidth,
                height: totalHeight,
                pointerEvents: 'none',
                zIndex: 22,
              }}
            >
              {connectionPaths}
              {draggingPortal && dragMousePos && draggingLinePath && (
                <g>
                  <path
                    d={draggingLinePath}
                    fill="none"
                    stroke="rgba(168, 85, 247, 0.6)"
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                  <path
                    d={draggingLinePath}
                    fill="none"
                    stroke="#c084fc"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray="4, 4"
                  />
                </g>
              )}
            </svg>
          );
        })()}

        {/* Portal Handles Overlay */}
        {liveRooms.map((room) => {
          const offset = roomPositions[room.id];
          if (!offset) return null;

          return (['top', 'bottom', 'left', 'right'] as const).map((side) => {
            const edge = room.edges[side];
            if (!edge || edge.type !== 'portal') return null;

            const isConnected = !!edge.targetRoomId && !!edge.targetEdge;

            const BAR_LENGTH = 28;
            const BAR_THICKNESS = 8;
            
            const handleStyle: React.CSSProperties = {
              position: 'absolute',
              backgroundColor: isConnected ? '#a855f7' : 'rgba(168, 85, 247, 0.25)',
              border: `2px ${isConnected ? 'solid' : 'dashed'} #c084fc`,
              boxShadow: isConnected ? '0 0 10px rgba(168, 85, 247, 0.8)' : 'none',
              cursor: 'grab',
              zIndex: 36,
              borderRadius: 4,
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            };

            if (side === 'top') {
              handleStyle.left = offset.left + offset.width / 2 - BAR_LENGTH / 2;
              handleStyle.top = offset.top - BAR_THICKNESS - 3;
              handleStyle.width = BAR_LENGTH;
              handleStyle.height = BAR_THICKNESS;
            } else if (side === 'bottom') {
              handleStyle.left = offset.left + offset.width / 2 - BAR_LENGTH / 2;
              handleStyle.top = offset.top + offset.height + 3;
              handleStyle.width = BAR_LENGTH;
              handleStyle.height = BAR_THICKNESS;
            } else if (side === 'left') {
              handleStyle.left = offset.left - BAR_THICKNESS - 3;
              handleStyle.top = offset.top + offset.height / 2 - BAR_LENGTH / 2;
              handleStyle.width = BAR_THICKNESS;
              handleStyle.height = BAR_LENGTH;
            } else if (side === 'right') {
              handleStyle.left = offset.left + offset.width + 3;
              handleStyle.top = offset.top + offset.height / 2 - BAR_LENGTH / 2;
              handleStyle.width = BAR_THICKNESS;
              handleStyle.height = BAR_LENGTH;
            }

            return (
              <div
                key={`${room.id}-${side}-handle`}
                style={handleStyle}
                title={`${room.name} ${side} Portal handle. Drag to connect.`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDraggingPortal({ roomId: room.id, side });
                  if (canvasRef.current) {
                    const rect = canvasRef.current.getBoundingClientRect();
                    setDragMousePos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                    });
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.25)';
                  e.currentTarget.style.boxShadow = '0 0 15px #d8b4fe';
                  e.currentTarget.style.backgroundColor = '#a855f7';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = isConnected ? '0 0 10px rgba(168, 85, 247, 0.8)' : 'none';
                  e.currentTarget.style.backgroundColor = isConnected ? '#a855f7' : 'rgba(168, 85, 247, 0.25)';
                }}
              />
            );
          });
        })}
      </div>

      <p style={{ fontSize: 9, color: '#1e3a5f', margin: '12px 0 0', letterSpacing: '0.06em', alignSelf: 'center', flexShrink: 0 }}>
        Paint · click same = clear · drag = fill · click edge strip = cycle wall/portal/lava
      </p>
    </div>
  );
}
