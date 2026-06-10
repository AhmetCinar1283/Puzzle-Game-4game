'use client';

import { useCallback, useRef, useState } from 'react';
import { processSingleTick } from '../logic/engine/intentLoop';
import { checkWinCondition } from '../logic/winCondition';
import { Entity } from '../logic/entityTypes';
import { Cell } from '../logic/cellTypes';
import { ActionIntent, TickSnapshot, UIEvent } from '../logic/types';
import { LevelEdges, LevelBounds } from '../logic/engine/getNextTopologyPosition';

const MAX_TICKS = 50;

function cloneEntities(entities: Entity[]): Entity[] {
    return entities.map(e => ({
        ...e,
        position: { ...e.position },
        physics: { ...e.physics },
        def: { ...e.def },
        traits: new Set(e.traits),
        customData: { ...e.customData },
    }));
}

function cloneGrid(grid: Cell[][]): Cell[][] {
    return grid.map(row =>
        row.map(cell => ({
            ...cell,
            def: { ...cell.def },
            customData: { ...cell.customData },
        }))
    );
}

interface UseGameEngineOptions {
    initialEntities: Entity[];
    initialGrid: Cell[][];
    levelEdges?: LevelEdges;
    trailCollision?: boolean;
}

export function useGameEngine({ initialEntities, initialGrid, levelEdges, trailCollision }: UseGameEngineOptions) {
    const entitiesRef = useRef<Entity[]>(initialEntities);
    const gridRef = useRef<Cell[][]>(initialGrid);
    const isGameOverRef = useRef(false);
    const isAnimatingInternalRef = useRef(false);

    const [snapshots, setSnapshots] = useState<TickSnapshot[]>(() => [{
        tickNumber: 0,
        grid: cloneGrid(initialGrid),
        entities: cloneEntities(initialEntities),
        vfxEvents: [],
        uiEvents: [],
    }]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [uiEvents, setUiEvents] = useState<UIEvent[]>([]);
    const [isGameOver, setIsGameOver] = useState(false);

    const getEntities = useCallback(() => entitiesRef.current, []);

    const executeTurn = useCallback((startingIntents: ActionIntent[]) => {
        if (isGameOverRef.current) return;

        // Her tur başlangıcında geçici animasyon ve durum verilerini temizle
        for (const ent of entitiesRef.current) {
            delete ent.customData.bumpDirection;
            delete ent.customData.bumpReason;
            delete ent.customData.deathReason;
            delete ent.customData.isVictory;
        }

        // Grid boyutlarından level bounds hesapla
        const levelBounds: LevelBounds = {
            rows: gridRef.current.length,
            cols: gridRef.current[0]?.length ?? 0,
            edges: levelEdges ?? { top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' },
            trailCollision: !!trailCollision,
        };

        const collectedSnapshots: TickSnapshot[] = [];
        const collectedUi: UIEvent[] = [];

        collectedSnapshots.push({
            tickNumber: 0,
            grid: cloneGrid(gridRef.current),
            entities: cloneEntities(entitiesRef.current),
            vfxEvents: [],
            uiEvents: [],
        });

        let pending = [...startingIntents];
        let tickNumber = 0;

        while (tickNumber < MAX_TICKS) {
            // Beklenen intent yoksa bile entity'lerde aktif fizik (uçuş/kayma)
            // varsa döngüyü sürdür — onTick bir sonraki tick'te intent üretir.
            const hasActivePhysics = entitiesRef.current.some(e =>
                !e.customData._destroyed && (e.physics.force > 0 || e.physics.z > 0)
            );
            if (pending.length === 0 && !hasActivePhysics) break;

            const playerCountBefore = entitiesRef.current.filter(e => e.type === 'player').length;

            const result = processSingleTick(
                entitiesRef.current,
                gridRef.current,
                pending,
                levelBounds,
            );

            tickNumber++;

            const tickVfxEvents = [...result.vfxEvents];
            if (tickNumber === 1) {
                tickVfxEvents.unshift('sound_move');
            }

            // Yok edilen entity'leri grid'den silmeden önce klonla (animasyonun doğru karede görünmesi için)
            const snapshotEntities = cloneEntities(entitiesRef.current);

            entitiesRef.current = entitiesRef.current.filter(
                e => !e.customData._destroyed
            );

            const playerCountAfter = entitiesRef.current.filter(e => e.type === 'player').length;
            const playerDestroyed = playerCountAfter < playerCountBefore;

            const isWin = checkWinCondition(entitiesRef.current, gridRef.current);

            if (isWin) {
                for (const ent of entitiesRef.current) {
                    if (ent.type === 'player') ent.customData.isVictory = true;
                }
                for (const ent of snapshotEntities) {
                    if (ent.type === 'player') ent.customData.isVictory = true;
                }
            }

            const tickUiEvents: UIEvent[] = [...result.uiEvents];

            if (isWin) {
                tickUiEvents.push(
                    { kind: 'text', textType: 'success', message: 'Tebrikler! Bölüm tamamlandı!' },
                    { kind: 'button', buttonType: 'next_level', label: 'Sonraki Bölüm' },
                );
            }

            collectedSnapshots.push({
                tickNumber,
                grid: cloneGrid(gridRef.current),
                entities: snapshotEntities,
                vfxEvents: tickVfxEvents,
                uiEvents: tickUiEvents,
            });

            collectedUi.push(...tickUiEvents);
            pending = result.pendingNextTick;

            if (isWin || playerDestroyed) {
                isGameOverRef.current = true;
                break;
            }
        }

        setSnapshots(prev => {
            if (prev.length === 0 || !isAnimatingInternalRef.current) {
                return collectedSnapshots;
            }
            return [...prev, ...collectedSnapshots.slice(1)];
        });
        if (collectedUi.length > 0) {
            setUiEvents(prev => [...prev, ...collectedUi]);
        }
        if (isGameOverRef.current) {
            setIsGameOver(true);
        }
        if (collectedSnapshots.length > 1) {
            setIsAnimating(true);
            isAnimatingInternalRef.current = true;
        }
    }, [levelEdges, trailCollision]);

    const onAnimationEnd = useCallback(() => {
        setIsAnimating(false);
        isAnimatingInternalRef.current = false;
        setSnapshots(prev => {
            if (prev.length > 0) {
                return [prev[prev.length - 1]];
            }
            return prev;
        });
    }, []);

    const cancelAnimation = useCallback(() => {
        if (!isAnimatingInternalRef.current) return;
        setSnapshots(prev => {
            if (prev.length > 0) {
                return [prev[prev.length - 1]];
            }
            return prev;
        });
        setIsAnimating(false);
        isAnimatingInternalRef.current = false;
    }, []);

    const clearUiEvents = useCallback(() => setUiEvents([]), []);

    const reset = useCallback((newEntities: Entity[], newGrid: Cell[][]) => {
        entitiesRef.current = newEntities;
        gridRef.current = newGrid;
        isGameOverRef.current = false;
        setIsGameOver(false);
        setSnapshots([]);
        setUiEvents([]);
        setIsAnimating(false);
        isAnimatingInternalRef.current = false;
    }, []);

    return {
        snapshots,
        isAnimating,
        isGameOver,
        uiEvents,
        executeTurn,
        onAnimationEnd,
        cancelAnimation,
        clearUiEvents,
        reset,
        getEntities,
    };
}
