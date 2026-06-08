// components/effects/animationStyles.ts
// Modüler animasyon keyframe ve CSS tanımları.
// Oyun tahtası ve nesne sarmalayıcıları (PhysicsWrapper) bu tanımları kullanır.

export const GAME_ANIMATION_KEYFRAMES = `
    /* ── DUVAR / ENGEL BOUNCE (BUMP) ── */
    @keyframes bump-up {
        0% { transform: translateY(0); }
        30% { transform: translateY(-14px) scaleY(0.85) scaleX(1.08); }
        70% { transform: translateY(3px) scaleY(1.05) scaleX(0.96); }
        100% { transform: translateY(0) scale(1); }
    }
    @keyframes bump-down {
        0% { transform: translateY(0); }
        30% { transform: translateY(14px) scaleY(0.85) scaleX(1.08); }
        70% { transform: translateY(-3px) scaleY(1.05) scaleX(0.96); }
        100% { transform: translateY(0) scale(1); }
    }
    @keyframes bump-left {
        0% { transform: translateX(0); }
        30% { transform: translateX(-14px) scaleX(0.85) scaleY(1.08); }
        70% { transform: translateX(3px) scaleX(1.05) scaleY(0.96); }
        100% { transform: translateX(0) scale(1); }
    }
    @keyframes bump-right {
        0% { transform: translateX(0); }
        30% { transform: translateX(14px) scaleX(0.85) scaleY(1.08); }
        70% { transform: translateX(-3px) scaleX(1.05) scaleY(0.96); }
        100% { transform: translateX(0) scale(1); }
    }

    /* ── ENGELLENMİŞ İTME (HEAVY BUMP) ── */
    @keyframes blocked-push-up {
        0% { transform: translateY(0); }
        35% { transform: translateY(-7px) scaleY(0.75) scaleX(1.15); }
        75% { transform: translateY(1px) scaleY(1.03) scaleX(0.98); }
        100% { transform: translateY(0) scale(1); }
    }
    @keyframes blocked-push-down {
        0% { transform: translateY(0); }
        35% { transform: translateY(7px) scaleY(0.75) scaleX(1.15); }
        75% { transform: translateY(-1px) scaleY(1.03) scaleX(0.98); }
        100% { transform: translateY(0) scale(1); }
    }
    @keyframes blocked-push-left {
        0% { transform: translateX(0); }
        35% { transform: translateX(-7px) scaleX(0.75) scaleY(1.15); }
        75% { transform: translateX(1px) scaleX(1.03) scaleY(0.98); }
        100% { transform: translateX(0) scale(1); }
    }
    @keyframes blocked-push-right {
        0% { transform: translateX(0); }
        35% { transform: translateX(7px) scaleX(0.75) scaleY(1.15); }
        75% { transform: translateX(-1px) scaleX(1.03) scaleY(0.98); }
        100% { transform: translateX(0) scale(1); }
    }

    /* ── KAFA KAFAYA ÇARPIŞMA (COLLISION SHAKE) ── */
    @keyframes collision-shake {
        0%, 100% { transform: translate(0, 0) scale(1); }
        15% { transform: translate(-8px, -3px) scale(0.93); filter: brightness(1.2); }
        30% { transform: translate(7px, 3px) scale(1.07); filter: brightness(1.2); }
        45% { transform: translate(-6px, 1px) scale(0.96); }
        60% { transform: translate(4px, -1px) scale(1.03); }
        75% { transform: translate(-2px, 0) scale(1); }
    }

    /* ── KONVEYÖR REDDİ (PUSHBACK) ── */
    @keyframes conveyor-reject-up {
        0% { transform: translateY(0); }
        30% { transform: translateY(-10px) scaleY(0.9); }
        75% { transform: translateY(10px) scaleY(1.05); }
        100% { transform: translateY(0) scale(1); }
    }
    @keyframes conveyor-reject-down {
        0% { transform: translateY(0); }
        30% { transform: translateY(10px) scaleY(0.9); }
        75% { transform: translateY(-10px) scaleY(1.05); }
        100% { transform: translateY(0) scale(1); }
    }
    @keyframes conveyor-reject-left {
        0% { transform: translateX(0); }
        30% { transform: translateX(-10px) scaleX(0.9); }
        75% { transform: translateX(10px) scaleX(1.05); }
        100% { transform: translateY(0) scale(1); }
    }
    @keyframes conveyor-reject-right {
        0% { transform: translateX(0); }
        30% { transform: translateX(10px) scaleX(0.9); }
        75% { transform: translateX(-10px) scaleX(1.05); }
        100% { transform: translateY(0) scale(1); }
    }

    /* ── YASAKLI BÖLGE ÖLÜMÜ (VORTEX DISSOLVE) ── */
    @keyframes death-forbidden {
        0% { transform: scale(1) rotate(0deg); opacity: 1; filter: saturate(1) brightness(1); }
        35% { transform: scale(1.25) rotate(90deg); opacity: 0.9; filter: saturate(2) brightness(1.5); }
        100% { transform: scale(0) rotate(540deg); opacity: 0; filter: saturate(3) brightness(0.2); }
    }

    /* ── EZİLME ÖLÜMÜ (FLAT SQUASH) ── */
    @keyframes death-crushed {
        0% { transform: scale(1); opacity: 1; filter: grayscale(0) brightness(1); }
        25% { transform: scale(1.7, 0.18); opacity: 1; filter: grayscale(0.6) brightness(0.6); }
        100% { transform: scale(1.9, 0.02); opacity: 0; filter: grayscale(1) brightness(0.1); }
    }

    /* ── LAV KAZASI (MELT & SINK) ── */
    @keyframes death-lava {
        0% { transform: translateY(0) scale(1); opacity: 1; filter: brightness(1) drop-shadow(0 0 0 red); }
        40% { transform: translateY(16px) scale(0.9, 1.15); opacity: 0.8; filter: brightness(1.6) sepia(1) hue-rotate(-50deg) drop-shadow(0 0 12px #ef4444); }
        100% { transform: translateY(32px) scale(0); opacity: 0; filter: brightness(2) sepia(1) hue-rotate(-50deg); }
    }

    /* ── İZ ÇARPIŞMA ÖLÜMÜ (NEON SHOCK DISSOLVE) ── */
    @keyframes death-trail {
        0% { transform: scale(1); opacity: 1; filter: hue-rotate(0deg) brightness(1) drop-shadow(0 0 2px transparent); }
        15% { transform: scale(1.15); opacity: 1; filter: hue-rotate(180deg) brightness(2.5) drop-shadow(0 0 12px #00ff88); }
        45% { transform: scale(0.75); opacity: 0.75; filter: hue-rotate(90deg) brightness(1.8) drop-shadow(0 0 6px #00c4ff); }
        100% { transform: scale(0); opacity: 0; filter: hue-rotate(0deg) brightness(0.2); }
    }

    /* ── KAZANMA ANIMASYONU (VICTORY SPIN & FLOAT) ── */
    @keyframes victory-spin {
        0% { transform: scale(1) translateY(0) rotate(0deg); filter: brightness(1) drop-shadow(0 0 5px rgba(0,255,136,0.6)); }
        50% { transform: scale(1.2) translateY(-6px) rotate(180deg); filter: brightness(1.5) drop-shadow(0 0 20px rgba(0,255,136,0.9)); }
        100% { transform: scale(1) translateY(0) rotate(360deg); filter: brightness(1) drop-shadow(0 0 5px rgba(0,255,136,0.6)); }
    }

    /* ── BUZ HÜCRESİ (ICE CELL) ── */
    @keyframes icePulse {
        0%, 100% { transform: scale(1); filter: drop-shadow(0 0 10px rgba(165,243,252,0.9)); }
        50% { transform: scale(1.15); filter: drop-shadow(0 0 18px rgba(165,243,252,1)); }
    }
    .ice-icon-animated {
        animation: icePulse 1.2s infinite ease-in-out;
    }

    /* ── TELEPORT HÜCRESİ (TELEPORTER CELL) ── */
    @keyframes rotatePortal {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    @keyframes rotatePortalReverse {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(-360deg); }
    }
    @keyframes portalPulse {
        0% { transform: scale(0.65); opacity: 0.8; }
        50% { opacity: 0.45; }
        100% { transform: scale(1.35); opacity: 0; }
    }
    .portal-pulse-ring-active {
        animation: portalPulse 0.8s infinite ease-out;
    }
    .portal-vortex-active {
        animation: rotatePortal 4.2s infinite linear;
    }
    .portal-vortex-inner-active {
        animation: rotatePortalReverse 2.2s infinite linear;
    }

    /* ── GÜÇ HÜCRESİ (POWER CELL) ── */
    @keyframes powerRing {
        0% { transform: scale(0.7); opacity: 0.8; }
        50% { opacity: 0.4; }
        100% { transform: scale(1.15); opacity: 0; }
    }
    @keyframes boltGlow {
        0%, 100% { filter: drop-shadow(0 0 4px rgba(251,191,36,0.85)); transform: scale(1); }
        50% { filter: drop-shadow(0 0 12px rgba(251,191,36,1)); transform: scale(1.18); }
    }
    .power-ring-active {
        animation: powerRing 0.7s infinite ease-out;
    }
    .power-bolt-active {
        animation: boltGlow 0.5s infinite ease-in-out;
    }

    /* ── HEDEF HÜCRESİ (TARGET CELL) ── */
    @keyframes targetPulse {
        0% { transform: scale(0.9); opacity: 0.7; }
        50% { transform: scale(1.08); opacity: 1; }
        100% { transform: scale(0.9); opacity: 0.7; }
    }
    @keyframes targetRotate {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    .target-pulse-anim {
        animation: targetPulse 2.2s infinite ease-in-out;
    }
    .target-rotate-anim {
        position: absolute;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        animation: targetRotate 8s infinite linear;
        pointer-events: none;
    }

    /* ── GEÇİŞ HÜCRESİ (TOGGLE CELL) ── */
    @keyframes toggleActive {
        0% { transform: scale(1) rotate(0deg); opacity: 0.7; }
        50% { transform: scale(1.25) rotate(180deg); opacity: 1; }
        100% { transform: scale(1) rotate(360deg); opacity: 0.7; }
    }
    .toggle-symbol-active {
        animation: toggleActive 0.6s infinite linear;
    }

    /* ── KONVEYÖR HÜCRESİ (CONVEYOR CELL) ── */
    @keyframes conveyorChasing {
        0%, 100% { opacity: 0.25; }
        50% { opacity: 1; }
    }
    .conveyor-arrow-1-active {
        animation: conveyorChasing 0.5s infinite linear;
        animation-delay: 0s;
    }
    .conveyor-arrow-2-active {
        animation: conveyorChasing 0.5s infinite linear;
        animation-delay: 0.16s;
    }
    .conveyor-arrow-3-active {
        animation: conveyorChasing 0.5s infinite linear;
        animation-delay: 0.32s;
    }

    /* ── TRAMBOLİN HÜCRESİ (TRAMPOLINE CELL) ── */
    @keyframes trampolineLaunch {
        0% { transform: scale(1.3, 0.35); filter: brightness(1.6); }
        40% { transform: scale(0.7, 1.4); filter: brightness(2.0); }
        70% { transform: scale(1.15, 0.85); }
        100% { transform: scale(1, 1); }
    }
    .trampoline-spring-active {
        animation: trampolineLaunch 500ms cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }

    /* ── KUTU GRAFİĞİ (BOX GRAPHIC) ── */
    @keyframes electricSpark {
        0% { transform: scale(1); box-shadow: 0 0 12px rgba(249,115,22, 0.5), inset 0 0 6px rgba(249,115,22, 0.15); }
        50% { transform: scale(1.04); box-shadow: 0 0 24px rgba(251,191,36, 0.95), inset 0 0 12px rgba(251,191,36, 0.4); border-color: #fbbf24; }
        100% { transform: scale(1); box-shadow: 0 0 12px rgba(249,115,22, 0.5), inset 0 0 6px rgba(249,115,22, 0.15); }
    }
    .box-container-active {
        animation: electricSpark 1.2s infinite ease-in-out;
    }

    /* ── OYUNCU GRAFİĞİ (PLAYER GRAPHIC) ── */
    @keyframes playerPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    @keyframes spinCounterClockwise {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(-360deg); }
    }
    .player-outer-ring-reversed {
        animation: spinCounterClockwise 3.5s infinite linear;
        transform-origin: 12px 12px;
    }

    /* ── FİZİK VE PARÇACIKLAR (PHYSICS WRAPPER & ICE DUST) ── */
    @keyframes teleportInEffect {
        0% { transform: scale(0) rotate(120deg); opacity: 0; filter: brightness(3) hue-rotate(90deg); }
        50% { transform: scale(1.3); opacity: 0.8; filter: brightness(2); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; filter: brightness(1); }
    }
    @keyframes landingSquashEffect {
        0% { transform: scale(1.3, 0.7); }
        40% { transform: scale(0.85, 1.15); }
        70% { transform: scale(1.05, 0.95); }
        100% { transform: scale(1, 1); }
    }
    @keyframes iceDustLeft {
        0% { transform: translate(16px, 48px) scale(1); opacity: 0.8; }
        100% { transform: translate(56px, 40px) scale(0.1); opacity: 0; }
    }
    @keyframes iceDustRight {
        0% { transform: translate(48px, 48px) scale(1); opacity: 0.8; }
        100% { transform: translate(8px, 40px) scale(0.1); opacity: 0; }
    }
    @keyframes iceDustUp {
        0% { transform: translate(32px, 48px) scale(1); opacity: 0.8; }
        100% { transform: translate(32px, 80px) scale(0.1); opacity: 0; }
    }
    @keyframes iceDustDown {
        0% { transform: translate(32px, 16px) scale(1); opacity: 0.8; }
        100% { transform: translate(32px, -16px) scale(0.1); opacity: 0; }
    }
    .ice-dust-particle {
        position: absolute;
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: rgba(165,243,252,0.85);
        box-shadow: 0 0 5px rgba(165,243,252,1);
        pointer-events: none;
    }
    .ice-trail-left { animation: iceDustLeft 220ms infinite linear; }
    .ice-trail-right { animation: iceDustRight 220ms infinite linear; }
    .ice-trail-up { animation: iceDustUp 220ms infinite linear; }
    .ice-trail-down { animation: iceDustDown 220ms infinite linear; }
`;
