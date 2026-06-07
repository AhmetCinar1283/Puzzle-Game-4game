// components/entities/BoxGraphic.tsx
// APTAL GRAFİK — kutu görünümü. Fizik → PhysicsWrapper'da.

import { Entity } from '../../logic/entityTypes';

export const BoxGraphic = ({ entity }: { entity: Entity }) => {
    // requiresPower: customData'da varsa ve isPowered değilse soluk göster
    const requiresPower = (entity.customData.requiresPower as boolean) ?? false;
    const isPowered = entity.isElectrified;
    const dimmed = requiresPower && !isPowered;

    // Renkleri daha kolay yönetmek için sabitler
    const hex = '#f97316';
    const rgb = '249,115,22';

    return (
        <div style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        }}>
            {/* Dış Kalıp - Görseldeki gibi yuvarlatılmış köşeler ve parlama */}
            <div 
                className={isPowered && !dimmed ? 'box-container-active' : undefined}
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    border: `2px solid ${dimmed ? `rgba(${rgb},0.3)` : isPowered ? '#fbbf24' : hex}`,
                    boxShadow: dimmed
                        ? 'none'
                        : isPowered 
                            ? 'none' // will be animated by class
                            : `0 0 12px rgba(${rgb},0.5), inset 0 0 6px rgba(${rgb},0.15)`,
                    background: dimmed ? 'transparent' : `rgba(${rgb},0.02)`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 200ms ease-in-out',
                }}
            >
                {/* Merkez İkon - Görseldeki iç içe geçmiş kareler */}
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
                    style={{ filter: dimmed ? 'none' : `drop-shadow(0 0 4px ${isPowered ? '#fbbf24' : hex})` }}
                >
                    {/* Dış ince kare */}
                    <rect x="2" y="2" width="20" height="20" rx="3" 
                        stroke={dimmed ? `rgba(${rgb},0.4)` : isPowered ? '#fbbf24' : hex} 
                        strokeWidth="2.5" 
                    />
                    {/* İç dolu kare */}
                    <rect x="8" y="8" width="8" height="8" rx="1.5" 
                        fill={dimmed ? `rgba(${rgb},0.4)` : isPowered ? '#fbbf24' : hex} 
                    />
                </svg>
            </div>
        </div>
    );
};