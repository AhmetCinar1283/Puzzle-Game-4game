// components/entities/PlayerGraphic.tsx
// APTAL GRAFİK — sadece entity verisini renkli bir şekle dönüştürür.
// Fizik, pozisyon, animasyon → PhysicsWrapper'ın işi.

import { Entity } from '../../logic/entityTypes';
import { Direction } from '../../logic/types';

// Oyuncu renk şeması (docs/theme.md)
const PLAYER_COLORS: Record<number, { primary: string; glow: string }> = {
    0: { primary: '#00ff88', glow: 'rgba(0,255,136,0.6)' }, // Emerald — P1
    1: { primary: '#00c4ff', glow: 'rgba(0,196,255,0.6)' }, // Sky     — P2
};

const DIRECTION_ROTATION: Record<Direction, string> = {
    up: '-90deg', right: '0deg', down: '90deg', left: '180deg',
};

export const PlayerGraphic = ({ entity }: { entity: Entity }) => {
    // customData.playerIndex: 0 = P1 (emerald), 1 = P2 (sky), varsayılan 0
    const playerIndex = (entity.customData.playerIndex as number) ?? 0;
    const { primary, glow } = PLAYER_COLORS[playerIndex] ?? PLAYER_COLORS[0];
    const rotation = DIRECTION_ROTATION[entity.physics.direction];

    return (
        <div style={{
            width: 64, height: 64,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <svg
                width={38} height={38}
                viewBox="0 0 24 24"
                fill="none"
                style={{
                    transform: `rotate(${rotation})`,
                    filter: `drop-shadow(0 0 8px ${glow})`,
                    transition: 'transform 150ms ease',
                }}
            >
                {/* Ok şekli: yön bilgisini görsel olarak yansıtır */}
                <circle cx="12" cy="12" r="10" fill={primary} fillOpacity="0.15" />
                <circle cx="12" cy="12" r="10" stroke={primary} strokeWidth="1.5" />
                {/* İleride yön oku yerine sprite yerleştirilebilir */}
                <path
                    d="M8 12h8M13 8l4 4-4 4"
                    stroke={primary}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        </div>
    );
};
