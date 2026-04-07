'use client';

import type { ReactNode } from 'react';

export function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
        textTransform: 'uppercase', color,
        textShadow: `0 0 12px ${color}70`,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, ${color}30, transparent)` }} />
    </div>
  );
}

// `cols` and `headers` are accepted for API compat but no longer rendered as a header row.
export function LevelTable({
  children,
}: {
  children: ReactNode;
  cols?: string;
  headers?: string[];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {children}
    </div>
  );
}
