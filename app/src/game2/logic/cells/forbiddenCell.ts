// cells/forbiddenCell.ts
// Yasaklı hücre: içinden geçilebilir ama durulamaz.
// → Oyuncu burada durursa "Oyun bitti" (destroy + UI mesajı).
// → Kutu itilirse sessizce yok olur (destroy, sessiz).

import { CellBehavior, CellDef } from '../cellTypes';

export const forbiddenDef: CellDef = {
    friction: 1,
    isWalkable: true, // Girilir — ama giren yok edilir
};

export const forbiddenBehavior: CellBehavior = {
    onEnter: (cell, entity) => {
        if (entity.type === 'player') {
            // Oyuncu: yok et + ekrana hata mesajı + yeniden başlatma butonu
            return [
                {
                    entityId: entity.id,
                    type: 'destroy',
                    uiEvent: { kind: 'text', textType: 'error', message: 'Oyun bitti!' },
                },
                {
                    entityId: entity.id,
                    type: 'mutate_entity', // Sahte niyet — sadece UI butonunu taşımak için
                    uiEvent: { kind: 'button', buttonType: 'restart', label: 'Yeniden Başlat' },
                },
            ];
        }

        // Kutu: sessizce yok et
        return [{
            entityId: entity.id,
            type: 'destroy',
        }];
    },
};
