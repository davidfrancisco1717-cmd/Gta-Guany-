import * as THREE from 'three';
import { CameraMode, WorldBoxCollider } from './types';
import { raycastCollidersFraction } from './physics';

const _desiredPos = new THREE.Vector3();
const _lookTarget = new THREE.Vector3();
const _cockpitPos = new THREE.Vector3();
const _cockpitLook = new THREE.Vector3();

export class ThirdPersonCamera {
  public camera: THREE.PerspectiveCamera;
  public yaw = 0; // radians around Y
  public pitch = 0.28; // radians above horizon
  public shakeIntensity = 0;
  public mode: CameraMode = 'chase';
  private cockpitLookYaw = 0;
  private cockpitLookPitch = -0.03;
  private currentPos = new THREE.Vector3(-12, 5, 22);
  private currentLook = new THREE.Vector3(-12, 1.5, 14);
  private currentFov = 62;
  private transitionTimer = 0;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.15, 650);
    this.camera.position.copy(this.currentPos);
  }

  public addShake(amount: number): void {
    this.shakeIntensity = Math.min(0.9, this.shakeIntensity + amount);
  }

  public triggerVehicleTransition(entering: boolean): void {
    this.transitionTimer = 0.65;
    if (!entering && this.mode === 'cockpit') {
      this.mode = 'chase';
    }
    this.cockpitLookYaw = 0;
    this.cockpitLookPitch = -0.03;
  }

  public toggleMode(): CameraMode {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    this.cockpitLookYaw = 0;
    this.cockpitLookPitch = -0.05;
    this.transitionTimer = 0;
    return this.mode;
  }

  public applyLookDelta(dx: number, dy: number, sensitivity: number): void {
    if (this.mode === 'cockpit') {
      this.cockpitLookYaw = THREE.MathUtils.clamp(
        this.cockpitLookYaw - dx * 0.004 * sensitivity,
        -1.35,
        1.35,
      );
      this.cockpitLookPitch = THREE.MathUtils.clamp(
        this.cockpitLookPitch - dy * 0.003 * sensitivity,
        -0.35,
        0.42,
      );
      return;
    }
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
    colliders?: WorldBoxCollider[],
    steerInput = 0,
    cockpitOffset?: { x: number; y: number; z: number },
    bodyPitch = 0,
    bodyRoll = 0,
    isSprinting = false,
  ): void {
    if (this.transitionTimer > 0) {
      this.transitionTimer = Math.max(0, this.transitionTimer - dt);
    }

    if (inVehicle && this.mode === 'cockpit' && cockpitOffset) {
      const fwdX = Math.sin(targetHeading);
      const fwdZ = Math.cos(targetHeading);
      const rightX = Math.cos(targetHeading);
      const rightZ = -Math.sin(targetHeading);

      if (!isUserLooking) {
        this.cockpitLookYaw = THREE.MathUtils.damp(this.cockpitLookYaw, steerInput * 0.22, 5.5, dt);
        this.cockpitLookPitch = THREE.MathUtils.damp(this.cockpitLookPitch, -0.025, 5.5, dt);
      }

      const rollLift = -bodyRoll * cockpitOffset.x;
      const pitchLift = -bodyPitch * cockpitOffset.z;
      _cockpitPos.set(
        targetPos.x + rightX * cockpitOffset.x + fwdX * cockpitOffset.z,
        targetPos.y + cockpitOffset.y + rollLift + pitchLift,
        targetPos.z + rightZ * cockpitOffset.x + fwdZ * cockpitOffset.z,
      );

      const lookHeading = targetHeading + this.cockpitLookYaw;
      const lookFwdX = Math.sin(lookHeading);
      const lookFwdZ = Math.cos(lookHeading);
      _cockpitLook.set(
        _cockpitPos.x + lookFwdX * 16,
        _cockpitPos.y + (this.cockpitLookPitch - bodyPitch * 0.45) * 14,
        _cockpitPos.z + lookFwdZ * 16,
      );

      if (this.transitionTimer > 0.15) {
        this.currentPos.lerp(_cockpitPos, Math.min(1, 14 * dt));
        this.currentLook.lerp(_cockpitLook, Math.min(1, 16 * dt));
      } else {
        this.currentPos.copy(_cockpitPos);
        this.currentLook.copy(_cockpitLook);
      }

      const targetFov = 72 + Math.min(8, Math.abs(vehicleSpeed) * 0.2);
      this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 7, dt);
      if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();
      }

      this.camera.position.copy(this.currentPos);
      if (this.shakeIntensity > 0.005) {
        this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity * 0.55;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity * 0.55;
        this.shakeIntensity *= Math.exp(-10 * dt);
      } else {
        this.shakeIntensity = 0;
      }

      this.camera.lookAt(this.currentLook);
      this.yaw = targetHeading + Math.PI;
      return;
    }

    // Chase Camera: Gently auto-align behind vehicle heading + turn/drift anticipation
    if (inVehicle && !isUserLooking && (Math.abs(vehicleSpeed) > 1.8 || Math.abs(steerInput) > 0.1)) {
      const driftFollowOffset = THREE.MathUtils.clamp(slipAngle * 0.45 - steerInput * 0.16, -0.4, 0.4);
      const reverseFlip = vehicleSpeed < -2.5 ? Math.PI : 0;
      const targetYaw = targetHeading + Math.PI + reverseFlip - driftFollowOffset;
      let diff = targetYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, (2.9 + Math.abs(steerInput) * 1.4) * dt);
    }

    const dist = inVehicle ? 7.8 + Math.min(2.6, Math.abs(vehicleSpeed) * 0.058) : 5.4;
    const heightOffset = inVehicle ? 2.05 : 1.7;

    const horizDist = Math.cos(this.pitch) * dist;
    const vertDist = Math.sin(this.pitch) * dist;

    _lookTarget.set(targetPos.x, targetPos.y + (inVehicle ? 1.25 : 1.45), targetPos.z);

    _desiredPos.set(
      targetPos.x + Math.sin(this.yaw) * horizDist,
      Math.max(0.75, targetPos.y + heightOffset + vertDist),
      targetPos.z + Math.cos(this.yaw) * horizDist,
    );

    // Collider occlusion prevention so camera never clips inside buildings/walls
    if (colliders && colliders.length > 0) {
      const frac = raycastCollidersFraction(
        _lookTarget.x,
        _lookTarget.y,
        _lookTarget.z,
        _desiredPos.x,
        _desiredPos.y,
        _desiredPos.z,
        colliders,
        0.55,
      );
      if (frac < 0.995) {
        _desiredPos.lerpVectors(_lookTarget, _desiredPos, frac);
        _desiredPos.y = Math.max(0.85, _desiredPos.y);
      }
    }

    // Smooth exponential damping (softened slightly during enter/exit transition)
    const transitionScale = this.transitionTimer > 0 ? 0.65 : 1.0;
    const posLambda = (inVehicle ? 11.5 : 14) * transitionScale;
    this.currentPos.x = THREE.MathUtils.damp(this.currentPos.x, _desiredPos.x, posLambda, dt);
    this.currentPos.y = THREE.MathUtils.damp(this.currentPos.y, _desiredPos.y, posLambda, dt);
    this.currentPos.z = THREE.MathUtils.damp(this.currentPos.z, _desiredPos.z, posLambda, dt);

    this.currentLook.x = THREE.MathUtils.damp(this.currentLook.x, _lookTarget.x, 16 * transitionScale, dt);
    this.currentLook.y = THREE.MathUtils.damp(this.currentLook.y, _lookTarget.y, 16 * transitionScale, dt);
    this.currentLook.z = THREE.MathUtils.damp(this.currentLook.z, _lookTarget.z, 16 * transitionScale, dt);

    // Dynamic FOV widening at high driving speed or on-foot sprint
    const targetFov = inVehicle
      ? 62 + Math.min(14, Math.abs(vehicleSpeed) * 0.34)
      : isSprinting
        ? 64.5
        : 60;
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
