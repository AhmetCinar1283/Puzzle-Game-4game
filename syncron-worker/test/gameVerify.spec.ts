import { describe, it, expect } from "vitest";
import { verifyMoves } from "../src/services/gameVerify";

describe("gameVerify logic", () => {
  it("verifies a simple level completion", () => {
    const mockLevel = {
      edges: { top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' },
      grid: [
        ['empty', 'empty', 'empty'],
        ['empty', 'empty', 'target_1'],
        ['empty', 'empty', 'empty'],
      ],
      initialObjects: [
        { position: { row: 1, col: 0 }, mode: 'normal' }
      ],
      initialBoxes: []
    };

    // Moving right twice reaches target_1 and wins (short-hand: 'r', 'r')
    expect(verifyMoves(mockLevel, ['r', 'r'])).toBe(true);

    // Long-form moves: 'right', 'right' should also work
    expect(verifyMoves(mockLevel, ['right', 'right'])).toBe(true);

    // Insufficient moves (only 1 move right) -> should be false (no win)
    expect(verifyMoves(mockLevel, ['r'])).toBe(false);

    // Moving in wrong directions -> should be false (no win)
    expect(verifyMoves(mockLevel, ['u', 'd'])).toBe(false);
  });

  it("verifies player mode reversal", () => {
    const mockLevel = {
      edges: { top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' },
      grid: [
        ['empty', 'empty', 'empty'],
        ['target_1', 'empty', 'empty'],
        ['empty', 'empty', 'empty'],
      ],
      initialObjects: [
        { position: { row: 1, col: 1 }, mode: 'reversed' } // starts in center, moves opposite
      ],
      initialBoxes: []
    };

    // Input: 'r' (right), but because player is reversed, they will actually move LEFT
    // Moving left from (1, 1) reaches target_1 at (1, 0)
    expect(verifyMoves(mockLevel, ['r'])).toBe(true);

    // Input: 'l' (left) -> moves right -> no win
    expect(verifyMoves(mockLevel, ['l'])).toBe(false);
  });

  it("verifies trampolines and portal wrapping", () => {
    const mockLevel = {
      edges: { top: 'wall', bottom: 'wall', left: 'portal', right: 'portal' },
      grid: [
        ['empty', 'empty', 'empty', 'empty'],
        ['trampoline_left', 'empty', 'target_1', 'empty'],
        ['empty', 'empty', 'empty', 'empty'],
      ],
      initialObjects: [
        { position: { row: 0, col: 3 }, mode: 'normal' }
      ],
      initialBoxes: [],
      trampolineConfig: [
        { position: { row: 1, col: 0 }, steps: 2 }
      ]
    };

    // Solution path: 'l', 'l', 'l', 'd'
    // 'l': moves player from (0,3) to (0,2)
    // 'l': moves player from (0,2) to (0,1)
    // 'l': moves player from (0,1) to (0,0)
    // 'd': moves player from (0,0) to (1,0) -> triggers trampoline -> wraps left to (1,3) -> lands on (1,2) target
    expect(verifyMoves(mockLevel, ['l', 'l', 'l', 'd'])).toBe(true);

    // Incorrect path: only 3 moves (l, l, l) -> player at (0,0) -> no win
    expect(verifyMoves(mockLevel, ['l', 'l', 'l'])).toBe(false);
  });

  it("verifies multiple rooms and selective room switching", () => {
    const mockLevel = {
      controlMode: 'selected_room',
      initialControlledRooms: ['room1'],
      rooms: [
        {
          id: 'room1',
          name: 'Room 1',
          width: 3,
          height: 3,
          edges: { top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' },
          grid: [
            ['empty', 'empty', 'empty'],
            ['empty', 'empty', 'target_1'],
            ['empty', 'empty', 'empty'],
          ],
        },
        {
          id: 'room2',
          name: 'Room 2',
          width: 3,
          height: 3,
          edges: { top: 'wall', bottom: 'wall', left: 'wall', right: 'wall' },
          grid: [
            ['empty', 'empty', 'empty'],
            ['empty', 'empty', 'target_2'],
            ['empty', 'empty', 'empty'],
          ],
        }
      ],
      initialObjects: [
        { position: { roomId: 'room1', row: 1, col: 0 }, mode: 'normal' },
        { position: { roomId: 'room2', row: 1, col: 0 }, mode: 'normal' }
      ],
      initialBoxes: []
    };

    // If we only move 'r', 'r', room2 is never controlled, so player 2 doesn't move. No win.
    expect(verifyMoves(mockLevel, ['r', 'r'])).toBe(false);

    // With switching:
    // 'r', 'r': player 1 reaches target_1.
    // 's': switch room control to room2.
    // 'r', 'r': player 2 reaches target_2.
    expect(verifyMoves(mockLevel, ['r', 'r', 's', 'r', 'r'])).toBe(true);
  });
});
