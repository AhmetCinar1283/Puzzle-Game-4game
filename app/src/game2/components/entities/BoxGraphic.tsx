// components/entities/BoxGraphic.tsx
// APTAL GRAFİK — kutu görünümü. Fizik → PhysicsWrapper'da.

import { Entity } from '../../logic/entityTypes';

export const BoxGraphic = ({ entity }: { entity: Entity }) => {
    // requiresPower: customData'da varsa ve isPowered değilse soluk göster
    const requiresPower = (entity.customData.requiresPower as boolean) ?? false;
    const isPowered = entity.isElectrified;
    const dimmed = requiresPower && !isPowered;

    return (
        <div style={{
            width: 64, height: 64,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
            <div style={{
                width: 44, height: 44,
                background: dimmed
                    ? 'rgba(249,115,22,0.08)'
                    : 'rgba(249,115,22,0.15)',
                border: `2px solid ${dimmed ? 'rgba(249,115,22,0.3)' : '#f97316'}`,
                boxShadow: dimmed
                    ? 'none'
                    : '0 0 10px rgba(249,115,22,0.4), inset 0 0 8px rgba(249,115,22,0.1)',
                boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'border-color 200ms, box-shadow 200ms',
            }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none"
                    stroke={dimmed ? 'rgba(249,115,22,0.4)' : '#f97316'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ filter: dimmed ? 'none' : 'drop-shadow(0 0 4px rgba(249,115,22,0.8))' }}
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 3v18" />
                </svg>
            </div>
        </div>
    );
};
