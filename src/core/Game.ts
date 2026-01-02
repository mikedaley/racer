import { Track } from "./Track";
import { WebGLRenderer } from "./WebGLRenderer";
import { Input } from "./Input";
import { Minimap } from "./Minimap";
import { Player } from "../types/game";
import { TrackData } from "../data/TrackData";

interface PhysicsSettings {
  centrifugalForce: number;
  steeringRate: number;
  steeringSpeedScale: number;
  maxSpeed: number;
  accel: number;
  offRoadMaxSpeed: number;
  fogDensity: number;
}

const PHYSICS_STORAGE_KEY = "race_physics_settings";

function savePhysicsSettings(settings: PhysicsSettings): void {
  localStorage.setItem(PHYSICS_STORAGE_KEY, JSON.stringify(settings));
}

function loadPhysicsSettings(): PhysicsSettings | null {
  const saved = localStorage.getItem(PHYSICS_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }
  return null;
}

export class Game {
  private track: Track;
  private renderer: WebGLRenderer;
  private input: Input;
  private minimap: Minimap;
  private onExit: (() => void) | null = null;

  private position = 0;
  private player: Player = {
    x: 0,
    speed: 0,
    maxSpeed: 600,
    accel: 2,
    decel: 0.5,
    offRoadDecel: 1,
    offRoadMaxSpeed: 200,
  };

  private playerY = 0;
  private playerVelocityY = 0;
  private gravity = 5000;

  private lastTime = 0;
  private running = false;

  // Tunable physics parameters
  private centrifugalForce = 3.0;
  private steeringRate = 3.0;
  private steeringSpeedScale = 0.5;

  constructor(
    canvas: HTMLCanvasElement,
    trackData?: TrackData,
    onExit?: () => void,
  ) {
    this.track = new Track(trackData);
    this.renderer = new WebGLRenderer(canvas);
    this.input = new Input();
    this.minimap = new Minimap();
    this.onExit = onExit || null;

    // Load saved physics settings
    this.loadSettings();

    // Listen for Escape key to return to editor
    this.handleKeyDown = this.handleKeyDown.bind(this);
    window.addEventListener("keydown", this.handleKeyDown);

    // Setup debug panel
    this.setupDebugPanel();
  }

  private loadSettings(): void {
    const saved = loadPhysicsSettings();
    if (saved) {
      this.centrifugalForce = saved.centrifugalForce;
      this.steeringRate = saved.steeringRate;
      this.steeringSpeedScale = saved.steeringSpeedScale;
      this.player.maxSpeed = saved.maxSpeed;
      this.player.accel = saved.accel;
      this.player.offRoadMaxSpeed = saved.offRoadMaxSpeed;
      this.renderer.fogDensity = saved.fogDensity;
    }
  }

  private saveSettings(): void {
    savePhysicsSettings({
      centrifugalForce: this.centrifugalForce,
      steeringRate: this.steeringRate,
      steeringSpeedScale: this.steeringSpeedScale,
      maxSpeed: this.player.maxSpeed,
      accel: this.player.accel,
      offRoadMaxSpeed: this.player.offRoadMaxSpeed,
      fogDensity: this.renderer.fogDensity,
    });
  }

