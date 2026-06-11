'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlayScreen } from '@/app/src/game2/components/PlayScreen';
import { convertToGame2State } from '@/app/src/game2/logic/converter';
import { NBtn } from './components/EditorUI';
import EditorLeftPanel from './components/EditorLeftPanel';
import ToolPalette from './components/ToolPalette';
import EditorCanvas from './components/EditorCanvas';
import BottomSettingsPanel from './components/BottomSettingsPanel';
import EditorRightPanel from './components/EditorRightPanel';
import EditorDialogs from './components/EditorDialogs';
import { useEditorState } from './useEditorState';
import { useGridOperations } from './useGridOperations';
import { EditorContextProvider } from './EditorContext';
import type { EditorContextValue } from './EditorContext';
import type { SelectionRect } from './useGridOperations';
import { useT } from '@/app/src/contexts/LanguageContext';

function EditorInner() {
  const t = useT();
  const searchParams = useSearchParams();
  const editId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
  const firestoreIdParam = searchParams.get('firestoreId');

  const s = useEditorState(editId, firestoreIdParam);

  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'levels' | 'grid' | 'settings'>('grid');
  const [cellSize, setCellSize] = useState(44);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 900); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    function compute() {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mob = vw < 900;
      // Subtract: left panel, right panel, row/col controls (34px), edge strips (20px), padding (20px)
      const availW = mob ? vw - 76 : vw - 170 - 220 - 80;
      // Subtract: top bar, tab bar (mob), tool palette, bottom panel, col controls, edge, padding
      const availH = vh - (mob ? 130 : 44) - 52 - 40 - 22 - 28;
      setCellSize(Math.max(24, Math.min(56, Math.floor(availW / s.width), Math.floor(availH / s.height))));
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [s.width, s.height]);

  const gridOps = useGridOperations({
    grid: s.grid, setGrid: s.setGrid,
    width: s.width, setWidth: s.setWidth,
    height: s.height, setHeight: s.setHeight,
    objects: s.objects, setObjects: s.setObjects,
    boxes: s.boxes, setBoxes: s.setBoxes,
    conveyorPowerRequired: s.conveyorPowerRequired, setConveyorPowerRequired: s.setConveyorPowerRequired,
    conveyorConfig: s.conveyorConfig, setConveyorConfig: s.setConveyorConfig,
    trampolineConfig: s.trampolineConfig, setTrampolineConfig: s.setTrampolineConfig,
    pushGridHistory: s.pushGridHistory,
    activeRoomId: s.activeRoomId,
  });

  // Ctrl+Z undo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        s.undo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [s.undo]);

  const ctxValue: EditorContextValue = {
    ...s,
    cellSize,
    ...gridOps,
  };

  return (
    <EditorContextProvider value={ctxValue}>
      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#030712', color: '#e2e8f0', overflow: 'hidden' }}>

        {/* Top bar */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', background: 'rgba(3,7,18,0.97)', borderBottom: '1px solid rgba(0,196,255,0.15)' }}>
          <button onClick={() => s.router.push('/')} style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', letterSpacing: '0.06em' }}>{t('common.back_menu')}</button>
          <h1 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00c4ff', textShadow: '0 0 10px rgba(0,196,255,0.5)' }}>
            {t('editor.title')} {editId !== null ? <span style={{ color: '#1e3a5f', fontWeight: 400 }}>{t('editor.editing', { id: editId })}</span> : t('editor.new')}
          </h1>
          <div style={{ display: 'flex', gap: 8 }}>
            {!s.isAnonymous && !s.isModerator && (
              <>
                <NBtn onClick={s.handleSaveClick} color="#a78bfa" active style={{ padding: '5px 16px' }}>
                  {s.saveSuccess || (editId !== null ? t('editor.update') : t('editor.save'))}
                </NBtn>
                <NBtn onClick={s.handleSaveAndSubmit} color="#00ff88" style={{ padding: '5px 14px', fontSize: 11 }}>
                  {editId !== null ? t('editor.update_submit') : t('editor.save_submit')}
                </NBtn>
              </>
            )}
            {(s.isAnonymous || s.isModerator) && (
              <NBtn onClick={s.handleSaveClick} color="#00ff88" active style={{ padding: '5px 16px' }}>
                {s.saveSuccess || (editId !== null ? t('editor.update') : t('editor.save'))}
              </NBtn>
            )}
          </div>
        </div>

        {/* Mobile tab bar */}
        {isMobile && (
          <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid rgba(30,58,95,0.4)', background: 'rgba(3,7,18,0.97)' }}>
            {(['levels', 'grid', 'settings'] as const).map((tab) => (
              <button
                key={tab} onClick={() => setActiveTab(tab)}
                style={{ flex: 1, padding: '8px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab ? '#00c4ff' : 'transparent'}`, color: activeTab === tab ? '#00c4ff' : '#334155', cursor: 'pointer', transition: 'all 0.15s' }}
              >
                {tab === 'levels' ? t('editor.tab_levels') : tab === 'grid' ? t('editor.tab_grid') : t('editor.tab_settings')}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <EditorLeftPanel
            editId={editId} levelsLoading={s.levelsLoading} savedLevels={s.savedLevels}
            isModerator={s.isModerator} showFirestoreLevels={s.showFirestoreLevels}
            setShowFirestoreLevels={s.setShowFirestoreLevels} firestoreLevels={s.firestoreLevels}
            firestoreEditId={s.firestoreEditId} selectedPartId={s.selectedPartId}
            onLoadLevel={s.handleLoadLevel} onNewLevel={s.handleNewLevel}
            onLoadFirestoreLevel={s.loadFirestoreLevel}
            isMobile={isMobile} visible={activeTab === 'levels'}
          />

          {/* Center column: palette + grid + bottom panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
            <ToolPalette isMobile={isMobile} />
            <EditorCanvas isMobile={isMobile} visible={activeTab === 'grid'} />
            <BottomSettingsPanel isMobile={isMobile} visible={activeTab === 'grid'} />
          </div>

          <EditorRightPanel isMobile={isMobile} visible={activeTab === 'settings'} />
        </div>

        <EditorDialogs
          saveDialogOpen={s.saveDialogOpen}
          onSaveClose={() => s.setSaveDialogOpen(false)}
          savePosition={s.savePosition} setSavePosition={s.setSavePosition}
          savedLevels={s.savedLevels} onSave={s.doSave}
          submitDialogOpen={s.submitDialogOpen}
          onSubmitClose={() => { s.setSubmitDialogOpen(false); s.setSubmitNote(''); }}
          submitNote={s.submitNote} setSubmitNote={s.setSubmitNote}
          submitError={s.submitError} submitStatus={s.submitStatus}
          savedRequestId={s.savedRequestId} levelName={s.levelName}
          difficulty={s.difficulty} user={s.user} userTag={s.userTag}
          onSubmit={s.handleSubmitLevel}
          generatorDialogOpen={s.generatorDialogOpen}
          onGeneratorClose={() => s.setGeneratorDialogOpen(false)}
          onGenerate={s.doGenerateLevel}
        />

        {s.testLevel && (
          <div style={{ position: 'fixed', inset: 0, background: '#030712', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', background: 'rgba(3,7,18,0.97)', borderBottom: '1px solid rgba(0,196,255,0.15)' }}>
              <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#00ff88', textShadow: '0 0 8px rgba(0,255,136,0.5)', fontWeight: 700 }}>Test Mode (Game2 Physics)</span>
              <button onClick={() => s.setTestLevel(null)} style={{ fontSize: 12, padding: '6px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: 7, cursor: 'pointer', fontWeight: 600 }}>✕ Close Test</button>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <PlayScreen
                key={s.testLevel.id}
                levelName={s.testLevel.name}
                initialEntities={convertToGame2State(s.testLevel as any).entities}
                initialRooms={convertToGame2State(s.testLevel as any).rooms}
                controlMode={convertToGame2State(s.testLevel as any).controlMode}
                initialControlledRooms={convertToGame2State(s.testLevel as any).initialControlledRooms}
                levelEdges={s.testLevel.edges as any}
                trailCollision={!!s.testLevel.trailCollision}
                onMoveExecuted={() => {}}
                isTestMode={true}
                onButtonPressed={(btn) => {
                  if (btn === 'menu' || btn === 'next_level') {
                    s.setTestLevel(null);
                  } else if (btn === 'restart') {
                    const temp = s.testLevel;
                    s.setTestLevel(null);
                    setTimeout(() => s.setTestLevel(temp), 50);
                  }
                }}
              />
            </div>
          </div>
        )}
      </div>
    </EditorContextProvider>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={
      <div style={{ height: '100dvh', background: '#030712', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em' }}>LOADING...</span>
      </div>
    }>
      <EditorInner />
    </Suspense>
  );
}
