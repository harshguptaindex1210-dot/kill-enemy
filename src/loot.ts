import * as THREE from 'three';

export interface LootDef {
  type: 'weapon' | 'ammo' | 'armor' | 'heal';
  subtype: string;
  amount: number;
}

export interface LootSpawn {
  position: THREE.Vector3;
  loot: LootDef;
  mesh: THREE.Mesh;
  collected: boolean;
}

export interface LootSpawnData {
  id: number;
  position: THREE.Vector3;
  loot: LootDef;
  collected: boolean;
}

const LOOT_TIERS: Record<string, LootDef[]> = {
  Town: [
    { type: 'weapon', subtype: 'rifle', amount: 1 },
    { type: 'weapon', subtype: 'pistol', amount: 1 },
    { type: 'ammo', subtype: 'rifle', amount: 30 },
  ],
  Factory: [
    { type: 'weapon', subtype: 'grenade', amount: 1 },
    { type: 'armor', subtype: 'vest', amount: 50 },
    { type: 'ammo', subtype: 'pistol', amount: 15 },
  ],
  Docks: [
    { type: 'weapon', subtype: 'pistol', amount: 1 },
    { type: 'heal', subtype: 'medkit', amount: 50 },
    { type: 'ammo', subtype: 'rifle', amount: 30 },
  ],
  Hilltop: [
    { type: 'weapon', subtype: 'rifle', amount: 1 },
    { type: 'armor', subtype: 'vest', amount: 30 },
    { type: 'heal', subtype: 'medkit', amount: 25 },
  ],
};

const LOOT_ITEMS_PER_POI = 4;

function tierFor(poiName: string): LootDef[] {
  return LOOT_TIERS[poiName] || LOOT_TIERS.Town;
}

let lootIdCounter = 1;

export function generateLootData(
  pois: { name: string; position: THREE.Vector3 }[],
  rng: () => number = Math.random
): LootSpawnData[] {
  const spawns: LootSpawnData[] = [];
  for (const poi of pois) {
    const tier = tierFor(poi.name);
    for (let i = 0; i < LOOT_ITEMS_PER_POI; i++) {
      const loot = tier[Math.floor(rng() * tier.length)];
      const angle = rng() * Math.PI * 2;
      const dist = 8 + rng() * 22;
      spawns.push({
        id: lootIdCounter++,
        position: new THREE.Vector3(
          poi.position.x + Math.cos(angle) * dist,
          0.5,
          poi.position.z + Math.sin(angle) * dist
        ),
        loot: { ...loot },
        collected: false,
      });
    }
  }
  return spawns;
}

export function collectLootData(
  spawns: LootSpawnData[],
  playerPos: THREE.Vector3,
  pickupRange: number = 2
): LootSpawnData | null {
  for (const s of spawns) {
    if (s.collected) continue;
    if (s.position.distanceTo(playerPos) <= pickupRange) {
      s.collected = true;
      return s;
    }
  }
  return null;
}

export function generateLoot(
  scene: THREE.Scene,
  pois: { name: string; position: THREE.Vector3 }[]
): LootSpawn[] {
  const spawns: LootSpawn[] = [];
  for (const data of generateLootData(pois)) {
    const color =
      data.loot.type === 'weapon'
        ? 0xff4444
        : data.loot.type === 'ammo'
          ? 0xffaa00
          : data.loot.type === 'armor'
            ? 0x4444ff
            : 0x44ff44;
    const geo = new THREE.BoxGeometry(0.4, 0.2, 0.4);
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.3,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(data.position);
    mesh.userData.lootIndex = spawns.length;
    scene.add(mesh);

    spawns.push({
      position: data.position,
      loot: data.loot,
      mesh,
      collected: false,
    });
  }
  return spawns;
}

export function collectLoot(
  spawns: LootSpawn[],
  playerPos: THREE.Vector3,
  pickupRange: number = 2
): LootDef | null {
  for (const s of spawns) {
    if (s.collected) continue;
    if (s.position.distanceTo(playerPos) <= pickupRange) {
      s.collected = true;
      s.mesh.visible = false;
      return s.loot;
    }
  }
  return null;
}
