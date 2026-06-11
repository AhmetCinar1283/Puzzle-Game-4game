import GridCore from './GridCore';
import GridEdgeStrip from './GridEdgeStrip';
import SelectionLayer from './SelectionLayer';
import { ColControls, RowControls, COL_CTRL_H, ROW_CTRL_W } from './GridRowColControls';
import { useEditorContext } from '../EditorContext';
import { calculateRoomLayoutOffsets } from '@/app/src/game2/logic/engine/rooms';
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
  } = useEditorContext();

  const liveRooms = rooms.map((r) => {
    if (r.id === activeRoomId) {
      return { ...r, width, height, edges, grid };
    }
    return r;
  });

  const { roomPositions, totalWidth, totalHeight } = calculateRoomLayoutOffsets(liveRooms, cellSize, 80);

  return (
    <div style={{
      flex: 1,
      display: isMobile ? (visible ? 'flex' : 'none') : 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderLeft: '1px solid rgba(148, 163, 184, 0.2)', paddingLeft: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>X:</span>
                <input
                  type="number"
                  value={activeRoom.x}
                  onChange={(e) => updateRoomLayoutPosition(activeRoom.id, Number(e.target.value), activeRoom.y)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 4,
                    color: '#e2e8f0',
                    width: 44,
                    fontSize: 11,
                    padding: '2px 4px',
                    textAlign: 'center',
                  }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>Y:</span>
                <input
                  type="number"
                  value={activeRoom.y}
                  onChange={(e) => updateRoomLayoutPosition(activeRoom.id, activeRoom.x, Number(e.target.value))}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 4,
                    color: '#e2e8f0',
                    width: 44,
                    fontSize: 11,
                    padding: '2px 4px',
                    textAlign: 'center',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>CONTROL:</span>
                <select
                  value={controlMode}
                  onChange={(e) => setControlMode(e.target.value as any)}
                  style={{
                    background: '#0f172a',
                    border: '1px solid rgba(148, 163, 184, 0.2)',
                    borderRadius: 4,
                    color: '#e2e8f0',
                    fontSize: 11,
                    padding: '2px 4px',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all_rooms">All Rooms</option>
                  <option value="selected_room">Selected Room</option>
                </select>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Rooms Layout Canvas */}
      <div style={{
        position: 'relative',
        width: totalWidth,
        height: totalHeight,
        margin: '24px auto',
        flexShrink: 0,
      }}>
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
      </div>

      <p style={{ fontSize: 9, color: '#1e3a5f', margin: '12px 0 0', letterSpacing: '0.06em', alignSelf: 'center', flexShrink: 0 }}>
        Paint · click same = clear · drag = fill · click edge strip = cycle wall/portal/lava
      </p>
    </div>
  );
}
