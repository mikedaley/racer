/**
 * Minimap Renderer
 * Displays a top-down view of the entire track with player position
 */

import { Track } from "./Track";

interface MinimapConfig {
  width: number;
  height: number;
  padding: number;
  trackColor: string;
  trackAlpha: number;
  playerColor: string;
}

const DEFAULT_CONFIG: MinimapConfig = {
  width: 150,
  height: 350,
  padding: 10,
  trackColor: "#ffffff",
  trackAlpha: 0.6,
  playerColor: "#ff0000",
};

interface TrackPoint {
  x: number;
  y: number;
}

export class Minimap {
  private config: MinimapConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Cached track data
  private cachedTrackLength = 0;
  private trackPoints: TrackPoint[] = [];
  private bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  } | null = null;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;

  constructor(config: Partial<MinimapConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.config.width;
    this.canvas.height = this.config.height;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context for minimap");
    }
    this.ctx = ctx;
  }

  /**
   * Render the minimap and return the canvas for compositing
   */
  render(
    track: Track,
    playerPosition: number,
    playerX: number,
  ): HTMLCanvasElement {
    const { width, height, padding } = this.config;
    const ctx = this.ctx;

    // Rebuild track points if track changed (check trackLength as track object is reused)
    if (
      track.trackLength !== this.cachedTrackLength ||
      this.trackPoints.length !== track.segments.length
    ) {
      this.buildTrackPoints(track);
      this.cachedTrackLength = track.trackLength;
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Render the entire track
    this.renderTrack();

    // Calculate player segment index and render player
    const segmentLength = track.segmentLength;
    const playerSegmentIndex =
      Math.floor(playerPosition / segmentLength) % track.segments.length;
    const segmentProgress = (playerPosition % segmentLength) / segmentLength;

    this.renderPlayer(playerSegmentIndex, segmentProgress);

    return this.canvas;
  }

  /**
   * Build track points from all segments (called once per track)
   */
  private buildTrackPoints(track: Track): void {
    const segments = track.segments;
    this.trackPoints = [];

    let x = 0;
    let y = 0;
    let direction = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const curve = segment.curve;

      // Update direction based on curve
      direction += curve * 0.008;

      // Move forward in current direction
      const step = 2;
      x += Math.sin(direction) * step;
      y -= Math.cos(direction) * step;

      this.trackPoints.push({ x, y });
    }

    // Calculate bounds
    this.bounds = this.calculateBounds(this.trackPoints);

    // Calculate scale and offsets to fit track in minimap
    const { width, height, padding } = this.config;
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;
    const scaleX = this.bounds.width > 0 ? drawWidth / this.bounds.width : 1;
    const scaleY = this.bounds.height > 0 ? drawHeight / this.bounds.height : 1;
    this.scale = Math.min(scaleX, scaleY);

    // Center the track
    this.offsetX =
      padding +
      (drawWidth - this.bounds.width * this.scale) / 2 -
      this.bounds.minX * this.scale;
    this.offsetY =
      padding +
      (drawHeight - this.bounds.height * this.scale) / 2 -
      this.bounds.minY * this.scale;
  }

  /**
   * Calculate bounding box of all points
   */
  private calculateBounds(points: TrackPoint[]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
  } {
    if (points.length === 0) {
      return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
    }

    let minX = points[0].x;
    let maxX = points[0].x;
    let minY = points[0].y;
    let maxY = points[0].y;

    for (const point of points) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    const margin = 5;
    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Render the entire track path
   */
  private renderTrack(): void {
    const ctx = this.ctx;
    const points = this.trackPoints;

    if (points.length < 2) return;

    ctx.beginPath();
    const firstPoint = points[0];
    ctx.moveTo(
      firstPoint.x * this.scale + this.offsetX,
      firstPoint.y * this.scale + this.offsetY,
    );

    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      ctx.lineTo(
        p.x * this.scale + this.offsetX,
        p.y * this.scale + this.offsetY,
      );
    }

    ctx.strokeStyle = this.colorWithAlpha(
      this.config.trackColor,
      this.config.trackAlpha,
    );
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  /**
   * Render the player marker at current position
   */
  private renderPlayer(segmentIndex: number, progress: number): void {
    const ctx = this.ctx;
    const points = this.trackPoints;

    if (points.length === 0) return;

    // Get current and next point for interpolation
    const currentPoint = points[segmentIndex];
    const nextIndex = (segmentIndex + 1) % points.length;
    const nextPoint = points[nextIndex];

    // Interpolate position
    const x = currentPoint.x + (nextPoint.x - currentPoint.x) * progress;
    const y = currentPoint.y + (nextPoint.y - currentPoint.y) * progress;

    const screenX = x * this.scale + this.offsetX;
    const screenY = y * this.scale + this.offsetY;

    // Draw player dot
    ctx.beginPath();
    ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
    ctx.fillStyle = this.config.playerColor;
    ctx.fill();

    // Draw outline for visibility
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /**
   * Convert hex color to rgba with alpha
   */
  private colorWithAlpha(color: string, alpha: number): string {
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }
}
