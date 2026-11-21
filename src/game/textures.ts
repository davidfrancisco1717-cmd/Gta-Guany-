import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphalt: THREE.CanvasTexture;
  asphaltRoughness: THREE.CanvasTexture;
  asphaltNormal: THREE.CanvasTexture;
  asphaltAo: THREE.CanvasTexture;
  sidewalk: THREE.CanvasTexture;
  sidewalkNormal: THREE.CanvasTexture;
  sidewalkRoughness: THREE.CanvasTexture;
  sidewalkAo: THREE.CanvasTexture;
  curb: THREE.CanvasTexture;
  curbNormal: THREE.CanvasTexture;
  concrete: THREE.CanvasTexture;
  concreteNormal: THREE.CanvasTexture;
  concreteRoughness: THREE.CanvasTexture;
  metal: THREE.CanvasTexture;
  metalRoughness: THREE.CanvasTexture;
  brick: THREE.CanvasTexture;
  brickNormal: THREE.CanvasTexture;
  wood: THREE.CanvasTexture;
  woodNormal: THREE.CanvasTexture;
  grass: THREE.CanvasTexture;
  grassNormal: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  waterNormal: THREE.CanvasTexture;
  skyscraperFacade: THREE.CanvasTexture;
  skyscraperEmissive: THREE.CanvasTexture;
  skyscraperRoughness: THREE.CanvasTexture;
  concreteTowerFacade: THREE.CanvasTexture;
  concreteTowerEmissive: THREE.CanvasTexture;
  apartmentFacade: THREE.CanvasTexture;
  apartmentEmissive: THREE.CanvasTexture;
  artDecoFacade: THREE.CanvasTexture;
  artDecoEmissive: THREE.CanvasTexture;
  highwaySign: THREE.CanvasTexture;
  billboardSign: THREE.CanvasTexture;
  ammuSign: THREE.CanvasTexture;
  bincoSign: THREE.CanvasTexture;
  ltdSign: THREE.CanvasTexture;
  hotelSign: THREE.CanvasTexture;
  electronicsSign: THREE.CanvasTexture;
  bannerSign: THREE.CanvasTexture;
  policeDoorDecal: THREE.CanvasTexture;
  licensePlate: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeColorTex(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function finalizeDataTex(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function heightToNormalCanvas(heightCanvas: HTMLCanvasElement, strength = 2.4): HTMLCanvasElement {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const srcCtx = heightCanvas.getContext('2d')!;
  const src = srcCtx.getImageData(0, 0, w, h).data;

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const outCtx = out.getContext('2d')!;
  const dst = outCtx.createImageData(w, h);

  const sample = (x: number, y: number) => {
    const wx = ((x % w) + w) % w;
    const wy = ((y % h) + h) % h;
    return src[(wy * w + wx) * 4] / 255;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);
      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const len = Math.hypot(dx, dy, dz);
      const idx = (y * w + x) * 4;
      dst.data[idx] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      dst.data[idx + 1] = Math.round(((dy / len) * 0.5 + 0.5) * 255);
      dst.data[idx + 2] = Math.round(((dz / len) * 0.5 + 0.5) * 255);
      dst.data[idx + 3] = 255;
    }
  }
  outCtx.putImageData(dst, 0, 0);
  return out;
}

