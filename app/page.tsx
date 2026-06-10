'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
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

function CanvasParticles({ isMobile }: { isMobile: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = window.innerWidth;
    let height = window.innerHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const handleResize = () => {
      if (!canvas) return;
      const currentDpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * currentDpr;
      canvas.height = height * currentDpr;
      const currentCtx = canvas.getContext('2d');
      if (currentCtx) {
        currentCtx.scale(currentDpr, currentDpr);
      }
    };
    window.addEventListener('resize', handleResize);

    const particleCount = isMobile ? 12 : 28;
    const colors = [
      '#00ff88',
      '#00c4ff',
      '#ffd700',
      '#fbbf24',
      '#9333ea',
      '#a5f3fc',
      '#ec4899',
      '#f97316',
    ];

    class Particle {
      x: number;
      y: number;
      size: number;
      speedY: number;
      driftX: number;
      driftSpeed: number;
      color: string;
      maxOpacity: number;
      opacity: number;
      angle: number;

      constructor(isInitial = false) {
        this.x = Math.random() * width;
        this.y = isInitial ? Math.random() * height : height + 30;
        this.size = 8 + Math.random() * 18;
        this.speedY = 0.4 + Math.random() * 0.8;
        this.driftX = (Math.random() - 0.5) * 1.2;
        this.driftSpeed = 0.005 + Math.random() * 0.015;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.maxOpacity = 0.10 + Math.random() * 0.18;
        this.opacity = 0;
        this.angle = Math.random() * Math.PI * 2;
      }

      update() {
        this.y -= this.speedY;
        this.angle += this.driftSpeed;
        this.x += Math.sin(this.angle) * 0.4 + this.driftX;

        const fadeZone = 120;
        if (this.y > height - fadeZone) {
          const pct = (height - this.y) / fadeZone;
          this.opacity = pct * this.maxOpacity;
        } else if (this.y < fadeZone) {
          const pct = this.y / fadeZone;
          this.opacity = pct * this.maxOpacity;
        } else {
          this.opacity = this.maxOpacity;
        }

        if (this.y < -30 || this.x < -30 || this.x > width + 30) {
          this.x = Math.random() * width;
          this.y = height + 30;
          this.size = 8 + Math.random() * 18;
          this.speedY = 0.4 + Math.random() * 0.8;
          this.driftX = (Math.random() - 0.5) * 1.2;
          this.color = colors[Math.floor(Math.random() * colors.length)];
          this.maxOpacity = 0.10 + Math.random() * 0.18;
          this.opacity = 0;
        }
      }

      draw(context: CanvasRenderingContext2D) {
        context.save();
        context.fillStyle = this.color;
        
        // Glow (outer circle) - hardware accelerated double drawing
        context.beginPath();
        context.arc(this.x, this.y, this.size * (isMobile ? 1.3 : 1.8), 0, Math.PI * 2);
        context.globalAlpha = Math.max(0, Math.min(1, this.opacity * 0.28));
        context.fill();

        // Core (inner circle)
        context.beginPath();
        context.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        context.globalAlpha = Math.max(0, Math.min(1, this.opacity));
        context.fill();

        context.restore();
      }
    }

    const particlesList: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particlesList.push(new Particle(true));
    }

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particlesList.length; i++) {
        const p = particlesList[i];
        p.update();
        p.draw(ctx);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isMobile]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

