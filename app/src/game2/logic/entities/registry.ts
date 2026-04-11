// entities/registry.ts
// Entity tiplerini davranış objelerine eşleyen kayıt defteri.
// Motor behavior'ları entity instance'ının içinden değil, buradan okur.

import { EntityBehavior, EntityTypes } from '../entityTypes';
import { playerBehavior } from './playerEnt';
import { boxBehavior } from './boxEnt';

export const ENTITY_BEHAVIORS: Record<EntityTypes, EntityBehavior> = {
    'player': playerBehavior,
    'box':    boxBehavior,
};
