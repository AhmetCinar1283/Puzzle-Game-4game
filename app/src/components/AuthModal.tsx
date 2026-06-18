'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { useAuthContext } from '../contexts/AuthContext';
import { useT, useLanguage } from '../contexts/LanguageContext';
import { LANGS, type Lang } from '../lib/i18n';
import { functions, db } from '../lib/firebase/config';

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

function toMessageKey(err: unknown): string {
  const code = (err as { code?: string }).code ?? '';
  if (code === 'auth/invalid-email') return 'auth.err_invalid_email';
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') return 'auth.err_wrong_password';
  if (code === 'auth/user-not-found') return 'auth.err_user_not_found';
  if (code === 'auth/email-already-in-use') return 'auth.err_email_in_use';
  if (code === 'auth/weak-password') return 'auth.err_weak_password';
  if (code === 'auth/popup-closed-by-user') return '';
  if (code === 'auth/provider-already-linked') return 'auth.err_already_linked';
  return 'auth.err_generic';
}

// ─── Tag data shape ───────────────────────────────────────────────────────────

interface TagData {
  tag?: string;
  tagChangeCount: number;
  tagChangedAt: Date | null;
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function AuthModal({ onClose }: Props) {
  const t = useT();
  const { lang, setLang } = useLanguage();
  const { user, isAnonymous, linkWithGoogle, linkWithEmail, signOut } = useAuthContext();

  const [tab, setTab] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Tag state (signed-in view only)
  const [tagData, setTagData] = useState<TagData | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tagBusy, setTagBusy] = useState(false);
  const [tagError, setTagError] = useState('');
  const [tagSuccess, setTagSuccess] = useState(false);

