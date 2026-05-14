import { JSX } from 'react';
import { Entity, EntityTypes } from '../../logic/entityTypes';
import { PlayerGraphic } from './PlayerGraphic';
import { BoxGraphic }    from './BoxGraphic';

export const ENTITY_RENDERERS: Record<EntityTypes, (props: { entity: Entity }) => JSX.Element> = {
    player: PlayerGraphic,
    box:    BoxGraphic,
};
