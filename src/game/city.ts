import * as THREE from 'three';
import { GraphicsQuality, InteractiveZone, QUALITY_PRESETS, WorldBoxCollider } from './types';
import { ProceduralTextureSet } from './textures';
import { BEACH_START_X, OCEAN_START_X } from './physics';

export const ROAD_COORDS = [-120, -60, 0, 60, 120] as const;
export const ROAD_WIDTH = 14;
export const HALF_ROAD = ROAD_WIDTH / 2;

export interface TrafficLightNode {
  x: number;
  z: number;
  nsRed: THREE.MeshStandardMaterial;
  nsGreen: THREE.MeshStandardMaterial;
  ewRed: THREE.MeshStandardMaterial;
  ewGreen: THREE.MeshStandardMaterial;
}

export interface CityWorld {
  group: THREE.Group;
  colliders: WorldBoxCollider[];
  interactiveZones: InteractiveZone[];
  trafficLights: TrafficLightNode[];
  streetLightBulbs: THREE.MeshStandardMaterial;
  windowMaterials: THREE.MeshStandardMaterial[];
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  fillLight: THREE.DirectionalLight;
  waterMesh: THREE.Mesh;
  cloudsGroup: THREE.Group;
  setQuality: (q: GraphicsQuality, shadowsEnabled: boolean) => void;
  update: (elapsed: number, dayProgress: number, playerPos: THREE.Vector3, shadowsEnabled: boolean) => {
    nsGreen: boolean;
    isNight: boolean;
  };
}

function attachUv2(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (geo.attributes.uv && !geo.attributes.uv2) {
    geo.setAttribute('uv2', geo.attributes.uv);
  }
  return geo;
}

