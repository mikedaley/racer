import { SpriteType } from "../types/game";
import {
  TrackData,
  TrackPiece,
  PlacedSprite,
  TrackPieceType,
  createDefaultTrackData,
  generateId,
  saveTrackData,
  loadTrackData,
} from "../data/TrackData";
import { Track } from "../core/Track";
import { WebGLRenderer } from "../core/WebGLRenderer";

// Import from sprite registry - single source of truth
import {
  SPRITE_REGISTRY,
  getSpritesByCategory,
  getSpriteById,
} from "../sprites/SpriteRegistry";
import { SpriteDefinition, SpriteCategory } from "../sprites/types";

// Editor-specific sprite info (extends registry with UI category mapping)
interface EditorSpriteInfo {
  id: string;
  name: string;
  path: string;
  category: "trees" | "veg" | "objects" | "billboards";
}

// Map registry categories to editor categories
function mapCategory(
  category: SpriteCategory,
): "trees" | "veg" | "objects" | "billboards" {
  switch (category) {
    case "trees":
      return "trees";
    case "vegetation":
      return "veg";
    case "objects":
      return "objects";
    case "billboards":
      return "billboards";
    case "vehicles":
      return "objects"; // Map vehicles to objects for editor
  }
}

// Build SPRITE_INFO from registry (excluding vehicles for roadside placement)
function buildSpriteInfo(): EditorSpriteInfo[] {
  return Object.values(SPRITE_REGISTRY)
    .filter((s) => s.category !== "vehicles")
    .map((s) => ({
      id: s.id,
      name: s.name,
      path: s.path,
      category: mapCategory(s.category),
    }));
}

const SPRITE_INFO = buildSpriteInfo();

