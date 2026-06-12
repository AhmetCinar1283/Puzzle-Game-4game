import { JSX } from "react";
import { CellTypes } from "../../logic/cellTypes";

import { NormalCellRenderer    } from "./normalCellRenderer";
import { IceCellRenderer       } from "./iceCellRenderer";
import { ObstacleCellRenderer  } from "./obstacleCellRenderer";
import { ForbiddenCellRenderer } from "./forbiddenCellRenderer";
import { PowerCellRenderer     } from "./powerCellRenderer";
import { ToggleCellRenderer    } from "./toggleCellRenderer";
import { ConveyorCellRenderer  } from "./conveyorCellRenderer";
import { TrampolineCellRenderer} from "./trampolineCellRenderer";
import { TeleportCellRenderer  } from "./teleportCellRenderer";
import { TargetCellRenderer    } from "./targetCellRenderer";
import { ControlSwitchCellRenderer } from "./controlSwitchCellRenderer";
import { DirectionDeflectorCellRenderer } from "./directionDeflectorCellRenderer";


export const CELL_RENDERERS: Record<CellTypes, (props: any) => JSX.Element> = {
    'normal':     NormalCellRenderer,
    'obstacle':   ObstacleCellRenderer,
    'forbidden':  ForbiddenCellRenderer,
    'ice':        IceCellRenderer,
    'power':      PowerCellRenderer,
    'toggle':     ToggleCellRenderer,
    'conveyor':   ConveyorCellRenderer,
    'trampoline': TrampolineCellRenderer,
    'teleport':   TeleportCellRenderer,
    'target':     TargetCellRenderer,
    'control_switch': ControlSwitchCellRenderer,
    'direction_deflector': DirectionDeflectorCellRenderer,
};
