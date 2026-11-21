import * as THREE from 'three';
import { WeaponId, WorldBoxCollider } from './types';
import { groundHeightAt, resolveCircleWorldCollisions } from './physics';

export interface HumanoidRig {
  group: THREE.Group;
  bodyPivot: THREE.Group;
  head: THREE.Object3D;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  batMesh: THREE.Mesh;
  pistolMesh: THREE.Mesh;
}

export function createHumanoidRig(
  jacketColor: number,
  pantsColor: number,
  skinColor: number,
  hairColor: number,
  contactShadowTex: THREE.Texture,
  isOfficer = false,
): HumanoidRig {
  const group = new THREE.Group();

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 1.08),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.52,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  group.add(shadow);

  const bodyPivot = new THREE.Group();
  group.add(bodyPivot);

  const jacketMat = new THREE.MeshStandardMaterial({ color: jacketColor, roughness: 0.68, metalness: 0.05 });
  const undershirtMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.86 });
  const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.66 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.88 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.14, metalness: 0.85 });

  // Sculpted Torso (Capsule chest + shoulders + collar)
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.34, 6, 12), jacketMat);
  chest.scale.set(1.12, 1.0, 0.68);
  chest.position.y = 1.15;
  chest.castShadow = true;
  bodyPivot.add(chest);

  // Undershirt collar accent
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.12, 10), undershirtMat);
  collar.position.y = 1.44;
  bodyPivot.add(collar);

  // Waist / Belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.08, 12), soleMat);
  belt.scale.set(1.08, 1, 0.68);
  belt.position.y = 0.86;
  bodyPivot.add(belt);

  if (isOfficer) {
    const badge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.055, 0.03, 6),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 }),
    );
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0.12, 1.24, 0.16);
    bodyPivot.add(badge);
  }

  // Sculpted Head + Hair/Cap + Sunglasses
  const head = new THREE.Group();
  head.position.set(0, 1.63, 0);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.14, 10), skinMat);
  neck.position.y = -0.14;
  head.add(neck);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.165, 14, 12), skinMat);
  skull.scale.set(0.92, 1.08, 0.96);
  skull.castShadow = true;
  head.add(skull);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
    isOfficer ? new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 }) : hairMat,
  );
  hair.scale.set(0.94, 1.06, 0.98);
  hair.position.set(0, 0.03, -0.01);
  head.add(hair);

  if (isOfficer) {
    const capBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.18, 0.03, 12, 1, false, -0.9, 1.8), visorMat);
    capBrim.position.set(0, 0.07, 0.08);
    head.add(capBrim);
  } else {
    const shades = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.06), visorMat);
    shades.position.set(0, 0.02, 0.15);
    head.add(shades);
  }
  bodyPivot.add(head);

  // Rounded Articulated Arms (Shoulder sphere + Sleeve + Forearm + Hand)
  const makeArm = (side: number) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.3, 1.38, 0);

    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), jacketMat);
    arm.add(shoulder);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.22, 4, 10), jacketMat);
    sleeve.position.y = -0.15;
    sleeve.castShadow = true;
    arm.add(sleeve);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.062, 0.06, 10), undershirtMat);
    cuff.position.y = -0.31;
    arm.add(cuff);

    const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.18, 4, 10), skinMat);
    forearm.position.y = -0.42;
    forearm.castShadow = true;
    arm.add(forearm);

    bodyPivot.add(arm);
    return arm;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Equipped Weapons attached to Right Hand
  const batMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.022, 0.74, 10),
    new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.55 }),
  );
  batMesh.rotation.x = Math.PI / 2;
  batMesh.position.set(0, -0.56, 0.32);
  batMesh.visible = false;
  rightArm.add(batMesh);

  const pistolMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.14, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.26 }),
  );
  pistolMesh.position.set(0, -0.54, 0.16);
  pistolMesh.visible = false;
  rightArm.add(pistolMesh);

  // Rounded Articulated Legs (Denim Capsule + Sneaker)
  const makeLeg = (side: number) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.125, 0.82, 0);

    const legCyl = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.5, 4, 10), pantsMat);
    legCyl.position.y = -0.35;
    legCyl.castShadow = true;
    leg.add(legCyl);

    const sneaker = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.085, 0.12, 4, 10),
      isOfficer ? soleMat : shoeMat,
    );
    sneaker.rotation.x = Math.PI / 2;
    sneaker.scale.set(1.0, 1.0, 0.75);
    sneaker.position.set(0, -0.74, 0.05);
    sneaker.castShadow = true;
    leg.add(sneaker);

    bodyPivot.add(leg);
    return leg;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  return {
    group,
    bodyPivot,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    batMesh,
    pistolMesh,
  };
}

