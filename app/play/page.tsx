'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { StoredLevel } from '@/app/src/lib/db';
import { useUserStorage } from '@/app/src/lib/userStorage';
import { PlayScreen } from '@/app/src/game2/components/PlayScreen';
import { convertToGame2State } from './converter';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorScreen } from './components/ErrorScreen';
import { WinResultOverlay } from './components/WinResultOverlay';
import type { UIButtonType, Direction } from '@/app/src/game2/logic/types';
import type { Entity } from '@/app/src/game2/logic/entityTypes';
import type { Cell } from '@/app/src/game2/logic/cellTypes';
import { useT } from '../src/contexts/LanguageContext';

// ─── Worker tipi (docs/scoring.md) ──────────────────────────────────────────

interface WorkerResult {
    success: boolean;
    stars?: 1 | 2 | 3;
    scoreDelta?: number;
    isFirstCompletion?: boolean;
    isNewBestSolution?: boolean;
    isBestSolution?: boolean;
    isGoodSolution?: boolean;
}

// ─── StoredLevel → LevelData yardımcısı (game/page.tsx ile aynı) ─────────────

function storedToLevelData(stored: StoredLevel & { id: number }) {
    return {
        ...stored,
        grid: typeof stored.grid === 'string' ? JSON.parse(stored.grid) : stored.grid,
    } as StoredLevel & { id: number };
}

// ─── Inner component ─────────────────────────────────────────────────────────

