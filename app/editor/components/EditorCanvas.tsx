'use client';

import GridCore from './GridCore';
import GridEdgeStrip from './GridEdgeStrip';
import SelectionLayer from './SelectionLayer';
import { ColControls, RowControls, COL_CTRL_H, ROW_CTRL_W } from './GridRowColControls';

interface EditorCanvasProps {
  isMobile: boolean;
  visible: boolean;
}

export default function EditorCanvas({ isMobile, visible }: EditorCanvasProps) {
  return (
    <div style={{
      flex: 1,
      display: isMobile ? (visible ? 'flex' : 'none') : 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'auto',
      padding: '12px 8px 8px',
    }}>
      {/* Column controls + grid + row controls */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>

        {/* Column delete/add row (above grid, offset to align with grid cells) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Spacer to align with the left-side symmetry spacer */}
          <div style={{ width: 2, flexShrink: 0 }} />
          {/* Spacer for edge strip padding */}
          <div style={{ width: 10, flexShrink: 0 }} />
          <ColControls />
          {/* Spacer for right edge strip + row controls */}
          <div style={{ width: 10 + 2 + ROW_CTRL_W, flexShrink: 0 }} />
        </div>

        {/* Main row: symmetry spacer | edge-strip gap | grid | edge-strip gap | row-controls right */}
        <div style={{ display: 'flex', alignItems: 'flex-start' }}>
          {/* 2px symmetry spacer */}
          <div style={{ width: 2, flexShrink: 0 }} />

          {/* Edge strip padding left */}
          <div style={{ width: 10, flexShrink: 0 }} />

          {/* Grid wrapper: relative so edge strips + selection can position absolutely */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <GridEdgeStrip />
            <GridCore />
            <SelectionLayer />
          </div>

          {/* Edge strip padding right */}
          <div style={{ width: 10, flexShrink: 0 }} />

          {/* Row delete/add controls (right of grid) */}
          <RowControls />
        </div>

        <p style={{ fontSize: 9, color: '#1e3a5f', margin: '6px 0 0', letterSpacing: '0.06em', alignSelf: 'center' }}>
          Paint · click same = clear · drag = fill · click edge strip = cycle wall/portal/lava
        </p>
      </div>
    </div>
  );
}
