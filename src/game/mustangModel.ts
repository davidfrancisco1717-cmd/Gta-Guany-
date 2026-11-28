import * as THREE from 'three';
import type { VehicleSpec } from './types';

export interface WheelNode {
  pivot: THREE.Group;
  spinMesh: THREE.Object3D;
  localX: number;
  localZ: number;
  restY: number;
  isFront: boolean;
}

export interface MustangMaterialsInput {
  paintMat: THREE.Material;
  trimMat?: THREE.Material;
  chromeMat: THREE.Material;
  alloyMat?: THREE.Material;
  darkAlloyMat?: THREE.Material;
  tireMat?: THREE.Material;
  rotorMat?: THREE.Material;
  caliperRedMat?: THREE.Material;
  carbonMat?: THREE.Material;
  interiorMat: THREE.Material;
  seatMat: THREE.Material;
  glassMat?: THREE.Material;
  headlightMat: THREE.Material;
  taillightMat: THREE.Material;
  brakeLightMat: THREE.Material;
  reverseLightMat: THREE.Material;
  turnLeftMat?: THREE.Material;
  turnRightMat?: THREE.Material;
}

export interface MustangBuildResult {
  wheelNodes: WheelNode[];
  wheelMeshes: THREE.Object3D[];
  frontSteerPivots: THREE.Object3D[];
}

// ---------------------------------------------------------------------------
// Cached Procedural PBR Textures & Geometry Pool
// ---------------------------------------------------------------------------
const geoCache = new Map<string, THREE.BufferGeometry>();
function cachedMustangGeo(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = factory();
    geoCache.set(key, g);
  }
  return g;
}

interface MustangTexturePack {
  paintSide: THREE.CanvasTexture;
  paintTop: THREE.CanvasTexture;
  paintEnd: THREE.CanvasTexture;
  flakeRough: THREE.CanvasTexture;
  flakeNormal: THREE.CanvasTexture;
  tireTread: THREE.CanvasTexture;
  tireTreadNormal: THREE.CanvasTexture;
  honeycomb: THREE.CanvasTexture;
  honeycombNormal: THREE.CanvasTexture;
  rotorDiff: THREE.CanvasTexture;
  rotorNormal: THREE.CanvasTexture;
  ponyBadge: THREE.CanvasTexture;
  gtBadge: THREE.CanvasTexture;
  badge50: THREE.CanvasTexture;
  rearPlate: THREE.CanvasTexture;
  turnLens: THREE.CanvasTexture;
  gaugeCluster: THREE.CanvasTexture;
  centerScreen: THREE.CanvasTexture;
}

let cachedTextures: MustangTexturePack | null = null;

function createBasePaintCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, '#ffffff');
  grad.addColorStop(0.65, '#faf8f8');
  grad.addColorStop(1.0, '#f2eeee');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  return [c, ctx];
}

