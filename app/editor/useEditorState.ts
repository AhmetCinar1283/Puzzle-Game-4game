import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CellType, EdgeBehavior, LevelData, Position, ConveyorCellConfig, TrampolineCellConfig, DeflectorCellConfig } from '@/app/src/games/types';
import type { EdgeConfig, ControlMode } from '@/app/src/game2/logic/types';
import type { StoredLevel } from '@/app/src/lib/db';
import type { FirestoreLevel, LevelPart } from '@/app/src/lib/firebase/admin';
import { useAuth } from '@/app/src/hooks/useAuth';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/src/store';
import { makeGrid, resizeGrid, type ToolType, type ObjConfig, type BoxConfig } from './editorConfig';
import type { SelectionRect } from './useGridOperations';

const DEFAULT_OBJS: ObjConfig[] = [
  { id: 1, row: null, col: null, roomId: 'main', mode: 'normal', lockOnTarget: true },
  { id: 2, row: null, col: null, roomId: 'main', mode: 'normal', lockOnTarget: true },
];

export function useEditorState(editId: number | null, firestoreIdParam: string | null) {
  const router = useRouter();
  const { user, isAnonymous, isModerator } = useAuth();
  const userTag = useSelector((state: RootState) => state.user.tag);
  const creatorName = userTag ?? user?.displayName ?? user?.email ?? 'Unknown';

  // Level data
  const [levelName, setLevelName] = useState('My Level');
  const [width, setWidth] = useState(5);
  const [height, setHeight] = useState(5);
  const [pendingW, setPendingW] = useState(5);
  const [pendingH, setPendingH] = useState(5);
  const [trailCollision, setTrailCollision] = useState(false);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4>(2);
  const [savedRequestId, setSavedRequestId] = useState<string | null>(null);
  const savedIdForSubmitRef = useRef<number | null>(null);
  const [edges, setEdges] = useState<Record<'top' | 'bottom' | 'left' | 'right', EdgeConfig>>({
    top: { type: 'wall' },
    bottom: { type: 'wall' },
    left: { type: 'wall' },
    right: { type: 'wall' },
  });
  const [grid, setGrid] = useState<CellType[][]>(() => makeGrid(5, 5));
  const [rooms, setRooms] = useState<any[]>(() => [
    {
      id: 'main',
      name: 'Main Room',
      width: 5,
      height: 5,
      x: 0,
      y: 0,
      edges: {
        top: { type: 'wall' },
        bottom: { type: 'wall' },
        left: { type: 'wall' },
        right: { type: 'wall' },
      },
      grid: makeGrid(5, 5),
    }
  ]);
  const [activeRoomId, setActiveRoomId] = useState<string>('main');
  const [controlMode, setControlMode] = useState<ControlMode>('all_rooms');
  const [lockedCells, setLockedCells] = useState<Record<string, boolean>>({});
  const [optimalSolutionTrajectory, setOptimalSolutionTrajectory] = useState<{ player1: Position[]; player2: Position[] } | null>(null);
  const [objects, setObjects] = useState<ObjConfig[]>(DEFAULT_OBJS);
  const [boxes, setBoxes] = useState<BoxConfig[]>([]);
  const [activePlacingBoxId, setActivePlacingBoxId] = useState<number | null>(null);
  const [conveyorPowerRequired, setConveyorPowerRequired] = useState<Position[]>([]);
  const [conveyorConfig, setConveyorConfig] = useState<ConveyorCellConfig[]>([]);
  const [trampolineConfig, setTrampolineConfig] = useState<TrampolineCellConfig[]>([]);
  const [deflectorConfig, setDeflectorConfig] = useState<DeflectorCellConfig[]>([]);
  const [fogOfWar, setFogOfWar] = useState(false);
  const [fogVisibilityDistance, setFogVisibilityDistance] = useState(1.5);
  const [fogKeepRevealed, setFogKeepRevealed] = useState(true);

  // Selection & Generated Candidates
  const [selection, setSelection] = useState<SelectionRect | null>(null);
  const [generatedCandidates, setGeneratedCandidates] = useState<{ level: LevelData; solution: string[] | null; moveCount: number }[]>([]);
  const [activeCandidateIndex, setActiveCandidateIndex] = useState<number | null>(null);

  // Tool — wrap setActiveTool to track previous tool for restoring after box placement
  const [activeTool, _setActiveTool] = useState<ToolType>('obstacle');
  const prevToolRef = useRef<ToolType>('obstacle');
  const setActiveTool = useCallback((t: ToolType) => {
    _setActiveTool((prev) => {
      if (prev !== 'place_box' && !prev.startsWith('place_obj')) {
        prevToolRef.current = prev;
      }
      return t;
    });
  }, []);
  const paintMode = useRef<'paint' | 'erase'>('paint');

  // Undo history — stores grid and lock snapshots (max 40)
  interface HistorySnapshot {
    grid: CellType[][];
    lockedCells: Record<string, boolean>;
  }
  const historyRef = useRef<HistorySnapshot[]>([]);
  const [historyLen, setHistoryLen] = useState(0);

  const pushGridHistory = useCallback(() => {
    historyRef.current = [
      ...historyRef.current.slice(-39),
      { grid: grid.map((r) => [...r]), lockedCells: { ...lockedCells } }
    ];
    setHistoryLen(historyRef.current.length);
  }, [grid, lockedCells]);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setHistoryLen(historyRef.current.length);
    setGrid(prev.grid);
    setLockedCells(prev.lockedCells);
  }, []);

  // Saved levels
  const [savedLevels, setSavedLevels] = useState<(StoredLevel & { id: number })[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);

  // UI
  const [testLevel, setTestLevel] = useState<LevelData | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [optimalSolution, setOptimalSolution] = useState<string[] | null>(null);
  const [optimalSolutionMoves, setOptimalSolutionMoves] = useState<number>(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePosition, setSavePosition] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitNote, setSubmitNote] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [copied, setCopied] = useState(false);

  // Admin / Firestore
  const [parts, setParts] = useState<LevelPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('1');
  const [firestoreLevels, setFirestoreLevels] = useState<FirestoreLevel[]>([]);
  const [showFirestoreLevels, setShowFirestoreLevels] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');
  const [firestoreEditId, setFirestoreEditId] = useState<string | null>(null);

  const reloadLevels = useCallback(async () => {
    const { getOrderedLevels } = await import('@/app/src/lib/db');
    setSavedLevels((await getOrderedLevels()) as (StoredLevel & { id: number })[]);
    setLevelsLoading(false);
  }, []);

  useEffect(() => {
    if (!isModerator) return;
    (async () => {
      const { getAllParts } = await import('@/app/src/lib/firebase/admin');
      const allParts = await getAllParts();
      setParts(allParts);
      if (allParts.length > 0) setSelectedPartId(allParts[0].partId);
    })();
  }, [isModerator]);

  useEffect(() => {
    if (!isModerator || !showFirestoreLevels) return;
    (async () => {
      const { getPartLevels } = await import('@/app/src/lib/firebase/admin');
      setFirestoreLevels(await getPartLevels(selectedPartId));
    })();
  }, [isModerator, selectedPartId, showFirestoreLevels]);

  const loadForEdit = useCallback(async (id: number) => {
    const { getDB } = await import('@/app/src/lib/db');
    const stored = await getDB().levels.get(id);
    if (!stored) return;
    setLevelName(stored.name);
    setOptimalSolution(null);
    setOptimalSolutionMoves(0);
    setTrailCollision(!!stored.trailCollision);
    setDifficulty((stored.difficulty != undefined ? stored.difficulty : 2) as 1 | 2 | 3 | 4);
    setSavedRequestId(stored.requestId ?? null);

    // Multi-room support loading
    const parsedControlMode = stored.controlMode ?? 'all_rooms';
    setControlMode(parsedControlMode);

    if (stored.rooms && stored.rooms.length > 0) {
      const parsedRooms = stored.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        width: r.width,
        height: r.height,
        x: r.x ?? 0,
        y: r.y ?? 0,
        edges: {
          top: typeof r.edges.top === 'string' ? { type: r.edges.top } : r.edges.top,
          bottom: typeof r.edges.bottom === 'string' ? { type: r.edges.bottom } : r.edges.bottom,
          left: typeof r.edges.left === 'string' ? { type: r.edges.left } : r.edges.left,
          right: typeof r.edges.right === 'string' ? { type: r.edges.right } : r.edges.right,
        },
        grid: typeof r.grid === 'string' ? JSON.parse(r.grid) : r.grid,
        fogOfWar: r.fogOfWar ?? false,
        fogVisibilityDistance: r.fogVisibilityDistance ?? 1.5,
        fogKeepRevealed: r.fogKeepRevealed ?? true,
      }));
      setRooms(parsedRooms);

      const firstRoom = parsedRooms[0];
      setActiveRoomId(firstRoom.id);
      setWidth(firstRoom.width); setHeight(firstRoom.height);
      setPendingW(firstRoom.width); setPendingH(firstRoom.height);
      setEdges(firstRoom.edges);
      setGrid(firstRoom.grid);
      setFogOfWar(firstRoom.fogOfWar ?? false);
      setFogVisibilityDistance(firstRoom.fogVisibilityDistance ?? 1.5);
      setFogKeepRevealed(firstRoom.fogKeepRevealed ?? true);
    } else {
      // Legacy single-room fallback
      const legacyEdges = {
        top: typeof stored.edges.top === 'string' ? { type: stored.edges.top } : stored.edges.top,
        bottom: typeof stored.edges.bottom === 'string' ? { type: stored.edges.bottom } : stored.edges.bottom,
        left: typeof stored.edges.left === 'string' ? { type: stored.edges.left } : stored.edges.left,
        right: typeof stored.edges.right === 'string' ? { type: stored.edges.right } : stored.edges.right,
      } as any;
      const mainRoom = {
        id: 'main',
        name: stored.name,
        width: stored.width,
        height: stored.height,
        x: 0,
        y: 0,
        edges: legacyEdges,
        grid: typeof stored.grid === 'string' ? JSON.parse(stored.grid) : stored.grid as CellType[][],
        fogOfWar: false,
        fogVisibilityDistance: 1.5,
        fogKeepRevealed: true,
      };
      setRooms([mainRoom]);
      setActiveRoomId('main');
      setWidth(stored.width); setHeight(stored.height);
      setPendingW(stored.width); setPendingH(stored.height);
      setEdges(legacyEdges);
      setGrid(mainRoom.grid);
      setFogOfWar(false);
      setFogVisibilityDistance(1.5);
      setFogKeepRevealed(true);
    }

    setLockedCells((stored as any).lockedCells ?? {});
    const objs: ObjConfig[] = (stored.initialObjects ?? []).map((obj) => ({
      id: obj.id,
      row: obj.position.row,
      col: obj.position.col,
      roomId: obj.position.roomId ?? 'main',
      mode: obj.mode,
      lockOnTarget: obj.lockOnTarget,
    }));
    if (objs.length === 0) {
      objs.push({ id: 1, row: null, col: null, roomId: 'main', mode: 'normal', lockOnTarget: true });
    }
    setObjects(objs);
    setBoxes((stored.initialBoxes ?? []).map((b) => ({
      id: b.id,
      row: b.position.row,
      col: b.position.col,
      roomId: b.position.roomId ?? 'main',
      requiresPower: b.requiresPower ?? false,
      durabilityEnabled: b.durabilityEnabled ?? false,
      durability: b.durability ?? 3,
      colorFilterEnabled: b.colorFilterEnabled ?? false,
      colorFilterIndex: b.colorFilterIndex ?? 0,
    })));
    setConveyorPowerRequired(stored.conveyorPowerRequired ?? []);
    setConveyorConfig(stored.conveyorConfig ?? []);
    setTrampolineConfig(stored.trampolineConfig ?? []);
    setDeflectorConfig(stored.deflectorConfig ?? []);
    setActivePlacingBoxId(null);

    setSelection(null);
    setGeneratedCandidates([]);
    setActiveCandidateIndex(null);
  }, []);

  useEffect(() => { reloadLevels(); }, [reloadLevels]);
  useEffect(() => { if (editId !== null) loadForEdit(editId); }, [editId, loadForEdit]);



  const applyResize = useCallback(() => {
    const newW = Math.max(3, Math.min(16, pendingW));
    const newH = Math.max(3, Math.min(16, pendingH));
    setWidth(newW); setHeight(newH);
    setGrid((g) => resizeGrid(g, newW, newH));
    setObjects((os) => os.map((o) => {
      if ((o.roomId ?? 'main') !== activeRoomId) return o;
      return { ...o, row: o.row !== null && o.row < newH ? o.row : null, col: o.col !== null && o.col < newW ? o.col : null };
    }));
    setBoxes((bs) => bs.map((b) => {
      if ((b.roomId ?? 'main') !== activeRoomId) return b;
      return { ...b, row: b.row !== null && b.row < newH ? b.row : null, col: b.col !== null && b.col < newW ? b.col : null };
    }));
    setConveyorPowerRequired((cpr) => cpr.filter((p) => (p.roomId ?? 'main') !== activeRoomId || (p.row < newH && p.col < newW)));
    setConveyorConfig((cc) => cc.filter((c) => (c.position.roomId ?? 'main') !== activeRoomId || (c.position.row < newH && c.position.col < newW)));
    setTrampolineConfig((tc) => tc.filter((c) => (c.position.roomId ?? 'main') !== activeRoomId || (c.position.row < newH && c.position.col < newW)));
    setDeflectorConfig((dc) => dc.filter((c) => (c.position.roomId ?? 'main') !== activeRoomId || (c.position.row < newH && c.position.col < newW)));

    setSelection(null);
    setLockedCells((prev) => {
      const filtered: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(prev)) {
        const [rStr, cStr] = key.split(',');
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        if (r < newH && c < newW) {
          filtered[key] = value;
        }
      }
      return filtered;
    });
    setActiveCandidateIndex(null);
  }, [pendingW, pendingH, activeRoomId]);

  const paintCell = useCallback((r: number, c: number, isDrag: boolean) => {
    setActiveCandidateIndex(null);
    if (!isDrag) pushGridHistory();
    if (activeTool.startsWith('place_obj')) {
      const id = parseInt(activeTool.substring(9), 10);
      if (!isNaN(id)) {
        setObjects((os) => os.map((o) => o.id === id ? { ...o, row: r, col: c, roomId: activeRoomId } : o));
        return;
      }
    }
    if (activeTool === 'place_box' && activePlacingBoxId !== null) {
      setBoxes((bs) => bs.map((b) => b.id === activePlacingBoxId ? { ...b, row: r, col: c, roomId: activeRoomId } : b));
      setActivePlacingBoxId(null);
      setActiveTool(prevToolRef.current);
      return;
    }
    // BUG FIX: if still in place_box mode but no box to place, do nothing
    if (activeTool === 'place_box') return;
    if (activeTool === 'lock') {
      setLockedCells((prev) => {
        const key = `${r},${c}`;
        const next = { ...prev };
        if (isDrag) {
          if (paintMode.current === 'erase') {
            delete next[key];
          } else {
            next[key] = true;
          }
        } else {
          if (next[key]) {
            paintMode.current = 'erase';
            delete next[key];
          } else {
            paintMode.current = 'paint';
            next[key] = true;
          }
        }
        return next;
      });
      return;
    }
    // 'select' tool paints nothing
    if (activeTool === 'select') return;
    const cellType: CellType = activeTool === 'erase' ? 'empty' : (activeTool as CellType);
    setGrid((g) => {
      const next = g.map((row) => [...row]);
      if (isDrag) {
        if (paintMode.current === 'erase') { next[r][c] = 'empty'; return next; }
      } else {
        if (activeTool !== 'erase' && next[r][c] === cellType) { paintMode.current = 'erase'; next[r][c] = 'empty'; return next; }
        paintMode.current = 'paint';
      }
      if (cellType === 'target_1' || cellType === 'target_2') {
        for (let row = 0; row < next.length; row++)
          for (let col = 0; col < next[row].length; col++)
            if (next[row][col] === cellType) next[row][col] = 'empty';
      }
      next[r][c] = cellType;
      return next;
    });
  }, [activeTool, activePlacingBoxId, setActiveTool, activeRoomId]);
  const switchActiveRoom = useCallback((newId: string) => {
    setRooms((prevRooms) => {
      const updated = prevRooms.map((r) => {
        if (r.id === activeRoomId) {
          return { ...r, width, height, edges, grid, fogOfWar, fogVisibilityDistance, fogKeepRevealed };
        }
        return r;
      });

      const targetRoom = updated.find((r) => r.id === newId);
      if (targetRoom) {
        setActiveRoomId(newId);
        setWidth(targetRoom.width);
        setHeight(targetRoom.height);
        setPendingW(targetRoom.width);
        setPendingH(targetRoom.height);
        setEdges(targetRoom.edges);
        setGrid(targetRoom.grid);
        setFogOfWar(targetRoom.fogOfWar ?? false);
        setFogVisibilityDistance(targetRoom.fogVisibilityDistance ?? 1.5);
        setFogKeepRevealed(targetRoom.fogKeepRevealed ?? true);
      }
      return updated;
    });
  }, [activeRoomId, width, height, edges, grid, fogOfWar, fogVisibilityDistance, fogKeepRevealed]);

  const addRoom = useCallback(() => {
    // Find first unoccupied layout slot in the 6x6 grid [0..5]
    let newX = 0;
    let newY = 0;
    let found = false;
    for (let y = 0; y <= 5; y++) {
      for (let x = 0; x <= 5; x++) {
        if (!rooms.some((r) => r.x === x && r.y === y)) {
          newX = x;
          newY = y;
          found = true;
          break;
        }
      }
      if (found) break;
    }

    const newId = `room_${Date.now()}`;
    const newRoom = {
      id: newId,
      name: `Room ${rooms.length + 1}`,
      width: 5,
      height: 5,
      x: newX,
      y: newY,
      edges: {
        top: { type: 'wall' },
        bottom: { type: 'wall' },
        left: { type: 'wall' },
        right: { type: 'wall' },
      },
      grid: makeGrid(5, 5),
      fogOfWar: false,
      fogVisibilityDistance: 1.5,
      fogKeepRevealed: true,
    };

    setRooms((prevRooms) => {
      const updated = prevRooms.map((r) => {
        if (r.id === activeRoomId) {
          return { ...r, width, height, edges, grid, fogOfWar, fogVisibilityDistance, fogKeepRevealed };
        }
        return r;
      });
      return [...updated, newRoom];
    });

    setActiveRoomId(newId);
    setWidth(5);
    setHeight(5);
    setPendingW(5);
    setPendingH(5);
    setEdges({
      top: { type: 'wall' },
      bottom: { type: 'wall' },
      left: { type: 'wall' },
      right: { type: 'wall' },
    });
    setGrid(makeGrid(5, 5));
    setFogOfWar(false);
    setFogVisibilityDistance(1.5);
    setFogKeepRevealed(true);
  }, [rooms, activeRoomId, width, height, edges, grid, fogOfWar, fogVisibilityDistance, fogKeepRevealed]);

  const deleteRoom = useCallback((idToDelete: string) => {
    if (rooms.length <= 1) return;

    setRooms((prevRooms) => {
      const remaining = prevRooms.filter((r) => r.id !== idToDelete).map((r) => {
        let rChanged = false;
        const nextRoomEdges = { ...r.edges };
        for (const s of ['top', 'bottom', 'left', 'right'] as const) {
          const edge = nextRoomEdges[s];
          if (edge && edge.type === 'portal' && edge.targetRoomId === idToDelete) {
            nextRoomEdges[s] = {
              ...edge,
              targetRoomId: undefined,
              targetEdge: undefined,
            };
            rChanged = true;
          }
        }
        if (rChanged) {
          return { ...r, edges: nextRoomEdges };
        }
        return r;
      });

      if (activeRoomId === idToDelete) {
        const fallbackRoom = remaining[0];
        setActiveRoomId(fallbackRoom.id);
        setWidth(fallbackRoom.width);
        setHeight(fallbackRoom.height);
        setPendingW(fallbackRoom.width);
        setPendingH(fallbackRoom.height);
        setEdges(fallbackRoom.edges);
        setGrid(fallbackRoom.grid);
        setFogOfWar(fallbackRoom.fogOfWar ?? false);
        setFogVisibilityDistance(fallbackRoom.fogVisibilityDistance ?? 1.5);
        setFogKeepRevealed(fallbackRoom.fogKeepRevealed ?? true);
      }
      return remaining;
    });

    setObjects((os) => os.filter((o) => (o.roomId ?? 'main') !== idToDelete));
    setBoxes((bs) => bs.filter((b) => (b.roomId ?? 'main') !== idToDelete));
    setConveyorPowerRequired((cpr) => cpr.filter((pos) => (pos.roomId ?? 'main') !== idToDelete));
    setConveyorConfig((cc) => cc.filter((c) => (c.position.roomId ?? 'main') !== idToDelete));
    setTrampolineConfig((tc) => tc.filter((c) => (c.position.roomId ?? 'main') !== idToDelete));
    setDeflectorConfig((dc) => dc.filter((c) => (c.position.roomId ?? 'main') !== idToDelete));
  }, [rooms.length, activeRoomId]);

  const updateRoomName = useCallback((id: string, newName: string) => {
    setRooms((prev) => prev.map((r) => r.id === id ? { ...r, name: newName } : r));
  }, []);

  const updateRoomLayoutPosition = useCallback((id: string, x: number, y: number) => {
    const clampedX = Math.max(0, Math.min(5, Math.floor(x)));
    const clampedY = Math.max(0, Math.min(5, Math.floor(y)));

    setRooms((prev) => {
      const duplicateRoom = prev.find((r) => r.id !== id && r.x === clampedX && r.y === clampedY);

      if (duplicateRoom) {
        const currentRoom = prev.find((r) => r.id === id);
        if (currentRoom) {
          const originalX = currentRoom.x;
          const originalY = currentRoom.y;

          return prev.map((r) => {
            if (r.id === id) {
              return { ...r, x: clampedX, y: clampedY };
            }
            if (r.id === duplicateRoom.id) {
              return { ...r, x: originalX, y: originalY };
            }
            return r;
          });
        }
      }

      return prev.map((r) => r.id === id ? { ...r, x: clampedX, y: clampedY } : r);
    });
  }, []);

  const generateLevelData = useCallback((): { level: LevelData | null; error: string | null } => {
    const currentRooms = rooms.map((r) => {
      if (r.id === activeRoomId) {
        return { ...r, width, height, edges, grid, fogOfWar, fogVisibilityDistance, fogKeepRevealed };
      }
      return r;
    });

    const validObjs = objects.filter((o) => o.row !== null && o.col !== null);
    if (validObjs.length < 1) return { level: null, error: 'Place at least one player on the grid first.' };
    if (validObjs.length !== objects.length) return { level: null, error: 'All defined players must be placed on the grid.' };

    const targets: { objectId: number; position: { roomId: string; row: number; col: number } }[] = [];
    for (const room of currentRooms) {
      for (let r = 0; r < room.height; r++) {
        for (let c = 0; c < room.width; c++) {
          const cell = room.grid[r][c];
          if (cell.startsWith('target_')) {
            const id = parseInt(cell.substring(7), 10);
            if (!isNaN(id)) {
              targets.push({ objectId: id, position: { roomId: room.id, row: r, col: c } });
            }
          }
        }
      }
    }

    if (targets.length !== validObjs.length) {
      return { level: null, error: `Number of targets (${targets.length}) must match number of players (${validObjs.length}).` };
    }

    const telGroupCounts: Record<string, number> = {};
    for (const room of currentRooms) {
      for (const row of room.grid) {
        for (const cell of row) {
          if (cell.startsWith('teleporter_in_') || cell.startsWith('teleporter_out_')) {
            const group = cell.substring(cell.lastIndexOf('_') + 1);
            telGroupCounts[group] = (telGroupCounts[group] ?? 0) + 1;
          }
        }
      }
    }
    for (const [group, count] of Object.entries(telGroupCounts)) {
      if (count < 2) {
        return { level: null, error: `Teleporter group ${group} must have at least 2 portals.` };
      }
    }

    const validBoxes = boxes.filter((b) => b.row !== null && b.col !== null);
    const initialControlledRooms = controlMode === 'all_rooms' ? currentRooms.map(r => r.id) : [currentRooms[0].id];

    return {
      level: {
        id: editId ?? 0,
        name: levelName || 'Unnamed Level',
        width,
        height,
        edges: edges as any,
        grid,
        difficulty,
        creatorName,
        rooms: currentRooms.map((r) => ({
          id: r.id,
          name: r.name,
          width: r.width,
          height: r.height,
          x: r.x,
          y: r.y,
          edges: r.edges,
          grid: r.grid,
          fogOfWar: r.fogOfWar ?? false,
          fogVisibilityDistance: r.fogVisibilityDistance ?? 1.5,
          fogKeepRevealed: r.fogKeepRevealed ?? true,
        })),
        controlMode,
        initialControlledRooms,
        initialObjects: validObjs.map((o) => ({
          id: o.id,
          position: { roomId: o.roomId ?? 'main', row: o.row!, col: o.col! },
          mode: o.mode,
          lockOnTarget: o.lockOnTarget
        })),
        targets: targets as any,
        ...(trailCollision ? { trailCollision: true } : {}),
        ...(validBoxes.length > 0 ? {
          initialBoxes: validBoxes.map((b) => ({
            id: b.id,
            position: { roomId: b.roomId ?? 'main', row: b.row!, col: b.col! },
            ...(b.requiresPower ? { requiresPower: true } : {}),
            ...(b.durabilityEnabled ? { durabilityEnabled: true, durability: b.durability } : {}),
            ...(b.colorFilterEnabled ? { colorFilterEnabled: true, colorFilterIndex: b.colorFilterIndex } : {}),
          }))
        } : {}),
        ...(conveyorPowerRequired.length > 0 ? { conveyorPowerRequired } : {}),
        ...(conveyorConfig.length > 0 ? { conveyorConfig } : {}),
        ...(trampolineConfig.length > 0 ? { trampolineConfig } : {}),
        ...(deflectorConfig.length > 0 ? { deflectorConfig } : {}),
        ...(Object.keys(lockedCells).length > 0 ? { lockedCells } : {}),
      } as any,
      error: null,
    };
  }, [editId, levelName, width, height, edges, grid, objects, trailCollision, boxes, conveyorPowerRequired, conveyorConfig, trampolineConfig, deflectorConfig, lockedCells, rooms, controlMode, activeRoomId, difficulty, creatorName, fogOfWar, fogVisibilityDistance, fogKeepRevealed]);

  // Live Path Solver effect (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      const { level, error } = generateLevelData();
      if (error || !level) {
        setOptimalSolution(null);
        setOptimalSolutionMoves(0);
        setOptimalSolutionTrajectory(null);
        return;
      }
      try {
        const { solvePuzzle, getSolutionTrajectories } = await import('@/app/src/games/logic/solver');
        const result = solvePuzzle(level, 26, 2000);
        if (result.solvable && result.solution) {
          setOptimalSolution(result.solution);
          setOptimalSolutionMoves(result.moveCount);
          const traj = getSolutionTrajectories(level, result.solution);
          setOptimalSolutionTrajectory(traj);
        } else {
          setOptimalSolution(null);
          setOptimalSolutionMoves(0);
          setOptimalSolutionTrajectory(null);
        }
      } catch (err) {
        console.error('Live solver error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [grid, width, height, objects, boxes, edges, trailCollision, conveyorPowerRequired, conveyorConfig, trampolineConfig, deflectorConfig, generateLevelData, rooms]);

  const buildPayload = useCallback((level: any): Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: level.name, width: level.width, height: level.height, edges: level.edges,
    grid: level.grid, initialObjects: level.initialObjects, targets: level.targets,
    trailCollision: level.trailCollision, initialBoxes: level.initialBoxes,
    conveyorPowerRequired: level.conveyorPowerRequired,
    conveyorConfig: level.conveyorConfig,
    trampolineConfig: level.trampolineConfig,
    deflectorConfig: level.deflectorConfig,
    difficulty,
    lockedCells: level.lockedCells,
    rooms: level.rooms,
    controlMode: level.controlMode,
    initialControlledRooms: level.initialControlledRooms,
    ...(savedRequestId ? { requestId: savedRequestId } : {}),
    position: savedLevels.length
  }), [difficulty, savedRequestId, savedLevels.length]);

  const doSave = useCallback(async (posInput?: string) => {
    const { level, error } = generateLevelData();
    if (error || !level) { setTestError(error); return; }
    const payload = buildPayload(level);
    if (editId !== null) {
      const { updateStoredLevel } = await import('@/app/src/lib/db');
      await updateStoredLevel(editId, payload);
    } else {
      const { saveLevelAtPosition } = await import('@/app/src/lib/db');
      let pos: number | undefined;
      if (posInput?.trim()) { const n = parseInt(posInput, 10); if (!isNaN(n) && n >= 1) pos = n - 1; }
      const newId = await saveLevelAtPosition(payload, pos);
      router.replace(`/editor?id=${newId}`);
    }
    await reloadLevels();
    setSaveSuccess('Saved!');
    setTimeout(() => setSaveSuccess(''), 2000);
    setSaveDialogOpen(false); setSavePosition('');
  }, [editId, generateLevelData, buildPayload, reloadLevels, router]);

  const handleSaveClick = useCallback(() => {
    if (editId !== null) doSave();
    else setSaveDialogOpen(true);
  }, [editId, doSave]);

  const handleSubmitLevel = useCallback(async () => {
    if (!user || isAnonymous) return;
    const { level, error } = generateLevelData();
    if (error || !level) { setSubmitError(error ?? 'Level geçersiz.'); return; }
    setSubmitError('');
    try {
      if (savedRequestId) {
        const { updateLevelRequest } = await import('@/app/src/lib/firebase/firestore');
        await updateLevelRequest(savedRequestId, level, difficulty);
        setSubmitStatus('Güncellendi!');
      } else {
        const { submitLevelRequest } = await import('@/app/src/lib/firebase/firestore');
        const reqId = await submitLevelRequest(user.uid, level, userTag, difficulty, creatorName);
        setSavedRequestId(reqId);
        const targetId = savedIdForSubmitRef.current ?? (editId ?? null);
        if (targetId !== null) {
          const { setLevelRequestId } = await import('@/app/src/lib/db');
          await setLevelRequestId(targetId, reqId);
        }
        setSubmitStatus('Gönderildi!');
      }
      setTimeout(() => { setSubmitStatus(''); setSubmitDialogOpen(false); setSubmitNote(''); }, 2000);
    } catch (err) {
      console.error('[Submit]', err);
      setSubmitError('Gönderim başarısız. Tekrar dene.');
    }
  }, [user, isAnonymous, generateLevelData, userTag, savedRequestId, difficulty, editId]);

  const handleSaveAndSubmit = useCallback(async () => {
    if (!user || isAnonymous) return;
    const { level, error } = generateLevelData();
    if (error || !level) { setTestError(error); return; }
    const payload = buildPayload(level);
    if (editId !== null) {
      const { updateStoredLevel } = await import('@/app/src/lib/db');
      await updateStoredLevel(editId, payload);
      savedIdForSubmitRef.current = editId;
    } else {
      const { saveLevelAtPosition } = await import('@/app/src/lib/db');
      const newId = await saveLevelAtPosition(payload);
      savedIdForSubmitRef.current = newId;
      await reloadLevels();
      router.replace(`/editor?id=${newId}`);
    }
    setSaveSuccess('Kaydedildi!');
    setTimeout(() => setSaveSuccess(''), 2000);
    setSubmitError(''); setSubmitDialogOpen(true);
  }, [user, isAnonymous, editId, generateLevelData, buildPayload, reloadLevels, router]);

  /** Saves current level JSON to localStorage clipboard */
  const handleCopyBoard = useCallback(() => {
    const { level } = generateLevelData();
    if (!level) return;
    if (typeof window !== 'undefined') {
      localStorage.setItem('editorClipboard', JSON.stringify(level));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [generateLevelData]);

  /** Loads level JSON from localStorage clipboard. Returns error string or null on success. */
  const handlePasteBoard = useCallback((): string | null => {
    if (typeof window === 'undefined') return 'Unavailable';
    const raw = localStorage.getItem('editorClipboard');
    if (!raw) return 'Pano boş.';
    try {
      const parsed = JSON.parse(raw) as any;

      setLevelName(parsed.name ?? 'Pasted Level');
      setTrailCollision(!!parsed.trailCollision);
      setLockedCells(parsed.lockedCells ?? {});

      // Multi-room support loading
      const parsedControlMode = parsed.controlMode ?? 'all_rooms';
      setControlMode(parsedControlMode);

      if (parsed.rooms && parsed.rooms.length > 0) {
        const parsedRooms = parsed.rooms.map((r: any) => ({
          id: r.id,
          name: r.name,
          width: r.width,
          height: r.height,
          x: r.x ?? 0,
          y: r.y ?? 0,
          edges: {
            top: typeof r.edges.top === 'string' ? { type: r.edges.top } : r.edges.top,
            bottom: typeof r.edges.bottom === 'string' ? { type: r.edges.bottom } : r.edges.bottom,
            left: typeof r.edges.left === 'string' ? { type: r.edges.left } : r.edges.left,
            right: typeof r.edges.right === 'string' ? { type: r.edges.right } : r.edges.right,
          },
          grid: typeof r.grid === 'string' ? JSON.parse(r.grid) : r.grid,
          fogOfWar: r.fogOfWar ?? false,
          fogVisibilityDistance: r.fogVisibilityDistance ?? 1.5,
        }));
        setRooms(parsedRooms);

        const firstRoom = parsedRooms[0];
        setActiveRoomId(firstRoom.id);
        setWidth(firstRoom.width); setHeight(firstRoom.height);
        setPendingW(firstRoom.width); setPendingH(firstRoom.height);
        setEdges(firstRoom.edges);
        setGrid(firstRoom.grid);
        setFogOfWar(firstRoom.fogOfWar ?? false);
        setFogVisibilityDistance(firstRoom.fogVisibilityDistance ?? 1.5);
      } else {
        if (!parsed.grid || !parsed.width || !parsed.height) return 'Geçersiz format.';
        // Legacy single-room fallback
        const legacyEdges = {
          top: typeof parsed.edges.top === 'string' ? { type: parsed.edges.top } : parsed.edges.top,
          bottom: typeof parsed.edges.bottom === 'string' ? { type: parsed.edges.bottom } : parsed.edges.bottom,
          left: typeof parsed.edges.left === 'string' ? { type: parsed.edges.left } : parsed.edges.left,
          right: typeof parsed.edges.right === 'string' ? { type: parsed.edges.right } : parsed.edges.right,
        } as any;
        const mainRoom = {
          id: 'main',
          name: parsed.name ?? 'Pasted Level',
          width: parsed.width,
          height: parsed.height,
          x: 0,
          y: 0,
          edges: legacyEdges,
          grid: typeof parsed.grid === 'string' ? JSON.parse(parsed.grid) : parsed.grid as CellType[][],
          fogOfWar: false,
          fogVisibilityDistance: 1.5,
        };
        setRooms([mainRoom]);
        setActiveRoomId('main');
        setWidth(parsed.width); setHeight(parsed.height);
        setPendingW(parsed.width); setPendingH(parsed.height);
        setEdges(legacyEdges);
        setGrid(mainRoom.grid);
        setFogOfWar(false);
        setFogVisibilityDistance(1.5);
      }

      setBoxes((parsed.initialBoxes ?? []).map((b: any) => ({
        id: b.id,
        row: b.position.row,
        col: b.position.col,
        roomId: b.position.roomId ?? 'main',
        requiresPower: b.requiresPower ?? false,
        durabilityEnabled: b.durabilityEnabled ?? false,
        durability: b.durability ?? 3,
        colorFilterEnabled: b.colorFilterEnabled ?? false,
        colorFilterIndex: b.colorFilterIndex ?? 0,
      })));
      setConveyorPowerRequired(parsed.conveyorPowerRequired ?? []);
      setConveyorConfig(parsed.conveyorConfig ?? []);
      setTrampolineConfig(parsed.trampolineConfig ?? []);
      setDeflectorConfig(parsed.deflectorConfig ?? []);
      setActivePlacingBoxId(null);

      const objs: ObjConfig[] = (parsed.initialObjects ?? []).map((obj: any) => ({
        id: obj.id,
        row: obj.position.row,
        col: obj.position.col,
        roomId: obj.position.roomId ?? 'main',
        mode: obj.mode,
        lockOnTarget: obj.lockOnTarget,
      }));
      if (objs.length === 0) {
        objs.push({ id: 1, row: null, col: null, roomId: 'main', mode: 'normal', lockOnTarget: true });
      }
      setObjects(objs);
      return null;
    } catch {
      return 'Geçersiz JSON.';
    }
  }, []);

  const loadFirestoreLevel = useCallback((fl: FirestoreLevel) => {
    setFirestoreEditId(fl.firestoreId);
    setLevelName(fl.name);
    setOptimalSolution(null);
    setOptimalSolutionMoves(0);
    setTrailCollision(!!fl.trailCollision);
    setDifficulty((fl.difficulty != undefined ? fl.difficulty : 2) as 1 | 2 | 3 | 4);

    // Multi-room support loading
    const parsedControlMode = fl.controlMode ?? 'all_rooms';
    setControlMode(parsedControlMode);

    if (fl.rooms && fl.rooms.length > 0) {
      const parsedRooms = fl.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        width: r.width,
        height: r.height,
        x: r.x ?? 0,
        y: r.y ?? 0,
        edges: {
          top: typeof r.edges.top === 'string' ? { type: r.edges.top } : r.edges.top,
          bottom: typeof r.edges.bottom === 'string' ? { type: r.edges.bottom } : r.edges.bottom,
          left: typeof r.edges.left === 'string' ? { type: r.edges.left } : r.edges.left,
          right: typeof r.edges.right === 'string' ? { type: r.edges.right } : r.edges.right,
        },
        grid: typeof r.grid === 'string' ? JSON.parse(r.grid) : r.grid,
        fogOfWar: r.fogOfWar ?? false,
        fogVisibilityDistance: r.fogVisibilityDistance ?? 1.5,
      }));
      setRooms(parsedRooms);

      const firstRoom = parsedRooms[0];
      setActiveRoomId(firstRoom.id);
      setWidth(firstRoom.width); setHeight(firstRoom.height);
      setPendingW(firstRoom.width); setPendingH(firstRoom.height);
      setEdges(firstRoom.edges);
      setGrid(firstRoom.grid);
      setFogOfWar(firstRoom.fogOfWar ?? false);
      setFogVisibilityDistance(firstRoom.fogVisibilityDistance ?? 1.5);
    } else {
      // Legacy single-room fallback
      const legacyEdges = {
        top: typeof fl.edges.top === 'string' ? { type: fl.edges.top } : fl.edges.top,
        bottom: typeof fl.edges.bottom === 'string' ? { type: fl.edges.bottom } : fl.edges.bottom,
        left: typeof fl.edges.left === 'string' ? { type: fl.edges.left } : fl.edges.left,
        right: typeof fl.edges.right === 'string' ? { type: fl.edges.right } : fl.edges.right,
      } as any;
      const mainRoom = {
        id: 'main',
        name: fl.name,
        width: fl.width,
        height: fl.height,
        x: 0,
        y: 0,
        edges: legacyEdges,
        grid: typeof fl.grid === 'string' ? JSON.parse(fl.grid) : fl.grid as CellType[][],
        fogOfWar: false,
        fogVisibilityDistance: 1.5,
      };
      setRooms([mainRoom]);
      setActiveRoomId('main');
      setWidth(fl.width); setHeight(fl.height);
      setPendingW(fl.width); setPendingH(fl.height);
      setEdges(legacyEdges);
      setGrid(mainRoom.grid);
      setFogOfWar(false);
      setFogVisibilityDistance(1.5);
    }

    const objs: ObjConfig[] = (fl.initialObjects ?? []).map((obj) => ({
      id: obj.id,
      row: obj.position.row,
      col: obj.position.col,
      roomId: obj.position.roomId ?? 'main',
      mode: obj.mode,
      lockOnTarget: obj.lockOnTarget,
    }));
    if (objs.length === 0) {
      objs.push({ id: 1, row: null, col: null, roomId: 'main', mode: 'normal', lockOnTarget: true });
    }
    setObjects(objs);
    setBoxes((fl.initialBoxes ?? []).map((b) => ({
      id: b.id,
      row: b.position.row,
      col: b.position.col,
      roomId: b.position.roomId ?? 'main',
      requiresPower: b.requiresPower ?? false,
      durabilityEnabled: b.durabilityEnabled ?? false,
      durability: b.durability ?? 3,
      colorFilterEnabled: b.colorFilterEnabled ?? false,
      colorFilterIndex: b.colorFilterIndex ?? 0,
    })));
    setConveyorPowerRequired(fl.conveyorPowerRequired ?? []);
    setConveyorConfig(fl.conveyorConfig ?? []);
    setTrampolineConfig(fl.trampolineConfig ?? []);
    setDeflectorConfig(fl.deflectorConfig ?? []);
    setActivePlacingBoxId(null);

    setSelection(null);
    setGeneratedCandidates([]);
    setActiveCandidateIndex(null);
  }, []);

  const doPublish = useCallback(async () => {
    if (!user || !isModerator) return;
    const { level, error } = generateLevelData();
    if (error || !level) { setTestError(error); return; }
    const payload = { ...level, part: selectedPartId, position: savedLevels.length, difficulty };
    const { publishLevel, updateFirestoreLevel } = await import('@/app/src/lib/firebase/admin');
    if (firestoreEditId) {
      await updateFirestoreLevel(firestoreEditId, payload, user.uid, selectedPartId);
    } else {
      setFirestoreEditId(await publishLevel(payload, selectedPartId, user.uid));
    }
    setPublishStatus(firestoreEditId ? 'Updated!' : 'Published!');
    if (showFirestoreLevels) {
      const { getPartLevels } = await import('@/app/src/lib/firebase/admin');
      setFirestoreLevels(await getPartLevels(selectedPartId));
    }
    setTimeout(() => setPublishStatus(''), 2000);
  }, [user, isModerator, generateLevelData, selectedPartId, firestoreEditId, showFirestoreLevels, savedLevels.length, difficulty]);

  useEffect(() => {
    if (!firestoreIdParam || !isModerator) return;
    (async () => {
      const { getPartLevels, getAllParts } = await import('@/app/src/lib/firebase/admin');
      const allParts = await getAllParts();
      for (const part of allParts) {
        const levels = await getPartLevels(part.partId);
        const fl = levels.find((l) => l.firestoreId === firestoreIdParam);
        if (fl) { loadFirestoreLevel(fl); setSelectedPartId(part.partId); setShowFirestoreLevels(true); break; }
      }
    })();
  }, [firestoreIdParam, isModerator, loadFirestoreLevel]);

  const handleLoadLevel = useCallback((stored: StoredLevel & { id: number }) => {
    router.push(`/editor?id=${stored.id}`);
  }, [router]);

  const handleNewLevel = useCallback(() => {
    router.push('/editor');
    setLevelName('My Level');
    setOptimalSolution(null);
    setOptimalSolutionMoves(0);
    setWidth(5); setHeight(5); setPendingW(5); setPendingH(5);
    setEdges({ top: { type: 'wall' }, bottom: { type: 'wall' }, left: { type: 'wall' }, right: { type: 'wall' } });
    setGrid(makeGrid(5, 5)); setTrailCollision(false); setDifficulty(2);
    setSavedRequestId(null); savedIdForSubmitRef.current = null;

    setRooms([
      {
        id: 'main',
        name: 'Main Room',
        width: 5,
        height: 5,
        x: 0,
        y: 0,
        edges: {
          top: { type: 'wall' },
          bottom: { type: 'wall' },
          left: { type: 'wall' },
          right: { type: 'wall' },
        },
        grid: makeGrid(5, 5),
        fogOfWar: false,
        fogVisibilityDistance: 1.5,
      }
    ]);
    setActiveRoomId('main');
    setControlMode('all_rooms');
    setFogOfWar(false);
    setFogVisibilityDistance(1.5);

    setObjects([...DEFAULT_OBJS.map((o) => ({ ...o, roomId: 'main' }))]);
    setBoxes([]); setLockedCells({}); setConveyorPowerRequired([]); setConveyorConfig([]); setTrampolineConfig([]); setDeflectorConfig([]); setActivePlacingBoxId(null); setFirestoreEditId(null);

    setSelection(null);
    setGeneratedCandidates([]);
    setActiveCandidateIndex(null);
  }, [router]);

  const [generatorDialogOpen, setGeneratorDialogOpen] = useState(false);

  const doGenerateLevel = useCallback((
    level: LevelData,
    solution: string[] | null,
    moveCount: number,
    allCandidates?: { level: LevelData; solution: string[] | null; moveCount: number }[],
    selectedIndex?: number
  ) => {
    pushGridHistory();
    setLevelName(level.name);
    setOptimalSolution(solution);
    setOptimalSolutionMoves(moveCount);
    setWidth(level.width); setHeight(level.height);
    setPendingW(level.width); setPendingH(level.height);
    setEdges({
      top: typeof level.edges.top === 'string' ? { type: level.edges.top } : level.edges.top,
      bottom: typeof level.edges.bottom === 'string' ? { type: level.edges.bottom } : level.edges.bottom,
      left: typeof level.edges.left === 'string' ? { type: level.edges.left } : level.edges.left,
      right: typeof level.edges.right === 'string' ? { type: level.edges.right } : level.edges.right,
    } as any);
    setGrid(level.grid as CellType[][]);
    setTrailCollision(!!level.trailCollision);
    setDifficulty((level.difficulty != undefined ? level.difficulty : 2) as 1 | 2 | 3 | 4);
    setSavedRequestId(null);
    setFirestoreEditId(null);
    setFogOfWar(level.rooms?.[0]?.fogOfWar ?? false);
    setFogVisibilityDistance(level.rooms?.[0]?.fogVisibilityDistance ?? 1.5);
    setFogKeepRevealed(level.rooms?.[0]?.fogKeepRevealed ?? true);
    
    const objs: ObjConfig[] = (level.initialObjects ?? []).map((obj) => ({
      id: obj.id,
      row: obj.position.row,
      col: obj.position.col,
      mode: obj.mode,
      lockOnTarget: obj.lockOnTarget,
    }));
    if (objs.length === 0) {
      objs.push({ id: 1, row: null, col: null, mode: 'normal', lockOnTarget: true });
    }
    setObjects(objs);

    setBoxes((level.initialBoxes ?? []).map((b) => ({
      id: b.id,
      row: b.position.row,
      col: b.position.col,
      requiresPower: b.requiresPower ?? false,
      durabilityEnabled: b.durabilityEnabled ?? false,
      durability: b.durability ?? 3,
      colorFilterEnabled: b.colorFilterEnabled ?? false,
      colorFilterIndex: b.colorFilterIndex ?? 0,
    })));
    setConveyorPowerRequired(level.conveyorPowerRequired ?? []);
    setConveyorConfig(level.conveyorConfig ?? []);
    setTrampolineConfig(level.trampolineConfig ?? []);
    setDeflectorConfig(level.deflectorConfig ?? []);
    setActivePlacingBoxId(null);
    setGeneratorDialogOpen(false);

    setSelection(null);
    setLockedCells((prev) => {
      const filtered: Record<string, boolean> = {};
      for (const [key, value] of Object.entries(prev)) {
        const [rStr, cStr] = key.split(',');
        const r = parseInt(rStr, 10);
        const c = parseInt(cStr, 10);
        if (r < level.height && c < level.width) {
          filtered[key] = value;
        }
      }
      return filtered;
    });

    if (allCandidates) {
      setGeneratedCandidates(allCandidates);
    }
    if (selectedIndex !== undefined) {
      setActiveCandidateIndex(selectedIndex);
    }
  }, [pushGridHistory]);

  const handleTest = useCallback(() => {
    const { level, error } = generateLevelData();
    if (error || !level) { setTestError(error); return; }
    setTestError(null); setTestLevel(level);
  }, [generateLevelData]);

  return {
    // Auth
    user, isAnonymous, isModerator, userTag,
    // Level data
    levelName, setLevelName, width, setWidth, height, setHeight,
    pendingW, setPendingW, pendingH, setPendingH,
    trailCollision, setTrailCollision, difficulty, setDifficulty,
    savedRequestId, edges, setEdges, grid, setGrid, objects, setObjects,
    boxes, setBoxes, activePlacingBoxId, setActivePlacingBoxId,
    conveyorPowerRequired, setConveyorPowerRequired,
    conveyorConfig, setConveyorConfig,
    trampolineConfig, setTrampolineConfig,
    deflectorConfig, setDeflectorConfig,
    // Multi-room
    rooms, setRooms, activeRoomId, setActiveRoomId, controlMode, setControlMode,
    switchActiveRoom, addRoom, deleteRoom, updateRoomName, updateRoomLayoutPosition,
    fogOfWar, setFogOfWar, fogVisibilityDistance, setFogVisibilityDistance,
    fogKeepRevealed, setFogKeepRevealed,
    // Tool
    activeTool, setActiveTool, router,
    // Saved levels
    savedLevels, levelsLoading,
    // UI
    testLevel, setTestLevel, testError,
    saveDialogOpen, setSaveDialogOpen, savePosition, setSavePosition,
    saveSuccess, copied,
    submitDialogOpen, setSubmitDialogOpen, submitNote, setSubmitNote, submitStatus, submitError,
    generatorDialogOpen, setGeneratorDialogOpen,
    optimalSolution,
    optimalSolutionMoves,
    // Admin
    parts, selectedPartId, setSelectedPartId, firestoreLevels,
    showFirestoreLevels, setShowFirestoreLevels, publishStatus, firestoreEditId, setFirestoreEditId,
    // Undo
    undo, canUndo: historyLen > 0, pushGridHistory,
    lockedCells, setLockedCells, optimalSolutionTrajectory, setOptimalSolutionTrajectory,
    selection, setSelection,
    generatedCandidates, setGeneratedCandidates,
    activeCandidateIndex, setActiveCandidateIndex,
    // Handlers
    applyResize, paintCell, generateLevelData,
    doSave, handleSaveClick,
    handleSubmitLevel, handleSaveAndSubmit,
    handleCopyBoard, handlePasteBoard,
    loadFirestoreLevel, doPublish,
    handleLoadLevel, handleNewLevel, handleTest,
    doGenerateLevel,
  };
}
