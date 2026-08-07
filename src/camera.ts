import * as THREE from 'three';

const TPS_DISTANCE = 5.2;
const TPS_HEIGHT = 2.2;
const FPS_OFFSET = new THREE.Vector3(0, 0.3, 0);
const SHOULDER_OFFSET = new THREE.Vector3(0.55, 0, 0);

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
  const lerpFactor = options?.snapPosition ? 1 : 1 - Math.pow(0.01, dt);

  if (cameraMode === 'fps') {
    const targetPos = playerPos.clone().add(FPS_OFFSET);
    targetPos.y = eyeHeight;
    camera.position.lerp(targetPos, lerpFactor);

    const euler = new THREE.Euler(playerPitch, playerYaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
  } else {
    const behind = new THREE.Vector3(
      Math.sin(playerYaw) * TPS_DISTANCE,
      TPS_HEIGHT,
      Math.cos(playerYaw) * TPS_DISTANCE
    );
    const shoulder = new THREE.Vector3(
      -Math.cos(playerYaw) * SHOULDER_OFFSET.x,
      0,
      Math.sin(playerYaw) * SHOULDER_OFFSET.x
    );

    const targetPos = playerPos.clone().add(behind).add(shoulder);
    targetPos.y = eyeHeight + TPS_HEIGHT;
    camera.position.lerp(targetPos, lerpFactor);

    const lookTarget = playerPos.clone();
    lookTarget.y = eyeHeight;
    camera.lookAt(lookTarget);
  }
}
