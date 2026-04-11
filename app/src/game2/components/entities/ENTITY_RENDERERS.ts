import { JSX } from "react";
import { EntityTypes } from "../../logic/entityTypes";
import { PlayerGraphic } from "./PlayerGraphic";
import { BoxGraphic } from "./BoxGraphic";

export const ENTITY_RENDERERS: Record<EntityTypes, (...props: any) => JSX.Element> = {
    'player': PlayerGraphic,
    'box': BoxGraphic,
}