function createAsphaltSet(): {
  albedo: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  ao: HTMLCanvasElement;
} {
  const s = 512;
  const albedo = document.createElement('canvas');
  albedo.width = s;
  albedo.height = s;
  const actx = albedo.getContext('2d')!;

  const roughness = document.createElement('canvas');
  roughness.width = s;
  roughness.height = s;
  const rctx = roughness.getContext('2d')!;

  const height = document.createElement('canvas');
  height.width = s;
  height.height = s;
  const hctx = height.getContext('2d')!;

  const ao = document.createElement('canvas');
  ao.width = s;
  ao.height = s;
  const aoctx = ao.getContext('2d')!;

  actx.fillStyle = '#1e2127';
  actx.fillRect(0, 0, s, s);
  rctx.fillStyle = '#b8b8b8';
  rctx.fillRect(0, 0, s, s);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, s, s);
  aoctx.fillStyle = '#f2f2f2';
  aoctx.fillRect(0, 0, s, s);

  // Subtle macro tonal variation (patched asphalt repairs & weathering)
  for (let i = 0; i < 16; i++) {
    const px = (i * 113) % s;
    const py = (i * 173) % s;
    const rad = 45 + (i % 5) * 20;
    const grad = actx.createRadialGradient(px, py, 6, px, py, rad);
    grad.addColorStop(0, i % 2 === 0 ? 'rgba(14, 16, 20, 0.34)' : 'rgba(48, 52, 60, 0.22)');
    grad.addColorStop(1, 'rgba(30, 33, 39, 0)');
    actx.fillStyle = grad;
    actx.beginPath();
    actx.arc(px, py, rad, 0, Math.PI * 2);
    actx.fill();
  }

  // Fine mineral aggregate grit
  for (let i = 0; i < 20000; i++) {
    const px = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1) * s;
    const py = Math.abs((Math.sin(i * 78.233) * 23421.631) % 1) * s;
    const sz = i % 6 === 0 ? 2.4 : 1.4;
    actx.fillStyle = i % 3 === 0 ? '#323640' : i % 3 === 1 ? '#14161b' : '#262a31';
    actx.fillRect(px, py, sz, sz);
    hctx.fillStyle = i % 2 === 0 ? '#a4a4a4' : '#5e5e5e';
    hctx.fillRect(px, py, sz, sz);
  }

  // Longitudinal tire wear tracks & polished damp rubber streaks
  const trackXs = [95, 165, 345, 415];
  for (const tx of trackXs) {
    const tGrad = actx.createLinearGradient(tx - 24, 0, tx + 24, 0);
    tGrad.addColorStop(0, 'rgba(10,11,14,0)');
    tGrad.addColorStop(0.5, 'rgba(10,11,14,0.28)');
    tGrad.addColorStop(1, 'rgba(10,11,14,0)');
    actx.fillStyle = tGrad;
    actx.fillRect(tx - 24, 0, 48, s);

    const rGrad = rctx.createLinearGradient(tx - 22, 0, tx + 22, 0);
    rGrad.addColorStop(0, 'rgba(72,72,72,0)');
    rGrad.addColorStop(0.5, 'rgba(65,65,65,0.75)');
    rGrad.addColorStop(1, 'rgba(72,72,72,0)');
    rctx.fillStyle = rGrad;
    rctx.fillRect(tx - 22, 0, 44, s);
  }

  // Damp reflective puddle patches (for realistic dusk/streetlamp specular glints)
  for (let i = 0; i < 10; i++) {
    const gx = (i * 103 + 40) % s;
    const gy = (i * 149 + 25) % s;
    const rad = 42 + (i % 4) * 18;
    const grad = rctx.createRadialGradient(gx, gy, 4, gx, gy, rad);
    grad.addColorStop(0, 'rgba(28, 28, 28, 0.92)');
    grad.addColorStop(0.65, 'rgba(58, 58, 58, 0.55)');
    grad.addColorStop(1, 'rgba(184, 184, 184, 0)');
    rctx.fillStyle = grad;
    rctx.beginPath();
    rctx.arc(gx, gy, rad, 0, Math.PI * 2);
    rctx.fill();

    const agrad = actx.createRadialGradient(gx, gy, 4, gx, gy, rad);
    agrad.addColorStop(0, 'rgba(9, 11, 15, 0.34)');
    agrad.addColorStop(1, 'rgba(9, 11, 15, 0)');
    actx.fillStyle = agrad;
    actx.beginPath();
    actx.arc(gx, gy, rad, 0, Math.PI * 2);
    actx.fill();
  }

  // Tar-sealed cracks & secondary micro-fissures
  actx.strokeStyle = '#0d0f13';
  hctx.strokeStyle = '#2c2c2c';
  aoctx.strokeStyle = '#999999';
  actx.lineWidth = 1.8;
  hctx.lineWidth = 2.2;
  aoctx.lineWidth = 2.5;
  for (let c = 0; c < 9; c++) {
    let cx = (c * 67 + 22) % s;
    let cy = (c * 83) % s;
    actx.beginPath();
    hctx.beginPath();
    aoctx.beginPath();
    actx.moveTo(cx, cy);
    hctx.moveTo(cx, cy);
    aoctx.moveTo(cx, cy);
    for (let step = 0; step < 11; step++) {
      cx += Math.sin(c * 5 + step * 1.9) * 16;
      cy += 16 + Math.cos(c + step * 1.3) * 8;
      actx.lineTo(cx, cy);
      hctx.lineTo(cx, cy);
      aoctx.lineTo(cx, cy);
    }
    actx.stroke();
    hctx.stroke();
    aoctx.stroke();
  }

  return { albedo, roughness, normal: heightToNormalCanvas(height, 2.5), ao };
}

