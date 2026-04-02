# Auth & User System

## Overview

All users are **silently signed in anonymously** on first open. They can optionally upgrade to a real account (Google or email/password) which links to the same Firebase UID — preserving all game progress.

---

## Firebase Auth Flow

```
App opens
  └── onAuthStateChanged
        ├── user exists → setUser, createOrUpdateUserDoc, read Firestore role
        └── no user     → signInAnonymously() → onAuthStateChanged fires again
```

**Sign-out davranışı:** `signOut()` → Firebase oturumu kapanır → `onAuthStateChanged` null ile tetiklenir → yeni anonim oturum açılır. Orphaned anonim hesaplar Firebase tarafından 30 gün sonra otomatik temizlenir.

On Capacitor (Android/iOS), `getRedirectResult(auth)` is called on mount to capture any pending Google redirect result from a previous session.

---

## AuthContext (`app/src/contexts/AuthContext.tsx`)

### Exported Values

| Value | Type | Description |
|---|---|---|
| `user` | `User \| null` | Current Firebase user |
| `loading` | `boolean` | True until first auth state resolves |
| `isAnonymous` | `boolean` | True while on anonymous session |
| `role` | `'user' \| 'moderator' \| 'admin'` | Read from `users/{uid}.role` in Firestore |
| `isModerator` | `boolean` | `role === 'admin' \|\| role === 'moderator'` |
| `linkWithGoogle()` | `() => Promise<void>` | See below |
| `linkWithEmail(email, password, mode)` | `Promise<void>` | See below |
| `signOut()` | `() => Promise<void>` | Signs out, re-signs anonymously |

### `linkWithGoogle()`

- **Web / Electron:** `linkWithPopup(user, GoogleAuthProvider)`
- **Capacitor:** `linkWithRedirect(user, GoogleAuthProvider)` — page reloads, redirect result is captured on next open via `getRedirectResult`
- **Error `auth/credential-already-in-use`:** Google account already registered to a different UID → automatically calls `signInWithCredential` to switch to that account

### `linkWithEmail(email, password, mode)`

| `mode` | Action | UID behaviour |
|---|---|---|
| `'register'` | `EmailAuthProvider.credential(email, pass)` → `linkWithCredential(user, cred)` | **UID preserved** — anonymous data kept |
| `'signin'` | `signInWithEmailAndPassword(auth, email, pass)` | Switches to existing account (different UID possible) |

> **Why `linkWithCredential` and not `linkWithEmailAndPassword`?**
> Firebase v9 modular SDK does not export `linkWithEmailAndPassword` as a standalone function. The equivalent is: create a credential with `EmailAuthProvider.credential(email, password)`, then pass it to `linkWithCredential(user, credential)`.

---

## UI Components

### `UserBadge` (`app/src/components/UserBadge.tsx`)
Fixed `position: fixed` button at top-right of every page (mounted in `app/layout.tsx`).
- Anonymous → emerald `Giriş Yap` pill
- Signed in → sky neon circle with first initial of display name / email

### `AuthModal` (`app/src/components/AuthModal.tsx`)
Opened by `UserBadge`. Two views:
- **Anonymous:** Google button + email/password form with Giriş Yap / Kayıt Ol tabs
- **Signed in:** account info + sign-out button

---

## Firestore User Document

```
users/{uid}
  ├── uid: string
  ├── authProvider: 'anonymous' | 'google' | 'email'  ← updated on Google/email link
  ├── createdAt: Timestamp
  ├── totalScore: number
  ├── completedCount: number                            ← incremented on first level completion
  ├── role: 'user' | 'moderator' | 'admin'             ← set manually in Firebase Console
  ├── tag?: string                                      ← custom display tag (Cloud Function only)
  ├── email?: string
  └── displayName?: string
```

`role` is read from Firestore, **not** from Firebase custom claims. It cannot be changed by the client (Firestore rules enforce `role` immutability on update). To promote a user to admin: set `role: "admin"` directly in the Firebase Console.

---

## Firestore Security Rules (relevant excerpts)

```javascript
function isNotAnonymous() {
  return isSignedIn() && request.auth.token.firebase.sign_in_provider != 'anonymous';
}
function isAdmin() {
  return isSignedIn() &&
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// User doc: role cannot be self-escalated
allow update: if isOwner(uid)
  && request.resource.data.role == resource.data.role;

// Campaign levels: public read, admin-only write
match /levels/{id}      { allow read: if true; allow write: if isAdmin(); }
match /levelParts/{id}  { allow read: if true; allow write: if isAdmin(); }

// Community requests: non-anon users create, admin manages
match /levelRequests/{id} {
  allow get:    if isOwner(resource.data.submittedBy) || isAdmin();
  allow list:   if isAdmin();
  allow create: if isNotAnonymous() && request.resource.data.submittedBy == request.auth.uid
                && request.resource.data.status == 'pending';
  allow update: if isAdmin();
  allow delete: if isOwner(resource.data.submittedBy) && resource.data.status == 'pending';
}
```

---

## Sync

On app open and on `visibilitychange` (tab focus), `useFirestoreSync` runs:
1. `syncAllParts()` — syncs Firestore `levels` / `levelParts` → Dexie `presetLevels`
2. `syncPlayedLevels(uid)` — syncs `users/{uid}/playedLevels` → Dexie `playedLevels`

Both use a **24-hour cooldown** stored in Dexie `syncMeta` table (key per collection).
Delta queries use `where('updatedAt', '>', lastSync)` — only changed records are fetched.

Pass `force = true` to bypass cooldown (used by the ↻ button in `/levels`).

## User Data Isolation

`onAuthStateChanged` compares the incoming UID against `localStorage('activeUserId')`. If they differ (different account logged in), `playedLevels` and `syncMeta` are cleared from Dexie before proceeding. `activeUserId` is then updated to the new UID.

All user-specific localStorage keys (`lastPlayedLevelId`, `lastPlayedSource`, `soundMuted`) are scoped with the UID prefix via `useUserStorage()` / `userStorageGet/Set/Remove()`. See `docs/database.md` for details.

See `docs/database.md` for Dexie schema details.
