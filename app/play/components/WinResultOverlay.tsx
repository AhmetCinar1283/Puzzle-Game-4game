'use client';

// Kazanma sonrası puan/yıldız overlay'i — worker'dan gelen sonucu gösterir.
// Eski sistemdeki WinOverlay'in game2 karşılığı.

interface WorkerResult {
    success:          boolean;
    stars?:           1 | 2 | 3;
    scoreDelta?:      number;
    isFirstCompletion?: boolean;
    isNewBestSolution?: boolean;
    isBestSolution?:    boolean;
    isGoodSolution?:    boolean;
}

interface WinResultOverlayProps {
    result:      WorkerResult | null;  // null = yükleniyor
    onNextLevel: (() => void) | undefined;
    onMenu:      () => void;
}

const STAR_COLOR = '#fbbf24';

export function WinResultOverlay({ result, onNextLevel, onMenu }: WinResultOverlayProps) {
    const stars = result?.stars ?? 0;

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(3,7,18,0.88)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 20,
            zIndex: 200,
        }}>
            {/* Yıldızlar */}
            <div style={{ display: 'flex', gap: 10 }}>
                {[1, 2, 3].map(i => (
                    <span key={i} style={{
                        fontSize: 40,
                        color: i <= stars ? STAR_COLOR : '#1e2a3a',
                        textShadow: i <= stars ? `0 0 16px ${STAR_COLOR}` : 'none',
                        transition: 'color 400ms ease, text-shadow 400ms ease',
                    }}>★</span>
                ))}
            </div>

            {/* Puan */}
            {result && result.scoreDelta !== undefined && result.scoreDelta > 0 && (
                <span style={{
                    color: '#00ff88', fontSize: 20, fontWeight: 'bold',
                    textShadow: '0 0 12px rgba(0,255,136,0.6)',
                }}>
                    +{result.scoreDelta} PTS
                </span>
            )}

            {/* Rozetler */}
            {result && (
                <div style={{ display: 'flex', gap: 10 }}>
                    {result.isNewBestSolution && <Badge label="Yeni Rekor" color="#00ff88" />}
                    {result.isBestSolution     && <Badge label="Rekor"     color="#00c4ff" />}
                    {result.isGoodSolution     && <Badge label="İyi"       color="#9333ea" />}
                </div>
            )}

            {/* Yükleniyor göstergesi */}
            {!result && (
                <span style={{ color: '#1e3a5f', fontSize: 12, letterSpacing: '0.1em' }}>
                    HESAPLANIYOR...
                </span>
            )}

            {/* Aksiyon butonları */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                {onNextLevel && (
                    <button onClick={onNextLevel} style={actionBtn('#00ff88')}>
                        Sonraki Bölüm →
                    </button>
                )}
                <button onClick={onMenu} style={actionBtn('#1e3a5f')}>
                    Bölümler
                </button>
            </div>
        </div>
    );
}

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            color,
            border: `1px solid ${color}`,
            padding: '3px 10px',
            fontSize: 12,
            letterSpacing: '0.06em',
            boxShadow: `0 0 8px rgba(0,0,0,0.3)`,
        }}>
            {label}
        </span>
    );
}

function actionBtn(color: string): React.CSSProperties {
    return {
        background:    `rgba(${hexToRgb(color)},0.1)`,
        border:        `2px solid ${color}`,
        color,
        padding:       '10px 24px',
        fontSize:      14,
        fontWeight:    'bold',
        cursor:        'pointer',
        letterSpacing: '0.04em',
        boxShadow:     `0 0 12px rgba(${hexToRgb(color)},0.3)`,
    };
}

function hexToRgb(hex: string): string {
    const map: Record<string, string> = {
        '#00ff88': '0,255,136',
        '#00c4ff': '0,196,255',
        '#9333ea': '147,51,234',
        '#1e3a5f': '30,58,95',
        '#fbbf24': '251,191,36',
    };
    return map[hex] ?? '255,255,255';
}
