'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useT } from '@/app/src/contexts/LanguageContext';
import { useGamepad } from '@/app/src/hooks/useGamepad';

const NEON_TYPES = [
  { color: '#00ff88', glow: '0 0 6px #00ff88, 0 0 18px rgba(0,255,136,0.3)' },
  { color: '#00c4ff', glow: '0 0 6px #00c4ff, 0 0 18px rgba(0,196,255,0.3)' },
  { color: '#ffd700', glow: '0 0 6px #ffd700, 0 0 18px rgba(255,215,0,0.3)' },
  { color: '#fbbf24', glow: '0 0 6px #fbbf24, 0 0 18px rgba(251,191,36,0.3)' },
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

// Map of standard Gamepad buttons for visualization
const BUTTONS_MAP = [
  { index: 0, label: 'A / ✕', role: 'confirm' },
  { index: 1, label: 'B / ◯', role: 'menu' },
  { index: 2, label: 'X / ▢', role: 'restart' },
  { index: 3, label: 'Y / △', role: 'restart' },
  { index: 4, label: 'LB / L1', role: 'none' },
  { index: 5, label: 'RB / R1', role: 'none' },
  { index: 6, label: 'LT / L2', role: 'none' },
  { index: 7, label: 'RT / R2', role: 'none' },
  { index: 8, label: 'SELECT', role: 'restart' },
  { index: 9, label: 'START', role: 'menu' },
  { index: 12, label: 'D-Pad ▲', role: 'move' },
  { index: 13, label: 'D-Pad ▼', role: 'move' },
  { index: 14, label: 'D-Pad ◀', role: 'move' },
  { index: 15, label: 'D-Pad ▶', role: 'move' },
];

export default function ControlsPage() {
  const t = useT();
  const router = useRouter();
  const [particles, setParticles] = useState<Particle[]>([]);
  const [activeButtons, setActiveButtons] = useState<Record<number, boolean>>({});
  const [axes, setAxes] = useState<number[]>([0, 0, 0, 0]);

  // Use hook to detect gamepad and listen to inputs
  const { gamepad, isConnected } = useGamepad({
    onButtonPress: (index, pressed) => {
      setActiveButtons(prev => ({ ...prev, [index]: pressed }));
    },
    onAxisMove: (index, val) => {
      setAxes(prev => {
        const next = [...prev];
        next[index] = val;
        return next;
      });
      // Scroll page vertically using Right Stick Y (axis 3)
      if (index === 3 && Math.abs(val) > 0.15) {
        window.scrollBy({ top: val * 22, behavior: 'auto' });
      }
    },
    onMenu: () => router.push('/'),
    onMove: (dir) => {
      if (dir === 'up') {
        window.scrollBy({ top: -180, behavior: 'smooth' });
      } else if (dir === 'down') {
        window.scrollBy({ top: 180, behavior: 'smooth' });
      }
    }
  });

  // Keyboard navigation: Esc or Enter → back to home, ArrowUp/ArrowDown/PageUp/PageDown → scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.push('/');
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        window.scrollBy({ top: -180, behavior: 'smooth' });
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        window.scrollBy({ top: 180, behavior: 'smooth' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  // Generate background neon particles
  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const list: Particle[] = Array.from({ length: 15 }, (_, i) => {
      const type = NEON_TYPES[i % NEON_TYPES.length];
      return {
        id: i,
        color: type.color,
        glow: type.glow,
        size: 8 + Math.random() * 12,
        startX: Math.random() * vw,
        startY: Math.random() * vh,
        driftX: (Math.random() - 0.5) * 60,
        duration: 15 + Math.random() * 15,
        delay: -(Math.random() * 20),
        opacity: 0.08 + Math.random() * 0.15,
        borderRadius: Math.random() > 0.5 ? 50 : 4,
      };
    });
    setParticles(list);
  }, []);

  return (
    <>
      {/* Head details for SEO */}
      <title>{`${t('controls.title')} | Syncron`}</title>
      <meta name="description" content="Learn how to play Syncron using Gamepad or Keyboard. View the interactive control scheme." />

      {/* Background Particles */}
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
              y: [p.startY, -40],
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
          background: '#030712',
          padding: '40px 16px',
          boxSizing: 'border-box',
          color: '#ffffff',
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          overflowY: 'auto',
        }}
      >
        {/* Top Header */}
        <div style={{ width: '100%', maxWidth: 840, display: 'flex', justifyContent: 'flex-start', marginBottom: 24 }}>
          <button
            onClick={() => router.push('/')}
            id="back-btn"
            style={{
              background: 'rgba(0, 255, 136, 0.05)',
              border: '1px solid rgba(0, 255, 136, 0.25)',
              color: '#00ff88',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              boxShadow: '0 0 10px rgba(0,255,136,0.06)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 136, 0.12)';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(0,255,136,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 136, 0.05)';
              e.currentTarget.style.boxShadow = '0 0 10px rgba(0,255,136,0.06)';
            }}
          >
            {t('controls.back')}
            {isConnected && (
              <span style={{
                background: '#ef4444',
                color: '#fff',
                fontSize: 9,
                fontWeight: 800,
                borderRadius: '50%',
                width: 14,
                height: 14,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 6,
                boxShadow: '0 0 5px #ef4444'
              }}>
                B
              </span>
            )}
          </button>
        </div>

        {/* Page Titles */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#00ff88',
              textShadow: '0 0 15px rgba(0,255,136,0.4)',
              margin: '0 0 8px 0',
            }}
          >
            {t('controls.title')}
          </h1>
          <p
            style={{
              fontSize: 12,
              color: '#64748b',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: 0,
            }}
          >
            {t('controls.subtitle')}
          </p>
        </div>

        {/* Main Grid: Keyboard & Gamepad Details */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 24,
            width: '100%',
            maxWidth: 840,
            marginBottom: 32,
          }}
        >
          {/* Card 1: Keyboard */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(0, 196, 255, 0.15)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#00c4ff',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                borderBottom: '1px solid rgba(0, 196, 255, 0.15)',
                paddingBottom: 12,
                marginTop: 0,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>⌨</span> {t('controls.keyboard')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>{t('controls.move')}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>WASD</span>
                    <span style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>ARROWS</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{t('controls.move_desc')}</p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>{t('controls.restart')}</span>
                  <span style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>R</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{t('controls.restart_desc')}</p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>{t('controls.menu')}</span>
                  <span style={{ padding: '3px 8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, fontSize: 10, fontFamily: 'monospace' }}>ESC</span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{t('controls.menu_desc')}</p>
              </div>
            </div>
          </div>

          {/* Card 2: Gamepad Mappings */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.45)',
              border: '1px solid rgba(0, 255, 136, 0.15)',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <h2
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: '#00ff88',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                borderBottom: '1px solid rgba(0, 255, 136, 0.15)',
                paddingBottom: 12,
                marginTop: 0,
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>🎮</span> {t('controls.gamepad')}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>{t('controls.move')}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ padding: '3px 8px', background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.25)', borderRadius: 4, fontSize: 10, color: '#00ff88' }}>LEFT STICK</span>
                    <span style={{ padding: '3px 8px', background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.25)', borderRadius: 4, fontSize: 10, color: '#00ff88' }}>D-PAD</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{t('controls.move_desc')}</p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>{t('controls.restart')}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ padding: '3px 8px', background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.25)', borderRadius: 4, fontSize: 10, color: '#00ff88' }}>Y / △</span>
                    <span style={{ padding: '3px 8px', background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.25)', borderRadius: 4, fontSize: 10, color: '#00ff88' }}>SELECT</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{t('controls.restart_desc')}</p>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#f8fafc' }}>{t('controls.menu')}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <span style={{ padding: '3px 8px', background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.25)', borderRadius: 4, fontSize: 10, color: '#00ff88' }}>B / ◯</span>
                    <span style={{ padding: '3px 8px', background: 'rgba(0, 255, 136, 0.08)', border: '1px solid rgba(0, 255, 136, 0.25)', borderRadius: 4, fontSize: 10, color: '#00ff88' }}>START</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>{t('controls.menu_desc')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Live Gamepad Tester Card */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.35)',
            border: '1px solid rgba(251, 191, 36, 0.2)',
            borderRadius: 16,
            padding: 24,
            width: '100%',
            maxWidth: 840,
            boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <h2
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: '#fbbf24',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              margin: '0 0 8px 0',
            }}
          >
            {t('controls.tester_title')}
          </h2>
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 24px 0' }}>
            {t('controls.tester_desc')}
          </p>

          {/* Gamepad Connection status banner */}
          <div
            style={{
              padding: '12px 18px',
              borderRadius: 8,
              background: isConnected ? 'rgba(0, 255, 136, 0.06)' : 'rgba(251, 191, 36, 0.06)',
              border: `1px solid ${isConnected ? 'rgba(0, 255, 136, 0.2)' : 'rgba(251, 191, 36, 0.2)'}`,
              color: isConnected ? '#00ff88' : '#fbbf24',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 24,
              boxShadow: isConnected ? '0 0 10px rgba(0,255,136,0.05)' : 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isConnected ? '#00ff88' : '#fbbf24',
                  boxShadow: isConnected ? '0 0 8px #00ff88' : '0 0 8px #fbbf24',
                }}
              />
              <span>
                {isConnected
                  ? t('controls.gamepad_connected', { name: gamepad?.id || 'Controller' })
                  : t('controls.gamepad_disconnected')}
              </span>
            </div>
            {isConnected && (
              <span style={{ fontSize: 9, opacity: 0.6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                INDEX #{gamepad?.index}
              </span>
            )}
          </div>

          {/* Visual Tester Components */}
          {isConnected && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 2fr',
                gap: 24,
                alignItems: 'start',
              }}
            >
              {/* Left Column: Analog Stick Display */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'rgba(0,0,0,0.15)',
                  padding: 20,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                  Left Stick
                </span>

                {/* Joystick container */}
                <div
                  style={{
                    position: 'relative',
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: '#111827',
                    border: '2px solid rgba(255, 255, 255, 0.15)',
                    boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  {/* Grid Lines inside stick */}
                  <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(255,255,255,0.03)' }} />
                  <div style={{ position: 'absolute', width: 1, height: '100%', background: 'rgba(255,255,255,0.03)' }} />

                  {/* Floating Thumb Stick */}
                  <div
                    style={{
                      position: 'absolute',
                      width: 38,
                      height: 38,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #374151 0%, #1f2937 100%)',
                      border: '2px solid #4b5563',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.4), inset 0 2px 2px rgba(255,255,255,0.1)',
                      transform: `translate(${axes[0] * 30}px, ${axes[1] * 30}px)`,
                      transition: 'transform 0.05s ease-out',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Glowing center indicator */}
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: (Math.abs(axes[0]) > 0.1 || Math.abs(axes[1]) > 0.1) ? '#00ff88' : '#64748b',
                        boxShadow: (Math.abs(axes[0]) > 0.1 || Math.abs(axes[1]) > 0.1) ? '0 0 8px #00ff88' : 'none',
                      }}
                    />
                  </div>
                </div>

                {/* Coordinate Readouts */}
                <div style={{ display: 'flex', gap: 12, fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>
                  <span>X: <span style={{ color: Math.abs(axes[0]) > 0.1 ? '#00ff88' : '#94a3b8' }}>{axes[0].toFixed(2)}</span></span>
                  <span>Y: <span style={{ color: Math.abs(axes[1]) > 0.1 ? '#00ff88' : '#94a3b8' }}>{axes[1].toFixed(2)}</span></span>
                </div>
              </div>

              {/* Right Column: Button indicators */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.15)',
                  padding: 20,
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                  Button States
                </span>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                    gap: 8,
                  }}
                >
                  {BUTTONS_MAP.map((btn) => {
                    const active = !!activeButtons[btn.index];
                    let color = 'rgba(255, 255, 255, 0.03)';
                    let border = '1px solid rgba(255, 255, 255, 0.08)';
                    let textColor = '#64748b';
                    let glow = 'none';

                    if (active) {
                      glow = '0 0 10px rgba(0, 255, 136, 0.4)';
                      color = 'rgba(0, 255, 136, 0.12)';
                      border = '1px solid #00ff88';
                      textColor = '#00ff88';
                    } else if (btn.role === 'move') {
                      border = '1px solid rgba(0, 196, 255, 0.15)';
                      textColor = '#00c4ff80';
                    } else if (btn.role === 'restart') {
                      border = '1px solid rgba(251, 191, 36, 0.15)';
                      textColor = '#fbbf2480';
                    } else if (btn.role === 'menu') {
                      border = '1px solid rgba(249, 115, 22, 0.15)';
                      textColor = '#f9731680';
                    }

                    return (
                      <div
                        key={btn.index}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          background: color,
                          border: border,
                          color: textColor,
                          textAlign: 'center',
                          fontSize: 10,
                          fontWeight: active ? 700 : 500,
                          boxShadow: glow,
                          transition: 'all 0.08s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: 9, opacity: 0.5, fontStyle: 'italic' }}>#{btn.index}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{btn.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
