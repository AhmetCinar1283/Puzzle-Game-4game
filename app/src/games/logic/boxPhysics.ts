import type { BoxState, CellType, Direction, GameObjectState, LevelData, Position } from '../types';
import { DELTA, posKey, posEqual, cellTypeToConveyorDir } from './positionUtils';
import { isBoxPushable, isConveyorActive } from './powerSystem';
import { resolveIceSlide } from './iceSlide';
import { applyEntityTeleport } from './teleporter';

// ─── Edge resolution ─────────────────────────────────────────────────────────

type EdgeResult = Position | null | 'lava';

function resolveEdgePosition(candidate: Position, level: LevelData): EdgeResult {
  let { row, col } = candidate;
  if (row < 0) {
    if (level.edges.top === 'portal') row = level.height - 1;
    else if (level.edges.top === 'lava') return 'lava';
    else return null;
  } else if (row >= level.height) {
    if (level.edges.bottom === 'portal') row = 0;
    else if (level.edges.bottom === 'lava') return 'lava';
    else return null;
  }
  if (col < 0) {
    if (level.edges.left === 'portal') col = level.width - 1;
    else if (level.edges.left === 'lava') return 'lava';
    else return null;
  } else if (col >= level.width) {
    if (level.edges.right === 'portal') col = 0;
    else if (level.edges.right === 'lava') return 'lava';
    else return null;
  }
  return { row, col };
}

// ─── Chain push ───────────────────────────────────────────────────────────────

/**
 * Recursively pushes a chain of boxes one step in the given direction (Sokoban-style).
 *
 * Returns:
 *   Map<boxId, newPos>  all boxes in the chain with final positions (ice + teleport resolved)
 *   'lava'              terminal box hit a lava edge; caller destroys all chain boxes
 *   null                push blocked
 *
 * chainIds: boxes already in this call stack (cycle guard for portal edge loops).
 */
export function computeBoxChainPush(
  box: BoxState,
  direction: Direction,
  grid: CellType[][],
  level: LevelData,
  poweredCells: Set<string>,
  allBoxes: BoxState[],
  allObjects: GameObjectState[],
  chainIds: Set<number>,
): Map<number, Position> | 'lava' | null {
  if (chainIds.has(box.id)) return null;
  if (!isBoxPushable(box, poweredCells)) return null;

  const { dRow, dCol } = DELTA[direction];
  const resolved = resolveEdgePosition(
    { row: box.position.row + dRow, col: box.position.col + dCol },
    level,
  );
  if (resolved === 'lava') return 'lava';
  if (!resolved) return null;
  if (grid[resolved.row][resolved.col] === 'obstacle') return null;
  if (allObjects.some((o) => posEqual(o.position, resolved))) return null;

  // Another box at destination → recurse
  const nextBox = allBoxes.find((b) => b.id !== box.id && posEqual(b.position, resolved));
  let subChain: Map<number, Position> | null = null;

  if (nextBox) {
    const sub = computeBoxChainPush(
      nextBox, direction, grid, level, poweredCells, allBoxes, allObjects,
      new Set([...chainIds, box.id]),
    );
    if (sub === null) return null;
    if (sub === 'lava') return 'lava';
    subChain = sub;
  }

  // Blocker for ice slide: chain boxes use their projected (vacated) positions
  const isBlockingForBox = (p: Position): boolean => {
    if (grid[p.row]?.[p.col] === 'obstacle') return true;
    if (allObjects.some((o) => posEqual(o.position, p))) return true;
    for (const b of allBoxes) {
      if (b.id === box.id) continue;
      const effectivePos = subChain?.get(b.id) ?? b.position;
      if (posEqual(effectivePos, p)) return true;
    }
    return false;
  };

  let finalPos = resolved;

  if (grid[resolved.row][resolved.col] === 'ice') {
    const { finalPos: slid } = resolveIceSlide(resolved, direction, grid, level, isBlockingForBox);
    finalPos = slid;
  }

  // Teleport using projected sub-chain positions for exit occupancy
  const projectedForTeleport = allBoxes.map((b) =>
    subChain?.has(b.id) ? { ...b, position: subChain.get(b.id)! } : b,
  );
  finalPos = applyEntityTeleport(finalPos, grid, projectedForTeleport, allObjects, box.id, true);

  if (grid[finalPos.row]?.[finalPos.col] === 'ice') {
    const { finalPos: slid2 } = resolveIceSlide(finalPos, direction, grid, level, isBlockingForBox);
    finalPos = slid2;
  }

  const result = new Map<number, Position>(subChain ?? []);
  result.set(box.id, finalPos);
  return result;
}

