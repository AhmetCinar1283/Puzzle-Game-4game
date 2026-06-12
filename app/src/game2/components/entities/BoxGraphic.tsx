// components/entities/BoxGraphic.tsx
// APTAL GRAFİK — kutu görünümü. Fizik → PhysicsWrapper'da.

import { Entity } from '../../logic/entityTypes';
import { getPlayerColor } from '../playerColors';

export const BoxGraphic = ({ entity }: { entity: Entity }) => {
    // requiresPower: customData'da varsa ve isPowered değilse soluk göster
    const requiresPower = (entity.customData.requiresPower as boolean) ?? false;
    const isPowered = entity.isElectrified;
    const dimmed = requiresPower && !isPowered;

    const durabilityEnabled = (entity.customData.durabilityEnabled as boolean) ?? false;
    const durability = (entity.customData.durability as number) ?? 3;

    const colorFilterEnabled = (entity.customData.colorFilterEnabled as boolean) ?? false;
    const colorFilterIndex = (entity.customData.colorFilterIndex as number) ?? 0;

    // Renkleri dinamik olarak belirle
    let hex = '#f97316';
    let rgb = '249,115,22';
    if (colorFilterEnabled) {
        const colorSchema = getPlayerColor(colorFilterIndex);
        hex = colorSchema.hex;
        rgb = colorSchema.rgb;
    }

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
                    position: 'relative',
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

                {/* Top-Left Color Filter Dot Badge */}
                {colorFilterEnabled && (
                    <div style={{
                        position: 'absolute',
                        top: -5,
                        left: -5,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: '#030712',
                        border: `2.5px solid ${hex}`,
                        boxShadow: `0 0 8px ${hex}`,
                        zIndex: 2,
                    }} />
                )}

                {/* Top-Right Power Required Indicator */}
                {requiresPower && (
                    <div style={{
                        position: 'absolute',
                        top: -7,
                        right: -7,
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: '#030712',
                        border: `1.5px solid ${isPowered ? '#fbbf24' : '#475569'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8,
                        color: isPowered ? '#fbbf24' : '#475569',
                        boxShadow: isPowered ? '0 0 8px #fbbf24' : 'none',
                        zIndex: 2,
                        fontWeight: 'bold',
                    }}>
                        ⚡
                    </div>
                )}

                {/* Bottom-Right Durability Indicator */}
                {durabilityEnabled && (
                    <div style={{
                        position: 'absolute',
                        bottom: -7,
                        right: -7,
                        width: 15,
                        height: 15,
                        borderRadius: '50%',
                        background: '#030712',
                        border: `1.5px solid ${hex}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 9,
                        fontWeight: 'bold',
                        color: hex,
                        boxShadow: `0 0 8px ${hex}`,
                        zIndex: 2,
                        fontFamily: 'monospace',
                    }}>
                        {durability}
                    </div>
                )}
            </div>
        </div>
    );
};