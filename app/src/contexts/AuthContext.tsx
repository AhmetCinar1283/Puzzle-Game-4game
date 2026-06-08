'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  linkWithPopup,
  linkWithRedirect,
  linkWithCredential,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signInAnonymously,
  GoogleAuthProvider,
  EmailAuthProvider,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/app/src/lib/firebase';
import { createOrUpdateUserDoc } from '@/app/src/lib/firebase/firestore';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '@/app/src/store';
import { setAuthUser, setFirestoreData, resetUser } from '@/app/src/store/userSlice';
import type { AuthProvider as AuthProviderType, UserRole } from '@/app/src/store/userSlice';

// ─── Types ────────────────────────────────────────────────────────────────────

export type { UserRole };

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** True when running inside a Capacitor native app (Android/iOS). */
function isNativePlatform(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as { Capacitor?: { isNativePlatform?: () => boolean } })
      .Capacitor
  );
}

function resolveAuthProvider(user: User): AuthProviderType {
  if (user.isAnonymous) return 'anonymous';
  const providerIds = user.providerData.map((p) => p.providerId);
  if (providerIds.includes('google.com')) return 'google';
  return 'email';
}

// ─── Context shape ─────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /**
   * True only when the user has an active ANONYMOUS Firebase Auth session
   * (i.e. `user.isAnonymous === true`). False when the user is fully signed
   * out (unauthenticated) — use `isUnauthenticated` for that case.
   */
  isAnonymous: boolean;
  /**
   * True when there is NO active session at all (user === null).
   * Distinct from `isAnonymous`, which requires an anonymous Auth account.
   */
  isUnauthenticated: boolean;
  role: UserRole;
  isModerator: boolean;
  /**
   * Links the anonymous account to Google.
   * - Web/Electron: popup
   * - Capacitor: redirect (result handled on next app open)
   * If the Google account is already registered, signs in to that account instead.
   */
  linkWithGoogle: () => Promise<void>;
  /**
   * Links/signs in with email + password.
   * - `mode: 'register'` → linkWithEmailAndPassword (preserves anonymous UID)
   * - `mode: 'signin'`   → signInWithEmailAndPassword (switches to existing account)
   */
  linkWithEmail: (email: string, password: string, mode: 'register' | 'signin') => Promise<void>;
  /** Signs out — user becomes null (unauthenticated). No anonymous re-sign-in. */
  signOut: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<UserRole>('user');
  const dispatch = useDispatch<AppDispatch>();

  // 0. On Capacitor: pick up any pending redirect result immediately.
  useEffect(() => {
    getRedirectResult(auth).catch(() => {
      // No redirect pending — ignore
    });
  }, []);

  // 1. Subscribe to auth state. If no session exists, sign in anonymously.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Clear user-specific Dexie data when a different user logs in
        try {
          const prevUid = localStorage.getItem('activeUserId');
          if (prevUid && prevUid !== firebaseUser.uid) {
            const { getDB } = await import('@/app/src/lib/db');
            const db = getDB();
            await db.playedLevels.clear();
            await db.syncMeta.clear();
          }
          localStorage.setItem('activeUserId', firebaseUser.uid);
        } catch { /* ignore */ }

        setUser(firebaseUser);

        const authProvider = resolveAuthProvider(firebaseUser);
        dispatch(
          setAuthUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            isAnonymous: firebaseUser.isAnonymous,
            authProvider,
          }),
        );
      } else {
        // User is signed out — stay unauthenticated (null).
        // JIT anonymous sign-in happens in play/page.tsx and game/page.tsx
        // right before the first level is loaded.
        setUser(null);
        dispatch(resetUser());
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [dispatch]);

  // 2. Whenever user changes: sync Firestore doc + read role.
  useEffect(() => {
    if (!user) return;

    async function syncUser() {
      if (!user) return;
      try {
        const accepted = localStorage.getItem('accepted_terms') === 'true';
        if (accepted) {
          localStorage.removeItem('accepted_terms');
        }
        // Only sync Firestore doc for real (non-anonymous) users.
        // Anonymous users get their doc lazily created by the Worker on first level completion.
        if (!user.isAnonymous) {
          await createOrUpdateUserDoc(user, accepted);
        }
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          const firestoreRole = (data.role as UserRole) ?? 'user';
          setRole(firestoreRole);
          dispatch(
            setFirestoreData({
              role: firestoreRole,
              totalScore: data.totalScore ?? 0,
              completedCount: data.completedCount ?? 0,
              tag: data.tag ?? null,
            }),
          );
        }
      } catch (err) {
        console.error('[Auth] Firestore user sync failed:', err);
      } finally {
        setLoading(false);
      }
    }

    syncUser();
  }, [user, dispatch]);

  // 3. Google sign-in / linking
  // - user === null  → unauthenticated guest  → signInWithPopup / signInWithCredential
  // - user.isAnonymous → anonymous session     → linkWithPopup (preserves UID & data)
  const linkWithGoogle = useCallback(async () => {
    let credential: ReturnType<typeof GoogleAuthProvider.credential> | null = null;

    try {
      if (isNativePlatform()) {
        const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth');
        try {
          await GoogleAuth.initialize({
            clientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID || '1041986277726-9otkut2eqcl61rs3rokmgcqn184g42pu.apps.googleusercontent.com',
            scopes: ['profile', 'email'],
            grantOfflineAccess: true,
          });
        } catch { /* ignore if already initialized */ }

        const googleUser = await GoogleAuth.signIn();
        const idToken = googleUser.authentication.idToken;
        if (!idToken) throw new Error('Google Sign-in failed: No ID Token returned.');

        credential = GoogleAuthProvider.credential(idToken);

        // Native: link if anonymous, otherwise sign in directly
        if (user?.isAnonymous) {
          await linkWithCredential(user, credential);
        } else {
          await signInWithCredential(auth, credential);
        }
      } else {
        const provider = new GoogleAuthProvider();

        if (user?.isAnonymous) {
          // Anonymous session exists → link to preserve UID and game data
          await linkWithPopup(user, provider);
        } else {
          // No session (guest) → direct sign-in
          await signInWithPopup(auth, provider);
        }

        // Force immediate state update (onAuthStateChanged may delay for same-UID link)
        const current = auth.currentUser!;
        setUser(current);
        dispatch(
          setAuthUser({
            uid: current.uid,
            email: current.email,
            displayName: current.displayName,
            isAnonymous: false,
            authProvider: resolveAuthProvider(current),
          }),
        );
        return;
      }

      // Native path: update state after credential operation
      const current = auth.currentUser!;
      setUser(current);
      dispatch(
        setAuthUser({
          uid: current.uid,
          email: current.email,
          displayName: current.displayName,
          isAnonymous: false,
          authProvider: resolveAuthProvider(current),
        }),
      );
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code === 'auth/credential-already-in-use' ||
        code === 'auth/email-already-in-use'
      ) {
        // Google account already registered — sign in to that account instead
        const finalCredential = credential || GoogleAuthProvider.credentialFromError(
          err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0],
        );
        if (finalCredential) {
          await signInWithCredential(auth, finalCredential);
          // onAuthStateChanged fires here (UID changes)
        }
      } else {
        throw err;
      }
    }
  }, [user, dispatch]);

  // 4. Email/password sign-in / linking
  // - mode 'register':
  //     user.isAnonymous → linkWithCredential (preserves anonymous UID & game data)
  //     user === null    → createUserWithEmailAndPassword (fresh account)
  // - mode 'signin':
  //     always signInWithEmailAndPassword regardless of current session
  const linkWithEmail = useCallback(
    async (email: string, password: string, mode: 'register' | 'signin') => {
      if (mode === 'register') {
        if (user?.isAnonymous) {
          // Anonymous session exists → link to preserve UID and game data
          const credential = EmailAuthProvider.credential(email, password);
          await linkWithCredential(user, credential);
          // Force immediate state update (onAuthStateChanged may delay for same-UID link)
          const current = auth.currentUser!;
          setUser(current);
          dispatch(
            setAuthUser({
              uid: current.uid,
              email: current.email,
              displayName: current.displayName,
              isAnonymous: false,
              authProvider: 'email',
            }),
          );
        } else {
          // No session (guest) → create a brand-new account directly
          await createUserWithEmailAndPassword(auth, email, password);
          // onAuthStateChanged fires and handles state update
        }
      } else {
        // Sign in to existing account
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged fires for this case
      }
    },
    [user, dispatch],
  );

  // 5. Sign out → user becomes null (unauthenticated), no anonymous re-sign-in
  const signOut = useCallback(async () => {
    dispatch(resetUser());
    await firebaseSignOut(auth);
    // onAuthStateChanged fires with null → user stays null (guest/unauthenticated)
  }, [dispatch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        // isAnonymous: only true for an active anonymous Firebase Auth session.
        // Defaults to false (not true) when user is null — unauthenticated ≠ anonymous.
        isAnonymous: user?.isAnonymous ?? false,
        // isUnauthenticated: true when there is no session at all (user === null).
        isUnauthenticated: user === null,
        role,
        isModerator: role === 'admin' || role === 'moderator',
        linkWithGoogle,
        linkWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>');
  return ctx;
}
