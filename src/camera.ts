import * as THREE from 'three';

/** BGMI-style over-shoulder third person. */
export const CAMERA_FOV_TPS = 80;
/** Competitive first-person field of view. */
export const CAMERA_FOV_FPS = 92;

const TPS_DISTANCE = 4.35;
const TPS_BASE_HEIGHT = 1.7;
const SHOULDER_OFFSET = 0.5;
const FPS_EYE_FORWARD = 0.12;
const LOOK_AHEAD = 14;

const _aimDir = new THREE.Vector3();
const _behind = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _targetQuat = new THREE.Quaternion();

/** World-space look direction from yaw + pitch (matches player aim). */
export function aimDirection(yaw: number, pitch: number, out = _aimDir): THREE.Vector3 {
  const cosPitch = Math.cos(pitch);
  out.set(-Math.sin(yaw) * cosPitch, Math.sin(pitch), -Math.cos(yaw) * cosPitch);
  return out;
}

export function updateCamera(
  camera: THREE.PerspectiveCamera,
  playerYaw: number,
  playerPitch: number,
  eyeHeight: number,
  cameraMode: 'tps' | 'fps',
  playerPos: THREE.Vector3,
  dt: number,
  options?: { snapPosition?: boolean }
) {
  const lerpFactor = options?.snapPosition ? 1 : 1 - Math.pow(0.0015, dt);
  const targetFov = cameraMode === 'fps' ? CAMERA_FOV_FPS : CAMERA_FOV_TPS;
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, Math.min(1, lerpFactor * 1.4));
    camera.updateProjectionMatrix();
  }

  const eyeY = eyeHeight;
  aimDirection(playerYaw, playerPitch, _aimDir);
  _lookTarget.set(playerPos.x, eyeY, playerPos.z).addScaledVector(_aimDir, LOOK_AHEAD);

  if (cameraMode === 'fps') {
    _targetPos.set(playerPos.x, eyeY, playerPos.z).addScaledVector(_aimDir, FPS_EYE_FORWARD);
    camera.position.lerp(_targetPos, lerpFactor);

    _targetQuat.setFromEuler(new THREE.Euler(playerPitch, playerYaw, 0, 'YXZ'));
    if (lerpFactor >= 0.98) camera.quaternion.copy(_targetQuat);
    else camera.quaternion.slerp(_targetQuat, lerpFactor);
    return;
  }

  const pitchOrbit = THREE.MathUtils.clamp(playerPitch, -0.85, 1.05);
  const horizontalDist = TPS_DISTANCE * (0.88 + Math.cos(pitchOrbit) * 0.12);
  const lift = TPS_BASE_HEIGHT + Math.sin(-pitchOrbit) * 1.35;

  _behind.set(
    Math.sin(playerYaw) * horizontalDist,
    lift,
    Math.cos(playerYaw) * horizontalDist
  );
  _shoulder.set(
    -Math.cos(playerYaw) * SHOULDER_OFFSET,
    0.12,
    Math.sin(playerYaw) * SHOULDER_OFFSET
  );

  _targetPos.set(playerPos.x, eyeY, playerPos.z).add(_behind).add(_shoulder);
  camera.position.lerp(_targetPos, lerpFactor);
  camera.lookAt(_lookTarget);
}
