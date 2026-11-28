import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CameraMode,
  GamePhase,
  GraphicsQuality,
  HudSnapshot,
  InventoryItem,
  MinimapEntity,
  QUALITY_PRESETS,
  SavedVehicleEntry,
  VEHICLE_SPECS,
  VehicleCatalogItem,
  VehicleKind,
  WeaponId,
} from './types';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { SoundEngine } from './audio';
import { buildCity, CityWorld, ROAD_COORDS } from './city';
import {
  applyGltfTemplateToVehicle,
  createVehicle,
  stepTrafficAI,
  stepVehiclePhysics,
  VehicleInstance,
} from './vehicles';
import {
  BUILTIN_VEHICLE_CATALOG,
  importMustangGltf,
  MUSTANG_DEFAULT_LENGTH,
  MUSTANG_DEFAULT_WHEEL_NAMES,
  VehicleAssetLoader,
} from './vehicleLoader';
import { createPedestrian, Pedestrian, PlayerController, stepPedestrian } from './player';
import { PoliceSystem } from './police';
import { CITY_MISSIONS, MissionManager } from './missions';
import { ThirdPersonCamera } from './camera';
import { DesktopInputManager } from './controls';
import { createMobileInputState, detectTouchDevice, MobileInputState } from './mobile-controls';
import { findSafeExitPosition, getDistrictName, isPositionClear, raycastCollidersFraction } from './physics';

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface Bullet {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  life: number;
  fromPlayer: boolean;
}

