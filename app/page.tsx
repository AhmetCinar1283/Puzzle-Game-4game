'use client';
import { useRouter } from 'next/navigation';

const NAV = [
  { href: '/game', label: '▶ Play', color: '#00ff88', sub: 'Continue from levels list' },
  { href: '/levels', label: '☰ Levels', color: '#ffd700', sub: 'Browse & reorder levels' },
  { href: '/editor', label: '✦ Editor', color: '#00c4ff', sub: 'Create & edit levels' },
];

export default function Home() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030712',
        gap: 48,
        padding: '32px 16px',
        boxSizing: 'border-box',
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 900,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#00ff88',
            textShadow: '0 0 20px rgba(0,255,136,0.6), 0 0 40px rgba(0,255,136,0.25)',
            margin: 0,
          }}
        >
          Know & Conquer
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            color: '#1e3a5f',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
          }}
        >
          Grid Puzzle
        </p>
      </div>

      {/* Nav buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', width: '100%', maxWidth: 260 }}>
        {NAV.map(({ href, label, color, sub }) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            style={{
              width: '100%',
              padding: '14px 0',
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: `${color}0d`,
              border: `1px solid ${color}50`,
              color,
              borderRadius: 10,
              cursor: 'pointer',
              boxShadow: `0 0 18px ${color}18`,
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              el.style.background = `${color}18`;
              el.style.boxShadow = `0 0 26px ${color}2e`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              el.style.background = `${color}0d`;
              el.style.boxShadow = `0 0 18px ${color}18`;
            }}
          >
            <span>{label}</span>
            <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.08em', opacity: 0.5, textTransform: 'none' }}>{sub}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
