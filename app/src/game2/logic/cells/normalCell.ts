import { CellBehavior, CellDef } from '../cellTypes';

export const normalDef: CellDef = {
  friction: 1,
  isWalkable: true,
};

export const normalBehavior: CellBehavior = {
  onEnter: (cell, entity) => {
    if (entity.physics.z > 0) return []; // Havada — sürtünme yok

    const newForce = entity.physics.force - cell.def.friction;
    return [{
      entityId: entity.id,
      type: 'mutate_entity',
      newForce: newForce < 0 ? 0 : newForce,
    }];
  },
};
