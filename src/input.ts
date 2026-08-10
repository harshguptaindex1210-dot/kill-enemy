import type { PlayerInput } from './player';
import type { Settings } from './settings';
import { applyHudChrome } from './hud';
import { isPhoneDevice, safeRequestPointerLock } from './platform';
import { shouldUseMouseLook, touchDragToLookDelta, TOUCH_LOOK_SCALE } from './touchLook';

type TouchRuntimeSettings = Pick<
  Settings,
  | 'invertLookHorizontal'
  | 'invertLookVertical'
  | 'leftFireButton'
  | 'touchSprintMode'
  | 'touchButtonPreset'
  | 'touchLayoutPreset'
  | 'hudOpacity'
  | 'hudScale'
>;

export interface InputManagerOptions {
  /** Legacy compatibility toggle. */
  getInvertLookHorizontal?: () => boolean;
  /** Legacy compatibility callback. */
  onInvertLookHorizontalChange?: (invert: boolean) => void;
  /** Live touch-settings view so runtime changes apply immediately. */
  getTouchSettings?: () => TouchRuntimeSettings;
  /** Persist touch setting changes from in-match controls. */
  onTouchSettingsChange?: (changes: Partial<TouchRuntimeSettings>) => void;
  /** Full settings for in-match mobile gear panel. */
  getSettings?: () => Settings;
  /** Persist any setting change from the mobile gear panel. */
  onSettingsChange?: (changes: Partial<Settings>) => void;
  showRespawn?: () => boolean;
  onRespawn?: () => void;
}

export interface InputManager {
  getInput: () => PlayerInput;
  dispose: () => void;
}

