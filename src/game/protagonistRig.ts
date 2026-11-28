import * as THREE from 'three';
import { WeaponId } from './types';

export interface ProtagonistSkeleton {
  root: THREE.Group;
  skeleton: THREE.Skeleton;
  hips: THREE.Bone;
  spine: THREE.Bone;
  chest: THREE.Bone;
  neck: THREE.Bone;
  head: THREE.Bone;
  leftShoulder: THREE.Bone;
  leftUpperArm: THREE.Bone;
  leftForeArm: THREE.Bone;
  leftHand: THREE.Bone;
  rightShoulder: THREE.Bone;
  rightUpperArm: THREE.Bone;
  rightForeArm: THREE.Bone;
  rightHand: THREE.Bone;
  leftThigh: THREE.Bone;
  leftShin: THREE.Bone;
  leftFoot: THREE.Bone;
  rightThigh: THREE.Bone;
  rightShin: THREE.Bone;
  rightFoot: THREE.Bone;
  batMesh: THREE.Mesh;
  pistolMesh: THREE.Mesh;
  leftRestArmX: number;
  rightRestArmX: number;
  baseHipsY: number;
}

interface ProtagonistTextures {
  face: THREE.CanvasTexture;
  leather: THREE.CanvasTexture;
  leatherBump: THREE.CanvasTexture;
  sweater: THREE.CanvasTexture;
  cargo: THREE.CanvasTexture;
  sneaker: THREE.CanvasTexture;
}

let cachedProtTex: ProtagonistTextures | null = null;

