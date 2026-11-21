import * as THREE from 'three';
import { VEHICLE_SPECS, VehicleKind, VehicleSpec, WorldBoxCollider } from './types';
import { ROAD_COORDS } from './city';
import { resolveCircleWorldCollisions, vehicleSurfaceHeightAt } from './physics';
import { ProceduralTextureSet } from './textures';

export interface VehicleInput {
  throttle: number; // -1..1
  steer: number; // -1..1 (positive = left, negative = right)
  handbrake: boolean;
}

export interface WheelNode {
  pivot: THREE.Object3D;
  spinMesh: THREE.Object3D;
  localX: number;
  localZ: number;
  restY: number;
  isFront: boolean;
}

export interface VehicleInstance {
  id: string;
  spec: VehicleSpec;
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheelNodes: WheelNode[];
  wheelMeshes: THREE.Object3D[];
  frontSteerPivots: THREE.Object3D[];
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  brakeLightMat: THREE.MeshStandardMaterial;
  reverseLightMat: THREE.MeshStandardMaterial;
  turnLeftMat: THREE.MeshStandardMaterial;
  turnRightMat: THREE.MeshStandardMaterial;
  sirenRedMat?: THREE.MeshStandardMaterial;
  sirenBlueMat?: THREE.MeshStandardMaterial;
  x: number;
  y: number;
  z: number;
  heading: number; // radians, 0 = +Z forward, Math.PI = -Z
  vx: number;
  vz: number;
  forwardSpeed: number;
  steerAngle: number;
  angularVel: number;
  slipAngle: number;
  driftIntensity: number;
  gear: number;
  rpm: number;
  shiftTimer: number;
  suspY: number;
  suspVel: number;
  pitchAngle: number;
  pitchVel: number;
  rollAngle: number;
  rollVel: number;
  prevFwdSpeed: number;
  prevLatSpeed: number;
  prevGroundY: number;
  health: number;
  maxHealth: number;
  isPolice: boolean;
  sirenActive: boolean;
  occupiedByPlayer: boolean;
  isDrifting: boolean;
  aiActive: boolean;
  aiAxis: 'x' | 'z';
  aiDir: 1 | -1;
  aiLaneCoord: number;
  aiTargetSpeed: number;
}

const SPORTS_COLORS = [0xdc2626, 0x0f172a, 0xf8fafc, 0xf59e0b, 0x0284c7, 0x7c3aed];
const SEDAN_COLORS = [0x1e293b, 0x475569, 0x1e3a8a, 0x881337, 0xdbeafe, 0x0f766e, 0x27272a];
const SUV_COLORS = [0x1e3a8a, 0x18181b, 0x365314, 0x64748b, 0x7c2d12];

// ---------------------------------------------------------------------------
// Shared Procedural Geometry & Material Pool (Android-optimized)
// ---------------------------------------------------------------------------

interface SharedCarMaterials {
  trimMat: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshStandardMaterial;
  alloyMat: THREE.MeshStandardMaterial;
  darkAlloyMat: THREE.MeshStandardMaterial;
  tireMat: THREE.MeshStandardMaterial;
  rotorMat: THREE.MeshStandardMaterial;
  caliperRedMat: THREE.MeshStandardMaterial;
  caliperSteelMat: THREE.MeshStandardMaterial;
  carbonMat: THREE.MeshStandardMaterial;
  interiorMat: THREE.MeshStandardMaterial;
  seatMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshPhysicalMaterial;
  whitePaintMat: THREE.MeshPhysicalMaterial;
  mirrorGlassMat: THREE.MeshStandardMaterial;
}

let sharedMats: SharedCarMaterials | null = null;
const geoCache = new Map<string, THREE.BufferGeometry>();
const paintMatCache = new Map<string, THREE.Material>();

function getSharedMaterials(): SharedCarMaterials {
  if (sharedMats) return sharedMats;
  sharedMats = {
    trimMat: new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.68, metalness: 0.22 }),
    chromeMat: new THREE.MeshStandardMaterial({ color: 0xe8eaed, roughness: 0.14, metalness: 0.95 }),
    alloyMat: new THREE.MeshStandardMaterial({ color: 0xd4d8de, roughness: 0.22, metalness: 0.88 }),
    darkAlloyMat: new THREE.MeshStandardMaterial({ color: 0x272a30, roughness: 0.28, metalness: 0.84 }),
    tireMat: new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.88, metalness: 0.04 }),
    rotorMat: new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.35, metalness: 0.85 }),
    caliperRedMat: new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.32, metalness: 0.4 }),
    caliperSteelMat: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.65 }),
    carbonMat: new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.32, metalness: 0.45 }),
    interiorMat: new THREE.MeshStandardMaterial({ color: 0x1c1e24, roughness: 0.82, metalness: 0.08 }),
    seatMat: new THREE.MeshStandardMaterial({ color: 0x272a32, roughness: 0.76, metalness: 0.05 }),
    glassMat: new THREE.MeshPhysicalMaterial({
      color: 0x101c2e,
      metalness: 0.08,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      envMapIntensity: 1.5,
    }),
    whitePaintMat: new THREE.MeshPhysicalMaterial({
      color: 0xf8fafc,
      metalness: 0.25,
      roughness: 0.18,
      clearcoat: 0.9,
      clearcoatRoughness: 0.06,
    }),
    mirrorGlassMat: new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.05, metalness: 0.95 }),
  };
  return sharedMats;
}

function getPaintMaterial(color: number, reflections: boolean): THREE.Material {
  const key = `${color}_${reflections ? 'r' : 's'}`;
  const cached = paintMatCache.get(key);
  if (cached) return cached;

  const mat = reflections
    ? new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.7,
        roughness: 0.16,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.3,
      })
    : new THREE.MeshStandardMaterial({
        color,
        metalness: 0.52,
        roughness: 0.24,
      });
  paintMatCache.set(key, mat);
  return mat;
}

function cachedGeo(key: string, builder: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const existing = geoCache.get(key);
  if (existing) return existing;
  const g = builder();
  geoCache.set(key, g);
  return g;
}

