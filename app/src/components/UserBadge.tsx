'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  const router = useRouter();
  const pathname = usePathname();
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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

  // Listen for focus changes on home page
  useEffect(() => {
    if (pathname !== '/') {
      setIsFocused(false);
      return;
    }

    const handleFocus = (e: Event) => {
      const customEvent = e as CustomEvent;
      setIsFocused(customEvent.detail?.focused ?? false);
    };

    window.addEventListener('home-profile-focus', handleFocus);
    return () => {
      window.removeEventListener('home-profile-focus', handleFocus);
    };
  }, [pathname]);

  if (loading) return null;

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? null;
  const initial = displayName?.[0]?.toUpperCase() ?? '?';
  const signed = user !== null && !isAnonymous;
  const active = isFocused || isHovered;

  return (
    <>
      <button
        id="user-profile-badge"
        onClick={() => {
          if (signed) {
            router.push('/profile');
          } else {
            setOpen(true);
          }
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={
          isFocused
            ? (signed ? (hasUnread ? 'profile-focused-emerald' : 'profile-focused-cyan') : 'profile-focused-emerald')
            : ''
        }
        title={signed ? (displayName ?? t('auth.my_account')) : t('auth.sign_in')}
        style={{
          position: 'fixed',
          top: 14,
          right: 14,
          zIndex: 200,
          cursor: 'pointer',
          border: `1.5px solid ${
            active
              ? (signed ? (hasUnread ? '#00ff88' : '#00c4ff') : '#00ff88')
              : (signed ? (hasUnread ? '#00ff8870' : '#00c4ff35') : '#00ff8830')
          }`,
          borderRadius: signed ? (active ? 17 : '50%') : 8,
          background: signed
            ? (active ? 'rgba(0, 196, 255, 0.22)' : '#00c4ff0d')
            : (active ? 'rgba(0, 255, 136, 0.22)' : '#00ff880d'),
          color: signed
            ? (active ? '#fff' : (hasUnread ? '#00ff88' : '#00c4ff'))
            : (active ? '#fff' : '#00ff88'),
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: (signed && !active) ? 0 : '0.08em',
          width: signed ? (active ? 'auto' : 34) : 'auto',
          height: 34,
          padding: signed ? (active ? '0 10px' : '0') : '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: active
            ? (signed
                ? (hasUnread ? '0 0 24px rgba(0, 255, 136, 0.45)' : '0 0 24px rgba(0, 196, 255, 0.45)')
                : '0 0 24px rgba(0, 255, 136, 0.45)')
            : (signed
                ? (hasUnread ? '0 0 14px rgba(0, 255, 136, 0.18)' : '0 0 14px rgba(0, 196, 255, 0.1)')
                : '0 0 14px rgba(0, 255, 136, 0.1)'),
          transform: active ? 'scale(1.08)' : 'scale(1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s, box-shadow 0.15s, color 0.15s',
        }}
      >
        {signed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ transition: 'transform 0.2s' }}>{initial}</span>
            <span style={{
              maxWidth: active ? 90 : 0,
              opacity: active ? 1 : 0,
              overflow: 'hidden',
              transition: 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease',
              whiteSpace: 'nowrap',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.05em',
            }}>
              {displayName || t('auth.my_account')}
            </span>
          </div>
        ) : (
          t('auth.sign_in')
        )}

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
