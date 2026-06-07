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
    
    // Ters yönde de olsak oyuncu kendi asıl rengini korusun (yeşil/mavi vs.)
    const { primary, glow } = PLAYER_COLORS[playerIndex] ?? PLAYER_COLORS[0];

    return (
        <div style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        }}>
            <svg
                width={42}
                height={42}
                viewBox="0 0 24 24"
                fill="none"
                className={playerIndex === 0 
                    ? (isReversed ? 'player-svg-p0-reversed' : 'player-svg-p0') 
                    : (isReversed ? 'player-svg-p1-reversed' : 'player-svg-p1')}
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
                {entity.customData.isLocked ? (
                    /* Locked: Şık bir kilit simgesi */
                    <g style={{ filter: `drop-shadow(0 0 4px ${primary})` }}>
                        {/* Lock Body */}
                        <rect x="8.5" y="11" width="7" height="6" rx="1.2" fill={primary} />
                        {/* Lock Shackle */}
                        <path
                            d="M9.5 11V8.5a2.5 2.5 0 015 0V11"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            fill="none"
                        />
                        {/* Keyhole */}
                        <circle cx="12" cy="14" r="0.8" fill="#ffffff" />
                    </g>
                ) : isReversed ? (
                    /* Reversed mod: Eksi işareti (Normal moddaki artı işaretine zıt) */
                    <path
                        d="M9 12h6"
                        stroke="#ffffff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
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
