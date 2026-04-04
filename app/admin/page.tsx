'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// Admin paneline özel, biraz daha "sistem" hissiyatı veren renkler
const NEON_TYPES = [
  { color: '#00c4ff', glow: '0 0 6px #00c4ff, 0 0 18px rgba(0,196,255,0.3)' }, // Cyan
  { color: '#ffd700', glow: '0 0 6px #ffd700, 0 0 18px rgba(255,215,0,0.3)' }, // Gold
  { color: '#ec4899', glow: '0 0 6px #ec4899, 0 0 18px rgba(236,72,153,0.3)' }, // Pink
  { color: '#9333ea', glow: '0 0 6px #9333ea, 0 0 18px rgba(147,51,234,0.3)' }, // Purple
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

// Admin Dashboard için özel buton yapısı (Kare formunda)
function AdminCard({ 
  label, 
  sub, 
  icon, 
  color, 
  onClick 
}: { 
  label: string; 
  sub: string; 
  icon: string; 
  color: string; 
  onClick: () => void 
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%',
        aspectRatio: '1 / 1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: `${color}0d`,
        border: `1px solid ${color}50`,
        color,
        borderRadius: 16,
        cursor: 'pointer',
        boxShadow: `0 0 18px ${color}18`,
        transition: 'all 0.2s ease-in-out',
        padding: 16,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        el.style.background = `${color}18`;
        el.style.boxShadow = `0 0 30px ${color}30`;
        el.style.transform = 'translateY(-4px)'; // Üzerine gelince hafif yukarı kalkma
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        el.style.background = `${color}0d`;
        el.style.boxShadow = `0 0 18px ${color}18`;
        el.style.transform = 'translateY(0)';
      }}
    >
      <span style={{ fontSize: 36, opacity: 0.9, textShadow: `0 0 10px ${color}50` }}>
        {icon}
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 400, letterSpacing: '0.05em', opacity: 0.6, textAlign: 'center' }}>
          {sub}
        </span>
      </div>
    </button>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const list: Particle[] = Array.from({ length: 25 }, (_, i) => {
      const type = NEON_TYPES[i % NEON_TYPES.length];
      return {
        id: i,
        color: type.color,
        glow: type.glow,
        size: 6 + Math.random() * 14,
        startX: Math.random() * vw,
        startY: Math.random() * vh,
        driftX: (Math.random() - 0.5) * 60,
        duration: 15 + Math.random() * 15,
        delay: -(Math.random() * 20),
        opacity: 0.1 + Math.random() * 0.15,
        borderRadius: Math.random() > 0.5 ? 50 : 2,
      };
    });
    setParticles(list);
  }, []);

  const adminModules = [
    {
      path: '/admin/level-parts',
      label: 'Level Parts',
      sub: 'Manage level groups & structure',
      icon: '⊞', // Grid/Structure unicode
      color: '#00c4ff' // Cyan
    },
    {
      path: '/admin/pending-request-levels',
      label: 'Requests',
      sub: 'Review user submitted levels',
      icon: '⧖', // Hourglass/Pending unicode
      color: '#ffd700' // Gold
    },
    {
      path: '/admin/reports',
      label: 'Reports',
      sub: 'Check level complaints & issues',
      icon: '⚠', // Warning/Report unicode
      color: '#ec4899' // Pink
    },
    {
      path: '/admin/users',
      label: 'Users',
      sub: 'Manage accounts & bans',
      icon: '◈', // Core/User entity unicode
      color: '#9333ea' // Purple
    }
  ];

  return (
    <>
      {/* Background Particles */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: p.size, height: p.size,
              borderRadius: p.borderRadius,
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
          padding: '48px 24px',
          boxSizing: 'border-box',
          gap: 48,
        }}
      >
        {/* Header Section */}
        <div style={{ width: '100%', maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button
            onClick={() => router.push('/')}
            style={{
              alignSelf: 'flex-start',
              background: 'transparent',
              border: '1px solid #00ff8840',
              color: '#00ff88',
              padding: '8px 16px',
              borderRadius: 8,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.1em',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#00ff8815';
              e.currentTarget.style.boxShadow = '0 0 12px #00ff8830';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span>◄</span>
            <span>BACK TO HOME</span>
          </button>

          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 900,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#fff',
                textShadow: '0 0 20px rgba(255,255,255,0.3)',
                margin: '0 0 8px 0',
              }}
            >
              System <span style={{ color: '#00ff88', textShadow: '0 0 20px rgba(0,255,136,0.5)' }}>Admin</span>
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#4b5563', fontSize: 12, letterSpacing: '0.15em' }}>
              <span style={{ color: '#00ff88' }}>●</span>
              <span>CONNECTION SECURE</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div 
          style={{ 
            width: '100%', 
            maxWidth: 500, 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 20 
          }}
        >
          {adminModules.map((mod) => (
            <AdminCard
              key={mod.path}
              label={mod.label}
              sub={mod.sub}
              icon={mod.icon}
              color={mod.color}
              onClick={() => router.push(mod.path)}
            />
          ))}
        </div>
      </main>
    </>
  );
}