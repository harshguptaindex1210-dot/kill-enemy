import type { PlayerInput } from './player';

export interface InputManager {
  getInput: () => PlayerInput;
  dispose: () => void;
}

export function createInputManager(canvas: HTMLCanvasElement): InputManager {
  const keys: Set<string> = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let firePressed = false;
  let aimPressed = false;
  let reloadOnce = false;
  let skillOnce = false;
  let w1 = false,
    w2 = false,
    w3 = false;

  window.addEventListener('keydown', (e) => {
    keys.add(e.code);
    if (e.code === 'KeyR') reloadOnce = true;
    if (e.code === 'KeyF') skillOnce = true;
    if (e.code === 'Digit1') w1 = true;
    if (e.code === 'Digit2') w2 = true;
    if (e.code === 'Digit3') w3 = true;
  });

  window.addEventListener('keyup', (e) => keys.delete(e.code));
  canvas.addEventListener('mousemove', (e) => {
    mouseX += e.movementX;
    mouseY += e.movementY;
  });
  window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && document.pointerLockElement) firePressed = true;
    if (e.button === 2 && document.pointerLockElement) aimPressed = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) firePressed = false;
    if (e.button === 2) aimPressed = false;
  });

  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement) {
      keys.clear();
      firePressed = false;
      aimPressed = false;
    }
  });

  canvas.addEventListener('click', () => {
    if (!document.pointerLockElement) canvas.requestPointerLock();
  });

  function getInput(): PlayerInput {
    const input: PlayerInput = {
      forward: keys.has('KeyW') || keys.has('ArrowUp'),
      backward: keys.has('KeyS') || keys.has('ArrowDown'),
      left: keys.has('KeyA') || keys.has('ArrowLeft'),
      right: keys.has('KeyD') || keys.has('ArrowRight'),
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
      crouch: keys.has('ControlLeft') || keys.has('ControlRight'),
      jump: keys.has('Space'),
      aim: aimPressed,
      fire: firePressed,
      reload: reloadOnce,
      skill: skillOnce,
      weapon1: w1,
      weapon2: w2,
      weapon3: w3,
      mouseX,
      mouseY,
    };
    mouseX = 0;
    mouseY = 0;
    reloadOnce = false;
    skillOnce = false;
    w1 = false;
    w2 = false;
    w3 = false;
    return input;
  }

  return { getInput, dispose: () => {} };
}
