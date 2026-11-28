export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private hornOscA: OscillatorNode | null = null;
  private hornOscB: OscillatorNode | null = null;
  private hornGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private skidGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private footstepTimer = 0;

  public muted = false;
  public musicEnabled = true;

  public init(): void {
    if (typeof window === 'undefined') return;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.45;
    this.masterGain.connect(this.ctx.destination);

    // Prebuild white noise buffer for tire skid, crashes, gunshots, and gear shifts
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * 1.5, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;

    // Dual-oscillator engine synth with RPM-reactive lowpass filter
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;

    this.engineSubOsc = this.ctx.createOscillator();
    this.engineSubOsc.type = 'triangle';
    this.engineSubOsc.frequency.value = 28;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 260;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc.connect(this.engineFilter);
    this.engineSubOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOsc.start();
    this.engineSubOsc.start();

    // Persistent clean dual-tone vehicle horn (prevents per-frame oscillator spam)
    this.hornOscA = this.ctx.createOscillator();
    this.hornOscB = this.ctx.createOscillator();
    this.hornOscA.type = 'sawtooth';
    this.hornOscB.type = 'sawtooth';
    this.hornOscA.frequency.value = 340;
    this.hornOscB.frequency.value = 425;
    this.hornGain = this.ctx.createGain();
    this.hornGain.gain.value = 0;
    this.hornOscA.connect(this.hornGain);
    this.hornOscB.connect(this.hornGain);
    this.hornGain.connect(this.masterGain);
    this.hornOscA.start();
    this.hornOscB.start();

    // Police siren oscillator
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);
    this.sirenOsc.start();

    // Tire skid loop
    if (this.noiseBuffer) {
      const skidSource = this.ctx.createBufferSource();
      skidSource.buffer = this.noiseBuffer;
      skidSource.loop = true;
      const skidFilter = this.ctx.createBiquadFilter();
      skidFilter.type = 'bandpass';
      skidFilter.frequency.value = 1450;
      skidFilter.Q.value = 3.2;
      this.skidGain = this.ctx.createGain();
      this.skidGain.gain.value = 0;
      skidSource.connect(skidFilter);
      skidFilter.connect(this.skidGain);
      this.skidGain.connect(this.masterGain);
      skidSource.start();
    }

    this.startMusicLoop();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, this.ctx.currentTime, 0.04);
    }
  }

  public setMusicEnabled(enabled: boolean): void {
    this.musicEnabled = enabled;
  }

  public setHornActive(active: boolean): void {
    if (active) this.init();
    if (!this.ctx || !this.hornGain) return;
    const target = active && !this.muted ? 0.075 : 0;
    this.hornGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.025);
  }

  public updateContinuous(
    dt: number,
    inVehicle: boolean,
    speedNorm: number,
    isDrifting: boolean,
    sirenIntensity: number,
    isWalking: boolean,
    isSprinting: boolean,
    elapsed: number,
    engineRpm?: number,
    isHardBraking = false,
  ): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    if (this.engineOsc && this.engineSubOsc && this.engineFilter && this.engineGain) {
      if (inVehicle) {
        const rpmNorm = engineRpm !== undefined ? engineRpm : speedNorm;
        const targetFreq = 44 + rpmNorm * 134;
        this.engineOsc.frequency.setTargetAtTime(targetFreq, now, 0.04);
        this.engineSubOsc.frequency.setTargetAtTime(targetFreq * 0.5, now, 0.04);
        this.engineFilter.frequency.setTargetAtTime(200 + rpmNorm * 680, now, 0.05);
        this.engineGain.gain.setTargetAtTime(0.065 + rpmNorm * 0.085, now, 0.06);
      } else {
        this.engineGain.gain.setTargetAtTime(0, now, 0.08);
        if (this.hornGain) {
          this.hornGain.gain.setTargetAtTime(0, now, 0.03);
        }
      }
    }

    if (this.skidGain) {
      const targetSkid = inVehicle && (isDrifting || isHardBraking) && speedNorm > 0.14 ? 0.085 : 0;
      this.skidGain.gain.setTargetAtTime(targetSkid, now, 0.04);
    }

    if (this.sirenOsc && this.sirenGain) {
      if (sirenIntensity > 0.01) {
        const wail = Math.sin(elapsed * 5.2) * 230 + 780;
        this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
        this.sirenGain.gain.setTargetAtTime(0.055 * sirenIntensity, now, 0.08);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }

    // Footsteps when moving on foot
    if (!inVehicle && isWalking) {
      this.footstepTimer -= dt;
      if (this.footstepTimer <= 0) {
        this.playFootstep();
        this.footstepTimer = isSprinting ? 0.28 : 0.44;
      }
    } else {
      this.footstepTimer = 0.05;
    }
  }

  public playGearShift(): void {
    if (!this.ctx || !this.masterGain || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.085);
  }

  public playFootstep(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110 + Math.random() * 25, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.06);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playHorn(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    [340, 425].forEach((freq) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  public playCollision(intensity = 0.6): void {
    if (!this.ctx || !this.masterGain || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const clamped = Math.min(1, Math.max(0.15, intensity));

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450 + clamped * 400, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.24 * clamped, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.3);
  }

  public playPunch(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.11);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playGunshot(): void {
    this.init();
    if (!this.ctx || !this.masterGain || this.muted || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(600, now);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.18);
  }

  public playDoorChime(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.08);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playMissionSuccess(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.14, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.26);
    });
  }

  private startMusicLoop(): void {
    if (this.musicTimer !== null) return;
    const bassNotes = [55, 55, 65.41, 73.42, 55, 55, 82.41, 65.41];
    this.musicTimer = window.setInterval(() => {
      if (!this.ctx || !this.masterGain || this.muted || !this.musicEnabled) return;
      if (this.ctx.state !== 'running') return;
      const now = this.ctx.currentTime;
      const note = bassNotes[this.musicStep % bassNotes.length];
      this.musicStep++;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.28);
    }, 320);
  }

  public dispose(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
