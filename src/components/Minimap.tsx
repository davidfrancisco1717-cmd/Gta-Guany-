import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/game';
import { drawMinimap } from '../game/minimap';
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
  const [wideView, setWideView] = useState(false);
  const wideViewRef = useRef(wideView);
  wideViewRef.current = wideView;

  // Allow keyboard 'M' to toggle radar zoom between Street (1x) and City Wide (0.5x)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM' && hud.phase === 'playing') {
        setWideView((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hud.phase]);

  // Real-time 60fps radar render loop reading live player position directly from GameEngine
  useEffect(() => {
    if (hud.phase !== 'playing') return;

    let rafId = 0;
    const renderLoop = () => {
      const canvas = canvasRef.current;
      if (canvas) {
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
          },
        );
      }
      rafId = requestAnimationFrame(renderLoop);
    };

    rafId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafId);
  }, [engine, hud.phase]);

  return (
    <div
      className={`relative rounded-lg overflow-hidden border-2 border-neutral-800 bg-neutral-950 shadow-lg pointer-events-auto ${sizeClassName}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
      <button
        type="button"
        onClick={() => setWideView((v) => !v)}
        title="Alternar zoom do minimapa (M)"
        aria-label="Alternar zoom do minimapa"
        className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-neutral-950/85 border border-white/15 font-mono-num text-[10px] font-bold text-neutral-200 hover:text-amber-300 cursor-pointer"
      >
        {wideView ? '0.5x' : '1x'}
      </button>
    </div>
  );
};
