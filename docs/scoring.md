# Scoring, Stars & Level Progression

## Overview

Level completion is verified server-side by the Cloudflare Worker (`syncron-worker`). The client posts the move sequence; the worker replays it deterministically and commits the result. The client cannot self-report scores.

---

## Star Calculation (Worker)

Stars are computed in `syncron-worker/src/solutions.ts → computeStars()`:

| Condition | Stars |
|---|---|
| No prior solutions exist **or** `moves ≤ bestMoveCount` | ★★★ (3) |
| `moves ≤ floor(bestMoveCount × 1.2)` | ★★ (2) |
| Everything else | ★ (1) |

`bestMoveCount` is read via `getSolutionStats()` **before** the batch write, so the pioneer who first solves a level always earns 3 stars regardless of move count.

---

## Score Delta (Re-completion)

Stars and `totalScore` reflect **best-ever** performance:

- `existingStars` = previously stored star count (0 if first completion)
- `newStars` = stars earned this run
- `scoreDelta = max(0, newStars − existingStars)` — only the improvement is added
- `totalScore` in `users/{uid}` is incremented by `scoreDelta`
- `completedCount` in `users/{uid}` is incremented only on **first** completion
- `playedLevels/{levelId}.stars` and `.moveCount` always store the personal best (never regress)

---

## Solution Ranking Badges

Computed in `index.ts` from `solutionStats` (read before the batch write):

| Flag | Condition | Badge shown | Color |
|---|---|---|---|
| `isNewBestSolution` | `bestMoveCount === null` (first ever) or `moves < bestMoveCount` | **New Best** | Emerald `#00ff88` |
| `isBestSolution` | `moves === bestMoveCount` (ties global best) | **Best** | Sky `#00c4ff` |
| `isGoodSolution` | not best/new-best AND (`worstTopMoveCount === null` OR `moves ≤ worstTopMoveCount`) | **Good** | Purple `#9333ea` |

`worstTopMoveCount === null` means fewer than 3 solutions exist — any solution qualifies as "Good".
The three flags are mutually exclusive.

---

## Firestore Data Shape

`users/{uid}/playedLevels/{levelId}`:
```
stars:      1 | 2 | 3    ← best-ever star rating
score:      1 | 2 | 3    ← mirrors stars (legacy compat)
moveCount:  number        ← best-ever move count
timeSpent:  number        ← most recent time (seconds)
completedAt: timestamp    ← first completion timestamp (preserved)
updatedAt:  timestamp     ← last update
```

`levels/{levelId}/infos/solutions`:
```
solutions: [
  { uid, moves: string[], moveCount: number, solvedAt: number },
  ...  // top-3 shortest, one entry per uid, sorted by moveCount asc
]
```

**Update rule:** `updateSolutions` only writes when the new submission is **strictly better** (fewer moves) than the uid's existing entry. Equal or worse submissions are ignored.

---

## Level Lock / Unlock Progression

### Firestore Rule (`firestore.rules → canReadLevel()`)

Reads of `levels/{levelId}` are gated server-side:
- **Admin/moderator**: always allowed
- **First level of a part** (`prevLevelId` field absent or null): requires `users/{uid}.totalScore ≥ levelParts/{partId}.unlockRequirement`
- **Subsequent levels** (`prevLevelId` set): requires `users/{uid}/playedLevels/{prevLevelId}` to exist

### `prevLevelId` field on level documents

Set at publish time in `adminLevels.ts → publishLevel()` and `adminRequests.ts → approveLevelRequest()`:
- Null → first level in the part
- Non-null → Firestore ID of the immediately preceding level by position

**Staleness caveat:** `prevLevelId` becomes stale when levels are reordered via `moveLevelsInPart`. The `/levels` UI uses in-memory order data for lock calculation (immune to staleness); the Firestore rule is a security backstop only. An admin can repair by re-publishing or manually patching the field.

**Chain repair on delete:** `deleteFirestoreLevel` patches the successor level's `prevLevelId` to skip the deleted level (non-fatal on failure).

### UI Lock Calculation (`app/levels/page.tsx → lockedSet`)

Computed client-side from `partsMap` (full `LevelPart` objects) + `playedMap` (Dexie) + `totalScore` (Redux `userSlice`). Uses position-adjacent ordering — no extra network calls. Moderators see all levels as unlocked.

---

## Worker Endpoint

**POST** `${NEXT_PUBLIC_WORKER_URL}/complete-level`

`NEXT_PUBLIC_WORKER_URL` must NOT have a trailing slash (double-slash causes 404).

Request:
```json
{ "levelId": "<firestoreId>", "moves": ["u","d","r","l",...], "timeSpent": 42 }
```

Response (`CompleteLevelResponse`):
```json
{
  "success": true,
  "isFirstCompletion": true,
  "isNewBestSolution": false,
  "isBestSolution": false,
  "isGoodSolution": true,
  "stars": 3,
  "scoreDelta": 3
}
```

Valid move values: `"u"`, `"d"`, `"r"`, `"l"` — max 500 moves. Worker verifies by full replay using `initialStateFromLevel` + `processMoveStep`.

---

## Client Flow (GameShell)

1. Player wins → `GameShell` awaits worker response (no longer fire-and-forget)
2. On success: immediately writes to Dexie `playedLevels` (so levels page is up-to-date without waiting for next sync)
3. Sets `workerResult` state → `WinOverlay` shows animated gold stars + badges
4. WinOverlay shows grey ★★★ + bouncing dots while waiting, then stars animate gold one-by-one with neon glow

---

## WinOverlay Animation

- **Loading state**: ✦ icon pulses, grey stars fade in, 3 bouncing dots below
- **On result**: each lit star bursts gold sequentially (220 ms stagger) with `drop-shadow` neon glow
- **Badges** (appear after stars settle): `+N PTS` pop-in, then `New Best` / `Best` / `Good` fade-in

---

## Worker Local Dev Setup

1. `syncron-worker/.dev.vars` — paste real service account JSON (single line):
   ```
   GOOGLE_SERVICE_ACCOUNT={"type":"service_account",...}
   ```
2. `.env.local` — no trailing slash:
   ```
   NEXT_PUBLIC_WORKER_URL=http://localhost:8787
   ```
3. Run: `cd syncron-worker && npx wrangler dev`

For production: `npx wrangler secret put GOOGLE_SERVICE_ACCOUNT` then `npx wrangler deploy`.

---

## Dexie Schema

Version 9 (current): added `stars?: 1 | 2 | 3` to `StoredPlayedLevel`.

`syncPlayedLevels` in `sync.ts` maps `stars` and `moveCount` from Firestore → Dexie on every sync.
