/**
 * runOutPhysics.ts
 * Canonical Run-Out Physics Engine & Unified Timeline State Model.
 *
 * Provides a single deterministic physical replay state for any Run-Out / Stumping scenario
 * across all camera views (CAM 02, CAM 01, CAM 07, CAM 10, and Phase 1 broadcast).
 *
 * Invariant: All cameras consume this identical physical state at any given currentTimeMs.
 */

import type { RunOutData } from "../types/scenario";

export interface RunOutEventTimeline {
  runnerAccelerationStartMs: number;
  throwReleaseMs: number;
  runnerApproachMs: number;
  diveLaunchMs: number;
  batReachStartMs: number;
  batGroundContactMs: number;
  bailsContactMs: number;
  bailsDislodgedMs: number;
  postIncidentMs: number;
}

export type RunOutReplayPhase =
  | "APPROACH"
  | "DIVE_LAUNCH"
  | "REACHING"
  | "GROUNDED_SLIDE"
  | "AIRBORNE_BOUNCE"
  | "POST_INCIDENT";

export interface RunnerPhysicsState {
  runProgress: number; // 0.0 (deep in pitch) to 1.0 (past crease line)
  diveProgress: number; // 0.0 (upright sprint) to 1.0 (full dive/slide)
  isAirborne: boolean;
  isGrounded: boolean;
  torsoAngleRad: number;
  worldX: number; // mm from stumps (stumps = 0, bowling crease = 0, popping crease = 1220mm)
  worldY: number; // lateral offset in mm
  worldZ: number; // height offset in mm
}

export interface BatPhysicsState {
  marginFromCreaseMm: number; // Signed distance: positive = inside crease (safe), negative = short of crease (out)
  tipAltitudeMm: number; // 0 = firmly grounded on pitch turf, > 0 = airborne/bounced
  isGrounded: boolean; // True only if tip touches ground (tipAltitudeMm === 0)
  isPastCrease: boolean; // True if marginFromCreaseMm >= 0
  angleRad: number; // Tilt angle of bat blade
  slideProgress: number; // 0.0 to 1.0
}

export interface BallPhysicsState {
  throwProgress: number; // 0.0 (fielder hand) to 1.0 (stump impact)
  worldX: number; // mm in pitch space
  worldY: number;
  worldZ: number;
  isInFlight: boolean;
  hasHitStumps: boolean;
}

export interface StumpsPhysicsState {
  bailsIntact: boolean;
  bailsSeparating: boolean;
  bailsDislodged: boolean;
  bailDisplacementMm: { x: number; y: number; z: number };
  bailRotationDeg: number;
  zingLedLit: boolean;
}

export interface KeeperPhysicsState {
  gatherProgress: number; // 0.0 (anticipating) to 1.0 (whips bails off)
  isGlovesAtStumps: boolean;
}

export interface RunOutReplayState {
  currentTimeMs: number;
  timeline: RunOutEventTimeline;
  phase: RunOutReplayPhase;
  runner: RunnerPhysicsState;
  bat: BatPhysicsState;
  ball: BallPhysicsState;
  stumps: StumpsPhysicsState;
  keeper: KeeperPhysicsState;
}

/**
 * Helper: Clamps a numeric value between min and max
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Helper: Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Helper: Smooth cubic easing
 */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Derives the canonical event timeline for a given Run-Out scenario.
 */
export function getRunOutEventTimeline(runOut: RunOutData): RunOutEventTimeline {
  const bailsDislodgedMs = runOut.bailsDislodgedFrameMs;
  const batGroundContactMs = runOut.groundedFrameMs;

  return {
    runnerAccelerationStartMs: 600,
    throwReleaseMs: 800,
    runnerApproachMs: 950,
    diveLaunchMs: 1100,
    batReachStartMs: 1200,
    batGroundContactMs,
    bailsContactMs: Math.max(850, bailsDislodgedMs - 30),
    bailsDislodgedMs,
    postIncidentMs: 2200,
  };
}

