'use client';

import { LANGS } from '../lib/i18n';
import { useLanguage } from '../contexts/LanguageContext';

/**
 * Fixed bottom-right language toggle.
 * To add a new language: add its entry to app/src/lib/i18n/index.ts LANGS array
 * and create app/src/lib/i18n/<code>.ts — no other changes needed.
 */
export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 14,
        right: 14,
        zIndex: 200,
        display: 'flex',
        gap: 4,
      }}
    >
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => setLang(code)}
          style={{
            padding: '3px 9px',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            background:
              lang === code
                ? 'rgba(0,255,136,0.12)'
                : 'rgba(255,255,255,0.03)',
            border: `1px solid ${
              lang === code
                ? 'rgba(0,255,136,0.45)'
                : 'rgba(255,255,255,0.1)'
            }`,
            color: lang === code ? '#00ff88' : '#334155',
            borderRadius: 5,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