const _tmpVec = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class GameEngine {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camRig: ThirdPersonCamera;
  private textures: ProceduralTextureSet;
  private city: CityWorld;
  private sound = new SoundEngine();
  private desktopInput = new DesktopInputManager();
  public mobileInput: MobileInputState = createMobileInputState();

  private player: PlayerController;
  private vehicles: VehicleInstance[] = [];
  private pedestrians: Pedestrian[] = [];
  private missionEnemies: Pedestrian[] = [];
  private police: PoliceSystem;
  private missions: MissionManager;

  private particles: Particle[] = [];
  private bullets: Bullet[] = [];
  private particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  private smokeMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.55 });
  private bulletGeo = new THREE.SphereGeometry(0.1, 6, 6);
  private bulletMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  private phase: GamePhase = 'title';
  private quality: GraphicsQuality = 'medium';
  private touchControlsEnabled: boolean;
  private cameraSensitivity = 1.0;

  private activeVehicle: VehicleInstance | null = null;
  private vehicleLoader = new VehicleAssetLoader();
  private vehicleCatalog: VehicleCatalogItem[] = [...BUILTIN_VEHICLE_CATALOG];
  private savedVehicles: SavedVehicleEntry[] = [];
  private garageOpen = false;
  private inGarageZone = false;
  private importedObjectUrls: string[] = [];
  private mustangImportSource: File[] | string | ArrayBuffer | null = null;
  private mustangOrientationOffsetY = 0;
  private dayProgress = 0.705; // Golden-hour sunset start matching reference visuals
  private timer = new THREE.Timer();
  private elapsed = 0;
  private frameId = 0;
  private destroyed = false;
  private hudEmitTimer = 0;
  private toastMessage: string | null = null;
  private toastTimer = 0;
  private hitstopTimer = 0;
  private driftSmokeTimer = 0;
  private damageSmokeTimer = 0;
  private currentInteractPrompt: string | null = null;
  private currentInteractAction: (() => void) | null = null;

  private inventory: InventoryItem[] = [
    {
      id: 'fists',
      name: 'Punhos',
      category: 'weapon',
      weaponId: 'fists',
      owned: true,
      price: 0,
      description: 'Combate corpo-a-corpo rápido.',
    },
    {
      id: 'bat',
      name: 'Bastão de Basebol',
      category: 'weapon',
      weaponId: 'bat',
      owned: true,
      price: 120,
      description: 'Maior alcance e impacto em combate próximo.',
    },
    {
      id: 'pistol',
      name: 'Pistola 9mm',
      category: 'weapon',
      weaponId: 'pistol',
      owned: true,
      ammo: 24,
      maxAmmo: 60,
      price: 250,
      description: 'Arma de fogo semi-automática (+12 munições na loja).',
    },
    {
      id: 'medkit',
      name: 'Kit Médico',
      category: 'consumable',
      owned: true,
      quantity: 1,
      price: 100,
      description: 'Restaura +60 pontos de vida.',
    },
    {
      id: 'armor',
      name: 'Colete Balístico',
      category: 'consumable',
      owned: true,
      quantity: 1,
      price: 150,
      description: 'Restaura +60 de proteção.',
    },
  ];

  private detachInput: () => void;
  private onResizeBound: () => void;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.touchControlsEnabled = detectTouchDevice();
    this.quality = this.touchControlsEnabled ? 'low' : 'medium';

    this.scene = new THREE.Scene();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camRig = new ThirdPersonCamera(width / height);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, QUALITY_PRESETS[this.quality].pixelRatioMax),
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && QUALITY_PRESETS[this.quality].shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    // Studio Environment Map (PBR car paint & glass reflections on every device)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.textures = createProceduralTextures(this.renderer);
    const qCfg = QUALITY_PRESETS[this.quality];
    this.city = buildCity(
      this.scene,
      this.textures,
      !this.isSoftwareGl && qCfg.shadows,
      qCfg.shadowMapSize,
    );
    this.city.setQuality(this.quality, !this.isSoftwareGl && qCfg.shadows);

    this.player = new PlayerController(this.scene, this.textures.contactShadow);
    this.police = new PoliceSystem(this.scene, this.textures.contactShadow, qCfg.reflections, this.textures);
    this.missions = new MissionManager(this.scene);

    this.savedVehicles = this.loadSavedVehicles();
    this.spawnInitialWorldActors();
    void this.initVehicleCatalog();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camRig.camera);
    }

    this.detachInput = this.desktopInput.attach(this.renderer.domElement);
    this.onResizeBound = () => this.handleResize();
    window.addEventListener('resize', this.onResizeBound);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
    });

    this.timer.connect(document);
    this.timer.reset();
    this.emitHud();
    this.scheduleNextTick();
  }

  private loadSavedVehicles(): SavedVehicleEntry[] {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem('webgta_saved_vehicles_v1');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as SavedVehicleEntry[]) : [];
    } catch {
      return [];
    }
  }

  private persistSavedVehicles(): void {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return;
    try {
      window.localStorage.setItem('webgta_saved_vehicles_v1', JSON.stringify(this.savedVehicles));
    } catch {
      // Ignore storage quota errors
    }
  }

  private async initVehicleCatalog(): Promise<void> {
    const items = await this.vehicleLoader.loadCatalog();
    if (this.destroyed) return;
    this.vehicleCatalog = items;
    // Apply configured GLTF models on matching parked vehicles when present
    for (const v of this.vehicles) {
      const item = this.vehicleCatalog.find((c) => c.kind === v.spec.kind && c.modelUrl);
      if (item && item.modelUrl) {
        void this.tryAttachCatalogGltf(v, item);
      }
    }
    this.emitHud();
  }

  private async tryAttachCatalogGltf(v: VehicleInstance, item: VehicleCatalogItem): Promise<void> {
    if (!item.modelUrl) return;
    try {
      const allowShadows = !this.isSoftwareGl && QUALITY_PRESETS[this.quality].shadows;
      const disableTransmission = this.isSoftwareGl || this.quality !== 'high' || detectTouchDevice();
      const tpl =
        this.vehicleLoader.getResolvedTemplate(item.modelUrl) ??
        (await this.vehicleLoader.loadGltfTemplate(item.modelUrl, item.kind, {
          targetLength: item.targetLength,
          orientationOffsetY: item.orientationOffsetY,
          wheelNames: item.wheelNames,
          shadows: allowShadows,
          disableTransmission,
        }));
      if (!this.destroyed) {
        applyGltfTemplateToVehicle(v, this.vehicleLoader, tpl, item.modelUrl);
      }
    } catch {
      // Fall back gracefully to procedural 3D chassis
    }
  }

  private findClearVehicleSpot(
    prefX: number,
    prefZ: number,
    radius: number,
  ): { x: number; z: number } {
    const obstacleCircles: { x: number; z: number; radius: number }[] = [
      { x: this.player.x, z: this.player.z, radius: 2.2 },
    ];
    for (const v of this.vehicles) {
      obstacleCircles.push({ x: v.x, z: v.z, radius: v.spec.halfLength + 0.6 });
    }

    if (isPositionClear(prefX, prefZ, radius, this.city.colliders, obstacleCircles)) {
      return { x: prefX, z: prefZ };
    }

    for (let ring = 1; ring <= 8; ring++) {
      const r = ring * 3.5;
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const cx = prefX + Math.cos(ang) * r;
        const cz = prefZ + Math.sin(ang) * r;
        if (isPositionClear(cx, cz, radius, this.city.colliders, obstacleCircles)) {
          return { x: cx, z: cz };
        }
      }
    }
    return { x: prefX, z: prefZ };
  }

  private spawnInitialWorldActors(): void {
    const qCfg = QUALITY_PRESETS[this.quality];

    // Hero Parked Vehicles distributed cleanly across the city (starting with Yellow Camaro SS & Red Mustang GT near player)
    const parkedSpecs: { kind: VehicleKind; x: number; z: number; h: number; color?: number }[] = [
      { kind: 'camaro', x: -8.8, z: 10.5, h: 0, color: 0xea9600 }, // Yellow Camaro SS parked along curb near spawn!
      { kind: 'mustang', x: -8.8, z: 16.5, h: 0, color: 0xdc1e1e }, // Race Red 2015 Mustang GT 5.0 parked beside player!
      { kind: 'sports', x: -8, z: 2.5, h: Math.PI / 2, color: 0xb84a1e }, // Lexus LC 500 Convertible near spawn
      { kind: 'challenger', x: -8.8, z: -12.5, h: 0, color: 0x18181b }, // Dodge Challenger 2015 LB Performance near spawn
      { kind: 'sedan', x: -20, z: 8.5, h: -Math.PI / 2, color: 0x2563eb },
      { kind: 'moto', x: -4.5, z: 21, h: 0, color: 0xf97316 },
      { kind: 'suv', x: 76, z: -26, h: Math.PI, color: 0x1e293b }, // Parking lot
      { kind: 'camaro', x: 84, z: -26, h: Math.PI, color: 0xea9600 }, // Parking lot Camaro
      { kind: 'van', x: 24, z: 36, h: Math.PI / 2, color: 0xf1f5f9 }, // Near gas station
      { kind: 'police', x: 76, z: -84, h: 0 }, // Police precinct
      { kind: 'mustang', x: 118, z: 16, h: Math.PI, color: 0xdc1e1e }, // Beachfront Mustang GT
      { kind: 'sports', x: 118, z: 24, h: Math.PI, color: 0xb84a1e }, // Beachfront Lexus LC 500 Convertible
      { kind: 'suv', x: -24, z: 74, h: Math.PI / 2, color: 0x334155 }, // South residential
    ];

    parkedSpecs.forEach((p, idx) => {
      const clear = this.findClearVehicleSpot(p.x, p.z, VEHICLE_SPECS[p.kind].halfLength * 0.9);
      const v = createVehicle(
        `parked_${idx}`,
        p.kind,
        clear.x,
        clear.z,
        p.h,
        this.textures.contactShadow,
        qCfg.reflections,
        p.color,
        this.textures,
      );
      this.scene.add(v.group);
      this.vehicles.push(v);
    });

    // AI Traffic Cars
    this.syncTrafficCount(qCfg.trafficCount);

    // Pedestrians on Sidewalks
    this.syncPedestrianCount(qCfg.pedestrianCount);
  }

  private syncTrafficCount(target: number): void {
    const aiCars = this.vehicles.filter((v) => v.aiActive && !v.occupiedByPlayer);
    // Keep AI traffic lightweight for Android/mobile FPS (hero Lexuses spawn parked & via Garage/Mechanic)
    const kinds: VehicleKind[] = ['sedan', 'sedan', 'suv', 'van', 'moto'];
    const qCfg = QUALITY_PRESETS[this.quality];

    if (aiCars.length < target) {
      for (let i = aiCars.length; i < target; i++) {
        const axis: 'x' | 'z' = i % 2 === 0 ? 'z' : 'x';
        const dir: 1 | -1 = i % 4 < 2 ? 1 : -1;
        const roadBase = ROAD_COORDS[i % ROAD_COORDS.length];
        const laneOffset = dir === 1 ? -3.4 : 3.4;
        const laneCoord = roadBase + laneOffset;
        const along = -110 + ((i * 47) % 220);
        const x = axis === 'z' ? laneCoord : along;
        const z = axis === 'z' ? along : laneCoord;
        const heading = axis === 'z' ? (dir === 1 ? 0 : Math.PI) : dir === 1 ? Math.PI / 2 : -Math.PI / 2;

        const kind = kinds[i % kinds.length];
        const clear = this.findClearVehicleSpot(x, z, VEHICLE_SPECS[kind].halfLength * 0.9);
        const v = createVehicle(
          `traffic_${Date.now()}_${i}`,
          kind,
          clear.x,
          clear.z,
          heading,
          this.textures.contactShadow,
          qCfg.reflections,
          undefined,
          this.textures,
        );
        v.aiActive = true;
        v.aiAxis = axis;
        v.aiDir = dir;
        v.aiLaneCoord = laneCoord;
        v.aiTargetSpeed = 10 + (i % 4) * 2;
        this.scene.add(v.group);
        this.vehicles.push(v);
      }
    } else if (aiCars.length > target) {
      const toRemove = aiCars.slice(target);
      for (const rm of toRemove) {
        this.scene.remove(rm.group);
        const idx = this.vehicles.indexOf(rm);
        if (idx >= 0) this.vehicles.splice(idx, 1);
      }
    }
  }

  private syncPedestrianCount(target: number): void {
    while (this.pedestrians.length < target) {
      const i = this.pedestrians.length;
      const rx = ROAD_COORDS[i % ROAD_COORDS.length] + (i % 2 === 0 ? 9.5 : -9.5);
      const rz = -100 + ((i * 29) % 200);
      const ped = createPedestrian(rx, rz, this.textures.contactShadow, false);
      this.scene.add(ped.rig.group);
      this.pedestrians.push(ped);
    }
    while (this.pedestrians.length > target) {
      const ped = this.pedestrians.pop()!;
      this.scene.remove(ped.rig.group);
    }
  }

  public startGame(): void {
    this.sound.init();
    this.phase = 'playing';
    this.desktopInput.clearFrameEdges();
    this.showToast('Bem-vindo a San Verde! Explora a cidade ou inicia uma missão.');
    this.emitHud();
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      if (document.pointerLockElement) document.exitPointerLock();
      this.desktopInput.clearFrameEdges();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.timer.reset();
    }
    this.emitHud();
  }

  public respawn(): void {
    this.sound.init();
    if (this.activeVehicle) {
      this.exitVehicle();
    }
    this.player.health = this.player.maxHealth;
    this.player.armor = 50;
    this.player.x = -12;
    this.player.z = 14;
    this.player.y = 0;
    this.player.cash = Math.max(0, this.player.cash - 100);
    this.police.clearWanted();
    this.phase = 'playing';
    this.showToast('Recuperado no Hospital Central (-$100)');
    this.emitHud();
  }

  public setQuality(q: GraphicsQuality): void {
    this.quality = q;
    const cfg = QUALITY_PRESETS[q];
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, cfg.pixelRatioMax));
    const allowShadows = !this.isSoftwareGl && cfg.shadows;
    this.renderer.shadowMap.enabled = allowShadows;
    this.city.setQuality(q, allowShadows);
    this.city.sunLight.shadow.mapSize.set(cfg.shadowMapSize, cfg.shadowMapSize);
    this.city.sunLight.shadow.mapSize.width = cfg.shadowMapSize;
    this.city.sunLight.shadow.mapSize.height = cfg.shadowMapSize;
    if (this.city.sunLight.shadow.map) {
      this.city.sunLight.shadow.map.dispose();
      this.city.sunLight.shadow.map = null;
    }
    this.camRig.camera.far = cfg.drawDistance + 180;
    this.camRig.camera.updateProjectionMatrix();
    this.syncTrafficCount(cfg.trafficCount);
    this.syncPedestrianCount(cfg.pedestrianCount);
    this.emitHud();
  }

  public toggleMute(): void {
    this.sound.init();
    this.sound.setMuted(!this.sound.muted);
    this.emitHud();
  }

  public toggleMusic(): void {
    this.sound.init();
    this.sound.setMusicEnabled(!this.sound.musicEnabled);
    this.emitHud();
  }

  public toggleTouchControls(): void {
    this.touchControlsEnabled = !this.touchControlsEnabled;
    this.emitHud();
  }

  public setCameraSensitivity(val: number): void {
    this.cameraSensitivity = val;
    this.emitHud();
  }

  public setTimeOfDay(progress: number): void {
    this.dayProgress = ((progress % 1) + 1) % 1;
    this.emitHud();
  }

  public selectWeapon(weaponId: WeaponId): void {
    this.player.setWeapon(weaponId);
    this.emitHud();
  }

  public useOrBuyItem(itemId: string, buyMode = false): void {
    const item = this.inventory.find((i) => i.id === itemId);
    if (!item) return;

    if (buyMode) {
      if (this.player.cash < item.price) {
        this.showToast('Dinheiro insuficiente!');
        return;
      }
      if (item.id === 'pistol') {
        this.player.cash -= item.price;
        item.owned = true;
        item.ammo = Math.min(item.maxAmmo ?? 60, (item.ammo ?? 0) + 12);
        this.showToast('+12 munições de Pistola 9mm');
      } else if (item.category === 'consumable') {
        this.player.cash -= item.price;
        item.quantity = (item.quantity ?? 0) + 1;
        this.showToast(`Compraste ${item.name}`);
      }
      this.emitHud();
      return;
    }

    if (item.category === 'weapon' && item.weaponId && item.owned) {
      this.player.setWeapon(item.weaponId);
      this.showToast(`Equipado: ${item.name}`);
    } else if (item.id === 'medkit' && (item.quantity ?? 0) > 0) {
      if (this.player.health >= this.player.maxHealth) {
        this.showToast('Vida já está no máximo!');
        return;
      }
      item.quantity!--;
      this.player.health = Math.min(this.player.maxHealth, this.player.health + 60);
      this.showToast('Kit Médico usado (+60 Vida)');
    } else if (item.id === 'armor' && (item.quantity ?? 0) > 0) {
      item.quantity!--;
      this.player.armor = Math.min(100, this.player.armor + 60);
      this.showToast('Colete equipado (+60 Proteção)');
    }
    this.emitHud();
  }

  public startMissionById(id: string): void {
    this.clearMissionEnemies();
    this.missions.startMission(
      id,
      (stars) => {
        this.police.setWantedStars(stars);
      },
      (coords) => {
        for (const c of coords) {
          const enemy = createPedestrian(c.x, c.z, this.textures.contactShadow, true);
          this.scene.add(enemy.rig.group);
          this.missionEnemies.push(enemy);
        }
      },
    );
    if (this.phase === 'paused') {
      this.phase = 'playing';
    }
    this.emitHud();
  }

  public cancelMission(): void {
    this.missions.cancelMission();
    this.clearMissionEnemies();
    this.showToast('Missão cancelada');
    this.emitHud();
  }

  public callMechanicSpawnCar(): void {
    this.sound.init();
    if (this.player.cash < 100) {
      this.showToast('Precisas de $100 para chamar o mecânico.');
      return;
    }
    this.player.cash -= 100;
    const heading = this.activeVehicle ? this.activeVehicle.heading : this.player.heading;
    const sx = THREE.MathUtils.clamp(this.player.x + Math.sin(heading) * 5.2, -135, 130);
    const sz = THREE.MathUtils.clamp(this.player.z + Math.cos(heading) * 5.2, -135, 135);
    const qCfg = QUALITY_PRESETS[this.quality];
    const car = createVehicle(
      `mechanic_${Date.now()}`,
      'sports',
      sx,
      sz,
      heading + Math.PI / 2,
      this.textures.contactShadow,
      qCfg.reflections,
      0xb84a1e,
      this.textures,
    );
    this.scene.add(car.group);
    this.vehicles.push(car);
    const lexusItem = this.vehicleCatalog.find((c) => c.kind === 'sports' && c.modelUrl);
    if (lexusItem) {
      void this.tryAttachCatalogGltf(car, lexusItem);
    }
    this.sound.playDoorChime();
    this.showToast('Lexus LC 500 Convertible entregue junto de ti (-$100)!');
    this.emitHud();
  }

  public bribePolice(): void {
    this.sound.init();
    if (this.police.wantedStars <= 0) {
      this.showToast('Não tens estrelas de procura ativas.');
      return;
    }
    if (this.player.cash < 250) {
      this.showToast('Precisas de $250 para subornar a polícia.');
      return;
    }
    this.player.cash -= 250;
    this.police.clearWanted();
    this.sound.playMissionSuccess();
    this.showToast('Suborno aceite — procura policial limpa (-$250).');
    this.emitHud();
  }

  private clearMissionEnemies(): void {
    for (const e of this.missionEnemies) {
      this.scene.remove(e.rig.group);
    }
    this.missionEnemies = [];
  }

  private showToast(msg: string): void {
    this.toastMessage = msg;
    this.toastTimer = 3.2;
  }

  private syncVehicleGlassOpacity(vehicle: VehicleInstance, isCockpit: boolean): void {
    const camGlass = vehicle.bodyGroup.userData.camaroGlassMat as THREE.MeshPhysicalMaterial | undefined;
    if (camGlass) {
      camGlass.opacity = isCockpit ? 0.16 : 0.89;
    }
  }

  public toggleVehicleCameraMode(): void {
    if (!this.activeVehicle) return;
    const nextMode: CameraMode = this.camRig.toggleMode();
    const isCockpit = nextMode === 'cockpit';
    this.activeVehicle.driverGroup.visible = !isCockpit;
    this.syncVehicleGlassOpacity(this.activeVehicle, isCockpit);
    this.showToast(isCockpit ? 'Câmara Interior (Cockpit)' : 'Câmara Exterior');
    this.emitHud();
  }

  public openGarage(): void {
    if (this.phase !== 'playing') return;
    this.garageOpen = true;
    this.sound.setHornActive(false);
    if (document.pointerLockElement) document.exitPointerLock();
    this.desktopInput.clearFrameEdges();
    this.emitHud();
  }

  public closeGarage(): void {
    this.garageOpen = false;
    this.timer.reset();
    this.desktopInput.clearFrameEdges();
    this.emitHud();
  }

  public repairActiveVehicle(): void {
    const target = this.activeVehicle ?? this.findNearestVehicle(6.5);
    if (!target) {
      this.showToast('Aproxima um veículo para reparar.');
      return;
    }
    if (this.player.cash < 50) {
      this.showToast('Precisas de $50 para reparar o veículo.');
      return;
    }
    this.player.cash -= 50;
    target.health = target.maxHealth;
    this.sound.playMissionSuccess();
    this.showToast(`${target.spec.name} reparado a 100% (-$50)!`);
    this.emitHud();
  }

  public saveActiveVehicleToGarage(): void {
    const target = this.activeVehicle ?? this.findNearestVehicle(7.5);
    if (!target) {
      this.showToast('Entra ou aproxima-te de um veículo para o guardar na garagem.');
      return;
    }
    const cat = this.vehicleCatalog.find((c) => c.kind === target.spec.kind);
    const entry: SavedVehicleEntry = {
      slotId: `slot_${Date.now()}`,
      catalogId: cat?.id ?? target.spec.kind,
      kind: target.spec.kind,
      name: target.spec.name,
      color: target.paintColor,
      health: target.maxHealth,
      savedAtLabel: this.formatTimeOfDay(this.dayProgress),
      customModelUrl: target.customModelUrl,
    };
    target.health = target.maxHealth;
    this.savedVehicles = [entry, ...this.savedVehicles].slice(0, 8);
    this.persistSavedVehicles();
    this.sound.playMissionSuccess();
    this.showToast(`${target.spec.name} guardado e reparado na Garagem!`);
    this.emitHud();
  }

  public removeSavedVehicle(slotId: string): void {
    this.savedVehicles = this.savedVehicles.filter((s) => s.slotId !== slotId);
    this.persistSavedVehicles();
    this.emitHud();
  }

  public async spawnCatalogVehicle(
    catalogId: string,
    colorOverride?: number,
    customModelOverride?: string,
  ): Promise<void> {
    const item = this.vehicleCatalog.find((c) => c.id === catalogId) ?? this.vehicleCatalog[0];
    if (!item) return;

    const kind = item.kind;
    const spec = VEHICLE_SPECS[kind];
    const colorNum =
      colorOverride ?? parseInt(item.defaultColor.replace('#', ''), 16) ?? spec.defaultColor;

    // Exit current vehicle smoothly if player is replacing their active ride inside garage
    if (this.activeVehicle) {
      this.exitVehicle();
    }

    const nearSpawnBlock = Math.hypot(this.player.x - (-15), this.player.z - 16) < 28;
    const baseHeading = nearSpawnBlock ? 0 : this.player.heading;
    const prefX = nearSpawnBlock ? -3.4 : this.player.x + Math.sin(baseHeading) * 4.2;
    const prefZ = nearSpawnBlock ? 16 : this.player.z + Math.cos(baseHeading) * 4.2;
    const spot = this.findClearVehicleSpot(prefX, prefZ, spec.halfLength + 0.4);
    const qCfg = QUALITY_PRESETS[this.quality];

    const v = createVehicle(
      `garage_spawn_${Date.now()}`,
      kind,
      spot.x,
      spot.z,
      baseHeading,
      this.textures.contactShadow,
      qCfg.reflections,
      colorNum,
      this.textures,
    );
    this.scene.add(v.group);
    this.vehicles.push(v);

    const modelUrl = customModelOverride ?? item.modelUrl;
    if (modelUrl) {
      try {
        const allowShadows = !this.isSoftwareGl && qCfg.shadows;
        const disableTransmission = this.isSoftwareGl || this.quality !== 'high' || detectTouchDevice();
        const tpl =
          this.vehicleLoader.getResolvedTemplate(modelUrl) ??
          (await this.vehicleLoader.loadGltfTemplate(modelUrl, kind, {
            targetLength: item.targetLength,
            orientationOffsetY: item.orientationOffsetY,
            wheelNames: item.wheelNames,
            shadows: allowShadows,
            disableTransmission,
          }));
        if (!this.destroyed) {
          applyGltfTemplateToVehicle(v, this.vehicleLoader, tpl, modelUrl);
        }
      } catch {
        this.showToast(`Erro ao carregar GLB de ${item.name}; a usar carroçaria 3D local.`);
      }
    }

    this.closeGarage();
    this.enterSpecificVehicle(v);
    this.sound.playDoorChime();
    this.showToast(`${item.name} entregue e pronto a conduzir!`);
    this.emitHud();
  }

  public async retrieveSavedVehicle(slotId: string): Promise<void> {
    const saved = this.savedVehicles.find((s) => s.slotId === slotId);
    if (!saved) return;
    await this.spawnCatalogVehicle(saved.catalogId, saved.color, saved.customModelUrl);
  }

  /**
   * Dedicated external .GLTF / .GLB importer for the Ford Mustang GT.
   * Replaces the Mustang catalog asset and all Mustang instances in the world
   * with the imported 3D model while preserving authentic 1:1 proportions.
   */
  public async importMustangModel(
    source: File | File[] | FileList | string | ArrayBuffer,
    options?: {
      orientationOffsetY?: number;
      fileName?: string;
      autoDrive?: boolean;
    },
  ): Promise<boolean> {
    try {
      const allowShadows = !this.isSoftwareGl && QUALITY_PRESETS[this.quality].shadows;
      const orientationOffsetY = options?.orientationOffsetY ?? this.mustangOrientationOffsetY;

      let storedSource: File[] | string | ArrayBuffer;
      if (typeof source === 'string') {
        storedSource = source;
        if (source.startsWith('blob:')) this.importedObjectUrls.push(source);
      } else if (source instanceof ArrayBuffer) {
        storedSource = source;
      } else if ('size' in source) {
        storedSource = [source];
      } else {
        storedSource = Array.from(source);
      }

      const tpl = await importMustangGltf(source, this.vehicleLoader, {
        targetLength: MUSTANG_DEFAULT_LENGTH,
        orientationOffsetY,
        wheelNames: MUSTANG_DEFAULT_WHEEL_NAMES,
        shadows: allowShadows,
      });

      if (this.destroyed) return false;

      this.mustangImportSource = storedSource;
      this.mustangOrientationOffsetY = orientationOffsetY;

      const sourceLabel =
        options?.fileName ??
        (Array.isArray(storedSource)
          ? storedSource.find((f) => /\.(glb|gltf)$/i.test(f.name))?.name ?? 'Mustang.glb'
          : typeof storedSource === 'string'
            ? storedSource.split('/').pop() || 'Mustang.glb'
            : 'Mustang.glb');

      this.vehicleCatalog = this.vehicleCatalog.map((item) =>
        item.id === 'mustang_gt' || item.kind === 'mustang'
          ? {
              ...item,
              modelUrl: tpl.url,
              orientationOffsetY,
              targetLength: MUSTANG_DEFAULT_LENGTH,
              description: `Modelo externo carregado (${sourceLabel}) em escala 1:1 (${MUSTANG_DEFAULT_LENGTH}m) com rodas articuladas.`,
            }
          : item,
      );

      for (const v of this.vehicles) {
        if (v.spec.kind === 'mustang') {
          applyGltfTemplateToVehicle(v, this.vehicleLoader, tpl, tpl.url);
        }
      }

      if (options?.autoDrive) {
        if (this.activeVehicle?.spec.kind === 'mustang') {
          this.closeGarage();
        } else {
          await this.spawnCatalogVehicle('mustang_gt', VEHICLE_SPECS.mustang.defaultColor, tpl.url);
        }
      }

      this.sound.playDoorChime();
      this.showToast(`Mustang 3D importado (${sourceLabel}) com proporções originais!`);
      this.emitHud();
      return true;
    } catch {
      this.showToast('Não foi possível importar o ficheiro .GLB/.GLTF do Mustang.');
      this.emitHud();
      return false;
    }
  }

  public async rotateMustangModel(quarterTurns = 1): Promise<boolean> {
    const mustangItem = this.vehicleCatalog.find((c) => c.id === 'mustang_gt' || c.kind === 'mustang');
    const source = this.mustangImportSource ?? mustangItem?.modelUrl;
    if (!source) return false;
    const nextOffset =
      (((this.mustangOrientationOffsetY + quarterTurns * (Math.PI / 2)) % (Math.PI * 2)) + Math.PI * 2) %
      (Math.PI * 2);
    return this.importMustangModel(source, {
      orientationOffsetY: nextOffset,
      autoDrive: false,
    });
  }

  public async importCustomGltfVehicle(
    fileName: string,
    objectUrl: string,
    baseKind: VehicleKind,
  ): Promise<void> {
    if (baseKind === 'mustang') {
      await this.importMustangModel(objectUrl, { fileName, autoDrive: true });
      return;
    }
    this.importedObjectUrls.push(objectUrl);
    try {
      const allowShadows = !this.isSoftwareGl && QUALITY_PRESETS[this.quality].shadows;
      const disableTransmission = this.isSoftwareGl || this.quality !== 'high' || detectTouchDevice();
      const spec = VEHICLE_SPECS[baseKind];
      const tpl = await this.vehicleLoader.loadGltfTemplate(objectUrl, baseKind, {
        targetLength: spec.halfLength * 2,
        shadows: allowShadows,
        disableTransmission,
      });

      const cleanName = fileName.replace(/\.(glb|gltf)$/i, '').slice(0, 26) || 'Modelo Personalizado';
      const customItem: VehicleCatalogItem = {
        id: `custom_${Date.now()}`,
        kind: baseKind,
        name: cleanName,
        category: 'GLB Importado',
        description: `Modelo 3D importado (${fileName}) com normalização automática de escala e rodas.`,
        defaultColor: '#f5b800',
        previewUrl: null,
        modelUrl: tpl.url,
        targetLength: spec.halfLength * 2,
        cockpitOffset: spec.cockpitOffset,
      };
      this.vehicleCatalog = [customItem, ...this.vehicleCatalog];
      await this.spawnCatalogVehicle(customItem.id, spec.defaultColor, tpl.url);
    } catch {
      this.showToast('Não foi possível ler o ficheiro .GLB/.GLTF selecionado.');
      this.emitHud();
    }
  }

  private findNearestVehicle(maxRange = 4.6): VehicleInstance | null {
    let best: VehicleInstance | null = null;
    let bestDist = maxRange;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const d = Math.hypot(v.x - this.player.x, v.z - this.player.z);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  private enterSpecificVehicle(best: VehicleInstance): void {
    this.activeVehicle = best;
    best.occupiedByPlayer = true;
    best.aiActive = false;
    const isCockpit = this.camRig.mode === 'cockpit';
    best.driverGroup.visible = !isCockpit;
    this.syncVehicleGlassOpacity(best, isCockpit);
    this.player.rig.group.visible = false;
    this.camRig.triggerVehicleTransition(true);
    this.sound.playDoorChime();

    // Hijacking moving traffic or police car triggers wanted level!
    if (best.isPolice) {
      this.police.addCrime(45);
      this.showToast('Roubaste uma viatura policial!');
    } else if (Math.abs(best.forwardSpeed) > 2.5) {
      this.police.addCrime(25);
    }
  }

  private enterNearestVehicle(): boolean {
    const best = this.findNearestVehicle(4.8);
    if (!best) return false;
    this.enterSpecificVehicle(best);
    return true;
  }

  private exitVehicle(): void {
    if (!this.activeVehicle) return;
    const v = this.activeVehicle;
    v.occupiedByPlayer = false;
    v.driverGroup.visible = false;
    this.syncVehicleGlassOpacity(v, false);
    this.sound.setHornActive(false);

    // Safe braking threshold when jumping out of moving vehicle
    if (Math.abs(v.forwardSpeed) > 5) {
      v.vx *= 0.25;
      v.vz *= 0.25;
      v.forwardSpeed *= 0.25;
    }

    const otherVehicles = this.vehicles
      .filter((o) => o !== v)
      .map((o) => ({ x: o.x, z: o.z, halfWidth: o.spec.halfWidth }));

    const exitPos = findSafeExitPosition(
      v.x,
      v.z,
      v.heading,
      v.spec.halfWidth,
      v.spec.halfLength,
      this.city.colliders,
      otherVehicles,
    );

    this.player.x = exitPos.x;
    this.player.z = exitPos.z;
    this.player.y = exitPos.y;
    this.player.heading = v.heading;
    this.player.rig.group.position.set(this.player.x, this.player.y, this.player.z);
    this.player.rig.group.visible = true;
    this.activeVehicle = null;

    this.mobileInput.gasHeld = false;
    this.mobileInput.brakeHeld = false;
    this.mobileInput.reverseHeld = false;
    this.mobileInput.handbrakeHeld = false;
    this.mobileInput.steerLeftHeld = false;
    this.mobileInput.steerRightHeld = false;
    this.mobileInput.hornHeld = false;

    this.camRig.triggerVehicleTransition(false);
    this.sound.playDoorChime();
  }

  private spawnParticles(x: number, y: number, z: number, count: number, isSpark: boolean): void {
    if (!QUALITY_PRESETS[this.quality].particles) return;
    const maxParticles = this.quality === 'high' ? 110 : 75;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= maxParticles) {
        const oldest = this.particles.shift();
        if (oldest) this.scene.remove(oldest.mesh);
      }
      const mesh = new THREE.Mesh(this.particleGeo, isSpark ? this.sparkMat : this.smokeMat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * (isSpark ? 9 : 3),
        vy: Math.random() * (isSpark ? 6 : 2.5) + 1,
        vz: (Math.random() - 0.5) * (isSpark ? 9 : 3),
        life: 0,
        maxLife: isSpark ? 0.38 : 0.65,
      });
    }
  }

  private performPlayerAttack(): void {
    if (this.activeVehicle) return;
    if (!this.player.triggerAttack()) return;

    const weapon = this.player.equippedWeapon;
    if (weapon === 'pistol') {
      const pistolItem = this.inventory.find((i) => i.id === 'pistol');
      if (!pistolItem || (pistolItem.ammo ?? 0) <= 0) {
        this.showToast('Sem munições! Compra na Loja 24/7.');
        this.player.setWeapon('fists');
        return;
      }
      pistolItem.ammo!--;
      this.sound.playGunshot();
      this.camRig.addShake(0.14);

      const dirX = Math.sin(this.player.heading);
      const dirZ = Math.cos(this.player.heading);
      const bx = this.player.x + dirX * 0.7;
      const by = this.player.y + 1.35;
      const bz = this.player.z + dirZ * 0.7;

      const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
      mesh.position.set(bx, by, bz);
      this.scene.add(mesh);
      this.bullets.push({
        mesh,
        x: bx,
        y: by,
        z: bz,
        vx: dirX * 58,
        vz: dirZ * 58,
        life: 0.7,
        fromPlayer: true,
      });
      this.police.addCrime(14);
      // Nearby pedestrians panic
      for (const ped of this.pedestrians) {
        if (Math.hypot(ped.x - this.player.x, ped.z - this.player.z) < 22) {
          ped.fleeTimer = 6;
        }
      }
    } else {
      // Melee punch / baseball bat
      this.sound.playPunch();
      const range = weapon === 'bat' ? 2.4 : 1.7;
      const dmg = weapon === 'bat' ? 40 : 22;
      const hitX = this.player.x + Math.sin(this.player.heading) * 1.1;
      const hitZ = this.player.z + Math.cos(this.player.heading) * 1.1;

      const checkHitTarget = (tx: number, tz: number, onHit: () => void) => {
        if (Math.hypot(tx - hitX, tz - hitZ) <= range) {
          onHit();
          return true;
        }
        return false;
      };

      for (const ped of this.pedestrians) {
        if (ped.downedTimer <= 0) {
          checkHitTarget(ped.x, ped.z, () => {
            ped.health -= dmg;
            ped.fleeTimer = 6;
            this.spawnParticles(ped.x, 1.2, ped.z, 5, true);
            this.hitstopTimer = 0.04;
            this.police.addCrime(24);
            if (ped.health <= 0) {
              ped.downedTimer = 10;
              this.player.cash += 25;
            }
          });
        }
      }

      for (const enemy of this.missionEnemies) {
        if (enemy.downedTimer <= 0) {
          checkHitTarget(enemy.x, enemy.z, () => {
            enemy.health -= dmg;
            this.spawnParticles(enemy.x, 1.2, enemy.z, 6, true);
            this.hitstopTimer = 0.045;
            if (enemy.health <= 0) {
              enemy.downedTimer = 999;
              this.player.cash += 80;
            }
          });
        }
      }

      for (const off of this.police.officers) {
        checkHitTarget(off.x, off.z, () => {
          off.health -= dmg;
          this.spawnParticles(off.x, 1.2, off.z, 6, true);
          this.police.addCrime(45);
        });
      }
    }
  }

  private scheduleNextTick(): void {
    if (this.destroyed) return;
    this.frameId = requestAnimationFrame((ts) => this.tick(ts));
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 16);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.destroyed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 16);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(timestamp?: number): void {
    if (this.destroyed) return;

    this.timer.update(timestamp);
    const rawDt = this.timer.getDelta();
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastMessage = null;
    }

    // Handle Garage shortcut (G) & Pause shortcut (Esc / P)
    if (this.desktopInput.consumeJustPressed('Escape') || this.desktopInput.consumeJustPressed('KeyP')) {
      if (this.garageOpen) {
        this.closeGarage();
      } else if (this.phase === 'playing' || this.phase === 'paused') {
        this.togglePause();
      }
    }
    if (this.phase === 'playing' && this.desktopInput.consumeJustPressed('KeyG')) {
      if (this.garageOpen) this.closeGarage();
      else this.openGarage();
    }

    if (this.phase === 'title') {
      this.dayProgress = (this.dayProgress + dt * 0.008) % 1;
      _tmpVec.set(0, 0, 0);
      this.city.update(this.elapsed, this.dayProgress, _tmpVec, !this.isSoftwareGl && QUALITY_PRESETS[this.quality].shadows);
      this.camRig.updateTitlePan(this.elapsed);
      this.desktopInput.clearFrameEdges();
    } else if (this.phase === 'playing' && !this.garageOpen) {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.stepSimulation(dt);
      }
    } else {
      // Paused / Garage / Wasted / Busted: silence continuous sounds
      this.sound.setHornActive(false);
      this.sound.updateContinuous(dt, false, 0, false, 0, false, false, this.elapsed);
      this.desktopInput.clearFrameEdges();
    }

    this.renderer.render(this.scene, this.camRig.camera);

    this.hudEmitTimer += dt;
    if (this.hudEmitTimer >= 0.075) {
      this.hudEmitTimer = 0;
      this.emitHud();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(() => this.tick());
    } else {
      this.scheduleNextTick();
    }
  }

  private stepSimulation(dt: number): void {
    // Advance Day/Night cycle smoothly (~4 minutes full day)
    this.dayProgress = (this.dayProgress + dt * 0.0042) % 1;

    const playerPos = _tmpVec.set(this.player.x, this.player.y, this.player.z);
    const qCfg = QUALITY_PRESETS[this.quality];
    const allowShadows = !this.isSoftwareGl && qCfg.shadows;
    const { nsGreen, isNight } = this.city.update(this.elapsed, this.dayProgress, playerPos, allowShadows);
    this.renderer.toneMappingExposure = THREE.MathUtils.damp(
      this.renderer.toneMappingExposure,
      isNight ? 0.96 : 1.09,
      2.5,
      dt,
    );

    // Camera Look (desktop mouse + mobile right pad)
    const desktopLook = this.desktopInput.consumeLookDelta(dt);
    const totalLookX = desktopLook.dx + this.mobileInput.lookDeltaX;
    const totalLookY = desktopLook.dy + this.mobileInput.lookDeltaY;
    const isLooking = desktopLook.isLooking || Math.abs(this.mobileInput.lookDeltaX) > 0.1;
    this.mobileInput.lookDeltaX = 0;
    this.mobileInput.lookDeltaY = 0;
    if (totalLookX !== 0 || totalLookY !== 0) {
      this.camRig.applyLookDelta(totalLookX, totalLookY, this.cameraSensitivity);
    }

    // Enter / Exit Vehicle (F or Mobile button)
    const enterExitTrigger =
      this.desktopInput.consumeJustPressed('KeyF') || this.mobileInput.enterExitPressed;
    this.mobileInput.enterExitPressed = false;
    if (enterExitTrigger) {
      if (this.activeVehicle) {
        this.exitVehicle();
      } else {
        this.enterNearestVehicle();
      }
    }

    // Gather directional movement inputs
    const keyFwd =
      (this.desktopInput.isHeld('KeyW') || this.desktopInput.isHeld('ArrowUp') ? 1 : 0) -
      (this.desktopInput.isHeld('KeyS') || this.desktopInput.isHeld('ArrowDown') ? 1 : 0);
    const keyRight =
      (this.desktopInput.isHeld('KeyD') || this.desktopInput.isHeld('ArrowRight') ? 1 : 0) -
      (this.desktopInput.isHeld('KeyA') || this.desktopInput.isHeld('ArrowLeft') ? 1 : 0);

    let activeSteerInput = 0;
    let activeBrakeOnly = false;

    if (this.activeVehicle) {
      // Toggle Chase / Interior Cockpit Camera (C or V)
      if (this.desktopInput.consumeJustPressed('KeyC') || this.desktopInput.consumeJustPressed('KeyV')) {
        this.toggleVehicleCameraMode();
      }

      // Driving Controls (Desktop + Dedicated Continuous Mobile Buttons + Stick)
      const wantBrakeOnly =
        this.mobileInput.brakeHeld &&
        !this.mobileInput.reverseHeld &&
        !this.mobileInput.gasHeld &&
        keyFwd === 0;
      activeBrakeOnly = wantBrakeOnly;

      const mobileThrottle =
        (this.mobileInput.gasHeld ? 1 : 0) -
        (this.mobileInput.reverseHeld || this.mobileInput.brakeHeld ? 1 : 0) ||
        this.mobileInput.moveY;
      const throttle = wantBrakeOnly ? 0 : THREE.MathUtils.clamp(keyFwd + mobileThrottle, -1, 1);

      const mobileSteer =
        (this.mobileInput.steerLeftHeld ? 1 : 0) -
        (this.mobileInput.steerRightHeld ? 1 : 0) -
        this.mobileInput.moveX;
      const steer = THREE.MathUtils.clamp(-keyRight + mobileSteer, -1, 1);
      activeSteerInput = steer;

      const handbrake =
        this.desktopInput.isHeld('Space') ||
        this.mobileInput.handbrakeHeld ||
        this.mobileInput.jumpPressed;
      this.mobileInput.jumpPressed = false;

      const hornActive = this.desktopInput.isHeld('KeyH') || this.mobileInput.hornHeld;
      this.sound.setHornActive(hornActive);
      if (hornActive) {
        for (let pi = 0; pi < this.pedestrians.length; pi++) {
          const ped = this.pedestrians[pi];
          if (ped.downedTimer <= 0 && Math.hypot(ped.x - this.player.x, ped.z - this.player.z) < 12) {
            ped.fleeTimer = Math.max(ped.fleeTimer, 2.2);
          }
        }
      }

      stepVehiclePhysics(
        this.activeVehicle,
        { throttle, steer, handbrake, brakeOnly: wantBrakeOnly },
        dt,
        this.city.colliders,
        this.vehicles,
        isNight,
        this.elapsed,
        (impact, ix, iz) => {
          this.sound.playCollision(impact / 22);
          this.camRig.addShake(Math.min(0.45, impact * 0.02));
          this.spawnParticles(ix, 0.8, iz, 7, true);
          if (impact > 7) {
            for (let pi = 0; pi < this.pedestrians.length; pi++) {
              const ped = this.pedestrians[pi];
              if (ped.downedTimer <= 0 && Math.hypot(ped.x - ix, ped.z - iz) < 18) {
                ped.fleeTimer = Math.max(ped.fleeTimer, 4.5);
              }
            }
          }
        },
        () => {
          this.sound.playGearShift();
        },
      );

      this.activeVehicle.driverGroup.visible = this.camRig.mode !== 'cockpit';
      this.player.x = this.activeVehicle.x;
      this.player.y = this.activeVehicle.y;
      this.player.z = this.activeVehicle.z;
      this.player.heading = this.activeVehicle.heading;

      // Rear-tire drift smoke particles
      if (this.activeVehicle.isDrifting) {
        this.driftSmokeTimer -= dt;
        if (this.driftSmokeTimer <= 0) {
          this.driftSmokeTimer = 0.06;
          const v = this.activeVehicle;
          const fwdX = Math.sin(v.heading);
          const fwdZ = Math.cos(v.heading);
          const rightX = Math.cos(v.heading);
          const rightZ = -Math.sin(v.heading);
          const rearZ = -v.spec.halfLength * 0.62;
          if (v.spec.kind === 'moto') {
            this.spawnParticles(v.x + fwdX * rearZ, v.y + 0.18, v.z + fwdZ * rearZ, 1, false);
          } else {
            const trackW = v.spec.halfWidth - 0.15;
            this.spawnParticles(
              v.x + fwdX * rearZ - rightX * trackW,
              v.y + 0.18,
              v.z + fwdZ * rearZ - rightZ * trackW,
              1,
              false,
            );
            this.spawnParticles(
              v.x + fwdX * rearZ + rightX * trackW,
              v.y + 0.18,
              v.z + fwdZ * rearZ + rightZ * trackW,
              1,
              false,
            );
          }
        }
      } else {
        this.driftSmokeTimer = 0;
      }

      // Progressive engine damage smoke & critical sparks
      const dmgRatio = this.activeVehicle.maxHealth > 0 ? this.activeVehicle.health / this.activeVehicle.maxHealth : 1;
      if (dmgRatio < 0.48 && this.activeVehicle.health > 0) {
        this.damageSmokeTimer -= dt;
        if (this.damageSmokeTimer <= 0) {
          this.damageSmokeTimer = dmgRatio < 0.25 ? 0.08 : 0.16;
          const v = this.activeVehicle;
          const hoodX = v.x + Math.sin(v.heading) * (v.spec.halfLength * 0.62);
          const hoodZ = v.z + Math.cos(v.heading) * (v.spec.halfLength * 0.62);
          this.spawnParticles(hoodX, v.y + 0.95, hoodZ, 1, false);
          if (dmgRatio < 0.25 && Math.random() < 0.45) {
            this.spawnParticles(hoodX, v.y + 0.95, hoodZ, 1, true);
          }
        }
      } else {
        this.damageSmokeTimer = 0;
      }

      // Vehicle exploded / totaled check
      if (this.activeVehicle.health <= 0) {
        this.spawnParticles(this.activeVehicle.x, 1.4, this.activeVehicle.z, 18, true);
        this.spawnParticles(this.activeVehicle.x, 1.8, this.activeVehicle.z, 8, false);
        for (const ped of this.pedestrians) {
          if (Math.hypot(ped.x - this.activeVehicle.x, ped.z - this.activeVehicle.z) < 26) {
            ped.fleeTimer = 7;
          }
        }
        this.exitVehicle();
        this.player.applyDamage(35);
      }
    } else {
      // On-Foot Controls
      const moveFwd = THREE.MathUtils.clamp(keyFwd + this.mobileInput.moveY, -1, 1);
      const moveRight = THREE.MathUtils.clamp(keyRight + this.mobileInput.moveX, -1, 1);
      const sprint =
        this.desktopInput.isHeld('ShiftLeft') ||
        this.desktopInput.isHeld('ShiftRight') ||
        this.mobileInput.sprintHeld;
      const jump = this.desktopInput.consumeJustPressed('Space') || this.mobileInput.jumpPressed;
      this.mobileInput.jumpPressed = false;

      this.player.updateOnFoot(
        dt,
        moveFwd,
        moveRight,
        this.camRig.yaw,
        sprint,
        jump,
        this.city.colliders,
      );

      // Attack / Shoot
      if (this.desktopInput.consumeAttack() || this.mobileInput.attackPressed) {
        this.mobileInput.attackPressed = false;
        this.performPlayerAttack();
      }
    }

    // Quick Weapon Switch (1, 2, 3)
    if (this.desktopInput.consumeJustPressed('Digit1')) this.selectWeapon('fists');
    if (this.desktopInput.consumeJustPressed('Digit2')) this.selectWeapon('bat');
    if (this.desktopInput.consumeJustPressed('Digit3')) this.selectWeapon('pistol');

    // Step AI Traffic Vehicles & Distance Visibility Culling (Android FPS optimization)
    const vehCullDistSq = Math.pow(qCfg.drawDistance * 0.9, 2);
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const dxP = v.x - this.player.x;
      const dzP = v.z - this.player.z;
      v.group.visible = v === this.activeVehicle || dxP * dxP + dzP * dzP <= vehCullDistSq;
      if (v.aiActive && !v.occupiedByPlayer) {
        stepTrafficAI(
          v,
          this.vehicles,
          playerPos,
          nsGreen,
          dt,
          this.city.colliders,
          isNight,
          this.elapsed,
          () => this.sound.playHorn(),
          (impact, ix, iz) => {
            if (Math.hypot(ix - this.player.x, iz - this.player.z) < 42) {
              this.sound.playCollision(Math.min(1, impact / 22));
              this.spawnParticles(ix, 0.8, iz, 5, true);
            }
          },
        );
      } else if (!v.occupiedByPlayer && !v.isPolice) {
        // Parked car gentle settle
        if (Math.hypot(v.vx, v.vz) > 0.1) {
          stepVehiclePhysics(
            v,
            { throttle: 0, steer: 0, handbrake: true },
            dt,
            this.city.colliders,
            this.vehicles,
            isNight,
            this.elapsed,
          );
        }
      }
    }

    // Step Pedestrians & Vehicle-vs-Pedestrian Impact (with distance LOD culling)
    const pedCullDistSq = Math.pow(qCfg.drawDistance * 0.62, 2);
    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i];
      stepPedestrian(ped, dt, playerPos, this.city.colliders, undefined, pedCullDistSq);

      if (this.activeVehicle && ped.downedTimer <= 0 && Math.abs(this.activeVehicle.forwardSpeed) > 4.5) {
        const d = Math.hypot(ped.x - this.activeVehicle.x, ped.z - this.activeVehicle.z);
        if (d < 1.8) {
          ped.health = 0;
          ped.downedTimer = 10;
          this.sound.playCollision(0.5);
          this.police.addCrime(35);
          this.spawnParticles(ped.x, 1.0, ped.z, 6, false);
        }
      }
    }

    // Step Mission Action Enemies
    let activeEnemiesCount = 0;
    for (let i = this.missionEnemies.length - 1; i >= 0; i--) {
      const enemy = this.missionEnemies[i];
      if (enemy.downedTimer > 0) {
        enemy.rig.bodyPivot.rotation.x = Math.PI / 2;
        enemy.rig.bodyPivot.position.y = 0.25;
        continue;
      }
      activeEnemiesCount++;
      stepPedestrian(enemy, dt, playerPos, this.city.colliders, (shooter) => {
        const dx = this.player.x - shooter.x;
        const dz = this.player.z - shooter.z;
        const len = Math.hypot(dx, dz) || 1;
        const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
        mesh.position.set(shooter.x, 1.35, shooter.z);
        this.scene.add(mesh);
        this.bullets.push({
          mesh,
          x: shooter.x,
          y: 1.35,
          z: shooter.z,
          vx: (dx / len) * 34,
          vz: (dz / len) * 34,
          life: 0.9,
          fromPlayer: false,
        });
      });

      if (this.activeVehicle && Math.abs(this.activeVehicle.forwardSpeed) > 5) {
        if (Math.hypot(enemy.x - this.activeVehicle.x, enemy.z - this.activeVehicle.z) < 2.0) {
          enemy.health = 0;
          enemy.downedTimer = 999;
          this.sound.playCollision(0.5);
          this.spawnParticles(enemy.x, 1.0, enemy.z, 7, true);
        }
      }
    }

    // Update Bullets (including building wall occlusion)
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      const prevX = b.x;
      const prevZ = b.z;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);

      let hit = false;
      const wallFrac = raycastCollidersFraction(
        prevX,
        b.y,
        prevZ,
        b.x,
        b.y,
        b.z,
        this.city.colliders,
        0.05,
      );
      if (wallFrac < 0.99) {
        const hx = THREE.MathUtils.lerp(prevX, b.x, wallFrac);
        const hz = THREE.MathUtils.lerp(prevZ, b.z, wallFrac);
        this.spawnParticles(hx, b.y, hz, 3, true);
        hit = true;
      }

      if (!hit && b.fromPlayer) {
        for (const enemy of this.missionEnemies) {
          if (enemy.downedTimer <= 0 && Math.hypot(enemy.x - b.x, enemy.z - b.z) < 0.9) {
            enemy.health -= 38;
            this.spawnParticles(b.x, b.y, b.z, 6, true);
            if (enemy.health <= 0) {
              enemy.downedTimer = 999;
              this.player.cash += 80;
            }
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const off of this.police.officers) {
            if (Math.hypot(off.x - b.x, off.z - b.z) < 0.9) {
              off.health -= 35;
              this.police.addCrime(35);
              this.spawnParticles(b.x, b.y, b.z, 5, true);
              hit = true;
              break;
            }
          }
        }
        if (!hit) {
          for (const ped of this.pedestrians) {
            if (ped.downedTimer <= 0 && Math.hypot(ped.x - b.x, ped.z - b.z) < 0.85) {
              ped.health -= 40;
              ped.fleeTimer = 6;
              this.police.addCrime(28);
              this.spawnParticles(b.x, b.y, b.z, 5, true);
              if (ped.health <= 0) ped.downedTimer = 10;
              hit = true;
              break;
            }
          }
        }
      } else if (!hit) {
        // Enemy bullet vs Player
        if (Math.hypot(this.player.x - b.x, this.player.z - b.z) < (this.activeVehicle ? 1.5 : 0.7)) {
          this.player.applyDamage(this.activeVehicle ? 4 : 9);
          this.camRig.addShake(0.15);
          hit = true;
        }
      }

      if (hit || b.life <= 0) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      }
    }

    // Update Police System
    const { nearestPoliceDist } = this.police.update(
      dt,
      playerPos,
      Boolean(this.activeVehicle),
      this.vehicles,
      this.city.colliders,
      isNight,
      this.elapsed,
      (dmg) => {
        this.player.applyDamage(dmg);
        this.camRig.addShake(0.12);
      },
      () => {
        this.phase = 'busted';
        this.emitHud();
      },
      (bonus) => {
        this.player.cash += bonus;
        this.sound.playMissionSuccess();
        this.showToast(`Polícia despistada! +$${bonus}`);
      },
    );

    // Update Missions
    this.missions.update(
      dt,
      this.elapsed,
      playerPos,
      this.police.wantedStars,
      activeEnemiesCount,
      (reward, title) => {
        this.player.cash += reward;
        this.sound.playMissionSuccess();
        this.clearMissionEnemies();
        this.showToast(`Missão concluída: ${title} (+$${reward})`);
      },
      (reason) => {
        this.clearMissionEnemies();
        this.showToast(`Missão falhada: ${reason}`);
      },
    );

    // Contextual World Interactions (Nearby Car, Gas Station, Shop, Mission Marker)
    this.updateContextualPrompt();
    const interactTrigger =
      this.desktopInput.consumeJustPressed('KeyE') || this.mobileInput.interactPressed;
    this.mobileInput.interactPressed = false;
    if (interactTrigger && this.currentInteractAction) {
      this.currentInteractAction();
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      p.vy -= 14 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const s = 1 - p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.01, s));
      if (p.life >= p.maxLife) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
      }
    }

    // Update Camera (Chase with Turn Framing & Collider Anti-Clipping OR Interior Cockpit)
    const targetHeading = this.activeVehicle ? this.activeVehicle.heading : this.player.heading;
    const speed = this.activeVehicle ? this.activeVehicle.forwardSpeed : 0;
    this.camRig.updateFollow(
      dt,
      _tmpVec.set(this.player.x, this.player.y, this.player.z),
      targetHeading,
      Boolean(this.activeVehicle),
      speed,
      isLooking,
      this.activeVehicle ? this.activeVehicle.slipAngle : 0,
      this.city.colliders,
      activeSteerInput,
      this.activeVehicle?.spec.cockpitOffset,
      this.activeVehicle?.pitchAngle ?? 0,
      this.activeVehicle?.rollAngle ?? 0,
      this.player.isSprinting,
    );

    // Update Continuous Procedural Audio
    const sirenIntensity =
      this.police.wantedStars > 0 ? THREE.MathUtils.clamp(1 - nearestPoliceDist / 85, 0.15, 1) : 0;
    const speedNorm = this.activeVehicle
      ? Math.min(1, Math.abs(this.activeVehicle.forwardSpeed) / this.activeVehicle.spec.maxSpeed)
      : 0;
    const isHardBraking =
      Boolean(this.activeVehicle) &&
      (activeBrakeOnly || this.mobileInput.handbrakeHeld || this.desktopInput.isHeld('Space')) &&
      Math.abs(speed) > 4;
    this.sound.updateContinuous(
      dt,
      Boolean(this.activeVehicle),
      speedNorm,
      this.activeVehicle?.isDrifting ?? false,
      sirenIntensity,
      this.player.isMoving,
      this.player.isSprinting,
      this.elapsed,
      this.activeVehicle?.rpm,
      isHardBraking,
    );

    // Player Death Check
    if (this.player.health <= 0) {
      this.phase = 'wasted';
      if (document.pointerLockElement) document.exitPointerLock();
      this.emitHud();
    }
  }

  private updateContextualPrompt(): void {
    this.currentInteractPrompt = null;
    this.currentInteractAction = null;
    this.inGarageZone = false;

    // 1. Check Gas Station / Garage / Shop
    for (const z of this.city.interactiveZones) {
      const d = Math.hypot(this.player.x - z.x, this.player.z - z.z);
      if (d <= z.radius) {
        if (z.kind === 'garage') {
          this.inGarageZone = true;
          this.currentInteractPrompt = `[E] ${z.label}`;
          this.currentInteractAction = () => this.openGarage();
          return;
        } else if (z.kind === 'gas') {
          if (this.activeVehicle) {
            this.currentInteractPrompt = `[E] ${z.label}`;
            this.currentInteractAction = () => this.repairActiveVehicle();
            return;
          }
        } else if (z.kind === 'shop') {
          this.currentInteractPrompt = '[E] Comprar Munições & Kit Médico ($100)';
          this.currentInteractAction = () => {
            if (this.player.cash < 100) {
              this.showToast('Precisas de $100 para reabastecer na loja.');
              return;
            }
            this.player.cash -= 100;
            const pistol = this.inventory.find((i) => i.id === 'pistol');
            if (pistol) pistol.ammo = Math.min(60, (pistol.ammo ?? 0) + 18);
            this.player.health = Math.min(this.player.maxHealth, this.player.health + 50);
            this.sound.playMissionSuccess();
            this.showToast('Loja 24/7: +18 Munições & +50 Vida (-$100)');
          };
          return;
        }
      }
    }

    // 2. Check Mission Start Beacons
    if (!this.missions.progress.activeMissionId) {
      for (const m of CITY_MISSIONS) {
        const d = Math.hypot(this.player.x - m.startX, this.player.z - m.startZ);
        if (d <= 4.5) {
          this.currentInteractPrompt = `[E] Missão: ${m.title} (+$${m.reward})`;
          this.currentInteractAction = () => this.startMissionById(m.id);
          return;
        }
      }
    }

    // 3. Nearby Enterable Vehicle prompt
    if (!this.activeVehicle) {
      for (const v of this.vehicles) {
        if (Math.hypot(v.x - this.player.x, v.z - this.player.z) < 4.2) {
          this.currentInteractPrompt = `[F] Entrar em ${v.spec.name}`;
          return;
        }
      }
    }
  }

  private formatTimeOfDay(progress: number): string {
    const totalMinutes = Math.floor(progress * 24 * 60);
    const hh = Math.floor(totalMinutes / 60)
      .toString()
      .padStart(2, '0');
    const mm = (totalMinutes % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private buildMinimapEntities(): MinimapEntity[] {
    const minimapEntities: MinimapEntity[] = [];

    for (const z of this.city.interactiveZones) {
      minimapEntities.push({
        x: z.x,
        z: z.z,
        kind: z.kind === 'shop' ? 'shop' : z.kind === 'garage' ? 'garage' : 'gas',
      });
    }

    if (!this.missions.progress.activeMissionId) {
      for (const m of CITY_MISSIONS) {
        minimapEntities.push({ x: m.startX, z: m.startZ, kind: 'mission' });
      }
    } else {
      const active = this.missions.getActiveMission();
      const step = active?.steps[this.missions.progress.currentStepIndex];
      if (step) {
        minimapEntities.push({ x: step.targetX, z: step.targetZ, kind: 'checkpoint' });
      }
      for (const e of this.missionEnemies) {
        if (e.downedTimer <= 0) minimapEntities.push({ x: e.x, z: e.z, kind: 'target' });
      }
    }

    for (const v of this.vehicles) {
      if (v === this.activeVehicle) continue;
      if (v.isPolice && v.sirenActive) {
        minimapEntities.push({ x: v.x, z: v.z, kind: 'police', heading: v.heading });
      } else if (Math.hypot(v.x - this.player.x, v.z - this.player.z) < 185) {
        minimapEntities.push({
          x: v.x,
          z: v.z,
          kind: v.aiActive ? 'traffic' : 'parked',
          heading: v.heading,
        });
      }
    }

    return minimapEntities;
  }

  public getLiveMinimapState() {
    return {
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: this.activeVehicle ? this.activeVehicle.heading : this.player.heading,
      cameraYaw: this.camRig.yaw,
      speedKmh: this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.forwardSpeed) * 3.6) : 0,
      wantedStars: this.police.wantedStars,
      wantedFlashing: this.police.isFlashing,
      elapsed: this.elapsed,
      entities: this.buildMinimapEntities(),
    };
  }

  private emitHud(): void {
    const minimapEntities = this.buildMinimapEntities();
    const speedKmh = this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.forwardSpeed) * 3.6) : 0;

    this.onHudUpdate({
      phase: this.phase,
      health: Math.round(this.player.health),
      maxHealth: this.player.maxHealth,
      armor: Math.round(this.player.armor),
      stamina: Math.round(this.player.stamina),
      cash: Math.round(this.player.cash),
      wantedStars: this.police.wantedStars,
      wantedFlashing: this.police.isFlashing,
      evadeProgress: this.police.evadeTimer / this.police.evadeDuration,
      inVehicle: Boolean(this.activeVehicle),
      vehicleName: this.activeVehicle ? this.activeVehicle.spec.name : '',
      speedKmh,
      vehicleHealth: this.activeVehicle
        ? Math.round((this.activeVehicle.health / this.activeVehicle.maxHealth) * 100)
        : 100,
      vehicleGear: this.activeVehicle ? this.activeVehicle.gear : 1,
      vehicleRpm: this.activeVehicle ? this.activeVehicle.rpm : 0,
      isDrifting: this.activeVehicle ? this.activeVehicle.isDrifting : false,
      isReversing: this.activeVehicle ? this.activeVehicle.forwardSpeed < -0.5 : false,
      cameraMode: this.camRig.mode,
      inGarageZone: this.inGarageZone,
      garageOpen: this.garageOpen,
      vehicleCatalog: this.vehicleCatalog,
      savedVehicles: this.savedVehicles,
      district: getDistrictName(this.player.x, this.player.z),
      timeOfDayLabel: this.formatTimeOfDay(this.dayProgress),
      dayProgress: this.dayProgress,
      interactPrompt: this.currentInteractPrompt,
      equippedWeapon: this.player.equippedWeapon,
      inventory: this.inventory.map((i) => ({ ...i })),
      mission: { ...this.missions.progress },
      availableMissions: CITY_MISSIONS,
      quality: this.quality,
      muted: this.sound.muted,
      musicEnabled: this.sound.musicEnabled,
      touchControlsEnabled: this.touchControlsEnabled,
      cameraSensitivity: this.cameraSensitivity,
      playerX: this.player.x,
      playerZ: this.player.z,
      playerHeading: this.activeVehicle ? this.activeVehicle.heading : this.player.heading,
      minimapEntities,
      toastMessage: this.toastMessage,
    });
  }

  public triggerMobileAction(action: 'jump' | 'enterExit' | 'interact' | 'attack' | 'toggleCamera'): void {
    this.sound.init();
    if (action === 'jump') this.mobileInput.jumpPressed = true;
    if (action === 'enterExit') this.mobileInput.enterExitPressed = true;
    if (action === 'interact') this.mobileInput.interactPressed = true;
    if (action === 'attack') this.mobileInput.attackPressed = true;
    if (action === 'toggleCamera') this.toggleVehicleCameraMode();
  }

  private handleResize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camRig.resize(width / height);
    this.renderer.setSize(width, height);
  }

  public dispose(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResizeBound);
    this.detachInput();
    this.timer.dispose();
    this.player.dispose();
    this.sound.dispose();
    this.vehicleLoader.disposeAll();
    for (const url of this.importedObjectUrls) {
      URL.revokeObjectURL(url);
    }
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