export function createInputManager(
  canvas: HTMLCanvasElement,
  options: InputManagerOptions = {}
): InputManager {
  const keys: Set<string> = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let firePressed = false;
  let aimPressed = false;
  let reloadOnce = false;
  let skillOnce = false;
  let healOnce = false;
  let jumpOnce = false;
  let desktopJumpLatchUntil = 0;
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
  let touchJumpHeld = false;
  let touchJumpLatchUntil = 0;
  let touchReloadOnce = false;
  let touchSkillOnce = false;
  let touchHealOnce = false;
  let touchW1 = false;
  let touchW2 = false;
  let touchW3 = false;
  let touchLookActive = false;
  let lastTouchLookAtMs = Number.NEGATIVE_INFINITY;

  const isPhoneFlag = isPhoneDevice();

  const blockGameKeys = (e: KeyboardEvent) => {
    if (
      e.code === 'Space' ||
      e.code === 'ArrowUp' ||
      e.code === 'ArrowDown' ||
      e.code === 'ArrowLeft' ||
      e.code === 'ArrowRight' ||
      e.code.startsWith('Key')
    ) {
      e.preventDefault();
    }
  };

  // Keyboard listeners
  const onKeyDown = (e: KeyboardEvent) => {
    blockGameKeys(e);
    keys.add(e.code);
    if (e.code === 'KeyR') reloadOnce = true;
    if (e.code === 'KeyF') skillOnce = true;
    if (e.code === 'KeyH') healOnce = true;
    if (e.code === 'Space') {
      jumpOnce = true;
      desktopJumpLatchUntil = Date.now() + 900;
    }
    if (e.code === 'Digit1') w1 = true;
    if (e.code === 'Digit2') w2 = true;
    if (e.code === 'Digit3') w3 = true;
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);

  const onMouseMove = (e: MouseEvent) => {
    if (!shouldUseMouseLook(Date.now(), lastTouchLookAtMs, touchLookActive)) return;
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
      keys.delete('KeyW');
      keys.delete('KeyS');
      keys.delete('KeyA');
      keys.delete('KeyD');
      keys.delete('ArrowUp');
      keys.delete('ArrowDown');
      keys.delete('ArrowLeft');
      keys.delete('ArrowRight');
      keys.delete('ShiftLeft');
      keys.delete('ShiftRight');
      keys.delete('ControlLeft');
      keys.delete('ControlRight');
      firePressed = false;
      aimPressed = false;
    }
  };

  const onCanvasClick = () => {
    if (!isPhoneFlag && !document.pointerLockElement) {
      safeRequestPointerLock(canvas);
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  if (!isPhoneFlag) canvas.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onPointerLockChange);
  canvas.addEventListener('click', onCanvasClick);

  // Mobile Touch Controls UI
  let touchOverlay: HTMLDivElement | null = null;
  let cameraTouchId: number | null = null;
  let cameraLastX = 0;
  let cameraLastY = 0;
  let touchMoveHandler: ((e: TouchEvent) => void) | null = null;
  let touchEndHandler: ((e: TouchEvent) => void) | null = null;
  let touchStartHandler: ((e: TouchEvent) => void) | null = null;
  let firstTouchHandler: (() => void) | null = null;
  let lastTouchUiSignature = '';
  let touchRespawnBtn: HTMLButtonElement | null = null;

  const touchDefaults: TouchRuntimeSettings = {
    invertLookHorizontal: false,
    invertLookVertical: false,
    leftFireButton: true,
    touchSprintMode: 'auto',
    touchButtonPreset: 'standard',
    touchLayoutPreset: 'thumbs',
    hudOpacity: 0.78,
    hudScale: 1.06,
  };

  const resolveTouchSettings = (): TouchRuntimeSettings => {
    const legacyInvert = options.getInvertLookHorizontal?.() === true;
    const fromSettings = options.getTouchSettings?.();
    return {
      ...touchDefaults,
      ...fromSettings,
      invertLookHorizontal: fromSettings?.invertLookHorizontal ?? legacyInvert,
    };
  };

  const applyTouchUiSettings = () => {
    if (!touchOverlay) return;
    if (options.showRespawn) {
      touchRespawnBtn?.classList.toggle('is-visible', options.showRespawn());
    }
    const touchSettings = resolveTouchSettings();
    const signature = JSON.stringify(touchSettings);
    if (signature === lastTouchUiSignature) return;
    lastTouchUiSignature = signature;

    const joystickArea = touchOverlay.querySelector(
      '#touch-joystick-area'
    ) as HTMLDivElement | null;
    const joystickKnob = touchOverlay.querySelector(
      '#touch-joystick-knob'
    ) as HTMLDivElement | null;
    const actionsArea = touchOverlay.querySelector('#touch-actions-area') as HTMLDivElement | null;
    const weaponsArea = touchOverlay.querySelector('#touch-weapons-area') as HTMLDivElement | null;
    const leftFire = touchOverlay.querySelector('#tb-fire-left') as HTMLButtonElement | null;
    const actionButtons = touchOverlay.querySelectorAll(
      '#tb-heal,#tb-skill,#tb-jump,#tb-reload,#tb-aim,#tb-fire,#tb-fire-left'
    );

    const compact = touchSettings.touchButtonPreset === 'compact';
    const thumbsLayout = touchSettings.touchLayoutPreset === 'thumbs';
    const scale = Math.min(1.3, Math.max(0.8, touchSettings.hudScale));
    const opacity = Math.min(1, Math.max(0.35, touchSettings.hudOpacity));

    if (joystickArea) {
      joystickArea.style.width = `${Math.round((compact ? 110 : 126) * scale)}px`;
      joystickArea.style.height = joystickArea.style.width;
      joystickArea.style.left = thumbsLayout ? '18px' : '30px';
      joystickArea.style.bottom = thumbsLayout ? '18px' : '30px';
    }
    if (joystickKnob) {
      const knob = Math.round((compact ? 44 : 50) * scale);
      joystickKnob.style.width = `${knob}px`;
      joystickKnob.style.height = `${knob}px`;
      joystickKnob.style.marginLeft = `${Math.round(-knob / 2)}px`;
      joystickKnob.style.marginTop = `${Math.round(-knob / 2)}px`;
    }
    if (actionsArea) {
      actionsArea.style.right = thumbsLayout ? '14px' : '20px';
      actionsArea.style.bottom = thumbsLayout ? '14px' : '30px';
      actionsArea.style.gap = compact ? '9px' : '12px';
    }
    if (weaponsArea) {
      weaponsArea.style.top = thumbsLayout ? '84px' : '100px';
      weaponsArea.style.right = thumbsLayout ? '14px' : '15px';
      weaponsArea.style.gap = compact ? '4px' : '6px';
    }
    if (leftFire) {
      leftFire.style.display = touchSettings.leftFireButton ? 'flex' : 'none';
      leftFire.style.left = thumbsLayout ? '14px' : '22px';
      leftFire.style.bottom = thumbsLayout ? '144px' : '170px';
    }

    const actionSize = Math.round((compact ? 46 : 52) * scale);
    const fireSize = Math.round((compact ? 66 : 74) * scale);
    actionButtons.forEach((btn) => {
      const el = btn as HTMLButtonElement;
      const isFire = el.id === 'tb-fire' || el.id === 'tb-fire-left';
      const size = isFire ? fireSize : actionSize;
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.fontSize = `${Math.round(isFire ? size * 0.36 : size * 0.34)}px`;
    });

    touchOverlay.style.opacity = String(opacity);
    applyHudChrome({ hudOpacity: opacity, hudScale: scale });
    const minimap = document.getElementById('minimap');
    if (minimap) minimap.style.opacity = String(Math.min(1, opacity + 0.06));
  };

  function mountTouchUI() {
    if (touchOverlay) return;

    touchOverlay = document.createElement('div');
    touchOverlay.id = 'touch-controls-overlay';
    touchOverlay.style.cssText =
      'position:fixed;inset:0;pointer-events:none;z-index:10010;user-select:none;-webkit-user-select:none;touch-action:none;';

    touchOverlay.innerHTML = `<div id="touch-joystick-area"><div id="touch-joystick-knob"></div></div><button id="tb-fire-left" type="button">🔥</button><button id="tb-rs">RESPAWN</button><div id="touch-actions-area"><div><button id="tb-heal" type="button">HEAL</button><button id="tb-skill" type="button">⚡</button><button id="tb-jump" type="button">⬆</button></div><div><button id="tb-reload" type="button">↻</button><button id="tb-aim" type="button">🎯</button><button id="tb-fire" type="button">🔥</button></div></div><div id="touch-weapons-area"><button id="tb-w1" type="button">R1</button><button id="tb-w2" type="button">P2</button><button id="tb-w3" type="button">M3</button></div>`;

    document.body.appendChild(touchOverlay);
    const setStyle = (id: string, css: string) => {
      const el = touchOverlay!.querySelector(id) as HTMLElement | null;
      if (el) el.style.cssText = css;
    };
    setStyle(
      '#touch-joystick-area',
      'position:absolute;bottom:30px;left:30px;width:126px;height:126px;border-radius:50%;background:rgba(8,12,16,.55);border:2px solid rgba(201,168,96,.35);pointer-events:auto;touch-action:none;'
    );
    setStyle(
      '#touch-joystick-knob',
      'position:absolute;top:50%;left:50%;width:50px;height:50px;margin-top:-25px;margin-left:-25px;border-radius:50%;background:rgba(201,168,96,.75);box-shadow:0 0 10px rgba(232,200,120,.35);pointer-events:none;'
    );
    setStyle(
      '#touch-actions-area',
      'position:absolute;bottom:30px;right:20px;display:flex;flex-direction:column;gap:12px;align-items:flex-end;pointer-events:auto;touch-action:none;'
    );
    touchOverlay.querySelectorAll('#touch-actions-area > div').forEach((el) => {
      (el as HTMLElement).style.cssText = 'display:flex;gap:10px;align-items:center;';
    });
    setStyle(
      '#touch-weapons-area',
      'position:absolute;top:100px;right:15px;display:flex;gap:6px;pointer-events:auto;touch-action:none;'
    );
    const paintRoundBtn = (id: string, bg: string, border = '2px solid #fff') => {
      setStyle(
        id,
        `width:52px;height:52px;border-radius:50%;background:${bg};border:${border};color:#fff;font-size:20px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.5);`
      );
    };
    paintRoundBtn('#tb-heal', 'rgba(16,120,72,.88)', '2px solid #c9a860');
    paintRoundBtn('#tb-skill', 'rgba(42,58,48,.85)', '2px solid rgba(201,168,96,.5)');
    paintRoundBtn('#tb-jump', 'rgba(58,72,52,.9)', '2px solid #9cb06e');
    setStyle(
      '#tb-jump',
      `${(touchOverlay.querySelector('#tb-jump') as HTMLElement).style.cssText};pointer-events:auto;touch-action:none;`
    );
    paintRoundBtn('#tb-reload', 'rgba(72,62,40,.88)', '2px solid #c9a860');
    paintRoundBtn('#tb-aim', 'rgba(38,52,64,.9)', '2px solid rgba(140,160,180,.55)');
    paintRoundBtn('#tb-fire', 'rgba(140,48,32,.9)', '2px solid #e8c878');
    paintRoundBtn('#tb-fire-left', 'rgba(140,48,32,.88)', '2px solid #e8c878');
    setStyle(
      '#tb-heal',
      `${(touchOverlay.querySelector('#tb-heal') as HTMLElement).style.cssText};font-size:11px;letter-spacing:.02em;`
    );
    setStyle(
      '#tb-fire-left',
      `${(touchOverlay.querySelector('#tb-fire-left') as HTMLElement).style.cssText};position:absolute;left:22px;bottom:170px;pointer-events:auto;touch-action:none;box-shadow:0 4px 12px rgba(255,0,0,.6);`
    );
    setStyle(
      '#tb-fire',
      `${(touchOverlay.querySelector('#tb-fire') as HTMLElement).style.cssText};box-shadow:0 4px 12px rgba(255,0,0,.6);`
    );
    touchOverlay.querySelectorAll('#touch-weapons-area button').forEach((el) => {
      (el as HTMLElement).style.cssText =
        'padding:6px 12px;background:rgba(0,0,0,.6);border-radius:4px;font-size:12px;font-weight:bold;';
    });
    setStyle(
      '#tb-w1',
      `${(touchOverlay.querySelector('#tb-w1') as HTMLElement).style.cssText};border:1px solid #4af;color:#4af;`
    );
    setStyle(
      '#tb-w2',
      `${(touchOverlay.querySelector('#tb-w2') as HTMLElement).style.cssText};border:1px solid #fa0;color:#fa0;`
    );
    setStyle(
      '#tb-w3',
      `${(touchOverlay.querySelector('#tb-w3') as HTMLElement).style.cssText};border:1px solid #aaa;color:#aaa;`
    );
    applyTouchUiSettings();

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
      const normMag = dist / maxRadius;
      const touchSettings = resolveTouchSettings();
      const autoSprint = touchSettings.touchSprintMode === 'auto';

      // right = +normX (screen right). Must match joystickNormToMoveFlags in tests.
      touchForward = normY < -0.25;
      touchBackward = normY > 0.25;
      touchLeft = normX < -0.25;
      touchRight = normX > 0.25;
      touchSprint = autoSprint ? normY < -0.45 && normMag > 0.55 : normMag > 0.8;
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

    touchMoveHandler = (e: TouchEvent) => {
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
          touchLookActive = true;
          lastTouchLookAtMs = Date.now();
          const touchSettings = resolveTouchSettings();
          const look = touchDragToLookDelta(
            dx,
            dy,
            TOUCH_LOOK_SCALE,
            touchSettings.invertLookHorizontal,
            touchSettings.invertLookVertical
          );
          mouseX += look.mouseX;
          mouseY += look.mouseY;
        }
      }
    };
    window.addEventListener('touchmove', touchMoveHandler, { passive: false });

    touchEndHandler = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (t.identifier === joystickTouchId) resetJoystick();
        if (t.identifier === cameraTouchId) {
          cameraTouchId = null;
          touchLookActive = false;
          lastTouchLookAtMs = Date.now();
        }
      }
    };

    window.addEventListener('touchend', touchEndHandler);
    window.addEventListener('touchcancel', touchEndHandler);

    // Setup Camera Aim Drag Zone (Right half of screen)
    touchStartHandler = (e: TouchEvent) => {
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
          touchLookActive = true;
          lastTouchLookAtMs = Date.now();
        }
      }
    };
    window.addEventListener('touchstart', touchStartHandler);

    // Touch Button Handlers
    const bindFireButton = (id: string) => {
      const btn = touchOverlay!.querySelector(id) as HTMLButtonElement;
      const down = (e: Event) => {
        e.preventDefault();
        touchFirePressed = true;
      };
      const up = (e: Event) => {
        e.preventDefault();
        touchFirePressed = false;
      };
      btn.addEventListener('touchstart', down);
      btn.addEventListener('touchend', up);
      btn.addEventListener('touchcancel', up);
      btn.addEventListener('mousedown', down);
      btn.addEventListener('mouseup', up);
      btn.addEventListener('mouseleave', up);
    };
    bindFireButton('#tb-fire');
    bindFireButton('#tb-fire-left');

    const btnAim = touchOverlay.querySelector('#tb-aim') as HTMLButtonElement;
    btnAim.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchAimPressed = !touchAimPressed;
      btnAim.style.background = touchAimPressed ? 'rgba(0,255,200,0.85)' : 'rgba(50,150,255,0.6)';
    });

    const btnJump = touchOverlay.querySelector('#tb-jump') as HTMLButtonElement;
    const armJump = (e: Event) => {
      e.preventDefault();
      touchJumpHeld = true;
      touchJumpLatchUntil = Date.now() + 900;
    };
    const releaseJump = (e: Event) => {
      e.preventDefault();
      touchJumpHeld = false;
    };
    btnJump.addEventListener('touchstart', armJump, { passive: false });
    btnJump.addEventListener('pointerdown', armJump);
    btnJump.addEventListener('click', armJump);
    btnJump.addEventListener('touchend', releaseJump);
    btnJump.addEventListener('touchcancel', releaseJump);
    btnJump.addEventListener('pointerup', releaseJump);
    btnJump.addEventListener('pointerleave', releaseJump);

    if (options.onRespawn) {
      touchRespawnBtn = touchOverlay.querySelector('#tb-rs') as HTMLButtonElement;
      touchRespawnBtn.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          options.onRespawn!();
        },
        { passive: false }
      );
    }

    const btnSkill = touchOverlay.querySelector('#tb-skill') as HTMLButtonElement;
    btnSkill.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchSkillOnce = true;
    });

    const btnHeal = touchOverlay.querySelector('#tb-heal') as HTMLButtonElement;
    btnHeal.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchHealOnce = true;
    });
    btnHeal.addEventListener('click', (e) => {
      e.preventDefault();
      touchHealOnce = true;
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

    if (options.getSettings && options.onSettingsChange) {
      const gear = document.createElement('button');
      gear.id = 'tb-settings-gear';
      gear.type = 'button';
      gear.setAttribute('aria-label', 'Settings');
      gear.className = 'touch-settings-gear';
      gear.textContent = '⚙';
      const openSettings = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        void import('./mobileSettingsPanel').then(({ openMobileSettingsPanel }) => {
          openMobileSettingsPanel({
            getSettings: options.getSettings!,
            onChange: (changes) => {
              options.onSettingsChange?.(changes);
              options.onTouchSettingsChange?.(changes as Partial<TouchRuntimeSettings>);
            },
          });
        });
      };
      gear.addEventListener('touchstart', openSettings, { passive: false });
      gear.addEventListener('click', openSettings);
      touchOverlay.appendChild(gear);
    }
  }

  if (isPhoneFlag) {
    mountTouchUI();
  } else {
    // Dynamic mount if touchstart occurs on a phone-class device only
    firstTouchHandler = () => {
      if (!isPhoneDevice()) return;
      mountTouchUI();
      if (firstTouchHandler) {
        window.removeEventListener('touchstart', firstTouchHandler);
        firstTouchHandler = null;
      }
    };
    window.addEventListener('touchstart', firstTouchHandler);
  }

  function getInput(): PlayerInput {
    if (touchOverlay) applyTouchUiSettings();
    const touchJump = touchJumpHeld || Date.now() < touchJumpLatchUntil;
    const desktopJump = Date.now() < desktopJumpLatchUntil;
    const input: PlayerInput = {
      forward: keys.has('KeyW') || keys.has('ArrowUp') || touchForward,
      backward: keys.has('KeyS') || keys.has('ArrowDown') || touchBackward,
      left: keys.has('KeyA') || keys.has('ArrowLeft') || touchLeft,
      right: keys.has('KeyD') || keys.has('ArrowRight') || touchRight,
      sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || touchSprint,
      crouch: keys.has('ControlLeft') || keys.has('ControlRight'),
      jump: keys.has('Space') || jumpOnce || touchJump || desktopJump,
      aim: aimPressed || touchAimPressed,
      fire: firePressed || touchFirePressed,
      reload: reloadOnce || touchReloadOnce,
      skill: skillOnce || touchSkillOnce,
      heal: healOnce || touchHealOnce,
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
    healOnce = false;
    jumpOnce = false;
    w1 = false;
    w2 = false;
    w3 = false;

    touchReloadOnce = false;
    touchSkillOnce = false;
    touchHealOnce = false;
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
      if (!isPhoneFlag) canvas.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      canvas.removeEventListener('click', onCanvasClick);
      if (touchMoveHandler) {
        window.removeEventListener('touchmove', touchMoveHandler);
        touchMoveHandler = null;
      }
      if (touchEndHandler) {
        window.removeEventListener('touchend', touchEndHandler);
        window.removeEventListener('touchcancel', touchEndHandler);
        touchEndHandler = null;
      }
      if (touchStartHandler) {
        window.removeEventListener('touchstart', touchStartHandler);
        touchStartHandler = null;
      }
      if (firstTouchHandler) {
        window.removeEventListener('touchstart', firstTouchHandler);
        firstTouchHandler = null;
      }
      if (touchOverlay) {
        touchOverlay.remove();
        touchOverlay = null;
      }
    },
  };
}