function getMustangTextures(): MustangTexturePack {
  if (cachedTextures) return cachedTextures;

  // 1. Metallic Flake Micro-Roughness + Normal Map
  const flakeCanvas = document.createElement('canvas');
  flakeCanvas.width = 256;
  flakeCanvas.height = 256;
  const fctx = flakeCanvas.getContext('2d')!;
  const fImg = fctx.createImageData(256, 256);

  const fNormCanvas = document.createElement('canvas');
  fNormCanvas.width = 256;
  fNormCanvas.height = 256;
  const fnCtx = fNormCanvas.getContext('2d')!;
  const fnImg = fnCtx.createImageData(256, 256);

  let seed = 41927;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < 256 * 256 * 4; i += 4) {
    const r = rand();
    const v = Math.floor(46 + r * 14);
    fImg.data[i] = v;
    fImg.data[i + 1] = v;
    fImg.data[i + 2] = v;
    fImg.data[i + 3] = 255;

    fnImg.data[i] = Math.floor(124 + (rand() - 0.5) * 6);
    fnImg.data[i + 1] = Math.floor(124 + (rand() - 0.5) * 6);
    fnImg.data[i + 2] = 255;
    fnImg.data[i + 3] = 255;
  }
  fctx.putImageData(fImg, 0, 0);
  fnCtx.putImageData(fnImg, 0, 0);

  const flakeRough = new THREE.CanvasTexture(flakeCanvas);
  flakeRough.wrapS = THREE.RepeatWrapping;
  flakeRough.wrapT = THREE.RepeatWrapping;
  flakeRough.repeat.set(10, 10);

  const flakeNormal = new THREE.CanvasTexture(fNormCanvas);
  flakeNormal.wrapS = THREE.RepeatWrapping;
  flakeNormal.wrapT = THREE.RepeatWrapping;
  flakeNormal.repeat.set(10, 10);

  // 2. Side Albedo Map (Clean door seam lines + subtle fuel cap outline)
  const [sideC, sctx] = createBasePaintCanvas(1024, 512);
  sctx.strokeStyle = 'rgba(20, 4, 4, 0.34)';
  sctx.lineWidth = 2.0;

  // Front fender / door shutline
  sctx.beginPath();
  sctx.moveTo(644, 58);
  sctx.lineTo(652, 472);
  sctx.stroke();

  // Rear door trailing shutline curving around rear haunch
  sctx.beginPath();
  sctx.moveTo(392, 66);
  sctx.quadraticCurveTo(374, 232, 412, 470);
  sctx.stroke();

  // Fuel filler cap circle on rear quarter
  sctx.strokeStyle = 'rgba(20, 4, 4, 0.30)';
  sctx.lineWidth = 1.8;
  sctx.beginPath();
  sctx.ellipse(278, 172, 22, 17, 0, 0, Math.PI * 2);
  sctx.stroke();

  const paintSide = new THREE.CanvasTexture(sideC);
  paintSide.colorSpace = THREE.SRGBColorSpace;
  paintSide.anisotropy = 8;

  // 3. Top Albedo Map (Clean Mustang Hood + Roofline panel shutlines)
  const [topC, tctx] = createBasePaintCanvas(1024, 1024);
  tctx.strokeStyle = 'rgba(20, 4, 4, 0.28)';
  tctx.lineWidth = 2.2;
  tctx.strokeRect(202, 54, 620, 344);
  // Roof ditch channels
  tctx.beginPath();
  tctx.moveTo(278, 498);
  tctx.lineTo(298, 760);
  tctx.moveTo(746, 498);
  tctx.lineTo(726, 760);
  tctx.stroke();

  const paintTop = new THREE.CanvasTexture(topC);
  paintTop.colorSpace = THREE.SRGBColorSpace;
  paintTop.anisotropy = 8;

  // 4. Front & Rear End Albedo Map
  const [endC] = createBasePaintCanvas(512, 512);
  const paintEnd = new THREE.CanvasTexture(endC);
  paintEnd.colorSpace = THREE.SRGBColorSpace;
  paintEnd.anisotropy = 8;

  // 5. Tire Tread + Normal Map
  const treadCanvas = document.createElement('canvas');
  treadCanvas.width = 256;
  treadCanvas.height = 512;
  const trCtx = treadCanvas.getContext('2d')!;
  trCtx.fillStyle = '#1b1d22';
  trCtx.fillRect(0, 0, 256, 512);

  const trNCanvas = document.createElement('canvas');
  trNCanvas.width = 256;
  trNCanvas.height = 512;
  const trNCtx = trNCanvas.getContext('2d')!;
  trNCtx.fillStyle = 'rgb(128,128,255)';
  trNCtx.fillRect(0, 0, 256, 512);

  for (const gx of [46, 98, 158, 210]) {
    trCtx.fillStyle = '#0a0b0d';
    trCtx.fillRect(gx - 6, 0, 12, 512);
    trNCtx.fillStyle = 'rgb(128,128,165)';
    trNCtx.fillRect(gx - 6, 0, 12, 512);
  }
  for (let y = 0; y < 512; y += 22) {
    trCtx.strokeStyle = '#0d0e12';
    trCtx.lineWidth = 4;
    trCtx.beginPath();
    trCtx.moveTo(8, y);
    trCtx.lineTo(118, y + 12);
    trCtx.moveTo(248, y);
    trCtx.lineTo(138, y + 12);
    trCtx.stroke();

    trNCtx.strokeStyle = 'rgb(148,108,185)';
    trNCtx.lineWidth = 4;
    trNCtx.beginPath();
    trNCtx.moveTo(8, y);
    trNCtx.lineTo(118, y + 12);
    trNCtx.moveTo(248, y);
    trNCtx.lineTo(138, y + 12);
    trNCtx.stroke();
  }

  const tireTread = new THREE.CanvasTexture(treadCanvas);
  tireTread.colorSpace = THREE.SRGBColorSpace;
  tireTread.wrapS = THREE.RepeatWrapping;
  tireTread.wrapT = THREE.RepeatWrapping;
  tireTread.repeat.set(1, 5);
  tireTread.anisotropy = 8;

  const tireTreadNormal = new THREE.CanvasTexture(trNCanvas);
  tireTreadNormal.wrapS = THREE.RepeatWrapping;
  tireTreadNormal.wrapT = THREE.RepeatWrapping;
  tireTreadNormal.repeat.set(1, 5);

  // 6. Signature Mustang Hexagonal Honeycomb Grille + Normal Map
  const hexCanvas = document.createElement('canvas');
  hexCanvas.width = 256;
  hexCanvas.height = 256;
  const hctx = hexCanvas.getContext('2d')!;
  hctx.fillStyle = '#050608';
  hctx.fillRect(0, 0, 256, 256);

  const hexNCanvas = document.createElement('canvas');
  hexNCanvas.width = 256;
  hexNCanvas.height = 256;
  const hnctx = hexNCanvas.getContext('2d')!;
  hnctx.fillStyle = 'rgb(128,128,210)';
  hnctx.fillRect(0, 0, 256, 256);

  const rHex = 11;
  const dx = rHex * 1.5;
  const dy = rHex * Math.sqrt(3);
  hctx.strokeStyle = '#2b2f3a';
  hctx.lineWidth = 3.2;
  hnctx.strokeStyle = 'rgb(165,165,255)';
  hnctx.lineWidth = 3.2;

  for (let row = -1; row < 256 / dy + 2; row++) {
    for (let col = -1; col < 256 / dx + 2; col++) {
      const cx = col * dx;
      const cy = row * dy + (col % 2 === 0 ? 0 : dy * 0.5);
      for (const ctx of [hctx, hnctx]) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const px = cx + (rHex - 1.2) * Math.cos(a);
          const py = cy + (rHex - 1.2) * Math.sin(a);
          if (k === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  const honeycomb = new THREE.CanvasTexture(hexCanvas);
  honeycomb.colorSpace = THREE.SRGBColorSpace;
  honeycomb.wrapS = THREE.RepeatWrapping;
  honeycomb.wrapT = THREE.RepeatWrapping;
  honeycomb.repeat.set(5.2, 2.0);
  honeycomb.anisotropy = 8;

  const honeycombNormal = new THREE.CanvasTexture(hexNCanvas);
  honeycombNormal.wrapS = THREE.RepeatWrapping;
  honeycombNormal.wrapT = THREE.RepeatWrapping;
  honeycombNormal.repeat.set(5.2, 2.0);

  // 7. Ventilated Brake Rotor Diffuse & Normal
  const rotorCanvas = document.createElement('canvas');
  rotorCanvas.width = 256;
  rotorCanvas.height = 256;
  const rctx = rotorCanvas.getContext('2d')!;
  rctx.fillStyle = '#adb4bf';
  rctx.fillRect(0, 0, 256, 256);

  const rotorNCanvas = document.createElement('canvas');
  rotorNCanvas.width = 256;
  rotorNCanvas.height = 256;
  const rnctx = rotorNCanvas.getContext('2d')!;
  rnctx.fillStyle = 'rgb(128,128,255)';
  rnctx.fillRect(0, 0, 256, 256);

  for (let rad = 52; rad <= 122; rad += 6) {
    rctx.strokeStyle = rad % 12 === 0 ? 'rgba(255,255,255,0.28)' : 'rgba(60,65,75,0.22)';
    rctx.lineWidth = 2;
    rctx.beginPath();
    rctx.arc(128, 128, rad, 0, Math.PI * 2);
    rctx.stroke();
  }
  for (let a = 0; a < 18; a++) {
    const ang = (a / 18) * Math.PI * 2;
    for (const rr of [68, 86, 104]) {
      const px = 128 + Math.cos(ang + rr * 0.012) * rr;
      const py = 128 + Math.sin(ang + rr * 0.012) * rr;
      rctx.fillStyle = '#252930';
      rctx.beginPath();
      rctx.arc(px, py, 2.5, 0, Math.PI * 2);
      rctx.fill();

      rnctx.fillStyle = 'rgb(128,128,175)';
      rnctx.beginPath();
      rnctx.arc(px, py, 2.5, 0, Math.PI * 2);
      rnctx.fill();
    }
  }
  const rotorDiff = new THREE.CanvasTexture(rotorCanvas);
  rotorDiff.colorSpace = THREE.SRGBColorSpace;
  const rotorNormal = new THREE.CanvasTexture(rotorNCanvas);

  // 8. Authentic Galloping Silver Mustang Pony Front Grille Emblem
  const ponyCanvas = document.createElement('canvas');
  ponyCanvas.width = 512;
  ponyCanvas.height = 256;
  const pctx = ponyCanvas.getContext('2d')!;
  pctx.clearRect(0, 0, 512, 256);

  const ponyGrad = pctx.createLinearGradient(90, 40, 420, 210);
  ponyGrad.addColorStop(0.0, '#ffffff');
  ponyGrad.addColorStop(0.38, '#cbd5e1');
  ponyGrad.addColorStop(0.65, '#64748b');
  ponyGrad.addColorStop(1.0, '#e2e8f0');

  pctx.save();
  pctx.shadowColor = 'rgba(0,0,0,0.88)';
  pctx.shadowBlur = 10;
  pctx.shadowOffsetY = 4;
  pctx.fillStyle = ponyGrad;
  pctx.beginPath();
  // Authentic galloping Mustang pony silhouette (proud arched neck, ears, bent left knee, extended legs, windswept tail)
  pctx.moveTo(86, 84); // muzzle tip
  pctx.quadraticCurveTo(96, 62, 124, 44); // bridge of nose
  pctx.lineTo(132, 26); // upright ear tip
  pctx.lineTo(142, 40); // poll behind ears
  pctx.quadraticCurveTo(184, 34, 224, 72); // muscular arched crest & withers
  pctx.quadraticCurveTo(286, 80, 348, 70); // taut horizontal back
  pctx.quadraticCurveTo(400, 56, 452, 62); // long flowing tail top
  pctx.quadraticCurveTo(432, 82, 384, 84); // swept tail underside
  pctx.quadraticCurveTo(372, 102, 386, 126); // muscular croup
  pctx.lineTo(446, 166); // trailing hind hoof stretched back
  pctx.lineTo(436, 174);
  pctx.lineTo(370, 138); // hock
  pctx.lineTo(342, 176); // planted hind hoof
  pctx.lineTo(328, 174);
  pctx.lineTo(340, 122); // flank
  pctx.quadraticCurveTo(274, 128, 212, 126); // lean athletic barrel
  pctx.lineTo(188, 180); // trailing foreleg extended down
  pctx.lineTo(176, 178);
  pctx.lineTo(190, 128); // shoulder
  pctx.lineTo(146, 140); // sharp bent forward knee
  pctx.lineTo(172, 168); // tucked hoof angled back under knee
  pctx.lineTo(160, 172);
  pctx.lineTo(132, 138); // front knee tip
  pctx.lineTo(164, 112); // deep chest
  pctx.quadraticCurveTo(138, 96, 124, 78); // crisp jawline
  pctx.lineTo(94, 90); // lower lip
  pctx.closePath();
  pctx.fill();
  pctx.restore();

  pctx.strokeStyle = 'rgba(255,255,255,0.92)';
  pctx.lineWidth = 2.0;
  pctx.stroke();

  const ponyBadge = new THREE.CanvasTexture(ponyCanvas);
  ponyBadge.colorSpace = THREE.SRGBColorSpace;
  ponyBadge.anisotropy = 8;

  // 9. Rear Decklid "GT" Emblem
  const gtCanvas = document.createElement('canvas');
  gtCanvas.width = 512;
  gtCanvas.height = 256;
  const gctx = gtCanvas.getContext('2d')!;
  gctx.clearRect(0, 0, 512, 256);

  const gtGrad = gctx.createLinearGradient(0, 40, 0, 210);
  gtGrad.addColorStop(0.0, '#f8fafc');
  gtGrad.addColorStop(0.45, '#cbd5e1');
  gtGrad.addColorStop(0.65, '#64748b');
  gtGrad.addColorStop(1.0, '#e2e8f0');

  gctx.save();
  gctx.shadowColor = 'rgba(0,0,0,0.85)';
  gctx.shadowBlur = 8;
  gctx.shadowOffsetY = 3;
  gctx.fillStyle = gtGrad;
  gctx.font = 'italic 900 154px "Arial Black", Impact, sans-serif';
  gctx.textAlign = 'center';
  gctx.textBaseline = 'middle';
  gctx.fillText('GT', 256, 132);
  gctx.strokeStyle = 'rgba(255,255,255,0.75)';
  gctx.lineWidth = 3;
  gctx.strokeText('GT', 256, 132);
  gctx.restore();

  const gtBadge = new THREE.CanvasTexture(gtCanvas);
  gtBadge.colorSpace = THREE.SRGBColorSpace;
  gtBadge.anisotropy = 8;

  // 10. Fender "5.0" Chrome Badge with Red Decimal Dot
  const b50Canvas = document.createElement('canvas');
  b50Canvas.width = 256;
  b50Canvas.height = 128;
  const bctx = b50Canvas.getContext('2d')!;
  bctx.clearRect(0, 0, 256, 128);
  bctx.fillStyle = '#e5e7eb';
  bctx.strokeStyle = '#334155';
  bctx.lineWidth = 3;
  bctx.font = 'italic 900 84px "Arial Black", sans-serif';
  bctx.textBaseline = 'middle';
  bctx.fillText('5', 42, 66);
  bctx.strokeText('5', 42, 66);
  bctx.fillText('0', 134, 66);
  bctx.strokeText('0', 134, 66);
  bctx.fillStyle = '#dc1e1e';
  bctx.fillRect(108, 76, 18, 18);

  const badge50 = new THREE.CanvasTexture(b50Canvas);
  badge50.colorSpace = THREE.SRGBColorSpace;
  badge50.anisotropy = 8;

  // 11. Rear License Plate
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 256;
  plateCanvas.height = 128;
  const plctx = plateCanvas.getContext('2d')!;
  plctx.fillStyle = '#f8fafc';
  plctx.fillRect(0, 0, 256, 128);
  plctx.fillStyle = '#991b1b';
  plctx.fillRect(0, 0, 256, 26);
  plctx.fillStyle = '#ffffff';
  plctx.font = 'bold 13px sans-serif';
  plctx.textAlign = 'center';
  plctx.fillText('SAN VERDE', 128, 18);
  plctx.fillStyle = '#0f172a';
  plctx.font = 'bold 42px monospace';
  plctx.fillText('GT 5.0', 128, 84);
  plctx.strokeStyle = '#334155';
  plctx.lineWidth = 5;
  plctx.strokeRect(4, 4, 248, 120);

  const rearPlate = new THREE.CanvasTexture(plateCanvas);
  rearPlate.colorSpace = THREE.SRGBColorSpace;

  // 12. Clear Textured Turn Signal Strip Lens
  const turnCanvas = document.createElement('canvas');
  turnCanvas.width = 128;
  turnCanvas.height = 64;
  const tlctx = turnCanvas.getContext('2d')!;
  tlctx.fillStyle = '#d4dbe4';
  tlctx.fillRect(0, 0, 128, 64);
  for (let x = 4; x < 128; x += 8) {
    tlctx.fillStyle = 'rgba(255,255,255,0.42)';
    tlctx.fillRect(x, 4, 3, 56);
    tlctx.fillStyle = 'rgba(50,60,75,0.22)';
    tlctx.fillRect(x + 3, 4, 2, 56);
  }
  const turnLens = new THREE.CanvasTexture(turnCanvas);
  turnLens.colorSpace = THREE.SRGBColorSpace;

  // 13. Dual Gauge Cluster + SYNC Center Screen for Interior
  const gaugeCanvas = document.createElement('canvas');
  gaugeCanvas.width = 256;
  gaugeCanvas.height = 128;
  const gc = gaugeCanvas.getContext('2d')!;
  gc.fillStyle = '#07090d';
  gc.fillRect(0, 0, 256, 128);
  for (const cx of [70, 186]) {
    gc.strokeStyle = '#cbd5e1';
    gc.lineWidth = 5;
    gc.beginPath();
    gc.arc(cx, 66, 44, 0, Math.PI * 2);
    gc.stroke();
    gc.strokeStyle = '#60a5fa';
    gc.lineWidth = 2;
    gc.beginPath();
    gc.arc(cx, 66, 36, Math.PI * 0.75, Math.PI * 2.25);
    gc.stroke();
    gc.strokeStyle = '#ef4444';
    gc.lineWidth = 3;
    gc.beginPath();
    gc.moveTo(cx, 66);
    gc.lineTo(cx - 22, 42);
    gc.stroke();
  }
  const gaugeCluster = new THREE.CanvasTexture(gaugeCanvas);
  gaugeCluster.colorSpace = THREE.SRGBColorSpace;

  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = 256;
  scrCanvas.height = 160;
  const sc = scrCanvas.getContext('2d')!;
  sc.fillStyle = '#0b1220';
  sc.fillRect(0, 0, 256, 160);
  sc.fillStyle = '#1e3a5f';
  sc.fillRect(10, 10, 236, 28);
  sc.fillStyle = '#0f2036';
  sc.fillRect(16, 48, 106, 96);
  sc.fillStyle = '#162844';
  sc.fillRect(132, 48, 110, 44);
  sc.fillRect(132, 100, 110, 44);
  sc.fillStyle = '#ffffff';
  sc.font = 'bold 15px sans-serif';
  sc.fillText('SYNC · GT', 18, 28);

  const centerScreen = new THREE.CanvasTexture(scrCanvas);
  centerScreen.colorSpace = THREE.SRGBColorSpace;

  cachedTextures = {
    paintSide,
    paintTop,
    paintEnd,
    flakeRough,
    flakeNormal,
    tireTread,
    tireTreadNormal,
    honeycomb,
    honeycombNormal,
    rotorDiff,
    rotorNormal,
    ponyBadge,
    gtBadge,
    badge50,
    rearPlate,
    turnLens,
    gaugeCluster,
    centerScreen,
  };
  return cachedTextures;
}

// ---------------------------------------------------------------------------
// S550 Body Contour Math (Exact 1:1 2015 Ford Mustang GT Fastback: 4.784m x 1.916m x 1.381m)
// ---------------------------------------------------------------------------
const WHEEL_Z = 1.360; // 2.720 m wheelbase
const WHEEL_R = 0.343; // 0.686 m tire diameter
const ARCH_R = 0.388;
const FRONT_WHEEL_X = 0.791; // 1.582 m front track
const REAR_WHEEL_X = 0.824;  // 1.648 m rear track
const FRONT_JOIN_Z = 2.04;
const REAR_JOIN_Z = -2.04;

function smoothstep(e0: number, e1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function bell(x: number, center: number, width: number): number {
  const d = (x - center) / width;
  return Math.exp(-d * d);
}

function bodyHalfW(z: number): number {
  let hw = 0.896;
  hw += 0.032 * bell(z, WHEEL_Z, 0.44);  // front fender flare
  hw += 0.044 * bell(z, -WHEEL_Z, 0.52); // wide rear haunch hips (max body width 1.916m)
  hw -= 0.072 * smoothstep(1.66, 2.392, z);  // nose corner wrap taper
  hw -= 0.076 * smoothstep(-1.68, -2.392, z); // tail corner wrap taper
  return hw;
}

function beltlineY(z: number): number {
  const gentleDip = -0.008 * bell(z, 0.04, 0.42);
  const rearKick = 0.088 * smoothstep(-0.34, -1.26, z) * (1 - 0.14 * smoothstep(-1.72, -2.392, z));
  return 0.855 + gentleDip + rearKick;
}

function sideBottomY(z: number): number {
  let y = 0.152; // ~0.143 m ground clearance with lower rocker/splitter
  for (const wz of [WHEEL_Z, -WHEEL_Z]) {
    const dz = Math.abs(z - wz);
    if (dz < ARCH_R) {
      const archY = WHEEL_R + Math.sqrt(Math.max(0, ARCH_R * ARCH_R - dz * dz));
      y = Math.max(y, archY);
    }
  }
  if (z > 1.78) y = Math.max(y, 0.168 + 0.024 * smoothstep(1.86, 2.392, z));
  if (z < -1.78) y = Math.max(y, 0.185 + 0.055 * smoothstep(-1.82, -2.392, z));
  return y;
}

function sideTopEdgeX(z: number): number {
  if (z >= 0.54) {
    return 0.775 - 0.078 * smoothstep(0.54, 2.36, z);
  }
  if (z >= -1.94) {
    return (
      0.775 -
      0.034 * smoothstep(0.54, -0.35, z) +
      0.045 * smoothstep(-0.55, -1.35, z) -
      0.068 * smoothstep(-1.45, -2.04, z)
    );
  }
  return 0.718 - 0.054 * smoothstep(-1.94, -2.392, z);
}

function frontBrowZ(u: number): number {
  const au = Math.abs(u);
  return 2.352 - (2.352 - FRONT_JOIN_Z) * Math.pow(au, 2.55);
}

function frontSurfaceZ(x: number, vf: number): number {
  const u = THREE.MathUtils.clamp(x / bodyHalfW(FRONT_JOIN_Z), -1, 1);
  const edgeFade = 1 - Math.pow(Math.abs(u), 2.8);
  const sharkTilt = 0.032 * smoothstep(0.32, 0.72, vf) * edgeFade;
  return frontBrowZ(u) + sharkTilt;
}

function rearBrowZ(u: number): number {
  const au = Math.abs(u);
  return -2.370 + (REAR_JOIN_Z - -2.370) * Math.pow(au, 2.55);
}

function hoodSurfaceY(x: number, z: number): number {
  const t = THREE.MathUtils.clamp((z - 0.54) / 1.84, 0, 1);
  const base = THREE.MathUtils.lerp(0.858, 0.696, Math.pow(t, 1.55));
  const ax = Math.abs(x);
  const powerDome = 0.028 * bell(ax, 0.31, 0.115) * (1 - 0.42 * smoothstep(1.68, 2.34, z));
  const centerCrown = 0.015 * Math.cos(Math.min(1, ax / 0.76) * Math.PI * 0.5);
  const fenderArchLift = 0.036 * bell(z, WHEEL_Z, 0.36) * smoothstep(0.42, 0.74, ax);
  return base + powerDome + centerCrown + fenderArchLift;
}

function sideTopY(z: number): number {
  if (z >= 0.54) {
    return hoodSurfaceY(sideTopEdgeX(z), z);
  }
  return beltlineY(z);
}

function rearDeckTopY(u: number, z: number): number {
  const edge = beltlineY(z);
  const ducktail = 0.024 * smoothstep(-2.06, -2.392, z) * (1 - Math.pow(Math.abs(u), 2.4));
  return edge + ducktail;
}

// Unified Smooth Fastback Greenhouse Profile (Total height 1.381 m)
function cabinOuterHalfW(z: number): number {
  if (z >= 0.02) {
    const tf = THREE.MathUtils.clamp((0.54 - z) / 0.52, 0, 1);
    return THREE.MathUtils.lerp(sideTopEdgeX(0.54), 0.618, smoothstep(0, 1, tf));
  }
  if (z >= -1.16) {
    const tf = THREE.MathUtils.clamp((0.02 - z) / 1.18, 0, 1);
    return THREE.MathUtils.lerp(0.618, 0.585, tf);
  }
  const tf = THREE.MathUtils.clamp((-1.16 - z) / 0.78, 0, 1);
  return THREE.MathUtils.lerp(0.585, sideTopEdgeX(-1.94), smoothstep(0, 1, tf));
}

function cabinInnerHalfW(z: number): number {
  if (z >= 0.02) {
    const tf = THREE.MathUtils.clamp((0.54 - z) / 0.52, 0, 1);
    return THREE.MathUtils.lerp(0.705, 0.560, smoothstep(0, 1, tf));
  }
  if (z >= -1.16) {
    const tf = THREE.MathUtils.clamp((0.02 - z) / 1.18, 0, 1);
    return THREE.MathUtils.lerp(0.560, 0.528, tf);
  }
  const tf = THREE.MathUtils.clamp((-1.16 - z) / 0.78, 0, 1);
  return THREE.MathUtils.lerp(0.528, 0.505, tf);
}

function cabinCenterY(z: number): number {
  if (z >= -0.10) {
    const tf = smoothstep(0.54, -0.10, z);
    return THREE.MathUtils.lerp(sideTopY(0.54), 1.375, Math.pow(tf, 0.88));
  }
  if (z >= -0.44) {
    const tf = smoothstep(-0.10, -0.44, z);
    return 1.375 + 0.006 * Math.sin(tf * Math.PI) - 0.004 * tf; // 1.381 m exact peak height
  }
  const tf = smoothstep(-0.44, -1.94, z);
  return THREE.MathUtils.lerp(1.371, sideTopY(-1.94), Math.pow(tf, 1.32));
}

function sideSectionX(hw: number, t: number, z: number): number {
  const archZone =
    bell(z, WHEEL_Z, ARCH_R * 1.32) + bell(z, -WHEEL_Z, ARCH_R * 1.32);
  const flare = 0.028 * Math.min(1, archZone);
  const inArch = Math.max(
    1 - smoothstep(ARCH_R - 0.05, ARCH_R + 0.12, Math.abs(z - WHEEL_Z)),
    1 - smoothstep(ARCH_R - 0.05, ARCH_R + 0.12, Math.abs(z + WHEEL_Z)),
  );
  const doorScoop = -0.042 * bell(z, -0.04, 0.50) * Math.sin(smoothstep(0.18, 0.68, t) * Math.PI);
  const botX = THREE.MathUtils.lerp(hw - 0.062, hw + 0.002 + flare, inArch);

  if (t <= 0.14) {
    return THREE.MathUtils.lerp(botX, hw - 0.006 + flare, t / 0.14);
  }
  if (t <= 0.48) {
    return hw - 0.006 + flare + doorScoop + 0.022 * Math.sin(((t - 0.14) / 0.34) * Math.PI * 0.5);
  }
  if (t <= 0.76) {
    return hw + 0.016 + flare + doorScoop * 0.5;
  }
  const topX = sideTopEdgeX(z);
  const roll = (t - 0.76) / 0.24;
  return THREE.MathUtils.lerp(hw + 0.016 + flare, topX, Math.pow(roll, 1.32));
}

function buildLoftedGridGeometry(
  grid: THREE.Vector3[][],
  outwardHint: (uFrac: number, vFrac: number, p: THREE.Vector3) => THREE.Vector3,
  uvGrid?: THREE.Vector2[][],
): THREE.BufferGeometry {
  const rows = grid.length;
  const cols = grid[0].length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = grid[r][c];
      positions.push(p.x, p.y, p.z);
      const uv = uvGrid ? uvGrid[r][c] : new THREE.Vector2(c / (cols - 1), r / (rows - 1));
      uvs.push(uv.x, uv.y);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = a + 1;
      const d = (r + 1) * cols + c;
      const e = d + 1;

      const pa = grid[r][c];
      const pb = grid[r][c + 1];
      const pd = grid[r + 1][c];
      const triN = new THREE.Vector3().subVectors(pb, pa).cross(new THREE.Vector3().subVectors(pd, pa));
      const hint = outwardHint((c + 0.5) / (cols - 1), (r + 0.5) / (rows - 1), pa);

      if (triN.dot(hint) >= 0) {
        indices.push(a, b, d, b, e, d);
      } else {
        indices.push(a, d, b, b, d, e);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Solid Wheel & Tire Geometry Helpers (20" Mustang GT 10-Y-Spoke)
// ---------------------------------------------------------------------------
function getMustangTireTreadGeo(r: number, width: number): THREE.BufferGeometry {
  return cachedMustangGeo(`mus_tread_v5_${r.toFixed(3)}_${width.toFixed(3)}`, () => {
    const g = new THREE.CylinderGeometry(r, r, width * 0.90, 36, 1, true);
    g.rotateZ(Math.PI / 2);
    return g;
  });
}

function getMustangSidewallGeo(r: number, width: number): THREE.BufferGeometry {
  return cachedMustangGeo(`mus_sidewall_v5_${r.toFixed(3)}_${width.toFixed(3)}`, () => {
    const pts: THREE.Vector2[] = [];
    const innerR = r * 0.665;
    const outerR = r;
    const halfW = width * 0.5;
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const rad = THREE.MathUtils.lerp(innerR, outerR, t);
      const bulge = Math.sin(t * Math.PI) * 0.015;
      const shoulder = halfW * 0.90 + bulge;
      pts.push(new THREE.Vector2(rad, shoulder));
    }
    const g = new THREE.LatheGeometry(pts, 36);
    g.rotateZ(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}

function getMustangYSpokeGeo(r: number): THREE.BufferGeometry {
  return cachedMustangGeo(`mus_yspoke_v4_${r.toFixed(3)}`, () => {
    const s = new THREE.Shape();
    const hubR = r * 0.15;
    const splitR = r * 0.34;
    const rimR = r * 0.662;
    s.moveTo(-0.018, hubR);
    s.lineTo(0.018, hubR);
    s.lineTo(0.022, splitR);
    s.lineTo(0.078, rimR);
    s.lineTo(0.046, rimR);
    s.lineTo(0.004, splitR + 0.018);
    s.lineTo(-0.046, rimR);
    s.lineTo(-0.078, rimR);
    s.lineTo(-0.022, splitR);
    s.closePath();

    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.022,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    g.translate(0, 0, -0.011);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
  });
}

function getRotorDiscGeo(innerR: number, outerR: number): THREE.BufferGeometry {
  return cachedMustangGeo(`mus_rotor_${innerR.toFixed(3)}_${outerR.toFixed(3)}`, () => {
    const g = new THREE.RingGeometry(innerR, outerR, 32);
    g.rotateY(Math.PI / 2);
    return g;
  });
}

// ---------------------------------------------------------------------------
// Main 2015 Ford Mustang GT 5.0 Coupe Builder
// ---------------------------------------------------------------------------
export function buildMustangGTModel(
  spec: VehicleSpec,
  group: THREE.Group,
  bodyGroup: THREE.Group,
  mats: MustangMaterialsInput,
): MustangBuildResult {
  const tex = getMustangTextures();

  const wheelNodes: WheelNode[] = [];
  const wheelMeshes: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Object3D[] = [];

  // Rich Gloss Race Red Paint (#D91E18, respects Garage repaints!)
  const basePaintColor = new THREE.Color(0xd91e18);
  if ('color' in mats.paintMat && (mats.paintMat as THREE.MeshPhysicalMaterial).color) {
    basePaintColor.copy((mats.paintMat as THREE.MeshPhysicalMaterial).color);
  }

  const paintParams = {
    color: basePaintColor,
    roughnessMap: tex.flakeRough,
    normalMap: tex.flakeNormal,
    normalScale: new THREE.Vector2(0.014, 0.014),
    metalness: 0.42,
    roughness: 0.20,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 0.95,
  };

  const sidePaintMat = new THREE.MeshPhysicalMaterial({ ...paintParams, map: tex.paintSide });
  const topPaintMat = new THREE.MeshPhysicalMaterial({ ...paintParams, map: tex.paintTop });
  const endPaintMat = new THREE.MeshPhysicalMaterial({ ...paintParams, map: tex.paintEnd });
  const redUniformMat = new THREE.MeshPhysicalMaterial({ ...paintParams });

  // Smoked Automotive Glass (opacity ~0.44 revealing Recaro cabin)
  const mustangGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x111518,
    metalness: 0.08,
    roughness: 0.06,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.44,
    depthWrite: false,
    side: THREE.DoubleSide,
    envMapIntensity: 1.65,
  });
  bodyGroup.userData.camaroGlassMat = mustangGlassMat;

  const lensCoverGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x10141c,
    metalness: 0.08,
    roughness: 0.03,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    envMapIntensity: 1.6,
  });

  const satinBlackMat = new THREE.MeshStandardMaterial({
    color: 0x181818,
    roughness: 0.80,
    metalness: 0.10,
  });

  const archLinerMat = new THREE.MeshStandardMaterial({
    color: 0x0d0f13,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const glossBlackDeckMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0a0a,
    roughness: 0.10,
    metalness: 0.48,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    envMapIntensity: 1.15,
  });

  const honeycombMat = new THREE.MeshStandardMaterial({
    map: tex.honeycomb,
    normalMap: tex.honeycombNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    color: 0x1a1a1a,
    roughness: 0.78,
    metalness: 0.10,
    envMapIntensity: 0.25,
  });

  const gunmetalSpokeMat = new THREE.MeshPhysicalMaterial({
    color: 0x525760,
    roughness: 0.25,
    metalness: 0.68,
    clearcoat: 0.55,
    envMapIntensity: 1.0,
  });

  const rimLipMat = new THREE.MeshStandardMaterial({
    color: 0xb6beca,
    roughness: 0.24,
    metalness: 0.75,
    envMapIntensity: 1.0,
  });

  const machinedAlloyMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.20,
    metalness: 0.65,
    envMapIntensity: 1.1,
  });

  const tireTreadMat = new THREE.MeshStandardMaterial({
    map: tex.tireTread,
    normalMap: tex.tireTreadNormal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.04,
  });

  const tireSidewallMat = new THREE.MeshStandardMaterial({
    color: 0x1b1d22,
    roughness: 0.82,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });

  const rotorMat = new THREE.MeshStandardMaterial({
    map: tex.rotorDiff,
    normalMap: tex.rotorNormal,
    normalScale: new THREE.Vector2(0.95, 0.95),
    color: 0xd1d5db,
    roughness: 0.28,
    metalness: 0.86,
    side: THREE.DoubleSide,
  });

  const caliperMat = new THREE.MeshPhysicalMaterial({
    color: 0x374151,
    metalness: 0.55,
    roughness: 0.28,
    clearcoat: 0.65,
  });

  const drlWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xeef6ff,
    emissiveIntensity: 2.0,
    roughness: 0.12,
  });

  const fogLampMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xfff8e6,
    emissiveIntensity: 1.1,
    roughness: 0.12,
  });

  const amberMarkerMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xb45309,
    emissiveIntensity: 0.65,
    roughness: 0.18,
  });

  const redMarkerMat = new THREE.MeshStandardMaterial({
    color: 0xb91c1c,
    emissive: 0x991b1b,
    emissiveIntensity: 0.45,
    roughness: 0.20,
  });

  const turnSignalMat = new THREE.MeshStandardMaterial({
    map: tex.turnLens,
    color: 0xe2e8f0,
    emissive: 0x111827,
    roughness: 0.16,
    metalness: 0.35,
  });

  // -------------------------------------------------------------------------
  // 0. Exact 1:1 10-Y-Spoke Wheels + Tires (1.582m front track / 1.648m rear track, r=0.343m)
  // -------------------------------------------------------------------------
  const addMustangWheel = (wx: number, wy: number, wz: number, isFront: boolean, width: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(wx, wy, wz);
    const wheelObj = new THREE.Group();
    if (wx < 0) wheelObj.rotation.y = Math.PI;

    const r = WHEEL_R;

    const tread = new THREE.Mesh(getMustangTireTreadGeo(r, width), tireTreadMat);
    tread.castShadow = true;
    wheelObj.add(tread);

    // Both sidewalls with DoubleSide + proper +X/-X placement so tires are 100% solid
    const sideGeo = getMustangSidewallGeo(r, width);
    const outerSide = new THREE.Mesh(sideGeo, tireSidewallMat);
    wheelObj.add(outerSide);

    const innerSide = new THREE.Mesh(sideGeo, tireSidewallMat);
    innerSide.rotation.y = Math.PI;
    wheelObj.add(innerSide);

    // Dark inner wheel backing plate so you never see through the wheel spokes to the road
    const innerBackGeo = cachedMustangGeo(`mus_wback_${r.toFixed(3)}`, () => {
      const g = new THREE.CircleGeometry(r * 0.66, 28);
      g.rotateY(Math.PI / 2);
      return g;
    });
    const innerBack = new THREE.Mesh(innerBackGeo, archLinerMat);
    innerBack.position.x = -width * 0.36;
    wheelObj.add(innerBack);

    const outerLipGeo = cachedMustangGeo(`mus_olip_v4_${r.toFixed(3)}`, () => {
      const g = new THREE.TorusGeometry(r * 0.672, 0.0085, 10, 36);
      g.rotateY(Math.PI / 2);
      return g;
    });
    const outerLip = new THREE.Mesh(outerLipGeo, rimLipMat);
    outerLip.position.x = width * 0.43;
    wheelObj.add(outerLip);

    const barrelGeo = cachedMustangGeo(`mus_bar_v4_${r.toFixed(3)}_${width.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.672, r * 0.672, width * 0.84, 32, 1, true);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const barrel = new THREE.Mesh(barrelGeo, gunmetalSpokeMat);
    wheelObj.add(barrel);

    // 5 Dual Y-Spokes (10-spoke GT Performance silhouette)
    const spokeGeo = getMustangYSpokeGeo(r);
    const faceX = width * 0.405;
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(spokeGeo, gunmetalSpokeMat);
      spoke.position.x = faceX;
      spoke.rotation.x = a;
      wheelObj.add(spoke);

      const highlight = new THREE.Mesh(spokeGeo, machinedAlloyMat);
      highlight.position.x = faceX + 0.009;
      highlight.scale.set(0.36, 0.99, 0.70);
      highlight.rotation.x = a;
      wheelObj.add(highlight);
    }

    // Center Hub + 5 Chrome Lug Nuts
    const hubGeo = cachedMustangGeo(`mus_hub_v4_${r.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.16, r * 0.17, 0.048, 20);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const hub = new THREE.Mesh(hubGeo, gunmetalSpokeMat);
    hub.position.x = faceX + 0.005;
    wheelObj.add(hub);

    const capGeo = cachedMustangGeo('mus_cap_disc', () => {
      const g = new THREE.CylinderGeometry(r * 0.088, r * 0.088, 0.012, 16);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const cap = new THREE.Mesh(capGeo, satinBlackMat);
    cap.position.x = faceX + 0.028;
    wheelObj.add(cap);

    const lugGeo = cachedMustangGeo('mus_lug', () => {
      const g = new THREE.CylinderGeometry(0.007, 0.007, 0.014, 6);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    for (let l = 0; l < 5; l++) {
      const la = (l / 5) * Math.PI * 2 + Math.PI / 5;
      const lug = new THREE.Mesh(lugGeo, machinedAlloyMat);
      lug.position.set(faceX + 0.025, Math.cos(la) * r * 0.115, Math.sin(la) * r * 0.115);
      wheelObj.add(lug);
    }

    // Ventilated Brake Rotor & Caliper
    const sign = wx >= 0 ? 1 : -1;
    const rotorDisc = new THREE.Mesh(getRotorDiscGeo(r * 0.22, r * 0.54), rotorMat);
    rotorDisc.position.x = sign * width * 0.12;
    pivot.add(rotorDisc);

    const caliperGeo = cachedMustangGeo(`mus_cal_v4_${r.toFixed(3)}`, () => {
      const s = new THREE.Shape();
      s.absarc(0, 0, r * 0.56, -0.42, 0.42, false);
      s.absarc(0, 0, r * 0.37, 0.42, -0.42, true);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.068,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 2,
        curveSegments: 10,
      });
      g.translate(0, 0, -0.034);
      g.rotateY(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    });
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(sign * width * 0.13, 0, 0);
    caliper.rotation.x = isFront ? 0.52 : -2.55;
    pivot.add(caliper);

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

  addMustangWheel(-FRONT_WHEEL_X, WHEEL_R, WHEEL_Z, true, 0.255);
  addMustangWheel(FRONT_WHEEL_X, WHEEL_R, WHEEL_Z, true, 0.255);
  addMustangWheel(-REAR_WHEEL_X, WHEEL_R, -WHEEL_Z, false, 0.275);
  addMustangWheel(REAR_WHEEL_X, WHEEL_R, -WHEEL_Z, false, 0.275);

  // -------------------------------------------------------------------------
  // 1. Watertight Lofted Side Shells + Clean Wheel-Well Liners + Rocker Skirts + 5.0 Badges
  // -------------------------------------------------------------------------
  const archOffsets = [0.388, 0.376, 0.348, 0.300, 0.226, 0.128, 0.0, -0.128, -0.226, -0.300, -0.348, -0.376, -0.388];
  const sideStationsZ: number[] = [
    FRONT_JOIN_Z, 1.94, 1.84, 1.755,
    ...archOffsets.map((o) => Number((WHEEL_Z + o).toFixed(4))),
    0.965, 0.90, 0.80, 0.68, 0.54, 0.26, 0.0, -0.28, -0.56, -0.78, -0.90, -0.965,
    ...archOffsets.map((o) => Number((-WHEEL_Z + o).toFixed(4))),
    -1.755, -1.84, -1.94, REAR_JOIN_Z,
  ];
  const crossProfileT = [0.0, 0.14, 0.34, 0.56, 0.76, 0.90, 1.0];

  const sideUV = (z: number, y: number) =>
    new THREE.Vector2(
      THREE.MathUtils.clamp((z + 2.38) / 4.76, 0, 1),
      THREE.MathUtils.clamp((y - 0.14) / 0.84, 0, 1),
    );
  const topUV = (x: number, z: number) =>
    new THREE.Vector2(
      THREE.MathUtils.clamp((x + 0.98) / 1.96, 0, 1),
      THREE.MathUtils.clamp((z + 2.38) / 4.76, 0, 1),
    );
  const endUV = (x: number, y: number) =>
    new THREE.Vector2(
      THREE.MathUtils.clamp((x + 0.98) / 1.96, 0, 1),
      THREE.MathUtils.clamp((y - 0.14) / 0.84, 0, 1),
    );

  for (const side of [-1, 1] as const) {
    const sideGeo = cachedMustangGeo(`mus_side_wt_v7_${side}`, () => {
      const grid: THREE.Vector3[][] = [];
      const uvGrid: THREE.Vector2[][] = [];
      for (const z of sideStationsZ) {
        const yBot = sideBottomY(z);
        const yTop = sideTopY(z);
        const hw = bodyHalfW(z);

        const row: THREE.Vector3[] = [];
        const uRow: THREE.Vector2[] = [];
        for (const t of crossProfileT) {
          const x = side * sideSectionX(hw, t, z);
          const y = THREE.MathUtils.lerp(yBot, yTop, t);
          row.push(new THREE.Vector3(x, y, z));
          uRow.push(sideUV(z, y));
        }
        grid.push(row);
        uvGrid.push(uRow);
      }
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(side, 0.16, 0), uvGrid);
    });
    const sideMesh = new THREE.Mesh(sideGeo, sidePaintMat);
    sideMesh.castShadow = true;
    sideMesh.receiveShadow = true;
    bodyGroup.add(sideMesh);

    // Clean Semi-Circular Inner Wheel-Well Liners (matching exact front/rear track)
    for (const wz of [WHEEL_Z, -WHEEL_Z]) {
      const archWellGeo = cachedMustangGeo(`mus_arch_v9_${side}_${wz > 0 ? 'f' : 'r'}`, () => {
        const nz = 22;
        const grid: THREE.Vector3[][] = [[], []];
        const trackX = wz > 0 ? FRONT_WHEEL_X : REAR_WHEEL_X;
        for (let i = 0; i <= nz; i++) {
          const ang = THREE.MathUtils.lerp(Math.PI + 0.16, -0.16, i / nz);
          const z = wz + Math.cos(ang) * ARCH_R;
          const y = Math.max(0.20, WHEEL_R + Math.sin(ang) * ARCH_R);
          const lowerTuck = 0.055 * (1 - smoothstep(0.20, 0.34, y));
          const xOuter = side * (sideSectionX(bodyHalfW(z), 0, z) - 0.014 - lowerTuck);
          const xInner = side * (trackX - 0.24);
          grid[0].push(new THREE.Vector3(xOuter, y, z));
          grid[1].push(new THREE.Vector3(xInner, y - 0.008, z));
        }
        return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, -1, 0));
      });
      bodyGroup.add(new THREE.Mesh(archWellGeo, archLinerMat));
    }

    // Matte-Black Lower Side Rocker Skirt connecting front splitter to rear diffuser
    const rockerSkirt = new THREE.Mesh(
      cachedMustangGeo('mus_rocker_v9', () => new THREE.BoxGeometry(0.076, 0.042, 1.94)),
      satinBlackMat,
    );
    rockerSkirt.position.set(side * 0.842, 0.156, 0.0);
    bodyGroup.add(rockerSkirt);

    // Flush Painted Door Handle
    const handle = new THREE.Mesh(
      cachedMustangGeo('mus_handle', () => new THREE.BoxGeometry(0.026, 0.030, 0.16)),
      redUniformMat,
    );
    handle.position.set(side * 0.888, 0.778, -0.30);
    bodyGroup.add(handle);

    // Chrome "5.0" Front Fender Badge cleanly flush outside front fender skin
    const badgeZ = 0.835;
    const badgeX = sideSectionX(bodyHalfW(badgeZ), 0.64, badgeZ) + 0.005;
    const badge50Plane = new THREE.Mesh(
      cachedMustangGeo('mus_50_badge', () => new THREE.PlaneGeometry(0.155, 0.076)),
      new THREE.MeshBasicMaterial({ map: tex.badge50, transparent: true, depthWrite: false }),
    );
    badge50Plane.position.set(side * badgeX, 0.648, badgeZ);
    badge50Plane.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    bodyGroup.add(badge50Plane);

    // Rear Bumper Red Side-Marker Reflector
    const rearMarker = new THREE.Mesh(
      cachedMustangGeo('mus_rmarker', () => new THREE.BoxGeometry(0.016, 0.020, 0.11)),
      redMarkerMat,
    );
    rearMarker.position.set(side * 0.858, 0.445, -1.98);
    bodyGroup.add(rearMarker);

    // Sculpted S550 Aero Wing Mirror (total span 2.080m = ±1.040m)
    const mStalk = new THREE.Mesh(
      cachedMustangGeo('mus_mstalk', () => new THREE.BoxGeometry(0.10, 0.020, 0.040)),
      satinBlackMat,
    );
    mStalk.position.set(side * 0.832, 0.864, 0.42);
    mStalk.rotation.z = side * 0.18;
    bodyGroup.add(mStalk);

    const mShellGeo = cachedMustangGeo(`mus_mshell_v9_${side}`, () => {
      const grid: THREE.Vector3[][] = [
        [
          new THREE.Vector3(side * 0.85, 0.874, 0.448),
          new THREE.Vector3(side * 0.945, 0.880, 0.430),
          new THREE.Vector3(side * 1.040, 0.882, 0.398),
        ],
        [
          new THREE.Vector3(side * 0.85, 0.922, 0.436),
          new THREE.Vector3(side * 0.945, 0.928, 0.412),
          new THREE.Vector3(side * 1.036, 0.918, 0.382),
        ],
        [
          new THREE.Vector3(side * 0.85, 0.892, 0.362),
          new THREE.Vector3(side * 0.945, 0.896, 0.346),
          new THREE.Vector3(side * 1.034, 0.894, 0.336),
        ],
      ];
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.6, 0.8));
    });
    const mShell = new THREE.Mesh(mShellGeo, redUniformMat);
    mShell.castShadow = true;
    bodyGroup.add(mShell);

    const mBlackBase = new THREE.Mesh(
      cachedMustangGeo('mus_mbase_v9', () => new THREE.BoxGeometry(0.175, 0.015, 0.080)),
      satinBlackMat,
    );
    mBlackBase.position.set(side * 0.942, 0.870, 0.396);
    mBlackBase.rotation.y = side * -0.18;
    bodyGroup.add(mBlackBase);

    const mGlass = new THREE.Mesh(
      cachedMustangGeo('mus_mglass_v9', () => new THREE.PlaneGeometry(0.145, 0.044)),
      mats.chromeMat,
    );
    mGlass.position.set(side * 0.945, 0.896, 0.343);
    mGlass.rotation.y = Math.PI + side * -0.18;
    bodyGroup.add(mGlass);
  }

  // -------------------------------------------------------------------------
  // 2. Watertight Long S550 Hood + Twin Recessed Heat Extractor Vents
  // -------------------------------------------------------------------------
  const hoodGeo = cachedMustangGeo('mus_hood_wt_v4', () => {
    const nz = 24;
    const nx = 28;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const zFrac = iz / nz;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const zEnd = frontBrowZ(u);
        const z = THREE.MathUtils.lerp(0.54, zEnd, zFrac);
        const px = u * sideTopEdgeX(z);
        row.push(new THREE.Vector3(px, hoodSurfaceY(px, z), z));
        uRow.push(topUV(px, z));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 1, 0), uvGrid);
  });
  const hoodMesh = new THREE.Mesh(hoodGeo, topPaintMat);
  hoodMesh.castShadow = true;
  hoodMesh.receiveShadow = true;
  bodyGroup.add(hoodMesh);

  // Dual Signature 2015 GT Hood Heat Extractor Vents
  for (const side of [-1, 1] as const) {
    const ventGroup = new THREE.Group();
    const vx = side * 0.42;
    const vz = 1.46;
    ventGroup.position.set(vx, hoodSurfaceY(vx, vz) + 0.001, vz);
    ventGroup.rotation.x = 0.095;
    ventGroup.rotation.y = side * -0.075;

    const blisterGeo = cachedMustangGeo('mus_hood_blister_v4', () => {
      const s = new THREE.Shape();
      s.moveTo(0.15, 0.0);
      s.quadraticCurveTo(0.03, 0.010, -0.11, 0.022);
      s.lineTo(-0.125, 0.004);
      s.lineTo(-0.15, 0.0);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.115,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 2,
      });
      g.translate(0, 0, -0.0575);
      g.rotateY(-Math.PI / 2);
      g.computeVertexNormals();
      return g;
    });
    const blister = new THREE.Mesh(blisterGeo, redUniformMat);
    ventGroup.add(blister);

    const ventSlot = new THREE.Mesh(
      cachedMustangGeo('mus_hood_slot_v4', () => new THREE.BoxGeometry(0.102, 0.010, 0.020)),
      satinBlackMat,
    );
    ventSlot.position.set(0, 0.009, -0.118);
    ventGroup.add(ventSlot);

    bodyGroup.add(ventGroup);
  }

  // Windshield Cowl + Wipers
  const cowl = new THREE.Mesh(
    cachedMustangGeo('mus_cowl_v4', () => new THREE.BoxGeometry(1.46, 0.018, 0.068)),
    satinBlackMat,
  );
  cowl.position.set(0, 0.852, 0.538);
  bodyGroup.add(cowl);

  for (const wx of [-0.28, 0.24]) {
    const wiper = new THREE.Mesh(
      cachedMustangGeo('mus_wiper', () => new THREE.BoxGeometry(0.46, 0.011, 0.018)),
      satinBlackMat,
    );
    wiper.position.set(wx, 0.864, 0.535);
    wiper.rotation.y = 0.08;
    bodyGroup.add(wiper);
  }

  // -------------------------------------------------------------------------
  // 3. Watertight S550 Front Fascia (Exact Stitch to Hood & Fenders!) + Grilles + Headlights
  // -------------------------------------------------------------------------
  const frontFasciaGeo = cachedMustangGeo('mus_front_fascia_wt_v5', () => {
    const nx = 64;
    const ny = 24;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    const xJoinHw = bodyHalfW(FRONT_JOIN_Z);

    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      const outerSideX = sideSectionX(xJoinHw, vf, FRONT_JOIN_Z);

      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const x = u * outerSideX;
        const zBrow = frontBrowZ(u);
        const yBot = sideBottomY(zBrow);
        const hoodEdgeX = u * sideTopEdgeX(zBrow);
        const yTop = hoodSurfaceY(hoodEdgeX, zBrow);
        const y = THREE.MathUtils.lerp(yBot, yTop, vf);

        // Smooth recessed pockets for upper and lower honeycomb grilles (no jagged edges!)
        const upperHalfW = THREE.MathUtils.lerp(0.46, 0.40, smoothstep(0.42, 0.60, y));
        const inUpper = (1 - smoothstep(upperHalfW - 0.035, upperHalfW, Math.abs(x))) *
          smoothstep(0.425, 0.455, y) * (1 - smoothstep(0.575, 0.600, y));

        const lowerHalfW = THREE.MathUtils.lerp(0.41, 0.35, smoothstep(0.22, 0.34, y));
        const inLower = (1 - smoothstep(lowerHalfW - 0.03, lowerHalfW, Math.abs(x))) *
          smoothstep(0.220, 0.245, y) * (1 - smoothstep(0.315, 0.335, y));

        const edgeFade = 1 - Math.pow(Math.abs(u), 2.4);
        const topFade = 1 - smoothstep(0.75, 1.0, vf);
        const sharkTilt = 0.032 * smoothstep(0.25, 0.65, vf) * edgeFade * topFade;
        const recess = -0.055 * (inUpper + inLower);
        const z = zBrow + sharkTilt + recess;

        row.push(new THREE.Vector3(x, y, z));
        uRow.push(endUV(x, y));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.05, 1), uvGrid);
  });
  const frontFascia = new THREE.Mesh(frontFasciaGeo, endPaintMat);
  frontFascia.castShadow = true;
  frontFascia.receiveShadow = true;
  bodyGroup.add(frontFascia);

  // Upper Trapezoidal Honeycomb Grille + Contoured Bezel Frame + Twin GT Fangs + Silver Pony
  const upperGrilleGeo = cachedMustangGeo('mus_upper_grille_v5', () => {
    const nx = 24;
    const ny = 8;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const y = THREE.MathUtils.lerp(0.425, 0.592, vf);
      const halfSpan = THREE.MathUtils.lerp(0.465, 0.400, vf);
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const uf = ix / nx;
        const x = (uf * 2 - 1) * halfSpan;
        const z = frontSurfaceZ(x, 0.52) - 0.010;
        row.push(new THREE.Vector3(x, y, z));
        uRow.push(new THREE.Vector2(uf, vf));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0, 1), uvGrid);
  });
  bodyGroup.add(new THREE.Mesh(upperGrilleGeo, honeycombMat));

  // Trapezoidal Dark Grille Perimeter Frame (curves cleanly around recessed grille mouth)
  const upperFrameGeo = cachedMustangGeo('mus_upper_frame_v5', () => {
    const nx = 24;
    const s = new THREE.Shape();
    s.moveTo(-0.482, -0.088);
    s.lineTo(0.482, -0.088);
    s.lineTo(0.415, 0.088);
    s.lineTo(-0.415, 0.088);
    s.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-0.450, -0.066);
    hole.lineTo(0.450, -0.066);
    hole.lineTo(0.388, 0.068);
    hole.lineTo(-0.388, 0.068);
    hole.closePath();
    s.holes.push(hole);

    const g = new THREE.ExtrudeGeometry(s, { depth: 0.044, bevelEnabled: false, curveSegments: nx });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      pos.setZ(i, pz + frontSurfaceZ(px, 0.52) - 0.022);
    }
    g.computeVertexNormals();
    return g;
  });
  const upperFrame = new THREE.Mesh(upperFrameGeo, satinBlackMat);
  upperFrame.position.set(0, 0.508, 0);
  bodyGroup.add(upperFrame);

  for (const side of [-1, 1] as const) {
    const fang = new THREE.Mesh(
      cachedMustangGeo('mus_fang_v5', () => new THREE.BoxGeometry(0.032, 0.158, 0.032)),
      satinBlackMat,
    );
    fang.position.set(side * 0.275, 0.508, frontSurfaceZ(side * 0.275, 0.52) + 0.004);
    fang.rotation.z = side * 0.14;
    fang.rotation.y = side * 0.12;
    bodyGroup.add(fang);
  }

  // Centered Galloping Silver Mustang Pony Emblem
  const ponyPlane = new THREE.Mesh(
    cachedMustangGeo('mus_pony_emblem_v5', () => new THREE.PlaneGeometry(0.22, 0.108)),
    new THREE.MeshBasicMaterial({ map: tex.ponyBadge, transparent: true, depthWrite: false }),
  );
  ponyPlane.position.set(0, 0.510, frontSurfaceZ(0, 0.52) + 0.010);
  bodyGroup.add(ponyPlane);

  // Lower Trapezoidal Honeycomb Grille + Divider Ribs
  const lowerGrilleGeo = cachedMustangGeo('mus_lower_grille_v5', () => {
    const nx = 20;
    const ny = 4;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const y = THREE.MathUtils.lerp(0.222, 0.328, vf);
      const halfSpan = THREE.MathUtils.lerp(0.415, 0.360, vf);
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const uf = ix / nx;
        const x = (uf * 2 - 1) * halfSpan;
        const z = frontSurfaceZ(x, 0.16) - 0.006;
        row.push(new THREE.Vector3(x, y, z));
        uRow.push(new THREE.Vector2(uf, vf));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0, 1), uvGrid);
  });
  bodyGroup.add(new THREE.Mesh(lowerGrilleGeo, honeycombMat));

  const lowerFrameGeo = cachedMustangGeo('mus_lower_frame_v5', () => {
    const s = new THREE.Shape();
    s.moveTo(-0.432, -0.058);
    s.lineTo(0.432, -0.058);
    s.lineTo(0.378, 0.058);
    s.lineTo(-0.378, 0.058);
    s.closePath();

    const hole = new THREE.Path();
    hole.moveTo(-0.405, -0.042);
    hole.lineTo(0.405, -0.042);
    hole.lineTo(0.354, 0.042);
    hole.lineTo(-0.354, 0.042);
    hole.closePath();
    s.holes.push(hole);

    const g = new THREE.ExtrudeGeometry(s, { depth: 0.036, bevelEnabled: false });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      pos.setZ(i, pz + frontSurfaceZ(px, 0.16) - 0.018);
    }
    g.computeVertexNormals();
    return g;
  });
  const lowerFrame = new THREE.Mesh(lowerFrameGeo, satinBlackMat);
  lowerFrame.position.set(0, 0.275, 0);
  bodyGroup.add(lowerFrame);

  for (const side of [-1, 1] as const) {
    const lowerRib = new THREE.Mesh(
      cachedMustangGeo('mus_lower_rib_v5', () => new THREE.BoxGeometry(0.026, 0.104, 0.026)),
      satinBlackMat,
    );
    lowerRib.position.set(side * 0.24, 0.275, frontSurfaceZ(side * 0.24, 0.16) + 0.005);
    bodyGroup.add(lowerRib);
  }

  // Aggressive Matte-Black Front Chin Splitter (Flush underneath bumper brow)
  const splitterGeo = cachedMustangGeo('mus_splitter_v4', () => {
    const nx = 36;
    const grid: THREE.Vector3[][] = [[], [], []];
    for (let ix = 0; ix <= nx; ix++) {
      const u = (ix / nx) * 2 - 1;
      const x = u * 0.85;
      const zFront = frontBrowZ(u * 0.96) + 0.030;
      const zBack = zFront - 0.14;
      const yBase = sideBottomY(zFront) - 0.022;
      grid[0].push(new THREE.Vector3(x, yBase + 0.012, zBack));
      grid[1].push(new THREE.Vector3(x, yBase + 0.016, zFront));
      grid[2].push(new THREE.Vector3(x, yBase - 0.004, zFront));
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.3, 0.9));
  });
  const splitter = new THREE.Mesh(splitterGeo, satinBlackMat);
  splitter.castShadow = true;
  bodyGroup.add(splitter);

  // Outer Lower Fog-Lamp + Clear Turn-Signal Pods & Sleek Contoured S550 Headlights
  for (const side of [-1, 1] as const) {
    // 1. Sleek Trapezoidal Lower Fog + Clear Turn-Signal Pod
    const podX = side * 0.61;
    const podZ = frontSurfaceZ(podX, 0.18) + 0.008;
    const podYaw = side * 0.36;

    const podGroup = new THREE.Group();
    podGroup.position.set(podX, 0.278, podZ);
    podGroup.rotation.y = podYaw;

    const podBezelGeo = cachedMustangGeo(`mus_pod_bezel_v4_${side}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-0.105, -0.052);
      s.lineTo(0.105, -0.042);
      s.lineTo(0.088, 0.052);
      s.lineTo(-0.088, 0.046);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
      g.translate(0, 0, -0.011);
      if (side < 0) g.scale(-1, 1, 1);
      g.computeVertexNormals();
      return g;
    });
    podGroup.add(new THREE.Mesh(podBezelGeo, satinBlackMat));

    const turnStrip = new THREE.Mesh(
      cachedMustangGeo('mus_turn_strip_v4', () => new THREE.BoxGeometry(0.155, 0.022, 0.016)),
      turnSignalMat,
    );
    turnStrip.position.set(0, 0.032, 0.009);
    podGroup.add(turnStrip);

    const fogBezel = new THREE.Mesh(
      cachedMustangGeo('mus_fog_bezel_v4', () => {
        const g = new THREE.CylinderGeometry(0.032, 0.034, 0.022, 18);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      satinBlackMat,
    );
    fogBezel.position.set(0, -0.015, 0.010);
    podGroup.add(fogBezel);

    const fogLens = new THREE.Mesh(
      cachedMustangGeo('mus_fog_lens_v4', () => {
        const g = new THREE.CylinderGeometry(0.022, 0.022, 0.014, 16);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      fogLampMat,
    );
    fogLens.position.set(0, -0.015, 0.016);
    podGroup.add(fogLens);

    bodyGroup.add(podGroup);

    // 2. Contoured Tapered S550 Headlight Cluster (angled cleanly flush on nose corner!)
    const hlX = side * 0.645;
    const hlY = 0.618;
    const hlZ = frontSurfaceZ(hlX, 0.72) + 0.008;
    const hlYaw = side * 0.44;

    const hlGroup = new THREE.Group();
    hlGroup.position.set(hlX, hlY, hlZ);
    hlGroup.rotation.y = hlYaw;
    hlGroup.rotation.x = 0.10;
    hlGroup.rotation.z = side * 0.06;

    // Tapered trapezoidal headlight housing (pointed outer corner, sharp inner brow)
    const hlHousingGeo = cachedMustangGeo(`mus_hl_trap_v4_${side}`, () => {
      const s = new THREE.Shape();
      s.moveTo(-0.155, 0.036);
      s.lineTo(0.165, 0.044);
      s.lineTo(0.115, -0.034);
      s.lineTo(-0.125, -0.040);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.030, bevelEnabled: false });
      g.translate(0, 0, -0.015);
      if (side < 0) g.scale(-1, 1, 1);
      g.computeVertexNormals();
      return g;
    });
    hlGroup.add(new THREE.Mesh(hlHousingGeo, satinBlackMat));

    // Circular HID Projector + Thin Halo Ring
    const hidRing = new THREE.Mesh(
      cachedMustangGeo('mus_hid_ring_v4', () => new THREE.TorusGeometry(0.028, 0.0038, 8, 22)),
      drlWhiteMat,
    );
    hidRing.position.set(side * 0.042, 0.002, 0.017);
    hlGroup.add(hidRing);

    const hidLens = new THREE.Mesh(
      cachedMustangGeo('mus_hid_lens_v4', () => {
        const g = new THREE.CylinderGeometry(0.022, 0.022, 0.014, 16);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      mats.headlightMat,
    );
    hidLens.position.set(side * 0.042, 0.002, 0.014);
    hlGroup.add(hidLens);

    // Outer Amber Corner Reflector
    const cornerAmber = new THREE.Mesh(
      cachedMustangGeo('mus_hl_amber_v4', () => new THREE.BoxGeometry(0.042, 0.038, 0.012)),
      amberMarkerMat,
    );
    cornerAmber.position.set(side * 0.112, 0.008, 0.012);
    cornerAmber.rotation.z = side * -0.30;
    hlGroup.add(cornerAmber);

    // 3 Signature Slanted White LED DRL Gill Slashes
    for (let g = 0; g < 3; g++) {
      const gill = new THREE.Mesh(
        cachedMustangGeo('mus_drl_gill_v4', () => new THREE.BoxGeometry(0.0085, 0.062, 0.012)),
        drlWhiteMat,
      );
      gill.position.set(side * (-0.028 - g * 0.032), -0.002, 0.017);
      gill.rotation.z = side * 0.54;
      hlGroup.add(gill);
    }

    // Clear Acrylic Outer Cover Lens matching housing
    const hlCover = new THREE.Mesh(hlHousingGeo, lensCoverGlassMat);
    hlCover.position.z = 0.014;
    hlCover.scale.set(1.01, 1.01, 0.35);
    hlGroup.add(hlCover);

    bodyGroup.add(hlGroup);
  }

  // -------------------------------------------------------------------------
  // 4. Unified Watertight Fastback Greenhouse (Continuous Cantrails, Roof, Glass & Flush B-Pillar)
  // -------------------------------------------------------------------------
  const roofGeo = cachedMustangGeo('mus_roof_wt_v4', () => {
    const nz = 18;
    const nx = 14;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const tf = iz / nz;
      const z = THREE.MathUtils.lerp(0.02, -1.16, tf);
      const halfW = cabinInnerHalfW(z);
      const yCenter = cabinCenterY(z);
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const x = u * halfW;
        row.push(new THREE.Vector3(x, yCenter - 0.014 * u * u, z));
        uRow.push(topUV(x, z));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 1, 0), uvGrid);
  });
  const roofMesh = new THREE.Mesh(roofGeo, topPaintMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  bodyGroup.add(roofMesh);

  // Subtle Low Roof Antenna Pod positioned cleanly on flat roof crown
  const roofAntenna = new THREE.Mesh(
    cachedMustangGeo('mus_antenna_v7', () => new THREE.CylinderGeometry(0.014, 0.024, 0.008, 12)),
    redUniformMat,
  );
  roofAntenna.position.set(0, cabinCenterY(-0.92) + 0.002, -0.92);
  bodyGroup.add(roofAntenna);

  // Continuous A-Pillar -> Roof Cantrail -> Sweeping Solid Fastback C-Pillar Sail (Zero side gap!)
  const archZStations: number[] = [
    0.54, 0.44, 0.30, 0.16, 0.02,
    -0.14, -0.32, -0.52, -0.74, -0.84, -0.94, -1.04, -1.16,
    -1.32, -1.52, -1.74, -1.94,
  ];
  for (const side of [-1, 1] as const) {
    const cantrailGeo = cachedMustangGeo(`mus_cantrail_v7_${side}`, () => {
      const grid: THREE.Vector3[][] = [];
      for (const z of archZStations) {
        const xIn = side * cabinInnerHalfW(z);
        const yIn = cabinCenterY(z) - 0.014;
        const quarterSailBlend = smoothstep(-0.74, -1.06, z);
        const xCant = side * THREE.MathUtils.lerp(cabinOuterHalfW(z), sideTopEdgeX(z), quarterSailBlend);
        const yHeader = z <= 0.48 ? yIn - 0.020 : sideTopY(z);
        const yOut = Math.max(sideTopY(z), THREE.MathUtils.lerp(yHeader, sideTopY(z), quarterSailBlend));
        const xUnder = side * (THREE.MathUtils.lerp(cabinOuterHalfW(z), sideTopEdgeX(z), quarterSailBlend) - 0.006);
        const yUnder = z <= 0.48 ? Math.max(sideTopY(z), yOut - 0.018) : sideTopY(z);
        grid.push([
          new THREE.Vector3(xIn, yIn, z),
          new THREE.Vector3(xCant, yOut, z),
          new THREE.Vector3(xUnder, yUnder, z),
        ]);
      }
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(side * 0.65, 0.78, 0));
    });
    const cantrail = new THREE.Mesh(cantrailGeo, redUniformMat);
    cantrail.castShadow = true;
    cantrail.receiveShadow = true;
    bodyGroup.add(cantrail);
  }

  // Watertight Windshield
  const windshieldGeo = cachedMustangGeo('mus_windshield_v6', () => {
    const grid: THREE.Vector3[][] = [];
    for (let iz = 0; iz <= 10; iz++) {
      const tf = iz / 10;
      const z = THREE.MathUtils.lerp(0.54, 0.02, tf);
      const yCenter = cabinCenterY(z);
      const halfW = cabinInnerHalfW(z);
      const row: THREE.Vector3[] = [];
      for (let ix = 0; ix <= 12; ix++) {
        const u = (ix / 12) * 2 - 1;
        row.push(new THREE.Vector3(u * halfW, yCenter - 0.014 * u * u, z + 0.010 * (1 - u * u) * Math.sin(tf * Math.PI)));
      }
      grid.push(row);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.72, 0.68));
  });
  const windshield = new THREE.Mesh(windshieldGeo, mustangGlassMat);
  windshield.renderOrder = 2;
  bodyGroup.add(windshield);

  // Watertight Fastback Rear Glass
  const rearGlassGeo = cachedMustangGeo('mus_rear_glass_v6', () => {
    const grid: THREE.Vector3[][] = [];
    for (let iz = 0; iz <= 10; iz++) {
      const tf = iz / 10;
      const z = THREE.MathUtils.lerp(-1.16, -1.94, tf);
      const yCenter = cabinCenterY(z);
      const halfW = cabinInnerHalfW(z);
      const row: THREE.Vector3[] = [];
      for (let ix = 0; ix <= 12; ix++) {
        const u = (ix / 12) * 2 - 1;
        row.push(new THREE.Vector3(u * halfW, yCenter - 0.014 * u * u, z));
      }
      grid.push(row);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.85, -0.52));
  });
  const rearGlass = new THREE.Mesh(rearGlassGeo, mustangGlassMat);
  rearGlass.renderOrder = 2;
  bodyGroup.add(rearGlass);

  // Flush Side Door Glass + Tapered Fastback Quarter Window (locked identically to cantrail under-edge!)
  const sideWinZ = [0.44, 0.24, 0.02, -0.22, -0.46, -0.70, -0.82, -0.94, -1.04];
  for (const side of [-1, 1] as const) {
    const sideWinGeo = cachedMustangGeo(`mus_side_glass_v7_${side}`, () => {
      const grid: THREE.Vector3[][] = [];
      for (const z of sideWinZ) {
        const yBot = sideTopY(z) - 0.008;
        const xBot = side * (sideTopEdgeX(z) - 0.005);
        const quarterSailBlend = smoothstep(-0.74, -1.06, z);
        const xSail = THREE.MathUtils.lerp(cabinOuterHalfW(z), sideTopEdgeX(z), quarterSailBlend);
        const yHeader = (cabinCenterY(z) - 0.014) - 0.020;
        const yOut = Math.max(sideTopY(z), THREE.MathUtils.lerp(yHeader, sideTopY(z), quarterSailBlend));
        const yTop = Math.max(yBot + 0.012, yOut - 0.014);
        const xTop = side * (xSail - 0.006);

        grid.push([
          new THREE.Vector3(xBot, yBot, z),
          new THREE.Vector3(xTop, yTop, z),
        ]);
      }
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(side * 0.92, 0.38, 0));
    });
    const sideGlass = new THREE.Mesh(sideWinGeo, mustangGlassMat);
    sideGlass.renderOrder = 2;
    bodyGroup.add(sideGlass);

    // Slim Gloss-Black B-Pillar Strip flush with side window curve
    const bPillarGeo = cachedMustangGeo(`mus_bpillar_v7_${side}`, () => {
      const grid: THREE.Vector3[][] = [];
      for (const z of [-0.45, -0.52]) {
        const yBot = sideTopY(z) - 0.004;
        const xBot = side * (sideTopEdgeX(z) - 0.002);
        const yTop = cabinCenterY(z) - 0.032;
        const xTop = side * (cabinOuterHalfW(z) - 0.004);
        grid.push([
          new THREE.Vector3(xBot, yBot, z),
          new THREE.Vector3(xTop, yTop, z),
        ]);
      }
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(side * 0.92, 0.38, 0));
    });
    bodyGroup.add(new THREE.Mesh(bPillarGeo, glossBlackDeckMat));
  }

  // -------------------------------------------------------------------------
  // 5. Rear Decklid, Integrated Ducktail, Gloss-Black Panel + GT Emblem, Tri-Bar Taillights & Dual Exhaust
  // -------------------------------------------------------------------------
  const rearDeckGeo = cachedMustangGeo('mus_rear_deck_v4', () => {
    const nz = 10;
    const nx = 20;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const tf = iz / nz;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const zEnd = rearBrowZ(u);
        const z = THREE.MathUtils.lerp(-1.94, zEnd, tf);
        const x = u * sideTopEdgeX(z);
        const y = rearDeckTopY(u, z);
        row.push(new THREE.Vector3(x, y, z));
        uRow.push(topUV(x, z));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 1, 0), uvGrid);
  });
  const rearDeck = new THREE.Mesh(rearDeckGeo, topPaintMat);
  rearDeck.castShadow = true;
  rearDeck.receiveShadow = true;
  bodyGroup.add(rearDeck);

  // Smooth Watertight Wrap-Around Rear Fascia (Zero intersecting coarse mesh notches!)
  const rearFasciaGeo = cachedMustangGeo('mus_rear_fascia_wt_v4', () => {
    const nx = 48;
    const ny = 20;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    const xJoinHw = bodyHalfW(REAR_JOIN_Z);

    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      const outerSideX = sideSectionX(xJoinHw, vf, REAR_JOIN_Z);

      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const x = u * outerSideX;
        const zBrow = rearBrowZ(u);
        // Smooth gentle rear bumper lower fullness; vf=1 locks identically to rearDeck trailing edge
        const edgeFade = 1 - Math.pow(Math.abs(u), 2.5);
        const lowerBelly = -0.022 * smoothstep(0.05, 0.35, vf) * (1 - smoothstep(0.55, 0.90, vf)) * edgeFade;
        const z = zBrow + lowerBelly;

        const yBot = sideBottomY(zBrow);
        const yTop = rearDeckTopY(u, zBrow);
        const y = THREE.MathUtils.lerp(yBot, yTop, vf);

        row.push(new THREE.Vector3(x, y, z));
        uRow.push(endUV(x, y));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.05, -1), uvGrid);
  });
  const rearFascia = new THREE.Mesh(rearFasciaGeo, endPaintMat);
  rearFascia.castShadow = true;
  rearFascia.receiveShadow = true;
  bodyGroup.add(rearFascia);

  // Clean Curved Gloss-Black Rear Decklid Panel sitting proudly on -Z (NO Z-fighting teeth!)
  const deckPanelGeo = cachedMustangGeo('mus_deck_panel_v4', () => {
    const nx = 20;
    const grid: THREE.Vector3[][] = [[], []];
    for (let ix = 0; ix <= nx; ix++) {
      const uf = ix / nx;
      const x = (uf * 2 - 1) * 0.45;
      const uFascia = x / bodyHalfW(REAR_JOIN_Z);
      const z = rearBrowZ(uFascia) - 0.012;
      grid[0].push(new THREE.Vector3(x, 0.720, z));
      grid[1].push(new THREE.Vector3(x, 0.898, z - 0.004));
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0, -1));
  });
  bodyGroup.add(new THREE.Mesh(deckPanelGeo, glossBlackDeckMat));

  const gtEmblem = new THREE.Mesh(
    cachedMustangGeo('mus_gt_emblem_v4', () => new THREE.PlaneGeometry(0.165, 0.082)),
    new THREE.MeshBasicMaterial({ map: tex.gtBadge, transparent: true, depthWrite: false }),
  );
  gtEmblem.position.set(0, 0.810, rearBrowZ(0) - 0.017);
  gtEmblem.rotation.y = Math.PI;
  bodyGroup.add(gtEmblem);

  // Rear License Plate (cleanly proud of -Z rear bumper belly so zero seam bleed)
  const plateMesh = new THREE.Mesh(
    cachedMustangGeo('mus_rear_plate_v4', () => new THREE.PlaneGeometry(0.30, 0.15)),
    new THREE.MeshStandardMaterial({ map: tex.rearPlate, roughness: 0.4 }),
  );
  plateMesh.position.set(0, 0.560, rearBrowZ(0) - 0.030);
  plateMesh.rotation.y = Math.PI;
  bodyGroup.add(plateMesh);

  // Iconic Mustang Tri-Bar 3D Vertical Blade Taillights (mounted cleanly proud of -Z rear curve)
  for (const side of [-1, 1] as const) {
    const tlGroup = new THREE.Group();
    const uTl = (side * 0.61) / bodyHalfW(REAR_JOIN_Z);
    tlGroup.position.set(side * 0.61, 0.810, rearBrowZ(uTl) - 0.008);
    tlGroup.rotation.y = side * -0.30;
    tlGroup.rotation.x = -0.06;

    const tlHousing = new THREE.Mesh(
      cachedMustangGeo('mus_tl_house_v4', () => new THREE.BoxGeometry(0.27, 0.165, 0.030)),
      satinBlackMat,
    );
    tlGroup.add(tlHousing);

    for (let b = 0; b < 3; b++) {
      const bx = side * (-0.078 + b * 0.078);
      const blade = new THREE.Mesh(
        cachedMustangGeo('mus_tl_blade_v4', () => new THREE.BoxGeometry(0.032, 0.142, 0.034)),
        mats.taillightMat,
      );
      blade.position.set(bx, 0, -0.010);
      blade.rotation.z = side * -0.09;
      tlGroup.add(blade);

      const brakeStrip = new THREE.Mesh(
        cachedMustangGeo('mus_tl_brake_v4', () => new THREE.BoxGeometry(0.014, 0.122, 0.014)),
        mats.brakeLightMat,
      );
      brakeStrip.position.set(bx, 0, -0.024);
      brakeStrip.rotation.z = side * -0.09;
      tlGroup.add(brakeStrip);
    }

    bodyGroup.add(tlGroup);
  }

  // CHMSL 3rd Brake Light at Top Center of Rear Window
  const chmsl = new THREE.Mesh(
    cachedMustangGeo('mus_chmsl_v4', () => new THREE.BoxGeometry(0.34, 0.020, 0.032)),
    mats.brakeLightMat,
  );
  chmsl.position.set(0, cabinCenterY(-1.20) - 0.026, -1.20);
  bodyGroup.add(chmsl);

  // Flush Contoured Matte-Black Rear Diffuser Valance + Center Reverse Lamp + Dual Polished Exhaust Tips
  const diffuserGeo = cachedMustangGeo('mus_diffuser_wt_v4', () => {
    const nx = 24;
    const grid: THREE.Vector3[][] = [[], [], []];
    for (let ix = 0; ix <= nx; ix++) {
      const uf = ix / nx;
      const x = (uf * 2 - 1) * 0.70;
      const uFascia = x / bodyHalfW(REAR_JOIN_Z);
      const zOuter = rearBrowZ(uFascia) - 0.008;
      const yBot = sideBottomY(zOuter) + 0.008;
      grid[0].push(new THREE.Vector3(x, yBot + 0.005, zOuter + 0.12));
      grid[1].push(new THREE.Vector3(x, yBot + 0.012, zOuter));
      grid[2].push(new THREE.Vector3(x, yBot + 0.135, zOuter - 0.004));
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, -0.2, -1));
  });
  bodyGroup.add(new THREE.Mesh(diffuserGeo, satinBlackMat));

  const centerRevFrame = new THREE.Mesh(
    cachedMustangGeo('mus_rev_frame_v4', () => new THREE.BoxGeometry(0.175, 0.040, 0.020)),
    redMarkerMat,
  );
  centerRevFrame.position.set(0, 0.278, rearBrowZ(0) - 0.012);
  bodyGroup.add(centerRevFrame);

  const centerRevLamp = new THREE.Mesh(
    cachedMustangGeo('mus_rev_lamp_v4', () => new THREE.BoxGeometry(0.118, 0.024, 0.022)),
    mats.reverseLightMat,
  );
  centerRevLamp.position.set(0, 0.278, rearBrowZ(0) - 0.016);
  bodyGroup.add(centerRevLamp);

  for (const side of [-1, 1] as const) {
    const uEx = (side * 0.54) / bodyHalfW(REAR_JOIN_Z);
    const zEx = rearBrowZ(uEx) - 0.006;
    const tipOuter = new THREE.Mesh(
      cachedMustangGeo('mus_exh_outer_v4', () => {
        const g = new THREE.CylinderGeometry(0.048, 0.048, 0.12, 20, 1, true);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      machinedAlloyMat,
    );
    tipOuter.position.set(side * 0.54, 0.272, zEx);
    bodyGroup.add(tipOuter);

    const tipInner = new THREE.Mesh(
      cachedMustangGeo('mus_exh_inner_v4', () => {
        const g = new THREE.CylinderGeometry(0.038, 0.038, 0.10, 16);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      satinBlackMat,
    );
    tipInner.position.set(side * 0.54, 0.272, zEx + 0.012);
    bodyGroup.add(tipInner);
  }

  for (const dx of [-0.32, -0.16, 0.16, 0.32]) {
    const fin = new THREE.Mesh(
      cachedMustangGeo('mus_diff_fin_v10', () => new THREE.BoxGeometry(0.016, 0.068, 0.080)),
      satinBlackMat,
    );
    fin.position.set(dx, 0.244, rearBrowZ(dx / bodyHalfW(REAR_JOIN_Z)) + 0.018);
    bodyGroup.add(fin);
  }

  // Dark Underbody Belly Pan
  const bellyPan = new THREE.Mesh(
    cachedMustangGeo('mus_belly_v4', () => new THREE.BoxGeometry(1.48, 0.045, 4.10)),
    satinBlackMat,
  );
  bellyPan.position.set(0, 0.166, 0.0);
  bodyGroup.add(bellyPan);

  // -------------------------------------------------------------------------
  // 6. Detailed S550 Interior Cabin (Recaro-style Bucket Seats + 3 Circular Center Vents)
  // -------------------------------------------------------------------------
  const cabinTub = new THREE.Mesh(
    cachedMustangGeo('mus_cabin_tub', () => new THREE.BoxGeometry(1.36, 0.34, 1.88)),
    mats.interiorMat,
  );
  cabinTub.position.set(0, 0.42, -0.26);
  bodyGroup.add(cabinTub);

  const centerConsole = new THREE.Mesh(
    cachedMustangGeo('mus_console', () => new THREE.BoxGeometry(0.24, 0.28, 1.38)),
    mats.interiorMat,
  );
  centerConsole.position.set(0, 0.54, -0.12);
  bodyGroup.add(centerConsole);

  const shifterKnob = new THREE.Mesh(
    cachedMustangGeo('mus_shifter', () => new THREE.SphereGeometry(0.028, 10, 10)),
    machinedAlloyMat,
  );
  shifterKnob.position.set(0, 0.72, 0.12);
  bodyGroup.add(shifterKnob);

  for (const sx of [-0.38, 0.38]) {
    const seatBase = new THREE.Mesh(
      cachedMustangGeo('mus_seat_base', () => new THREE.BoxGeometry(0.42, 0.12, 0.46)),
      mats.seatMat,
    );
    seatBase.position.set(sx, 0.48, -0.04);
    bodyGroup.add(seatBase);

    const seatBack = new THREE.Mesh(
      cachedMustangGeo('mus_seat_back', () => new THREE.BoxGeometry(0.38, 0.56, 0.12)),
      mats.seatMat,
    );
    seatBack.position.set(sx, 0.76, -0.26);
    seatBack.rotation.x = -0.22;
    bodyGroup.add(seatBack);

    // Recaro Sport Side Bolster Wings
    for (const bx of [-0.185, 0.185]) {
      const bolster = new THREE.Mesh(
        cachedMustangGeo('mus_recaro_bolster_v9', () => new THREE.BoxGeometry(0.055, 0.52, 0.16)),
        mats.seatMat,
      );
      bolster.position.set(sx + bx, 0.78, -0.22);
      bolster.rotation.x = -0.22;
      bolster.rotation.y = bx > 0 ? -0.24 : 0.24;
      bodyGroup.add(bolster);
    }

    const headrest = new THREE.Mesh(
      cachedMustangGeo('mus_headrest', () => new THREE.BoxGeometry(0.21, 0.17, 0.10)),
      mats.seatMat,
    );
    headrest.position.set(sx, 1.09, -0.33);
    headrest.rotation.x = -0.14;
    bodyGroup.add(headrest);
  }

  const rearSeatBench = new THREE.Mesh(
    cachedMustangGeo('mus_rear_seat', () => new THREE.BoxGeometry(1.16, 0.30, 0.42)),
    mats.seatMat,
  );
  rearSeatBench.position.set(0, 0.62, -0.82);
  rearSeatBench.rotation.x = -0.22;
  bodyGroup.add(rearSeatBench);

  const dashBody = new THREE.Mesh(
    cachedMustangGeo('mus_dash_v4', () => new THREE.BoxGeometry(1.36, 0.24, 0.38)),
    mats.interiorMat,
  );
  dashBody.position.set(0, 0.79, 0.35);
  bodyGroup.add(dashBody);

  const dashTrim = new THREE.Mesh(
    cachedMustangGeo('mus_dash_trim', () => new THREE.BoxGeometry(1.32, 0.065, 0.03)),
    machinedAlloyMat,
  );
  dashTrim.position.set(0, 0.82, 0.15);
  bodyGroup.add(dashTrim);

  for (const vx of [-0.075, 0, 0.075]) {
    const ventRing = new THREE.Mesh(
      cachedMustangGeo('mus_ac_vent', () => new THREE.TorusGeometry(0.026, 0.005, 8, 16)),
      machinedAlloyMat,
    );
    ventRing.position.set(vx, 0.83, 0.133);
    bodyGroup.add(ventRing);
  }

  const syncScreen = new THREE.Mesh(
    cachedMustangGeo('mus_sync', () => new THREE.PlaneGeometry(0.17, 0.105)),
    new THREE.MeshBasicMaterial({ map: tex.centerScreen }),
  );
  syncScreen.position.set(0, 0.73, 0.145);
  syncScreen.rotation.y = Math.PI;
  bodyGroup.add(syncScreen);

  const gaugePlane = new THREE.Mesh(
    cachedMustangGeo('mus_gauges', () => new THREE.PlaneGeometry(0.32, 0.12)),
    new THREE.MeshBasicMaterial({ map: tex.gaugeCluster }),
  );
  gaugePlane.position.set(spec.cockpitOffset.x, 0.85, 0.145);
  gaugePlane.rotation.y = Math.PI;
  bodyGroup.add(gaugePlane);

  const rearViewMirror = new THREE.Mesh(
    cachedMustangGeo('mus_rvm', () => new THREE.BoxGeometry(0.18, 0.048, 0.032)),
    satinBlackMat,
  );
  rearViewMirror.position.set(0, 1.18, 0.14);
  bodyGroup.add(rearViewMirror);

  const steerGroup = new THREE.Group();
  steerGroup.position.set(spec.cockpitOffset.x, 0.875, 0.05);
  steerGroup.rotation.x = -0.34;
  const steerRim = new THREE.Mesh(
    cachedMustangGeo('mus_sw_rim', () => new THREE.TorusGeometry(0.160, 0.016, 8, 24)),
    mats.seatMat,
  );
  const steerHub = new THREE.Mesh(
    cachedMustangGeo('mus_sw_hub', () => {
      const g = new THREE.CylinderGeometry(0.050, 0.050, 0.03, 14);
      g.rotateX(Math.PI / 2);
      return g;
    }),
    satinBlackMat,
  );
  steerGroup.add(steerRim, steerHub);
  for (const ang of [0, Math.PI, -Math.PI * 0.5]) {
    const sp = new THREE.Mesh(
      cachedMustangGeo('mus_sw_sp', () => new THREE.BoxGeometry(0.025, 0.125, 0.015)),
      machinedAlloyMat,
    );
    sp.position.set(Math.cos(ang) * 0.072, Math.sin(ang) * 0.072, 0);
    sp.rotation.z = ang - Math.PI * 0.5;
    steerGroup.add(sp);
  }
  bodyGroup.add(steerGroup);

  return { wheelNodes, wheelMeshes, frontSteerPivots };
}
