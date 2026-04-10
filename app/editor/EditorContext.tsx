'use client';

import { createContext, useContext } from 'react';
import type { CellType, EdgeBehavior, LevelData, Position, ConveyorCellConfig, TrampolineCellConfig } from '@/app/src/games/types';
import type { StoredLevel } from '@/app/src/lib/db';
import type { FirestoreLevel, LevelPart } from '@/app/src/lib/firebase/admin';
import type { User } from 'firebase/auth';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { ObjConfig, BoxConfig, ToolType } from './editorConfig';
import type { SelectionRect } from './useGridOperations';

export type { SelectionRect };

export interface EditorContextValue {
  // Auth
  user: User | null;
  isAnonymous: boolean;
  isModerator: boolean;
  userTag: string | null;
  // Level data
  levelName: string; setLevelName: (v: string) => void;
  width: number; setWidth: React.Dispatch<React.SetStateAction<number>>;
  height: number; setHeight: React.Dispatch<React.SetStateAction<number>>;
  pendingW: number; setPendingW: (v: number) => void;
  pendingH: number; setPendingH: (v: number) => void;
  trailCollision: boolean; setTrailCollision: (v: boolean) => void;
  difficulty: 1 | 2 | 3 | 4; setDifficulty: (d: 1 | 2 | 3 | 4) => void;
  savedRequestId: string | null;
  edges: Record<'top' | 'bottom' | 'left' | 'right', EdgeBehavior>;
  setEdges: React.Dispatch<React.SetStateAction<Record<'top' | 'bottom' | 'left' | 'right', EdgeBehavior>>>;
  grid: CellType[][];
  setGrid: React.Dispatch<React.SetStateAction<CellType[][]>>;
  objects: ObjConfig[]; setObjects: React.Dispatch<React.SetStateAction<ObjConfig[]>>;
  boxes: BoxConfig[]; setBoxes: React.Dispatch<React.SetStateAction<BoxConfig[]>>;
  activePlacingBoxId: number | null; setActivePlacingBoxId: (id: number | null) => void;
  conveyorPowerRequired: Position[]; setConveyorPowerRequired: React.Dispatch<React.SetStateAction<Position[]>>;
  conveyorConfig: ConveyorCellConfig[]; setConveyorConfig: React.Dispatch<React.SetStateAction<ConveyorCellConfig[]>>;
  trampolineConfig: TrampolineCellConfig[]; setTrampolineConfig: React.Dispatch<React.SetStateAction<TrampolineCellConfig[]>>;
  // Tool
  activeTool: ToolType; setActiveTool: (t: ToolType) => void;
  router: AppRouterInstance;
  // Grid dimensions sync (needed by useGridOperations via context)
  cellSize: number;
  // Selection
  selection: SelectionRect | null; setSelection: (s: SelectionRect | null) => void;
  // Grid operations
  addRow: (afterIndex: number) => void;
  removeRow: (index: number) => void;
  addCol: (afterIndex: number) => void;
  removeCol: (index: number) => void;
  moveSelection: (sel: SelectionRect, dr: number, dc: number) => void;
  // Saved levels
  savedLevels: (StoredLevel & { id: number })[]; levelsLoading: boolean;
  // UI state
  testLevel: LevelData | null; setTestLevel: (l: LevelData | null) => void;
  testError: string | null;
  saveDialogOpen: boolean; setSaveDialogOpen: (v: boolean) => void;
  savePosition: string; setSavePosition: (v: string) => void;
  saveSuccess: string;
  copied: boolean;
  submitDialogOpen: boolean; setSubmitDialogOpen: (v: boolean) => void;
  submitNote: string; setSubmitNote: (v: string) => void;
  submitStatus: string; submitError: string;
  // Admin / Firestore
  parts: LevelPart[]; selectedPartId: string; setSelectedPartId: (v: string) => void;
  firestoreLevels: FirestoreLevel[];
  showFirestoreLevels: boolean; setShowFirestoreLevels: React.Dispatch<React.SetStateAction<boolean>>;
  publishStatus: string; firestoreEditId: string | null; setFirestoreEditId: (v: string | null) => void;
  // Undo
  undo: () => void;
  canUndo: boolean;
  pushGridHistory: () => void;
  // Handlers
  applyResize: () => void;
  paintCell: (r: number, c: number, isDrag: boolean) => void;
  generateLevelData: () => { level: LevelData | null; error: string | null };
  doSave: (posInput?: string) => void;
  handleSaveClick: () => void;
  handleSubmitLevel: () => void;
  handleSaveAndSubmit: () => void;
  handleCopyBoard: () => void;
  handlePasteBoard: () => string | null;
  loadFirestoreLevel: (fl: FirestoreLevel) => void;
  doPublish: () => void;
  handleLoadLevel: (stored: StoredLevel & { id: number }) => void;
  handleNewLevel: () => void;
  handleTest: () => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export const EditorContextProvider = EditorContext.Provider;

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditorContext must be used inside EditorContextProvider');
  return ctx;
}