// Profiled automotive tire using LatheGeometry (rounded shoulders & deep sidewall)
function getTireGeometry(radius: number, width: number): THREE.BufferGeometry {
  return cachedGeo(`tire_${radius.toFixed(3)}_${width.toFixed(3)}`, () => {
    const hw = width * 0.5;
    const innerR = radius * 0.62;
    const shoulderR = radius * 0.95;
    const pts = [
      new THREE.Vector2(innerR, -hw * 0.88),
      new THREE.Vector2(radius * 0.78, -hw),
      new THREE.Vector2(shoulderR, -hw * 0.94),
      new THREE.Vector2(radius, -hw * 0.72),
      new THREE.Vector2(radius, hw * 0.72),
      new THREE.Vector2(shoulderR, hw * 0.94),
      new THREE.Vector2(radius * 0.78, hw),
      new THREE.Vector2(innerR, hw * 0.88),
      new THREE.Vector2(innerR, -hw * 0.88),
    ];
    const geo = new THREE.LatheGeometry(pts, 20);
    // Align cylinder axis to X so spinMesh.rotation.x rotates forward
    geo.rotateZ(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

// Curved fender arch flare extruded cleanly around wheel well
function getFenderArchGeometry(outerR: number, innerR: number, width: number): THREE.BufferGeometry {
  return cachedGeo(`fender_${outerR.toFixed(3)}_${innerR.toFixed(3)}_${width.toFixed(3)}`, () => {
    const s = new THREE.Shape();
    const startA = -0.14;
    const endA = Math.PI + 0.14;
    s.absarc(0, 0, outerR, startA, endA, false);
    s.absarc(0, 0, innerR, endA, startA, true);
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth: width,
      bevelEnabled: true,
      bevelThickness: 0.025,
      bevelSize: 0.025,
      bevelSegments: 2,
      curveSegments: 14,
    });
    geo.translate(0, 0, -width / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

// Sculpted lower chassis core (narrower at wheel wells, full silhouette in center)
function getLowerChassisGeometry(kind: VehicleKind, halfWidth: number, halfLength: number): THREE.BufferGeometry {
  return cachedGeo(`lower_${kind}_${halfWidth.toFixed(2)}_${halfLength.toFixed(2)}`, () => {
    const s = new THREE.Shape();
    const L = halfLength;
    const base = kind === 'suv' ? 0.34 : kind === 'sports' ? 0.2 : 0.24;
    const hoodTop = kind === 'suv' ? 0.96 : kind === 'sports' ? 0.68 : 0.78;
    const beltY = kind === 'suv' ? 1.04 : kind === 'sports' ? 0.78 : 0.86;
    const noseY = kind === 'suv' ? 0.72 : kind === 'sports' ? 0.44 : 0.56;
    const trunkY = kind === 'suv' ? 1.02 : kind === 'sports' ? 0.82 : 0.88;

    s.moveTo(-L + 0.08, base);
    s.lineTo(L - 0.1, base);
    s.quadraticCurveTo(L + 0.04, base + 0.12, L, noseY); // sculpted front bumper nose
    s.quadraticCurveTo(L * 0.85, hoodTop - 0.05, L * 0.44, beltY - 0.02); // sloped aerodynamic hood
    s.lineTo(-L * 0.68, beltY); // clean beltline
    s.lineTo(-L + 0.05, trunkY);
    s.quadraticCurveTo(-L - 0.04, base + 0.28, -L + 0.08, base); // curved rear bumper
    s.closePath();

    // Narrower core width so tires sit cleanly inside flared fenders & wheel wells
    const coreWidth = halfWidth * 1.62;
    const geo = new THREE.ExtrudeGeometry(s, {
      depth: coreWidth,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.04,
      bevelSegments: 2,
      curveSegments: 10,
    });
    geo.translate(0, 0, -coreWidth / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

// Continuous sculpted side body flank (front fender + doors + rear quarter) with true wheel-arch cutouts
function getSideFlankGeometry(
  kind: VehicleKind,
  halfLength: number,
  wheelZ: number,
  wheelR: number,
  flankDepth: number,
): THREE.BufferGeometry {
  return cachedGeo(
    `flank_${kind}_${halfLength.toFixed(2)}_${wheelZ.toFixed(2)}_${wheelR.toFixed(2)}`,
    () => {
      const L = halfLength;
      const base = kind === 'suv' ? 0.34 : kind === 'sports' ? 0.2 : 0.24;
      const beltY = kind === 'suv' ? 1.04 : kind === 'sports' ? 0.78 : 0.86;
      const noseY = kind === 'suv' ? 0.72 : kind === 'sports' ? 0.44 : 0.56;
      const archR = wheelR + (kind === 'suv' ? 0.11 : 0.085);
      const archY = wheelR;

      const s = new THREE.Shape();
      s.moveTo(-L + 0.14, base);
      s.lineTo(-wheelZ - archR, base);
      s.lineTo(-wheelZ - archR, archY);
      s.absarc(-wheelZ, archY, archR, Math.PI, 0, true);
      s.lineTo(-wheelZ + archR, base);
      s.lineTo(wheelZ - archR, base);
      s.lineTo(wheelZ - archR, archY);
      s.absarc(wheelZ, archY, archR, Math.PI, 0, true);
      s.lineTo(wheelZ + archR, base);
      s.lineTo(L - 0.14, base);
      s.quadraticCurveTo(L - 0.02, base + 0.14, L - 0.06, noseY);
      s.quadraticCurveTo(L * 0.72, beltY - 0.06, L * 0.42, beltY - 0.01);
      s.lineTo(-L * 0.68, beltY);
      s.lineTo(-L + 0.08, beltY - 0.04);
      s.quadraticCurveTo(-L - 0.01, base + 0.26, -L + 0.14, base);
      s.closePath();

      const geo = new THREE.ExtrudeGeometry(s, {
        depth: flankDepth,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.025,
        bevelSegments: 2,
        curveSegments: 12,
      });
      geo.translate(0, 0, -flankDepth / 2);
      geo.rotateY(-Math.PI / 2);
      geo.computeVertexNormals();
      return geo;
    },
  );
}

// Sculpted contoured hood panel with nose curve
function getHoodGeometry(hoodLen: number, hoodW: number): THREE.BufferGeometry {
  return cachedGeo(`hood_${hoodLen.toFixed(2)}_${hoodW.toFixed(2)}`, () => {
    const s = new THREE.Shape();
    const hl = hoodLen * 0.5;
    s.moveTo(-hl, 0);
    s.lineTo(hl, -0.09);
    s.quadraticCurveTo(hl + 0.05, -0.02, hl - 0.04, 0.04);
    s.quadraticCurveTo(0, 0.09, -hl, 0.06);
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth: hoodW,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -hoodW / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

// Tapered cabin roof shell
function getRoofGeometry(roofLen: number, roofW: number): THREE.BufferGeometry {
  return cachedGeo(`roof_${roofLen.toFixed(2)}_${roofW.toFixed(2)}`, () => {
    const hl = roofLen * 0.5;
    const s = new THREE.Shape();
    s.moveTo(-hl, 0);
    s.lineTo(hl, 0);
    s.quadraticCurveTo(hl * 0.72, 0.07, 0, 0.08);
    s.quadraticCurveTo(-hl * 0.72, 0.07, -hl, 0);
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth: roofW,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -roofW / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

// Wrap-around sculpted front or rear bumper
function getBumperGeometry(bumperW: number, bumperH: number, bumperD: number): THREE.BufferGeometry {
  return cachedGeo(`bumper_${bumperW.toFixed(2)}_${bumperH.toFixed(2)}_${bumperD.toFixed(2)}`, () => {
    const hw = bumperW * 0.5;
    const s = new THREE.Shape();
    // Planform curve (X = width, Y = forward/back curve)
    s.moveTo(-hw, 0);
    s.lineTo(-hw * 0.92, bumperD * 0.65);
    s.quadraticCurveTo(0, bumperD * 1.12, hw * 0.92, bumperD * 0.65);
    s.lineTo(hw, 0);
    s.quadraticCurveTo(0, bumperD * 0.18, -hw, 0);
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth: bumperH,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 2,
      curveSegments: 10,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -bumperH * 0.5, 0);
    geo.computeVertexNormals();
    return geo;
  });
}

// Airfoil GT Spoiler blade for sports car
function getWingBladeGeometry(wingW: number): THREE.BufferGeometry {
  return cachedGeo(`wing_${wingW.toFixed(2)}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-0.16, 0.02);
    s.lineTo(0.16, 0.0);
    s.quadraticCurveTo(0.12, 0.055, -0.14, 0.055);
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth: wingW,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -wingW / 2);
    geo.rotateY(-Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

export function createVehicle(
  id: string,
  kind: VehicleKind,
  x: number,
  z: number,
  heading: number,
  contactShadowTex: THREE.Texture,
  reflections: boolean,
  customColor?: number,
  textures?: ProceduralTextureSet,
): VehicleInstance {
  const spec = VEHICLE_SPECS[kind];
  const startY = vehicleSurfaceHeightAt(x, z);
  const group = new THREE.Group();
  group.position.set(x, startY, z);
  group.rotation.y = heading;

  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  let paintColor = customColor ?? 0xdc2626;
  if (customColor === undefined) {
    if (kind === 'sports') paintColor = SPORTS_COLORS[Math.floor(Math.random() * SPORTS_COLORS.length)];
    else if (kind === 'sedan') paintColor = SEDAN_COLORS[Math.floor(Math.random() * SEDAN_COLORS.length)];
    else if (kind === 'suv') paintColor = SUV_COLORS[Math.floor(Math.random() * SUV_COLORS.length)];
    else if (kind === 'moto') paintColor = 0x1d4ed8;
    else if (kind === 'van') paintColor = 0xf1f5f9;
    else if (kind === 'police') paintColor = 0x0f172a;
  }

  const mats = getSharedMaterials();
  const paintMat = getPaintMaterial(paintColor, reflections);

  // Per-vehicle dynamic lighting materials
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfffbeb,
    emissiveIntensity: 0.6,
    roughness: 0.1,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.4,
    roughness: 0.15,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xff1a1a,
    emissiveIntensity: 0.12,
    roughness: 0.15,
  });
  const reverseLightMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xffffff,
    emissiveIntensity: 0.05,
    roughness: 0.15,
  });
  const turnLeftMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.05,
    roughness: 0.2,
  });
  const turnRightMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.05,
    roughness: 0.2,
  });

  // Ground Contact Shadow
  const shadowPlane = new THREE.Mesh(
    cachedGeo(`shadow_${kind}`, () => new THREE.PlaneGeometry(spec.halfWidth * 2.55, spec.halfLength * 2.4)),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.62,
    }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.03;
  group.add(shadowPlane);

  const wheelNodes: WheelNode[] = [];
  const wheelMeshes: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Object3D[] = [];

  const addWheel = (wx: number, wy: number, wz: number, isFront: boolean, thickness = 0.28) => {
    const pivot = new THREE.Group();
    pivot.position.set(wx, wy, wz);
    const wheelObj = new THREE.Group();
    // Face outer dish outward on both left (+X) and right (-X) sides without negative scale
    if (wx < 0) wheelObj.rotation.y = Math.PI;

    const r = spec.wheelRadius;
    const tireGeo = getTireGeometry(r, thickness);
    const tire = new THREE.Mesh(tireGeo, mats.tireMat);
    tire.castShadow = true;
    wheelObj.add(tire);

    // Outer metallic barrel lip
    const barrelGeo = cachedGeo(`barrel_${r.toFixed(3)}_${thickness.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.63, r * 0.63, thickness * 0.88, 16, 1, true);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    wheelObj.add(new THREE.Mesh(barrelGeo, mats.darkAlloyMat));

    // Inner dark backing disc
    const rimBackGeo = cachedGeo(`rimback_${r.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.6, r * 0.6, 0.03, 14);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const rimBack = new THREE.Mesh(rimBackGeo, mats.trimMat);
    rimBack.position.x = -thickness * 0.14;
    wheelObj.add(rimBack);

    // Multi-Spoke Alloy Rim (6 rugged spokes on SUV, 5 twin-spokes on Sports/Sedan)
    const spokeCount = kind === 'suv' || kind === 'van' ? 6 : 5;
    const spokeMat = kind === 'sports' ? mats.darkAlloyMat : mats.alloyMat;
    const spokeGeo = cachedGeo(`spoke_${r.toFixed(3)}_${spokeCount}`, () => {
      return new THREE.BoxGeometry(0.035, r * 0.56, r * 0.11);
    });
    const outerFaceX = thickness * 0.36;

    for (let s = 0; s < spokeCount; s++) {
      const angle = (s / spokeCount) * Math.PI * 2;
      if (kind === 'sports') {
        // Twin V-spoke design
        for (const split of [-0.075, 0.075]) {
          const sp = new THREE.Mesh(spokeGeo, spokeMat);
          const a = angle + split;
          sp.position.set(outerFaceX, Math.cos(a) * r * 0.31, Math.sin(a) * r * 0.31);
          sp.rotation.x = -a;
          wheelObj.add(sp);
        }
      } else {
        const sp = new THREE.Mesh(spokeGeo, spokeMat);
        sp.position.set(outerFaceX, Math.cos(angle) * r * 0.31, Math.sin(angle) * r * 0.31);
        sp.rotation.x = -angle;
        wheelObj.add(sp);
      }
    }

    // Polished alloy rim lip ring
    const lipGeo = cachedGeo(`lip_${r.toFixed(3)}`, () => {
      const g = new THREE.TorusGeometry(r * 0.59, 0.022, 6, 18);
      g.rotateY(Math.PI / 2);
      return g;
    });
    const lip = new THREE.Mesh(lipGeo, mats.chromeMat);
    lip.position.x = outerFaceX;
    wheelObj.add(lip);

    // Center hubcap
    const hubGeo = cachedGeo(`hub_${r.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.15, r * 0.17, 0.055, 10);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const hub = new THREE.Mesh(hubGeo, mats.trimMat);
    hub.position.x = outerFaceX + 0.005;
    wheelObj.add(hub);

    // Non-spinning Ventilated Brake Rotor & Caliper mounted to steering pivot (cars only)
    if (kind !== 'moto') {
      const sign = wx >= 0 ? 1 : -1;
      const rotorGeo = cachedGeo(`rotor_${r.toFixed(3)}`, () => {
        const g = new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.025, 14);
        g.rotateZ(Math.PI / 2);
        return g;
      });
      const rotor = new THREE.Mesh(rotorGeo, mats.rotorMat);
      rotor.position.x = sign * thickness * 0.08;
      pivot.add(rotor);

      const caliperGeo = cachedGeo(`caliper_${r.toFixed(3)}`, () => {
        return new THREE.BoxGeometry(0.06, r * 0.28, r * 0.22);
      });
      const caliper = new THREE.Mesh(
        caliperGeo,
        kind === 'sports' ? mats.caliperRedMat : mats.caliperSteelMat,
      );
      caliper.position.set(sign * thickness * 0.12, r * 0.16, isFront ? -r * 0.28 : r * 0.28);
      pivot.add(caliper);
    }

    pivot.add(wheelObj);
    group.add(pivot);
    wheelMeshes.push(wheelObj);
    if (isFront) frontSteerPivots.push(pivot);
    wheelNodes.push({
      pivot,
      spinMesh: wheelObj,
      localX: wx,
      localZ: wz,
      restY: wy,
      isFront,
    });
  };

  let sirenRedMat: THREE.MeshStandardMaterial | undefined;
  let sirenBlueMat: THREE.MeshStandardMaterial | undefined;

  if (kind === 'moto') {
    // Sculpted Sport Superbike (Bati 801)
    addWheel(0, spec.wheelRadius, 0.82, true, 0.15);
    addWheel(0, spec.wheelRadius, -0.82, false, 0.21);

    // Lower crankcase & twin-spar frame
    const engineBlock = new THREE.Mesh(
      cachedGeo('moto_engine', () => new THREE.BoxGeometry(0.32, 0.36, 0.62)),
      mats.darkAlloyMat,
    );
    engineBlock.position.set(0, 0.48, 0.02);
    engineBlock.castShadow = true;
    bodyGroup.add(engineBlock);

    // USD Front Forks
    for (const fx of [-0.11, 0.11]) {
      const fork = new THREE.Mesh(
        cachedGeo('moto_fork', () => new THREE.CylinderGeometry(0.026, 0.022, 0.72, 8)),
        mats.chromeMat,
      );
      fork.position.set(fx, 0.66, 0.64);
      fork.rotation.x = -0.38;
      bodyGroup.add(fork);
    }

    // Rear Swingarm
    for (const sx of [-0.12, 0.12]) {
      const arm = new THREE.Mesh(
        cachedGeo('moto_swing', () => new THREE.BoxGeometry(0.045, 0.07, 0.68)),
        mats.alloyMat,
      );
      arm.position.set(sx, 0.36, -0.48);
      arm.rotation.x = 0.08;
      bodyGroup.add(arm);
    }

    // Sculpted Fuel Tank
    const tankGeo = cachedGeo('moto_tank', () => {
      const g = new THREE.SphereGeometry(0.28, 12, 10);
      g.scale(0.84, 0.65, 1.38);
      return g;
    });
    const tank = new THREE.Mesh(tankGeo, paintMat);
    tank.position.set(0, 0.84, 0.16);
    tank.castShadow = true;
    bodyGroup.add(tank);

    // Tail cowl & Rider Seat
    const seat = new THREE.Mesh(
      cachedGeo('moto_seat', () => new THREE.BoxGeometry(0.3, 0.12, 0.62)),
      mats.seatMat,
    );
    seat.position.set(0, 0.76, -0.34);
    seat.rotation.x = -0.06;
    bodyGroup.add(seat);

    const tailCowl = new THREE.Mesh(
      cachedGeo('moto_tail', () => new THREE.BoxGeometry(0.28, 0.16, 0.42)),
      paintMat,
    );
    tailCowl.position.set(0, 0.84, -0.72);
    tailCowl.rotation.x = -0.22;
    bodyGroup.add(tailCowl);

    // Aero Front Fairing Nose & Windscreen
    const fairing = new THREE.Mesh(
      cachedGeo('moto_fairing', () => new THREE.BoxGeometry(0.42, 0.36, 0.56)),
      paintMat,
    );
    fairing.position.set(0, 0.84, 0.62);
    fairing.rotation.x = -0.34;
    fairing.castShadow = true;
    bodyGroup.add(fairing);

    const windscreen = new THREE.Mesh(
      cachedGeo('moto_screen', () => new THREE.BoxGeometry(0.32, 0.24, 0.04)),
      mats.glassMat,
    );
    windscreen.position.set(0, 1.07, 0.6);
    windscreen.rotation.x = -0.68;
    bodyGroup.add(windscreen);

    const handlebar = new THREE.Mesh(
      cachedGeo('moto_bar', () => new THREE.CylinderGeometry(0.022, 0.022, 0.74, 8)),
      mats.chromeMat,
    );
    handlebar.rotation.z = Math.PI / 2;
    handlebar.position.set(0, 1.01, 0.5);
    bodyGroup.add(handlebar);

    for (const ex of [-0.18, 0.18]) {
      const exhaust = new THREE.Mesh(
        cachedGeo('moto_pipe', () => new THREE.CylinderGeometry(0.048, 0.065, 0.64, 8)),
        mats.chromeMat,
      );
      exhaust.rotation.x = Math.PI / 2 - 0.18;
      exhaust.position.set(ex, 0.44, -0.52);
      bodyGroup.add(exhaust);
    }

    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.11, 0.06), headlightMat);
    hl.position.set(0, 0.84, 0.91);
    bodyGroup.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.06), taillightMat);
    tl.position.set(0, 0.88, -0.94);
    bodyGroup.add(tl);

    const br = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.06), brakeLightMat);
    br.position.set(0, 0.82, -0.94);
    bodyGroup.add(br);

    const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), turnLeftMat);
    tlLeft.position.set(0.15, 0.8, -0.9);
    bodyGroup.add(tlLeft);
    const tlRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.06), turnRightMat);
    tlRight.position.set(-0.15, 0.8, -0.9);
    bodyGroup.add(tlRight);
  } else if (kind === 'van') {
    // Upgraded Sculpted Commercial Cargo Van
    const w = spec.halfWidth * 2;
    const L = spec.halfLength;
    const wheelZ = L * 0.63;
    const wheelX = spec.halfWidth - 0.13;

    addWheel(-wheelX, spec.wheelRadius, wheelZ, true, 0.27);
    addWheel(wheelX, spec.wheelRadius, wheelZ, true, 0.27);
    addWheel(-wheelX, spec.wheelRadius, -wheelZ, false, 0.28);
    addWheel(wheelX, spec.wheelRadius, -wheelZ, false, 0.28);

    // Lower skirt chassis + wheel well liners
    const chassis = new THREE.Mesh(
      cachedGeo('van_chassis', () => new THREE.BoxGeometry(w * 0.86, 0.34, L * 1.92)),
      mats.trimMat,
    );
    chassis.position.set(0, 0.44, 0);
    bodyGroup.add(chassis);

    // Contoured cargo hull (side profile extruded)
    const vanHullGeo = cachedGeo('van_hull', () => {
      const s = new THREE.Shape();
      s.moveTo(-L + 0.06, 0.38);
      s.lineTo(L - 0.06, 0.38);
      s.lineTo(L, 0.88);
      s.lineTo(L * 0.68, 1.08);
      s.lineTo(L * 0.35, 2.02); // sloped van windshield
      s.lineTo(-L + 0.12, 2.04);
      s.lineTo(-L + 0.02, 1.15);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth: w * 0.9,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.04,
        bevelSegments: 2,
      });
      g.translate(0, 0, -(w * 0.9) / 2);
      g.rotateY(-Math.PI / 2);
      g.computeVertexNormals();
      return g;
    });
    const hull = new THREE.Mesh(vanHullGeo, paintMat);
    hull.castShadow = true;
    hull.receiveShadow = true;
    bodyGroup.add(hull);

    // Flared Wheel Arches
    const archGeo = getFenderArchGeometry(spec.wheelRadius + 0.14, spec.wheelRadius + 0.03, 0.22);
    for (const sx of [-spec.halfWidth + 0.08, spec.halfWidth - 0.08]) {
      for (const sz of [wheelZ, -wheelZ]) {
        const arch = new THREE.Mesh(archGeo, mats.trimMat);
        arch.position.set(sx, spec.wheelRadius, sz);
        bodyGroup.add(arch);
      }
    }

    // Windshield + Side Cab Windows
    const windshield = new THREE.Mesh(
      cachedGeo('van_ws', () => new THREE.BoxGeometry(w * 0.84, 0.82, 0.06)),
      mats.glassMat,
    );
    windshield.position.set(0, 1.54, L * 0.54);
    windshield.rotation.x = -0.34;
    bodyGroup.add(windshield);

    const sideWin = new THREE.Mesh(
      cachedGeo('van_swin', () => new THREE.BoxGeometry(w * 0.94, 0.64, 0.88)),
      mats.glassMat,
    );
    sideWin.position.set(0, 1.52, L * 0.22);
    bodyGroup.add(sideWin);

    // Grille & Front/Rear Bumpers
    const fBumper = new THREE.Mesh(getBumperGeometry(w * 0.98, 0.26, 0.22), mats.trimMat);
    fBumper.position.set(0, 0.42, L - 0.1);
    bodyGroup.add(fBumper);

    const rBumper = new THREE.Mesh(getBumperGeometry(w * 0.98, 0.24, 0.2), mats.trimMat);
    rBumper.rotation.y = Math.PI;
    rBumper.position.set(0, 0.4, -L + 0.1);
    bodyGroup.add(rBumper);

    const grille = new THREE.Mesh(
      cachedGeo('van_grille', () => new THREE.BoxGeometry(w * 0.52, 0.24, 0.08)),
      mats.trimMat,
    );
    grille.position.set(0, 0.72, L + 0.02);
    bodyGroup.add(grille);

    // Mirrors
    for (const sx of [-spec.halfWidth - 0.03, spec.halfWidth + 0.03]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.12), mats.trimMat);
      m.position.set(sx, 1.38, L * 0.44);
      bodyGroup.add(m);
    }

    // Roof Rack Bars
    for (const rz of [-1.2, 0, 1.0]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.05, 0.07), mats.darkAlloyMat);
      bar.position.set(0, 2.09, rz);
      bodyGroup.add(bar);
    }

    // Lights
    for (const lx of [-spec.halfWidth * 0.7, spec.halfWidth * 0.7]) {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), headlightMat);
      hl.position.set(lx, 0.72, L + 0.01);
      bodyGroup.add(hl);

      const fTurn = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.1, 0.08),
        lx > 0 ? turnLeftMat : turnRightMat,
      );
      fTurn.position.set(lx > 0 ? lx + 0.2 : lx - 0.2, 0.72, L);
      bodyGroup.add(fTurn);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, 0.08), taillightMat);
      tl.position.set(lx, 0.88, -L + 0.01);
      bodyGroup.add(tl);

      const br = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.08), brakeLightMat);
      br.position.set(lx, 0.68, -L + 0.01);
      bodyGroup.add(br);

      const rTurn = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.1, 0.08),
        lx > 0 ? turnLeftMat : turnRightMat,
      );
      rTurn.position.set(lx, 1.06, -L + 0.01);
      bodyGroup.add(rTurn);
    }
  } else {
    // -------------------------------------------------------------------------
    // REALISTIC MULTI-PART CAR (Sports, Sedan, SUV, Police Interceptor)
    // -------------------------------------------------------------------------
    const isSports = kind === 'sports';
    const isSuv = kind === 'suv';
    const isPolice = kind === 'police';

    const w = spec.halfWidth * 2;
    const L = spec.halfLength;
    const wheelZ = L * (isSports ? 0.63 : 0.61);
    const wheelX = spec.halfWidth - 0.14;
    const wheelW = isSports ? 0.31 : isSuv ? 0.3 : 0.27;

    addWheel(-wheelX, spec.wheelRadius, wheelZ, true, wheelW);
    addWheel(wheelX, spec.wheelRadius, wheelZ, true, wheelW);
    addWheel(-wheelX, spec.wheelRadius, -wheelZ, false, wheelW + 0.02);
    addWheel(wheelX, spec.wheelRadius, -wheelZ, false, wheelW + 0.02);

    // Proportions tuned per vehicle class
    const baseClearance = isSuv ? 0.34 : isSports ? 0.2 : 0.24;
    const beltY = isSuv ? 1.04 : isSports ? 0.78 : 0.86;
    const roofY = isSuv ? 1.68 : isSports ? 1.24 : 1.38;
    const cabHalfW = spec.halfWidth * (isSuv ? 0.8 : isSports ? 0.76 : 0.78);

    // 1. Sculpted Lower Core Body (recessed inward so tires sit cleanly inside deep wheel arches)
    const lowerHull = new THREE.Mesh(getLowerChassisGeometry(kind, spec.halfWidth, L), paintMat);
    lowerHull.castShadow = true;
    lowerHull.receiveShadow = true;
    bodyGroup.add(lowerHull);

    // Open-ended recessed dark wheel-well arch liners behind each tire (never obstructing alloy rims)
    const wellGeo = cachedGeo(`well_${spec.wheelRadius.toFixed(2)}`, () => {
      const g = new THREE.CylinderGeometry(
        spec.wheelRadius + 0.09,
        spec.wheelRadius + 0.09,
        0.28,
        14,
        1,
        true,
        0,
        Math.PI,
      );
      g.rotateZ(Math.PI / 2);
      g.rotateX(Math.PI / 2);
      return g;
    });
    for (const side of [-1, 1]) {
      for (const sz of [wheelZ, -wheelZ]) {
        const liner = new THREE.Mesh(wellGeo, mats.trimMat);
        liner.position.set(side * (wheelX - 0.14), spec.wheelRadius + 0.01, sz);
        bodyGroup.add(liner);
      }
    }

    // 2. Sculpted Flared Wheel-Arch Fenders (4 arches framing the tires)
    const archOuterR = spec.wheelRadius + (isSuv ? 0.14 : 0.11);
    const archInnerR = spec.wheelRadius + 0.045;
    const archWidth = 0.12;
    const archGeo = getFenderArchGeometry(archOuterR, archInnerR, archWidth);
    const archMat = isSuv ? mats.trimMat : paintMat;
    for (const side of [-1, 1]) {
      for (const sz of [wheelZ, -wheelZ]) {
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.set(side * (spec.halfWidth - 0.05), spec.wheelRadius, sz);
        bodyGroup.add(arch);
      }
    }

    // 3. Seamless Continuous Side Flanks (fenders + doors + quarter panels) & Rocker Skirts
    const doorLen = wheelZ * 2 - (spec.wheelRadius + 0.14) * 2;
    const doorH = beltY - baseClearance - 0.06;
    const flankGeo = getSideFlankGeometry(kind, L, wheelZ, spec.wheelRadius, 0.22);
    for (const side of [-1, 1]) {
      const flank = new THREE.Mesh(flankGeo, paintMat);
      flank.position.set(side * (spec.halfWidth - 0.13), 0, 0);
      flank.castShadow = true;
      flank.receiveShadow = true;
      bodyGroup.add(flank);

      // Lower Rocker Skirt Trim / SUV Running Board
      const skirt = new THREE.Mesh(
        cachedGeo(`skirt_${kind}`, () => new THREE.BoxGeometry(isSuv ? 0.18 : 0.11, 0.075, doorLen + 0.04)),
        mats.trimMat,
      );
      skirt.position.set(side * (spec.halfWidth - (isSuv ? 0.02 : 0.05)), baseClearance + 0.01, 0);
      bodyGroup.add(skirt);

      // Chrome / Body Door Handles (2 for Sports, 4 for Sedan/SUV/Police)
      const handleMat = isSports ? paintMat : mats.chromeMat;
      const handleGeo = cachedGeo('handle', () => new THREE.BoxGeometry(0.05, 0.036, 0.18));
      const handleOffsets = isSports ? [0.05] : [0.32, -0.45];
      for (const hz of handleOffsets) {
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.position.set(side * (spec.halfWidth + 0.01), beltY - 0.11, hz);
        bodyGroup.add(handle);
      }

      // Sports Car Side Aero Intake Scoop behind door
      if (isSports) {
        const scoop = new THREE.Mesh(
          cachedGeo('sports_scoop', () => new THREE.BoxGeometry(0.07, 0.24, 0.36)),
          mats.carbonMat,
        );
        scoop.position.set(side * (spec.halfWidth - 0.02), beltY - 0.24, -wheelZ + spec.wheelRadius + 0.22);
        bodyGroup.add(scoop);
      }
    }

    // Police White Livery Doors & Star Decal overlay
    if (isPolice) {
      const copDoorGeo = cachedGeo('cop_door_panel', () => new THREE.BoxGeometry(0.24, doorH, doorLen));
      for (const side of [-1, 1]) {
        const copDoor = new THREE.Mesh(copDoorGeo, mats.whitePaintMat);
        copDoor.position.set(side * (spec.halfWidth - 0.125), baseClearance + 0.04 + doorH * 0.5, 0);
        bodyGroup.add(copDoor);
      }
      if (textures) {
        const decalMat = new THREE.MeshStandardMaterial({
          map: textures.policeDoorDecal,
          roughness: 0.25,
          metalness: 0.15,
        });
        const decalGeo = cachedGeo('cop_decal', () => new THREE.PlaneGeometry(1.18, 0.44));
        for (const side of [-1, 1]) {
          const decal = new THREE.Mesh(decalGeo, decalMat);
          decal.position.set(side * (spec.halfWidth + 0.018), baseClearance + 0.04 + doorH * 0.5, 0);
          decal.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
          bodyGroup.add(decal);
        }
      }
    }

    // 4. Contoured Sculpted Hood + Power Dome / Vents
    const hoodLen = L * 0.62;
    const hoodW = w * 0.78;
    const hood = new THREE.Mesh(getHoodGeometry(hoodLen, hoodW), paintMat);
    hood.position.set(0, beltY - 0.05, L * 0.56);
    bodyGroup.add(hood);

    if (isSports) {
      // Twin hood extractor vents
      for (const vx of [-0.34, 0.34]) {
        const vent = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.03, 0.32), mats.carbonMat);
        vent.position.set(vx, beltY + 0.01, L * 0.54);
        vent.rotation.x = 0.08;
        bodyGroup.add(vent);
      }
    }

    // 5. Wrap-Around Front & Rear Bumpers + Splitter + Diffuser
    const frontBumper = new THREE.Mesh(getBumperGeometry(w * 0.96, isSuv ? 0.34 : 0.28, 0.24), paintMat);
    frontBumper.position.set(0, baseClearance + 0.15, L - 0.12);
    bodyGroup.add(frontBumper);

    const frontLip = new THREE.Mesh(
      getBumperGeometry(w * 0.98, 0.08, 0.26),
      isSuv ? mats.alloyMat : isSports ? mats.carbonMat : mats.trimMat,
    );
    frontLip.position.set(0, baseClearance - 0.01, L - 0.08);
    bodyGroup.add(frontLip);

    // Front Grille Surround (Chrome/Dark) + Inner Grille Slats
    const grilleW = w * (isSuv ? 0.58 : 0.54);
    const grilleH = isSuv ? 0.26 : isSports ? 0.18 : 0.22;
    const grilleY = baseClearance + (isSuv ? 0.34 : 0.24);
    const grilleFrame = new THREE.Mesh(
      cachedGeo(`gframe_${kind}`, () => new THREE.BoxGeometry(grilleW + 0.06, grilleH + 0.05, 0.08)),
      isSports ? mats.carbonMat : mats.chromeMat,
    );
    grilleFrame.position.set(0, grilleY, L + 0.04);
    bodyGroup.add(grilleFrame);

    const grilleMesh = new THREE.Mesh(
      cachedGeo(`gmesh_${kind}`, () => new THREE.BoxGeometry(grilleW, grilleH, 0.095)),
      mats.trimMat,
    );
    grilleMesh.position.set(0, grilleY, L + 0.045);
    bodyGroup.add(grilleMesh);

    // Chrome badge emblem on grille
    const emblem = new THREE.Mesh(
      cachedGeo('emblem', () => new THREE.CylinderGeometry(0.055, 0.055, 0.03, 10)),
      mats.chromeMat,
    );
    emblem.rotation.x = Math.PI / 2;
    emblem.position.set(0, grilleY + (isSports ? 0.12 : 0.0), L + 0.09);
    bodyGroup.add(emblem);

    // Rear Bumper + Diffuser + License Plate + Exhausts
    const rearBumper = new THREE.Mesh(getBumperGeometry(w * 0.96, isSuv ? 0.34 : 0.28, 0.22), paintMat);
    rearBumper.rotation.y = Math.PI;
    rearBumper.position.set(0, baseClearance + 0.16, -L + 0.12);
    bodyGroup.add(rearBumper);

    const rearDiffuser = new THREE.Mesh(
      cachedGeo(`diffuser_${kind}`, () => new THREE.BoxGeometry(w * 0.78, 0.14, 0.14)),
      isSuv ? mats.alloyMat : isSports ? mats.carbonMat : mats.trimMat,
    );
    rearDiffuser.position.set(0, baseClearance + 0.04, -L - 0.02);
    bodyGroup.add(rearDiffuser);

    const plateMat = textures
      ? new THREE.MeshStandardMaterial({ map: textures.licensePlate, roughness: 0.4 })
      : mats.whitePaintMat;
    const plate = new THREE.Mesh(
      cachedGeo('plate', () => new THREE.BoxGeometry(0.44, 0.19, 0.03)),
      plateMat,
    );
    plate.position.set(0, baseClearance + (isSuv ? 0.36 : 0.28), -L - 0.075);
    bodyGroup.add(plate);

    // Chrome Exhaust Tips (Quad on Sports, Dual on Sedan/SUV/Police)
    const pipeGeo = cachedGeo('exhaust_tip', () => new THREE.CylinderGeometry(0.052, 0.052, 0.18, 10));
    const pipeOffsets = isSports ? [-0.58, -0.44, 0.44, 0.58] : [-0.54, 0.54];
    for (const ex of pipeOffsets) {
      const pipe = new THREE.Mesh(pipeGeo, mats.chromeMat);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(ex, baseClearance + 0.05, -L - 0.08);
      bodyGroup.add(pipe);
    }

    // 6. Interior Cockpit (Visible through Transparent Tinted Windows!)
    const cabinFloorY = baseClearance + 0.18;
    const seatGeo = cachedGeo('car_seat', () => new THREE.BoxGeometry(0.46, 0.52, 0.44));
    const headrestGeo = cachedGeo('car_headrest', () => new THREE.BoxGeometry(0.24, 0.18, 0.12));
    for (const sx of [-0.42, 0.42]) {
      const seat = new THREE.Mesh(seatGeo, mats.seatMat);
      seat.position.set(sx, cabinFloorY + 0.28, -0.05);
      seat.rotation.x = -0.18;
      bodyGroup.add(seat);

      const hr = new THREE.Mesh(headrestGeo, mats.seatMat);
      hr.position.set(sx, cabinFloorY + 0.62, -0.14);
      bodyGroup.add(hr);
    }
    // Rear bench seat
    const rearBench = new THREE.Mesh(
      cachedGeo('car_rear_seat', () => new THREE.BoxGeometry(cabHalfW * 1.65, 0.44, 0.46)),
      mats.seatMat,
    );
    rearBench.position.set(0, cabinFloorY + 0.25, -0.78);
    rearBench.rotation.x = -0.14;
    bodyGroup.add(rearBench);

    // Dashboard & Center Console
    const dash = new THREE.Mesh(
      cachedGeo(`dash_${kind}`, () => new THREE.BoxGeometry(cabHalfW * 1.85, 0.26, 0.42)),
      mats.interiorMat,
    );
    dash.position.set(0, beltY - 0.04, 0.48);
    bodyGroup.add(dash);

    const consoleMesh = new THREE.Mesh(
      cachedGeo('console', () => new THREE.BoxGeometry(0.24, 0.22, 1.1)),
      mats.interiorMat,
    );
    consoleMesh.position.set(0, cabinFloorY + 0.16, 0.04);
    bodyGroup.add(consoleMesh);

    // Left-Hand-Drive Steering Wheel (+X = driver left)
    const steerWheel = new THREE.Mesh(
      cachedGeo('steer_wheel', () => new THREE.TorusGeometry(0.16, 0.024, 6, 14)),
      mats.trimMat,
    );
    steerWheel.position.set(0.42, beltY + 0.08, 0.34);
    steerWheel.rotation.x = -0.35;
    bodyGroup.add(steerWheel);

    // 7. Tapered Upper Greenhouse: Sculpted Roof + Raked Windshield + Pillars + Transparent Glass
    const cabinFrontZ = isSports ? 0.56 : isSuv ? 0.68 : 0.62;
    const cabinRearZ = isSports ? -1.42 : isSuv ? -1.88 : -1.48;
    const roofFrontZ = isSports ? 0.02 : isSuv ? 0.16 : 0.12;
    const roofRearZ = isSports ? -0.92 : isSuv ? -1.68 : -0.98;
    const roofLen = roofFrontZ - roofRearZ;
    const roofCenterZ = (roofFrontZ + roofRearZ) * 0.5;
    const roofW = cabHalfW * 1.94;

    const roof = new THREE.Mesh(
      getRoofGeometry(roofLen, roofW),
      isPolice ? mats.whitePaintMat : paintMat,
    );
    roof.position.set(0, roofY - 0.03, roofCenterZ);
    roof.castShadow = true;
    bodyGroup.add(roof);

    // Shark-fin roof antenna
    const antenna = new THREE.Mesh(
      cachedGeo('antenna', () => new THREE.ConeGeometry(0.045, 0.14, 4)),
      isPolice ? mats.whitePaintMat : paintMat,
    );
    antenna.position.set(0, roofY + 0.08, roofRearZ + 0.22);
    antenna.rotation.x = -0.35;
    bodyGroup.add(antenna);

    // Raked Windshield (transparent glass)
    const wsDx = cabinFrontZ - roofFrontZ;
    const wsDy = roofY - beltY;
    const wsLen = Math.hypot(wsDx, wsDy);
    const wsAngle = Math.atan2(wsDx, wsDy);
    const windshield = new THREE.Mesh(
      cachedGeo(`ws_${kind}`, () => new THREE.PlaneGeometry(cabHalfW * 1.88, wsLen)),
      mats.glassMat,
    );
    windshield.position.set(0, (beltY + roofY) * 0.5, (cabinFrontZ + roofFrontZ) * 0.5);
    windshield.rotation.x = -wsAngle;
    windshield.renderOrder = 2;
    bodyGroup.add(windshield);

    // Raked Rear Window (transparent glass)
    const rwDx = roofRearZ - cabinRearZ;
    const rwLen = Math.hypot(rwDx, wsDy);
    const rwAngle = Math.atan2(rwDx, wsDy);
    const rearGlass = new THREE.Mesh(
      cachedGeo(`rw_${kind}`, () => new THREE.PlaneGeometry(cabHalfW * 1.86, rwLen)),
      mats.glassMat,
    );
    rearGlass.position.set(0, (beltY + roofY) * 0.5, (cabinRearZ + roofRearZ) * 0.5);
    rearGlass.rotation.x = Math.PI + rwAngle;
    rearGlass.renderOrder = 2;
    bodyGroup.add(rearGlass);

    // Left & Right Tumblehome Side Windows + A/B/C Pillars
    const sideGlassLen = (cabinFrontZ - cabinRearZ) * 0.72;
    const sideGlassH = (roofY - beltY) * 0.94;
    const tumbleTilt = (spec.halfWidth - cabHalfW - 0.08) / Math.max(0.25, sideGlassH);
    const pillarMat = paintMat;

    for (const side of [-1, 1]) {
      const sideX = side * (cabHalfW + (spec.halfWidth - cabHalfW) * 0.35);

      const sWin = new THREE.Mesh(
        cachedGeo(`swin_${kind}`, () => new THREE.PlaneGeometry(sideGlassLen, sideGlassH)),
        mats.glassMat,
      );
      sWin.position.set(sideX, (beltY + roofY) * 0.5 - 0.01, (cabinFrontZ + cabinRearZ) * 0.5);
      sWin.rotation.set(0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      sWin.rotateX(-Math.atan(tumbleTilt));
      sWin.renderOrder = 2;
      bodyGroup.add(sWin);

      // A-Pillar
      const aPillar = new THREE.Mesh(
        cachedGeo(`apillar_${kind}`, () => new THREE.BoxGeometry(0.075, wsLen * 1.02, 0.08)),
        pillarMat,
      );
      aPillar.position.set(
        side * (cabHalfW - 0.02),
        (beltY + roofY) * 0.5,
        (cabinFrontZ + roofFrontZ) * 0.5,
      );
      aPillar.rotation.x = -wsAngle;
      aPillar.rotation.z = side * Math.atan(tumbleTilt);
      bodyGroup.add(aPillar);

      // B-Pillar
      const bPillar = new THREE.Mesh(
        cachedGeo(`bpillar_${kind}`, () => new THREE.BoxGeometry(0.065, sideGlassH * 1.04, 0.1)),
        mats.trimMat,
      );
      bPillar.position.set(sideX, (beltY + roofY) * 0.5, isSports ? -0.24 : -0.14);
      bPillar.rotation.z = side * Math.atan(tumbleTilt);
      bodyGroup.add(bPillar);

      // C-Pillar
      const cPillar = new THREE.Mesh(
        cachedGeo(`cpillar_${kind}`, () => new THREE.BoxGeometry(0.085, rwLen * 1.02, 0.14)),
        pillarMat,
      );
      cPillar.position.set(
        side * (cabHalfW - 0.02),
        (beltY + roofY) * 0.5,
        (cabinRearZ + roofRearZ) * 0.5,
      );
      cPillar.rotation.x = rwAngle;
      cPillar.rotation.z = side * Math.atan(tumbleTilt);
      bodyGroup.add(cPillar);

      // Sculpted Aerodynamic Side Mirror (Stalk + Painted Cap + Mirror Face)
      const stalk = new THREE.Mesh(
        cachedGeo('mirror_stalk', () => new THREE.BoxGeometry(0.1, 0.045, 0.05)),
        mats.trimMat,
      );
      stalk.position.set(side * (spec.halfWidth - 0.02), beltY + 0.05, cabinFrontZ - 0.16);
      bodyGroup.add(stalk);

      const mirrorCap = new THREE.Mesh(
        cachedGeo('mirror_cap', () => new THREE.BoxGeometry(0.15, 0.09, 0.12)),
        isPolice ? mats.trimMat : paintMat,
      );
      mirrorCap.position.set(side * (spec.halfWidth + 0.05), beltY + 0.08, cabinFrontZ - 0.18);
      mirrorCap.rotation.y = side * -0.18;
      bodyGroup.add(mirrorCap);

      const mirrorFace = new THREE.Mesh(
        cachedGeo('mirror_face', () => new THREE.PlaneGeometry(0.12, 0.07)),
        mats.mirrorGlassMat,
      );
      mirrorFace.position.set(side * (spec.halfWidth + 0.05), beltY + 0.08, cabinFrontZ - 0.245);
      mirrorFace.rotation.y = Math.PI + side * -0.18;
      bodyGroup.add(mirrorFace);
    }

    // 8. Class-Specific Exterior Details (Spoilers / Roof Rails / Police Gear)
    if (isSports) {
      // Carbon Fiber GT Wing Spoiler on Twin Uprights
      const wingW = w * 0.92;
      const wingBlade = new THREE.Mesh(getWingBladeGeometry(wingW), mats.carbonMat);
      wingBlade.position.set(0, beltY + 0.24, -L + 0.22);
      wingBlade.castShadow = true;
      bodyGroup.add(wingBlade);

      for (const sx of [-0.48, 0.48]) {
        const strut = new THREE.Mesh(
          cachedGeo('wing_strut', () => new THREE.BoxGeometry(0.05, 0.22, 0.16)),
          mats.carbonMat,
        );
        strut.position.set(sx, beltY + 0.14, -L + 0.22);
        strut.rotation.x = 0.22;
        bodyGroup.add(strut);

        const endplate = new THREE.Mesh(
          cachedGeo('wing_end', () => new THREE.BoxGeometry(0.03, 0.14, 0.34)),
          mats.carbonMat,
        );
        endplate.position.set(sx > 0 ? wingW * 0.5 : -wingW * 0.5, beltY + 0.25, -L + 0.22);
        bodyGroup.add(endplate);
      }
    } else if (kind === 'sedan') {
      // Subtle painted trunk lip spoiler
      const lipSpoiler = new THREE.Mesh(
        cachedGeo('sedan_lip', () => new THREE.BoxGeometry(w * 0.78, 0.05, 0.12)),
        paintMat,
      );
      lipSpoiler.position.set(0, beltY + 0.04, -L + 0.12);
      bodyGroup.add(lipSpoiler);
    } else if (isSuv) {
      // Aluminum Roof Rails & Rear Roof Spoiler
      for (const sx of [-cabHalfW * 0.82, cabHalfW * 0.82]) {
        const rail = new THREE.Mesh(
          cachedGeo('suv_rail', () => new THREE.BoxGeometry(0.06, 0.06, roofLen * 0.9)),
          mats.alloyMat,
        );
        rail.position.set(sx, roofY + 0.06, roofCenterZ);
        bodyGroup.add(rail);
      }
      const roofWing = new THREE.Mesh(
        cachedGeo('suv_wing', () => new THREE.BoxGeometry(cabHalfW * 1.84, 0.07, 0.24)),
        paintMat,
      );
      roofWing.position.set(0, roofY + 0.02, roofRearZ - 0.1);
      bodyGroup.add(roofWing);
    }

    if (isPolice) {
      // Heavy Steel Push Bar with Vertical Uprights
      const pushW = w * 0.58;
      const pushTop = new THREE.Mesh(new THREE.BoxGeometry(pushW, 0.07, 0.08), mats.trimMat);
      pushTop.position.set(0, baseClearance + 0.42, L + 0.16);
      bodyGroup.add(pushTop);
      const pushMid = new THREE.Mesh(new THREE.BoxGeometry(pushW, 0.06, 0.08), mats.trimMat);
      pushMid.position.set(0, baseClearance + 0.22, L + 0.16);
      bodyGroup.add(pushMid);
      for (const px of [-pushW * 0.36, pushW * 0.36]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.12), mats.trimMat);
        upright.position.set(px, baseClearance + 0.28, L + 0.14);
        bodyGroup.add(upright);
      }

      // Low-Profile Aero LED Police Lightbar
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.06, 0.24), mats.trimMat);
      barBase.position.set(0, roofY + 0.07, -0.18);
      bodyGroup.add(barBase);

      sirenRedMat = new THREE.MeshStandardMaterial({
        color: 0xff2222,
        emissive: 0xff1111,
        emissiveIntensity: 0.25,
      });
      sirenBlueMat = new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.25,
      });

      const redPod = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.09, 0.22), sirenRedMat);
      redPod.position.set(-0.32, roofY + 0.12, -0.18);
      bodyGroup.add(redPod);

      const centerPod = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.22), mats.whitePaintMat);
      centerPod.position.set(0, roofY + 0.12, -0.18);
      bodyGroup.add(centerPod);

      const bluePod = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.09, 0.22), sirenBlueMat);
      bluePod.position.set(0.32, roofY + 0.12, -0.18);
      bodyGroup.add(bluePod);
    }

    // 9. Functional Automotive Lighting Clusters (Headlights + DRLs + Taillights + Brake + Reverse + Turn Signals)
    const fLightY = grilleY + (isSports ? 0.06 : 0.04);
    const rLightY = beltY - 0.1;

    for (const side of [-1, 1]) {
      const lx = side * spec.halfWidth * 0.68;
      const turnMat = side > 0 ? turnLeftMat : turnRightMat;

      // Headlight Housing + Projector Lens + DRL Accent Strip
      const hlHousing = new THREE.Mesh(
        cachedGeo('hl_housing', () => new THREE.BoxGeometry(0.38, 0.14, 0.12)),
        mats.trimMat,
      );
      hlHousing.position.set(lx, fLightY, L - 0.01);
      hlHousing.rotation.y = side * -0.14;
      bodyGroup.add(hlHousing);

      const hlLens = new THREE.Mesh(
        cachedGeo('hl_lens', () => new THREE.BoxGeometry(0.32, 0.09, 0.06)),
        headlightMat,
      );
      hlLens.position.set(lx, fLightY + 0.01, L + 0.03);
      hlLens.rotation.y = side * -0.14;
      bodyGroup.add(hlLens);

      // Front Outer Amber Turn Signal
      const fTurn = new THREE.Mesh(
        cachedGeo('fturn', () => new THREE.BoxGeometry(0.11, 0.045, 0.06)),
        turnMat,
      );
      fTurn.position.set(lx + side * 0.14, fLightY - 0.045, L + 0.01);
      fTurn.rotation.y = side * -0.22;
      bodyGroup.add(fTurn);

      // Rear LED Taillight Bar + Dedicated Brake Module + Reverse White Module + Amber Blinker
      const tlHousing = new THREE.Mesh(
        cachedGeo('tl_housing', () => new THREE.BoxGeometry(0.44, 0.15, 0.1)),
        mats.trimMat,
      );
      tlHousing.position.set(lx, rLightY, -L + 0.02);
      tlHousing.rotation.y = side * 0.1;
      bodyGroup.add(tlHousing);

      const tlBar = new THREE.Mesh(
        cachedGeo('tl_bar', () => new THREE.BoxGeometry(0.38, 0.05, 0.05)),
        taillightMat,
      );
      tlBar.position.set(lx, rLightY + 0.035, -L - 0.015);
      tlBar.rotation.y = side * 0.1;
      bodyGroup.add(tlBar);

      const brakeModule = new THREE.Mesh(
        cachedGeo('brake_mod', () => new THREE.BoxGeometry(0.18, 0.055, 0.055)),
        brakeLightMat,
      );
      brakeModule.position.set(lx - side * 0.01, rLightY - 0.025, -L - 0.015);
      brakeModule.rotation.y = side * 0.1;
      bodyGroup.add(brakeModule);

      const revLens = new THREE.Mesh(
        cachedGeo('rev_lens', () => new THREE.BoxGeometry(0.09, 0.048, 0.055)),
        reverseLightMat,
      );
      revLens.position.set(lx - side * 0.16, rLightY - 0.025, -L - 0.016);
      bodyGroup.add(revLens);

      const rTurn = new THREE.Mesh(
        cachedGeo('rturn', () => new THREE.BoxGeometry(0.11, 0.05, 0.055)),
        turnMat,
      );
      rTurn.position.set(lx + side * 0.15, rLightY - 0.025, -L - 0.014);
      rTurn.rotation.y = side * 0.14;
      bodyGroup.add(rTurn);
    }

    // Center High-Mounted 3rd Brake Light (CHMSL)
    const chmsl = new THREE.Mesh(
      cachedGeo('chmsl', () => new THREE.BoxGeometry(0.42, 0.04, 0.05)),
      brakeLightMat,
    );
    chmsl.position.set(0, roofY - 0.06, roofRearZ - 0.03);
    bodyGroup.add(chmsl);
  }

  return {
    id,
    spec,
    group,
    bodyGroup,
    wheelNodes,
    wheelMeshes,
    frontSteerPivots,
    headlightMat,
    taillightMat,
    brakeLightMat,
    reverseLightMat,
    turnLeftMat,
    turnRightMat,
    sirenRedMat,
    sirenBlueMat,
    x,
    y: startY,
    z,
    heading,
    vx: 0,
    vz: 0,
    forwardSpeed: 0,
    steerAngle: 0,
    angularVel: 0,
    slipAngle: 0,
    driftIntensity: 0,
    gear: 1,
    rpm: 0.18,
    shiftTimer: 0,
    suspY: 0,
    suspVel: 0,
    pitchAngle: 0,
    pitchVel: 0,
    rollAngle: 0,
    rollVel: 0,
    prevFwdSpeed: 0,
    prevLatSpeed: 0,
    prevGroundY: startY,
    health: kind === 'suv' || kind === 'van' ? 140 : 100,
    maxHealth: kind === 'suv' || kind === 'van' ? 140 : 100,
    isPolice: kind === 'police',
    sirenActive: false,
    occupiedByPlayer: false,
    isDrifting: false,
    aiActive: false,
    aiAxis: 'z',
    aiDir: 1,
    aiLaneCoord: 0,
    aiTargetSpeed: 12,
  };
}

