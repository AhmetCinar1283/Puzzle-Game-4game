'use client';

import { useCallback, useRef, useState } from 'react';
import { processSingleTick, updateRoomVisibility } from '../logic/engine/intentLoop';
import { checkWinCondition } from '../logic/winCondition';
import { Entity } from '../logic/entityTypes';
import { Cell } from '../logic/cellTypes';
import { ActionIntent, TickSnapshot, UIEvent, RoomState } from '../logic/types';
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

function cloneRooms(rooms: Record<string, RoomState>): Record<string, RoomState> {
    const clone: Record<string, RoomState> = {};
    for (const [rId, room] of Object.entries(rooms)) {
        clone[rId] = {
            ...room,
            edges: { ...room.edges },
            grid: room.grid.map(row =>
                row.map(cell => ({
                    ...cell,
                    def: { ...cell.def },
                    customData: { ...cell.customData },
                }))
            ),
        };
    }
    return clone;
}

interface UseGameEngineOptions {
    initialEntities: Entity[];
    initialGrid?: Cell[][];
    initialRooms?: Record<string, RoomState>;
    controlMode?: 'all_rooms' | 'selected_room';
    initialControlledRooms?: string[];
    levelEdges?: LevelEdges;
    trailCollision?: boolean;
}

export function useGameEngine({
    initialEntities,
    initialGrid,
    initialRooms,
    controlMode = 'all_rooms',
    initialControlledRooms,
    levelEdges,
    trailCollision
}: UseGameEngineOptions) {
    
    // Normalleştirilmiş odalar sözlüğünü oluştur
    const normalizedInitialRooms = (() => {
        if (initialRooms) return cloneRooms(initialRooms);
        
        // Geriye dönük uyumluluk: initialGrid'i tek bir odaya sar
        const roomId = 'main';
        const grid = initialGrid ? initialGrid.map(row =>
            row.map(cell => ({
                ...cell,
                position: { ...cell.position, roomId },
                def: { ...cell.def },
                customData: { ...cell.customData },
            }))
        ) : [];
        
        const edges = {
            top:    typeof levelEdges?.top === 'string' ? { type: levelEdges.top } : (levelEdges?.top || { type: 'wall' }),
            bottom: typeof levelEdges?.bottom === 'string' ? { type: levelEdges.bottom } : (levelEdges?.bottom || { type: 'wall' }),
            left:   typeof levelEdges?.left === 'string' ? { type: levelEdges.left } : (levelEdges?.left || { type: 'wall' }),
            right:  typeof levelEdges?.right === 'string' ? { type: levelEdges.right } : (levelEdges?.right || { type: 'wall' }),
        } as RoomState['edges'];

        return {
            [roomId]: {
                id: roomId,
                name: 'Main Room',
                width: grid[0]?.length ?? 0,
                height: grid.length,
                x: 0, y: 0,
                edges,
                grid,
            }
        };
    })();

    updateRoomVisibility(initialEntities, normalizedInitialRooms);

    const entitiesRef = useRef<Entity[]>(initialEntities);
    const roomsRef = useRef<Record<string, RoomState>>(normalizedInitialRooms);
    
    const resolvedInitialControlledRooms = initialControlledRooms ?? Object.keys(normalizedInitialRooms);
    const [controlledRoomIds, setControlledRoomIds] = useState<string[]>(resolvedInitialControlledRooms);
    const controlledRoomIdsRef = useRef<string[]>(resolvedInitialControlledRooms);
    
    const isGameOverRef = useRef(false);
    const isAnimatingInternalRef = useRef(false);

    const [snapshots, setSnapshots] = useState<TickSnapshot[]>(() => [{
        tickNumber: 0,
        rooms: cloneRooms(normalizedInitialRooms),
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

        // Seviye sınırlarını ve odaları derle
        const levelBounds: LevelBounds = {
            rooms: Object.entries(roomsRef.current).reduce((acc, [rId, room]) => {
                acc[rId] = { rows: room.height, cols: room.width, edges: room.edges };
                return acc;
            }, {} as Record<string, { rows: number; cols: number; edges: RoomState['edges'] }>),
            trailCollision: !!trailCollision,
        };

        const collectedSnapshots: TickSnapshot[] = [];
        const collectedUi: UIEvent[] = [];

        collectedSnapshots.push({
            tickNumber: 0,
            rooms: cloneRooms(roomsRef.current),
            entities: cloneEntities(entitiesRef.current),
            vfxEvents: [],
            uiEvents: [],
        });

        let pending = [...startingIntents];
        let tickNumber = 0;

        while (tickNumber < MAX_TICKS) {
            // Fiziksel hareket devam ediyorsa loop sürdürülür
            const hasActivePhysics = entitiesRef.current.some(e =>
                !e.customData._destroyed && (e.physics.force > 0 || e.physics.z > 0)
            );
            if (pending.length === 0 && !hasActivePhysics) break;

            const playerCountBefore = entitiesRef.current.filter(e => e.type === 'player').length;

            const result = processSingleTick(
                entitiesRef.current,
                roomsRef.current,
                pending,
                levelBounds,
            );

            tickNumber++;

            const tickVfxEvents = [...result.vfxEvents];
            if (tickNumber === 1) {
                tickVfxEvents.unshift('sound_move');
            }

            const snapshotEntities = cloneEntities(entitiesRef.current);

            entitiesRef.current = entitiesRef.current.filter(
                e => !e.customData._destroyed
            );

            const playerCountAfter = entitiesRef.current.filter(e => e.type === 'player').length;
            const playerDestroyed = playerCountAfter < playerCountBefore;

            const isWin = checkWinCondition(entitiesRef.current, roomsRef.current);

            if (isWin) {
                for (const ent of entitiesRef.current) {
                    if (ent.type === 'player') ent.customData.isVictory = true;
                }
                for (const ent of snapshotEntities) {
                    if (ent.type === 'player') ent.customData.isVictory = true;
                }
            }

            const tickUiEvents: UIEvent[] = [...result.uiEvents];

            // Oda kontrol değişikliklerini dinle ve ref'i güncelle
            for (const uiEv of tickUiEvents) {
                if (uiEv.kind === 'change_control') {
                    const { action, targetRooms } = uiEv;
                    let nextIds = [...controlledRoomIdsRef.current];
                    if (action === 'set') {
                        nextIds = targetRooms;
                    } else if (action === 'add') {
                        nextIds = Array.from(new Set([...nextIds, ...targetRooms]));
                    } else if (action === 'remove') {
                        nextIds = nextIds.filter(id => !targetRooms.includes(id));
                    } else if (action === 'toggle') {
                        for (const tr of targetRooms) {
                            if (nextIds.includes(tr)) {
                                nextIds = nextIds.filter(id => id !== tr);
                            } else {
                                nextIds.push(tr);
                            }
                        }
                    } else if (action === 'cycle') {
                        const roomKeys = Object.keys(roomsRef.current);
                        if (roomKeys.length > 0) {
                            const currentIdx = roomKeys.indexOf(nextIds[0] ?? '');
                            const nextIdx = (currentIdx + 1) % roomKeys.length;
                            nextIds = [roomKeys[nextIdx]];
                        }
                    }
                    controlledRoomIdsRef.current = nextIds;
                }
            }

            if (isWin) {
                tickUiEvents.push(
                    { kind: 'text', textType: 'success', message: 'Tebrikler! Bölüm tamamlandı!' },
                    { kind: 'button', buttonType: 'next_level', label: 'Sonraki Bölüm' },
                );
            }

            collectedSnapshots.push({
                tickNumber,
                rooms: cloneRooms(roomsRef.current),
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
        
        // Turn sonunda state'i ref'ten besle
        setControlledRoomIds(controlledRoomIdsRef.current);
    }, [trailCollision]);

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

    const reset = useCallback((newEntities: Entity[], newRooms: Record<string, RoomState> | Cell[][], newControlledRooms?: string[]) => {
        let normalizedRooms: Record<string, RoomState> = {};
        if (Array.isArray(newRooms)) {
            const roomId = 'main';
            const grid = newRooms.map(row =>
                row.map(cell => ({
                    ...cell,
                    position: { ...cell.position, roomId },
                    def: { ...cell.def },
                    customData: { ...cell.customData },
                }))
            );
            const edges = {
                top:    typeof levelEdges?.top === 'string' ? { type: levelEdges.top } : (levelEdges?.top || { type: 'wall' }),
                bottom: typeof levelEdges?.bottom === 'string' ? { type: levelEdges.bottom } : (levelEdges?.bottom || { type: 'wall' }),
                left:   typeof levelEdges?.left === 'string' ? { type: levelEdges.left } : (levelEdges?.left || { type: 'wall' }),
                right:  typeof levelEdges?.right === 'string' ? { type: levelEdges.right } : (levelEdges?.right || { type: 'wall' }),
            } as RoomState['edges'];

            normalizedRooms = {
                [roomId]: {
                    id: roomId,
                    name: 'Main Room',
                    width: grid[0]?.length ?? 0,
                    height: grid.length,
                    x: 0, y: 0,
                    edges,
                    grid,
                }
            };
        } else {
            normalizedRooms = cloneRooms(newRooms);
        }

        updateRoomVisibility(newEntities, normalizedRooms);

        entitiesRef.current = newEntities;
        roomsRef.current = normalizedRooms;

        const resolvedControlled = newControlledRooms ?? Object.keys(normalizedRooms);
        controlledRoomIdsRef.current = resolvedControlled;
        setControlledRoomIds(resolvedControlled);

        isGameOverRef.current = false;
        setIsGameOver(false);
        setSnapshots([{
            tickNumber: 0,
            rooms: cloneRooms(normalizedRooms),
            entities: cloneEntities(newEntities),
            vfxEvents: [],
            uiEvents: [],
        }]);
        setUiEvents([]);
        setIsAnimating(false);
        isAnimatingInternalRef.current = false;
    }, [levelEdges]);

    return {
        snapshots,
        rooms: roomsRef.current,
        controlledRoomIds,
        setControlledRoomIds: (ids: string[]) => {
            controlledRoomIdsRef.current = ids;
            setControlledRoomIds(ids);
        },
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
