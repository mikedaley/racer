/**
 * WebGL Renderer
 * GPU-accelerated pseudo-3D road rendering with perspective projection
 */

import { Track } from "./Track";
import { Segment, SpriteType } from "../types/game";
import {
  createProgram,
  createBuffer,
  createTexture,
  getUniformLocations,
  getAttribLocations,
  ortho,
} from "./WebGLUtils";

// Import config
import { RENDER, CAMERA, ROAD, FOG, PLAYER } from "../config/constants";
import { RGB, SEGMENT_COLORS, FOG_COLOR, SKY_GRADIENT } from "../config/colors";

// Import sprite data
import { SPRITE_REGISTRY } from "../sprites/SpriteRegistry";
import {
  SPRITESHEET_PATH,
  SPRITESHEET_FRAMES,
  SPRITESHEET_SIZE,
} from "../sprites/spritesheet-data";

// Shader sources (inline for simplicity)
const SKY_VERT = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
out vec2 v_uv;
uniform mat4 u_projection;
void main() {
    v_uv = a_uv;
    gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
}`;

const SKY_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
out vec4 fragColor;
#define MAX_BANDS 20
uniform vec3 u_colors[MAX_BANDS];
uniform int u_bandCount;
void main() {
    // v_uv.y goes from 0 (top) to 1 (horizon)
    float t = v_uv.y;
    float bandSize = 1.0 / float(u_bandCount);
    int bandIndex = int(t / bandSize);
    bandIndex = min(bandIndex, u_bandCount - 1);
    vec3 color = u_colors[bandIndex];
    fragColor = vec4(color, 1.0);
}`;

const ROAD_VERT = `#version 300 es
in vec2 a_position;
in vec3 a_color;
in float a_fogAmount;
out vec3 v_color;
out float v_fogAmount;
uniform mat4 u_projection;
void main() {
    v_color = a_color;
    v_fogAmount = a_fogAmount;
    gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
}`;

const ROAD_FRAG = `#version 300 es
precision mediump float;
in vec3 v_color;
in float v_fogAmount;
out vec4 fragColor;
uniform vec3 u_fogColor;
void main() {
    vec3 color = mix(v_color, u_fogColor, v_fogAmount);
    fragColor = vec4(color, 1.0);
}`;

const SPRITE_VERT = `#version 300 es
in vec2 a_position;
in vec2 a_uv;
in float a_opacity;
out vec2 v_uv;
out float v_opacity;
uniform mat4 u_projection;
void main() {
    v_uv = a_uv;
    v_opacity = a_opacity;
    gl_Position = u_projection * vec4(a_position, 0.0, 1.0);
}`;

const SPRITE_FRAG = `#version 300 es
precision mediump float;
in vec2 v_uv;
in float v_opacity;
out vec4 fragColor;
uniform sampler2D u_texture;
void main() {
    vec4 texColor = texture(u_texture, v_uv);
    if (texColor.a < 0.01) {
        discard;
    }
    fragColor = vec4(texColor.rgb, texColor.a * v_opacity);
}`;

// =============================================================================
// RENDERER CLASS
// =============================================================================