  private setupDebugPanel(): void {
    // Toggle panel
    document.getElementById("debug-toggle")?.addEventListener("click", () => {
      const content = document.querySelector(".debug-content");
      content?.classList.toggle("collapsed");
    });

    // Centrifugal force
    const centrifugalSlider = document.getElementById(
      "param-centrifugal",
    ) as HTMLInputElement;
    if (centrifugalSlider) {
      centrifugalSlider.value = (this.centrifugalForce * 10).toString();
      document.getElementById("val-centrifugal")!.textContent =
        this.centrifugalForce.toFixed(1);
      centrifugalSlider.addEventListener("input", () => {
        this.centrifugalForce = parseInt(centrifugalSlider.value) / 10;
        document.getElementById("val-centrifugal")!.textContent =
          this.centrifugalForce.toFixed(1);
        this.saveSettings();
      });
    }

    // Steering rate
    const steeringSlider = document.getElementById(
      "param-steering",
    ) as HTMLInputElement;
    if (steeringSlider) {
      steeringSlider.value = (this.steeringRate * 10).toString();
      document.getElementById("val-steering")!.textContent =
        this.steeringRate.toFixed(1);
      steeringSlider.addEventListener("input", () => {
        this.steeringRate = parseInt(steeringSlider.value) / 10;
        document.getElementById("val-steering")!.textContent =
          this.steeringRate.toFixed(1);
        this.saveSettings();
      });
    }

    // Steering speed scale
    const steerSpeedSlider = document.getElementById(
      "param-steer-speed",
    ) as HTMLInputElement;
    if (steerSpeedSlider) {
      steerSpeedSlider.value = (this.steeringSpeedScale * 100).toString();
      document.getElementById("val-steer-speed")!.textContent =
        this.steeringSpeedScale.toFixed(2);
      steerSpeedSlider.addEventListener("input", () => {
        this.steeringSpeedScale = parseInt(steerSpeedSlider.value) / 100;
        document.getElementById("val-steer-speed")!.textContent =
          this.steeringSpeedScale.toFixed(2);
        this.saveSettings();
      });
    }

    // Max speed
    const maxSpeedSlider = document.getElementById(
      "param-maxspeed",
    ) as HTMLInputElement;
    if (maxSpeedSlider) {
      maxSpeedSlider.value = this.player.maxSpeed.toString();
      document.getElementById("val-maxspeed")!.textContent =
        this.player.maxSpeed.toString();
      maxSpeedSlider.addEventListener("input", () => {
        this.player.maxSpeed = parseInt(maxSpeedSlider.value);
        document.getElementById("val-maxspeed")!.textContent =
          this.player.maxSpeed.toString();
        this.saveSettings();
      });
    }

    // Acceleration
    const accelSlider = document.getElementById(
      "param-accel",
    ) as HTMLInputElement;
    if (accelSlider) {
      accelSlider.value = (this.player.accel * 10).toString();
      document.getElementById("val-accel")!.textContent =
        this.player.accel.toFixed(1);
      accelSlider.addEventListener("input", () => {
        this.player.accel = parseInt(accelSlider.value) / 10;
        document.getElementById("val-accel")!.textContent =
          this.player.accel.toFixed(1);
        this.saveSettings();
      });
    }

    // Off-road max speed
    const offroadSlider = document.getElementById(
      "param-offroad",
    ) as HTMLInputElement;
    if (offroadSlider) {
      offroadSlider.value = this.player.offRoadMaxSpeed.toString();
      document.getElementById("val-offroad")!.textContent =
        this.player.offRoadMaxSpeed.toString();
      offroadSlider.addEventListener("input", () => {
        this.player.offRoadMaxSpeed = parseInt(offroadSlider.value);
        document.getElementById("val-offroad")!.textContent =
          this.player.offRoadMaxSpeed.toString();
        this.saveSettings();
      });
    }

    // Fog density
    const fogSlider = document.getElementById("param-fog") as HTMLInputElement;
    if (fogSlider) {
      fogSlider.value = this.renderer.fogDensity.toString();
      document.getElementById("val-fog")!.textContent =
        this.renderer.fogDensity.toString();
      fogSlider.addEventListener("input", () => {
        this.renderer.fogDensity = parseInt(fogSlider.value);
        document.getElementById("val-fog")!.textContent = fogSlider.value;
        this.saveSettings();
      });
    }

    // Random track button
    const randomTrackBtn = document.getElementById("random-track-btn");
    if (randomTrackBtn) {
      randomTrackBtn.addEventListener("click", () => {
        this.generateRandomTrack();
      });
    }
  }

  /**
   * Generate a new random track and reset player position
   */
  private generateRandomTrack(): void {
    this.track.buildRandomTrack();
    this.position = 0;
    this.player.x = 0;
    this.player.speed = 0;
    this.playerY = 0;
  }