function MenuCard({
  id, label, sub, color, onClick, isSelected, onMouseEnter, isHero, isGamepadConnected, isMobile
}: {
  id: string; label: string; sub: string; color: string; onClick: () => void; isSelected?: boolean; onMouseEnter?: () => void; isHero?: boolean; isGamepadConnected?: boolean; isMobile?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const active = isSelected || hovered;

  const getIcon = () => {
    switch (id) {
      case 'play': return '🎮';
      case 'levels': return '🏆';
      case 'editor': return '🛠️';
      case 'friends': return '👥';
      case 'controls': return '🕹️';
      case 'admin': return '⚡';
      default: return '✦';
    }
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => {
        setHovered(true);
        onMouseEnter?.();
      }}
      onMouseLeave={() => setHovered(false)}
      style={{
        gridColumn: isHero ? '1 / -1' : undefined,
        width: '100%',
        minHeight: isHero ? 90 : 80,
        padding: '14px 18px',
        background: active
          ? `linear-gradient(135deg, ${color}24 0%, rgba(13, 20, 37, 0.97) 100%)`
          : isMobile
            ? 'rgba(13, 20, 37, 0.82)'
            : 'rgba(13, 20, 37, 0.45)',
        backdropFilter: isMobile ? 'blur(6px)' : 'blur(16px)',
        WebkitBackdropFilter: isMobile ? 'blur(6px)' : 'blur(16px)',
        border: `1.5px solid ${active ? color : `${color}25`}`,
        color: active ? '#fff' : '#94a3b8',
        borderRadius: 14,
        cursor: 'pointer',
        boxShadow: active
          ? `0 0 24px ${color}25, inset 0 0 8px ${color}15`
          : '0 8px 32px rgba(0, 0, 0, 0.4)',
        transition: 'background 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        textAlign: 'left',
        outline: 'none',
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: isHero ? 15 : 13,
            fontWeight: 800,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: active ? '#fff' : '#e2e8f0',
            transition: 'color 0.2s',
          }}>
            {label}
          </span>
          {isSelected && isGamepadConnected && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#00ff88',
              color: '#030712',
              fontSize: 9,
              fontWeight: 900,
              borderRadius: '50%',
              width: 14,
              height: 14,
              boxShadow: '0 0 6px #00ff88',
            }}>
              A
            </span>
          )}
        </div>
        <span style={{
          fontSize: isHero ? 10 : 9,
          fontWeight: 500,
          color: active ? `${color}` : '#64748b',
          lineHeight: 1.3,
          letterSpacing: '0.02em',
          transition: 'color 0.2s',
        }}>
          {sub}
        </span>
      </div>

      <div style={{
        width: isHero ? 40 : 34,
        height: isHero ? 40 : 34,
        borderRadius: 10,
        background: active ? `${color}20` : 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${active ? `${color}40` : 'rgba(255, 255, 255, 0.05)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: isHero ? 18 : 15,
        color: active ? color : '#475569',
        boxShadow: active ? `0 0 12px ${color}25` : 'none',
        transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
        flexShrink: 0,
      }}>
        {getIcon()}
      </div>
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
  const user = useSelector(selectUser);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile screen size on mount and window resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
      { id: 'friends', label: `👥 ${t('friends.title')}`, sub: t('home.friends_sub'), color: '#ec4899', onClick: () => router.push('/friends') },
      { id: 'controls', label: t('home.controls'), sub: t('home.controls_sub'), color: '#fbbf24', onClick: () => router.push('/controls') },
    ];
    if (user?.role === 'admin') {
      opts.push({ id: 'admin', label: t('home.admin'), sub: t('home.admin_sub'), color: '#00ff88', onClick: () => router.push('/admin') });
    }
    return opts;
  }, [t, user?.role, router, handlePlayClick]);

  const handleMoveMenu = useCallback((dir: 'up' | 'down' | 'left' | 'right') => {
    setActiveMenuIndex((prev) => {
      const hasAdmin = options.length > 5;
      switch (dir) {
        case 'up':
          if (prev === 0) return hasAdmin ? 5 : 4;
          if (prev === 1 || prev === 2) return 0;
          if (prev === 3) return 1;
          if (prev === 4) return 2;
          if (prev === 5) return 3;
          return prev;
        case 'down':
          if (prev === 0) return 1;
          if (prev === 1) return 3;
          if (prev === 2) return 4;
          if (prev === 3 || prev === 4) return hasAdmin ? 5 : 0;
          if (prev === 5) return 0;
          return prev;
        case 'left':
          if (prev === 2) return 1;
          if (prev === 4) return 3;
          return prev;
        case 'right':
          if (prev === 1) return 2;
          if (prev === 3) return 4;
          return prev;
      }
      return prev;
    });
  }, [options.length]);

  const { isConnected } = useGamepad({
    onMove: (dir) => handleMoveMenu(dir),
    onConfirm: () => {
      options[activeMenuIndex]?.onClick();
    },
  });

  // Keyboard navigation for menu cards
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleMoveMenu('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleMoveMenu('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleMoveMenu('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleMoveMenu('right');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        options[activeMenuIndex]?.onClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMoveMenu, activeMenuIndex, options]);

  return (
    <>
      {/* Floating background particles */}
      <CanvasParticles isMobile={isMobile} />

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

        {/* Nav cards grid */}
        <div style={{
          width: '100%',
          maxWidth: 480,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          padding: '0 8px',
          boxSizing: 'border-box',
        }}>
          {options.map((opt, idx) => (
            <MenuCard
              key={opt.id}
              id={opt.id}
              label={opt.label}
              sub={opt.sub}
              color={opt.color}
              onClick={opt.onClick}
              isSelected={activeMenuIndex === idx}
              onMouseEnter={() => setActiveMenuIndex(idx)}
              isHero={opt.id === 'play' || opt.id === 'admin'}
              isGamepadConnected={isConnected}
              isMobile={isMobile}
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
        {isConnected && (
          <div style={{
            position: 'fixed',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(3, 7, 18, 0.85)',
            backdropFilter: isMobile ? 'blur(6px)' : 'blur(12px)',
            WebkitBackdropFilter: isMobile ? 'blur(6px)' : 'blur(12px)',
            border: '1px solid rgba(0, 255, 136, 0.2)',
            borderRadius: 20,
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            color: '#00ff88',
            boxShadow: '0 4px 20px rgba(0, 255, 136, 0.15)',
            zIndex: 100,
            pointerEvents: 'none',
          }}>
            <span>🎮</span>
            <span>
              {isTr ? 'D-pad / Sol Analog: Yönlendir | (A): Seç' : 'D-pad / Left Stick: Navigate | (A): Select'}
            </span>
          </div>
        )}
      </main>
    </>
  );
}
