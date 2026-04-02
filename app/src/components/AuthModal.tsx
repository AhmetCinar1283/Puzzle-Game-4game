'use client';

import { useState, type FormEvent } from 'react';
import { useAuthContext } from '../contexts/AuthContext';

interface Props {
  onClose: () => void;
}

// ─── Google icon ─────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

// ─── Error messages ───────────────────────────────────────────────────────────

function toMessage(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  if (code === 'auth/invalid-email') return 'Geçersiz e-posta adresi.';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'E-posta veya şifre hatalı.';
  if (code === 'auth/user-not-found') return 'Bu e-posta ile kayıtlı kullanıcı bulunamadı.';
  if (code === 'auth/email-already-in-use') return 'Bu e-posta zaten kullanımda. Giriş Yap sekmesini deneyin.';
  if (code === 'auth/weak-password') return 'Şifre en az 6 karakter olmalıdır.';
  if (code === 'auth/popup-closed-by-user') return '';
  if (code === 'auth/provider-already-linked') return 'Bu hesap zaten bağlı.';
  return 'Bir hata oluştu. Lütfen tekrar deneyin.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthModal({ onClose }: Props) {
  const { user, isAnonymous, linkWithGoogle, linkWithEmail, signOut } = useAuthContext();

  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onClose();
    } catch (err) {
      const msg = toMessage(err);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = () => run(linkWithGoogle);

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    run(() => linkWithEmail(email, password, tab));
  };

  const handleSignOut = () => run(signOut);

  // ── Signed-in view ──────────────────────────────────────────────────────────
  if (!isAnonymous) {
    const name = user?.displayName ?? user?.email ?? 'Kullanıcı';
    const provider = user?.providerData?.[0]?.providerId ?? '';
    const providerLabel = provider === 'google.com' ? 'Google' : provider === 'password' ? 'E-posta' : '';

    return (
      <Backdrop onClose={onClose}>
        <h2 style={headingStyle}>Hesabım</h2>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '4px 0 6px' }}>{name}</p>
        {providerLabel && (
          <p style={{ color: '#374151', fontSize: 11, margin: '0 0 24px', letterSpacing: '0.06em' }}>
            {providerLabel} ile giriş yapıldı
          </p>
        )}
        <button onClick={handleSignOut} disabled={busy} style={dangerBtn}>
          {busy ? '...' : 'Çıkış Yap'}
        </button>
        {error && <p style={errorStyle}>{error}</p>}
      </Backdrop>
    );
  }

  // ── Sign-in view ─────────────────────────────────────────────────────────────
  return (
    <Backdrop onClose={onClose}>
      <h2 style={headingStyle}>Hesap Oluştur</h2>
      <p style={{ color: '#4b5563', fontSize: 12, margin: '4px 0 20px', lineHeight: 1.6 }}>
        İlerlemenizi kaydedin ve tüm cihazlarınızdan erişin.
      </p>

      {/* Google */}
      <button onClick={handleGoogle} disabled={busy} style={googleBtn}>
        <GoogleIcon />
        Google ile Devam Et
      </button>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
        <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
        <span style={{ color: '#374151', fontSize: 11 }}>veya e-posta ile</span>
        <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 14, background: '#0d1420', borderRadius: 8, padding: 3 }}>
        {(['signin', 'register'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); }}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: tab === t ? '#00ff8814' : 'transparent',
              color: tab === t ? '#00ff88' : '#4b5563',
              transition: 'all 0.15s',
            }}
          >
            {t === 'signin' ? 'Giriş Yap' : 'Kayıt Ol'}
          </button>
        ))}
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="email"
          placeholder="E-posta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Şifre"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />
        {error && <p style={errorStyle}>{error}</p>}
        <button type="submit" disabled={busy || !email || !password} style={{ ...primaryBtn, marginTop: 4 }}>
          {busy ? '...' : tab === 'signin' ? 'Giriş Yap' : 'Kayıt Ol'}
        </button>
      </form>

      <p style={{ color: '#374151', fontSize: 11, marginTop: 16, lineHeight: 1.5 }}>
        {tab === 'signin'
          ? 'Hesabınız yok mu? '
          : 'Zaten hesabınız var mı? '}
        <button
          onClick={() => { setTab(tab === 'signin' ? 'register' : 'signin'); setError(''); }}
          style={{ background: 'none', border: 'none', color: '#00ff8888', cursor: 'pointer', fontSize: 11, padding: 0 }}
        >
          {tab === 'signin' ? 'Kayıt olun' : 'Giriş yapın'}
        </button>
      </p>
    </Backdrop>
  );
}

// ─── Backdrop wrapper ─────────────────────────────────────────────────────────

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(3,7,18,0.88)', backdropFilter: 'blur(6px)',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: '#0a0f1a',
          border: '1px solid #00ff8820',
          borderRadius: 16,
          padding: '28px 24px 24px',
          width: '100%',
          maxWidth: 340,
          boxShadow: '0 0 60px rgba(0,255,136,0.06), 0 20px 60px rgba(0,0,0,0.6)',
          position: 'relative',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, right: 14,
            background: 'none', border: 'none', color: '#374151',
            cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 4,
          }}
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  color: '#00ff88',
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: '0.05em',
  margin: '0 0 2px',
  textShadow: '0 0 20px rgba(0,255,136,0.4)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#060c16',
  border: '1px solid #1f2937',
  borderRadius: 8,
  color: '#e5e7eb',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

const googleBtn: React.CSSProperties = {
  width: '100%',
  padding: '10px 16px',
  background: '#fff',
  border: 'none',
  borderRadius: 8,
  color: '#111827',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  boxSizing: 'border-box',
};

const primaryBtn: React.CSSProperties = {
  width: '100%',
  padding: '10px 0',
  background: '#00ff8812',
  border: '1px solid #00ff8840',
  borderRadius: 8,
  color: '#00ff88',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '0.06em',
  cursor: 'pointer',
  boxSizing: 'border-box',
};

const dangerBtn: React.CSSProperties = {
  width: '100%',
  padding: '10px 0',
  background: '#ef444412',
  border: '1px solid #ef444435',
  borderRadius: 8,
  color: '#ef4444',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  boxSizing: 'border-box',
};

const errorStyle: React.CSSProperties = {
  color: '#ef4444',
  fontSize: 12,
  margin: '2px 0 0',
  lineHeight: 1.5,
};
