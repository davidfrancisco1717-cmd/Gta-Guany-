import React, { useRef, useState } from 'react';
import { GameEngine } from '../game/game';
import { HudSnapshot } from '../game/types';

interface MobileControlsProps {
  engine: GameEngine;
  hud: HudSnapshot;
}

export const MobileControls: React.FC<MobileControlsProps> = ({ engine, hud }) => {
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });
  const stickPointerId = useRef<number | null>(null);
  const stickOrigin = useRef({ x: 0, y: 0 });

  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  const maxRadius = 40;

  const onStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (stickPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    stickPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    stickOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateStick(e.clientX, e.clientY);
  };

  const updateStick = (cx: number, cy: number) => {
    const dx = cx - stickOrigin.current.x;
    const dy = cy - stickOrigin.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);
    const ox = Math.cos(angle) * clamped;
    const oy = Math.sin(angle) * clamped;
    setStickOffset({ x: ox, y: oy });
    engine.mobileInput.moveX = ox / maxRadius;
    engine.mobileInput.moveY = -oy / maxRadius;
  };

  const onStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== stickPointerId.current) return;
    updateStick(e.clientX, e.clientY);
  };

  const onStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== stickPointerId.current) return;
    stickPointerId.current = null;
    setStickOffset({ x: 0, y: 0 });
    engine.mobileInput.moveX = 0;
    engine.mobileInput.moveY = 0;
  };

  const onLookPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (lookPointerId.current !== null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
  };

  const onLookPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current) return;
    const dx = e.clientX - lastLookPos.current.x;
    const dy = e.clientY - lastLookPos.current.y;
    lastLookPos.current = { x: e.clientX, y: e.clientY };
    engine.mobileInput.lookDeltaX += dx * 1.4;
    engine.mobileInput.lookDeltaY += dy * 1.2;
  };

  const onLookPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current) return;
    lookPointerId.current = null;
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      {/* Right-Half Invisible Camera Look Pad */}
      <div
        className="absolute top-14 right-0 bottom-40 left-1/2 pointer-events-auto touch-none"
        onPointerDown={onLookPointerDown}
        onPointerMove={onLookPointerMove}
        onPointerUp={onLookPointerUp}
        onPointerCancel={onLookPointerUp}
      />

      {/* Left Virtual Movement / Steering Joystick */}
      <div
        className="absolute bottom-28 left-4 sm:left-6 w-28 h-28 rounded-full bg-neutral-950/65 border border-white/20 flex items-center justify-center pointer-events-auto touch-none"
        onPointerDown={onStickPointerDown}
        onPointerMove={onStickPointerMove}
        onPointerUp={onStickPointerUp}
        onPointerCancel={onStickPointerUp}
      >
        <div
          className="w-12 h-12 rounded-full bg-amber-400/90 border-2 border-white shadow-lg transition-transform duration-75"
          style={{ transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)` }}
        />
      </div>

      {/* Right Thumb Ergonomic Action Cluster */}
      <div className="absolute bottom-4 right-4 sm:right-6 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          {hud.interactPrompt && (
            <button
              type="button"
              onPointerDown={() => engine.triggerMobileAction('interact')}
              className="min-w-[48px] h-12 px-3.5 rounded-xl bg-sky-500 text-neutral-950 font-display text-xs font-bold border border-white/30 active:scale-95"
            >
              Interagir
            </button>
          )}
          <button
            type="button"
            onPointerDown={() => engine.triggerMobileAction('enterExit')}
            className="min-w-[54px] h-12 px-3.5 rounded-xl bg-neutral-900/90 text-white font-display text-xs font-bold border border-white/25 active:scale-95"
          >
            {hud.inVehicle ? 'Sair' : 'Entrar'}
          </button>
        </div>

        {hud.inVehicle ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onPointerDown={() => {
                engine.mobileInput.hornHeld = true;
              }}
              onPointerUp={() => {
                engine.mobileInput.hornHeld = false;
              }}
              onPointerCancel={() => {
                engine.mobileInput.hornHeld = false;
              }}
              className="w-12 h-12 rounded-xl bg-neutral-900/90 text-amber-300 font-display text-xs font-bold border border-white/25 active:scale-95"
            >
              Buzina
            </button>
            <button
              type="button"
              onPointerDown={() => {
                engine.mobileInput.brakeHeld = true;
              }}
              onPointerUp={() => {
                engine.mobileInput.brakeHeld = false;
              }}
              onPointerCancel={() => {
                engine.mobileInput.brakeHeld = false;
              }}
              className="w-16 h-14 rounded-xl bg-rose-600/90 text-white font-display text-xs font-bold border border-white/30 active:scale-95"
            >
              Travar
            </button>
            <button
              type="button"
              onPointerDown={() => {
                engine.mobileInput.gasHeld = true;
              }}
              onPointerUp={() => {
                engine.mobileInput.gasHeld = false;
              }}
              onPointerCancel={() => {
                engine.mobileInput.gasHeld = false;
              }}
              className="w-16 h-16 rounded-xl bg-emerald-500/95 text-neutral-950 font-display text-xs font-bold border border-white/40 active:scale-95"
            >
              Acelerar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onPointerDown={() => {
                engine.mobileInput.sprintHeld = true;
              }}
              onPointerUp={() => {
                engine.mobileInput.sprintHeld = false;
              }}
              onPointerCancel={() => {
                engine.mobileInput.sprintHeld = false;
              }}
              className="w-12 h-12 rounded-xl bg-neutral-900/90 text-white font-display text-xs font-bold border border-white/25 active:scale-95"
            >
              Correr
            </button>
            <button
              type="button"
              onPointerDown={() => engine.triggerMobileAction('jump')}
              className="w-12 h-12 rounded-xl bg-neutral-900/90 text-white font-display text-xs font-bold border border-white/25 active:scale-95"
            >
              Saltar
            </button>
            <button
              type="button"
              onPointerDown={() => engine.triggerMobileAction('attack')}
              className="w-16 h-16 rounded-full bg-amber-400 text-neutral-950 font-display text-xs font-bold border-2 border-white/50 active:scale-95"
            >
              Atacar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
