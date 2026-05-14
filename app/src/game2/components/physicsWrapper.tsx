// components/PhysicsWrapper.tsx
// KOZMETİK SARMALAYICI — fiziksel konum ve Z yüksekliğini CSS'e çevirir.
// İçindeki grafik bileşen (PlayerGraphic, BoxGraphic) bunu bilmez.
//
// SORUMLULUK: position → translate, z → scale+yOffset, animasyon geçişi.
// KURAL: Oyun mantığı yok. Sadece veriyi CSS'e çevirir.

import { ReactNode } from 'react';
import { Entity } from '../logic/entityTypes';
import { CellTypes } from '../logic/cellTypes';

const CELL_SIZE = 64;
const FRAME_MS  = 80; // GameBoard ile senkron

interface PhysicsWrapperProps {
    entity: Entity;
    currentCellType: CellTypes;
    children: ReactNode;
}

export const PhysicsWrapper = ({ entity, currentCellType, children }: PhysicsWrapperProps) => {
    const { z, force } = entity.physics;
    const { row, col } = entity.position;

    const x = col * CELL_SIZE;
    const y = row * CELL_SIZE;

    // Z değerine göre görsel yükseklik ve büyüklük (trampolin zıplaması vb.)
    const scale   = 1 + z * 0.18;
    const zOffset = -(z * 12); // Yukarı kaymak için negatif Y

    // Buz üzerinde ve hareket ediyorsa bant efekti (eğilme hissi)
    const isSliding = force > 0 && currentCellType === 'ice';

    return (
        <div
            style={{
                position:   'absolute',
                top:        0,
                left:       0,
                width:      CELL_SIZE,
                height:     CELL_SIZE,
                transform:  `translate(${x}px, ${y + zOffset}px) scale(${scale})`,
                transition: `transform ${FRAME_MS}ms linear`,
                zIndex:     10 + z,
                filter:     isSliding ? 'brightness(1.2)' : undefined,
            }}
        >
            {children}
        </div>
    );
};
