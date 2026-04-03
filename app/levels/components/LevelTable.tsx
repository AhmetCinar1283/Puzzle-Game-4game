'use client';

export function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.2em', textTransform: 'uppercase', color, textShadow: `0 0 10px ${color}80` }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: `${color}20` }} />
    </div>
  );
}

export function LevelTable({ children, cols, headers }: { children: React.ReactNode; cols: string; headers: string[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 8, padding: '0 12px 6px', borderBottom: '1px solid rgba(30,58,95,0.4)' }}>
        {headers.map((h) => (
          <span key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1e3a5f' }}>{h}</span>
        ))}
      </div>
      {children}
    </div>
  );
}