export class Editor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private trackData: TrackData;
  private selectedPieceId: string | null = null;
  private selectedSpriteId: string | null = null;
  private selectedSpriteType: SpriteType = "palm_tree";
  private spriteOffset: number = -1.5;
  private onPlay: (data: TrackData) => void;

  // Track path data for rendering and clicking
  private trackPath: {
    x: number;
    y: number;
    elevation: number;
    segmentIndex: number;
  }[] = [];

  // Elevation canvas
  private elevationCanvas: HTMLCanvasElement | null = null;
  private elevationCtx: CanvasRenderingContext2D | null = null;

  // Zoom and pan
  private zoom: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private isDraggingPlayer: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // 3D Preview
  private preview3dCanvas: HTMLCanvasElement | null = null;
  private preview3dRenderer: WebGLRenderer | null = null;
  private preview3dTrack: Track | null = null;
  private preview3dPosition: number = 0;
  private preview3dAnimating: boolean = false;

  constructor(
    canvas: HTMLCanvasElement,
    onPlay: (data: TrackData) => void,
    initialTrackData?: TrackData,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onPlay = onPlay;

    // Use provided track data, or load saved, or create default
    if (initialTrackData) {
      this.trackData = initialTrackData;
    } else {
      const saved = loadTrackData();
      this.trackData = saved || createDefaultTrackData();
    }

    this.setupCanvas();
    this.setupElevationCanvas();
    this.setupUI();
    this.setup3dPreview();
    this.render();

    // Handle window resize
    window.addEventListener("resize", () => {
      this.setupCanvas();
      this.setupElevationCanvas();
    });
  }

  private setupElevationCanvas(): void {
    this.elevationCanvas = document.getElementById(
      "elevation-canvas",
    ) as HTMLCanvasElement;
    if (!this.elevationCanvas) return;

    const container = this.elevationCanvas.parentElement;
    if (container) {
      this.elevationCanvas.width = container.clientWidth;
      this.elevationCanvas.height = container.clientHeight;
    }

    this.elevationCtx = this.elevationCanvas.getContext("2d");
  }

  /**
   * Load new track data into the editor
   */
  loadTrackData(data: TrackData): void {
    this.trackData = data;
    this.selectedPieceId = null;
    this.selectedSpriteId = null;
    this.renderPiecesList();
    this.renderSpriteList();
    this.rebuild3dPreview(true);
    this.render();
  }

  private setup3dPreview(): void {
    this.preview3dCanvas = document.getElementById(
      "preview-3d-canvas",
    ) as HTMLCanvasElement;
    if (!this.preview3dCanvas) return;

    // Set canvas size
    const container = this.preview3dCanvas.parentElement;
    if (container) {
      this.preview3dCanvas.width = 480;
      this.preview3dCanvas.height = 272; // Account for header
    }

    // Create renderer for preview (no auto-resize)
    this.preview3dRenderer = new WebGLRenderer(this.preview3dCanvas, false);

    // Reduce draw distance for better preview performance
    this.preview3dRenderer.drawDistance = 100;

    // Build initial track
    this.rebuild3dPreview();

    // Start preview render loop (throttled)
    this.schedulePreviewRender();

    // Setup controls
    document
      .getElementById("preview-3d-back")
      ?.addEventListener("mousedown", () => {
        this.startPreviewMove(-1);
      });
    document
      .getElementById("preview-3d-back")
      ?.addEventListener("mouseup", () => {
        this.stopPreviewMove();
      });
    document
      .getElementById("preview-3d-back")
      ?.addEventListener("mouseleave", () => {
        this.stopPreviewMove();
      });

    document
      .getElementById("preview-3d-forward")
      ?.addEventListener("mousedown", () => {
        this.startPreviewMove(1);
      });
    document
      .getElementById("preview-3d-forward")
      ?.addEventListener("mouseup", () => {
        this.stopPreviewMove();
      });
    document
      .getElementById("preview-3d-forward")
      ?.addEventListener("mouseleave", () => {
        this.stopPreviewMove();
      });
  }

  private rebuild3dPreview(resetPosition: boolean = false): void {
    this.preview3dTrack = new Track(this.trackData);
    if (resetPosition) {
      this.preview3dPosition = 0;
    } else {
      // Clamp position to new track length
      if (this.preview3dPosition >= this.preview3dTrack.trackLength) {
        this.preview3dPosition = 0;
      }
    }
    this.updatePreviewPosition();
    this.requestPreviewRender();
    // Auto-save whenever track changes
    saveTrackData(this.trackData);
  }

  private startPreviewMove(direction: number): void {
    this.preview3dAnimating = true;
    const move = () => {
      if (!this.preview3dAnimating || !this.preview3dTrack) return;

      this.preview3dPosition +=
        direction * this.preview3dTrack.segmentLength * 0.5;

      // Wrap around
      if (this.preview3dPosition >= this.preview3dTrack.trackLength) {
        this.preview3dPosition -= this.preview3dTrack.trackLength;
      }
      if (this.preview3dPosition < 0) {
        this.preview3dPosition += this.preview3dTrack.trackLength;
      }

      this.updatePreviewPosition();
      requestAnimationFrame(move);
    };
    move();
  }

  private stopPreviewMove(): void {
    this.preview3dAnimating = false;
  }

  private updatePreviewPosition(): void {
    if (!this.preview3dTrack) return;

    const percent = Math.round(
      (this.preview3dPosition / this.preview3dTrack.trackLength) * 100,
    );
    const posDisplay = document.getElementById("preview-3d-position");
    if (posDisplay) {
      posDisplay.textContent = `${percent}%`;
    }
  }

  private preview3dNeedsRender: boolean = true;

  private render3dPreview(): void {
    if (this.preview3dRenderer && this.preview3dTrack) {
      // Get player Y at current position
      const segment = this.preview3dTrack.getSegment(this.preview3dPosition);
      const percent =
        (this.preview3dPosition % this.preview3dTrack.segmentLength) /
        this.preview3dTrack.segmentLength;
      const playerY =
        segment.p1.world.y +
        (segment.p2.world.y - segment.p1.world.y) * percent;

      this.preview3dRenderer.render(
        this.preview3dTrack,
        this.preview3dPosition,
        0,
        playerY,
      );

      // Update 2D preview if player is moving
      if (this.preview3dAnimating) {
        this.render();
      }

      this.preview3dNeedsRender = false;
    }
  }

  private schedulePreviewRender(): void {
    requestAnimationFrame(() => {
      // Only render if animating or explicitly requested
      if (this.preview3dAnimating || this.preview3dNeedsRender) {
        this.render3dPreview();
      }
      this.schedulePreviewRender();
    });
  }

  private requestPreviewRender(): void {
    this.preview3dNeedsRender = true;
  }

  private setupCanvas(): void {
    const panel = this.canvas.parentElement;
    if (panel) {
      this.canvas.width = panel.clientWidth;
      this.canvas.height = panel.clientHeight;

      // Center track on first setup
      if (this.panX === 0 && this.panY === 0) {
        this.panX = this.canvas.width / 2;
        this.panY = this.canvas.height / 2;
      }

      this.render();
    }
  }

  private setupUI(): void {
    // Pieces list
    this.renderPiecesList();

    // Add piece button
    document.getElementById("add-piece-btn")?.addEventListener("click", () => {
      this.addPiece();
    });

    // Property controls
    const propType = document.getElementById("prop-type") as HTMLSelectElement;
    const propLength = document.getElementById(
      "prop-length",
    ) as HTMLInputElement;
    const propValue = document.getElementById("prop-value") as HTMLInputElement;

    propType?.addEventListener("change", () => {
      if (this.selectedPieceId) {
        const piece = this.getPiece(this.selectedPieceId);
        if (piece) {
          piece.type = propType.value as TrackPieceType;
          this.updateValueSliderRange(piece.type);
          this.renderPiecesList();
          this.render();
          this.rebuild3dPreview();
        }
      }
    });

    propLength?.addEventListener("input", () => {
      document.getElementById("prop-length-value")!.textContent =
        propLength.value;
      if (this.selectedPieceId) {
        const piece = this.getPiece(this.selectedPieceId);
        if (piece) {
          piece.length = parseInt(propLength.value);
          this.renderPiecesList();
          this.render();
          this.rebuild3dPreview();
        }
      }
    });

    propValue?.addEventListener("input", () => {
      document.getElementById("prop-value-value")!.textContent =
        propValue.value;
      if (this.selectedPieceId) {
        const piece = this.getPiece(this.selectedPieceId);
        if (piece) {
          piece.value = parseInt(propValue.value);
          this.renderPiecesList();
          this.render();
          this.rebuild3dPreview();
        }
      }
    });

    // Sprite palette
    this.renderSpritePalette();

    // Sprite offset
    const spriteOffset = document.getElementById(
      "sprite-offset",
    ) as HTMLInputElement;
    spriteOffset?.addEventListener("input", () => {
      this.spriteOffset = parseInt(spriteOffset.value) / 10;
      const valueEl = document.getElementById("sprite-offset-value");
      if (valueEl) {
        valueEl.textContent = this.spriteOffset.toFixed(1);
      }
      this.updateOffsetMarker();
    });

    // Initialize offset marker position
    this.updateOffsetMarker();

    // Sprite editor controls
    this.setupSpriteEditor();

    // Canvas mouse events for panning, sprite placement, and player dragging
    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const worldX = (screenX - this.panX) / this.zoom;
        const worldY = (screenY - this.panY) / this.zoom;

        // Check if clicking on player marker
        const playerPoint = this.getPlayerTrackPoint();
        if (playerPoint) {
          const dist = Math.sqrt(
            (playerPoint.x - worldX) ** 2 + (playerPoint.y - worldY) ** 2,
          );
          if (dist < 15) {
            this.isDraggingPlayer = true;
            this.canvas.style.cursor = "grabbing";
            return;
          }
        }

        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldX = (screenX - this.panX) / this.zoom;
      const worldY = (screenY - this.panY) / this.zoom;

      if (this.isDraggingPlayer) {
        // Find nearest track segment to mouse
        let nearestSegment = -1;
        let nearestDist = Infinity;

        for (const point of this.trackPath) {
          const dist = Math.sqrt(
            (point.x - worldX) ** 2 + (point.y - worldY) ** 2,
          );
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestSegment = point.segmentIndex;
          }
        }

        if (nearestSegment >= 0 && this.preview3dTrack) {
          this.preview3dPosition =
            nearestSegment * this.preview3dTrack.segmentLength;
          this.updatePreviewPosition();
          this.render();
        }
      } else if (this.isPanning) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.panX += dx;
        this.panY += dy;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.render();
      } else {
        // Update cursor based on hover
        const playerPoint = this.getPlayerTrackPoint();
        if (playerPoint) {
          const dist = Math.sqrt(
            (playerPoint.x - worldX) ** 2 + (playerPoint.y - worldY) ** 2,
          );
          this.canvas.style.cursor = dist < 15 ? "grab" : "grab";
        }
      }
    });

    this.canvas.addEventListener("mouseup", (e) => {
      if (this.isDraggingPlayer) {
        this.isDraggingPlayer = false;
        this.canvas.style.cursor = "grab";
        return;
      }

      if (this.isPanning) {
        const dx = Math.abs(e.clientX - this.lastMouseX);
        const dy = Math.abs(e.clientY - this.lastMouseY);
        // Only place sprite if it was a click (not a drag)
        if (dx < 5 && dy < 5) {
          this.handleCanvasClick(e);
        }
      }
      this.isPanning = false;
    });

    this.canvas.addEventListener("mouseleave", () => {
      this.isPanning = false;
      this.isDraggingPlayer = false;
    });

    // Mouse wheel for zooming
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.1, Math.min(10, this.zoom * zoomFactor));

      // Zoom towards mouse position
      const zoomRatio = newZoom / this.zoom;
      this.panX = mouseX - (mouseX - this.panX) * zoomRatio;
      this.panY = mouseY - (mouseY - this.panY) * zoomRatio;

      this.zoom = newZoom;
      this.updateZoomDisplay();
      this.render();
    });

    // Zoom buttons
    document.getElementById("zoom-in")?.addEventListener("click", () => {
      this.setZoom(this.zoom * 1.25);
    });

    document.getElementById("zoom-out")?.addEventListener("click", () => {
      this.setZoom(this.zoom * 0.8);
    });

    document.getElementById("zoom-fit")?.addEventListener("click", () => {
      this.fitToView();
    });

    // Toolbar buttons
    document.getElementById("play-btn")?.addEventListener("click", () => {
      this.onPlay(this.trackData);
    });

    document.getElementById("save-btn")?.addEventListener("click", () => {
      saveTrackData(this.trackData);
      alert("Track saved!");
    });

    document.getElementById("load-btn")?.addEventListener("click", () => {
      const loaded = loadTrackData();
      if (loaded) {
        this.trackData = loaded;
        this.selectedPieceId = null;
        this.renderPiecesList();
        this.render();
        this.rebuild3dPreview();
        alert("Track loaded!");
      } else {
        alert("No saved track found.");
      }
    });

    document.getElementById("clear-btn")?.addEventListener("click", () => {
      if (confirm("Clear track and start fresh?")) {
        this.trackData = createDefaultTrackData();
        this.selectedPieceId = null;
        this.renderPiecesList();
        this.render();
        this.rebuild3dPreview();
      }
    });
  }

  private setZoom(newZoom: number): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;

    newZoom = Math.max(0.1, Math.min(10, newZoom));
    const zoomRatio = newZoom / this.zoom;

    this.panX = centerX - (centerX - this.panX) * zoomRatio;
    this.panY = centerY - (centerY - this.panY) * zoomRatio;

    this.zoom = newZoom;
    this.updateZoomDisplay();
    this.render();
  }

  private updateZoomDisplay(): void {
    const display = document.getElementById("zoom-level");
    if (display) {
      display.textContent = `${Math.round(this.zoom * 100)}%`;
    }
  }

  private fitToView(): void {
    // Calculate track bounds
    if (this.trackPath.length === 0) {
      this.buildTrackPath();
    }

    if (this.trackPath.length === 0) return;

    let minX = Infinity,
      maxX = -Infinity;
    let minY = Infinity,
      maxY = -Infinity;

    for (const point of this.trackPath) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }

    const trackWidth = maxX - minX + 100;
    const trackHeight = maxY - minY + 100;

    const scaleX = this.canvas.width / trackWidth;
    const scaleY = this.canvas.height / trackHeight;
    this.zoom = Math.min(scaleX, scaleY, 2);

    // Center the track
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    this.panX = this.canvas.width / 2 - centerX * this.zoom;
    this.panY = this.canvas.height / 2 - centerY * this.zoom;

    this.updateZoomDisplay();
    this.render();
  }

  private buildTrackPath(): void {
    this.trackPath = [];
    let x = 0;
    let y = 0;
    let baseElevation = 0;
    let angle = -Math.PI / 2; // Start heading "up" (negative Y direction)
    let segmentIndex = 0;
    const segmentScale = 2; // Pixels per segment in the preview

    for (const piece of this.trackData.pieces) {
      for (let i = 0; i < piece.length; i++) {
        // For curves, apply uniform turning across the entire piece
        if (piece.type === "curve") {
          // Constant turn rate for even curves
          // piece.value ranges roughly -10 to 10, scale to reasonable angle change
          const turnRate = piece.value * 0.003;
          angle += turnRate;
        }

        // Calculate elevation for this segment
        let elevation = baseElevation;

        // For hills, use enter/hold/exit pattern (matches Track.ts addHill)
        // Hill goes up to peak then back down to original level
        if (piece.type === "hill") {
          const enterCount = Math.floor(piece.length / 4);
          const holdCount = Math.floor(piece.length / 2);

          let hillOffset = 0;
          if (i < enterCount) {
            // Enter phase - gradually increase to peak
            hillOffset = (piece.value * i) / enterCount;
          } else if (i < enterCount + holdCount) {
            // Hold phase - maintain peak
            hillOffset = piece.value;
          } else {
            // Exit phase - gradually decrease back to base
            const exitI = i - enterCount - holdCount;
            const exitCount = piece.length - enterCount - holdCount;
            hillOffset = piece.value * (1 - exitI / exitCount);
          }
          elevation = baseElevation + hillOffset;
        }

        // Move forward in current direction
        x += Math.cos(angle) * segmentScale;
        y += Math.sin(angle) * segmentScale;

        this.trackPath.push({ x, y, elevation, segmentIndex });
        segmentIndex++;
      }
      // baseElevation stays the same after a hill (it returns to original level)
    }
  }

  private renderSpritePalette(): void {
    const palettes: Record<string, HTMLElement | null> = {
      trees: document.getElementById("sprite-palette-trees"),
      veg: document.getElementById("sprite-palette-veg"),
      objects: document.getElementById("sprite-palette-objects"),
      billboards: document.getElementById("sprite-palette-billboards"),
    };

    // Clear all palettes
    Object.values(palettes).forEach((p) => {
      if (p) p.innerHTML = "";
    });

    // Populate each category
    for (const sprite of SPRITE_INFO) {
      const palette = palettes[sprite.category];
      if (!palette) continue;

      const btn = document.createElement("button");
      btn.className =
        "sprite-btn" +
        (sprite.id === this.selectedSpriteType ? " selected" : "");
      btn.innerHTML = `<img class="sprite-icon" src="${sprite.path}" alt="${sprite.name}" />${sprite.name}`;
      btn.addEventListener("click", () => {
        this.selectedSpriteType = sprite.id as SpriteType;
        this.renderSpritePalette();
        this.updateSelectedSpriteName();
      });
      palette.appendChild(btn);
    }

    this.updateSelectedSpriteName();
  }

  private updateSelectedSpriteName(): void {
    const nameEl = document.getElementById("selected-sprite-name");
    if (nameEl) {
      const sprite = SPRITE_INFO.find((s) => s.id === this.selectedSpriteType);
      nameEl.textContent = sprite ? sprite.name : this.selectedSpriteType;
    }
  }

  private updateOffsetMarker(): void {
    const marker = document.getElementById("offset-marker");
    if (marker) {
      // Offset range is -2 to 2, map to 0-100%
      const percent = ((this.spriteOffset + 2) / 4) * 100;
      marker.style.left = `${percent}%`;
    }
  }

  private setupSpriteEditor(): void {
    // Close button
    document
      .getElementById("sprite-editor-close")
      ?.addEventListener("click", () => {
        this.deselectSprite();
      });

    // Offset slider for editing
    const editOffset = document.getElementById(
      "sprite-edit-offset",
    ) as HTMLInputElement;
    editOffset?.addEventListener("input", () => {
      if (this.selectedSpriteId) {
        const sprite = this.trackData.sprites.find(
          (s) => s.id === this.selectedSpriteId,
        );
        if (sprite) {
          sprite.offset = parseInt(editOffset.value) / 10;
          this.updateSpriteEditOffsetMarker(sprite.offset);
          this.render();
          this.rebuild3dPreview();
        }
      }
    });

    // Segment input for moving sprite
    const editSegment = document.getElementById(
      "sprite-edit-segment",
    ) as HTMLInputElement;
    editSegment?.addEventListener("change", () => {
      if (this.selectedSpriteId) {
        const sprite = this.trackData.sprites.find(
          (s) => s.id === this.selectedSpriteId,
        );
        if (sprite) {
          const maxSegment = this.trackPath.length - 1;
          let newSegment = parseInt(editSegment.value);
          newSegment = Math.max(0, Math.min(maxSegment, newSegment));
          sprite.segmentIndex = newSegment;
          editSegment.value = newSegment.toString();
          document.getElementById("sprite-editor-segment")!.textContent =
            newSegment.toString();
          this.renderSpriteList();
          this.render();
          this.rebuild3dPreview();
        }
      }
    });

    // Delete button
    document
      .getElementById("sprite-delete-btn")
      ?.addEventListener("click", () => {
        if (this.selectedSpriteId) {
          this.trackData.sprites = this.trackData.sprites.filter(
            (s) => s.id !== this.selectedSpriteId,
          );
          this.deselectSprite();
          this.renderSpriteList();
          this.render();
          this.rebuild3dPreview();
        }
      });
  }

  private selectSprite(id: string): void {
    this.selectedSpriteId = id;
    const sprite = this.trackData.sprites.find((s) => s.id === id);
    if (!sprite) return;

    const spriteInfo = SPRITE_INFO.find((s) => s.id === sprite.type);
    const path = spriteInfo?.path || "";
    const name = spriteInfo?.name || sprite.type.replace(/_/g, " ");

    // Show editor panel
    const editor = document.getElementById("sprite-editor");
    if (editor) {
      editor.style.display = "block";
    }

    // Populate editor
    const iconEl = document.getElementById("sprite-editor-icon");
    if (iconEl)
      iconEl.innerHTML = `<img src="${path}" alt="${name}" style="width: 32px; height: 32px; object-fit: contain;" />`;

    const nameEl = document.getElementById("sprite-editor-name");
    if (nameEl) nameEl.textContent = name;

    const segmentEl = document.getElementById("sprite-editor-segment");
    if (segmentEl) segmentEl.textContent = sprite.segmentIndex.toString();

    const offsetSlider = document.getElementById(
      "sprite-edit-offset",
    ) as HTMLInputElement;
    if (offsetSlider) {
      offsetSlider.value = (sprite.offset * 10).toString();
    }

    const segmentInput = document.getElementById(
      "sprite-edit-segment",
    ) as HTMLInputElement;
    if (segmentInput) {
      segmentInput.value = sprite.segmentIndex.toString();
      segmentInput.max = (this.trackPath.length - 1).toString();
    }

    this.updateSpriteEditOffsetMarker(sprite.offset);
    this.renderSpriteList();
    this.render();
  }

  private deselectSprite(): void {
    this.selectedSpriteId = null;
    const editor = document.getElementById("sprite-editor");
    if (editor) {
      editor.style.display = "none";
    }
    this.renderSpriteList();
    this.render();
  }

  private updateSpriteEditOffsetMarker(offset: number): void {
    const marker = document.getElementById("sprite-edit-offset-marker");
    if (marker) {
      // Offset range is -2 to 2, map to 0-100%
      const percent = ((offset + 2) / 4) * 100;
      marker.style.left = `${percent}%`;
    }
  }

  private getPlayerTrackPoint(): { x: number; y: number } | null {
    if (!this.preview3dTrack || this.trackPath.length === 0) return null;

    // Use track percentage to find segment index
    const trackPercent =
      this.preview3dPosition / this.preview3dTrack.trackLength;
    const segmentIndex = Math.floor(trackPercent * this.trackPath.length);
    const clampedIndex = Math.max(
      0,
      Math.min(segmentIndex, this.trackPath.length - 1),
    );

    return this.trackPath[clampedIndex] || null;
  }

  private renderPiecesList(): void {
    const list = document.getElementById("pieces-list");
    if (!list) return;

    list.innerHTML = "";
    for (const piece of this.trackData.pieces) {
      const div = document.createElement("div");
      div.className =
        "piece-item" + (piece.id === this.selectedPieceId ? " selected" : "");

      const typeLabel =
        piece.type === "straight"
          ? "Straight"
          : piece.type === "curve"
            ? `Curve (${piece.value > 0 ? "Right" : "Left"})`
            : `Hill (${piece.value > 0 ? "Up" : "Down"})`;

      div.innerHTML = `
        <div class="piece-type">${typeLabel}</div>
        <div class="piece-info">Length: ${piece.length} | Value: ${piece.value}</div>
        <div class="piece-actions">
          <button class="secondary move-up">Up</button>
          <button class="secondary move-down">Down</button>
          <button class="delete">Delete</button>
        </div>
      `;

      div.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).tagName !== "BUTTON") {
          this.selectPiece(piece.id);
        }
      });

      div.querySelector(".move-up")?.addEventListener("click", () => {
        this.movePiece(piece.id, -1);
      });

      div.querySelector(".move-down")?.addEventListener("click", () => {
        this.movePiece(piece.id, 1);
      });

      div.querySelector(".delete")?.addEventListener("click", () => {
        this.deletePiece(piece.id);
      });

      list.appendChild(div);
    }

    this.updateTrackInfo();
  }

  private updateTrackInfo(): void {
    const totalSegments = this.trackData.pieces.reduce(
      (sum, p) => sum + p.length,
      0,
    );
    const info = document.getElementById("track-info");
    if (info) {
      info.textContent = `${totalSegments} segments | ${this.trackData.sprites.length} sprites`;
    }
  }

  private selectPiece(id: string): void {
    this.selectedPieceId = id;
    const piece = this.getPiece(id);

    const propsPanel = document.getElementById("piece-properties");
    if (propsPanel && piece) {
      propsPanel.style.display = "block";

      const propType = document.getElementById(
        "prop-type",
      ) as HTMLSelectElement;
      const propLength = document.getElementById(
        "prop-length",
      ) as HTMLInputElement;
      const propValue = document.getElementById(
        "prop-value",
      ) as HTMLInputElement;

      propType.value = piece.type;
      propLength.value = piece.length.toString();
      document.getElementById("prop-length-value")!.textContent =
        piece.length.toString();

      this.updateValueSliderRange(piece.type);
      propValue.value = piece.value.toString();
      document.getElementById("prop-value-value")!.textContent =
        piece.value.toString();
    }

    this.renderPiecesList();
    this.render();
  }

  private updateValueSliderRange(type: TrackPieceType): void {
    const propValue = document.getElementById("prop-value") as HTMLInputElement;
    const valueLabel = document.getElementById("value-label");
    const valueGroup = document.getElementById("value-group");

    if (type === "straight") {
      valueGroup!.style.display = "none";
    } else {
      valueGroup!.style.display = "block";
      if (type === "curve") {
        propValue.min = "-10";
        propValue.max = "10";
        valueLabel!.textContent = "Curve Intensity (- = left, + = right)";
      } else {
        propValue.min = "-200";
        propValue.max = "200";
        valueLabel!.textContent = "Hill Height (- = down, + = up)";
      }
    }
  }

  private getPiece(id: string): TrackPiece | undefined {
    return this.trackData.pieces.find((p) => p.id === id);
  }

  private addPiece(): void {
    const newPiece: TrackPiece = {
      id: generateId(),
      type: "straight",
      length: 50,
      value: 0,
    };
    this.trackData.pieces.push(newPiece);
    this.selectPiece(newPiece.id);
    this.render();
    this.rebuild3dPreview();
  }

  private deletePiece(id: string): void {
    const index = this.trackData.pieces.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.trackData.pieces.splice(index, 1);
      if (this.selectedPieceId === id) {
        this.selectedPieceId = null;
        document.getElementById("piece-properties")!.style.display = "none";
      }
      this.renderPiecesList();
      this.render();
      this.rebuild3dPreview();
    }
  }

  private movePiece(id: string, direction: number): void {
    const index = this.trackData.pieces.findIndex((p) => p.id === id);
    const newIndex = index + direction;

    if (newIndex >= 0 && newIndex < this.trackData.pieces.length) {
      const piece = this.trackData.pieces.splice(index, 1)[0];
      this.trackData.pieces.splice(newIndex, 0, piece);
      this.renderPiecesList();
      this.render();
      this.rebuild3dPreview();
    }
  }

  private handleCanvasClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates (accounting for zoom and pan)
    const worldX = (screenX - this.panX) / this.zoom;
    const worldY = (screenY - this.panY) / this.zoom;

    // First check if clicking on an existing sprite
    let clickedSprite: PlacedSprite | null = null;
    let clickedSpriteDist = Infinity;

    for (const sprite of this.trackData.sprites) {
      const point = this.trackPath[sprite.segmentIndex];
      if (point) {
        const spriteX = point.x + sprite.offset * 15;
        const spriteY = point.y;
        const dist = Math.sqrt(
          (spriteX - worldX) ** 2 + (spriteY - worldY) ** 2,
        );
        if (dist < 10 && dist < clickedSpriteDist) {
          clickedSpriteDist = dist;
          clickedSprite = sprite;
        }
      }
    }

    if (clickedSprite) {
      // Toggle selection
      if (this.selectedSpriteId === clickedSprite.id) {
        this.deselectSprite();
      } else {
        this.selectSprite(clickedSprite.id);
      }
      return;
    }

    // Find nearest track segment to place new sprite
    let nearestSegment = -1;
    let nearestDist = Infinity;

    for (const point of this.trackPath) {
      const dist = Math.sqrt((point.x - worldX) ** 2 + (point.y - worldY) ** 2);
      if (dist < nearestDist && dist < 30 / this.zoom) {
        nearestDist = dist;
        nearestSegment = point.segmentIndex;
      }
    }

    if (nearestSegment >= 0) {
      const sprite: PlacedSprite = {
        id: generateId(),
        segmentIndex: nearestSegment,
        type: this.selectedSpriteType,
        offset: this.spriteOffset,
      };
      this.trackData.sprites.push(sprite);
      this.renderSpriteList();
      this.render();
      this.rebuild3dPreview();
    }
  }

  private renderSpriteList(): void {
    const list = document.getElementById("sprite-list");
    if (!list) return;

    // Update sprite count
    const countEl = document.getElementById("sprite-count");
    if (countEl) {
      countEl.textContent = `${this.trackData.sprites.length} placed`;
    }

    // Clear list but keep the header
    const items = list.querySelectorAll(".sprite-item");
    items.forEach((item) => item.remove());

    for (const sprite of this.trackData.sprites) {
      const spriteInfo = SPRITE_INFO.find((s) => s.id === sprite.type);
      const path = spriteInfo?.path || "";
      const name = spriteInfo?.name || sprite.type.replace(/_/g, " ");

      const div = document.createElement("div");
      div.className =
        "sprite-item" +
        (sprite.id === this.selectedSpriteId ? " selected" : "");
      div.innerHTML = `
        <div class="sprite-item-info">
          <img class="sprite-item-icon" src="${path}" alt="${name}" />
          <span>${name} @ ${sprite.segmentIndex}</span>
        </div>
        <button data-id="${sprite.id}">Remove</button>
      `;

      // Click to select (but not on the remove button)
      div.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).tagName !== "BUTTON") {
          if (this.selectedSpriteId === sprite.id) {
            this.deselectSprite();
          } else {
            this.selectSprite(sprite.id);
          }
        }
      });

      div.querySelector("button")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.trackData.sprites = this.trackData.sprites.filter(
          (s) => s.id !== sprite.id,
        );
        if (this.selectedSpriteId === sprite.id) {
          this.deselectSprite();
        }
        this.renderSpriteList();
        this.render();
        this.rebuild3dPreview();
      });
      list.appendChild(div);
    }

    this.updateTrackInfo();
  }

  render(): void {
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear canvas
    ctx.fillStyle = "#0f0f23";
    ctx.fillRect(0, 0, width, height);

    // Build track path (in local coordinates, starting at 0,0)
    this.buildTrackPath();

    if (this.trackPath.length === 0) {
      this.renderSpriteList();
      return;
    }

    // Apply zoom and pan transform
    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Draw track background (wider, darker)
    ctx.strokeStyle = "#3a3a5a";
    ctx.lineWidth = 28;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (const point of this.trackPath) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    // Draw main track
    ctx.strokeStyle = "#6b6b6b";
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (const point of this.trackPath) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();

    // Draw selected piece highlight
    if (this.selectedPieceId) {
      let startIdx = 0;
      for (const piece of this.trackData.pieces) {
        if (piece.id === this.selectedPieceId) {
          const endIdx = startIdx + piece.length;
          ctx.strokeStyle = "#e94560";
          ctx.lineWidth = 26;
          ctx.beginPath();

          const startPoint =
            startIdx === 0 ? { x: 0, y: 0 } : this.trackPath[startIdx - 1];
          ctx.moveTo(startPoint.x, startPoint.y);

          for (let i = startIdx; i < endIdx && i < this.trackPath.length; i++) {
            ctx.lineTo(this.trackPath[i].x, this.trackPath[i].y);
          }
          ctx.stroke();
          break;
        }
        startIdx += piece.length;
      }
    }

    // Draw elevation indicators for hills
    let pathIdx = 0;
    for (const piece of this.trackData.pieces) {
      if (piece.type === "hill") {
        for (
          let i = 0;
          i < piece.length && pathIdx < this.trackPath.length;
          i++
        ) {
          const point = this.trackPath[pathIdx];
          const hillColor = piece.value > 0 ? "#4ecdc4" : "#ff6b6b";
          ctx.fillStyle = hillColor;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          pathIdx++;
        }
      } else {
        pathIdx += piece.length;
      }
    }

    // Draw sprites as colored dots
    for (const sprite of this.trackData.sprites) {
      const point = this.trackPath[sprite.segmentIndex];
      if (point) {
        const isSelected = sprite.id === this.selectedSpriteId;
        ctx.fillStyle = isSelected ? "#fff" : "#10ac84";
        ctx.beginPath();
        ctx.arc(
          point.x + sprite.offset * 15,
          point.y,
          isSelected ? 8 : 6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.strokeStyle = isSelected ? "#10ac84" : "#fff";
        ctx.lineWidth = isSelected ? 3 : 1;
        ctx.stroke();
      }
    }

    // Draw start line
    ctx.strokeStyle = "#10ac84";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(25, 0);
    ctx.stroke();

    // Draw start marker
    ctx.fillStyle = "#10ac84";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Draw "START" label
    ctx.fillStyle = "#10ac84";
    ctx.font = "bold 12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("START", 0, -15);

    // Draw finish line and marker at end of track
    if (this.trackPath.length > 0) {
      const endPoint = this.trackPath[this.trackPath.length - 1];

      // Finish line
      ctx.strokeStyle = "#e94560";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(endPoint.x - 25, endPoint.y);
      ctx.lineTo(endPoint.x + 25, endPoint.y);
      ctx.stroke();

      // Finish marker
      ctx.fillStyle = "#e94560";
      ctx.beginPath();
      ctx.arc(endPoint.x, endPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();

      // Draw "FINISH" label
      ctx.fillStyle = "#e94560";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FINISH", endPoint.x, endPoint.y - 15);
    }

    // Draw player position marker
    const playerPoint = this.getPlayerTrackPoint();
    if (playerPoint) {
      ctx.fillStyle = "#e94560";
      ctx.beginPath();
      ctx.arc(playerPoint.x, playerPoint.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    // Draw instructions overlay
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      "Scroll to zoom | Drag to pan | Click to place sprite",
      10,
      height - 10,
    );

    this.renderSpriteList();
    this.renderElevation();
  }

  private renderElevation(): void {
    if (
      !this.elevationCanvas ||
      !this.elevationCtx ||
      this.trackPath.length === 0
    )
      return;

    const ctx = this.elevationCtx;
    const width = this.elevationCanvas.width;
    const height = this.elevationCanvas.height;

    // Clear canvas
    ctx.fillStyle = "#0a0a1a";
    ctx.fillRect(0, 0, width, height);

    // Calculate elevation bounds
    let minElev = 0;
    let maxElev = 0;
    for (const point of this.trackPath) {
      minElev = Math.min(minElev, point.elevation);
      maxElev = Math.max(maxElev, point.elevation);
    }

    // Add padding to elevation range
    const elevRange = Math.max(maxElev - minElev, 100); // minimum range of 100
    const padding = elevRange * 0.2;
    minElev -= padding;
    maxElev += padding;

    const margin = { top: 25, bottom: 15, left: 10, right: 10 };
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;

    // Draw zero line
    const zeroY = margin.top + graphHeight * (maxElev / (maxElev - minElev));
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(margin.left, zeroY);
    ctx.lineTo(width - margin.right, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw elevation profile
    ctx.strokeStyle = "#4ecdc4";
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < this.trackPath.length; i++) {
      const point = this.trackPath[i];
      const x = margin.left + (i / (this.trackPath.length - 1)) * graphWidth;
      const y =
        margin.top +
        graphHeight * ((maxElev - point.elevation) / (maxElev - minElev));

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();

    // Fill under the curve
    ctx.lineTo(width - margin.right, zeroY);
    ctx.lineTo(margin.left, zeroY);
    ctx.closePath();
    ctx.fillStyle = "rgba(78, 205, 196, 0.15)";
    ctx.fill();

    // Draw selected piece highlight on elevation
    if (this.selectedPieceId) {
      let startIdx = 0;
      for (const piece of this.trackData.pieces) {
        if (piece.id === this.selectedPieceId) {
          const endIdx = Math.min(
            startIdx + piece.length,
            this.trackPath.length,
          );

          // Highlight bar
          const startX =
            margin.left + (startIdx / (this.trackPath.length - 1)) * graphWidth;
          const endX =
            margin.left +
            ((endIdx - 1) / (this.trackPath.length - 1)) * graphWidth;

          ctx.fillStyle = "rgba(233, 69, 96, 0.3)";
          ctx.fillRect(startX, margin.top, endX - startX, graphHeight);

          // Draw highlighted portion of elevation line
          ctx.strokeStyle = "#e94560";
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let i = startIdx; i < endIdx; i++) {
            const point = this.trackPath[i];
            const x =
              margin.left + (i / (this.trackPath.length - 1)) * graphWidth;
            const y =
              margin.top +
              graphHeight * ((maxElev - point.elevation) / (maxElev - minElev));

            if (i === startIdx) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
          break;
        }
        startIdx += piece.length;
      }
    }

    // Draw player position marker
    if (this.preview3dTrack && this.trackPath.length > 0) {
      // Use the same percentage as the 3D preview position display
      const trackPercent =
        this.preview3dPosition / this.preview3dTrack.trackLength;
      const segmentIndex = Math.floor(trackPercent * this.trackPath.length);
      const clampedIndex = Math.max(
        0,
        Math.min(segmentIndex, this.trackPath.length - 1),
      );

      const point = this.trackPath[clampedIndex];
      // X position based on track percentage, not segment index
      const x = margin.left + trackPercent * graphWidth;
      const y =
        margin.top +
        graphHeight * ((maxElev - point.elevation) / (maxElev - minElev));

      // Vertical line
      ctx.strokeStyle = "#e94560";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + graphHeight);
      ctx.stroke();

      // Marker dot
      ctx.fillStyle = "#e94560";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}
