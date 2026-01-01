/**
 * Track Generation and Management
 * Handles building track segments with curves, hills, and sprite placement
 */

import { Segment, ScreenCoord, Sprite, SpriteType } from "../types/game";
import {
  TrackData,
  TrackPiece,
  PlacedSprite,
  generateId,
} from "../data/TrackData";

// Import from centralized config
import { ROAD, SPRITE_PLACEMENT } from "../config/constants";

// Import from sprite registry - use the pre-built category lists
import {
  TREE_SPRITES,
  VEGETATION_SPRITES,
  OBJECT_SPRITES,
  BILLBOARD_SPRITES,
} from "../sprites/SpriteRegistry";

// Legacy color format for segment colors (kept for compatibility with types.ts)
const COLORS = {
  LIGHT: {
    road: "#6b6b6b",
    grass: "#10aa10",
    rumble: "#ff0000",
    lane: "#cccccc",
  },
  DARK: {
    road: "#696969",
    grass: "#009a00",
    rumble: "#ffffff",
    lane: "#696969",
  },
};

export class Track {
  segments: Segment[] = [];
  segmentLength = ROAD.SEGMENT_LENGTH;
  rumbleLength = ROAD.RUMBLE_LENGTH;
  trackLength = 0;

  // Store current track pieces for export
  private currentPieces: TrackPiece[] = [];

  constructor(trackData?: TrackData) {
    if (trackData) {
      this.buildFromData(trackData);
    } else {
      this.buildTrack();
    }
  }

  /**
   * Export current track as TrackData
   */
  getTrackData(): TrackData {
    // Extract placed sprites from segments
    const sprites: PlacedSprite[] = [];
    for (let i = 0; i < this.segments.length; i++) {
      for (const sprite of this.segments[i].sprites) {
        sprites.push({
          id: generateId(),
          segmentIndex: i,
          type: sprite.type,
          offset: sprite.offset,
        });
      }
    }

    return {
      pieces: [...this.currentPieces],
      sprites,
    };
  }

  buildFromData(data: TrackData): void {
    this.segments = [];
    this.currentPieces = [...data.pieces]; // Store pieces for export

    // Build segments from track pieces
    for (const piece of data.pieces) {
      switch (piece.type) {
        case "straight":
          this.addStraight(piece.length);
          break;
        case "curve":
          this.addCurve(piece.length, piece.value);
          break;
        case "hill":
          this.addHill(piece.length, piece.value);
          break;
      }
    }

    // Ensure we have at least some segments
    if (this.segments.length === 0) {
      this.addStraight(100);
    }

    this.trackLength = this.segments.length * this.segmentLength;
    this.calculateYPositions();

    // Add placed sprites from data
    for (const sprite of data.sprites) {
      if (
        sprite.segmentIndex >= 0 &&
        sprite.segmentIndex < this.segments.length
      ) {
        this.segments[sprite.segmentIndex].sprites.push({
          type: sprite.type,
          offset: sprite.offset,
        });
      }
    }
  }

  private buildTrack(): void {
    this.buildRandomTrack();
  }

