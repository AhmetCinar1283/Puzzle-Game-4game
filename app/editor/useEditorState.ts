'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { CellType, EdgeBehavior, LevelData, Position } from '@/app/src/games/types';
import type { StoredLevel } from '@/app/src/lib/db';
import type { FirestoreLevel, LevelPart } from '@/app/src/lib/firebase/admin';
import { useAuth } from '@/app/src/hooks/useAuth';
import { useSelector } from 'react-redux';
import type { RootState } from '@/app/src/store';
import { makeGrid, resizeGrid, type ToolType, type ObjConfig, type BoxConfig } from './editorConfig';

const DEFAULT_OBJS: ObjConfig[] = [
  { id: 1, row: null, col: null, mode: 'normal', lockOnTarget: true },
  { id: 2, row: null, col: null, mode: 'normal', lockOnTarget: true },
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
  const [edges, setEdges] = useState<Record<'top' | 'bottom' | 'left' | 'right', EdgeBehavior>>({ top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' });
  const [grid, setGrid] = useState<CellType[][]>(() => makeGrid(5, 5));
  const [objects, setObjects] = useState<ObjConfig[]>(DEFAULT_OBJS);
  const [boxes, setBoxes] = useState<BoxConfig[]>([]);
  const [activePlacingBoxId, setActivePlacingBoxId] = useState<number | null>(null);
  const [conveyorPowerRequired, setConveyorPowerRequired] = useState<Position[]>([]);

  // Tool
  const [activeTool, setActiveTool] = useState<ToolType>('obstacle');
  const paintMode = useRef<'paint' | 'erase'>('paint');

  // Saved levels
  const [savedLevels, setSavedLevels] = useState<(StoredLevel & { id: number })[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);

  // UI
  const [testLevel, setTestLevel] = useState<LevelData | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [savePosition, setSavePosition] = useState('');
  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState('');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitNote, setSubmitNote] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');
  const [submitError, setSubmitError] = useState('');

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
    setWidth(stored.width); setHeight(stored.height);
    setPendingW(stored.width); setPendingH(stored.height);
    setEdges(stored.edges as typeof edges);
    setGrid(stored.grid as CellType[][]);
    setTrailCollision(!!stored.trailCollision);
    setDifficulty((stored.difficulty != undefined ? stored.difficulty : 2) as 1 | 2 | 3 | 4);
    setSavedRequestId(stored.requestId ?? null);
    const objs = [...DEFAULT_OBJS.map((o) => ({ ...o }))];
    stored.initialObjects.forEach((obj) => {
      const idx = objs.findIndex((o) => o.id === obj.id);
      if (idx >= 0) objs[idx] = { id: obj.id, row: obj.position.row, col: obj.position.col, mode: obj.mode, lockOnTarget: obj.lockOnTarget };
    });
    setObjects(objs);
    setBoxes((stored.initialBoxes ?? []).map((b) => ({ id: b.id, row: b.position.row, col: b.position.col, requiresPower: b.requiresPower ?? false })));
    setConveyorPowerRequired(stored.conveyorPowerRequired ?? []);
    setActivePlacingBoxId(null);
  }, []);

  useEffect(() => { reloadLevels(); }, [reloadLevels]);
  useEffect(() => { if (editId !== null) loadForEdit(editId); }, [editId, loadForEdit]);

  const applyResize = useCallback(() => {
    const newW = Math.max(3, Math.min(16, pendingW));
    const newH = Math.max(3, Math.min(16, pendingH));
    setWidth(newW); setHeight(newH);
    setGrid((g) => resizeGrid(g, newW, newH));
    setObjects((os) => os.map((o) => ({ ...o, row: o.row !== null && o.row < newH ? o.row : null, col: o.col !== null && o.col < newW ? o.col : null })));
    setBoxes((bs) => bs.map((b) => ({ ...b, row: b.row !== null && b.row < newH ? b.row : null, col: b.col !== null && b.col < newW ? b.col : null })));
    setConveyorPowerRequired((cpr) => cpr.filter((p) => p.row < newH && p.col < newW));
  }, [pendingW, pendingH]);

  const paintCell = useCallback((r: number, c: number, isDrag: boolean) => {
    if (activeTool === 'place_obj1') { setObjects((os) => os.map((o) => o.id === 1 ? { ...o, row: r, col: c } : o)); return; }
    if (activeTool === 'place_obj2') { setObjects((os) => os.map((o) => o.id === 2 ? { ...o, row: r, col: c } : o)); return; }
    if (activeTool === 'place_box' && activePlacingBoxId !== null) {
      setBoxes((bs) => bs.map((b) => b.id === activePlacingBoxId ? { ...b, row: r, col: c } : b));
      setActivePlacingBoxId(null); return;
    }
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
  }, [activeTool, activePlacingBoxId]);

  const generateLevelData = useCallback((): { level: LevelData | null; error: string | null } => {
    const targets: { objectId: number; position: { row: number; col: number } }[] = [];
    for (let r = 0; r < height; r++)
      for (let c = 0; c < width; c++) {
        if (grid[r][c] === 'target_1') targets.push({ objectId: 1, position: { row: r, col: c } });
        if (grid[r][c] === 'target_2') targets.push({ objectId: 2, position: { row: r, col: c } });
      }
    const validObjs = objects.filter((o) => o.row !== null && o.col !== null);
    if (validObjs.length < 2) return { level: null, error: 'Place both objects on the grid first.' };
    for (const letter of ['A', 'B', 'C'] as const) {
      const hasIn = grid.some((row) => row.includes(`teleporter_in_${letter}` as CellType));
      const hasOut = grid.some((row) => row.includes(`teleporter_out_${letter}` as CellType));
      if (hasIn && !hasOut) return { level: null, error: `Teleporter ${letter} has an entrance but no exit.` };
      if (!hasIn && hasOut) return { level: null, error: `Teleporter ${letter} has an exit but no entrance.` };
    }
    const validBoxes = boxes.filter((b) => b.row !== null && b.col !== null);
    return {
      level: {
        id: editId ?? 0, name: levelName || 'Unnamed Level', width, height, edges, grid, difficulty, creatorName,
        initialObjects: validObjs.map((o) => ({ id: o.id, position: { row: o.row!, col: o.col! }, mode: o.mode, lockOnTarget: o.lockOnTarget })),
        targets,
        ...(trailCollision ? { trailCollision: true } : {}),
        ...(validBoxes.length > 0 ? { initialBoxes: validBoxes.map((b) => ({ id: b.id, position: { row: b.row!, col: b.col! }, ...(b.requiresPower ? { requiresPower: true } : {}) })) } : {}),
        ...(conveyorPowerRequired.length > 0 ? { conveyorPowerRequired } : {}),
      },
      error: null,
    };
  }, [editId, levelName, width, height, edges, grid, objects, trailCollision, boxes, conveyorPowerRequired]);

  const buildPayload = useCallback((level: LevelData): Omit<StoredLevel, 'id' | 'createdAt' | 'updatedAt'> => ({
    name: level.name, width: level.width, height: level.height, edges: level.edges,
    grid: level.grid, initialObjects: level.initialObjects, targets: level.targets,
    trailCollision: level.trailCollision, initialBoxes: level.initialBoxes,
    conveyorPowerRequired: level.conveyorPowerRequired, difficulty,
    ...(savedRequestId ? { requestId: savedRequestId } : {}),
    position: savedLevels.length // burada en sona ekler sadece bunu düzelteceğiz fakat diğer değişkenleri de uyumlu hale getirmemiz gerekeceği için şu ertelemeyi uygun gördük
  }), [difficulty, savedRequestId]);

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

  const handlePaste = useCallback(() => {
    setPasteError('');
    try {
      const parsed = JSON.parse(pasteText) as Partial<LevelData>;
      if (!parsed.grid || !parsed.width || !parsed.height) throw new Error('Invalid format');
      setLevelName(parsed.name ?? 'Pasted Level');
      setWidth(parsed.width); setHeight(parsed.height);
      setPendingW(parsed.width); setPendingH(parsed.height);
      if (parsed.edges) setEdges(parsed.edges as typeof edges);
      setGrid(parsed.grid as CellType[][]);
      setTrailCollision(!!parsed.trailCollision);
      setBoxes((parsed.initialBoxes ?? []).map((b) => ({ id: b.id, row: b.position.row, col: b.position.col, requiresPower: b.requiresPower ?? false })));
      setConveyorPowerRequired(parsed.conveyorPowerRequired ?? []);
      setActivePlacingBoxId(null);
      const objs = [...DEFAULT_OBJS.map((o) => ({ ...o }))];
      (parsed.initialObjects ?? []).forEach((obj) => {
        const idx = objs.findIndex((o) => o.id === obj.id);
        if (idx >= 0) objs[idx] = { id: obj.id, row: obj.position.row, col: obj.position.col, mode: obj.mode, lockOnTarget: obj.lockOnTarget };
      });
      setObjects(objs);
      setPasteDialogOpen(false); setPasteText('');
    } catch {
      setPasteError('Invalid JSON. Make sure it matches LevelData format.');
    }
  }, [pasteText]);

  const loadFirestoreLevel = useCallback((fl: FirestoreLevel) => {
    setFirestoreEditId(fl.firestoreId);
    setLevelName(fl.name);
    setWidth(fl.width); setHeight(fl.height);
    setPendingW(fl.width); setPendingH(fl.height);
    setEdges(fl.edges as typeof edges);
    setGrid(typeof fl.grid == 'string' ? JSON.parse(fl.grid) : fl.grid as CellType[][]);
    setTrailCollision(!!fl.trailCollision);
    const objs = [...DEFAULT_OBJS.map((o) => ({ ...o }))];
    fl.initialObjects.forEach((obj) => {
      const idx = objs.findIndex((o) => o.id === obj.id);
      if (idx >= 0) objs[idx] = { id: obj.id, row: obj.position.row, col: obj.position.col, mode: obj.mode, lockOnTarget: obj.lockOnTarget };
    });
    setObjects(objs);
    setBoxes((fl.initialBoxes ?? []).map((b) => ({ id: b.id, row: b.position.row, col: b.position.col, requiresPower: b.requiresPower ?? false })));
    setConveyorPowerRequired(fl.conveyorPowerRequired ?? []);
    setActivePlacingBoxId(null);
  }, []);

  const doPublish = useCallback(async () => {
    if (!user || !isModerator) return;
    const { level, error } = generateLevelData();
    if (error || !level) { setTestError(error); return; }
    const payload = { ...level, part: selectedPartId,
      position: savedLevels.length, // Bu en sona ekler leveli fakat ileride ayarlanabilir olmalı
      difficulty,
     };
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
  }, [user, isModerator, generateLevelData, selectedPartId, firestoreEditId, showFirestoreLevels]);

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
    setLevelName('My Level'); setWidth(5); setHeight(5); setPendingW(5); setPendingH(5);
    setEdges({ top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' });
    setGrid(makeGrid(5, 5)); setTrailCollision(false); setDifficulty(2);
    setSavedRequestId(null); savedIdForSubmitRef.current = null;
    setObjects([...DEFAULT_OBJS.map((o) => ({ ...o }))]);
    setBoxes([]); setConveyorPowerRequired([]); setActivePlacingBoxId(null); setFirestoreEditId(null);
  }, [router]);

  const handleTest = useCallback(() => {
    const { level, error } = generateLevelData();
    if (error || !level) { setTestError(error); return; }
    setTestError(null); setTestLevel(level);
  }, [generateLevelData]);

  const handleCopy = useCallback((jsonString: string) => {
    navigator.clipboard.writeText(jsonString).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return {
    // Auth
    user, isAnonymous, isModerator, userTag,
    // Level data
    levelName, setLevelName, width, height, pendingW, setPendingW, pendingH, setPendingH,
    trailCollision, setTrailCollision, difficulty, setDifficulty,
    savedRequestId, edges, setEdges, grid, objects, setObjects,
    boxes, setBoxes, activePlacingBoxId, setActivePlacingBoxId, conveyorPowerRequired, setConveyorPowerRequired,
    // Tool
    activeTool, setActiveTool, router,
    // Saved levels
    savedLevels, levelsLoading,
    // UI
    testLevel, setTestLevel, testError,
    saveDialogOpen, setSaveDialogOpen, savePosition, setSavePosition,
    pasteDialogOpen, setPasteDialogOpen, pasteText, setPasteText, pasteError,
    copied, saveSuccess,
    submitDialogOpen, setSubmitDialogOpen, submitNote, setSubmitNote, submitStatus, submitError,
    // Admin
    parts, selectedPartId, setSelectedPartId, firestoreLevels,
    showFirestoreLevels, setShowFirestoreLevels, publishStatus, firestoreEditId, setFirestoreEditId,
    // Handlers
    applyResize, paintCell, generateLevelData,
    doSave, handleSaveClick,
    handleSubmitLevel, handleSaveAndSubmit,
    handlePaste, loadFirestoreLevel, doPublish,
    handleLoadLevel, handleNewLevel, handleTest, handleCopy,
  };
}
