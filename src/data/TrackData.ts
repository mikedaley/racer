import { SpriteType } from "../types/game";

export type TrackPieceType = "straight" | "curve" | "hill";

export interface TrackPiece {
  id: string;
  type: TrackPieceType;
  length: number; // Number of segments
  value: number; // Curve intensity (-10 to 10) or hill height (-20 to 20)
}

export interface PlacedSprite {
  id: string;
  segmentIndex: number;
  type: SpriteType;
  offset: number; // -2 to 2
}

export interface TrackData {
  pieces: TrackPiece[];
  sprites: PlacedSprite[];
}

export function createDefaultTrackData(): TrackData {
  return {
    pieces: [
      { id: generateId(), type: "straight", length: 50, value: 0 },
      { id: generateId(), type: "curve", length: 50, value: 2 },
      { id: generateId(), type: "hill", length: 80, value: 50 },
      { id: generateId(), type: "straight", length: 50, value: 0 },
      { id: generateId(), type: "hill", length: 80, value: -50 },
    ],
    sprites: [],
  };
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function saveTrackData(data: TrackData): void {
  localStorage.setItem("raceTrackData", JSON.stringify(data));
}

export function loadTrackData(): TrackData | null {
  const saved = localStorage.getItem("raceTrackData");
  if (saved) {
    try {
      return JSON.parse(saved) as TrackData;
    } catch {
      return null;
    }
  }
  return null;
}
