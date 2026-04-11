import { CellBehavior, CellDef } from '../cellTypes';

export const normalDef: CellDef = {
  friction: 1,   // Normal zemin her adımda 1 force tüketir
  isWalkable: true,
};

export const normalBehavior: CellBehavior = {
  onEnter: (cell, entity) => {
    // SÜRTÜNME KURALI — Normal zemin kendi içinde hesaplar, motora hazır değeri verir.
    // Motor "force -= friction" bilmez. Zemin hesaplar, mutate_entity niyeti döndürür.
    // Motor sadece "entity.physics.force = newForce" atamasını yapar.
    const newForce = entity.physics.force - cell.def.friction;
    return [{
      entityId: entity.id,
      type: 'mutate_entity',
      newForce: newForce < 0 ? 0 : newForce,
    }];
  },
};
