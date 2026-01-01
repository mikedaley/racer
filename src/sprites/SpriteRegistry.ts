/**
 * Sprite Registry
 * Single source of truth for all sprite definitions
 */

import { SpriteDefinition, SpriteCategory } from "./types";

// =============================================================================
// SPRITE REGISTRY
// =============================================================================

/**
 * Central registry of all available sprite types
 * This is the single source of truth - no other file should define sprites
 */
export const SPRITE_REGISTRY: Record<string, SpriteDefinition> = {
  // -------------------------------------------------------------------------
  // TREES
  // -------------------------------------------------------------------------
  palm_tree: {
    id: "palm_tree",
    name: "Palm Tree",
    category: "trees",
    path: "/images/sprites/palm_tree.png",
    scale: 1.0,
  },
  tree1: {
    id: "tree1",
    name: "Oak Tree",
    category: "trees",
    path: "/images/sprites/tree1.png",
    scale: 0.9,
  },
  tree2: {
    id: "tree2",
    name: "Pine Tree",
    category: "trees",
    path: "/images/sprites/tree2.png",
    scale: 0.8,
  },
  dead_tree1: {
    id: "dead_tree1",
    name: "Dead Tree 1",
    category: "trees",
    path: "/images/sprites/dead_tree1.png",
    scale: 0.7,
  },
  dead_tree2: {
    id: "dead_tree2",
    name: "Dead Tree 2",
    category: "trees",
    path: "/images/sprites/dead_tree2.png",
    scale: 0.6,
  },

  // -------------------------------------------------------------------------
  // VEGETATION
  // -------------------------------------------------------------------------
  bush1: {
    id: "bush1",
    name: "Bush",
    category: "vegetation",
    path: "/images/sprites/bush1.png",
    scale: 0.4,
  },
  bush2: {
    id: "bush2",
    name: "Shrub",
    category: "vegetation",
    path: "/images/sprites/bush2.png",
    scale: 0.4,
  },
  cactus: {
    id: "cactus",
    name: "Cactus",
    category: "vegetation",
    path: "/images/sprites/cactus.png",
    scale: 0.5,
  },
  stump: {
    id: "stump",
    name: "Stump",
    category: "vegetation",
    path: "/images/sprites/stump.png",
    scale: 0.4,
  },

  // -------------------------------------------------------------------------
  // OBJECTS
  // -------------------------------------------------------------------------
  boulder1: {
    id: "boulder1",
    name: "Boulder",
    category: "objects",
    path: "/images/sprites/boulder1.png",
    scale: 0.5,
  },
  boulder2: {
    id: "boulder2",
    name: "Rock",
    category: "objects",
    path: "/images/sprites/boulder2.png",
    scale: 0.5,
  },
  boulder3: {
    id: "boulder3",
    name: "Large Rock",
    category: "objects",
    path: "/images/sprites/boulder3.png",
    scale: 0.6,
  },
  column: {
    id: "column",
    name: "Column",
    category: "objects",
    path: "/images/sprites/column.png",
    scale: 0.8,
  },

  // -------------------------------------------------------------------------
  // BILLBOARDS
  // -------------------------------------------------------------------------
  billboard01: {
    id: "billboard01",
    name: "Sign 1",
    category: "billboards",
    path: "/images/sprites/billboard01.png",
    scale: 0.6,
  },
  billboard02: {
    id: "billboard02",
    name: "Sign 2",
    category: "billboards",
    path: "/images/sprites/billboard02.png",
    scale: 0.6,
  },
  billboard03: {
    id: "billboard03",
    name: "Sign 3",
    category: "billboards",
    path: "/images/sprites/billboard03.png",
    scale: 0.6,
  },
  billboard04: {
    id: "billboard04",
    name: "Sign 4",
    category: "billboards",
    path: "/images/sprites/billboard04.png",
    scale: 0.5,
  },
  billboard05: {
    id: "billboard05",
    name: "Sign 5",
    category: "billboards",
    path: "/images/sprites/billboard05.png",
    scale: 0.6,
  },
  billboard06: {
    id: "billboard06",
    name: "Sign 6",
    category: "billboards",
    path: "/images/sprites/billboard06.png",
    scale: 0.6,
  },
  billboard07: {
    id: "billboard07",
    name: "Sign 7",
    category: "billboards",
    path: "/images/sprites/billboard07.png",
    scale: 0.6,
  },
  billboard08: {
    id: "billboard08",
    name: "Sign 8",
    category: "billboards",
    path: "/images/sprites/billboard08.png",
    scale: 0.8,
  },
  billboard09: {
    id: "billboard09",
    name: "Sign 9",
    category: "billboards",
    path: "/images/sprites/billboard09.png",
    scale: 0.8,
  },

  // -------------------------------------------------------------------------
  // VEHICLES (for traffic - future use)
  // -------------------------------------------------------------------------
  car01: {
    id: "car01",
    name: "Car 1",
    category: "vehicles",
    path: "/images/sprites/car01.png",
    scale: 0.6,
  },
  car02: {
    id: "car02",
    name: "Car 2",
    category: "vehicles",
    path: "/images/sprites/car02.png",
    scale: 0.6,
  },
  car03: {
    id: "car03",
    name: "Car 3",
    category: "vehicles",
    path: "/images/sprites/car03.png",
    scale: 0.6,
  },
  car04: {
    id: "car04",
    name: "Car 4",
    category: "vehicles",
    path: "/images/sprites/car04.png",
    scale: 0.6,
  },
  truck: {
    id: "truck",
    name: "Truck",
    category: "vehicles",
    path: "/images/sprites/truck.png",
    scale: 0.8,
  },
  semi: {
    id: "semi",
    name: "Semi",
    category: "vehicles",
    path: "/images/sprites/semi.png",
    scale: 1.0,
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get a sprite definition by ID
 */
export function getSpriteById(id: string): SpriteDefinition | undefined {
  return SPRITE_REGISTRY[id];
}

/**
 * Get all sprites in a category
 */
export function getSpritesByCategory(
  category: SpriteCategory,
): SpriteDefinition[] {
  return Object.values(SPRITE_REGISTRY).filter((s) => s.category === category);
}

/**
 * Get all sprite IDs
 */
export function getAllSpriteIds(): string[] {
  return Object.keys(SPRITE_REGISTRY);
}

/**
 * Get all sprite definitions
 */
export function getAllSprites(): SpriteDefinition[] {
  return Object.values(SPRITE_REGISTRY);
}

/**
 * Get sprites suitable for roadside placement (excludes vehicles)
 */
export function getRoadsideSprites(): SpriteDefinition[] {
  return Object.values(SPRITE_REGISTRY).filter(
    (s) => s.category !== "vehicles",
  );
}

/**
 * Get sprite IDs by category for procedural placement
 */
export function getSpriteIdsByCategory(category: SpriteCategory): string[] {
  return getSpritesByCategory(category).map((s) => s.id);
}

/**
 * Check if a sprite ID is valid
 */
export function isValidSpriteId(id: string): boolean {
  return id in SPRITE_REGISTRY;
}

// =============================================================================
// CATEGORY LISTS (for convenience)
// =============================================================================

/** All tree sprite IDs */
export const TREE_SPRITES = getSpriteIdsByCategory("trees");

/** All vegetation sprite IDs */
export const VEGETATION_SPRITES = getSpriteIdsByCategory("vegetation");

/** All object sprite IDs */
export const OBJECT_SPRITES = getSpriteIdsByCategory("objects");

/** All billboard sprite IDs */
export const BILLBOARD_SPRITES = getSpriteIdsByCategory("billboards");

/** All vehicle sprite IDs */
export const VEHICLE_SPRITES = getSpriteIdsByCategory("vehicles");