function createSidewalkSet(): {
  albedo: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
  ao: HTMLCanvasElement;
} {
  const s = 512;
  const albedo = document.createElement('canvas');
  albedo.width = s;
  albedo.height = s;
  const actx = albedo.getContext('2d')!;

  const height = document.createElement('canvas');
  height.width = s;
  height.height = s;
  const hctx = height.getContext('2d')!;

  const roughness = document.createElement('canvas');
  roughness.width = s;
  roughness.height = s;
  const rctx = roughness.getContext('2d')!;

  const ao = document.createElement('canvas');
  ao.width = s;
  ao.height = s;
  const aoctx = ao.getContext('2d')!;

  actx.fillStyle = '#999da3';
  actx.fillRect(0, 0, s, s);
  hctx.fillStyle = '#b4b4b4';
  hctx.fillRect(0, 0, s, s);
  rctx.fillStyle = '#cccccc';
  rctx.fillRect(0, 0, s, s);
  aoctx.fillStyle = '#f0f0f0';
  aoctx.fillRect(0, 0, s, s);

  const step = 128;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const shade = 148 + (((r * 11 + c * 17) % 7) - 3) * 5;
      actx.fillStyle = `rgb(${shade}, ${shade + 1}, ${shade + 3})`;
      actx.fillRect(c * step + 3, r * step + 3, step - 6, step - 6);

      const roughShade = 185 + (((r * 5 + c * 9) % 5) - 2) * 14;
      rctx.fillStyle = `rgb(${roughShade},${roughShade},${roughShade})`;
      rctx.fillRect(c * step + 3, r * step + 3, step - 6, step - 6);
    }
  }

  // Expansion joint grooves + AO shadow inside joints
  actx.strokeStyle = 'rgba(38, 42, 48, 0.78)';
  actx.lineWidth = 4;
  hctx.strokeStyle = '#323232';
  hctx.lineWidth = 5;
  aoctx.strokeStyle = '#7c7c7c';
  aoctx.lineWidth = 7;

  for (let i = 0; i <= s; i += step) {
    actx.beginPath();
    actx.moveTo(i, 0);
    actx.lineTo(i, s);
    actx.stroke();
    actx.beginPath();
    actx.moveTo(0, i);
    actx.lineTo(s, i);
    actx.stroke();

    hctx.beginPath();
    hctx.moveTo(i, 0);
    hctx.lineTo(i, s);
    hctx.stroke();
    hctx.beginPath();
    hctx.moveTo(0, i);
    hctx.lineTo(s, i);
    hctx.stroke();

    aoctx.beginPath();
    aoctx.moveTo(i, 0);
    aoctx.lineTo(i, s);
    aoctx.stroke();
    aoctx.beginPath();
    aoctx.moveTo(0, i);
    aoctx.lineTo(s, i);
    aoctx.stroke();
  }

  // Concrete aggregate speckles & damp stain variation
  for (let i = 0; i < 8000; i++) {
    const px = Math.abs((Math.sin(i * 91.7) * 43758.5) % 1) * s;
    const py = Math.abs((Math.cos(i * 47.3) * 19283.1) % 1) * s;
    actx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(28,30,36,0.11)';
    actx.fillRect(px, py, 2, 2);
  }

  for (let p = 0; p < 5; p++) {
    const gx = (p * 117 + 40) % s;
    const gy = (p * 141 + 60) % s;
    const grad = rctx.createRadialGradient(gx, gy, 5, gx, gy, 52);
    grad.addColorStop(0, 'rgba(92,92,92,0.8)');
    grad.addColorStop(1, 'rgba(204,204,204,0)');
    rctx.fillStyle = grad;
    rctx.beginPath();
    rctx.arc(gx, gy, 52, 0, Math.PI * 2);
    rctx.fill();
  }

  return { albedo, normal: heightToNormalCanvas(height, 2.7), roughness, ao };
}

function createCurbSet(): { albedo: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const w = 256;
  const h = 128;
  const albedo = document.createElement('canvas');
  albedo.width = w;
  albedo.height = h;
  const actx = albedo.getContext('2d')!;

  const height = document.createElement('canvas');
  height.width = w;
  height.height = h;
  const hctx = height.getContext('2d')!;

  actx.fillStyle = '#8b8f96';
  actx.fillRect(0, 0, w, h);
  hctx.fillStyle = '#b8b8b8';
  hctx.fillRect(0, 0, w, h);

  // Granite/concrete curb block segments + subtle weathered red paint zones
  const seg = 64;
  for (let i = 0; i < 4; i++) {
    const x = i * seg;
    actx.fillStyle = i % 2 === 0 ? '#92969d' : '#858990';
    actx.fillRect(x + 2, 2, seg - 4, h - 4);
    actx.fillStyle = 'rgba(35,38,44,0.6)';
    actx.fillRect(x, 0, 3, h);
    hctx.fillStyle = '#404040';
    hctx.fillRect(x, 0, 4, h);
  }

  // Painted red curb accent band with wear
  actx.fillStyle = 'rgba(166, 40, 40, 0.72)';
  actx.fillRect(0, 12, w, h - 24);
  for (let i = 0; i < 1200; i++) {
    const px = Math.abs((Math.sin(i * 41.3) * 19283.1) % 1) * w;
    const py = Math.abs((Math.cos(i * 73.9) * 32451.7) % 1) * h;
    actx.fillStyle = i % 2 === 0 ? 'rgba(130,134,140,0.28)' : 'rgba(35,38,42,0.18)';
    actx.fillRect(px, py, 2, 2);
  }

  return { albedo, normal: heightToNormalCanvas(height, 2.4) };
}

