/**
 * caughtBehindPhysics.ts
 *
 * Canonical Caught Behind ball corridor and forensic evidence model.
 *
 * The module has two responsibilities:
 *
 * 1.  Ball corridor. `solveCaughtBehindBallState` produces one continuous
 *     trajectory for the Phase 1 broadcast replay. A clean miss is a single
 *     smooth arc: position and direction stay continuous where the ball
 *     crosses the bat plane, so the replay never fakes a collision. A genuine
 *     edge deflects once, at the moment of contact, and loses speed.
 *
 * 2.  Neutral evidence presentation. `solveEdgeOpticalEvidence` and
 *     `solveUltraEdgeSignal` convert canonical ground truth into what the
 *     forensic cameras are allowed to show. Neither result encodes
 *     `hasEdge` directly: on marginal incidents an edge and a fine miss
 *     produce the same optical classification and the same class of acoustic
 *     transient, so the third umpire has to interpret the evidence.
 *
 * Every function is pure and deterministic. Ground truth stays in
 * `CaughtBehindData` and is never modified here.
 */

import type { CaughtBehindData } from "../types/scenario";

// ================================================================
// 1. BALL CORRIDOR & CANONICAL 3D DELIVERY TRAJECTORY
// ================================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Authoritative 3D state of the delivery ball in pitch coordinate space:
 * - Striker stumps base: (0, 0, 0)
 * - +X: lateral right (off-side for right-handed batter)
 * - -X: lateral left (leg-side)
 * - +Y: vertical height above turf in meters (0 = turf)
 * - +Z: distance along pitch towards bowler (popping crease = 1.22m, bowler stumps = 20.12m)
 */
export interface Delivery3DState {
  timeMs: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  hasBounced: boolean;
  hasPassedBat: boolean;
  isDeflected: boolean;
  gapMm: number;
  radius: number;
}

export const CB_TIMESTAMPS = {
  T_RELEASE: 800,
  T_BOUNCE: 1050,
  T_TRANSIT: 1200,
  T_KEEPER: 1300,
  T_END: 2200,
} as const;

export const BAT_EDGE_X_M = 0.20;
export const BALL_RADIUS_M = 0.036;

/** Replay progress at which the ball reaches the bat plane. */
export const CB_BAT_CROSS_P = 0.5;

/** Peak vertical sag of the delivery arc, in rig pixels. */
const CB_SAG_PX = 10;

/**
 * Screen-space anchors for the slip-camera corridor. The caller supplies
 * these from its own perspective projection; this module only solves the
 * motion between them.
 */
export interface CaughtBehindCorridor {
  /** Release point near the camera, at the bottom of the frame. */
  entryX: number;
  entryY: number;
  /** Outside edge of the bat, on the bat plane. */
  batEdgeX: number;
  batEdgeY: number;
  /** Keeper's glove target behind the wicket. */
  gloveX: number;
  gloveY: number;
  /** Apparent daylight between the ball and the edge, in screen pixels. */
  gapPx: number;
  /** Canonical ground truth. Controls whether a deflection occurs. */
  hasEdge: boolean;
  /** Apparent deflection from Phase 1 evidence, in degrees. */
  deflectionAngleDeg: number;
}

export interface CaughtBehindBallState {
  x: number;
  y: number;
  /** Instantaneous velocity, in pixels per unit of replay progress. */
  vx: number;
  vy: number;
  /** Ball radius for the current camera distance. */
  radius: number;
  /** Trailing sample used to draw the motion blur in the travel direction. */
  prevX: number;
  prevY: number;
  hasCrossedBatPlane: boolean;
  /** True only after a genuine edge has deflected the ball. */
  isDeflected: boolean;
}

