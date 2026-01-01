// Sprite sheet data types and storage

export interface SpriteDefinition {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpriteSheetData {
  path: string;
  sprites: SpriteDefinition[];
}

export interface AllSpriteSheets {
  sheets: Record<string, SpriteSheetData>;
}

const SPRITE_SHEETS_STORAGE_KEY = "race_sprite_sheets";

// Available sprite sheets in the game
export const AVAILABLE_SPRITE_SHEETS = [
  { name: "Car", path: "/src/images/car.png" },
  { name: "Sprites (Combined)", path: "/src/images/sprites.png" },
  { name: "Palm Tree", path: "/src/images/sprites/palm_tree.png" },
  { name: "Tree 1", path: "/src/images/sprites/tree1.png" },
  { name: "Tree 2", path: "/src/images/sprites/tree2.png" },
  { name: "Dead Tree 1", path: "/src/images/sprites/dead_tree1.png" },
  { name: "Dead Tree 2", path: "/src/images/sprites/dead_tree2.png" },
  { name: "Bush 1", path: "/src/images/sprites/bush1.png" },
  { name: "Bush 2", path: "/src/images/sprites/bush2.png" },
  { name: "Cactus", path: "/src/images/sprites/cactus.png" },
  { name: "Stump", path: "/src/images/sprites/stump.png" },
  { name: "Boulder 1", path: "/src/images/sprites/boulder1.png" },
  { name: "Boulder 2", path: "/src/images/sprites/boulder2.png" },
  { name: "Boulder 3", path: "/src/images/sprites/boulder3.png" },
  { name: "Column", path: "/src/images/sprites/column.png" },
  { name: "Billboard 01", path: "/src/images/sprites/billboard01.png" },
  { name: "Billboard 02", path: "/src/images/sprites/billboard02.png" },
  { name: "Billboard 03", path: "/src/images/sprites/billboard03.png" },
  { name: "Billboard 04", path: "/src/images/sprites/billboard04.png" },
  { name: "Billboard 05", path: "/src/images/sprites/billboard05.png" },
  { name: "Billboard 06", path: "/src/images/sprites/billboard06.png" },
  { name: "Billboard 07", path: "/src/images/sprites/billboard07.png" },
  { name: "Billboard 08", path: "/src/images/sprites/billboard08.png" },
  { name: "Billboard 09", path: "/src/images/sprites/billboard09.png" },
  { name: "Car 01", path: "/src/images/sprites/car01.png" },
  { name: "Car 02", path: "/src/images/sprites/car02.png" },
  { name: "Car 03", path: "/src/images/sprites/car03.png" },
  { name: "Car 04", path: "/src/images/sprites/car04.png" },
  { name: "Truck", path: "/src/images/sprites/truck.png" },
  { name: "Semi", path: "/src/images/sprites/semi.png" },
];

export function saveSpriteSheets(data: AllSpriteSheets): void {
  localStorage.setItem(SPRITE_SHEETS_STORAGE_KEY, JSON.stringify(data));
}

export function loadSpriteSheets(): AllSpriteSheets {
  const saved = localStorage.getItem(SPRITE_SHEETS_STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return { sheets: {} };
    }
  }
  return { sheets: {} };
}

export function getSpriteSheet(path: string): SpriteSheetData | null {
  const all = loadSpriteSheets();
  return all.sheets[path] || null;
}

export function saveSpriteSheet(path: string, data: SpriteSheetData): void {
  const all = loadSpriteSheets();
  all.sheets[path] = data;
  saveSpriteSheets(all);
}
