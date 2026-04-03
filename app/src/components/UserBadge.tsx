'use client';

import { useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import AuthModal from './AuthModal';
import { useT } from '../contexts/LanguageContext';

/**
 * Fixed top-right button visible on all pages.
 * - Anonymous  → "Giriş Yap" (emerald neon)
 * - Signed in  → initial letter avatar (sky neon)
 * Clicking opens AuthModal.
 */
export default function UserBadge() {
  const t = useT();
  const { user, isAnonymous, loading } = useAuthContext();
  const [open, setOpen] = useState(false);

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
          border: `1px solid ${signed ? '#00c4ff35' : '#00ff8830'}`,
          borderRadius: signed ? '50%' : 8,
          background: signed ? '#00c4ff0d' : '#00ff880d',
          color: signed ? '#00c4ff' : '#00ff88',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: signed ? 0 : '0.08em',
          width: signed ? 34 : 'auto',
          height: 34,
          padding: signed ? 0 : '0 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 14px ${signed ? 'rgba(0,196,255,0.1)' : 'rgba(0,255,136,0.1)'}`,
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = signed ? '#00c4ff60' : '#00ff8860';
          el.style.boxShadow = `0 0 20px ${signed ? 'rgba(0,196,255,0.18)' : 'rgba(0,255,136,0.18)'}`;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.borderColor = signed ? '#00c4ff35' : '#00ff8830';
          el.style.boxShadow = `0 0 14px ${signed ? 'rgba(0,196,255,0.1)' : 'rgba(0,255,136,0.1)'}`;
        }}
      >
        {signed ? initial : t('auth.sign_in')}
      </button>

      {open && <AuthModal onClose={() => setOpen(false)} />}
    </>
  );
}
