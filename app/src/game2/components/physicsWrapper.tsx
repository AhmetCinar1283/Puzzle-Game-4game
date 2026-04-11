// components/PhysicsWrapper.tsx
import React, { ReactNode } from 'react';
import { Entity } from '../logic/entityTypes';
import { CellTypes } from '../logic/cellTypes';

export const PhysicsWrapper = ({ entity, currentCellType, children }: { entity: Entity, currentCellType: CellTypes, children: ReactNode }) => {
  const { z, force, direction } = entity.physics;
  const { row, col } = entity.position;

  // Grid üzerindeki X ve Y pozisyonunu hesapla (Örn: her hücre 64px)
  const CELL_SIZE = 64;
  const xPos = col * CELL_SIZE;
  const yPos = row * CELL_SIZE;

  // Z değerine göre büyüklük (Scale) ve yükseklik hissi (Y-Offset)
  const scale = 1 + (z * 0.2); 
  const zOffset = -(z * 15); 
  
  // Buzun üstündeysen ve hareket ediyorsan yalpalama animasyonu
  const isSliding = force > 0 && currentCellType === 'ice';

  return (
    <div 
      className={`absolute transition-all duration-200 ease-linear ${isSliding ? 'animate-wobble' : ''}`}
      style={{
        transform: `translate(${xPos}px, ${yPos + zOffset}px) scale(${scale})`,
        zIndex: 10 + z
      }}
    >
      {/* İÇERİDEKİ NESNE NE OLURSA OLSUN, FİZİK KURALLARI ONA UYGULANIR */}
      {children}
    </div>
  );
};