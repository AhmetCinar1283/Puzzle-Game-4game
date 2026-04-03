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

**Syncron** — a grid-based puzzle game built with Next.js 16 App Router. The player presses arrow keys (or D-pad) to move two objects simultaneously across a grid. Each object has an independent movement mode (`normal` = moves in key direction, `reversed` = moves in opposite direction). The goal is to land both objects on their respective target cells at the same time.

## Pages

| Route | Description |
|---|---|
| `/` | Main menu (neon style) |
| `/game?id=X` | Play level X from Dexie DB |
| `/levels` | Browse levels; ↻ refresh button forces Firestore sync |
| `/editor` | Create new level; "Gönder" button for non-admin users to submit a level request |
| `/editor?id=X` | Edit existing level X |
| `/admin` | Admin-only moderation panel — approve/reject community level requests |

## Source Layout

```
app/src/
├── contexts/        AuthContext.tsx — Firebase Auth provider
├── hooks/           useAuth.ts, useFirestoreSync.ts
├── components/      FirestoreSync, UserBadge, AuthModal
├── lib/
│   ├── analytics.ts  GA4 event wrapper (trackLevelStart/Complete/Fail)
│   ├── firebase/
│   │   ├── config.ts           Firebase app init + exports (auth, db, storage)
│   │   ├── firestore.ts        End-user ops: createOrUpdateUserDoc, savePlayedLevel, submitLevelRequest, getLevelRequests
│   │   ├── sync.ts             Firestore → Dexie sync engine
│   │   ├── index.ts            Barrel re-export
│   │   ├── admin.ts            Barrel re-export for all admin sub-modules
│   │   ├── adminTypes.ts       Shared admin types: AdminLevelInput, FirestoreLevel, LevelPart, LevelOrderEntry
│   │   ├── adminParts.ts       Part ops: getAllParts, getPart, reorderPartLevels
│   │   ├── adminLevels.ts      Level CRUD: publishLevel, updateFirestoreLevel, deleteFirestoreLevel, getPartLevels
│   │   └── adminRequests.ts    Request moderation: approveLevelRequest, rejectLevelRequest
│   └── db/
│       ├── schema.ts           Dexie class (v1-v8), types (StoredLevel etc.), getDB()
│       ├── levelOrderOps.ts    levelOrder table: getOrderedLevels, getNextLevelId, reorderLevels
│       ├── levelsOps.ts        levels table: saveLevelAtPosition, updateStoredLevel, deleteStoredLevel, setLevelRequestId
│       ├── presetLevelsOps.ts  presetLevels table: getPresetLevels, getNextPresetLevelId
│       └── index.ts            Barrel re-export (same public API as before)
└── games/
    ├── components/  GameShell, GameBoard, GameCell, GameObject, GameBoxObject, HUD, WinOverlay, LostOverlay
    ├── hooks/       useGameEngine, useSoundManager
    ├── logic/
    │   ├── movement.ts         processMoveStep — main 16-step pipeline (imports from movementHelpers)
    │   ├── movementHelpers.ts  Pure helpers: resolveDirection, resolveEdgePosition, checkWinCondition, applyMoveToObject, computePlayerDesiredPosition, etc.
    │   ├── boxPhysics.ts       computeBoxChainPush, processConveyors
    │   ├── powerSystem.ts      computePoweredCells (BFS)
    │   ├── iceSlide.ts         resolveIceSlide
    │   ├── teleporter.ts       applyEntityTeleport
    │   ├── positionUtils.ts    posKey, DELTA, conveyor/teleporter cell helpers
    │   └── gameReducer.ts      initialStateFromLevel
    └── types/       index.ts
```

## Detailed Docs

@docs/game-logic.md
@docs/database.md
@docs/editor.md
@docs/platforms.md
@docs/theme.md
@docs/auth.md
@docs/analytics.md
@docs/backlog.md
