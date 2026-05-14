'use client';

export function ErrorScreen({ onBack }: { onBack: () => void }) {
    return (
        <main style={{
            minHeight: '100dvh',
            background: '#030712',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
        }}>
            <span style={{ color: '#ef4444', fontSize: 14 }}>
                Bölüm bulunamadı.
            </span>
            <button
                onClick={onBack}
                style={{
                    padding: '8px 20px',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 12,
                    letterSpacing: '0.06em',
                }}
            >
                ← Bölümler
            </button>
        </main>
    );
}
