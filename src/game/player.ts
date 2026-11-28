import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { WeaponId, WorldBoxCollider } from './types';
import { groundHeightAt, resolveCircleWorldCollisions } from './physics';
import {
  ProtagonistSkeleton,
  buildProtagonistSkeleton,
  stepProtagonistAnimation,
} from './protagonistRig';

const ROAD_LINES = [-120, -60, 0, 60, 120] as const;

export interface HumanoidRig {
  group: THREE.Group;
  bodyPivot: THREE.Object3D;
  head: THREE.Object3D;
  leftArm: THREE.Object3D;
  rightArm: THREE.Object3D;
  leftLeg: THREE.Object3D;
  rightLeg: THREE.Object3D;
  batMesh: THREE.Mesh;
  pistolMesh: THREE.Mesh;
}

interface ExternalGlbCharacter {
  root: THREE.Group;
  mixer: THREE.AnimationMixer | null;
  idleAction: THREE.AnimationAction | null;
  walkAction: THREE.AnimationAction | null;
  runAction: THREE.AnimationAction | null;
  hipsBone: THREE.Object3D | null;
  headBone: THREE.Object3D | null;
  leftArmBone: THREE.Object3D | null;
  rightArmBone: THREE.Object3D | null;
  leftLegBone: THREE.Object3D | null;
  rightLegBone: THREE.Object3D | null;
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

function findBoneByKeywords(root: THREE.Object3D, patterns: RegExp[]): THREE.Object3D | null {
  let matched: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (matched) return;
    const name = child.name || '';
    if (patterns.some((re) => re.test(name))) {
      matched = child;
    }
  });
  return matched;
}

