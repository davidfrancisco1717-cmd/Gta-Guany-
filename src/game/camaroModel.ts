import * as THREE from 'three';
import { VehicleSpec } from './types';
import { WheelNode } from './vehicles';

export interface CamaroMaterialsInput {
  paintMat: THREE.Material;
  trimMat: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshStandardMaterial;
  alloyMat: THREE.MeshStandardMaterial;
  darkAlloyMat: THREE.MeshStandardMaterial;
  tireMat: THREE.MeshStandardMaterial;
  rotorMat: THREE.MeshStandardMaterial;
  caliperRedMat: THREE.MeshStandardMaterial;
  carbonMat: THREE.MeshStandardMaterial;
  interiorMat: THREE.MeshStandardMaterial;
  seatMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshPhysicalMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  brakeLightMat: THREE.MeshStandardMaterial;
  reverseLightMat: THREE.MeshStandardMaterial;
  turnLeftMat: THREE.MeshStandardMaterial;
  turnRightMat: THREE.MeshStandardMaterial;
}

export interface CamaroBuildResult {
  wheelNodes: WheelNode[];
  wheelMeshes: THREE.Object3D[];
  frontSteerPivots: THREE.Object3D[];
}

interface CamaroTextures {
  paintSide: THREE.CanvasTexture;
  paintTop: THREE.CanvasTexture;
  paintEnd: THREE.CanvasTexture;
  flakeRough: THREE.CanvasTexture;
  flakeNormal: THREE.CanvasTexture;
  tireTread: THREE.CanvasTexture;
  tireTreadNormal: THREE.CanvasTexture;
  honeycomb: THREE.CanvasTexture;
  grilleNormal: THREE.Texture;
  carbonDiff: THREE.Texture;
  carbonNormal: THREE.Texture;
  rotorDiff: THREE.Texture;
  rotorNormal: THREE.Texture;
  caliperNormal: THREE.Texture;
  caliperMetal: THREE.Texture;
  chassisNormal: THREE.Texture;
  camaroBadge: THREE.CanvasTexture;
  autobotBadge: THREE.CanvasTexture;
  rearPlate: THREE.CanvasTexture;
  taillightLens: THREE.CanvasTexture;
  spoilerStripe: THREE.CanvasTexture;
  gaugeCluster: THREE.CanvasTexture;
  centerGauges: THREE.CanvasTexture;
}

let cachedTextures: CamaroTextures | null = null;
const camaroGeoCache = new Map<string, THREE.BufferGeometry>();

function cachedCamaroGeo(key: string, builder: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const existing = camaroGeoCache.get(key);
  if (existing) return existing;
  const geo = builder();
  camaroGeoCache.set(key, geo);
  return geo;
}

// World-space UV mapping bounds so every panel shut-line & rally stripe lines up seamlessly
const Z_MIN = -2.38;
const Z_MAX = 2.42;
const Y_MIN = 0.14;
const Y_MAX = 1.36;
const X_SPAN = 1.12;

function sideUV(z: number, y: number): THREE.Vector2 {
  const u = THREE.MathUtils.clamp((z - Z_MIN) / (Z_MAX - Z_MIN), 0.002, 0.998);
  const v = THREE.MathUtils.clamp((y - Y_MIN) / (Y_MAX - Y_MIN), 0.002, 0.998);
  return new THREE.Vector2(u, v);
}

function topUV(x: number, z: number): THREE.Vector2 {
  const u = THREE.MathUtils.clamp((x + X_SPAN) / (X_SPAN * 2), 0.002, 0.998);
  const v = THREE.MathUtils.clamp((z - Z_MIN) / (Z_MAX - Z_MIN), 0.002, 0.998);
  return new THREE.Vector2(u, v);
}

function endUV(x: number, y: number): THREE.Vector2 {
  const u = THREE.MathUtils.clamp((x + X_SPAN) / (X_SPAN * 2), 0.002, 0.998);
  const v = THREE.MathUtils.clamp((y - Y_MIN) / (Y_MAX - Y_MIN), 0.002, 0.998);
  return new THREE.Vector2(u, v);
}

function loadAssetTexture(
  loader: THREE.TextureLoader,
  url: string,
  options: {
    srgb?: boolean;
    repeat?: [number, number];
    anisotropy?: number;
  } = {},
): THREE.Texture {
  const tex = loader.load(url);
  tex.colorSpace = options.srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (options.repeat) {
    tex.repeat.set(options.repeat[0], options.repeat[1]);
  }
  tex.anisotropy = options.anisotropy ?? 8;
  return tex;
}

