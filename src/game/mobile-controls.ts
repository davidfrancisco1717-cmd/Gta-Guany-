export interface MobileInputState {
  moveX: number; // -1..1 (left stick horizontal)
  moveY: number; // -1..1 (left stick vertical, +1 = forward/up)
  lookDeltaX: number;
  lookDeltaY: number;
  sprintHeld: boolean;
  gasHeld: boolean;
  brakeHeld: boolean;
  reverseHeld: boolean;
  handbrakeHeld: boolean;
  steerLeftHeld: boolean;
  steerRightHeld: boolean;
  jumpPressed: boolean;
  enterExitPressed: boolean;
  interactPressed: boolean;
  attackPressed: boolean;
  hornHeld: boolean;
}

export function createMobileInputState(): MobileInputState {
  return {
    moveX: 0,
    moveY: 0,
    lookDeltaX: 0,
    lookDeltaY: 0,
    sprintHeld: false,
    gasHeld: false,
    brakeHeld: false,
    reverseHeld: false,
    handbrakeHeld: false,
    steerLeftHeld: false,
    steerRightHeld: false,
    jumpPressed: false,
    enterExitPressed: false,
    interactPressed: false,
    attackPressed: false,
    hornHeld: false,
  };
}

export function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
