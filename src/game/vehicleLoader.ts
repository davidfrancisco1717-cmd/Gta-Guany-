import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { VEHICLE_SPECS, VehicleCatalogItem, VehicleKind } from './types';

export interface NormalizedWheelTemplate {
  pivot: THREE.Group;
  spinMesh: THREE.Group;
  localX: number;
  localZ: number;
  restY: number;
  isFront: boolean;
}

export interface VehicleModelTemplate {
  url: string;
  root: THREE.Group;
  wheels: NormalizedWheelTemplate[];
  hasMergedWheels: boolean;
  wheelRadius: number;
  halfWidth: number;
  halfLength: number;
  height: number;
}

export interface GltfNormalizeOptions {
  targetLength?: number;
  orientationOffsetY?: number;
  wheelNames?: string[];
  shadows?: boolean;
  disableTransmission?: boolean;
}

export interface MustangGltfImportOptions extends GltfNormalizeOptions {
  cacheKey?: string;
}

export const MUSTANG_DEFAULT_LENGTH = 4.784;
export const MUSTANG_DEFAULT_WHEEL_NAMES = [
  'wheel',
  'roda',
  'tire',
  'tyre',
  'rim',
  'pneu',
  'aro',
  'ftire',
  'rtire',
];

export const BUILTIN_VEHICLE_CATALOG: VehicleCatalogItem[] = [
  {
    id: 'camaro_ss',
    kind: 'camaro',
    name: VEHICLE_SPECS.camaro.name,
    category: 'Muscle Coupe',
    description: 'Coupé V8 clássico amarelo com faixas desportivas pretas, binário elevado e tração traseira.',
    defaultColor: '#f5b800',
    previewUrl: '/assets/aistudio/camaro-1_272dea49.webp',
    modelUrl: null,
    orientationOffsetY: 0,
    targetLength: 4.68,
    cockpitOffset: VEHICLE_SPECS.camaro.cockpitOffset,
    wheelNames: ['wheel', 'roda', 'tire', 'rim'],
  },
  {
    id: 'mustang_gt',
    kind: 'mustang',
    name: VEHICLE_SPECS.mustang.name,
    category: 'Muscle Coupe',
    description: 'Fastback V8 5.0 Race Red com suporte direto para importação de modelo 3D externo (.GLB/.GLTF).',
    defaultColor: '#D91E18',
    previewUrl: '/assets/aistudio/sportscarfordmustangcoupe2015_9_418f1262.webp',
    modelUrl: null,
    orientationOffsetY: 0,
    targetLength: MUSTANG_DEFAULT_LENGTH,
    cockpitOffset: VEHICLE_SPECS.mustang.cockpitOffset,
    wheelNames: MUSTANG_DEFAULT_WHEEL_NAMES,
  },
  {
    id: 'lexus_lc500',
    kind: 'sports',
    name: VEHICLE_SPECS.sports.name,
    category: 'GT Descapotável',
    description: 'Lexus LC 500 Convertible 2021 V8 5.0 com modelo 3D real, interior descapotável e rodas articuladas.',
    defaultColor: '#b84a1e',
    previewUrl: null,
    modelUrl: '/assets/vehicles/2021_lexus_lc_500_convertible.glb',
    orientationOffsetY: 0,
    targetLength: 4.77,
    cockpitOffset: VEHICLE_SPECS.sports.cockpitOffset,
    wheelNames: ['^3dwheel', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'],
  },
  {
    id: 'dodge_challenger_lb',
    kind: 'challenger',
    name: VEHICLE_SPECS.challenger.name,
    category: 'Muscle Widebody',
    description: 'Dodge Challenger SRT Hellcat 2015 Liberty Walk Widebody com modelo 3D real, carroçaria alargada e rodas articuladas.',
    defaultColor: '#18181b',
    previewUrl: null,
    modelUrl: '/assets/vehicles/2015_dodge_challenger_lbperformance.glb',
    orientationOffsetY: 0,
    targetLength: 5.02,
    cockpitOffset: VEHICLE_SPECS.challenger.cockpitOffset,
    wheelNames: ['^3dwheel', 'wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'],
  },
  {
    id: 'sultan_sedan',
    kind: 'sedan',
    name: VEHICLE_SPECS.sedan.name,
    category: 'Berlina Urbana',
    description: 'Berlina equilibrada de 4 portas para condução estável na cidade.',
    defaultColor: '#2563eb',
    previewUrl: null,
    modelUrl: null,
    orientationOffsetY: 0,
    targetLength: 4.4,
    cockpitOffset: VEHICLE_SPECS.sedan.cockpitOffset,
    wheelNames: ['wheel', 'roda', 'tire', 'rim'],
  },
  {
    id: 'granger_suv',
    kind: 'suv',
    name: VEHICLE_SPECS.suv.name,
    category: 'Todo-o-Terreno',
    description: 'SUV robusto com suspensão elevada, elevada massa de impacto e tração firme.',
    defaultColor: '#1e293b',
    previewUrl: null,
    modelUrl: null,
    orientationOffsetY: 0,
    targetLength: 4.7,
    cockpitOffset: VEHICLE_SPECS.suv.cockpitOffset,
    wheelNames: ['wheel', 'roda', 'tire', 'rim'],
  },
  {
    id: 'speedo_cargo',
    kind: 'van',
    name: VEHICLE_SPECS.van.name,
    category: 'Carrinha Comercial',
    description: 'Carrinha pesada de carga com suspensão macia e grande resistência.',
    defaultColor: '#f1f5f9',
    previewUrl: null,
    modelUrl: null,
    orientationOffsetY: 0,
    targetLength: 5.1,
    cockpitOffset: VEHICLE_SPECS.van.cockpitOffset,
    wheelNames: ['wheel', 'roda', 'tire', 'rim'],
  },
  {
    id: 'bati_801',
    kind: 'moto',
    name: VEHICLE_SPECS.moto.name,
    category: 'Superbike',
    description: 'Moto desportiva ágil com inclinação realista em curva e aceleração explosiva.',
    defaultColor: '#f97316',
    previewUrl: null,
    modelUrl: null,
    orientationOffsetY: 0,
    targetLength: 2.3,
    cockpitOffset: VEHICLE_SPECS.moto.cockpitOffset,
    wheelNames: ['wheel', 'roda', 'tire', 'rim'],
  },
  {
    id: 'lspd_cruiser',
    kind: 'police',
    name: VEHICLE_SPECS.police.name,
    category: 'Polícia',
    description: 'Interceptor policial reforçado com barra de proteção frontal e sirenes.',
    defaultColor: '#0f172a',
    previewUrl: null,
    modelUrl: null,
    orientationOffsetY: 0,
    targetLength: 4.56,
    cockpitOffset: VEHICLE_SPECS.police.cockpitOffset,
    wheelNames: ['wheel', 'roda', 'tire', 'rim'],
  },
];

const _tmpBox = new THREE.Box3();
const _tmpSize = new THREE.Vector3();
const _tmpCenter = new THREE.Vector3();

function buildCacheKey(url: string, options?: GltfNormalizeOptions): string {
  const rot = options?.orientationOffsetY ?? 0;
  const len = options?.targetLength ?? 'default';
  return `${url}::rot=${rot.toFixed(4)}::len=${len}`;
}

function disposeObjectResources(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry?.dispose();
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;
      const std = m as THREE.MeshStandardMaterial;
      std.map?.dispose();
      std.normalMap?.dispose();
      std.roughnessMap?.dispose();
      std.metalnessMap?.dispose();
      std.emissiveMap?.dispose();
      m.dispose();
    }
  });
}

