/**
 * movement.ts — backward-compatibility shim
 *
 * The engine lives in engine/tick.ts. This shim keeps gameReducer.ts (and any
 * other consumers) working without changes.
 */

export { processMoveStep } from './engine/tick';

// Utilities still used by editor / admin pages
export {
  resolveDirection,
  checkWinCondition,
  applyMoveToObject,
} from './movementHelpers';