function getProtagonistTextures(): ProtagonistTextures {
  if (cachedProtTex) return cachedProtTex;

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // -------------------------------------------------------------------------
  // 1. Face UV Texture (Equirectangular-mapped Sphere: U=0.5 is Front +Z? Wait:
  //    Three.js SphereGeometry starts phi=0 at -X, so +Z is U=0.75 (or rotateY(-PI/2) puts +Z at U=0.5!))
  //    We will rotate head geometry by -PI/2 around Y so U = 0.5 is dead-center Front (+Z)!
  // -------------------------------------------------------------------------
  const fCanvas = document.createElement('canvas');
  fCanvas.width = 512;
  fCanvas.height = 512;
  const fctx = fCanvas.getContext('2d')!;

  // Warm natural skin tone base
  const skinGrad = fctx.createLinearGradient(0, 80, 0, 480);
  skinGrad.addColorStop(0.0, '#cfa081');
  skinGrad.addColorStop(0.45, '#d7a483');
  skinGrad.addColorStop(1.0, '#c08b6c');
  fctx.fillStyle = skinGrad;
  fctx.fillRect(0, 0, 512, 512);

  // Subtle cheekbone & temple shading
  const leftCheek = fctx.createRadialGradient(196, 285, 6, 196, 285, 42);
  leftCheek.addColorStop(0, 'rgba(155, 90, 65, 0.25)');
  leftCheek.addColorStop(1, 'rgba(155, 90, 65, 0)');
  fctx.fillStyle = leftCheek;
  fctx.fillRect(140, 230, 120, 120);

  const rightCheek = fctx.createRadialGradient(316, 285, 6, 316, 285, 42);
  rightCheek.addColorStop(0, 'rgba(155, 90, 65, 0.25)');
  rightCheek.addColorStop(1, 'rgba(155, 90, 65, 0)');
  fctx.fillStyle = rightCheek;
  fctx.fillRect(256, 230, 120, 120);

  // 5-o'clock shadow / trimmed dark stubble beard along jawline, chin & upper lip
  const beardGrad = fctx.createRadialGradient(256, 345, 22, 256, 340, 118);
  beardGrad.addColorStop(0, 'rgba(34, 24, 18, 0.62)');
  beardGrad.addColorStop(0.62, 'rgba(38, 28, 22, 0.45)');
  beardGrad.addColorStop(1, 'rgba(38, 28, 22, 0)');
  fctx.fillStyle = beardGrad;
  fctx.beginPath();
  fctx.ellipse(256, 350, 96, 86, 0, 0, Math.PI * 2);
  fctx.fill();

  // Individual subtle beard stubble speckles around lower face
  for (let i = 0; i < 950; i++) {
    const sx = 172 + rand() * 168;
    const sy = 286 + rand() * 140;
    const dx = (sx - 256) / 86;
    const dy = (sy - 355) / 72;
    if (dx * dx + dy * dy < 1.0 && !(Math.abs(sx - 256) < 24 && Math.abs(sy - 332) < 9)) {
      fctx.fillStyle = rand() > 0.4 ? 'rgba(28, 20, 15, 0.35)' : 'rgba(55, 42, 33, 0.24)';
      fctx.fillRect(sx, sy, 2, 2);
    }
  }

  // Mustache & Soul Patch emphasis
  fctx.fillStyle = 'rgba(34, 25, 19, 0.56)';
  fctx.beginPath();
  fctx.ellipse(256, 317, 29, 7, 0, 0, Math.PI * 2);
  fctx.fill();

  // Natural Lips (parted neutral expression)
  fctx.fillStyle = '#a36455';
  fctx.beginPath();
  fctx.ellipse(256, 333, 21, 5.5, 0, 0, Math.PI * 2);
  fctx.fill();
  fctx.strokeStyle = '#5c342b';
  fctx.lineWidth = 2.2;
  fctx.beginPath();
  fctx.moveTo(236, 333);
  fctx.lineTo(276, 333);
  fctx.stroke();

  // Subtle Nose Bridge & Nostril Shadow
  fctx.fillStyle = 'rgba(130, 78, 55, 0.38)';
  fctx.beginPath();
  fctx.ellipse(249, 296, 4.5, 3, 0, 0, Math.PI * 2);
  fctx.ellipse(263, 296, 4.5, 3, 0, 0, Math.PI * 2);
  fctx.fill();

  // Eyes (left at x=286, right at x=226 in centered UV) + Expressive Dark Eyebrows
  for (const ex of [224, 288]) {
    const sign = ex < 256 ? -1 : 1;
    // Eye socket soft shadow
    const sock = fctx.createRadialGradient(ex, 245, 3, ex, 245, 22);
    sock.addColorStop(0, 'rgba(95, 55, 40, 0.32)');
    sock.addColorStop(1, 'rgba(95, 55, 40, 0)');
    fctx.fillStyle = sock;
    fctx.fillRect(ex - 22, 223, 44, 44);

    // Sclera
    fctx.fillStyle = '#ece9e4';
    fctx.beginPath();
    fctx.ellipse(ex, 246, 13, 6.5, 0, 0, Math.PI * 2);
    fctx.fill();

    // Dark brown iris & pupil + specular glint
    fctx.fillStyle = '#38251a';
    fctx.beginPath();
    fctx.arc(ex, 246, 5.8, 0, Math.PI * 2);
    fctx.fill();
    fctx.fillStyle = '#0d0907';
    fctx.beginPath();
    fctx.arc(ex, 246, 2.7, 0, Math.PI * 2);
    fctx.fill();
    fctx.fillStyle = 'rgba(255,255,255,0.8)';
    fctx.beginPath();
    fctx.arc(ex + 1.8, 244.2, 1.3, 0, Math.PI * 2);
    fctx.fill();

    // Upper eyelid crease
    fctx.strokeStyle = '#291c15';
    fctx.lineWidth = 2.6;
    fctx.beginPath();
    fctx.moveTo(ex - 13, 244);
    fctx.quadraticCurveTo(ex, 238, ex + 13, 244);
    fctx.stroke();

    // Strong slightly furrowed masculine dark-brown eyebrow
    fctx.strokeStyle = '#241a14';
    fctx.lineWidth = 6.5;
    fctx.lineCap = 'round';
    fctx.beginPath();
    fctx.moveTo(ex - sign * 15, 228);
    fctx.quadraticCurveTo(ex, 223, ex + sign * 16, 231);
    fctx.stroke();
  }

  // Sideburn hair & full nape/back-of-head hair coverage in UV
  fctx.fillStyle = '#241c17';
  fctx.fillRect(0, 0, 512, 152);
  fctx.fillRect(0, 152, 138, 225);
  fctx.fillRect(374, 152, 138, 225);
  fctx.fillRect(0, 152, 92, 260);
  fctx.fillRect(420, 152, 92, 260);

  const face = new THREE.CanvasTexture(fCanvas);
  face.colorSpace = THREE.SRGBColorSpace;
  face.anisotropy = 8;

  // -------------------------------------------------------------------------
  // 2. Olive-Charcoal Distressed Waxed Leather Jacket Texture & Bump
  // -------------------------------------------------------------------------
  const lCanvas = document.createElement('canvas');
  lCanvas.width = 512;
  lCanvas.height = 512;
  const lctx = lCanvas.getContext('2d')!;
  lctx.fillStyle = '#33362c';
  lctx.fillRect(0, 0, 512, 512);

  // Subtle distressed olive-brown leather grain & edge scuffs
  for (let i = 0; i < 3200; i++) {
    const lx = rand() * 512;
    const ly = rand() * 512;
    const w = 1 + rand() * 5;
    const h = 1 + rand() * 3;
    lctx.fillStyle = rand() > 0.5 ? 'rgba(72, 74, 58, 0.24)' : 'rgba(28, 30, 24, 0.28)';
    lctx.fillRect(lx, ly, w, h);
  }
  // Stitch & seam accents
  lctx.strokeStyle = 'rgba(22, 24, 18, 0.65)';
  lctx.lineWidth = 2;
  for (let y = 64; y < 512; y += 128) {
    lctx.beginPath();
    lctx.moveTo(0, y);
    lctx.lineTo(512, y);
    lctx.stroke();
  }

  const leather = new THREE.CanvasTexture(lCanvas);
  leather.colorSpace = THREE.SRGBColorSpace;
  leather.wrapS = THREE.RepeatWrapping;
  leather.wrapT = THREE.RepeatWrapping;

  const lbCanvas = document.createElement('canvas');
  lbCanvas.width = 256;
  lbCanvas.height = 256;
  const lbctx = lbCanvas.getContext('2d')!;
  lbctx.fillStyle = '#808080';
  lbctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2400; i++) {
    const v = 96 + Math.floor(rand() * 64);
    lbctx.fillStyle = `rgb(${v},${v},${v})`;
    lbctx.fillRect(rand() * 256, rand() * 256, 2, 2);
  }
  const leatherBump = new THREE.CanvasTexture(lbCanvas);
  leatherBump.wrapS = THREE.RepeatWrapping;
  leatherBump.wrapT = THREE.RepeatWrapping;
  leatherBump.repeat.set(3, 3);

  // -------------------------------------------------------------------------
  // 3. Ribbed Dark-Grey Knit Sweater Texture
  // -------------------------------------------------------------------------
  const swCanvas = document.createElement('canvas');
  swCanvas.width = 256;
  swCanvas.height = 256;
  const swctx = swCanvas.getContext('2d')!;
  swctx.fillStyle = '#383b3f';
  swctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 6) {
    swctx.fillStyle = x % 12 === 0 ? '#464a50' : '#2a2d31';
    swctx.fillRect(x, 0, 3, 256);
  }
  const sweater = new THREE.CanvasTexture(swCanvas);
  sweater.colorSpace = THREE.SRGBColorSpace;
  sweater.wrapS = THREE.RepeatWrapping;
  sweater.wrapT = THREE.RepeatWrapping;
  sweater.repeat.set(4, 2);

  // -------------------------------------------------------------------------
  // 4. Slate Charcoal Cargo Twill Texture
  // -------------------------------------------------------------------------
  const cCanvas = document.createElement('canvas');
  cCanvas.width = 256;
  cCanvas.height = 256;
  const cctx = cCanvas.getContext('2d')!;
  cctx.fillStyle = '#2d2f32';
  cctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2200; i++) {
    cctx.fillStyle = rand() > 0.5 ? 'rgba(60, 64, 68, 0.22)' : 'rgba(20, 22, 24, 0.26)';
    cctx.fillRect(rand() * 256, rand() * 256, 3, 2);
  }
  // Vertical trouser seam stitching
  cctx.strokeStyle = 'rgba(18, 19, 21, 0.55)';
  cctx.lineWidth = 2;
  cctx.beginPath();
  cctx.moveTo(64, 0);
  cctx.lineTo(64, 256);
  cctx.moveTo(192, 0);
  cctx.lineTo(192, 256);
  cctx.stroke();

  const cargo = new THREE.CanvasTexture(cCanvas);
  cargo.colorSpace = THREE.SRGBColorSpace;
  cargo.wrapS = THREE.RepeatWrapping;
  cargo.wrapT = THREE.RepeatWrapping;

  // -------------------------------------------------------------------------
  // 5. Trail Sneaker Mesh & Lacing Texture
  // -------------------------------------------------------------------------
  const snCanvas = document.createElement('canvas');
  snCanvas.width = 256;
  snCanvas.height = 256;
  const snctx = snCanvas.getContext('2d')!;
  snctx.fillStyle = '#232528';
  snctx.fillRect(0, 0, 256, 256);
  snctx.strokeStyle = '#6f747c';
  snctx.lineWidth = 5;
  for (let y = 36; y < 220; y += 28) {
    snctx.beginPath();
    snctx.moveTo(32, y);
    snctx.lineTo(128, y + 18);
    snctx.lineTo(224, y);
    snctx.stroke();
  }
  const sneaker = new THREE.CanvasTexture(snCanvas);
  sneaker.colorSpace = THREE.SRGBColorSpace;

  cachedProtTex = { face, leather, leatherBump, sweater, cargo, sneaker };
  return cachedProtTex;
}