export class PlayerController {
  public protagonist: ProtagonistSkeleton;
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
  private scene: THREE.Scene;
  private contactShadowTex: THREE.Texture;
  private externalGlb: ExternalGlbCharacter | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene, contactShadowTex: THREE.Texture) {
    this.scene = scene;
    this.contactShadowTex = contactShadowTex;
    this.protagonist = buildProtagonistSkeleton(contactShadowTex);
    this.rig = {
      group: this.protagonist.root,
      bodyPivot: this.protagonist.hips,
      head: this.protagonist.head,
      leftArm: this.protagonist.leftUpperArm,
      rightArm: this.protagonist.rightUpperArm,
      leftLeg: this.protagonist.leftThigh,
      rightLeg: this.protagonist.rightThigh,
      batMesh: this.protagonist.batMesh,
      pistolMesh: this.protagonist.pistolMesh,
    };
    this.rig.group.position.set(this.x, this.y, this.z);
    this.rig.group.rotation.y = this.heading;
    scene.add(this.rig.group);

    void this.tryLoadExternalGlb('/assets/aistudio/characters/model_web.glb');
  }

  private async tryLoadExternalGlb(url: string): Promise<void> {
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('text/html')) return;

      const buffer = await res.arrayBuffer();
      if (this.disposed || buffer.byteLength < 16) return;

      const magic = new DataView(buffer).getUint32(0, true);
      const isGlbMagic = magic === 0x46546c67;
      const firstByte = new Uint8Array(buffer, 0, 1)[0];
      const isJsonGltf = firstByte === 0x7b;
      if (!isGlbMagic && !isJsonGltf) return;

      const loader = new GLTFLoader();
      const draco = new DRACOLoader();
      draco.setDecoderPath('/draco/');
      loader.setDRACOLoader(draco);

      const gltf = await loader.parseAsync(buffer, url.substring(0, url.lastIndexOf('/') + 1));
      draco.dispose();
      if (this.disposed) return;

      const model = gltf.scene;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      if (size.y < 0.05) return;

      const targetHeight = 1.82;
      const scale = targetHeight / size.y;
      model.scale.setScalar(scale);
      model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

      model.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      const root = new THREE.Group();
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.12, 1.12),
        new THREE.MeshBasicMaterial({
          map: this.contactShadowTex,
          transparent: true,
          depthWrite: false,
          opacity: 0.5,
        }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.025;
      root.add(shadow);
      root.add(model);

      let mixer: THREE.AnimationMixer | null = null;
      let idleAction: THREE.AnimationAction | null = null;
      let walkAction: THREE.AnimationAction | null = null;
      let runAction: THREE.AnimationAction | null = null;

      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        const findClip = (re: RegExp) => gltf.animations.find((c) => re.test(c.name)) ?? null;
        const idleClip = findClip(/idle|stand|breath/i) ?? gltf.animations[0];
        const walkClip = findClip(/walk|move/i);
        const runClip = findClip(/run|sprint|jog/i);

        idleAction = mixer.clipAction(idleClip);
        idleAction.play();
        if (walkClip) {
          walkAction = mixer.clipAction(walkClip);
          walkAction.setEffectiveWeight(0);
          walkAction.play();
        }
        if (runClip) {
          runAction = mixer.clipAction(runClip);
          runAction.setEffectiveWeight(0);
          runAction.play();
        }
      }

      const hipsBone = findBoneByKeywords(model, [/hips|pelvis|root/i]);
      const headBone = findBoneByKeywords(model, [/head/i]);
      const leftArmBone = findBoneByKeywords(model, [/left.*arm|arm.*l|upperarm_l|l_upperarm/i]);
      const rightArmBone = findBoneByKeywords(model, [/right.*arm|arm.*r|upperarm_r|r_upperarm/i]);
      const leftLegBone = findBoneByKeywords(model, [/left.*leg|thigh.*l|upleg_l|l_thigh/i]);
      const rightLegBone = findBoneByKeywords(model, [/right.*leg|thigh.*r|upleg_r|r_thigh/i]);
      const rightHandBone =
        findBoneByKeywords(model, [/right.*hand|hand.*r|r_hand/i]) ?? rightArmBone ?? root;

      const batMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.02, 0.72, 10),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.55 }),
      );
      batMesh.rotation.x = Math.PI / 2;
      batMesh.visible = this.equippedWeapon === 'bat';
      rightHandBone.add(batMesh);

      const pistolMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.13, 0.26),
        new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.85, roughness: 0.26 }),
      );
      pistolMesh.visible = this.equippedWeapon === 'pistol';
      rightHandBone.add(pistolMesh);

      const wasVisible = this.rig.group.visible;
      this.scene.remove(this.rig.group);
      root.visible = wasVisible;
      root.position.set(this.x, this.y, this.z);
      root.rotation.y = this.heading;
      this.scene.add(root);

      this.externalGlb = {
        root,
        mixer,
        idleAction,
        walkAction,
        runAction,
        hipsBone,
        headBone,
        leftArmBone,
        rightArmBone,
        leftLegBone,
        rightLegBone,
        batMesh,
        pistolMesh,
      };
      this.rig = {
        group: root,
        bodyPivot: hipsBone ?? model,
        head: headBone ?? model,
        leftArm: leftArmBone ?? model,
        rightArm: rightArmBone ?? model,
        leftLeg: leftLegBone ?? model,
        rightLeg: rightLegBone ?? model,
        batMesh,
        pistolMesh,
      };
    } catch {
      // Silently keep built-in 19-bone ProtagonistSkeleton when no GLB is present
    }
  }

  public setWeapon(weapon: WeaponId): void {
    this.equippedWeapon = weapon;
    if (this.externalGlb) {
      this.externalGlb.batMesh.visible = weapon === 'bat';
      this.externalGlb.pistolMesh.visible = weapon === 'pistol';
    } else {
      this.protagonist.batMesh.visible = weapon === 'bat';
      this.protagonist.pistolMesh.visible = weapon === 'pistol';
    }
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
      this.walkPhase += dt * (this.isSprinting ? 13.0 : 8.2);
    } else {
      this.walkPhase += dt * 2.1;
    }

    if (this.externalGlb) {
      const ext = this.externalGlb;
      if (ext.mixer) {
        if (ext.idleAction) {
          ext.idleAction.setEffectiveWeight(this.isMoving ? 0.15 : 1);
        }
        if (ext.walkAction) {
          ext.walkAction.setEffectiveWeight(this.isMoving && !this.isSprinting ? 1 : 0);
        }
        if (ext.runAction) {
          ext.runAction.setEffectiveWeight(this.isMoving && this.isSprinting ? 1 : 0);
        } else if (ext.walkAction && this.isMoving && this.isSprinting) {
          ext.walkAction.setEffectiveWeight(1);
          ext.walkAction.timeScale = 1.45;
        } else if (ext.walkAction) {
          ext.walkAction.timeScale = 1.0;
        }
        ext.mixer.update(dt);
      } else {
        const amp = this.isMoving ? (this.isSprinting ? 0.65 : 0.42) : 0;
        const swing = Math.sin(this.walkPhase) * amp;
        if (ext.leftLegBone) ext.leftLegBone.rotation.x = swing;
        if (ext.rightLegBone) ext.rightLegBone.rotation.x = -swing;
        if (ext.leftArmBone) ext.leftArmBone.rotation.x = -swing * 0.8;
        if (ext.rightArmBone) ext.rightArmBone.rotation.x = swing * 0.8;
      }
    } else {
      stepProtagonistAnimation(
        this.protagonist,
        dt,
        this.walkPhase,
        this.isMoving,
        this.isSprinting,
        this.grounded,
        this.attackTimer,
        this.equippedWeapon,
      );
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

  public dispose(): void {
    this.disposed = true;
    this.protagonist.skeleton.dispose();
    this.protagonist.root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.geometry?.dispose();
      }
    });
    if (this.externalGlb) {
      this.externalGlb.root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
        }
      });
    }
  }
}

