// app/src/game2/components/playerColors.ts

export interface PlayerColorSchema {
    hex: string;
    primary: string;
    rgb: string;
    glow: string;
}

const PRESET_PLAYER_COLORS: Record<number, PlayerColorSchema> = {
    0: { hex: '#00ff88', primary: '#00ff88', rgb: '0,255,136', glow: 'rgba(0,255,136,0.65)' }, // P1 — Emerald
    1: { hex: '#00c4ff', primary: '#00c4ff', rgb: '0,196,255', glow: 'rgba(0,196,255,0.65)' }, // P2 — Sky
    2: { hex: '#d946ef', primary: '#d946ef', rgb: '217,70,239', glow: 'rgba(217,70,239,0.65)' }, // P3 — Purple/Orchid
    3: { hex: '#f97316', primary: '#f97316', rgb: '249,115,22', glow: 'rgba(249,115,22,0.65)' }, // P4 — Orange
    4: { hex: '#ec4899', primary: '#ec4899', rgb: '236,72,153', glow: 'rgba(236,72,153,0.65)' }, // P5 — Pink
    5: { hex: '#eab308', primary: '#eab308', rgb: '234,179,8', glow: 'rgba(234,179,8,0.65)' },   // P6 — Yellow
};

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return {
        r: Math.round(255 * f(0)),
        g: Math.round(255 * f(8)),
        b: Math.round(255 * f(4))
    };
}

export function getPlayerColor(index: number): PlayerColorSchema {
    if (PRESET_PLAYER_COLORS[index]) {
        return PRESET_PLAYER_COLORS[index];
    }
    // Generate beautiful distinct colors using golden angle distribution
    const hue = (index * 137.5) % 360;
    const { r, g, b } = hslToRgb(hue, 100, 50);
    const rgbStr = `${r},${g},${b}`;
    const hexStr = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return {
        hex: hexStr,
        primary: hexStr,
        rgb: rgbStr,
        glow: `rgba(${rgbStr},0.65)`,
    };
}
