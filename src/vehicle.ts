import * as THREE from 'three';

export type VehicleType = 'sedan' | 'buggy' | 'motorbike';

export interface VehicleState {
  type: VehicleType;
  position: THREE.Vector3;
  rotation: number;
  speed: number;
  health: number;
  occupied: boolean;
}

const VEHICLE_DEFS = {
  sedan: { maxSpeed: 30, accel: 15, brake: 25, turnSpeed: 1.5, health: 200 },
  buggy: { maxSpeed: 40, accel: 20, brake: 20, turnSpeed: 2.0, health: 150 },
  motorbike: { maxSpeed: 50, accel: 25, brake: 25, turnSpeed: 2.5, health: 100 },
};

export interface CreateVehicleOptions {
  /** Client-only cosmetic tint for sedan/buggy body (local match view). */
  bodyColor?: number;
}

export function createVehicle(
  type: VehicleType,
  pos: THREE.Vector3,
  opts?: CreateVehicleOptions
): { state: VehicleState; mesh: THREE.Group } {
  const def = VEHICLE_DEFS[type];
  const state: VehicleState = {
    type,
    position: pos.clone(),
    rotation: 0,
    speed: 0,
    health: def.health,
    occupied: false,
  };

  const group = new THREE.Group();
  group.position.copy(pos);

  const sedanColors = [0xe63946, 0x457b9d, 0xf4a261, 0x2a9d8f];
  const buggyColors = [0x80b918, 0xffb703, 0xfb8500, 0x219ebc];
  const bikeColors = [0x3a86ef, 0xff006e, 0x8338ec, 0xffbe0b];
  const bodyColor =
    opts?.bodyColor ??
    (type === 'sedan'
      ? sedanColors[Math.abs(Math.floor(pos.x)) % sedanColors.length]!
      : type === 'buggy'
        ? buggyColors[Math.abs(Math.floor(pos.z)) % buggyColors.length]!
        : bikeColors[Math.abs(Math.floor(pos.x + pos.z)) % bikeColors.length]!);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    metalness: 0.5,
    roughness: 0.3,
  });

  if (type === 'motorbike') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 2.2), bodyMat);
    body.position.y = 0.6;
    group.add(body);

    const handleMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), handleMat);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0, 0.9, 0.6);
    group.add(handle);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (const wz of [0.8, -0.8]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.15, 8), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.35, wz);
      group.add(wheel);
    }
  } else {
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 4), bodyMat);
    body.position.y = 0.5;
    group.add(body);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    for (let i = 0; i < 4; i++) {
      const wx = (i % 2 === 0 ? -1 : 1) * 1.1;
      const wz = i < 2 ? -1.3 : 1.3;
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 8), wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.3, wz * 1.5);
      group.add(wheel);
    }
  }

  return { state, mesh: group };
}

export function updateVehicle(
  vehicle: VehicleState,
  throttle: number,
  steer: number,
  dt: number,
  groundY: number
) {
  const def = VEHICLE_DEFS[vehicle.type];
  if (throttle > 0) {
    vehicle.speed = Math.min(vehicle.speed + def.accel * dt, def.maxSpeed);
  } else if (throttle < 0) {
    vehicle.speed = Math.max(vehicle.speed - def.brake * dt, -def.maxSpeed * 0.3);
  } else {
    vehicle.speed *= 0.98;
    if (Math.abs(vehicle.speed) < 0.1) vehicle.speed = 0;
  }

  const speedSign = vehicle.speed === 0 ? 1 : Math.sign(vehicle.speed);
  vehicle.rotation +=
    steer * def.turnSpeed * dt * (Math.abs(vehicle.speed) / def.maxSpeed) * speedSign;

  // Match player yaw convention: rotation 0 faces -Z (see player.ts forwardVec).
  vehicle.position.x -= Math.sin(vehicle.rotation) * vehicle.speed * dt;
  vehicle.position.z -= Math.cos(vehicle.rotation) * vehicle.speed * dt;
  vehicle.position.y = groundY + 0.5;
}

/** Local-space seat offset (x right, y up, z forward along vehicle facing). */
export function seatOffsetForVehicle(type: VehicleType): { x: number; y: number; z: number } {
  if (type === 'motorbike') return { x: 0, y: 0.45, z: -0.15 };
  // sedan / buggy — slightly left of center, above floor
  return { x: -0.4, y: 0.35, z: 0.2 };
}

/** World pose for a visible rider on an occupied vehicle. */
export function riderWorldPose(
  type: VehicleType,
  vehiclePos: THREE.Vector3,
  vehicleRotation: number
): { position: THREE.Vector3; yaw: number } {
  const seat = seatOffsetForVehicle(type);
  const forward = new THREE.Vector3(-Math.sin(vehicleRotation), 0, -Math.cos(vehicleRotation));
  const right = new THREE.Vector3(-Math.cos(vehicleRotation), 0, Math.sin(vehicleRotation));
  const position = vehiclePos
    .clone()
    .add(right.multiplyScalar(seat.x))
    .add(new THREE.Vector3(0, seat.y, 0))
    .add(forward.multiplyScalar(seat.z));
  return { position, yaw: vehicleRotation };
}

/** Alive units stay drawn on foot and while mounted (bike/car). */
export function shouldShowUnitRig(alive: boolean): boolean {
  return alive;
}

export function findNearbyVehicle(
  vehicles: { state: VehicleState; mesh: THREE.Group }[],
  pos: THREE.Vector3,
  range: number = 3
): (typeof vehicles)[0] | null {
  for (const v of vehicles) {
    if (v.state.occupied) continue;
    if (v.state.position.distanceTo(pos) <= range) return v;
  }
  return null;
}
