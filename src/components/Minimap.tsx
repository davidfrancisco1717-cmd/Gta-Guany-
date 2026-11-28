import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/game';
import {
  MinimapOrientationMode,
  drawMinimap,
  getWorldCompassInfo,
} from '../game/minimap';
import { HudSnapshot } from '../game/types';

interface MinimapProps {
  engine: GameEngine;
  hud: HudSnapshot;
  sizeClassName?: string;
}

export const Minimap: React.FC<MinimapProps> = ({
  engine,
  hud,
  sizeClassName = 'w-[128px] h-[128px] sm:w-[156px] sm:h-[156px]',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bearingRef = useRef<HTMLSpanElement | null>(null);
  const coordsRef = useRef<HTMLSpanElement | null>(null);
  const lastTelemetryRef = useRef({ x: NaN, z: NaN, deg: NaN });

  const [wideView, setWideView] = useState(false);
  const [orientationMode, setOrientationMode] = useState<MinimapOrientationMode>('north-up');
  const wideViewRef = useRef(wideView);
  const orientationModeRef = useRef(orientationMode);
  wideViewRef.current = wideView;
  orientationModeRef.current = orientationMode;

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const live = engine.getLiveMinimapState();

    drawMinimap(
      canvas,
      live.playerX,
      live.playerZ,
      live.playerHeading,
      live.entities,
      live.wantedFlashing,
      live.elapsed,
      {
        zoom: wideViewRef.current ? 0.5 : 0.9,
        cameraYaw: live.cameraYaw,
        speedKmh: live.speedKmh,
        wantedStars: live.wantedStars,
        orientationMode: orientationModeRef.current,
      },
    );

    const rx = Math.round(live.playerX);
    const rz = Math.round(live.playerZ);
    const compass = getWorldCompassInfo(live.playerHeading);

    if (
      lastTelemetryRef.current.x !== rx ||
      lastTelemetryRef.current.z !== rz ||
      lastTelemetryRef.current.deg !== compass.degrees
    ) {
      lastTelemetryRef.current = { x: rx, z: rz, deg: compass.degrees };
      if (bearingRef.current) {
        bearingRef.current.textContent = `${compass.cardinal} ${compass.degrees.toString().padStart(3, '0')}°`;
      }
      if (coordsRef.current) {
        coordsRef.current.textContent = `${rx},${rz}`;
      }
    }
  }, [engine]);

  // Keyboard shortcuts: 'M' toggles radar zoom (1x / 0.5x), 'N' toggles orientation (North-Up / Heading-Up)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (hud.phase !== 'playing') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'KeyM') {
        setWideView((prev) => !prev);
      } else if (e.code === 'KeyN') {
        setOrientationMode((prev) => (prev === 'north-up' ? 'heading-up' : 'north-up'));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.phase]);

  // Real-time 60fps radar render loop reading live player position & orientation from GameEngine
  useEffect(() => {
    renderFrame();
    if (hud.phase !== 'playing') return;

    let rafId = 0;
    const renderLoop = () => {
      renderFrame();
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [hud.phase, wideView, orientationMode, renderFrame]);

  // Redraw immediately when container resizes (e.g. mobile <-> desktop layout change)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => renderFrame());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [renderFrame]);

  const initialCompass = getWorldCompassInfo(hud.playerHeading);

  return (
    <div
      className={`relative rounded-lg overflow-hidden border-2 border-neutral-800 bg-neutral-950 shadow-lg pointer-events-auto flex flex-col ${sizeClassName}`}
      aria-label="Minimapa de localização"
    >
      <div className="relative flex-1 min-h-0 w-full">
        <canvas ref={canvasRef} className="w-full h-full block" />
        <div className="absolute bottom-1 right-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setOrientationMode((m) => (m === 'north-up' ? 'heading-up' : 'north-up'))
            }
            title="Alternar orientação do radar: Norte fixo / Rotação com jogador (N)"
            aria-label="Alternar orientação do minimapa"
            className={`px-1.5 py-0.5 rounded bg-neutral-950/88 border border-white/15 font-mono-num text-[9px] font-bold cursor-pointer transition-colors ${
              orientationMode === 'heading-up'
                ? 'text-amber-300 border-amber-400/40'
                : 'text-neutral-200 hover:text-amber-300'
            }`}
          >
            {orientationMode === 'north-up' ? 'N↑' : 'HDG'}
          </button>
          <button
            type="button"
            onClick={() => setWideView((v) => !v)}
            title="Alternar zoom do minimapa (M)"
            aria-label="Alternar zoom do minimapa"
            className="px-1.5 py-0.5 rounded bg-neutral-950/88 border border-white/15 font-mono-num text-[9px] font-bold text-neutral-200 hover:text-amber-300 cursor-pointer transition-colors"
          >
            {wideView ? '0.5x' : '1x'}
          </button>
        </div>
      </div>

      {/* Live World Orientation & Coordinate Footer (tabular numerals) */}
      <div className="h-[20px] shrink-0 px-1.5 bg-neutral-950 border-t border-white/10 flex items-center justify-between gap-1 font-mono-num tabular-nums text-[9px] leading-none text-neutral-300 select-none">
        <span ref={bearingRef} className="font-bold text-amber-400 whitespace-nowrap">
          {initialCompass.cardinal} {initialCompass.degrees.toString().padStart(3, '0')}°
        </span>
        <span ref={coordsRef} className="text-neutral-300 whitespace-nowrap truncate">
          {Math.round(hud.playerX)},{Math.round(hud.playerZ)}
        </span>
      </div>
    </div>
  );
};

