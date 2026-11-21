import * as THREE from 'three';

const _desiredPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();

export class ThirdPersonCamera {
  public camera: THREE.PerspectiveCamera;
  public yaw = 0; // radians around Y
  public pitch = 0.28; // radians above horizon
  public shakeIntensity = 0;
  private currentPos = new THREE.Vector3(-12, 5, 22);
  private currentLook = new THREE.Vector3(-12, 1.5, 14);
  private currentFov = 62;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.2, 650);
    this.camera.position.copy(this.currentPos);
  }

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(0.9, this.shakeIntensity + amount);
  }

  public applyLookDelta(dx: number, dy: number, sensitivity: number): void {
    this.yaw -= dx * 0.0042 * sensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * 0.0032 * sensitivity, -0.18, 1.05);
  }

  public updateTitlePan(elapsed: number): void {
    const angle = elapsed * 0.11;
    const radius = 105;
    _desiredPos.set(
      Math.cos(angle) * radius - 10,
      36 + Math.sin(elapsed * 0.25) * 6,
      Math.sin(angle) * radius,
    );
    _lookTarget.set(-10, 10, -10);
    this.camera.position.copy(_desiredPos);
    this.camera.lookAt(_lookTarget);
  }

  public updateFollow(
    dt: number,
    targetPos: THREE.Vector3,
    targetHeading: number,
    inVehicle: boolean,
    vehicleSpeed: number,
    isUserLooking: boolean,
    slipAngle = 0,
  ): void {
    // Gently auto-align camera behind vehicle velocity/drift arc when driving
    if (inVehicle && !isUserLooking && Math.abs(vehicleSpeed) > 3.0) {
      const driftFollowOffset = THREE.MathUtils.clamp(slipAngle * 0.45, -0.35, 0.35);
      const targetYaw = targetHeading + Math.PI - driftFollowOffset;
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, 2.7 * dt);
    }

    const dist = inVehicle ? 8.0 + Math.min(2.4, Math.abs(vehicleSpeed) * 0.055) : 5.4;
    const heightOffset = inVehicle ? 2.05 : 1.7;

    const horizDist = Math.cos(this.pitch) * dist;
    const vertDist = Math.sin(this.pitch) * dist;

    _desiredPos.set(
      targetPos.x + Math.sin(this.yaw) * horizDist,
      Math.max(0.7, targetPos.y + heightOffset + vertDist),
      targetPos.z + Math.cos(this.yaw) * horizDist,
    );

    _lookTarget.set(targetPos.x, targetPos.y + (inVehicle ? 1.2 : 1.45), targetPos.z);

    // Smooth exponential damping
    const posLambda = inVehicle ? 11 : 14;
    this.currentPos.x = THREE.MathUtils.damp(this.currentPos.x, _desiredPos.x, posLambda, dt);
    this.currentPos.y = THREE.MathUtils.damp(this.currentPos.y, _desiredPos.y, posLambda, dt);
    this.currentPos.z = THREE.MathUtils.damp(this.currentPos.z, _desiredPos.z, posLambda, dt);

    this.currentLook.x = THREE.MathUtils.damp(this.currentLook.x, _lookTarget.x, 16, dt);
    this.currentLook.y = THREE.MathUtils.damp(this.currentLook.y, _lookTarget.y, 16, dt);
    this.currentLook.z = THREE.MathUtils.damp(this.currentLook.z, _lookTarget.z, 16, dt);

    // Dynamic FOV widening at high driving speed
    const targetFov = inVehicle ? 62 + Math.min(14, Math.abs(vehicleSpeed) * 0.34) : 60;
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 6, dt);
    if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
    }

    this.camera.position.copy(this.currentPos);
    if (this.shakeIntensity > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity *= Math.exp(-10 * dt);
    } else {
      this.shakeIntensity = 0;
    }

    this.camera.lookAt(this.currentLook);
  }

  public resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
}
