export interface Sprite {
  type: SpriteType;
  offset: number; // -1 to 1, negative = left side, positive = right side
}

export type SpriteType =
  | "palm_tree"
  | "tree1"
  | "tree2"
  | "dead_tree1"
  | "dead_tree2"
  | "bush1"
  | "bush2"
  | "cactus"
  | "stump"
  | "boulder1"
  | "boulder2"
  | "boulder3"
  | "column"
  | "billboard01"
  | "billboard02"
  | "billboard03"
  | "billboard04"
  | "billboard05"
  | "billboard06"
  | "billboard07"
  | "billboard08"
  | "billboard09";

export interface Segment {
  index: number;
  p1: ScreenCoord;
  p2: ScreenCoord;
  curve: number;
  hill: number;
  color: SegmentColor;
  sprites: Sprite[];
}

export interface ScreenCoord {
  world: WorldCoord;
  camera: { x: number; y: number; z: number };
  screen: { x: number; y: number; w: number };
  scale: number;
}

export interface WorldCoord {
  x: number;
  y: number;
  z: number;
}

export interface SegmentColor {
  road: string;
  grass: string;
  rumble: string;
  lane: string;
}

export interface Player {
  x: number;
  speed: number;
  maxSpeed: number;
  accel: number;
  decel: number;
  offRoadDecel: number;
  offRoadMaxSpeed: number;
}

export interface GameState {
  position: number;
  player: Player;
}

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
}
