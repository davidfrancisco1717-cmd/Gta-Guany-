import * as THREE from 'three';
import { WorldBoxCollider } from './types';
import { VehicleInstance, createVehicle, stepVehiclePhysics } from './vehicles';
import { HumanoidRig, createHumanoidRig } from './player';
import {
  groundHeightAt,
  isPositionClear,
  raycastCollidersFraction,
  resolveCircleWorldCollisions,
} from './physics';
import { ProceduralTextureSet } from './textures';

const ROAD_LINES = [-120, -60, 0, 60, 120] as const;

export interface PoliceOfficer {
  rig: HumanoidRig;
  x: number;
  z: number;
  heading: number;
  walkPhase: number;
  shootCooldown: number;
  health: number;
}

export class PoliceSystem {
  public wantedStars = 0;
  public heat = 0;
  public evadeTimer = 0;
  public evadeDuration = 12;
  public isFlashing = false;
  public policeVehicles: VehicleInstance[] = [];
  public officers: PoliceOfficer[] = [];
  private scene: THREE.Scene;
  private contactShadowTex: THREE.Texture;
  private reflections: boolean;
  private textures?: ProceduralTextureSet;
  private spawnCooldown = 0;
  private cruiserStuckMap = new WeakMap<VehicleInstance, { stuck: number; reverse: number }>();
  private lastPlayerX = 0;
  private lastPlayerZ = 0;
  private hasLastPlayerPos = false;

  constructor(
    scene: THREE.Scene,
    contactShadowTex: THREE.Texture,
    reflections: boolean,
    textures?: ProceduralTextureSet,
  ) {
    this.scene = scene;
    this.contactShadowTex = contactShadowTex;
    this.reflections = reflections;
    this.textures = textures;
  }

  public addCrime(severity: number): void {
    this.heat = Math.min(500, this.heat + severity);
    const nextStars =
      this.heat >= 340
        ? 5
        : this.heat >= 230
          ? 4
          : this.heat >= 140
            ? 3
            : this.heat >= 70
              ? 2
              : this.heat >= 20
                ? 1
                : 0;
    if (nextStars > this.wantedStars) {
      this.wantedStars = nextStars;
    }
    this.evadeTimer = 0;
    this.isFlashing = false;
  }

  public setWantedStars(stars: number): void {
    this.wantedStars = Math.max(0, Math.min(5, stars));
    this.heat = stars * 80;
    this.evadeTimer = 0;
    this.isFlashing = false;
  }

  public clearWanted(): void {
    this.wantedStars = 0;
    this.heat = 0;
    this.evadeTimer = 0;
    this.isFlashing = false;
    this.despawnAll();
  }

  public despawnAll(): void {
    for (const pv of this.policeVehicles) {
      if (!pv.occupiedByPlayer) {
        this.scene.remove(pv.group);
      }
    }
    this.policeVehicles = this.policeVehicles.filter((pv) => pv.occupiedByPlayer);
    for (const off of this.officers) {
      this.scene.remove(off.rig.group);
    }
    this.officers = [];
  }

