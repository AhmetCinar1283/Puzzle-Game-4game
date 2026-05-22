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
  signInAnonymously,
  signOut as firebaseSignOut,
  linkWithPopup,
  linkWithRedirect,
  linkWithCredential,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithCredential,
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
  isAnonymous: boolean;
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
  /** Signs out and immediately re-signs anonymously. */
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
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged fires again with the new anonymous user
        } catch (err) {
          console.error('[Auth] Anonymous sign-in failed:', err);
          setLoading(false);
        }
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
        await createOrUpdateUserDoc(user, accepted);
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

  // 3. Google linking
  const linkWithGoogle = useCallback(async () => {
    if (!user) throw new Error('No active session.');
    const provider = new GoogleAuthProvider();

    try {
      if (isNativePlatform()) {
        // Capacitor: redirect flow — page reloads, getRedirectResult picks up result
        await linkWithRedirect(user, provider);
      } else {
        await linkWithPopup(user, provider);
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
      }
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code === 'auth/credential-already-in-use' ||
        code === 'auth/email-already-in-use'
      ) {
        // Google account already registered — sign in to that account instead
        const credential = GoogleAuthProvider.credentialFromError(
          err as Parameters<typeof GoogleAuthProvider.credentialFromError>[0],
        );
        if (credential) {
          await signInWithCredential(auth, credential);
          // onAuthStateChanged fires here (UID changes)
        }
      } else {
        throw err;
      }
    }
  }, [user, dispatch]);

  // 4. Email/password
  const linkWithEmail = useCallback(
    async (email: string, password: string, mode: 'register' | 'signin') => {
      if (!user) throw new Error('No active session.');

      if (mode === 'register') {
        // v9 modular: credential nesnesi oluştur → linkWithCredential ile bağla
        // Bu sayede anonymous UID korunur, mevcut oyun verisi silinmez.
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
        // Sign in to existing account (switches UID; anonymous data on this device lost)
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged fires for this case (UID changes)
      }
    },
    [user, dispatch],
  );

  // 5. Sign out → re-sign anonymously via onAuthStateChanged handler
  const signOut = useCallback(async () => {
    dispatch(resetUser());
    await firebaseSignOut(auth);
    // onAuthStateChanged fires with null → triggers signInAnonymously
  }, [dispatch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAnonymous: user?.isAnonymous ?? true,
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
