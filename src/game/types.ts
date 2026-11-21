export type GraphicsQuality = 'low' | 'medium' | 'high';

export type GamePhase = 'title' | 'playing' | 'paused' | 'wasted' | 'busted';

export type VehicleKind = 'sports' | 'sedan' | 'suv' | 'moto' | 'van' | 'police';

export interface QualityConfig {
  label: string;
  pixelRatioMax: number;
  shadows: boolean;
  shadowMapSize: number;
  drawDistance: number;
  trafficCount: number;
  pedestrianCount: number;
  reflections: boolean;
  particles: boolean;
}

export const QUALITY_PRESETS: Record<GraphicsQuality, QualityConfig> = {
  low: {
    label: 'Baixa',
    pixelRatioMax: 1.0,
    shadows: false,
    shadowMapSize: 512,
    drawDistance: 210,
    trafficCount: 6,
    pedestrianCount: 10,
    reflections: false,
    particles: false,
  },
  medium: {
    label: 'Média',
    pixelRatioMax: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    drawDistance: 320,
    trafficCount: 10,
    pedestrianCount: 18,
    reflections: true,
    particles: true,
  },
  high: {
    label: 'Alta',
    pixelRatioMax: 2.0,
    shadows: true,
    shadowMapSize: 2048,
    drawDistance: 460,
    trafficCount: 14,
    pedestrianCount: 24,
    reflections: true,
    particles: true,
  },
};

export interface VehicleSpec {
  kind: VehicleKind;
  name: string;
  maxSpeed: number; // m/s
  accel: number;
  brake: number;
  turnSpeed: number;
  grip: number;
  driftGrip: number;
  oversteerBias: number;
  gears: number;
  suspensionStiffness: number;
  suspensionDamping: number;
  suspensionTravel: number;
  rollFactor: number;
  pitchFactor: number;
  mass: number;
  halfWidth: number;
  halfLength: number;
  height: number;
  wheelRadius: number;
}

export const VEHICLE_SPECS: Record<VehicleKind, VehicleSpec> = {
  sports: {
    kind: 'sports',
    name: 'Comet GT',
    maxSpeed: 42,
    accel: 26,
    brake: 34,
    turnSpeed: 2.85,
    grip: 8.4,
    driftGrip: 1.75,
    oversteerBias: 0.46,
    gears: 6,
    suspensionStiffness: 72,
    suspensionDamping: 12.2,
    suspensionTravel: 0.085,
    rollFactor: 0.055,
    pitchFactor: 0.048,
    mass: 1.15,
    halfWidth: 1.05,
    halfLength: 2.25,
    height: 1.32,
    wheelRadius: 0.36,
  },
  sedan: {
    kind: 'sedan',
    name: 'Sultan Sedan',
    maxSpeed: 31,
    accel: 17.5,
    brake: 26,
    turnSpeed: 2.5,
    grip: 7.2,
    driftGrip: 2.15,
    oversteerBias: 0.28,
    gears: 5,
    suspensionStiffness: 52,
    suspensionDamping: 9.4,
    suspensionTravel: 0.11,
    rollFactor: 0.082,
    pitchFactor: 0.064,
    mass: 1.35,
    halfWidth: 1.0,
    halfLength: 2.2,
    height: 1.45,
    wheelRadius: 0.35,
  },
  suv: {
    kind: 'suv',
    name: 'Granger SUV',
    maxSpeed: 28,
    accel: 15,
    brake: 24,
    turnSpeed: 2.15,
    grip: 6.5,
    driftGrip: 2.55,
    oversteerBias: 0.18,
    gears: 5,
    suspensionStiffness: 42,
    suspensionDamping: 8.2,
    suspensionTravel: 0.145,
    rollFactor: 0.115,
    pitchFactor: 0.082,
    mass: 1.85,
    halfWidth: 1.15,
    halfLength: 2.35,
    height: 1.78,
    wheelRadius: 0.42,
  },
  moto: {
    kind: 'moto',
    name: 'Bati 801',
    maxSpeed: 44,
    accel: 29,
    brake: 32,
    turnSpeed: 3.45,
    grip: 9.6,
    driftGrip: 2.9,
    oversteerBias: 0.32,
    gears: 6,
    suspensionStiffness: 62,
    suspensionDamping: 10.8,
    suspensionTravel: 0.11,
    rollFactor: 0.14,
    pitchFactor: 0.072,
    mass: 0.55,
    halfWidth: 0.46,
    halfLength: 1.15,
    height: 1.15,
    wheelRadius: 0.32,
  },
  van: {
    kind: 'van',
    name: 'Speedo Cargo',
    maxSpeed: 24,
    accel: 12.5,
    brake: 21,
    turnSpeed: 1.9,
    grip: 5.8,
    driftGrip: 2.7,
    oversteerBias: 0.12,
    gears: 4,
    suspensionStiffness: 38,
    suspensionDamping: 7.6,
    suspensionTravel: 0.14,
    rollFactor: 0.125,
    pitchFactor: 0.086,
    mass: 2.1,
    halfWidth: 1.12,
    halfLength: 2.55,
    height: 2.1,
    wheelRadius: 0.38,
  },
  police: {
    kind: 'police',
    name: 'Viatura LSPD',
    maxSpeed: 38,
    accel: 22.5,
    brake: 31,
    turnSpeed: 2.68,
    grip: 7.9,
    driftGrip: 1.9,
    oversteerBias: 0.4,
    gears: 5,
    suspensionStiffness: 64,
    suspensionDamping: 11.2,
    suspensionTravel: 0.10,
    rollFactor: 0.068,
    pitchFactor: 0.056,
    mass: 1.5,
    halfWidth: 1.04,
    halfLength: 2.28,
    height: 1.52,
    wheelRadius: 0.36,
  },
};