export function stepVehiclePhysics(
  v: VehicleInstance,
  input: VehicleInput,
  dt: number,
  colliders: WorldBoxCollider[],
  allVehicles: VehicleInstance[],
  isNight: boolean,
  elapsed: number,
  onImpact?: (impactSpeed: number, x: number, z: number) => void,
): void {
  const safeDt = Math.max(0.001, Math.min(dt, 0.033));
  const { spec } = v;

  const fwdX = Math.sin(v.heading);
  const fwdZ = Math.cos(v.heading);
  const rightX = Math.cos(v.heading);
  const rightZ = -Math.sin(v.heading);

  let localFwd = v.vx * fwdX + v.vz * fwdZ;
  let localLat = v.vx * rightX + v.vz * rightZ;
  const absFwd = Math.abs(localFwd);
  const speedNorm = Math.min(1, absFwd / spec.maxSpeed);

  // 1. Multi-Gear Transmission & Torque Curve
  const prevGear = v.gear;
  const nextGear = Math.min(spec.gears, Math.max(1, Math.floor(speedNorm * spec.gears * 0.995) + 1));
  if (nextGear > prevGear && input.throttle > 0.25 && localFwd > 2) {
    v.shiftTimer = 0.065;
    v.pitchVel += 0.28; // Subtle crisp gear-shift weight nod
  }
  v.gear = nextGear;
  if (v.shiftTimer > 0) {
    v.shiftTimer = Math.max(0, v.shiftTimer - safeDt);
  }

  const gearSpan = 1 / spec.gears;
  const gearProgress = THREE.MathUtils.clamp((speedNorm - (v.gear - 1) * gearSpan) / gearSpan, 0, 1);
  const targetRpm = THREE.MathUtils.clamp(
    0.2 + gearProgress * 0.76 + (Math.abs(input.throttle) > 0.2 && v.shiftTimer <= 0 ? 0.08 : 0),
    0.16,
    1.0,
  );
  v.rpm = THREE.MathUtils.damp(v.rpm, targetRpm, 14, safeDt);

  const torqueBand = 0.78 + 0.46 * Math.sin(v.rpm * Math.PI * 0.8);
  const gearLeverage = 1.3 - ((v.gear - 1) / Math.max(1, spec.gears - 1)) * 0.44;
  const shiftCut = v.shiftTimer > 0 ? 0.35 : 1.0;

  // Longitudinal Acceleration, Progressive Braking & Aerodynamic Drag
  if (input.throttle > 0.05) {
    if (localFwd < -0.7) {
      localFwd += spec.brake * 1.15 * safeDt;
    } else {
      localFwd += input.throttle * spec.accel * torqueBand * gearLeverage * shiftCut * safeDt;
    }
  } else if (input.throttle < -0.05) {
    if (localFwd > 0.7) {
      const brakeMod = 1 + 0.22 * (1 - speedNorm);
      localFwd -= spec.brake * brakeMod * safeDt;
    } else {
      localFwd += input.throttle * (spec.accel * 0.58) * safeDt;
    }
  } else {
    localFwd *= Math.exp(-0.72 * safeDt);
  }

  const aeroCoeff = (spec.accel * 0.86) / (spec.maxSpeed * spec.maxSpeed);
  localFwd -= aeroCoeff * localFwd * Math.abs(localFwd) * safeDt;

  if (input.handbrake) {
    localFwd *= Math.exp(-2.6 * safeDt);
  }

  const maxRev = -spec.maxSpeed * 0.44;
  localFwd = THREE.MathUtils.clamp(localFwd, maxRev, spec.maxSpeed * 1.05);

  // 2. Speed-Sensitive Steering, Yaw Inertia & GTA-Style Drift Physics
  const steerLockScale = 1 / (1 + absFwd * 0.036);
  const targetSteer = input.steer * 0.55 * steerLockScale;
  v.steerAngle = THREE.MathUtils.damp(v.steerAngle, targetSteer, 13, safeDt);

  const speedFactor = Math.min(1, absFwd / 4.6);
  const dirSign = localFwd >= -0.15 ? 1 : -1;

  const powerOversteer =
    Math.abs(input.steer) > 0.48 &&
    input.throttle > 0.6 &&
    absFwd > 9.0 &&
    spec.oversteerBias > 0.24;
  const handbrakeSlide = input.handbrake && absFwd > 4.5;

  v.driftIntensity = THREE.MathUtils.damp(
    v.driftIntensity,
    handbrakeSlide ? 1.0 : powerOversteer ? spec.oversteerBias * 1.45 : Math.min(1, Math.abs(localLat) / 7.5),
    handbrakeSlide ? 11 : 6.5,
    safeDt,
  );

  let desiredYaw = input.steer * spec.turnSpeed * speedFactor * dirSign;
  if (handbrakeSlide) {
    desiredYaw *= 1.46;
  } else if (v.driftIntensity > 0.25) {
    desiredYaw *= 1 + v.driftIntensity * spec.oversteerBias * 0.48;
  }

  const counterSteering = localLat * input.steer < -0.8 && Math.abs(input.steer) > 0.25;
  const yawDamping = counterSteering ? 15 : handbrakeSlide ? 9.5 : 13;
  v.angularVel = THREE.MathUtils.damp(v.angularVel, desiredYaw, yawDamping, safeDt);
  v.heading += v.angularVel * safeDt;

  const worldVx = fwdX * localFwd + rightX * localLat;
  const worldVz = fwdZ * localFwd + rightZ * localLat;

  const newFwdX = Math.sin(v.heading);
  const newFwdZ = Math.cos(v.heading);
  const newRightX = Math.cos(v.heading);
  const newRightZ = -Math.sin(v.heading);

  localFwd = worldVx * newFwdX + worldVz * newFwdZ;
  localLat = worldVx * newRightX + worldVz * newRightZ;

  const gripLerp = handbrakeSlide ? 0.92 : THREE.MathUtils.clamp(v.driftIntensity * 0.85, 0, 0.88);
  const effectiveGrip = THREE.MathUtils.lerp(spec.grip, spec.driftGrip, gripLerp);
  localLat *= Math.exp(-effectiveGrip * safeDt);

  if (v.driftIntensity > 0.3 && absFwd > 6) {
    localFwd *= Math.exp(-0.35 * v.driftIntensity * safeDt);
  }

  v.slipAngle = Math.atan2(localLat, Math.max(2.5, Math.abs(localFwd)));
  const burnoutLaunch =
    absFwd < 6.5 && input.throttle > 0.8 && spec.oversteerBias > 0.35 && Math.abs(input.steer) > 0.2;
  v.isDrifting =
    Math.abs(v.slipAngle) > 0.16 ||
    (handbrakeSlide && absFwd > 5.2) ||
    burnoutLaunch;

  v.vx = newFwdX * localFwd + newRightX * localLat;
  v.vz = newFwdZ * localFwd + newRightZ * localLat;
  v.forwardSpeed = localFwd;

  v.x += v.vx * safeDt;
  v.z += v.vz * safeDt;

  // 3. World & Vehicle Collisions
  const posTmp = { x: v.x, z: v.z };
  const colRadius = spec.halfWidth * 1.05;
  const colRes = resolveCircleWorldCollisions(posTmp, colRadius, colliders);
  if (colRes.collided) {
    v.x = posTmp.x;
    v.z = posTmp.z;
    const vn = v.vx * colRes.normalX + v.vz * colRes.normalZ;
    if (vn < 0) {
      const impact = -vn;
      v.vx -= 1.32 * vn * colRes.normalX;
      v.vz -= 1.32 * vn * colRes.normalZ;
      v.vx *= 0.78;
      v.vz *= 0.78;
      v.suspVel -= Math.min(1.6, impact * 0.08);
      v.pitchVel += (colRes.normalX * newFwdX + colRes.normalZ * newFwdZ) * Math.min(1.8, impact * 0.12);
      if (impact > 4.5) {
        v.health = Math.max(0, v.health - impact * 1.4);
        onImpact?.(impact, v.x, v.z);
      }
    }
  }

  for (let i = 0; i < allVehicles.length; i++) {
    const other = allVehicles[i];
    if (other === v) continue;
    const dx = v.x - other.x;
    const dz = v.z - other.z;
    const minDist = spec.halfWidth + other.spec.halfWidth + 0.35;
    const distSq = dx * dx + dz * dz;
    if (distSq < minDist * minDist && distSq > 1e-5) {
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = minDist - dist;

      const totalMass = spec.mass + other.spec.mass;
      v.x += nx * overlap * (other.spec.mass / totalMass);
      v.z += nz * overlap * (other.spec.mass / totalMass);
      other.x -= nx * overlap * (spec.mass / totalMass);
      other.z -= nz * overlap * (spec.mass / totalMass);

      const rvx = v.vx - other.vx;
      const rvz = v.vz - other.vz;
      const velAlongNormal = rvx * nx + rvz * nz;
      if (velAlongNormal < 0) {
        const restitution = 0.45;
        const j = (-(1 + restitution) * velAlongNormal) / (1 / spec.mass + 1 / other.spec.mass);
        v.vx += (j / spec.mass) * nx;
        v.vz += (j / spec.mass) * nz;
        other.vx -= (j / other.spec.mass) * nx;
        other.vz -= (j / other.spec.mass) * nz;

        const impact = -velAlongNormal;
        v.suspVel -= Math.min(1.4, impact * 0.06);
        other.suspVel -= Math.min(1.4, impact * 0.06);
        if (impact > 5.0) {
          v.health = Math.max(0, v.health - impact * 1.1);
          other.health = Math.max(0, other.health - impact * 1.1);
          onImpact?.(impact, (v.x + other.x) * 0.5, (v.z + other.z) * 0.5);
        }
      }
    }
  }

  // 4. 4-Wheel Terrain Sampling & 2nd-Order Spring-Damper Suspension
  let groundSum = 0;
  let frontHeightSum = 0;
  let frontCount = 0;
  let rearHeightSum = 0;
  let rearCount = 0;
  let leftHeightSum = 0;
  let leftCount = 0;
  let rightHeightSum = 0;
  let rightCount = 0;

  for (let i = 0; i < v.wheelNodes.length; i++) {
    const wn = v.wheelNodes[i];
    const wx = v.x + newRightX * wn.localX + newFwdX * wn.localZ;
    const wz = v.z + newRightZ * wn.localX + newFwdZ * wn.localZ;
    const wh = vehicleSurfaceHeightAt(wx, wz);
    groundSum += wh;
    if (wn.isFront) {
      frontHeightSum += wh;
      frontCount++;
    } else {
      rearHeightSum += wh;
      rearCount++;
    }
    if (wn.localX < -0.05) {
      leftHeightSum += wh;
      leftCount++;
    } else if (wn.localX > 0.05) {
      rightHeightSum += wh;
      rightCount++;
    }
  }

  const targetGroundY = v.wheelNodes.length > 0 ? groundSum / v.wheelNodes.length : vehicleSurfaceHeightAt(v.x, v.z);
  const groundDelta = targetGroundY - v.prevGroundY;
  v.prevGroundY = targetGroundY;
  v.y = targetGroundY;
  v.group.position.set(v.x, v.y, v.z);
  v.group.rotation.y = v.heading;

  if (Math.abs(groundDelta) > 0.002) {
    v.suspY = THREE.MathUtils.clamp(v.suspY - groundDelta * 0.75, -spec.suspensionTravel, spec.suspensionTravel);
    v.suspVel -= THREE.MathUtils.clamp(groundDelta / safeDt, -5, 5) * 0.25;
  }

  const fAvg = frontCount > 0 ? frontHeightSum / frontCount : targetGroundY;
  const rAvg = rearCount > 0 ? rearHeightSum / rearCount : targetGroundY;
  const lAvg = leftCount > 0 ? leftHeightSum / leftCount : targetGroundY;
  const rSideAvg = rightCount > 0 ? rightHeightSum / rightCount : targetGroundY;
  const terrainPitch = Math.atan2(fAvg - rAvg, Math.max(1.2, spec.halfLength * 1.24));
  const terrainRoll = Math.atan2(rSideAvg - lAvg, Math.max(0.8, spec.halfWidth * 1.8));

  const ax = THREE.MathUtils.clamp((localFwd - v.prevFwdSpeed) / safeDt, -36, 36);
  const ay = THREE.MathUtils.clamp(localFwd * v.angularVel + (localLat - v.prevLatSpeed) / safeDt, -36, 36);
  v.prevFwdSpeed = localFwd;
  v.prevLatSpeed = localLat;

  const heaveAcc = -spec.suspensionStiffness * v.suspY - spec.suspensionDamping * v.suspVel;
  v.suspVel += heaveAcc * safeDt;
  v.suspY = THREE.MathUtils.clamp(v.suspY + v.suspVel * safeDt, -spec.suspensionTravel, spec.suspensionTravel);

  const targetPitch = THREE.MathUtils.clamp(-ax * spec.pitchFactor * 0.044, -0.1, 0.1) - terrainPitch;
  const pitchAcc = 56 * (targetPitch - v.pitchAngle) - 9.8 * v.pitchVel;
  v.pitchVel += pitchAcc * safeDt;
  v.pitchAngle = THREE.MathUtils.clamp(v.pitchAngle + v.pitchVel * safeDt, -0.15, 0.15);

  const rollSign = spec.kind === 'moto' ? -1 : 1;
  const maxRoll = spec.kind === 'moto' ? 0.42 : 0.15;
  const targetRoll =
    THREE.MathUtils.clamp(rollSign * ay * spec.rollFactor * 0.046, -maxRoll, maxRoll) + terrainRoll;
  const rollAcc = 58 * (targetRoll - v.rollAngle) - 10.2 * v.rollVel;
  v.rollVel += rollAcc * safeDt;
  v.rollAngle = THREE.MathUtils.clamp(v.rollAngle + v.rollVel * safeDt, -0.45, 0.45);

  v.bodyGroup.position.y = v.suspY;
  v.bodyGroup.rotation.x = v.pitchAngle;
  v.bodyGroup.rotation.z = v.rollAngle;

  // Individual Wheel Travel, Steering & Synchronized Spin
  const baseSpin = (localFwd * safeDt) / spec.wheelRadius;
  const rearWheelSpinMult = burnoutLaunch ? 2.4 : handbrakeSlide ? 0.05 : 1.0;

  for (let i = 0; i < v.wheelNodes.length; i++) {
    const wn = v.wheelNodes[i];
    wn.spinMesh.rotation.x += wn.isFront ? baseSpin : baseSpin * rearWheelSpinMult;
    if (wn.isFront) {
      wn.pivot.rotation.y = v.steerAngle;
    }
    const wx = v.x + newRightX * wn.localX + newFwdX * wn.localZ;
    const wz = v.z + newRightZ * wn.localX + newFwdZ * wn.localZ;
    const wh = vehicleSurfaceHeightAt(wx, wz);
    const targetWheelY = THREE.MathUtils.clamp(
      wn.restY + (wh - v.y),
      wn.restY - spec.suspensionTravel,
      wn.restY + spec.suspensionTravel,
    );
    wn.pivot.position.y = THREE.MathUtils.damp(wn.pivot.position.y, targetWheelY, 18, safeDt);
  }

  // 5. Functional Vehicle Lighting (Headlights, Taillights, Brake Lights, Reverse, Turn Signals & Sirens)
  v.headlightMat.emissiveIntensity = isNight ? 2.6 : v.occupiedByPlayer ? 1.05 : 0.35;
  v.taillightMat.emissiveIntensity = isNight ? 1.35 : v.occupiedByPlayer ? 0.55 : 0.25;

  const braking = (input.throttle < -0.1 && localFwd > 0.5) || input.handbrake;
  v.brakeLightMat.emissiveIntensity = braking ? 3.5 : isNight ? 0.45 : 0.08;

  const reversing = localFwd < -0.45 && input.throttle < -0.1;
  v.reverseLightMat.emissiveIntensity = reversing ? 2.8 : 0.04;

  const blinkOn = Math.sin(elapsed * 9.0) > 0;
  v.turnLeftMat.emissiveIntensity = input.steer > 0.24 ? (blinkOn ? 2.8 : 0.06) : 0.04;
  v.turnRightMat.emissiveIntensity = input.steer < -0.24 ? (blinkOn ? 2.8 : 0.06) : 0.04;

  if (v.sirenRedMat && v.sirenBlueMat) {
    if (v.sirenActive) {
      const flash = Math.sin(elapsed * 14) > 0;
      v.sirenRedMat.emissiveIntensity = flash ? 3.5 : 0.15;
      v.sirenBlueMat.emissiveIntensity = flash ? 0.15 : 3.5;
    } else {
      v.sirenRedMat.emissiveIntensity = 0.25;
      v.sirenBlueMat.emissiveIntensity = 0.25;
    }
  }
}