function createArchitecturalConcreteSet(): {
  albedo: HTMLCanvasElement;
  normal: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
} {
  const s = 256;
  const albedo = document.createElement('canvas');
  albedo.width = s;
  albedo.height = s;
  const actx = albedo.getContext('2d')!;

  const height = document.createElement('canvas');
  height.width = s;
  height.height = s;
  const hctx = height.getContext('2d')!;

  const roughness = document.createElement('canvas');
  roughness.width = s;
  roughness.height = s;
  const rctx = roughness.getContext('2d')!;

  actx.fillStyle = '#9aa0a8';
  actx.fillRect(0, 0, s, s);
  hctx.fillStyle = '#a8a8a8';
  hctx.fillRect(0, 0, s, s);
  rctx.fillStyle = '#c8c8c8';
  rctx.fillRect(0, 0, s, s);

  const cell = 64;
  for (let y = 0; y < s; y += cell) {
    for (let x = 0; x < s; x += cell) {
      const shade = 148 + (((x + y) / cell) % 3) * 7;
      actx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
      actx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      // Formwork tie holes
      actx.fillStyle = '#5a6068';
      actx.fillRect(x + 12, y + 12, 3, 3);
      actx.fillRect(x + cell - 15, y + 12, 3, 3);
      hctx.fillStyle = '#404040';
      hctx.fillRect(x, y, 2, cell);
      hctx.fillRect(x, y, cell, 2);
    }
  }

  for (let i = 0; i < 1800; i++) {
    const px = Math.abs((Math.sin(i * 63.1) * 41235.7) % 1) * s;
    const py = Math.abs((Math.cos(i * 27.9) * 19283.3) % 1) * s;
    actx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(20,24,30,0.08)';
    actx.fillRect(px, py, 2, 2);
  }

  return { albedo, normal: heightToNormalCanvas(height, 2.2), roughness };
}

function createMetalSet(): { albedo: HTMLCanvasElement; roughness: HTMLCanvasElement } {
  const s = 256;
  const albedo = document.createElement('canvas');
  albedo.width = s;
  albedo.height = s;
  const actx = albedo.getContext('2d')!;

  const roughness = document.createElement('canvas');
  roughness.width = s;
  roughness.height = s;
  const rctx = roughness.getContext('2d')!;

  actx.fillStyle = '#5c6470';
  actx.fillRect(0, 0, s, s);
  rctx.fillStyle = '#686868';
  rctx.fillRect(0, 0, s, s);

  for (let y = 0; y < s; y += 2) {
    const tone = 82 + ((y * 13) % 24);
    actx.fillStyle = `rgb(${tone},${tone + 6},${tone + 14})`;
    actx.fillRect(0, y, s, 1);
    const rTone = 75 + ((y * 7) % 45);
    rctx.fillStyle = `rgb(${rTone},${rTone},${rTone})`;
    rctx.fillRect(0, y, s, 1);
  }
  actx.strokeStyle = '#333942';
  actx.lineWidth = 2;
  actx.strokeRect(2, 2, s - 4, s - 4);
  actx.beginPath();
  actx.moveTo(0, 128);
  actx.lineTo(s, 128);
  actx.stroke();

  return { albedo, roughness };
}

function createBrickSet(): { albedo: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const s = 256;
  const albedo = document.createElement('canvas');
  albedo.width = s;
  albedo.height = s;
  const actx = albedo.getContext('2d')!;

  const height = document.createElement('canvas');
  height.width = s;
  height.height = s;
  const hctx = height.getContext('2d')!;

  actx.fillStyle = '#a89f94';
  actx.fillRect(0, 0, s, s);
  hctx.fillStyle = '#484848';
  hctx.fillRect(0, 0, s, s);

  const rows = 8;
  const cols = 4;
  const bh = s / rows;
  const bw = s / cols;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const hash = Math.abs(Math.sin((r * 19 + c * 31) * 7.3) * 1234.5) % 1;
      const red = Math.round(132 + hash * 46);
      const green = Math.round(64 + hash * 26);
      const blue = Math.round(45 + hash * 16);
      actx.fillStyle = `rgb(${red},${green},${blue})`;
      actx.fillRect(c * bw + offset + 2, r * bh + 2, bw - 4, bh - 4);

      hctx.fillStyle = '#c8c8c8';
      hctx.fillRect(c * bw + offset + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }

  return { albedo, normal: heightToNormalCanvas(height, 2.6) };
}

