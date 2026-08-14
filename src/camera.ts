import * as THREE from 'three';

/** BGMI-style over-shoulder third person. */
export const CAMERA_FOV_TPS = 70;
/** Hold-ADS zoom (tighter than hip-fire). */
export const CAMERA_FOV_FPS = 56;

const TPS_DISTANCE = 4.05;
const TPS_ADS_DISTANCE = 2.2;
const TPS_BASE_HEIGHT = 1.7;
const SHOULDER_OFFSET = 0.5;
const LOOK_AHEAD = 14;

const _aimDir = new THREE.Vector3();
const _behind = new THREE.Vector3();
const _shoulder = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

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
    const adsDist = TPS_ADS_DISTANCE;
    const pitchOrbit = THREE.MathUtils.clamp(playerPitch, -0.85, 1.05);
    _behind.set(
      Math.sin(playerYaw) * adsDist * 0.92,
      TPS_BASE_HEIGHT * 0.55 + Math.sin(-pitchOrbit) * 0.45,
      Math.cos(playerYaw) * adsDist * 0.92
    );
    _shoulder.set(-Math.cos(playerYaw) * 0.28, 0.08, Math.sin(playerYaw) * 0.28);
    _targetPos.set(playerPos.x, eyeY, playerPos.z).add(_behind).add(_shoulder);
    camera.position.lerp(_targetPos, lerpFactor);
    camera.lookAt(_lookTarget);
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
