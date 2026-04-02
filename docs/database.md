# Database

## Dexie (IndexedDB) — `app/src/lib/db/`

### Schema (version 6)

| Table | Key | Purpose |
|---|---|---|
| `levels` | `++id` | User-created levels (device-local) |
| `levelOrder` | `id` (singleton) | Display order array `{ id: 1, order: number[] }` |
| `presetLevels` | `++id, firestoreId` | Campaign levels synced from Firestore |
| `playedLevels` | `levelId, updatedAt` | Completed levels cache (user-specific, cleared on UID switch) |
| `syncMeta` | `collection` | Per-collection last-sync timestamp (cleared on UID switch) |

Version 2: added `initialBoxes`, `conveyorPowerRequired` fields.
Version 3: added `presetLevels` table.
Version 4: added `firestoreId` index on `presetLevels`.
Version 5: added `playedLevels` and `syncMeta` tables.
Version 6: added `creatorName?: string` to `StoredLevel` (attribution for community-submitted levels).

### User Data Isolation

When `onAuthStateChanged` fires with a **different UID** than the one stored in `localStorage('activeUserId')`, `playedLevels` and `syncMeta` are cleared from Dexie before setting the new user. This prevents data from leaking between accounts on the same device.

### Why Separate Order Record?

Inserting a level at any position only updates the one `levelOrder` record — no other level records are modified. Order is O(1) to change regardless of level count.

### Key Helpers (`app/src/lib/db/index.ts`)

```typescript
getOrderedLevels()               // → StoredLevel[] in display order
getNextLevelId(currentId)        // → next level's DB id, or null
saveLevelAtPosition(data, pos?)  // → new level id (0-based pos, undefined = append)
updateStoredLevel(id, data)      // updates a level in-place (keeps order)
deleteStoredLevel(id)            // removes from table + order array
reorderLevels(newOrder)          // replaces the order array
getPresetLevels()                // → all preset levels ordered by id
getNextPresetLevelId(currentId)  // → next preset level id, or null
```

**Lazy singleton:** `getDB()` is called at runtime to avoid server-side instantiation.

---

## User-Scoped localStorage — `app/src/lib/userStorage.ts`

All user-specific localStorage keys are prefixed with the current UID (`activeUserId`), e.g. `uid123:lastPlayedLevelId`. This prevents data overlap when multiple accounts are used on the same device.

**Global keys** (no prefix — same for all users on device):
- `activeUserId` — current UID tracker

**User-scoped keys** (prefixed with UID):
- `lastPlayedLevelId` — last opened level ID
- `lastPlayedSource` — `'preset'` | `'user'`
- `soundMuted` — sound on/off preference

### API

```typescript
// Plain functions (use in lib/, non-React code)
userStorageGet(key)           // → string | null
userStorageSet(key, value)    // → void
userStorageRemove(key)        // → void

// React hook (use in components/hooks)
const { getItem, setItem, removeItem } = useUserStorage();
```

---

## Firebase / Firestore — `app/src/lib/firebase/`

### File Structure

| File | Purpose |
|---|---|
| `config.ts` | Firebase app init, exports `auth`, `db`, `storage`, `functions` |
| `firestore.ts` | End-user helpers: `createOrUpdateUserDoc`, `savePlayedLevel`, `submitLevelRequest`, `getLevelRequests` |
| `admin.ts` | Admin helpers: `publishLevel`, `updateFirestoreLevel`, `deleteFirestoreLevel`, `approveLevelRequest`, `rejectLevelRequest`, `getAllParts`, `getPartLevels` |
| `sync.ts` | Firestore → Dexie sync: `syncAllParts(force?)`, `syncPart(id, force?)`, `syncPlayedLevels(uid, force?)` |
| `index.ts` | Barrel — re-exports config + firestore |

### Firestore Data Model

```
users/{uid}
  ├── uid, authProvider, createdAt
  ├── totalScore, completedCount
  ├── role: 'user' | 'moderator' | 'admin'
  ├── email?, displayName?, tag?
  └── playedLevels/{levelId}
        ├── score, timeSpent, completedAt, updatedAt

levels/{levelId}                    ← admin/approved community write only
  ├── [level data fields]
  ├── grid: string                  ← JSON.stringify(CellType[][])
  ├── part: number
  ├── publishedBy: uid
  ├── createdBy?: uid               ← set when approved from a community request
  ├── creatorName?: string
  ├── creatorTag?: string | null
  └── createdAt, updatedAt

levelParts/{partId}                 ← admin write only
  ├── name, unlockRequirement
  ├── order: string[]               ← level IDs in display order
  └── updatedAt

levelRequests/{requestId}           ← community submissions
  ├── [level data fields]
  ├── grid: string                  ← JSON.stringify(CellType[][])
  ├── submittedBy: uid
  ├── creatorName, creatorTag
  ├── status: 'pending' | 'approved' | 'rejected'
  ├── submittedAt, updatedAt
  └── adminNote?

tags/{tag}                          ← Cloud Functions only (locked to client)
```

**Grid serialization:** Firestore does not support nested arrays. `grid: CellType[][]` is always stored as `JSON.stringify(grid)`. When reading in `sync.ts` and `getLevelRequests`, the value is decoded: `typeof data.grid === 'string' ? JSON.parse(data.grid) : data.grid`.

### Sync (`app/src/lib/firebase/sync.ts`)

`useFirestoreSync` hook (mounted in `FirestoreSync` component in `layout.tsx`) triggers on:
1. App first open
2. `visibilitychange` — hidden → visible (tab focus)

**Cooldown: 24 hours** per collection key in Dexie `syncMeta`. On first ever run (`lastSync = 0`), sync always fires.

**Force sync:** Pass `force = true` to bypass the cooldown. Used by the ↻ refresh button in `/levels`.

```typescript
syncAllParts(force?)           // syncs all levelParts → Dexie presetLevels
syncPlayedLevels(uid, force?)  // syncs user's playedLevels → Dexie playedLevels
```

**Delta strategy per part:**
- If `levelParts/{id}.updatedAt > lastSync` → full re-sync of that part (order changed)
- Otherwise → partial sync: only `levels/` docs with `updatedAt > lastSync`

### Auth Flow (`app/src/contexts/AuthContext.tsx`)

1. `onAuthStateChanged` fires on mount
2. If no user → `signInAnonymously(auth)` (silent, no UI)
3. On auth state change → `createOrUpdateUserDoc(user)` syncs Firestore doc + reads `role`
4. `linkWithGoogle()` → `linkWithPopup` with `GoogleAuthProvider`; uid stays the same

### Key Functions

```typescript
// firestore.ts
createOrUpdateUserDoc(user: User): Promise<void>
savePlayedLevel(uid, levelId, { score, timeSpent }): Promise<void>
submitLevelRequest(uid, levelData, creatorName, creatorTag): Promise<string>
getLevelRequests(status): Promise<LevelRequest[]>  // admin only

// admin.ts
publishLevel(data, partId, publishedByUid): Promise<string>
updateFirestoreLevel(firestoreId, data, publishedByUid): Promise<void>
deleteFirestoreLevel(firestoreId, partId): Promise<void>
approveLevelRequest(requestId, partId, req, approvedByUid): Promise<void>
rejectLevelRequest(requestId, note?): Promise<void>
getAllParts(): Promise<LevelPart[]>
getPartLevels(partId): Promise<FirestoreLevel[]>
```

### Adding a Level via Admin

**Critical invariant:** `targets[i].position` must match the coordinates of the corresponding `target_1`/`target_2` cell in `grid`. A mismatch causes the win condition to trigger on wrong cells.