export class PlayerController {
  public rig: HumanoidRig;
  public x = -12;
  public y = 0;
  public z = 14;
  public vy = 0;
  public heading = Math.PI;
  public health = 100;
  public maxHealth = 100;
  public armor = 50;
  public stamina = 100;
  public cash = 650;
  public grounded = true;
  public isMoving = false;
  public isSprinting = false;
  public attackTimer = 0;
  public attackCooldown = 0;
  public enterExitAnim = 0;
  public equippedWeapon: WeaponId = 'fists';
  private walkPhase = 0;

  constructor(scene: THREE.Scene, contactShadowTex: THREE.Texture) {
    // Iconic casual denim overshirt + dark jeans + white sneakers look
    this.rig = createHumanoidRig(0x1e40af, 0x1f2937, 0xc98a63, 0x18181b, contactShadowTex, false);
    this.rig.group.position.set(this.x, this.y, this.z);
    this.rig.group.rotation.y = this.heading;
    scene.add(this.rig.group);
  }

  public setWeapon(weapon: WeaponId): void {
    this.equippedWeapon = weapon;
    this.rig.batMesh.visible = weapon === 'bat';
    this.rig.pistolMesh.visible = weapon === 'pistol';
  }

  public triggerAttack(): boolean {
    if (this.attackCooldown > 0) return false;
    this.attackTimer = 0.28;
    this.attackCooldown = this.equippedWeapon === 'pistol' ? 0.28 : 0.4;
    return true;
  }

  public updateOnFoot(
    dt: number,
    moveForward: number,
    moveRight: number,
    cameraYaw: number,
    sprintHeld: boolean,
    jumpPressed: boolean,
    colliders: WorldBoxCollider[],
  ): void {
    const inputMag = Math.min(1, Math.hypot(moveForward, moveRight));
    this.isMoving = inputMag > 0.08;

    if (sprintHeld && this.isMoving && this.stamina > 3) {
      this.isSprinting = true;
      this.stamina = Math.max(0, this.stamina - 22 * dt);
    } else {
      this.isSprinting = false;
      this.stamina = Math.min(100, this.stamina + 16 * dt);
    }

    const speed = this.isMoving ? (this.isSprinting ? 10.8 : 5.6) * inputMag : 0;

    if (this.isMoving) {
      const camFwdX = -Math.sin(cameraYaw);
      const camFwdZ = -Math.cos(cameraYaw);
      const camRightX = Math.cos(cameraYaw);
      const camRightZ = -Math.sin(cameraYaw);

      const dirX = camFwdX * moveForward + camRightX * moveRight;
      const dirZ = camFwdZ * moveForward + camRightZ * moveRight;
      const len = Math.hypot(dirX, dirZ) || 1;
      const nx = dirX / len;
      const nz = dirZ / len;

      this.x += nx * speed * dt;
      this.z += nz * speed * dt;

      const targetHeading = Math.atan2(nx, nz);
      let diff = targetHeading - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, 12 * dt);
    }

    if (jumpPressed && this.grounded) {
      this.vy = 7.8;
      this.grounded = false;
    }
    this.vy -= 21 * dt;
    this.y += this.vy * dt;

