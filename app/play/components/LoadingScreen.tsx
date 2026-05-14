'use client';

export function LoadingScreen() {
    return (
        <main style={{
            minHeight: '100dvh',
            background: '#030712',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}>
            <span style={{ color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em' }}>
                YÜKLENİYOR...
            </span>
        </main>
    );
}