  private findRoadSpawnNearPlayer(
    playerPos: THREE.Vector3,
    colliders: WorldBoxCollider[],
    allVehicles: VehicleInstance[],
  ): { x: number; z: number; heading: number } {
    const vehicleCircles = allVehicles.map((v) => ({
      x: v.x,
      z: v.z,
      radius: v.spec.halfLength + 1.2,
    }));

    for (let attempt = 0; attempt < 16; attempt++) {
      const axisZ = (attempt + Math.floor(Math.random() * 2)) % 2 === 0;
      const roadCoord = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
      const laneOffset = Math.random() < 0.5 ? -3.4 : 3.4;
      const dist = 46 + Math.random() * 28;
      const sign = Math.random() < 0.5 ? 1 : -1;

      const sx = THREE.MathUtils.clamp(
        axisZ ? roadCoord + laneOffset : playerPos.x + sign * dist,
        -126,
        122,
      );
      const sz = THREE.MathUtils.clamp(
        axisZ ? playerPos.z + sign * dist : roadCoord + laneOffset,
        -126,
        126,
      );
      const dToPlayer = Math.hypot(sx - playerPos.x, sz - playerPos.z);
      if (dToPlayer < 34) continue;

      if (isPositionClear(sx, sz, 2.5, colliders, vehicleCircles)) {
        return {
          x: sx,
          z: sz,
          heading: Math.atan2(playerPos.x - sx, playerPos.z - sz),
        };
      }
    }

    const angle = Math.random() * Math.PI * 2;
    const fx = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * 58, -125, 120);
    const fz = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * 58, -125, 120);
    return {
      x: fx,
      z: fz,
      heading: Math.atan2(playerPos.x - fx, playerPos.z - fz),
    };
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerInVehicle: boolean,
    allVehicles: VehicleInstance[],
    colliders: WorldBoxCollider[],
    isNight: boolean,
    elapsed: number,
    onPlayerHit: (dmg: number) => void,
    onBusted: () => void,
    onEvaded: (bonusCash: number) => void,
  ): { nearestPoliceDist: number } {
    let playerVx = 0;
    let playerVz = 0;
    if (this.hasLastPlayerPos && dt > 0.001) {
      playerVx = THREE.MathUtils.clamp((playerPos.x - this.lastPlayerX) / dt, -42, 42);
      playerVz = THREE.MathUtils.clamp((playerPos.z - this.lastPlayerZ) / dt, -42, 42);
    }
    this.lastPlayerX = playerPos.x;
    this.lastPlayerZ = playerPos.z;
    this.hasLastPlayerPos = true;

    if (this.wantedStars <= 0) {
      if (this.policeVehicles.length > 0 || this.officers.length > 0) {
        this.despawnAll();
      }
      return { nearestPoliceDist: 999 };
    }

    const desiredCars = Math.min(4, this.wantedStars);
    this.spawnCooldown -= dt;

    // Spawn police cruisers on road avenues outside immediate view
    if (this.policeVehicles.length < desiredCars && this.spawnCooldown <= 0) {
      this.spawnCooldown = 2.8;
      const spawn = this.findRoadSpawnNearPlayer(playerPos, colliders, allVehicles);
      const copCar = createVehicle(
        `police_${Date.now()}_${Math.random()}`,
        'police',
        spawn.x,
        spawn.z,
        spawn.heading,
        this.contactShadowTex,
        this.reflections,
        undefined,
        this.textures,
      );
      copCar.sirenActive = true;
      this.scene.add(copCar.group);
      this.policeVehicles.push(copCar);
      allVehicles.push(copCar);
    }

    // Spawn foot officers if player is on foot & wanted >= 2
    if (!playerInVehicle && this.wantedStars >= 2 && this.officers.length < 2) {
      const ang = Math.random() * Math.PI * 2;
      const ox = THREE.MathUtils.clamp(playerPos.x + Math.cos(ang) * 28, -125, 120);
      const oz = THREE.MathUtils.clamp(playerPos.z + Math.sin(ang) * 28, -125, 120);
      if (isPositionClear(ox, oz, 0.7, colliders)) {
        const rig = createHumanoidRig(0x1e3a8a, 0x0f172a, 0xd9a077, 0x1c1917, this.contactShadowTex, true);
        rig.pistolMesh.visible = true;
        rig.group.position.set(ox, groundHeightAt(ox, oz), oz);
        this.scene.add(rig.group);
        this.officers.push({
          rig,
          x: ox,
          z: oz,
          heading: Math.atan2(playerPos.x - ox, playerPos.z - oz),
          walkPhase: 0,
          shootCooldown: 1.5,
          health: 60,
        });
      }
    }

    let nearestDist = 999;

    // Update Police Cruisers Pursuit AI with obstacle whiskers & velocity-lead intercept
    for (let i = 0; i < this.policeVehicles.length; i++) {
      const pv = this.policeVehicles[i];
      if (pv.occupiedByPlayer) continue;
      pv.sirenActive = true;

      let stuckState = this.cruiserStuckMap.get(pv);
      if (!stuckState) {
        stuckState = { stuck: 0, reverse: 0 };
        this.cruiserStuckMap.set(pv, stuckState);
      }

      const dx = playerPos.x - pv.x;
      const dz = playerPos.z - pv.z;
      const dist = Math.hypot(dx, dz);
      if (dist < nearestDist) nearestDist = dist;

      // Velocity-lead intercept target when chasing fast player
      const leadSec = this.wantedStars >= 2 ? THREE.MathUtils.clamp(dist / 36, 0, 1.1) : 0;
      const targetX = playerPos.x + playerVx * leadSec;
      const targetZ = playerPos.z + playerVz * leadSec;
      const desiredHeading = Math.atan2(targetX - pv.x, targetZ - pv.z);

      let err = desiredHeading - pv.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;

      // 3-whisker obstacle probe ahead (center, left +0.48 rad, right -0.48 rad)
      const probeDist = 11.5;
      const fwdX = Math.sin(pv.heading);
      const fwdZ = Math.cos(pv.heading);
      const leftHeading = pv.heading + 0.48;
      const rightHeading = pv.heading - 0.48;

      const centerFrac = raycastCollidersFraction(
        pv.x + fwdX * 1.8,
        1.1,
        pv.z + fwdZ * 1.8,
        pv.x + fwdX * probeDist,
        1.1,
        pv.z + fwdZ * probeDist,
        colliders,
        0.95,
      );
      let avoidBias = 0;
      if (centerFrac < 0.92) {
        const leftFrac = raycastCollidersFraction(
          pv.x,
          1.1,
          pv.z,
          pv.x + Math.sin(leftHeading) * probeDist,
          1.1,
          pv.z + Math.cos(leftHeading) * probeDist,
          colliders,
          0.95,
        );
        const rightFrac = raycastCollidersFraction(
          pv.x,
          1.1,
          pv.z,
          pv.x + Math.sin(rightHeading) * probeDist,
          1.1,
          pv.z + Math.cos(rightHeading) * probeDist,
          colliders,
          0.95,
        );
        avoidBias = leftFrac >= rightFrac ? 1.15 : -1.15;
      }

      // Stuck detection -> brief reverse & turn recovery
      if (dist > 8 && Math.abs(pv.forwardSpeed) < 1.35) {
        stuckState.stuck += dt;
        if (stuckState.stuck > 1.15) {
          stuckState.reverse = 0.95;
          stuckState.stuck = 0;
        }
      } else {
        stuckState.stuck = Math.max(0, stuckState.stuck - dt * 1.5);
      }

      let steer = THREE.MathUtils.clamp(err * 2.1 + avoidBias * 1.35, -1, 1);
      const speedCap = 24 + this.wantedStars * 2.6;
      let throttle = dist < 6.0 ? -0.42 : pv.forwardSpeed < speedCap ? 0.92 : 0.1;
      if (centerFrac < 0.45 && dist > 9) {
        throttle = 0.42;
      }

      if (stuckState.reverse > 0) {
        stuckState.reverse -= dt;
        throttle = -0.82;
        steer = avoidBias !== 0 ? -Math.sign(avoidBias) : -Math.sign(err || 1);
      }

      stepVehiclePhysics(
        pv,
        { throttle, steer, handbrake: false },
        dt,
        colliders,
        allVehicles,
        isNight,
        elapsed,
      );

      // Ram damage / Close arrest pressure
      if (dist < 3.6 && !playerInVehicle && pv.forwardSpeed > 4) {
        onPlayerHit(14 * dt * 3);
      } else if (dist < 4.0 && !playerInVehicle && pv.forwardSpeed < 2.5 && this.wantedStars >= 1) {
        onPlayerHit(8 * dt);
      }
    }

    // Update Police Officers on Foot
    for (let i = this.officers.length - 1; i >= 0; i--) {
      const off = this.officers[i];
      if (off.health <= 0) {
        this.scene.remove(off.rig.group);
        this.officers.splice(i, 1);
        continue;
      }
      const dx = playerPos.x - off.x;
      const dz = playerPos.z - off.z;
      const dist = Math.hypot(dx, dz);
      if (dist < nearestDist) nearestDist = dist;

      const targetHeading = Math.atan2(dx, dz);
      let hDiff = targetHeading - off.heading;
      while (hDiff > Math.PI) hDiff -= Math.PI * 2;
      while (hDiff < -Math.PI) hDiff += Math.PI * 2;
      off.heading += hDiff * Math.min(1, 10 * dt);

      const chasing = dist > 7.5 && dist < 85;
      if (chasing) {
        off.x += Math.sin(off.heading) * 4.6 * dt;
        off.z += Math.cos(off.heading) * 4.6 * dt;
        off.walkPhase += dt * 10;
      }

      const posTmp = { x: off.x, z: off.z };
      const res = resolveCircleWorldCollisions(posTmp, 0.4, colliders);
      off.x = posTmp.x;
      off.z = posTmp.z;
      if (res.collided && chasing) {
        off.x += res.normalZ * 1.4 * dt;
        off.z -= res.normalX * 1.4 * dt;
      }

      off.shootCooldown -= dt;
      if (dist < 26 && off.shootCooldown <= 0) {
        off.shootCooldown = 1.4;
        const losFrac = raycastCollidersFraction(
          off.x,
          1.35,
          off.z,
          playerPos.x,
          1.2,
          playerPos.z,
          colliders,
          0.25,
        );
        if (losFrac > 0.96 && Math.random() < 0.65) {
          onPlayerHit(7 + this.wantedStars * 2);
        }
      }

      const swing = chasing ? Math.sin(off.walkPhase) * 0.55 : 0;
      off.rig.leftLeg.rotation.x = THREE.MathUtils.damp(off.rig.leftLeg.rotation.x, swing, 14, dt);
      off.rig.rightLeg.rotation.x = THREE.MathUtils.damp(off.rig.rightLeg.rotation.x, -swing, 14, dt);
      off.rig.leftArm.rotation.x = THREE.MathUtils.damp(off.rig.leftArm.rotation.x, -swing * 0.6, 12, dt);
      off.rig.rightArm.rotation.x = THREE.MathUtils.damp(off.rig.rightArm.rotation.x, -Math.PI * 0.48, 12, dt);
      off.rig.group.position.set(off.x, groundHeightAt(off.x, off.z), off.z);
      off.rig.group.rotation.y = off.heading;

      // Busted if player knocked down / zero speed right next to officer
      if (dist < 1.5 && !playerInVehicle && this.wantedStars >= 1 && Math.random() < 0.004) {
        onBusted();
      }
    }

    // Evasion Logic: if all police > 55m away, count up evasion timer
    if (nearestDist > 54) {
      this.isFlashing = true;
      this.evadeTimer += dt;
      if (this.evadeTimer >= this.evadeDuration) {
        const bonus = this.wantedStars * 150;
        this.clearWanted();
        onEvaded(bonus);
      }
    } else {
      this.isFlashing = false;
      this.evadeTimer = Math.max(0, this.evadeTimer - dt * 1.5);
    }

    return { nearestPoliceDist: nearestDist };
  }
}