    const floorY = groundHeightAt(this.x, this.z);
    if (this.y <= floorY) {
      this.y = floorY;
      this.vy = 0;
      this.grounded = true;
    }

    const posTmp = { x: this.x, z: this.z };
    resolveCircleWorldCollisions(posTmp, 0.45, colliders);
    this.x = posTmp.x;
    this.z = posTmp.z;

    if (this.attackCooldown > 0) this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.enterExitAnim > 0) this.enterExitAnim = Math.max(0, this.enterExitAnim - dt);

    if (this.isMoving && this.grounded) {
      this.walkPhase += dt * (this.isSprinting ? 13.5 : 8.5);
      const swing = Math.sin(this.walkPhase) * (this.isSprinting ? 0.88 : 0.55);
      this.rig.leftLeg.rotation.x = swing;
      this.rig.rightLeg.rotation.x = -swing;
      this.rig.leftArm.rotation.x = -swing * 0.85;
      if (this.attackTimer <= 0) {
        this.rig.rightArm.rotation.x = swing * 0.85;
      }
      this.rig.bodyPivot.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06;
    } else if (!this.grounded) {
      this.rig.leftLeg.rotation.x = 0.45;
      this.rig.rightLeg.rotation.x = -0.35;
      this.rig.leftArm.rotation.x = -0.6;
      if (this.attackTimer <= 0) this.rig.rightArm.rotation.x = -0.6;
      this.rig.bodyPivot.position.y = 0;
    } else {
      this.walkPhase += dt * 2.2;
      this.rig.leftLeg.rotation.x = THREE.MathUtils.damp(this.rig.leftLeg.rotation.x, 0, 10, dt);
      this.rig.rightLeg.rotation.x = THREE.MathUtils.damp(this.rig.rightLeg.rotation.x, 0, 10, dt);
      this.rig.leftArm.rotation.x = THREE.MathUtils.damp(this.rig.leftArm.rotation.x, Math.sin(this.walkPhase) * 0.04, 10, dt);
      if (this.attackTimer <= 0) {
        this.rig.rightArm.rotation.x = THREE.MathUtils.damp(this.rig.rightArm.rotation.x, -Math.sin(this.walkPhase) * 0.04, 10, dt);
      }
      this.rig.bodyPivot.position.y = 0;
    }

    if (this.attackTimer > 0) {
      if (this.equippedWeapon === 'pistol') {
        this.rig.rightArm.rotation.x = -Math.PI * 0.48 - Math.sin(this.attackTimer * 25) * 0.15;
      } else {
        const p = this.attackTimer / 0.28;
        this.rig.rightArm.rotation.x = -Math.PI * 0.85 * Math.sin(p * Math.PI);
      }
    }

    this.rig.group.position.set(this.x, this.y, this.z);
    this.rig.group.rotation.y = this.heading;
  }

  public applyDamage(amount: number): void {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount * 0.65);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health = Math.max(0, this.health - amount);
  }
}

export interface Pedestrian {
  rig: HumanoidRig;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  walkPhase: number;
  speed: number;
  health: number;
  fleeTimer: number;
  downedTimer: number;
  isEnemy: boolean;
  shootCooldown: number;
}

const JACKET_PALETTE = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x475569];
const PANTS_PALETTE = [0x1e293b, 0x334155, 0x3f3f46, 0x1e3a8a];

