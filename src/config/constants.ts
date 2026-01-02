/**
 * Game Constants
 * Centralized configuration for all magic numbers and game settings
 */

// =============================================================================
// RENDERING
// =============================================================================

export const RENDER: {
  RETRO_WIDTH: number;
  RETRO_HEIGHT: number;
  DRAW_DISTANCE: number;
  SPRITE_SCALE: number;
} = {
  /** Internal rendering width (retro resolution) */
  RETRO_WIDTH: 640,
  /** Internal rendering height (retro resolution) */
  RETRO_HEIGHT: 480,
  /** Number of road segments to render ahead */
  DRAW_DISTANCE: 350,
  /** Global sprite scale multiplier */
  SPRITE_SCALE: 4.0,
};

// =============================================================================
// CAMERA
// =============================================================================

export const CAMERA: {
  HEIGHT: number;
  DEPTH: number;
  ROAD_WIDTH: number;
} = {
  /** Camera height above the road */
  HEIGHT: 1000,
  /** Perspective depth factor (affects FOV) */
  DEPTH: 0.84,
  /** Road width in world units */
  ROAD_WIDTH: 2000,
};

// =============================================================================
// ROAD GEOMETRY
// =============================================================================

export const ROAD: {
  SEGMENT_LENGTH: number;
  RUMBLE_LENGTH: number;
  RUMBLE_WIDTH_RATIO: number;
  LANE_WIDTH_RATIO: number;
  LANE_POSITION_RATIO: number;
} = {
  /** Length of each road segment in world units */
  SEGMENT_LENGTH: 200,
  /** Number of segments per rumble strip color band */
  RUMBLE_LENGTH: 3,
  /** Rumble strip width as ratio of road width */
  RUMBLE_WIDTH_RATIO: 1 / 8,
  /** Lane marker width as ratio of road width */
  LANE_WIDTH_RATIO: 1 / 32,
  /** Lane marker position as ratio of road width from center */
  LANE_POSITION_RATIO: 1 / 3,
};

// =============================================================================
// PHYSICS
// =============================================================================

export const PHYSICS = {
  /** Default maximum speed */
  DEFAULT_MAX_SPEED: 600,
  /** Default acceleration rate */
  DEFAULT_ACCEL: 2,
  /** Default deceleration rate */
  DEFAULT_DECEL: 0.5,
  /** Default off-road deceleration rate */
  DEFAULT_OFF_ROAD_DECEL: 1,
  /** Default off-road maximum speed */
  DEFAULT_OFF_ROAD_MAX_SPEED: 200,
  /** Default centrifugal force multiplier */
  DEFAULT_CENTRIFUGAL_FORCE: 0.9,
  /** Default steering rate */
  DEFAULT_STEERING_RATE: 3.0,
  /** Default steering speed scale (reduces steering at high speed) */
  DEFAULT_STEERING_SPEED_SCALE: 0.5,
  /** Gravity for vertical movement */
  GRAVITY: 5000,
  /** Maximum curve influence to prevent extreme forces */
  MAX_CURVE_INFLUENCE: 5,
  /** Player position bounds (left/right of road) */
  PLAYER_BOUNDS: 2,
  /** Off-road threshold (absolute X position) */
  OFF_ROAD_THRESHOLD: 1.0,
  /** Off-road acceleration reduction factor */
  OFF_ROAD_ACCEL_REDUCTION: 0.7,
};

// =============================================================================
// FOG
// =============================================================================

export const FOG = {
  /** Default fog density (0-10 scale) */
  DEFAULT_DENSITY: 5,
  /** Distance at which fog starts (in segments) */
  START_DISTANCE: 50,
  /** Base multiplier for fog end distance calculation */
  END_DISTANCE_MULTIPLIER: 1.1,
};

// =============================================================================
// PLAYER CAR
// =============================================================================

export const PLAYER = {
  /** Car scale relative to screen width */
  SCALE_BASE: 320,
  /** Car vertical offset from bottom of screen */
  BOTTOM_OFFSET: 5,
  /** Fallback car width when sprite not loaded */
  FALLBACK_WIDTH: 55,
  /** Fallback car height when sprite not loaded */
  FALLBACK_HEIGHT: 28,
};

// =============================================================================
// HUD
// =============================================================================

export const HUD = {
  /** Maximum displayed speed in MPH */
  MAX_DISPLAY_SPEED: 120,
};

// =============================================================================
// EDITOR
// =============================================================================

export const EDITOR = {
  /** 2D preview segment scale in pixels */
  SEGMENT_SCALE: 2,
  /** Curve visibility factor for 2D preview */
  CURVE_FACTOR: 0.15,
  /** Curve accumulation factor for 2D preview */
  CURVE_ACCUMULATION: 0.1,
  /** Click detection radius for sprites */
  SPRITE_CLICK_RADIUS: 10,
  /** Click detection radius for track path */
  TRACK_CLICK_RADIUS: 30,
  /** Player marker radius */
  PLAYER_MARKER_RADIUS: 15,
  /** Sprite visual offset multiplier */
  SPRITE_OFFSET_MULTIPLIER: 15,
  /** 3D preview canvas width */
  PREVIEW_3D_WIDTH: 480,
  /** 3D preview canvas height */
  PREVIEW_3D_HEIGHT: 272,
};

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
  TRACK_DATA: "raceTrackData",
  PHYSICS_SETTINGS: "race_physics_settings",
  SPRITE_SHEETS: "race_sprite_sheets",
};

// =============================================================================
// SPRITE PLACEMENT (for procedural track generation)
// =============================================================================

export const SPRITE_PLACEMENT = {
  /** Tree placement interval (every N segments) */
  TREE_INTERVAL_LEFT: 12,
  TREE_INTERVAL_RIGHT: 15,
  /** Bush placement interval */
  BUSH_INTERVAL_LEFT: 20,
  BUSH_INTERVAL_RIGHT: 25,
  /** Column/post placement interval */
  COLUMN_INTERVAL: 30,
  /** Rock placement interval */
  ROCK_INTERVAL: 40,
  /** Billboard placement interval */
  BILLBOARD_INTERVAL: 80,
  /** Offset ranges for roadside objects */
  OFFSETS: {
    TREE_BASE: 1.3,
    TREE_RANDOM: 0.5,
    BUSH_BASE: 1.15,
    BUSH_RANDOM: 0.2,
    COLUMN: 1.1,
    ROCK_BASE: 1.5,
    ROCK_RANDOM: 0.3,
    BILLBOARD_BASE: 1.4,
    BILLBOARD_RANDOM: 0.3,
  },
};