export type WeaponId = 'fists' | 'bat' | 'pistol';

export interface InventoryItem {
  id: string;
  name: string;
  category: 'weapon' | 'consumable';
  weaponId?: WeaponId;
  owned: boolean;
  ammo?: number;
  maxAmmo?: number;
  quantity?: number;
  price: number;
  description: string;
}

export type MissionType = 'race' | 'delivery' | 'escape' | 'explore' | 'action';

export interface MissionStep {
  label: string;
  targetX: number;
  targetZ: number;
  radius: number;
}

export interface MissionDefinition {
  id: string;
  title: string;
  type: MissionType;
  typeLabel: string;
  description: string;
  reward: number;
  timeLimitSec?: number;
  startX: number;
  startZ: number;
  steps: MissionStep[];
  wantedOnStart?: number;
  spawnTargets?: { x: number; z: number }[];
}

export interface MissionProgress {
  activeMissionId: string | null;
  currentStepIndex: number;
  timeRemaining: number;
  completedIds: string[];
  targetsRemaining: number;
  bannerText: string | null;
}

export interface WorldBoxCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  maxY: number;
  tag: 'building' | 'prop' | 'wall';
}

export interface InteractiveZone {
  id: string;
  kind: 'gas' | 'shop' | 'garage';
  label: string;
  x: number;
  z: number;
  radius: number;
}

export interface MinimapEntity {
  x: number;
  z: number;
  kind: 'traffic' | 'police' | 'parked' | 'mission' | 'target' | 'gas' | 'shop' | 'checkpoint';
  heading?: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  health: number;
  maxHealth: number;
  armor: number;
  stamina: number;
  cash: number;
  wantedStars: number;
  wantedFlashing: boolean;
  evadeProgress: number; // 0..1
  inVehicle: boolean;
  vehicleName: string;
  speedKmh: number;
  vehicleHealth: number;
  district: string;
  timeOfDayLabel: string;
  dayProgress: number; // 0..1
  interactPrompt: string | null;
  equippedWeapon: WeaponId;
  inventory: InventoryItem[];
  mission: MissionProgress;
  availableMissions: MissionDefinition[];
  quality: GraphicsQuality;
  muted: boolean;
  musicEnabled: boolean;
  touchControlsEnabled: boolean;
  cameraSensitivity: number;
  playerX: number;
  playerZ: number;
  playerHeading: number;
  minimapEntities: MinimapEntity[];
  toastMessage: string | null;
}
