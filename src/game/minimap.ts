import { MinimapEntity } from './types';
import { ROAD_COORDS, ROAD_WIDTH } from './city';
import { BEACH_START_X, OCEAN_START_X } from './physics';

export type MinimapOrientationMode = 'north-up' | 'heading-up';

export interface MinimapRenderOptions {
  zoom?: number; // world-to-pixel multiplier (default 0.88)
  cameraYaw?: number;
  speedKmh?: number;
  wantedStars?: number;
  orientationMode?: MinimapOrientationMode;
}

const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

/**
 * Converts GameEngine heading (0 = +Z South, +PI/2 = +X East, PI = -Z North)
 * into standard navigation azimuth degrees (0° = North -Z, 90° = East +X, 180° = South +Z, 270° = West -X).
 */
export function getWorldCompassInfo(playerHeading: number): {
  degrees: number;
  cardinal: string;
} {
  const rad = Math.atan2(Math.sin(playerHeading), -Math.cos(playerHeading));
  const degrees = Math.round(((rad * 180) / Math.PI + 360) % 360) % 360;
  const cardinal = CARDINALS[Math.round(degrees / 45) % 8];
  return { degrees, cardinal };
}

function clampToBoxRay(x: number, y: number, maxX: number, maxY: number): [number, number] {
  const ratio = Math.max(Math.abs(x) / maxX, Math.abs(y) / maxY, 1);
  return [x / ratio, y / ratio];
}

