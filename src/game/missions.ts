import * as THREE from 'three';
import { MissionDefinition, MissionProgress } from './types';

export const CITY_MISSIONS: MissionDefinition[] = [
  {
    id: 'street_race',
    title: 'Corrida Neon na Avenida',
    type: 'race',
    typeLabel: 'Corrida de Rua',
    description: 'Percorre os 4 pontos de controlo pelas avenidas principais antes do tempo acabar.',
    reward: 600,
    timeLimitSec: 75,
    startX: 0,
    startZ: 30,
    steps: [
      { label: 'Checkpoint 1: Cruzamento Norte', targetX: 0, targetZ: -60, radius: 7.5 },
      { label: 'Checkpoint 2: Centro Financeiro', targetX: -60, targetZ: -60, radius: 7.5 },
      { label: 'Checkpoint 3: Avenida Sul', targetX: -60, targetZ: 60, radius: 7.5 },
      { label: 'Meta: Praça Central', targetX: 0, targetZ: 60, radius: 8.5 },
    ],
  },
  {
    id: 'cargo_run',
    title: 'Entrega Expresso no Cais',
    type: 'delivery',
    typeLabel: 'Entrega',
    description: 'Transporta a encomenda da Loja 24/7 até ao Cais da Praia de Vespucci.',
    reward: 450,
    timeLimitSec: 65,
    startX: -19,
    startZ: 28,
    steps: [
      { label: 'Recolhe a carga no Parque de Estacionamento', targetX: 82, targetZ: -30, radius: 7.5 },
      { label: 'Entrega no Cais de Vespucci', targetX: 129, targetZ: 28, radius: 8.0 },
    ],
  },
  {
    id: 'heat_breaker',
    title: 'Fuga à Polícia',
    type: 'escape',
    typeLabel: 'Perseguição',
    description: 'Despista uma perseguição policial de 3 estrelas e escapa da zona de busca.',
    reward: 800,
    startX: 60,
    startZ: -60,
    wantedOnStart: 3,
    steps: [
      { label: 'Despista a polícia até as estrelas desaparecerem', targetX: 135, targetZ: -90, radius: 10 },
    ],
  },
  {
    id: 'beach_patrol',
    title: 'Reconhecimento Costeiro',
    type: 'explore',
    typeLabel: 'Exploração',
    description: 'Visita o Parque Central, o Posto de Combustível e o Miradouro da Praia.',
    reward: 350,
    startX: 25,
    startZ: -10,
    steps: [
      { label: 'Visita a Fonte do Parque Central', targetX: 30, targetZ: -20, radius: 8.0 },
      { label: 'Passa pelo Posto de Combustível', targetX: 25, targetZ: 32, radius: 8.0 },
      { label: 'Chega ao Passeio Marítimo', targetX: 131, targetZ: 0, radius: 8.5 },
    ],
  },
  {
    id: 'bounty_hunt',
    title: 'Acerto de Contas',
    type: 'action',
    typeLabel: 'Ação',
    description: 'Neutraliza os 3 mercenários armados escondidos no Bairro Sul.',
    reward: 750,
    startX: -30,
    startZ: 60,
    spawnTargets: [
      { x: -30, z: 95 },
      { x: 10, z: 105 },
      { x: -75, z: 100 },
    ],
    steps: [
      { label: 'Elimina os 3 alvos no Bairro Sul', targetX: -30, targetZ: 100, radius: 12 },
    ],
  },
];

export class MissionManager {
  public progress: MissionProgress = {
    activeMissionId: null,
    currentStepIndex: 0,
    timeRemaining: 0,
    completedIds: [],
    targetsRemaining: 0,
    bannerText: null,
  };

  private scene: THREE.Scene;
  private startBeacons: Map<string, THREE.Group> = new Map();
  private activeCheckpointMesh: THREE.Group;
  private bannerTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Create 3D pulsing checkpoint ring + vertical beam for active mission target
    this.activeCheckpointMesh = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(3.2, 0.22, 10, 28),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.4,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.35;
    this.activeCheckpointMesh.add(ring);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 32, 14, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.y = 16;
    this.activeCheckpointMesh.add(beam);
    this.activeCheckpointMesh.visible = false;
    this.scene.add(this.activeCheckpointMesh);

