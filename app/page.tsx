'use client';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#030712',
        gap: 48,
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: 42,
            fontWeight: 900,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#00ff88',
            textShadow: '0 0 20px rgba(0,255,136,0.6), 0 0 40px rgba(0,255,136,0.3)',
            margin: 0,
          }}
        >
          Know & Conquer
        </h1>
        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            color: '#334155',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          Grid Puzzle
        </p>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
        <button
          onClick={() => router.push('/game')}
          style={{
            width: 220,
            padding: '14px 0',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'rgba(0,255,136,0.08)',
            border: '1px solid rgba(0,255,136,0.5)',
            color: '#00ff88',
            borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(0,255,136,0.12)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = 'rgba(0,255,136,0.15)';
            el.style.boxShadow = '0 0 28px rgba(0,255,136,0.28)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = 'rgba(0,255,136,0.08)';
            el.style.boxShadow = '0 0 20px rgba(0,255,136,0.12)';
          }}
        >
          ▶ Play
        </button>

        <button
          onClick={() => router.push('/editor')}
          style={{
            width: 220,
            padding: '14px 0',
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            background: 'rgba(0,196,255,0.06)',
            border: '1px solid rgba(0,196,255,0.4)',
            color: '#00c4ff',
            borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 0 20px rgba(0,196,255,0.1)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            const el = e.currentTarget;
            el.style.background = 'rgba(0,196,255,0.12)';
            el.style.boxShadow = '0 0 28px rgba(0,196,255,0.24)';
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget;
            el.style.background = 'rgba(0,196,255,0.06)';
            el.style.boxShadow = '0 0 20px rgba(0,196,255,0.1)';
          }}
        >
          ✦ Level Editor
        </button>
      </div>
    </main>
  );
}
