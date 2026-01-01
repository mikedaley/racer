/**
 * Sprite Type Definitions
 */

export type SpriteCategory =
  | "trees"
  | "vegetation"
  | "objects"
  | "billboards"
  | "vehicles";

export interface SpriteDefinition {
  id: string;
  name: string;
  category: SpriteCategory;
  path: string;
  scale: number;
}

export interface PlacedSprite {
  id: string;
  segmentIndex: number;
  type: string;
  offset: number;
}