function lerpVal(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Solves the single canonical 3D delivery trajectory for a Caught Behind incident.
 * Consumed identically by CAM 01 (Broadcast Replay), CAM 04 (UltraEdge), and CAM 08 (HotSpot).
 */
export function solveCaughtBehindDeliveryTrajectory(
  cb: CaughtBehindData,
  timeMs: number
): Delivery3DState {
  const transitTime = cb.ballPassesBatFrameMs || CB_TIMESTAMPS.T_TRANSIT;
  const bounceTime = CB_TIMESTAMPS.T_BOUNCE;
  const releaseTime = CB_TIMESTAMPS.T_RELEASE;
  const keeperTime = CB_TIMESTAMPS.T_KEEPER;

  const trueGapMm = cb.hasEdge ? 0 : cb.gapMm;
  const gapM = trueGapMm / 1000;

  // Waypoints
  // Transit waypoint at bat plane (Z = 1.22m)
  const xTransit = BAT_EDGE_X_M + BALL_RADIUS_M + gapM;
  const yTransit = 0.65;
  const zTransit = 1.22;

  // Bounce waypoint on good length (Z = 6.5m)
  const xBounce = xTransit - 0.04;
  const yBounce = BALL_RADIUS_M;
  const zBounce = 6.5;

  // Release waypoint near bowler stumps (Z = 18.2m)
  const xRelease = xBounce - 0.06;
  const yRelease = 2.15;
  const zRelease = 18.2;

  // Pre-transit velocities entering bat plane:
  const dtBounceToTransit = (transitTime - bounceTime) / 1000;
  const vxPre = (xTransit - xBounce) / dtBounceToTransit;
  const vzPre = (zTransit - zBounce) / dtBounceToTransit; // -35.2 m/s
  const yApex = 0.70;
  const vyPre = (2 * (yTransit - yApex)) / dtBounceToTransit; // -0.667 m/s downward descent

  // Post-transit dynamics (1200ms -> 1300ms)
  const dtPost = (keeperTime - transitTime) / 1000; // 0.10s
  const gScaled = 3.2; // scaled gravity for super-slow motion replay

  // Deflection on edge vs pure carry on clean miss:
  const vxPost = cb.hasEdge ? vxPre + 0.55 : vxPre;
  const vzPost = cb.hasEdge ? -27.2 : -30.2;
  const vyPost = cb.hasEdge ? vyPre + 0.35 : vyPre;

  // Analytical keeper catch position at keeperTime (1300ms):
  const xKeeper = xTransit + vxPost * dtPost;
  const yKeeper = yTransit + vyPost * dtPost - 0.5 * gScaled * dtPost * dtPost;
  const zKeeper = zTransit + vzPost * dtPost; // ~ -1.5m to -1.8m

  let x = xRelease;
  let y = yRelease;
  let z = zRelease;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  const hasBounced = timeMs >= bounceTime;
  const hasPassedBat = timeMs >= transitTime;
  const isDeflected = cb.hasEdge && hasPassedBat;

  if (timeMs <= releaseTime) {
    // Before release: ball held in bowler's hand
    x = xRelease;
    y = yRelease;
    z = zRelease;
    vx = 0;
    vy = 0;
    vz = 0;
  } else if (timeMs < bounceTime) {
    // Release -> Bounce flight (800ms to 1050ms)
    const dt = (bounceTime - releaseTime) / 1000;
    const u = Math.max(0, Math.min(1, (timeMs - releaseTime) / (bounceTime - releaseTime)));
    
    // Linear in X and Z
    x = lerpVal(xRelease, xBounce, u);
    z = lerpVal(zRelease, zBounce, u);
    vx = (xBounce - xRelease) / dt;
    vz = (zBounce - zRelease) / dt;

    // Parabolic gravity flight in Y
    const yMid = (yRelease + yBounce) / 2 - 0.20;
    const om = 1 - u;
    y = om * om * yRelease + 2 * om * u * yMid + u * u * yBounce;
    vy = (2 * om * (yMid - yRelease) + 2 * u * (yBounce - yMid)) / dt;
  } else if (timeMs <= transitTime) {
    // Bounce -> Bat-plane transit (1050ms to 1200ms)
    const dt = dtBounceToTransit;
    const u = Math.max(0, Math.min(1, (timeMs - bounceTime) / (transitTime - bounceTime)));

    // Linear in X and Z (Strict lateral collinearity: constant Vx)
    x = lerpVal(xBounce, xTransit, u);
    z = lerpVal(zBounce, zTransit, u);
    vx = vxPre;
    vz = vzPre;

    // Rising bounce arc in Y
    const om = 1 - u;
    y = om * om * yBounce + 2 * om * u * yApex + u * u * yTransit;
    vy = (2 * om * (yApex - yBounce) + 2 * u * (yTransit - yApex)) / dt;
  } else {
    // Post-transit -> Wicketkeeper (1200ms onwards)
    if (timeMs >= keeperTime) {
      // Ball safely caught and secured in keeper's gloves
      x = xKeeper;
      y = yKeeper;
      z = zKeeper;
      vx = 0;
      vy = 0;
      vz = 0;
    } else {
      // 1200ms < timeMs < 1300ms: continuous C1 carry into gloves
      const elapsedSec = (timeMs - transitTime) / 1000;
      x = xTransit + vxPost * elapsedSec;
      y = yTransit + vyPost * elapsedSec - 0.5 * gScaled * elapsedSec * elapsedSec;
      z = zTransit + vzPost * elapsedSec;
      vx = vxPost;
      vy = vyPost - gScaled * elapsedSec;
      vz = vzPost;
    }
  }

  return {
    timeMs,
    x,
    y,
    z,
    vx,
    vy,
    vz,
    hasBounced,
    hasPassedBat,
    isDeflected,
    gapMm: trueGapMm,
    radius: BALL_RADIUS_M,
  };
}

/**
 * Returns the exact 3D position where the wicketkeeper intercepts and catches the delivery.
 */
export function getKeeperCatchPosition(cb: CaughtBehindData): Vec3 {
  const d = solveCaughtBehindDeliveryTrajectory(cb, CB_TIMESTAMPS.T_KEEPER);
  return { x: d.x, y: d.y, z: d.z };
}

export interface SlipCorridorBallState {
  x: number;
  y: number;
  radius: number;
  hasBounced: boolean;
  hasPassedBat: boolean;
  isDeflected: boolean;
}

/**
 * Calibrated 2.5D visual delivery corridor for Slip Cam (Phase 1 & Phase 2).
 *
 * Interpolates smoothly across four physical visual anchors:
 * 1. Release (t <= 800ms): Bowler delivery release near frame bottom.
 * 2. Bounce (t = 1050ms): Pitch impact on the perspective clay strip.
 * 3. Bat Transit (t = 1200ms): Bat-plane transit (outside edge contact or visible daylight gap).
 * 4. Keeper Gloves (t = 1300ms): Terminal arrival in the planted wicketkeeper's gloves.
 *
 * Mathematically guarantees:
 * - Screen Y strictly decreases monotonically towards the batter and keeper (no direction reversal).
 * - Zero division singularities or coordinate inversions.
 * - Accurate event alignment: ball crosses bat at exactly t = 1200ms.
 * - Perfectly continuous glove arrival at t = 1300ms.
 */
export function solveCaughtBehindSlipCorridor(
  cb: CaughtBehindData,
  timeMs: number,
  w: number,
  h: number,
  batEdgeX: number,
  batEdgeY: number,
  gloveX: number,
  gloveY: number
): SlipCorridorBallState {
  const T_RELEASE = 800;
  const T_BOUNCE = 1050;
  const T_TRANSIT = 1200;
  const T_KEEPER = 1300;

  // Visual Anchors
  const x0 = w * 0.50;
  const y0 = h * 0.965;
  const r0 = 6.4;

  const x1 = w * 0.495;
  const y1 = h * 0.88;
  const r1 = 5.6;

  const gapPx = cb.hasEdge ? 0 : Math.max(4, Math.min(28, (cb.gapMm / 30) * 16));
  const x2 = cb.hasEdge ? batEdgeX - 3.2 : batEdgeX - gapPx - 3.2;
  const y2 = batEdgeY;
  const r2 = 4.8;

  const x3 = gloveX;
  const y3 = gloveY;
  const r3 = 4.0;

  let x = x0;
  let y = y0;
  let radius = r0;
  const hasBounced = timeMs >= T_BOUNCE;
  const hasPassedBat = timeMs >= T_TRANSIT;
  const isDeflected = cb.hasEdge && hasPassedBat;

  if (timeMs <= T_RELEASE) {
    x = x0;
    y = y0;
    radius = r0;
  } else if (timeMs <= T_BOUNCE) {
    const u = (timeMs - T_RELEASE) / (T_BOUNCE - T_RELEASE);
    x = lerpVal(x0, x1, u);
    y = lerpVal(y0, y1, u) - Math.sin(u * Math.PI) * 6;
    radius = lerpVal(r0, r1, u);
  } else if (timeMs <= T_TRANSIT) {
    const u = (timeMs - T_BOUNCE) / (T_TRANSIT - T_BOUNCE);
    x = lerpVal(x1, x2, u);
    y = lerpVal(y1, y2, u) - Math.sin(u * Math.PI) * 8;
    radius = lerpVal(r1, r2, u);
  } else if (timeMs <= T_KEEPER) {
    const u = (timeMs - T_TRANSIT) / (T_KEEPER - T_TRANSIT);
    // Screen Y decreases monotonically into the keeper gloves
    y = lerpVal(y2, y3, u) - Math.sin(u * Math.PI) * 2;
    if (!cb.hasEdge) {
      x = lerpVal(x2, x3, u);
    } else {
      const eased = u * (2 - u);
      x = lerpVal(x2, x3, eased);
    }
    radius = lerpVal(r2, r3, u);
  } else {
    x = x3;
    y = y3;
    radius = r3;
  }

  return {
    x,
    y,
    radius,
    hasBounced,
    hasPassedBat,
    isDeflected,
  };
}

/**
 * Canonical perspective projection from 3D pitch coordinates into Slip Cam 2D screen coordinates.
 */
export function projectPitchToSlipCam(
  p: Vec3,
  w: number,
  h: number
): { x: number; y: number; scale: number } {
  const CAM_X = 6.0;
  const HORIZON_H = 0.16;
  const PERSP_K = 3.48;
  const EYE_D0 = 1.0;
  const WORLD_BATTER_GUARD_Z = 1.06;

  const camDist = CAM_X - p.z;
  const depthFactor = PERSP_K / (camDist + EYE_D0);
  const baseDepth = PERSP_K / (CAM_X - WORLD_BATTER_GUARD_Z + EYE_D0);
  const scale = depthFactor / baseDepth;

  const groundY = h * (HORIZON_H + depthFactor);
  const stripHalfW = w * 0.27 * scale;
  const pxPerMeterX = stripHalfW / 1.525;
  const pxPerMeterY = 72 * scale;

  const screenX = w * 0.50 - p.x * pxPerMeterX;
  const screenY = groundY - p.y * pxPerMeterY;

  return { x: screenX, y: screenY, scale };
}

/**
 * Projects a 3D delivery point into macro edge camera screen coordinates.
 */
export function projectCaughtBehindToMacro(
  state: Delivery3DState,
  edgeX: number = 200,
  ballRadiusPx: number = 28,
  scale: number = 3.5
): { ballX: number; ballY: number; scaleFactor: number } {
  // Lateral offset from outside edge profile in view pixels
  const lateralDeltaM = state.x - (BAT_EDGE_X_M + BALL_RADIUS_M);
  const ballX = edgeX + ballRadiusPx + lateralDeltaM * 1000 * (scale / 3.5);

  // Vertical movement through the corridor: passes edge at Y = 150
  const zDeltaM = state.z - 1.22; // 0 at bat plane
  const ballY = 150 - zDeltaM * 110;

  const scaleFactor = Math.max(0.7, Math.min(1.3, 1.0 - zDeltaM * 0.08));

  return { ballX, ballY, scaleFactor };
}

/**
 * Target the ball reaches when it misses the bat.
 *
 * The ball passes the bat edge at q = CB_BAT_CROSS_P with exact separation gapPx,
 * continuing along its natural flight line past the stumps into the gloves.
 */
function cleanMissTarget(c: CaughtBehindCorridor) {
  // The keeper stands down-corridor from the bat edge. A ball that beats the
  // outside edge passes on the far side of the edge, so it arrives wide of
  // the gloves in the same lateral direction it was already travelling.
  const side = Math.sign(c.gloveX - c.batEdgeX) || 1;
  return {
    x: c.gloveX + side * Math.max(6, c.gapPx) * 0.9,
    y: c.gloveY + 10,
  };
}

/**
 * Target the ball reaches after an edge.
 *
 * A thicker edge, reported by a larger apparent deflection angle, fans the
 * carry slightly wider of the gloves.
 */
function edgeCarryTarget(c: CaughtBehindCorridor) {
  const fan = c.deflectionAngleDeg * 1.6;
  return { x: c.gloveX + fan, y: c.gloveY + 6 };
}

/**
 * Solves the ball position and velocity at replay progress `p`, in `[0, 1]`.
 *
 * Clean miss: one straight line from the release point to a point wide of
 * the gloves, plus a shared parabolic sag. Lateral travel is linear in `p`,
 * so the ball cannot change lateral direction anywhere, including at the bat
 * plane.
 *
 * Edge: a straight approach to the bat edge, then a single deflection into
 * the gloves at reduced speed. Position stays continuous through contact and
 * the ball keeps travelling down the corridor.
 */
export function solveCaughtBehindBallState(
  c: CaughtBehindCorridor,
  p: number
): CaughtBehindBallState {
  const t = Math.max(0, Math.min(1, p));
  const sagAt = (q: number) => CB_SAG_PX * 4 * q * (1 - q);
  const radiusAt = (q: number) => 5.4 - q * 1.9;
  const TRAIL_DP = 0.05;

  if (!c.hasEdge) {
    // --- Clean miss: a single continuous arc past the bat ---
    const target = cleanMissTarget(c);
    const posAt = (q: number) => ({
      x: c.entryX + (target.x - c.entryX) * q,
      y: c.entryY + (target.y - c.entryY) * q + sagAt(q),
    });
    const here = posAt(t);
    // Sample the derivative forwards, or backwards at the end of the flight,
    // so the reported direction is never a degenerate zero vector.
    const dp = 1e-4;
    const forward = t + dp <= 1;
    const other = forward ? posAt(t + dp) : posAt(t - dp);
    const sign = forward ? 1 : -1;
    const behind = posAt(Math.max(0, t - TRAIL_DP));
    return {
      x: here.x,
      y: here.y,
      vx: (sign * (other.x - here.x)) / dp,
      vy: (sign * (other.y - here.y)) / dp,
      radius: radiusAt(t),
      prevX: behind.x,
      prevY: behind.y,
      hasCrossedBatPlane: t >= CB_BAT_CROSS_P,
      isDeflected: false,
    };
  }

  // --- Edge: approach, contact at the bat edge, deflected carry ---
  const contactX = c.batEdgeX;
  const contactY = c.batEdgeY;
  const carry = edgeCarryTarget(c);

  // Both segments carry the same gravity sag, so position stays continuous
  // where the deflection happens: only the direction changes.
  const approachAt = (q: number) => {
    const s = q / CB_BAT_CROSS_P;
    return {
      x: c.entryX + (contactX - c.entryX) * s,
      y: c.entryY + (contactY - c.entryY) * s + sagAt(q),
    };
  };
  // The edge deadens the ball, so the carry decelerates into the gloves.
  const carryAt = (q: number) => {
    const s = (q - CB_BAT_CROSS_P) / (1 - CB_BAT_CROSS_P);
    const eased = s * (2 - s);
    return {
      x: contactX + (carry.x - contactX) * eased,
      y: contactY + (carry.y - contactY) * eased + sagAt(q),
    };
  };
  const posAt = (q: number) => (q <= CB_BAT_CROSS_P ? approachAt(q) : carryAt(q));

  const here = posAt(t);
  // Sample the derivative on the same side of contact, and never past the end
  // of the flight, so the reported direction is the true instantaneous one
  // rather than an average across the deflection.
  const dp = 1e-4;
  const forward = (t + dp <= CB_BAT_CROSS_P || t > CB_BAT_CROSS_P) && t + dp <= 1;
  const other = forward ? posAt(t + dp) : posAt(Math.max(0, t - dp));
  const sign = forward ? 1 : -1;
  const behind = posAt(Math.max(0, t - TRAIL_DP));

  return {
    x: here.x,
    y: here.y,
    vx: (sign * (other.x - here.x)) / dp,
    vy: (sign * (other.y - here.y)) / dp,
    radius: radiusAt(t),
    prevX: behind.x,
    prevY: behind.y,
    hasCrossedBatPlane: t >= CB_BAT_CROSS_P,
    isDeflected: t > CB_BAT_CROSS_P,
  };
}

/**
 * Measures the direction change across the bat plane, in degrees.
 *
 * A clean miss returns `0`: the ball holds its line. An edge returns the
 * plausible turn the deflection produced.
 */
export function measureBatPlaneTurnDeg(c: CaughtBehindCorridor): number {
  const before = solveCaughtBehindBallState(c, CB_BAT_CROSS_P - 1e-3);
  const after = solveCaughtBehindBallState(c, CB_BAT_CROSS_P + 1e-3);
  const a1 = Math.atan2(before.vy, before.vx);
  const a2 = Math.atan2(after.vy, after.vx);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return (d * 180) / Math.PI;
}

// ================================================================
// 2. SUPER SLOW-MO OPTICAL EVIDENCE
// ================================================================

/**
 * Optical separation the 1000 fps macro camera can actually resolve.
 *
 * At this shutter speed the ball smears across a few millimetres, so any true
 * gap smaller than the blur envelope reads as no visible daylight. A genuine
 * edge and a fine miss therefore look the same, which is why the camera
 * cannot decide a marginal incident on its own.
 *
 * The value is tuned against the generator's gap ranges: marginal misses span
 * 3 mm to 8 mm, so the wider end of that range still resolves a sliver of
 * daylight while the finer end collapses into the blur. Clear and howler
 * misses span 20 mm and above and always resolve. Genuine edges have no gap
 * at all, so they can never resolve daylight. Resolved daylight is real
 * evidence rather than a leak: the camera reports what the optics measure and
 * never inspects the ground truth flag.
 */
export const CB_MOTION_BLUR_TOLERANCE_MM = 6;

export type EdgeOpticalReading = "VISIBLE_DAYLIGHT" | "INCONCLUSIVE";

export interface EdgeOpticalEvidence {
  /** Separation the camera resolves, in millimetres. Never negative. */
  apparentSeparationMm: number;
  /** Width of the motion-blur envelope, in millimetres. */
  blurToleranceMm: number;
  /** Classification the operator sees. Never encodes `hasEdge`. */
  reading: EdgeOpticalReading;
  /** Ball travel smear used to draw the blur envelope, in millimetres. */
  smearMm: number;
}

/**
 * Converts canonical ground truth into what the macro camera may display.
 *
 * The returned separation is the true gap reduced by the blur envelope, so
 * marginal misses collapse to the same `INCONCLUSIVE` reading as an edge.
 * Wide misses still resolve as visible daylight, which is what makes clear
 * incidents decidable.
 */
export function solveEdgeOpticalEvidence(cb: CaughtBehindData): EdgeOpticalEvidence {
  const trueGapMm = cb.hasEdge ? 0 : cb.gapMm;
  const apparentSeparationMm = Math.max(0, trueGapMm - CB_MOTION_BLUR_TOLERANCE_MM);
  return {
    apparentSeparationMm,
    blurToleranceMm: CB_MOTION_BLUR_TOLERANCE_MM,
    reading: apparentSeparationMm > 0 ? "VISIBLE_DAYLIGHT" : "INCONCLUSIVE",
    smearMm: CB_MOTION_BLUR_TOLERANCE_MM,
  };
}

// ================================================================
// 3. ULTRAEDGE ACOUSTIC EVIDENCE
// ================================================================

/**
 * One transient on the stump microphone.
 *
 * The operator sees a time, an amplitude and a frequency character. None of
 * these fields state what the transient came from: a bat edge, a pad and a
 * boot scrape all appear as transients, and the player has to judge whether
 * one aligns with the frame in which the ball passed the bat.
 */
export interface UltraEdgeTransient {
  timeMs: number;
  /** Peak amplitude, 0 to 1. Ranges overlap across sources. */
  amplitude: number;
  /** Dominant frequency, in hertz. Ranges overlap across sources. */
  centreFreqHz: number;
  /** Decay time constant, in milliseconds. */
  decayMs: number;
}

export interface UltraEdgeSignal {
  /** Ambient crowd and equipment noise, 0 to 1. Never zero. */
  noiseFloor: number;
  /** Every transient in the review window, sorted by time. */
  transients: UltraEdgeTransient[];
  /** Frame in which the ball passed the bat, for alignment checks. */
  batPlaneTimeMs: number;
  /** Review window bounds, in milliseconds. */
  windowStartMs: number;
  windowEndMs: number;
}

const CB_WINDOW_START_MS = 800;
const CB_WINDOW_END_MS = 1600;

/**
 * Deterministic value in `[0, 1)` derived from a seed.
 *
 * Keeps presentation jitter stable for a given incident without pulling in
 * the scenario generator's RNG.
 */
function hashUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Builds the acoustic evidence for the UltraEdge scope and speaker.
 *
 * Every incident produces a noise floor and at least one candidate
 * transient, so the scope never flatlines and the absence of a spike can no
 * longer be read as "no edge". Amplitude and frequency bands overlap between
 * bat contact and decoy contact, so loudness and tone prove nothing on their
 * own.
 *
 * Alignment with the transit frame is the intended skill, exactly as in a
 * real review. To keep it a judgement rather than a lookup, edge transients
 * carry a spread of several frames and ambient noise can also land close to
 * the transit frame, so a tight offset is strong evidence but not proof.
 */
export function solveUltraEdgeSignal(cb: CaughtBehindData): UltraEdgeSignal {
  // Seed from fields that vary on every incident, including the ones that are
  // non-zero when a genuine edge occurs. A seed built only from `gapMm` and
  // the decoy time collapses to a constant for edges, which would make the
  // reported offset identical every time and give the answer away.
  const seed =
    cb.proximityFrameMs * 0.37 +
    cb.gapMm * 7.13 +
    (cb.distractorTimeMs ?? 0) * 1.7 +
    Math.round(cb.spikeIntensity * 1000) * 2.9 +
    (cb.waveformSpikeTimeMs ?? 0) * 0.11;
  const jitter = (n: number, spread: number) => (hashUnit(seed + n) - 0.5) * 2 * spread;

  const transients: UltraEdgeTransient[] = [];

  // A genuine edge registers near the bat plane, but the microphone and the
  // frame clock disagree by a few frames, so the offset spans a band that
  // ambient noise can also occupy.
  if (cb.hasEdge && cb.waveformSpikeTimeMs !== null) {
    transients.push({
      timeMs: cb.waveformSpikeTimeMs + jitter(1, 26),
      amplitude: 0.42 + hashUnit(seed + 2) * 0.36,
      centreFreqHz: 1500 + hashUnit(seed + 3) * 2600,
      decayMs: 14 + hashUnit(seed + 4) * 10,
    });
  }

  // A decoy contact registers off the bat plane, in the same amplitude and
  // frequency bands as a real edge.
  if (cb.distractorNoise && cb.distractorTimeMs !== null) {
    transients.push({
      timeMs: cb.distractorTimeMs + jitter(5, 8),
      amplitude: 0.40 + hashUnit(seed + 6) * 0.38,
      centreFreqHz: 1400 + hashUnit(seed + 7) * 2700,
      decayMs: 16 + hashUnit(seed + 8) * 12,
    });
  }

  // Ambient kit and crowd noise always leaves transients in the window, so a
  // clean miss still produces a signal to interpret. One of them is placed
  // near the transit frame on some incidents, which is why a tight offset
  // alone cannot be treated as proof of contact.
  const ambientCount = 2 + Math.floor(hashUnit(seed + 9) * 2);
  const span = CB_WINDOW_END_MS - CB_WINDOW_START_MS;
  for (let i = 0; i < ambientCount; i++) {
    const nearTransit = hashUnit(seed + 60 + i) < 0.35;
    const timeMs = nearTransit
      ? cb.ballPassesBatFrameMs + jitter(70 + i, 30)
      : CB_WINDOW_START_MS + 60 + hashUnit(seed + 20 + i) * (span - 120);
    transients.push({
      timeMs,
      amplitude: 0.14 + hashUnit(seed + 30 + i) * 0.22,
      centreFreqHz: 900 + hashUnit(seed + 40 + i) * 3000,
      decayMs: 18 + hashUnit(seed + 50 + i) * 14,
    });
  }

  transients.sort((a, b) => a.timeMs - b.timeMs);

  return {
    noiseFloor: 0.08 + hashUnit(seed + 11) * 0.05,
    transients,
    batPlaneTimeMs: cb.ballPassesBatFrameMs,
    windowStartMs: CB_WINDOW_START_MS,
    windowEndMs: CB_WINDOW_END_MS,
  };
}

/**
 * Solves bat vertical displacement (turf contact) during a stroke.
 * If the incident contains a ground scrape distractor, the bat toe contacts
 * the turf precisely around distractorTimeMs.
 */
export function solveBatGroundContact(cb: CaughtBehindData, timeMs: number): {
  toeDisplacementPx: number;
  isTurfContact: boolean;
  contactIntensity: number;
} {
  if (!cb.distractorNoise || cb.distractorType !== "GROUND_SCRAPE" || cb.distractorTimeMs === null) {
    return { toeDisplacementPx: 0, isTurfContact: false, contactIntensity: 0 };
  }
  const dt = timeMs - cb.distractorTimeMs;
  const sigma = 35; // 35ms pulse width
  const intensity = Math.exp(-(dt * dt) / (2 * sigma * sigma));
  const maxDisplacementPx = 6.0; // moves bat toe 6px down to touch the turf line
  const displacement = maxDisplacementPx * intensity;
  return {
    toeDisplacementPx: displacement,
    isTurfContact: intensity > 0.82,
    contactIntensity: intensity,
  };
}

/**
 * Amplitude of the signal at a point in time, including the noise floor.
 *
 * Used to draw the scope and to render the audio buffer from the same model,
 * so what the operator sees always matches what they hear.
 */
export function sampleUltraEdgeAmplitude(signal: UltraEdgeSignal, timeMs: number): number {
  // Stable, low-amplitude ambient noise floor (-36dB to -40dB equivalent)
  let amp = (signal.noiseFloor * 0.16) * Math.sin(timeMs * 0.08) + 
            (signal.noiseFloor * 0.06) * Math.sin(timeMs * 0.22);
  for (const tr of signal.transients) {
    const delta = timeMs - tr.timeMs;
    if (Math.abs(delta) > tr.decayMs * 5) continue;
    const envelope = Math.exp(-Math.abs(delta) / tr.decayMs);
    amp += Math.sin((delta * tr.centreFreqHz) / 12000) * tr.amplitude * envelope;
  }
  return amp;
}

/**
 * Transient closest to the bat plane, with its offset in milliseconds.
 *
 * The console shows this offset so the operator can judge alignment. It does
 * not label the source of the transient.
 */
export function findNearestTransient(
  signal: UltraEdgeSignal
): { transient: UltraEdgeTransient; offsetMs: number } | null {
  let best: UltraEdgeTransient | null = null;
  let bestOffset = Number.POSITIVE_INFINITY;
  for (const tr of signal.transients) {
    const offset = tr.timeMs - signal.batPlaneTimeMs;
    if (Math.abs(offset) < Math.abs(bestOffset)) {
      best = tr;
      bestOffset = offset;
    }
  }
  return best ? { transient: best, offsetMs: bestOffset } : null;
}
