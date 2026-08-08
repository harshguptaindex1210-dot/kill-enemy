import * as THREE from 'three';

/** Shared PBR surface roles — keeps robots, POIs, and props in one visual language. */
export type SurfaceRole =
  'metal' | 'paint' | 'concrete' | 'foliage' | 'glass' | 'rubber' | 'emissive';

const SURFACE: Record<SurfaceRole, { roughness: number; metalness: number }> = {
  metal: { roughness: 0.36, metalness: 0.74 },
  paint: { roughness: 0.46, metalness: 0.52 },
  concrete: { roughness: 0.9, metalness: 0.05 },
  foliage: { roughness: 0.94, metalness: 0.02 },
  glass: { roughness: 0.16, metalness: 0.78 },
  rubber: { roughness: 0.92, metalness: 0.04 },
  emissive: { roughness: 0.32, metalness: 0.22 },
};

export function styleMat(
  color: number,
  role: SurfaceRole,
  emissive?: number,
  emissiveIntensity = 0.45
): THREE.MeshStandardMaterial {
  const surf = SURFACE[role];
  return new THREE.MeshStandardMaterial({
    color,
    roughness: surf.roughness,
    metalness: surf.metalness,
    ...(emissive !== undefined ? { emissive, emissiveIntensity } : {}),
  });
}
