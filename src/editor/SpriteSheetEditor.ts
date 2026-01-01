// Sprite Sheet Editor - allows users to define sprite regions on sprite sheets

import {
  SpriteDefinition,
  SpriteSheetData,
  AVAILABLE_SPRITE_SHEETS,
  getSpriteSheet,
  saveSpriteSheet,
} from "../data/SpriteSheetData";

export class SpriteSheetEditor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLElement;

  // Current sprite sheet
  private currentSheetPath: string = "";
  private currentImage: HTMLImageElement | null = null;
  private sprites: SpriteDefinition[] = [];

  // View state
  private zoom: number = 1;
  private panX: number = 0;
  private panY: number = 0;
  private isPanning: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  // Selection state
  private isSelecting: boolean = false;
  private selectionStart: { x: number; y: number } | null = null;
  private selection: { x: number; y: number; w: number; h: number } | null =
    null;

  // DOM elements
  private sheetsListEl: HTMLElement;
  private spritesListEl: HTMLElement;
  private previewEl: HTMLElement;
  private xInput: HTMLInputElement;
  private yInput: HTMLInputElement;
  private wInput: HTMLInputElement;
  private hInput: HTMLInputElement;
  private nameInput: HTMLInputElement;
  private zoomLevelEl: HTMLElement;
  private zoomInfoEl: HTMLElement;

  constructor() {
    this.canvas = document.getElementById(
      "sprite-sheet-canvas",
    ) as HTMLCanvasElement;
    this.ctx = this.canvas.getContext("2d")!;
    this.container = document.getElementById(
      "sprite-canvas-panel",
    ) as HTMLElement;

    this.sheetsListEl = document.getElementById(
      "sprite-sheets-list",
    ) as HTMLElement;
    this.spritesListEl = document.getElementById(
      "saved-sprites-list",
    ) as HTMLElement;
    this.previewEl = document.getElementById(
      "sprite-selection-preview",
    ) as HTMLElement;
    this.xInput = document.getElementById("sprite-x") as HTMLInputElement;
    this.yInput = document.getElementById("sprite-y") as HTMLInputElement;
    this.wInput = document.getElementById("sprite-w") as HTMLInputElement;
    this.hInput = document.getElementById("sprite-h") as HTMLInputElement;
    this.nameInput = document.getElementById(
      "sprite-name-input",
    ) as HTMLInputElement;
    this.zoomLevelEl = document.getElementById(
      "sprite-zoom-level",
    ) as HTMLElement;
    this.zoomInfoEl = document.getElementById("zoom-info") as HTMLElement;

    this.setupEventListeners();
    this.populateSheetsList();
    this.resizeCanvas();
  }

  private setupEventListeners(): void {
    // Canvas mouse events
    this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
    this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
    this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));
    this.canvas.addEventListener("wheel", this.onWheel.bind(this));
    this.canvas.addEventListener("mouseleave", this.onMouseUp.bind(this));

    // Zoom controls
    document
      .getElementById("sprite-zoom-in")
      ?.addEventListener("click", () => this.setZoom(this.zoom * 1.5));
    document
      .getElementById("sprite-zoom-out")
      ?.addEventListener("click", () => this.setZoom(this.zoom / 1.5));
    document
      .getElementById("sprite-zoom-fit")
      ?.addEventListener("click", () => this.fitToView());

    // Coordinate inputs
    this.xInput.addEventListener("input", () => this.onCoordChange());
    this.yInput.addEventListener("input", () => this.onCoordChange());
    this.wInput.addEventListener("input", () => this.onCoordChange());
    this.hInput.addEventListener("input", () => this.onCoordChange());

    // Coordinate adjustment buttons
    document.querySelectorAll(".coord-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget as HTMLElement;
        const field = target.dataset.field;
        const delta = parseInt(target.dataset.delta || "0");
        if (field) {
          const input = document.getElementById(field) as HTMLInputElement;
          if (input) {
            input.value = String(
              Math.max(0, parseInt(input.value || "0") + delta),
            );
            this.onCoordChange();
          }
        }
      });
    });

    // Add sprite button
    document
      .getElementById("add-sprite-btn")
      ?.addEventListener("click", () => this.addSprite());

    // Save button
    document
      .getElementById("save-sprites-btn")
      ?.addEventListener("click", () => this.saveSprites());

    // Export button
    document
      .getElementById("export-sprites-btn")
      ?.addEventListener("click", () => this.exportJSON());

    // Back button
    document
      .getElementById("sprite-editor-back")
      ?.addEventListener("click", () => this.hide());

    // Window resize
    window.addEventListener("resize", () => this.resizeCanvas());
  }

  private populateSheetsList(): void {
    this.sheetsListEl.innerHTML = "";

    AVAILABLE_SPRITE_SHEETS.forEach((sheet) => {
      const item = document.createElement("div");
      item.className = "sheet-item";
      item.textContent = sheet.name;
      item.dataset.path = sheet.path;

      item.addEventListener("click", () => {
        document
          .querySelectorAll(".sheet-item")
          .forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");
        this.loadSheet(sheet.path);
      });

      this.sheetsListEl.appendChild(item);
    });
  }

  private loadSheet(path: string): void {
    this.currentSheetPath = path;

    // Load existing sprite definitions
    const saved = getSpriteSheet(path);
    this.sprites = saved?.sprites || [];

    // Load the image
    const img = new Image();
    img.onload = () => {
      this.currentImage = img;
      this.fitToView();
      this.render();
      this.updateSpritesList();
    };
    img.onerror = () => {
      console.error("Failed to load sprite sheet:", path);
      this.currentImage = null;
      this.render();
    };
    img.src = path;
  }

  private resizeCanvas(): void {
    const rect = this.container.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    this.render();
  }

  private setZoom(newZoom: number): void {
    this.zoom = Math.max(0.1, Math.min(10, newZoom));
    this.zoomLevelEl.textContent = `${Math.round(this.zoom * 100)}%`;
    this.updateZoomInfo();
    this.render();
  }

  private fitToView(): void {
    if (!this.currentImage) return;

    const padding = 40;
    const scaleX = (this.canvas.width - padding * 2) / this.currentImage.width;
    const scaleY =
      (this.canvas.height - padding * 2) / this.currentImage.height;
    this.zoom = Math.min(scaleX, scaleY, 1);

    // Center the image
    this.panX = (this.canvas.width - this.currentImage.width * this.zoom) / 2;
    this.panY = (this.canvas.height - this.currentImage.height * this.zoom) / 2;

    this.zoomLevelEl.textContent = `${Math.round(this.zoom * 100)}%`;
    this.updateZoomInfo();
    this.render();
  }

  private updateZoomInfo(): void {
    this.zoomInfoEl.textContent = `Zoom: ${Math.round(this.zoom * 100)}% | Pan: ${Math.round(this.panX)}, ${Math.round(this.panY)}`;
  }

  private screenToImage(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    return {
      x: Math.floor((canvasX - this.panX) / this.zoom),
      y: Math.floor((canvasY - this.panY) / this.zoom),
    };
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle button or Alt+Left click for panning
      this.isPanning = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.canvas.style.cursor = "grabbing";
    } else if (e.button === 0) {
      // Left click for selection
      const pos = this.screenToImage(e.clientX, e.clientY);
      if (
        this.currentImage &&
        pos.x >= 0 &&
        pos.x < this.currentImage.width &&
        pos.y >= 0 &&
        pos.y < this.currentImage.height
      ) {
        this.isSelecting = true;
        this.selectionStart = pos;
        this.selection = { x: pos.x, y: pos.y, w: 1, h: 1 };
        this.updateSelectionInputs();
      }
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;
      this.panX += dx;
      this.panY += dy;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.updateZoomInfo();
      this.render();
    } else if (this.isSelecting && this.selectionStart) {
      const pos = this.screenToImage(e.clientX, e.clientY);
      const minX = Math.min(this.selectionStart.x, pos.x);
      const minY = Math.min(this.selectionStart.y, pos.y);
      const maxX = Math.max(this.selectionStart.x, pos.x);
      const maxY = Math.max(this.selectionStart.y, pos.y);

      this.selection = {
        x: minX,
        y: minY,
        w: Math.max(1, maxX - minX + 1),
        h: Math.max(1, maxY - minY + 1),
      };
      this.updateSelectionInputs();
      this.render();
    }
  }

  private onMouseUp(_e: MouseEvent): void {
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = "crosshair";
    }
    if (this.isSelecting) {
      this.isSelecting = false;
      this.updatePreview();
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();

    // Get mouse position relative to image before zoom
    const pos = this.screenToImage(e.clientX, e.clientY);

    // Apply zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, this.zoom * zoomFactor));

    // Adjust pan to zoom towards mouse position
    this.panX -= pos.x * (newZoom - this.zoom);
    this.panY -= pos.y * (newZoom - this.zoom);
    this.zoom = newZoom;

    this.zoomLevelEl.textContent = `${Math.round(this.zoom * 100)}%`;
    this.updateZoomInfo();
    this.render();
  }

  private onCoordChange(): void {
    this.selection = {
      x: parseInt(this.xInput.value) || 0,
      y: parseInt(this.yInput.value) || 0,
      w: Math.max(1, parseInt(this.wInput.value) || 1),
      h: Math.max(1, parseInt(this.hInput.value) || 1),
    };
    this.updatePreview();
    this.render();
  }

  private updateSelectionInputs(): void {
    if (this.selection) {
      this.xInput.value = String(this.selection.x);
      this.yInput.value = String(this.selection.y);
      this.wInput.value = String(this.selection.w);
      this.hInput.value = String(this.selection.h);
    }
  }

  private updatePreview(): void {
    if (!this.selection || !this.currentImage) {
      this.previewEl.innerHTML =
        '<span style="color: #666; font-size: 12px;">No selection</span>';
      return;
    }

    // Create a temporary canvas to extract the selection
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = this.selection.w;
    tempCanvas.height = this.selection.h;
    const tempCtx = tempCanvas.getContext("2d")!;

    tempCtx.drawImage(
      this.currentImage,
      this.selection.x,
      this.selection.y,
      this.selection.w,
      this.selection.h,
      0,
      0,
      this.selection.w,
      this.selection.h,
    );

    const img = document.createElement("img");
    img.src = tempCanvas.toDataURL();
    this.previewEl.innerHTML = "";
    this.previewEl.appendChild(img);
  }

  private addSprite(): void {
    if (!this.selection) {
      alert("Please make a selection first");
      return;
    }

    const name = this.nameInput.value.trim();
    if (!name) {
      alert("Please enter a sprite name");
      return;
    }

    // Check for duplicate names
    if (this.sprites.some((s) => s.name === name)) {
      alert("A sprite with this name already exists");
      return;
    }

    this.sprites.push({
      name,
      x: this.selection.x,
      y: this.selection.y,
      w: this.selection.w,
      h: this.selection.h,
    });

    this.nameInput.value = "";
    this.updateSpritesList();
    this.render();
  }

  private updateSpritesList(): void {
    this.spritesListEl.innerHTML = "";

    this.sprites.forEach((sprite, index) => {
      const item = document.createElement("div");
      item.className = "saved-sprite-item";
      item.innerHTML = `
        <div class="sprite-info">
          <div class="sprite-name">${sprite.name}</div>
          <div class="sprite-coords">${sprite.x}, ${sprite.y} - ${sprite.w}x${sprite.h}</div>
        </div>
        <button data-index="${index}">Delete</button>
      `;

      // Click to select this sprite's region
      item.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).tagName !== "BUTTON") {
          this.selection = {
            x: sprite.x,
            y: sprite.y,
            w: sprite.w,
            h: sprite.h,
          };
          this.updateSelectionInputs();
          this.updatePreview();
          this.render();
        }
      });

      // Delete button
      const deleteBtn = item.querySelector("button");
      deleteBtn?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.sprites.splice(index, 1);
        this.updateSpritesList();
        this.render();
      });

      this.spritesListEl.appendChild(item);
    });
  }

  private saveSprites(): void {
    if (!this.currentSheetPath) {
      alert("Please select a sprite sheet first");
      return;
    }

    saveSpriteSheet(this.currentSheetPath, {
      path: this.currentSheetPath,
      sprites: this.sprites,
    });

    alert("Sprites saved successfully!");
  }

  private exportJSON(): void {
    if (!this.currentSheetPath || this.sprites.length === 0) {
      alert("No sprites to export");
      return;
    }

    const data: SpriteSheetData = {
      path: this.currentSheetPath,
      sprites: this.sprites,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${this.currentSheetPath
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "")}_sprites.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  private render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw checkerboard background for transparency
    const checkSize = 10;
    for (let y = 0; y < this.canvas.height; y += checkSize) {
      for (let x = 0; x < this.canvas.width; x += checkSize) {
        const isLight = (x / checkSize + y / checkSize) % 2 === 0;
        ctx.fillStyle = isLight ? "#2a2a3a" : "#1a1a2a";
        ctx.fillRect(x, y, checkSize, checkSize);
      }
    }

    if (!this.currentImage) {
      ctx.fillStyle = "#666";
      ctx.font = "16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Select a sprite sheet from the left panel",
        this.canvas.width / 2,
        this.canvas.height / 2,
      );
      return;
    }

    ctx.save();
    ctx.translate(this.panX, this.panY);
    ctx.scale(this.zoom, this.zoom);

    // Draw the sprite sheet
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.currentImage, 0, 0);

    // Draw saved sprite rectangles
    ctx.strokeStyle = "#10ac84";
    ctx.lineWidth = 1 / this.zoom;
    this.sprites.forEach((sprite) => {
      ctx.strokeRect(sprite.x, sprite.y, sprite.w, sprite.h);
    });

    // Draw current selection
    if (this.selection) {
      ctx.strokeStyle = "#e94560";
      ctx.lineWidth = 2 / this.zoom;
      ctx.setLineDash([4 / this.zoom, 4 / this.zoom]);
      ctx.strokeRect(
        this.selection.x,
        this.selection.y,
        this.selection.w,
        this.selection.h,
      );
      ctx.setLineDash([]);

      // Fill with semi-transparent
      ctx.fillStyle = "rgba(233, 69, 96, 0.1)";
      ctx.fillRect(
        this.selection.x,
        this.selection.y,
        this.selection.w,
        this.selection.h,
      );
    }

    ctx.restore();
  }

  public show(): void {
    document.getElementById("game-screen")?.classList.remove("active");
    document.getElementById("editor-screen")?.classList.remove("active");
    document.getElementById("sprite-editor-screen")?.classList.add("active");
    this.resizeCanvas();
    this.render();
  }

  public hide(): void {
    document.getElementById("sprite-editor-screen")?.classList.remove("active");
    document.getElementById("game-screen")?.classList.add("active");
  }
}