export function createPedestrian(
  x: number,
  z: number,
  contactShadowTex: THREE.Texture,
  isEnemy = false,
): Pedestrian {
  const jacket = isEnemy
    ? 0x991b1b
    : JACKET_PALETTE[Math.floor(Math.random() * JACKET_PALETTE.length)];
  const pants = PANTS_PALETTE[Math.floor(Math.random() * PANTS_PALETTE.length)];
  const rig = createHumanoidRig(jacket, pants, 0xd9a077, 0x292524, contactShadowTex, false);
  if (isEnemy) {
    rig.pistolMesh.visible = true;
  }
  const angle = Math.random() * Math.PI * 2;
  rig.group.position.set(x, groundHeightAt(x, z), z);
  rig.group.rotation.y = angle;
  return {
    rig,
    x,
    z,
    vx: Math.sin(angle) * 1.8,
    vz: Math.cos(angle) * 1.8,
    heading: angle,
    walkPhase: Math.random() * 6.28,
    speed: 1.7 + Math.random() * 0.8,
    health: isEnemy ? 75 : 40,
    fleeTimer: 0,
    downedTimer: 0,
    isEnemy,
    shootCooldown: 1.2,
  };
}

export function stepPedestrian(
  ped: Pedestrian,
  dt: number,
  playerPos: THREE.Vector3,
  colliders: WorldBoxCollider[],
  onEnemyShoot?: (ped: Pedestrian) => void,
): void {
  if (ped.downedTimer > 0) {
    ped.downedTimer -= dt;
    ped.rig.bodyPivot.rotation.x = Math.PI / 2;
    ped.rig.bodyPivot.position.y = 0.25;
    if (ped.downedTimer <= 0 && !ped.isEnemy) {
      ped.health = 40;
      ped.rig.bodyPivot.rotation.x = 0;
      ped.rig.bodyPivot.position.y = 0;
      ped.x = (Math.random() - 0.5) * 200;
      ped.z = (Math.random() - 0.5) * 200;
    }
    return;
  }

  const dxToPlayer = playerPos.x - ped.x;
  const dzToPlayer = playerPos.z - ped.z;
  const distToPlayer = Math.hypot(dxToPlayer, dzToPlayer);

  if (ped.isEnemy) {
    if (distToPlayer > 0.1) {
      ped.heading = Math.atan2(dxToPlayer, dzToPlayer);
    }
    if (distToPlayer > 11 && distToPlayer < 65) {
      ped.x += Math.sin(ped.heading) * 3.8 * dt;
      ped.z += Math.cos(ped.heading) * 3.8 * dt;
      ped.walkPhase += dt * 9;
    } else if (distToPlayer <= 28) {
      ped.shootCooldown -= dt;
      if (ped.shootCooldown <= 0) {
        ped.shootCooldown = 1.35 + Math.random() * 0.6;
        onEnemyShoot?.(ped);
      }
      ped.rig.rightArm.rotation.x = -Math.PI * 0.48;
    }
  } else {
    let moveSpeed = ped.speed;
    if (ped.fleeTimer > 0) {
      ped.fleeTimer -= dt;
      moveSpeed = 5.4;
      if (distToPlayer > 0.1) {
        ped.heading = Math.atan2(-dxToPlayer, -dzToPlayer);
      }
    } else if (Math.random() < 0.008) {
      ped.heading += (Math.random() - 0.5) * 1.4;
    }

    ped.x += Math.sin(ped.heading) * moveSpeed * dt;
    ped.z += Math.cos(ped.heading) * moveSpeed * dt;
    ped.walkPhase += dt * moveSpeed * 4.2;
  }

  const posTmp = { x: ped.x, z: ped.z };
  const res = resolveCircleWorldCollisions(posTmp, 0.4, colliders);
  ped.x = posTmp.x;
  ped.z = posTmp.z;
  if (res.collided) {
    ped.heading += Math.PI * 0.65;
  }

  const swing = Math.sin(ped.walkPhase) * 0.55;
  ped.rig.leftLeg.rotation.x = swing;
  ped.rig.rightLeg.rotation.x = -swing;
  ped.rig.leftArm.rotation.x = -swing * 0.8;
  if (!ped.isEnemy) ped.rig.rightArm.rotation.x = swing * 0.8;

  ped.rig.group.position.set(ped.x, groundHeightAt(ped.x, ped.z), ped.z);
  ped.rig.group.rotation.y = ped.heading;
}
