# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev           # Start dev server (Turbopack, default in Next.js 16)
npm run build         # Production build → out/ (static export, used by Cloudflare Pages)
npm run lint          # ESLint (Next.js 16 uses ESLint CLI, not next lint)
npx tsc --noEmit      # Type-check without emitting files
npm run build:mobile      # next build + cap sync → prepares Android project
npm run cap:open          # Open android/ in Android Studio to build APK
npx cap sync              # Sync web assets to native project after build
npm run electron:dev      # Electron dev (needs `npm run dev` running on :3000 first)
npm run electron:serve    # next build → open in Electron (no installer)
npm run electron:dist     # next build → create installer for current OS
npm run electron:dist:win # Windows .exe (NSIS installer)
npm run electron:dist:mac # macOS .dmg
npm run electron:dist:linux # Linux .AppImage
```

No test framework is set up yet.

## What This Is

**Know & Conquer** — a grid-based puzzle game built with Next.js 16 App Router. The player presses arrow keys (or D-pad) to move two objects simultaneously across a grid. Each object has an independent movement mode (`normal` = moves in key direction, `reversed` = moves in opposite direction). The goal is to land both objects on their respective target cells at the same time.

## Pages

| Route | Description |
|---|---|
| `/` | Main menu (neon style) |
| `/game?id=X` | Play level X from Dexie DB |
| `/levels` | Browse, reorder, play, edit, delete levels (Dexie) |
| `/editor` | Create new level |
| `/editor?id=X` | Edit existing level X from Dexie DB |

## Architecture

### Client-only Pages

All pages that interact with the game or Dexie are `'use client'` components. The previous server-component pattern (passing level JSON as prop) is no longer used for Dexie-sourced levels. `useSearchParams` usage is always wrapped in `<Suspense>`.

### State Flow

```
useGameEngine (hook)
  └── useReducer(gameReducer, level, initialStateFromLevel)
        └── processMoveStep (pure) — 16-step pipeline
              ├── computePoweredCells (BFS from power_node + powered trails)
              ├── Pass 1: raw player desired positions (ignoring boxes)
              ├── Pass 2: resolve box pushes; conflicts → both players stay
              ├── Pass 3: finalize player positions
              ├── Lava edge check → lost
              ├── Ice slide (resolveIceSlide) per player
              ├── Teleport players (applyEntityTeleport)
              ├── Post-teleport ice slide
              ├── Update trails (always for poweredPlayers; otherwise gated on trailCollision)
              ├── Apply side-effects: power_node, direction_toggle, lock
              ├── Apply box pushes; boxes on lava/forbidden → destroyed
              ├── Conveyor phase (processConveyors) — moves both players and boxes
              ├── Recompute poweredCells
              ├── Forbidden check → lost
              ├── Trail collision check → lost
              ├── Win condition check
              └── Assemble new state with boxes, poweredPlayers
