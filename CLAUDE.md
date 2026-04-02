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
├── components/      PresetSeeder (no-op), FirestoreSync, UserBadge, AuthModal
├── data/            preset-levels.json (no longer used for seeding)
├── lib/
│   ├── analytics.ts  GA4 event wrapper (trackLevelStart/Complete/Fail)
│   ├── firebase/    config.ts, firestore.ts, admin.ts, sync.ts, index.ts
│   └── db/          index.ts (Dexie v6), seedPresets.ts (no-op)
└── games/
    ├── components/  GameShell, GameBoard, GameCell, GameObject, GameBoxObject, HUD, WinOverlay, LostOverlay
    ├── hooks/       useGameEngine, useSoundManager
    ├── logic/       movement, positionUtils, powerSystem, iceSlide, teleporter, boxPhysics, gameReducer
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