export type PedestrianState = 'patrol' | 'idle' | 'flee' | 'downed';

export interface Pedestrian {
  rig: HumanoidRig;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  targetHeading: number;
  walkPhase: number;
  speed: number;
  health: number;
  fleeTimer: number;
  idleTimer: number;
  turnCooldown: number;
  downedTimer: number;
  state: PedestrianState;
  isEnemy: boolean;
  shootCooldown: number;
}

const JACKET_PALETTE = [0xef4444, 0x3b82f6, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x475569];
const PANTS_PALETTE = [0x1e293b, 0x334155, 0x3f3f46, 0x1e3a8a];

function snapHeadingToSidewalk(x: number, z: number): number {
  let nearestXDist = Infinity;
  for (const r of ROAD_LINES) {
    const d = Math.abs(x - r);
    if (d < nearestXDist) nearestXDist = d;
  }
  let nearestZDist = Infinity;
  for (const r of ROAD_LINES) {
    const d = Math.abs(z - r);
    if (d < nearestZDist) nearestZDist = d;
  }
  if (nearestXDist <= nearestZDist) {
    return Math.random() < 0.5 ? 0 : Math.PI;
  }
  return Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
}

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
  const angle = isEnemy ? Math.random() * Math.PI * 2 : snapHeadingToSidewalk(x, z);
  rig.group.position.set(x, groundHeightAt(x, z), z);
  rig.group.rotation.y = angle;
  return {
    rig,
    x,
    z,
    vx: Math.sin(angle) * 1.8,
    vz: Math.cos(angle) * 1.8,
    heading: angle,
    targetHeading: angle,
    walkPhase: Math.random() * 6.28,
    speed: 1.65 + Math.random() * 0.75,
    health: isEnemy ? 75 : 40,
    fleeTimer: 0,
    idleTimer: 0,
    turnCooldown: 3 + Math.random() * 6,
    downedTimer: 0,
    state: 'patrol',
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
  maxCullDistSq = 185 * 185,
): void {
  const dxToPlayer = playerPos.x - ped.x;
  const dzToPlayer = playerPos.z - ped.z;
  const distSqToPlayer = dxToPlayer * dxToPlayer + dzToPlayer * dzToPlayer;

  // Android / mobile LOD culling for distant non-enemy civilians
  if (!ped.isEnemy && distSqToPlayer > maxCullDistSq) {
    ped.rig.group.visible = false;
    return;
  }
  ped.rig.group.visible = true;

  if (ped.downedTimer > 0) {
    ped.state = 'downed';
    ped.downedTimer -= dt;
    ped.rig.bodyPivot.rotation.x = Math.PI / 2;
    ped.rig.bodyPivot.position.y = 0.25;
    if (ped.downedTimer <= 0 && !ped.isEnemy) {
      ped.health = 40;
      ped.state = 'patrol';
      ped.rig.bodyPivot.rotation.x = 0;
      ped.rig.bodyPivot.position.y = 0;
      const rx = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)] + (Math.random() < 0.5 ? 9.4 : -9.4);
      const rz = (Math.random() - 0.5) * 180;
      ped.x = rx;
      ped.z = rz;
      ped.heading = snapHeadingToSidewalk(rx, rz);
      ped.targetHeading = ped.heading;
    }
    return;
  }

  const distToPlayer = Math.sqrt(distSqToPlayer);

  if (ped.isEnemy) {
    if (distToPlayer > 0.1) {
      ped.targetHeading = Math.atan2(dxToPlayer, dzToPlayer);
    }
    if (distToPlayer > 11 && distToPlayer < 75) {
      ped.x += Math.sin(ped.targetHeading) * 4.1 * dt;
      ped.z += Math.cos(ped.targetHeading) * 4.1 * dt;
      ped.walkPhase += dt * 9.5;
    } else if (distToPlayer <= 28) {
      ped.shootCooldown -= dt;
      if (ped.shootCooldown <= 0) {
        ped.shootCooldown = 1.25 + Math.random() * 0.55;
        onEnemyShoot?.(ped);
      }
      ped.rig.rightArm.rotation.x = THREE.MathUtils.damp(ped.rig.rightArm.rotation.x, -Math.PI * 0.48, 12, dt);
    }
    ped.heading = ped.targetHeading;
  } else {
    let moveSpeed = ped.speed;

    if (ped.fleeTimer > 0) {
      ped.state = 'flee';
      ped.fleeTimer -= dt;
      moveSpeed = 5.4;
      if (distToPlayer > 0.1) {
        ped.targetHeading = Math.atan2(-dxToPlayer, -dzToPlayer);
      }
    } else if (ped.idleTimer > 0) {
      ped.state = 'idle';
      ped.idleTimer -= dt;
      moveSpeed = 0;
      ped.walkPhase += dt * 1.8;
    } else {
      ped.state = 'patrol';
      ped.turnCooldown -= dt;
      if (ped.turnCooldown <= 0) {
        ped.turnCooldown = 4.5 + Math.random() * 6.5;
        const r = Math.random();
        if (r < 0.22) {
          ped.idleTimer = 1.2 + Math.random() * 2.2;
        } else if (r < 0.6) {
          ped.targetHeading += Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        }
      }
      // Keep pedestrians inside the city grid smoothly
      if (Math.abs(ped.x) > 135 || Math.abs(ped.z) > 135) {
        ped.targetHeading = Math.atan2(-ped.x, -ped.z);
      }
    }

    let headingDiff = ped.targetHeading - ped.heading;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    ped.heading += headingDiff * Math.min(1, 8.5 * dt);

    if (moveSpeed > 0.05) {
      ped.x += Math.sin(ped.heading) * moveSpeed * dt;
      ped.z += Math.cos(ped.heading) * moveSpeed * dt;
      ped.walkPhase += dt * moveSpeed * 4.2;
    }
  }

  const posTmp = { x: ped.x, z: ped.z };
  const res = resolveCircleWorldCollisions(posTmp, 0.4, colliders);
  ped.x = posTmp.x;
  ped.z = posTmp.z;
  if (res.collided) {
    ped.targetHeading = Math.atan2(res.normalX, res.normalZ) + (Math.random() - 0.5) * 0.5;
    ped.heading = ped.targetHeading;
  }

  // Detail animation only within 110m to save mobile CPU
  if (ped.isEnemy || distSqToPlayer < 110 * 110) {
    if (ped.state === 'idle' && !ped.isEnemy) {
      ped.rig.leftLeg.rotation.x = THREE.MathUtils.damp(ped.rig.leftLeg.rotation.x, 0, 10, dt);
      ped.rig.rightLeg.rotation.x = THREE.MathUtils.damp(ped.rig.rightLeg.rotation.x, 0, 10, dt);
      ped.rig.leftArm.rotation.x = THREE.MathUtils.damp(ped.rig.leftArm.rotation.x, Math.sin(ped.walkPhase) * 0.05, 8, dt);
      ped.rig.rightArm.rotation.x = THREE.MathUtils.damp(ped.rig.rightArm.rotation.x, -Math.sin(ped.walkPhase) * 0.05, 8, dt);
      ped.rig.head.rotation.y = Math.sin(ped.walkPhase * 0.7) * 0.25;
    } else if (ped.state === 'flee' && !ped.isEnemy) {
      const swing = Math.sin(ped.walkPhase) * 0.72;
      ped.rig.leftLeg.rotation.x = swing;
      ped.rig.rightLeg.rotation.x = -swing;
      ped.rig.leftArm.rotation.x = -2.1 + Math.sin(ped.walkPhase * 1.2) * 0.35;
      ped.rig.rightArm.rotation.x = -2.1 - Math.sin(ped.walkPhase * 1.2) * 0.35;
      ped.rig.head.rotation.y = 0;
    } else {
      const swing = Math.sin(ped.walkPhase) * 0.55;
      ped.rig.leftLeg.rotation.x = swing;
      ped.rig.rightLeg.rotation.x = -swing;
      ped.rig.leftArm.rotation.x = -swing * 0.8;
      if (!ped.isEnemy) ped.rig.rightArm.rotation.x = swing * 0.8;
      ped.rig.head.rotation.y = 0;
    }
  }

  ped.rig.group.position.set(ped.x, groundHeightAt(ped.x, ped.z), ped.z);
  ped.rig.group.rotation.y = ped.heading;
}

