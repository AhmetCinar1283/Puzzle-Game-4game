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
import { useGamepad } from '@/app/src/hooks/useGamepad';

type LevelEntry = StoredLevel & { id: number };

const SELECTED_PART_STORAGE_KEY = 'levelsPage:selectedPartId';

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

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

  // ── Physics Types & Setup ───────────────────────────────────────────
  interface PhysicsNode {
    id: string;
    levelIndex?: number;
    levelId?: number;
    firestoreId?: string;
    name?: string;
    isPortal?: boolean;
    portalType?: 'start' | 'end';
    anchorX: number;
    anchorY: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    mass: number;
    isLocked: boolean;
    isCompleted: boolean;
    stars?: 1 | 2 | 3;
    isDragging?: boolean;
  }

  const [canvasWidth, setCanvasWidth] = useState(800);
  const [canvasHeight, setCanvasHeight] = useState(1050);

  const nodesRef = useRef<PhysicsNode[]>([]);
  const elementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const pathsRef = useRef<Map<string, SVGPathElement>>(new Map());
  const bridgesRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const tunnelsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const initialScrolledRef = useRef(false);
  const dragTargetRef = useRef({ x: 0, y: 0 });
  const draggingNodeIdRef = useRef<string | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const keyboardSelectedIdxRef = useRef<number | null>(null);

  useEffect(() => {
    function check() {
      const width = window.innerWidth;
      const mobile = width < 600;
      setIsMobile(mobile);
      if (mobile) {
        setCanvasWidth(width);
        setCanvasHeight(950);
      } else {
        setCanvasWidth(800);
        setCanvasHeight(1050);
      }
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
  const getSegmentState = useCallback((idx: number) => {
    const nodes = nodesRef.current;
    if (!nodes || idx < 0 || idx >= nodes.length - 1) return 'locked';
    const targetNode = nodes[idx + 1];
    if (!targetNode) return 'locked';
    if (!targetNode.isPortal) {
      if (targetNode.isCompleted) return 'completed';
      if (!targetNode.isLocked) return 'current';
      return 'locked';
    } else {
      if (targetNode.isCompleted) return 'completed';
      return 'locked';
    }
  }, []);

  const centerNodeAtIndex = useCallback((idx: number, force = false) => {
    if (!mapRef.current) return;
    const nodes = nodesRef.current;
    const node = nodes.find(n => n.levelIndex === idx);
    if (!node) return;

    const container = mapRef.current;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;

    if (container.scrollHeight <= clientHeight && !force) {
      return;
    }

    const maxScrollLeft = Math.max(0, container.scrollWidth - clientWidth);
    const maxScrollTop = Math.max(0, container.scrollHeight - clientHeight);
    const targetLeft = Math.max(0, Math.min(maxScrollLeft, node.x - clientWidth / 2));
    const targetTop = Math.max(0, Math.min(maxScrollTop, node.y - clientHeight / 2));

    container.scrollTo({
      left: targetLeft,
      top: targetTop,
      behavior: 'smooth',
    });
  }, []);

  const centerActiveNode = useCallback((force = false) => {
    const nodes = nodesRef.current;
    if (!nodes || nodes.length === 0) return;

    let activeNode = nodes.find(n => !n.isPortal && !n.isLocked && !n.isCompleted);
    if (!activeNode) {
      activeNode = nodes.find(n => !n.isPortal);
    }

    if (!activeNode || !mapRef.current) return;

    const container = mapRef.current;
    const clientWidth = container.clientWidth;
    const clientHeight = container.clientHeight;

    if (container.scrollHeight <= clientHeight && !force) {
      return;
    }

    const maxScrollLeft = Math.max(0, container.scrollWidth - clientWidth);
    const maxScrollTop = Math.max(0, container.scrollHeight - clientHeight);
    const targetLeft = Math.max(0, Math.min(maxScrollLeft, activeNode.x - clientWidth / 2));
    const targetTop = Math.max(0, Math.min(maxScrollTop, activeNode.y - clientHeight / 2));

    container.scrollTo({
      left: targetLeft,
      top: targetTop,
      behavior: 'smooth',
    });

    if (!force) {
      initialScrolledRef.current = true;
    }
  }, []);

  const isLoopRunning = useRef(false);

  // Main Physics loop
  const loop = useCallback(() => {
    const nodes = nodesRef.current;
    if (!nodes || nodes.length === 0) {
      animationFrameId.current = requestAnimationFrame(loop);
      return;
    }

    const k_rope = 0.032;
    const rest_dist_factor = 0.88;
    const count = nodes.length;

    // 1. Spring forces between connected nodes
    for (let i = 0; i < count - 1; i++) {
      const nA = nodes[i];
      const nB = nodes[i + 1];

      const dx = nB.x - nA.x;
      const dy = nB.y - nA.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.001;

      const adx = nB.anchorX - nA.anchorX;
      const ady = nB.anchorY - nA.anchorY;
      const restLength = Math.sqrt(adx * adx + ady * ady) * rest_dist_factor;

      const extension = dist - restLength;
      const force = k_rope * extension;

      const fx = force * (dx / dist);
      const fy = force * (dy / dist);

      if (!nA.isDragging) {
        nA.vx += fx / nA.mass;
        nA.vy += fy / nA.mass;
      }
      if (!nB.isDragging) {
        nB.vx -= fx / nB.mass;
        nB.vy -= fy / nB.mass;
      }
    }



    // 3. Anchor pull, hover bounce, damping, integration
    const k_anchor = 0.07;
    const damping = 0.83;
    const time = Date.now() * 0.0035;
    let allSettled = true;

    for (let i = 0; i < count; i++) {
      const n = nodes[i];

      if (n.isDragging) {
        allSettled = false;
        n.x += (dragTargetRef.current.x - n.x) * 0.4;
        n.y += (dragTargetRef.current.y - n.y) * 0.4;
        n.vx = 0;
        n.vy = 0;
      } else {
        const fax = -k_anchor * (n.x - n.anchorX);
        const fay = -k_anchor * (n.y - n.anchorY);

        n.vx += fax / n.mass;
        n.vy += fay / n.mass;

        // selection float
        if (keyboardSelectedIdxRef.current === n.levelIndex && !n.isPortal) {
          n.vx += Math.sin(time) * 0.16;
          n.vy += Math.cos(time * 0.85) * 0.16;
        }

        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx;
        n.y += n.vy;

        const vel = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        const dist = Math.sqrt((n.x - n.anchorX) ** 2 + (n.y - n.anchorY) ** 2);
        if (vel > 0.015 || dist > 0.15) {
          allSettled = false;
        }
      }

      const el = elementsRef.current.get(n.id);
      if (el) {
        el.style.transform = `translate3d(${n.x}px, ${n.y}px, 0) translate(-50%, -50%)`;
      }
    }

    // 4. Update SVG paths and bridge/tunnel overlays in real-time
    for (let i = 0; i < count - 1; i++) {
      const nA = nodes[i];
      const nB = nodes[i + 1];

      const midX = (nA.x + nB.x) / 2;
      const midY = (nA.y + nB.y) / 2;

      const dx = nB.x - nA.x;
      const dy = nB.y - nA.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const nx = -dy / len;
      const ny = dx / len;

      const sign = (i % 2 === 0) ? 1 : -1;
      const bendAmount = len * 0.12 * sign;
      const ctrlX = midX + nx * bendAmount;
      const ctrlY = midY + ny * bendAmount;

      const pathData = `M ${nA.x} ${nA.y} Q ${ctrlX} ${ctrlY}, ${nB.x} ${nB.y}`;

      const pathGlow = pathsRef.current.get(`glow-${i}`);
      if (pathGlow) pathGlow.setAttribute('d', pathData);

      const pathCore = pathsRef.current.get(`core-${i}`);
      if (pathCore) pathCore.setAttribute('d', pathData);

      const pathBeam = pathsRef.current.get(`beam-${i}`);
      if (pathBeam) pathBeam.setAttribute('d', pathData);

      const bridge = bridgesRef.current.get(`bridge-${i}`);
      if (bridge) {
        const angle = Math.atan2(dy, dx);
        bridge.style.transform = `translate3d(${midX + nx * bendAmount * 0.5}px, ${midY + ny * bendAmount * 0.5}px, 0) translate(-50%, -50%) rotate(${angle}rad)`;
      }

      const tunnel = tunnelsRef.current.get(`tunnel-${i}`);
      if (tunnel) {
        const angle = Math.atan2(dy, dx);
        tunnel.style.transform = `translate3d(${midX + nx * bendAmount * 0.5}px, ${midY + ny * bendAmount * 0.5}px, 0) translate(-50%, -50%) rotate(${angle}rad)`;
      }
    }

    // 5. Initial viewport centering on active node once dimensions are ready
    if (!initialScrolledRef.current && mapRef.current && nodes.length > 0) {
      const container = mapRef.current;
      if (container.scrollHeight > container.clientHeight) {
        centerActiveNode();
      }
    }

    if (allSettled && draggingNodeIdRef.current === null) {
      isLoopRunning.current = false;
      animationFrameId.current = null;
      return;
    }

    animationFrameId.current = requestAnimationFrame(loop);
  }, [centerActiveNode]);

  const wakePhysics = useCallback(() => {
    if (!isLoopRunning.current) {
      isLoopRunning.current = true;
      animationFrameId.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  const handleNodePointerDown = useCallback((nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingNodeIdRef.current = nodeId;

    const nodes = nodesRef.current;
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      node.isDragging = true;
      const canvas = document.getElementById('physics-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        dragTargetRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      }
      wakePhysics();
    }
  }, [wakePhysics]);

  const handleNodePointerMove = useCallback((nodeId: string, e: React.PointerEvent) => {
    if (draggingNodeIdRef.current === nodeId) {
      const canvas = document.getElementById('physics-canvas');
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        dragTargetRef.current = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
      }
      wakePhysics();
    }
  }, [wakePhysics]);

  const handleNodePointerUp = useCallback((nodeId: string, e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    draggingNodeIdRef.current = null;

    const nodes = nodesRef.current;
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      node.isDragging = false;
      wakePhysics();
    }
  }, [wakePhysics]);

  const [gamepadSelectedNodeIndex, setGamepadSelectedNodeIndex] = useState<number | null>(null);

  const defaultActiveIdx = useMemo(() => {
    const idx = filteredPresets.findIndex((lv) => {
      const isCompleted = lv.firestoreId ? playedMap.has(lv.firestoreId) : false;
      const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
      return !isLocked && !isCompleted;
    });
    return idx !== -1 ? idx : 0;
  }, [filteredPresets, playedMap, lockedSet]);

  useEffect(() => {
    setGamepadSelectedNodeIndex(activeTab === 'campaign' ? defaultActiveIdx : 0);
  }, [activeTab, viewMode, defaultActiveIdx]);

  // Handle selected node kick (impulse) and centering when index changes
  useEffect(() => {
    if (activeTab === 'campaign' && viewMode === 'map' && gamepadSelectedNodeIndex !== null) {
      const targetNode = nodesRef.current.find(n => n.levelIndex === gamepadSelectedNodeIndex);
      if (targetNode) {
        targetNode.vx += (Math.random() - 0.5) * 16;
        targetNode.vy += (Math.random() - 0.5) * 16;
        wakePhysics();
      }
      // Delay centering slightly to let physics load
      const timer = setTimeout(() => {
        if (initialScrolledRef.current) {
          centerNodeAtIndex(gamepadSelectedNodeIndex);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [gamepadSelectedNodeIndex, activeTab, viewMode, centerNodeAtIndex, wakePhysics]);



  // Initialize and update nodesRef on level data changes
  useEffect(() => {
    if (viewMode !== 'map' || activeTab !== 'campaign') {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      return;
    }

    const activePart = partsMap.get(selectedPartId);
    const currentIdx = parts.findIndex(p => p.id === selectedPartId);
    const hasPortalStart = currentIdx > 0;
    const nodesList: PhysicsNode[] = [];

    // 1. Entry Portal (Portal Start)
    if (hasPortalStart && activePart) {
      const portalStartX = activePart.portalStartX !== undefined ? activePart.portalStartX : 50;
      const portalStartY = activePart.portalStartY !== undefined ? activePart.portalStartY : 90;
      
      nodesList.push({
        id: 'portal-start',
        isPortal: true,
        portalType: 'start',
        anchorX: (portalStartX / 100) * canvasWidth,
        anchorY: (portalStartY / 100) * canvasHeight,
        x: (portalStartX / 100) * canvasWidth,
        y: (portalStartY / 100) * canvasHeight,
        vx: 0,
        vy: 0,
        mass: 1.8,
        isLocked: false,
        isCompleted: false,
      });
    }

    // 2. Level Nodes
    filteredPresets.forEach((lv, idx) => {
      const entry = lv.firestoreId && activePart ? activePart.order[lv.firestoreId] : undefined;
      let mapX = entry?.mapX;
      let mapY = entry?.mapY;

      if (mapX === undefined || mapY === undefined) {
        const count = filteredPresets.length;
        const ratio = count > 1 ? idx / (count - 1) : 0.5;
        mapY = Math.round(85 - ratio * 70);
        mapX = Math.round(50 + Math.sin(ratio * Math.PI * 3.5) * 35);
      }

      const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
      const isCompleted = lv.firestoreId ? playedMap.has(lv.firestoreId) : false;
      const playedData = lv.firestoreId ? playedMap.get(lv.firestoreId) : undefined;

      nodesList.push({
        id: `node-${lv.id}`,
        levelIndex: idx,
        levelId: lv.id,
        firestoreId: lv.firestoreId,
        name: lv.name,
        isPortal: false,
        anchorX: (mapX / 100) * canvasWidth,
        anchorY: (mapY / 100) * canvasHeight,
        x: (mapX / 100) * canvasWidth,
        y: (mapY / 100) * canvasHeight,
        vx: 0,
        vy: 0,
        mass: 1.0,
        isLocked,
        isCompleted,
        stars: playedData?.score as 1 | 2 | 3,
      });
    });

    // 3. Exit Portal (Portal End)
    if (activePart) {
      const portalX = activePart.portalX !== undefined ? activePart.portalX : 50;
      const portalY = activePart.portalY !== undefined ? activePart.portalY : 10;
      const isSessionCompleted = filteredPresets.length > 0 && filteredPresets.every(lv => lv.firestoreId && playedMap.has(lv.firestoreId));

      nodesList.push({
        id: 'portal-end',
        isPortal: true,
        portalType: 'end',
        anchorX: (portalX / 100) * canvasWidth,
        anchorY: (portalY / 100) * canvasHeight,
        x: (portalX / 100) * canvasWidth,
        y: (portalY / 100) * canvasHeight,
        vx: 0,
        vy: 0,
        mass: 1.8,
        isLocked: !isSessionCompleted,
        isCompleted: isSessionCompleted,
      });
    }

    nodesRef.current = nodesList;

    wakePhysics();

    // Apply startup kick to make nodes float and settle
    setTimeout(() => {
      nodesRef.current.forEach(n => {
        n.vx += (Math.random() - 0.5) * 8;
        n.vy += (Math.random() - 0.5) * 8;
      });
      wakePhysics();
    }, 100);

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      isLoopRunning.current = false;
    };
  }, [filteredPresets, selectedPartId, viewMode, activeTab, partsMap, lockedSet, playedMap, loop, wakePhysics, canvasWidth, canvasHeight]);

  // Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Esc → back to home
      if (e.key === 'Escape') {
        e.preventDefault();
        router.push('/');
        return;
      }

      // PageUp / PageDown → scroll the map or list container
      if (e.key === 'PageUp') {
        e.preventDefault();
        if (mapRef.current) {
          mapRef.current.scrollBy({ top: -300, behavior: 'smooth' });
        } else {
          window.scrollBy({ top: -300, behavior: 'smooth' });
        }
        return;
      }
      if (e.key === 'PageDown') {
        e.preventDefault();
        if (mapRef.current) {
          mapRef.current.scrollBy({ top: 300, behavior: 'smooth' });
        } else {
          window.scrollBy({ top: 300, behavior: 'smooth' });
        }
        return;
      }

      if (activeTab === 'campaign' && viewMode === 'map') {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          setGamepadSelectedNodeIndex((prev) => {
            const current = prev !== null ? prev : defaultActiveIdx;
            return (current - 1 + filteredPresets.length) % filteredPresets.length;
          });
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          setGamepadSelectedNodeIndex((prev) => {
            const current = prev !== null ? prev : defaultActiveIdx;
            return (current + 1) % filteredPresets.length;
          });
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const current = gamepadSelectedNodeIndex !== null ? gamepadSelectedNodeIndex : defaultActiveIdx;
          const lv = filteredPresets[current];
          if (lv) {
            const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
            if (!isLocked) {
              router.push(`/play?id=${lv.id}&source=preset`);
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, viewMode, filteredPresets, gamepadSelectedNodeIndex, defaultActiveIdx, lockedSet, router]);

  const { isConnected } = useGamepad({
    onMove: (dir) => {
      if (activeTab === 'campaign' && viewMode === 'map') {
        if (dir === 'left') {
          setGamepadSelectedNodeIndex((prev) => {
            const current = prev !== null ? prev : defaultActiveIdx;
            return (current - 1 + filteredPresets.length) % filteredPresets.length;
          });
        } else if (dir === 'right') {
          setGamepadSelectedNodeIndex((prev) => {
            const current = prev !== null ? prev : defaultActiveIdx;
            return (current + 1) % filteredPresets.length;
          });
        } else if (dir === 'up') {
          const currentIdx = parts.findIndex((p) => p.id === selectedPartId);
          if (currentIdx > 0) {
            setIsWarping(true);
            setTimeout(() => {
              setSelectedPartId(parts[currentIdx - 1].id);
              setIsWarping(false);
            }, 1100);
          }
        } else if (dir === 'down') {
          const currentIdx = parts.findIndex((p) => p.id === selectedPartId);
          if (currentIdx !== -1 && currentIdx < parts.length - 1) {
            setIsWarping(true);
            setTimeout(() => {
              setSelectedPartId(parts[currentIdx + 1].id);
              setIsWarping(false);
            }, 1100);
          }
        }
      } else {
        const listLength = activeTab === 'campaign' ? filteredPresets.length : userLevels.length;
        if (listLength === 0) return;

        if (dir === 'up') {
          setGamepadSelectedNodeIndex((prev) => {
            const current = prev !== null ? prev : 0;
            return (current - 1 + listLength) % listLength;
          });
        } else if (dir === 'down') {
          setGamepadSelectedNodeIndex((prev) => {
            const current = prev !== null ? prev : 0;
            return (current + 1) % listLength;
          });
        } else if (dir === 'left' || dir === 'right') {
          setActiveTab((prev) => (prev === 'campaign' ? 'custom' : 'campaign'));
        }
      }
    },
    onConfirm: () => {
      if (activeTab === 'campaign' && viewMode === 'map') {
        const idx = gamepadSelectedNodeIndex !== null ? gamepadSelectedNodeIndex : defaultActiveIdx;
        const lv = filteredPresets[idx];
        if (lv) {
          const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
          if (!isLocked) {
            router.push(`/play?id=${lv.id}&source=preset`);
          }
        }
      } else if (activeTab === 'campaign' && viewMode === 'list') {
        const idx = gamepadSelectedNodeIndex !== null ? gamepadSelectedNodeIndex : 0;
        const lv = filteredPresets[idx];
        if (lv) {
          const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
          if (!isLocked) {
            router.push(`/play?id=${lv.id}&source=preset`);
          }
        }
      } else if (activeTab === 'custom') {
        const idx = gamepadSelectedNodeIndex !== null ? gamepadSelectedNodeIndex : 0;
        const lv = userLevels[idx];
        if (lv) {
          router.push(`/play?id=${lv.id}`);
        }
      }
    },
    onMenu: () => {
      router.push('/');
    },
    onRestart: () => {
      if (activeTab === 'campaign') {
        setViewMode((prev) => (prev === 'map' ? 'list' : 'map'));
      }
    },
    onAxisMove: (axisIndex, value) => {
      if (Math.abs(value) < 0.15) return;
      if (activeTab === 'campaign' && viewMode === 'map') {
        if (mapRef.current) {
          if (axisIndex === 2) {
            mapRef.current.scrollLeft += value * 22;
          } else if (axisIndex === 3) {
            mapRef.current.scrollTop += value * 22;
          }
        }
      } else {
        if (axisIndex === 3) {
          window.scrollBy({ top: value * 22, behavior: 'auto' });
        }
      }
    }
  });

  // Reset initial scroll flag when selected part changes
  useEffect(() => {
    initialScrolledRef.current = false;
  }, [selectedPartId]);

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
          transition: filter 0.3s ease, z-index 0.3s ease;
        }
        .map-node-btn:hover {
          filter: drop-shadow(0 0 15px currentColor);
          z-index: 15 !important;
        }
        .portal-btn {
          transition: filter 0.3s ease, z-index 0.3s ease;
        }
        .portal-btn:hover {
          filter: brightness(1.25) drop-shadow(0 0 20px currentColor);
          z-index: 15 !important;
        }
        @keyframes march {
          to { stroke-dashoffset: -1000; }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.7); opacity: 0.9; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes portalSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes portalPulse {
          from { transform: scale(0.95); opacity: 0.85; }
          to { transform: scale(1.15); opacity: 1; }
        }
        @keyframes activeNodeFloat {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
          100% { transform: translateY(0px); }
        }
        .active-floating-node {
          animation: activeNodeFloat 3s ease-in-out infinite;
        }
      `}</style>

      {/* Floating HUD Top Bar */}
      <div 
        style={{ 
          position: 'absolute', 
          top: isMobile ? 8 : 12, 
          left: isMobile ? 8 : 12, 
          right: isMobile ? 8 : 12, 
          zIndex: 10,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: isMobile ? '6px 10px' : '8px 16px', 
          background: 'rgba(8, 12, 28, 0.75)', 
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: isMobile ? 10 : 14,
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
            padding: isMobile ? '6px 8px' : '6px 12px',
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
          {isConnected && (
            <span style={{
              background: '#ef4444',
              color: '#fff',
              fontSize: 9,
              fontWeight: 800,
              borderRadius: '50%',
              width: 14,
              height: 14,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 4,
              boxShadow: '0 0 5px #ef4444'
            }}>
              B
            </span>
          )}
        </button>

        {/* Central Segmented Tab Controls */}
        <div 
          style={{ 
            display: 'flex', 
            background: 'rgba(3, 7, 18, 0.6)', 
            borderRadius: 10, 
            padding: 2, 
            border: '1px solid rgba(255, 255, 255, 0.05)',
            position: 'relative'
          }}
        >
          {isConnected && (
            <span style={{
              position: 'absolute',
              left: -24,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              fontSize: 9,
              fontWeight: 800,
              padding: '2px 4px',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              pointerEvents: 'none'
            }}>
              ◀
            </span>
          )}
          <button
            onClick={() => setActiveTab('campaign')}
            style={{
              padding: isMobile ? '5px 8px' : '6px 14px', 
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
              padding: isMobile ? '5px 8px' : '6px 14px', 
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
          {isConnected && (
            <span style={{
              position: 'absolute',
              right: -24,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              fontSize: 9,
              fontWeight: 800,
              padding: '2px 4px',
              borderRadius: 4,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              pointerEvents: 'none'
            }}>
              ▶
            </span>
          )}
        </div>

        {/* Right Actions & Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
          {/* Trophy Score Badge */}
          {totalScore > 0 && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2, 
                background: 'rgba(255, 215, 0, 0.06)',
                border: '1px solid rgba(255, 215, 0, 0.2)',
                borderRadius: 8,
                padding: isMobile ? '3px 6px' : '4px 8px',
                color: '#ffd700',
                fontSize: isMobile ? 10 : 11,
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
              padding: isMobile ? '6px 8px' : '6px 12px', 
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
      {activeTab === 'campaign' && viewMode === 'map' && (() => {
        const activePart = partsMap.get(selectedPartId);
        const mapTheme = activePart?.mapTheme || 'cyber-grid';
        let activeColor = '#00ff88';
        if (mapTheme === 'retro-matrix') activeColor = '#22c55e';
        if (mapTheme === 'neon-abyss') activeColor = '#ec4899';
        if (mapTheme === 'cosmic-vortex') activeColor = '#a855f7';
        if (mapTheme === 'star-nebula') activeColor = '#6366f1';

        const hasPortalStart = parts.findIndex(p => p.id === selectedPartId) > 0;
        const isSessionCompleted = filteredPresets.length > 0 && filteredPresets.every(lv => lv.firestoreId && playedMap.has(lv.firestoreId));

        const handleEntryPortalClick = () => {
          const currentIdx = parts.findIndex(p => p.id === selectedPartId);
          if (currentIdx > 0) {
            setIsWarping(true);
            setTimeout(() => {
              setSelectedPartId(parts[currentIdx - 1].id);
              setIsWarping(false);
            }, 1100);
          }
        };

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
                overflowX: isMobile ? 'hidden' : 'auto',
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                cursor: isPanning ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: isMobile ? 'pan-y' : 'pan-x pan-y',
                WebkitOverflowScrolling: 'touch',
                paddingBottom: 110,
                paddingTop: 76
              }}
            >
              {/* Scrollable canvas dimensions centered */}
              <div 
                id="physics-canvas" 
                style={{ 
                  width: canvasWidth, 
                  height: canvasHeight, 
                  position: 'relative', 
                  margin: '0 auto',
                  background: 'transparent'
                }}
              >

                {/* CSS Keyframes for Ambient Effects */}
                <style>{`
                  @keyframes march {
                    to { stroke-dashoffset: -40; }
                  }
                  @keyframes tunnelPulse {
                    0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.6; }
                    100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.95; }
                  }
                  @keyframes starOrbit {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                  }
                  @keyframes activeHalo {
                    0% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.8; }
                    50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(0.92); opacity: 0.8; }
                  }
                  @keyframes floatAmbient {
                    0% { transform: translateY(0px) rotate(0deg); }
                    100% { transform: translateY(-12px) rotate(10deg); }
                  }
                `}</style>

                {/* Thematic Background Elements */}
                {(mapTheme === 'star-nebula' || mapTheme === 'cosmic-vortex') && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
                    {/* Glowing Galaxy Spin */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '45%',
                        width: 500,
                        height: 500,
                        transform: 'translate(-50%, -50%)',
                        background: mapTheme === 'cosmic-vortex' 
                          ? 'radial-gradient(circle, rgba(168, 85, 247, 0.08) 0%, transparent 70%)'
                          : 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
                        animation: 'spin 90s linear infinite',
                      }}
                    />
                    
                    {/* Planet A */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '12%',
                        top: '25%',
                        width: 90,
                        height: 90,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle at 30% 30%, #3b82f6 0%, #1d4ed8 70%, #0c1530 100%)',
                        boxShadow: '0 0 25px rgba(59, 130, 246, 0.25)',
                        opacity: 0.7
                      }}
                    />
                    {/* Ring for Planet A */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '7%',
                        top: '29%',
                        width: 170,
                        height: 25,
                        border: '3px solid rgba(147, 51, 234, 0.2)',
                        borderRadius: '50%',
                        transform: 'rotate(-20deg)',
                        opacity: 0.5
                      }}
                    />

                    {/* Planet B */}
                    <div
                      style={{
                        position: 'absolute',
                        right: '10%',
                        top: '60%',
                        width: 70,
                        height: 70,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle at 35% 35%, #ec4899 0%, #be123c 75%, #020617 100%)',
                        boxShadow: '0 0 20px rgba(236, 72, 153, 0.2)',
                        opacity: 0.65
                      }}
                    />

                    {/* Ambient Asteroids */}
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: `${(27 * i) % 75 + 12}%`,
                          top: `${(19 * i) % 65 + 15}%`,
                          width: 8 + (i % 3) * 5,
                          height: 7 + (i % 3) * 4,
                          background: 'rgba(51, 65, 85, 0.5)',
                          border: '1px solid rgba(255,255,255,0.03)',
                          borderRadius: '40% 60% 50% 50% / 50% 40% 60% 50%',
                          boxShadow: 'inset -2px -2px 5px rgba(0,0,0,0.8)',
                          opacity: 0.45,
                          animation: `floatAmbient ${12 + i * 3}s ease-in-out infinite alternate`
                        }}
                      />
                    ))}
                  </div>
                )}

                {(mapTheme === 'cyber-grid' || mapTheme === 'retro-matrix' || mapTheme === 'neon-abyss') && (
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.15 }}>
                    <svg style={{ width: '100%', height: '100%' }}>
                      {/* Interactive circuit visual lines */}
                      <path d="M 120 150 L 220 150 L 280 210 L 280 380 L 180 480" fill="none" stroke={activeColor} strokeWidth="1.5" />
                      <path d="M 680 220 L 580 220 L 530 270 L 530 500 L 630 600" fill="none" stroke={activeColor} strokeWidth="1.5" strokeDasharray="6,4" />
                      <path d="M 150 780 L 300 780 L 350 830 L 350 980" fill="none" stroke={activeColor} strokeWidth="1.5" />
                      <path d="M 650 720 L 500 720 L 450 770 L 450 920" fill="none" stroke={activeColor} strokeWidth="1.5" />
                    </svg>
                  </div>
                )}

                {/* Connecting Spline Path SVG Layer */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                  {nodesRef.current.length > 1 && Array.from({ length: nodesRef.current.length - 1 }).map((_, i) => {
                    const segmentState = getSegmentState(i);
                    let strokeColor = activeColor;
                    let isBeamActive = false;

                    if (segmentState === 'completed') {
                      strokeColor = activeColor;
                      isBeamActive = true;
                    } else if (segmentState === 'current') {
                      strokeColor = '#ffd700'; // Pulsing gold for active selection road
                      isBeamActive = true;
                    } else {
                      strokeColor = 'rgba(71, 85, 105, 0.25)'; // Dark dash for locked
                    }

                    return (
                      <g key={`segment-g-${i}`}>
                        {/* 1. Neon glowing outline (Completed/Current) */}
                        {segmentState !== 'locked' && (
                          <path
                            ref={(el) => {
                              if (el) pathsRef.current.set(`glow-${i}`, el);
                              else pathsRef.current.delete(`glow-${i}`);
                            }}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ opacity: isMobile ? 0.35 : 0.15, filter: isMobile ? 'none' : 'blur(5px)' }}
                          />
                        )}

                        {/* 2. Core dark boundary */}
                        <path
                          ref={(el) => {
                            if (el) pathsRef.current.set(`core-${i}`, el);
                            else pathsRef.current.delete(`core-${i}`);
                          }}
                          fill="none"
                          stroke={segmentState === 'locked' ? 'rgba(30, 41, 59, 0.4)' : 'rgba(3, 7, 18, 0.5)'}
                          strokeWidth={segmentState === 'locked' ? '3' : '6.5'}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeDasharray={segmentState === 'locked' ? '6,6' : 'none'}
                        />

                        {/* 3. Glowing core spline overlay */}
                        {segmentState !== 'locked' && (
                          <path
                            ref={(el) => {
                              if (el) pathsRef.current.set(`core-${i}`, el); // reference registration
                              else pathsRef.current.delete(`core-${i}`);
                            }}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ opacity: 0.8, filter: isMobile ? 'none' : `drop-shadow(0 0 3px ${strokeColor})` }}
                          />
                        )}

                        {/* 4. Moving Dash Flow Light-Beam */}
                        {isBeamActive && (
                          <path
                            ref={(el) => {
                              if (el) pathsRef.current.set(`beam-${i}`, el);
                              else pathsRef.current.delete(`beam-${i}`);
                            }}
                            fill="none"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="8, 16"
                            style={{ opacity: 0.75, animation: 'march 12s linear infinite' }}
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Bridges and Tunnels DOM Overlays (Centered on paths) */}
                {nodesRef.current.length > 1 && Array.from({ length: nodesRef.current.length - 1 }).map((_, i) => {
                  const isBridge = i % 3 === 1;
                  const isTunnel = i % 3 === 2;
                  const segmentState = getSegmentState(i);

                  if (segmentState === 'locked') return null;

                  if (isBridge) {
                    return (
                      <div
                        key={`bridge-${i}`}
                        ref={(el) => {
                          if (el) bridgesRef.current.set(`bridge-${i}`, el);
                          else bridgesRef.current.delete(`bridge-${i}`);
                        }}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: 38,
                          height: 18,
                          transformOrigin: 'center',
                          pointerEvents: 'none',
                          zIndex: 4,
                          background: 'rgba(8, 12, 28, 0.95)',
                          borderLeft: `2.5px solid ${activeColor}`,
                          borderRight: `2.5px solid ${activeColor}`,
                          boxShadow: `0 0 10px ${activeColor}30`,
                          borderRadius: 3,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '2px 0',
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <div style={{ height: 1.5, background: 'rgba(255,255,255,0.18)', width: '100%' }} />
                        <div style={{ height: 1.5, background: 'rgba(255,255,255,0.18)', width: '100%' }} />
                        <div style={{ height: 1.5, background: 'rgba(255,255,255,0.18)', width: '100%' }} />
                      </div>
                    );
                  }

                  if (isTunnel) {
                    return (
                      <div
                        key={`tunnel-${i}`}
                        ref={(el) => {
                          if (el) tunnelsRef.current.set(`tunnel-${i}`, el);
                          else tunnelsRef.current.delete(`tunnel-${i}`);
                        }}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: 32,
                          height: 32,
                          transformOrigin: 'center',
                          pointerEvents: 'none',
                          zIndex: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            width: 28,
                            height: 28,
                            border: `1.8px solid ${activeColor}`,
                            borderRadius: '50%',
                            opacity: 0.7,
                            boxShadow: `0 0 8px ${activeColor}35`,
                            animation: 'tunnelPulse 1.2s ease-in-out infinite alternate'
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            width: 18,
                            height: 18,
                            border: `1px dashed ${activeColor}`,
                            borderRadius: '50%',
                            opacity: 0.45,
                            animation: 'portalSpin 5s linear infinite'
                          }}
                        />
                      </div>
                    );
                  }

                  return null;
                })}

                {/* Entry Portal (Portal Start) */}
                {hasPortalStart && (() => {
                  const portalStartX = activePart?.portalStartX !== undefined ? activePart.portalStartX : 50;
                  const portalStartY = activePart?.portalStartY !== undefined ? activePart.portalStartY : 90;
                  const portalStartEntry = nodesRef.current.find(n => n.id === 'portal-start');
                  const currentPortalStartX = portalStartEntry ? portalStartEntry.x : (portalStartX / 100) * canvasWidth;
                  const currentPortalStartY = portalStartEntry ? portalStartEntry.y : (portalStartY / 100) * canvasHeight;

                  return (
                    <div
                      ref={(el) => {
                        if (el) elementsRef.current.set('portal-start', el);
                        else elementsRef.current.delete('portal-start');
                      }}
                      onPointerDown={(e) => handleNodePointerDown('portal-start', e)}
                      onPointerMove={(e) => handleNodePointerMove('portal-start', e)}
                      onPointerUp={(e) => handleNodePointerUp('portal-start', e)}
                      onClick={handleEntryPortalClick}
                      className="portal-btn"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        transform: `translate3d(${currentPortalStartX}px, ${currentPortalStartY}px, 0) translate(-50%, -50%)`,
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'grab',
                        zIndex: 10,
                        color: '#00ffcc',
                        background: 'radial-gradient(circle, #0d9488 0%, #115e59 100%)',
                        border: '2.5px solid #00f5d4',
                        boxShadow: '0 0 20px rgba(0, 245, 212, 0.7), inset 0 0 10px rgba(0, 245, 212, 0.3)',
                        touchAction: 'none'
                      }}
                      title={t('levels.portal_prev_tooltip')}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          animation: 'portalSpin 4s linear infinite',
                        }}
                      >
                        <span style={{ fontSize: 22, animation: 'portalPulse 1.5s ease-in-out infinite alternate' }}>
                          🌀
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Exit Portal (Portal End) */}
                {(() => {
                  const portalX = activePart?.portalX !== undefined ? activePart.portalX : 50;
                  const portalY = activePart?.portalY !== undefined ? activePart.portalY : 10;
                  const portalEndEntry = nodesRef.current.find(n => n.id === 'portal-end');
                  const currentPortalX = portalEndEntry ? portalEndEntry.x : (portalX / 100) * canvasWidth;
                  const currentPortalY = portalEndEntry ? portalEndEntry.y : (portalY / 100) * canvasHeight;

                  return (
                    <div
                      ref={(el) => {
                        if (el) elementsRef.current.set('portal-end', el);
                        else elementsRef.current.delete('portal-end');
                      }}
                      onPointerDown={(e) => handleNodePointerDown('portal-end', e)}
                      onPointerMove={(e) => handleNodePointerMove('portal-end', e)}
                      onPointerUp={(e) => handleNodePointerUp('portal-end', e)}
                      onClick={handleExitPortalClick}
                      className="portal-btn"
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        transform: `translate3d(${currentPortalX}px, ${currentPortalY}px, 0) translate(-50%, -50%)`,
                        width: 50,
                        height: 50,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'grab',
                        zIndex: 10,
                        color: isSessionCompleted ? '#fbbf24' : '#475569',
                        background: isSessionCompleted 
                          ? 'radial-gradient(circle, #f59e0b 0%, #78350f 100%)' 
                          : 'radial-gradient(circle, #334155 0%, #0f172a 100%)',
                        border: `2.5px solid ${isSessionCompleted ? '#fbbf24' : '#475569'}`,
                        boxShadow: isSessionCompleted 
                          ? '0 0 25px rgba(245, 158, 11, 0.75), inset 0 0 15px rgba(255, 215, 0, 0.4)' 
                          : 'none',
                        touchAction: 'none'
                      }}
                      title={isSessionCompleted ? t('levels.portal_next_tooltip_unlocked') : t('levels.portal_next_tooltip_locked')}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          animation: isSessionCompleted ? 'portalSpin 3s linear infinite' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 24, animation: isSessionCompleted ? 'portalPulse 1.5s ease-in-out infinite alternate' : 'none' }}>
                          🌀
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Level Nodes (Simulated real-time) */}
                {filteredPresets.map((lv, idx) => {
                  const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
                  const isCompleted = lv.firestoreId ? playedMap.has(lv.firestoreId) : false;
                  const playedData = lv.firestoreId ? playedMap.get(lv.firestoreId) : undefined;
                  const isCurrent = !isLocked && !isCompleted;

                  const entry = lv.firestoreId && activePart ? activePart.order[lv.firestoreId] : undefined;
                  const mapX = entry?.mapX !== undefined ? entry.mapX : 50;
                  const mapY = entry?.mapY !== undefined ? entry.mapY : 50;

                  const nodeRefEntry = nodesRef.current.find(n => n.id === `node-${lv.id}`);
                  const currentX = nodeRefEntry ? nodeRefEntry.x : (mapX / 100) * canvasWidth;
                  const currentY = nodeRefEntry ? nodeRefEntry.y : (mapY / 100) * canvasHeight;

                  return (
                    <div
                      key={lv.id}
                      ref={(el) => {
                        if (el) elementsRef.current.set(`node-${lv.id}`, el);
                        else elementsRef.current.delete(`node-${lv.id}`);
                      }}
                      className="map-node-btn"
                      onPointerDown={(e) => handleNodePointerDown(`node-${lv.id}`, e)}
                      onPointerMove={(e) => handleNodePointerMove(`node-${lv.id}`, e)}
                      onPointerUp={(e) => handleNodePointerUp(`node-${lv.id}`, e)}
                      onClick={() => {
                        setGamepadSelectedNodeIndex(idx);
                      }}
                      onDoubleClick={() => {
                        if (isLocked) return;
                        router.push(`/play?id=${lv.id}&source=preset`);
                      }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        transform: `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`,
                        zIndex: 5,
                        cursor: isLocked ? 'not-allowed' : 'grab',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        color: activeColor,
                        touchAction: 'none'
                      }}
                    >
                      {/* Inner relative container to isolate floating keyframe transforms */}
                      <div
                        className={isCurrent ? 'active-floating-node' : ''}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: '100%',
                          height: '100%'
                        }}
                      >
                        {/* Glowing Aura Ring for Active Node */}
                        {isCurrent && (
                          <div
                            style={{
                              position: 'absolute',
                              width: isMobile ? 56 : 50,
                              height: isMobile ? 56 : 50,
                              borderRadius: '50%',
                              border: `2px solid ${activeColor}`,
                              animation: 'activeHalo 2.5s ease-in-out infinite',
                              pointerEvents: 'none',
                              left: '50%',
                              top: isMobile ? '19px' : '16px',
                              transform: 'translate(-50%, -50%)'
                            }}
                          />
                        )}

                        {/* Selection Box Halo */}
                        {gamepadSelectedNodeIndex === idx && (
                          <div
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: isMobile ? '19px' : '16px',
                              width: 0,
                              height: 0,
                              pointerEvents: 'none',
                              zIndex: 6
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                width: isMobile ? 52 : 46,
                                height: isMobile ? 52 : 46,
                                left: isMobile ? -26 : -23,
                                top: isMobile ? -26 : -23,
                                borderRadius: '50%',
                                border: `2.5px solid #ffd700`,
                                boxShadow: '0 0 15px #ffd700',
                                animation: 'pulseRing 1.2s ease-in-out infinite'
                              }}
                            />
                          </div>
                        )}

                        {/* Rotating completed gold stars around node */}
                        {isCompleted && playedData && (
                          <div
                            style={{
                              position: 'absolute',
                              left: '50%',
                              top: isMobile ? '19px' : '16px',
                              width: 0,
                              height: 0,
                              pointerEvents: 'none',
                              zIndex: 4
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                width: isMobile ? 60 : 54,
                                height: isMobile ? 60 : 54,
                                left: isMobile ? -30 : -27,
                                top: isMobile ? -30 : -27,
                                animation: 'starOrbit 15s linear infinite',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              {[1, 2, 3].map((n) => {
                                const angle = (n - 1) * 120;
                                const rad = (angle * Math.PI) / 180;
                                const radius = isMobile ? 27 : 24;
                                const sx = Math.cos(rad) * radius;
                                const sy = Math.sin(rad) * radius;

                                return (
                                  <span
                                    key={n}
                                    style={{
                                      position: 'absolute',
                                      transform: `translate(${sx}px, ${sy}px)`,
                                      color: n <= playedData.score ? '#ffd700' : 'rgba(255, 255, 255, 0.08)',
                                      fontSize: 8,
                                      textShadow: n <= playedData.score ? '0 0 4px #ffd700' : 'none'
                                    }}
                                  >
                                    ★
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Core Node Button */}
                        <div
                          style={{
                            width: isMobile ? 38 : 32,
                            height: isMobile ? 38 : 32,
                            borderRadius: '50%',
                            background: isLocked ? '#090d16' : (isCompleted ? `${activeColor}15` : '#060b13'),
                            border: `2px solid ${isLocked ? '#1e293b' : (isCurrent ? '#ffd700' : activeColor)}`,
                            color: isLocked ? '#475569' : '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: isMobile ? 14 : 12,
                            fontWeight: 800,
                            boxShadow: isLocked 
                              ? 'none' 
                              : `0 0 15px ${isCurrent ? 'rgba(255, 215, 0, 0.4)' : `${activeColor}30`}`,
                            textShadow: isLocked ? 'none' : '0 0 4px rgba(255,255,255,0.5)',
                            transition: 'background 0.2s, border-color 0.2s'
                          }}
                        >
                          {isLocked ? '🔒' : idx + 1}
                        </div>

                        {/* Level Name Label */}
                        <div
                          style={{
                            position: 'absolute',
                            top: isMobile ? 42 : 36,
                            background: 'rgba(3,7,18,0.92)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 6,
                            padding: '3px 8px',
                            fontSize: 8,
                            fontWeight: 700,
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
                        </div>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Level Detail Panel */}
      {!loading && activeTab === 'campaign' && viewMode === 'map' && gamepadSelectedNodeIndex !== null && (() => {
        const lv = filteredPresets[gamepadSelectedNodeIndex];
        if (!lv) return null;
        
        const isLocked = lv.firestoreId ? lockedSet.has(lv.firestoreId) : false;
        const playedData = lv.firestoreId ? playedMap.get(lv.firestoreId) : undefined;
        const isCompleted = playedData !== undefined;

        const activePart = partsMap.get(selectedPartId);
        const mapTheme = activePart?.mapTheme || 'cyber-grid';
        let accentColor = '#00ff88';
        if (mapTheme === 'retro-matrix') accentColor = '#22c55e';
        if (mapTheme === 'neon-abyss') accentColor = '#ec4899';
        if (mapTheme === 'cosmic-vortex') accentColor = '#a855f7';
        if (mapTheme === 'star-nebula') accentColor = '#6366f1';

        const DIFF_COLOR = { 1: '#00ff88', 2: '#fbbf24', 3: '#f97316', 4: '#ef4444' } as Record<number, string>;
        const difficultyColor = lv.difficulty ? DIFF_COLOR[lv.difficulty] : '#00ff88';

        return (
          <div
            style={{
              position: 'absolute',
              bottom: isMobile ? 74 : 86, // sits just above the horizontal world cards
              left: '50%',
              transform: 'translateX(-50%)',
              width: isMobile ? 'calc(100% - 16px)' : 'calc(100% - 24px)',
              maxWidth: 420,
              zIndex: 15,
              background: 'rgba(8, 12, 28, 0.85)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: isMobile ? 12 : 16,
              padding: isMobile ? '8px 12px' : '12px 16px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 255, 136, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: isMobile ? 8 : 12,
              transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
            }}
          >
            {/* Level Info */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569' }}>
                SEVİYE {gamepadSelectedNodeIndex + 1}
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {isLocked ? '🔒 Kilitli Bölüm' : lv.name}
              </span>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                {/* Difficulty pill */}
                {lv.difficulty && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: difficultyColor,
                    background: `${difficultyColor}12`,
                    border: `1px solid ${difficultyColor}30`,
                    borderRadius: 4,
                    padding: '1px 5px'
                  }}>
                    {t(`difficulty.${lv.difficulty}`)}
                  </span>
                )}

                {/* Complete details */}
                {isCompleted && playedData && (
                  <span style={{ fontSize: 9, color: '#64748b' }}>
                    {playedData.moveCount} Hamle · {formatTime(playedData.timeSpent)}
                  </span>
                )}
              </div>
            </div>

            {/* Stars (Center) */}
            {isCompleted && playedData && (
              <div style={{ display: 'flex', gap: 2, marginRight: 4 }}>
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    style={{
                      color: n <= playedData.score ? '#ffd700' : 'rgba(255, 255, 255, 0.1)',
                      fontSize: 14,
                      textShadow: n <= playedData.score ? '0 0 6px #ffd700' : 'none'
                    }}
                  >
                    ★
                  </span>
                ))}
              </div>
            )}

            {/* Action button */}
            <button
              onClick={() => {
                if (!isLocked) {
                  router.push(`/play?id=${lv.id}&source=preset`);
                }
              }}
              disabled={isLocked}
              style={{
                padding: '8px 18px',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                background: isLocked
                  ? 'rgba(71, 85, 105, 0.1)'
                  : `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}30 100%)`,
                border: `1px solid ${isLocked ? 'rgba(71, 85, 105, 0.2)' : `${accentColor}60`}`,
                color: isLocked ? '#475569' : '#fff',
                borderRadius: 10,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                boxShadow: isLocked ? 'none' : `0 0 15px ${accentColor}25`,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span>{isLocked ? 'KİLİTLİ' : 'OYNAT'}</span>
              {!isLocked && (
                <>
                  <span>▶</span>
                  {isConnected && (
                    <span style={{
                      background: '#00ff88',
                      color: '#030712',
                      fontSize: 9,
                      fontWeight: 800,
                      borderRadius: '50%',
                      width: 14,
                      height: 14,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 4,
                      boxShadow: '0 0 5px #00ff88'
                    }}>
                      A
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
        );
      })()}

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
              style={{ width: '100%', maxWidth: 1024, background: 'rgba(8, 12, 28, 0.55)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: isMobile ? '10px' : '24px', boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)' }}
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
                          onMouseEnter={() => setGamepadSelectedNodeIndex(idx)}
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
                            gamepadSelected={gamepadSelectedNodeIndex === idx}
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
                            onMouseEnter={() => setGamepadSelectedNodeIndex(idx)}
                          >
                            <LevelRow
                              level={lv} index={idx} total={userLevels.length}
                              isPreset={false} isMobile={isMobile} cols=""
                              onPlay={() => router.push(`/play?id=${lv.id}`)}
                              onEdit={() => router.push(`/editor?id=${lv.id}`)}
                              onDelete={() => handleDelete(lv.id)}
                              onMoveUp={() => move(idx, -1)} onMoveDown={() => move(idx, 1)}
                              gamepadSelected={gamepadSelectedNodeIndex === idx}
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
            bottom: isMobile ? 8 : 16, 
            left: isMobile ? 8 : 12, 
            right: isMobile ? 8 : 12, 
            zIndex: 10,
            display: 'flex',
            gap: isMobile ? 8 : 10,
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
                  padding: isMobile ? '6px 10px' : '10px 16px',
                  minWidth: isMobile ? 130 : 165,
                  borderRadius: isMobile ? 10 : 12,
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
                  gap: isMobile ? 2 : 3
                }}
              >
                <span style={{ fontSize: isMobile ? 8 : 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: isActive ? '#ffd700' : '#475569' }}>
                  CHAPTER {idx + 1}
                </span>
                <span style={{ fontSize: isMobile ? 11 : 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
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

      {/* Floating Center Active Level Button */}
      {!loading && activeTab === 'campaign' && viewMode === 'map' && (
        <button
          onClick={() => {
            centerActiveNode(true);
            setGamepadSelectedNodeIndex(defaultActiveIdx);
          }}
          style={{
            position: 'absolute',
            bottom: isMobile
              ? (gamepadSelectedNodeIndex !== null ? 186 : 126)
              : 134,
            right: 16,
            zIndex: 15,
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'rgba(8, 12, 28, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(255, 215, 0, 0.3)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4), 0 0 8px rgba(255, 215, 0, 0.1)',
            color: '#ffd700',
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
          title="Kaldığım Seviyeye Git"
        >
          🎯
        </button>
      )}

      {/* Floating View Mode Toggle Button */}
      {!loading && activeTab === 'campaign' && (
        <button
          onClick={() => setViewMode(prev => prev === 'map' ? 'list' : 'map')}
          style={{
            position: 'absolute',
            bottom: viewMode === 'map'
              ? (isMobile ? (gamepadSelectedNodeIndex !== null ? 138 : 78) : 82)
              : (isMobile ? 16 : 24),
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
            transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          }}
          title={viewMode === 'map' ? t('levels.view_list') : t('levels.view_map')}
        >
          {viewMode === 'map' ? '📋' : '🗺️'}
          {isConnected && (
            <span style={{
              position: 'absolute',
              top: -6,
              right: -6,
              background: '#38bdf8',
              color: '#030712',
              fontSize: 8,
              fontWeight: 900,
              borderRadius: '50%',
              width: 14,
              height: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 5px #38bdf8',
              border: '1px solid #030712'
            }}>
              Y
            </span>
          )}
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

