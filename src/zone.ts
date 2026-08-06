import * as THREE from 'three';
import { MAP_BOUND, ZONE_PHASE_DURATIONS, ZONE_PHASE_DPS, ZONE_PHASE_RADII } from './constants';

export interface ZonePhase {
  radius: number;
  damagePerSec: number;
  duration: number;
  center: THREE.Vector3;
}

const SHRINK_DURATION = 30;
export const ZONE_WARNING_LEAD = 5;

export class ZoneLogic {
  phases: ZonePhase[] = [];
  currentPhase = 0;
  phaseTime = 0;
  totalTime = 0;
  private warnedPhase = -1;

  constructor() {
    this.phases = ZONE_PHASE_RADII.map((radius, i) => ({
      radius,
      damagePerSec: ZONE_PHASE_DPS[i]!,
      duration: ZONE_PHASE_DURATIONS[i]!,
      center: new THREE.Vector3(0, 0, 0),
    }));
  }

  update(dt: number) {
    this.totalTime += dt;
    const phase = this.phases[this.currentPhase];
    if (!phase) return;
    this.phaseTime += dt;
    if (this.phaseTime >= phase.duration && this.currentPhase < this.phases.length - 1) {
      this.currentPhase++;
      this.phaseTime = 0;
    }
  }

  /** Current storm boundary radius. Starts at the map edge and shrinks to the phase target. */
  get currentSafeRadius(): number {
    const phase = this.phases[this.currentPhase];
    if (!phase) return 0;
    const start =
      this.currentPhase === 0
        ? MAP_BOUND
        : Math.max(this.phases[this.currentPhase - 1].radius, phase.radius);
    const t = Math.min(this.phaseTime / SHRINK_DURATION, 1);
    return start + (phase.radius - start) * t;
  }

  get innerRadius(): number {
    return this.currentSafeRadius;
  }

  get damagePerSec(): number {
    const phase = this.phases[this.currentPhase];
    return phase ? phase.damagePerSec : 0;
  }

  get center(): THREE.Vector3 {
    const phase = this.phases[this.currentPhase];
    return phase ? phase.center : new THREE.Vector3(0, 0, 0);
  }

  get phaseTotalDuration(): number {
    return this.phases[this.currentPhase]?.duration ?? 0;
  }

  isOutsideZone(pos: THREE.Vector3): boolean {
    const phase = this.phases[this.currentPhase];
    if (!phase) return false;
    return pos.distanceTo(phase.center) > this.currentSafeRadius;
  }

  /** True once per phase while a shrink is imminent (last ZONE_WARNING_LEAD seconds). */
  get zoneIncoming(): boolean {
    const phase = this.phases[this.currentPhase];
    if (!phase) return false;
    return phase.duration - this.phaseTime <= ZONE_WARNING_LEAD;
  }

  /** Fires zoneIncoming once per phase; used to raise a single warning event. */
  consumeZoneIncoming(): boolean {
    if (this.zoneIncoming && this.warnedPhase !== this.currentPhase) {
      this.warnedPhase = this.currentPhase;
      return true;
    }
    return false;
  }
}

export class ZoneSystem extends ZoneLogic {
  ring: THREE.Mesh;
  ringPos = new THREE.Vector3(0, 50, 0);

  constructor(scene: THREE.Scene) {
    super();
    const geo = new THREE.RingGeometry(ZONE_PHASE_RADII[0], ZONE_PHASE_RADII[0] + 20, 64);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x4488ff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
    });
    this.ring = new THREE.Mesh(geo, mat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.copy(this.ringPos);
    scene.add(this.ring);
  }

  override update(dt: number) {
    super.update(dt);
    const safe = this.currentSafeRadius;
    const inner = Math.max(safe - 15, 0);

    const positions = this.ring.geometry.attributes.position;
    const thetaSegments = 64;
    for (let i = 0; i <= thetaSegments; i++) {
      const angle = (i / thetaSegments) * Math.PI * 2;
      const innerIdx = i * 2;
      const outerIdx = i * 2 + 1;
      if (innerIdx < positions.count) {
        positions.setXYZ(innerIdx, Math.cos(angle) * inner, 0, Math.sin(angle) * inner);
      }
      if (outerIdx < positions.count) {
        positions.setXYZ(outerIdx, Math.cos(angle) * safe, 0, Math.sin(angle) * safe);
      }
    }
    positions.needsUpdate = true;
  }

  override isOutsideZone(pos: THREE.Vector3): boolean {
    return super.isOutsideZone(pos);
  }

  getDamagePerSec(): number {
    return this.damagePerSec;
  }

  /** Drives the ring mesh purely from an authoritative safe radius (e.g. the sim zone). */
  updateFromZone(safeRadius: number) {
    const inner = Math.max(safeRadius - 15, 0);
    const positions = this.ring.geometry.attributes.position;
    const thetaSegments = 64;
    for (let i = 0; i <= thetaSegments; i++) {
      const angle = (i / thetaSegments) * Math.PI * 2;
      const innerIdx = i * 2;
      const outerIdx = i * 2 + 1;
      if (innerIdx < positions.count) {
        positions.setXYZ(innerIdx, Math.cos(angle) * inner, 0, Math.sin(angle) * inner);
      }
      if (outerIdx < positions.count) {
        positions.setXYZ(outerIdx, Math.cos(angle) * safeRadius, 0, Math.sin(angle) * safeRadius);
      }
    }
    positions.needsUpdate = true;
  }
}