export function stepTrafficAI(
  v: VehicleInstance,
  allVehicles: VehicleInstance[],
  playerPos: THREE.Vector3,
  nsGreen: boolean,
  dt: number,
  colliders: WorldBoxCollider[],
  isNight: boolean,
  elapsed: number,
): void {
  if (!v.aiActive || v.occupiedByPlayer) return;

  let shouldStop = false;
  const distToPlayer = Math.hypot(v.x - playerPos.x, v.z - playerPos.z);
  if (distToPlayer < 11) {
    const fwdX = Math.sin(v.heading);
    const fwdZ = Math.cos(v.heading);
    const dot = (playerPos.x - v.x) * fwdX + (playerPos.z - v.z) * fwdZ;
    if (dot > 1.5 && dot < 10.5) {
      shouldStop = true;
    }
  }

  const fwdX = Math.sin(v.heading);
  const fwdZ = Math.cos(v.heading);
  for (let i = 0; i < allVehicles.length; i++) {
    const other = allVehicles[i];
    if (other === v) continue;
    const dx = other.x - v.x;
    const dz = other.z - v.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < 144) {
      const proj = dx * fwdX + dz * fwdZ;
      const lat = Math.abs(dx * fwdZ - dz * fwdX);
      if (proj > 1.5 && proj < 11 && lat < 2.3) {
        shouldStop = true;
        break;
      }
    }
  }

  if (!shouldStop) {
    const coord = v.aiAxis === 'z' ? v.z : v.x;
    const green = v.aiAxis === 'z' ? nsGreen : !nsGreen;
    if (!green) {
      for (const ic of ROAD_COORDS) {
        const distToStop = (ic - v.aiDir * 9.5 - coord) * v.aiDir;
        if (distToStop > 0 && distToStop < 6.5) {
          shouldStop = true;
          break;
        }
      }
    }
  }

  const targetHeading =
    v.aiAxis === 'z'
      ? v.aiDir === 1
        ? 0
        : Math.PI
      : v.aiDir === 1
        ? Math.PI / 2
        : -Math.PI / 2;

  let headingErr = targetHeading - v.heading;
  while (headingErr > Math.PI) headingErr -= Math.PI * 2;
  while (headingErr < -Math.PI) headingErr += Math.PI * 2;

  const laneOffset = v.aiAxis === 'z' ? v.aiLaneCoord - v.x : v.aiLaneCoord - v.z;
  const laneSteer = v.aiAxis === 'z' ? laneOffset * v.aiDir * 0.12 : -laneOffset * v.aiDir * 0.12;
  const steer = THREE.MathUtils.clamp(headingErr * 1.8 + laneSteer, -1, 1);

  const throttle = shouldStop ? -0.8 : v.forwardSpeed < v.aiTargetSpeed ? 0.55 : 0;

  stepVehiclePhysics(
    v,
    { throttle, steer, handbrake: shouldStop && v.forwardSpeed < 2 },
    dt,
    colliders,
    allVehicles,
    isNight,
    elapsed,
  );

  if (v.z > 135) v.z = -135;
  if (v.z < -135) v.z = 135;
  if (v.x > 128) v.x = -128;
  if (v.x < -135) v.x = 128;
}
