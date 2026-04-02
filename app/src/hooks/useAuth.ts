'use client';

/**
 * useAuth — access auth state from any client component.
 *
 * Returns { user, loading, isAnonymous, linkWithGoogle }.
 *
 * Example — saving a completed level:
 *
 *   const { user } = useAuth();
 *
 *   async function handleWin() {
 *     if (user) {
 *       await savePlayedLevel(user.uid, level.id, { score, timeSpent });
 *     }
 *   }
 *
 * Example — Google linking button:
 *
 *   const { isAnonymous, linkWithGoogle } = useAuth();
 *
 *   async function handleSaveProgress() {
 *     try {
 *       await linkWithGoogle();
 *     } catch (err: unknown) {
 *       if ((err as { code?: string }).code === 'auth/credential-already-in-use') {
 *         alert('This Google account is already linked to another profile.');
 *       }
 *     }
 *   }
 */
export { useAuthContext as useAuth } from '@/app/src/contexts/AuthContext';
