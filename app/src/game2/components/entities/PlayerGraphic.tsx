// components/entities/PlayerGraphic.tsx
// APTAL GRAFİK — sadece entity verisini renkli bir şekle dönüştürür.
// Fizik, pozisyon, animasyon → PhysicsWrapper'ın işi.

import { Entity } from '../../logic/entityTypes';

// Oyuncu renk şeması (docs/theme.md)
const PLAYER_COLORS: Record<number, { primary: string; glow: string }> = {
    0: { primary: '#00ff88', glow: 'rgba(0,255,136,0.65)' }, // Emerald — P1
    1: { primary: '#00c4ff', glow: 'rgba(0,196,255,0.65)' }, // Sky     — P2
};

export const PlayerGraphic = ({ entity }: { entity: Entity }) => {
    const playerIndex = (entity.customData.playerIndex as number) ?? 0;
    const mode = (entity.customData.mode as 'normal' | 'reversed') ?? 'normal';
    const isReversed = mode === 'reversed';
    
    // Eğer ters yöndeyse kırmızı/gül rengi elektrik aurası verelim
    const { primary, glow } = isReversed
        ? { primary: '#f43f5e', glow: 'rgba(244,63,94,0.85)' }
        : PLAYER_COLORS[playerIndex] ?? PLAYER_COLORS[0];

    return (
        <div style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        }}>
            <style>{`
                @keyframes playerGlowPulse {
                    0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px ${glow}); }
                    50% { transform: scale(1.05); filter: drop-shadow(0 0 16px ${glow}); }
                }
                @keyframes spinCounterClockwise {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(-360deg); }
                }
                .player-svg {
                    animation: playerGlowPulse ${isReversed ? '1.3s' : '2.5s'} infinite ease-in-out;
                    transition: transform 150ms cubic-bezier(0.25, 1, 0.5, 1);
                }
                .player-outer-ring-reversed {
                    animation: spinCounterClockwise 3.5s infinite linear;
                    transform-origin: 12px 12px;
                }
            `}</style>
            <svg
                width={42}
                height={42}
                viewBox="0 0 24 24"
                fill="none"
                className="player-svg"
            >
                {/* Dış parıltı çemberi (Reversed modda sürekli döner) */}
                <circle 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke={primary} 
                    strokeWidth="1.2" 
                    strokeDasharray="3 3" 
                    opacity={isReversed ? 0.95 : 0.6}
                    className={isReversed ? 'player-outer-ring-reversed' : undefined}
                />
                
                {/* Ana gövde halkası */}
                <circle cx="12" cy="12" r="8" fill={primary} fillOpacity={isReversed ? "0.22" : "0.15"} stroke={primary} strokeWidth="2" />
                
                {/* Merkez göstergesi */}
                {isReversed ? (
                    /* Geri Sarma (Rewind / ◀◀) sembolü */
                    <path
                        d="M10 8l-4 4 4 4V8zm5 0l-4 4 4 4V8z"
                        fill="#ffffff"
                        style={{ filter: 'drop-shadow(0 0 3px #ffffff)' }}
                    />
                ) : (
                    /* Normal mod: Simetrik fütüristik nişangah / artı işareti */
                    <path
                        d="M12 9v6M9 12h6"
                        stroke={primary}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />
                )}
            </svg>
        </div>
    );
};
