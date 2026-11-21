import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  GamePhase,
  GraphicsQuality,
  HudSnapshot,
  InventoryItem,
  MinimapEntity,
  QUALITY_PRESETS,
  VehicleKind,
  WeaponId,
} from './types';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { SoundEngine } from './audio';
import { buildCity, CityWorld, ROAD_COORDS } from './city';
import { createVehicle, stepTrafficAI, stepVehiclePhysics, VehicleInstance } from './vehicles';
import { createPedestrian, Pedestrian, PlayerController, stepPedestrian } from './player';
import { PoliceSystem } from './police';
import { CITY_MISSIONS, MissionManager } from './missions';
import { ThirdPersonCamera } from './camera';
import { DesktopInputManager } from './controls';
import { createMobileInputState, detectTouchDevice, MobileInputState } from './mobile-controls';
import { getDistrictName, groundHeightAt } from './physics';

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

    this.spawnInitialWorldActors();

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

  private spawnInitialWorldActors(): void {
    const qCfg = QUALITY_PRESETS[this.quality];

    // Hero Parked Vehicles right near player spawn & key landmarks
    const parkedSpecs: { kind: VehicleKind; x: number; z: number; h: number; color?: number }[] = [
      { kind: 'sports', x: -8, z: 6, h: Math.PI / 2, color: 0xe11d48 },
      { kind: 'sedan', x: -20, z: 10, h: -Math.PI / 2, color: 0x2563eb },
      { kind: 'moto', x: -6, z: 22, h: 0, color: 0xf97316 },
      { kind: 'suv', x: 76, z: -26, h: Math.PI, color: 0x1e293b }, // Parking lot
      { kind: 'sports', x: 84, z: -26, h: Math.PI, color: 0xfacc15 }, // Parking lot
      { kind: 'van', x: 24, z: 36, h: Math.PI / 2, color: 0xf1f5f9 }, // Near gas station
      { kind: 'police', x: 76, z: -84, h: 0 }, // Police precinct
    ];

    parkedSpecs.forEach((p, idx) => {
      const v = createVehicle(
        `parked_${idx}`,
        p.kind,
        p.x,
        p.z,
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
    const kinds: VehicleKind[] = ['sedan', 'sedan', 'suv', 'sports', 'van', 'moto'];
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
        const v = createVehicle(
          `traffic_${Date.now()}_${i}`,
          kind,
          x,
          z,
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
      0x111827,
      this.textures,
    );
    this.scene.add(car.group);
    this.vehicles.push(car);
    this.sound.playDoorChime();
    this.showToast('Comet GT entregue junto de ti (-$100)!');
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

  private enterNearestVehicle(): boolean {
    let best: VehicleInstance | null = null;
    let bestDist = 4.6;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      const d = Math.hypot(v.x - this.player.x, v.z - this.player.z);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    if (!best) return false;

    this.activeVehicle = best;
    best.occupiedByPlayer = true;
    best.aiActive = false;
    this.player.rig.group.visible = false;
    this.sound.playDoorChime();

    // Hijacking moving traffic or police car triggers wanted level!
    if (best.isPolice) {
      this.police.addCrime(45);
      this.showToast('Roubaste uma viatura policial!');
    } else if (Math.abs(best.forwardSpeed) > 2.5) {
      this.police.addCrime(25);
    }
    return true;
  }

  private exitVehicle(): void {
    if (!this.activeVehicle) return;
    const v = this.activeVehicle;
    v.occupiedByPlayer = false;
    // Place player cleanly beside driver door (left side)
    const leftX = -Math.cos(v.heading) * (v.spec.halfWidth + 0.95);
    const leftZ = Math.sin(v.heading) * (v.spec.halfWidth + 0.95);
    this.player.x = v.x + leftX;
    this.player.z = v.z + leftZ;
    this.player.y = groundHeightAt(this.player.x, this.player.z);
    this.player.heading = v.heading;
    this.player.rig.group.position.set(this.player.x, this.player.y, this.player.z);
    this.player.rig.group.visible = true;
    this.activeVehicle = null;
    this.sound.playDoorChime();
  }

  private spawnParticles(x: number, y: number, z: number, count: number, isSpark: boolean): void {
    if (!QUALITY_PRESETS[this.quality].particles) return;
    for (let i = 0; i < count; i++) {
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
      this.frameId = window.setTimeout(cb, 80);
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
        this.frameId = window.setTimeout(cb, 80);
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

    // Handle Pause shortcut (Esc / P)
    if (this.desktopInput.consumeJustPressed('Escape') || this.desktopInput.consumeJustPressed('KeyP')) {
      if (this.phase === 'playing' || this.phase === 'paused') {
        this.togglePause();
      }
    }

    if (this.phase === 'title') {
      this.dayProgress = (this.dayProgress + dt * 0.008) % 1;
      _tmpVec.set(0, 0, 0);
      this.city.update(this.elapsed, this.dayProgress, _tmpVec, !this.isSoftwareGl && QUALITY_PRESETS[this.quality].shadows);
      this.camRig.updateTitlePan(this.elapsed);
      this.desktopInput.clearFrameEdges();
    } else if (this.phase === 'playing') {
      if (this.hitstopTimer > 0) {
        this.hitstopTimer -= dt;
      } else {
        this.stepSimulation(dt);
      }
    } else {
      // Paused / Wasted / Busted: silence continuous sounds
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
    const allowShadows = !this.isSoftwareGl && QUALITY_PRESETS[this.quality].shadows;
    const { nsGreen, isNight } = this.city.update(this.elapsed, this.dayProgress, playerPos, allowShadows);

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

    if (this.activeVehicle) {
      // Driving Controls
      const mobileThrottle =
        (this.mobileInput.gasHeld ? 1 : 0) - (this.mobileInput.brakeHeld ? 1 : 0) ||
        this.mobileInput.moveY;
      const throttle = THREE.MathUtils.clamp(keyFwd + mobileThrottle, -1, 1);
      const steer = THREE.MathUtils.clamp(-(keyRight + this.mobileInput.moveX), -1, 1);
      const handbrake = this.desktopInput.isHeld('Space') || this.mobileInput.jumpPressed;

      if (this.desktopInput.isHeld('KeyH') || this.mobileInput.hornHeld) {
        this.sound.playHorn();
      }

      stepVehiclePhysics(
        this.activeVehicle,
        { throttle, steer, handbrake },
        dt,
        this.city.colliders,
        this.vehicles,
        isNight,
        this.elapsed,
        (impact, ix, iz) => {
          this.sound.playCollision(impact / 22);
          this.camRig.addShake(Math.min(0.45, impact * 0.02));
          this.spawnParticles(ix, 0.8, iz, 7, true);
        },
      );

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

      // Vehicle exploded / totaled check
      if (this.activeVehicle.health <= 0) {
        this.spawnParticles(this.activeVehicle.x, 1.4, this.activeVehicle.z, 18, true);
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

    // Step AI Traffic Vehicles
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
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

    // Step Pedestrians & Vehicle-vs-Pedestrian Impact
    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i];
      stepPedestrian(ped, dt, playerPos, this.city.colliders);

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

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.mesh.position.set(b.x, b.y, b.z);

      let hit = false;
      if (b.fromPlayer) {
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
      } else {
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

    // Update Camera
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
    );

    // Update Continuous Procedural Audio
    const sirenIntensity =
      this.police.wantedStars > 0 ? THREE.MathUtils.clamp(1 - nearestPoliceDist / 85, 0.15, 1) : 0;
    const speedNorm = this.activeVehicle
      ? Math.min(1, Math.abs(this.activeVehicle.forwardSpeed) / this.activeVehicle.spec.maxSpeed)
      : 0;
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

    // 1. Check Gas Station / Garage / Shop
    for (const z of this.city.interactiveZones) {
      const d = Math.hypot(this.player.x - z.x, this.player.z - z.z);
      if (d <= z.radius) {
        if (z.kind === 'gas' || z.kind === 'garage') {
          if (this.activeVehicle) {
            this.currentInteractPrompt = `[E] ${z.label}`;
            this.currentInteractAction = () => {
              if (!this.activeVehicle) return;
              if (this.player.cash < 50) {
                this.showToast('Precisas de $50 para reparar.');
                return;
              }
              this.player.cash -= 50;
              this.activeVehicle.health = this.activeVehicle.maxHealth;
              this.sound.playMissionSuccess();
              this.showToast('Veículo reparado e abastecido (-$50)!');
            };
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
      minimapEntities.push({ x: z.x, z: z.z, kind: z.kind === 'shop' ? 'shop' : 'gas' });
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
        minimapEntities.push({ x: v.x, z: v.z, kind: 'police' });
      } else if (Math.hypot(v.x - this.player.x, v.z - this.player.z) < 120) {
        minimapEntities.push({ x: v.x, z: v.z, kind: v.aiActive ? 'traffic' : 'parked' });
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

  public triggerMobileAction(action: 'jump' | 'enterExit' | 'interact' | 'attack'): void {
    this.sound.init();
    if (action === 'jump') this.mobileInput.jumpPressed = true;
    if (action === 'enterExit') this.mobileInput.enterExitPressed = true;
    if (action === 'interact') this.mobileInput.interactPressed = true;
    if (action === 'attack') this.mobileInput.attackPressed = true;
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
    this.sound.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