export class WebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;

  // Retro rendering - render at low res then scale up
  private retroCanvas: HTMLCanvasElement;
  private retroGl: WebGL2RenderingContext;
  private retroWidth = RENDER.RETRO_WIDTH;
  private retroHeight = RENDER.RETRO_HEIGHT;

  // 2D context for final upscale
  private displayCtx: CanvasRenderingContext2D;

  // Shader programs
  private skyProgram: WebGLProgram;
  private roadProgram: WebGLProgram;
  private spriteProgram: WebGLProgram;

  // Uniform locations
  private skyUniforms: Record<string, WebGLUniformLocation | null>;
  private roadUniforms: Record<string, WebGLUniformLocation | null>;
  private spriteUniforms: Record<string, WebGLUniformLocation | null>;

  // Attribute locations
  private skyAttribs: Record<string, number>;
  private roadAttribs: Record<string, number>;
  private spriteAttribs: Record<string, number>;

  // Buffers (initialized in create*Buffers methods called from constructor)
  private skyVAO!: WebGLVertexArrayObject;
  private skyPositionBuffer!: WebGLBuffer;
  private skyUvBuffer!: WebGLBuffer;
  private roadVAO!: WebGLVertexArrayObject;
  private spriteVAO!: WebGLVertexArrayObject;
  private roadPositionBuffer!: WebGLBuffer;
  private roadColorBuffer!: WebGLBuffer;
  private roadFogBuffer!: WebGLBuffer;
  private spritePositionBuffer!: WebGLBuffer;
  private spriteUvBuffer!: WebGLBuffer;
  private spriteOpacityBuffer!: WebGLBuffer;

  // Textures
  private spriteTexture: WebGLTexture | null = null;
  private spriteSheetLoaded = false;

  // Projection matrix
  private projectionMatrix: Float32Array;

  // Segment data for sprite rendering
  private segmentDataPool: { segment: Segment | null; clip: number }[] = [];

  // Pre-allocated typed arrays for dynamic data
  private roadPositions: Float32Array;
  private roadColors: Float32Array;
  private roadFogAmounts: Float32Array;
  private spritePositions: Float32Array;
  private spriteUvs: Float32Array;
  private spriteOpacities: Float32Array;

  // Public properties
  width = RENDER.RETRO_WIDTH;
  height = RENDER.RETRO_HEIGHT;
  roadWidth = CAMERA.ROAD_WIDTH;
  cameraHeight = CAMERA.HEIGHT;
  cameraDepth = CAMERA.DEPTH;
  drawDistance = RENDER.DRAW_DISTANCE;
  fogDensity = FOG.DEFAULT_DENSITY;
  debugCollisions = false; // Toggle to show collision bounding boxes

  // Collision constants (must match Game.ts)
  private readonly PLAYER_WIDTH = 0.3;
  private readonly SPRITE_WIDTH = 0.2;

  constructor(canvas: HTMLCanvasElement, autoResize: boolean = true) {
    this.canvas = canvas;
    this.displayCtx = canvas.getContext("2d")!;
    this.displayCtx.imageSmoothingEnabled = false;

    // Create offscreen WebGL canvas for retro rendering
    this.retroCanvas = document.createElement("canvas");
    this.retroCanvas.width = this.retroWidth;
    this.retroCanvas.height = this.retroHeight;

    const gl = this.retroCanvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error("WebGL2 not supported");
    }

    this.gl = gl;
    this.retroGl = gl;

    // Enable blending for sprites
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Create shader programs
    this.skyProgram = createProgram(gl, SKY_VERT, SKY_FRAG);
    this.roadProgram = createProgram(gl, ROAD_VERT, ROAD_FRAG);
    this.spriteProgram = createProgram(gl, SPRITE_VERT, SPRITE_FRAG);

    // Get uniform locations
    this.skyUniforms = getUniformLocations(gl, this.skyProgram, [
      "u_colors",
      "u_bandCount",
      "u_projection",
    ]);
    this.roadUniforms = getUniformLocations(gl, this.roadProgram, [
      "u_projection",
      "u_fogColor",
    ]);
    this.spriteUniforms = getUniformLocations(gl, this.spriteProgram, [
      "u_projection",
      "u_texture",
    ]);

    // Get attribute locations
    this.skyAttribs = getAttribLocations(gl, this.skyProgram, [
      "a_position",
      "a_uv",
    ]);
    this.roadAttribs = getAttribLocations(gl, this.roadProgram, [
      "a_position",
      "a_color",
      "a_fogAmount",
    ]);
    this.spriteAttribs = getAttribLocations(gl, this.spriteProgram, [
      "a_position",
      "a_uv",
      "a_opacity",
    ]);

    // Create projection matrix (2D orthographic)
    this.projectionMatrix = ortho(
      0,
      this.retroWidth,
      this.retroHeight,
      0,
      -1,
      1,
    );

    // Pre-allocate segment data pool
    this.segmentDataPool = new Array(this.drawDistance)
      .fill(null)
      .map(() => ({ segment: null, clip: 0 }));

    // Pre-allocate typed arrays
    // Road: up to drawDistance segments * 6 quads each * 6 vertices * 2 coords
    const maxRoadVertices = this.drawDistance * 6 * 6;
    this.roadPositions = new Float32Array(maxRoadVertices * 2);
    this.roadColors = new Float32Array(maxRoadVertices * 3);
    this.roadFogAmounts = new Float32Array(maxRoadVertices);

    // Sprites: estimate max 500 sprites * 6 vertices
    const maxSpriteVertices = 500 * 6;
    this.spritePositions = new Float32Array(maxSpriteVertices * 2);
    this.spriteUvs = new Float32Array(maxSpriteVertices * 2);
    this.spriteOpacities = new Float32Array(maxSpriteVertices);

    // Create buffers and VAOs
    this.createSkyBuffers();
    this.createRoadBuffers();
    this.createSpriteBuffers();

    // Setup sky colors uniform
    this.setupSkyColors();

    if (autoResize) {
      this.resize();
      window.addEventListener("resize", () => this.resize());
    } else {
      this.canvas.width = canvas.width;
      this.canvas.height = canvas.height;
    }

    this.loadSprites();
  }

  private createSkyBuffers(): void {
    const gl = this.gl;

    // Pre-allocate buffers for dynamic sky quad (updated each frame based on horizon)
    const positions = new Float32Array(6 * 2); // 6 vertices, 2 components
    const uvs = new Float32Array(6 * 2);

    this.skyPositionBuffer = createBuffer(
      gl,
      positions,
      gl.ARRAY_BUFFER,
      gl.DYNAMIC_DRAW,
    );
    this.skyUvBuffer = createBuffer(gl, uvs, gl.ARRAY_BUFFER, gl.DYNAMIC_DRAW);

    this.skyVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.skyVAO);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyPositionBuffer);
    gl.enableVertexAttribArray(this.skyAttribs.a_position);
    gl.vertexAttribPointer(
      this.skyAttribs.a_position,
      2,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyUvBuffer);
    gl.enableVertexAttribArray(this.skyAttribs.a_uv);
    gl.vertexAttribPointer(this.skyAttribs.a_uv, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
  }

  private createRoadBuffers(): void {
    const gl = this.gl;

    this.roadPositionBuffer = createBuffer(
      gl,
      this.roadPositions,
      gl.ARRAY_BUFFER,
      gl.DYNAMIC_DRAW,
    );
    this.roadColorBuffer = createBuffer(
      gl,
      this.roadColors,
      gl.ARRAY_BUFFER,
      gl.DYNAMIC_DRAW,
    );
    this.roadFogBuffer = createBuffer(
      gl,
      this.roadFogAmounts,
      gl.ARRAY_BUFFER,
      gl.DYNAMIC_DRAW,
    );

    this.roadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.roadVAO);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadPositionBuffer);
    gl.enableVertexAttribArray(this.roadAttribs.a_position);
    gl.vertexAttribPointer(
      this.roadAttribs.a_position,
      2,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadColorBuffer);
    gl.enableVertexAttribArray(this.roadAttribs.a_color);
    gl.vertexAttribPointer(this.roadAttribs.a_color, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadFogBuffer);
    gl.enableVertexAttribArray(this.roadAttribs.a_fogAmount);
    gl.vertexAttribPointer(
      this.roadAttribs.a_fogAmount,
      1,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindVertexArray(null);
  }

  private createSpriteBuffers(): void {
    const gl = this.gl;

    this.spritePositionBuffer = createBuffer(
      gl,
      this.spritePositions,
      gl.ARRAY_BUFFER,
      gl.DYNAMIC_DRAW,
    );
    this.spriteUvBuffer = createBuffer(
      gl,
      this.spriteUvs,
      gl.ARRAY_BUFFER,
      gl.DYNAMIC_DRAW,
    );
    this.spriteOpacityBuffer = createBuffer(
      gl,
      this.spriteOpacities,
      gl.ARRAY_BUFFER,
      gl.DYNAMIC_DRAW,
    );

    this.spriteVAO = gl.createVertexArray()!;
    gl.bindVertexArray(this.spriteVAO);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spritePositionBuffer);
    gl.enableVertexAttribArray(this.spriteAttribs.a_position);
    gl.vertexAttribPointer(
      this.spriteAttribs.a_position,
      2,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteUvBuffer);
    gl.enableVertexAttribArray(this.spriteAttribs.a_uv);
    gl.vertexAttribPointer(this.spriteAttribs.a_uv, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteOpacityBuffer);
    gl.enableVertexAttribArray(this.spriteAttribs.a_opacity);
    gl.vertexAttribPointer(
      this.spriteAttribs.a_opacity,
      1,
      gl.FLOAT,
      false,
      0,
      0,
    );

    gl.bindVertexArray(null);
  }

  private setupSkyColors(): void {
    const gl = this.gl;
    gl.useProgram(this.skyProgram);

    // Flatten sky gradient colors to vec3 array
    const colorData = new Float32Array(SKY_GRADIENT.length * 3);
    for (let i = 0; i < SKY_GRADIENT.length; i++) {
      colorData[i * 3] = SKY_GRADIENT[i].r / 255;
      colorData[i * 3 + 1] = SKY_GRADIENT[i].g / 255;
      colorData[i * 3 + 2] = SKY_GRADIENT[i].b / 255;
    }

    gl.uniform3fv(this.skyUniforms.u_colors, colorData);
    gl.uniform1i(this.skyUniforms.u_bandCount, SKY_GRADIENT.length);
  }

  private loadSprites(): void {
    const image = new Image();
    image.onload = () => {
      this.spriteTexture = createTexture(this.gl, image, {
        filter: this.gl.NEAREST,
        wrap: this.gl.CLAMP_TO_EDGE,
      });
      this.spriteSheetLoaded = true;
      console.log("WebGL sprite sheet loaded");
    };
    image.onerror = () => {
      console.warn("Failed to load sprite sheet");
    };
    image.src = SPRITESHEET_PATH;
  }

  private resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.width = this.retroWidth;
    this.height = this.retroHeight;
    this.displayCtx.imageSmoothingEnabled = false;
  }

  // ---------------------------------------------------------------------------
  // FOG CALCULATIONS
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
  // MAIN RENDER
  // ---------------------------------------------------------------------------

  render(
    track: Track,
    position: number,
    playerX: number,
    playerY?: number,
    steerDirection: number = 0,
  ): void {
    const gl = this.gl;

    // Clear
    gl.viewport(0, 0, this.retroWidth, this.retroHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Build road geometry first to determine horizon
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

    let maxy = this.height;
    let x = 0;
    let dx = -(baseSegment.curve * basePercent);

    let roadVertexCount = 0;
    let segmentCount = 0;

    // Project all segments and build road geometry
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

      // Store segment data for sprite pass
      this.segmentDataPool[segmentCount].segment = segment;
      this.segmentDataPool[segmentCount].clip = maxy;
      segmentCount++;

      // Skip conditions
      if (segment.p1.camera.z <= this.cameraDepth) continue;
      if (segment.p2.screen.y >= segment.p1.screen.y) continue;
      if (segment.p2.screen.y >= maxy) continue;

      // Build road geometry for this segment
      roadVertexCount = this.buildSegmentGeometry(segment, n, roadVertexCount);

      maxy = segment.p1.screen.y;
    }

    // Render sky from top to visible horizon (maxy is the topmost road point)
    this.renderSky(maxy);

    // Upload and render road
    this.renderRoad(roadVertexCount);

    // 3. Render sprites (back to front)
    this.renderSprites(segmentCount);

    // 4. Render debug collision boxes (if enabled)
    if (this.debugCollisions) {
      this.renderDebugCollisions(segmentCount, playerX);
    }

    // 5. Render player
    this.renderPlayer(steerDirection);

    // 6. Scale up to display canvas
    this.displayCtx.drawImage(
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
  // SKY RENDERING
  // ---------------------------------------------------------------------------

  private renderSky(horizonY: number): void {
    const gl = this.gl;

    // Build dynamic sky quad from top (y=0) to visible horizon
    const positions = new Float32Array([
      0,
      0,
      this.retroWidth,
      0,
      0,
      horizonY,
      0,
      horizonY,
      this.retroWidth,
      0,
      this.retroWidth,
      horizonY,
    ]);

    // UVs: 0 at top, 1 at horizon
    const uvs = new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]);

    gl.useProgram(this.skyProgram);
    gl.uniformMatrix4fv(
      this.skyUniforms.u_projection,
      false,
      this.projectionMatrix,
    );

    // Update buffers with dynamic positions
    gl.bindVertexArray(this.skyVAO);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyPositionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.skyUvBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, uvs);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------------------
  // ROAD GEOMETRY BUILDING
  // ---------------------------------------------------------------------------

  private buildSegmentGeometry(
    segment: Segment,
    n: number,
    vertexOffset: number,
  ): number {
    const { p1, p2 } = segment;

    const x1 = p1.screen.x;
    const y1 = p1.screen.y;
    const w1 = p1.screen.w;
    const x2 = p2.screen.x;
    const y2 = p2.screen.y;
    const w2 = p2.screen.w;

    const fogAmount = this.getFogAmount(n);

    // Get colors
    const isLight = Math.floor(segment.index / ROAD.RUMBLE_LENGTH) % 2 === 0;
    const colors = isLight ? SEGMENT_COLORS.LIGHT : SEGMENT_COLORS.DARK;

    // Grass (full width)
    vertexOffset = this.addQuad(
      vertexOffset,
      0,
      y1,
      this.width,
      y1,
      this.width,
      y2,
      0,
      y2,
      colors.grass,
      fogAmount,
    );

    // Left rumble
    const rw1 = w1 * ROAD.RUMBLE_WIDTH_RATIO;
    const rw2 = w2 * ROAD.RUMBLE_WIDTH_RATIO;
    vertexOffset = this.addQuad(
      vertexOffset,
      x1 - w1 - rw1,
      y1,
      x1 - w1,
      y1,
      x2 - w2,
      y2,
      x2 - w2 - rw2,
      y2,
      colors.rumble,
      fogAmount,
    );

    // Right rumble
    vertexOffset = this.addQuad(
      vertexOffset,
      x1 + w1,
      y1,
      x1 + w1 + rw1,
      y1,
      x2 + w2 + rw2,
      y2,
      x2 + w2,
      y2,
      colors.rumble,
      fogAmount,
    );

    // Road surface
    vertexOffset = this.addQuad(
      vertexOffset,
      x1 - w1,
      y1,
      x1 + w1,
      y1,
      x2 + w2,
      y2,
      x2 - w2,
      y2,
      colors.road,
      fogAmount,
    );

    // Lane markers (only on light segments)
    if (isLight) {
      const lw1 = w1 * ROAD.LANE_WIDTH_RATIO;
      const lw2 = w2 * ROAD.LANE_WIDTH_RATIO;
      const lx1a = x1 - w1 * ROAD.LANE_POSITION_RATIO;
      const lx2a = x2 - w2 * ROAD.LANE_POSITION_RATIO;
      const lx1b = x1 + w1 * ROAD.LANE_POSITION_RATIO;
      const lx2b = x2 + w2 * ROAD.LANE_POSITION_RATIO;

      vertexOffset = this.addQuad(
        vertexOffset,
        lx1a - lw1,
        y1,
        lx1a + lw1,
        y1,
        lx2a + lw2,
        y2,
        lx2a - lw2,
        y2,
        colors.lane,
        fogAmount,
      );
      vertexOffset = this.addQuad(
        vertexOffset,
        lx1b - lw1,
        y1,
        lx1b + lw1,
        y1,
        lx2b + lw2,
        y2,
        lx2b - lw2,
        y2,
        colors.lane,
        fogAmount,
      );
    }

    return vertexOffset;
  }

  private addQuad(
    offset: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x3: number,
    y3: number,
    x4: number,
    y4: number,
    color: RGB,
    fogAmount: number,
  ): number {
    const r = color.r / 255;
    const g = color.g / 255;
    const b = color.b / 255;

    // Triangle 1: (x1,y1), (x2,y2), (x4,y4)
    this.roadPositions[offset * 2] = x1;
    this.roadPositions[offset * 2 + 1] = y1;
    this.roadColors[offset * 3] = r;
    this.roadColors[offset * 3 + 1] = g;
    this.roadColors[offset * 3 + 2] = b;
    this.roadFogAmounts[offset] = fogAmount;
    offset++;

    this.roadPositions[offset * 2] = x2;
    this.roadPositions[offset * 2 + 1] = y2;
    this.roadColors[offset * 3] = r;
    this.roadColors[offset * 3 + 1] = g;
    this.roadColors[offset * 3 + 2] = b;
    this.roadFogAmounts[offset] = fogAmount;
    offset++;

    this.roadPositions[offset * 2] = x4;
    this.roadPositions[offset * 2 + 1] = y4;
    this.roadColors[offset * 3] = r;
    this.roadColors[offset * 3 + 1] = g;
    this.roadColors[offset * 3 + 2] = b;
    this.roadFogAmounts[offset] = fogAmount;
    offset++;

    // Triangle 2: (x2,y2), (x3,y3), (x4,y4)
    this.roadPositions[offset * 2] = x2;
    this.roadPositions[offset * 2 + 1] = y2;
    this.roadColors[offset * 3] = r;
    this.roadColors[offset * 3 + 1] = g;
    this.roadColors[offset * 3 + 2] = b;
    this.roadFogAmounts[offset] = fogAmount;
    offset++;

    this.roadPositions[offset * 2] = x3;
    this.roadPositions[offset * 2 + 1] = y3;
    this.roadColors[offset * 3] = r;
    this.roadColors[offset * 3 + 1] = g;
    this.roadColors[offset * 3 + 2] = b;
    this.roadFogAmounts[offset] = fogAmount;
    offset++;

    this.roadPositions[offset * 2] = x4;
    this.roadPositions[offset * 2 + 1] = y4;
    this.roadColors[offset * 3] = r;
    this.roadColors[offset * 3 + 1] = g;
    this.roadColors[offset * 3 + 2] = b;
    this.roadFogAmounts[offset] = fogAmount;
    offset++;

    return offset;
  }

  private renderRoad(vertexCount: number): void {
    if (vertexCount === 0) return;

    const gl = this.gl;

    gl.useProgram(this.roadProgram);

    // Upload dynamic data
    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadPositionBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadPositions.subarray(0, vertexCount * 2),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadColorBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadColors.subarray(0, vertexCount * 3),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadFogBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadFogAmounts.subarray(0, vertexCount),
    );

    // Set uniforms
    gl.uniformMatrix4fv(
      this.roadUniforms.u_projection,
      false,
      this.projectionMatrix,
    );
    gl.uniform3f(
      this.roadUniforms.u_fogColor,
      FOG_COLOR.r / 255,
      FOG_COLOR.g / 255,
      FOG_COLOR.b / 255,
    );

    // Draw
    gl.bindVertexArray(this.roadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------------------
  // SPRITE RENDERING
  // ---------------------------------------------------------------------------

  private renderSprites(segmentCount: number): void {
    if (!this.spriteSheetLoaded || !this.spriteTexture) return;

    const gl = this.gl;
    let spriteVertexCount = 0;

    // Iterate back to front
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

        // Early culling
        const maxSpriteWidth = spriteScale * this.width * 0.5;
        if (
          spriteX < -maxSpriteWidth ||
          spriteX > this.width + maxSpriteWidth
        ) {
          continue;
        }

        const offsetX = sprite.offset < 0 ? -1 : 0;
        const offsetY = -1;

        spriteVertexCount = this.buildSpriteGeometry(
          sprite.type,
          spriteScale,
          spriteX,
          spriteY,
          offsetX,
          offsetY,
          clip,
          fogAmount,
          spriteVertexCount,
        );
      }
    }

    if (spriteVertexCount === 0) return;

    // Upload and draw
    gl.useProgram(this.spriteProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spritePositionBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.spritePositions.subarray(0, spriteVertexCount * 2),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteUvBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.spriteUvs.subarray(0, spriteVertexCount * 2),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteOpacityBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.spriteOpacities.subarray(0, spriteVertexCount),
    );

    gl.uniformMatrix4fv(
      this.spriteUniforms.u_projection,
      false,
      this.projectionMatrix,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.spriteTexture);
    gl.uniform1i(this.spriteUniforms.u_texture, 0);

    gl.bindVertexArray(this.spriteVAO);
    gl.drawArrays(gl.TRIANGLES, 0, spriteVertexCount);
    gl.bindVertexArray(null);
  }

  private buildSpriteGeometry(
    type: SpriteType,
    scale: number,
    destX: number,
    destY: number,
    offsetX: number,
    offsetY: number,
    clipY: number,
    fogAmount: number,
    vertexOffset: number,
  ): number {
    const frame = SPRITESHEET_FRAMES[type];
    if (!frame) return vertexOffset;

    const spriteDef = SPRITE_REGISTRY[type];
    const spriteScale = spriteDef?.scale ?? 1.0;

    // Calculate destination dimensions
    const destW =
      ((frame.w * scale * this.width) / 2) *
      ((spriteScale * RENDER.SPRITE_SCALE * this.roadWidth) / 1000);
    const destH =
      ((frame.h * scale * this.width) / 2) *
      ((spriteScale * RENDER.SPRITE_SCALE * this.roadWidth) / 1000);

    // Apply offsets
    const x = destX + destW * offsetX;
    const y = destY + destH * offsetY;

    // Calculate clipping
    const clipH = clipY ? Math.max(0, y + destH - clipY) : 0;

    if (clipH >= destH) return vertexOffset;

    const opacity = 1 - fogAmount;

    // UV coordinates
    const texW = SPRITESHEET_SIZE.width;
    const texH = SPRITESHEET_SIZE.height;
    const u0 = frame.x / texW;
    const v0 = frame.y / texH;
    const u1 = (frame.x + frame.w) / texW;
    const srcClipH = (frame.h * clipH) / destH;
    const v1 = (frame.y + frame.h - srcClipH) / texH;

    const finalH = destH - clipH;

    // Build quad (2 triangles)
    // Vertex 0
    this.spritePositions[vertexOffset * 2] = x;
    this.spritePositions[vertexOffset * 2 + 1] = y;
    this.spriteUvs[vertexOffset * 2] = u0;
    this.spriteUvs[vertexOffset * 2 + 1] = v0;
    this.spriteOpacities[vertexOffset] = opacity;
    vertexOffset++;

    // Vertex 1
    this.spritePositions[vertexOffset * 2] = x + destW;
    this.spritePositions[vertexOffset * 2 + 1] = y;
    this.spriteUvs[vertexOffset * 2] = u1;
    this.spriteUvs[vertexOffset * 2 + 1] = v0;
    this.spriteOpacities[vertexOffset] = opacity;
    vertexOffset++;

    // Vertex 2
    this.spritePositions[vertexOffset * 2] = x;
    this.spritePositions[vertexOffset * 2 + 1] = y + finalH;
    this.spriteUvs[vertexOffset * 2] = u0;
    this.spriteUvs[vertexOffset * 2 + 1] = v1;
    this.spriteOpacities[vertexOffset] = opacity;
    vertexOffset++;

    // Vertex 3
    this.spritePositions[vertexOffset * 2] = x + destW;
    this.spritePositions[vertexOffset * 2 + 1] = y;
    this.spriteUvs[vertexOffset * 2] = u1;
    this.spriteUvs[vertexOffset * 2 + 1] = v0;
    this.spriteOpacities[vertexOffset] = opacity;
    vertexOffset++;

    // Vertex 4
    this.spritePositions[vertexOffset * 2] = x + destW;
    this.spritePositions[vertexOffset * 2 + 1] = y + finalH;
    this.spriteUvs[vertexOffset * 2] = u1;
    this.spriteUvs[vertexOffset * 2 + 1] = v1;
    this.spriteOpacities[vertexOffset] = opacity;
    vertexOffset++;

    // Vertex 5
    this.spritePositions[vertexOffset * 2] = x;
    this.spritePositions[vertexOffset * 2 + 1] = y + finalH;
    this.spriteUvs[vertexOffset * 2] = u0;
    this.spriteUvs[vertexOffset * 2 + 1] = v1;
    this.spriteOpacities[vertexOffset] = opacity;
    vertexOffset++;

    return vertexOffset;
  }

  // ---------------------------------------------------------------------------
  // DEBUG COLLISION RENDERING
  // ---------------------------------------------------------------------------

  private renderDebugCollisions(segmentCount: number, playerX: number): void {
    const gl = this.gl;
    let vertexCount = 0;

    // Colors for debug boxes
    const spriteColor = { r: 255, g: 0, b: 0 }; // Red for sprite collision boxes
    const playerColor = { r: 0, g: 255, b: 0 }; // Green for player collision box

    // Render collision boxes for sprites on nearby segments
    for (let n = 0; n < Math.min(segmentCount, 30); n++) {
      const segmentData = this.segmentDataPool[n];
      const segment = segmentData.segment;
      if (!segment) continue;

      const scale = segment.p1.scale;
      if (scale <= 0.001) continue;

      for (const sprite of segment.sprites) {
        // Calculate sprite screen position (same as in renderSprites)
        const spriteScreenX =
          segment.p1.screen.x +
          (scale * sprite.offset * this.roadWidth * this.width) / 2;
        const spriteScreenY = segment.p1.screen.y;

        // Calculate collision box width in screen space
        const collisionWidth = segment.p1.screen.w * this.SPRITE_WIDTH * 2;
        const boxHeight = Math.max(10, 50 * scale);

        const x1 = spriteScreenX - collisionWidth;
        const x2 = spriteScreenX + collisionWidth;
        const y1 = spriteScreenY - boxHeight;
        const y2 = spriteScreenY;

        // Draw filled collision box
        vertexCount = this.addQuad(
          vertexCount,
          x1,
          y1,
          x2,
          y1,
          x2,
          y2,
          x1,
          y2,
          spriteColor,
          0,
        );
      }
    }

    // Draw player collision box at bottom of screen
    const playerScreenX = this.width / 2;
    const playerCollisionWidth = 30;
    const playerBoxHeight = 40;
    const playerY = this.height - 45;

    const px1 = playerScreenX - playerCollisionWidth;
    const px2 = playerScreenX + playerCollisionWidth;
    const py1 = playerY - playerBoxHeight;
    const py2 = playerY;

    // Draw filled player box
    vertexCount = this.addQuad(
      vertexCount,
      px1,
      py1,
      px2,
      py1,
      px2,
      py2,
      px1,
      py2,
      playerColor,
      0,
    );

    if (vertexCount === 0) return;

    // Render using road shader
    gl.useProgram(this.roadProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadPositionBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadPositions.subarray(0, vertexCount * 2),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadColorBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadColors.subarray(0, vertexCount * 3),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadFogBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadFogAmounts.subarray(0, vertexCount),
    );

    gl.uniformMatrix4fv(
      this.roadUniforms.u_projection,
      false,
      this.projectionMatrix,
    );
    gl.uniform3f(this.roadUniforms.u_fogColor, 0, 0, 0);

    gl.bindVertexArray(this.roadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    gl.bindVertexArray(null);
  }

  // ---------------------------------------------------------------------------
  // PLAYER RENDERING
  // ---------------------------------------------------------------------------

  renderPlayer(steerDirection: number = 0): void {
    if (!this.spriteSheetLoaded || !this.spriteTexture) {
      this.renderPlayerFallback();
      return;
    }

    // Map steer direction to sprite sheet frame name
    let frameName: string = "player_straight";
    if (steerDirection < 0) {
      frameName = "player_left";
    } else if (steerDirection > 0) {
      frameName = "player_right";
    }

    const frame = SPRITESHEET_FRAMES[frameName];
    if (!frame) {
      this.renderPlayerFallback();
      return;
    }

    const gl = this.gl;

    const scale = (this.width / PLAYER.SCALE_BASE) * 1.0;
    const carWidth = frame.w * scale;
    const carHeight = frame.h * scale;
    const x = this.width / 2 - carWidth / 2;
    const y = this.height - carHeight - PLAYER.BOTTOM_OFFSET * scale;

    // UV coordinates
    const texW = SPRITESHEET_SIZE.width;
    const texH = SPRITESHEET_SIZE.height;
    const u0 = frame.x / texW;
    const v0 = frame.y / texH;
    const u1 = (frame.x + frame.w) / texW;
    const v1 = (frame.y + frame.h) / texH;

    // Build quad
    let offset = 0;
    this.spritePositions[offset * 2] = x;
    this.spritePositions[offset * 2 + 1] = y;
    this.spriteUvs[offset * 2] = u0;
    this.spriteUvs[offset * 2 + 1] = v0;
    this.spriteOpacities[offset] = 1.0;
    offset++;

    this.spritePositions[offset * 2] = x + carWidth;
    this.spritePositions[offset * 2 + 1] = y;
    this.spriteUvs[offset * 2] = u1;
    this.spriteUvs[offset * 2 + 1] = v0;
    this.spriteOpacities[offset] = 1.0;
    offset++;

    this.spritePositions[offset * 2] = x;
    this.spritePositions[offset * 2 + 1] = y + carHeight;
    this.spriteUvs[offset * 2] = u0;
    this.spriteUvs[offset * 2 + 1] = v1;
    this.spriteOpacities[offset] = 1.0;
    offset++;

    this.spritePositions[offset * 2] = x + carWidth;
    this.spritePositions[offset * 2 + 1] = y;
    this.spriteUvs[offset * 2] = u1;
    this.spriteUvs[offset * 2 + 1] = v0;
    this.spriteOpacities[offset] = 1.0;
    offset++;

    this.spritePositions[offset * 2] = x + carWidth;
    this.spritePositions[offset * 2 + 1] = y + carHeight;
    this.spriteUvs[offset * 2] = u1;
    this.spriteUvs[offset * 2 + 1] = v1;
    this.spriteOpacities[offset] = 1.0;
    offset++;

    this.spritePositions[offset * 2] = x;
    this.spritePositions[offset * 2 + 1] = y + carHeight;
    this.spriteUvs[offset * 2] = u0;
    this.spriteUvs[offset * 2 + 1] = v1;
    this.spriteOpacities[offset] = 1.0;
    offset++;

    // Upload and draw
    gl.useProgram(this.spriteProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spritePositionBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.spritePositions.subarray(0, offset * 2),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteUvBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.spriteUvs.subarray(0, offset * 2),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteOpacityBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.spriteOpacities.subarray(0, offset),
    );

    gl.uniformMatrix4fv(
      this.spriteUniforms.u_projection,
      false,
      this.projectionMatrix,
    );
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.spriteTexture);
    gl.uniform1i(this.spriteUniforms.u_texture, 0);

    gl.bindVertexArray(this.spriteVAO);
    gl.drawArrays(gl.TRIANGLES, 0, offset);
    gl.bindVertexArray(null);
  }

  private renderPlayerFallback(): void {
    // Use road shader to draw a red rectangle as fallback
    const gl = this.gl;

    const scale = this.width / PLAYER.SCALE_BASE;
    const carWidth = PLAYER.FALLBACK_WIDTH * scale;
    const carHeight = PLAYER.FALLBACK_HEIGHT * scale;
    const x = this.width / 2 - carWidth / 2;
    const y = this.height - carHeight - PLAYER.BOTTOM_OFFSET * scale;

    const color = { r: 204, g: 0, b: 0 };

    let offset = 0;
    offset = this.addQuad(
      offset,
      x,
      y,
      x + carWidth,
      y,
      x + carWidth,
      y + carHeight,
      x,
      y + carHeight,
      color,
      0,
    );

    gl.useProgram(this.roadProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadPositionBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadPositions.subarray(0, offset * 2),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadColorBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadColors.subarray(0, offset * 3),
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.roadFogBuffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.roadFogAmounts.subarray(0, offset),
    );

    gl.uniformMatrix4fv(
      this.roadUniforms.u_projection,
      false,
      this.projectionMatrix,
    );
    gl.uniform3f(
      this.roadUniforms.u_fogColor,
      FOG_COLOR.r / 255,
      FOG_COLOR.g / 255,
      FOG_COLOR.b / 255,
    );

    gl.bindVertexArray(this.roadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, offset);
    gl.bindVertexArray(null);
  }
}