// ---------------------------------------------------------------------------
// Organic Tapered Limb & Skinned Torso Geometry Helpers
// ---------------------------------------------------------------------------

function makeSkinnedTorsoGeometry(
  topHalfW: number,
  botHalfW: number,
  topDepth: number,
  botDepth: number,
  height: number,
  yBottomOffset: number,
  isJacketShell: boolean,
): THREE.BufferGeometry {
  const segY = 14;
  const segA = 24;
  // Open-front shell for jacket so the ribbed dark-grey sweater underneath is cleanly revealed
  const thetaStart = isJacketShell ? 0.36 : 0;
  const thetaLen = isJacketShell ? Math.PI * 2 - 0.72 : Math.PI * 2;
  const geo = new THREE.CylinderGeometry(1, 1, height, segA, segY, isJacketShell, thetaStart, thetaLen);
  geo.translate(0, yBottomOffset + height * 0.5, 0);

  const pos = geo.attributes.position as THREE.BufferAttribute;
  const skinIndices = new Uint16Array(pos.count * 4);
  const skinWeights = new Float32Array(pos.count * 4);

  // Bone palette order in skeleton: 0 = hips, 1 = spine, 2 = chest
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const t = THREE.MathUtils.clamp((vy - yBottomOffset) / height, 0, 1);

    // Taper smoothly from hips/waist up into broad athletic chest/shoulders
    const waistDip = 1 - 0.13 * Math.sin(t * Math.PI * 0.85) * (1 - t);
    const rx = THREE.MathUtils.lerp(botHalfW, topHalfW, Math.pow(t, 0.8)) * waistDip;
    let rz = THREE.MathUtils.lerp(botDepth, topDepth, Math.pow(t, 0.85)) * waistDip;

    // Slight muscular chest swell on front (+Z)
    if (vz > 0 && t > 0.42) {
      rz *= 1 + 0.12 * Math.sin(((t - 0.42) / 0.58) * Math.PI);
    }

    let finalX = vx * rx;
    let finalZ = vz * rz;

    // Taper jacket front opening into a natural slight V-gap toward shoulders
    if (isJacketShell && vz > 0.45) {
      const flare = smoothT(0.15, 0.95, t) * 0.016;
      if (Math.abs(finalX) > 0.005) {
        finalX += Math.sign(finalX) * flare;
      }
      finalZ += 0.006;
    }

    pos.setXYZ(i, finalX, vy, finalZ);

    // Smooth skin weights across hips(0), spine(1), chest(2)
    let w0 = 0;
    let w1 = 0;
    let w2 = 0;
    if (t < 0.45) {
      const k = t / 0.45;
      w0 = 1 - k;
      w1 = k;
    } else {
      const k = (t - 0.45) / 0.55;
      w1 = 1 - k;
      w2 = k;
    }
    skinIndices[i * 4] = 0;
    skinIndices[i * 4 + 1] = 1;
    skinIndices[i * 4 + 2] = 2;
    skinIndices[i * 4 + 3] = 0;

    skinWeights[i * 4] = w0;
    skinWeights[i * 4 + 1] = w1;
    skinWeights[i * 4 + 2] = w2;
    skinWeights[i * 4 + 3] = 0;
  }

  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));
  geo.computeVertexNormals();
  return geo;
}

