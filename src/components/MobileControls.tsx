import React, { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
    if (!hud.inVehicle) {
      engine.mobileInput.gasHeld = false;
      engine.mobileInput.brakeHeld = false;
      engine.mobileInput.reverseHeld = false;
      engine.mobileInput.handbrakeHeld = false;
      engine.mobileInput.steerLeftHeld = false;
      engine.mobileInput.steerRightHeld = false;
      engine.mobileInput.hornHeld = false;
    }
  }, [engine, hud.inVehicle]);

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

  const bindHold = (
    setter: (held: boolean) => void,
  ) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failures in synthetic test dispatch
      }
      setter(true);
    },
    onPointerUp: () => setter(false),
    onPointerCancel: () => setter(false),
    onLostPointerCapture: () => setter(false),
  });

  return (
    <div className="absolute inset-0 pointer-events-none z-20 select-none">
      {/* Right-Half Invisible Camera Look Pad */}
      <div
        className="absolute top-14 right-0 bottom-40 left-1/2 pointer-events-auto touch-none"
        onPointerDown={onLookPointerDown}
        onPointerMove={onLookPointerMove}
        onPointerUp={onLookPointerUp}
        onPointerCancel={onLookPointerUp}
      />

      {/* Left Zone: Steer Buttons in Vehicle OR Virtual Stick On Foot */}
      {hud.inVehicle ? (
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 flex items-center gap-2.5 pointer-events-auto touch-none">
          <button
            type="button"
            aria-label="Virar Esquerda"
            {...bindHold((held) => {
              engine.mobileInput.steerLeftHeld = held;
            })}
            className="w-16 h-14 rounded-xl bg-neutral-950/85 text-white font-display text-xs font-bold border border-white/25 active:scale-95 active:bg-amber-400 active:text-neutral-950 touch-none"
          >
            ◀ ESQ
          </button>
          <button
            type="button"
            aria-label="Virar Direita"
            {...bindHold((held) => {
              engine.mobileInput.steerRightHeld = held;
            })}
            className="w-16 h-14 rounded-xl bg-neutral-950/85 text-white font-display text-xs font-bold border border-white/25 active:scale-95 active:bg-amber-400 active:text-neutral-950 touch-none"
          >
            DIR ▶
          </button>
        </div>
      ) : (
        <div
          className="absolute bottom-4 left-3 sm:bottom-6 sm:left-5 w-28 h-28 rounded-full bg-neutral-950/65 border border-white/20 flex items-center justify-center pointer-events-auto touch-none"
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
      )}

      {/* Right Thumb Ergonomic Action Cluster (Safe Android Landscape Margins) */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 flex flex-col items-end gap-2 pointer-events-auto">
        <div className="flex items-center gap-2">
          {hud.inVehicle && (
            <button
              type="button"
              onPointerDown={() => engine.triggerMobileAction('toggleCamera')}
              className="h-10 px-3 rounded-xl bg-neutral-900/90 text-sky-300 font-display text-[11px] font-bold border border-white/25 active:scale-95"
            >
              {hud.cameraMode === 'cockpit' ? 'Ext.' : 'Interior'}
            </button>
          )}
          {hud.interactPrompt && (
            <button
              type="button"
              onPointerDown={() => engine.triggerMobileAction('interact')}
              className="min-w-[48px] h-10 px-3 rounded-xl bg-sky-500 text-neutral-950 font-display text-xs font-bold border border-white/30 active:scale-95"
            >
              Interagir
            </button>
          )}
          <button
            type="button"
            onPointerDown={() => engine.triggerMobileAction('enterExit')}
            className="min-w-[54px] h-10 px-3.5 rounded-xl bg-neutral-900/90 text-white font-display text-xs font-bold border border-white/25 active:scale-95"
          >
            {hud.inVehicle ? 'Sair' : 'Entrar'}
          </button>
        </div>

        {hud.inVehicle ? (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                {...bindHold((held) => {
                  engine.mobileInput.hornHeld = held;
                })}
                className="h-10 px-3 rounded-xl bg-neutral-900/90 text-amber-300 font-display text-[11px] font-bold border border-white/25 active:scale-95 touch-none"
              >
                Buzina
              </button>
              <button
                type="button"
                {...bindHold((held) => {
                  engine.mobileInput.handbrakeHeld = held;
                })}
                className="h-10 px-3 rounded-xl bg-amber-500/90 text-neutral-950 font-display text-[11px] font-bold border border-white/30 active:scale-95 touch-none"
              >
                T. Mão
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Marcha Atrás"
                {...bindHold((held) => {
                  engine.mobileInput.reverseHeld = held;
                })}
                className="w-13 h-13 rounded-xl bg-orange-600/95 text-white font-display text-xs font-bold border border-white/30 active:scale-95 touch-none"
              >
                RÉ
              </button>
              <button
                type="button"
                aria-label="Travar"
                {...bindHold((held) => {
                  engine.mobileInput.brakeHeld = held;
                })}
                className="w-15 h-13 rounded-xl bg-rose-600/95 text-white font-display text-xs font-bold border border-white/30 active:scale-95 touch-none"
              >
                Travar
              </button>
              <button
                type="button"
                aria-label="Acelerar"
                {...bindHold((held) => {
                  engine.mobileInput.gasHeld = held;
                })}
                className="w-16 h-14 rounded-xl bg-emerald-500/95 text-neutral-950 font-display text-xs font-bold border border-white/40 active:scale-95 touch-none"
              >
                Acelerar
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              {...bindHold((held) => {
                engine.mobileInput.sprintHeld = held;
              })}
              className="w-12 h-12 rounded-xl bg-neutral-900/90 text-white font-display text-xs font-bold border border-white/25 active:scale-95 touch-none"
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
              className="w-15 h-15 rounded-full bg-amber-400 text-neutral-950 font-display text-xs font-bold border-2 border-white/50 active:scale-95"
            >
              Atacar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
