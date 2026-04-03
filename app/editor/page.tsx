'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GameShell from '@/app/src/games/components/GameShell';
import { NBtn } from './components/EditorUI';
import EditorLeftPanel from './components/EditorLeftPanel';
import EditorGrid from './components/EditorGrid';
import EditorRightPanel from './components/EditorRightPanel';
import EditorDialogs from './components/EditorDialogs';
import { useEditorState } from './useEditorState';

function EditorInner() {
  const searchParams = useSearchParams();
  const editId = searchParams.get('id') ? Number(searchParams.get('id')) : null;
  const firestoreIdParam = searchParams.get('firestoreId');

  const s = useEditorState(editId, firestoreIdParam);

  const [isMobile, setIsMobile] = useState(false);
  const [activeTab, setActiveTab] = useState<'levels' | 'grid' | 'settings'>('grid');
  const [cellSize, setCellSize] = useState(48);

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
      const availW = mob ? vw - 110 - 20 : vw - 170 - 110 - 220 - 20;
      const availH = vh - (mob ? 130 : 80);
      setCellSize(Math.max(24, Math.min(58, Math.floor(availW / s.width), Math.floor(availH / s.height))));
    }
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, [s.width, s.height]);

  const jsonString = (() => {
    const { level } = s.generateLevelData();
    return level ? JSON.stringify(level, null, 2) : '// Place both objects to generate JSON';
  })();

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#030712', color: '#e2e8f0', overflow: 'hidden' }}>

      {/* Top bar */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 20px', background: 'rgba(3,7,18,0.97)', borderBottom: '1px solid rgba(0,196,255,0.15)' }}>
        <button onClick={s.handleNewLevel} style={{ background: 'none', border: 'none', color: '#334155', fontSize: 12, cursor: 'pointer', letterSpacing: '0.06em' }}>← Menu</button>
        <h1 style={{ margin: 0, fontSize: 13, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#00c4ff', textShadow: '0 0 10px rgba(0,196,255,0.5)' }}>
          Level Editor {editId !== null ? <span style={{ color: '#1e3a5f', fontWeight: 400 }}>· editing #{editId}</span> : '· new'}
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <NBtn onClick={() => s.setPasteDialogOpen(true)} color="#94a3b8" style={{ fontSize: 11 }}>Paste JSON</NBtn>
          {!s.isAnonymous && !s.isModerator && (
            <>
              <NBtn onClick={s.handleSaveClick} color="#a78bfa" active style={{ padding: '5px 16px' }}>
                {s.saveSuccess || (editId !== null ? 'Güncelle' : 'Kaydet')}
              </NBtn>
              <NBtn onClick={s.handleSaveAndSubmit} color="#00ff88" style={{ padding: '5px 14px', fontSize: 11 }}>
                {editId !== null ? 'Güncelle ve Gönder' : 'Kaydet ve Gönder'}
              </NBtn>
            </>
          )}
          {(s.isAnonymous || s.isModerator) && (
            <NBtn onClick={s.handleSaveClick} color="#00ff88" active style={{ padding: '5px 16px' }}>
              {s.saveSuccess || (editId !== null ? 'Update' : 'Save')}
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
              {tab === 'levels' ? '☰ Levels' : tab === 'grid' ? '⊞ Grid' : '⚙ Settings'}
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
        <EditorGrid
          activeTool={s.activeTool} setActiveTool={s.setActiveTool}
          objects={s.objects} boxes={s.boxes}
          activePlacingBoxId={s.activePlacingBoxId} setActivePlacingBoxId={s.setActivePlacingBoxId}
          setBoxes={s.setBoxes} grid={s.grid} edges={s.edges} cellSize={cellSize}
          paintCell={s.paintCell} isMobile={isMobile} visible={activeTab === 'grid'}
        />
        <EditorRightPanel
          levelName={s.levelName} setLevelName={s.setLevelName}
          difficulty={s.difficulty} setDifficulty={s.setDifficulty}
          pendingW={s.pendingW} setPendingW={s.setPendingW}
          pendingH={s.pendingH} setPendingH={s.setPendingH}
          applyResize={s.applyResize} edges={s.edges} setEdges={s.setEdges}
          trailCollision={s.trailCollision} setTrailCollision={s.setTrailCollision}
          grid={s.grid} width={s.width} height={s.height}
          conveyorPowerRequired={s.conveyorPowerRequired} setConveyorPowerRequired={s.setConveyorPowerRequired}
          objects={s.objects} setObjects={s.setObjects}
          boxes={s.boxes} setBoxes={s.setBoxes}
          activePlacingBoxId={s.activePlacingBoxId} setActivePlacingBoxId={s.setActivePlacingBoxId}
          setActiveTool={s.setActiveTool}
          testError={s.testError} onTest={s.handleTest}
          copied={s.copied} onCopy={() => s.handleCopy(jsonString)}
          jsonString={jsonString} isModerator={s.isModerator}
          parts={s.parts} selectedPartId={s.selectedPartId} setSelectedPartId={s.setSelectedPartId}
          firestoreEditId={s.firestoreEditId} setFirestoreEditId={s.setFirestoreEditId}
          publishStatus={s.publishStatus} onPublish={s.doPublish}
          isMobile={isMobile} visible={activeTab === 'settings'}
        />
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
        pasteDialogOpen={s.pasteDialogOpen}
        onPasteClose={() => { s.setPasteDialogOpen(false); s.setPasteText(''); }}
        pasteText={s.pasteText} setPasteText={s.setPasteText}
        pasteError={s.pasteError} onPaste={s.handlePaste}
      />

      {s.testLevel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,5,14,0.88)', backdropFilter: 'blur(6px)', zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 700, padding: '0 16px' }}>
            <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#00ff88', textShadow: '0 0 8px rgba(0,255,136,0.5)' }}>Test Mode</span>
            <button onClick={() => s.setTestLevel(null)} style={{ fontSize: 12, padding: '6px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444', borderRadius: 7, cursor: 'pointer' }}>✕ Close</button>
          </div>
          <GameShell level={s.testLevel} />
        </div>
      )}
    </div>
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
