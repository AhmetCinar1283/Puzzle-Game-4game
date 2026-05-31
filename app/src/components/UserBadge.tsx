'use client';

import { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { useT } from '../contexts/LanguageContext';
import { subscribeToUserTickets } from '../lib/firebase/support';

/**
 * Fixed top-right button visible on all pages.
 * - Anonymous  → "Giriş Yap" (emerald neon)
 * - Signed in  → initial letter avatar (sky neon)
 * - Has unread ticket → displays a pulsing green/emerald notification dot.
 * Clicking opens AuthModal.
 */
export default function UserBadge() {
  const t = useT();
  const { user, isAnonymous, loading } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  // Subscribe to user tickets for live unread updates
  useEffect(() => {
    if (loading || !user || isAnonymous) {
      setHasUnread(false);
      return;
    }

    try {
      const unsubscribe = subscribeToUserTickets(user.uid, (tickets) => {
        const unread = tickets.some((t) => t.hasUnreadUser === true);
        setHasUnread(unread);
      });
      return () => unsubscribe();
    } catch (err) {
      console.warn('[UserBadge] Failed to subscribe to user tickets:', err);
    }
  }, [user, isAnonymous, loading]);

  if (loading) return null;

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? null;
  const initial = displayName?.[0]?.toUpperCase() ?? '?';
  const signed = !isAnonymous;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={signed ? (displayName ?? t('auth.my_account')) : t('auth.sign_in')}
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 200,
          cursor: 'pointer',
          border: `1px solid ${signed ? (hasUnread ? '#00ff8870' : '#00c4ff35') : '#00ff8830'}`,
          borderRadius: signed ? '50%' : 8,
          background: signed ? '#00c4ff0d' : '#00ff880d',
          color: signed ? (hasUnread ? '#00ff88' : '#00c4ff') : '#00ff88',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: signed ? 0 : '0.08em',
          width: signed ? 34 : 'auto',
          height: 34,
          padding: signed ? 0 : '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 14px ${signed ? (hasUnread ? 'rgba(0,255,136,0.18)' : 'rgba(0,196,255,0.1)') : 'rgba(0,255,136,0.1)'}`,
          transition: 'border-color 0.15s, box-shadow 0.15s, color 0.15s',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = signed ? (hasUnread ? '#00ff88a0' : '#00c4ff60') : '#00ff8860';
          el.style.boxShadow = `0 0 20px ${signed ? (hasUnread ? 'rgba(0,255,136,0.3)' : 'rgba(0,196,255,0.18)') : 'rgba(0,255,136,0.18)'}`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = signed ? (hasUnread ? '#00ff8870' : '#00c4ff35') : '#00ff8830';
          el.style.boxShadow = `0 0 14px ${signed ? (hasUnread ? 'rgba(0,255,136,0.18)' : 'rgba(0,196,255,0.1)') : 'rgba(0,255,136,0.1)'}`;
        }}
      >
        {signed ? initial : t('auth.sign_in')}

        {/* Pulse unread dot */}
        {signed && hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: -1,
              right: -1,
              width: '9px',
              height: '9px',
              background: '#00ff88',
              borderRadius: '50%',
              boxShadow: '0 0 8px #00ff88, 0 0 16px #00ff88',
              border: '2px solid #030712',
              zIndex: 5,
            }}
          />
        )}
      </button>

      {open && <AuthModal onClose={() => setOpen(false)} />}
    </>
  );
}
