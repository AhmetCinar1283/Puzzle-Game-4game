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
        100% { transform: translateX(0) scale(1); }
    }
    @keyframes conveyor-reject-right {
        0% { transform: translateX(0); }
        30% { transform: translateX(10px) scaleX(0.9); }
        75% { transform: translateX(-10px) scaleX(1.05); }
        100% { transform: translateX(0) scale(1); }
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
`;