  /**
   * Generate a random procedural track
   */
  buildRandomTrack(): void {
    this.segments = [];
    this.currentPieces = []; // Reset pieces for export

    // Track generation parameters
    const minSections = 12;
    const maxSections = 20;
    const numSections =
      minSections + Math.floor(Math.random() * (maxSections - minSections));

    // Start with a straight section
    const startLength = 30 + Math.floor(Math.random() * 30);
    this.currentPieces.push({
      id: generateId(),
      type: "straight",
      length: startLength,
      value: 0,
    });
    this.addStraight(startLength);

    for (let i = 0; i < numSections; i++) {
      const sectionType = Math.random();

      if (sectionType < 0.3) {
        // Straight section (30%)
        const length = 30 + Math.floor(Math.random() * 50);
        this.currentPieces.push({
          id: generateId(),
          type: "straight",
          length,
          value: 0,
        });
        this.addStraight(length);
      } else if (sectionType < 0.6) {
        // Curve section (30%)
        const length = 30 + Math.floor(Math.random() * 50);
        const intensity = Math.random() * 6 - 3; // -3 to 3
        this.currentPieces.push({
          id: generateId(),
          type: "curve",
          length,
          value: intensity,
        });
        this.addCurve(length, intensity);
      } else if (sectionType < 0.85) {
        // Hill section (25%)
        const length = 40 + Math.floor(Math.random() * 80);
        const height = Math.random() * 300 - 150; // -150 to 150
        this.currentPieces.push({
          id: generateId(),
          type: "hill",
          length,
          value: height,
        });
        this.addHill(length, height);
      } else {
        // Combined curve + hill (15%) - store as two separate pieces for editor
        const length = 40 + Math.floor(Math.random() * 60);
        const curveIntensity = Math.random() * 4 - 2; // -2 to 2
        const hillHeight = Math.random() * 200 - 100; // -100 to 100
        this.currentPieces.push({
          id: generateId(),
          type: "curve",
          length: Math.floor(length / 2),
          value: curveIntensity,
        });
        this.currentPieces.push({
          id: generateId(),
          type: "hill",
          length: Math.floor(length / 2),
          value: hillHeight,
        });
        this.addCurveWithHill(length, curveIntensity, hillHeight);
      }
    }

    // End with a straight section
    const endLength = 40 + Math.floor(Math.random() * 40);
    this.currentPieces.push({
      id: generateId(),
      type: "straight",
      length: endLength,
      value: 0,
    });
    this.addStraight(endLength);

    this.trackLength = this.segments.length * this.segmentLength;
    this.calculateYPositions();
    this.addSprites();
  }

  /**
   * Add a section that curves and changes elevation simultaneously
   */
  private addCurveWithHill(count: number, curve: number, height: number): void {
    const enterCount = Math.floor(count / 4);
    const holdCount = Math.floor(count / 2);
    const exitCount = count - enterCount - holdCount;

    // Enter phase - gradually increase curve and hill
    for (let i = 0; i < enterCount; i++) {
      const t = i / enterCount;
      this.addSegment(curve * t, height * t);
    }
    // Hold phase - maintain curve and hill
    for (let i = 0; i < holdCount; i++) {
      this.addSegment(curve, height);
    }
    // Exit phase - gradually decrease
    for (let i = 0; i < exitCount; i++) {
      const t = 1 - i / exitCount;
      this.addSegment(curve * t, height * t);
    }
  }

  /**
   * Add procedural sprites along the track using sprite registry
   */
  private addSprites(): void {
    // Use sprite lists from registry
    const trees = TREE_SPRITES;
    const bushes = VEGETATION_SPRITES;
    const rocks = OBJECT_SPRITES.filter((id) => id.startsWith("boulder"));
    const billboards = BILLBOARD_SPRITES;

    const offsets = SPRITE_PLACEMENT.OFFSETS;

    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];

      // Add trees every few segments on both sides
      if (i % SPRITE_PLACEMENT.TREE_INTERVAL_LEFT === 0) {
        const type = trees[
          Math.floor(Math.random() * trees.length)
        ] as SpriteType;
        segment.sprites.push({
          type,
          offset: -(offsets.TREE_BASE + Math.random() * offsets.TREE_RANDOM),
        });
      }
      if (i % SPRITE_PLACEMENT.TREE_INTERVAL_RIGHT === 0) {
        const type = trees[
          Math.floor(Math.random() * trees.length)
        ] as SpriteType;
        segment.sprites.push({
          type,
          offset: offsets.TREE_BASE + Math.random() * offsets.TREE_RANDOM,
        });
      }