function getCamaroTextures(): CamaroTextures {
  if (cachedTextures) return cachedTextures;

  const texLoader = new THREE.TextureLoader();

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // -------------------------------------------------------------------------
  // 1. Metallic Flake Micro-Roughness & Micro-Normal Maps
  // -------------------------------------------------------------------------
  const flakeCanvas = document.createElement('canvas');
  flakeCanvas.width = 256;
  flakeCanvas.height = 256;
  const fctx = flakeCanvas.getContext('2d')!;
  const fImg = fctx.createImageData(256, 256);

  const flakeNCanvas = document.createElement('canvas');
  flakeNCanvas.width = 256;
  flakeNCanvas.height = 256;
  const fnctx = flakeNCanvas.getContext('2d')!;
  const fnImg = fnctx.createImageData(256, 256);

  for (let i = 0; i < fImg.data.length; i += 4) {
    const v = 224 + Math.floor(rand() * 30);
    fImg.data[i] = v;
    fImg.data[i + 1] = v;
    fImg.data[i + 2] = v;
    fImg.data[i + 3] = 255;

    fnImg.data[i] = 124 + Math.floor(rand() * 8);
    fnImg.data[i + 1] = 124 + Math.floor(rand() * 8);
    fnImg.data[i + 2] = 255;
    fnImg.data[i + 3] = 255;
  }
  fctx.putImageData(fImg, 0, 0);
  fnctx.putImageData(fnImg, 0, 0);

  const flakeRough = new THREE.CanvasTexture(flakeCanvas);
  flakeRough.wrapS = THREE.RepeatWrapping;
  flakeRough.wrapT = THREE.RepeatWrapping;
  flakeRough.repeat.set(16, 16);

  const flakeNormal = new THREE.CanvasTexture(flakeNCanvas);
  flakeNormal.wrapS = THREE.RepeatWrapping;
  flakeNormal.wrapT = THREE.RepeatWrapping;
  flakeNormal.repeat.set(16, 16);

  // -------------------------------------------------------------------------
  // 2. Side Panel Neutral AO, Shut-Lines & Flush Sculpted Gill Creases
  // -------------------------------------------------------------------------
  const sideCanvas = document.createElement('canvas');
  sideCanvas.width = 1024;
  sideCanvas.height = 512;
  const sctx = sideCanvas.getContext('2d')!;

  const sideGrad = sctx.createLinearGradient(0, 0, 0, 512);
  sideGrad.addColorStop(0.0, '#ffffff');
  sideGrad.addColorStop(0.55, '#fbfbfb');
  sideGrad.addColorStop(0.84, '#f0f0f0');
  sideGrad.addColorStop(1.0, '#d8d8d8');
  sctx.fillStyle = sideGrad;
  sctx.fillRect(0, 0, 1024, 512);

  const szToX = (z: number) => ((z - Z_MIN) / (Z_MAX - Z_MIN)) * 1024;
  const syToY = (y: number) => (1 - (y - Y_MIN) / (Y_MAX - Y_MIN)) * 512;

  // Subtle horizontal door crease highlight
  sctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  sctx.lineWidth = 2.5;
  sctx.beginPath();
  sctx.moveTo(szToX(-2.15), syToY(0.76));
  sctx.lineTo(szToX(2.02), syToY(0.68));
  sctx.stroke();

  // Subtle recessed door & fender shut-lines (matches 3_110bdf47.webp)
  sctx.strokeStyle = 'rgba(25, 20, 10, 0.55)';
  sctx.lineWidth = 2.0;
  sctx.lineCap = 'round';

  // Front bumper-to-fender shut-line
  sctx.beginPath();
  sctx.moveTo(szToX(1.94), syToY(0.62));
  sctx.lineTo(szToX(2.04), syToY(0.62));
  sctx.moveTo(szToX(1.88), syToY(0.45));
  sctx.quadraticCurveTo(szToX(1.95), syToY(0.63), szToX(2.02), syToY(0.76));
  sctx.stroke();

  // Door perimeter shut-line
  sctx.beginPath();
  sctx.moveTo(szToX(0.57), syToY(0.825));
  sctx.lineTo(szToX(0.54), syToY(0.24));
  sctx.lineTo(szToX(-0.56), syToY(0.24));
  sctx.quadraticCurveTo(szToX(-0.62), syToY(0.55), szToX(-0.56), syToY(0.865));
  sctx.stroke();

  // Rear bumper shut-line behind rear wheel arch
  sctx.beginPath();
  sctx.moveTo(szToX(-1.86), syToY(0.66));
  sctx.quadraticCurveTo(szToX(-2.04), syToY(0.66), szToX(-2.22), syToY(0.67));
  sctx.stroke();

  // 3 Flush Sculpted Rear-Quarter Gill Louvers (subtle indented shadow + rim highlight, no protruding sticks!)
  for (let gi = 0; gi < 3; gi++) {
    const gz = -0.76 - gi * 0.056;
    const gx0 = szToX(gz);
    const gx1 = szToX(gz - 0.045);
    const gy0 = syToY(0.57 + gi * 0.008);
    const gy1 = syToY(0.32 + gi * 0.008);

    sctx.strokeStyle = 'rgba(20, 15, 5, 0.52)';
    sctx.lineWidth = 3.2;
    sctx.beginPath();
    sctx.moveTo(gx0, gy0);
    sctx.lineTo(gx1, gy1);
    sctx.stroke();

    sctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    sctx.lineWidth = 1.6;
    sctx.beginPath();
    sctx.moveTo(gx0 + 2.5, gy0);
    sctx.lineTo(gx1 + 2.5, gy1);
    sctx.stroke();
  }

  const paintSide = new THREE.CanvasTexture(sideCanvas);
  paintSide.colorSpace = THREE.SRGBColorSpace;
  paintSide.anisotropy = 8;

  // -------------------------------------------------------------------------
  // 3. Top Paint Texture (2048px Twin Gloss-Black Rally Stripes + Clean Seams)
  // -------------------------------------------------------------------------
  const topCanvas = document.createElement('canvas');
  topCanvas.width = 2048;
  topCanvas.height = 2048;
  const tctx = topCanvas.getContext('2d')!;

  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, 2048, 2048);

  const txToPx = (x: number) => ((x + X_SPAN) / (X_SPAN * 2)) * 2048;
  const tzToPy = (z: number) => (1 - (z - Z_MIN) / (Z_MAX - Z_MIN)) * 2048;

  // Subtle reverse-mohawk roof center channel shading
  const mohawkAO = tctx.createLinearGradient(txToPx(-0.22), 0, txToPx(0.22), 0);
  mohawkAO.addColorStop(0, 'rgba(0,0,0,0)');
  mohawkAO.addColorStop(0.25, 'rgba(0,0,0,0.06)');
  mohawkAO.addColorStop(0.5, 'rgba(0,0,0,0.02)');
  mohawkAO.addColorStop(0.75, 'rgba(0,0,0,0.06)');
  mohawkAO.addColorStop(1, 'rgba(0,0,0,0)');
  tctx.fillStyle = mohawkAO;
  tctx.fillRect(txToPx(-0.24), tzToPy(0.05), txToPx(0.24) - txToPx(-0.24), tzToPy(-1.05) - tzToPy(0.05));

  // Twin Gloss-Black Rally Stripes + Thin Outer Pinstripes (Hood + Trunk only, pure yellow roof)
  const drawTopStripeBand = (zStart: number, zEnd: number, halfCenterGap: number, widthStart: number, widthEnd: number) => {
    for (const sign of [-1, 1] as const) {
      const in0 = txToPx(sign * halfCenterGap);
      const out0 = txToPx(sign * (halfCenterGap + widthStart));
      const in1 = txToPx(sign * (halfCenterGap * 0.86));
      const out1 = txToPx(sign * (halfCenterGap * 0.86 + widthEnd));
      const py0 = tzToPy(zStart);
      const py1 = tzToPy(zEnd);

      tctx.fillStyle = '#090a0d';
      tctx.beginPath();
      tctx.moveTo(in0, py0);
      tctx.lineTo(out0, py0);
      tctx.lineTo(out1, py1);
      tctx.lineTo(in1, py1);
      tctx.closePath();
      tctx.fill();

      // Thin crisp outer pinstripe
      const pinGap = 0.015;
      const pinW = 0.020;
      const pIn0 = txToPx(sign * (halfCenterGap + widthStart + pinGap));
      const pOut0 = txToPx(sign * (halfCenterGap + widthStart + pinGap + pinW));
      const pIn1 = txToPx(sign * (halfCenterGap * 0.86 + widthEnd + pinGap * 0.9));
      const pOut1 = txToPx(sign * (halfCenterGap * 0.86 + widthEnd + pinGap * 0.9 + pinW * 0.9));

      tctx.beginPath();
      tctx.moveTo(pIn0, py0);
      tctx.lineTo(pOut0, py0);
      tctx.lineTo(pOut1, py1);
      tctx.lineTo(pIn1, py1);
      tctx.closePath();
      tctx.fill();
    }
  };

  // Hood stripes stop cleanly just behind the mail-slot brow crease; rear stripes cover trunk lid
  drawTopStripeBand(0.56, 2.21, 0.054, 0.275, 0.232);
  drawTopStripeBand(-1.52, -2.35, 0.052, 0.260, 0.250);

  // Subtle Hood Perimeter Shut-Line Seam
  tctx.strokeStyle = 'rgba(20, 15, 5, 0.45)';
  tctx.lineWidth = 3.5;
  tctx.beginPath();
  tctx.moveTo(txToPx(-0.74), tzToPy(0.56));
  tctx.lineTo(txToPx(-0.71), tzToPy(1.94));
  tctx.quadraticCurveTo(txToPx(-0.52), tzToPy(2.14), txToPx(0), tzToPy(2.18));
  tctx.quadraticCurveTo(txToPx(0.52), tzToPy(2.14), txToPx(0.71), tzToPy(1.94));
  tctx.lineTo(txToPx(0.74), tzToPy(0.56));
  tctx.stroke();

  // Subtle Trunk Lid Shut-Line Seam
  tctx.beginPath();
  tctx.moveTo(txToPx(-0.68), tzToPy(-1.54));
  tctx.lineTo(txToPx(-0.68), tzToPy(-2.18));
  tctx.moveTo(txToPx(0.68), tzToPy(-1.54));
  tctx.lineTo(txToPx(0.68), tzToPy(-2.18));
  tctx.stroke();

  const paintTop = new THREE.CanvasTexture(topCanvas);
  paintTop.colorSpace = THREE.SRGBColorSpace;
  paintTop.anisotropy = 8;

  // -------------------------------------------------------------------------
  // 4. Front & Rear End Neutral Paint Texture (Trunk Seam + License Recess AO)
  // -------------------------------------------------------------------------
  const endCanvas = document.createElement('canvas');
  endCanvas.width = 1024;
  endCanvas.height = 512;
  const ect = endCanvas.getContext('2d')!;

  const endGrad = ect.createLinearGradient(0, 0, 0, 512);
  endGrad.addColorStop(0.0, '#ffffff');
  endGrad.addColorStop(0.70, '#f7f7f7');
  endGrad.addColorStop(1.0, '#e2e2e2');
  ect.fillStyle = endGrad;
  ect.fillRect(0, 0, 1024, 512);

  const exToPx = (x: number) => ((x + X_SPAN) / (X_SPAN * 2)) * 1024;
  const eyToPy = (y: number) => (1 - (y - Y_MIN) / (Y_MAX - Y_MIN)) * 512;

  ect.strokeStyle = 'rgba(20, 15, 5, 0.55)';
  ect.lineWidth = 3.0;
  ect.beginPath();
  ect.moveTo(exToPx(-0.92), eyToPy(0.878));
  ect.lineTo(exToPx(0.92), eyToPy(0.878));
  ect.stroke();

  ect.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ect.lineWidth = 3;
  ect.strokeRect(
    exToPx(-0.24),
    eyToPy(0.65),
    exToPx(0.24) - exToPx(-0.24),
    eyToPy(0.46) - eyToPy(0.65),
  );

  const paintEnd = new THREE.CanvasTexture(endCanvas);
  paintEnd.colorSpace = THREE.SRGBColorSpace;
  paintEnd.anisotropy = 8;

  // -------------------------------------------------------------------------
  // 5. Real Sport Tire Tread + Cropped Real Normal Map from Shared_Car_Tire_Sport_N
  // -------------------------------------------------------------------------
  const tireCanvas = document.createElement('canvas');
  tireCanvas.width = 256;
  tireCanvas.height = 256;
  const trctx = tireCanvas.getContext('2d')!;
  trctx.fillStyle = '#181a1f';
  trctx.fillRect(0, 0, 256, 256);
  trctx.strokeStyle = '#090a0d';
  trctx.lineWidth = 6;
  for (let y = -32; y < 288; y += 22) {
    trctx.beginPath();
    trctx.moveTo(0, y);
    trctx.lineTo(128, y + 26);
    trctx.lineTo(256, y);
    trctx.stroke();
  }
  trctx.fillStyle = '#07080a';
  trctx.fillRect(104, 0, 12, 256);
  trctx.fillRect(140, 0, 12, 256);
  const tireTread = new THREE.CanvasTexture(tireCanvas);
  tireTread.colorSpace = THREE.SRGBColorSpace;
  tireTread.wrapS = THREE.RepeatWrapping;
  tireTread.wrapT = THREE.RepeatWrapping;
  tireTread.repeat.set(1, 6);
  tireTread.anisotropy = 8;

  const tireNCanvas = document.createElement('canvas');
  tireNCanvas.width = 256;
  tireNCanvas.height = 256;
  const tnctx = tireNCanvas.getContext('2d')!;
  tnctx.fillStyle = 'rgb(128, 128, 255)';
  tnctx.fillRect(0, 0, 256, 256);
  tnctx.strokeStyle = 'rgb(128, 70, 235)';
  tnctx.lineWidth = 6;
  for (let y = -32; y < 288; y += 22) {
    tnctx.beginPath();
    tnctx.moveTo(0, y);
    tnctx.lineTo(128, y + 26);
    tnctx.lineTo(256, y);
    tnctx.stroke();
  }
  const tireTreadNormal = new THREE.CanvasTexture(tireNCanvas);
  tireTreadNormal.colorSpace = THREE.NoColorSpace;
  tireTreadNormal.wrapS = THREE.RepeatWrapping;
  tireTreadNormal.wrapT = THREE.RepeatWrapping;
  tireTreadNormal.repeat.set(1, 6);

  const tireImg = new Image();
  tireImg.onload = () => {
    const sx = Math.floor(tireImg.width * 0.335);
    const sy = Math.floor(tireImg.height * 0.25);
    const sw = Math.floor(tireImg.width * 0.33);
    const sh = Math.floor(tireImg.height * 0.50);
    tnctx.drawImage(tireImg, sx, sy, sw, sh, 0, 0, 256, 256);
    tireTreadNormal.needsUpdate = true;
  };
  tireImg.src = '/assets/aistudio/Shared_Car_Tire_Sport_N_16f116f4.png';

  // -------------------------------------------------------------------------
  // 6. Spoiler Stripe Wrap Texture (Matches 5_7244386f.webp & 6_312e4d6f.webp)
  // -------------------------------------------------------------------------
  const spCanvas = document.createElement('canvas');
  spCanvas.width = 1024;
  spCanvas.height = 128;
  const spctx = spCanvas.getContext('2d')!;
  spctx.fillStyle = '#ffffff';
  spctx.fillRect(0, 0, 1024, 128);
  const spTxToPx = (x: number) => ((x + X_SPAN) / (X_SPAN * 2)) * 1024;
  for (const sign of [-1, 1] as const) {
    const x0 = spTxToPx(sign * 0.044);
    const x1 = spTxToPx(sign * 0.295);
    spctx.fillStyle = '#090a0d';
    spctx.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), 128);
    const p0 = spTxToPx(sign * 0.310);
    const p1 = spTxToPx(sign * 0.330);
    spctx.fillRect(Math.min(p0, p1), 0, Math.abs(p1 - p0), 128);
  }
  const spoilerStripe = new THREE.CanvasTexture(spCanvas);
  spoilerStripe.colorSpace = THREE.SRGBColorSpace;
  spoilerStripe.anisotropy = 8;

  // -------------------------------------------------------------------------
  // 7. Real Honeycomb Grille (Dark Recessed Cavities + Real GrilleA Normal Map)
  // -------------------------------------------------------------------------
  const hcCanvas = document.createElement('canvas');
  hcCanvas.width = 256;
  hcCanvas.height = 256;
  const hctx = hcCanvas.getContext('2d')!;
  hctx.fillStyle = '#030406';
  hctx.fillRect(0, 0, 256, 256);
  hctx.strokeStyle = '#1b1f28';
  hctx.lineWidth = 4.2;
  const hr = 14;
  const hdx = hr * 1.5;
  const hdy = hr * Math.sqrt(3);
  for (let row = -1; row < 20; row++) {
    for (let col = -1; col < 20; col++) {
      const hx = col * hdx;
      const hy = row * hdy + (col % 2 !== 0 ? hdy * 0.5 : 0);
      hctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const px = hx + (hr - 1.2) * Math.cos(a);
        const py = hy + (hr - 1.2) * Math.sin(a);
        if (k === 0) hctx.moveTo(px, py);
        else hctx.lineTo(px, py);
      }
      hctx.closePath();
      hctx.stroke();
    }
  }
  const honeycomb = new THREE.CanvasTexture(hcCanvas);
  honeycomb.colorSpace = THREE.SRGBColorSpace;
  honeycomb.wrapS = THREE.RepeatWrapping;
  honeycomb.wrapT = THREE.RepeatWrapping;
  honeycomb.repeat.set(10, 3);
  honeycomb.anisotropy = 8;

  const grilleNormal = loadAssetTexture(
    texLoader,
    '/assets/aistudio/Car_Pagani_Huayra_2012_GrilleA_NO_35c568c0.png',
    { srgb: false, repeat: [10, 3] },
  );

  // -------------------------------------------------------------------------
  // 8. Real Carbon Fiber, Drilled Brake Rotor, Caliper & Chassis PBR Maps
  // -------------------------------------------------------------------------
  const carbonDiff = loadAssetTexture(
    texLoader,
    '/assets/aistudio/common_carbon05_black_diff_f956c437.png',
    { srgb: true, repeat: [10, 6] },
  );
  const carbonNormal = loadAssetTexture(
    texLoader,
    '/assets/aistudio/common_carbon05_norm_bc99b40d.png',
    { srgb: false, repeat: [10, 6] },
  );
  const rotorDiff = loadAssetTexture(
    texLoader,
    '/assets/aistudio/Shared_Car_DiscCeramicDrilled10Square_D_aa64c6f7.png',
    { srgb: true },
  );
  const rotorNormal = loadAssetTexture(
    texLoader,
    '/assets/aistudio/Shared_Car_DiscCeramicDrilled10Square_N_0e91bb33.png',
    { srgb: false },
  );
  const caliperNormal = loadAssetTexture(
    texLoader,
    '/assets/aistudio/Shared_Car_CaliperExoticParking_N_4ca8f331.png',
    { srgb: false },
  );
  const caliperMetal = loadAssetTexture(
    texLoader,
    '/assets/aistudio/Shared_Car_CaliperExoticParking_Material_Metallic_631c5a42.png',
    { srgb: false },
  );
  const chassisNormal = loadAssetTexture(
    texLoader,
    '/assets/aistudio/Shared_Car_ChassisImprovement_N_e6ea1837.png',
    { srgb: false, repeat: [2, 2] },
  );

  // -------------------------------------------------------------------------
  // 9. Dark Metallic "CAMARO" Fender Lettering Badge (matches 3_110bdf47.webp)
  // -------------------------------------------------------------------------
  const badgeCanvas = document.createElement('canvas');
  badgeCanvas.width = 512;
  badgeCanvas.height = 128;
  const bctx = badgeCanvas.getContext('2d')!;
  bctx.clearRect(0, 0, 512, 128);
  bctx.font = '900 50px "Arial Black", Impact, sans-serif';
  bctx.textAlign = 'center';
  bctx.textBaseline = 'middle';
  bctx.fillStyle = 'rgba(0,0,0,0.45)';
  bctx.fillText('C A M A R O', 258, 67);
  const chromeGrad = bctx.createLinearGradient(0, 36, 0, 92);
  chromeGrad.addColorStop(0, '#e2e8f0');
  chromeGrad.addColorStop(0.45, '#64748b');
  chromeGrad.addColorStop(0.55, '#334155');
  chromeGrad.addColorStop(1, '#94a3b8');
  bctx.fillStyle = chromeGrad;
  bctx.fillText('C A M A R O', 256, 64);
  const camaroBadge = new THREE.CanvasTexture(badgeCanvas);
  camaroBadge.colorSpace = THREE.SRGBColorSpace;
  camaroBadge.anisotropy = 8;

  // -------------------------------------------------------------------------
  // 10. Crimson / Silver Autobot Fender Crest
  // -------------------------------------------------------------------------
  const autoCanvas = document.createElement('canvas');
  autoCanvas.width = 128;
  autoCanvas.height = 128;
  const actx = autoCanvas.getContext('2d')!;
  actx.clearRect(0, 0, 128, 128);
  actx.fillStyle = '#b91c1c';
  actx.strokeStyle = '#cbd5e1';
  actx.lineWidth = 4;
  actx.beginPath();
  actx.moveTo(22, 16);
  actx.lineTo(106, 16);
  actx.lineTo(112, 48);
  actx.lineTo(86, 114);
  actx.lineTo(42, 114);
  actx.lineTo(16, 48);
  actx.closePath();
  actx.fill();
  actx.stroke();
  actx.fillStyle = '#0f172a';
  actx.fillRect(36, 48, 22, 14);
  actx.fillRect(70, 48, 22, 14);
  actx.strokeStyle = '#fecaca';
  actx.lineWidth = 3;
  actx.beginPath();
  actx.moveTo(64, 24);
  actx.lineTo(64, 96);
  actx.moveTo(34, 78);
  actx.lineTo(94, 78);
  actx.stroke();
  const autobotBadge = new THREE.CanvasTexture(autoCanvas);
  autobotBadge.colorSpace = THREE.SRGBColorSpace;

  // -------------------------------------------------------------------------
  // 11. Dark "EXELANS / CHEVROLET CAMARO SS" Rear License Plate
  // -------------------------------------------------------------------------
  const plateCanvas = document.createElement('canvas');
  plateCanvas.width = 512;
  plateCanvas.height = 256;
  const pctx = plateCanvas.getContext('2d')!;
  pctx.fillStyle = '#07090d';
  pctx.fillRect(0, 0, 512, 256);
  pctx.strokeStyle = '#e2e8f0';
  pctx.lineWidth = 10;
  pctx.strokeRect(8, 8, 496, 240);
  pctx.strokeStyle = '#ef4444';
  pctx.lineWidth = 3;
  pctx.strokeRect(20, 20, 472, 216);
  pctx.fillStyle = '#f8fafc';
  pctx.font = 'italic 900 72px "Arial Black", sans-serif';
  pctx.textAlign = 'center';
  pctx.textBaseline = 'middle';
  pctx.fillText('EXELANS', 256, 118);
  pctx.fillStyle = '#ef4444';
  pctx.fillRect(72, 152, 368, 4);
  pctx.fillStyle = '#cbd5e1';
  pctx.font = 'bold 20px monospace';
  pctx.fillText('CHEVROLET CAMARO SS', 256, 198);
  const rearPlate = new THREE.CanvasTexture(plateCanvas);
  rearPlate.colorSpace = THREE.SRGBColorSpace;
  rearPlate.anisotropy = 8;

  // -------------------------------------------------------------------------
  // 12. Ruby Jewel Taillight Multi-Facet Reflector Pattern
  // -------------------------------------------------------------------------
  const tlCanvas = document.createElement('canvas');
  tlCanvas.width = 256;
  tlCanvas.height = 128;
  const tlctx = tlCanvas.getContext('2d')!;
  const tlGrad = tlctx.createLinearGradient(0, 0, 0, 128);
  tlGrad.addColorStop(0, '#7c0c12');
  tlGrad.addColorStop(0.45, '#cb1a22');
  tlGrad.addColorStop(0.55, '#9d1016');
  tlGrad.addColorStop(1, '#58090c');
  tlctx.fillStyle = tlGrad;
  tlctx.fillRect(0, 0, 256, 128);
  tlctx.strokeStyle = 'rgba(255, 200, 200, 0.22)';
  tlctx.lineWidth = 3;
  for (let gx = 16; gx < 256; gx += 20) {
    tlctx.beginPath();
    tlctx.moveTo(gx, 8);
    tlctx.lineTo(gx, 120);
    tlctx.stroke();
  }
  tlctx.strokeStyle = 'rgba(18, 3, 4, 0.85)';
  tlctx.lineWidth = 10;
  tlctx.strokeRect(4, 4, 248, 120);
  const taillightLens = new THREE.CanvasTexture(tlCanvas);
  taillightLens.colorSpace = THREE.SRGBColorSpace;

  // -------------------------------------------------------------------------
  // 13. Camaro SS Twin-Square Instrument Cluster + Console 4-Pack Gauges
  // -------------------------------------------------------------------------
  const gCanvas = document.createElement('canvas');
  gCanvas.width = 512;
  gCanvas.height = 256;
  const gctx = gCanvas.getContext('2d')!;
  gctx.fillStyle = '#070b12';
  gctx.fillRect(0, 0, 512, 256);

  const drawCamaroDial = (cx: number, cy: number, radius: number, label: string, maxLabel: string) => {
    gctx.strokeStyle = '#94a3b8';
    gctx.lineWidth = 8;
    gctx.beginPath();
    gctx.roundRect(cx - radius - 14, cy - radius - 10, (radius + 14) * 2, (radius + 10) * 2, 22);
    gctx.stroke();
    gctx.fillStyle = '#09111f';
    gctx.fill();

    gctx.strokeStyle = '#38bdf8';
    gctx.lineWidth = 3;
    gctx.beginPath();
    gctx.arc(cx, cy, radius * 0.86, Math.PI * 0.78, Math.PI * 2.22);
    gctx.stroke();

    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * 0.78 + (i / 12) * Math.PI * 1.44;
      const r0 = radius * 0.70;
      const r1 = radius * 0.84;
      gctx.strokeStyle = i >= 10 ? '#ef4444' : '#e0f2fe';
      gctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
      gctx.beginPath();
      gctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      gctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      gctx.stroke();
    }

    gctx.strokeStyle = '#f97316';
    gctx.lineWidth = 4;
    gctx.beginPath();
    gctx.moveTo(cx, cy);
    gctx.lineTo(cx + Math.cos(Math.PI * 0.92) * radius * 0.72, cy + Math.sin(Math.PI * 0.92) * radius * 0.72);
    gctx.stroke();

    gctx.fillStyle = '#cbd5e1';
    gctx.beginPath();
    gctx.arc(cx, cy, 10, 0, Math.PI * 2);
    gctx.fill();

    gctx.fillStyle = '#7dd3fc';
    gctx.font = 'bold 14px sans-serif';
    gctx.textAlign = 'center';
    gctx.fillText(label, cx, cy + radius * 0.42);
    gctx.fillText(maxLabel, cx, cy + radius * 0.65);
  };

  drawCamaroDial(135, 128, 86, 'RPM x1000', 'SS V8');
  drawCamaroDial(377, 128, 86, 'KM/H', '280');

  gctx.fillStyle = '#0c4a6e';
  gctx.fillRect(228, 92, 56, 72);
  gctx.strokeStyle = '#38bdf8';
  gctx.lineWidth = 2;
  gctx.strokeRect(228, 92, 56, 72);
  gctx.fillStyle = '#e0f2fe';
  gctx.font = 'bold 15px monospace';
  gctx.textAlign = 'center';
  gctx.fillText('P R N D', 256, 118);
  gctx.fillText('SS 6.2L', 256, 148);

  const gaugeCluster = new THREE.CanvasTexture(gCanvas);
  gaugeCluster.colorSpace = THREE.SRGBColorSpace;

  const cgCanvas = document.createElement('canvas');
  cgCanvas.width = 256;
  cgCanvas.height = 128;
  const cgctx = cgCanvas.getContext('2d')!;
  cgctx.fillStyle = '#11151d';
  cgctx.fillRect(0, 0, 256, 128);
  for (let gx = 0; gx < 4; gx++) {
    const cx = 36 + gx * 61;
    cgctx.strokeStyle = '#94a3b8';
    cgctx.lineWidth = 3;
    cgctx.strokeRect(cx - 22, 24, 44, 80);
    cgctx.fillStyle = '#070b12';
    cgctx.fillRect(cx - 19, 27, 38, 74);
    cgctx.strokeStyle = '#38bdf8';
    cgctx.lineWidth = 2;
    cgctx.beginPath();
    cgctx.arc(cx, 64, 15, Math.PI * 0.8, Math.PI * 2.2);
    cgctx.stroke();
    cgctx.strokeStyle = '#f97316';
    cgctx.beginPath();
    cgctx.moveTo(cx, 64);
    cgctx.lineTo(cx + 8, 53);
    cgctx.stroke();
  }
  const centerGauges = new THREE.CanvasTexture(cgCanvas);
  centerGauges.colorSpace = THREE.SRGBColorSpace;

  cachedTextures = {
    paintSide,
    paintTop,
    paintEnd,
    flakeRough,
    flakeNormal,
    tireTread,
    tireTreadNormal,
    honeycomb,
    grilleNormal,
    carbonDiff,
    carbonNormal,
    rotorDiff,
    rotorNormal,
    caliperNormal,
    caliperMetal,
    chassisNormal,
    camaroBadge,
    autobotBadge,
    rearPlate,
    taillightLens,
    spoilerStripe,
    gaugeCluster,
    centerGauges,
  };
  return cachedTextures;
}