export function buildCity(
  scene: THREE.Scene,
  textures: ProceduralTextureSet,
  shadowsEnabled: boolean,
  shadowMapSize: number,
): CityWorld {
  const group = new THREE.Group();
  const detailPropsGroup = new THREE.Group();
  const colliders: WorldBoxCollider[] = [];
  const interactiveZones: InteractiveZone[] = [];
  const trafficLights: TrafficLightNode[] = [];
  const windowMaterials: THREE.MeshStandardMaterial[] = [];

  // 1. Atmospheric Gradient Sky Dome Shader (with Dawn/Sunset scattering & Night Stars)
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x3a618e) },
    uHorizonColor: { value: new THREE.Color(0xf29356) },
    uSunColor: { value: new THREE.Color(0xffdca8) },
    uSunDir: { value: new THREE.Vector3(0.6, 0.25, 0.4).normalize() },
    uSunGlow: { value: 1.0 },
    uNightFactor: { value: 0.0 },
    uTime: { value: 0.0 },
  };
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(520, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyUniforms,
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        uniform float uSunGlow;
        uniform float uNightFactor;
        uniform float uTime;
        varying vec3 vWorldDir;

        float hashStar(vec3 p) {
          p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        void main() {
          vec3 dir = normalize(vWorldDir);
          float h = clamp(dir.y * 1.35 + 0.05, 0.0, 1.0);
          vec3 col = mix(uHorizonColor, uTopColor, pow(h, 0.62));
          float sunDot = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * (pow(sunDot, 14.0) * 0.42 + pow(sunDot, 140.0) * 0.95) * uSunGlow;

          if (uNightFactor > 0.02 && dir.y > 0.06) {
            vec3 cell = floor(dir * 165.0);
            float starVal = hashStar(cell);
            if (starVal > 0.992) {
              float twinkle = 0.65 + 0.35 * sin(uTime * 2.5 + starVal * 120.0);
              float skyMask = smoothstep(0.06, 0.35, dir.y);
              col += vec3(0.82, 0.9, 1.0) * twinkle * uNightFactor * skyMask * 0.85;
            }
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    }),
  );
  group.add(skyDome);

  // 2. Three-Point Atmospheric Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xaad0ff, 0x3b3d42, 0.92);
  hemiLight.position.set(0, 100, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xffdfb8, 2.35);
  sunLight.position.set(80, 95, 60);
  sunLight.castShadow = shadowsEnabled;
  sunLight.shadow.mapSize.width = shadowMapSize;
  sunLight.shadow.mapSize.height = shadowMapSize;
  const shadowSpan = 88;
  sunLight.shadow.camera.left = -shadowSpan;
  sunLight.shadow.camera.right = shadowSpan;
  sunLight.shadow.camera.top = shadowSpan;
  sunLight.shadow.camera.bottom = -shadowSpan;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 310;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const fillLight = new THREE.DirectionalLight(0x7ca7d9, 0.52);
  fillLight.position.set(-70, 55, -80);
  scene.add(fillLight);

  // Extended Outer Terrain
  const outerGroundMat = new THREE.MeshStandardMaterial({
    color: 0x3a5032,
    roughness: 0.94,
    metalness: 0.0,
  });
  const outerGround = new THREE.Mesh(new THREE.PlaneGeometry(1180, 1180), outerGroundMat);
  outerGround.rotation.x = -Math.PI / 2;
  outerGround.position.set(-60, -0.08, 0);
  outerGround.receiveShadow = true;
  group.add(outerGround);

  // 3. Full PBR Asphalt Roads (BaseColor + Normal + Roughness + AO)
  const asphaltTex = textures.asphalt.clone();
  asphaltTex.repeat.set(36, 36);
  asphaltTex.needsUpdate = true;
  const asphaltRough = textures.asphaltRoughness.clone();
  asphaltRough.repeat.set(36, 36);
  asphaltRough.needsUpdate = true;
  const asphaltNorm = textures.asphaltNormal.clone();
  asphaltNorm.repeat.set(36, 36);
  asphaltNorm.needsUpdate = true;
  const asphaltAo = textures.asphaltAo.clone();
  asphaltAo.repeat.set(36, 36);
  asphaltAo.needsUpdate = true;

  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughnessMap: asphaltRough,
    normalMap: asphaltNorm,
    normalScale: new THREE.Vector2(0.85, 0.85),
    aoMap: asphaltAo,
    aoMapIntensity: 0.75,
    roughness: 0.84,
    metalness: 0.16,
    envMapIntensity: 1.15,
  });
  const cityBaseGeo = attachUv2(new THREE.PlaneGeometry(316, 360));
  const cityBase = new THREE.Mesh(cityBaseGeo, asphaltMat);
  cityBase.rotation.x = -Math.PI / 2;
  cityBase.position.set(-30, 0, 0);
  cityBase.receiveShadow = true;
  group.add(cityBase);

  // Road Markings (Double Yellow Centerlines, Dashed Lane Dividers, Stop Bars, Crosswalks, Manholes)
  const yellowLineMat = new THREE.MeshStandardMaterial({
    color: 0xf0be32,
    roughness: 0.65,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const whiteLineMat = new THREE.MeshStandardMaterial({
    color: 0xe9edf2,
    roughness: 0.65,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const lineGeosNS = new THREE.PlaneGeometry(0.18, 44);
  const lineGeosEW = new THREE.PlaneGeometry(44, 0.18);
  const crosswalkStripeGeoNS = new THREE.PlaneGeometry(0.58, 2.7);
  const crosswalkStripeGeoEW = new THREE.PlaneGeometry(2.7, 0.58);

  const blockCenters = [-90, -30, 30, 90];
  const dummy = new THREE.Object3D();
  const colorTmp = new THREE.Color();

  for (const rx of ROAD_COORDS) {
    for (const bz of blockCenters) {
      const l1 = new THREE.Mesh(lineGeosNS, yellowLineMat);
      l1.rotation.x = -Math.PI / 2;
      l1.position.set(rx - 0.18, 0.015, bz);
      group.add(l1);

      const l2 = new THREE.Mesh(lineGeosNS, yellowLineMat);
      l2.rotation.x = -Math.PI / 2;
      l2.position.set(rx + 0.18, 0.015, bz);
      group.add(l2);
    }
  }
  for (const rz of ROAD_COORDS) {
    for (const bx of blockCenters) {
      const l1 = new THREE.Mesh(lineGeosEW, yellowLineMat);
      l1.rotation.x = -Math.PI / 2;
      l1.position.set(bx, 0.015, rz - 0.18);
      group.add(l1);

      const l2 = new THREE.Mesh(lineGeosEW, yellowLineMat);
      l2.rotation.x = -Math.PI / 2;
      l2.position.set(bx, 0.015, rz + 0.18);
      group.add(l2);
    }
  }

  // Instanced Dashed Lane Dividers & Stop Bars
  const dashTransforms: { x: number; z: number; rotY: number }[] = [];
  for (const rx of ROAD_COORDS) {
    for (const bz of blockCenters) {
      for (const offsetZ of [-16, -8, 0, 8, 16]) {
        dashTransforms.push({ x: rx - 3.5, z: bz + offsetZ, rotY: 0 });
        dashTransforms.push({ x: rx + 3.5, z: bz + offsetZ, rotY: 0 });
      }
    }
  }
  for (const rz of ROAD_COORDS) {
    for (const bx of blockCenters) {
      for (const offsetX of [-16, -8, 0, 8, 16]) {
        dashTransforms.push({ x: bx + offsetX, z: rz - 3.5, rotY: Math.PI / 2 });
        dashTransforms.push({ x: bx + offsetX, z: rz + 3.5, rotY: Math.PI / 2 });
      }
    }
  }
  if (dashTransforms.length > 0) {
    const dashGeo = new THREE.PlaneGeometry(0.14, 3.2);
    dashGeo.rotateX(-Math.PI / 2);
    const dashInst = new THREE.InstancedMesh(dashGeo, whiteLineMat, dashTransforms.length);
    dashTransforms.forEach((d, idx) => {
      dummy.position.set(d.x, 0.016, d.z);
      dummy.rotation.set(0, d.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dashInst.setMatrixAt(idx, dummy.matrix);
    });
    dashInst.instanceMatrix.needsUpdate = true;
    dashInst.computeBoundingSphere();
    group.add(dashInst);
  }

  // Crosswalk stripes & intersection stop bars
  for (const ix of ROAD_COORDS) {
    for (const iz of ROAD_COORDS) {
      for (let s = -4; s <= 4; s += 2) {
        const st1 = new THREE.Mesh(crosswalkStripeGeoNS, whiteLineMat);
        st1.rotation.x = -Math.PI / 2;
        st1.position.set(ix + s * 0.95, 0.02, iz + HALF_ROAD + 1.4);
        group.add(st1);

        const st2 = new THREE.Mesh(crosswalkStripeGeoEW, whiteLineMat);
        st2.rotation.x = -Math.PI / 2;
        st2.position.set(ix + HALF_ROAD + 1.4, 0.02, iz + s * 0.95);
        group.add(st2);
      }
    }
  }

  // Instanced Steel Manhole Covers along roads
  const manholeCoords: [number, number][] = [];
  for (const rx of [-60, 0, 60]) {
    for (const bz of blockCenters) {
      manholeCoords.push([rx + 2.2, bz - 12], [rx - 2.2, bz + 12]);
    }
  }
  const darkCastIronMat = new THREE.MeshStandardMaterial({
    map: textures.metal,
    roughnessMap: textures.metalRoughness,
    color: 0x2a2f36,
    roughness: 0.52,
    metalness: 0.78,
  });
  if (manholeCoords.length > 0) {
    const mhGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.02, 12);
    const mhInst = new THREE.InstancedMesh(mhGeo, darkCastIronMat, manholeCoords.length);
    manholeCoords.forEach(([mx, mz], idx) => {
      dummy.position.set(mx, 0.012, mz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mhInst.setMatrixAt(idx, dummy.matrix);
    });
    mhInst.instanceMatrix.needsUpdate = true;
    mhInst.computeBoundingSphere();
    detailPropsGroup.add(mhInst);
  }

  // 4. PBR Sidewalks, Concrete Curbs & Architectural Materials
  const sidewalkTex = textures.sidewalk.clone();
  sidewalkTex.repeat.set(8, 8);
  sidewalkTex.needsUpdate = true;
  const sidewalkNorm = textures.sidewalkNormal.clone();
  sidewalkNorm.repeat.set(8, 8);
  sidewalkNorm.needsUpdate = true;
  const sidewalkRough = textures.sidewalkRoughness.clone();
  sidewalkRough.repeat.set(8, 8);
  sidewalkRough.needsUpdate = true;
  const sidewalkAo = textures.sidewalkAo.clone();
  sidewalkAo.repeat.set(8, 8);
  sidewalkAo.needsUpdate = true;

  const sidewalkMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    normalMap: sidewalkNorm,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: sidewalkRough,
    aoMap: sidewalkAo,
    aoMapIntensity: 0.65,
    roughness: 0.85,
    metalness: 0.06,
  });

  const curbMat = new THREE.MeshStandardMaterial({
    map: textures.curb,
    normalMap: textures.curbNormal,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.74,
    metalness: 0.06,
  });

  const concreteMat = new THREE.MeshStandardMaterial({
    map: textures.concrete,
    normalMap: textures.concreteNormal,
    roughnessMap: textures.concreteRoughness,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughness: 0.8,
    metalness: 0.08,
  });

  const woodMat = new THREE.MeshStandardMaterial({
    map: textures.wood,
    normalMap: textures.woodNormal,
    normalScale: new THREE.Vector2(0.7, 0.7),
    roughness: 0.82,
    metalness: 0.04,
  });

  const grassMat = new THREE.MeshStandardMaterial({
    map: textures.grass,
    normalMap: textures.grassNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.92,
    metalness: 0.02,
  });

  // Beach Boardwalk, Sand Slope & Ocean
  const boardwalk = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.24, 360), woodMat);
  boardwalk.position.set(BEACH_START_X + 1.5, 0.12, 0);
  boardwalk.receiveShadow = true;
  group.add(boardwalk);

  const sandGeo = new THREE.PlaneGeometry(52, 460, 12, 1);
  sandGeo.rotateX(-Math.PI / 2);
  const sandPos = sandGeo.attributes.position;
  for (let i = 0; i < sandPos.count; i++) {
    const localX = sandPos.getX(i);
    const t = Math.max(0, Math.min(1, (localX + 26) / 40));
    sandPos.setY(i, -0.75 * t + 0.05);
  }
  sandGeo.computeVertexNormals();
  const sandMesh = new THREE.Mesh(
    sandGeo,
    new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.93 }),
  );
  sandMesh.position.set(BEACH_START_X + 24, 0, 0);
  sandMesh.receiveShadow = true;
  group.add(sandMesh);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0b5f82,
    roughness: 0.14,
    metalness: 0.55,
    normalMap: textures.waterNormal,
    normalScale: new THREE.Vector2(0.52, 0.52),
    envMapIntensity: 1.35,
  });
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(420, 960), waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.set(OCEAN_START_X + 190, -0.45, 0);
  waterMesh.receiveShadow = true;
  group.add(waterMesh);

  // Wooden Pier
  const pierGroup = new THREE.Group();
  const pierDeck = new THREE.Mesh(new THREE.BoxGeometry(72, 0.45, 7.5), woodMat);
  pierDeck.position.set(168, 1.05, 28);
  pierDeck.castShadow = true;
  pierDeck.receiveShadow = true;
  pierGroup.add(pierDeck);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4f3c2c, roughness: 0.9 });
  for (let px = 138; px <= 200; px += 10) {
    for (const pz of [24.8, 31.2]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.2, 8), postMat);
      post.position.set(px, 0.2, pz);
      pierGroup.add(post);
    }
  }
  group.add(pierGroup);

  // 5. Shared Reusable Building Materials (Optimal for Android & WebGL Batching)
  const skyGlassMat = new THREE.MeshStandardMaterial({
    map: textures.skyscraperFacade,
    roughnessMap: textures.skyscraperRoughness,
    emissiveMap: textures.skyscraperEmissive,
    emissive: new THREE.Color(0xffe1a8),
    emissiveIntensity: 0.0,
    roughness: 0.28,
    metalness: 0.72,
    envMapIntensity: 1.4,
  });
  windowMaterials.push(skyGlassMat);

  const skyBlueMat = new THREE.MeshStandardMaterial({
    map: textures.skyscraperFacade,
    roughnessMap: textures.skyscraperRoughness,
    emissiveMap: textures.skyscraperEmissive,
    color: 0xbdd4eb,
    emissive: new THREE.Color(0xffe1a8),
    emissiveIntensity: 0.0,
    roughness: 0.24,
    metalness: 0.76,
    envMapIntensity: 1.45,
  });
  windowMaterials.push(skyBlueMat);

  const concTowerMat = new THREE.MeshStandardMaterial({
    map: textures.concreteTowerFacade,
    emissiveMap: textures.concreteTowerEmissive,
    emissive: new THREE.Color(0xffd796),
    emissiveIntensity: 0.0,
    roughness: 0.65,
    metalness: 0.16,
    envMapIntensity: 0.95,
  });
  windowMaterials.push(concTowerMat);

  const aptWarmMat = new THREE.MeshStandardMaterial({
    map: textures.apartmentFacade,
    emissiveMap: textures.apartmentEmissive,
    color: 0xd9cab5,
    emissive: new THREE.Color(0xffcf82),
    emissiveIntensity: 0.0,
    roughness: 0.7,
    metalness: 0.1,
  });
  windowMaterials.push(aptWarmMat);

  const aptSlateMat = new THREE.MeshStandardMaterial({
    map: textures.apartmentFacade,
    emissiveMap: textures.apartmentEmissive,
    color: 0xb7c2cc,
    emissive: new THREE.Color(0xffd89c),
    emissiveIntensity: 0.0,
    roughness: 0.66,
    metalness: 0.14,
  });
  windowMaterials.push(aptSlateMat);

  const artDecoMat = new THREE.MeshStandardMaterial({
    map: textures.artDecoFacade,
    emissiveMap: textures.artDecoEmissive,
    emissive: new THREE.Color(0x67e8f9),
    emissiveIntensity: 0.15,
    roughness: 0.55,
    metalness: 0.18,
  });
  windowMaterials.push(artDecoMat);

  const brickMat = new THREE.MeshStandardMaterial({
    map: textures.brick,
    normalMap: textures.brickNormal,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughness: 0.82,
    metalness: 0.04,
  });

  const trimMetalMat = new THREE.MeshStandardMaterial({
    map: textures.metal,
    roughnessMap: textures.metalRoughness,
    color: 0x262c36,
    roughness: 0.36,
    metalness: 0.82,
    envMapIntensity: 1.2,
  });

  const storefrontGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x162b40,
    roughness: 0.08,
    metalness: 0.3,
    clearcoat: 1.0,
    envMapIntensity: 1.6,
  });

  const neonCyanMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.35,
  });
  const neonPinkMat = new THREE.MeshStandardMaterial({
    color: 0xf472b6,
    emissive: 0xec4899,
    emissiveIntensity: 1.25,
  });

  // Balcony & Storefront Door Builders (reusing shared geometries)
  const balconyMatrices: THREE.Matrix4[] = [];
  const awningMatrices: THREE.Matrix4[] = [];

  const addBuilding = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    h: number,
    style: 'skyscraper' | 'concreteTower' | 'apartment' | 'artdeco' | 'commercial',
    variant = 0,
  ) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(cx, 0.16, cz);

    const facadeMat =
      style === 'skyscraper'
        ? variant % 2 === 0
          ? skyGlassMat
          : skyBlueMat
        : style === 'concreteTower'
          ? concTowerMat
          : style === 'artdeco'
            ? artDecoMat
            : variant % 2 === 0
              ? aptWarmMat
              : aptSlateMat;

    // Ground-floor architectural podium with glazed storefront windows & door
    const podiumH = Math.min(5.2, h * 0.22);
    const podiumMat = style === 'commercial' ? brickMat : style === 'concreteTower' ? concreteMat : trimMetalMat;
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w + 0.7, podiumH, d + 0.7), podiumMat);
    podium.position.y = podiumH / 2;
    podium.castShadow = true;
    podium.receiveShadow = true;
    bGroup.add(podium);

    // Street-level reflective shopfront glass strip & recessed double entrance door
    const frontGlass = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.72, podiumH * 0.56, d + 0.78),
      storefrontGlassMat,
    );
    frontGlass.position.y = podiumH * 0.45;
    bGroup.add(frontGlass);

    const doorFrame = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.7, 0.22),
      trimMetalMat,
    );
    doorFrame.position.set(0, 1.35, d / 2 + 0.42);
    bGroup.add(doorFrame);

    const doorGlass = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 2.35, 0.26),
      storefrontGlassMat,
    );
    doorGlass.position.set(0, 1.32, d / 2 + 0.42);
    bGroup.add(doorGlass);

    // Entrance canopy awning
    dummy.position.set(cx, 0.16 + Math.min(3.5, podiumH * 0.74), cz + d / 2 + 1.05);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(Math.min(5.4, w * 0.45), 0.22, 1.5);
    dummy.updateMatrix();
    awningMatrices.push(dummy.matrix.clone());

    // Main Tower Shaft
    const mainH = h - podiumH;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(w, mainH, d), facadeMat);
    shaft.position.y = podiumH + mainH / 2;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    bGroup.add(shaft);

    // Cornice ledge between podium and upper shaft
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 1.0, 0.45, d + 1.0), concreteMat);
    cornice.position.y = podiumH + 0.1;
    bGroup.add(cornice);

    if (style === 'skyscraper' || style === 'concreteTower') {
      const crownH = Math.max(4.5, h * 0.18);
      const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, crownH, d * 0.72), facadeMat);
      crown.position.y = h + crownH / 2;
      crown.castShadow = true;
      bGroup.add(crown);

      const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.78, 0.75, d * 0.78), concreteMat);
      cap.position.y = h + crownH + 0.36;
      bGroup.add(cap);

      if (style === 'skyscraper') {
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.36, 9.5, 8), trimMetalMat);
        spire.position.y = h + crownH + 4.8;
        bGroup.add(spire);
      } else {
        const penthouse = new THREE.Mesh(new THREE.BoxGeometry(w * 0.38, 3.2, d * 0.38), concreteMat);
        penthouse.position.y = h + crownH + 1.9;
        bGroup.add(penthouse);
      }
    } else if (style === 'artdeco') {
      // Stepped Art-Deco crown + glowing cyan/magenta neon bands
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.9, d + 0.6), concreteMat);
      parapet.position.y = h + 0.45;
      bGroup.add(parapet);

      const neonTop = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.72, 0.26, d + 0.72),
        variant % 2 === 0 ? neonCyanMat : neonPinkMat,
      );
      neonTop.position.y = h + 0.1;
      bGroup.add(neonTop);

      const neonAwning = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.85, 0.22, d + 0.85),
        variant % 2 === 0 ? neonPinkMat : neonCyanMat,
      );
      neonAwning.position.y = podiumH + 0.32;
      bGroup.add(neonAwning);

      // Balconies on front & back facades
      for (let by = podiumH + 3.2; by < h - 2.5; by += 3.6) {
        dummy.position.set(cx, 0.16 + by, cz + d / 2 + 0.55);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(w * 0.65, 0.85, 1.1);
        dummy.updateMatrix();
        balconyMatrices.push(dummy.matrix.clone());
      }
    } else {
      // Apartment / Commercial roof parapet + rooftop HVAC + balconies
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.55, 0.85, d + 0.55), concreteMat);
      parapet.position.y = h + 0.42;
      bGroup.add(parapet);

      const hvac = new THREE.Mesh(new THREE.BoxGeometry(w * 0.24, 1.4, d * 0.24), trimMetalMat);
      hvac.position.set(w * 0.18, h + 1.1, -d * 0.15);
      bGroup.add(hvac);

      if (style === 'apartment' && h > 12) {
        for (let by = podiumH + 3.4; by < h - 2.4; by += 4.2) {
          dummy.position.set(cx - w * 0.2, 0.16 + by, cz + d / 2 + 0.52);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(3.8, 0.82, 1.05);
          dummy.updateMatrix();
          balconyMatrices.push(dummy.matrix.clone());

          dummy.position.set(cx + w * 0.2, 0.16 + by, cz + d / 2 + 0.52);
          dummy.updateMatrix();
          balconyMatrices.push(dummy.matrix.clone());
        }
      }
    }

    group.add(bGroup);
    colliders.push({
      minX: cx - w / 2 - 0.5,
      maxX: cx + w / 2 + 0.5,
      minZ: cz - d / 2 - 0.5,
      maxZ: cz + d / 2 + 0.5,
      maxY: h + 4,
      tag: 'building',
    });
  };

  const addHouse = (cx: number, cz: number, wallColor: number, roofColor: number) => {
    const hGroup = new THREE.Group();
    hGroup.position.set(cx, 0.16, cz);

    const wallMat = new THREE.MeshStandardMaterial({
      map: textures.concrete,
      normalMap: textures.concreteNormal,
      color: wallColor,
      roughness: 0.84,
    });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.78 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(11, 4.4, 9), wallMat);
    body.position.y = 2.2;
    body.castShadow = true;
    body.receiveShadow = true;
    hGroup.add(body);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(8.2, 3.2, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 4.4 + 1.6;
    roof.castShadow = true;
    hGroup.add(roof);

    const porch = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.24, 2.3), woodMat);
    porch.position.set(0, 2.8, 5.4);
    hGroup.add(porch);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.4, 0.22), woodMat);
    door.position.set(0, 1.2, 4.55);
    hGroup.add(door);

    for (const wx of [-3.2, 3.2]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.4, 0.18), storefrontGlassMat);
      win.position.set(wx, 2.3, 4.54);
      hGroup.add(win);
    }

    group.add(hGroup);
    colliders.push({
      minX: cx - 5.6,
      maxX: cx + 5.6,
      minZ: cz - 4.6,
      maxZ: cz + 4.6,
      maxY: 7.5,
      tag: 'building',
    });
  };

  const blockSlabGeo = attachUv2(new THREE.BoxGeometry(45.6, 0.17, 45.6));
  const curbFrameGeo = new THREE.BoxGeometry(46.5, 0.13, 46.5);

  // Build 16 Core City Blocks (Sidewalks + Concrete/Red Curbs)
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const curb = new THREE.Mesh(curbFrameGeo, curbMat);
      curb.position.set(bx, 0.065, bz);
      curb.receiveShadow = true;
      group.add(curb);

      const pad = new THREE.Mesh(blockSlabGeo, sidewalkMat);
      pad.position.set(bx, 0.085, bz);
      pad.receiveShadow = true;
      group.add(pad);

      if (bx === 30 && bz === -30) {
        // CENTRAL PARK
        const lawn = new THREE.Mesh(new THREE.BoxGeometry(41, 0.06, 41), grassMat);
        lawn.position.set(bx, 0.19, bz);
        lawn.receiveShadow = true;
        group.add(lawn);

        const fountainGroup = new THREE.Group();
        fountainGroup.position.set(bx, 0.22, bz);
        const basin = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.9, 20), concreteMat);
        basin.position.y = 0.45;
        basin.castShadow = true;
        basin.receiveShadow = true;
        fountainGroup.add(basin);

        const poolWater = new THREE.Mesh(
          new THREE.CylinderGeometry(4.6, 4.6, 0.15, 20),
          new THREE.MeshStandardMaterial({ color: 0x1d93b8, roughness: 0.08, metalness: 0.35, envMapIntensity: 1.4 }),
        );
        poolWater.position.y = 0.85;
        fountainGroup.add(poolWater);

        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 2.8, 12), concreteMat);
        pillar.position.y = 1.6;
        pillar.castShadow = true;
        fountainGroup.add(pillar);

        const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 0.6, 0.6, 16), concreteMat);
        topBowl.position.y = 2.8;
        fountainGroup.add(topBowl);

        group.add(fountainGroup);
        colliders.push({
          minX: bx - 5.4,
          maxX: bx + 5.4,
          minZ: bz - 5.4,
          maxZ: bz + 5.4,
          maxY: 3.2,
          tag: 'prop',
        });
      } else if (bx === 30 && bz === 30) {
        // LTD GAS STATION & AUTO GARAGE
        const forecourtGeo = attachUv2(new THREE.BoxGeometry(42, 0.04, 42));
        const forecourt = new THREE.Mesh(forecourtGeo, asphaltMat);
        forecourt.position.set(bx, 0.18, bz);
        forecourt.receiveShadow = true;
        group.add(forecourt);

        const canopyGroup = new THREE.Group();
        canopyGroup.position.set(bx - 5, 0.2, bz - 4);
        const ltdBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35, metalness: 0.25 });
        const ltdRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
        const ltdSignMat = new THREE.MeshStandardMaterial({
          map: textures.ltdSign,
          emissiveMap: textures.ltdSign,
          emissive: 0xffffff,
          emissiveIntensity: 0.3,
        });

        const canopyRoof = new THREE.Mesh(new THREE.BoxGeometry(16, 1.0, 10), ltdBlueMat);
        canopyRoof.position.y = 5.0;
        canopyRoof.castShadow = true;
        canopyGroup.add(canopyRoof);

        const redTrim = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.26, 10.2), ltdRedMat);
        redTrim.position.y = 4.45;
        canopyGroup.add(redTrim);

        const fasciaFront = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 1.15), ltdSignMat);
        fasciaFront.position.set(0, 5.1, -5.05);
        fasciaFront.rotation.y = Math.PI;
        canopyGroup.add(fasciaFront);

        const fasciaBack = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 1.15), ltdSignMat);
        fasciaBack.position.set(0, 5.1, 5.05);
        canopyGroup.add(fasciaBack);

        for (const px of [-6.5, 6.5]) {
          const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 5.0, 0.7), trimMetalMat);
          pillar.position.set(px, 2.5, 0);
          pillar.castShadow = true;
          canopyGroup.add(pillar);
        }
        for (const px of [-2.8, 2.8]) {
          const pump = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.85, 0.8), ltdBlueMat);
          pump.position.set(px, 0.92, 0);
          pump.castShadow = true;
          canopyGroup.add(pump);
        }
        group.add(canopyGroup);

        addBuilding(bx + 11, bz + 10, 14, 14, 7.5, 'commercial', 0);

        interactiveZones.push({
          id: 'gas_station_1',
          kind: 'gas',
          label: 'Posto LTD & Oficina (Reparar Veículo $50)',
          x: bx - 5,
          z: bz + 2,
          radius: 7.5,
        });
      } else if (bx === -30 && bz === 30) {
        // BRICK AMMU-NATION & BINCO & PARADISE TECH PLAZA
        addBuilding(bx - 8, bz - 8, 18, 18, 20, 'artdeco', 0);

        const shopGroup = new THREE.Group();
        shopGroup.position.set(bx + 11, 0.16, bz + 11);
        const shopBody = new THREE.Mesh(new THREE.BoxGeometry(14, 6.6, 13), brickMat);
        shopBody.position.y = 3.3;
        shopBody.castShadow = true;
        shopBody.receiveShadow = true;
        shopGroup.add(shopBody);

        const shopGlass = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.8, 13.15), storefrontGlassMat);
        shopGlass.position.y = 1.6;
        shopGroup.add(shopGlass);

        const ammuBannerMat = new THREE.MeshStandardMaterial({
          map: textures.ammuSign,
          emissiveMap: textures.ammuSign,
          emissive: 0xffffff,
          emissiveIntensity: 0.28,
        });
        const ammuSign = new THREE.Mesh(new THREE.BoxGeometry(11.5, 2.2, 0.4), ammuBannerMat);
        ammuSign.position.set(0, 5.4, -6.7);
        shopGroup.add(ammuSign);

        const bincoBannerMat = new THREE.MeshStandardMaterial({
          map: textures.bincoSign,
          emissiveMap: textures.bincoSign,
          emissive: 0xffffff,
          emissiveIntensity: 0.32,
        });
        const bincoSign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 8.5), bincoBannerMat);
        bincoSign.position.set(7.2, 4.2, 0);
        shopGroup.add(bincoSign);

        const elecMat = new THREE.MeshStandardMaterial({
          map: textures.electronicsSign,
          emissiveMap: textures.electronicsSign,
          emissive: 0xffffff,
          emissiveIntensity: 0.55,
        });
        const elecSign = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.8, 8.5), elecMat);
        elecSign.position.set(-7.2, 4.2, 0);
        shopGroup.add(elecSign);

        group.add(shopGroup);
        colliders.push({
          minX: bx + 4,
          maxX: bx + 18,
          minZ: bz + 4.5,
          maxZ: bz + 17.5,
          maxY: 6.5,
          tag: 'building',
        });

        interactiveZones.push({
          id: 'shop_1',
          kind: 'shop',
          label: 'Ammu-Nation 24/7 (Munições & Kit Médico)',
          x: bx + 11,
          z: bz + 1.5,
          radius: 5.5,
        });

        // GARAGE & PARKING BAY (North-East quadrant of block -30, 30 -> center -18, 19)
        const homePadGeo = attachUv2(new THREE.BoxGeometry(11, 0.04, 9));
        const homePad = new THREE.Mesh(homePadGeo, asphaltMat);
        homePad.position.set(bx + 12, 0.18, bz - 11);
        homePad.receiveShadow = true;
        group.add(homePad);

        for (const sx of [-3.2, 0, 3.2]) {
          const line = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 4.8), yellowLineMat);
          line.rotation.x = -Math.PI / 2;
          line.position.set(bx + 12 + sx, 0.21, bz - 11);
          group.add(line);
        }

        const garagePylon = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.8, 0.45), trimMetalMat);
        garagePylon.position.set(bx + 16.8, 1.56, bz - 15.0);
        garagePylon.castShadow = true;
        const garageBeacon = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 0.7, 0.55),
          new THREE.MeshStandardMaterial({
            color: 0x8b5cf6,
            emissive: 0x7c3aed,
            emissiveIntensity: 0.9,
          }),
        );
        garageBeacon.position.set(bx + 16.8, 3.15, bz - 15.0);
        group.add(garagePylon, garageBeacon);
        colliders.push({
          minX: bx + 16.4,
          maxX: bx + 17.2,
          minZ: bz - 15.4,
          maxZ: bz - 14.6,
          maxY: 3.5,
          tag: 'prop',
        });

        interactiveZones.push({
          id: 'garage_home',
          kind: 'garage',
          label: 'Garagem & Estacionamento (Guardar / Selecionar Veículo)',
          x: bx + 12,
          z: bz - 11,
          radius: 6.5,
        });
      } else if (bx === 90 && bz === -30) {
        // PARKING LOT & GARAGE + OCEAN VIEW COASTAL HOTEL
        const lotGeo = attachUv2(new THREE.BoxGeometry(42, 0.04, 42));
        const lot = new THREE.Mesh(lotGeo, asphaltMat);
        lot.position.set(bx, 0.18, bz);
        lot.receiveShadow = true;
        group.add(lot);

        for (let s = -12; s <= 12; s += 6) {
          const line = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 6.5), whiteLineMat);
          line.rotation.x = -Math.PI / 2;
          line.position.set(bx + s, 0.21, bz - 10);
          group.add(line);
        }

        addBuilding(bx + 11, bz + 11, 14, 13, 14, 'artdeco', 1);
        const hotelSignMesh = new THREE.Mesh(
          new THREE.BoxGeometry(10.5, 1.9, 0.4),
          new THREE.MeshStandardMaterial({
            map: textures.hotelSign,
            emissiveMap: textures.hotelSign,
            emissive: 0xffffff,
            emissiveIntensity: 0.65,
          }),
        );
        hotelSignMesh.position.set(bx + 11, 4.9, bz + 4.2);
        group.add(hotelSignMesh);

        interactiveZones.push({
          id: 'garage_1',
          kind: 'garage',
          label: 'Garagem Central (Guardar / Selecionar Veículo)',
          x: bx + 2,
          z: bz + 10,
          radius: 6.8,
        });
      } else if (bx === 90 && bz === -90) {
        // POLICE PRECINCT
        addBuilding(bx, bz, 26, 22, 14, 'concreteTower', 0);
        const sign = new THREE.Mesh(
          new THREE.BoxGeometry(12, 1.6, 0.6),
          new THREE.MeshStandardMaterial({
            color: 0x2563eb,
            emissive: 0x1d4ed8,
            emissiveIntensity: 0.85,
          }),
        );
        sign.position.set(bx, 7.5, bz + 11.4);
        group.add(sign);
      } else if (bx <= -30 && bz <= -30) {
        // DOWNTOWN SKYSCRAPERS (Mix of reflective glass & stone towers)
        const seed = Math.abs(bx * 7 + bz * 13);
        const h1 = 44 + (seed % 38);
        const h2 = 30 + ((seed * 3) % 24);
        addBuilding(bx - 8, bz - 6, 17, 18, h1, seed % 3 === 0 ? 'concreteTower' : 'skyscraper', seed);
        addBuilding(bx + 10, bz + 8, 16, 16, h2, seed % 2 === 0 ? 'skyscraper' : 'concreteTower', seed + 1);
      } else if (bz >= 90) {
        addHouse(bx - 10, bz - 10, 0xe8dec8, 0x8c4435);
        addHouse(bx + 10, bz - 10, 0xd8e2dc, 0x3f4f5c);
        addHouse(bx - 10, bz + 10, 0xf2e4cf, 0x704a32);
        addHouse(bx + 10, bz + 10, 0xdde5ed, 0x455a64);
      } else if (bx === 90 && bz === 30) {
        // Coastal Art-Deco Strip
        addBuilding(bx - 8, bz - 8, 17, 16, 18, 'artdeco', 0);
        addBuilding(bx + 10, bz + 9, 15, 16, 14, 'artdeco', 1);
      } else {
        addBuilding(bx - 9, bz - 8, 17, 17, 22, 'apartment', 0);
        addBuilding(bx + 10, bz + 9, 15, 16, 16, 'apartment', 1);
      }
    }
  }

  // Instanced Balconies & Storefront Awnings
  if (balconyMatrices.length > 0) {
    const balconyGeo = new THREE.BoxGeometry(1, 1, 1);
    const balconyInst = new THREE.InstancedMesh(balconyGeo, concreteMat, balconyMatrices.length);
    balconyMatrices.forEach((m, i) => balconyInst.setMatrixAt(i, m));
    balconyInst.instanceMatrix.needsUpdate = true;
    balconyInst.computeBoundingSphere();
    group.add(balconyInst);
  }
  if (awningMatrices.length > 0) {
    const awningGeo = new THREE.BoxGeometry(1, 1, 1);
    const awningInst = new THREE.InstancedMesh(awningGeo, trimMetalMat, awningMatrices.length);
    awningMatrices.forEach((m, i) => awningInst.setMatrixAt(i, m));
    awningInst.instanceMatrix.needsUpdate = true;
    awningInst.computeBoundingSphere();
    group.add(awningInst);
  }

  // Overhead Highway Directional Sign Gantries
  const gantryPositions: [number, number, number][] = [
    [0, 32, 0],
    [0, -32, 0],
    [-60, 28, 0],
  ];
  const hwSignMat = new THREE.MeshStandardMaterial({ map: textures.highwaySign, roughness: 0.42 });
  for (const [gx, gz, rotY] of gantryPositions) {
    const gGroup = new THREE.Group();
    gGroup.position.set(gx, 0, gz);
    gGroup.rotation.y = rotY;
    for (const px of [-7.6, 7.6]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.8, 8), trimMetalMat);
      pole.position.set(px, 3.4, 0);
      pole.castShadow = true;
      gGroup.add(pole);
    }
    const crossBeam = new THREE.Mesh(new THREE.BoxGeometry(15.6, 0.28, 0.28), trimMetalMat);
    crossBeam.position.set(0, 6.4, 0);
    gGroup.add(crossBeam);

    const board = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.8, 0.24), hwSignMat);
    board.position.set(0, 6.4, 0.2);
    board.castShadow = true;
    gGroup.add(board);
    group.add(gGroup);
  }

  // Sunset Billboard ("San Verde - Dream Bigger")
  const bbGroup = new THREE.Group();
  bbGroup.position.set(14, 0.16, -2);
  bbGroup.rotation.y = -Math.PI / 5;
  const bbPost = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 7.5, 8), trimMetalMat);
  bbPost.position.y = 3.75;
  bbGroup.add(bbPost);
  const bbFrame = new THREE.Mesh(new THREE.BoxGeometry(11.4, 5.6, 0.4), trimMetalMat);
  bbFrame.position.y = 8.4;
  bbFrame.castShadow = true;
  bbGroup.add(bbFrame);
  const bbFace = new THREE.Mesh(
    new THREE.PlaneGeometry(10.8, 5.1),
    new THREE.MeshStandardMaterial({
      map: textures.billboardSign,
      emissiveMap: textures.billboardSign,
      emissive: 0xffffff,
      emissiveIntensity: 0.24,
      roughness: 0.45,
    }),
  );
  bbFace.position.set(0, 8.4, 0.23);
  bbGroup.add(bbFace);
  group.add(bbGroup);

  // Outer Suburban Houses
  for (const oz of [-155, -90, -30, 30, 90, 155]) {
    addHouse(-155, oz, 0xdccbb8, 0x6b3e2e);
  }
  for (const ox of [-90, -30, 30, 90]) {
    addHouse(ox, -155, 0xd5dee3, 0x475569);
    addHouse(ox, 155, 0xe5d7c3, 0x7c4a3a);
  }

  // 6. Instanced 3D Broadleaf Street & Park Trees (Multi-cluster crowns + tapered trunks + planters)
  const treePositions: [number, number, number][] = [
    [16, 0.2, -44],
    [44, 0.2, -44],
    [16, 0.2, -16],
    [44, 0.2, -16],
    [30, 0.2, -45],
    [15, 0.2, -30],
    [45, 0.2, -30],
    [30, 0.2, -15],
    // Boulevard sidewalk avenue trees
    [-51.6, 0.16, -42],
    [-51.6, 0.16, -18],
    [-8.6, 0.16, -42],
    [8.6, 0.16, -18],
    [8.6, 0.16, 42],
    [-8.6, 0.16, 42],
    [51.6, 0.16, -78],
    [51.6, 0.16, 78],
  ];
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 3.1, 7);
  trunkGeo.translate(0, 1.55, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c422c, roughness: 0.92 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
  trunkInst.castShadow = true;

  const crownGeo = new THREE.DodecahedronGeometry(1.75, 1);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2f7a3e, roughness: 0.85 });
  const canopyInst = new THREE.InstancedMesh(crownGeo, canopyMat, treePositions.length * 3);
  canopyInst.castShadow = true;
  canopyInst.receiveShadow = true;

  const leafShades = [0x2f7a3e, 0x3b8a46, 0x266934, 0x4b944f];
  treePositions.forEach(([x, y, z], idx) => {
    const s = 0.88 + ((idx * 17) % 28) / 100;
    dummy.position.set(x, y, z);
    dummy.scale.set(s, s, s);
    dummy.rotation.set(0, idx * 1.1, 0);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);

    const offsets: [number, number, number, number][] = [
      [0, 3.9, 0, 1.05],
      [0.85, 3.25, 0.55, 0.78],
      [-0.78, 3.35, -0.5, 0.74],
    ];
    offsets.forEach(([ox, oy, oz, os], cIdx) => {
      dummy.position.set(x + ox * s, y + oy * s, z + oz * s);
      dummy.scale.set(s * os, s * os * 0.92, s * os);
      dummy.rotation.set(cIdx * 0.4, idx + cIdx, 0);
      dummy.updateMatrix();
      const flatIdx = idx * 3 + cIdx;
      canopyInst.setMatrixAt(flatIdx, dummy.matrix);
      colorTmp.setHex(leafShades[(idx + cIdx) % leafShades.length]);
      canopyInst.setColorAt(flatIdx, colorTmp);
    });
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  group.add(trunkInst);
  group.add(canopyInst);

  // 7. Multi-Frond 3D Palm Trees along Beach Boardwalk & Boulevards (InstancedMesh)
  const palmPositions: [number, number][] = [];
  for (let z = -150; z <= 150; z += 22) {
    if (Math.abs(z - 28) > 8) {
      palmPositions.push([BEACH_START_X + 4.8, z]);
    }
  }
  for (let z = -102; z <= 102; z += 26) {
    if (Math.abs(z % 60) > 10) {
      palmPositions.push([-8.8, z]);
      palmPositions.push([8.8, z]);
      palmPositions.push([-51.2, z]);
    }
  }
  let pTrunkInst: THREE.InstancedMesh | null = null;
  let pFrondInst: THREE.InstancedMesh | null = null;
  if (palmPositions.length > 0) {
    const pTrunkGeo = new THREE.CylinderGeometry(0.17, 0.34, 7.2, 7);
    pTrunkGeo.translate(0, 3.6, 0);
    const pTrunkMat = new THREE.MeshStandardMaterial({ color: 0x73563c, roughness: 0.9 });
    const palmTrunkInst = new THREE.InstancedMesh(pTrunkGeo, pTrunkMat, palmPositions.length);
    palmTrunkInst.castShadow = true;

    // Arching palm frond blade
    const frondGeo = new THREE.BoxGeometry(0.68, 0.08, 3.1);
    frondGeo.translate(0, 0, 1.45);
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x3b8c3f, roughness: 0.78 });
    const frondsPerPalm = 6;
    const palmFrondInst = new THREE.InstancedMesh(frondGeo, frondMat, palmPositions.length * frondsPerPalm);
    palmFrondInst.castShadow = true;

    palmPositions.forEach(([x, z], idx) => {
      const s = 0.88 + ((idx * 13) % 26) / 100;
      const tiltX = 0.05 * Math.sin(idx);
      const tiltZ = 0.04 * Math.cos(idx);
      dummy.position.set(x, 0.12, z);
      dummy.scale.set(s, s, s);
      dummy.rotation.set(tiltX, idx * 0.9, tiltZ);
      dummy.updateMatrix();
      palmTrunkInst.setMatrixAt(idx, dummy.matrix);

      const topX = x + Math.sin(tiltZ) * 0.35;
      const topY = 0.12 + 7.1 * s;
      const topZ = z + Math.sin(tiltX) * 0.35;
      for (let f = 0; f < frondsPerPalm; f++) {
        const yaw = (f / frondsPerPalm) * Math.PI * 2 + idx * 0.4;
        dummy.position.set(topX, topY, topZ);
        dummy.rotation.set(0.38 + (f % 2) * 0.14, yaw, 0);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        const flatIdx = idx * frondsPerPalm + f;
        palmFrondInst.setMatrixAt(flatIdx, dummy.matrix);
        colorTmp.setHex(f % 2 === 0 ? 0x3b8c3f : 0x4ca148);
        palmFrondInst.setColorAt(flatIdx, colorTmp);
      }
    });
    palmTrunkInst.instanceMatrix.needsUpdate = true;
    palmFrondInst.instanceMatrix.needsUpdate = true;
    if (palmFrondInst.instanceColor) palmFrondInst.instanceColor.needsUpdate = true;
    palmTrunkInst.computeBoundingSphere();
    palmFrondInst.computeBoundingSphere();
    group.add(palmTrunkInst);
    group.add(palmFrondInst);
    pTrunkInst = palmTrunkInst;
    pFrondInst = palmFrondInst;
  }

  // 8. Instanced Park Hedges & Shrubs
  const shrubCoords: [number, number, number][] = [
    [10, 0.2, -49],
    [50, 0.2, -49],
    [10, 0.2, -11],
    [50, 0.2, -11],
    [22, 0.2, -39],
    [38, 0.2, -39],
    [22, 0.2, -21],
    [38, 0.2, -21],
    [-46, 0.16, 46],
    [-14, 0.16, 46],
  ];
  const shrubGeo = new THREE.DodecahedronGeometry(0.85, 0);
  const shrubMat = new THREE.MeshStandardMaterial({ color: 0x2d6e36, roughness: 0.88 });
  const shrubInst = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubCoords.length);
  shrubCoords.forEach(([sx, sy, sz], idx) => {
    dummy.position.set(sx, sy + 0.45, sz);
    dummy.scale.set(1.25, 0.85, 1.25);
    dummy.rotation.set(0, idx * 0.8, 0);
    dummy.updateMatrix();
    shrubInst.setMatrixAt(idx, dummy.matrix);
  });
  shrubInst.instanceMatrix.needsUpdate = true;
  shrubInst.computeBoundingSphere();
  detailPropsGroup.add(shrubInst);

  // 9. Classic Cast-Iron Street Lamps + Hanging Downtown Banners (InstancedMesh)
  const lampCoords: [number, number][] = [];
  for (const rx of [-60, 0, 60, 120]) {
    for (let z = -90; z <= 90; z += 60) {
      lampCoords.push([rx + 8.2, z + 10]);
    }
  }
  const streetLightBulbs = new THREE.MeshStandardMaterial({
    color: 0xfff5d6,
    emissive: 0xffd27d,
    emissiveIntensity: 0.25,
    roughness: 0.3,
  });
  if (lampCoords.length > 0) {
    const baseGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.9, 8);
    baseGeo.translate(0, 0.45, 0);
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.13, 5.4, 7);
    poleGeo.translate(0, 2.7, 0);
    const armGeo = new THREE.BoxGeometry(1.1, 0.1, 0.1);
    armGeo.translate(-0.5, 5.25, 0);
    const bulbGeo = new THREE.SphereGeometry(0.24, 8, 8);
    bulbGeo.translate(-0.95, 5.05, 0);

    const baseInst = new THREE.InstancedMesh(baseGeo, darkCastIronMat, lampCoords.length);
    const poleInst = new THREE.InstancedMesh(poleGeo, darkCastIronMat, lampCoords.length);
    const armInst = new THREE.InstancedMesh(armGeo, darkCastIronMat, lampCoords.length);
    const bulbInst = new THREE.InstancedMesh(bulbGeo, streetLightBulbs, lampCoords.length);

    const bannerGeo = new THREE.PlaneGeometry(0.55, 1.35);
    bannerGeo.translate(0.34, 3.8, 0);
    const bannerMat = new THREE.MeshStandardMaterial({
      map: textures.bannerSign,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    const bannerInst = new THREE.InstancedMesh(bannerGeo, bannerMat, lampCoords.length);

    lampCoords.forEach(([x, z], idx) => {
      dummy.position.set(x, 0.16, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      baseInst.setMatrixAt(idx, dummy.matrix);
      poleInst.setMatrixAt(idx, dummy.matrix);
      armInst.setMatrixAt(idx, dummy.matrix);
      bulbInst.setMatrixAt(idx, dummy.matrix);
      bannerInst.setMatrixAt(idx, dummy.matrix);
    });
    [baseInst, poleInst, armInst, bulbInst, bannerInst].forEach((inst) => {
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
    });
    group.add(baseInst, poleInst, armInst, bulbInst);
    detailPropsGroup.add(bannerInst);
  }

  // 10. Instanced Park & Sidewalk Benches, Trash Bins, Fire Hydrants & Crosswalk Bollards
  const benchCoords: { x: number; y: number; z: number; rotY: number }[] = [
    { x: 22, y: 0.22, z: -30, rotY: Math.PI / 2 },
    { x: 38, y: 0.22, z: -30, rotY: -Math.PI / 2 },
    { x: 30, y: 0.22, z: -22, rotY: 0 },
    { x: 30, y: 0.22, z: -38, rotY: Math.PI },
    { x: BEACH_START_X + 0.5, y: 0.24, z: -34, rotY: -Math.PI / 2 },
    { x: BEACH_START_X + 0.5, y: 0.24, z: 12, rotY: -Math.PI / 2 },
    { x: -10.5, y: 0.16, z: -20, rotY: Math.PI / 2 },
    { x: 10.5, y: 0.16, z: 18, rotY: -Math.PI / 2 },
  ];
  const benchSeatGeo = new THREE.BoxGeometry(1.9, 0.1, 0.55);
  benchSeatGeo.translate(0, 0.45, 0);
  const benchBackGeo = new THREE.BoxGeometry(1.9, 0.42, 0.08);
  benchBackGeo.translate(0, 0.72, -0.24);
  const benchLegGeo = new THREE.BoxGeometry(1.7, 0.45, 0.48);
  benchLegGeo.translate(0, 0.22, 0);

  const benchSeatInst = new THREE.InstancedMesh(benchSeatGeo, woodMat, benchCoords.length);
  const benchBackInst = new THREE.InstancedMesh(benchBackGeo, woodMat, benchCoords.length);
  const benchLegInst = new THREE.InstancedMesh(benchLegGeo, darkCastIronMat, benchCoords.length);
  benchCoords.forEach((b, idx) => {
    dummy.position.set(b.x, b.y, b.z);
    dummy.rotation.set(0, b.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    benchSeatInst.setMatrixAt(idx, dummy.matrix);
    benchBackInst.setMatrixAt(idx, dummy.matrix);
    benchLegInst.setMatrixAt(idx, dummy.matrix);
  });
  [benchSeatInst, benchBackInst, benchLegInst].forEach((inst) => {
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    detailPropsGroup.add(inst);
  });

  // Metallic Trash Bins along sidewalk corners
  const binCoords: [number, number][] = [];
  for (const bx of [-30, 30]) {
    for (const bz of [-30, 30]) {
      binCoords.push([bx - 21.2, bz - 21.2], [bx + 21.2, bz + 21.2]);
    }
  }
  const binGeo = new THREE.CylinderGeometry(0.28, 0.25, 0.88, 10);
  binGeo.translate(0, 0.44, 0);
  const binInst = new THREE.InstancedMesh(binGeo, trimMetalMat, binCoords.length);
  binCoords.forEach(([x, z], idx) => {
    dummy.position.set(x, 0.16, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    binInst.setMatrixAt(idx, dummy.matrix);
  });
  binInst.instanceMatrix.needsUpdate = true;
  binInst.computeBoundingSphere();
  detailPropsGroup.add(binInst);

  // Red Fire Hydrants & Sidewalk Corner Bollards
  const hydrantCoords: [number, number][] = [
    [-8.6, 8.6],
    [8.6, -8.6],
    [-51.4, -8.6],
    [51.4, 8.6],
    [-8.6, -51.4],
    [8.6, 51.4],
  ];
  const hydrantMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.38, metalness: 0.35 });
  const hydrantGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.72, 8);
  hydrantGeo.translate(0, 0.36, 0);
  const hydrantInst = new THREE.InstancedMesh(hydrantGeo, hydrantMat, hydrantCoords.length);
  hydrantCoords.forEach(([hx, hz], idx) => {
    dummy.position.set(hx, 0.16, hz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    hydrantInst.setMatrixAt(idx, dummy.matrix);
  });
  hydrantInst.instanceMatrix.needsUpdate = true;
  hydrantInst.computeBoundingSphere();
  detailPropsGroup.add(hydrantInst);

  // Sidewalk Safety Bollards near central avenue crosswalks
  const bollardCoords: [number, number][] = [];
  for (const sx of [-9.2, 9.2]) {
    for (const sz of [-10.5, -9.2, 9.2, 10.5]) {
      bollardCoords.push([sx, sz]);
    }
  }
  const bollardGeo = new THREE.CylinderGeometry(0.09, 0.1, 0.85, 8);
  bollardGeo.translate(0, 0.425, 0);
  const bollardInst = new THREE.InstancedMesh(bollardGeo, darkCastIronMat, bollardCoords.length);
  bollardCoords.forEach(([bx, bz], idx) => {
    dummy.position.set(bx, 0.16, bz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    bollardInst.setMatrixAt(idx, dummy.matrix);
  });
  bollardInst.instanceMatrix.needsUpdate = true;
  bollardInst.computeBoundingSphere();
  detailPropsGroup.add(bollardInst);

  // Original Stop / Speed Street Signs at avenue corners
  const signCoords: { x: number; z: number; rotY: number }[] = [
    { x: -8.6, z: -26, rotY: 0 },
    { x: 8.6, z: 26, rotY: Math.PI },
    { x: -26, z: 8.6, rotY: Math.PI / 2 },
    { x: 26, z: -8.6, rotY: -Math.PI / 2 },
  ];
  const signPoleGeo = new THREE.CylinderGeometry(0.045, 0.05, 2.7, 6);
  signPoleGeo.translate(0, 1.35, 0);
  const stopPlateGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.05, 8);
  stopPlateGeo.rotateX(Math.PI / 2);
  stopPlateGeo.translate(0, 2.45, 0.05);

  const signPoleInst = new THREE.InstancedMesh(signPoleGeo, trimMetalMat, signCoords.length);
  const stopPlateInst = new THREE.InstancedMesh(stopPlateGeo, hydrantMat, signCoords.length);
  signCoords.forEach((sc, idx) => {
    dummy.position.set(sc.x, 0.16, sc.z);
    dummy.rotation.set(0, sc.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    signPoleInst.setMatrixAt(idx, dummy.matrix);
    stopPlateInst.setMatrixAt(idx, dummy.matrix);
  });
  signPoleInst.instanceMatrix.needsUpdate = true;
  stopPlateInst.instanceMatrix.needsUpdate = true;
  signPoleInst.computeBoundingSphere();
  stopPlateInst.computeBoundingSphere();
  detailPropsGroup.add(signPoleInst, stopPlateInst);

  group.add(detailPropsGroup);

  // 11. Traffic Lights
  const intersectionCoords: [number, number][] = [
    [0, 0],
    [-60, 0],
    [0, -60],
    [60, 0],
    [0, 60],
  ];
  for (const [ix, iz] of intersectionCoords) {
    const tlGroup = new THREE.Group();
    tlGroup.position.set(ix + HALF_ROAD + 1.2, 0.16, iz + HALF_ROAD + 1.2);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 5.4, 8), trimMetalMat);
    pole.position.y = 2.7;
    tlGroup.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.14), trimMetalMat);
    arm.position.set(-1.5, 5.1, 0);
    tlGroup.add(arm);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.35, 0.45), trimMetalMat);
    housing.position.set(-2.6, 4.7, 0);
    tlGroup.add(housing);

    const nsRed = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 1.0 });
    const nsGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.1 });
    const ewRed = new THREE.MeshStandardMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 0.1 });
    const ewGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 1.0 });

    const lensGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const l1 = new THREE.Mesh(lensGeo, nsRed);
    l1.position.set(-2.6, 5.05, 0.24);
    tlGroup.add(l1);
    const l2 = new THREE.Mesh(lensGeo, nsGreen);
    l2.position.set(-2.6, 4.45, 0.24);
    tlGroup.add(l2);

    const l3 = new THREE.Mesh(lensGeo, ewRed);
    l3.position.set(-2.88, 5.05, 0);
    tlGroup.add(l3);
    const l4 = new THREE.Mesh(lensGeo, ewGreen);
    l4.position.set(-2.88, 4.45, 0);
    tlGroup.add(l4);

    group.add(tlGroup);
    trafficLights.push({ x: ix, z: iz, nsRed, nsGreen, ewRed, ewGreen });
  }

  // Patrolling Helicopter over Downtown Skyline
  const heliGroup = new THREE.Group();
  const heliBody = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.95, 2.4, 6, 12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.5, roughness: 0.3 }),
  );
  heliBody.rotation.x = Math.PI / 2;
  heliGroup.add(heliBody);
  const heliTail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 3.6), trimMetalMat);
  heliTail.position.set(0, 0.2, -2.5);
  heliGroup.add(heliTail);
  const heliRotor = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.06, 0.24), trimMetalMat);
  heliRotor.position.set(0, 1.25, 0);
  heliGroup.add(heliRotor);
  const heliTailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.14), trimMetalMat);
  heliTailRotor.position.set(0.18, 0.3, -4.1);
  heliGroup.add(heliTailRotor);
  heliGroup.position.set(-35, 52, -35);
  group.add(heliGroup);

  // Drifting Volumetric Clouds
  const cloudsGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 1.0,
    transparent: true,
    opacity: 0.82,
  });
  for (let i = 0; i < 16; i++) {
    const cg = new THREE.Group();
    const cx = -220 + ((i * 83) % 440);
    const cz = -220 + ((i * 127) % 440);
    const cy = 90 + (i % 4) * 9;
    cg.position.set(cx, cy, cz);
    for (let p = 0; p < 3; p++) {
      const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(9 + p * 2.5, 1), cloudMat);
      puff.position.set((p - 1) * 9, p === 1 ? 2.5 : 0, (p % 2) * 3);
      puff.scale.set(1.5, 0.55, 1.1);
      cg.add(puff);
    }
    cloudsGroup.add(cg);
  }
  group.add(cloudsGroup);

  // Distant Horizon Mountains + Hillside Landmark Sign
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x3b4d42, roughness: 0.95 });
  for (let i = 0; i < 10; i++) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(65 + (i % 3) * 20, 42 + (i % 4) * 14, 7), hillMat);
    hill.position.set(-290 - (i % 2) * 35, 16, -240 + i * 55);
    group.add(hill);
  }

  const vwCanvas = document.createElement('canvas');
  vwCanvas.width = 512;
  vwCanvas.height = 128;
  const vwCtx = vwCanvas.getContext('2d')!;
  vwCtx.clearRect(0, 0, 512, 128);
  vwCtx.fillStyle = '#ffffff';
  vwCtx.font = 'bold 74px Chakra Petch, Arial, sans-serif';
  vwCtx.textAlign = 'center';
  vwCtx.fillText('SAN VERDE', 256, 86);
  const vwTex = new THREE.CanvasTexture(vwCanvas);
  vwTex.colorSpace = THREE.SRGBColorSpace;
  const vwSign = new THREE.Mesh(
    new THREE.PlaneGeometry(52, 13),
    new THREE.MeshBasicMaterial({ map: vwTex, transparent: true, side: THREE.DoubleSide }),
  );
  vwSign.position.set(-245, 31, -45);
  vwSign.rotation.y = Math.PI / 2;
  group.add(vwSign);

  scene.add(group);

  const dayZenith = new THREE.Color(0x2e6fb8);
  const dayHorizon = new THREE.Color(0x9ed3f7);
  const sunsetZenith = new THREE.Color(0x314a70);
  const sunsetHorizon = new THREE.Color(0xf29356);
  const nightZenith = new THREE.Color(0x050914);
  const nightHorizon = new THREE.Color(0x132240);

  const daySunColor = new THREE.Color(0xfff1d6);
  const sunsetSunColor = new THREE.Color(0xff9b52);
  const moonColor = new THREE.Color(0x7aa4e8);
  const currentHorizon = new THREE.Color();

  scene.background = sunsetHorizon.clone();
  scene.fog = new THREE.FogExp2(0xf29356, 0.0026);

  let currentShadowSpan = 88;
  let currentShadowMapSize = shadowMapSize;

  const setQuality = (q: GraphicsQuality, allowShadows: boolean) => {
    const isLow = q === 'low';
    const qCfg = QUALITY_PRESETS[q];
    detailPropsGroup.visible = !isLow;
    trunkInst.castShadow = allowShadows && !isLow;
    canopyInst.castShadow = allowShadows && !isLow;
    if (pTrunkInst) pTrunkInst.castShadow = allowShadows && !isLow;
    if (pFrondInst) pFrondInst.castShadow = allowShadows && !isLow;
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = isLow ? 0.0036 : q === 'medium' ? 0.0024 : 0.0018;
    }
    currentShadowSpan = isLow ? 60 : q === 'medium' ? 88 : 108;
    currentShadowMapSize = qCfg.shadowMapSize;
    sunLight.shadow.camera.left = -currentShadowSpan;
    sunLight.shadow.camera.right = currentShadowSpan;
    sunLight.shadow.camera.top = currentShadowSpan;
    sunLight.shadow.camera.bottom = -currentShadowSpan;
    sunLight.shadow.camera.updateProjectionMatrix();
  };

  const update = (
    elapsed: number,
    dayProgress: number,
    playerPos: THREE.Vector3,
    allowShadows: boolean,
  ) => {
    const sunAngle = (dayProgress - 0.25) * Math.PI * 2;
    const sunElev = Math.sin(sunAngle);
    const isNight = sunElev < 0.06;

    if (sunElev > 0.28) {
      skyUniforms.uTopColor.value.copy(dayZenith);
      currentHorizon.copy(dayHorizon);
      skyUniforms.uSunGlow.value = 0.72;
    } else if (sunElev > -0.15) {
      const t = (sunElev + 0.15) / 0.43;
      if (t > 0.5) {
        const k = (t - 0.5) * 2;
        skyUniforms.uTopColor.value.copy(sunsetZenith).lerp(dayZenith, k);
        currentHorizon.copy(sunsetHorizon).lerp(dayHorizon, k);
        skyUniforms.uSunGlow.value = THREE.MathUtils.lerp(1.18, 0.72, k);
      } else {
        const k = t * 2;
        skyUniforms.uTopColor.value.copy(nightZenith).lerp(sunsetZenith, k);
        currentHorizon.copy(nightHorizon).lerp(sunsetHorizon, k);
        skyUniforms.uSunGlow.value = THREE.MathUtils.lerp(0.18, 1.18, k);
      }
    } else {
      skyUniforms.uTopColor.value.copy(nightZenith);
      currentHorizon.copy(nightHorizon);
      skyUniforms.uSunGlow.value = 0.14;
    }

    const nightGlow = isNight ? 1.0 : THREE.MathUtils.clamp((0.24 - sunElev) / 0.28, 0, 1);
    skyUniforms.uNightFactor.value = nightGlow;
    skyUniforms.uTime.value = elapsed;
    skyUniforms.uHorizonColor.value.copy(currentHorizon);
    skyDome.position.set(playerPos.x, 0, playerPos.z);

    if (scene.background instanceof THREE.Color) {
      scene.background.copy(currentHorizon);
    }
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(currentHorizon);
    }

    // Texel-snapped directional shadow camera follows player cleanly without shadow shimmer
    const lightDist = 110;
    const elevClamped = Math.max(0.28, Math.abs(sunElev));
    const lx = Math.cos(sunAngle) * lightDist * 0.72;
    const ly = elevClamped * lightDist;
    const lz = 45;
    const texelSize = (currentShadowSpan * 2) / Math.max(256, currentShadowMapSize);
    const snapX = Math.round(playerPos.x / texelSize) * texelSize;
    const snapZ = Math.round(playerPos.z / texelSize) * texelSize;
    sunLight.position.set(snapX + lx, ly, snapZ + lz);
    sunLight.target.position.set(snapX, 0, snapZ);
    sunLight.target.updateMatrixWorld();
    sunLight.castShadow = allowShadows;
    skyUniforms.uSunDir.value.set(lx, Math.max(8, sunElev * lightDist), lz).normalize();

    if (!isNight) {
      const dayFactor = THREE.MathUtils.clamp((sunElev - 0.05) / 0.4, 0, 1);
      sunLight.intensity = 1.4 + dayFactor * 1.18;
      sunLight.color.copy(sunsetSunColor).lerp(daySunColor, dayFactor);
      skyUniforms.uSunColor.value.copy(sunLight.color);
      hemiLight.intensity = 0.68 + dayFactor * 0.36;
      fillLight.intensity = 0.42 + dayFactor * 0.16;
    } else {
      sunLight.intensity = 0.82;
      sunLight.color.copy(moonColor);
      skyUniforms.uSunColor.value.copy(moonColor);
      hemiLight.intensity = 0.48;
      fillLight.intensity = 0.3;
    }

    streetLightBulbs.emissiveIntensity = 0.25 + nightGlow * 2.55;
    for (let i = 0; i < windowMaterials.length; i++) {
      windowMaterials[i].emissiveIntensity = nightGlow * 0.98;
    }

    textures.waterNormal.offset.x = (elapsed * 0.015) % 1;
    textures.waterNormal.offset.y = (elapsed * 0.024) % 1;

    for (let i = 0; i < cloudsGroup.children.length; i++) {
      const c = cloudsGroup.children[i];
      c.position.x += 0.018;
      if (c.position.x > 260) c.position.x = -260;
    }

    // Orbit Helicopter over downtown
    const heliAngle = elapsed * 0.22;
    const hx = -35 + Math.cos(heliAngle) * 52;
    const hz = -35 + Math.sin(heliAngle) * 44;
    heliGroup.position.set(hx, 54 + Math.sin(elapsed * 0.9) * 1.8, hz);
    heliGroup.rotation.y = -heliAngle;
    heliRotor.rotation.y = elapsed * 24;
    heliTailRotor.rotation.x = elapsed * 28;

    const cycle = elapsed % 14;
    const nsGreen = cycle < 7;
    for (let i = 0; i < trafficLights.length; i++) {
      const tl = trafficLights[i];
      tl.nsGreen.emissiveIntensity = nsGreen ? 1.5 : 0.08;
      tl.nsRed.emissiveIntensity = nsGreen ? 0.08 : 1.5;
      tl.ewGreen.emissiveIntensity = nsGreen ? 0.08 : 1.5;
      tl.ewRed.emissiveIntensity = nsGreen ? 1.5 : 0.08;
    }

    return { nsGreen, isNight };
  };

  return {
    group,
    colliders,
    interactiveZones,
    trafficLights,
    streetLightBulbs,
    windowMaterials,
    sunLight,
    hemiLight,
    fillLight,
    waterMesh,
    cloudsGroup,
    setQuality,
    update,
  };
}
