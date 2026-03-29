'use client';
import { useRouter } from 'next/navigation';

const NAV_LOWER = [
  { href: '/levels', label: '☰ Levels', color: '#ffd700', sub: 'Browse & reorder levels' },
  { href: '/editor', label: '✦ Editor', color: '#00c4ff', sub: 'Create & edit levels' },
];

function NavButton({ label, sub, color, onClick }: { label: string; sub: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
  );
}

export default function Home() {
  const router = useRouter();

  function handlePlayClick() {
    try {
      const id = localStorage.getItem('lastPlayedLevelId');
      const src = localStorage.getItem('lastPlayedSource');
      if (id) {
        router.push(src === 'preset' ? `/game?id=${id}&source=preset` : `/game?id=${id}`);
        return;
      }
    } catch { /* ignore */ }
    router.push('/levels');
  }

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
        <NavButton
          label="▶ Play"
          sub="Continue last level"
          color="#00ff88"
          onClick={handlePlayClick}
        />
        {NAV_LOWER.map(({ href, label, color, sub }) => (
          <NavButton
            key={href}
            label={label}
            sub={sub}
            color={color}
            onClick={() => router.push(href)}
          />
        ))}
      </div>
    </main>
  );
}
