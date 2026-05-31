'use client';

import { useEffect, useState, useCallback, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { localClear, type StoredLevel, type StoredPlayedLevel } from '@/app/src/lib/db';
import { useAuth } from '@/app/src/hooks/useAuth';
import { SectionHeader, LevelTable } from './components/LevelTable';
import { LevelRow } from './components/LevelRow';
import { useT } from '@/app/src/contexts/LanguageContext';
import { useAppSelector } from '@/app/src/store/hooks';
import { selectUser } from '@/app/src/store/userSlice';
import type { LevelPart } from '@/app/src/lib/firebase/adminTypes';
import { motion, AnimatePresence } from 'framer-motion';

type LevelEntry = StoredLevel & { id: number };

const SELECTED_PART_STORAGE_KEY = 'levelsPage:selectedPartId';

function LevelsPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isModerator } = useAuth();
  const { totalScore } = useAppSelector(selectUser);
  const [presets, setPresets] = useState<LevelEntry[]>([]);
  const [userLevels, setUserLevels] = useState<LevelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<LevelEntry | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [parts, setParts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [playedMap, setPlayedMap] = useState<Map<string, StoredPlayedLevel>>(new Map());
  const [partsMap, setPartsMap] = useState<Map<string, LevelPart>>(new Map());
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'campaign' | 'custom'>('campaign');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isWarping, setIsWarping] = useState(false);
  const [victoryModal, setVictoryModal] = useState(false);

  // Drag scroll panning
  const mapRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const handlePanDown = (e: React.MouseEvent) => {
    if (
      e.button !== 0 ||
      (e.target as HTMLElement).closest('.map-node-btn') ||
      (e.target as HTMLElement).closest('.portal-btn')
    )
      return;
    setIsPanning(true);
    setStartX(e.pageX - (mapRef.current?.offsetLeft || 0));
    setStartY(e.pageY - (mapRef.current?.offsetTop || 0));
    setScrollLeft(mapRef.current?.scrollLeft || 0);
    setScrollTop(mapRef.current?.scrollTop || 0);
  };

  const handlePanMove = (e: React.MouseEvent) => {
    if (!isPanning || !mapRef.current) return;
    e.preventDefault();
    const x = e.pageX - mapRef.current.offsetLeft;
    const y = e.pageY - mapRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    mapRef.current.scrollLeft = scrollLeft - walkX;
    mapRef.current.scrollTop = scrollTop - walkY;
  };

  const handlePanUpOrLeave = () => {
    setIsPanning(false);
  };

  // ── Geri tuşu (popstate) ─────────────────────────────
  useEffect(() => {
    window.history.pushState({ levels: true }, '');
    function handlePopState() {
      router.replace('/');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 600);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const reload = useCallback(async () => {
    const { getOrderedLevels, getPresetLevels, getDB } = await import('@/app/src/lib/db');
    const [presetData, userData] = await Promise.all([getPresetLevels(), getOrderedLevels()]);
    setPresets(presetData as LevelEntry[]);
    setUserLevels(userData as LevelEntry[]);

    const db = getDB();
    const playedData = await db.playedLevels.toArray();
    setPlayedMap(new Map(playedData.map((p) => [p.levelId, p])));

    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Load part names and full part data from Firestore (for lock computation)
  useEffect(() => {
    // On mount: read stored partId from URL or localStorage
    const fromUrl = searchParams.get('part');
    const fromStorage = localStorage.getItem(SELECTED_PART_STORAGE_KEY);
    const initialPart = fromUrl || fromStorage || '';
    if (initialPart) setSelectedPartId(initialPart);

    import('@/app/src/lib/firebase/adminParts').then(({ getAllParts }) => {
      getAllParts()
        .then((fetchedParts) => {
          const mapped = fetchedParts.map((p) => ({ id: p.partId, name: p.name }));
          setParts(mapped);
          setSelectedPartId((prev) => {
            // Keep existing selection if valid, otherwise fall back to first
            if (prev && mapped.some((p) => p.id === prev)) return prev;
            return mapped[0]?.id ?? '';
          });
          const m = new Map<string, LevelPart>();
          fetchedParts.forEach((p) => m.set(p.partId, p));
          setPartsMap(m);
        })
        .catch((err) => console.warn('[Parts]', err));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist selectedPartId to localStorage + URL whenever it changes
  useEffect(() => {
    if (!selectedPartId) return;
    localStorage.setItem(SELECTED_PART_STORAGE_KEY, selectedPartId);
    const url = new URL(window.location.href);
    if (url.searchParams.get('part') !== selectedPartId) {
      url.searchParams.set('part', selectedPartId);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, [selectedPartId]);

  useEffect(() => {
    import('@/app/src/lib/firebase/sync').then(({ syncLevelsMeta }) => {
      syncLevelsMeta()
        .then(() => reload())
        .catch((err) => console.warn('[Sync] Meta sync failed:', err));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback(async () => {
    if (!user?.uid) return null;
    setSyncing(true);
    try {
      const { syncLevelsMeta, syncPlayedLevels } = await import('@/app/src/lib/firebase/sync');
      await syncLevelsMeta(true);
      await syncPlayedLevels(user.uid, true);
    } catch (err) {
      console.warn('[Sync] Refresh failed:', err);
    }
    await reload();
    setSyncing(false);
  }, [reload, user]);

  const move = useCallback(
    async (index: number, dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= userLevels.length) return;
      const next = [...userLevels];
      [next[index], next[target]] = [next[target], next[index]];
      setUserLevels(next);
      const { reorderLevels } = await import('@/app/src/lib/db');
      await reorderLevels(next.map((l) => l.id));
    },
    [userLevels],
  );

  const handleDelete = useCallback(
    async (id: number) => {
      if (!confirm('Delete this level? This cannot be undone.')) return;
      const { deleteStoredLevel } = await import('@/app/src/lib/db');
      await deleteStoredLevel(id);
      await reload();
    },
    [reload],
  );

  const handleDeletePreset = useCallback((lv: LevelEntry) => {
    setDeleteConfirm(lv);
  }, []);

  const confirmDeletePreset = useCallback(async () => {
    if (!deleteConfirm?.firestoreId) return;
    setDeleting(true);
    try {
      const { deleteFirestoreLevel, getAllParts } = await import('@/app/src/lib/firebase/admin');
      const allParts = await getAllParts();
      const part = allParts.find((p) =>
        Object.values(p.order).some((e) => (typeof e === 'string' ? e : e.id) === deleteConfirm.firestoreId),
      );
      if (!part) {
        await deleteFirestoreLevel(deleteConfirm.firestoreId, '');
      } else {
        await deleteFirestoreLevel(deleteConfirm.firestoreId, part.partId);
      }
      const { getDB } = await import('@/app/src/lib/db');
      const db = getDB();
      await db.presetLevels.delete(deleteConfirm.id);
      await reload();
    } catch (err) {
      console.error('[DeletePreset]', err);
    }
    setDeleting(false);
    setDeleteConfirm(null);
  }, [deleteConfirm, reload]);

  // Filter presets to selected part
  const filteredPresets = selectedPartId
    ? presets.filter((lv) => String(lv.part) === selectedPartId)
    : presets;

  // Compute which levels are locked based on progression + totalScore
  const lockedSet = useMemo((): Set<string> => {
    if (isModerator) return new Set(); // admins/mods see everything unlocked
    const locked = new Set<string>();
    if (!selectedPartId) return locked;

    const part = partsMap.get(selectedPartId);
    if (!part) return locked;

    const sorted = Object.values(part.order).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    for (let i = 0; i < sorted.length; i++) {
      const fid = typeof sorted[i] === 'string' ? (sorted[i] as unknown as string) : sorted[i].id;
      if (i === 0) {
        if (totalScore < (part.unlockRequirement ?? 0)) locked.add(fid);
      } else {
        const prevEntry = sorted[i - 1];
        const prevFid = typeof prevEntry === 'string' ? (prevEntry as unknown as string) : prevEntry.id;
        if (!playedMap.has(prevFid)) locked.add(fid);
      }
    }
    return locked;
  }, [selectedPartId, partsMap, playedMap, totalScore, isModerator]);

  // Organic B-Spline smooth winding path calculation
  const svgPathData = useMemo(() => {
    if (!selectedPartId) return '';
    const activePart = partsMap.get(selectedPartId);
    if (!activePart) return '';

    const points: Array<{ x: number; y: number }> = [];
    const currentIdx = parts.findIndex((p) => p.id === selectedPartId);

    // 1. Entry Portal (if previous session exists)
    if (currentIdx > 0) {
      const portalStartX = activePart.portalStartX !== undefined ? activePart.portalStartX : 50;
      const portalStartY = activePart.portalStartY !== undefined ? activePart.portalStartY : 90;
      points.push({ x: portalStartX, y: portalStartY });
    }

    // 2. Level Nodes
    filteredPresets.forEach((lv, idx) => {
      const entry = lv.firestoreId ? activePart.order[lv.firestoreId] : undefined;
      let x = entry?.mapX;
      let y = entry?.mapY;

      if (x === undefined || y === undefined) {
        const count = filteredPresets.length;
        const ratio = count > 1 ? idx / (count - 1) : 0.5;
        y = Math.round(85 - ratio * 70);
        x = Math.round(50 + Math.sin(ratio * Math.PI * 3.5) * 35);
      }
      points.push({ x, y });
    });

    // 3. Exit Portal
    const portalX = activePart.portalX !== undefined ? activePart.portalX : 50;
    const portalY = activePart.portalY !== undefined ? activePart.portalY : 10;
    points.push({ x: portalX, y: portalY });

    if (points.length < 2) return '';

    let path = `M ${points[0].x}% ${points[0].y}%`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2;
      path += ` Q ${p0.x}% ${p0.y}%, ${mx}% ${my}%`;
    }
    path += ` L ${points[points.length - 1].x}% ${points[points.length - 1].y}%`;
    return path;
  }, [parts, selectedPartId, partsMap, filteredPresets]);

  // Viewport Auto-Centering for Active Level
  const centerActiveNode = useCallback(() => {
    if (!mapRef.current || !selectedPartId) return;
    const activePart = partsMap.get(selectedPartId);
    if (!activePart) return;

    // Find first unlocked level that is not completed
    let activeLv = filteredPresets.find((lv) => {
      const isCompleted = lv.firestoreId ? playedMap.has(lv.firestoreId) : false;
      const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
      return !isLocked && !isCompleted;
    });

    // Fallback to first level if none found or all completed
    if (!activeLv && filteredPresets.length > 0) {
      activeLv = filteredPresets[0];
    }

    if (!activeLv) return;

    const entry = activePart.order[activeLv.firestoreId!];
    let x = entry?.mapX;
    let y = entry?.mapY;

    if (x === undefined || y === undefined) {
      const idx = filteredPresets.findIndex((l) => l.id === activeLv!.id);
      const count = filteredPresets.length;
      const ratio = count > 1 ? idx / (count - 1) : 0.5;
      y = Math.round(85 - ratio * 70);
      x = Math.round(50 + Math.sin(ratio * Math.PI * 3.5) * 35);
    }

    const container = mapRef.current;
    const scrollWidth = container.scrollWidth;
    const scrollHeight = container.scrollHeight;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;

    const pixelX = (x / 100) * scrollWidth;
    const pixelY = (y / 100) * scrollHeight;

    container.scrollTo({
      left: pixelX - clientWidth / 2,
      top: pixelY - clientHeight / 2,
      behavior: 'smooth',
    });
  }, [selectedPartId, partsMap, filteredPresets, lockedSet, playedMap]);

  useEffect(() => {
    if (!loading && activeTab === 'campaign' && viewMode === 'map' && filteredPresets.length > 0) {
      const timer = setTimeout(() => {
        centerActiveNode();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [loading, activeTab, viewMode, selectedPartId, filteredPresets, centerActiveNode]);

  return (
    <div 
      style={{ 
        height: '100dvh', 
        width: '100vw',
        position: 'relative', 
        overflow: 'hidden',
        color: '#e2e8f0', 
        display: 'flex', 
        flexDirection: 'column',
        ...(() => {
          const activePart = partsMap.get(selectedPartId);
          const mapTheme = activePart?.mapTheme || 'cyber-grid';
          switch (mapTheme) {
            case 'star-nebula':
              return {
                background: 'radial-gradient(circle at 50% 50%, #0c1530 0%, #020617 100%)',
                boxShadow: 'inset 0 0 100px rgba(99, 102, 241, 0.15)'
              };
            case 'cosmic-vortex':
              return {
                background: 'radial-gradient(circle at 50% 50%, #200c3b 0%, #06020f 100%)',
                boxShadow: 'inset 0 0 100px rgba(168, 85, 247, 0.15)'
              };
            case 'retro-matrix':
              return {
                background: '#000',
                backgroundImage: 'linear-gradient(to right, rgba(34, 197, 94, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(34, 197, 94, 0.05) 1px, transparent 1px)',
                backgroundSize: '25px 25px'
              };
            case 'neon-abyss':
              return {
                background: 'linear-gradient(180deg, #0d0614 0%, #020005 100%)',
                boxShadow: 'inset 0 0 100px rgba(236, 72, 153, 0.12)'
              };
            case 'cyber-grid':
            default:
              return {
                background: '#030712',
                backgroundImage: 'linear-gradient(to right, rgba(0, 255, 136, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0, 255, 136, 0.05) 1px, transparent 1px)',
                backgroundSize: '30px 30px'
              };
          }
        })(),
        transition: 'background 0.4s ease, box-shadow 0.4s ease'
      }}
    >

      {/* CSS Animation Overrides */}
      <style>{`
        .map-node-btn {
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .map-node-btn:hover {
          transform: translate(-50%, -50%) scale(1.22) !important;
          filter: drop-shadow(0 0 15px currentColor);
          z-index: 15 !important;
        }
        .map-node-btn:active {
          transform: translate(-50%, -50%) scale(0.92) !important;
        }
        .portal-btn {
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .portal-btn:hover {
          transform: translate(-50%, -50%) scale(1.18) !important;
          filter: brightness(1.25) drop-shadow(0 0 20px currentColor);
          z-index: 15 !important;
        }
        .portal-btn:active {
          transform: translate(-50%, -50%) scale(0.92) !important;
        }
        @keyframes march {
          to { stroke-dashoffset: -1000; }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes portalSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        @keyframes portalPulse {
          from { transform: scale(0.95); opacity: 0.85; }
          to { transform: scale(1.15); opacity: 1; }
        }
        @keyframes activeNodeFloat {
          0% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-5px); }
          100% { transform: translate(-50%, -50%) translateY(0px); }
        }
        .active-floating-node {
          animation: activeNodeFloat 3s ease-in-out infinite;
        }
      `}</style>

      {/* Floating HUD Top Bar */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 12, 
          left: 12, 
          right: 12, 
          zIndex: 10,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: '8px 16px', 
          background: 'rgba(8, 12, 28, 0.75)', 
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 0 16px rgba(0, 255, 136, 0.03)'
        }}
      >
        {/* Back Menu Button */}
        <button 
          onClick={() => router.push('/')} 
          style={{ 
            background: 'rgba(255,255,255,0.03)', 
            border: '1px solid rgba(255,255,255,0.08)', 
            borderRadius: 8,
            padding: '6px 12px',
            color: '#94a3b8', 
            fontSize: 11, 
            fontWeight: 700,
            cursor: 'pointer', 
            letterSpacing: '0.04em',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <span>←</span>
          {!isMobile && <span>{t('common.back_menu')}</span>}
        </button>

        {/* Central Segmented Tab Controls */}
        <div 
          style={{ 
            display: 'flex', 
            background: 'rgba(3, 7, 18, 0.6)', 
            borderRadius: 10, 
            padding: 2, 
            border: '1px solid rgba(255, 255, 255, 0.05)' 
          }}
        >
          <button
            onClick={() => setActiveTab('campaign')}
            style={{
              padding: '6px 14px', 
              fontSize: 11, 
              fontWeight: 700,
              background: activeTab === 'campaign' ? 'rgba(0, 255, 136, 0.08)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: activeTab === 'campaign' ? '#00ff88' : '#64748b',
              cursor: 'pointer', 
              letterSpacing: '0.06em', 
              textTransform: 'uppercase',
              textShadow: activeTab === 'campaign' ? '0 0 8px rgba(0, 255, 136, 0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {t('levels.campaign')}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            style={{
              padding: '6px 14px', 
              fontSize: 11, 
              fontWeight: 700,
              background: activeTab === 'custom' ? 'rgba(0, 196, 255, 0.08)' : 'transparent',
              border: 'none',
              borderRadius: 8,
              color: activeTab === 'custom' ? '#00c4ff' : '#64748b',
              cursor: 'pointer', 
              letterSpacing: '0.06em', 
              textTransform: 'uppercase',
              textShadow: activeTab === 'custom' ? '0 0 8px rgba(0, 196, 255, 0.4)' : 'none',
              transition: 'all 0.2s ease',
            }}
          >
            {t('levels.custom')}
          </button>
        </div>

        {/* Right Actions & Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Trophy Score Badge */}
          {totalScore > 0 && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4, 
                background: 'rgba(255, 215, 0, 0.06)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: 8,
                padding: '4px 8px',
                color: '#ffd700',
                fontSize: 11,
                fontWeight: 800,
                textShadow: '0 0 6px rgba(255,215,0,0.3)'
              }}
              title="Toplam Skor"
            >
              <span>🏆</span>
              <span>{totalScore}</span>
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={handleRefresh} 
            disabled={syncing} 
            title="Firestore'dan güncelle"
            style={{ 
              width: 30,
              height: 30,
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              color: syncing ? '#1e3a5f' : '#64748b', 
              borderRadius: 8, 
              cursor: syncing ? 'not-allowed' : 'pointer', 
              transition: 'all 0.15s ease',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: 12
            }}
          >
            <span style={{ display: 'inline-block', animation: syncing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
          </button>

          {/* New Level Button */}
          <button
            onClick={() => router.push('/editor')}
            style={{ 
              fontSize: 11, 
              padding: '6px 12px', 
              fontWeight: 800, 
              letterSpacing: '0.04em', 
              background: 'linear-gradient(135deg, rgba(0, 196, 255, 0.1) 0%, rgba(0, 196, 255, 0.2) 100%)', 
              border: '1.5px solid rgba(0, 196, 255, 0.45)', 
              color: '#00c4ff', 
              borderRadius: 8, 
              cursor: 'pointer',
              boxShadow: '0 0 12px rgba(0, 196, 255, 0.15)',
              transition: 'all 0.15s ease'
            }}
          >
            {isMobile ? '+' : t('levels.new')}
          </button>
        </div>
      </div>

      {/* Full-Screen Campaign Map View */}
      {activeTab === 'campaign' && viewMode === 'map' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', width: '100%', height: '100%' }}>

          {/* Warp transition overlay */}
          {isWarping && (
            <div
              style={{
                position: 'absolute', inset: 0, zIndex: 1000,
                background: '#03050a',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                animation: 'warpFlash 1.2s ease-in-out forwards',
                overflow: 'hidden'
              }}
            >
              <h2 style={{ fontSize: 24, fontWeight: 900, color: '#00ff88', letterSpacing: '0.3em', textShadow: '0 0 20px rgba(0,255,136,0.6)', textTransform: 'uppercase', zIndex: 10, animation: 'warpText 1.2s ease-in-out' }}>
                WARPING...
              </h2>
              <style>{`
                @keyframes warpFlash {
                  0% { opacity: 0; backdrop-filter: blur(0px); }
                  15% { opacity: 1; backdrop-filter: blur(15px); background: rgba(255,255,255,0.9); }
                  35% { background: #03050a; }
                  85% { opacity: 1; }
                  100% { opacity: 0; pointer-events: none; }
                }
                @keyframes warpText {
                  0% { transform: scale(0.6); opacity: 0; letter-spacing: 0.1em; }
                  50% { transform: scale(1.15); opacity: 1; letter-spacing: 0.4em; }
                  100% { transform: scale(1.6); opacity: 0; letter-spacing: 0.6em; }
                }
              `}</style>
            </div>
          )}

          {/* Map canvas container */}
          <div
            ref={mapRef}
            onMouseDown={handlePanDown}
            onMouseMove={handlePanMove}
            onMouseUp={handlePanUpOrLeave}
            onMouseLeave={handlePanUpOrLeave}
            style={{
              width: '100%',
              height: '100%',
              overflowY: 'auto',
              overflowX: 'auto',
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              cursor: isPanning ? 'grabbing' : 'grab',
              userSelect: 'none',
              touchAction: 'pan-x pan-y',
              WebkitOverflowScrolling: 'touch',
              paddingBottom: 110, // Avoid bottom cards block
              paddingTop: 76 // Avoid header block
            }}
          >
            {/* Scrollable canvas dimensions */}
            <div style={{ width: '100%', minWidth: 600, height: 920, position: 'relative' }}>

              {/* Connecting Spline Path Layer */}
              {svgPathData && (() => {
                const activePart = partsMap.get(selectedPartId);
                const mapTheme = activePart?.mapTheme || 'cyber-grid';
                let activeColor = '#00ff88';
                if (mapTheme === 'retro-matrix') activeColor = '#22c55e';
                if (mapTheme === 'neon-abyss') activeColor = '#ec4899';
                if (mapTheme === 'cosmic-vortex') activeColor = '#a855f7';
                if (mapTheme === 'star-nebula') activeColor = '#6366f1';

                return (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                    {/* 1. Neon Glowing Drop Shadow Projection */}
                    <path
                      d={svgPathData}
                      fill="none"
                      stroke={activeColor}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.15, filter: 'blur(6px)' }}
                    />
                    {/* 2. Core Boundary tactile line */}
                    <path
                      d={svgPathData}
                      fill="none"
                      stroke="rgba(3, 7, 18, 0.6)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* 3. Glowing core spline */}
                    <path
                      d={svgPathData}
                      fill="none"
                      stroke={activeColor}
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.8, filter: `drop-shadow(0 0 3px ${activeColor})` }}
                    />
                    {/* 4. Moving Dash Flow Light-Beam */}
                    <path
                      d={svgPathData}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="8, 16"
                      style={{ opacity: 0.75, animation: 'march 18s linear infinite' }}
                    />
                  </svg>
                );
              })()}

              {/* Entry Portal (Bottom) - warps to previous session */}
              {(() => {
                const activePart = partsMap.get(selectedPartId);
                if (!activePart) return null;

                const currentIdx = parts.findIndex(p => p.id === selectedPartId);
                if (currentIdx <= 0) return null;

                const portalStartX = activePart.portalStartX !== undefined ? activePart.portalStartX : 50;
                const portalStartY = activePart.portalStartY !== undefined ? activePart.portalStartY : 90;

                const handleEntryPortalClick = () => {
                  setIsWarping(true);
                  setTimeout(() => {
                    setSelectedPartId(parts[currentIdx - 1].id);
                    setIsWarping(false);
                  }, 1100);
                };

                return (
                  <div
                    onClick={handleEntryPortalClick}
                    className="portal-btn"
                    style={{
                      position: 'absolute',
                      left: `${portalStartX}%`,
                      top: `${portalStartY}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                      color: '#00ffcc',
                      background: 'radial-gradient(circle, #0d9488 0%, #115e59 100%)',
                      border: '2.5px solid #00f5d4',
                      boxShadow: '0 0 20px rgba(0, 245, 212, 0.7), inset 0 0 10px rgba(0, 245, 212, 0.3)',
                      animation: 'portalSpin 4s linear infinite',
                    }}
                    title={t('levels.portal_prev_tooltip')}
                  >
                    <span style={{ fontSize: 22, animation: 'portalPulse 1.5s ease-in-out infinite alternate' }}>
                      🌀
                    </span>
                  </div>
                );
              })()}

              {/* Exit Portal (Top) - warps to next session / victory */}
              {(() => {
                const activePart = partsMap.get(selectedPartId);
                if (!activePart) return null;

                const portalX = activePart.portalX !== undefined ? activePart.portalX : 50;
                const portalY = activePart.portalY !== undefined ? activePart.portalY : 10;
                
                const isSessionCompleted = filteredPresets.length > 0 && filteredPresets.every(lv => lv.firestoreId && playedMap.has(lv.firestoreId));

                const handleExitPortalClick = () => {
                  if (!isSessionCompleted) {
                    alert(t('levels.portal_next_tooltip_locked'));
                    return;
                  }
                  
                  const currentIdx = parts.findIndex(p => p.id === selectedPartId);
                  if (currentIdx !== -1 && currentIdx < parts.length - 1) {
                    setIsWarping(true);
                    setTimeout(() => {
                      setSelectedPartId(parts[currentIdx + 1].id);
                      setIsWarping(false);
                    }, 1100);
                  } else {
                    setVictoryModal(true);
                  }
                };

                return (
                  <div
                    onClick={handleExitPortalClick}
                    className="portal-btn"
                    style={{
                      position: 'absolute',
                      left: `${portalX}%`,
                      top: `${portalY}%`,
                      transform: 'translate(-50%, -50%)',
                      width: 50,
                      height: 50,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      zIndex: 10,
                      color: isSessionCompleted ? '#fbbf24' : '#475569',
                      background: isSessionCompleted 
                        ? 'radial-gradient(circle, #f59e0b 0%, #78350f 100%)' 
                        : 'radial-gradient(circle, #334155 0%, #0f172a 100%)',
                      border: `2.5px solid ${isSessionCompleted ? '#fbbf24' : '#475569'}`,
                      boxShadow: isSessionCompleted 
                        ? '0 0 25px rgba(245, 158, 11, 0.75), inset 0 0 15px rgba(255, 215, 0, 0.4)' 
                        : 'none',
                      animation: isSessionCompleted ? 'portalSpin 3s linear infinite' : 'none',
                    }}
                    title={isSessionCompleted ? t('levels.portal_next_tooltip_unlocked') : t('levels.portal_next_tooltip_locked')}
                  >
                    <span style={{ fontSize: 24, animation: isSessionCompleted ? 'portalPulse 1.5s ease-in-out infinite alternate' : 'none' }}>
                      🌀
                    </span>
                  </div>
                );
              })()}

              {/* Level Nodes */}
              {filteredPresets.map((lv, idx) => {
                const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
                const isCompleted = lv.firestoreId ? playedMap.has(lv.firestoreId) : false;
                const playedData = lv.firestoreId ? playedMap.get(lv.firestoreId) : undefined;
                
                const isCurrent = !isLocked && !isCompleted;

                const activePart = partsMap.get(selectedPartId);
                const mapTheme = activePart?.mapTheme || 'cyber-grid';
                let activeColor = '#00ff88';
                if (mapTheme === 'retro-matrix') activeColor = '#22c55e';
                if (mapTheme === 'neon-abyss') activeColor = '#ec4899';
                if (mapTheme === 'cosmic-vortex') activeColor = '#a855f7';
                if (mapTheme === 'star-nebula') activeColor = '#6366f1';

                const entry = lv.firestoreId && activePart ? activePart.order[lv.firestoreId] : undefined;
                let x = entry?.mapX;
                let y = entry?.mapY;
                
                if (x === undefined || y === undefined) {
                  const count = filteredPresets.length;
                  const ratio = count > 1 ? idx / (count - 1) : 0.5;
                  y = Math.round(85 - ratio * 70);
                  x = Math.round(50 + Math.sin(ratio * Math.PI * 3.5) * 35);
                }

                return (
                  <div
                    key={lv.id}
                    className={`map-node-btn ${isCurrent ? 'active-floating-node' : ''}`}
                    onClick={() => {
                      if (isLocked) return;
                      router.push(`/play?id=${lv.id}&source=preset`);
                    }}
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: 5,
                      cursor: isLocked ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      color: activeColor
                    }}
                  >
                    {isCurrent && (
                      <div
                        style={{
                          position: 'absolute',
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          border: `2px solid ${activeColor}`,
                          animation: 'pulseRing 1.5s cubic-bezier(0.215, 0.610, 0.355, 1) infinite',
                          pointerEvents: 'none'
                        }}
                      />
                    )}

                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: isLocked ? '#0a0c10' : (isCompleted ? `${activeColor}15` : '#070a13'),
                        border: `2px solid ${isLocked ? '#1e293b' : (isCurrent ? '#ffd700' : activeColor)}`,
                        color: isLocked ? '#475569' : '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 800,
                        boxShadow: isLocked 
                          ? 'none' 
                          : `0 0 15px ${isCurrent ? 'rgba(255, 215, 0, 0.4)' : `${activeColor}30`}`,
                        textShadow: isLocked ? 'none' : '0 0 4px rgba(255,255,255,0.5)',
                        transition: 'all 0.15s ease-in-out'
                      }}
                    >
                      {isLocked ? '🔒' : idx + 1}
                    </div>

                    <div
                      style={{
                        position: 'absolute',
                        top: 36,
                        background: 'rgba(3,7,18,0.92)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: 8,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        letterSpacing: '0.05em',
                        color: isLocked ? '#475569' : '#cbd5e1',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                        pointerEvents: 'none',
                        textTransform: 'uppercase',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2
                      }}
                    >
                      <span>{lv.name}</span>
                      {isCompleted && playedData && (
                        <div style={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          {[1, 2, 3].map((n) => (
                            <span
                              key={n}
                              style={{
                                color: n <= playedData.score ? '#ffd700' : 'rgba(255,255,255,0.15)',
                                fontSize: 7,
                                textShadow: n <= playedData.score ? '0 0 4px #ffd700' : 'none'
                              }}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            </div>
          </div>
        </div>
      )}

      {/* Scrollable List Views (Campaign List & Custom Levels) */}
      {(activeTab === 'custom' || viewMode === 'list') && (
        <div style={{ 
          position: 'absolute', 
          inset: 0, 
          top: 68, 
          zIndex: 2, 
          overflowY: 'auto', 
          padding: isMobile ? '12px 8px 30px' : '20px 40px 40px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          WebkitOverflowScrolling: 'touch',
        }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#ffd700', fontSize: 13, letterSpacing: '0.1em', paddingTop: 60, textShadow: '0 0 10px rgba(255, 215, 0, 0.4)' }}>
              {t('common.loading')}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{ width: '100%', maxWidth: 800, background: 'rgba(8, 12, 28, 0.55)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: isMobile ? '10px' : '24px', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)' }}
            >
              {activeTab === 'campaign' ? (
                /* Campaign List View */
                <LevelTable>
                  <AnimatePresence mode="popLayout">
                    {filteredPresets.map((lv, idx) => {
                      const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
                      return (
                        <motion.div
                          key={lv.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          transition={{ delay: Math.min(idx * 0.03, 0.35) }}
                        >
                          <LevelRow
                            level={lv} index={idx} total={filteredPresets.length}
                            isPreset isAdmin={isModerator} isMobile={isMobile} cols=""
                            playedLevel={lv.firestoreId ? playedMap.get(lv.firestoreId) : undefined}
                            isLocked={isLocked}
                            onPlay={() => {
                              if (isLocked) return;
                              router.push(`/play?id=${lv.id}&source=preset`);
                            }}
                            onEdit={() => lv.firestoreId ? router.push(`/editor?firestoreId=${lv.firestoreId}`) : undefined}
                            onDelete={() => handleDeletePreset(lv)}
                            onMoveUp={() => { }} onMoveDown={() => { }}
                          />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </LevelTable>
              ) : (
                /* Custom Tab */
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {userLevels.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 40, paddingBottom: 40 }}>
                      <p style={{ color: '#64748b', fontSize: 13, letterSpacing: '0.06em' }}>{t('levels.no_custom')}</p>
                      <button
                        onClick={() => router.push('/editor')}
                        style={{ 
                          padding: '10px 28px', 
                          fontSize: 13, 
                          fontWeight: 700, 
                          letterSpacing: '0.08em', 
                          textTransform: 'uppercase', 
                          background: 'rgba(0,196,255,0.06)', 
                          border: '1px solid rgba(0,196,255,0.4)', 
                          color: '#00c4ff', 
                          borderRadius: 10, 
                          cursor: 'pointer',
                          boxShadow: '0 4px 12px rgba(0, 196, 255, 0.2)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {t('levels.create_first')}
                      </button>
                    </div>
                  ) : (
                    <LevelTable>
                      <AnimatePresence mode="popLayout">
                        {userLevels.map((lv, idx) => (
                          <motion.div
                            key={lv.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 10 }}
                            transition={{ delay: Math.min(idx * 0.03, 0.35) }}
                          >
                            <LevelRow
                              level={lv} index={idx} total={userLevels.length}
                              isPreset={false} isMobile={isMobile} cols=""
                              onPlay={() => router.push(`/play?id=${lv.id}`)}
                              onEdit={() => router.push(`/editor?id=${lv.id}`)}
                              onDelete={() => handleDelete(lv.id)}
                              onMoveUp={() => move(idx, -1)} onMoveDown={() => move(idx, 1)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </LevelTable>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* Floating Bottom Chapter / World Card Selector (Horizontal Scrolling) */}
      {!loading && activeTab === 'campaign' && viewMode === 'map' && parts.length > 0 && (
        <div 
          style={{ 
            position: 'absolute', 
            bottom: 16, 
            left: 12, 
            right: 12, 
            zIndex: 10,
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            padding: '6px 4px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none',
          }}
          className="scrollbar-none"
        >
          {/* Inject style tag to hide Webkit scrollbars */}
          <style>{`
            .scrollbar-none::-webkit-scrollbar {
              display: none;
            }
          `}</style>
          {parts.map((p, idx) => {
            const isActive = selectedPartId === p.id;
            
            // Compute completion progress
            const partLevels = presets.filter(l => String(l.part) === p.id);
            const totalCount = partLevels.length;
            const completedCount = partLevels.filter(l => l.firestoreId && playedMap.has(l.firestoreId)).length;
            
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPartId(p.id)}
                style={{
                  flexShrink: 0,
                  padding: '10px 16px',
                  minWidth: 165,
                  borderRadius: 12,
                  background: isActive ? 'rgba(255, 215, 0, 0.09)' : 'rgba(8, 12, 28, 0.7)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: `1.5px solid ${isActive ? 'rgba(255, 215, 0, 0.5)' : 'rgba(255, 255, 255, 0.08)'}`,
                  color: isActive ? '#ffd700' : '#94a3b8',
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: isActive ? '0 4px 20px rgba(255, 215, 0, 0.18), inset 0 0 10px rgba(255, 215, 0, 0.05)' : '0 4px 12px rgba(0,0,0,0.3)',
                  transition: 'all 0.22s cubic-bezier(0.25, 0.8, 0.25, 1)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3
                }}
              >
                <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: isActive ? '#ffd700' : '#475569' }}>
                  CHAPTER {idx + 1}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                  {p.name}
                </span>
                {totalCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', marginTop: 2 }}>
                    {/* Tiny Progress Bar */}
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${(completedCount / totalCount) * 100}%`, 
                          background: isActive ? '#ffd700' : '#00ff88',
                          boxShadow: isActive ? '0 0 8px rgba(255,215,0,0.5)' : '0 0 8px rgba(0,255,136,0.5)',
                          borderRadius: 2,
                          transition: 'width 0.3s ease'
                        }} 
                      />
                    </div>
                    <span style={{ fontSize: 9, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isActive ? '#ffd700' : '#475569' }}>
                      ★ {completedCount}/{totalCount}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Floating View Mode Toggle Button */}
      {!loading && activeTab === 'campaign' && (
        <button
          onClick={() => setViewMode(prev => prev === 'map' ? 'list' : 'map')}
          style={{
            position: 'absolute',
            bottom: viewMode === 'map' ? 82 : 24, 
            right: 16,
            zIndex: 15,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(8, 12, 28, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(0, 255, 136, 0.3)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 0 8px rgba(0, 255, 136, 0.1)',
            color: '#00ff88',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          title={viewMode === 'map' ? t('levels.view_list') : t('levels.view_map')}
        >
          {viewMode === 'map' ? '📋' : '🗺️'}
        </button>
      )}

      {/* Campaign Victory Modal */}
      {victoryModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.92)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setVictoryModal(false)}
        >
          <div
            style={{
              background: '#070a13', border: '1px solid rgba(255,215,0,0.3)', borderRadius: 18, padding: '32px 28px', maxWidth: 420, width: '100%',
              boxShadow: '0 0 50px rgba(255,215,0,0.15)', textAlign: 'center', position: 'relative', overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 50, marginBottom: 16 }}>🏆</div>
            <h3 style={{ margin: '0 0 12px', fontSize: 18, color: '#ffd700', letterSpacing: '0.1em', fontWeight: 900, textTransform: 'uppercase' }}>
              {t('levels.victory_portal_title')}
            </h3>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 24px' }}>
              {t('levels.victory_portal_body')}
            </p>
            <button
              onClick={() => setVictoryModal(false)}
              style={{
                width: '100%', padding: '10px 20px', fontSize: 13, fontWeight: 800, background: 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)', border: 'none', color: '#030712', borderRadius: 8, cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase', boxShadow: '0 4px 12px rgba(245,158,11,0.3)'
              }}
            >
              {t('levels.victory_portal_back')}
            </button>
          </div>
        </div>
      )}

      {/* Delete preset confirmation dialog */}
      {deleteConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(3,7,18,0.88)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !deleting && setDeleteConfirm(null)}
        >
          <div
            style={{ background: '#0a0f1a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 14, padding: '24px 28px', maxWidth: 360, width: '100%', boxShadow: '0 0 40px rgba(239,68,68,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#ef4444', letterSpacing: '0.05em' }}>{t('levels.delete_title')}</h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 6px' }}>
              {t('levels.delete_body', { name: deleteConfirm.name })}
            </p>
            <p style={{ fontSize: 11, color: '#334155', margin: '0 0 20px' }}>{t('levels.delete_warning')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={confirmDeletePreset} disabled={deleting}
                style={{ padding: '8px 20px', fontSize: 13, fontWeight: 700, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.5)', color: '#ef4444', borderRadius: 8, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}
              >
                {deleting ? '...' : t('levels.delete_yes')}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)} disabled={deleting}
                style={{ padding: '8px 16px', fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#475569', borderRadius: 8, cursor: 'pointer' }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LevelsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#030712' }} />}>
      <LevelsPageContent />
    </Suspense>
  );
}

