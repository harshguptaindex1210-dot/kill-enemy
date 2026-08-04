import * as THREE from 'three';
import type { LootDef } from './loot';

export interface Airdrop {
  id: number;
  position: THREE.Vector3;
  landingTime: number;
  loot: LootDef[];
  claimed: boolean;
}

export interface AirdropSystem {
  airdrops: Airdrop[];
  nextDropTime: number;
  nextId: number;
  intervalMs: number;
  maxDrops: number;
}

const CRATE_LOOT: LootDef[] = [
  { type: 'weapon', subtype: 'rifle', amount: 1 },
  { type: 'armor', subtype: 'vest', amount: 50 },
  { type: 'heal', subtype: 'medkit', amount: 50 },
  { type: 'weapon', subtype: 'grenade', amount: 2 },
  { type: 'ammo', subtype: 'rifle', amount: 60 },
];

export function createAirdropSystem(
  intervalMs: number = 120000,
  maxDrops: number = 4
): AirdropSystem {
  return {
    airdrops: [],
    nextDropTime: intervalMs,
    nextId: 1,
    intervalMs,
    maxDrops,
  };
}

export function randomPointInCircle(center: THREE.Vector3, radius: number): THREE.Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.sqrt(Math.random()) * Math.max(radius, 10);
  return new THREE.Vector3(
    center.x + Math.cos(angle) * dist,
    50,
    center.z + Math.sin(angle) * dist
  );
}

export function updateAirdrops(
  system: AirdropSystem,
  time: number,
  safeCenter: THREE.Vector3,
  safeRadius: number
): Airdrop[] {
  const spawned: Airdrop[] = [];
  while (system.airdrops.length < system.maxDrops && time >= system.nextDropTime) {
    const drop: Airdrop = {
      id: system.nextId++,
      position: randomPointInCircle(safeCenter, safeRadius * 0.6),
      landingTime: time + 8000,
      loot: CRATE_LOOT.map((l) => ({ ...l })),
      claimed: false,
    };
    system.airdrops.push(drop);
    spawned.push(drop);
    system.nextDropTime = time + system.intervalMs;
  }
  return spawned;
}

export function claimAirdrop(system: AirdropSystem, id: number): LootDef[] | null {
  const drop = system.airdrops.find((a) => a.id === id && !a.claimed);
  if (!drop) return null;
  drop.claimed = true;
  return drop.loot;
}