      // Add bushes/vegetation
      if (i % SPRITE_PLACEMENT.BUSH_INTERVAL_LEFT === 0) {
        const type = bushes[
          Math.floor(Math.random() * bushes.length)
        ] as SpriteType;
        segment.sprites.push({
          type,
          offset: -(offsets.BUSH_BASE + Math.random() * offsets.BUSH_RANDOM),
        });
      }
      if (i % SPRITE_PLACEMENT.BUSH_INTERVAL_RIGHT === 0) {
        const type = bushes[
          Math.floor(Math.random() * bushes.length)
        ] as SpriteType;
        segment.sprites.push({
          type,
          offset: offsets.BUSH_BASE + Math.random() * offsets.BUSH_RANDOM,
        });
      }

      // Add columns/posts along the road
      if (i % SPRITE_PLACEMENT.COLUMN_INTERVAL === 0) {
        segment.sprites.push({ type: "column", offset: -offsets.COLUMN });
        segment.sprites.push({ type: "column", offset: offsets.COLUMN });
      }

      // Occasional rocks
      if (i % SPRITE_PLACEMENT.ROCK_INTERVAL === 0 && rocks.length > 0) {
        const type = rocks[
          Math.floor(Math.random() * rocks.length)
        ] as SpriteType;
        segment.sprites.push({
          type,
          offset: -(offsets.ROCK_BASE + Math.random() * offsets.ROCK_RANDOM),
        });
      }

      // Billboards occasionally
      if (
        i % SPRITE_PLACEMENT.BILLBOARD_INTERVAL === 0 &&
        billboards.length > 0
      ) {
        const type = billboards[
          Math.floor(Math.random() * billboards.length)
        ] as SpriteType;
        const side = Math.random() > 0.5 ? 1 : -1;
        segment.sprites.push({
          type,
          offset:
            side *
            (offsets.BILLBOARD_BASE + Math.random() * offsets.BILLBOARD_RANDOM),
        });
      }
    }
  }

  private calculateYPositions(): void {
    let y = 0;
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      segment.p1.world.y = y;
      y += segment.hill;
      segment.p2.world.y = y;
    }
  }

  private addSegment(curve: number, hill: number): void {
    const n = this.segments.length;
    const color =
      Math.floor(n / this.rumbleLength) % 2 === 0 ? COLORS.LIGHT : COLORS.DARK;

    this.segments.push({
      index: n,
      p1: this.createScreenCoord(n),
      p2: this.createScreenCoord(n + 1),
      curve,
      hill,
      color,
      sprites: [],
    });
  }

  private createScreenCoord(index: number): ScreenCoord {
    return {
      world: { x: 0, y: 0, z: index * this.segmentLength },
      camera: { x: 0, y: 0, z: 0 },
      screen: { x: 0, y: 0, w: 0 },
      scale: 0,
    };
  }

  private addStraight(count: number): void {
    for (let i = 0; i < count; i++) {
      this.addSegment(0, 0);
    }
  }

  private addCurve(count: number, curve: number): void {
    const enterCount = Math.floor(count / 4);
    const holdCount = Math.floor(count / 2);
    const exitCount = count - enterCount - holdCount;

    for (let i = 0; i < enterCount; i++) {
      this.addSegment((curve * i) / enterCount, 0);
    }
    for (let i = 0; i < holdCount; i++) {
      this.addSegment(curve, 0);
    }
    for (let i = 0; i < exitCount; i++) {
      this.addSegment(curve * (1 - i / exitCount), 0);
    }
  }

  private addHill(count: number, height: number): void {
    const enterCount = Math.floor(count / 4);
    const holdCount = Math.floor(count / 2);
    const exitCount = count - enterCount - holdCount;

    for (let i = 0; i < enterCount; i++) {
      this.addSegment(0, (height * i) / enterCount);
    }
    for (let i = 0; i < holdCount; i++) {
      this.addSegment(0, height);
    }
    for (let i = 0; i < exitCount; i++) {
      this.addSegment(0, height * (1 - i / exitCount));
    }
  }

  getSegment(z: number): Segment {
    const index = Math.floor(z / this.segmentLength) % this.segments.length;
    return this.segments[index < 0 ? index + this.segments.length : index];
  }
}