// ---------------------------------------------------------------------------
// Mathematical Loft & Boundary Helpers (Watertight Stitched Curves)
// ---------------------------------------------------------------------------

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function samplePiecewise(stops: ReadonlyArray<[number, number]>, z: number): number {
  if (stops[0][0] > stops[stops.length - 1][0]) {
    if (z >= stops[0][0]) return stops[0][1];
    for (let i = 0; i < stops.length - 1; i++) {
      const [z0, v0] = stops[i];
      const [z1, v1] = stops[i + 1];
      if (z <= z0 && z >= z1) {
        const t = THREE.MathUtils.clamp((z0 - z) / Math.max(1e-5, z0 - z1), 0, 1);
        const s = t * t * (3 - 2 * t);
        return v0 + (v1 - v0) * s;
      }
    }
    return stops[stops.length - 1][1];
  }
  if (z <= stops[0][0]) return stops[0][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [z0, v0] = stops[i];
    const [z1, v1] = stops[i + 1];
    if (z >= z0 && z <= z1) {
      const t = THREE.MathUtils.clamp((z - z0) / Math.max(1e-5, z1 - z0), 0, 1);
      const s = t * t * (3 - 2 * t);
      return v0 + (v1 - v0) * s;
    }
  }
  return stops[stops.length - 1][1];
}