/**
 * Computes the authoritative, shared physical replay state for any Run-Out scenario at currentTimeMs.
 * Pure deterministic function with zero camera-specific ad-hoc divergences.
 */
export function solveRunOutReplayState(
  runOut: RunOutData,
  currentTimeMs: number
): RunOutReplayState {
  const timeline = getRunOutEventTimeline(runOut);
  const minTime = timeline.runnerAccelerationStartMs;
  const maxTime = timeline.postIncidentMs;
  const clampedTime = clamp(currentTimeMs, minTime, maxTime);

  // --- 1. Event Phase Detection ---
  let phase: RunOutReplayPhase = "APPROACH";
  if (clampedTime < timeline.diveLaunchMs) {
    phase = "APPROACH";
  } else if (clampedTime < timeline.batReachStartMs) {
    phase = "DIVE_LAUNCH";
  } else if (clampedTime < timeline.batGroundContactMs) {
    phase = "REACHING";
  } else if (runOut.batBounced && !runOut.batGrounded && clampedTime >= timeline.bailsContactMs - 80 && clampedTime <= timeline.bailsContactMs + 160) {
    phase = "AIRBORNE_BOUNCE";
  } else if (clampedTime >= timeline.bailsDislodgedMs) {
    phase = "POST_INCIDENT";
  } else {
    phase = "GROUNDED_SLIDE";
  }

  // --- 2. Canonical Bat Kinematics & Crease Margin ---
  // Speed of sliding reach in millimeters per millisecond (~6.2 mm/ms ≈ 22.3 km/h slide)
  const slideSpeedMmPerMs = 6.2;
  const dtFromDislodge = clampedTime - timeline.bailsDislodgedMs;

  // Exact margin from popping crease in mm (positive = inside/safe, negative = short/out)
  // At clampedTime === timeline.bailsDislodgedMs, marginFromCreaseMm is guaranteed to equal runOut.creaseMarginMm exactly.
  const marginFromCreaseMm = Math.round(runOut.creaseMarginMm + dtFromDislodge * slideSpeedMmPerMs);
  const isPastCrease = marginFromCreaseMm >= 0;

  // Normalized reach progress [0, 1]
  const reachProgress = clamp((clampedTime - timeline.batReachStartMs) / (timeline.bailsDislodgedMs - timeline.batReachStartMs + 200), 0, 1);

  // Bat Altitude (0 = grounded, > 0 = airborne in mm)
  let tipAltitudeMm = 0;
  if (runOut.batBounced && !runOut.batGrounded) {
    // Bounced airborne bat
    const bounceCenter = timeline.bailsDislodgedMs;
    const bounceDelta = Math.abs(clampedTime - bounceCenter);
    if (bounceDelta < 220) {
      const bounceNorm = 1 - bounceDelta / 220;
      tipAltitudeMm = Math.round(14 * Math.sin(bounceNorm * Math.PI * 0.5));
    } else {
      tipAltitudeMm = clampedTime < timeline.batGroundContactMs ? 18 : 0;
    }
  } else {
    // Normal reach & ground contact
    if (clampedTime < timeline.batGroundContactMs) {
      const airNorm = (timeline.batGroundContactMs - clampedTime) / Math.max(1, timeline.batGroundContactMs - timeline.batReachStartMs);
      tipAltitudeMm = Math.round(clamp(airNorm * 24, 0, 30));
    } else {
      tipAltitudeMm = 0;
    }
  }

  const isGrounded = tipAltitudeMm === 0;

  // Bat blade tilt angle
  const batAngleRad = lerp(0.35, 0.04, easeInOutQuad(reachProgress));

  // --- 3. Canonical Runner Kinematics ---
  const runProgress = clamp((clampedTime - minTime) / (maxTime - minTime), 0, 1);
  const isUpright = runOut.diveType === "STANDING";
  let diveProgress = 0;

  if (clampedTime < timeline.diveLaunchMs) {
    diveProgress = 0;
  } else if (clampedTime < timeline.batReachStartMs + 100) {
    diveProgress = isUpright ? 0 : easeInOutQuad((clampedTime - timeline.diveLaunchMs) / (timeline.batReachStartMs + 100 - timeline.diveLaunchMs));
  } else {
    diveProgress = isUpright ? 0 : 1.0;
  }

  const runnerAirborne = diveProgress > 0.25 && diveProgress < 0.85;
  const runnerGrounded = !runnerAirborne;
  const torsoAngleRad = lerp(0.24, 1.48, diveProgress);

  // Runner physical distance in mm along the pitch (3500mm far to 400mm near)
  const runnerWorldX = lerp(3600, 350, easeInOutQuad(runProgress));

  // --- 4. Canonical Ball & Throw Trajectory ---
  const throwDuration = timeline.bailsContactMs - timeline.throwReleaseMs;
  const throwProgress = clamp((clampedTime - timeline.throwReleaseMs) / Math.max(1, throwDuration), 0, 1);
  const isInFlight = clampedTime >= timeline.throwReleaseMs && clampedTime < timeline.bailsContactMs;
  const hasHitStumps = clampedTime >= timeline.bailsContactMs;

  // Ball 3D position in mm space (origin at stumps base)
  const ballWorldX = lerp(8000, 0, throwProgress); // 8m deep throw to stumps
  const ballWorldY = lerp(1200, 0, throwProgress);
  const arcZ = Math.sin(throwProgress * Math.PI) * 450;
  const ballWorldZ = lerp(1800, 710, throwProgress) + (isInFlight ? arcZ : 0);

  // --- 5. Canonical Stumps & Zing Bails ---
  const bailsBroke = clampedTime >= timeline.bailsDislodgedMs;
  const bailsContact = clampedTime >= timeline.bailsContactMs;
  const bailDeltaMs = Math.max(0, clampedTime - timeline.bailsDislodgedMs);

  const bailsSeparating = bailsBroke;
  const bailsDislodged = clampedTime >= timeline.bailsDislodgedMs + 40;
  const zingLedLit = bailsBroke;

  // Physical displacement in mm (upwards Z, outwards X/Y)
  const bailDisplacementMm = {
    x: bailsSeparating ? Math.min(180, bailDeltaMs * 0.65) : 0,
    y: bailsSeparating ? Math.min(90, bailDeltaMs * 0.35) : 0,
    z: bailsSeparating ? Math.min(220, bailDeltaMs * 0.85) : 0,
  };

  const bailRotationDeg = bailsSeparating ? Math.min(55, bailDeltaMs * 0.32) : 0;

  // --- 6. Wicketkeeper State ---
  const gatherDuration = timeline.bailsDislodgedMs - timeline.throwReleaseMs + 100;
  const gatherProgress = clamp((clampedTime - timeline.throwReleaseMs) / Math.max(1, gatherDuration), 0, 1);

  return {
    currentTimeMs: clampedTime,
    timeline,
    phase,
    runner: {
      runProgress,
      diveProgress,
      isAirborne: runnerAirborne,
      isGrounded: runnerGrounded,
      torsoAngleRad,
      worldX: runnerWorldX,
      worldY: 0,
      worldZ: runnerAirborne ? 120 : 0,
    },
    bat: {
      marginFromCreaseMm,
      tipAltitudeMm,
      isGrounded,
      isPastCrease,
      angleRad: batAngleRad,
      slideProgress: reachProgress,
    },
    ball: {
      throwProgress,
      worldX: ballWorldX,
      worldY: ballWorldY,
      worldZ: ballWorldZ,
      isInFlight,
      hasHitStumps,
    },
    stumps: {
      bailsIntact: !bailsBroke,
      bailsSeparating,
      bailsDislodged,
      bailDisplacementMm,
      bailRotationDeg,
      zingLedLit,
    },
    keeper: {
      gatherProgress,
      isGlovesAtStumps: bailsContact,
    },
  };
}