function smoothT(e0: number, e1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeTaperedLimbGeometry(
  topRx: number,
  topRz: number,
  botRx: number,
  botRz: number,
  length: number,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(1, 1, length, 14, 4, false);
  geo.translate(0, -length * 0.5, 0);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(-pos.getY(i) / length, 0, 1); // 0 = top, 1 = bottom
    const rx = THREE.MathUtils.lerp(topRx, botRx, t);
    const rz = THREE.MathUtils.lerp(topRz, botRz, t);
    pos.setX(i, pos.getX(i) * rx);
    pos.setZ(i, pos.getZ(i) * rz);
  }
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Main AAA Protagonist Rig & Skeleton Builder
// ---------------------------------------------------------------------------

export function buildProtagonistSkeleton(contactShadowTex: THREE.Texture): ProtagonistSkeleton {
  const tex = getProtagonistTextures();

  const root = new THREE.Group();
  root.name = 'ProtagonistRoot';

  // Soft Ground Contact Shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.12, 1.12),
    new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  // Materials matching the 4-view reference sheet
  const leatherMat = new THREE.MeshStandardMaterial({
    map: tex.leather,
    bumpMap: tex.leatherBump,
    bumpScale: 0.008,
    color: 0xffffff,
    roughness: 0.56,
    metalness: 0.08,
  });
  const jacketShellMat = leatherMat.clone();
  jacketShellMat.side = THREE.DoubleSide;
  const ribTrimMat = new THREE.MeshStandardMaterial({
    color: 0x262822,
    roughness: 0.85,
    metalness: 0.04,
  });
  const zipperMat = new THREE.MeshStandardMaterial({
    color: 0x9499a1,
    roughness: 0.28,
    metalness: 0.86,
  });
  const sweaterMat = new THREE.MeshStandardMaterial({
    map: tex.sweater,
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
  });
  const cargoMat = new THREE.MeshStandardMaterial({
    map: tex.cargo,
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.03,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd49f7e,
    roughness: 0.62,
    metalness: 0.02,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex.face,
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.02,
  });
  const stubbleJawMat = new THREE.MeshStandardMaterial({
    color: 0xc28e70,
    roughness: 0.70,
    metalness: 0.02,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x241c17,
    roughness: 0.84,
    metalness: 0.04,
  });
  const sneakerUpperMat = new THREE.MeshStandardMaterial({
    map: tex.sneaker,
    color: 0xffffff,
    roughness: 0.68,
    metalness: 0.05,
  });
  const sneakerMidsoleMat = new THREE.MeshStandardMaterial({
    color: 0xbac0c6,
    roughness: 0.52,
    metalness: 0.04,
  });
  const sneakerSoleMat = new THREE.MeshStandardMaterial({
    color: 0x111214,
    roughness: 0.86,
  });

  // -------------------------------------------------------------------------
  // 1. Humanoid Bone Hierarchy (Hips -> Spine -> Chest -> Neck -> Head + Arms + Legs)
  // -------------------------------------------------------------------------
  const baseHipsY = 0.94;
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  hips.position.set(0, baseHipsY, 0);

  const spine = new THREE.Bone();
  spine.name = 'Spine';
  spine.position.set(0, 0.14, 0);
  hips.add(spine);

  const chest = new THREE.Bone();
  chest.name = 'Chest';
  chest.position.set(0, 0.21, 0);
  spine.add(chest);

  const neck = new THREE.Bone();
  neck.name = 'Neck';
  neck.position.set(0, 0.23, 0.008);
  chest.add(neck);

  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.set(0, 0.10, 0.01);
  neck.add(head);

  // Character LEFT Arm (+X when facing +Z)
  const leftShoulder = new THREE.Bone();
  leftShoulder.name = 'LeftShoulder';
  leftShoulder.position.set(0.14, 0.165, -0.005);
  chest.add(leftShoulder);

  const leftUpperArm = new THREE.Bone();
  leftUpperArm.name = 'LeftUpperArm';
  leftUpperArm.position.set(0.085, -0.015, 0);
  leftShoulder.add(leftUpperArm);

  const leftForeArm = new THREE.Bone();
  leftForeArm.name = 'LeftForeArm';
  leftForeArm.position.set(0, -0.275, 0);
  leftUpperArm.add(leftForeArm);

  const leftHand = new THREE.Bone();
  leftHand.name = 'LeftHand';
  leftHand.position.set(0, -0.245, 0);
  leftForeArm.add(leftHand);

  // Character RIGHT Arm (-X when facing +Z)
  const rightShoulder = new THREE.Bone();
  rightShoulder.name = 'RightShoulder';
  rightShoulder.position.set(-0.14, 0.165, -0.005);
  chest.add(rightShoulder);

  const rightUpperArm = new THREE.Bone();
  rightUpperArm.name = 'RightUpperArm';
  rightUpperArm.position.set(-0.085, -0.015, 0);
  rightShoulder.add(rightUpperArm);

  const rightForeArm = new THREE.Bone();
  rightForeArm.name = 'RightForeArm';
  rightForeArm.position.set(0, -0.275, 0);
  rightUpperArm.add(rightForeArm);

  const rightHand = new THREE.Bone();
  rightHand.name = 'RightHand';
  rightHand.position.set(0, -0.245, 0);
  rightForeArm.add(rightHand);

  // Character LEFT Leg (+X)
  const leftThigh = new THREE.Bone();
  leftThigh.name = 'LeftThigh';
  leftThigh.position.set(0.102, -0.035, 0);
  hips.add(leftThigh);

  const leftShin = new THREE.Bone();
  leftShin.name = 'LeftShin';
  leftShin.position.set(0, -0.435, 0);
  leftThigh.add(leftShin);

  const leftFoot = new THREE.Bone();
  leftFoot.name = 'LeftFoot';
  leftFoot.position.set(0, -0.405, 0);
  leftShin.add(leftFoot);

  // Character RIGHT Leg (-X)
  const rightThigh = new THREE.Bone();
  rightThigh.name = 'RightThigh';
  rightThigh.position.set(-0.102, -0.035, 0);
  hips.add(rightThigh);

  const rightShin = new THREE.Bone();
  rightShin.name = 'RightShin';
  rightShin.position.set(0, -0.435, 0);
  rightThigh.add(rightShin);

  const rightFoot = new THREE.Bone();
  rightFoot.name = 'RightFoot';
  rightFoot.position.set(0, -0.405, 0);
  rightShin.add(rightFoot);

  const allBones: THREE.Bone[] = [
    hips,
    spine,
    chest,
    neck,
    head,
    leftShoulder,
    leftUpperArm,
    leftForeArm,
    leftHand,
    rightShoulder,
    rightUpperArm,
    rightForeArm,
    rightHand,
    leftThigh,
    leftShin,
    leftFoot,
    rightThigh,
    rightShin,
    rightFoot,
  ];
  root.add(hips);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(allBones);

  // -------------------------------------------------------------------------
  // 2. Skinned Torso (Ribbed Grey Sweater Core + Open Distressed Olive Leather Jacket Shell)
  //    Vertices live in bind-pose root height (y = baseHipsY - 0.01 .. 1.48) matching hips/spine/chest!
  // -------------------------------------------------------------------------
  const sweaterGeo = makeSkinnedTorsoGeometry(0.175, 0.155, 0.116, 0.105, 0.53, baseHipsY - 0.01, false);
  const sweaterMesh = new THREE.SkinnedMesh(sweaterGeo, sweaterMat);
  sweaterMesh.castShadow = true;
  sweaterMesh.receiveShadow = true;
  sweaterMesh.frustumCulled = false;
  sweaterMesh.bind(skeleton);
  root.add(sweaterMesh);

  const jacketGeo = makeSkinnedTorsoGeometry(0.222, 0.180, 0.148, 0.124, 0.55, baseHipsY - 0.01, true);
  const jacketMesh = new THREE.SkinnedMesh(jacketGeo, jacketShellMat);
  jacketMesh.castShadow = true;
  jacketMesh.receiveShadow = true;
  jacketMesh.frustumCulled = false;
  jacketMesh.bind(skeleton);
  root.add(jacketMesh);

  // Ribbed Bomber Waistband + Zipper Front Plackets + Chest Zip Pocket + Stand-up Collar
  const waistband = new THREE.Mesh(
    new THREE.CylinderGeometry(0.180, 0.174, 0.062, 16, 1, true, 0.34, Math.PI * 2 - 0.68),
    ribTrimMat,
  );
  waistband.material = ribTrimMat.clone();
  waistband.material.side = THREE.DoubleSide;
  waistband.scale.set(1.02, 1.0, 0.72);
  waistband.position.set(0, -0.115, 0);
  spine.add(waistband);

  // Central Open Metallic Zipper Rails along front chest jacket edges
  for (const side of [-1, 1] as const) {
    const zipRail = new THREE.Mesh(new THREE.BoxGeometry(0.011, 0.43, 0.014), zipperMat);
    zipRail.position.set(side * 0.062, -0.075, 0.136);
    zipRail.rotation.z = side * -0.05;
    zipRail.rotation.y = side * 0.25;
    chest.add(zipRail);

    // Lower Angled Snap Hip Flap Pocket
    const hipPocket = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.026, 0.015), leatherMat);
    hipPocket.position.set(side * 0.125, -0.21, 0.116);
    hipPocket.rotation.y = side * 0.42;
    hipPocket.rotation.z = side * 0.14;
    chest.add(hipPocket);
  }

  // Signature Left-Chest Vertical Zip Pocket (on wearer's LEFT = +X)
  const chestZipPocket = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.115, 0.014), zipperMat);
  chestZipPocket.position.set(0.114, 0.055, 0.141);
  chestZipPocket.rotation.y = 0.28;
  chest.add(chestZipPocket);

  // Back Horizontal Shoulder Yoke Seam Bar (flush with curved back contour)
  const backYoke = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.012, 0.012), ribTrimMat);
  backYoke.position.set(0, 0.115, -0.128);
  chest.add(backYoke);

  // Sweater Crew Collar Ring seated neatly at base of neck inside jacket V-neck
  const sweaterCollar = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.011, 8, 16), sweaterMat);
  sweaterCollar.rotation.x = Math.PI / 2;
  sweaterCollar.position.set(0, 0.194, 0.004);
  chest.add(sweaterCollar);

  // Tailored leather shoulder yoke dome capping the top of the open jacket cleanly
  const shoulderDome = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.45),
    leatherMat,
  );
  shoulderDome.scale.set(1.52, 0.36, 1.02);
  shoulderDome.position.set(0, 0.145, 0);
  chest.add(shoulderDome);

  // Stand-up Bomber Jacket Collar (open at front V-neck)
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.094, 0.106, 0.068, 16, 1, true, 0.52, Math.PI * 2 - 1.04),
    jacketShellMat,
  );
  collar.position.set(0, 0.218, -0.006);
  chest.add(collar);

  // Pelvis / Cargo Trousers Hip Block (child of hips bone)
  const pelvis = new THREE.Mesh(new THREE.CylinderGeometry(0.166, 0.174, 0.17, 16), cargoMat);
  pelvis.scale.set(1.04, 1.0, 0.72);
  pelvis.position.set(0, -0.025, 0);
  pelvis.castShadow = true;
  hips.add(pelvis);

  // -------------------------------------------------------------------------
  // 3. Sculpted Head, Neck, Face/Beard UV, Ears & Messy Spiked Dark-Brown Hair
  // -------------------------------------------------------------------------
  const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.062, 0.14, 12), skinMat);
  neckMesh.position.set(0, 0.015, -0.005);
  neckMesh.castShadow = true;
  neck.add(neckMesh);

  // Rotate SphereGeometry -PI/2 around Y so U=0.5 faces +Z (front face!)
  const skullGeo = new THREE.SphereGeometry(0.112, 22, 18);
  skullGeo.rotateY(-Math.PI / 2);
  const skull = new THREE.Mesh(skullGeo, faceMat);
  skull.scale.set(0.88, 1.09, 0.96);
  skull.position.set(0, 0.098, 0.004);
  skull.castShadow = true;
  head.add(skull);

  // Subtle Lower Jaw Contour matching skin tone (lets UV stubble show cleanly on front!)
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.056, 12, 10), stubbleJawMat);
  jaw.scale.set(0.88, 0.72, 0.86);
  jaw.position.set(0, 0.024, 0.024);
  head.add(jaw);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.038, 6), skinMat);
  nose.rotation.x = Math.PI * 0.42;
  nose.position.set(0, 0.092, 0.110);
  head.add(nose);

  for (const side of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), skinMat);
    ear.scale.set(0.45, 1.25, 0.75);
    ear.position.set(side * 0.098, 0.092, -0.005);
    head.add(ear);
  }

  // Textured Messy Spiked Dark-Brown Hair Crown + Upward Crown/Front Spikes + Side/Back Nape Locks
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.117, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
    hairMat,
  );
  hairCap.scale.set(0.91, 1.05, 0.99);
  hairCap.position.set(0, 0.112, -0.012);
  hairCap.rotation.x = -0.38;
  hairCap.castShadow = true;
  head.add(hairCap);

  const hairNape = new THREE.Mesh(new THREE.SphereGeometry(0.10, 12, 10), hairMat);
  hairNape.scale.set(0.86, 0.92, 0.68);
  hairNape.position.set(0, 0.072, -0.044);
  head.add(hairNape);

  const spikeSpecs: Array<[number, number, number, number, number, number]> = [
    [0, 0.232, 0.022, 0.22, 0, 0.052],
    [-0.036, 0.228, 0.032, 0.26, -0.22, 0.046],
    [0.036, 0.228, 0.032, 0.26, 0.22, 0.046],
    [0, 0.222, -0.032, -0.28, 0, 0.055],
    [-0.052, 0.212, -0.004, -0.1, -0.45, 0.046],
    [0.052, 0.212, -0.004, -0.1, 0.45, 0.046],
    [0, 0.212, 0.058, 0.38, 0.06, 0.040],
    [-0.042, 0.208, 0.052, 0.36, -0.20, 0.036],
    [0.042, 0.208, 0.052, 0.36, 0.20, 0.036],
  ];
  for (const [hx, hy, hz, rx, rz, hLen] of spikeSpecs) {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.026, hLen, 6), hairMat);
    tuft.position.set(hx, hy, hz);
    tuft.rotation.set(rx, 0, rz);
    head.add(tuft);
  }

  // -------------------------------------------------------------------------
  // 4. Articulated Jacket Sleeves, Elbow Caps, Ribbed Cuffs, Hands & Weapon Sockets
  // -------------------------------------------------------------------------
  const buildArmMeshes = (
    upperBone: THREE.Bone,
    foreBone: THREE.Bone,
    handBone: THREE.Bone,
    isLeft: boolean,
  ) => {
    // Rounded shoulder deltoid cap
    const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), leatherMat);
    shoulderCap.castShadow = true;
    upperBone.add(shoulderCap);

    const upperGeo = makeTaperedLimbGeometry(0.065, 0.062, 0.055, 0.053, 0.275);
    const upperMesh = new THREE.Mesh(upperGeo, leatherMat);
    upperMesh.castShadow = true;
    upperBone.add(upperMesh);

    // Small Zippered Pocket on character's LEFT upper sleeve (+X)
    if (isLeft) {
      const sleevePocket = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.075, 0.048), leatherMat);
      sleevePocket.position.set(0.058, -0.11, 0);
      upperBone.add(sleevePocket);
      const sleeveZip = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.065, 0.008), zipperMat);
      sleeveZip.position.set(0.065, -0.11, 0.014);
      upperBone.add(sleeveZip);
    }

    // Elbow spherical joint cap (zero gap when elbow bends 90°!)
    const elbowCap = new THREE.Mesh(new THREE.SphereGeometry(0.053, 10, 10), leatherMat);
    foreBone.add(elbowCap);

    const foreGeo = makeTaperedLimbGeometry(0.054, 0.052, 0.041, 0.039, 0.215);
    const foreMesh = new THREE.Mesh(foreGeo, leatherMat);
    foreMesh.castShadow = true;
    foreBone.add(foreMesh);

    // Ribbed knit sleeve cuff
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.042, 12), ribTrimMat);
    cuff.position.set(0, -0.222, 0);
    foreBone.add(cuff);

    // Sculpted Hand + Thumb + Finger Block
    const wristCap = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), skinMat);
    handBone.add(wristCap);

    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.088, 0.062), skinMat);
    palm.position.set(0, -0.045, 0.008);
    palm.castShadow = true;
    handBone.add(palm);

    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.028, 4, 6), skinMat);
    thumb.position.set(0, -0.032, 0.042);
    thumb.rotation.x = 0.55;
    handBone.add(thumb);
  };

  buildArmMeshes(leftUpperArm, leftForeArm, leftHand, true);
  buildArmMeshes(rightUpperArm, rightForeArm, rightHand, false);

  // Equipped Weapons attached directly to RightHand skeletal bone
  const batMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.019, 0.72, 10),
    new THREE.MeshStandardMaterial({ color: 0x7c3f12, roughness: 0.52 }),
  );
  batMesh.rotation.x = Math.PI / 2;
  batMesh.position.set(0, -0.065, 0.30);
  batMesh.castShadow = true;
  batMesh.visible = false;
  rightHand.add(batMesh);

  const pistolMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.046, 0.115, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x1e2024, metalness: 0.88, roughness: 0.24 }),
  );
  pistolMesh.position.set(0, -0.055, 0.13);
  pistolMesh.castShadow = true;
  pistolMesh.visible = false;
  rightHand.add(pistolMesh);

  // -------------------------------------------------------------------------
  // 5. Articulated Cargo Pants Legs, 3D Side Cargo Pockets & Trail Sneakers
  // -------------------------------------------------------------------------
  const buildLegMeshes = (
    thighBone: THREE.Bone,
    shinBone: THREE.Bone,
    footBone: THREE.Bone,
    sideSign: number, // +1 = Left(+X), -1 = Right(-X)
  ) => {
    const hipBall = new THREE.Mesh(new THREE.SphereGeometry(0.088, 12, 10), cargoMat);
    thighBone.add(hipBall);

    const thighGeo = makeTaperedLimbGeometry(0.092, 0.095, 0.072, 0.074, 0.435);
    const thighMesh = new THREE.Mesh(thighGeo, cargoMat);
    thighMesh.castShadow = true;
    thighBone.add(thighMesh);

    // Signature 3D Bellowed Cargo Thigh Pocket + Flap on outer thigh
    const cargoPocket = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.155, 0.115), cargoMat);
    cargoPocket.position.set(sideSign * 0.078, -0.22, 0.005);
    cargoPocket.castShadow = true;
    thighBone.add(cargoPocket);

    const pocketFlap = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.035, 0.122), cargoMat);
    pocketFlap.position.set(sideSign * 0.08, -0.155, 0.005);
    thighBone.add(pocketFlap);

    // Knee spherical cap (smooth bend in walk/sprint/jump!)
    const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), cargoMat);
    shinBone.add(kneeBall);

    const shinGeo = makeTaperedLimbGeometry(0.074, 0.075, 0.060, 0.063, 0.388);
    const shinMesh = new THREE.Mesh(shinGeo, cargoMat);
    shinMesh.castShadow = true;
    shinBone.add(shinMesh);

    // Trail Running Sneaker (resting cleanly so sole bottom = -0.07 from footBone -> y = 0.000!)
    const shoeGroup = new THREE.Group();
    footBone.add(shoeGroup);

    // Grippy black lugged outsole (y = -0.07 .. -0.056)
    const outsole = new THREE.Mesh(new THREE.BoxGeometry(0.114, 0.016, 0.275), sneakerSoleMat);
    outsole.position.set(0, -0.062, 0.058);
    outsole.castShadow = true;
    shoeGroup.add(outsole);

    // Cushioned light-grey sculpted midsole (y = -0.054 .. -0.020)
    const midsole = new THREE.Mesh(
      new THREE.BoxGeometry(0.110, 0.034, 0.268),
      new THREE.MeshStandardMaterial({ color: 0xd0d5dc, roughness: 0.48, metalness: 0.04 }),
    );
    midsole.position.set(0, -0.037, 0.056);
    shoeGroup.add(midsole);

    // Dark charcoal mesh/leather sneaker upper + toe cap + grey laces
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.052, 0.228), sneakerUpperMat);
    upper.position.set(0, -0.002, 0.042);
    upper.castShadow = true;
    shoeGroup.add(upper);

    const toeCap = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), sneakerUpperMat);
    toeCap.scale.set(1.02, 0.54, 1.38);
    toeCap.position.set(0, -0.015, 0.142);
    shoeGroup.add(toeCap);
  };

  buildLegMeshes(leftThigh, leftShin, leftFoot, 1);
  buildLegMeshes(rightThigh, rightShin, rightFoot, -1);

  // Set natural A-pose relaxed arm rest angles (Left +X rotates OUTWARD via +Z, Right -X via -Z!)
  const leftRestArmX = 0;
  const rightRestArmX = 0;
  leftUpperArm.rotation.z = 0.20;
  rightUpperArm.rotation.z = -0.20;
  leftForeArm.rotation.x = -0.14;
  rightForeArm.rotation.x = -0.14;

  return {
    root,
    skeleton,
    hips,
    spine,
    chest,
    neck,
    head,
    leftShoulder,
    leftUpperArm,
    leftForeArm,
    leftHand,
    rightShoulder,
    rightUpperArm,
    rightForeArm,
    rightHand,
    leftThigh,
    leftShin,
    leftFoot,
    rightThigh,
    rightShin,
    rightFoot,
    batMesh,
    pistolMesh,
    leftRestArmX,
    rightRestArmX,
    baseHipsY,
  };
}

