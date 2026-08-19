/**
 * cameraProjections.ts
 * Unified camera projection functions for all Run-Out camera views.
 *
 * Every camera projects from the SAME canonical world-space coordinates (mm)
 * into its own screen-space. The world coordinate system is:
 *   Origin: base of middle stump
 *   X-axis: along pitch corridor (0 = stumps, 1220 = popping crease, >1220 = outfield)
 *   Y-axis: lateral across pitch (-ve = off-side, +ve = leg-side)
 *   Z-axis: vertical height above turf (0 = ground)
 */

/**
 * Phase 1 Broadcast Camera Projection (Square Leg Broadcast)
 * Side-on view with pitch running left-to-right.
 * Stumps are at screen-left (~24% of width), popping crease at ~42%.
 * Runner approaches from right, bat reaches left towards crease.
 *
 * World X maps to screen X (high worldX = far right on screen, low worldX = near stumps on left).
 * World Z maps to screen Y offset (higher Z = higher on screen).
 */
export function projectToPhase1(
  worldX: number,
  worldY: number,
  worldZ: number,
  canvasW: number,
  canvasH: number
): { screenX: number; screenY: number; scale: number } {
  // Pitch layout on canvas:
  // stumpsX = canvasW * 0.24 corresponds to worldX = 0 (stumps)
  // creaseX = canvasW * 0.42 corresponds to worldX = 1220mm (popping crease)
  const stumpsScreenX = canvasW * 0.24;
  const creaseScreenX = canvasW * 0.42;
  const pxPerMmX = (creaseScreenX - stumpsScreenX) / 1220;

  // worldX = 0 (stumps) maps to stumpsScreenX, worldX = 1220 maps to creaseScreenX
  const screenX = stumpsScreenX + worldX * pxPerMmX;

  // Base Y is the pitch surface line
  const pitchTopY = canvasH * 0.50;
  const stumpsBaseY = pitchTopY + 8;

  // worldZ raises the object above the pitch surface
  const pxPerMmZ = 0.06;
  const screenY = stumpsBaseY + 12 - worldZ * pxPerMmZ;

  const scale = 1.12;

  return { screenX, screenY, scale };
}

/**
 * CAM 01 Side-On Wide Projection
 * Wide-angle side-on view with pitch running left-to-right.
 * Stumps at screen X=120, popping crease at X=180.
 */
export function projectToCAM01(
  worldX: number,
  worldY: number,
  worldZ: number
): { screenX: number; screenY: number; scale: number } {
  // CAM 01 viewport is 500x320 SVG
  // Stumps at X=120 corresponds to worldX=0
  // Popping crease at X=180 corresponds to worldX=1220mm
  const stumpsScreenX = 120;
  const creaseScreenX = 180;
  const pxPerMmX = (creaseScreenX - stumpsScreenX) / 1220;

  const screenX = stumpsScreenX + worldX * pxPerMmX;

  // Pitch surface at Y=210 in CAM 01
  const pitchSurfaceY = 210;
  const pxPerMmZ = 0.053;
  const screenY = pitchSurfaceY - worldZ * pxPerMmZ;

  const scale = 1.0;

  return { screenX, screenY, scale };
}

/**
 * CAM 02 Crease 500fps Zoom Projection
 * Tight close-up side-on view centred on the popping crease.
 * Very high magnification.
 * Popping crease is at screenX = 250.
 */
export function projectToCAM02(
  worldX: number,
  worldY: number,
  worldZ: number
): { screenX: number; screenY: number; scale: number } {
  // CAM 02 viewport is 500x280 SVG
  // Crease line at screenX=250 corresponds to worldX=1220mm (popping crease)
  // Stumps at screenX=160 corresponds to worldX=0
  const stumpsScreenX = 160;
  const creaseScreenX = 250;
  const pxPerMmX = (creaseScreenX - stumpsScreenX) / 1220;

  const screenX = stumpsScreenX + worldX * pxPerMmX;

  // Pitch surface at Y=195 in CAM 02
  const pitchSurfaceY = 195;
  const pxPerMmZ = 0.85;
  const screenY = pitchSurfaceY - worldZ * pxPerMmZ;

  const scale = 1.0;

  return { screenX, screenY, scale };
}

/**
 * CAM 07 Overhead Bird's Eye Projection (Orthographic Top-Down)
 * Looking straight down at the pitch.
 * worldX maps to screenX (along pitch corridor)
 * worldY maps to screenY (across pitch width)
 * worldZ has no positional effect (only shadow offset)
 */
export function projectToCAM07(
  worldX: number,
  worldY: number,
  worldZ: number
): { screenX: number; screenY: number; scale: number } {
  // CAM 07 viewport is 500x320 SVG
  // Crease at screenX=250 corresponds to worldX=1220mm
  // Stumps at screenX=130 corresponds to worldX=0
  const stumpsScreenX = 130;
  const creaseScreenX = 250;
  const pxPerMmX = (creaseScreenX - stumpsScreenX) / 1220;

  const screenX = stumpsScreenX + worldX * pxPerMmX;

  // Orthographic: worldY maps directly to screenY
  // Centre of pitch (worldY=0) maps to screenY=160
  const centrePitchScreenY = 160;
  const pxPerMmY = 0.098;
  const screenY = centrePitchScreenY + worldY * pxPerMmY;

  const scale = 1.0;

  return { screenX, screenY, scale };
}
