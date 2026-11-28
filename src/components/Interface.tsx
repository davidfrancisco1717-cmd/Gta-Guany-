import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  BatteryCharging,
  Camera,
  Car,
  CloudSun,
  Crosshair,
  Gamepad2,
  Home,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Save,
  Settings,
  Shield,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  Wifi,
  Wrench,
  X,
} from 'lucide-react';
import { GameEngine } from '../game/game';
import { GraphicsQuality, HudSnapshot, QUALITY_PRESETS, VEHICLE_SPECS, VehicleKind } from '../game/types';
import { Minimap } from './Minimap';
import { MobileControls } from './MobileControls';

interface InterfaceProps {
  engine: GameEngine | null;
  hud: HudSnapshot | null;
}

type PauseTab = 'missions' | 'inventory' | 'graphics' | 'controls';
type PhoneApp = 'home' | 'missions' | 'services' | 'shop' | 'weather' | 'settings';

export const Interface: React.FC<InterfaceProps> = ({ engine, hud }) => {
  const [pauseTab, setPauseTab] = useState<PauseTab>('missions');
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneApp, setPhoneApp] = useState<PhoneApp>('home');
  const [importKind, setImportKind] = useState<VehicleKind>('mustang');
  const [mustangUrl, setMustangUrl] = useState('');

  useEffect(() => {
    if (!engine || !hud) return;
    const onKey = (e: KeyboardEvent) => {
      if (hud.phase === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        engine.startGame();
      } else if (hud.phase === 'playing' && e.code === 'KeyT') {
        e.preventDefault();
        setPhoneOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine, hud]);

  if (!engine || !hud) return null;

  // TITLE SCREEN
  if (hud.phase === 'title') {
    return (
      <div className="absolute inset-0 z-30 flex items-center pointer-events-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/90 via-neutral-950/55 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-xl px-8 sm:px-14 py-8 flex flex-col items-start gap-6">
          {/* Bespoke inline SVG Title Lockup */}
          <div className="flex flex-col gap-2">
            <svg
              viewBox="0 0 360 74"
              className="w-72 sm:w-88 h-auto"
              role="img"
              aria-label="San Verde 3D"
            >
              <defs>
                <linearGradient id="svGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <rect x="0" y="6" width="6" height="58" rx="2" fill="url(#svGrad)" />
              <text
                x="18"
                y="46"
                fill="#ffffff"
                fontFamily="Chakra Petch, sans-serif"
                fontWeight="700"
                fontSize="42"
                letterSpacing="2"
              >
                SAN VERDE
              </text>
              <text
                x="20"
                y="65"
                fill="#fbbf24"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="700"
                fontSize="13"
                letterSpacing="4"
              >
                MUNDO ABERTO 3D
              </text>
            </svg>
            <p className="text-sm sm:text-base text-neutral-300 max-w-md leading-relaxed">
              Explora a cidade costeira, conduz carros desportivos e motos, foge às perseguições policiais e completa missões pelas avenidas.
            </p>
          </div>

          {/* Quality Quick Selector */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-neutral-400">Qualidade Gráfica</span>
            <div className="flex items-center gap-1.5 p-1 bg-neutral-900/90 border border-white/15 rounded-lg">
              {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => engine.setQuality(q)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    hud.quality === q
                      ? 'bg-amber-400 text-neutral-950'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {QUALITY_PRESETS[q].label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => engine.startGame()}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-display text-base font-bold tracking-wide transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              Entrar na Cidade
            </button>
            <button
              type="button"
              onClick={() => engine.toggleTouchControls()}
              className={`inline-flex items-center gap-2 px-4 py-3.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                hud.touchControlsEnabled
                  ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                  : 'bg-neutral-900/85 border-white/15 text-neutral-300 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              {hud.touchControlsEnabled ? 'Controlos Táteis: Ligados' : 'Controlos Táteis'}
            </button>
          </div>

          <div className="text-xs text-neutral-400 font-mono-num">
            WASD Mover/Conduzir · F Veículo · C Câmara · G Garagem · E Interagir · T Telemóvel · Esc Pausa
          </div>
        </div>
      </div>
    );
  }

  const activeMission = hud.mission.activeMissionId
    ? hud.availableMissions.find((m) => m.id === hud.mission.activeMissionId)
    : null;
  const activeStep = activeMission?.steps[hud.mission.currentStepIndex];

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* Top-Left Compact Utility Actions + Contextual Interaction Box */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col items-start gap-2">
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={() => engine.togglePause()}
            aria-label="Menu de Pausa"
            className="h-9 px-3 rounded-md bg-neutral-950/90 border border-white/15 text-white hover:bg-neutral-900 inline-flex items-center gap-2 text-xs font-semibold cursor-pointer"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Menu</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setPhoneOpen((prev) => !prev);
            }}
            aria-label="Telemóvel iFruit (T)"
            title="Telemóvel iFruit (T)"
            className={`h-9 px-2.5 rounded-md border inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              phoneOpen
                ? 'bg-amber-400 border-amber-300 text-neutral-950'
                : 'bg-neutral-950/90 border-white/15 text-white hover:bg-neutral-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Telemóvel</span>
          </button>
          <button
            type="button"
            onClick={() => engine.toggleMute()}
            aria-label={hud.muted ? 'Ativar Som' : 'Silenciar Som'}
            className="w-9 h-9 rounded-md bg-neutral-950/90 border border-white/15 text-white hover:bg-neutral-900 inline-flex items-center justify-center cursor-pointer"
          >
            {hud.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => engine.toggleTouchControls()}
            aria-label="Alternar Controlos Táteis"
            className={`w-9 h-9 rounded-md border inline-flex items-center justify-center cursor-pointer ${
              hud.touchControlsEnabled
                ? 'bg-sky-500/25 border-sky-400/60 text-sky-200'
                : 'bg-neutral-950/90 border-white/15 text-neutral-300 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => engine.openGarage()}
            aria-label="Abrir Garagem (G)"
            title="Garagem & Veículos (G)"
            className={`h-9 px-2.5 rounded-md border inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
              hud.garageOpen || hud.inGarageZone
                ? 'bg-violet-500 border-violet-300 text-white'
                : 'bg-neutral-950/90 border-white/15 text-white hover:bg-neutral-900'
            }`}
          >
            <Car className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Garagem</span>
          </button>
          {hud.inVehicle && !hud.touchControlsEnabled && (
            <button
              type="button"
              onClick={() => engine.toggleVehicleCameraMode()}
              aria-label="Alternar Câmara (C)"
              title="Alternar Câmara Exterior / Interior (C)"
              className="h-9 px-2.5 rounded-md bg-neutral-950/90 border border-white/15 text-sky-300 hover:bg-neutral-900 hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{hud.cameraMode === 'cockpit' ? 'Interior' : 'Exterior'}</span>
            </button>
          )}
        </div>

        {/* GTA-Style Top-Left Contextual Prompt (desktop only here; mobile sits bottom-center) */}
        {!hud.touchControlsEnabled && hud.interactPrompt && (
          <div className="max-w-xs bg-neutral-950/90 border border-white/20 rounded-md px-3.5 py-2 text-xs sm:text-sm font-medium text-white shadow-lg">
            {hud.interactPrompt}
          </div>
        )}
      </div>

      {/* Top-Right Classic GTA Status Cluster: Stars + Outlined Green Cash + District/Time */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex flex-col items-end gap-1.5">
        <div className="flex items-center gap-1" aria-label={`Procurado ${hud.wantedStars} estrelas`}>
          {[1, 2, 3, 4, 5].map((star) => {
            const active = star <= hud.wantedStars;
            return (
              <svg
                key={star}
                viewBox="0 0 20 20"
                className={`w-5 h-5 sm:w-6 sm:h-6 drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] ${
                  active
                    ? hud.wantedFlashing
                      ? 'text-sky-400 opacity-75'
                      : 'text-white'
                    : 'text-neutral-900/70 stroke-white/40'
                }`}
                fill="currentColor"
                strokeWidth={active ? 0 : 1.2}
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.447a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.367-2.447a1 1 0 00-1.175 0l-3.367 2.447c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.075 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
              </svg>
            );
          })}
        </div>

        <div className="font-display font-mono-num text-2xl sm:text-3xl font-bold text-emerald-400 leading-none tracking-tight [text-shadow:0_2px_0_#000,1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000]">
          ${hud.cash}
        </div>

        <div className="text-[11px] font-semibold text-neutral-100 [text-shadow:0_1px_2px_rgba(0,0,0,0.95)]">
          {hud.district} · {hud.timeOfDayLabel}
        </div>

        {/* Equipped Weapon Readout */}
        {!hud.inVehicle && (
          <div className="bg-neutral-950/90 border border-white/15 rounded-md px-2.5 py-1 flex items-center gap-1.5 text-xs pointer-events-auto">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-semibold text-white">
              {hud.equippedWeapon === 'fists'
                ? 'Punhos'
                : hud.equippedWeapon === 'bat'
                  ? 'Bastão'
                  : `Pistola (${hud.inventory.find((i) => i.id === 'pistol')?.ammo ?? 0})`}
            </span>
          </div>
        )}

        {/* Active Mission Objective */}
        {activeMission && (
          <div className="max-w-xs bg-neutral-950/92 border border-amber-400/45 rounded-md px-3.5 py-2 text-right mt-1">
            <div className="flex items-center justify-end gap-2 text-xs font-bold text-amber-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>{activeMission.title}</span>
            </div>
            <p className="text-xs text-neutral-200 mt-1">
              {activeMission.type === 'action'
                ? `Alvos restantes: ${hud.mission.targetsRemaining}`
                : activeStep?.label}
            </p>
            {activeMission.timeLimitSec && (
              <div className="font-mono-num text-xs font-bold text-rose-400 mt-1">
                {Math.max(0, Math.ceil(hud.mission.timeRemaining))}s
              </div>
            )}
          </div>
        )}
      </div>

      {/* Real-Time Minimap & Classic 3-Segment Vitals Bar (Green / Blue / Yellow) */}
      {hud.touchControlsEnabled ? (
        <div className="absolute top-14 left-3 sm:top-16 sm:left-4 flex flex-col gap-1">
          <Minimap
            engine={engine}
            hud={hud}
            sizeClassName="w-[104px] h-[104px] sm:w-[132px] sm:h-[132px]"
          />
          <div className="w-[104px] sm:w-[132px] bg-neutral-950/95 border border-neutral-800 rounded-sm p-1 grid grid-cols-3 gap-1">
            <div className="h-1.5 bg-neutral-800 overflow-hidden" title="Vida">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100))}%` }}
              />
            </div>
            <div className="h-1.5 bg-neutral-800 overflow-hidden" title="Proteção">
              <div
                className="h-full bg-sky-400 transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, hud.armor))}%` }}
              />
            </div>
            <div className="h-1.5 bg-neutral-800 overflow-hidden" title="Energia">
              <div
                className="h-full bg-amber-400 transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 flex flex-col gap-1">
          <Minimap
            engine={engine}
            hud={hud}
            sizeClassName="w-[144px] h-[144px] sm:w-[172px] sm:h-[172px]"
          />
          <div className="w-[144px] sm:w-[172px] bg-neutral-950/95 border border-neutral-800 rounded-sm p-1 grid grid-cols-3 gap-1">
            <div className="h-2 bg-neutral-800 overflow-hidden" title="Vida">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100))}%` }}
              />
            </div>
            <div className="h-2 bg-neutral-800 overflow-hidden" title="Proteção">
              <div
                className="h-full bg-sky-400 transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, hud.armor))}%` }}
              />
            </div>
            <div className="h-2 bg-neutral-800 overflow-hidden" title="Energia">
              <div
                className="h-full bg-amber-400 transition-all duration-150"
                style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Speedometer + Gear + RPM + Drift */}
      {hud.inVehicle && (
        <div
          className={`absolute bg-neutral-950/90 border border-white/15 rounded-lg px-3.5 py-2 flex items-center gap-3.5 ${
            hud.touchControlsEnabled
              ? 'left-1/2 -translate-x-1/2 bottom-3'
              : phoneOpen
                ? 'right-3 sm:right-60 bottom-4'
                : 'right-3 sm:right-4 bottom-4'
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-neutral-300">{hud.vehicleName}</span>
              {hud.isDrifting && (
                <span className="text-[10px] font-bold text-amber-300 font-mono-num">DRIFT</span>
              )}
            </div>
            <div className="w-24 h-1.5 bg-neutral-800 rounded-sm overflow-hidden mt-1">
              <div
                className={`h-full ${hud.vehicleHealth > 35 ? 'bg-amber-400' : 'bg-rose-500'}`}
                style={{ width: `${hud.vehicleHealth}%` }}
              />
            </div>
            <div className="w-24 h-1 bg-neutral-800 rounded-sm overflow-hidden mt-1" title="RPM">
              <div
                className="h-full bg-sky-400 transition-all duration-75"
                style={{ width: `${Math.round(hud.vehicleRpm * 100)}%` }}
              />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono-num text-xs font-bold text-sky-300">
              {hud.isReversing ? 'R' : `${hud.vehicleGear}ª`}
            </span>
            <span className="font-display font-mono-num text-2xl sm:text-3xl font-bold text-white leading-none">
              {hud.speedKmh}
            </span>
            <span className="text-[11px] font-semibold text-amber-400">km/h</span>
          </div>
        </div>
      )}

      {/* Bottom-Right Interactive iFruit-Style Smartphone */}
      {phoneOpen && hud.phase === 'playing' && (
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-[212px] rounded-[22px] border-[3px] border-neutral-700 bg-neutral-950 shadow-2xl overflow-hidden pointer-events-auto flex flex-col">
          {/* Speaker Notch */}
          <div className="bg-neutral-900 px-3 pt-1.5 pb-1 flex flex-col items-center gap-1 border-b border-white/10">
            <div className="w-10 h-1 rounded-full bg-neutral-700" />
            <div className="w-full flex items-center justify-between text-[10px] text-neutral-300 font-mono-num">
              <span className="flex items-center gap-1">
                <Wifi className="w-3 h-3 text-sky-400" />
                iFruit
              </span>
              <span>{hud.timeOfDayLabel}</span>
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>

          {/* Phone App Header */}
          <div className="bg-sky-700 px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wide">
              {phoneApp === 'home'
                ? 'Contatos & Apps'
                : phoneApp === 'missions'
                  ? 'Missões'
                  : phoneApp === 'services'
                    ? 'Serviços'
                    : phoneApp === 'shop'
                      ? 'Loja Rápida'
                      : phoneApp === 'weather'
                        ? 'Hora do Dia'
                        : 'Definições'}
            </span>
            <span className="font-mono-num text-[11px] font-bold text-emerald-200">${hud.cash}</span>
          </div>

          {/* Screen Body */}
          <div className="p-2.5 bg-neutral-950 min-h-[210px] max-h-[245px] overflow-y-auto flex flex-col gap-2">
            {phoneApp === 'home' && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {[
                  { id: 'missions' as const, label: 'Missões', icon: MapPin, bg: 'bg-amber-500 text-neutral-950' },
                  { id: 'services' as const, label: 'Serviços', icon: Car, bg: 'bg-sky-500 text-white' },
                  { id: 'shop' as const, label: 'Loja', icon: ShoppingBag, bg: 'bg-emerald-500 text-neutral-950' },
                  { id: 'weather' as const, label: 'Clima', icon: CloudSun, bg: 'bg-orange-500 text-white' },
                  { id: 'settings' as const, label: 'Opções', icon: Settings, bg: 'bg-neutral-700 text-white' },
                ].map((app) => {
                  const Icon = app.icon;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setPhoneApp(app.id)}
                      className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${app.bg}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-medium text-neutral-200">{app.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => engine.toggleMute()}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${hud.muted ? 'bg-rose-600 text-white' : 'bg-indigo-500 text-white'}`}>
                    {hud.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </div>
                  <span className="text-[10px] font-medium text-neutral-200">
                    {hud.muted ? 'Mudo' : 'Áudio'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhoneOpen(false);
                    engine.openGarage();
                  }}
                  className="flex flex-col items-center gap-1 p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-violet-600 text-white">
                    <Car className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium text-neutral-200">Garagem</span>
                </button>
              </div>
            )}

            {phoneApp === 'missions' && (
              <div className="flex flex-col gap-1.5">
                {hud.availableMissions.map((m) => {
                  const isActive = hud.mission.activeMissionId === m.id;
                  return (
                    <div key={m.id} className="p-2 rounded-lg bg-neutral-900 border border-white/10 flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-white truncate">{m.title}</span>
                        <span className="font-mono-num text-emerald-400 font-bold">+${m.reward}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isActive) engine.cancelMission();
                          else engine.startMissionById(m.id);
                        }}
                        className={`w-full py-1 rounded text-[11px] font-bold cursor-pointer ${
                          isActive ? 'bg-rose-600 text-white' : 'bg-amber-400 text-neutral-950'
                        }`}
                      >
                        {isActive ? 'Cancelar Missão' : 'Iniciar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {phoneApp === 'services' && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => engine.callMechanicSpawnCar()}
                  className="p-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-sky-500/40 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                    <span className="flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5" />
                      Mecânico: Lexus LC 500
                    </span>
                    <span className="font-mono-num">$100</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Entrega um carro desportivo ao teu lado.</p>
                </button>

                <button
                  type="button"
                  onClick={() => engine.bribePolice()}
                  className="p-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-amber-500/40 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Subornar Polícia
                    </span>
                    <span className="font-mono-num">$250</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 mt-0.5">Remove imediatamente todas as estrelas.</p>
                </button>
              </div>
            )}

            {phoneApp === 'shop' && (
              <div className="flex flex-col gap-1.5">
                {hud.inventory
                  .filter((i) => i.price > 0)
                  .map((item) => (
                    <div key={item.id} className="p-2 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-white truncate">{item.name}</div>
                        <div className="text-[10px] text-neutral-400 font-mono-num">
                          {item.ammo !== undefined ? `${item.ammo} mun.` : `x${item.quantity ?? 0}`}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => engine.useOrBuyItem(item.id, true)}
                        className="px-2 py-1 rounded bg-emerald-500 text-neutral-950 text-[10px] font-bold cursor-pointer shrink-0"
                      >
                        ${item.price}
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {phoneApp === 'weather' && (
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Manhã', val: 0.32 },
                  { label: 'Meio-Dia', val: 0.5 },
                  { label: 'Pôr do Sol', val: 0.705 },
                  { label: 'Noite', val: 0.04 },
                ].map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => engine.setTimeOfDay(t.val)}
                    className="py-2 px-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-[11px] font-semibold text-white cursor-pointer"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            {phoneApp === 'settings' && (
              <div className="flex flex-col gap-2">
                <span className="text-[10px] font-semibold text-neutral-400">Qualidade Gráfica</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => engine.setQuality(q)}
                      className={`py-1.5 rounded text-[10px] font-bold cursor-pointer ${
                        hud.quality === q ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-900 text-neutral-300'
                      }`}
                    >
                      {QUALITY_PRESETS[q].label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => engine.toggleMusic()}
                  className="py-1.5 px-2 rounded bg-neutral-900 border border-white/10 text-[11px] font-semibold text-white cursor-pointer"
                >
                  Música: {hud.musicEnabled ? 'Ligada' : 'Desligada'}
                </button>
              </div>
            )}
          </div>

          {/* Bottom Phone Navigation Bar */}
          <div className="bg-neutral-900 border-t border-white/10 px-4 py-1.5 flex items-center justify-between text-neutral-300">
            <button
              type="button"
              onClick={() => setPhoneApp('home')}
              aria-label="Voltar"
              className="p-1 hover:text-white cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPhoneApp('home')}
              aria-label="Início"
              className="p-1 hover:text-white cursor-pointer"
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPhoneOpen(false)}
              aria-label="Fechar telemóvel"
              className="p-1 hover:text-rose-400 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast & Mobile Interaction Banner */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 ${
          hud.touchControlsEnabled ? 'top-14' : 'bottom-6'
        }`}
      >
        {hud.toastMessage && (
          <div className="bg-neutral-950/92 border border-amber-400/40 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium text-amber-200 whitespace-nowrap">
            {hud.toastMessage}
          </div>
        )}
        {hud.touchControlsEnabled && hud.interactPrompt && (
          <div className="bg-neutral-950/92 border border-white/25 rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold text-white whitespace-nowrap">
            {hud.interactPrompt}
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      {hud.phase === 'playing' && !hud.garageOpen && hud.touchControlsEnabled && (
        <MobileControls engine={engine} hud={hud} />
      )}

      {/* GARAGE & VEHICLE SELECTOR MODAL */}
      {hud.phase === 'playing' && hud.garageOpen && (
        <div className="absolute inset-0 z-40 bg-neutral-950/88 flex items-center justify-center p-3 sm:p-5 pointer-events-auto">
          <div className="w-full max-w-4xl bg-neutral-900 border border-white/15 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-white/10 bg-neutral-950/60">
              <div className="flex items-center gap-3">
                <Car className="w-5 h-5 text-violet-400" />
                <h2 className="font-display text-base sm:text-lg font-bold text-white">
                  Garagem & Frota de Veículos
                </h2>
                <span className="font-mono-num text-sm font-semibold text-emerald-400">${hud.cash}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => engine.saveActiveVehicleToGarage()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Guardar Veículo
                </button>
                <button
                  type="button"
                  onClick={() => engine.repairActiveVehicle()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-300 text-xs font-bold border border-white/10 cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Reparar $50
                </button>
                <button
                  type="button"
                  onClick={() => engine.closeGarage()}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  aria-label="Fechar Garagem"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-5">
              {/* Saved Garage Slots */}
              {hud.savedVehicles.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-2">
                    Veículos Guardados ({hud.savedVehicles.length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {hud.savedVehicles.map((slot) => (
                      <div
                        key={slot.slotId}
                        className="p-3 rounded-lg bg-neutral-950/75 border border-violet-500/30 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full border border-white/40 shrink-0"
                            style={{ backgroundColor: `#${slot.color.toString(16).padStart(6, '0')}` }}
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{slot.name}</div>
                            <div className="text-[10px] text-neutral-400 font-mono-num">
                              Guardado às {slot.savedAtLabel}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => void engine.retrieveSavedVehicle(slot.slotId)}
                            className="px-2.5 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-neutral-950 text-[11px] font-bold cursor-pointer"
                          >
                            Retirar
                          </button>
                          <button
                            type="button"
                            onClick={() => engine.removeSavedVehicle(slot.slotId)}
                            aria-label="Remover veículo guardado"
                            className="p-1.5 rounded bg-neutral-800 hover:bg-rose-600/80 text-neutral-300 hover:text-white cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Vehicle Catalog Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
                  Catálogo de Modelos Disponíveis
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {hud.vehicleCatalog.map((item) => {
                    const spec = VEHICLE_SPECS[item.kind];
                    const speedPct = Math.round((spec.maxSpeed / 46) * 100);
                    const accelPct = Math.round((spec.accel / 30) * 100);
                    const gripPct = Math.round((spec.grip / 10) * 100);
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl bg-neutral-950/80 border border-white/10 overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          {item.previewUrl ? (
                            <div className="h-28 w-full bg-neutral-900 overflow-hidden">
                              <img
                                src={item.previewUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-14 px-3.5 flex items-center justify-between bg-neutral-900/90 border-b border-white/5">
                              <span className="text-[11px] font-semibold text-neutral-300">
                                {item.category}
                              </span>
                              <span
                                className="w-5 h-5 rounded-full border border-white/40"
                                style={{ backgroundColor: item.defaultColor }}
                              />
                            </div>
                          )}
                          <div className="p-3.5">
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="text-sm font-bold text-white">{item.name}</h4>
                              <span className="text-[10px] font-mono-num text-amber-400">
                                {spec.gears} vel.
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                              {item.description}
                            </p>
                            <div className="mt-2.5 flex flex-col gap-1 text-[10px] text-neutral-400 font-mono-num">
                              <div className="flex items-center gap-2">
                                <span className="w-14">Vel. Máx</span>
                                <div className="flex-1 h-1.5 bg-neutral-800 rounded-sm overflow-hidden">
                                  <div className="h-full bg-amber-400" style={{ width: `${speedPct}%` }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-14">Aceleração</span>
                                <div className="flex-1 h-1.5 bg-neutral-800 rounded-sm overflow-hidden">
                                  <div className="h-full bg-emerald-400" style={{ width: `${accelPct}%` }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="w-14">Aderência</span>
                                <div className="flex-1 h-1.5 bg-neutral-800 rounded-sm overflow-hidden">
                                  <div className="h-full bg-sky-400" style={{ width: `${gripPct}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="px-3.5 pb-3.5 flex flex-col gap-2">
                          {item.kind === 'mustang' && (
                            <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-neutral-900/90 border border-rose-500/25">
                              <div className="flex items-center justify-between gap-2 text-[10px]">
                                <span className="font-semibold text-neutral-300">
                                  {item.modelUrl ? 'GLB/GLTF Externo Ativo' : 'Importar Modelo Real (.GLB/.GLTF)'}
                                </span>
                                {item.modelUrl && (
                                  <button
                                    type="button"
                                    onClick={() => void engine.rotateMustangModel(1)}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-amber-300 font-semibold border border-white/10 cursor-pointer"
                                    title="Rodar orientação do Mustang 90°"
                                  >
                                    <RotateCw className="w-3 h-3" />
                                    Rodar 90°
                                  </button>
                                )}
                              </div>
                              <label className="w-full py-1.5 px-2.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-display text-[11px] font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                                <Upload className="w-3.5 h-3.5" />
                                {item.modelUrl ? 'Trocar .GLB / .GLTF' : 'Carregar .GLB / .GLTF'}
                                <input
                                  type="file"
                                  accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp"
                                  multiple
                                  className="hidden"
                                  data-testid="mustang-gltf-input"
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files || files.length === 0) return;
                                    void engine.importMustangModel(Array.from(files), { autoDrive: true });
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => void engine.spawnCatalogVehicle(item.id)}
                            className="w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-display text-xs font-bold cursor-pointer"
                          >
                            Selecionar &amp; Conduzir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Runtime GLB / GLTF Importer */}
              <div className="p-3.5 rounded-xl bg-neutral-950/70 border border-white/10 flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-sky-400" />
                      Importar Modelo 3D (.GLB / .GLTF)
                    </h4>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Carrega ficheiros .glb ou .gltf (+ .bin/texturas) ou cola um URL .glb para substituir o Mustang mantendo as proporções 1:1 reais.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      value={importKind}
                      onChange={(e) => setImportKind(e.target.value as VehicleKind)}
                      className="h-9 px-2.5 rounded-lg bg-neutral-900 border border-white/15 text-xs text-white"
                      aria-label="Perfil de Física"
                    >
                      <option value="mustang">Mustang GT 5.0</option>
                      <option value="camaro">Camaro / Muscle</option>
                      <option value="challenger">Dodge Challenger 2015 LB</option>
                      <option value="sports">Lexus LC 500 Convertible</option>
                      <option value="sedan">Berlina</option>
                      <option value="suv">SUV</option>
                      <option value="van">Carrinha</option>
                      <option value="moto">Moto</option>
                      <option value="police">Polícia</option>
                    </select>
                    <label className="h-9 px-3.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-neutral-950 font-display text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                      <Upload className="w-3.5 h-3.5" />
                      Abrir .GLB / .GLTF
                      <input
                        type="file"
                        accept=".glb,.gltf,.bin,.png,.jpg,.jpeg,.webp"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (!files || files.length === 0) return;
                          if (importKind === 'mustang') {
                            void engine.importMustangModel(Array.from(files), { autoDrive: true });
                          } else {
                            const file = files[0];
                            const url = URL.createObjectURL(file);
                            void engine.importCustomGltfVehicle(file.name, url, importKind);
                          }
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                <form
                  className="flex flex-col sm:flex-row gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = mustangUrl.trim();
                    if (!trimmed) return;
                    void engine.importMustangModel(trimmed, { autoDrive: true });
                  }}
                >
                  <input
                    type="url"
                    value={mustangUrl}
                    onChange={(e) => setMustangUrl(e.target.value)}
                    placeholder="https://.../mustang_gt.glb (URL direto .glb ou .gltf para o Mustang)"
                    className="flex-1 h-9 px-3 rounded-lg bg-neutral-900 border border-white/15 text-xs text-white placeholder:text-neutral-500"
                  />
                  <button
                    type="submit"
                    className="h-9 px-3.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white font-display text-xs font-bold border border-white/15 cursor-pointer whitespace-nowrap"
                  >
                    Importar URL Mustang
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PAUSE / INVENTORY / MISSIONS / SETTINGS MODAL */}
      {hud.phase === 'paused' && (
        <div className="absolute inset-0 z-40 bg-neutral-950/85 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-2xl bg-neutral-900 border border-white/15 rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h2 className="font-display text-lg font-bold text-white">Menu de Jogo</h2>
                <span className="font-mono-num text-sm font-semibold text-emerald-400">${hud.cash}</span>
              </div>
              <button
                type="button"
                onClick={() => engine.togglePause()}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
                aria-label="Retomar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 px-5 py-2.5 bg-neutral-950/60 border-b border-white/10 overflow-x-auto">
              {(
                [
                  { id: 'missions', label: 'Missões', icon: MapPin },
                  { id: 'inventory', label: 'Inventário', icon: Shield },
                  { id: 'graphics', label: 'Gráficos', icon: Settings },
                  { id: 'controls', label: 'Controlos & Áudio', icon: Gamepad2 },
                ] as const
              ).map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPauseTab(t.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      pauseTab === t.id
                        ? 'bg-amber-400 text-neutral-950'
                        : 'text-neutral-300 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-5 overflow-y-auto flex-1">
              {pauseTab === 'missions' && (
                <div className="flex flex-col gap-3">
                  {hud.availableMissions.map((m) => {
                    const isActive = hud.mission.activeMissionId === m.id;
                    const isDone = hud.mission.completedIds.includes(m.id);
                    return (
                      <div
                        key={m.id}
                        className="p-3.5 rounded-lg bg-neutral-950/70 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs text-neutral-400">
                            <span className="text-amber-400 font-semibold">{m.typeLabel}</span>
                            <span>·</span>
                            <span className="font-mono-num text-emerald-400 font-semibold">+${m.reward}</span>
                            {isDone && (
                              <>
                                <span>·</span>
                                <span className="text-sky-400 font-semibold">Concluída</span>
                              </>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-white mt-0.5">{m.title}</h3>
                          <p className="text-xs text-neutral-400 mt-0.5">{m.description}</p>
                        </div>
                        {isActive ? (
                          <button
                            type="button"
                            onClick={() => engine.cancelMission()}
                            className="px-3.5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Cancelar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => engine.startMissionById(m.id)}
                            className="px-3.5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Iniciar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {pauseTab === 'inventory' && (
                <div className="flex flex-col gap-3">
                  {hud.inventory.map((item) => {
                    const isEquipped = item.weaponId && hud.equippedWeapon === item.weaponId;
                    return (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-lg bg-neutral-950/70 border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white">{item.name}</h3>
                            {item.ammo !== undefined && (
                              <span className="font-mono-num text-xs text-amber-400">
                                {item.ammo}/{item.maxAmmo}
                              </span>
                            )}
                            {item.quantity !== undefined && (
                              <span className="font-mono-num text-xs text-sky-400">
                                x{item.quantity}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.price > 0 && (
                            <button
                              type="button"
                              onClick={() => engine.useOrBuyItem(item.id, true)}
                              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-emerald-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
                            >
                              Comprar ${item.price}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => engine.useOrBuyItem(item.id, false)}
                            disabled={isEquipped || (item.quantity !== undefined && item.quantity <= 0)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap cursor-pointer ${
                              isEquipped
                                ? 'bg-amber-400 text-neutral-950'
                                : 'bg-white/10 hover:bg-white/20 text-white disabled:opacity-40'
                            }`}
                          >
                            {isEquipped ? 'Equipado' : item.category === 'weapon' ? 'Equipar' : 'Usar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {pauseTab === 'graphics' && (
                <div className="flex flex-col gap-5">
                  <div>
                    <h3 className="text-sm font-bold text-white mb-2">Qualidade Gráfica</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => engine.setQuality(q)}
                          className={`py-2.5 px-3 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                            hud.quality === q
                              ? 'bg-amber-400 text-neutral-950 border-amber-300'
                              : 'bg-neutral-950/70 text-neutral-300 border-white/10 hover:text-white'
                          }`}
                        >
                          {QUALITY_PRESETS[q].label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-2">Hora do Dia ({hud.timeOfDayLabel})</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Manhã', val: 0.3 },
                        { label: 'Meio-Dia', val: 0.5 },
                        { label: 'Pôr do Sol', val: 0.74 },
                        { label: 'Noite', val: 0.04 },
                      ].map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => engine.setTimeOfDay(t.val)}
                          className="py-2 px-2.5 rounded-lg bg-neutral-950/70 border border-white/10 text-xs font-semibold text-neutral-200 hover:border-amber-400/50 cursor-pointer"
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {pauseTab === 'controls' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950/70 border border-white/10">
                    <span className="text-xs font-semibold text-white">Controlos Táteis (Android / Ecrã)</span>
                    <button
                      type="button"
                      onClick={() => engine.toggleTouchControls()}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        hud.touchControlsEnabled ? 'bg-sky-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {hud.touchControlsEnabled ? 'Ativado' : 'Desativado'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-950/70 border border-white/10">
                    <span className="text-xs font-semibold text-white">Música Ambiente</span>
                    <button
                      type="button"
                      onClick={() => engine.toggleMusic()}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                        hud.musicEnabled ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {hud.musicEnabled ? 'Ligada' : 'Desligada'}
                    </button>
                  </div>
                  <div className="p-3 rounded-lg bg-neutral-950/70 border border-white/10">
                    <div className="flex items-center justify-between text-xs font-semibold text-white mb-2">
                      <span>Sensibilidade da Câmara</span>
                      <span className="font-mono-num text-amber-400">{hud.cameraSensitivity.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={hud.cameraSensitivity}
                      onChange={(e) => engine.setCameraSensitivity(parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div className="text-xs text-neutral-400 leading-relaxed">
                    PC: WASD Mover/Conduzir · Shift Correr · Espaço Saltar/Travão de Mão · F Entrar/Sair de Veículo · C Câmara Exterior/Interior · G Garagem · E Interagir · H Buzina · Botão Esq. Atacar · Arrastar Rato Câmara.
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-white/10 bg-neutral-950/60 flex justify-end">
              <button
                type="button"
                onClick={() => engine.togglePause()}
                className="px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-display text-xs font-bold cursor-pointer"
              >
                Voltar ao Jogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WASTED / BUSTED OVERLAY */}
      {(hud.phase === 'wasted' || hud.phase === 'busted') && (
        <div className="absolute inset-0 z-40 bg-neutral-950/88 flex flex-col items-center justify-center gap-4 p-6 pointer-events-auto">
          <h2
            className={`font-display text-4xl sm:text-5xl font-bold tracking-wider ${
              hud.phase === 'wasted' ? 'text-rose-500' : 'text-sky-400'
            }`}
          >
            {hud.phase === 'wasted' ? 'ELIMINADO' : 'DETIDO'}
          </h2>
          <p className="text-sm text-neutral-300 text-center max-w-md">
            {hud.phase === 'wasted'
              ? 'Foste atendido no Hospital Central de San Verde.'
              : 'A polícia intercetou-te. Pagaste a fiança para sair.'}
          </p>
          <button
            type="button"
            onClick={() => engine.respawn()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-display text-sm font-bold cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            Continuar (-$100)
          </button>
        </div>
      )}
    </div>
  );
};