function createWoodSet(): { albedo: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const s = 256;
  const albedo = document.createElement('canvas');
  albedo.width = s;
  albedo.height = s;
  const ctx = albedo.getContext('2d')!;

  const height = document.createElement('canvas');
  height.width = s;
  height.height = s;
  const hctx = height.getContext('2d')!;

  ctx.fillStyle = '#7c5534';
  ctx.fillRect(0, 0, s, s);
  hctx.fillStyle = '#b4b4b4';
  hctx.fillRect(0, 0, s, s);

  for (let p = 0; p < 8; p++) {
    const y = p * 32;
    ctx.fillStyle = p % 2 === 0 ? '#8a5f3b' : '#704b2d';
    ctx.fillRect(0, y + 1, s, 30);
    // Grain streaks
    for (let g = 0; g < 6; g++) {
      ctx.fillStyle = 'rgba(42, 24, 12, 0.22)';
      ctx.fillRect(0, y + 4 + g * 4, s, 1);
    }
    ctx.fillStyle = 'rgba(26, 15, 8, 0.55)';
    ctx.fillRect(0, y, s, 2);
    hctx.fillStyle = '#3a3a3a';
    hctx.fillRect(0, y, s, 2);
  }
  return { albedo, normal: heightToNormalCanvas(height, 2.1) };
}

function createGrassSet(): { albedo: HTMLCanvasElement; normal: HTMLCanvasElement } {
  const s = 256;
  const albedo = document.createElement('canvas');
  albedo.width = s;
  albedo.height = s;
  const ctx = albedo.getContext('2d')!;

  const height = document.createElement('canvas');
  height.width = s;
  height.height = s;
  const hctx = height.getContext('2d')!;

  ctx.fillStyle = '#396b32';
  ctx.fillRect(0, 0, s, s);
  hctx.fillStyle = '#787878';
  hctx.fillRect(0, 0, s, s);

  for (let i = 0; i < 6000; i++) {
    const px = Math.abs((Math.sin(i * 33.1) * 91823.7) % 1) * s;
    const py = Math.abs((Math.cos(i * 19.7) * 41235.9) % 1) * s;
    ctx.fillStyle = i % 4 === 0 ? '#559448' : i % 4 === 1 ? '#284d23' : i % 4 === 2 ? '#65a151' : '#3f7637';
    ctx.fillRect(px, py, 2, 4);
    hctx.fillStyle = i % 2 === 0 ? '#b2b2b2' : '#585858';
    hctx.fillRect(px, py, 2, 3);
  }
  return { albedo, normal: heightToNormalCanvas(height, 1.8) };
}

function createSandCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#dcc599';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3200; i++) {
    const px = Math.abs((Math.sin(i * 51.4) * 32451.2) % 1) * 256;
    const py = Math.abs((Math.cos(i * 29.8) * 65432.1) % 1) * 256;
    ctx.fillStyle = i % 2 === 0 ? '#ead7b0' : '#c7ae80';
    ctx.fillRect(px, py, 2, 2);
  }
  return canvas;
}

