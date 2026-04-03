// Shared small UI primitives used across editor panels and dialogs.

export const iStyle: React.CSSProperties = {
  background: '#060d1a',
  border: '1px solid rgba(30,58,95,0.6)',
  color: '#94a3b8',
  borderRadius: 6,
  padding: '5px 8px',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
};

export function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#1e3a5f', borderBottom: '1px solid rgba(30,58,95,0.4)', paddingBottom: 5, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#334155', display: 'block', marginBottom: 5 }}>
      {children}
    </span>
  );
}

export function NBtn({ children, onClick, active, color = '#94a3b8', style, disabled }: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  color?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '5px 9px', fontSize: 11, fontWeight: 600, letterSpacing: '0.03em',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
        background: active ? `${color}1a` : 'rgba(255,255,255,0.02)',
        color: active ? color : '#475569',
        borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: active ? `0 0 8px ${color}28` : 'none',
        transition: 'all 0.12s', opacity: disabled ? 0.45 : 1, ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(2,5,14,0.82)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'rgba(6,13,26,0.98)', border: '1px solid rgba(30,58,95,0.6)', borderRadius: 14, padding: '24px 28px', boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