function PlayContent() {
    const t = useT();
    const searchParams = useSearchParams();
    const router = useRouter();

    const idParam = searchParams.get('id');
    const source = searchParams.get('source');
    const isPreset = source === 'preset';
    const levelId = idParam ? Number(idParam) : null;

    const { setItem: storageSet } = useUserStorage();

    // ── Seviye yükleme state'leri ────────────────────────────
    const [levelName, setLevelName] = useState<string>('');
    const [firestoreId, setFirestoreId] = useState<string | undefined>();
    const [game2State, setGame2State] = useState<{ entities: Entity[]; grid: Cell[][] } | null>(null);
    const [nextLevelId, setNextLevelId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // ── Oyun izleme ──────────────────────────────────────────
    const moveHistoryRef = useRef<string[]>([]); // 'u' | 'd' | 'l' | 'r'
    const startTimeRef = useRef(Date.now());
    const [restartKey, setRestartKey] = useState(0);

    // ── Win overlay ──────────────────────────────────────────
    const [showWin, setShowWin] = useState(false);
    const [workerResult, setWorkerResult] = useState<WorkerResult | null>(null);

    // ── Seviye yükleme ───────────────────────────────────────
    useEffect(() => {
        if (levelId === null) { router.replace('/levels'); return; }

        setLoading(true);
        setGame2State(null);
        setNextLevelId(null);
        setError(false);
        setShowWin(false);
        setWorkerResult(null);
        moveHistoryRef.current = [];
        startTimeRef.current = Date.now();

        let cancelled = false;

        async function load() {
            try {
                let stored: (StoredLevel & { id: number }) | undefined;
                let nextId: number | null = null;

                if (isPreset) {
                    const { getDB, getNextPresetLevelId } = await import('@/app/src/lib/db');
                    const db = getDB();
                    let raw = await db.presetLevels.get(levelId!);
                    if (cancelled) return;
                    if (!raw) { setError(true); setLoading(false); return; }
                    
                    if ((raw.isNeedSync || !raw.grid?.length) && raw.firestoreId) {
                        try {
                            const { fetchAndCacheLevel } = await import('@/app/src/lib/firebase/sync');
                            await fetchAndCacheLevel(raw.firestoreId, raw.id!);
                            raw = await db.presetLevels.get(levelId!);
                        } catch (err) {
                            console.warn('[Play] Lazy fetch failed:', err);
                            console.log("5")
                        }
                        if (cancelled) return;
                        if (!raw) { setError(true); setLoading(false); return; }
                    }
                    
                    stored = storedToLevelData(raw as StoredLevel & { id: number });
                    nextId = await getNextPresetLevelId(levelId!);
                    console.log("8")
                    storageSet('lastPlayedLevelId', String(levelId));
                    storageSet('lastPlayedSource', 'preset');
                } else {
                    const { getDB, getNextLevelId } = await import('@/app/src/lib/db');
                    const db = getDB();
                    const raw = await db.levels.get(levelId!);
                    if (cancelled) return;
                    if (!raw) { setError(true); setLoading(false); return; }
                    
                    stored = storedToLevelData(raw as StoredLevel & { id: number });
                    nextId = await getNextLevelId(levelId!);
                    console.log("12")
                    storageSet('lastPlayedLevelId', String(levelId));
                    storageSet('lastPlayedSource', 'user');
                }
                
                if (cancelled) return;
                setLevelName(stored.name ?? '');
                setFirestoreId(stored.firestoreId);
                setGame2State(convertToGame2State(stored));
                setNextLevelId(nextId);
            } catch (err) {
                console.error('[Play] Level load error:', err);
                if (!cancelled) setError(true);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        load();
        return () => { cancelled = true; };
    }, [levelId, isPreset, router, restartKey]);

    // ── Move tracking ─────────────────────────────────────────
    const handleMoveExecuted = useCallback((direction: Direction) => {
        const map: Record<Direction, string> = { up: 'u', down: 'd', left: 'l', right: 'r' };
        moveHistoryRef.current.push(map[direction]);
    }, []);

    // ── Worker çağrısı (kazanma) ──────────────────────────────
    const callWorker = useCallback(async () => {
        if (!firestoreId) return; // Kullanıcı seviyelerinde worker yok
        const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL;
        if (!WORKER_URL) return;

        const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);

        try {
            const res = await fetch(`${WORKER_URL}/complete-level`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    levelId: firestoreId,
                    moves: moveHistoryRef.current,
                    timeSpent,
                }),
            });
            if (res.ok) {
                const data: WorkerResult = await res.json();
                setWorkerResult(data);

                // Dexie'ye de kaydet (anlık — sync beklemeden)
                if (data.success && data.stars) {
                    try {
                        const { getDB } = await import('@/app/src/lib/db');
                        const { savePlayedLevel } = await import('@/app/src/lib/firebase/firestore');
                        const { getCurrentUser } = await import('@/app/src/lib/firebase/config')
                            .then(m => ({ getCurrentUser: () => m.auth.currentUser }));
                        const user = getCurrentUser();
                        if (user) {
                            await savePlayedLevel(user.uid, String(levelId!), {
                                score: data.stars,
                                timeSpent: Math.round((Date.now() - startTimeRef.current) / 1000),
                            });
                        }
                        // Dexie anlık kayıt
                        const db = getDB();
                        const existing = isPreset
                            ? await db.presetLevels.get(levelId!)
                            : null;
                        void existing; // Şimdilik kullanılmıyor — sync zaten halleder
                    } catch (e) {
                        console.warn('[Play] Dexie local save failed:', e);
                    }
                }
            }
        } catch (err) {
            console.warn('[Play] Worker call failed:', err);
            // Worker olmadan da oyun devam eder — sonuç overlay'i gösterilir
            setWorkerResult({ success: false });
        }
    }, [firestoreId, levelId, isPreset]);

    // ── UI button handler ─────────────────────────────────────
    const handleButtonPressed = useCallback((buttonType: UIButtonType) => {
        if (buttonType === 'next_level') {
            // Kazandı → worker çağır, win overlay göster
            setShowWin(true);
            callWorker();
        } else if (buttonType === 'restart') {
            moveHistoryRef.current = [];
            startTimeRef.current = Date.now();
            setRestartKey(k => k + 1); // PlayScreen'i sıfırla
        } else if (buttonType === 'menu') {
            router.push('/levels');
        }
    }, [callWorker, router]);

    // ── Next level navigasyon ─────────────────────────────────
    const handleNextLevel = useCallback(() => {
        if (nextLevelId !== null) {
            router.push(isPreset
                ? `/play?id=${nextLevelId}&source=preset`
                : `/play?id=${nextLevelId}`
            );
        }
    }, [nextLevelId, isPreset, router]);

    // ── Render ───────────────────────────────────────────────
    if (loading) return <LoadingScreen />;
    if (error || !game2State) return <ErrorScreen onBack={() => router.push('/levels')} />;

    return (
        <main style={{
            height: '100dvh',
            background: '#030712',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 8px',
            boxSizing: 'border-box',
            overflow: 'hidden',
        }}>
            {/* Geri butonu */}
            <button
                onClick={() => router.push('/levels')}
                style={{
                    position: 'fixed',
                    top: 12,
                    left: 16,
                    background: 'none',
                    border: 'none',
                    color: '#1e3a5f',
                    fontSize: 12,
                    cursor: 'pointer',
                    letterSpacing: '0.06em',
                    zIndex: 30,
                }}
            >
                {t('game.back')}
            </button>

            {/* Bölüm adı */}
            {levelName && (
                <span style={{
                    position: 'fixed',
                    top: 14,
                    color: '#1e3a5f',
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    zIndex: 30,
                }}>
                    {levelName}
                </span>
            )}

            {/* Oyun tahtası */}
            <PlayScreen
                key={`${levelId}-${restartKey}`}
                initialEntities={game2State.entities}
                initialGrid={game2State.grid}
                onMoveExecuted={handleMoveExecuted}
                onButtonPressed={handleButtonPressed}
            />

            {/* Kazanma result overlay */}
            {showWin && (
                <WinResultOverlay
                    result={workerResult}
                    onNextLevel={nextLevelId !== null ? handleNextLevel : undefined}
                    onMenu={() => router.push('/levels')}
                />
            )}
        </main>
    );
}

// ─── Page export ─────────────────────────────────────────────────────────────

export default function PlayPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <PlayContent />
        </Suspense>
    );
}