```

All game logic lives in `app/src/games/logic/` as pure functions with no React dependency.

### Logic Files

| File | Purpose |
|---|---|
| `movement.ts` | `processMoveStep` — main per-turn pipeline |
| `positionUtils.ts` | `posKey`, `DELTA`, conveyor/teleporter cell helpers |
| `powerSystem.ts` | `computePoweredCells` — BFS power propagation |
| `iceSlide.ts` | `resolveIceSlide` — slides entity to end of ice run |
| `teleporter.ts` | `applyEntityTeleport` — teleports entity if exit is free |
| `boxPhysics.ts` | `computeBoxChainPush`, `computeBoxPush`, `processConveyors` |
| `gameReducer.ts` | `initialStateFromLevel` — builds initial `GameState` |

### Movement Resolution Order (critical)

All new positions are computed **before** any are applied. This prevents turn-order dependency between objects. Then side-effects (mode toggle, lock, trail) are applied per-object.

### Cell Types & Behaviour

| Cell | Behaviour |
|---|---|
| `empty` | Walkable |
| `obstacle` | Blocks movement — object stays in place |
| `forbidden` | Walkable, but landing on it triggers `phase = 'lost'` (reason: `'forbidden'`) |
| `target_1` / `target_2` | Win destination for each object |
| `direction_toggle` | On entry, toggles the landing object's mode (normal ↔ reversed) |
| `ice` | Entity slides in move direction until hitting a non-ice or blocking cell |
| `power_node` | Player stepping here becomes "powered"; their trail acts as an electric cable |
| `conveyor_up/down/left/right` | After all movement: pushes players and boxes 1 step in conveyor direction |
| `teleporter_in_A/B/C` | Teleports entity to paired `teleporter_out_A/B/C`; blocked exit = no teleport |
| `teleporter_out_A/B/C` | Exit point for a teleporter pair |

**Ice rules:** During a slide, lava edges act as walls (no death). Lava death only on the first intentional step. All intermediate ice cells' effects trigger (none in practice since intermediate cells are ice).

**Teleporter rules:** If the exit cell is occupied by a player, box, or obstacle → entity stays at the `teleporter_in` cell (no teleport this turn). Power cables (powered player trails) propagate through teleporters.

**Conveyor rules:** Conveyors may optionally require power (`conveyorPowerRequired` in `LevelData`). An unpowered required conveyor is inactive. Batch order-independent resolution with per-entity cycle detection.
- Player on conveyor reaching a box → chain push; if push fails, player stays (no overlap)
- Box on conveyor reaching a player → player is pushed 1 step; if player can't move, box stays (no overlap)
- Box on conveyor reaching another box → conveyor stops (no chain push from conveyors, only from player actions)

### Edge Behaviour

Each of the 4 edges is independently configured in the level JSON:
- `wall` — movement into that edge is blocked (object stays)
- `portal` — object wraps to the opposite edge (purple border `#9333ea`)
- `lava` — object tries to move beyond this edge → `phase = 'lost'` (reason: `'lava_edge'`), red border `#ef4444`

### Boxes (Sokoban mechanic)

Boxes are defined in `LevelData.initialBoxes` and tracked in `GameState.boxes` as `BoxState[]`.

- Players push boxes by moving into them; box slides 1 step in the same direction
- **Chain push:** pushing box A into box B moves both (recursively); whole chain fails if any box is blocked
- Two players pushing the same box (directly or via a shared chain) → conflict → both players stay, no boxes move
- `requiresPower: true` on a box → box can only be pushed when its cell is powered
- Box pushed onto `forbidden` or off a `lava` edge → silently destroyed (no game-over)
- Boxes slide on ice when pushed onto it
- Boxes can teleport through teleporters

**Teleporter exit collision (same turn):** Step 7 uses projected box positions (after the push computed in step 3) for exit occupancy. A box pushed to exit E this turn blocks a player from also teleporting to E in the same turn. Two players teleporting to the same exit in the same turn → both stay at `teleporter_in`.

**`computeBoxChainPush`** in `boxPhysics.ts` is the recursive chain push implementation; exported for use in `movement.ts` (player pushes) and `processConveyors` (conveyor carries player into box).

### Power System

- `power_node` cell: player stepping on it is added to `poweredPlayers: number[]`
- Powered players' trail positions are always tracked (regardless of `trailCollision`); trail renders an electric amber overlay
- `computePoweredCells` BFS: seeds = all `power_node` positions + all trail cells of powered players
- BFS extends through adjacent: conveyors in `conveyorPowerRequired`, boxes with `requiresPower: true`
- Teleporter propagation: powered `teleporter_in_X` → paired `teleporter_out_X` also powered; BFS continues from there

### Trail Collision (optional per level)

When `trailCollision: true` is set in `LevelData`:
- Trail positions are tracked in `GameState.trail`
- Trail overlays are rendered on the board (emerald for P1, sky for P2)
- Landing on the opponent's trail → `phase = 'lost'` (reason: `'trail'`)
- Objects can freely step on their **own** trail

When `trailCollision` is absent/false: no trail tracking, no trail rendering. Powered player trails are still tracked internally for the power system.

### GameState Shape

```typescript
{
  level: LevelData                     // immutable level config
  objects: GameObjectState[]           // mutable runtime state per object
  boxes: BoxState[]                    // pushable box positions
  poweredPlayers: number[]             // player IDs who stepped on power_node
  phase: 'playing' | 'won' | 'lost'
  moveCount: number
  trail: Record<number, Position[]>    // objectId → visited positions
  lostReason?: 'forbidden' | 'lava_edge' | 'trail'  // shown in LostOverlay
}
```

### GameShell Props

