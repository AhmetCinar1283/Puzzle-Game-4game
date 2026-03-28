# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # Start dev server (Turbopack, default in Next.js 16)
npm run build    # Production build
npm run lint     # ESLint (Next.js 16 uses ESLint CLI, not next lint)
npx tsc --noEmit # Type-check without emitting files
```

No test framework is set up yet.

## What This Is

**Know & Conquer** — a grid-based puzzle game built with Next.js 16 App Router. The player presses arrow keys to move two objects simultaneously across a grid. Each object has an independent movement mode (`normal` = moves in key direction, `reversed` = moves in opposite direction). The goal is to land both objects on their respective target cells at the same time.

## Architecture

### `'use client'` Boundary

`app/game/page.tsx` is a Server Component. It imports level JSON statically and passes it as a serializable prop to `GameShell`, which is the **single** `'use client'` boundary. All components under `GameShell` inherit client context — they do not need their own `'use client'` directive.

### State Flow

```
useGameEngine (hook)
  └── useReducer(gameReducer, level, initialStateFromLevel)
        └── processMoveStep (pure)
              ├── computeNewPosition × N objects (order-independent batch)
              ├── addToTrail (record old positions that moved)
              ├── applyMoveToObject (toggle mode, lock on target)
              └── checkWinCondition / forbidden check → phase
```

All game logic lives in `app/src/games/logic/` as pure functions with no React dependency. The hook in `hooks/useGameEngine.ts` is the only place that touches `window` (keydown listener).

### Movement Resolution Order (critical)

All new positions are computed **before** any are applied. This prevents turn-order dependency between objects. Then side-effects (mode toggle, lock, trail) are applied per-object.

### Cell Types & Behaviour

| Cell | Behaviour |
|---|---|
| `empty` | Walkable |
| `obstacle` | Blocks movement — object stays in place |
| `forbidden` | Walkable, but landing on it triggers `phase = 'lost'` |
| `target_1` / `target_2` | Win destination for each object |
| `direction_toggle` | On entry, toggles the landing object's mode (normal ↔ reversed) |

### Edge Behaviour

Each of the 4 edges is independently configured in the level JSON:
- `wall` — movement into that edge is blocked (object stays)
- `portal` — object wraps to the opposite edge

Visually: portal edges render with a purple border (`#a855f7`) and a `↕`/`↔` symbol outside the board.

### GameState Shape

```typescript
{
  level: LevelData                     // immutable level config (from JSON)
  objects: GameObjectState[]           // mutable runtime state per object
  phase: 'playing' | 'won' | 'lost'
  moveCount: number
  trail: Record<number, Position[]>    // objectId → list of visited positions (no duplicates)
}
```

`trail` is reset to `{}` on restart or level load. It is rendered in `GameBoard` as semi-transparent colored overlays (emerald for object 1, sky for object 2) behind objects.

### Adding a New Level

1. Create `app/src/games/levels/level-NNN.json` following this schema:

```json
{
  "id": 3,
  "name": "My Level",
  "width": 7,
  "height": 7,
  "edges": { "top": "wall", "bottom": "wall", "left": "portal", "right": "portal" },
  "grid": [
    ["empty", "obstacle", "forbidden", "target_1", "target_2", "direction_toggle", "empty"],
    ...
  ],
  "initialObjects": [
    { "id": 1, "position": { "row": 0, "col": 0 }, "mode": "normal", "lockOnTarget": true },
    { "id": 2, "position": { "row": 6, "col": 6 }, "mode": "normal", "lockOnTarget": true }
  ],
  "targets": [
    { "objectId": 1, "position": { "row": 6, "col": 6 } },
    { "objectId": 2, "position": { "row": 0, "col": 0 } }
  ]
}
```

2. Import and add it to the `LEVELS` array in `app/src/games/levels/index.ts`.

**Critical invariant:** `targets[i].position` must match the coordinates of the corresponding `target_1`/`target_2` cell in `grid`. A mismatch causes the win condition to trigger on wrong cells (this was the Level 1 bug).

### Object IDs & Visual Mapping

- Object `id: 1` → emerald green (`#10b981`), grid cell `target_1`
- Object `id: 2` → sky blue (`#0ea5e9`), grid cell `target_2`

The `lockOnTarget` flag per object (in JSON) controls whether an object freezes permanently once it reaches its target (`🔒` icon shown). Some levels may set this to `false` to allow objects to be knocked off their targets.

### framer-motion Usage

`GameObject` uses `<motion.div animate={{ x, y }}>` with absolute positioning. `x = col * CELL_SIZE`, `y = row * CELL_SIZE`. Spring config: `stiffness: 400, damping: 30`. `WinOverlay` and `LostOverlay` use `AnimatePresence` with scale+opacity transitions.