export function drawMinimap(
  canvas: HTMLCanvasElement,
  playerX: number,
  playerZ: number,
  playerHeading: number,
  entities: MinimapEntity[],
  wantedFlashing: boolean,
  elapsed: number,
  options: MinimapRenderOptions = {},
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.clientWidth || 160;
  const cssH = canvas.clientHeight || 160;
  const targetW = Math.round(cssW * dpr);
  const targetH = Math.round(cssH * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  const w = cssW;
  const h = cssH;
  const cx = w / 2;
  const cy = h / 2;

  const baseZoom = options.zoom ?? 0.88;
  const speedPullback = options.speedKmh ? Math.min(0.22, options.speedKmh * 0.0016) : 0;
  const scale = Math.max(0.36, baseZoom - speedPullback);
  const orientationMode = options.orientationMode ?? 'north-up';

  // In heading-up mode, rotate world around player so player's forward vector (sin(H), cos(H)) points UP (0, -1).
  const mapRotation = orientationMode === 'heading-up' ? playerHeading - Math.PI : 0;

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Outer green/dark terrain base (matches city outerGround)
  ctx.fillStyle = '#151c24';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(cx, cy);
  if (mapRotation !== 0) {
    ctx.rotate(mapRotation);
  }

  const toMapX = (wx: number) => (wx - playerX) * scale;
  const toMapY = (wz: number) => (wz - playerZ) * scale;

  // City Asphalt Footprint (-188..128 in X, -180..180 in Z)
  ctx.fillStyle = '#1b232e';
  ctx.fillRect(toMapX(-188), toMapY(-180), 316 * scale, 360 * scale);

  // Beach Sand & Ocean on East (extends generously in Z for rotated heading-up coverage)
  ctx.fillStyle = '#9f8961';
  ctx.fillRect(toMapX(BEACH_START_X), toMapY(-700), (OCEAN_START_X - BEACH_START_X) * scale, 1400 * scale);
  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(toMapX(OCEAN_START_X), toMapY(-700), 700 * scale, 1400 * scale);

  // Coastal Wooden Boardwalk (x = 126.75..132.25, z = -180..180)
  ctx.fillStyle = '#6f553d';
  ctx.fillRect(toMapX(BEACH_START_X - 1.25), toMapY(-180), 5.5 * scale, 360 * scale);

  // Wooden Pier (x = 132..204, z = 24.25..31.75)
  ctx.fillStyle = '#7c5d41';
  ctx.fillRect(toMapX(132), toMapY(24.25), 72 * scale, 7.5 * scale);

  // Central Park Block (x = 7..53, z = -53..-7) & Fountain Circle
  ctx.fillStyle = '#225930';
  ctx.fillRect(toMapX(7), toMapY(-53), 46 * scale, 46 * scale);
  ctx.fillStyle = '#1d93b8';
  ctx.beginPath();
  ctx.arc(toMapX(30), toMapY(-30), 5.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Road Grid (NS roads span -180..180; EW roads end cleanly at BEACH_START_X = 128)
  ctx.fillStyle = '#313d4f';
  for (const rx of ROAD_COORDS) {
    ctx.fillRect(toMapX(rx - ROAD_WIDTH / 2), toMapY(-180), ROAD_WIDTH * scale, 360 * scale);
  }
  for (const rz of ROAD_COORDS) {
    ctx.fillRect(toMapX(-180), toMapY(rz - ROAD_WIDTH / 2), (BEACH_START_X + 180) * scale, ROAD_WIDTH * scale);
  }

  // Subtle Road Centerlines
  ctx.strokeStyle = 'rgba(230, 184, 53, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const rx of ROAD_COORDS) {
    const mx = toMapX(rx);
    ctx.moveTo(mx, toMapY(-180));
    ctx.lineTo(mx, toMapY(180));
  }
  for (const rz of ROAD_COORDS) {
    const my = toMapY(rz);
    ctx.moveTo(toMapX(-180), my);
    ctx.lineTo(toMapX(BEACH_START_X), my);
  }
  ctx.stroke();

  // Core City Block Footprints (excluding Central Park)
  ctx.fillStyle = '#222b38';
  for (const bx of [-90, -30, 30, 90]) {
    for (const bz of [-90, -30, 30, 90]) {
      if (bx === 30 && bz === -30) continue;
      ctx.fillRect(toMapX(bx - 21), toMapY(bz - 21), 42 * scale, 42 * scale);
    }
  }

  // Police Precinct Highlight (90, -90)
  ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
  ctx.fillRect(toMapX(90 - 13), toMapY(-90 - 11), 26 * scale, 22 * scale);

  // Outer Suburban House Footprints (matches city.ts addHouse)
  ctx.fillStyle = '#242e3b';
  for (const oz of [-155, -90, -30, 30, 90, 155]) {
    ctx.fillRect(toMapX(-155 - 5.5), toMapY(oz - 4.5), 11 * scale, 9 * scale);
  }
  for (const ox of [-90, -30, 30, 90]) {
    ctx.fillRect(toMapX(ox - 5.5), toMapY(-155 - 4.5), 11 * scale, 9 * scale);
    ctx.fillRect(toMapX(ox - 5.5), toMapY(155 - 4.5), 11 * scale, 9 * scale);
  }

  // Camera Sight Cone behind player arrow (aligned in world XZ inside mapRotation)
  if (options.cameraYaw !== undefined) {
    ctx.save();
    const lookAngle = Math.atan2(-Math.sin(options.cameraYaw), -Math.cos(options.cameraYaw));
    ctx.rotate(-lookAngle);
    const coneRadius = Math.min(38, Math.max(24, Math.min(w, h) * 0.24));
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, coneRadius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, coneRadius, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Entities (Vehicles, Police, Shops, Gas, Missions, Waypoints)
  const clampPadX = Math.max(12, cx - 10);
  const clampPadY = Math.max(12, cy - 10);

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const ex = toMapX(e.x);
    const ey = toMapY(e.z);

    if (e.kind === 'traffic' || e.kind === 'parked') {
      ctx.save();
      ctx.translate(ex, ey);
      if (e.heading !== undefined) {
        ctx.rotate(-e.heading);
      }
      ctx.fillStyle = e.kind === 'parked' ? '#7c8ba1' : '#cbd5e1';
      ctx.fillRect(-1.7, -2.7, 3.4, 5.4);
      ctx.restore();
    } else if (e.kind === 'police') {
      const flashBlue = Math.sin(elapsed * 16) > 0;
      ctx.save();
      ctx.translate(ex, ey);
      if (e.heading !== undefined) {
        ctx.rotate(-e.heading);
      }
      ctx.fillStyle = flashBlue ? '#3b82f6' : '#ef4444';
      ctx.fillRect(-2.4, -3.8, 4.8, 7.6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.85;
      ctx.strokeRect(-2.4, -3.8, 4.8, 7.6);
      ctx.restore();
    } else if (e.kind === 'gas') {
      ctx.save();
      ctx.translate(ex, ey);
      if (mapRotation !== 0) ctx.rotate(-mapRotation);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', 0, 0.5);
      ctx.restore();
    } else if (e.kind === 'garage') {
      ctx.save();
      ctx.translate(ex, ey);
      if (mapRotation !== 0) ctx.rotate(-mapRotation);
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(-4.8, -4.8, 9.6, 9.6);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-4.8, -4.8, 9.6, 9.6);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('G', 0, 0.5);
      ctx.restore();
    } else if (e.kind === 'shop') {
      ctx.save();
      ctx.translate(ex, ey);
      if (mapRotation !== 0) ctx.rotate(-mapRotation);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.fillStyle = '#052e16';
      ctx.font = 'bold 7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0.5);
      ctx.restore();
    } else if (e.kind === 'mission') {
      ctx.save();
      ctx.translate(ex, ey);
      if (mapRotation !== 0) ctx.rotate(-mapRotation);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#082f49';
      ctx.font = 'bold 7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', 0, 0.5);
      ctx.restore();
    } else if (e.kind === 'checkpoint' || e.kind === 'target') {
      // Ray-clamp off-radar objectives onto the perimeter at their true world bearing
      const cosR = Math.cos(mapRotation);
      const sinR = Math.sin(mapRotation);
      const sx = ex * cosR - ey * sinR;
      const sy = ex * sinR + ey * cosR;
      const [clampedSx, clampedSy] = clampToBoxRay(sx, sy, clampPadX, clampPadY);
      const pulse = 5.0 + Math.sin(elapsed * 6) * 0.9;

      ctx.save();
      // Draw in unrotated screen space so clamped coordinates align cleanly with radar edges
      if (mapRotation !== 0) ctx.rotate(-mapRotation);
      ctx.fillStyle = e.kind === 'target' ? '#ef4444' : '#facc15';
      ctx.beginPath();
      ctx.arc(clampedSx, clampedSy, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  // Player Directional Arrow at Center (World +Z = down, heading 0 = +Z)
  ctx.save();
  ctx.rotate(-playerHeading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 7.8);
  ctx.lineTo(-5.3, -5.0);
  ctx.lineTo(0, -2.3);
  ctx.lineTo(5.3, -5.0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // end world transform

  // Compass North Indicator ('N'): top-center in North-Up, orbits perimeter in Heading-Up
  const northDirX = Math.sin(mapRotation);
  const northDirY = -Math.cos(mapRotation);
  const [nEdgeX, nEdgeY] =
    orientationMode === 'heading-up'
      ? clampToBoxRay(northDirX * 1000, northDirY * 1000, Math.max(10, cx - 10), Math.max(10, cy - 10))
      : [0, -(cy - 9)];

  const nPosX = cx + nEdgeX;
  const nPosY = cy + nEdgeY;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  ctx.fillRect(nPosX - 7.5, nPosY - 6.5, 15, 13);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', nPosX, nPosY + 0.5);

  // Police Flashing Radar Perimeter
  if (wantedFlashing || (options.wantedStars ?? 0) > 0) {
    const flash = Math.sin(elapsed * 12) > 0;
    ctx.strokeStyle = flash ? 'rgba(59, 130, 246, 0.9)' : 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  ctx.restore();
}

