import { WorldBoxCollider } from './types';

export const WORLD_HALF_EXTENT = 195;
export const BEACH_START_X = 128;
export const OCEAN_START_X = 165;

export function groundHeightAt(x: number, z: number): number {
  if (x <= BEACH_START_X) {
    return 0;
  }
  if (x <= OCEAN_START_X) {
    const t = (x - BEACH_START_X) / (OCEAN_START_X - BEACH_START_X);
    return -0.55 * t;
  }
  return -0.65;
}

const BLOCK_CENTERS = [-90, -30, 30, 90] as const;

export function vehicleSurfaceHeightAt(x: number, z: number): number {
  // Beach boardwalk deck
  if (x >= BEACH_START_X - 1.25 && x <= BEACH_START_X + 4.25 && Math.abs(z) <= 180) {
    return 0.24;
  }
  // City raised sidewalks inside the 4x4 block grid
  if (x > -113 && x < 113 && z > -113 && z < 113) {
    let onBlockX = false;
    for (let i = 0; i < 4; i++) {
      if (Math.abs(x - BLOCK_CENTERS[i]) < 23) {
        onBlockX = true;
        break;
      }
    }
    if (onBlockX) {
      for (let i = 0; i < 4; i++) {
        if (Math.abs(z - BLOCK_CENTERS[i]) < 23) {
          return 0.16;
        }
      }
    }
  }
  return groundHeightAt(x, z);
}

export function getDistrictName(x: number, z: number): string {
  if (x > 125) return 'Praia de Vespucci';
  if (x > -35 && x < 35 && z > -35 && z < 35) return 'Parque Central';
  if (x < -30 && z < 20) return 'Centro Financeiro';
  if (z > 40) return 'Bairro Residencial Sul';
  if (x > 30 && z < -20) return 'Distrito Comercial';
  return 'Avenida San Verde';
}

export interface CollisionResult {
  collided: boolean;
  normalX: number;
  normalZ: number;
  penetration: number;
}

export function resolveCircleWorldCollisions(
  pos: { x: number; z: number },
  radius: number,
  colliders: WorldBoxCollider[],
): CollisionResult {
  let collided = false;
  let bestNormalX = 0;
  let bestNormalZ = 0;
  let maxPen = 0;

  // World perimeter bounds (west/north/south city edge & ocean deep water)
  const minBound = -WORLD_HALF_EXTENT + 6;
  const maxBoundZ = WORLD_HALF_EXTENT - 6;
  const maxBoundX = OCEAN_START_X + 2;

  if (pos.x - radius < minBound) {
    const pen = minBound - (pos.x - radius);
    pos.x += pen;
    collided = true;
    bestNormalX = 1;
    bestNormalZ = 0;
    maxPen = Math.max(maxPen, pen);
  }
  if (pos.x + radius > maxBoundX) {
    const pen = pos.x + radius - maxBoundX;
    pos.x -= pen;
    collided = true;
    bestNormalX = -1;
    bestNormalZ = 0;
    maxPen = Math.max(maxPen, pen);
  }
  if (pos.z - radius < minBound) {
    const pen = minBound - (pos.z - radius);
    pos.z += pen;
    collided = true;
    bestNormalX = 0;
    bestNormalZ = 1;
    maxPen = Math.max(maxPen, pen);
  }
  if (pos.z + radius > maxBoundZ) {
    const pen = pos.z + radius - maxBoundZ;
    pos.z -= pen;
    collided = true;
    bestNormalX = 0;
    bestNormalZ = -1;
    maxPen = Math.max(maxPen, pen);
  }

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    // Quick broadphase reject
    if (
      pos.x + radius < box.minX ||
      pos.x - radius > box.maxX ||
      pos.z + radius < box.minZ ||
      pos.z - radius > box.maxZ
    ) {
      continue;
    }

    const closestX = Math.max(box.minX, Math.min(pos.x, box.maxX));
    const closestZ = Math.max(box.minZ, Math.min(pos.z, box.maxZ));

    const dx = pos.x - closestX;
    const dz = pos.z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      collided = true;
      if (distSq > 1e-6) {
        const dist = Math.sqrt(distSq);
        const pen = radius - dist;
        const nx = dx / dist;
        const nz = dz / dist;
        pos.x += nx * pen;
        pos.z += nz * pen;
        if (pen > maxPen) {
          maxPen = pen;
          bestNormalX = nx;
          bestNormalZ = nz;
        }
      } else {
        // Center is inside AABB, push out along shortest axis
        const penLeft = Math.abs(pos.x - box.minX);
        const penRight = Math.abs(box.maxX - pos.x);
        const penTop = Math.abs(pos.z - box.minZ);
        const penBot = Math.abs(box.maxZ - pos.z);
        const minAxis = Math.min(penLeft, penRight, penTop, penBot);
        if (minAxis === penLeft) {
          pos.x = box.minX - radius;
          bestNormalX = -1;
          bestNormalZ = 0;
        } else if (minAxis === penRight) {
          pos.x = box.maxX + radius;
          bestNormalX = 1;
          bestNormalZ = 0;
        } else if (minAxis === penTop) {
          pos.z = box.minZ - radius;
          bestNormalX = 0;
          bestNormalZ = -1;
        } else {
          pos.z = box.maxZ + radius;
          bestNormalX = 0;
          bestNormalZ = 1;
        }
        maxPen = Math.max(maxPen, minAxis + radius);
      }
    }
  }

  return {
    collided,
    normalX: bestNormalX,
    normalZ: bestNormalZ,
    penetration: maxPen,
  };
}
