# Analytics & Community Features

## Google Analytics 4

### Setup

Add to `.env.local` (not committed):
```
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

Script is loaded in `app/layout.tsx` via `next/script strategy="afterInteractive"`. If `GA_ID` is empty, script is skipped entirely.

### Event Wrapper (`app/src/lib/analytics.ts`)

All events go through typed wrapper functions — never call `window.gtag()` directly.

```typescript
trackLevelStart(levelId, levelName, source)         // on GameShell mount
trackLevelComplete(levelId, levelName, moveCount, timeSpent) // phase → 'won'
trackLevelFail(levelId, levelName, moveCount, lostReason, timeSpent) // phase → 'lost'
```

Each function guards against SSR / GA not loaded (`typeof window.gtag !== 'function'`).

### Where Events Fire (`app/src/games/components/GameShell.tsx`)

- `trackLevelStart` — standalone `useEffect([], [])` on mount. Since `<GameShell key={level.id}>` remounts per level, this fires once per level.
- `trackLevelComplete` / `trackLevelFail` — inside the existing sound effect `useEffect` that monitors `state.phase`. `timeSpent` is computed from a `startTimeRef = useRef(Date.now())` initialized on mount.
- `source` prop (`'preset' | 'user'`) is passed from `app/game/page.tsx`.

### What GA4 Tracks Automatically

Page views, session duration, device/browser/country — no extra code needed.

---

## Community Level Submission

Non-anonymous users can submit level requests from the editor. Admins review and publish them.

### Firestore Collection: `levelRequests`

```
levelRequests/{requestId}
  ├── [all level data fields]
  ├── grid: string          ← JSON.stringify(CellType[][]) — Firestore nested arrays unsupported
  ├── submittedBy: uid
  ├── creatorName: string   ← tag ?? displayName ?? email
  ├── creatorTag: string | null
  ├── status: 'pending' | 'approved' | 'rejected'
  ├── submittedAt: Timestamp
  ├── updatedAt: Timestamp
  └── adminNote?: string
```

**Important:** `grid` is stored as `JSON.stringify(CellType[][])` — a single string — because Firestore rejects nested arrays. Decoded back to `CellType[][]` in `getLevelRequests()`. The same encoding applies to `levels/` collection (`publishLevel`, `updateFirestoreLevel`, `approveLevelRequest`). `sync.ts` handles both formats: `typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid`.

### Security Rules (`firestore.rules`)

```javascript
function isNotAnonymous() {
  return isSignedIn() && request.auth.token.firebase.sign_in_provider != 'anonymous';
}

match /levelRequests/{requestId} {
  allow get:    if isOwner(resource.data.submittedBy) || isAdmin();
  allow list:   if isAdmin();
  allow create: if isNotAnonymous()
    && request.resource.data.submittedBy == request.auth.uid
    && request.resource.data.status == 'pending';
  allow update: if isAdmin();
  allow delete: if isOwner(resource.data.submittedBy) && resource.data.status == 'pending';
}
```

### Key Functions

```typescript
// app/src/lib/firebase/firestore.ts
submitLevelRequest(uid, levelData, creatorName, creatorTag): Promise<string>
getLevelRequests(status): Promise<LevelRequest[]>  // admin only

// app/src/lib/firebase/admin.ts
approveLevelRequest(requestId, partId, req, approvedByUid): Promise<void>
  // batch: creates levels/ doc + updates levelParts/ order + marks request approved
rejectLevelRequest(requestId, note?): Promise<void>
```

### UI Entry Points

- **Submit:** Editor top bar → "Gönder" button (visible when `!isAnonymous && !isModerator`). Opens a dialog showing level name + creator name (read-only) + optional note.
- **Moderate:** `/admin` page (redirects non-admins). Lists pending requests with inline grid preview, part selector, approve/reject actions.

### Attribution in Levels List

When a level synced from Firestore has `creatorName`, it's stored in Dexie `presetLevels.creatorName` and shown as "by X" below the level name in `/levels`.