  /**
   * Get current track data for export to editor
   */
  getTrackData(): TrackData {
    return this.track.getTrackData();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape" && this.onExit) {
      this.stop();
      window.removeEventListener("keydown", this.handleKeyDown);
      this.onExit();
    }
  }

  start(): void {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  stop(): void {
    this.running = false;
  }

  private loop(currentTime: number): void {
    if (!this.running) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  private update(dt: number): void {
    const speedPercent = this.player.speed / this.player.maxSpeed;

    // Steering - only works when moving, more responsive at low speeds, reduced at high speeds
    // At speed=0: no steering
    // At speed=max: steerRate = steeringRate * (1 - steeringSpeedScale)
    const steerRate =
      dt *
      this.steeringRate *
      speedPercent *
      (1 - speedPercent * this.steeringSpeedScale);

    const isTurning = this.input.state.left || this.input.state.right;

    if (this.player.speed > 0) {
      if (this.input.state.left) {
        this.player.x -= steerRate;
      }
      if (this.input.state.right) {
        this.player.x += steerRate;
      }
    }

    const offRoadAmount = Math.max(0, Math.abs(this.player.x) - 1.0);
    const isOffRoad = offRoadAmount > 0;

    // Gradual slowdown based on how far off road
    const offRoadFactor = Math.min(offRoadAmount, 1.0); // 0 to 1
    const maxSpeed = isOffRoad
      ? this.player.maxSpeed -
        (this.player.maxSpeed - this.player.offRoadMaxSpeed) * offRoadFactor
      : this.player.maxSpeed;

    if (this.input.state.up) {
      const accelReduction = isOffRoad ? 1 - offRoadFactor * 0.7 : 1;
      this.player.speed += this.player.accel * dt * 100 * accelReduction;
    } else if (this.input.state.down) {
      this.player.speed -= this.player.accel * dt * 100 * 2;
    } else {
      this.player.speed -= this.player.decel * dt * 100;
    }

    // Speed bleeds off faster when turning
    if (isTurning) {
      this.player.speed -= this.player.decel * dt * 100 * speedPercent;
    }

    if (isOffRoad && this.player.speed > maxSpeed) {
      this.player.speed -= this.player.offRoadDecel * dt * 100 * offRoadFactor;
    }

    this.player.speed = Math.max(0, Math.min(this.player.speed, maxSpeed));

    // Apply centrifugal force from curves
    // This pushes the car to the outside of curves - player must steer against it
    // Interpolate curve value between current and next segment for smooth transitions
    const segment = this.track.getSegment(this.position);
    const nextSegment = this.track.getSegment(
      this.position + this.track.segmentLength,
    );
    const segmentPercent =
      (this.position % this.track.segmentLength) / this.track.segmentLength;
    const rawCurveValue =
      segment.curve + (nextSegment.curve - segment.curve) * segmentPercent;
    // Clamp curve influence to prevent extreme forces on tight corners
    const curveValue =
      Math.sign(rawCurveValue) * Math.min(Math.abs(rawCurveValue), 5);
    const centrifugal =
      curveValue * speedPercent * speedPercent * dt * this.centrifugalForce;
    this.player.x -= centrifugal;

    // Clamp player position to track bounds
    this.player.x = Math.max(-2, Math.min(2, this.player.x));

    this.position += (this.player.speed * dt * this.track.segmentLength) / 10;

    // Calculate road Y at player position (slightly ahead of camera)
    // This matches the reference: playerSegment = findSegment(position + playerZ)
    const playerZ = this.renderer.cameraHeight * this.renderer.cameraDepth;
    const playerSegment = this.track.getSegment(this.position + playerZ);
    const playerPercent =
      ((this.position + playerZ) % this.track.segmentLength) /
      this.track.segmentLength;
    const roadY =
      playerSegment.p1.world.y +
      (playerSegment.p2.world.y - playerSegment.p1.world.y) * playerPercent;

    // Car follows the road surface
    this.playerY = roadY;

    while (this.position >= this.track.trackLength) {
      this.position -= this.track.trackLength;
    }
    while (this.position < 0) {
      this.position += this.track.trackLength;
    }
  }

  private render(): void {
    // Determine steering direction for car sprite
    let steerDirection = 0;
    if (this.input.state.left) steerDirection = -1;
    if (this.input.state.right) steerDirection = 1;

    this.renderer.render(
      this.track,
      this.position,
      this.player.x,
      this.playerY,
      steerDirection,
    );
    this.renderHUD();
  }

  private renderHUD(): void {
    const ctx = this.renderer["displayCtx"] as CanvasRenderingContext2D;
    const canvas = ctx.canvas;

    // Speed display
    ctx.fillStyle = "#ffffff";
    ctx.font = "40px monospace";
    const speedMph = Math.round(
      (this.player.speed / this.player.maxSpeed) * 120,
    );
    ctx.fillText(`${speedMph} MPH`, 20, 50);

    // Minimap (left side, below speed)
    const minimapCanvas = this.minimap.render(
      this.track,
      this.position,
      this.player.x,
    );
    ctx.drawImage(minimapCanvas, 20, 70);
  }
}