const IS_MOBILE_DEVICE =
  typeof navigator !== 'undefined' && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

function enhanceTextureMap(tex: THREE.Texture | null | undefined): void {
  if (!tex) return;
  const targetAniso = IS_MOBILE_DEVICE ? 2 : 4;
  if (tex.anisotropy !== targetAniso) {
    tex.anisotropy = targetAniso;
    tex.needsUpdate = true;
  }
}

export class VehicleAssetLoader {
  private gltfLoader: GLTFLoader;
  private dracoLoader: DRACOLoader | null = null;
  private catalog: VehicleCatalogItem[] = [...BUILTIN_VEHICLE_CATALOG];
  private cache = new Map<string, Promise<VehicleModelTemplate>>();
  private resolvedTemplates = new Map<string, VehicleModelTemplate>();
  private manifestLoaded = false;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.configureLoader(this.gltfLoader);
  }

  private configureLoader(loader: GLTFLoader): void {
    if (typeof window !== 'undefined') {
      if (!this.dracoLoader) {
        try {
          this.dracoLoader = new DRACOLoader();
          this.dracoLoader.setDecoderPath('/draco/');
        } catch {
          this.dracoLoader = null;
        }
      }
      if (this.dracoLoader) {
        loader.setDRACOLoader(this.dracoLoader);
      }
    }
    try {
      loader.setMeshoptDecoder(MeshoptDecoder);
    } catch {
      // Optional Meshopt compression decoder
    }
  }

  public getCatalog(): VehicleCatalogItem[] {
    return this.catalog;
  }

  public getResolvedTemplate(urlOrKey: string): VehicleModelTemplate | undefined {
    return this.resolvedTemplates.get(urlOrKey);
  }

  public async loadCatalog(): Promise<VehicleCatalogItem[]> {
    if (this.manifestLoaded || typeof fetch !== 'function') {
      return this.catalog;
    }
    this.manifestLoaded = true;
    try {
      const res = await fetch('/assets/vehicles/manifest.json');
      if (!res.ok) return this.catalog;
      const manifest = (await res.json()) as { vehicles?: string[] };
      if (!Array.isArray(manifest.vehicles) || manifest.vehicles.length === 0) {
        return this.catalog;
      }
      const loadedItems = await Promise.all(
        manifest.vehicles.map(async (id) => {
          try {
            const cfgRes = await fetch(`/assets/vehicles/${id}/config.json`);
            if (!cfgRes.ok) return null;
            return (await cfgRes.json()) as VehicleCatalogItem;
          } catch {
            return null;
          }
        }),
      );
      const valid = loadedItems.filter((item): item is VehicleCatalogItem => Boolean(item && item.id));
      if (valid.length > 0) {
        this.catalog = valid;
      }
    } catch {
      // Keep built-in fallback catalog without console errors
    }
    return this.catalog;
  }

  public async loadGltfTemplate(
    url: string,
    kind: VehicleKind,
    options?: GltfNormalizeOptions,
  ): Promise<VehicleModelTemplate> {
    const cacheKey = buildCacheKey(url, options);
    const existing = this.cache.get(cacheKey);
    if (existing) return existing;

    const promise = new Promise<VehicleModelTemplate>((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          try {
            const normalized = this.normalizeGltfScene(gltf.scene, cacheKey, kind, options);
            this.resolvedTemplates.set(cacheKey, normalized);
            this.resolvedTemplates.set(url, normalized);
            resolve(normalized);
          } catch (err) {
            reject(err);
          }
        },
        undefined,
        (err) => {
          this.cache.delete(cacheKey);
          reject(err);
        },
      );
    });

    this.cache.set(cacheKey, promise);
    return promise;
  }

  public async loadGltfFromBuffer(
    buffer: ArrayBuffer,
    cacheKey: string,
    kind: VehicleKind,
    options?: GltfNormalizeOptions,
  ): Promise<VehicleModelTemplate> {
    const fullKey = buildCacheKey(cacheKey, options);
    const existing = this.cache.get(fullKey);
    if (existing) return existing;

    const promise = new Promise<VehicleModelTemplate>((resolve, reject) => {
      this.gltfLoader.parse(
        buffer,
        '',
        (gltf: GLTF) => {
          try {
            const normalized = this.normalizeGltfScene(gltf.scene, fullKey, kind, options);
            this.resolvedTemplates.set(fullKey, normalized);
            this.resolvedTemplates.set(cacheKey, normalized);
            resolve(normalized);
          } catch (err) {
            reject(err);
          }
        },
        (err) => {
          this.cache.delete(fullKey);
          reject(err);
        },
      );
    });

    this.cache.set(fullKey, promise);
    return promise;
  }

  public async loadGltfFromFiles(
    fileList: File[] | FileList,
    kind: VehicleKind,
    options?: GltfNormalizeOptions & { cacheKey?: string },
  ): Promise<VehicleModelTemplate> {
    const files = Array.from(fileList);
    if (files.length === 0) {
      throw new Error('Nenhum ficheiro .glb ou .gltf selecionado.');
    }

    const entryFile =
      files.find((f) => /\.glb$/i.test(f.name)) ??
      files.find((f) => /\.gltf$/i.test(f.name));

    if (!entryFile) {
      throw new Error('Seleciona um ficheiro .glb ou .gltf válido.');
    }

    // Single .glb file can be parsed directly from ArrayBuffer without companion URLs
    if (/\.glb$/i.test(entryFile.name) && files.length === 1) {
      const buffer = await entryFile.arrayBuffer();
      const key = options?.cacheKey ?? `local_glb://${entryFile.name}_${entryFile.size}_${entryFile.lastModified}`;
      return this.loadGltfFromBuffer(buffer, key, kind, options);
    }

    // Multi-file .gltf + .bin + textures: route companion resources via LoadingManager
    const companionUrls = new Map<string, string>();
    const createdUrls: string[] = [];

    for (const file of files) {
      const objUrl = URL.createObjectURL(file);
      createdUrls.push(objUrl);
      const rel = ((file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name)
        .replace(/^\.?\//, '')
        .toLowerCase();
      companionUrls.set(rel, objUrl);
      companionUrls.set(file.name.toLowerCase(), objUrl);
    }

    const entryUrl = companionUrls.get(entryFile.name.toLowerCase())!;
    const manager = new THREE.LoadingManager();
    manager.setURLModifier((requestedUrl: string) => {
      if (requestedUrl === entryUrl || requestedUrl.startsWith('data:') || requestedUrl.startsWith('blob:')) {
        return requestedUrl;
      }
      const cleaned = decodeURIComponent(requestedUrl.split('?')[0]).replace(/^\.?\//, '').toLowerCase();
      const base = cleaned.split('/').pop() ?? cleaned;
      return companionUrls.get(cleaned) ?? companionUrls.get(base) ?? requestedUrl;
    });

    const scopedLoader = new GLTFLoader(manager);
    this.configureLoader(scopedLoader);

    const cacheKey = options?.cacheKey ?? `local_gltf://${entryFile.name}_${entryFile.size}_${entryFile.lastModified}`;
    const fullKey = buildCacheKey(cacheKey, options);

    try {
      const gltf = await scopedLoader.loadAsync(entryUrl);
      const normalized = this.normalizeGltfScene(gltf.scene, fullKey, kind, options);
      this.resolvedTemplates.set(fullKey, normalized);
      this.resolvedTemplates.set(cacheKey, normalized);
      this.cache.set(fullKey, Promise.resolve(normalized));
      return normalized;
    } finally {
      for (const u of createdUrls) {
        URL.revokeObjectURL(u);
      }
    }
  }

  public normalizeGltfScene(
    rawScene: THREE.Object3D,
    url: string,
    kind: VehicleKind,
    options?: GltfNormalizeOptions,
  ): VehicleModelTemplate {
    const spec = VEHICLE_SPECS[kind];
    const targetLength = options?.targetLength ?? spec.halfLength * 2;
    const allowShadows = options?.shadows ?? true;

    const wrapper = new THREE.Group();
    const model = rawScene;

    // 1. Auto-detect orientation (ensure longest horizontal axis aligns with +Z) + explicit rotation offset
    model.updateMatrixWorld(true);
    _tmpBox.setFromObject(model);
    _tmpBox.getSize(_tmpSize);
    if (_tmpSize.x > _tmpSize.z * 1.15) {
      model.rotation.y += Math.PI / 2;
    }
    if (options?.orientationOffsetY) {
      model.rotation.y += options.orientationOffsetY;
    }
    model.updateMatrixWorld(true);

    // 2. Uniformly scale to target vehicle length preserving exact 1:1 original proportions, ground min.y = 0, center X/Z
    _tmpBox.setFromObject(model);
    _tmpBox.getSize(_tmpSize);
    const currentLen = Math.max(0.01, _tmpSize.z);
    const scaleFactor = targetLength / currentLen;
    model.scale.multiplyScalar(scaleFactor);
    model.updateMatrixWorld(true);

    _tmpBox.setFromObject(model);
    _tmpBox.getCenter(_tmpCenter);
    model.position.x -= _tmpCenter.x;
    model.position.z -= _tmpCenter.z;
    model.position.y -= _tmpBox.min.y;
    model.updateMatrixWorld(true);

    wrapper.add(model);

    // 3. Preserve PBR materials, textures, glass transparency, lights & shadow flags
    const wheelRegex = options?.wheelNames?.length
      ? new RegExp(options.wheelNames.join('|'), 'i')
      : /wheel|roda|tire|tyre|rim|pneu|aro|ftire|rtire/i;

    const wheelCandidates: THREE.Object3D[] = [];
    const seenRoots = new Set<THREE.Object3D>();
    const _candBox = new THREE.Box3();
    const _candSize = new THREE.Vector3();

    model.traverse((child) => {
      const name = child.name || '';
      if (wheelRegex.test(name) && !seenRoots.has(child)) {
        // Avoid adding descendants of an already-captured wheel group
        let ancestor = child.parent;
        let underWheel = false;
        while (ancestor) {
          if (seenRoots.has(ancestor)) {
            underWheel = true;
            break;
          }
          ancestor = ancestor.parent;
        }
        if (!underWheel) {
          // Skip parent axle/wheel-assembly containers (e.g. Wheel2A_3D_00 holding all 4 wheels + calipers)
          _candBox.setFromObject(child);
          _candBox.getSize(_candSize);
          const isSingleWheelSize =
            _candSize.y >= 0.12 &&
            _candSize.z <= targetLength * 0.42 &&
            _candSize.x <= targetLength * 0.35;
          if (isSingleWheelSize) {
            seenRoots.add(child);
            wheelCandidates.push(child);
          }
        }
      }

      const mesh = child as THREE.Mesh;
      if (mesh.isMesh) {
        let isTransparentOrInterior = /glass|window|vidro|windshield|interior|seatbelt|badge|emiss:/i.test(name);

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          const std = mat as THREE.MeshStandardMaterial;
          enhanceTextureMap(std.map);
          enhanceTextureMap(std.normalMap);
          enhanceTextureMap(std.roughnessMap);
          enhanceTextureMap(std.metalnessMap);
          enhanceTextureMap(std.emissiveMap);

          if ('envMapIntensity' in std) {
            std.envMapIntensity = Math.max(std.envMapIntensity || 1.2, 1.2);
          }

          const lname = (mat.name || name).toLowerCase();
          if (/glass|window|vidro|windshield/i.test(lname)) {
            isTransparentOrInterior = true;
            mat.transparent = true;
            mat.opacity = Math.min(mat.opacity || 0.45, 0.55);
            mat.depthWrite = false;
          } else if (/headlight|farol/i.test(lname) && 'emissive' in mat) {
            if (std.emissive.getHex() === 0) std.emissive.setHex(0xfffbeb);
            std.emissiveIntensity = Math.max(std.emissiveIntensity || 0.8, 0.8);
          } else if (/taillight|brake|lantern/i.test(lname) && 'emissive' in mat) {
            if (std.emissive.getHex() === 0) std.emissive.setHex(0xef4444);
            std.emissiveIntensity = Math.max(std.emissiveIntensity || 0.6, 0.6);
          }

          if (/interior|seatbelt|badge/i.test(lname) || mat.transparent) {
            isTransparentOrInterior = true;
          }

          // Performance optimization (Android / Low-Med / Software GL): avoid full-scene secondary transmission render pass
          if ((IS_MOBILE_DEVICE || !allowShadows || options?.disableTransmission) && 'transmission' in std) {
            const phys = std as THREE.MeshPhysicalMaterial;
            if (phys.transmission > 0) {
              phys.transmission = 0;
              phys.transparent = true;
              phys.opacity = Math.max(0.28, Math.min(phys.opacity || 0.42, 0.48));
              phys.depthWrite = false;
            }
          }
        }

        mesh.castShadow = allowShadows && !isTransparentOrInterior;
        mesh.receiveShadow = true;
      }
    });

    // 4. Re-parent detected wheels around exact centered spin/steer pivots (zero mesh deformation)
    const wheels: NormalizedWheelTemplate[] = [];
    for (const candidate of wheelCandidates) {
      wrapper.updateMatrixWorld(true);
      _tmpBox.setFromObject(candidate);
      if (_tmpBox.isEmpty()) continue;
      _tmpBox.getCenter(_tmpCenter);
      _tmpBox.getSize(_tmpSize);
      // Skip tiny nuts/caps or whole chassis mistakenly named
      if (_tmpSize.y < 0.12 || _tmpSize.z > targetLength * 0.45) continue;

      const worldPos = _tmpCenter.clone();
      const pivot = new THREE.Group();
      pivot.position.copy(worldPos);
      pivot.userData.wheelIndex = wheels.length;

      const spinMesh = new THREE.Group();
      pivot.add(spinMesh);

      // Attach preserving world transform cleanly
      spinMesh.attach(candidate);
      wrapper.add(pivot);

      wheels.push({
        pivot,
        spinMesh,
        localX: worldPos.x,
        localZ: worldPos.z,
        restY: worldPos.y,
        isFront: worldPos.z > 0,
      });
    }

    // Fallback when wheels are merged into the chassis mesh:
    // keep body completely intact and create subtle non-deforming spinning inner hub overlays
    let hasMergedWheels = false;
    wrapper.updateMatrixWorld(true);
    _tmpBox.setFromObject(wrapper);
    _tmpBox.getSize(_tmpSize);
    const halfWidth = Math.max(0.45, _tmpSize.x * 0.5);
    const halfLength = Math.max(1.0, _tmpSize.z * 0.5);
    const height = Math.max(0.9, _tmpSize.y);
    const wheelRadius =
      wheels.length > 0
        ? THREE.MathUtils.clamp(wheels[0].restY, 0.22, 0.56)
        : spec.wheelRadius;

    if (wheels.length < 2) {
      hasMergedWheels = true;
      const wheelZ = halfLength * 0.61;
      const wheelX = Math.max(0.15, halfWidth - 0.14);
      const discMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.7,
        roughness: 0.35,
      });
      const spokeMat = new THREE.MeshStandardMaterial({
        color: 0xd4d8de,
        metalness: 0.88,
        roughness: 0.22,
      });

      const positions: [number, number, boolean][] =
        kind === 'moto'
          ? [
              [0, halfLength * 0.72, true],
              [0, -halfLength * 0.72, false],
            ]
          : [
              [-wheelX, wheelZ, true],
              [wheelX, wheelZ, true],
              [-wheelX, -wheelZ, false],
              [wheelX, -wheelZ, false],
            ];

      for (const [wx, wz, isFront] of positions) {
        const pivot = new THREE.Group();
        pivot.position.set(wx, wheelRadius, wz);
        pivot.userData.wheelIndex = wheels.length;
        const spinMesh = new THREE.Group();
        const hubBar = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, wheelRadius * 1.1, 0.05),
          spokeMat,
        );
        const hubBar2 = new THREE.Mesh(
          new THREE.BoxGeometry(0.03, 0.05, wheelRadius * 1.1),
          discMat,
        );
        hubBar.position.x = wx >= 0 ? 0.08 : -0.08;
        hubBar2.position.x = wx >= 0 ? 0.08 : -0.08;
        spinMesh.add(hubBar, hubBar2);
        pivot.add(spinMesh);
        wrapper.add(pivot);
        wheels.push({
          pivot,
          spinMesh,
          localX: wx,
          localZ: wz,
          restY: wheelRadius,
          isFront,
        });
      }
    }

    return {
      url,
      root: wrapper,
      wheels,
      hasMergedWheels,
      wheelRadius,
      halfWidth,
      halfLength,
      height,
    };
  }

  public cloneTemplateInstance(template: VehicleModelTemplate): {
    root: THREE.Group;
    wheels: NormalizedWheelTemplate[];
    wheelMeshes: THREE.Object3D[];
    frontSteerPivots: THREE.Object3D[];
  } {
    const clone = template.root.clone(true);
    const wheels: NormalizedWheelTemplate[] = [];
    const wheelMeshes: THREE.Object3D[] = [];
    const frontSteerPivots: THREE.Object3D[] = [];

    for (let i = 0; i < template.wheels.length; i++) {
      const orig = template.wheels[i];
      const clonedPivot = (clone.children.find((c) => c.userData?.wheelIndex === i) ??
        clone.children.find(
          (c) =>
            Math.abs(c.position.x - orig.pivot.position.x) < 0.01 &&
            Math.abs(c.position.y - orig.pivot.position.y) < 0.01 &&
            Math.abs(c.position.z - orig.pivot.position.z) < 0.01,
        )) as THREE.Group | undefined;

      if (clonedPivot && clonedPivot.children[0]) {
        const spinMesh = clonedPivot.children[0] as THREE.Group;
        wheels.push({
          pivot: clonedPivot,
          spinMesh,
          localX: orig.localX,
          localZ: orig.localZ,
          restY: orig.restY,
          isFront: orig.isFront,
        });
        wheelMeshes.push(spinMesh);
        if (orig.isFront) frontSteerPivots.push(clonedPivot);
      }
    }

    return { root: clone, wheels, wheelMeshes, frontSteerPivots };
  }

  public disposeUrl(url: string): void {
    const tpl = this.resolvedTemplates.get(url);
    if (tpl) {
      disposeObjectResources(tpl.root);
      this.resolvedTemplates.delete(url);
    }
    this.cache.delete(url);
  }

  public disposeAll(): void {
    const disposed = new Set<VehicleModelTemplate>();
    for (const tpl of this.resolvedTemplates.values()) {
      if (disposed.has(tpl)) continue;
      disposed.add(tpl);
      disposeObjectResources(tpl.root);
    }
    this.resolvedTemplates.clear();
    this.cache.clear();
    this.dracoLoader?.dispose();
  }
}

