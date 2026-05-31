'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const NEON_GLOWS = [
  { color: '#ec4899', glow: '0 0 10px #ec4899, 0 0 30px rgba(236, 72, 153, 0.4)' }, // Pink
  { color: '#9333ea', glow: '0 0 10px #9333ea, 0 0 30px rgba(147, 51, 234, 0.4)' }, // Purple
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
};

export default function AccessDeniedPage() {
  const router = useRouter();
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const list: Particle[] = Array.from({ length: 15 }, (_, i) => {
      const type = NEON_GLOWS[i % NEON_GLOWS.length];
      return {
        id: i,
        color: type.color,
        glow: type.glow,
        size: 8 + Math.random() * 12,
        startX: Math.random() * vw,
        startY: Math.random() * vh,
        driftX: (Math.random() - 0.5) * 80,
        duration: 10 + Math.random() * 10,
        delay: -(Math.random() * 10),
        opacity: 0.15 + Math.random() * 0.15,
      };
    });
    setParticles(list);
  }, []);

  return (
    <>
      {/* Background Particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0, background: '#02040a' }}>
        {/* Anti-gravity well glow center */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, rgba(147,51,234,0.05) 50%, rgba(0,0,0,0) 100%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />

        {particles.map((p) => (
          <motion.div
            key={p.id}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              boxShadow: p.glow,
            }}
            animate={{
              x: [p.startX, p.startX + p.driftX],
              y: [p.startY, -50],
              opacity: [0, p.opacity, p.opacity, 0],
            }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'linear' }}
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
          padding: '24px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            maxWidth: '440px',
            width: '100%',
            textAlign: 'center',
            background: 'rgba(3, 7, 18, 0.6)',
            border: '1px solid rgba(236, 72, 153, 0.25)',
            borderRadius: '24px',
            padding: '48px 32px',
            boxShadow: '0 0 40px rgba(236, 72, 153, 0.08), inset 0 0 20px rgba(236, 72, 153, 0.03)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Neon Error Symbol */}
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              border: '2px solid #ec4899',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '36px',
              color: '#ec4899',
              textShadow: '0 0 10px rgba(236, 72, 153, 0.6)',
              boxShadow: '0 0 20px rgba(236, 72, 153, 0.2), inset 0 0 15px rgba(236, 72, 153, 0.1)',
            }}
          >
            ⚠
          </div>

          <div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: 900,
                letterSpacing: '0.12em',
                color: '#fff',
                margin: '0 0 12px 0',
                textTransform: 'uppercase',
              }}
            >
              Access <span style={{ color: '#ec4899', textShadow: '0 0 12px rgba(236, 72, 153, 0.5)' }}>Denied</span>
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: '#94a3b8',
                lineHeight: '1.6',
                margin: 0,
                letterSpacing: '0.02em',
              }}
            >
              You do not have the authorization required to access this system segment. Admins and Moderators only.
            </p>
          </div>

          <div style={{ width: '100%', height: '1px', background: 'linear-gradient(to right, transparent, rgba(236, 72, 153, 0.25), transparent)' }} />

          <button
            onClick={() => router.push('/')}
            style={{
              width: '100%',
              background: 'transparent',
              border: '1px solid rgba(236, 72, 153, 0.5)',
              color: '#ec4899',
              padding: '12px 24px',
              borderRadius: '12px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.1em',
              transition: 'all 0.2s ease-in-out',
              boxShadow: '0 0 15px rgba(236, 72, 153, 0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)';
              e.currentTarget.style.boxShadow = '0 0 25px rgba(236, 72, 153, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = '0 0 15px rgba(236, 72, 153, 0.1)';
            }}
          >
            RETURN TO SECTOR 0
          </button>
        </div>
      </main>
    </>
  );
}
