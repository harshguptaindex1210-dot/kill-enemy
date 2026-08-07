import type { PlayerInput } from './player';
import { isTouchDevice, safeRequestPointerLock } from './platform';

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
  let jumpOnce = false;
  let w1 = false,
    w2 = false,
    w3 = false;

  // Touch state
  let touchForward = false;
  let touchBackward = false;
  let touchLeft = false;
  let touchRight = false;
  let touchSprint = false;
  let touchFirePressed = false;
  let touchAimPressed = false;
  let touchJumpOnce = false;
  let touchReloadOnce = false;
  let touchSkillOnce = false;
  let touchW1 = false;
  let touchW2 = false;
  let touchW3 = false;

  const isTouchDeviceFlag = isTouchDevice();

  // Keyboard listeners
  const onKeyDown = (e: KeyboardEvent) => {
    keys.add(e.code);
    if (e.code === 'KeyR') reloadOnce = true;
    if (e.code === 'KeyF') skillOnce = true;
    if (e.code === 'Space') jumpOnce = true;
    if (e.code === 'Digit1') w1 = true;
    if (e.code === 'Digit2') w2 = true;
    if (e.code === 'Digit3') w3 = true;
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);

  const onMouseMove = (e: MouseEvent) => {
    mouseX += e.movementX;
    mouseY += e.movementY;
  };

  const onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 && document.pointerLockElement) firePressed = true;
    if (e.button === 2 && document.pointerLockElement) aimPressed = true;
  };

  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) firePressed = false;
    if (e.button === 2) aimPressed = false;
  };

  const onPointerLockChange = () => {
    if (!document.pointerLockElement) {
      keys.clear();
      firePressed = false;
      aimPressed = false;
    }
  };

  const onCanvasClick = () => {
    if (!isTouchDeviceFlag && !document.pointerLockElement) {
      safeRequestPointerLock(canvas);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  if (!isTouchDeviceFlag) canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  canvas.addEventListener('click', onCanvasClick);

  // Mobile Touch Controls UI
  let touchOverlay: HTMLDivElement | null = null;
  let cameraTouchId: number | null = null;
  let cameraLastX = 0;
  let cameraLastY = 0;

  function mountTouchUI() {
    if (touchOverlay) return;

    touchOverlay = document.createElement('div');
    touchOverlay.id = 'touch-controls-overlay';
    touchOverlay.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:9996;user-select:none;-webkit-user-select:none;touch-action:none;';

    touchOverlay.innerHTML = `
      <!-- Virtual Joystick (Left) -->
      <div id="touch-joystick-area" style="position:absolute;bottom:30px;left:30px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,0.12);border:2px solid rgba(255,255,255,0.3);pointer-events:auto;touch-action:none;">
        <div id="touch-joystick-knob" style="position:absolute;top:50%;left:50%;width:50px;height:50px;margin-top:-25px;margin-left:-25px;border-radius:50%;background:rgba(0,220,255,0.7);box-shadow:0 0 10px rgba(0,240,255,0.5);pointer-events:none;"></div>
      </div>

      <!-- Action Buttons (Right) -->
      <div id="touch-actions-area" style="position:absolute;bottom:30px;right:20px;display:flex;flex-direction:column;gap:12px;align-items:flex-end;pointer-events:auto;touch-action:none;">
        <div style="display:flex;gap:10px;align-items:center;">
          <button id="tb-skill" style="width:52px;height:52px;border-radius:50%;background:rgba(0,240,255,0.6);border:2px solid #fff;color:#fff;font-size:20px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);">⚡</button>
          <button id="tb-jump" style="width:52px;height:52px;border-radius:50%;background:rgba(50,220,100,0.6);border:2px solid #fff;color:#fff;font-size:20px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);">⬆️</button>
        </div>
        <div style="display:flex;gap:10px;align-items:center;">
          <button id="tb-reload" style="width:52px;height:52px;border-radius:50%;background:rgba(255,180,0,0.6);border:2px solid #fff;color:#fff;font-size:18px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);">🔄</button>
          <button id="tb-aim" style="width:52px;height:52px;border-radius:50%;background:rgba(50,150,255,0.6);border:2px solid #fff;color:#fff;font-size:20px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.5);">🎯</button>
          <button id="tb-fire" style="width:72px;height:72px;border-radius:50%;background:rgba(255,50,50,0.75);border:3px solid #fff;color:#fff;font-size:28px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(255,0,0,0.6);">🔥</button>
        </div>
      </div>

      <!-- Weapon Slots Bar (Top Right) -->
      <div id="touch-weapons-area" style="position:absolute;top:100px;right:15px;display:flex;gap:6px;pointer-events:auto;touch-action:none;">
        <button id="tb-w1" style="padding:6px 12px;background:rgba(0,0,0,0.6);border:1px solid #4af;color:#4af;border-radius:4px;font-size:12px;font-weight:bold;">Rifle</button>
        <button id="tb-w2" style="padding:6px 12px;background:rgba(0,0,0,0.6);border:1px solid #fa0;color:#fa0;border-radius:4px;font-size:12px;font-weight:bold;">Pistol</button>
        <button id="tb-w3" style="padding:6px 12px;background:rgba(0,0,0,0.6);border:1px solid #aaa;color:#aaa;border-radius:4px;font-size:12px;font-weight:bold;">Melee</button>
      </div>
    `;

    document.body.appendChild(touchOverlay);

    // Setup Joystick Dragging
    const joystickArea = touchOverlay.querySelector('#touch-joystick-area') as HTMLDivElement;
    const joystickKnob = touchOverlay.querySelector('#touch-joystick-knob') as HTMLDivElement;
    let joystickTouchId: number | null = null;

    const handleJoystickMove = (clientX: number, clientY: number) => {
      const rect = joystickArea.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = rect.width / 2;

      let dx = clientX - centerX;
      let dy = clientY - centerY;
      const dist = Math.hypot(dx, dy);

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius;
        dy = (dy / dist) * maxRadius;
      }

      joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;

      const normX = dx / maxRadius;
      const normY = dy / maxRadius;

      touchForward = normY < -0.25;
      touchBackward = normY > 0.25;
      touchLeft = normX < -0.25;
      touchRight = normX > 0.25;
      touchSprint = dist / maxRadius > 0.8;
    };

    const resetJoystick = () => {
      joystickTouchId = null;
      joystickKnob.style.transform = 'translate(0px, 0px)';
      touchForward = false;
      touchBackward = false;
      touchLeft = false;
      touchRight = false;
      touchSprint = false;
    };

    joystickArea.addEventListener('touchstart', (e) => {
      if (e.changedTouches.length > 0 && joystickTouchId === null) {
        const t = e.changedTouches[0];
        joystickTouchId = t.identifier;
        handleJoystickMove(t.clientX, t.clientY);
      }
    });

    window.addEventListener('touchmove', (e) => {
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        if (t.identifier === joystickTouchId) {
          handleJoystickMove(t.clientX, t.clientY);
        } else if (t.identifier === cameraTouchId) {
          e.preventDefault();
          const dx = t.clientX - cameraLastX;
          const dy = t.clientY - cameraLastY;
          cameraLastX = t.clientX;
          cameraLastY = t.clientY;
          mouseX += dx * 2.2;
          mouseY += dy * 2.2;
        }
      }
    }, { passive: false });

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joystickTouchId) resetJoystick();
        if (t.identifier === cameraTouchId) cameraTouchId = null;
      }
    };

    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    // Setup Camera Aim Drag Zone (Right half of screen)
    window.addEventListener('touchstart', (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (
          t.identifier !== joystickTouchId &&
          cameraTouchId === null &&
          t.clientX > window.innerWidth * 0.35
        ) {
          const target = t.target as HTMLElement;
          if (target && target.tagName === 'BUTTON') continue;
          cameraTouchId = t.identifier;
          cameraLastX = t.clientX;
          cameraLastY = t.clientY;
        }
      }
    });

    // Touch Button Handlers
    const btnFire = touchOverlay.querySelector('#tb-fire') as HTMLButtonElement;
    btnFire.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchFirePressed = true;
    });
    btnFire.addEventListener('touchend', (e) => {
      e.preventDefault();
      touchFirePressed = false;
    });

    const btnAim = touchOverlay.querySelector('#tb-aim') as HTMLButtonElement;
    btnAim.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchAimPressed = !touchAimPressed;
      btnAim.style.background = touchAimPressed ? 'rgba(0,255,200,0.85)' : 'rgba(50,150,255,0.6)';
    });

    const btnJump = touchOverlay.querySelector('#tb-jump') as HTMLButtonElement;
    btnJump.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchJumpOnce = true;
    });

    const btnSkill = touchOverlay.querySelector('#tb-skill') as HTMLButtonElement;
    btnSkill.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchSkillOnce = true;
    });

    const btnReload = touchOverlay.querySelector('#tb-reload') as HTMLButtonElement;
    btnReload.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchReloadOnce = true;
    });

    (touchOverlay.querySelector('#tb-w1') as HTMLButtonElement).addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        touchW1 = true;
      }
    );
    (touchOverlay.querySelector('#tb-w2') as HTMLButtonElement).addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        touchW2 = true;
      }
    );
    (touchOverlay.querySelector('#tb-w3') as HTMLButtonElement).addEventListener(
      'touchstart',
      (e) => {
        e.preventDefault();
        touchW3 = true;
      }
    );
  }

  if (isTouchDeviceFlag) {
    mountTouchUI();
  } else {
    // Dynamic mount if touchstart occurs
    const onFirstTouch = () => {
      mountTouchUI();
      window.removeEventListener('touchstart', onFirstTouch);
    };
    window.addEventListener('touchstart', onFirstTouch);
  }

  function getInput(): PlayerInput {
    const input: PlayerInput = {
      forward: keys.has('KeyW') || keys.has('ArrowUp') || touchForward,
      backward: keys.has('KeyS') || keys.has('ArrowDown') || touchBackward,
      left: keys.has('KeyA') || keys.has('ArrowLeft') || touchLeft,
      right: keys.has('KeyD') || keys.has('ArrowRight') || touchRight,
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprint,
      crouch: keys.has('ControlLeft') || keys.has('ControlRight'),
      jump: keys.has('Space') || jumpOnce || touchJumpOnce,
      aim: aimPressed || touchAimPressed,
      fire: firePressed || touchFirePressed,
      reload: reloadOnce || touchReloadOnce,
      skill: skillOnce || touchSkillOnce,
      weapon1: w1 || touchW1,
      weapon2: w2 || touchW2,
      weapon3: w3 || touchW3,
      mouseX,
      mouseY,
    };

    mouseX = 0;
    mouseY = 0;
    reloadOnce = false;
    skillOnce = false;
    jumpOnce = false;
    w1 = false;
    w2 = false;
    w3 = false;

    touchJumpOnce = false;
    touchReloadOnce = false;
    touchSkillOnce = false;
    touchW1 = false;
    touchW2 = false;
    touchW3 = false;

    return input;
  }

  return {
    getInput,
    dispose: () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (!isTouchDeviceFlag) canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('click', onCanvasClick);
      if (touchOverlay) {
        touchOverlay.remove();
        touchOverlay = null;
      }
    },
  };
}
