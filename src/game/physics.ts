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

export function isPositionClear(
  x: number,
  z: number,
  radius: number,
  colliders: WorldBoxCollider[],
  otherCircles?: { x: number; z: number; radius: number }[],
): boolean {
  const minBound = -WORLD_HALF_EXTENT + 7;
  const maxBoundZ = WORLD_HALF_EXTENT - 7;
  const maxBoundX = OCEAN_START_X;
  if (x - radius < minBound || x + radius > maxBoundX || z - radius < minBound || z + radius > maxBoundZ) {
    return false;
  }

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    if (x + radius <= box.minX || x - radius >= box.maxX || z + radius <= box.minZ || z - radius >= box.maxZ) {
      continue;
    }
    const cx = Math.max(box.minX, Math.min(x, box.maxX));
    const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) {
      return false;
    }
  }

  if (otherCircles) {
    for (let i = 0; i < otherCircles.length; i++) {
      const o = otherCircles[i];
      const minD = radius + o.radius;
      const dx = x - o.x;
      const dz = z - o.z;
      if (dx * dx + dz * dz < minD * minD) {
        return false;
      }
    }
  }

  return true;
}

export function findSafeExitPosition(
  vx: number,
  vz: number,
  heading: number,
  halfWidth: number,
  halfLength: number,
  colliders: WorldBoxCollider[],
  otherVehicles: { x: number; z: number; halfWidth: number }[],
): { x: number; y: number; z: number } {
  const playerRadius = 0.45;
  const fwdX = Math.sin(heading);
  const fwdZ = Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);

  const sideOffset = halfWidth + 0.92;
  const longOffset = halfLength + 1.05;

  // Candidate offsets in local vehicle frame: Driver side (+X / left door), Passenger side (-X), Rear, Front
  const candidates: [number, number][] = [
    [sideOffset, 0.15],
    [sideOffset + 0.55, 0.15],
    [-sideOffset, 0.15],
    [-sideOffset - 0.55, 0.15],
    [0, -longOffset],
    [0, longOffset],
    [sideOffset, -halfLength * 0.5],
    [-sideOffset, -halfLength * 0.5],
  ];

  const vehicleObstacles = otherVehicles.map((o) => ({ x: o.x, z: o.z, radius: o.halfWidth + 0.25 }));

  for (let i = 0; i < candidates.length; i++) {
    const [lx, lz] = candidates[i];
    const cx = vx + rightX * lx + fwdX * lz;
    const cz = vz + rightZ * lx + fwdZ * lz;
    if (isPositionClear(cx, cz, playerRadius, colliders, vehicleObstacles)) {
      return {
        x: cx,
        y: Math.max(0, vehicleSurfaceHeightAt(cx, cz)),
        z: cz,
      };
    }
  }

  // Fallback: push directly left + resolve collisions so player never clips inside chassis or building
  const fallback = {
    x: vx + rightX * sideOffset,
    z: vz + rightZ * sideOffset,
  };
  resolveCircleWorldCollisions(fallback, playerRadius, colliders);
  return {
    x: fallback.x,
    y: Math.max(0, vehicleSurfaceHeightAt(fallback.x, fallback.z)),
    z: fallback.z,
  };
}

// Ray-AABB slab intersection from origin toward target; returns clamped fraction in [minFrac..1]
export function raycastCollidersFraction(
  ox: number,
  oy: number,
  oz: number,
  tx: number,
  ty: number,
  tz: number,
  colliders: WorldBoxCollider[],
  padding = 0.55,
): number {
  const dx = tx - ox;
  const dy = ty - oy;
  const dz = tz - oz;
  let bestT = 1.0;

  for (let i = 0; i < colliders.length; i++) {
    const box = colliders[i];
    // Ignore low ground props below camera ray
    if (box.maxY < Math.min(oy, ty) - 0.2) continue;

    const minX = box.minX - padding;
    const maxX = box.maxX + padding;
    const minY = -0.5;
    const maxY = box.maxY + padding * 0.5;
    const minZ = box.minZ - padding;
    const maxZ = box.maxZ + padding;

    let tMin = 0;
    let tMax = bestT;

    // X slab
    if (Math.abs(dx) < 1e-6) {
      if (ox < minX || ox > maxX) continue;
    } else {
      const inv = 1 / dx;
      let t1 = (minX - ox) * inv;
      let t2 = (maxX - ox) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    // Y slab
    if (Math.abs(dy) < 1e-6) {
      if (oy < minY || oy > maxY) continue;
    } else {
      const inv = 1 / dy;
      let t1 = (minY - oy) * inv;
      let t2 = (maxY - oy) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    // Z slab
    if (Math.abs(dz) < 1e-6) {
      if (oz < minZ || oz > maxZ) continue;
    } else {
      const inv = 1 / dz;
      let t1 = (minZ - oz) * inv;
      let t2 = (maxZ - oz) * inv;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      tMin = Math.max(tMin, t1);
      tMax = Math.min(tMax, t2);
      if (tMin > tMax) continue;
    }

    if (tMin > 0.02 && tMin < bestT) {
      bestT = tMin;
    }
  }

  return Math.max(0.24, bestT);
}