    // Create mission starter markers in the 3D city
    for (const m of CITY_MISSIONS) {
      const marker = new THREE.Group();
      marker.position.set(m.startX, 0.1, m.startZ);

      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 1.8, 0.12, 20),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 1.2,
        }),
      );
      marker.add(disc);

      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.65, 12, 12, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      pillar.position.y = 6;
      marker.add(pillar);

      this.scene.add(marker);
      this.startBeacons.set(m.id, marker);
    }
  }

  public getActiveMission(): MissionDefinition | null {
    if (!this.progress.activeMissionId) return null;
    return CITY_MISSIONS.find((m) => m.id === this.progress.activeMissionId) ?? null;
  }

  public startMission(
    id: string,
    onSetupEscape: (stars: number) => void,
    onSpawnActionTargets: (coords: { x: number; z: number }[]) => void,
  ): boolean {
    const def = CITY_MISSIONS.find((m) => m.id === id);
    if (!def) return false;

    this.progress.activeMissionId = def.id;
    this.progress.currentStepIndex = 0;
    this.progress.timeRemaining = def.timeLimitSec ?? 0;
    this.progress.targetsRemaining = def.spawnTargets ? def.spawnTargets.length : 0;
    this.progress.bannerText = `Missão iniciada: ${def.title}`;
    this.bannerTimer = 3.5;

    if (def.wantedOnStart) {
      onSetupEscape(def.wantedOnStart);
    }
    if (def.spawnTargets) {
      onSpawnActionTargets(def.spawnTargets);
    }
    return true;
  }

  public cancelMission(): void {
    this.progress.activeMissionId = null;
    this.progress.currentStepIndex = 0;
    this.progress.timeRemaining = 0;
    this.progress.targetsRemaining = 0;
    this.activeCheckpointMesh.visible = false;
  }

  public update(
    dt: number,
    elapsed: number,
    playerPos: THREE.Vector3,
    wantedStars: number,
    enemiesRemaining: number,
    onComplete: (reward: number, title: string) => void,
    onFail: (reason: string) => void,
  ): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.progress.bannerText = null;
    }

    // Hide/show start beacons
    for (const [id, mesh] of this.startBeacons.entries()) {
      mesh.visible = this.progress.activeMissionId === null;
      mesh.rotation.y = elapsed * 1.4 + id.length;
    }

    const active = this.getActiveMission();
    if (!active) {
      this.activeCheckpointMesh.visible = false;
      return;
    }

    // Timer countdown
    if (active.timeLimitSec) {
      this.progress.timeRemaining -= dt;
      if (this.progress.timeRemaining <= 0) {
        this.cancelMission();
        onFail('Tempo esgotado!');
        return;
      }
    }

    if (active.type === 'escape') {
      this.activeCheckpointMesh.visible = false;
      if (wantedStars === 0) {
        if (!this.progress.completedIds.includes(active.id)) {
          this.progress.completedIds.push(active.id);
        }
        const reward = active.reward;
        const title = active.title;
        this.cancelMission();
        onComplete(reward, title);
      }
      return;
    }

    if (active.type === 'action') {
      this.progress.targetsRemaining = enemiesRemaining;
      const step = active.steps[0];
      this.activeCheckpointMesh.visible = enemiesRemaining > 0;
      this.activeCheckpointMesh.position.set(step.targetX, 0.1, step.targetZ);
      this.activeCheckpointMesh.rotation.y = elapsed * 2;
      if (enemiesRemaining === 0) {
        if (!this.progress.completedIds.includes(active.id)) {
          this.progress.completedIds.push(active.id);
        }
        const reward = active.reward;
        const title = active.title;
        this.cancelMission();
        onComplete(reward, title);
      }
      return;
    }

    // Standard Checkpoint Progression (race, delivery, explore)
    const step = active.steps[this.progress.currentStepIndex];
    if (!step) return;

    this.activeCheckpointMesh.visible = true;
    this.activeCheckpointMesh.position.set(step.targetX, 0.1, step.targetZ);
    this.activeCheckpointMesh.rotation.y = elapsed * 2;

    const dist = Math.hypot(playerPos.x - step.targetX, playerPos.z - step.targetZ);
    if (dist <= step.radius) {
      this.progress.currentStepIndex++;
      if (this.progress.currentStepIndex >= active.steps.length) {
        if (!this.progress.completedIds.includes(active.id)) {
          this.progress.completedIds.push(active.id);
        }
        const reward = active.reward;
        const title = active.title;
        this.cancelMission();
        onComplete(reward, title);
      } else {
        this.progress.bannerText = active.steps[this.progress.currentStepIndex].label;
        this.bannerTimer = 3.0;
      }
    }
  }
}
