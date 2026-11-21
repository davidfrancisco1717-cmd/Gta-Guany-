import * as THREE from 'three';
import { WorldBoxCollider } from './types';
import { VehicleInstance, createVehicle, stepVehiclePhysics } from './vehicles';
import { HumanoidRig, createHumanoidRig } from './player';
import { groundHeightAt, resolveCircleWorldCollisions } from './physics';
import { ProceduralTextureSet } from './textures';

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
    if (this.wantedStars <= 0) {
      if (this.policeVehicles.length > 0 || this.officers.length > 0) {
        this.despawnAll();
      }
      return { nearestPoliceDist: 999 };
    }

    const desiredCars = Math.min(4, this.wantedStars);
    this.spawnCooldown -= dt;

    // Spawn police cruisers on nearby road avenues outside immediate view
    if (this.policeVehicles.length < desiredCars && this.spawnCooldown <= 0) {
      this.spawnCooldown = 3.0;
      const angle = Math.random() * Math.PI * 2;
      const dist = 56 + Math.random() * 20;
      const sx = THREE.MathUtils.clamp(playerPos.x + Math.cos(angle) * dist, -125, 120);
      const sz = THREE.MathUtils.clamp(playerPos.z + Math.sin(angle) * dist, -125, 125);
      const heading = Math.atan2(playerPos.x - sx, playerPos.z - sz);
      const copCar = createVehicle(
        `police_${Date.now()}_${Math.random()}`,
        'police',
        sx,
        sz,
        heading,
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
      const rig = createHumanoidRig(0x1e3a8a, 0x0f172a, 0xd9a077, 0x1c1917, this.contactShadowTex, true);
      rig.pistolMesh.visible = true;
      rig.group.position.set(ox, groundHeightAt(ox, oz), oz);
      this.scene.add(rig.group);
      this.officers.push({
        rig,
        x: ox,
        z: oz,
        heading: 0,
        walkPhase: 0,
        shootCooldown: 1.5,
        health: 60,
      });
    }

    let nearestDist = 999;

    // Update Police Cruisers Pursuit AI
    for (let i = 0; i < this.policeVehicles.length; i++) {
      const pv = this.policeVehicles[i];
      if (pv.occupiedByPlayer) continue;
      pv.sirenActive = true;

      const dx = playerPos.x - pv.x;
      const dz = playerPos.z - pv.z;
      const dist = Math.hypot(dx, dz);
      if (dist < nearestDist) nearestDist = dist;

      const desiredHeading = Math.atan2(dx, dz);
      let err = desiredHeading - pv.heading;
      while (err > Math.PI) err -= Math.PI * 2;
      while (err < -Math.PI) err += Math.PI * 2;

      const steer = THREE.MathUtils.clamp(err * 2.2, -1, 1);
      const speedCap = 24 + this.wantedStars * 2.5;
      const throttle = dist < 6.5 ? -0.4 : pv.forwardSpeed < speedCap ? 0.92 : 0.1;

      stepVehiclePhysics(
        pv,
        { throttle, steer, handbrake: false },
        dt,
        colliders,
        allVehicles,
        isNight,
        elapsed,
      );

      // Ram damage / Busted check
      if (dist < 3.6 && !playerInVehicle && pv.forwardSpeed > 4) {
        onPlayerHit(14 * dt * 3);
      } else if (dist < 4.0 && !playerInVehicle && pv.forwardSpeed < 2.5 && this.wantedStars >= 1) {
        // Close arrest countdown handled via damage/pressure
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

      off.heading = Math.atan2(dx, dz);
      if (dist > 7.5 && dist < 80) {
        off.x += Math.sin(off.heading) * 4.5 * dt;
        off.z += Math.cos(off.heading) * 4.5 * dt;
        off.walkPhase += dt * 10;
      }

      const posTmp = { x: off.x, z: off.z };
      resolveCircleWorldCollisions(posTmp, 0.4, colliders);
      off.x = posTmp.x;
      off.z = posTmp.z;

      off.shootCooldown -= dt;
      if (dist < 26 && off.shootCooldown <= 0) {
        off.shootCooldown = 1.4;
        if (Math.random() < 0.65) {
          onPlayerHit(7 + this.wantedStars * 2);
        }
      }

      const swing = dist > 7.5 ? Math.sin(off.walkPhase) * 0.55 : 0;
      off.rig.leftLeg.rotation.x = swing;
      off.rig.rightLeg.rotation.x = -swing;
      off.rig.rightArm.rotation.x = -Math.PI * 0.48;
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