  useEffect(() => {
    if (isAnonymous || !user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setTagData({
          tag: d.tag,
          tagChangeCount: d.tagChangeCount ?? 0,
          tagChangedAt: d.tagChangedAt?.toDate() ?? null,
        });
      }
    });
  }, [isAnonymous, user]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      onClose();
    } catch (err: any) {
      console.error('[AuthModal] Error during auth operation:', err);
      if (err && typeof err === 'object') {
        console.error('[AuthModal] Error Code:', err.code);
        console.error('[AuthModal] Error Message:', err.message);
      }
      const key = toMessageKey(err);
      if (key) setError(t(key));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = () => {
    if (!acceptedTerms) {
      setError(t('auth.err_terms_required'));
      return;
    }
    localStorage.setItem('accepted_terms', 'true');
    run(linkWithGoogle);
  };

  const handleEmailSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (tab === 'register' && !acceptedTerms) {
      setError(t('auth.err_terms_required'));
      return;
    }
    if (tab === 'register') {
      localStorage.setItem('accepted_terms', 'true');
    }
    run(() => linkWithEmail(email, password, tab));
  };

  const handleSignOut = () => run(signOut);

  const handleTagSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    setTagBusy(true);
    setTagError('');
    setTagSuccess(false);
    try {
      const fn = httpsCallable<{ tag: string }, { tag: string }>(functions, 'requestNewTag');
      const result = await fn({ tag: tagInput.trim() });
      const newTag = result.data.tag;
      setTagData((prev) =>
        prev
          ? { ...prev, tag: newTag, tagChangeCount: prev.tagChangeCount + 1, tagChangedAt: new Date() }
          : prev,
      );
      setTagInput('');
      setTagSuccess(true);
    } catch (err) {
      const msg = (err as { message?: string }).message ?? '';
      if (msg === 'TAG_INVALID_CHARS') setTagError(t('auth.err_tag_chars'));
      else if (msg.startsWith('TAG_LENGTH')) setTagError(t('auth.err_tag_length'));
      else if (msg === 'TAG_TAKEN') setTagError(t('auth.err_tag_taken'));
      else if (msg.startsWith('TAG_COOLDOWN')) {
        const days = msg.split(':')[1] ?? '14';
        setTagError(t('auth.err_tag_cooldown', { n: days }));
      } else if (msg === 'TAG_MAX_CHANGES') setTagError(t('auth.err_tag_max'));
      else setTagError(t('auth.err_generic'));
    } finally {
      setTagBusy(false);
    }
  };

  // ── Signed-in view ──────────────────────────────────────────────────────────
  if (user !== null && !isAnonymous) {
    const name = user?.displayName ?? user?.email ?? t('auth.sign_in');
    const provider = user?.providerData?.[0]?.providerId ?? '';
    const providerLabel = provider === 'google.com' ? 'Google' : provider === 'password' ? t('auth.email') : '';

    const now = Date.now();
    const lastChangeMs = tagData?.tagChangedAt?.getTime() ?? 0;
    const msRemaining = lastChangeMs + TWO_WEEKS_MS - now;
    const daysRemaining = tagData?.tagChangedAt ? Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000))) : 0;
    const changesLeft = Math.max(0, 5 - (tagData?.tagChangeCount ?? 0));
    const canChange = changesLeft > 0 && daysRemaining === 0;

    return (
      <Backdrop onClose={onClose}>
        <h2 style={headingStyle}>{t('auth.my_account')}</h2>
        <p style={{ color: '#9ca3af', fontSize: 13, margin: '4px 0 6px' }}>{name}</p>
        {providerLabel && (
          <p style={{ color: '#374151', fontSize: 11, margin: '0 0 16px', letterSpacing: '0.06em' }}>
            {t('auth.signed_in_with', { provider: providerLabel })}
          </p>
        )}

        {/* Tag section */}
        <div style={{ borderTop: '1px solid #0d1420', paddingTop: 14, marginBottom: 14 }}>
          <p style={{ color: '#4b5563', fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, margin: '0 0 8px' }}>
            {t('auth.tag_section')}
          </p>
          {tagData === null ? (
            <p style={{ color: '#374151', fontSize: 12, margin: 0 }}>...</p>
          ) : (
            <>
              {tagData.tag ? (
                <p style={{ color: '#00ff88', fontSize: 22, fontWeight: 800, letterSpacing: '0.12em', margin: '0 0 6px', textShadow: '0 0 14px rgba(0,255,136,0.4)' }}>
                  #{tagData.tag}
                </p>
              ) : (
                <p style={{ color: '#374151', fontSize: 12, margin: '0 0 6px' }}>{t('auth.tag_no_tag')}</p>
              )}
              <p style={{ color: '#4b5563', fontSize: 11, margin: '0 0 4px' }}>
                {changesLeft > 0 ? t('auth.tag_changes_remaining', { n: changesLeft }) : t('auth.tag_max_reached')}
              </p>
              {tagData.tagChangedAt && daysRemaining > 0 && (
                <p style={{ color: '#374151', fontSize: 11, margin: '0 0 4px' }}>
                  {t('auth.tag_cooldown', { n: daysRemaining })}
                </p>
              )}
              {canChange && (
                <form onSubmit={handleTagSubmit} style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder={t('auth.tag_placeholder')}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value.toUpperCase())}
                    maxLength={10}
                    style={{ ...inputStyle, flex: 1, fontSize: 12, padding: '8px 10px' }}
                  />
                  <button
                    type="submit"
                    disabled={tagBusy || !tagInput.trim()}
                    style={{ ...primaryBtn, width: 'auto', padding: '8px 14px', fontSize: 12, flexShrink: 0 }}
                  >
                    {tagBusy ? '...' : t('auth.tag_save')}
                  </button>
                </form>
              )}
              {tagError && <p style={{ ...errorStyle, marginTop: 4 }}>{tagError}</p>}
              {tagSuccess && (
                <p style={{ color: '#00ff88', fontSize: 12, margin: '4px 0 0' }}>{t('auth.tag_updated')}</p>
              )}
            </>
          )}
        </div>

        <LangSection lang={lang} setLang={setLang} label={t('auth.language')} />
        <button onClick={handleSignOut} disabled={busy} style={dangerBtn}>
          {busy ? '...' : t('auth.sign_out')}
        </button>
        {error && <p style={errorStyle}>{error}</p>}
      </Backdrop>
    );
  }

  // ── Sign-in view ─────────────────────────────────────────────────────────────
  return (
    <Backdrop onClose={onClose}>
      <h2 style={headingStyle}>{t('auth.create_account')}</h2>
      <p style={{ color: '#4b5563', fontSize: 12, margin: '4px 0 20px', lineHeight: 1.6 }}>
        {t('auth.save_progress')}
      </p>

      {/* Google */}
      <button onClick={handleGoogle} disabled={busy} style={googleBtn}>
        <GoogleIcon />
        {t('auth.continue_google')}
      </button>

      {/* Legal Acceptance Checkbox */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '14px 0 6px' }}>
        <input
          type="checkbox"
          id="terms-checkbox"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          style={{
            marginTop: 3,
            cursor: 'pointer',
            accentColor: '#00ff88',
            width: 16,
            height: 16,
            flexShrink: 0,
          }}
        />
        <label htmlFor="terms-checkbox" style={{ color: '#64748b', fontSize: 11, lineHeight: 1.5, cursor: 'pointer', userSelect: 'none' }}>
          {t('auth.terms_checkbox_text_1')}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={legalLinkStyle} onMouseEnter={(e) => e.currentTarget.style.color = '#00c4ff'} onMouseLeave={(e) => e.currentTarget.style.color = '#00ff88'}>
            {t('auth.terms_checkbox_text_2')}
          </a>
          {t('auth.terms_checkbox_text_3')}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={legalLinkStyle} onMouseEnter={(e) => e.currentTarget.style.color = '#00c4ff'} onMouseLeave={(e) => e.currentTarget.style.color = '#00ff88'}>
            {t('auth.terms_checkbox_text_4')}
          </a>
          {t('auth.terms_checkbox_text_5')}
          <a href="/kvkk" target="_blank" rel="noopener noreferrer" style={legalLinkStyle} onMouseEnter={(e) => e.currentTarget.style.color = '#00c4ff'} onMouseLeave={(e) => e.currentTarget.style.color = '#00ff88'}>
            {t('auth.terms_checkbox_text_6')}
          </a>
          {t('auth.terms_checkbox_text_7')}
        </label>
      </div>

      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
        <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
        <span style={{ color: '#374151', fontSize: 11 }}>{t('auth.or_email')}</span>
        <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
      </div>

      {/* Tab toggle */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 14, background: '#0d1420', borderRadius: 8, padding: 3 }}>
        {(['signin', 'register'] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => { setTab(tabKey); setError(''); setAcceptedTerms(false); }}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: tab === tabKey ? '#00ff8814' : 'transparent',
              color: tab === tabKey ? '#00ff88' : '#4b5563',
              transition: 'all 0.15s',
            }}
          >
            {tabKey === 'signin' ? t('auth.tab_signin') : t('auth.tab_register')}
          </button>
        ))}
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
        />
        <input
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={inputStyle}
        />
        {error && <p style={errorStyle}>{error}</p>}
        <button type="submit" disabled={busy || !email || !password} style={{ ...primaryBtn, marginTop: 4 }}>
          {busy ? '...' : tab === 'signin' ? t('auth.tab_signin') : t('auth.tab_register')}
        </button>
      </form>

      <p style={{ color: '#374151', fontSize: 11, marginTop: 16, lineHeight: 1.5 }}>
        {tab === 'signin' ? t('auth.no_account') : t('auth.have_account')}{' '}
        <button
          onClick={() => { setTab(tab === 'signin' ? 'register' : 'signin'); setError(''); }}
          style={{ background: 'none', border: 'none', color: '#00ff8888', cursor: 'pointer', fontSize: 11, padding: 0 }}
        >
          {tab === 'signin' ? t('auth.sign_up_link') : t('auth.sign_in_link')}
        </button>
      </p>

      <div style={{ borderTop: '1px solid #0d1420', marginTop: 20, paddingTop: 16 }}>
        <LangSection lang={lang} setLang={setLang} label={t('auth.language')} />
      </div>
    </Backdrop>
  );
}

// ─── Language section ─────────────────────────────────────────────────────────

function LangSection({ lang, setLang, label }: { lang: Lang; setLang: (l: Lang) => void; label: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ color: '#4b5563', fontSize: 10, letterSpacing: '0.1em', fontWeight: 700, margin: '0 0 8px' }}>
        {label}
      </p>
      <div style={{ display: 'flex', gap: 6 }}>
        {LANGS.map(({ code, label: lbl }) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            style={{
              padding: '5px 14px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              background: lang === code ? 'rgba(0,255,136,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${lang === code ? 'rgba(0,255,136,0.4)' : '#1f2937'}`,
              color: lang === code ? '#00ff88' : '#374151',
              borderRadius: 6,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
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

const legalLinkStyle: React.CSSProperties = {
  color: '#00ff88',
  textDecoration: 'underline',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'color 0.15s',
};
