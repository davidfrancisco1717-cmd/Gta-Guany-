import { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/game';
import { HudSnapshot } from './game/types';
import { Interface } from './components/Interface';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    try {
      const engine = new GameEngine(mount, (snapshot) => {
        setHud(snapshot);
      });
      engineRef.current = engine;
      return () => {
        engine.dispose();
        engineRef.current = null;
      };
    } catch (err) {
      setWebglError(err instanceof Error ? err.message : 'Erro ao inicializar WebGL 3D.');
    }
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-neutral-950">
      {/* Isolated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {/* Fallback if WebGL unavailable */}
      {webglError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950 p-6">
          <div className="max-w-md bg-neutral-900 border border-white/15 rounded-xl p-6 text-center">
            <h1 className="font-display text-xl font-bold text-white">WebGL Indisponível</h1>
            <p className="text-sm text-neutral-400 mt-2">{webglError}</p>
          </div>
        </div>
      )}

      {/* Semantic DOM HUD Overlay */}
      <Interface engine={engineRef.current} hud={hud} />
    </div>
  );
}