function createFacadePair(
  baseColor: string,
  frameColor: string,
  cols: number,
  rows: number,
  warmLit: boolean,
  style: 'glass' | 'concrete' | 'apartment' | 'artdeco' = 'glass',
): { albedo: HTMLCanvasElement; emissive: HTMLCanvasElement; roughness: HTMLCanvasElement } {
  const w = 512;
  const h = 1024;
  const albedo = document.createElement('canvas');
  albedo.width = w;
  albedo.height = h;
  const actx = albedo.getContext('2d')!;

  const emissive = document.createElement('canvas');
  emissive.width = w;
  emissive.height = h;
  const ectx = emissive.getContext('2d')!;

  const roughness = document.createElement('canvas');
  roughness.width = w;
  roughness.height = h;
  const rctx = roughness.getContext('2d')!;

  actx.fillStyle = baseColor;
  actx.fillRect(0, 0, w, h);
  ectx.fillStyle = '#000000';
  ectx.fillRect(0, 0, w, h);
  rctx.fillStyle = style === 'glass' ? '#707070' : '#cccccc';
  rctx.fillRect(0, 0, w, h);

  const padX = w / cols;
  const padY = h / rows;

  for (let r = 0; r < rows; r++) {
    // Horizontal floor band / cornice trim
    actx.fillStyle = frameColor;
    actx.fillRect(0, r * padY, w, style === 'concrete' ? 12 : 7);

    if (style === 'artdeco' && (r === 0 || r === rows - 1)) {
      actx.fillStyle = '#67e8f9';
      actx.fillRect(0, r * padY + 6, w, 4);
      ectx.fillStyle = '#22d3ee';
      ectx.fillRect(0, r * padY + 6, w, 4);
    }

    for (let c = 0; c < cols; c++) {
      const wx = c * padX + padX * 0.14;
      const wy = r * padY + padY * 0.2;
      const ww = padX * 0.72;
      const wh = padY * 0.64;

      const hash = Math.abs(Math.sin((r * 31 + c * 17) * 12.34) * 43758.5) % 1;
      const grad = actx.createLinearGradient(wx, wy, wx + ww, wy + wh);
      if (style === 'glass') {
        grad.addColorStop(0, hash > 0.5 ? '#2d4f6e' : '#1f3954');
        grad.addColorStop(1, '#0d1a29');
      } else {
        grad.addColorStop(0, hash > 0.5 ? '#24364a' : '#182534');
        grad.addColorStop(1, '#0e1620');
      }
      actx.fillStyle = grad;
      actx.fillRect(wx, wy, ww, wh);

      // Glass panes have low roughness (mirror-like sunset & sky reflections)
      rctx.fillStyle = '#1a1a1a';
      rctx.fillRect(wx, wy, ww, wh);

      // Diagonal sky reflection highlight + mullion divider
      actx.fillStyle = 'rgba(218, 238, 255, 0.2)';
      actx.fillRect(wx + 3, wy + 3, ww * 0.34, wh - 6);
      actx.fillStyle = frameColor;
      actx.fillRect(wx + ww * 0.5 - 1.5, wy, 3, wh);

      // Sill accent for concrete/apartment buildings
      if (style !== 'glass') {
        actx.fillStyle = 'rgba(0,0,0,0.28)';
        actx.fillRect(wx - 2, wy + wh, ww + 4, 4);
      }

      if (hash > 0.38) {
        ectx.fillStyle = warmLit
          ? hash > 0.76
            ? '#ffe0a6'
            : '#ffc26b'
          : hash > 0.78
            ? '#cde9ff'
            : '#ffe4ad';
        ectx.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
      }
    }
  }

  return { albedo, emissive, roughness };
}

function createHighwaySignCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0f5c3a';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 236);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Plus Jakarta Sans, Arial, sans-serif';
  ctx.fillText('↑  San Verde Centro', 38, 72);
  ctx.fillText('↑  Vinewood Hills', 38, 134);
  ctx.fillText('→  Praia Vespucci', 38, 198);

  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(424, 154, 54, 52);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 5;
  ctx.strokeRect(424, 154, 54, 52);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px monospace';
  ctx.fillText('5', 442, 190);
  return c;
}

function createBillboardCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#f97316');
  grad.addColorStop(0.6, '#fbbf24');
  grad.addColorStop(1, '#1e293b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  ctx.fillStyle = '#fff7ed';
  ctx.beginPath();
  ctx.arc(380, 118, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 195, 512, 61);
  ctx.fillRect(62, 90, 10, 110);
  ctx.fillRect(435, 105, 9, 95);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'italic bold 56px Georgia, serif';
  ctx.fillText('San Verde', 48, 108);
  ctx.fillStyle = '#fde68a';
  ctx.font = '600 24px Plus Jakarta Sans, Arial, sans-serif';
  ctx.fillText('DREAM BIGGER · COSTA OESTE', 50, 150);
  return c;
}

function createShopBannerCanvas(title: string, subtitle: string, bg: string, fg: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 112);

  ctx.fillStyle = fg;
  ctx.font = 'bold 46px Chakra Petch, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 256, 66);
  ctx.font = 'bold 19px monospace';
  ctx.fillText(subtitle, 256, 100);
  return c;
}

function createStreetPoleBannerCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, 128, 256);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, 128, 24);
  ctx.fillRect(0, 232, 128, 24);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Chakra Petch, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SAN', 64, 112);
  ctx.fillText('VERDE', 64, 140);
  ctx.font = 'bold 12px monospace';
  ctx.fillStyle = '#fde68a';
  ctx.fillText('DOWNTOWN', 64, 172);
  return c;
}

function createPoliceDoorCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 256, 18);
  ctx.fillRect(0, 110, 256, 18);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 42px Chakra Petch, Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('POLICE', 128, 72);
  ctx.fillStyle = '#ca8a04';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('SAN VERDE · LSPD', 128, 96);
  return c;
}

function createLicensePlateCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 128, 64);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(0, 0, 128, 16);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SAN VERDE', 64, 12);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px monospace';
  ctx.fillText('SV-508', 64, 48);
  return c;
}

function createContactShadowCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.36)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  return canvas;
}

function createWaterNormalCanvas(): HTMLCanvasElement {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const dx = Math.cos(u * 3 + v * 2) * 0.4 + Math.cos(u * 5 - v * 4) * 0.25;
      const dy = Math.sin(v * 3 - u * 2) * 0.4 + Math.sin(v * 6 + u * 3) * 0.25;
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.floor((dx * 0.5 + 0.5) * 255);
      img.data[idx + 1] = Math.floor((dy * 0.5 + 0.5) * 255);
      img.data[idx + 2] = 235;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function createProceduralTextures(renderer: THREE.WebGLRenderer): ProceduralTextureSet {
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const asphaltSet = createAsphaltSet();
  const asphalt = finalizeColorTex(asphaltSet.albedo, maxAniso, 1, 1);
  const asphaltRoughness = finalizeDataTex(asphaltSet.roughness, maxAniso, 1, 1);
  const asphaltNormal = finalizeDataTex(asphaltSet.normal, maxAniso, 1, 1);
  const asphaltAo = finalizeDataTex(asphaltSet.ao, maxAniso, 1, 1);

  const sidewalkSet = createSidewalkSet();
  const sidewalk = finalizeColorTex(sidewalkSet.albedo, maxAniso, 1, 1);
  const sidewalkNormal = finalizeDataTex(sidewalkSet.normal, maxAniso, 1, 1);
  const sidewalkRoughness = finalizeDataTex(sidewalkSet.roughness, maxAniso, 1, 1);
  const sidewalkAo = finalizeDataTex(sidewalkSet.ao, maxAniso, 1, 1);

  const curbSet = createCurbSet();
  const curb = finalizeColorTex(curbSet.albedo, maxAniso, 6, 1);
  const curbNormal = finalizeDataTex(curbSet.normal, maxAniso, 6, 1);

  const concreteSet = createArchitecturalConcreteSet();
  const concrete = finalizeColorTex(concreteSet.albedo, maxAniso, 2, 2);
  const concreteNormal = finalizeDataTex(concreteSet.normal, maxAniso, 2, 2);
  const concreteRoughness = finalizeDataTex(concreteSet.roughness, maxAniso, 2, 2);

  const metalSet = createMetalSet();
  const metal = finalizeColorTex(metalSet.albedo, maxAniso, 2, 2);
  const metalRoughness = finalizeDataTex(metalSet.roughness, maxAniso, 2, 2);

  const brickSet = createBrickSet();
  const brick = finalizeColorTex(brickSet.albedo, maxAniso, 2, 2);
  const brickNormal = finalizeDataTex(brickSet.normal, maxAniso, 2, 2);

  const woodSet = createWoodSet();
  const wood = finalizeColorTex(woodSet.albedo, maxAniso, 2, 8);
  const woodNormal = finalizeDataTex(woodSet.normal, maxAniso, 2, 8);

  const grassSet = createGrassSet();
  const grass = finalizeColorTex(grassSet.albedo, maxAniso, 14, 14);
  const grassNormal = finalizeDataTex(grassSet.normal, maxAniso, 14, 14);
  const sand = finalizeColorTex(createSandCanvas(), maxAniso, 10, 24);

  const waterNormal = finalizeDataTex(createWaterNormalCanvas(), maxAniso, 14, 30);

  const skyPair = createFacadePair('#475569', '#202938', 6, 14, false, 'glass');
  const skyscraperFacade = finalizeColorTex(skyPair.albedo, maxAniso, 1, 1);
  const skyscraperEmissive = finalizeColorTex(skyPair.emissive, maxAniso, 1, 1);
  const skyscraperRoughness = finalizeDataTex(skyPair.roughness, maxAniso, 1, 1);

  const concTowerPair = createFacadePair('#a8a59e', '#6f6c66', 5, 12, true, 'concrete');
  const concreteTowerFacade = finalizeColorTex(concTowerPair.albedo, maxAniso, 1, 1);
  const concreteTowerEmissive = finalizeColorTex(concTowerPair.emissive, maxAniso, 1, 1);

  const aptPair = createFacadePair('#c2ad94', '#7d6b58', 4, 8, true, 'apartment');
  const apartmentFacade = finalizeColorTex(aptPair.albedo, maxAniso, 1, 1);
  const apartmentEmissive = finalizeColorTex(aptPair.emissive, maxAniso, 1, 1);

  const decoPair = createFacadePair('#7db5a5', '#d9e3dc', 5, 6, true, 'artdeco');
  const artDecoFacade = finalizeColorTex(decoPair.albedo, maxAniso, 1, 1);
  const artDecoEmissive = finalizeColorTex(decoPair.emissive, maxAniso, 1, 1);

  const highwaySign = finalizeColorTex(createHighwaySignCanvas(), maxAniso, 1, 1);
  const billboardSign = finalizeColorTex(createBillboardCanvas(), maxAniso, 1, 1);
  const ammuSign = finalizeColorTex(
    createShopBannerCanvas('AMMU-NATION', 'ARMAS · MUNIÇÕES · COLETES', '#f1f5f9', '#b91c1c'),
    maxAniso,
    1,
    1,
  );
  const bincoSign = finalizeColorTex(
    createShopBannerCanvas('BINCO', 'MODA URBANA · 24H', '#ea580c', '#ffffff'),
    maxAniso,
    1,
    1,
  );
  const ltdSign = finalizeColorTex(
    createShopBannerCanvas('LTD FUEL', 'COMBUSTÍVEL & OFICINA 24/7', '#1d4ed8', '#fef08a'),
    maxAniso,
    1,
    1,
  );
  const hotelSign = finalizeColorTex(
    createShopBannerCanvas('OCEAN VIEW', 'HOTEL · BAR · LOUNGE', '#1e1b4b', '#f472b6'),
    maxAniso,
    1,
    1,
  );
  const electronicsSign = finalizeColorTex(
    createShopBannerCanvas('PARADISE TECH', 'ELETRÓNICA · NEO', '#090d16', '#38bdf8'),
    maxAniso,
    1,
    1,
  );
  const bannerSign = finalizeColorTex(createStreetPoleBannerCanvas(), maxAniso, 1, 1);
  const policeDoorDecal = finalizeColorTex(createPoliceDoorCanvas(), maxAniso, 1, 1);
  const licensePlate = finalizeColorTex(createLicensePlateCanvas(), maxAniso, 1, 1);

  const contactShadow = new THREE.CanvasTexture(createContactShadowCanvas());
  contactShadow.colorSpace = THREE.SRGBColorSpace;
  contactShadow.needsUpdate = true;

  const allTextures: THREE.Texture[] = [
    asphalt,
    asphaltRoughness,
    asphaltNormal,
    asphaltAo,
    sidewalk,
    sidewalkNormal,
    sidewalkRoughness,
    sidewalkAo,
    curb,
    curbNormal,
    concrete,
    concreteNormal,
    concreteRoughness,
    metal,
    metalRoughness,
    brick,
    brickNormal,
    wood,
    woodNormal,
    grass,
    grassNormal,
    sand,
    waterNormal,
    skyscraperFacade,
    skyscraperEmissive,
    skyscraperRoughness,
    concreteTowerFacade,
    concreteTowerEmissive,
    apartmentFacade,
    apartmentEmissive,
    artDecoFacade,
    artDecoEmissive,
    highwaySign,
    billboardSign,
    ammuSign,
    bincoSign,
    ltdSign,
    hotelSign,
    electronicsSign,
    bannerSign,
    policeDoorDecal,
    licensePlate,
    contactShadow,
  ];

  return {
    asphalt,
    asphaltRoughness,
    asphaltNormal,
    asphaltAo,
    sidewalk,
    sidewalkNormal,
    sidewalkRoughness,
    sidewalkAo,
    curb,
    curbNormal,
    concrete,
    concreteNormal,
    concreteRoughness,
    metal,
    metalRoughness,
    brick,
    brickNormal,
    wood,
    woodNormal,
    grass,
    grassNormal,
    sand,
    waterNormal,
    skyscraperFacade,
    skyscraperEmissive,
    skyscraperRoughness,
    concreteTowerFacade,
    concreteTowerEmissive,
    apartmentFacade,
    apartmentEmissive,
    artDecoFacade,
    artDecoEmissive,
    highwaySign,
    billboardSign,
    ammuSign,
    bincoSign,
    ltdSign,
    hotelSign,
    electronicsSign,
    bannerSign,
    policeDoorDecal,
    licensePlate,
    contactShadow,
    dispose: () => {
      for (const tex of allTextures) tex.dispose();
    },
  };
}