// ─── Public single-box push API ───────────────────────────────────────────────

/**
 * Thin wrapper: pushes a box (plus any chain behind it), returns this box's new position.
 */
export function computeBoxPush(
  box: BoxState,
  direction: Direction,
  grid: CellType[][],
  level: LevelData,
  poweredCells: Set<string>,
  allBoxes: BoxState[],
  allObjects: GameObjectState[],
): Position | 'lava' | null {
  const result = computeBoxChainPush(
    box, direction, grid, level, poweredCells, allBoxes, allObjects, new Set(),
  );
  if (result === null || result === 'lava') return result;
  return result.get(box.id) ?? null;
}

// ─── Conveyor phase ───────────────────────────────────────────────────────────

/**
 * Processes conveyor belts for one full pass.
 *
 * - Player on conveyor hitting a box: chain push. If blocked, player stays (no overlap).
 * - Box on conveyor hitting a player: push player 1 step. If blocked, box stays (no overlap).
 */
export function processConveyors(
  boxes: BoxState[],
  objects: GameObjectState[],
  grid: CellType[][],
  level: LevelData,
  poweredCells: Set<string>,
): { newBoxes: BoxState[]; newObjects: GameObjectState[] } {
  let currentBoxes = [...boxes];
  let currentObjects = [...objects];

  const maxIter = level.width * level.height;

  const boxVisited = new Map<number, Set<string>>();
  const playerVisited = new Map<number, Set<string>>();
  for (const b of boxes) boxVisited.set(b.id, new Set());
  for (const o of objects) playerVisited.set(o.id, new Set());

  for (let iter = 0; iter < maxIter; iter++) {
    let anyMoved = false;

    // ── Boxes on conveyors ────────────────────────────────────────────────
    const boxMoves = new Map<number, Position>();
    const lavaBoxIds = new Set<number>();
    const pendingPlayerFromBox = new Map<number, Position>();

    for (const box of currentBoxes) {
      const cell = grid[box.position.row]?.[box.position.col];
      const convDir = cell ? cellTypeToConveyorDir(cell) : null;
      if (!convDir || !isConveyorActive(box.position, level, poweredCells)) continue;
      const visited = boxVisited.get(box.id);
      if (!visited || visited.has(posKey(box.position))) continue;

      const { dRow, dCol } = DELTA[convDir];
      const resolved = resolveEdgePosition(
        { row: box.position.row + dRow, col: box.position.col + dCol }, level,
      );
      if (resolved === 'lava') { lavaBoxIds.add(box.id); continue; }
      if (!resolved || grid[resolved.row][resolved.col] === 'obstacle') continue;
      // Box-on-box: conveyor stops (no chain from conveyor)
      if (currentBoxes.some((b) => b.id !== box.id && posEqual(b.position, resolved))) continue;

      const playerAtDest = currentObjects.find((o) => posEqual(o.position, resolved));
      if (playerAtDest) {
        const { dRow: pdr, dCol: pdc } = DELTA[convDir];
        const playerDest = resolveEdgePosition(
          { row: resolved.row + pdr, col: resolved.col + pdc }, level,
        );
        if (
          playerDest && playerDest !== 'lava' &&
          grid[playerDest.row]?.[playerDest.col] !== 'obstacle' &&
          !currentObjects.some((o) => o.id !== playerAtDest.id && posEqual(o.position, playerDest)) &&
          !currentBoxes.some((b) => posEqual(b.position, playerDest))
        ) {
          const teleportedBox = applyEntityTeleport(resolved, grid, currentBoxes, currentObjects, box.id, true);
          boxMoves.set(box.id, teleportedBox);
          const teleportedPlayer = applyEntityTeleport(playerDest, grid, currentBoxes, currentObjects, playerAtDest.id, false);
          pendingPlayerFromBox.set(playerAtDest.id, teleportedPlayer);
        }
        // Player can't move → box stays
        continue;
      }

      const teleported = applyEntityTeleport(resolved, grid, currentBoxes, currentObjects, box.id, true);
      boxMoves.set(box.id, teleported);
    }

    // Apply box moves
    let nextBoxes: BoxState[] = currentBoxes
      .filter((b) => !lavaBoxIds.has(b.id))
      .map((box) => {
        const newPos = boxMoves.get(box.id);
        if (!newPos) return box;
        boxVisited.get(box.id)!.add(posKey(box.position));
        anyMoved = true;
        return { ...box, position: newPos };
      });
    if (lavaBoxIds.size > 0) anyMoved = true;

    // Apply player moves from box-pushes-player
    let nextObjects: GameObjectState[] = currentObjects.map((obj) => {
      const newPos = pendingPlayerFromBox.get(obj.id);
      if (!newPos) return obj;
      playerVisited.get(obj.id)!.add(posKey(obj.position));
      anyMoved = true;
      return { ...obj, position: newPos };
    });

    const survivingBoxes = nextBoxes.filter(
      (b) => grid[b.position.row]?.[b.position.col] !== 'forbidden',
    );

    // ── Players on conveyors ──────────────────────────────────────────────
    const playerMoves = new Map<number, Position>();
    const pendingBoxFromPlayer = new Map<number, Position>();

    for (const obj of nextObjects) {
      const cell = grid[obj.position.row]?.[obj.position.col];
      const convDir = cell ? cellTypeToConveyorDir(cell) : null;
      if (!convDir || !isConveyorActive(obj.position, level, poweredCells)) continue;
      const visited = playerVisited.get(obj.id);
      if (!visited || visited.has(posKey(obj.position))) continue;

      const { dRow, dCol } = DELTA[convDir];
      const resolved = resolveEdgePosition(
        { row: obj.position.row + dRow, col: obj.position.col + dCol }, level,
      );
      if (!resolved || resolved === 'lava') continue;
      if (grid[resolved.row][resolved.col] === 'obstacle') continue;
      if (nextObjects.some((o) => o.id !== obj.id && posEqual(o.position, resolved))) continue;

      const boxAtDest = survivingBoxes.find((b) => posEqual(b.position, resolved));
      if (boxAtDest) {
        const chainResult = computeBoxChainPush(
          boxAtDest, convDir, grid, level, poweredCells, survivingBoxes, nextObjects, new Set(),
        );
        if (!chainResult || chainResult === 'lava') continue; // player blocked
        for (const [boxId, newPos] of chainResult) pendingBoxFromPlayer.set(boxId, newPos);
        const teleported = applyEntityTeleport(resolved, grid, survivingBoxes, nextObjects, obj.id, false);
        playerMoves.set(obj.id, teleported);
        continue;
      }

      const teleported = applyEntityTeleport(resolved, grid, survivingBoxes, nextObjects, obj.id, false);
      playerMoves.set(obj.id, teleported);
    }

    nextObjects = nextObjects.map((obj) => {
      const newPos = playerMoves.get(obj.id);
      if (!newPos) return obj;
      playerVisited.get(obj.id)!.add(posKey(obj.position));
      anyMoved = true;
      return { ...obj, position: newPos };
    });

    let finalBoxes = survivingBoxes.map((box) => {
      const newPos = pendingBoxFromPlayer.get(box.id);
      if (!newPos) return box;
      boxVisited.get(box.id)?.add(posKey(box.position));
      anyMoved = true;
      return { ...box, position: newPos };
    }).filter((b) => grid[b.position.row]?.[b.position.col] !== 'forbidden');
    if (pendingBoxFromPlayer.size > 0) anyMoved = true;

    currentBoxes = finalBoxes;
    currentObjects = nextObjects;
    if (!anyMoved) break;
  }

  return { newBoxes: currentBoxes, newObjects: currentObjects };
}
