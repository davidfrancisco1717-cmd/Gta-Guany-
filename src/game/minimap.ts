import { MinimapEntity } from './types';
import { ROAD_COORDS, ROAD_WIDTH } from './city';
import { BEACH_START_X, OCEAN_START_X } from './physics';

export interface MinimapRenderOptions {
  zoom?: number; // world-to-pixel multiplier (default 0.88)
  cameraYaw?: number;
  speedKmh?: number;
  wantedStars?: number;
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
  const scale = Math.max(0.38, baseZoom - speedPullback);

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  // Radar dark terrain base
  ctx.fillStyle = '#151b24';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(cx, cy);

  const toMapX = (wx: number) => (wx - playerX) * scale;
  const toMapY = (wz: number) => (wz - playerZ) * scale;

  // Beach & Ocean on East
  ctx.fillStyle = '#9f8961';
  ctx.fillRect(toMapX(BEACH_START_X), -500, (OCEAN_START_X - BEACH_START_X) * scale, 1000);
  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(toMapX(OCEAN_START_X), -500, 600, 1000);

  // Beach Pier
  ctx.fillStyle = '#7c5d41';
  ctx.fillRect(toMapX(132), toMapY(24.2), 72 * scale, 7.6 * scale);

  // Central Park green block (x=7..53, z=-53..-7)
  ctx.fillStyle = '#225930';
  ctx.fillRect(toMapX(7), toMapY(-53), 46 * scale, 46 * scale);

  // Park Fountain Circle
  ctx.fillStyle = '#1d93b8';
  ctx.beginPath();
  ctx.arc(toMapX(30), toMapY(-30), 5.2 * scale, 0, Math.PI * 2);
  ctx.fill();

  // Road Grid
  ctx.fillStyle = '#313d4f';
  for (const rx of ROAD_COORDS) {
    ctx.fillRect(toMapX(rx - ROAD_WIDTH / 2), toMapY(-165), ROAD_WIDTH * scale, 330 * scale);
  }
  for (const rz of ROAD_COORDS) {
    ctx.fillRect(toMapX(-165), toMapY(rz - ROAD_WIDTH / 2), 330 * scale, ROAD_WIDTH * scale);
  }

  // Subtle Road Centerlines
  ctx.strokeStyle = 'rgba(230, 184, 53, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const rx of ROAD_COORDS) {
    const mx = toMapX(rx);
    ctx.moveTo(mx, toMapY(-165));
    ctx.lineTo(mx, toMapY(165));
  }
  for (const rz of ROAD_COORDS) {
    const my = toMapY(rz);
    ctx.moveTo(toMapX(-165), my);
    ctx.lineTo(toMapX(165), my);
  }
  ctx.stroke();

  // City Block Footprints
  ctx.fillStyle = '#222b38';
  for (const bx of [-90, -30, 30, 90]) {
    for (const bz of [-90, -30, 30, 90]) {
      if (bx === 30 && bz === -30) continue;
      ctx.fillRect(toMapX(bx - 21), toMapY(bz - 21), 42 * scale, 42 * scale);
    }
  }

  // Camera Sight Cone behind player arrow
  if (options.cameraYaw !== undefined) {
    ctx.save();
    // Camera looks toward (-sin(yaw), -cos(yaw)) in world XZ
    const lookAngle = Math.atan2(-Math.sin(options.cameraYaw), -Math.cos(options.cameraYaw));
    ctx.rotate(-lookAngle);
    const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 34, Math.PI / 2 - 0.45, Math.PI / 2 + 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Entities (Vehicles, Police, Shops, Gas, Missions, Waypoints)
  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const ex = toMapX(e.x);
    const ey = toMapY(e.z);

    if (e.kind === 'traffic' || e.kind === 'parked') {
      ctx.fillStyle = e.kind === 'parked' ? '#7c8ba1' : '#cbd5e1';
      ctx.fillRect(ex - 2, ey - 2, 4, 4);
    } else if (e.kind === 'police') {
      const flashBlue = Math.sin(elapsed * 16) > 0;
      ctx.fillStyle = flashBlue ? '#3b82f6' : '#ef4444';
      ctx.beginPath();
      ctx.arc(ex, ey, 3.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    } else if (e.kind === 'gas') {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(ex - 4.5, ey - 4.5, 9, 9);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', ex, ey + 0.5);
    } else if (e.kind === 'shop') {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(ex - 4.5, ey - 4.5, 9, 9);
      ctx.fillStyle = '#052e16';
      ctx.font = 'bold 7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', ex, ey + 0.5);
    } else if (e.kind === 'mission') {
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(ex, ey, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#082f49';
      ctx.font = 'bold 7px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', ex, ey + 0.5);
    } else if (e.kind === 'checkpoint' || e.kind === 'target') {
      // Clamp active objective onto radar rim if outside viewport
      const maxX = cx - 10;
      const maxY = cy - 10;
      const clampedX = Math.max(-maxX, Math.min(maxX, ex));
      const clampedY = Math.max(-maxY, Math.min(maxY, ey));
      const pulse = 5.2 + Math.sin(elapsed * 6) * 1.1;

      ctx.fillStyle = e.kind === 'target' ? '#ef4444' : '#facc15';
      ctx.beginPath();
      ctx.arc(clampedX, clampedY, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  // Player Directional Arrow at Center (World +Z = down, heading 0 = +Z)
  ctx.save();
  ctx.rotate(-playerHeading);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, 7.5);
  ctx.lineTo(-5.2, -5.2);
  ctx.lineTo(0, -2.5);
  ctx.lineTo(5.2, -5.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // North Indicator ('N') pinned at top-center edge
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(cx - 8, 2, 16, 13);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 9px JetBrains Mono, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, 9);

  // Police Flashing Radar Perimeter
  if (wantedFlashing || (options.wantedStars ?? 0) > 0) {
    const flash = Math.sin(elapsed * 12) > 0;
    ctx.strokeStyle = flash ? 'rgba(59, 130, 246, 0.9)' : 'rgba(239, 68, 68, 0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  }

  ctx.restore();
}