```typescript
interface GameShellProps {
  level: LevelData;
  onNextLevel?: () => void;  // if provided, "Next Level" button is shown in WinOverlay
}
```

`GameShell` no longer self-discovers next level from a static array. The parent (game page) handles Dexie lookup and passes the callback.

### Dexie Database (`app/src/lib/db.ts`)

**Schema (version 2):**
- `levels` table — `++id` (auto-increment). Stores `StoredLevel` objects.
- `levelOrder` table — single record `{ id: 1, order: number[] }` containing level IDs in display order.
- Version 2 added optional fields `initialBoxes` and `conveyorPowerRequired` to `StoredLevel`; no migration needed (old data still valid).

**Why separate order record?**
Inserting a level at any position only updates the one `levelOrder` record — no other level records are modified. Order is O(1) to change regardless of level count.

**Key helpers:**
```typescript
getOrderedLevels()               // → StoredLevel[] in display order
getNextLevelId(currentId)        // → next level's DB id, or null
saveLevelAtPosition(data, pos?)  // → new level id (0-based pos, undefined = append)
updateStoredLevel(id, data)      // updates a level in-place (keeps order)
deleteStoredLevel(id)            // removes from table + order array
reorderLevels(newOrder)          // replaces the order array
```

**Lazy singleton:** `getDB()` is called at runtime to avoid server-side instantiation.

### Level Editor (`/editor`)

Three-column layout (all within `100dvh`, sidebars scroll, center grid fixed):
- **Left panel:** Saved levels list (click to load for editing), "New Level" button
- **Center:** Tool palette (grouped: Basic, Ice, Power, Conveyors, Teleporters, Players, Boxes) + clickable grid with edge indicators
- **Right panel:** Level name, grid size, edges, options (trail collision + conveyor power requirements), object configs, boxes section, actions, JSON preview

**Painting behavior:**
- Click a cell with the same type as active tool → toggles to empty
- Drag always paints/erases following the action started on mousedown

**Save flow:**
- Editing existing (`?id=X`): "Update" button saves immediately
- New level: "Save" opens a dialog to choose insert position (1-based, blank = last)
- Validation: `generateLevelData` checks that every `teleporter_in_X` has a matching `teleporter_out_X` and vice versa; returns an error if any pair is incomplete

**Box placement:**
- "Add Box" button in palette → new box enters placement mode
- Click any grid cell to place the box; placement mode exits automatically
- Right panel Boxes section: shows each box's position, "Place" button to re-place, requiresPower toggle, remove button
- `BoxDot` overlay renders box position on the editor grid

**Conveyor power requirements:**
- Options section shows a checklist for every conveyor cell in the current grid
- Checked = that conveyor requires power to be active (`conveyorPowerRequired` in saved level)

### Level Order in `/levels`

Up/down arrow buttons reorder. Only the single `levelOrder` record in Dexie is updated per move — no level records are touched.

### Adding a Level via JSON

**Critical invariant:** `targets[i].position` must match the coordinates of the corresponding `target_1`/`target_2` cell in `grid`. A mismatch causes the win condition to trigger on wrong cells.

### Object IDs & Visual Mapping

- Object `id: 1` → neon emerald `#00ff88`, grid cell `target_1`
- Object `id: 2` → neon sky `#00c4ff`, grid cell `target_2`

### Neon Theme

Dark base `#030712`. Neon glows via `box-shadow` and `text-shadow` inline styles:
- Emerald (P1): `#00ff88`
- Sky (P2): `#00c4ff`
- Forbidden: `#ef4444`
- Direction toggle: `#ffd700`
- Portal edge: `#9333ea`
- Lava edge: `#ef4444`
- Ice: `#a5f3fc` (cyan-white)
- Power node: `#fbbf24` (amber)
- Conveyor: `#c4b5fd` (purple); dims when unpowered
- Teleporter A: `#ec4899` (pink), B: `#f97316` (orange), C: `#14b8a6` (teal)
- Box (GameBoxObject): `#f97316` orange neon border; dims when `requiresPower && !isPowered`
- Powered trail overlay: amber `rgba(251,191,36,0.08)` electric layer on top of base trail

### framer-motion Usage

`GameObject` uses `<motion.div animate={{ x, y }}>` with absolute positioning. `x = col * CELL_SIZE`, `y = row * CELL_SIZE`. Spring config: `stiffness: 400, damping: 30`. `WinOverlay` and `LostOverlay` use `AnimatePresence` with scale+opacity transitions.

