'use client';

import { useAuth } from '@/app/src/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

interface AdminGuardProps {
  children: ReactNode;
}

/**
 * A security wrapper component for routes under /admin/*.
 * Validates the Firebase user session, and explicitly parses the custom claims
 * on the Firebase ID Token (decoded JWT token).
 * Redirects to /403 if claims.admin and claims.moderator are both missing/false.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [isValidated, setIsValidated] = useState<boolean>(false);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/');
      return;
    }

    const isAdmin = role === 'admin';
    const isMod = role === 'moderator';

    if (!isAdmin && !isMod) {
      console.warn('[AdminGuard] Access Denied: Role invalid.', { uid: user.uid, role });
      router.replace('/403');
    } else {
      setIsValidated(true);
    }
  }, [user, role, loading, router]);

  if (loading || (!isValidated && user)) {
    return (
      <main
        style={{
          minHeight: '100dvh',
          background: '#030712',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <span
          style={{
            color: '#00ff88',
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            textShadow: '0 0 10px rgba(0, 255, 136, 0.4)',
          }}
        >
          Securing Access Sector...
        </span>
      </main>
    );
  }

  if (!isValidated) {
    return null;
  }

  return <>{children}</>;
}
