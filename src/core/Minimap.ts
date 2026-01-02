/**
 * Minimap Renderer
 * Displays a top-down view of the track with player position
 * Track sections fade based on distance from player
 */

import { Track } from "./Track";

interface MinimapConfig {
  width: number;
  height: number;
  padding: number;
  segmentsVisible: number;
  fadeDistance: number;
  trackColor: string;
  playerColor: string;
  backgroundColor: string;
}

const DEFAULT_CONFIG: MinimapConfig = {
  width: 150,
  height: 200,
  padding: 10,
  segmentsVisible: 100,
  fadeDistance: 40,
  trackColor: "#ffffff",
  playerColor: "#ff0000",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
};

export class Minimap {
  private config: MinimapConfig;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

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
    const { width, height, padding, segmentsVisible, fadeDistance } =
      this.config;
    const ctx = this.ctx;

    // Clear with background
    ctx.fillStyle = this.config.backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const segments = track.segments;
    const segmentLength = track.segmentLength;
    const trackLength = track.trackLength;

    // Calculate current segment index
    const currentSegmentIndex =
      Math.floor(playerPosition / segmentLength) % segments.length;

    // Calculate visible range (half behind, half ahead)
    const halfVisible = Math.floor(segmentsVisible / 2);
    const startOffset = -halfVisible;
    const endOffset = halfVisible;

    // Build path points from track segments
    const points = this.calculateTrackPoints(
      segments,
      currentSegmentIndex,
      startOffset,
      endOffset,
      segmentLength,
    );

    // Find bounds for scaling
    const bounds = this.calculateBounds(points);

    // Calculate scale to fit within padded area
    const drawWidth = width - padding * 2;
    const drawHeight = height - padding * 2;
    const scaleX = bounds.width > 0 ? drawWidth / bounds.width : 1;
    const scaleY = bounds.height > 0 ? drawHeight / bounds.height : 1;
    const scale = Math.min(scaleX, scaleY);

    // Center offset
    const offsetX =
      padding + (drawWidth - bounds.width * scale) / 2 - bounds.minX * scale;
    const offsetY =
      padding + (drawHeight - bounds.height * scale) / 2 - bounds.minY * scale;

    // Render track segments with fade
    this.renderTrackPath(points, scale, offsetX, offsetY, fadeDistance);

    // Find and render player position
    const playerPoint = this.findPlayerPoint(points, halfVisible);
    if (playerPoint) {
      this.renderPlayer(playerPoint, playerX, scale, offsetX, offsetY);
    }

    return this.canvas;
  }

  /**
   * Calculate track points from segments around the player
   */
  private calculateTrackPoints(
    segments: Track["segments"],
    currentIndex: number,
    startOffset: number,
    endOffset: number,
    segmentLength: number,
  ): { x: number; y: number; distanceFromPlayer: number }[] {
    const points: { x: number; y: number; distanceFromPlayer: number }[] = [];
    const totalSegments = segments.length;

    let x = 0;
    let y = 0;
    let direction = 0;

    for (let offset = startOffset; offset <= endOffset; offset++) {
      let segmentIndex = currentIndex + offset;

      // Wrap around track
      while (segmentIndex < 0) segmentIndex += totalSegments;
      while (segmentIndex >= totalSegments) segmentIndex -= totalSegments;

      const segment = segments[segmentIndex];
      const curve = segment.curve;

      // Update direction based on curve (scaled to match actual track feel)
      direction += curve * 0.003;

      // Move forward in current direction
      const step = 2;
      x += Math.sin(direction) * step;
      y -= Math.cos(direction) * step;

      points.push({
        x,
        y,
        distanceFromPlayer: Math.abs(offset),
      });
    }

    return points;
  }

  /**
   * Calculate bounding box of all points
   */
  private calculateBounds(points: { x: number; y: number }[]): {
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

    // Add small margin to prevent edge clipping
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
   * Render the track path with distance-based fading
   */
  private renderTrackPath(
    points: { x: number; y: number; distanceFromPlayer: number }[],
    scale: number,
    offsetX: number,
    offsetY: number,
    fadeDistance: number,
  ): void {
    const ctx = this.ctx;

    if (points.length < 2) return;

    // Draw segments individually for per-segment alpha
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];

      // Calculate fade based on distance from player
      const distance = Math.min(p1.distanceFromPlayer, p2.distanceFromPlayer);
      const alpha = this.calculateFade(distance, fadeDistance);

      if (alpha <= 0.05) continue;

      const x1 = p1.x * scale + offsetX;
      const y1 = p1.y * scale + offsetY;
      const x2 = p2.x * scale + offsetX;
      const y2 = p2.y * scale + offsetY;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = this.colorWithAlpha(this.config.trackColor, alpha);
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.stroke();
    }
  }

  /**
   * Calculate fade alpha based on distance
   */
  private calculateFade(distance: number, fadeDistance: number): number {
    if (distance <= fadeDistance * 0.5) {
      return 1.0;
    }
    if (distance >= fadeDistance) {
      return 0.0;
    }
    // Smooth fade in the outer half
    const fadeStart = fadeDistance * 0.5;
    const fadeRange = fadeDistance - fadeStart;
    return 1.0 - (distance - fadeStart) / fadeRange;
  }

  /**
   * Convert hex color to rgba with alpha
   */
  private colorWithAlpha(color: string, alpha: number): string {
    // Handle hex colors
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }

  /**
   * Find the player's position point in the calculated path
   */
  private findPlayerPoint(
    points: { x: number; y: number; distanceFromPlayer: number }[],
    halfVisible: number,
  ): { x: number; y: number } | null {
    // Player is at the center of the visible range
    const playerIndex = halfVisible;
    if (playerIndex >= 0 && playerIndex < points.length) {
      return points[playerIndex];
    }
    return null;
  }

  /**
   * Render the player marker
   */
  private renderPlayer(
    point: { x: number; y: number },
    playerX: number,
    scale: number,
    offsetX: number,
    offsetY: number,
  ): void {
    const ctx = this.ctx;

    const x = point.x * scale + offsetX;
    const y = point.y * scale + offsetY;

    // Draw player dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = this.config.playerColor;
    ctx.fill();

    // Draw outline for visibility
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
