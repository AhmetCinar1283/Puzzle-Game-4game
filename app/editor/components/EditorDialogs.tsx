'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import type { StoredLevel } from '@/app/src/lib/db';
import type { EdgeBehavior } from '@/app/src/games/types';
import { Modal, NBtn, iStyle, Lbl } from './EditorUI';
import { DIFFICULTY_COLORS } from '../editorConfig';
import { useT } from '@/app/src/contexts/LanguageContext';

export interface GeneratorFiltersUI {
  width: number;
  height: number;
  difficulty: 1 | 2 | 3 | 4;
  playerCount: 1 | 2;
  edgeBehavior?: 'wall' | 'portal' | 'lava' | 'random'; // legacy
  edgeTopAllowed?: EdgeBehavior[];
  edgeBottomAllowed?: EdgeBehavior[];
  edgeLeftAllowed?: EdgeBehavior[];
  edgeRightAllowed?: EdgeBehavior[];
  conveyorSteps?: 1 | 2 | 3 | 4 | 5 | 'random';
  trampolineSteps?: 1 | 2 | 3 | 4 | 5 | 'random';
  playerMode: 'normal' | 'reversed' | 'random';
  playerLock: 'lock' | 'nolock' | 'random';
  trailCollision: 'yes' | 'no' | 'random';
  obstacleDensity: number;
  iceDensity: number;
  conveyorDensity: number;
  trampolineDensity: number;
  forbiddenDensity: number;
  toggleDensity: number;
  teleporterCount: number;
}

interface EditorDialogsProps {
  // Save dialog
  saveDialogOpen: boolean;
  onSaveClose: () => void;
  savePosition: string;
  setSavePosition: (v: string) => void;
  savedLevels: (StoredLevel & { id: number })[];
  onSave: (pos?: string) => void;
  // Submit dialog
  submitDialogOpen: boolean;
  onSubmitClose: () => void;
  submitNote: string;
  setSubmitNote: (v: string) => void;
  submitError: string;
  submitStatus: string;
  savedRequestId: string | null;
  levelName: string;
  difficulty: 1 | 2 | 3 | 4;
  user: User | null;
  userTag: string | null;
  onSubmit: () => void;
  // Generator dialog
  generatorDialogOpen: boolean;
  onGeneratorClose: () => void;
  onGenerate: (filters: GeneratorFiltersUI) => void;
}

interface StoredPreset {
  name: string;
  filters: GeneratorFiltersUI;
}

