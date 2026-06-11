import type { CellType, EdgeBehavior, MovementMode } from '@/app/src/games/types';

// ─── Types ─────────────────────────────────────────────────────────────────

export type ToolType = CellType | 'place_obj1' | 'place_obj2' | 'place_box' | 'erase' | 'select' | 'lock';

export interface ObjConfig {
  id: number;
  row: number | null;
  col: number | null;
  roomId?: string;
  mode: MovementMode;
  lockOnTarget: boolean;
}

export interface BoxConfig {
  id: number;
  row: number | null;
  col: number | null;
  roomId?: string;
  requiresPower: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const CELL_TYPES_BASIC: CellType[] = [
  'empty', 'obstacle', 'forbidden', 'target_1', 'target_2', 'direction_toggle', 'control_switch',
];
export const CELL_TYPES_ICE: CellType[] = ['ice'];
export const CELL_TYPES_POWER: CellType[] = ['power_node'];
export const CELL_TYPES_CONVEYOR: CellType[] = [
  'conveyor_up', 'conveyor_down', 'conveyor_left', 'conveyor_right',
];
export const CELL_TYPES_TELEPORTER: CellType[] = [
  'teleporter_in_A', 'teleporter_out_A',
  'teleporter_in_B', 'teleporter_out_B',
  'teleporter_in_C', 'teleporter_out_C',
];
export const CELL_TYPES_TRAMPOLINE: CellType[] = [
  'trampoline_up', 'trampoline_down', 'trampoline_left', 'trampoline_right',
];

export const CELL_TYPES: CellType[] = [
  ...CELL_TYPES_BASIC,
  ...CELL_TYPES_ICE,
  ...CELL_TYPES_POWER,
  ...CELL_TYPES_CONVEYOR,
  ...CELL_TYPES_TELEPORTER,
  ...CELL_TYPES_TRAMPOLINE,
];

import { getPlayerColor } from '@/app/src/game2/components/playerColors';

const GROUP_COLORS: Record<string, string> = {
  A: '#ec4899',
  B: '#f97316',
  C: '#14b8a6',
  D: '#a855f7',
  E: '#eab308',
  F: '#ef4444',
  G: '#3b82f6',
};

export function getGroupColor(group: string): string {
  if (GROUP_COLORS[group]) return GROUP_COLORS[group];
  let hash = 0;
  for (let i = 0; i < group.length; i++) {
    hash = group.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 85%, 60%)`;
}

const RAW_CELL_LABEL: Record<string, string> = {
  empty: 'Empty', obstacle: 'Obstacle', forbidden: 'Forbidden',
  target_1: 'Target 1', target_2: 'Target 2', direction_toggle: 'Toggle', control_switch: 'Control Switch', erase: 'Erase',
  ice: 'Ice',
  power_node: 'Power',
  conveyor_up: 'Conv ▲', conveyor_down: 'Conv ▼',
  conveyor_left: 'Conv ◄', conveyor_right: 'Conv ►',
  teleporter_in_A: 'Tel-In A', teleporter_out_A: 'Tel-Out A',
  teleporter_in_B: 'Tel-In B', teleporter_out_B: 'Tel-Out B',
  teleporter_in_C: 'Tel-In C', teleporter_out_C: 'Tel-Out C',
  trampoline_up: 'Trmp ▲', trampoline_down: 'Trmp ▼',
  trampoline_left: 'Trmp ◄', trampoline_right: 'Trmp ►',
};

export const CELL_LABEL = new Proxy(RAW_CELL_LABEL, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    if (prop.startsWith('target_')) {
      return `Target ${prop.substring(7)}`;
    }
    if (prop.startsWith('teleporter_in_')) {
      return `Tel-In ${prop.substring('teleporter_in_'.length)}`;
    }
    if (prop.startsWith('teleporter_out_')) {
      return `Tel-Out ${prop.substring('teleporter_out_'.length)}`;
    }
    return prop;
  }
}) as unknown as Record<string, string>;

const RAW_CELL_ICON: Record<string, string> = {
  empty: '▫', obstacle: '■', forbidden: '✕',
  target_1: '◎', target_2: '◎', direction_toggle: '⇄', control_switch: '❖', erase: '⌫',
  ice: '❄',
  power_node: '⚡',
  conveyor_up: '▲', conveyor_down: '▼', conveyor_left: '◄', conveyor_right: '►',
  teleporter_in_A: '⟿A', teleporter_out_A: '⟾A',
  teleporter_in_B: '⟿B', teleporter_out_B: '⟾B',
  teleporter_in_C: '⟿C', teleporter_out_C: '⟾C',
  trampoline_up: '▲', trampoline_down: '▼', trampoline_left: '◄', trampoline_right: '►',
};

export const CELL_ICON = new Proxy(RAW_CELL_ICON, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    if (prop.startsWith('target_')) return '◎';
    if (prop.startsWith('teleporter_in_')) {
      return `⟿${prop.substring('teleporter_in_'.length)}`;
    }
    if (prop.startsWith('teleporter_out_')) {
      return `⟾${prop.substring('teleporter_out_'.length)}`;
    }
    return prop;
  }
}) as unknown as Record<string, string>;

const RAW_CELL_COLOR: Record<string, string> = {
  empty: '#475569', obstacle: '#94a3b8', forbidden: '#ef4444',
  target_1: '#00ff88', target_2: '#00c4ff', direction_toggle: '#ffd700', control_switch: '#a855f7', erase: '#64748b',
  ice: '#a5f3fc',
  power_node: '#fbbf24',
  conveyor_up: '#c4b5fd', conveyor_down: '#c4b5fd',
  conveyor_left: '#c4b5fd', conveyor_right: '#c4b5fd',
  teleporter_in_A: '#ec4899', teleporter_out_A: '#ec4899',
  teleporter_in_B: '#f97316', teleporter_out_B: '#f97316',
  teleporter_in_C: '#14b8a6', teleporter_out_C: '#14b8a6',
  trampoline_up: '#22d3ee', trampoline_down: '#22d3ee',
  trampoline_left: '#22d3ee', trampoline_right: '#22d3ee',
};

export const CELL_COLOR = new Proxy(RAW_CELL_COLOR, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    if (prop.startsWith('target_')) {
      const idx = parseInt(prop.substring(7), 10) - 1;
      return getPlayerColor(isNaN(idx) ? 0 : idx).hex;
    }
    if (prop.startsWith('teleporter_in_') || prop.startsWith('teleporter_out_')) {
      const group = prop.substring(prop.lastIndexOf('_') + 1);
      return getGroupColor(group);
    }
    return '#475569';
  }
}) as unknown as Record<string, string>;

export const EDGE_OPTIONS: EdgeBehavior[] = ['wall', 'portal', 'lava'];
export const EDGE_LABEL: Record<EdgeBehavior, string> = { wall: 'Wall', portal: 'Portal', lava: 'Lava' };
export const EDGE_COLOR: Record<EdgeBehavior, string> = { wall: '#475569', portal: '#9333ea', lava: '#ef4444' };

export const DIFFICULTY_LABELS: Record<number, string> = { 1: 'Kolay', 2: 'Orta', 3: 'Zor', 4: 'Çok Zor' };
export const DIFFICULTY_COLORS: Record<number, string> = { 1: '#00ff88', 2: '#fbbf24', 3: '#f97316', 4: '#ef4444' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function makeGrid(w: number, h: number): CellType[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => 'empty' as CellType));
}

export function resizeGrid(old: CellType[][], w: number, h: number): CellType[][] {
  return Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => old[r]?.[c] ?? 'empty'),
  );
}