// ---------------------------------------------------------------------------
// Biomechanical Multi-State Skeletal Animation Controller
// ---------------------------------------------------------------------------

export function stepProtagonistAnimation(
  skel: ProtagonistSkeleton,
  dt: number,
  walkPhase: number,
  isMoving: boolean,
  isSprinting: boolean,
  grounded: boolean,
  attackTimer: number,
  equippedWeapon: WeaponId,
): void {
  const dampRate = 14;

  let targetHipsY = skel.baseHipsY;
  let targetHipsRotY = 0;
  let targetSpineRotX = 0;
  let targetChestRotX = 0;
  let targetChestRotY = 0;
  let targetHeadRotX = 0;
  let targetHeadRotY = 0;

  let targetLThighX = 0;
  let targetLShinX = 0;
  let targetLFootX = 0;
  let targetRThighX = 0;
  let targetRShinX = 0;
  let targetRFootX = 0;

  let targetLArmX = 0;
  let targetLArmZ = 0.20;
  let targetLForeX = -0.14;
  let targetRArmX = 0;
  let targetRArmZ = -0.20;
  let targetRForeX = -0.14;

  if (!grounded) {
    // Airborne athletic jump pose
    targetSpineRotX = 0.12;
    targetChestRotX = 0.08;
    targetLThighX = -0.58;
    targetLShinX = 0.92;
    targetLFootX = 0.25;
    targetRThighX = 0.22;
    targetRShinX = 0.45;
    targetRFootX = 0.35;
    targetLArmX = -0.68;
    targetLArmZ = 0.30;
    targetLForeX = -0.65;
    targetRArmX = -0.58;
    targetRArmZ = -0.30;
    targetRForeX = -0.65;
  } else if (isMoving) {
    const s = Math.sin(walkPhase);
    const c = Math.cos(walkPhase);
    const amp = isSprinting ? 0.78 : 0.48;

    // Hip bounce + pelvic counter-rotation
    targetHipsY = skel.baseHipsY + Math.abs(s) * (isSprinting ? 0.055 : 0.028) - (isSprinting ? 0.035 : 0.01);
    targetHipsRotY = s * (isSprinting ? 0.10 : 0.06);
    targetSpineRotX = isSprinting ? 0.18 : 0.04;
    targetChestRotX = isSprinting ? 0.12 : 0.02;
    targetChestRotY = -s * (isSprinting ? 0.16 : 0.09);

    // Legs: thigh swings forward (-X lifts leg forward along +Z), knee bends positively (+X folds shin back)
    targetLThighX = -s * amp;
    targetRThighX = s * amp;

    targetLShinX = Math.max(0.06, (s > 0 ? s : -c * 0.55) * (isSprinting ? 1.15 : 0.72));
    targetRShinX = Math.max(0.06, (s < 0 ? -s : c * 0.55) * (isSprinting ? 1.15 : 0.72));

    targetLFootX = s * 0.22;
    targetRFootX = -s * 0.22;

    // Opposite Arm Swing + natural elbow bend
    const armAmp = isSprinting ? 0.85 : 0.46;
    targetLArmX = s * armAmp;
    targetRArmX = -s * armAmp;
    targetLArmZ = isSprinting ? 0.14 : 0.18;
    targetRArmZ = isSprinting ? -0.14 : -0.18;
    targetLForeX = isSprinting ? -1.15 + Math.max(0, s) * 0.25 : -0.24 - Math.max(0, -s) * 0.28;
    targetRForeX = isSprinting ? -1.15 + Math.max(0, -s) * 0.25 : -0.24 - Math.max(0, s) * 0.28;
  } else {
    // Subtle Alive Idle Breathing & Weight Shift
    const breath = Math.sin(walkPhase);
    targetChestRotX = breath * 0.022;
    targetLArmX = breath * 0.022;
    targetRArmX = -breath * 0.022;
    targetLForeX = -0.14 - breath * 0.02;
    targetRForeX = -0.14 - breath * 0.02;
    targetHeadRotY = Math.sin(walkPhase * 0.45) * 0.06;
    targetHeadRotX = breath * 0.015;
  }

  // Armed Ready Pose & Active Combat Strikes (overrides right arm cleanly)
  if (equippedWeapon === 'pistol' && attackTimer <= 0) {
    targetRArmX = -Math.PI * 0.44;
    targetRArmZ = -0.06;
    targetRForeX = -0.12;
    targetChestRotY += 0.14;
  }

  if (attackTimer > 0) {
    if (equippedWeapon === 'pistol') {
      const recoil = Math.sin((attackTimer / 0.28) * Math.PI);
      targetRArmX = -Math.PI * 0.48 - recoil * 0.22;
      targetRArmZ = -0.06;
      targetRForeX = -0.12 - recoil * 0.14;
      targetChestRotY += 0.18;
    } else if (equippedWeapon === 'bat') {
      const p = 1 - attackTimer / 0.28;
      const swingCurve = Math.sin(p * Math.PI);
      targetRArmX = -0.95 - swingCurve * 0.75;
      targetRArmZ = -0.42 + p * 0.95;
      targetRForeX = -0.35;
      targetChestRotY = (0.5 - p) * 0.75;
    } else {
      // Crisp Punch Jab / Cross with torso rotation
      const p = Math.sin((attackTimer / 0.28) * Math.PI);
      targetRArmX = -Math.PI * 0.48 * p - 0.3;
      targetRArmZ = -0.10;
      targetRForeX = -0.18 * (1 - p);
      targetChestRotY = 0.42 * p;
      targetLArmX = -0.35 * p;
      targetLArmZ = 0.14;
      targetLForeX = -0.95 * p;
    }
  }

  skel.hips.position.y = THREE.MathUtils.damp(skel.hips.position.y, targetHipsY, dampRate, dt);
  skel.hips.rotation.y = THREE.MathUtils.damp(skel.hips.rotation.y, targetHipsRotY, dampRate, dt);
  skel.spine.rotation.x = THREE.MathUtils.damp(skel.spine.rotation.x, targetSpineRotX, dampRate, dt);
  skel.chest.rotation.x = THREE.MathUtils.damp(skel.chest.rotation.x, targetChestRotX, dampRate, dt);
  skel.chest.rotation.y = THREE.MathUtils.damp(skel.chest.rotation.y, targetChestRotY, dampRate, dt);
  skel.head.rotation.x = THREE.MathUtils.damp(skel.head.rotation.x, targetHeadRotX, dampRate, dt);
  skel.head.rotation.y = THREE.MathUtils.damp(skel.head.rotation.y, targetHeadRotY, dampRate, dt);

  skel.leftThigh.rotation.x = THREE.MathUtils.damp(skel.leftThigh.rotation.x, targetLThighX, dampRate, dt);
  skel.leftShin.rotation.x = THREE.MathUtils.damp(skel.leftShin.rotation.x, targetLShinX, dampRate, dt);
  skel.leftFoot.rotation.x = THREE.MathUtils.damp(skel.leftFoot.rotation.x, targetLFootX, dampRate, dt);

  skel.rightThigh.rotation.x = THREE.MathUtils.damp(skel.rightThigh.rotation.x, targetRThighX, dampRate, dt);
  skel.rightShin.rotation.x = THREE.MathUtils.damp(skel.rightShin.rotation.x, targetRShinX, dampRate, dt);
  skel.rightFoot.rotation.x = THREE.MathUtils.damp(skel.rightFoot.rotation.x, targetRFootX, dampRate, dt);

  skel.leftUpperArm.rotation.x = THREE.MathUtils.damp(skel.leftUpperArm.rotation.x, targetLArmX, dampRate, dt);
  skel.leftUpperArm.rotation.z = THREE.MathUtils.damp(skel.leftUpperArm.rotation.z, targetLArmZ, dampRate, dt);
  skel.leftForeArm.rotation.x = THREE.MathUtils.damp(skel.leftForeArm.rotation.x, targetLForeX, dampRate, dt);

  skel.rightUpperArm.rotation.x = THREE.MathUtils.damp(skel.rightUpperArm.rotation.x, targetRArmX, dampRate, dt);
  skel.rightUpperArm.rotation.z = THREE.MathUtils.damp(skel.rightUpperArm.rotation.z, targetRArmZ, dampRate, dt);
  skel.rightForeArm.rotation.x = THREE.MathUtils.damp(skel.rightForeArm.rotation.x, targetRForeX, dampRate, dt);
}