/**
 * Dedicated importer for external high-quality Ford Mustang GT (.gltf / .glb) 3D models.
 * Preserves authentic 1:1 proportions (scaled uniformly to 4.784m Mustang length),
 * original PBR materials/textures, and separate steering/spinning wheel pivots.
 */
export async function importMustangGltf(
  source: string | File | File[] | FileList | ArrayBuffer,
  loader: VehicleAssetLoader = new VehicleAssetLoader(),
  options: MustangGltfImportOptions = {},
): Promise<VehicleModelTemplate> {
  const normalizedOptions: GltfNormalizeOptions & { cacheKey?: string } = {
    targetLength: options.targetLength ?? MUSTANG_DEFAULT_LENGTH,
    orientationOffsetY: options.orientationOffsetY ?? 0,
    wheelNames: options.wheelNames ?? MUSTANG_DEFAULT_WHEEL_NAMES,
    shadows: options.shadows ?? true,
    cacheKey: options.cacheKey,
  };

  if (typeof source === 'string') {
    return loader.loadGltfTemplate(source, 'mustang', normalizedOptions);
  }

  if (source instanceof ArrayBuffer) {
    const key = options.cacheKey ?? `mustang_buffer://${source.byteLength}`;
    return loader.loadGltfFromBuffer(source, key, 'mustang', normalizedOptions);
  }

  if ('size' in source) {
    return loader.loadGltfFromFiles([source], 'mustang', normalizedOptions);
  }

  return loader.loadGltfFromFiles(source, 'mustang', normalizedOptions);
}