function buildLoftedGridGeometry(
  grid: THREE.Vector3[][],
  outwardHint: (p: THREE.Vector3, uFrac: number, vFrac: number) => THREE.Vector3,
  uvGrid?: THREE.Vector2[][],
): THREE.BufferGeometry {
  const rows = grid.length;
  const cols = grid[0].length;
  const positions = new Float32Array(rows * cols * 3);
  const uvs = new Float32Array(rows * cols * 2);

  for (let r = 0; r < rows; r++) {
    const vf = r / Math.max(1, rows - 1);
    for (let c = 0; c < cols; c++) {
      const uf = c / Math.max(1, cols - 1);
      const idx = r * cols + c;
      const p = grid[r][c];
      positions[idx * 3] = p.x;
      positions[idx * 3 + 1] = p.y;
      positions[idx * 3 + 2] = p.z;
      if (uvGrid) {
        uvs[idx * 2] = uvGrid[r][c].x;
        uvs[idx * 2 + 1] = uvGrid[r][c].y;
      } else {
        uvs[idx * 2] = uf;
        uvs[idx * 2 + 1] = vf;
      }
    }
  }

  const mr = Math.floor((rows - 1) / 2);
  const mc = Math.floor((cols - 1) / 2);
  const p00 = grid[mr][mc];
  const p10 = grid[mr + 1][mc];
  const p01 = grid[mr][mc + 1];
  const e1 = new THREE.Vector3().subVectors(p10, p00);
  const e2 = new THREE.Vector3().subVectors(p01, p00);
  const triN = new THREE.Vector3().crossVectors(e1, e2);
  const hint = outwardHint(p00, mc / Math.max(1, cols - 1), mr / Math.max(1, rows - 1));
  const flip = triN.dot(hint) < 0;

  const indices: number[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = (r + 1) * cols + c;
      const d = r * cols + (c + 1);
      const e = (r + 1) * cols + (c + 1);
      if (!flip) {
        indices.push(a, b, e, a, e, d);
      } else {
        indices.push(a, e, b, a, d, e);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---------------------------------------------------------------------------
// Exact 2010–2012 Chevrolet Camaro SS Shared Silhouette Functions
// ---------------------------------------------------------------------------

const WHEEL_Z = 1.48;
const WHEEL_R = 0.382;
const ARCH_R = 0.438;
const FRONT_JOIN_Z = 2.02;
const REAR_JOIN_Z = -2.18;

function frontBrowZ(u: number): number {
  return 2.38 - (2.38 - FRONT_JOIN_Z) * Math.pow(THREE.MathUtils.clamp(Math.abs(u), 0, 1), 1.95);
}

function frontSurfaceZ(x: number, outerW = 0.945): number {
  return frontBrowZ(THREE.MathUtils.clamp(x / outerW, -1, 1));
}

function rearBrowZ(u: number): number {
  return -2.32 + (2.32 + REAR_JOIN_Z) * Math.pow(THREE.MathUtils.clamp(Math.abs(u), 0, 1), 1.85);
}

function rearTailZ(x: number, outerW = 0.968): number {
  return rearBrowZ(THREE.MathUtils.clamp(x / outerW, -1, 1));
}

function beltlineY(z: number): number {
  return samplePiecewise(
    [
      [2.38, 0.728],
      [2.02, 0.778],
      [1.48, 0.818],
      [0.58, 0.824],
      [-0.30, 0.854],
      [-0.86, 0.896],
      [-1.48, 0.938],
      [-2.05, 0.924],
      [-2.32, 0.908],
    ],
    z,
  );
}

function bodyHalfW(z: number): number {
  return samplePiecewise(
    [
      [2.38, 0.84],
      [2.02, 0.945],
      [1.82, 0.985],
      [1.48, 1.028],
      [0.85, 0.996],
      [0.0, 0.988],
      [-0.75, 1.032],
      [-1.48, 1.072],
      [-2.00, 1.008],
      [-2.18, 0.968],
      [-2.32, 0.92],
    ],
    z,
  );
}

// Exact shared edge X where side shoulder meets hood, greenhouse pillars, and trunk
function sideTopEdgeX(z: number): number {
  return bodyHalfW(z) - 0.105;
}

function sideBottomY(z: number): number {
  const df = Math.abs(z - WHEEL_Z);
  if (df < ARCH_R) {
    return WHEEL_R + Math.sqrt(Math.max(0, ARCH_R * ARCH_R - df * df));
  }
  const dr = Math.abs(z + WHEEL_Z);
  if (dr < ARCH_R) {
    return WHEEL_R + Math.sqrt(Math.max(0, ARCH_R * ARCH_R - dr * dr));
  }
  return samplePiecewise(
    [
      [2.38, 0.195],
      [1.92, 0.195],
      [1.04, 0.185],
      [-1.04, 0.185],
      [-1.92, 0.215],
      [-2.18, 0.295],
      [-2.32, 0.365],
    ],
    z,
  );
}

function sideSectionX(hw: number, t: number, z: number): number {
  // Smooth convex automotive shoulder curve from rocker (t=0) up to top deck edge (t=1)
  const archFlare =
    Math.abs(z - WHEEL_Z) < ARCH_R + 0.05 || Math.abs(z + WHEEL_Z) < ARCH_R + 0.05
      ? 0.016 * (1 - t)
      : 0;
  if (t <= 0.001) return hw - 0.065 + archFlare;
  // Smooth bulge peaking around belt shoulder (t ~ 0.65) and curving seamlessly inward to hw - 0.105 at t=1
  const lowerTuck = -0.065 * Math.pow(1 - t, 2.2);
  const shoulderOut = 0.022 * Math.sin(Math.pow(t, 0.85) * Math.PI);
  const upperTuck = -0.105 * Math.pow(t, 2.4);
  return hw + lowerTuck + shoulderOut + upperTuck + archFlare;
}

function hoodSurfaceY(x: number, z: number): number {
  const halfSpan = Math.max(0.45, sideTopEdgeX(z));
  const xn = THREE.MathUtils.clamp(x / halfSpan, -1, 1);
  const edgeY = beltlineY(z);
  const lateralCrown = 0.028 * (1 - xn * xn);

  const bulgeZEnv = smoothstep(0.54, 0.86, z) * (1 - smoothstep(1.94, 2.12, z));
  const bulgeXEnv = Math.exp(-Math.pow(x / 0.34, 4));
  const powerDome = 0.044 * bulgeZEnv * bulgeXEnv;

  const noseDrop = -0.052 * smoothstep(1.94, 2.36, z);
  return edgeY + lateralCrown + powerDome + noseDrop;
}

function trunkSurfaceY(x: number, z: number): number {
  const halfSpan = Math.max(0.50, sideTopEdgeX(z));
  const xn = THREE.MathUtils.clamp(x / halfSpan, -1, 1);
  const edgeY = beltlineY(z);
  const camber = 0.020 * (1 - xn * xn);
  return edgeY + camber;
}

function roofFrontZ(x: number): number {
  const xn = THREE.MathUtils.clamp(Math.abs(x) / 0.69, 0, 1);
  return 0.015 + 0.045 * (1 - xn * xn);
}

function roofRearZ(x: number): number {
  const xn = THREE.MathUtils.clamp(Math.abs(x) / 0.69, 0, 1);
  return -1.03 - 0.022 * (1 - xn * xn);
}

function roofSurfaceY(x: number, z: number): number {
  const zMid = -0.51;
  const zn = THREE.MathUtils.clamp((z - zMid) / 0.56, -1, 1);
  const domeZ = Math.max(0, 1 - Math.pow(Math.abs(zn), 2.1) * 0.72);
  const xn = THREE.MathUtils.clamp(Math.abs(x) / 0.70, 0, 1);
  const domeX = 1 - Math.pow(xn, 2.1);
  const mohawkDip = -0.012 * Math.exp(-Math.pow(x / 0.16, 2));
  return 1.228 + 0.050 * domeZ * domeX + mohawkDip;
}

// ---------------------------------------------------------------------------
// Custom 20" 5-Spoke Bumblebee Wheels + Polar Drilled Brake Discs
// ---------------------------------------------------------------------------

function getCamaroSpokeBackingGeo(r: number): THREE.BufferGeometry {
  return cachedCamaroGeo(`camaro_spoke_silver_v3_${r.toFixed(3)}`, () => {
    const shape = new THREE.Shape();
    const r0 = r * 0.15;
    const r1 = r * 0.655;
    shape.moveTo(-0.036, r0);
    shape.lineTo(0.036, r0);
    shape.lineTo(0.082, r1 * 0.72);
    shape.lineTo(0.098, r1);
    shape.lineTo(0.032, r1);
    shape.lineTo(0.018, r1 * 0.66);
    shape.lineTo(-0.018, r1 * 0.66);
    shape.lineTo(-0.032, r1);
    shape.lineTo(-0.098, r1);
    shape.lineTo(-0.082, r1 * 0.72);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.006,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -0.012);
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

function getCamaroSpokeFaceGeo(r: number): THREE.BufferGeometry {
  return cachedCamaroGeo(`camaro_spoke_black_v3_${r.toFixed(3)}`, () => {
    const shape = new THREE.Shape();
    const r0 = r * 0.15;
    const r1 = r * 0.638;
    shape.moveTo(-0.026, r0);
    shape.lineTo(0.026, r0);
    shape.lineTo(0.068, r1 * 0.72);
    shape.lineTo(0.082, r1);
    shape.lineTo(0.025, r1);
    shape.lineTo(0.012, r1 * 0.66);
    shape.lineTo(-0.012, r1 * 0.66);
    shape.lineTo(-0.025, r1);
    shape.lineTo(-0.082, r1);
    shape.lineTo(-0.068, r1 * 0.72);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -0.012);
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

function getCamaroTireTreadGeo(radius: number, width: number): THREE.BufferGeometry {
  return cachedCamaroGeo(`camaro_tire_tread_${radius.toFixed(3)}_${width.toFixed(3)}`, () => {
    const hw = width * 0.5;
    const pts = [
      new THREE.Vector2(radius * 0.945, -hw * 0.94),
      new THREE.Vector2(radius, -hw * 0.74),
      new THREE.Vector2(radius, hw * 0.74),
      new THREE.Vector2(radius * 0.945, hw * 0.94),
    ];
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.rotateZ(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

function getCamaroTireSidewallGeo(radius: number, width: number): THREE.BufferGeometry {
  return cachedCamaroGeo(`camaro_tire_side_${radius.toFixed(3)}_${width.toFixed(3)}`, () => {
    const hw = width * 0.5;
    const innerR = radius * 0.685;
    const shoulderR = radius * 0.948;
    const pts = [
      new THREE.Vector2(innerR, -hw * 0.89),
      new THREE.Vector2(radius * 0.81, -hw),
      new THREE.Vector2(shoulderR, -hw * 0.94),
      new THREE.Vector2(radius * 0.955, -hw * 0.84),
      new THREE.Vector2(innerR, -hw * 0.84),
    ];
    const geo = new THREE.LatheGeometry(pts, 36);
    geo.rotateZ(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

function getDrilledRotorDiscGeo(rInner: number, rOuter: number): THREE.BufferGeometry {
  return cachedCamaroGeo(`cam_drilled_disc_${rInner.toFixed(3)}_${rOuter.toFixed(3)}`, () => {
    const geo = new THREE.RingGeometry(rInner, rOuter, 36, 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const py = pos.getY(i);
      const rad = Math.hypot(px, py);
      const ang = (Math.atan2(py, px) + Math.PI * 2) % (Math.PI * 2);
      const sectorFrac = (ang % (Math.PI / 3)) / (Math.PI / 3);
      const radFrac = THREE.MathUtils.clamp((rad - rInner) / (rOuter - rInner), 0, 1);
      uv.setXY(i, 0.08 + sectorFrac * 0.49, 0.40 + radFrac * 0.56);
    }
    uv.needsUpdate = true;
    geo.rotateY(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  });
}

function getTrapezoidTaillightGeo(wTop: number, wBot: number, h: number, depth: number): THREE.BufferGeometry {
  return cachedCamaroGeo(`cam_trap_v2_${wTop}_${wBot}_${h}_${depth}`, () => {
    const shape = new THREE.Shape();
    shape.moveTo(-wTop * 0.5, h * 0.5);
    shape.lineTo(wTop * 0.5, h * 0.5);
    shape.lineTo(wBot * 0.5, -h * 0.5);
    shape.lineTo(-wBot * 0.5, -h * 0.5);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.005,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -depth * 0.5);
    geo.computeVertexNormals();
    return geo;
  });
}

function getChevroletBowtieOuterGeo(w: number, h: number, depth: number): THREE.BufferGeometry {
  return cachedCamaroGeo(`cam_bowtie_out_${w}_${h}_${depth}`, () => {
    const hw = w * 0.5;
    const hh = h * 0.5;
    const cw = w * 0.19;
    const ch = h * 0.82;
    const s = new THREE.Shape();
    s.moveTo(-hw, hh * 0.54);
    s.lineTo(-cw, hh * 0.54);
    s.lineTo(-cw, ch);
    s.lineTo(cw, ch);
    s.lineTo(cw, hh * 0.54);
    s.lineTo(hw, hh * 0.54);
    s.lineTo(hw * 0.86, -hh * 0.54);
    s.lineTo(cw, -hh * 0.54);
    s.lineTo(cw, -ch);
    s.lineTo(-cw, -ch);
    s.lineTo(-cw, -hh * 0.54);
    s.lineTo(-hw * 0.86, -hh * 0.54);
    s.closePath();

    const geo = new THREE.ExtrudeGeometry(s, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 2,
    });
    geo.translate(0, 0, -depth * 0.5);
    geo.computeVertexNormals();
    return geo;
  });
}

// ---------------------------------------------------------------------------
// Main Watertight 2010–2012 Chevrolet Camaro SS Builder
// ---------------------------------------------------------------------------

export function buildCamaroSSModel(
  spec: VehicleSpec,
  group: THREE.Group,
  bodyGroup: THREE.Group,
  mats: CamaroMaterialsInput,
): CamaroBuildResult {
  const tex = getCamaroTextures();

  const wheelNodes: WheelNode[] = [];
  const wheelMeshes: THREE.Object3D[] = [];
  const frontSteerPivots: THREE.Object3D[] = [];

  // Rich Saturated Bumblebee Golden-Yellow Paint (holds deep amber-gold hue under bright ACES daylight; preserves Garage repaints)
  const basePaintColor = new THREE.Color(0xd98600);
  if ('color' in mats.paintMat && (mats.paintMat as THREE.MeshPhysicalMaterial).color) {
    basePaintColor.copy((mats.paintMat as THREE.MeshPhysicalMaterial).color);
    if (
      basePaintColor.getHex() === 0xffb800 ||
      basePaintColor.getHex() === 0xea9600 ||
      basePaintColor.getHex() === 0xf2a700 ||
      basePaintColor.getHex() === 0xdf8800 ||
      basePaintColor.getHex() === 0xdc8500 ||
      basePaintColor.getHex() === 0xefa200 ||
      basePaintColor.getHex() === 0xe49200
    ) {
      basePaintColor.setHex(0xd98600);
    }
  }

  const sidePaintMat = new THREE.MeshPhysicalMaterial({
    color: basePaintColor,
    map: tex.paintSide,
    roughnessMap: tex.flakeRough,
    normalMap: tex.flakeNormal,
    normalScale: new THREE.Vector2(0.015, 0.015),
    metalness: 0.18,
    roughness: 0.26,
    clearcoat: 0.88,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.58,
  });

  const topPaintMat = new THREE.MeshPhysicalMaterial({
    color: basePaintColor,
    map: tex.paintTop,
    roughnessMap: tex.flakeRough,
    normalMap: tex.flakeNormal,
    normalScale: new THREE.Vector2(0.015, 0.015),
    metalness: 0.18,
    roughness: 0.26,
    clearcoat: 0.88,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.58,
  });

  const endPaintMat = new THREE.MeshPhysicalMaterial({
    color: basePaintColor,
    map: tex.paintEnd,
    roughnessMap: tex.flakeRough,
    normalMap: tex.flakeNormal,
    normalScale: new THREE.Vector2(0.015, 0.015),
    metalness: 0.18,
    roughness: 0.26,
    clearcoat: 0.88,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.58,
  });

  const yellowUniformMat = new THREE.MeshPhysicalMaterial({
    color: basePaintColor,
    roughnessMap: tex.flakeRough,
    normalMap: tex.flakeNormal,
    normalScale: new THREE.Vector2(0.015, 0.015),
    metalness: 0.18,
    roughness: 0.26,
    clearcoat: 0.88,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.58,
  });

  // Dark Obsidian Smoked Tinted Glass (toggled transparent in cockpit view via userData)
  const camaroGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x050608,
    metalness: 0.08,
    roughness: 0.03,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    envMapIntensity: 1.8,
  });
  bodyGroup.userData.camaroGlassMat = camaroGlassMat;

  const lensCoverGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0d14,
    metalness: 0.06,
    roughness: 0.03,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    envMapIntensity: 1.5,
  });

  const camaroTreadMat = new THREE.MeshStandardMaterial({
    map: tex.tireTread,
    normalMap: tex.tireTreadNormal,
    normalScale: new THREE.Vector2(1.4, 1.4),
    color: 0xffffff,
    roughness: 0.82,
    metalness: 0.04,
  });

  const camaroSidewallMat = new THREE.MeshStandardMaterial({
    color: 0x16181d,
    roughness: 0.78,
    metalness: 0.04,
  });

  const camaroRotorMat = new THREE.MeshStandardMaterial({
    map: tex.rotorDiff,
    normalMap: tex.rotorNormal,
    normalScale: new THREE.Vector2(1.1, 1.1),
    color: 0xd4d9e2,
    roughness: 0.28,
    metalness: 0.84,
    side: THREE.DoubleSide,
  });

  const camaroCaliperMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    normalMap: tex.caliperNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    metalnessMap: tex.caliperMetal,
    metalness: 0.45,
    roughness: 0.24,
    clearcoat: 0.85,
  });

  const camaroCarbonMat = new THREE.MeshPhysicalMaterial({
    map: tex.carbonDiff,
    normalMap: tex.carbonNormal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    color: 0xffffff,
    roughness: 0.36,
    metalness: 0.16,
    clearcoat: 0.72,
    clearcoatRoughness: 0.14,
  });

  const honeycombMat = new THREE.MeshStandardMaterial({
    map: tex.honeycomb,
    normalMap: tex.grilleNormal,
    normalScale: new THREE.Vector2(0.65, 0.65),
    color: 0x14171d,
    roughness: 0.80,
    metalness: 0.10,
    envMapIntensity: 0.15,
  });

  const goldBowtieMat = new THREE.MeshPhysicalMaterial({
    color: 0xd99b08,
    roughness: 0.22,
    metalness: 0.88,
    clearcoat: 0.9,
  });

  const haloRingMat = new THREE.MeshStandardMaterial({
    color: 0x260200,
    emissive: 0xff2800,
    emissiveIntensity: 2.6,
    roughness: 0.14,
  });

  const chinGlowMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xb45309,
    emissiveIntensity: 0.85,
    roughness: 0.32,
  });

  const haloCollarMat = new THREE.MeshStandardMaterial({
    color: 0x06080c,
    roughness: 0.38,
    metalness: 0.55,
  });

  const projectorEyeMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0e16,
    emissive: mats.headlightMat.emissive,
    emissiveIntensity: 0.14,
    metalness: 0.35,
    roughness: 0.08,
    clearcoat: 1.0,
  });

  const taillightJewelMat = new THREE.MeshStandardMaterial({
    map: tex.taillightLens,
    color: 0xffffff,
    emissive: 0x550000,
    emissiveIntensity: 0.85,
    roughness: 0.14,
    metalness: 0.22,
  });

  const underbodyMat = new THREE.MeshStandardMaterial({
    color: 0x14171c,
    normalMap: tex.chassisNormal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 0.72,
    metalness: 0.32,
  });

  const machinedAlloyMat = new THREE.MeshStandardMaterial({
    color: 0xd9dfe8,
    roughness: 0.18,
    metalness: 0.92,
    envMapIntensity: 1.15,
  });

  const glossBlackMat = new THREE.MeshPhysicalMaterial({
    color: 0x080a0e,
    roughness: 0.22,
    metalness: 0.20,
    clearcoat: 0.75,
    envMapIntensity: 0.50,
  });

  const wheelBlackSpokeMat = new THREE.MeshPhysicalMaterial({
    color: 0x07080b,
    roughness: 0.32,
    metalness: 0.16,
    clearcoat: 0.35,
    envMapIntensity: 0.34,
  });

  // -------------------------------------------------------------------------
  // 0. 20" 5-Spoke Two-Tone Wheels + Drilled Brake Discs + Brembo Calipers
  // -------------------------------------------------------------------------
  const wheelX = 0.902;
  const addCamaroWheel = (wx: number, wy: number, wz: number, isFront: boolean, width: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(wx, wy, wz);
    const wheelObj = new THREE.Group();
    if (wx < 0) wheelObj.rotation.y = Math.PI;

    const r = WHEEL_R;

    const tireTreadMesh = new THREE.Mesh(getCamaroTireTreadGeo(r, width), camaroTreadMat);
    tireTreadMesh.castShadow = true;
    wheelObj.add(tireTreadMesh);

    const sideGeo = getCamaroTireSidewallGeo(r, width);
    const outerSide = new THREE.Mesh(sideGeo, camaroSidewallMat);
    outerSide.rotation.y = Math.PI;
    wheelObj.add(outerSide);

    const innerSide = new THREE.Mesh(sideGeo, camaroSidewallMat);
    wheelObj.add(innerSide);

    const outerLipGeo = cachedCamaroGeo(`cam_olip_v3_${r.toFixed(3)}`, () => {
      const g = new THREE.TorusGeometry(r * 0.668, 0.022, 10, 36);
      g.rotateY(Math.PI / 2);
      return g;
    });
    const outerLip = new THREE.Mesh(outerLipGeo, machinedAlloyMat);
    outerLip.position.x = width * 0.435;
    wheelObj.add(outerLip);

    const barrelGeo = cachedCamaroGeo(`cam_bar_v3_${r.toFixed(3)}_${width.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.678, r * 0.678, width * 0.84, 32, 1, true);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const barrel = new THREE.Mesh(barrelGeo, machinedAlloyMat);
    wheelObj.add(barrel);

    const innerBackGeo = cachedCamaroGeo(`cam_rback_v3_${r.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.655, r * 0.655, 0.026, 28);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const innerBack = new THREE.Mesh(innerBackGeo, glossBlackMat);
    innerBack.position.x = -width * 0.18;
    wheelObj.add(innerBack);

    const stepRingGeo = cachedCamaroGeo(`cam_sring_v3_${r.toFixed(3)}`, () => {
      const g = new THREE.RingGeometry(r * 0.568, r * 0.664, 36);
      g.rotateY(Math.PI / 2);
      return g;
    });
    const stepRing = new THREE.Mesh(stepRingGeo, machinedAlloyMat);
    stepRing.position.x = width * 0.365;
    wheelObj.add(stepRing);

    const boltGeo = cachedCamaroGeo('cam_bolt_v2', () => new THREE.BoxGeometry(0.016, 0.014, 0.020));
    for (let s = 0; s < 5; s++) {
      const bayCenter = ((s + 0.5) / 5) * Math.PI * 2;
      for (const dAng of [-0.075, 0.075]) {
        const a = bayCenter + dAng;
        const bolt = new THREE.Mesh(boltGeo, mats.trimMat);
        bolt.position.set(width * 0.372, Math.cos(a) * r * 0.616, Math.sin(a) * r * 0.616);
        bolt.rotation.x = a;
        wheelObj.add(bolt);
      }
    }

    const silverBackingGeo = getCamaroSpokeBackingGeo(r);
    const blackFaceGeo = getCamaroSpokeFaceGeo(r);
    const outerFaceX = width * 0.39;
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2;
      const silverSpoke = new THREE.Mesh(silverBackingGeo, machinedAlloyMat);
      silverSpoke.position.x = outerFaceX - 0.008;
      silverSpoke.rotation.x = a;
      wheelObj.add(silverSpoke);

      const blackSpoke = new THREE.Mesh(blackFaceGeo, wheelBlackSpokeMat);
      blackSpoke.position.x = outerFaceX + 0.009;
      blackSpoke.rotation.x = a;
      wheelObj.add(blackSpoke);
    }

    const hubGeo = cachedCamaroGeo(`cam_hub_v3_${r.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.168, r * 0.184, 0.056, 20);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const hub = new THREE.Mesh(hubGeo, wheelBlackSpokeMat);
    hub.position.x = outerFaceX + 0.008;
    wheelObj.add(hub);

    const lugGeo = cachedCamaroGeo('cam_lug', () => {
      const g = new THREE.CylinderGeometry(0.007, 0.007, 0.014, 6);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    for (let l = 0; l < 5; l++) {
      const la = (l / 5) * Math.PI * 2 + Math.PI / 5;
      const lug = new THREE.Mesh(lugGeo, machinedAlloyMat);
      lug.position.set(outerFaceX + 0.036, Math.cos(la) * r * 0.105, Math.sin(la) * r * 0.105);
      wheelObj.add(lug);
    }

    const sign = wx >= 0 ? 1 : -1;
    const rotorDisc = new THREE.Mesh(getDrilledRotorDiscGeo(r * 0.22, r * 0.53), camaroRotorMat);
    rotorDisc.position.x = sign * width * 0.12;
    pivot.add(rotorDisc);

    const rotorHatGeo = cachedCamaroGeo(`cam_rhat_${r.toFixed(3)}`, () => {
      const g = new THREE.CylinderGeometry(r * 0.23, r * 0.24, 0.05, 18);
      g.rotateZ(Math.PI / 2);
      return g;
    });
    const rotorHat = new THREE.Mesh(rotorHatGeo, mats.darkAlloyMat);
    rotorHat.position.x = sign * width * 0.11;
    pivot.add(rotorHat);

    const caliperGeo = cachedCamaroGeo(`cam_cal_v2_${r.toFixed(3)}`, () => {
      const s = new THREE.Shape();
      s.absarc(0, 0, r * 0.555, -0.45, 0.45, false);
      s.absarc(0, 0, r * 0.365, 0.45, -0.45, true);
      s.closePath();
      const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.072,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.008,
        bevelSegments: 2,
        curveSegments: 12,
      });
      g.translate(0, 0, -0.036);
      g.rotateY(Math.PI / 2);
      g.computeVertexNormals();
      return g;
    });
    const caliper = new THREE.Mesh(caliperGeo, camaroCaliperMat);
    caliper.position.set(sign * width * 0.13, 0, 0);
    caliper.rotation.x = isFront ? 0.55 : -2.55;
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

  addCamaroWheel(-wheelX, WHEEL_R, WHEEL_Z, true, 0.30);
  addCamaroWheel(wheelX, WHEEL_R, WHEEL_Z, true, 0.30);
  addCamaroWheel(-wheelX, WHEEL_R, -WHEEL_Z, false, 0.33);
  addCamaroWheel(wheelX, WHEEL_R, -WHEEL_Z, false, 0.33);

  // -------------------------------------------------------------------------
  // 1. Watertight Sculpted Left & Right Side Body Shells + Stitched Wheel-Well Liners
  // -------------------------------------------------------------------------
  const sideStationsZ: number[] = [
    FRONT_JOIN_Z, 1.97, 1.918,
    1.86, 1.76, 1.63, 1.48, 1.33, 1.20, 1.10, 1.042,
    0.85, 0.56, 0.28, 0.0, -0.35, -0.70, -0.95,
    -1.042, -1.10, -1.20, -1.33, -1.48, -1.63, -1.76, -1.86,
    -1.918, -2.02, -2.10, REAR_JOIN_Z,
  ];
  const crossProfileT = [0.0, 0.16, 0.38, 0.62, 0.80, 0.92, 1.0];

  for (const side of [-1, 1] as const) {
    const sideGeo = cachedCamaroGeo(`camaro_side_wt_v1_${side}`, () => {
      const grid: THREE.Vector3[][] = [];
      const uvGrid: THREE.Vector2[][] = [];
      for (const z of sideStationsZ) {
        const yBot = sideBottomY(z);
        const yTop = beltlineY(z);
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
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(side, 0.15, 0), uvGrid);
    });
    const sideMesh = new THREE.Mesh(sideGeo, sidePaintMat);
    sideMesh.castShadow = true;
    sideMesh.receiveShadow = true;
    bodyGroup.add(sideMesh);

    // Flush Stitched Inner Wheel-Well Liners (shares exact outer arch coordinates with sideMesh!)
    for (const wz of [WHEEL_Z, -WHEEL_Z]) {
      const archWellGeo = cachedCamaroGeo(`camaro_arch_liner_${side}_${wz > 0 ? 'f' : 'r'}`, () => {
        const nz = 20;
        const grid: THREE.Vector3[][] = [[], []];
        for (let i = 0; i <= nz; i++) {
          const ang = THREE.MathUtils.lerp(Math.PI, 0, i / nz);
          const z = wz + Math.cos(ang) * ARCH_R;
          const y = WHEEL_R + Math.sin(ang) * ARCH_R;
          const xOuter = side * sideSectionX(bodyHalfW(z), 0, z);
          const xInner = side * (wheelX - 0.24);
          grid[0].push(new THREE.Vector3(xOuter, y, z));
          grid[1].push(new THREE.Vector3(xInner, y - 0.015, z));
        }
        return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, -1, 0));
      });
      const archWell = new THREE.Mesh(archWellGeo, mats.trimMat);
      bodyGroup.add(archWell);
    }

    // Sleek Low-Profile Lower Rocker Skirt Trim (tucked flush along rocker)
    const sill = new THREE.Mesh(
      cachedCamaroGeo('camaro_sill_v3', () => new THREE.BoxGeometry(0.08, 0.042, 2.04)),
      camaroCarbonMat,
    );
    sill.position.set(side * 0.905, 0.175, 0);
    bodyGroup.add(sill);

    // Brushed Silver Door Handle (tucked cleanly flush on door panel)
    const handle = new THREE.Mesh(
      cachedCamaroGeo('camaro_handle_v3', () => new THREE.BoxGeometry(0.026, 0.032, 0.145)),
      machinedAlloyMat,
    );
    handle.position.set(side * 1.005, 0.742, -0.26);
    bodyGroup.add(handle);

    // Fender "CAMARO" Lettering + Lower Autobot Emblem (flush against door/fender wall)
    const badgePlane = new THREE.Mesh(
      cachedCamaroGeo('camaro_badge_plane', () => new THREE.PlaneGeometry(0.26, 0.062)),
      new THREE.MeshBasicMaterial({ map: tex.camaroBadge, transparent: true, depthWrite: false }),
    );
    badgePlane.position.set(side * 1.012, 0.655, 0.88);
    badgePlane.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    bodyGroup.add(badgePlane);

    const autoPlane = new THREE.Mesh(
      cachedCamaroGeo('camaro_auto_plane', () => new THREE.PlaneGeometry(0.058, 0.058)),
      new THREE.MeshBasicMaterial({ map: tex.autobotBadge, transparent: true, depthWrite: false }),
    );
    autoPlane.position.set(side * 1.008, 0.425, 0.82);
    autoPlane.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    bodyGroup.add(autoPlane);

    // Front Amber & Rear Red Side-Marker Reflectors
    const frontMarker = new THREE.Mesh(
      cachedCamaroGeo('cam_marker', () => new THREE.BoxGeometry(0.014, 0.018, 0.105)),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xb45309, emissiveIntensity: 0.4, roughness: 0.2 }),
    );
    frontMarker.position.set(side * 0.968, 0.61, 1.94);
    bodyGroup.add(frontMarker);

    const rearMarker = new THREE.Mesh(
      cachedCamaroGeo('cam_marker_r', () => new THREE.BoxGeometry(0.014, 0.018, 0.12)),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x991b1b, emissiveIntensity: 0.4, roughness: 0.2 }),
    );
    rearMarker.position.set(side * 1.002, 0.655, -2.02);
    bodyGroup.add(rearMarker);

    // Sleek Tapered Tear-Drop Aerodynamic Side Mirror (3_110bdf47.webp)
    const mStalk = new THREE.Mesh(
      cachedCamaroGeo('cam_mstalk_v2', () => new THREE.BoxGeometry(0.10, 0.022, 0.032)),
      yellowUniformMat,
    );
    mStalk.position.set(side * 0.915, 0.848, 0.43);
    mStalk.rotation.z = side * 0.16;
    bodyGroup.add(mStalk);

    const mShellGeo = cachedCamaroGeo(`cam_mshell_v3_${side}`, () => {
      const grid: THREE.Vector3[][] = [
        [
          new THREE.Vector3(side * 0.945, 0.858, 0.452),
          new THREE.Vector3(side * 1.02, 0.86, 0.428),
          new THREE.Vector3(side * 1.095, 0.864, 0.395),
        ],
        [
          new THREE.Vector3(side * 0.945, 0.888, 0.442),
          new THREE.Vector3(side * 1.025, 0.892, 0.412),
          new THREE.Vector3(side * 1.095, 0.888, 0.382),
        ],
        [
          new THREE.Vector3(side * 0.945, 0.87, 0.382),
          new THREE.Vector3(side * 1.02, 0.874, 0.362),
          new THREE.Vector3(side * 1.095, 0.872, 0.352),
        ],
      ];
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.6, 0.8));
    });
    const mShell = new THREE.Mesh(mShellGeo, yellowUniformMat);
    mShell.castShadow = true;
    bodyGroup.add(mShell);

    const mGlass = new THREE.Mesh(
      cachedCamaroGeo('cam_mglass', () => new THREE.PlaneGeometry(0.105, 0.034)),
      mats.chromeMat,
    );
    mGlass.position.set(side * 1.02, 0.874, 0.360);
    mGlass.rotation.y = Math.PI + side * -0.22;
    bodyGroup.add(mGlass);
  }

  // Round Black Fuel Cap on Left (+X) Rear Quarter Deck (matches 5_7244386f.webp)
  const fuelCap = new THREE.Mesh(
    cachedCamaroGeo('camaro_fuelcap', () => new THREE.CylinderGeometry(0.064, 0.064, 0.014, 20)),
    mats.trimMat,
  );
  fuelCap.position.set(0.75, 0.942, -1.68);
  fuelCap.rotation.z = -0.18;
  bodyGroup.add(fuelCap);

  // -------------------------------------------------------------------------
  // 2. Watertight Sculpted Hood (Stitched to Side Shoulders + Front Nose Brow)
  // -------------------------------------------------------------------------
  const hoodGeo = cachedCamaroGeo('camaro_hood_wt_v2', () => {
    const nz = 22;
    const nx = 24;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const zFrac = iz / nz;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const zEnd = frontBrowZ(u);
        const z = THREE.MathUtils.lerp(0.56, zEnd, zFrac);
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

  // Flush Camaro SS Mail-Slot Front Hood Intake (4_1f3286b3.webp & camaro-1_272dea49.webp)
  const scoopPocket = new THREE.Mesh(
    cachedCamaroGeo('camaro_mailslot_mouth_v10', () => new THREE.BoxGeometry(0.42, 0.020, 0.048)),
    mats.trimMat,
  );
  scoopPocket.position.set(0, 0.722, 2.302);
  scoopPocket.rotation.x = 0.08;
  bodyGroup.add(scoopPocket);

  const scoopRim = new THREE.Mesh(
    cachedCamaroGeo('camaro_mailslot_rim_v5', () => new THREE.BoxGeometry(0.46, 0.018, 0.038)),
    yellowUniformMat,
  );
  scoopRim.position.set(0, 0.735, 2.290);
  scoopRim.rotation.x = 0.16;
  bodyGroup.add(scoopRim);

  // Slim Flush Windshield Cowl + Wipers (Tucked cleanly at base of windshield)
  const cowl = new THREE.Mesh(
    cachedCamaroGeo('camaro_cowl_v5', () => new THREE.BoxGeometry(1.56, 0.014, 0.060)),
    mats.trimMat,
  );
  cowl.position.set(0, 0.822, 0.556);
  bodyGroup.add(cowl);

  for (const wx of [-0.34, 0.24]) {
    const wiper = new THREE.Mesh(
      cachedCamaroGeo('cam_wiper_v2', () => new THREE.BoxGeometry(0.50, 0.010, 0.018)),
      mats.trimMat,
    );
    wiper.position.set(wx, 0.834, 0.555);
    wiper.rotation.y = 0.09;
    wiper.rotation.z = 0.03;
    bodyGroup.add(wiper);
  }

  // -------------------------------------------------------------------------
  // 3. Single-Piece Watertight Wrap-Around Front Fascia + Zero-Clip Grille & Fog Pockets
  // -------------------------------------------------------------------------
  const frontFasciaGeo = cachedCamaroGeo('camaro_front_fascia_wt_v3', () => {
    const nx = 64;
    const ny = 24;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];

    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];

      const xFrontJoin = bodyHalfW(FRONT_JOIN_Z);
      const outerSideX = sideSectionX(xFrontJoin, vf, FRONT_JOIN_Z);

      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const x = u * outerSideX;

        const zBase = frontBrowZ(u);
        const yBot = sideBottomY(zBase);
        const yTop = hoodSurfaceY(THREE.MathUtils.clamp(x, -sideTopEdgeX(zBase), sideTopEdgeX(zBase)), zBase);
        const y = THREE.MathUtils.lerp(yBot, yTop, vf);

        const edgeFade = 1 - Math.pow(Math.abs(u), 3.0);
        const bumperBulge = 0.022 * Math.sin(smoothstep(0.28, 0.58, vf) * Math.PI) * edgeFade;

        // Deep flat-bottomed upper grille + headlight cavity (strictly encloses upperGrille & halo pods)
        const inUpperX = 1 - smoothstep(0.735, 0.795, Math.abs(x));
        const inUpperY = smoothstep(0.490, 0.518, y) * (1 - smoothstep(0.665, 0.692, y));
        const upperPocket = -0.095 * inUpperX * inUpperY;

        // Deep flat-bottomed lower grille intake cavity
        const xLowerMax = THREE.MathUtils.lerp(0.475, 0.415, smoothstep(0.22, 0.36, y));
        const inLowerX = 1 - smoothstep(xLowerMax - 0.042, xLowerMax, Math.abs(x));
        const inLowerY = smoothstep(0.225, 0.250, y) * (1 - smoothstep(0.345, 0.372, y));
        const lowerPocket = -0.088 * inLowerX * inLowerY;

        // Recessed circular pockets for fog lamp pods
        const fogDist = Math.hypot(Math.abs(x) - 0.615, (y - 0.305) * 1.05);
        const fogPocket = -0.030 * (1 - smoothstep(0.055, 0.085, fogDist));

        const z = zBase + bumperBulge + upperPocket + lowerPocket + fogPocket;
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

  // Recessed Dark Upper Grille Mesh (strictly inside flat floor of upperPocket, zero triangle clipping)
  const upperGrilleGeo = cachedCamaroGeo('camaro_upper_grille_wt_v3', () => {
    const nx = 24;
    const ny = 4;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const y = THREE.MathUtils.lerp(0.514, 0.668, vf);
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const uf = ix / nx;
        const x = (uf * 2 - 1) * 0.735;
        const z = frontSurfaceZ(x, 0.960) - 0.052;
        row.push(new THREE.Vector3(x, y, z));
        uRow.push(new THREE.Vector2(uf, vf));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0, 1), uvGrid);
  });
  const upperGrille = new THREE.Mesh(upperGrilleGeo, honeycombMat);
  bodyGroup.add(upperGrille);

  // Upper Grille Slats & Center Horizontal Bar (4_1f3286b3.webp)
  for (const gx of [-0.36, -0.18, 0, 0.18, 0.36]) {
    const slat = new THREE.Mesh(
      cachedCamaroGeo('cam_grille_slat_v2', () => new THREE.BoxGeometry(0.015, 0.146, 0.018)),
      glossBlackMat,
    );
    slat.position.set(gx, 0.591, frontSurfaceZ(gx, 0.960) - 0.042);
    bodyGroup.add(slat);
  }
  // V-Contoured Upper Grille Horizontal Bar (hugs frontSurfaceZ cleanly with zero straight-box protrusion)
  const midBarGeo = cachedCamaroGeo('cam_grille_hbar_v3', () => {
    const nx = 16;
    const grid: THREE.Vector3[][] = [[], [], []];
    for (let ix = 0; ix <= nx; ix++) {
      const x = ((ix / nx) * 2 - 1) * 0.50;
      const zFront = frontSurfaceZ(x, 0.960) - 0.036;
      const zBack = zFront - 0.018;
      grid[0].push(new THREE.Vector3(x, 0.583, zFront));
      grid[1].push(new THREE.Vector3(x, 0.599, zFront));
      grid[2].push(new THREE.Vector3(x, 0.599, zBack));
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.2, 1));
  });
  const midBar = new THREE.Mesh(midBarGeo, glossBlackMat);
  bodyGroup.add(midBar);

  // Recessed Round Halo Projector Headlights Inside Outer Upper Grille Pocket (aligned outward to V-nose tangent!)
  for (const side of [-1, 1] as const) {
    const eyeX = side * 0.618;
    const eyeZ = frontSurfaceZ(eyeX, 0.960) - 0.044;
    const eyeYaw = side * 0.28;

    const eyeBucket = new THREE.Mesh(
      cachedCamaroGeo('cam_eye_bucket_v5', () => {
        const g = new THREE.CylinderGeometry(0.080, 0.070, 0.044, 24);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      glossBlackMat,
    );
    eyeBucket.rotation.y = eyeYaw;
    eyeBucket.position.set(eyeX, 0.591, eyeZ - 0.012);
    bodyGroup.add(eyeBucket);

    const haloRing = new THREE.Mesh(
      cachedCamaroGeo('cam_halo_ring_v6', () => new THREE.TorusGeometry(0.068, 0.009, 10, 28)),
      haloRingMat,
    );
    haloRing.position.set(eyeX, 0.591, eyeZ + 0.010);
    haloRing.rotation.y = eyeYaw;
    bodyGroup.add(haloRing);

    const innerCollar = new THREE.Mesh(
      cachedCamaroGeo('cam_eye_collar_v7', () => new THREE.RingGeometry(0.032, 0.061, 22)),
      haloCollarMat,
    );
    innerCollar.position.set(eyeX, 0.591, eyeZ + 0.007);
    innerCollar.rotation.y = eyeYaw;
    bodyGroup.add(innerCollar);

    const projectorLens = new THREE.Mesh(
      cachedCamaroGeo('cam_proj_lens_v7', () => new THREE.SphereGeometry(0.032, 16, 12)),
      projectorEyeMat,
    );
    projectorLens.scale.set(1, 1, 0.52);
    projectorLens.position.set(eyeX, 0.591, eyeZ + 0.006);
    bodyGroup.add(projectorLens);

    const hlGlassCover = new THREE.Mesh(
      cachedCamaroGeo('cam_hl_glass_v3', () => new THREE.CircleGeometry(0.080, 24)),
      lensCoverGlassMat,
    );
    hlGlassCover.position.set(eyeX, 0.591, eyeZ + 0.018);
    hlGlassCover.rotation.y = eyeYaw;
    hlGlassCover.renderOrder = 3;
    bodyGroup.add(hlGlassCover);

    const fTurn = new THREE.Mesh(
      cachedCamaroGeo('cam_fturn_v2', () => new THREE.BoxGeometry(0.030, 0.016, 0.016)),
      side > 0 ? mats.turnLeftMat : mats.turnRightMat,
    );
    fTurn.position.set(side * 0.692, 0.542, eyeZ - 0.004);
    fTurn.rotation.y = eyeYaw;
    bodyGroup.add(fTurn);
  }

  // Front 3D Beveled Gold + Chrome Chevrolet Bowtie Emblem
  const frontBowGroup = new THREE.Group();
  frontBowGroup.position.set(0, 0.592, frontSurfaceZ(0, 0.960) - 0.022);
  const fBowChrome = new THREE.Mesh(getChevroletBowtieOuterGeo(0.240, 0.090, 0.022), mats.chromeMat);
  const fBowGold = new THREE.Mesh(getChevroletBowtieOuterGeo(0.218, 0.074, 0.028), goldBowtieMat);
  fBowGold.position.z = 0.004;
  frontBowGroup.add(fBowChrome, fBowGold);
  bodyGroup.add(frontBowGroup);

  // Recessed Lower Honeycomb Grille
  const lowerGrilleGeo = cachedCamaroGeo('camaro_lower_grille_wt_v2', () => {
    const nx = 16;
    const ny = 3;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const y = THREE.MathUtils.lerp(0.248, 0.348, vf);
      const halfSpan = THREE.MathUtils.lerp(0.435, 0.382, vf);
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const uf = ix / nx;
        const x = (uf * 2 - 1) * halfSpan;
        const z = frontSurfaceZ(x, 0.916) - 0.044;
        row.push(new THREE.Vector3(x, y, z));
        uRow.push(new THREE.Vector2(uf, vf));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0, 1), uvGrid);
  });
  const lowerGrille = new THREE.Mesh(lowerGrilleGeo, honeycombMat);
  bodyGroup.add(lowerGrille);

  // Subtle Dark Underbody Chin Tray (tucked cleanly behind yellow front lower lip, zero overhang)
  const frontSplitterGeo = cachedCamaroGeo('camaro_front_splitter_v4', () => {
    const nx = 20;
    const grid: THREE.Vector3[][] = [[], []];
    for (let ix = 0; ix <= nx; ix++) {
      const u = (ix / nx) * 2 - 1;
      const x = u * 0.78;
      const zFront = frontSurfaceZ(x, 0.880) - 0.025;
      grid[0].push(new THREE.Vector3(x, 0.192, zFront - 0.16));
      grid[1].push(new THREE.Vector3(x, 0.192, zFront));
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 1, 0));
  });
  const frontSplitter = new THREE.Mesh(frontSplitterGeo, camaroCarbonMat);
  bodyGroup.add(frontSplitter);

  // Flush Recessed Fog Lamp Pods + Curved Lower Chin Strakes (aligned cleanly outward along cheek tangent!)
  for (const side of [-1, 1] as const) {
    const fx = side * 0.615;
    const fz = frontSurfaceZ(fx, 0.916) - 0.016;
    const fy = 0.305;
    const fYaw = side * 0.32;

    const fogBezel = new THREE.Mesh(
      cachedCamaroGeo('cam_fog_bezel_v6', () => {
        const g = new THREE.CylinderGeometry(0.060, 0.054, 0.032, 22);
        g.rotateX(Math.PI / 2);
        return g;
      }),
      glossBlackMat,
    );
    fogBezel.rotation.y = fYaw;
    fogBezel.position.set(fx, fy, fz - 0.004);
    bodyGroup.add(fogBezel);

    const fogChromeRing = new THREE.Mesh(
      cachedCamaroGeo('cam_fog_cring_v4', () => new THREE.TorusGeometry(0.046, 0.006, 8, 20)),
      machinedAlloyMat,
    );
    fogChromeRing.position.set(fx, fy, fz + 0.009);
    fogChromeRing.rotation.y = fYaw;
    bodyGroup.add(fogChromeRing);

    const fogLens = new THREE.Mesh(
      cachedCamaroGeo('cam_fog_lens_v5', () => new THREE.SphereGeometry(0.040, 14, 10)),
      projectorEyeMat,
    );
    fogLens.scale.set(1, 1, 0.45);
    fogLens.position.set(fx, fy, fz + 0.003);
    bodyGroup.add(fogLens);

    for (const sy of [0.228, 0.246]) {
      const sx = side * 0.605;
      const sz = frontSurfaceZ(sx, 0.896) - 0.004;
      const strake = new THREE.Mesh(
        cachedCamaroGeo('cam_chin_strake_v2', () => new THREE.BoxGeometry(0.115, 0.009, 0.014)),
        chinGlowMat,
      );
      strake.position.set(sx, sy, sz);
      strake.rotation.y = side * 0.34;
      bodyGroup.add(strake);
    }
  }

  // -------------------------------------------------------------------------
  // 4. Seamless Fastback Greenhouse (Roof + Continuous A/C Pillars + Flush Glass)
  // -------------------------------------------------------------------------
  const roofGeo = cachedCamaroGeo('camaro_roof_wt_v1', () => {
    const nz = 12;
    const nx = 14;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const zFrac = iz / nz;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const x = u * 0.69;
        const z = THREE.MathUtils.lerp(roofRearZ(x), roofFrontZ(x), zFrac);
        row.push(new THREE.Vector3(x, roofSurfaceY(x, z), z));
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

  // Curved Dark Obsidian Tinted Windshield (Tucked cleanly inside A-pillars & roof header)
  const windshieldGeo = cachedCamaroGeo('camaro_windshield_wt_v3', () => {
    const nz = 8;
    const nx = 14;
    const grid: THREE.Vector3[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const vf = iz / nz;
      const row: THREE.Vector3[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const halfSpan = THREE.MathUtils.lerp(0.790, 0.674, vf);
        const x = u * halfSpan;
        const zBot = 0.554 + 0.024 * (1 - u * u);
        const zTop = roofFrontZ(x) - 0.004;
        const yBot = 0.820;
        const yTop = roofSurfaceY(x, zTop) - 0.005;
        row.push(new THREE.Vector3(x, THREE.MathUtils.lerp(yBot, yTop, vf), THREE.MathUtils.lerp(zBot, zTop, vf)));
      }
      grid.push(row);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.65, 0.76));
  });
  const windshield = new THREE.Mesh(windshieldGeo, camaroGlassMat);
  windshield.renderOrder = 3;
  bodyGroup.add(windshield);

  // Curved Fastback Rear Window Glass (Tucked cleanly inside C-pillars & trunk deck)
  const rearGlassGeo = cachedCamaroGeo('camaro_rearglass_wt_v2', () => {
    const nz = 8;
    const nx = 14;
    const grid: THREE.Vector3[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const vf = iz / nz;
      const row: THREE.Vector3[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const halfSpan = THREE.MathUtils.lerp(0.692, 0.664, vf);
        const x = u * halfSpan;
        const zBot = -1.515 - 0.010 * (1 - u * u);
        const zTop = roofRearZ(x) + 0.004;
        const yBot = trunkSurfaceY(x, zBot) - 0.005;
        const yTop = roofSurfaceY(x, zTop) - 0.005;
        row.push(new THREE.Vector3(x, THREE.MathUtils.lerp(yBot, yTop, vf), THREE.MathUtils.lerp(zBot, zTop, vf)));
      }
      grid.push(row);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0.62, -0.78));
  });
  const rearGlass = new THREE.Mesh(rearGlassGeo, camaroGlassMat);
  rearGlass.renderOrder = 3;
  bodyGroup.add(rearGlass);

  // Continuous Left & Right Greenhouse Pillars (Zero gap around C-pillar & quarter window!)
  for (const side of [-1, 1] as const) {
    const pillarGeo = cachedCamaroGeo(`camaro_pillar_loop_wt_v3_${side}`, () => {
      const stations: Array<{ zIn: number; xIn: number; yIn: number; zOut: number; xOut: number; yOut: number }> = [
        { zIn: 0.56, xIn: 0.805, yIn: 0.822, zOut: 0.56, xOut: sideTopEdgeX(0.56), yOut: beltlineY(0.56) },
        { zIn: 0.29, xIn: 0.742, yIn: 1.035, zOut: 0.29, xOut: 0.818, yOut: 1.022 },
        { zIn: 0.015, xIn: 0.688, yIn: roofSurfaceY(0.688, 0.015), zOut: 0.015, xOut: 0.752, yOut: 1.218 },
        { zIn: -0.51, xIn: 0.688, yIn: roofSurfaceY(0.688, -0.51), zOut: -0.51, xOut: 0.752, yOut: 1.236 },
        { zIn: -1.03, xIn: 0.680, yIn: roofSurfaceY(0.680, -1.03), zOut: -1.00, xOut: 0.752, yOut: 1.216 },
        { zIn: -1.26, xIn: 0.692, yIn: 1.080, zOut: -1.20, xOut: 0.892, yOut: 1.015 },
        { zIn: -1.40, xIn: 0.700, yIn: 1.000, zOut: -1.36, xOut: sideTopEdgeX(-1.36), yOut: beltlineY(-1.36) + 0.018 },
        { zIn: -1.52, xIn: 0.708, yIn: trunkSurfaceY(0.708, -1.52), zOut: -1.52, xOut: sideTopEdgeX(-1.52), yOut: beltlineY(-1.52) - 0.008 },
      ];
      const grid: THREE.Vector3[][] = [];
      const uvGrid: THREE.Vector2[][] = [];
      for (const st of stations) {
        const xm = (st.xIn + st.xOut) * 0.5;
        const ym = (st.yIn + st.yOut) * 0.5 + 0.008;
        const zm = (st.zIn + st.zOut) * 0.5;
        const row: THREE.Vector3[] = [
          new THREE.Vector3(side * st.xIn, st.yIn, st.zIn),
          new THREE.Vector3(side * xm, ym, zm),
          new THREE.Vector3(side * st.xOut, st.yOut, st.zOut),
          new THREE.Vector3(side * (st.xOut - 0.025), st.yOut - 0.036, st.zOut),
        ];
        grid.push(row);
        uvGrid.push(row.map((p) => topUV(p.x, p.z)));
      }
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(side * 0.7, 0.7, 0), uvGrid);
    });
    const pillarMesh = new THREE.Mesh(pillarGeo, topPaintMat);
    pillarMesh.castShadow = true;
    pillarMesh.receiveShadow = true;
    bodyGroup.add(pillarMesh);

    // Gun-Slit Dark Smoked Side Window Glass (extends cleanly behind C-pillar, zero see-through gap!)
    const sideGlassGeo = cachedCamaroGeo(`camaro_sideglass_wt_v3_${side}`, () => {
      const grid: THREE.Vector3[][] = [];
      const cols: Array<{ zTop: number; yTop: number; xTop: number; zBot: number; yBot: number; xBot: number }> = [
        { zTop: 0.03, yTop: 1.214, xTop: 0.735, zBot: 0.54, yBot: 0.818, xBot: 0.880 },
        { zTop: -0.25, yTop: 1.230, xTop: 0.738, zBot: -0.25, yBot: 0.844, xBot: 0.884 },
        { zTop: -0.64, yTop: 1.228, xTop: 0.738, zBot: -0.64, yBot: 0.868, xBot: 0.892 },
        { zTop: -0.96, yTop: 1.210, xTop: 0.742, zBot: -0.98, yBot: 0.894, xBot: 0.912 },
        { zTop: -1.24, yTop: 1.065, xTop: 0.842, zBot: -1.36, yBot: 0.915, xBot: 0.945 },
        { zTop: -1.38, yTop: 0.985, xTop: 0.855, zBot: -1.52, yBot: 0.895, xBot: 0.935 },
      ];
      for (const c of cols) {
        grid.push([
          new THREE.Vector3(side * c.xBot, c.yBot, c.zBot),
          new THREE.Vector3(side * ((c.xBot + c.xTop) * 0.5), (c.yBot + c.yTop) * 0.5, (c.zBot + c.zTop) * 0.5),
          new THREE.Vector3(side * c.xTop, c.yTop, c.zTop),
        ]);
      }
      return buildLoftedGridGeometry(grid, () => new THREE.Vector3(side * 0.95, 0.3, 0));
    });
    const sideGlass = new THREE.Mesh(sideGlassGeo, camaroGlassMat);
    sideGlass.renderOrder = 3;
    bodyGroup.add(sideGlass);

    // Slim Gloss-Black B-Pillar Window Divider
    const bPillar = new THREE.Mesh(
      cachedCamaroGeo('camaro_bpillar_v4', () => new THREE.BoxGeometry(0.024, 0.36, 0.062)),
      glossBlackMat,
    );
    bPillar.position.set(side * 0.815, 1.032, -0.46);
    bPillar.rotation.z = side * 0.36;
    bodyGroup.add(bPillar);
  }

  // -------------------------------------------------------------------------
  // 5. Rear Trunk Deck, Raised Pedestal Spoiler (5_7244386f.webp) & Rear Fascia
  // -------------------------------------------------------------------------
  const trunkGeo = cachedCamaroGeo('camaro_trunk_wt_v2', () => {
    const nz = 12;
    const nx = 18;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const zFrac = iz / nz;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const zEnd = rearBrowZ(u);
        const z = THREE.MathUtils.lerp(-1.50, zEnd, zFrac);
        const px = u * sideTopEdgeX(z);
        row.push(new THREE.Vector3(px, trunkSurfaceY(px, z), z));
        uRow.push(topUV(px, z));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 1, 0), uvGrid);
  });
  const trunkMesh = new THREE.Mesh(trunkGeo, topPaintMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  bodyGroup.add(trunkMesh);

  // Dark satin rear parcel shelf inside fastback glass
  const parcelShelf = new THREE.Mesh(
    cachedCamaroGeo('camaro_parcel_shelf', () => new THREE.BoxGeometry(1.42, 0.05, 0.62)),
    mats.interiorMat,
  );
  parcelShelf.position.set(0, 0.875, -1.25);
  bodyGroup.add(parcelShelf);

  // Sculpted Camaro SS Raised Rear Wing Spoiler with Wrapping Stripes (5_7244386f.webp & 6_312e4d6f.webp)
  const spoilerWingGeo = cachedCamaroGeo('camaro_wing_spoiler_v2', () => {
    const nx = 20;
    const nz = 4;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iz = 0; iz <= nz; iz++) {
      const vf = iz / nz;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const x = u * 0.84;
        const tz = rearTailZ(x, 0.90);
        const z = THREE.MathUtils.lerp(tz + 0.22, tz - 0.04, vf);
        const arch = 0.018 * (1 - u * u);
        const y = vf < 0.78 ? 0.962 + arch + vf * 0.022 : 0.954 + arch;
        row.push(new THREE.Vector3(x, y, z));
        const uCoord = (x + X_SPAN) / (X_SPAN * 2);
        uRow.push(new THREE.Vector2(uCoord, vf));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 1, -0.15), uvGrid);
  });
  const spoilerCapMat = new THREE.MeshPhysicalMaterial({
    color: basePaintColor,
    map: tex.spoilerStripe,
    roughnessMap: tex.flakeRough,
    metalness: 0.14,
    roughness: 0.24,
    clearcoat: 0.94,
    clearcoatRoughness: 0.07,
    envMapIntensity: 0.72,
  });
  const spoilerWing = new THREE.Mesh(spoilerWingGeo, spoilerCapMat);
  spoilerWing.castShadow = true;
  bodyGroup.add(spoilerWing);

  for (const sx of [-0.52, 0.52]) {
    const post = new THREE.Mesh(
      cachedCamaroGeo('cam_sp_post', () => new THREE.BoxGeometry(0.08, 0.055, 0.14)),
      yellowUniformMat,
    );
    post.position.set(sx, 0.948, rearTailZ(sx, 0.90) + 0.14);
    bodyGroup.add(post);
  }

  // Watertight Rear Fascia Panel (Stitched identically to Trunk Deck & Side Quarter Panels)
  const rearFasciaGeo = cachedCamaroGeo('camaro_rear_fascia_wt_v2', () => {
    const nx = 34;
    const ny = 14;
    const grid: THREE.Vector3[][] = [];
    const uvGrid: THREE.Vector2[][] = [];
    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const row: THREE.Vector3[] = [];
      const uRow: THREE.Vector2[] = [];
      const xRearJoin = bodyHalfW(REAR_JOIN_Z);
      const outerSideX = sideSectionX(xRearJoin, vf, REAR_JOIN_Z);
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const absU = Math.abs(u);
        const x = u * outerSideX;

        const zBase = rearBrowZ(u);
        const yBot = THREE.MathUtils.lerp(0.41, sideBottomY(REAR_JOIN_Z), Math.pow(absU, 2.0));
        const yTop = trunkSurfaceY(THREE.MathUtils.clamp(x, -sideTopEdgeX(zBase), sideTopEdgeX(zBase)), zBase);
        const y = THREE.MathUtils.lerp(yBot, yTop, vf);

        const edgeFade = 1 - Math.pow(absU, 3.0);
        const trunkLipCrease = 0.018 * Math.sin(vf * Math.PI) * edgeFade;
        const inPlateX = 1 - smoothstep(0.21, 0.27, Math.abs(x));
        const inPlateY = smoothstep(0.12, 0.18, vf) * (1 - smoothstep(0.50, 0.58, vf));
        const pocketRecess = 0.038 * inPlateX * inPlateY;
        row.push(new THREE.Vector3(x, y, zBase + trunkLipCrease + pocketRecess));
        uRow.push(endUV(x, y));
      }
      grid.push(row);
      uvGrid.push(uRow);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, 0, -1), uvGrid);
  });
  const rearFascia = new THREE.Mesh(rearFasciaGeo, endPaintMat);
  rearFascia.castShadow = true;
  rearFascia.receiveShadow = true;
  bodyGroup.add(rearFascia);

  // Rear 3D Beveled Gold + Chrome Chevrolet Bowtie Emblem
  const rearBowGroup = new THREE.Group();
  rearBowGroup.position.set(0, 0.795, rearTailZ(0) - 0.008);
  const rBowChrome = new THREE.Mesh(getChevroletBowtieOuterGeo(0.19, 0.072, 0.018), mats.chromeMat);
  const rBowGold = new THREE.Mesh(getChevroletBowtieOuterGeo(0.172, 0.060, 0.023), goldBowtieMat);
  rBowGold.position.z = -0.003;
  rearBowGroup.add(rBowChrome, rBowGold);
  bodyGroup.add(rearBowGroup);

  // Dark Recessed License Plate (EXELANS CHEVROLET CAMARO SS)
  const rearPlateMesh = new THREE.Mesh(
    cachedCamaroGeo('camaro_rear_plate', () => new THREE.PlaneGeometry(0.36, 0.165)),
    new THREE.MeshStandardMaterial({ map: tex.rearPlate, roughness: 0.34, metalness: 0.20 }),
  );
  rearPlateMesh.position.set(0, 0.562, rearTailZ(0) + 0.030);
  rearPlateMesh.rotation.y = Math.PI;
  bodyGroup.add(rearPlateMesh);

  // Crisp Dark-Bezeled Trapezoidal Quad Camaro Taillights (matching 6_312e4d6f.webp)
  const innerBezelTrapGeo = getTrapezoidTaillightGeo(0.214, 0.184, 0.114, 0.026);
  const lensTrapGeo = getTrapezoidTaillightGeo(0.194, 0.166, 0.098, 0.030);

  for (const side of [-1, 1] as const) {
    const turnMat = side > 0 ? mats.turnLeftMat : mats.turnRightMat;
    for (const pod of [0, 1] as const) {
      const px = side * (pod === 0 ? 0.43 : 0.70);
      const pz = rearTailZ(px) + 0.012;
      const py = 0.778;
      const pYaw = side * (pod === 0 ? -0.05 : -0.12);

      const bezel = new THREE.Mesh(innerBezelTrapGeo, glossBlackMat);
      bezel.position.set(px, py, pz + 0.002);
      bezel.rotation.y = pYaw;
      bodyGroup.add(bezel);

      const lens = new THREE.Mesh(lensTrapGeo, taillightJewelMat);
      lens.position.set(px, py, pz - 0.004);
      lens.rotation.y = pYaw;
      bodyGroup.add(lens);

      const brakeBar = new THREE.Mesh(
        cachedCamaroGeo('cam_tl_brake', () => new THREE.BoxGeometry(0.138, 0.042, 0.014)),
        mats.brakeLightMat,
      );
      brakeBar.position.set(px, py + 0.014, pz - 0.015);
      brakeBar.rotation.y = pYaw;
      bodyGroup.add(brakeBar);

      if (pod === 0) {
        const revBar = new THREE.Mesh(
          cachedCamaroGeo('cam_tl_rev', () => new THREE.BoxGeometry(0.075, 0.020, 0.014)),
          mats.reverseLightMat,
        );
        revBar.position.set(px, py - 0.030, pz - 0.015);
        revBar.rotation.y = pYaw;
        bodyGroup.add(revBar);
      } else {
        const turnBar = new THREE.Mesh(
          cachedCamaroGeo('cam_tl_turn', () => new THREE.BoxGeometry(0.085, 0.020, 0.014)),
          turnMat,
        );
        turnBar.position.set(px, py - 0.030, pz - 0.015);
        turnBar.rotation.y = pYaw;
        bodyGroup.add(turnBar);
      }
    }
  }

  // Woven Carbon-Fiber Rear Diffuser Valance + 4 Aero Ribs + Chrome Exhaust Tips
  const rearDiffuserGeo = cachedCamaroGeo('camaro_rear_diffuser_v3', () => {
    const nx = 20;
    const ny = 4;
    const grid: THREE.Vector3[][] = [];
    for (let iy = 0; iy <= ny; iy++) {
      const vf = iy / ny;
      const row: THREE.Vector3[] = [];
      for (let ix = 0; ix <= nx; ix++) {
        const u = (ix / nx) * 2 - 1;
        const x = u * 0.85;
        const tz = rearTailZ(x) + 0.020;
        const archY = 0.43 - 0.045 * Math.pow(Math.abs(u), 2.4);
        const y = THREE.MathUtils.lerp(0.24, archY, vf);
        const z = tz + (1 - vf) * 0.082;
        row.push(new THREE.Vector3(x, y, z));
      }
      grid.push(row);
    }
    return buildLoftedGridGeometry(grid, () => new THREE.Vector3(0, -0.2, -1));
  });
  const rearDiffuser = new THREE.Mesh(rearDiffuserGeo, camaroCarbonMat);
  bodyGroup.add(rearDiffuser);

  for (const fx of [-0.35, -0.13, 0.13, 0.35]) {
    const fin = new THREE.Mesh(
      cachedCamaroGeo('cam_diff_fin', () => new THREE.BoxGeometry(0.02, 0.14, 0.055)),
      camaroCarbonMat,
    );
    fin.position.set(fx, 0.305, rearTailZ(fx) + 0.072);
    fin.rotation.x = 0.28;
    bodyGroup.add(fin);
  }

  for (const side of [-1, 1] as const) {
    const ex = side * 0.60;
    const ez = rearTailZ(ex) + 0.018;
    const ey = 0.34;

    const tipOuter = new THREE.Mesh(
      cachedCamaroGeo('cam_ex_oct_v2', () => new THREE.CylinderGeometry(0.074, 0.074, 0.15, 16, 1, true)),
      mats.chromeMat,
    );
    tipOuter.rotation.x = Math.PI / 2;
    tipOuter.position.set(ex, ey, ez);
    bodyGroup.add(tipOuter);

    const tipRim = new THREE.Mesh(
      cachedCamaroGeo('cam_ex_rim_oct_v2', () => new THREE.TorusGeometry(0.068, 0.011, 10, 18)),
      mats.chromeMat,
    );
    tipRim.position.set(ex, ey, ez - 0.072);
    bodyGroup.add(tipRim);

    const tipCore = new THREE.Mesh(
      cachedCamaroGeo('cam_ex_core_v2', () => new THREE.CircleGeometry(0.063, 16)),
      mats.trimMat,
    );
    tipCore.rotation.y = Math.PI;
    tipCore.position.set(ex, ey, ez - 0.064);
    bodyGroup.add(tipCore);
  }

  // -------------------------------------------------------------------------
  // 6. Normal-Mapped Underbody Chassis + Detailed Camaro SS Cockpit Interior
  // -------------------------------------------------------------------------
  const underbody = new THREE.Mesh(
    cachedCamaroGeo('camaro_underbody_v2', () => new THREE.BoxGeometry(1.52, 0.08, 4.05)),
    underbodyMat,
  );
  underbody.position.set(0, 0.22, 0.02);
  bodyGroup.add(underbody);

  const cabinFloorY = 0.36;
  const seatGeo = cachedCamaroGeo('cam_seat', () => new THREE.BoxGeometry(0.46, 0.52, 0.44));
  const bolsterGeo = cachedCamaroGeo('cam_bolster', () => new THREE.BoxGeometry(0.08, 0.48, 0.16));
  const headrestGeo = cachedCamaroGeo('cam_hr', () => new THREE.BoxGeometry(0.22, 0.17, 0.11));
  for (const sx of [-0.42, 0.42]) {
    const seat = new THREE.Mesh(seatGeo, mats.seatMat);
    seat.position.set(sx, cabinFloorY + 0.28, -0.06);
    seat.rotation.x = -0.18;
    bodyGroup.add(seat);

    for (const bx of [-0.21, 0.21]) {
      const bolster = new THREE.Mesh(bolsterGeo, mats.seatMat);
      bolster.position.set(sx + bx, cabinFloorY + 0.26, 0.04);
      bolster.rotation.x = -0.18;
      bodyGroup.add(bolster);
    }

    const hr = new THREE.Mesh(headrestGeo, mats.seatMat);
    hr.position.set(sx, cabinFloorY + 0.62, -0.15);
    bodyGroup.add(hr);
  }
  const rearBench = new THREE.Mesh(
    cachedCamaroGeo('cam_rbench', () => new THREE.BoxGeometry(1.24, 0.42, 0.44)),
    mats.seatMat,
  );
  rearBench.position.set(0, cabinFloorY + 0.24, -0.78);
  rearBench.rotation.x = -0.14;
  bodyGroup.add(rearBench);

  const dash = new THREE.Mesh(
    cachedCamaroGeo('cam_dash_v2', () => new THREE.BoxGeometry(1.40, 0.22, 0.38)),
    mats.interiorMat,
  );
  dash.position.set(0, 0.74, 0.45);
  bodyGroup.add(dash);

  const gaugePod = new THREE.Mesh(
    cachedCamaroGeo('cam_gauge_v2', () => new THREE.PlaneGeometry(0.32, 0.13)),
    new THREE.MeshStandardMaterial({
      map: tex.gaugeCluster,
      emissiveMap: tex.gaugeCluster,
      emissive: 0xffffff,
      emissiveIntensity: 0.75,
      roughness: 0.22,
    }),
  );
  gaugePod.position.set(0.42, 0.89, 0.42);
  gaugePod.rotation.y = Math.PI;
  bodyGroup.add(gaugePod);

  const consoleMesh = new THREE.Mesh(
    cachedCamaroGeo('cam_console', () => new THREE.BoxGeometry(0.24, 0.22, 1.08)),
    mats.interiorMat,
  );
  consoleMesh.position.set(0, cabinFloorY + 0.16, 0.04);
  bodyGroup.add(consoleMesh);

  const auxGauges = new THREE.Mesh(
    cachedCamaroGeo('cam_aux_gauges', () => new THREE.PlaneGeometry(0.19, 0.09)),
    new THREE.MeshStandardMaterial({
      map: tex.centerGauges,
      emissiveMap: tex.centerGauges,
      emissive: 0xffffff,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    }),
  );
  auxGauges.position.set(0, cabinFloorY + 0.30, 0.34);
  auxGauges.rotation.x = -0.58;
  auxGauges.rotation.y = Math.PI;
  bodyGroup.add(auxGauges);

  const shifter = new THREE.Mesh(
    cachedCamaroGeo('cam_shifter', () => new THREE.CylinderGeometry(0.022, 0.018, 0.12, 10)),
    machinedAlloyMat,
  );
  shifter.position.set(0, cabinFloorY + 0.31, 0.16);
  shifter.rotation.x = -0.18;
  bodyGroup.add(shifter);

  const rvMirror = new THREE.Mesh(
    cachedCamaroGeo('cam_rvmirror', () => new THREE.BoxGeometry(0.22, 0.048, 0.032)),
    mats.trimMat,
  );
  rvMirror.position.set(0, 1.15, 0.16);
  bodyGroup.add(rvMirror);

  const steerGroup = new THREE.Group();
  steerGroup.position.set(spec.cockpitOffset.x, 0.87, 0.29);
  steerGroup.rotation.x = -0.35;
  const swRim = new THREE.Mesh(
    cachedCamaroGeo('cam_sw_rim', () => new THREE.TorusGeometry(0.165, 0.022, 10, 24)),
    mats.trimMat,
  );
  const swHub = new THREE.Mesh(
    cachedCamaroGeo('cam_sw_hub', () => new THREE.CylinderGeometry(0.056, 0.06, 0.038, 16)),
    mats.interiorMat,
  );
  swHub.rotation.x = Math.PI / 2;
  const swBowtie = new THREE.Mesh(getChevroletBowtieOuterGeo(0.044, 0.018, 0.008), goldBowtieMat);
  swBowtie.position.z = -0.022;
  swBowtie.rotation.y = Math.PI;
  steerGroup.add(swRim, swHub, swBowtie);

  for (const sa of [0, 2.35, -2.35]) {
    const swSpoke = new THREE.Mesh(
      cachedCamaroGeo('cam_sw_spoke', () => new THREE.BoxGeometry(0.036, 0.135, 0.018)),
      machinedAlloyMat,
    );
    swSpoke.position.set(Math.sin(sa) * 0.085, -Math.cos(sa) * 0.085, 0);
    swSpoke.rotation.z = sa;
    steerGroup.add(swSpoke);
  }
  bodyGroup.add(steerGroup);

  return { wheelNodes, wheelMeshes, frontSteerPivots };
}
