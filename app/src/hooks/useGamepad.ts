'use client';

import { useEffect, useRef, useState } from 'react';

export type GamepadDirection = 'up' | 'down' | 'left' | 'right';

interface UseGamepadProps {
  onMove?: (direction: GamepadDirection) => void;
  onRestart?: () => void;
  onMenu?: () => void;
  onConfirm?: () => void;
  onButtonPress?: (buttonIndex: number, pressed: boolean) => void;
  onAxisMove?: (axisIndex: number, value: number) => void;
  enabled?: boolean;
}

export function useGamepad({
  onMove,
  onRestart,
  onMenu,
  onConfirm,
  onButtonPress,
  onAxisMove,
  enabled = true,
}: UseGamepadProps = {}) {
  const [connectedGamepad, setConnectedGamepad] = useState<Gamepad | null>(null);

  // Keep references to callbacks to avoid resetting the RAF loop when they change
  const callbacksRef = useRef({ onMove, onRestart, onMenu, onConfirm, onButtonPress, onAxisMove });
  useEffect(() => {
    callbacksRef.current = { onMove, onRestart, onMenu, onConfirm, onButtonPress, onAxisMove };
  }, [onMove, onRestart, onMenu, onConfirm, onButtonPress, onAxisMove]);

  // Track previous state for discrete action triggering
  const prevStateRef = useRef<{
    buttons: boolean[];
    axes: number[];
  }>({
    buttons: [],
    axes: [],
  });

  useEffect(() => {
    if (!enabled) {
      setConnectedGamepad(null);
      return;
    }

    // Check for already connected gamepads on mount
    const checkInitialGamepads = () => {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      const gps = navigator.getGamepads();
      for (let i = 0; i < gps.length; i++) {
        if (gps[i]) {
          setConnectedGamepad(gps[i]);
          break;
        }
      }
    };

    checkInitialGamepads();

    const handleConnect = (e: GamepadEvent) => {
      console.log('Gamepad connected:', e.gamepad.id);
      setConnectedGamepad(e.gamepad);
    };

    const handleDisconnect = (e: GamepadEvent) => {
      console.log('Gamepad disconnected:', e.gamepad.id);
      setConnectedGamepad(null);
    };

    window.addEventListener('gamepadconnected', handleConnect);
    window.addEventListener('gamepaddisconnected', handleDisconnect);

    return () => {
      window.removeEventListener('gamepadconnected', handleConnect);
      window.removeEventListener('gamepaddisconnected', handleDisconnect);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !connectedGamepad) return;

    let rAFId: number;

    const pollGamepad = () => {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      
      const gamepads = navigator.getGamepads();
      // Find the gamepad we are tracking
      const gp = gamepads[connectedGamepad.index];
      if (!gp) {
        rAFId = requestAnimationFrame(pollGamepad);
        return;
      }

      const prev = prevStateRef.current;
      const currentButtons = gp.buttons.map(b => b.pressed);
      const currentAxes = [...gp.axes];

      // Pad previous state arrays if they are empty (first run)
      if (prev.buttons.length === 0) {
        prev.buttons = new Array(gp.buttons.length).fill(false);
      }
      if (prev.axes.length === 0) {
        prev.axes = new Array(gp.axes.length).fill(0);
      }

      const { onMove: triggerMove, onRestart: triggerRestart, onMenu: triggerMenu, onConfirm: triggerConfirm, onButtonPress: triggerButtonPress, onAxisMove: triggerAxisMove } = callbacksRef.current;

      // 1. Process Buttons
      for (let i = 0; i < gp.buttons.length; i++) {
        const pressed = gp.buttons[i].pressed;
        const prevPressed = prev.buttons[i];

        if (pressed !== prevPressed) {
          triggerButtonPress?.(i, pressed);

          // Trigger on transition from false to true
          if (pressed && !prevPressed) {
            // Confirm button (A / Cross)
            if (i === 0) triggerConfirm?.();

            // D-Pad Up
            if (i === 12) triggerMove?.('up');
            // D-Pad Down
            if (i === 13) triggerMove?.('down');
            // D-Pad Left
            if (i === 14) triggerMove?.('left');
            // D-Pad Right
            if (i === 15) triggerMove?.('right');

            // Restart buttons: Y / Triangle (button 3), X / Square (button 2), or Select/Share (button 8)
            if (i === 2 || i === 3 || i === 8) {
              triggerRestart?.();
            }

            // Menu buttons: B / Circle (button 1), Start/Options (button 9)
            if (i === 1 || i === 9) {
              triggerMenu?.();
            }
          }
        }
      }

      // 2. Process Analog Sticks (Axes)
      // Left Stick Horizontal: axis 0
      // Left Stick Vertical: axis 1
      const AXIS_THRESHOLD = 0.5;

      for (let i = 0; i < gp.axes.length; i++) {
        const val = gp.axes[i];
        const prevVal = prev.axes[i];

        if (val !== prevVal) {
          triggerAxisMove?.(i, val);
        }

        // Horizontal Left Stick
        if (i === 0) {
          if (val < -AXIS_THRESHOLD && prevVal >= -AXIS_THRESHOLD) {
            triggerMove?.('left');
          } else if (val > AXIS_THRESHOLD && prevVal <= AXIS_THRESHOLD) {
            triggerMove?.('right');
          }
        }

        // Vertical Left Stick
        if (i === 1) {
          if (val < -AXIS_THRESHOLD && prevVal >= -AXIS_THRESHOLD) {
            triggerMove?.('up');
          } else if (val > AXIS_THRESHOLD && prevVal <= AXIS_THRESHOLD) {
            triggerMove?.('down');
          }
        }
      }

      // Save state for next tick
      prevStateRef.current = {
        buttons: currentButtons,
        axes: currentAxes,
      };

      rAFId = requestAnimationFrame(pollGamepad);
    };

    rAFId = requestAnimationFrame(pollGamepad);

    return () => {
      cancelAnimationFrame(rAFId);
    };
  }, [enabled, connectedGamepad]);

  return {
    gamepad: connectedGamepad,
    isConnected: !!connectedGamepad,
  };
}
