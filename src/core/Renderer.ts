/**
 * Game Renderer
 * Handles pseudo-3D road rendering with perspective projection
 */

import { Track } from "./Track";
import { Segment, SpriteType } from "../types/game";

// Import centralized config
import { RENDER, CAMERA, ROAD, FOG, PLAYER } from "../config/constants";
import {
  RGB,
  SEGMENT_COLORS,
  FOG_COLOR,
  SKY_GRADIENT,
  rgbToString,
  blendColors,
} from "../config/colors";

// Import sprite registry for scale values
import { SPRITE_REGISTRY } from "../sprites/SpriteRegistry";

// Import sprite sheet data
import {
  SPRITESHEET_PATH,
  SPRITESHEET_FRAMES,
} from "../sprites/spritesheet-data";

// =============================================================================
// RENDERER CLASS
// =============================================================================

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Sprite sheet (single image containing all sprites including player car)
  private spriteSheet: HTMLImageElement | null = null;
  private spriteSheetLoaded = false;

  private playerSegmentData: { segment: Segment; percent: number } | null =
    null;

  // Retro rendering - render at low res then scale up
  private retroCanvas: HTMLCanvasElement;
  private retroCtx: CanvasRenderingContext2D;
  private retroWidth = RENDER.RETRO_WIDTH;
  private retroHeight = RENDER.RETRO_HEIGHT;

  // Pre-allocated segment data array (reused each frame)
  private segmentDataPool: { segment: Segment | null; clip: number }[] = [];

  // Public properties using config constants
  width = RENDER.RETRO_WIDTH;
  height = RENDER.RETRO_HEIGHT;
  roadWidth = CAMERA.ROAD_WIDTH;
  cameraHeight = CAMERA.HEIGHT;
  cameraDepth = CAMERA.DEPTH;
  drawDistance = RENDER.DRAW_DISTANCE;

  // Fog settings
  fogDensity = FOG.DEFAULT_DENSITY;

  constructor(canvas: HTMLCanvasElement, autoResize: boolean = true) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;

    // Create offscreen canvas for retro rendering
    this.retroCanvas = document.createElement("canvas");
    this.retroCanvas.width = this.retroWidth;
    this.retroCanvas.height = this.retroHeight;
    this.retroCtx = this.retroCanvas.getContext("2d")!;

    // Disable image smoothing for pixelated look
    this.ctx.imageSmoothingEnabled = false;
    this.retroCtx.imageSmoothingEnabled = false;

    // Pre-allocate segment data pool
    this.segmentDataPool = new Array(this.drawDistance)
      .fill(null)
      .map(() => ({ segment: null, clip: 0 }));

    if (autoResize) {
      this.resize();
      window.addEventListener("resize", () => this.resize());
    } else {
      this.canvas.width = canvas.width;
      this.canvas.height = canvas.height;
    }

    this.loadSprites();
  }

  // ---------------------------------------------------------------------------
  // SPRITE LOADING
  // ---------------------------------------------------------------------------

  private loadSprites(): void {
    // Load combined sprite sheet (single image for all sprites including player car)
    this.spriteSheet = new Image();
    this.spriteSheet.onload = () => {
      this.spriteSheetLoaded = true;
      console.log("Sprite sheet loaded");
    };
    this.spriteSheet.onerror = () => {
      console.warn("Failed to load sprite sheet");
    };
    this.spriteSheet.src = SPRITESHEET_PATH;
  }

  // ---------------------------------------------------------------------------
  // RESIZE
  // ---------------------------------------------------------------------------

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.retroWidth;
    this.height = this.retroHeight;
    this.ctx.imageSmoothingEnabled = false;
  }

  // ---------------------------------------------------------------------------
  // SKY RENDERING
  // ---------------------------------------------------------------------------

  private renderSunsetSky(ctx: CanvasRenderingContext2D): void {
    const skyHeight = this.height;
    const bandHeight = Math.ceil(skyHeight / SKY_GRADIENT.length);

    for (let i = 0; i < SKY_GRADIENT.length; i++) {
      ctx.fillStyle = rgbToString(SKY_GRADIENT[i]);
      const y = i * bandHeight;
      const h = bandHeight + 1; // +1 to avoid gaps
      ctx.fillRect(0, y, this.width, h);
    }
  }

  // ---------------------------------------------------------------------------
  // FOG CALCULATIONS (Optimized - no hex parsing)
  // ---------------------------------------------------------------------------

  private getFogAmount(z: number): number {
    if (this.fogDensity === 0) return 0;
    const fogStart = FOG.START_DISTANCE;
    const fogEnd =
      this.drawDistance * (FOG.END_DISTANCE_MULTIPLIER - this.fogDensity / 10);
    if (z <= fogStart) return 0;
    if (z >= fogEnd) return 1;
    return (z - fogStart) / (fogEnd - fogStart);
  }

  /**
   * Apply fog to an RGB color and return CSS string
   * Optimized: no hex parsing, direct RGB blending
   */
  private applyFogToRGB(color: RGB, fogAmount: number): string {
    if (fogAmount <= 0) {
      return rgbToString(color);
    }
    const blended = blendColors(color, FOG_COLOR, fogAmount);
    return rgbToString(blended);
  }

  // ---------------------------------------------------------------------------
  // MAIN RENDER
  // ---------------------------------------------------------------------------

  render(
    track: Track,
    position: number,
    playerX: number,
    playerY?: number,
    steerDirection: number = 0,
  ): void {
    const ctx = this.retroCtx;

    const baseSegment = track.getSegment(position);
    const basePercent = (position % track.segmentLength) / track.segmentLength;

    const playerZ = this.cameraHeight * this.cameraDepth;
    const playerSegment = track.getSegment(position + playerZ);
    const playerPercent =
      ((position + playerZ) % track.segmentLength) / track.segmentLength;

    const camPlayerY =
      playerY !== undefined
        ? playerY
        : baseSegment.p1.world.y +
          (baseSegment.p2.world.y - baseSegment.p1.world.y) * basePercent;

    // Draw sunset gradient sky
    this.renderSunsetSky(ctx);

    this.playerSegmentData = {
      segment: playerSegment,
      percent: playerPercent,
    };

    let maxy = this.height;
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);

    // Reuse pre-allocated segment data array
    let segmentCount = 0;

    // First pass: project and render road segments (front to back)
    for (let n = 0; n < this.drawDistance; n++) {
      const segmentIndex = (baseSegment.index + n) % track.segments.length;
      const segment = track.segments[segmentIndex];
      const looped = segmentIndex < baseSegment.index;

      const camZ = position - (looped ? track.trackLength : 0);
      const camY = camPlayerY + this.cameraHeight;

      this.project(segment.p1, playerX * this.roadWidth - x, camY, camZ);
      this.project(segment.p2, playerX * this.roadWidth - x - dx, camY, camZ);

      x += dx;
      dx += segment.curve;

      // Store in pre-allocated pool
      this.segmentDataPool[segmentCount].segment = segment;
      this.segmentDataPool[segmentCount].clip = maxy;
      segmentCount++;

      // Skip conditions
      if (segment.p1.camera.z <= this.cameraDepth) continue;
      if (segment.p2.screen.y >= segment.p1.screen.y) continue;
      if (segment.p2.screen.y >= maxy) continue;

      // Render this segment with fog
      const fogAmount = this.getFogAmount(n);
      this.renderSegment(segment, fogAmount);

      maxy = segment.p1.screen.y;
    }

    // Second pass: render sprites back to front (far to near)
    for (let n = segmentCount - 1; n > 0; n--) {
      const segmentData = this.segmentDataPool[n];
      const segment = segmentData.segment;
      if (!segment) continue;

      const clip = segmentData.clip;
      const fogAmount = this.getFogAmount(n);

      if (fogAmount >= 1) continue;

      for (const sprite of segment.sprites) {
        const spriteScale = segment.p1.scale;
        const spriteX =
          segment.p1.screen.x +
          (spriteScale * sprite.offset * this.roadWidth * this.width) / 2;
        const spriteY = segment.p1.screen.y;

        // Early culling: skip sprites that are off-screen horizontally
        // Estimate max sprite width for culling (generous estimate)
        const maxSpriteWidth = spriteScale * this.width * 0.5;
        if (
          spriteX < -maxSpriteWidth ||
          spriteX > this.width + maxSpriteWidth
        ) {
          continue;
        }

        const offsetX = sprite.offset < 0 ? -1 : 0;
        const offsetY = -1;

        this.renderSprite(
          sprite.type,
          spriteScale,
          spriteX,
          spriteY,
          offsetX,
          offsetY,
          clip,
          fogAmount,
        );
      }
    }

    this.renderPlayer(playerX, steerDirection);

    // Scale up the retro canvas to the main canvas with pixelated look
    this.ctx.drawImage(
      this.retroCanvas,
      0,
      0,
      this.retroWidth,
      this.retroHeight,
      0,
      0,
      this.canvas.width,
      this.canvas.height,
    );
  }

  // ---------------------------------------------------------------------------
  // PROJECTION
  // ---------------------------------------------------------------------------

  private project(
    p: {
      world: { x: number; y: number; z: number };
      camera: { x: number; y: number; z: number };
      screen: { x: number; y: number; w: number };
      scale: number;
    },
    cameraX: number,
    cameraY: number,
    cameraZ: number,
  ): void {
    p.camera.x = p.world.x - cameraX;
    p.camera.y = p.world.y - cameraY;
    p.camera.z = p.world.z - cameraZ;

    if (p.camera.z <= 0) {
      p.scale = 0;
      p.screen.y = this.height;
      p.screen.x = 0;
      p.screen.w = 0;
      return;
    }

    p.scale = this.cameraDepth / p.camera.z;
    p.screen.x = Math.round(
      this.width / 2 + (p.scale * p.camera.x * this.width) / 2,
    );
    p.screen.y = Math.round(
      this.height / 2 - (p.scale * p.camera.y * this.height) / 2,
    );
    p.screen.w = Math.round((p.scale * this.roadWidth * this.width) / 2);
  }

  // ---------------------------------------------------------------------------
  // SEGMENT RENDERING (Optimized with pre-parsed RGB colors)
  // ---------------------------------------------------------------------------

  private renderSegment(segment: Segment, fogAmount: number = 0): void {
    const ctx = this.retroCtx;
    const { p1, p2, color } = segment;

    const x1 = p1.screen.x;
    const y1 = p1.screen.y;
    const w1 = p1.screen.w;
    const x2 = p2.screen.x;
    const y2 = p2.screen.y;
    const w2 = p2.screen.w;

    // Get pre-parsed RGB colors based on segment index
    const isLight = Math.floor(segment.index / ROAD.RUMBLE_LENGTH) % 2 === 0;
    const colors = isLight ? SEGMENT_COLORS.LIGHT : SEGMENT_COLORS.DARK;

    // Apply fog to pre-parsed RGB colors (no hex parsing!)
    const grassColor = this.applyFogToRGB(colors.grass, fogAmount);
    const roadColor = this.applyFogToRGB(colors.road, fogAmount);
    const rumbleColor = this.applyFogToRGB(colors.rumble, fogAmount);
    const laneColor = this.applyFogToRGB(colors.lane, fogAmount);

    // Grass
    ctx.fillStyle = grassColor;
    ctx.fillRect(0, y2, this.width, y1 - y2);

    // Rumble strips
    const rw1 = w1 * ROAD.RUMBLE_WIDTH_RATIO;
    const rw2 = w2 * ROAD.RUMBLE_WIDTH_RATIO;
    this.renderQuad(
      x1 - w1 - rw1,
      y1,
      x1 - w1,
      y1,
      x2 - w2,
      y2,
      x2 - w2 - rw2,
      y2,
      rumbleColor,
    );
    this.renderQuad(
      x1 + w1,
      y1,
      x1 + w1 + rw1,
      y1,
      x2 + w2 + rw2,
      y2,
      x2 + w2,
      y2,
      rumbleColor,
    );

    // Road
    this.renderQuad(
      x1 - w1,
      y1,
      x1 + w1,
      y1,
      x2 + w2,
      y2,
      x2 - w2,
      y2,
      roadColor,
    );

    // Lane markers (only if different from road color - i.e., light segments)
    if (isLight) {
      const lw1 = w1 * ROAD.LANE_WIDTH_RATIO;
      const lw2 = w2 * ROAD.LANE_WIDTH_RATIO;
      const lx1a = x1 - w1 * ROAD.LANE_POSITION_RATIO;
      const lx2a = x2 - w2 * ROAD.LANE_POSITION_RATIO;
      const lx1b = x1 + w1 * ROAD.LANE_POSITION_RATIO;
      const lx2b = x2 + w2 * ROAD.LANE_POSITION_RATIO;
      this.renderQuad(
        lx1a - lw1,
        y1,
        lx1a + lw1,
        y1,
        lx2a + lw2,
        y2,
        lx2a - lw2,
        y2,
        laneColor,
      );
      this.renderQuad(
        lx1b - lw1,
        y1,
        lx1b + lw1,
        y1,
        lx2b + lw2,
        y2,
        lx2b - lw2,
        y2,
        laneColor,
      );
    }
  }

  private renderQuad(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
    color: string,
  ): void {
    const ctx = this.retroCtx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  // ---------------------------------------------------------------------------
  // SPRITE RENDERING
  // ---------------------------------------------------------------------------

  private renderSprite(
    type: SpriteType,
    scale: number,
    destX: number,
    destY: number,
    offsetX: number,
    offsetY: number,
    clipY: number,
    fogAmount: number = 0,
  ): void {
    const ctx = this.retroCtx;

    // Get sprite frame from sprite sheet
    const frame = SPRITESHEET_FRAMES[type];
    if (!frame || !this.spriteSheet || !this.spriteSheetLoaded) return;

    const spriteDef = SPRITE_REGISTRY[type];
    const spriteScale = spriteDef?.scale ?? 1.0;

    // Calculate destination dimensions using frame dimensions
    const destW =
      ((frame.w * scale * this.width) / 2) *
      ((spriteScale * RENDER.SPRITE_SCALE * this.roadWidth) / 1000);
    const destH =
      ((frame.h * scale * this.width) / 2) *
      ((spriteScale * RENDER.SPRITE_SCALE * this.roadWidth) / 1000);

    // Apply offsets
    destX = destX + destW * offsetX;
    destY = destY + destH * offsetY;

    // Calculate clipping
    const clipH = clipY ? Math.max(0, destY + destH - clipY) : 0;

    if (clipH < destH) {
      const opacity = 1 - fogAmount;
      ctx.globalAlpha = opacity;

      // Calculate source height after clipping
      const srcClipH = (frame.h * clipH) / destH;

      ctx.drawImage(
        this.spriteSheet,
        frame.x,
        frame.y,
        frame.w,
        frame.h - srcClipH,
        destX,
        destY,
        destW,
        destH - clipH,
      );

      ctx.globalAlpha = 1;
    }
  }

  // ---------------------------------------------------------------------------
  // PLAYER RENDERING
  // ---------------------------------------------------------------------------

  renderPlayer(playerX: number, steerDirection: number = 0): void {
    const ctx = this.retroCtx;

    // Map steer direction to sprite sheet frame name
    let frameName: string = "player_straight";
    if (steerDirection < 0) {
      frameName = "player_left";
    } else if (steerDirection > 0) {
      frameName = "player_right";
    }

    // Get frame from sprite sheet
    const frame = SPRITESHEET_FRAMES[frameName];

    if (this.spriteSheetLoaded && this.spriteSheet && frame) {
      const scale = (this.width / PLAYER.SCALE_BASE) * 1.0;
      const carWidth = frame.w * scale;
      const carHeight = frame.h * scale;
      const x = this.width / 2 - carWidth / 2;
      const y = this.height - carHeight - PLAYER.BOTTOM_OFFSET * scale;

      ctx.drawImage(
        this.spriteSheet,
        frame.x,
        frame.y,
        frame.w,
        frame.h,
        x,
        y,
        carWidth,
        carHeight,
      );
    } else {
      // Fallback: red rectangle if sprite sheet not loaded
      const scale = this.width / PLAYER.SCALE_BASE;
      const carWidth = PLAYER.FALLBACK_WIDTH * scale;
      const carHeight = PLAYER.FALLBACK_HEIGHT * scale;
      const x = this.width / 2 - carWidth / 2;
      const y = this.height - carHeight - PLAYER.BOTTOM_OFFSET * scale;

      ctx.fillStyle = "#cc0000";
      ctx.fillRect(x, y, carWidth, carHeight);
    }
  }
}
