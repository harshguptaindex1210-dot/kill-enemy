import * as THREE from 'three';

export type PlayerState = 'stand' | 'crouch' | 'sprint' | 'jump';
export type CameraMode = 'tps' | 'fps';

export interface PlayerInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  crouch: boolean;
  glooWall?: boolean;
  jump: boolean;
  aim: boolean;
  fire: boolean;
  reload: boolean;
  skill?: boolean;
  /** One-shot med-kit use (KeyH / touch Heal). */
  heal?: boolean;
  weapon1: boolean;
  weapon2: boolean;
  weapon3: boolean;
  mouseX: number;
  mouseY: number;
}

export interface PlayerBundle {
  mesh: THREE.Mesh;
  capsule: THREE.Mesh;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  state: PlayerState;
  cameraMode: CameraMode;
  health: number;
  yaw: number;
  pitch: number;
  update: (input: PlayerInput, dt: number, groundY: number, speedMult?: number) => void;
  getEyeHeight: () => number;
  setFacing: (yaw: number, pitch?: number) => void;
  /** Re-sync ground contact after teleport/respawn. */
  resetGroundContact: (groundY?: number) => void;
}

const STAND_HEIGHT = 1.8;
const CROUCH_HEIGHT = 1.0;
const SPRINT_MULT = 1.5;
const WALK_SPEED = 6;
const CROUCH_SPEED = 2.5;
const JUMP_VELOCITY = 5;
const GRAVITY = -20;
const MOUSE_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI / 2 - 0.01;
const GROUND_EPS = 0.08;
/** Sim ticks to remember a jump press (missed-frame buffer only). */
const JUMP_BUFFER_TICKS = 10;

export function createPlayer(startPos: THREE.Vector3 = new THREE.Vector3(0, 0.9, 0)): PlayerBundle {
  const bundle = {} as PlayerBundle;
  let pState: PlayerState = 'stand';
  let pCameraMode: CameraMode = 'tps';
  let pYaw = 0;
  let pPitch = 0;
  let onGround = startPos.y <= 0.9;
  let pendingJump = 0;
  let prevJumpInput = false;
  let jumpLock = false;

  bundle.velocity = new THREE.Vector3(0, 0, 0);
  bundle.position = startPos.clone();
  bundle.health = 100;

  Object.defineProperties(bundle, {
    state: { get: () => pState },
    cameraMode: { get: () => pCameraMode },
    yaw: { get: () => pYaw },
    pitch: { get: () => pPitch },
  });

  const geo = new THREE.CapsuleGeometry(0.34, 0.72, 6, 10);
  const mat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.55, metalness: 0.08 });
  bundle.capsule = new THREE.Mesh(geo, mat);
  bundle.capsule.position.copy(bundle.position);

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a5240, roughness: 0.82, metalness: 0.04 });
  const bodyGeo = new THREE.BoxGeometry(0.44, 0.5, 0.28);
  bundle.mesh = new THREE.Mesh(bodyGeo, bodyMat);
  bundle.mesh.position.copy(bundle.position);

  const headMat = new THREE.MeshStandardMaterial({ color: 0xc49a6c, roughness: 0.5, metalness: 0.06 });
  const headGeo = new THREE.SphereGeometry(0.14, 8, 8);
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 0.72, 0);
  bundle.mesh.add(head);

  function getHeight(): number {
    return pState === 'crouch' ? CROUCH_HEIGHT : STAND_HEIGHT;
  }

  function getSpeed(): number {
    if (pState === 'crouch') return CROUCH_SPEED;
    if (pState === 'sprint') return WALK_SPEED * SPRINT_MULT;
    return WALK_SPEED;
  }

  bundle.resetGroundContact = (gy = 0) => {
    const height = getHeight();
    const groundLevel = gy + height / 2;
    bundle.position.y = Math.max(bundle.position.y, groundLevel);
    bundle.velocity.set(0, 0, 0);
    onGround = true;
    pState = 'stand';
    pendingJump = 0;
    prevJumpInput = false;
    jumpLock = false;
  };

  bundle.update = (input: PlayerInput, dt: number, groundY: number, speedMult: number = 1.0) => {
    const height = getHeight();
    const speed = getSpeed() * speedMult;
    const groundLevel = groundY + height / 2;
    const standLevel = groundY + STAND_HEIGHT / 2;

    // Coyote-time: standing on the floor but onGround was lost (respawn / float drift).
    if (
      !onGround &&
      pState !== 'crouch' &&
      bundle.velocity.y <= 0 &&
      bundle.position.y <= standLevel + GROUND_EPS
    ) {
      onGround = true;
    }

    if (input.crouch && onGround) {
      pState = 'crouch';
    } else if (!input.crouch && pState === 'crouch' && onGround) {
      pState = 'stand';
    }

    if (input.sprint && pState !== 'crouch' && onGround) {
      pState = 'sprint';
    } else if (!input.sprint && pState === 'sprint' && onGround) {
      pState = 'stand';
    }

    const jumpPressed = input.jump && !prevJumpInput;
    prevJumpInput = input.jump;
    if (jumpPressed) pendingJump = JUMP_BUFFER_TICKS;

    if (pendingJump > 0 && onGround && !jumpLock) {
      bundle.velocity.y = JUMP_VELOCITY;
      pState = 'jump';
      onGround = false;
      pendingJump = 0;
      jumpLock = true;
    } else if (pendingJump > 0 && !onGround) {
      pendingJump--;
    }

    if (!onGround) jumpLock = false;

    if (pState === 'jump' && onGround) {
      pState = 'stand';
    }

    pYaw -= input.mouseX * MOUSE_SENSITIVITY;
    pPitch -= input.mouseY * MOUSE_SENSITIVITY;
    pPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pPitch));

    const forwardVec = new THREE.Vector3(-Math.sin(pYaw), 0, -Math.cos(pYaw));
    // right = forward × up (prior formula was world-left)
    const rightVec = new THREE.Vector3(-forwardVec.z, 0, forwardVec.x);

    const moveDir = new THREE.Vector3(0, 0, 0);
    if (input.forward) moveDir.add(forwardVec);
    if (input.backward) moveDir.sub(forwardVec);
    if (input.left) moveDir.sub(rightVec);
    if (input.right) moveDir.add(rightVec);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
    }

    bundle.velocity.x = moveDir.x * speed;
    bundle.velocity.z = moveDir.z * speed;
    bundle.velocity.y += GRAVITY * dt;

    bundle.position.x += bundle.velocity.x * dt;
    bundle.position.y += bundle.velocity.y * dt;
    bundle.position.z += bundle.velocity.z * dt;

    if (bundle.position.y <= groundLevel) {
      bundle.position.y = groundLevel;
      if (bundle.velocity.y <= 0) {
        bundle.velocity.y = 0;
        onGround = true;
      }
    }

    bundle.capsule.position.copy(bundle.position);
    bundle.capsule.scale.y = height / 1.8;
    bundle.mesh.position.copy(bundle.position);
    bundle.mesh.position.y += height / 2 - 0.3;

    pCameraMode = input.aim ? 'fps' : 'tps';
  };

  bundle.getEyeHeight = () => {
    return bundle.position.y + (pState === 'crouch' ? CROUCH_HEIGHT - 0.2 : STAND_HEIGHT - 0.2);
  };

  bundle.setFacing = (yaw: number, pitch?: number) => {
    pYaw = yaw;
    if (pitch !== undefined) {
      pPitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));
    }
  };

  return bundle;
}
