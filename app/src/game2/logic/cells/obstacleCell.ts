// cells/obstacleCell.ts
// Engel: geçilemez katı duvar. Hiçbir nesne içine giremez.
// Motor zaten isWalkable: false kontrolünü yapar — behavior boş bırakılır.

import { CellBehavior, CellDef } from '../cellTypes';

export const obstacleDef: CellDef = {
    friction: 1,
    isWalkable: false, // Motor bu bayrakla girişi engeller
};

export const obstacleBehavior: CellBehavior = {
    // Engel hücresi ekstra kural üretmez; geçişi motor reddeder.
};
