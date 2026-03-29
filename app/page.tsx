'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

const NEON_TYPES = [
  { color: '#00ff88', glow: '0 0 6px #00ff88, 0 0 18px rgba(0,255,136,0.3)' },
  { color: '#00c4ff', glow: '0 0 6px #00c4ff, 0 0 18px rgba(0,196,255,0.3)' },
  { color: '#ffd700', glow: '0 0 6px #ffd700, 0 0 18px rgba(255,215,0,0.3)' },
  { color: '#fbbf24', glow: '0 0 6px #fbbf24, 0 0 18px rgba(251,191,36,0.3)' },
  { color: '#9333ea', glow: '0 0 6px #9333ea, 0 0 18px rgba(147,51,234,0.3)' },
  { color: '#a5f3fc', glow: '0 0 6px #a5f3fc, 0 0 18px rgba(165,243,252,0.3)' },
  { color: '#ec4899', glow: '0 0 6px #ec4899, 0 0 18px rgba(236,72,153,0.3)' },
  { color: '#f97316', glow: '0 0 6px #f97316, 0 0 18px rgba(249,115,22,0.3)' },
];

type Particle = {
  id: number;
  color: string;
  glow: string;
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  duration: number;
  delay: number;
  opacity: number;
  borderRadius: number;
};

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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Generate particles with window dimensions (client only)
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const list: Particle[] = Array.from({ length: 30 }, (_, i) => {
      const type = NEON_TYPES[i % NEON_TYPES.length];
      return {
        id: i,
        color: type.color,
        glow: type.glow,
        size: 9 + Math.random() * 19,
        startX: Math.random() * vw,
        startY: Math.random() * vh,
        driftX: (Math.random() - 0.5) * 100,
        duration: 12 + Math.random() * 14,
        delay: -(Math.random() * 26),
        opacity: 0.12 + Math.random() * 0.22,
        borderRadius: Math.random() > 0.55 ? 50 : 3,
      };
    });
    setParticles(list);
  }, []);

  // Menu music (loop, low volume)
  useEffect(() => {
    const audio = new Audio('/sounds/menu.mp3');
    audio.loop = true;
    audio.volume = 0.18;
    audioRef.current = audio;

    audio.play().catch(() => {
      // Autoplay blocked — unlock on first interaction
      const unlock = () => {
        audio.play().catch(() => {});
      };
      window.addEventListener('click', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
    });

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

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
    <>
      {/* Floating background particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: p.size,
              height: p.size,
              borderRadius: p.borderRadius,
              background: p.color,
              boxShadow: p.glow,
            }}
            animate={{
              x: [p.startX, p.startX + p.driftX],
              y: [p.startY, -60],
              opacity: [0, p.opacity, p.opacity, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <main
        style={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
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
            Syncron
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
    </>
  );
}