### Mobile Controls & Responsive Layout

- **Desktop (≥ 768px):** D-pad rendered below board (9-cell grid: ↑ ← · → ↓), uses `onPointerDown`
- **Mobile (< 768px):** D-pad hidden; swipe gestures on the board area (touchstart/touchend, 30px threshold)
- **Dynamic cell size:** `GameShell` computes `cellSize` from viewport on resize; clamped `[32, 72]px`; passed as prop to `GameBoard`
- **Levels page:** Collapses to 3-column grid on mobile (Size + Order columns hidden)
- **Editor page:** Tab-based layout on mobile (`< 900px`): tabs switch between Levels / Grid / Settings panels

### Teleporter Behaviour (Bidirectional)

- **Forward (teleporter_in → teleporter_out):** Always applies when entity is on a `teleporter_in_X` cell.
- **Reverse (teleporter_out → teleporter_in):** Applies when entity **moved into** a `teleporter_out_X` cell this turn (i.e. `prevPos ≠ newPos`). If the entity was already on the exit and got blocked (didn't move), reverse teleport does NOT trigger.
- `positionUtils.ts` exports `teleporterOutToIn()` for the reverse mapping.
- `applyEntityTeleport` accepts `prevPos: Position | null = null`; movement.ts passes `state.objects[i].position` as `prevPos`.

### Preset Level Seeding

`seedPresets.ts` uses a content hash stored in `localStorage` (`presetLevelsHash`) to detect changes in `preset-levels.json`. When the hash changes (or table is empty), it clears `presetLevels` and re-seeds from the JSON. Also clears `lastPlayedLevelId`/`lastPlayedSource` on re-seed since IDs change.

### Last Played Level

- `game/page.tsx` saves `lastPlayedLevelId` and `lastPlayedSource` (`'preset'` | `'user'`) to `localStorage` after loading a level.
- Main menu Play button reads these values and navigates directly to the last played level. Falls back to `/levels` if not set.
- `game/page.tsx` `useEffect` resets `loading/level/nextLevelId` at the start to prevent stale level state during navigation. `<GameShell key={level.id}>` forces remount on level change.

### Capacitor (Android APK)

- `capacitor.config.ts` at project root: `appId: 'com.knowandconquer.app'`, `webDir: 'out'`, `androidScheme: 'https'`
- `android/` directory contains the native Android project (committed to git; build artifacts gitignored)
- `next.config.ts` has `trailingSlash: true` — required for Capacitor WebView routing with Next.js App Router
- **Workflow to build APK:**
  1. `npm run build:mobile` → runs `next build && cap sync`
  2. `npm run cap:open` → opens Android Studio
  3. In Android Studio: Build → Generate Signed APK / Bundle
- Cloudflare Pages deployment is unaffected: it runs `npm run build` which outputs to `out/`

### Electron (Desktop — Windows/Mac/Linux)

- `electron/main.js` — main process: creates fullscreen BrowserWindow, disables native context menu, disables DevTools in prod, F11 toggles fullscreen, ESC exits fullscreen
- `electron/preload.js` — exposes `window.electron.isElectron = true` so web code can detect the environment
- `electron-builder.yml` — build config: `asar: false` (required for Next.js static files via file://), outputs to `dist-electron/`
- `"main": "electron/main.js"` in package.json
- **Game feel features:**
  - Starts fullscreen (`fullscreen: true`)
  - No menu bar (`Menu.setApplicationMenu(null)`)
  - Native context menu disabled (`webContents.on('context-menu', e => e.preventDefault())`)
  - DevTools shortcuts blocked in production (F12, Ctrl+Shift+I, Ctrl+U)
  - F11 / ESC to toggle fullscreen
- **CSS game feel (globals.css):**
  - Custom neon crosshair cursor (SVG data URI, `#00ff88`, 24×24, hotspot 12,12)
  - `user-select: none` on body (re-enabled for inputs/textareas)
- **Workflow to build .exe:**
  1. `npm run electron:dist:win` — builds Next.js static export + packages with electron-builder
  2. Output in `dist-electron/` — NSIS installer (.exe)
- **Dev workflow:** `npm run dev` in one terminal, `npm run electron:dev` in another
