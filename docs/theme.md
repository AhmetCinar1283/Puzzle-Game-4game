# Theme & Visual System

## Neon Color Palette

Dark base: `#030712`. Glows via `box-shadow` and `text-shadow` inline styles.

| Element | Color |
|---|---|
| P1 (emerald) | `#00ff88` |
| P2 (sky) | `#00c4ff` |
| Forbidden | `#ef4444` |
| Direction toggle | `#ffd700` |
| Portal edge | `#9333ea` |
| Lava edge | `#ef4444` |
| Ice | `#a5f3fc` (cyan-white) |
| Power node | `#fbbf24` (amber) |
| Conveyor (active) | `#c4b5fd` (purple) |
| Teleporter A | `#ec4899` (pink) |
| Teleporter B | `#f97316` (orange) |
| Teleporter C | `#14b8a6` (teal) |
| Box | `#f97316` orange neon border; dims when `requiresPower && !isPowered` |
| Powered trail overlay | `rgba(251,191,36,0.08)` amber over base trail |
| Trail P1 | emerald |
| Trail P2 | sky |

## framer-motion Usage

`GameObject` uses `<motion.div animate={{ x, y }}>` with absolute positioning.
- `x = col * CELL_SIZE`, `y = row * CELL_SIZE`
- Spring config: `stiffness: 400, damping: 30`

`WinOverlay` and `LostOverlay` use `AnimatePresence` with scale+opacity transitions.

## Mobile Controls & Responsive Layout

- **Desktop (≥ 768px):** D-pad rendered below board (9-cell grid: ↑ ← · → ↓), uses `onPointerDown`
- **Mobile (< 768px):** D-pad hidden; swipe gestures on the board area (touchstart/touchend, 30px threshold)
- **Dynamic cell size:** `GameShell` computes `cellSize` from viewport on resize; clamped `[32, 72]px`; passed as prop to `GameBoard`

## CSS Game Feel (`globals.css`)

- Custom neon crosshair cursor (SVG data URI, `#00ff88`, 24×24, hotspot 12,12)
- `user-select: none` on body (re-enabled for inputs/textareas)
