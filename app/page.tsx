'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useUserStorage } from '@/app/src/lib/userStorage';
import { useSelector } from 'react-redux';
import { selectUser } from './src/store/userSlice';
import { useT, useLanguage } from './src/contexts/LanguageContext';
import { useGamepad } from './src/hooks/useGamepad';

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

function useNavLower(t: ReturnType<typeof useT>) {
  return [
    { href: '/levels', label: t('home.levels'), color: '#ffd700', sub: t('home.levels_sub') },
    { href: '/editor', label: t('home.editor'), color: '#00c4ff', sub: t('home.editor_sub') },
  ];
}

function NavButton({
  label, sub, color, onClick, isSelected, onMouseEnter
}: {
  label: string; sub: string; color: string; onClick: () => void; isSelected?: boolean; onMouseEnter?: () => void
}) {
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
        background: isSelected ? `${color}18` : `${color}0d`,
        border: isSelected ? `1px solid ${color}` : `1px solid ${color}50`,
        color,
        borderRadius: 10,
        cursor: 'pointer',
        boxShadow: isSelected ? `0 0 26px ${color}2e` : `0 0 18px ${color}18`,
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
      onMouseEnter={(e) => {
        onMouseEnter?.();
        const el = e.currentTarget;
        el.style.background = `${color}18`;
        el.style.boxShadow = `0 0 26px ${color}2e`;
        el.style.border = `1px solid ${color}`;
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          const el = e.currentTarget;
          el.style.background = `${color}0d`;
          el.style.boxShadow = `0 0 18px ${color}18`;
          el.style.border = `1px solid ${color}50`;
        }
      }}
    >
      <span>{label}</span>
      <span style={{ fontSize: 9, fontWeight: 400, letterSpacing: '0.08em', opacity: 0.5, textTransform: 'none' }}>{sub}</span>
    </button>
  );
}

export default function Home() {
  const t = useT();
  const { lang } = useLanguage();
  const isTr = lang === 'tr';
  const router = useRouter();
  const { getItem: storageGet } = useUserStorage();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const user = useSelector(selectUser);
  const NAV_LOWER = useNavLower(t);

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
    // const audio = new Audio('/sounds/menu.mp3');
    // audio.loop = true;
    // audio.volume = 0.18;
    // audioRef.current = audio;

    // audio.play().catch(() => {
    //   // Autoplay blocked — unlock on first interaction
    //   const unlock = () => {
    //     audio.play().catch(() => {});
    //   };
    //   window.addEventListener('click', unlock, { once: true });
    //   window.addEventListener('keydown', unlock, { once: true });
    //   window.addEventListener('touchstart', unlock, { once: true });
    // });

    // return () => {
    //   audio.pause();
    //   audio.src = '';
    // };
  }, []);

  const [activeMenuIndex, setActiveMenuIndex] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handlePlayClick = useCallback(() => {
    const id = storageGet('lastPlayedLevelId');
    const src = storageGet('lastPlayedSource');
    if (id) {
      router.push(src === 'preset' ? `/play?id=${id}&source=preset` : `/play?id=${id}`);
      return;
    }
    router.push('/levels');
  }, [router, storageGet]);

  const options = useMemo(() => {
    const opts = [
      { id: 'play', label: t('home.play'), sub: t('home.play_sub'), color: '#00ff88', onClick: handlePlayClick },
      { id: 'levels', label: t('home.levels'), sub: t('home.levels_sub'), color: '#ffd700', onClick: () => router.push('/levels') },
      { id: 'editor', label: t('home.editor'), sub: t('home.editor_sub'), color: '#00c4ff', onClick: () => router.push('/editor') },
      { id: 'controls', label: t('home.controls'), sub: t('home.controls_sub'), color: '#fbbf24', onClick: () => router.push('/controls') },
    ];
    if (user?.role === 'admin') {
      opts.push({ id: 'admin', label: t('home.admin'), sub: t('home.admin_sub'), color: '#00ff88', onClick: () => router.push('/admin') });
    }
    return opts;
  }, [t, user?.role, router, handlePlayClick]);

  useGamepad({
    onMove: (dir) => {
      if (dir === 'up') {
        setActiveMenuIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (dir === 'down') {
        setActiveMenuIndex((prev) => (prev + 1) % options.length);
      }
    },
    onConfirm: () => {
      options[activeMenuIndex]?.onClick();
    },
  });

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
          {options.map((opt, idx) => (
            <NavButton
              key={opt.id}
              label={opt.label}
              sub={opt.sub}
              color={opt.color}
              onClick={opt.onClick}
              isSelected={activeMenuIndex === idx}
              onMouseEnter={() => setActiveMenuIndex(idx)}
            />
          ))}
        </div>

        {/* How To Play — semantic content for SEO */}
        <section
          aria-label="How to play Syncron"
          style={{
            width: '100%',
            maxWidth: 480,
            borderTop: '1px solid #00ff8820',
            paddingTop: 28,
            color: '#4b5563',
            fontSize: 12,
            lineHeight: 1.7,
          }}
        >
          <h2
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#00ff8844',
              marginBottom: 14,
              marginTop: 0,
            }}
          >
            {t('home.how_to_play')}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' }}>
            {[
              { icon: '↑↓←→', key: 'home.tip_move' },
              { icon: '⊕', key: 'home.tip_win' },
              { icon: '❄', key: 'home.tip_ice' },
              { icon: '⟳', key: 'home.tip_toggle' },
              { icon: '◎', key: 'home.tip_teleporter' },
              { icon: '▶', key: 'home.tip_conveyor' },
              { icon: '⚡', key: 'home.tip_power' },
              { icon: '✦', key: 'home.tip_editor' },
            ].map(({ icon, key }) => (
              <div key={key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: '#00ff8833', flexShrink: 0, width: 18 }}>{icon}</span>
                <span>{t(key)}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16, marginBottom: 0, color: '#374151', fontSize: 11 }}>
            {t('home.seo')}{' '}
            <a
              href="https://syncron.polyvoclub.com"
              style={{ color: '#00ff8844', textDecoration: 'none' }}
            >
              syncron.polyvoclub.com
            </a>
            .
          </p>

          {/* Footer links */}
          <footer
            style={{
              marginTop: 24,
              display: 'flex',
              gap: 16,
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
              borderTop: '1px solid rgba(0, 255, 136, 0.1)',
              paddingTop: 16,
            }}
          >
            <a
              href="/support"
              style={{
                color: '#00ff8888',
                textDecoration: 'none',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#00ff88')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#00ff8888')}
            >
              {isTr ? 'DESTEK' : 'SUPPORT'}
            </a>
            <span style={{ color: '#1e3a5f', fontSize: 10 }}>•</span>
            <a
              href="/privacy"
              style={{
                color: '#00ff8888',
                textDecoration: 'none',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#00ff88')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#00ff8888')}
            >
              {isTr ? 'GİZLİLİK' : 'PRIVACY'}
            </a>
            <span style={{ color: '#1e3a5f', fontSize: 10 }}>•</span>
            <a
              href="/terms"
              style={{
                color: '#00ff8888',
                textDecoration: 'none',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#00ff88')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#00ff8888')}
            >
              {isTr ? 'KOŞULLAR' : 'TERMS'}
            </a>
            <span style={{ color: '#1e3a5f', fontSize: 10 }}>•</span>
            <a
              href="/kvkk"
              style={{
                color: '#00ff8888',
                textDecoration: 'none',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#00ff88')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#00ff8888')}
            >
              {isTr ? 'KVKK BEYANI' : 'KVKK'}
            </a>
          </footer>
        </section>
      </main>
    </>
  );
}
