// cells/registry.ts
// Hücre tiplerini davranış ve tanım objelerine eşleyen kayıt defteri.
// Motor behavior'ları cell instance'ının içinden değil, buradan okur.

import { Cell, CellBehavior, CellDef } from '../cellTypes';

import { normalBehavior,    normalDef    } from './normalCell';
import { iceBehavior,       iceDef       } from './iceCell';
import { obstacleBehavior,  obstacleDef  } from './obstacleCell';
import { forbiddenBehavior, forbiddenDef } from './forbiddenCell';
import { powerBehavior,     powerDef     } from './powerCell';
import { toggleBehavior,    toggleDef    } from './toggleCell';
import { conveyorBehavior,  conveyorDef  } from './conveyorCell';
import { trampolineBehavior, trampolineDef } from './trampolineCell';
import { teleportBehavior,  teleportDef  } from './teleporterCell';

export const CELL_BEHAVIORS: Record<Cell['type'], CellBehavior> = {
    'normal':     normalBehavior,
    'obstacle':   obstacleBehavior,
    'forbidden':  forbiddenBehavior,
    'ice':        iceBehavior,
    'power':      powerBehavior,
    'toggle':     toggleBehavior,
    'conveyor':   conveyorBehavior,
    'trampoline': trampolineBehavior,
    'teleport':   teleportBehavior,
};

export const CELL_DEFS: Record<Cell['type'], CellDef> = {
    'normal':     normalDef,
    'obstacle':   obstacleDef,
    'forbidden':  forbiddenDef,
    'ice':        iceDef,
    'power':      powerDef,
    'toggle':     toggleDef,
    'conveyor':   conveyorDef,
    'trampoline': trampolineDef,
    'teleport':   teleportDef,
};
