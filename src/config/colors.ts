/**
 * Color Definitions
 * Pre-parsed RGB values to avoid hex parsing in render loop
 */

// =============================================================================
// RGB Color Type
// =============================================================================

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface SegmentColorSet {
  road: RGB;
  grass: RGB;
  rumble: RGB;
  lane: RGB;
}

// =============================================================================
// ROAD SEGMENT COLORS
// =============================================================================

export const SEGMENT_COLORS = {
  LIGHT: {
    road: { r: 107, g: 107, b: 107 }, // #6b6b6b
    grass: { r: 16, g: 170, b: 16 }, // #10aa10
    rumble: { r: 255, g: 0, b: 0 }, // #ff0000
    lane: { r: 204, g: 204, b: 204 }, // #cccccc
  },
  DARK: {
    road: { r: 105, g: 105, b: 105 }, // #696969
    grass: { r: 0, g: 154, b: 0 }, // #009a00
    rumble: { r: 255, g: 255, b: 255 }, // #ffffff
    lane: { r: 105, g: 105, b: 105 }, // #696969 (same as road - invisible)
  },
} as const;

// =============================================================================
// FOG COLOR
// =============================================================================

export const FOG_COLOR: RGB = { r: 180, g: 180, b: 180 }; // Grey fog

// =============================================================================
// SKY GRADIENT
// Pre-parsed RGB values for the sunset sky bands (top to bottom)
// =============================================================================

export const SKY_GRADIENT: RGB[] = [
  { r: 13, g: 2, b: 24 }, // #0d0218 - Near black at top
  { r: 26, g: 5, b: 51 }, // #1a0533 - Deep purple
  { r: 26, g: 5, b: 51 }, // #1a0533 - Deep purple
  { r: 45, g: 27, b: 78 }, // #2d1b4e - Purple
  { r: 45, g: 27, b: 78 }, // #2d1b4e - Purple
  { r: 58, g: 24, b: 72 }, // #3a1848 - Purple-magenta
  { r: 74, g: 25, b: 66 }, // #4a1942 - Dark magenta
  { r: 92, g: 31, b: 62 }, // #5c1f3e - Magenta
  { r: 110, g: 38, b: 58 }, // #6e263a - Red-magenta
  { r: 123, g: 45, b: 62 }, // #7b2d3e - Deep red
  { r: 143, g: 53, b: 56 }, // #8f3538 - Red
  { r: 164, g: 61, b: 52 }, // #a43d34 - Red-orange
  { r: 184, g: 68, b: 48 }, // #b84430 - Orange-red
  { r: 204, g: 84, b: 40 }, // #cc5428 - Orange
  { r: 230, g: 115, b: 32 }, // #e67320 - Orange (matches fog)
  { r: 237, g: 138, b: 32 }, // #ed8a20 - Light orange
  { r: 244, g: 160, b: 32 }, // #f4a020 - Golden orange
  { r: 248, g: 184, b: 48 }, // #f8b830 - Golden
  { r: 252, g: 208, b: 72 }, // #fcd048 - Light golden
  { r: 255, g: 208, b: 96 }, // #ffd060 - Light golden
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert RGB to CSS color string
 */
export function rgbToString(color: RGB): string {
  return `rgb(${color.r},${color.g},${color.b})`;
}

/**
 * Blend two colors based on a factor (0 = color1, 1 = color2)
 */
export function blendColors(color1: RGB, color2: RGB, factor: number): RGB {
  return {
    r: Math.round(color1.r + (color2.r - color1.r) * factor),
    g: Math.round(color1.g + (color2.g - color1.g) * factor),
    b: Math.round(color1.b + (color2.b - color1.b) * factor),
  };
}

/**
 * Apply fog to a color and return CSS string
 */
export function applyFog(
  color: RGB,
  fogAmount: number,
  fogColor: RGB = FOG_COLOR,
): string {
  if (fogAmount <= 0) {
    return rgbToString(color);
  }
  const blended = blendColors(color, fogColor, fogAmount);
  return rgbToString(blended);
}

/**
 * Get segment colors based on segment index
 */
export function getSegmentColors(
  segmentIndex: number,
  rumbleLength: number,
): SegmentColorSet {
  const isLight = Math.floor(segmentIndex / rumbleLength) % 2 === 0;
  return isLight ? SEGMENT_COLORS.LIGHT : SEGMENT_COLORS.DARK;
}