// Subcomponent: GeneratorModal
function GeneratorModal({
  onClose,
  onGenerate,
}: {
  onClose: () => void;
  onGenerate: (filters: GeneratorFiltersUI) => void;
}) {
  const [width, setWidth] = useState(6);
  const [height, setHeight] = useState(6);
  const [difficulty, setDifficulty] = useState<1 | 2 | 3 | 4>(2);
  const [playerCount, setPlayerCount] = useState<1 | 2>(1);
  const [edgeTopAllowed, setEdgeTopAllowed] = useState<EdgeBehavior[]>(['wall']);
  const [edgeBottomAllowed, setEdgeBottomAllowed] = useState<EdgeBehavior[]>(['wall']);
  const [edgeLeftAllowed, setEdgeLeftAllowed] = useState<EdgeBehavior[]>(['wall']);
  const [edgeRightAllowed, setEdgeRightAllowed] = useState<EdgeBehavior[]>(['wall']);
  const [conveyorSteps, setConveyorSteps] = useState<1 | 2 | 3 | 4 | 5 | 'random'>(1);
  const [trampolineSteps, setTrampolineSteps] = useState<1 | 2 | 3 | 4 | 5 | 'random'>(3);
  const [playerMode, setPlayerMode] = useState<'normal' | 'reversed' | 'random'>('normal');
  const [playerLock, setPlayerLock] = useState<'lock' | 'nolock' | 'random'>('lock');
  const [trailCollision, setTrailCollision] = useState<'yes' | 'no' | 'random'>('no');
  const [obstacleDensity, setObstacleDensity] = useState(0.15);
  const [iceDensity, setIceDensity] = useState(0.15);
  const [conveyorDensity, setConveyorDensity] = useState(0.0);
  const [trampolineDensity, setTrampolineDensity] = useState(0.0);
  const [forbiddenDensity, setForbiddenDensity] = useState(0.0);
  const [toggleDensity, setToggleDensity] = useState(0.0);
  const [teleporterCount, setTeleporterCount] = useState(0);

  const [presets, setPresets] = useState<StoredPreset[]>([]);
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | 'default' | 'last_used'>('default');
  const [newPresetName, setNewPresetName] = useState('');
  const [generating, setGenerating] = useState(false);

  const toggleEdgeAllowed = (side: 'top' | 'bottom' | 'left' | 'right', behavior: EdgeBehavior) => {
    const setters = {
      top: [edgeTopAllowed, setEdgeTopAllowed],
      bottom: [edgeBottomAllowed, setEdgeBottomAllowed],
      left: [edgeLeftAllowed, setEdgeLeftAllowed],
      right: [edgeRightAllowed, setEdgeRightAllowed],
    } as const;
    
    const [current, set] = setters[side];
    if (current.includes(behavior)) {
      if (current.length > 1) {
        set(current.filter((x) => x !== behavior));
      }
    } else {
      set([...current, behavior]);
    }
  };

  const applyFilters = (f: GeneratorFiltersUI) => {
    if (f.width !== undefined) setWidth(f.width);
    if (f.height !== undefined) setHeight(f.height);
    if (f.difficulty !== undefined) setDifficulty(f.difficulty);
    if (f.playerCount !== undefined) setPlayerCount(f.playerCount);
    if (f.playerMode !== undefined) setPlayerMode(f.playerMode);
    if (f.playerLock !== undefined) setPlayerLock(f.playerLock);
    if (f.trailCollision !== undefined) setTrailCollision(f.trailCollision);
    if (f.obstacleDensity !== undefined) setObstacleDensity(f.obstacleDensity);
    if (f.iceDensity !== undefined) setIceDensity(f.iceDensity);
    if (f.conveyorDensity !== undefined) setConveyorDensity(f.conveyorDensity);
    if (f.trampolineDensity !== undefined) setTrampolineDensity(f.trampolineDensity);
    if (f.forbiddenDensity !== undefined) setForbiddenDensity(f.forbiddenDensity);
    if (f.toggleDensity !== undefined) setToggleDensity(f.toggleDensity);
    if (f.teleporterCount !== undefined) setTeleporterCount(f.teleporterCount);

    // Support legacy presets having legacy edgeBehavior
    if (f.edgeBehavior !== undefined) {
      const legacy = f.edgeBehavior;
      if (legacy === 'random') {
        const all: EdgeBehavior[] = ['wall', 'portal', 'lava'];
        setEdgeTopAllowed(all);
        setEdgeBottomAllowed(all);
        setEdgeLeftAllowed(all);
        setEdgeRightAllowed(all);
      } else {
        setEdgeTopAllowed([legacy as EdgeBehavior]);
        setEdgeBottomAllowed([legacy as EdgeBehavior]);
        setEdgeLeftAllowed([legacy as EdgeBehavior]);
        setEdgeRightAllowed([legacy as EdgeBehavior]);
      }
    }

    // New fields
    if (f.edgeTopAllowed !== undefined) setEdgeTopAllowed(f.edgeTopAllowed);
    if (f.edgeBottomAllowed !== undefined) setEdgeBottomAllowed(f.edgeBottomAllowed);
    if (f.edgeLeftAllowed !== undefined) setEdgeLeftAllowed(f.edgeLeftAllowed);
    if (f.edgeRightAllowed !== undefined) setEdgeRightAllowed(f.edgeRightAllowed);
    if (f.conveyorSteps !== undefined) setConveyorSteps(f.conveyorSteps);
    if (f.trampolineSteps !== undefined) setTrampolineSteps(f.trampolineSteps);
  };

  // Load presets & last-used from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedPresets = localStorage.getItem('generator_presets');
      if (storedPresets) {
        try { setPresets(JSON.parse(storedPresets)); } catch (e) { console.error(e); }
      }
      const lastUsed = localStorage.getItem('generator_last_used');
      if (lastUsed) {
        try {
          const parsed = JSON.parse(lastUsed) as GeneratorFiltersUI;
          applyFilters(parsed);
          setSelectedPresetIndex('last_used');
        } catch (e) { console.error(e); }
      }
    }
  }, []);

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    const newPreset: StoredPreset = {
      name: newPresetName.trim(),
      filters: {
        width, height, difficulty, playerCount,
        edgeTopAllowed, edgeBottomAllowed, edgeLeftAllowed, edgeRightAllowed,
        playerMode, playerLock, trailCollision,
        obstacleDensity, iceDensity, conveyorDensity, trampolineDensity,
        forbiddenDensity, toggleDensity, teleporterCount,
        conveyorSteps, trampolineSteps
      }
    };
    const updated = [...presets, newPreset];
    setPresets(updated);
    localStorage.setItem('generator_presets', JSON.stringify(updated));
    setSelectedPresetIndex(updated.length - 1);
    setNewPresetName('');
  };

  const handleDeletePreset = () => {
    if (typeof selectedPresetIndex !== 'number') return;
    const updated = presets.filter((_, idx) => idx !== selectedPresetIndex);
    setPresets(updated);
    localStorage.setItem('generator_presets', JSON.stringify(updated));
    setSelectedPresetIndex('default');
    
    // Reset to defaults
    setWidth(6); setHeight(6); setDifficulty(2); setPlayerCount(1);
    setEdgeTopAllowed(['wall']);
    setEdgeBottomAllowed(['wall']);
    setEdgeLeftAllowed(['wall']);
    setEdgeRightAllowed(['wall']);
    setPlayerMode('normal'); setPlayerLock('lock');
    setTrailCollision('no'); setObstacleDensity(0.15); setIceDensity(0.15);
    setConveyorDensity(0); setTrampolineDensity(0); setForbiddenDensity(0);
    setToggleDensity(0); setTeleporterCount(0);
    setConveyorSteps(1); setTrampolineSteps(3);
  };

  const handlePresetSelect = (val: string) => {
    if (val === 'default') {
      setSelectedPresetIndex('default');
      setWidth(6); setHeight(6); setDifficulty(2); setPlayerCount(1);
      setEdgeTopAllowed(['wall']);
      setEdgeBottomAllowed(['wall']);
      setEdgeLeftAllowed(['wall']);
      setEdgeRightAllowed(['wall']);
      setPlayerMode('normal'); setPlayerLock('lock');
      setTrailCollision('no'); setObstacleDensity(0.15); setIceDensity(0.15);
      setConveyorDensity(0); setTrampolineDensity(0); setForbiddenDensity(0);
      setToggleDensity(0); setTeleporterCount(0);
      setConveyorSteps(1); setTrampolineSteps(3);
    } else if (val === 'last_used') {
      setSelectedPresetIndex('last_used');
      const lastUsed = localStorage.getItem('generator_last_used');
      if (lastUsed) {
        try { applyFilters(JSON.parse(lastUsed)); } catch (e) { console.error(e); }
      }
    } else {
      const idx = parseInt(val, 10);
      if (!isNaN(idx) && presets[idx]) {
        setSelectedPresetIndex(idx);
        applyFilters(presets[idx].filters);
      }
    }
  };

  const handleGenerateClick = () => {
    setGenerating(true);
    const filters: GeneratorFiltersUI = {
      width, height, difficulty, playerCount,
      edgeTopAllowed, edgeBottomAllowed, edgeLeftAllowed, edgeRightAllowed,
      playerMode, playerLock, trailCollision,
      obstacleDensity, iceDensity, conveyorDensity, trampolineDensity,
      forbiddenDensity, toggleDensity, teleporterCount,
      conveyorSteps, trampolineSteps
    };
    
    // Persist as last-used in localStorage
    localStorage.setItem('generator_last_used', JSON.stringify(filters));

    setTimeout(() => {
      onGenerate(filters);
      setGenerating(false);
    }, 80);
  };

  return (
    <Modal onClose={generating ? () => {} : onClose}>
      <div style={{ width: 440, maxWidth: '90vw', boxSizing: 'border-box', position: 'relative', display: 'flex', flexDirection: 'column', maxHeight: '85dvh' }}>
        <h3 style={{ margin: '0 0 14px', flexShrink: 0, fontSize: 14, fontWeight: 800, color: '#00c4ff', textShadow: '0 0 8px rgba(0,196,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Procedural Level Generator
        </h3>

        {generating ? (
          <div style={{ height: 350, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div className="spinner" style={{
              width: 36, height: 36, border: '3px solid rgba(0,196,255,0.1)', borderTop: '3px solid #00c4ff', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
            <span style={{ fontSize: 11, color: '#00c4ff', letterSpacing: '0.06em' }}>GENERATING LEVEL...</span>
            <span style={{ fontSize: 9, color: '#475569' }}>Calibrating physics & searching solution paths</span>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}} />
          </div>
        ) : (
          <>
            {/* Scrollable contents */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 6, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
              
              {/* Presets Management section */}
              <div style={{ background: '#040914', border: '1px solid rgba(30,58,95,0.3)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#1e3a5f', textTransform: 'uppercase' }}>Presettings & Presets</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select 
                    value={selectedPresetIndex} 
                    onChange={(e) => handlePresetSelect(e.target.value)} 
                    style={{ ...iStyle, flex: 1, background: '#060d1a', border: '1px solid rgba(30,58,95,0.5)', height: 30 }}
                  >
                    <option value="default">Default Configuration</option>
                    <option value="last_used">Last Used Settings</option>
                    {presets.map((p, idx) => (
                      <option key={idx} value={idx}>{p.name}</option>
                    ))}
                  </select>
                  {typeof selectedPresetIndex === 'number' && (
                    <button 
                      onClick={handleDeletePreset} 
                      style={{ padding: '0 12px', fontSize: 11, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', color: '#ef4444', borderRadius: 6, cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    type="text" placeholder="Preset Name..."
                    value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)}
                    style={{ ...iStyle, flex: 1, height: 28 }}
                  />
                  <button
                    onClick={handleSavePreset}
                    disabled={!newPresetName.trim()}
                    style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, background: newPresetName.trim() ? 'rgba(0,196,255,0.1)' : 'rgba(255,255,255,0.02)', border: `1px solid ${newPresetName.trim() ? 'rgba(0,196,255,0.4)' : 'rgba(255,255,255,0.08)'}`, color: newPresetName.trim() ? '#00c4ff' : '#475569', borderRadius: 6, cursor: newPresetName.trim() ? 'pointer' : 'not-allowed' }}
                  >
                    Save Current
                  </button>
                </div>
              </div>

              {/* Grid Dimensions */}
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <Lbl>Width: {width}</Lbl>
                  <input type="range" min={3} max={12} value={width} onChange={(e) => setWidth(Number(e.target.value))} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <Lbl>Height: {height}</Lbl>
                  <input type="range" min={3} max={12} value={height} onChange={(e) => setHeight(Number(e.target.value))} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>
              </div>

              {/* Player Count & Difficulty */}
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <Lbl>Players</Lbl>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {([1, 2] as const).map((n) => (
                      <NBtn key={n} onClick={() => setPlayerCount(n)} active={playerCount === n} color="#00c4ff" style={{ flex: 1, padding: '5px 2px', fontSize: 10 }}>
                        {n === 1 ? '1 Player' : '2 Players'}
                      </NBtn>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <Lbl>Difficulty</Lbl>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {([1, 2, 3, 4] as const).map((d) => {
                      const colors = { 1: '#00ff88', 2: '#00c4ff', 3: '#fbbf24', 4: '#ef4444' };
                      const labels = { 1: 'Easy', 2: 'Med', 3: 'Hard', 4: 'Exp' };
                      return (
                        <NBtn key={d} onClick={() => setDifficulty(d)} active={difficulty === d} color={colors[d]} style={{ flex: 1, padding: '5px 1px', fontSize: 9 }}>
                          {labels[d]}
                        </NBtn>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Granular Edge Behaviors */}
              <div style={{ background: '#040914', border: '1px solid rgba(30,58,95,0.3)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#00c4ff', textTransform: 'uppercase' }}>Granular Edge Behaviors</span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  
                  {/* Top Edge */}
                  <div>
                    <Lbl style={{ margin: '0 0 3px', fontSize: 8 }}>Top Edge</Lbl>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {(['wall', 'portal', 'lava'] as const).map((b) => (
                        <NBtn
                          key={b}
                          onClick={() => toggleEdgeAllowed('top', b)}
                          active={edgeTopAllowed.includes(b)}
                          color={b === 'wall' ? '#00c4ff' : b === 'portal' ? '#a78bfa' : '#ef4444'}
                          style={{ flex: 1, padding: '4px 0', fontSize: 8 }}
                        >
                          {b === 'wall' ? 'Wall' : b === 'portal' ? 'Port' : 'Lava'}
                        </NBtn>
                      ))}
                    </div>
                  </div>

                  {/* Right Edge */}
                  <div>
                    <Lbl style={{ margin: '0 0 3px', fontSize: 8 }}>Right Edge</Lbl>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {(['wall', 'portal', 'lava'] as const).map((b) => (
                        <NBtn
                          key={b}
                          onClick={() => toggleEdgeAllowed('right', b)}
                          active={edgeRightAllowed.includes(b)}
                          color={b === 'wall' ? '#00c4ff' : b === 'portal' ? '#a78bfa' : '#ef4444'}
                          style={{ flex: 1, padding: '4px 0', fontSize: 8 }}
                        >
                          {b === 'wall' ? 'Wall' : b === 'portal' ? 'Port' : 'Lava'}
                        </NBtn>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Edge */}
                  <div>
                    <Lbl style={{ margin: '0 0 3px', fontSize: 8 }}>Bottom Edge</Lbl>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {(['wall', 'portal', 'lava'] as const).map((b) => (
                        <NBtn
                          key={b}
                          onClick={() => toggleEdgeAllowed('bottom', b)}
                          active={edgeBottomAllowed.includes(b)}
                          color={b === 'wall' ? '#00c4ff' : b === 'portal' ? '#a78bfa' : '#ef4444'}
                          style={{ flex: 1, padding: '4px 0', fontSize: 8 }}
                        >
                          {b === 'wall' ? 'Wall' : b === 'portal' ? 'Port' : 'Lava'}
                        </NBtn>
                      ))}
                    </div>
                  </div>

                  {/* Left Edge */}
                  <div>
                    <Lbl style={{ margin: '0 0 3px', fontSize: 8 }}>Left Edge</Lbl>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {(['wall', 'portal', 'lava'] as const).map((b) => (
                        <NBtn
                          key={b}
                          onClick={() => toggleEdgeAllowed('left', b)}
                          active={edgeLeftAllowed.includes(b)}
                          color={b === 'wall' ? '#00c4ff' : b === 'portal' ? '#a78bfa' : '#ef4444'}
                          style={{ flex: 1, padding: '4px 0', fontSize: 8 }}
                        >
                          {b === 'wall' ? 'Wall' : b === 'portal' ? 'Port' : 'Lava'}
                        </NBtn>
                      ))}
                    </div>
                  </div>

                </div>
              </div>

              {/* Conveyor & Trampoline Custom Steps Settings */}
              <div style={{ background: '#040914', border: '1px solid rgba(30,58,95,0.3)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#00c4ff', textTransform: 'uppercase' }}>Conveyor & Trampoline Steps</span>
                
                <div style={{ display: 'flex', gap: 14 }}>
                  {/* Conveyor Steps Selection */}
                  <div style={{ flex: 1 }}>
                    <Lbl style={{ marginBottom: 4 }}>Conveyor Steps</Lbl>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {([1, 2, 3, 4, 5, 'random'] as const).map((s) => (
                        <NBtn
                          key={s}
                          onClick={() => setConveyorSteps(s)}
                          active={conveyorSteps === s}
                          color="#00c4ff"
                          style={{ flex: 1, padding: '4px 0', fontSize: 8 }}
                        >
                          {s === 'random' ? 'Rand' : s}
                        </NBtn>
                      ))}
                    </div>
                  </div>

                  {/* Trampoline Steps Selection */}
                  <div style={{ flex: 1 }}>
                    <Lbl style={{ marginBottom: 4 }}>Trampoline Steps</Lbl>
                    <div style={{ display: 'flex', gap: 2 }}>
                      {([1, 2, 3, 4, 5, 'random'] as const).map((s) => (
                        <NBtn
                          key={s}
                          onClick={() => setTrampolineSteps(s)}
                          active={trampolineSteps === s}
                          color="#00c4ff"
                          style={{ flex: 1, padding: '4px 0', fontSize: 8 }}
                        >
                          {s === 'random' ? 'Rand' : s}
                        </NBtn>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Trail Collision Row */}
              <div>
                <Lbl>Trail Collision</Lbl>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['yes', 'no', 'random'] as const).map((tc) => (
                    <NBtn key={tc} onClick={() => setTrailCollision(tc)} active={trailCollision === tc} color="#00c4ff" style={{ flex: 1, padding: '4px 2px', fontSize: 9, textTransform: 'capitalize' }}>
                      {tc}
                    </NBtn>
                  ))}
                </div>
              </div>

              {/* Player Behaviors */}
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ flex: 1 }}>
                  <Lbl>Player Move Direction</Lbl>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {(['normal', 'reversed', 'random'] as const).map((mode) => (
                      <NBtn key={mode} onClick={() => setPlayerMode(mode)} active={playerMode === mode} color="#00c4ff" style={{ flex: 1, padding: '4px 1px', fontSize: 8, textTransform: 'uppercase' }}>
                        {mode === 'reversed' ? 'Rev' : mode}
                      </NBtn>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <Lbl>Lock Target On Reach</Lbl>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {(['lock', 'nolock', 'random'] as const).map((lock) => (
                      <NBtn key={lock} onClick={() => setPlayerLock(lock)} active={playerLock === lock} color="#00c4ff" style={{ flex: 1, padding: '4px 1px', fontSize: 8, textTransform: 'uppercase' }}>
                        {lock === 'nolock' ? 'NoLock' : lock}
                      </NBtn>
                    ))}
                  </div>
                </div>
              </div>

              {/* Granular Sliders for Densities */}
              <div style={{ background: '#040914', border: '1px solid rgba(30,58,95,0.3)', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: '#1e3a5f', textTransform: 'uppercase' }}>Special Element Densities & Ratios</span>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                    <span>Obstacles Ratio</span>
                    <span>{Math.round(obstacleDensity * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={50} step={5} value={obstacleDensity * 100} onChange={(e) => setObstacleDensity(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                    <span>Ice cells Ratio</span>
                    <span>{Math.round(iceDensity * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={50} step={5} value={iceDensity * 100} onChange={(e) => setIceDensity(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                    <span>Conveyors Ratio</span>
                    <span>{Math.round(conveyorDensity * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={30} step={5} value={conveyorDensity * 100} onChange={(e) => setConveyorDensity(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                    <span>Trampolines Ratio</span>
                    <span>{Math.round(trampolineDensity * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={20} step={5} value={trampolineDensity * 100} onChange={(e) => setTrampolineDensity(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                    <span>Forbidden tiles Ratio</span>
                    <span>{Math.round(forbiddenDensity * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={30} step={5} value={forbiddenDensity * 100} onChange={(e) => setForbiddenDensity(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                    <span>Direction Toggles Ratio</span>
                    <span>{Math.round(toggleDensity * 100)}%</span>
                  </div>
                  <input type="range" min={0} max={20} step={5} value={toggleDensity * 100} onChange={(e) => setToggleDensity(Number(e.target.value) / 100)} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 2 }}>
                    <span>Teleporter pairs (A, B, C)</span>
                    <span>{teleporterCount} Pairs</span>
                  </div>
                  <input type="range" min={0} max={3} step={1} value={teleporterCount} onChange={(e) => setTeleporterCount(Number(e.target.value))} style={{ width: '100%', accentColor: '#00c4ff' }} />
                </div>
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div style={{ flexShrink: 0, display: 'flex', gap: 8, borderTop: '1px solid rgba(30,58,95,0.3)', paddingTop: 10 }}>
              <NBtn onClick={handleGenerateClick} color="#00c4ff" active style={{ flex: 2, padding: '8px 20px', fontSize: 12, fontWeight: 700 }}>
                ⚡ GENERATE LEVEL
              </NBtn>
              <NBtn onClick={onClose} style={{ flex: 1, padding: '8px 16px', fontSize: 12 }}>
                CANCEL
              </NBtn>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function EditorDialogs({
  saveDialogOpen, onSaveClose, savePosition, setSavePosition, savedLevels, onSave,
  submitDialogOpen, onSubmitClose, submitNote, setSubmitNote,
  submitError, submitStatus, savedRequestId, levelName, difficulty, user, userTag, onSubmit,
  generatorDialogOpen, onGeneratorClose, onGenerate,
}: EditorDialogsProps) {
  const t = useT();
  return (
    <>
      {saveDialogOpen && (
        <Modal onClose={onSaveClose}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#00ff88', textShadow: '0 0 8px rgba(0,255,136,0.5)', letterSpacing: '0.06em' }}>{t('editor.dialog_save_title')}</h3>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px' }}>{t('editor.dialog_save_instruction')}</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <input
              type="number" min={1} placeholder={t('editor.dialog_save_last', { n: savedLevels.length + 1 })}
              value={savePosition} onChange={(e) => setSavePosition(e.target.value)}
              style={{ ...iStyle, width: 90 }}
              autoFocus
            />
            <span style={{ fontSize: 11, color: '#334155' }}>{t('editor.dialog_save_of', { n: savedLevels.length + 1 })}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <NBtn onClick={() => onSave(savePosition)} color="#00ff88" style={{ padding: '7px 20px', fontSize: 12 }}>{t('editor.dialog_save_btn')}</NBtn>
            <NBtn onClick={onSaveClose} style={{ padding: '7px 16px', fontSize: 12 }}>{t('common.cancel')}</NBtn>
          </div>
        </Modal>
      )}

      {submitDialogOpen && (
        <Modal onClose={onSubmitClose}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#a78bfa', letterSpacing: '0.06em', textShadow: '0 0 8px rgba(167,139,250,0.5)' }}>
            {savedRequestId ? t('editor.dialog_submit_update') : t('editor.dialog_submit_new')}
          </h3>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 4 }}>{t('editor.dialog_level_name')}</span>
            <span style={{ fontSize: 13, color: '#94a3b8' }}>{levelName || t('editor.dialog_unnamed')}</span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 4 }}>{t('editor.dialog_creator')}</span>
            <span style={{ fontSize: 13, color: '#a78bfa' }}>
              {userTag ?? user?.displayName ?? user?.email ?? 'Unknown'}
            </span>
          </div>
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 4 }}>{t('editor.dialog_difficulty')}</span>
            <span style={{ fontSize: 13, color: DIFFICULTY_COLORS[difficulty], fontWeight: 700 }}>
              {t(`difficulty.${difficulty}`)}
            </span>
          </div>
          <div style={{ marginBottom: 14 }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 4 }}>{t('editor.dialog_note')}</span>
            <textarea
              value={submitNote} onChange={(e) => setSubmitNote(e.target.value)}
              placeholder={t('editor.dialog_note_placeholder')}
              style={{ width: 320, height: 60, background: '#060d1a', border: '1px solid rgba(30,58,95,0.5)', color: '#94a3b8', fontFamily: 'inherit', fontSize: 12, borderRadius: 6, padding: 8, outline: 'none', resize: 'none', boxSizing: 'border-box' }}
            />
          </div>
          {submitError && <p style={{ fontSize: 11, color: '#ef4444', marginBottom: 8 }}>{submitError}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <NBtn onClick={onSubmit} color="#a78bfa" active style={{ padding: '7px 20px', fontSize: 12 }}>
              {submitStatus || (savedRequestId ? t('editor.dialog_update_btn') : t('editor.dialog_submit_btn'))}
            </NBtn>
            <NBtn onClick={onSubmitClose} style={{ padding: '7px 16px', fontSize: 12 }}>{t('common.cancel')}</NBtn>
          </div>
          <p style={{ fontSize: 10, color: '#1e3a5f', margin: '10px 0 0', lineHeight: 1.5 }}>
            {savedRequestId ? t('editor.dialog_request_update_note') : t('editor.dialog_submit_note')}
          </p>
        </Modal>
      )}
      {generatorDialogOpen && (
        <GeneratorModal onClose={onGeneratorClose} onGenerate={onGenerate} />
      )}
    </>
  );
}
