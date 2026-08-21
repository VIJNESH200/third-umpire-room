/**
 * actorRigs.ts
 * Procedural 2D Cricket Actor Rig & Continuous Kinematics Animation System.
 * Provides continuous smooth articulation, weight, momentum, and follow-through
 * for Batter, Bowler, Wicketkeeper, Fielder, Stumps, and Cricket Ball in Phase 1 broadcast replays.
 */

export interface ActorTransform {
  x: number;
  y: number;
  scale?: number;
  rotationDeg?: number;
  facing?: "LEFT" | "RIGHT";
  opacity?: number;
}

// Math & Easing Helpers
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

// ================================================================
// KINEMATIC DATA STRUCTURES
// ================================================================
export interface BatterKinematics {
  torsoAngleRad: number;
  headX: number;
  headY: number;
  headTiltRad: number;
  frontLegX: number;
  frontLegY: number;
  backLegX: number;
  backLegY: number;
  batPivotX: number;
  batPivotY: number;
  batRotRad: number;
  padRecoilX: number;
  padRecoilY: number;
  isDiving?: boolean;
}

export interface BowlerKinematics {
  torsoAngleRad: number;
  torsoY: number;
  headTiltRad: number;
  bowlingArmAngleRad: number;
  nonBowlingArmAngleRad: number;
  frontLegX: number;
  frontLegY: number;
  backLegX: number;
  backLegY: number;
  appealElevation: number; // 0.0 (bowling) to 1.0 (appealing)
}

export interface KeeperKinematics {
  crouchElevation: number; // 0.0 (deep crouch) to 1.0 (full standing appeal)
  torsoAngleRad: number;
  headTiltRad: number;
  gloveX: number;
  gloveY: number;
  isGlovesOpen: boolean;
}

export interface FielderKinematics {
  torsoAngleRad: number;
  headX: number;
  headY: number;
  frontLegX: number;
  frontLegY: number;
  backLegX: number;
  backLegY: number;
  reachArmAngleRad: number;
  isSliding: boolean;
  slideProgress: number; // 0.0 to 1.0
}

export interface RunnerKinematics {
  diveProgress: number; // 0.0 (upright sprint) to 1.0 (full dive reach/slide)
  isAirborne: boolean;
  isGrounded: boolean;
  pelvisOffsetY: number; // vertical height of hips

  // Spine & Torso (derives from pelvis)
  torsoAngleRad: number; // forward pitch angle
  torsoLength: number;

  // Head (derives from neck at top of torso)
  headTiltRad: number;

  // Lead Arm & Bat (derives from shoulder at top of torso)
  leadShoulderAngleRad: number;
  leadElbowAngleRad: number;
  batGripAngleRad: number;

  // Rear Arm (derives from shoulder at top of torso)
  rearShoulderAngleRad: number;
  rearElbowAngleRad: number;

  // Lead Leg (derives from lead hip socket on pelvis)
  leadHipAngleRad: number;
  leadKneeAngleRad: number;

  // Trail Leg (derives from trail hip socket on pelvis)
  trailHipAngleRad: number;
  trailKneeAngleRad: number;
}

// ================================================================
// CONTINUOUS KINEMATIC SOLVERS
// ================================================================

/**
 * Solves continuous batter kinematics across the 2.8s replay loop for LBW.
 */
export function solveLBWBatterKinematics(
  p: number,
  isNoShot: boolean,
  _shotType: string,
  batPadSeparationMm: number = 60
): BatterKinematics {
  let stride = 0.0;
  let impactRecoil = 0.0;

  if (p < 0.20) {
    stride = 0.0;
  } else if (p >= 0.20 && p < 0.50) {
    const t = (p - 0.20) / 0.30;
    stride = easeInOutQuad(t);
  } else {
    stride = 1.0;
  }

  if (p >= 0.70 && p < 0.85) {
    const t = (p - 0.70) / 0.15;
    impactRecoil = Math.sin(t * Math.PI) * 2.5;
  }

  const torsoAngleRad = lerp(-0.04, isNoShot ? -0.15 : 0.12, stride);
  const headX = lerp(-2, isNoShot ? -6 : 4, stride);
  const headY = lerp(-54, isNoShot ? -56 : -50, stride);
  const headTiltRad = lerp(0.0, isNoShot ? -0.1 : 0.15, stride);

  const frontLegX = lerp(4, isNoShot ? 2 : 14, stride) - impactRecoil * 0.5;
  const frontLegY = lerp(-28, -28, stride);
  const backLegX = lerp(-10, isNoShot ? -8 : -12, stride);
  const backLegY = lerp(-28, -28, stride);

  let targetBatPivotX = 8;
  let targetBatPivotY = -30;
  let targetBatRot = 0.16;

  if (isNoShot) {
    targetBatPivotX = -14;
    targetBatPivotY = -44;
    targetBatRot = -0.65;
  } else {
    const batOffset = batPadSeparationMm < 25 ? -2 : -10;
    targetBatPivotX = frontLegX + batOffset;
  }

  const batPivotX = lerp(-6, targetBatPivotX, stride);
  const batPivotY = lerp(-34, targetBatPivotY, stride);
  const batRotRad = lerp(0.08, targetBatRot, stride);

  return {
    torsoAngleRad,
    headX,
    headY,
    headTiltRad,
    frontLegX,
    frontLegY,
    backLegX,
    backLegY,
    batPivotX,
    batPivotY,
    batRotRad,
    padRecoilX: -impactRecoil,
    padRecoilY: 0,
  };
}

export interface BowlerKinematicsOptions {
  isNoBall?: boolean;
  frontFootOverstepMm?: number;
  deliveryLine?: string;
}

/**
 * Solves continuous bowler kinematics across the 2.8s replay loop for LBW.
 * Accurately models front-foot landing relative to popping crease:
 * - Legal delivery: front foot lands firmly behind the popping crease (+Y).
 * - No-ball delivery: front foot visibly oversteps the popping crease (-Y) proportional to overstepMm.
 */
export function solveLBWBowlerKinematics(
  p: number,
  opts: BowlerKinematicsOptions = {}
): BowlerKinematics {
  const isNoBall = opts.isNoBall ?? false;
  const overstepMm = opts.frontFootOverstepMm ?? 0;

  // Front foot landing target Y relative to the popping crease anchor:
  // In canvas coordinate space (+Y is down towards bowling crease / camera, -Y is up towards batsman / pitch).
  // Legal delivery: front foot lands 6px to 8px behind the popping crease (+Y).
  // No-Ball: front foot oversteps over the line (-Y) scaled to overstep distance.
  const landedFrontLegY = isNoBall
    ? -Math.max(6, Math.min(18, overstepMm * 0.35 + 4))
    : 6;

  let torsoAngleRad = 0.08;
  let torsoY = 0;
  let bowlingArmAngleRad = 0.8;
  let nonBowlingArmAngleRad = -0.6;
  let frontLegX = 6;
  let frontLegY = 6;
  let backLegX = -10;
  let backLegY = 2;
  let appealElevation = 0.0;

  if (p < 0.12) {
    // Run-up stride cycle approaching crease
    const t = p / 0.12;
    const strideCycle = Math.sin(t * Math.PI * 4);
    frontLegX = 4 + strideCycle * 6;
    frontLegY = 8 - Math.abs(strideCycle) * 4;
    backLegX = -8 - strideCycle * 6;
    backLegY = 8 - Math.abs(Math.cos(t * Math.PI * 4)) * 4;
    torsoY = Math.abs(strideCycle) * 2;
    bowlingArmAngleRad = 0.5 + Math.sin(t * Math.PI * 2) * 0.8;
    nonBowlingArmAngleRad = -0.5 - Math.sin(t * Math.PI * 2) * 0.8;
  } else if (p >= 0.12 && p < 0.22) {
    // Delivery gather and front foot stride plant
    const t = (p - 0.12) / 0.10;
    const smoothT = easeInOutQuad(t);
    bowlingArmAngleRad = lerp(-Math.PI * 0.5, Math.PI * 1.35, smoothT);
    nonBowlingArmAngleRad = lerp(Math.PI * 0.6, -Math.PI * 0.4, smoothT);
    torsoAngleRad = lerp(0.05, 0.35, smoothT);
    frontLegX = lerp(2, 9, smoothT);
    frontLegY = lerp(12, landedFrontLegY, smoothT);
    backLegX = lerp(-6, -14, smoothT);
    backLegY = lerp(6, 12, smoothT);
  } else if (p >= 0.22 && p < 0.65) {
    // Release follow-through: front foot remains firmly planted on the turf
    const t = (p - 0.22) / 0.43;
    const smoothT = easeOutCubic(t);
    bowlingArmAngleRad = lerp(Math.PI * 1.35, Math.PI * 0.6, smoothT);
    nonBowlingArmAngleRad = lerp(-Math.PI * 0.4, 0.2, smoothT);
    torsoAngleRad = lerp(0.35, 0.15, smoothT);
    frontLegX = lerp(9, 6, smoothT);
    frontLegY = landedFrontLegY;
    backLegX = lerp(-14, -8, smoothT);
    backLegY = lerp(12, 6, smoothT);
  } else {
    // Turn & appeal towards camera / umpire
    const t = (p - 0.65) / 0.25;
    appealElevation = clamp(easeInOutQuad(t), 0, 1);
    torsoAngleRad = lerp(0.15, -0.15, appealElevation);
    bowlingArmAngleRad = lerp(Math.PI * 0.6, -Math.PI * 0.75, appealElevation);
    nonBowlingArmAngleRad = lerp(0.2, -Math.PI * 0.75, appealElevation);
    frontLegX = lerp(6, 4, appealElevation);
    frontLegY = lerp(landedFrontLegY, 6, appealElevation);
    backLegX = lerp(-8, -4, appealElevation);
    backLegY = 4;
  }

  return {
    torsoAngleRad,
    torsoY,
    headTiltRad: lerp(0.1, -0.2, appealElevation),
    bowlingArmAngleRad,
    nonBowlingArmAngleRad,
    frontLegX,
    frontLegY,
    backLegX,
    backLegY,
    appealElevation,
  };
}

/**
 * Solves continuous batter kinematics for Caught Behind (Corridor of Uncertainty).
 */
export function solveCaughtBehindBatterKinematics(
  p: number,
  _shotType: string = "FORWARD_DEFENCE",
  batAngleDeg: number = 14
): BatterKinematics {
  let swing = 0.0;
  let followThrough = 0.0;

  if (p < 0.25) {
    const t = p / 0.25;
    swing = t * 0.15;
  } else if (p >= 0.25 && p < 0.50) {
    const t = (p - 0.25) / 0.25;
    swing = lerp(0.15, 0.85, easeInOutQuad(t));
  } else if (p >= 0.50 && p < 0.75) {
    const t = (p - 0.50) / 0.25;
    followThrough = easeOutCubic(t);
    swing = lerp(0.85, 1.0, followThrough);
  } else {
    swing = 1.0;
    followThrough = 1.0;
  }

  const baseAngleRad = (batAngleDeg * Math.PI) / 180;
  const batRotRad = lerp(-0.25, baseAngleRad + 0.15, swing);
  const torsoAngleRad = lerp(0.04, 0.20, swing);

  const headX = lerp(0, 6, swing);
  const headY = lerp(-54, -48, swing);
  const headTiltRad = lerp(0.05, 0.18, swing);

  const frontLegX = lerp(8, 16, swing);
  const frontLegY = -28;
  const backLegX = lerp(-10, -12, swing);
  const backLegY = -28;

  const batPivotX = lerp(-4, 10, swing);
  const batPivotY = lerp(-38, -28, swing);

  return {
    torsoAngleRad,
    headX,
    headY,
    headTiltRad,
    frontLegX,
    frontLegY,
    backLegX,
    backLegY,
    batPivotX,
    batPivotY,
    batRotRad,
    padRecoilX: 0,
    padRecoilY: 0,
  };
}

/**
 * Solves continuous wicketkeeper kinematics for Caught Behind.
 */
export function solveCaughtBehindKeeperKinematics(
  p: number,
  hasEdge: boolean
): KeeperKinematics {
  let crouchElevation = 0.0;
  let gloveX = 12;
  let gloveY = -16;
  let isGlovesOpen = true;

  if (p < 0.35) {
    crouchElevation = 0.0;
    gloveX = 12;
    gloveY = -16;
  } else if (p >= 0.35 && p < 0.52) {
    const t = (p - 0.35) / 0.17;
    const smoothT = easeInOutQuad(t);
    gloveX = lerp(12, 18, smoothT);
    gloveY = lerp(-16, hasEdge ? -22 : -20, smoothT);
    crouchElevation = lerp(0.0, 0.1, smoothT);
  } else if (p >= 0.52 && p < 0.70) {
    const t = (p - 0.52) / 0.18;
    const smoothT = easeOutCubic(t);
    gloveX = lerp(18, 14, smoothT);
    gloveY = lerp(-22, -18, smoothT);
    isGlovesOpen = false;
    crouchElevation = lerp(0.1, 0.25, smoothT);
  } else {
    const t = (p - 0.70) / 0.25;
    const smoothT = clamp(easeInOutQuad(t), 0, 1);
    crouchElevation = lerp(0.25, 1.0, smoothT);
    gloveX = lerp(14, 0, smoothT);
    gloveY = lerp(-18, -52, smoothT);
  }

  const torsoAngleRad = lerp(0.15, -0.1, crouchElevation);
  const headTiltRad = lerp(0.1, -0.2, crouchElevation);

  return {
    crouchElevation,
    torsoAngleRad,
    headTiltRad,
    gloveX,
    gloveY,
    isGlovesOpen,
  };
}

/**
 * Solves continuous runner kinematics for Run-Out across the replay timeline.
 * Forward Kinematic Hierarchy: Pelvis Root -> Spine/Torso -> Neck/Head -> Shoulders/Arms/Bat -> Hips/Knees/Feet.
 * Sprint acceleration -> Dive launch -> Crease reach -> Skidding momentum.
 */
export function solveRunOutRunnerKinematics(
  p: number,
  creaseX: number,
  marginPx: number,
  diveTechnique: string = "FULL_DIVE"
): { runnerX: number; runnerY: number; runnerK: RunnerKinematics } {
  const targetBatTipX = creaseX - marginPx; // Safe = inside (left), Out = short (right)
  const isUpright = diveTechnique === "UPRIGHT_RUN";

  let runnerX = 580;
  let diveProgress = 0.0; // 0.0 (upright sprint) to 1.0 (horizontal dive)
  let isAirborne = false;
  let isGrounded = true;

  // Stride animation cycle during sprint
  const stridePhase = p * Math.PI * 14;

  if (p < 0.35) {
    // Phase 1: High speed sprint approach
    const t = p / 0.35;
    runnerX = lerp(580, 430, t);
    diveProgress = 0.0;
    isAirborne = false;
    isGrounded = true;
  } else if (p >= 0.35 && p < 0.54) {
    // Phase 2: Launch into dive
    const t = (p - 0.35) / 0.19;
    diveProgress = isUpright ? 0.0 : easeInOutQuad(t);
    runnerX = lerp(430, targetBatTipX + (isUpright ? 40 : 70), easeOutCubic(t));
    isAirborne = diveProgress > 0.3 && diveProgress < 0.85;
    isGrounded = !isAirborne;
  } else if (p >= 0.54 && p < 0.65) {
    // Phase 3: Airborne extension & crease reach (bat reaches target at p=0.62)
    const t = (p - 0.54) / 0.11;
    diveProgress = isUpright ? 0.0 : 1.0;
    runnerX = lerp(targetBatTipX + (isUpright ? 40 : 70), targetBatTipX + (isUpright ? 30 : 60), t);
    isAirborne = t < 0.6;
    isGrounded = t >= 0.6;
  } else {
    // Phase 4: Post-reach turf slide momentum
    const t = (p - 0.65) / 0.35;
    diveProgress = isUpright ? 0.0 : 1.0;
    runnerX = (targetBatTipX + (isUpright ? 30 : 60)) - t * 35;
    isAirborne = false;
    isGrounded = true;
  }

  // --- Forward Kinematic Angles derived strictly from diveProgress ---
  // Torso / Spine: upright sprint (0.24 rad) -> full horizontal dive (1.48 rad)
  const torsoAngleRad = lerp(0.24 + Math.sin(stridePhase) * 0.04, 1.48, diveProgress);
  const torsoLength = 28;

  // Pelvis vertical height offset: running bounce (0 to 3) -> drop down to slide (10px)
  const sprintBounce = Math.abs(Math.sin(stridePhase)) * 3;
  const pelvisOffsetY = lerp(sprintBounce, 10, diveProgress);

  // Head tilt: during dive, runner lifts neck/chin up to look down the pitch towards crease
  const headTiltRad = lerp(0.06, -0.42, diveProgress);

  // Lead Arm (reaches forward with bat towards crease)
  const sprintLeadArm = -Math.sin(stridePhase) * 0.6 + 0.35;
  const leadShoulderAngleRad = lerp(sprintLeadArm, 1.54, diveProgress);
  const leadElbowAngleRad = lerp(0.5, 0.05, diveProgress);
  const batGripAngleRad = lerp(-0.4, 0.06, diveProgress);

  // Rear Arm (counter-balance pump in sprint -> streamlined back in dive)
  const sprintRearArm = Math.sin(stridePhase) * 0.6;
  const rearShoulderAngleRad = lerp(sprintRearArm, -0.65, diveProgress);
  const rearElbowAngleRad = lerp(0.8, 0.2, diveProgress);

  // Lead Leg (hip -> knee)
  const sprintLeadHip = Math.sin(stridePhase) * 0.75;
  const sprintLeadKnee = Math.max(0, -Math.sin(stridePhase) * 1.1);
  const leadHipAngleRad = lerp(sprintLeadHip, -0.12, diveProgress);
  const leadKneeAngleRad = lerp(sprintLeadKnee, 0.15, diveProgress);

  // Trail Leg (hip -> knee)
  const sprintTrailHip = -Math.sin(stridePhase) * 0.75;
  const sprintTrailKnee = Math.max(0, Math.sin(stridePhase) * 1.1);
  const trailHipAngleRad = lerp(sprintTrailHip, -0.32, diveProgress);
  const trailKneeAngleRad = lerp(sprintTrailKnee, 0.25, diveProgress);

  return {
    runnerX,
    runnerY: 200,
    runnerK: {
      diveProgress,
      isAirborne,
      isGrounded,
      pelvisOffsetY,
      torsoAngleRad,
      torsoLength,
      headTiltRad,
      leadShoulderAngleRad,
      leadElbowAngleRad,
      batGripAngleRad,
      rearShoulderAngleRad,
      rearElbowAngleRad,
      leadHipAngleRad,
      leadKneeAngleRad,
      trailHipAngleRad,
      trailKneeAngleRad,
    },
  };
}

/**
 * Solves canonical wicketkeeper kinematics for Run-Out / direct hit scenarios.
 * Driven by gatherProgress from the canonical Run-Out physics timeline.
 *
 * The keeper crouches behind the stumps anticipating the throw,
 * rises to collect the ball, and whips the bails off at the stumps.
 *
 * gatherProgress: 0.0 (anticipating) → 0.5 (gathering throw) → 1.0 (bails whipped off / appeal)
 */
export function solveRunOutKeeperKinematics(
  gatherProgress: number,
  isGlovesAtStumps: boolean
): KeeperKinematics {
  const gp = clamp(gatherProgress, 0, 1);

  let crouchElevation = 0.0;
  let gloveX = 10;
  let gloveY = -14;
  let isGlovesOpen = true;

  if (gp < 0.3) {
    // Phase 1: Deep crouch, anticipating throw — gloves low, open, ready
    crouchElevation = 0.0;
    gloveX = 10;
    gloveY = -14;
    isGlovesOpen = true;
  } else if (gp < 0.6) {
    // Phase 2: Rising to collect throw — gloves move towards stumps
    const t = easeInOutQuad((gp - 0.3) / 0.3);
    crouchElevation = lerp(0.0, 0.15, t);
    gloveX = lerp(10, 20, t);
    gloveY = lerp(-14, -20, t);
    isGlovesOpen = true;
  } else if (gp < 0.85) {
    // Phase 3: Collecting and whipping bails — gloves close on ball, move to stumps
    const t = easeOutCubic((gp - 0.6) / 0.25);
    crouchElevation = lerp(0.15, 0.3, t);
    gloveX = lerp(20, 16, t);
    gloveY = lerp(-20, -18, t);
    isGlovesOpen = false;
  } else {
    // Phase 4: Appeal — keeper rises with gloves up
    const t = easeInOutQuad((gp - 0.85) / 0.15);
    crouchElevation = lerp(0.3, 1.0, t);
    gloveX = lerp(16, 0, t);
    gloveY = lerp(-18, -48, t);
    isGlovesOpen = false;
  }

  const torsoAngleRad = lerp(0.15, -0.1, crouchElevation);
  const headTiltRad = lerp(0.1, -0.2, crouchElevation);

  return {
    crouchElevation,
    torsoAngleRad,
    headTiltRad,
    gloveX,
    gloveY,
    isGlovesOpen,
  };
}

/**
 * Solves continuous batter kinematics for Stumping.
 * Batter steps out -> Misses ball -> Desperate back-foot drag towards crease.
 */
export function solveStumpingBatterKinematics(
  p: number,
  creaseX: number,
  marginPx: number
): { batterX: number; batterY: number; batterK: BatterKinematics } {
  // Batter is positioned relative to popping crease
  let advanceProgress = 0.0;
  let stretchBackProgress = 0.0;

  if (p < 0.35) {
    // Advances down pitch
    const t = p / 0.35;
    advanceProgress = easeOutCubic(t);
  } else if (p >= 0.35 && p < 0.65) {
    advanceProgress = 1.0;
    // Beaten & desperate back-foot drag
    const t = (p - 0.35) / 0.30;
    stretchBackProgress = easeInOutQuad(t);
  } else {
    advanceProgress = 1.0;
    stretchBackProgress = 1.0;
  }

  const batterX = creaseX + 28 + advanceProgress * 14;
  const torsoAngleRad = lerp(0.12, 0.28, advanceProgress) - stretchBackProgress * 0.15;
  const headX = lerp(4, 10, advanceProgress);
  const headY = lerp(-50, -46, advanceProgress);

  // Back foot stretches backwards towards crease line
  const backFootReach = lerp(-10, -10 - marginPx * 0.6, stretchBackProgress);
  const backLegX = backFootReach;
  const frontLegX = lerp(14, 22, advanceProgress);

  const batPivotX = lerp(8, 14, advanceProgress);
  const batPivotY = -30;
  const batRotRad = lerp(0.18, 0.40, advanceProgress);

  return {
    batterX,
    batterY: 215,
    batterK: {
      torsoAngleRad,
      headX,
      headY,
      headTiltRad: lerp(0.15, -0.1, stretchBackProgress),
      frontLegX,
      frontLegY: -28,
      backLegX,
      backLegY: -28,
      batPivotX,
      batPivotY,
      batRotRad,
      padRecoilX: 0,
      padRecoilY: 0,
    },
  };
}

/**
 * Solves continuous wicketkeeper kinematics for Stumping.
 * Catch delivery -> Whip gloves into stumps to break bails -> Immediate appeal.
 */
export function solveStumpingKeeperKinematics(p: number): KeeperKinematics {
  let crouchElevation = 0.0;
  let gloveX = 14;
  let gloveY = -18;
  let isGlovesOpen = true;

  if (p < 0.40) {
    // Anticipation crouch
    crouchElevation = 0.0;
    gloveX = 14;
    gloveY = -18;
  } else if (p >= 0.40 && p < 0.55) {
    // Receive ball outside off
    const t = (p - 0.40) / 0.15;
    const smoothT = easeInOutQuad(t);
    gloveX = lerp(14, 20, smoothT);
    gloveY = lerp(-18, -24, smoothT);
  } else if (p >= 0.55 && p < 0.65) {
    // Fast whip towards stumps (breaking bails at p = 0.65)
    const t = (p - 0.55) / 0.10;
    const smoothT = easeOutCubic(t);
    gloveX = lerp(20, -4, smoothT);
    gloveY = lerp(-24, -36, smoothT);
    isGlovesOpen = false;
  } else {
    // 65% - 100%: Passionate stumping appeal
    const t = (p - 0.65) / 0.25;
    const smoothT = clamp(easeInOutQuad(t), 0, 1);
    crouchElevation = lerp(0.1, 1.0, smoothT);
    gloveX = lerp(-4, 0, smoothT);
    gloveY = lerp(-36, -52, smoothT);
  }

  const torsoAngleRad = lerp(0.15, -0.1, crouchElevation);
  const headTiltRad = lerp(0.1, -0.2, crouchElevation);

  return {
    crouchElevation,
    torsoAngleRad,
    headTiltRad,
    gloveX,
    gloveY,
    isGlovesOpen,
  };
}

/**
 * Solves continuous fielder kinematics for Boundary checks.
 * Sprint pursuit -> Athletic slide -> Relay flick -> Post-save reaction.
 */
export function solveBoundaryFielderKinematics(
  p: number,
  isBoundary: boolean,
  cushionApexX: number
): { fielderX: number; fielderY: number; fielderK: FielderKinematics; ballX: number; ballY: number } {
  let targetSlideX = cushionApexX - 30;
  if (isBoundary) {
    targetSlideX = cushionApexX + 15; // Slips onto cushion
  }

  let fielderX = 520;
  let slideProgress = 0.0;

  if (p < 0.45) {
    // High speed pursuit
    const t = p / 0.45;
    fielderX = lerp(520, 390, easeInQuad(t));
    slideProgress = 0.0;
  } else if (p >= 0.45 && p < 0.60) {
    // Drop into horizontal boundary slide
    const t = (p - 0.45) / 0.15;
    fielderX = lerp(390, targetSlideX, easeOutCubic(t));
    slideProgress = easeInOutQuad(t);
  } else {
    // Skidding momentum
    const t = (p - 0.60) / 0.40;
    fielderX = targetSlideX + t * 14;
    slideProgress = 1.0;
  }

  const torsoAngleRad = lerp(0.30, Math.PI * 0.42, slideProgress);
  const headX = lerp(10, 28, slideProgress);
  const headY = lerp(-24, -6, slideProgress);

  const frontLegX = lerp(6, -14, slideProgress);
  const frontLegY = lerp(-16, 2, slideProgress);
  const backLegX = lerp(-12, -28, slideProgress);
  const backLegY = lerp(-12, -2, slideProgress);

  const reachArmAngleRad = lerp(0.3, -Math.PI * 0.45, slideProgress);

  // Ball position & relay toss
  let ballX = fielderX - 32;
  let ballY = 196;

  if (p >= 0.60) {
    const tFlick = (p - 0.60) / 0.40;
    if (!isBoundary) {
      ballX = fielderX - 32 - tFlick * 45;
      ballY = 196 - Math.sin(tFlick * Math.PI) * 65; // High aerial parabolic toss
    } else {
      ballX = fielderX - 28;
      ballY = 196;
    }
  }

  return {
    fielderX,
    fielderY: 196,
    fielderK: {
      torsoAngleRad,
      headX,
      headY,
      frontLegX,
      frontLegY,
      backLegX,
      backLegY,
      reachArmAngleRad,
      isSliding: slideProgress > 0.4,
      slideProgress,
    },
    ballX,
    ballY,
  };
}

// ================================================================
// 1. ARTICULATED BATTER RIG RENDERER
// ================================================================
export function drawArticulatedBatter(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  k: BatterKinematics
) {
  const scale = t.scale ?? 1.0;
  const facingDir = t.facing === "LEFT" ? -1 : 1;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scale * facingDir, scale);
  if (t.rotationDeg) {
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
  }
  if (t.opacity !== undefined) {
    ctx.globalAlpha = t.opacity;
  }

  // --- Ground Contact Shadow ---
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(k.frontLegX * 0.5, 0, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- 1. Rear Leg & Rear Pad ---
  ctx.save();
  ctx.translate(k.backLegX, k.backLegY);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(-4, 0, 8, 14);
  ctx.fillStyle = "#cbd5e1";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(-5, 12, 10, 24, 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(-2, 36, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 2. Torso & Flannels ---
  ctx.save();
  ctx.translate(0, -32);
  ctx.rotate(k.torsoAngleRad);
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-10, -18, 20, 26, [4, 4, 2, 2]);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.moveTo(-4, -18);
  ctx.lineTo(0, -10);
  ctx.lineTo(4, -18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- 3. Head & Protective Helmet ---
  ctx.save();
  ctx.translate(k.headX, k.headY);
  ctx.rotate(k.headTiltRad);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(1, -3, 9, 4, 1);
  ctx.fill();
  ctx.fillStyle = "#d4a373";
  ctx.beginPath();
  ctx.arc(2, 2, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(3, -1);
  ctx.lineTo(8, 3);
  ctx.lineTo(3, 7);
  ctx.moveTo(5, 1);
  ctx.lineTo(9, 6);
  ctx.stroke();
  ctx.restore();

  // --- 4. Front Leg & Front Batting Pad ---
  ctx.save();
  ctx.translate(k.frontLegX + k.padRecoilX, k.frontLegY + k.padRecoilY);
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(-5, 0, 10, 14);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-6, 10, 13, 26, 3);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-5, 18);
  ctx.lineTo(6, 18);
  ctx.moveTo(-5, 23);
  ctx.lineTo(6, 23);
  ctx.moveTo(-5, 28);
  ctx.lineTo(6, 28);
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(-5, 8, 11, 4, 1);
  ctx.fill();

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(3, 36, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 34, 5, 2);
  ctx.restore();

  // --- 5. Arms, Gloves & Contoured Willow Bat ---
  ctx.save();
  ctx.translate(k.batPivotX, k.batPivotY);
  ctx.rotate(k.batRotRad);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.6;
  ctx.fillRect(-2, -18, 4, 18);
  ctx.strokeRect(-2, -18, 4, 18);

  ctx.fillStyle = "#0284c7";
  ctx.beginPath();
  ctx.roundRect(-4, -14, 8, 7, 2);
  ctx.roundRect(-4, -6, 8, 7, 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-3, -12, 6, 2.5);
  ctx.fillRect(-3, -4, 6, 2.5);

  ctx.fillStyle = "#d97706";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-3.5, 0, 7, 46, [1, 1, 3, 3]);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#b45309";
  ctx.fillRect(-1.5, 4, 3, 38);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-3, 2, 6, 6);

  ctx.restore();

  ctx.restore();
}

// ================================================================
// 1B. ARTICULATED RUNNER RIG RENDERER (FORWARD KINEMATIC TREE)
// ================================================================
export function drawArticulatedRunner(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  k: RunnerKinematics
) {
  const scale = t.scale ?? 1.0;
  const facingDir = t.facing === "LEFT" ? -1 : 1;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scale * facingDir, scale);
  if (t.rotationDeg) {
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
  }
  if (t.opacity !== undefined) {
    ctx.globalAlpha = t.opacity;
  }

  // --- 1. Unified Ground Contact / Slide Shadow ---
  ctx.fillStyle = k.isAirborne ? "rgba(0, 0, 0, 0.15)" : "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  if (k.diveProgress < 0.25) {
    ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2);
  } else {
    // Elongated slide shadow spanning runner's body and reaching bat
    const shadowCenter = 28 * k.diveProgress;
    const shadowWidth = 18 + 42 * k.diveProgress;
    ctx.ellipse(shadowCenter, 0, shadowWidth, 5, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  // --- 2. Pelvis Root ---
  const pelvisX = 0;
  const pelvisY = -22 + k.pelvisOffsetY;

  // --- 3. Spine / Torso Vector ---
  const torsoL = k.torsoLength;
  const shoulderX = pelvisX + Math.sin(k.torsoAngleRad) * torsoL;
  const shoulderY = pelvisY - Math.cos(k.torsoAngleRad) * torsoL;

  // --- 4. Rear Arm (Drawn behind body) ---
  const rearArmL = 14;
  const rearElbowX = shoulderX - Math.sin(k.rearShoulderAngleRad) * rearArmL;
  const rearElbowY = shoulderY + Math.cos(k.rearShoulderAngleRad) * rearArmL;
  const rearHandX = rearElbowX - Math.sin(k.rearShoulderAngleRad + k.rearElbowAngleRad) * rearArmL;
  const rearHandY = rearElbowY + Math.cos(k.rearShoulderAngleRad + k.rearElbowAngleRad) * rearArmL;

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(rearElbowX, rearElbowY);
  ctx.lineTo(rearHandX, rearHandY);
  ctx.stroke();

  // Rear Glove
  ctx.fillStyle = "#0284c7";
  ctx.beginPath();
  ctx.arc(rearHandX, rearHandY, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // --- 5. Trail / Rear Leg (Drawn behind body) ---
  const thighL = 16;
  const shinL = 16;
  const trailHipX = pelvisX - 4;
  const trailHipY = pelvisY;
  const trailKneeX = trailHipX - Math.sin(k.trailHipAngleRad) * thighL;
  const trailKneeY = trailHipY + Math.cos(k.trailHipAngleRad) * thighL;
  const trailFootX = trailKneeX - Math.sin(k.trailHipAngleRad + k.trailKneeAngleRad) * shinL;
  const trailFootY = trailKneeY + Math.cos(k.trailHipAngleRad + k.trailKneeAngleRad) * shinL;

  // Trail Leg bone / flannels
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(trailHipX, trailHipY);
  ctx.lineTo(trailKneeX, trailKneeY);
  ctx.stroke();

  // Trail Batting Pad
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.0;
  ctx.fillStyle = "#e2e8f0";
  ctx.beginPath();
  const padAngle = Math.atan2(trailFootY - trailKneeY, trailFootX - trailKneeX);
  ctx.save();
  ctx.translate((trailKneeX + trailFootX) / 2, (trailKneeY + trailFootY) / 2);
  ctx.rotate(padAngle - Math.PI / 2);
  ctx.roundRect(-4.5, -8, 9, 16, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Trail Shoe / Spikes
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(trailFootX, trailFootY, 5, 2.5, padAngle, 0, Math.PI * 2);
  ctx.fill();

  // --- 6. Pelvis / Shorts ---
  ctx.fillStyle = "#f1f5f9";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(pelvisX - 6, pelvisY - 4, 12, 8, 2);
  ctx.fill();
  ctx.stroke();

  // --- 7. Torso / Jersey ---
  ctx.save();
  ctx.translate((pelvisX + shoulderX) / 2, (pelvisY + shoulderY) / 2);
  ctx.rotate(k.torsoAngleRad);
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-8, -torsoL / 2, 16, torsoL, [4, 4, 2, 2]);
  ctx.fill();
  ctx.stroke();

  // Jersey collar V
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.moveTo(-3, -torsoL / 2);
  ctx.lineTo(0, -torsoL / 2 + 6);
  ctx.lineTo(3, -torsoL / 2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- 8. Head & Helmet (Derived strictly from Shoulders / Neck) ---
  const neckL = 10;
  const headAngle = k.torsoAngleRad + k.headTiltRad;
  const headX = shoulderX + Math.sin(headAngle) * neckL;
  const headY = shoulderY - Math.cos(headAngle) * neckL;

  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(headAngle);

  // Helmet Shell
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();

  // Helmet Peak / Visor
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(1, -3, 9, 4, 1);
  ctx.fill();

  // Face / Chin
  ctx.fillStyle = "#d4a373";
  ctx.beginPath();
  ctx.arc(2, 2, 5, 0, Math.PI * 2);
  ctx.fill();

  // Steel Visor Grille
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(3, -1);
  ctx.lineTo(8, 3);
  ctx.lineTo(3, 7);
  ctx.moveTo(5, 1);
  ctx.lineTo(9, 6);
  ctx.stroke();
  ctx.restore();

  // --- 9. Lead / Front Leg ---
  const leadHipX = pelvisX + 4;
  const leadHipY = pelvisY;
  const leadKneeX = leadHipX + Math.sin(k.leadHipAngleRad) * thighL;
  const leadKneeY = leadHipY + Math.cos(k.leadHipAngleRad) * thighL;
  const leadFootX = leadKneeX + Math.sin(k.leadHipAngleRad + k.leadKneeAngleRad) * shinL;
  const leadFootY = leadKneeY + Math.cos(k.leadHipAngleRad + k.leadKneeAngleRad) * shinL;

  // Lead Thigh
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(leadHipX, leadHipY);
  ctx.lineTo(leadKneeX, leadKneeY);
  ctx.stroke();

  // Lead Batting Pad
  const leadPadAngle = Math.atan2(leadFootY - leadKneeY, leadFootX - leadKneeX);
  ctx.save();
  ctx.translate((leadKneeX + leadFootX) / 2, (leadKneeY + leadFootY) / 2);
  ctx.rotate(leadPadAngle - Math.PI / 2);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.roundRect(-5.5, -9, 11, 18, 2.5);
  ctx.fill();
  ctx.stroke();

  // Pad straps
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(-4.5, -3);
  ctx.lineTo(4.5, -3);
  ctx.moveTo(-4.5, 3);
  ctx.lineTo(4.5, 3);
  ctx.stroke();
  ctx.restore();

  // Lead Shoe / Spikes
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(leadFootX, leadFootY, 6, 3, leadPadAngle, 0, Math.PI * 2);
  ctx.fill();

  // --- 10. Lead Arm, Gloves & Bat ---
  const leadArmL = 15;
  const leadElbowX = shoulderX + Math.sin(k.leadShoulderAngleRad) * leadArmL;
  const leadElbowY = shoulderY - Math.cos(k.leadShoulderAngleRad) * leadArmL;
  const leadHandX = leadElbowX + Math.sin(k.leadShoulderAngleRad + k.leadElbowAngleRad) * leadArmL;
  const leadHandY = leadElbowY - Math.cos(k.leadShoulderAngleRad + k.leadElbowAngleRad) * leadArmL;

  // Arm
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(leadElbowX, leadElbowY);
  ctx.lineTo(leadHandX, leadHandY);
  ctx.stroke();

  // Batting Gloves (Lead & Secondary)
  ctx.fillStyle = "#0284c7";
  ctx.beginPath();
  ctx.roundRect(leadHandX - 4, leadHandY - 4, 8, 7, 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(leadHandX - 3, leadHandY - 2, 6, 2);

  // Bat Grip & Blade (Derives strictly from Lead Hand)
  const batAngle = k.leadShoulderAngleRad + k.batGripAngleRad;
  ctx.save();
  ctx.translate(leadHandX, leadHandY);
  ctx.rotate(batAngle - Math.PI / 2);

  // Handle & Rubber Grip
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.6;
  ctx.fillRect(-2, -14, 4, 14);
  ctx.strokeRect(-2, -14, 4, 14);

  // Grip texture
  ctx.fillStyle = "#0284c7";
  ctx.fillRect(-3, -10, 6, 3);
  ctx.fillRect(-3, -5, 6, 3);

  // Willow Blade
  ctx.fillStyle = "#d97706";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.roundRect(-3.5, 0, 7, 44, [1, 1, 3, 3]);
  ctx.fill();
  ctx.stroke();

  // Blade Spine & Red Sponsor Sticker
  ctx.fillStyle = "#b45309";
  ctx.fillRect(-1.5, 4, 3, 36);
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-3, 2, 6, 6);

  ctx.restore();

  ctx.restore();
}

// ================================================================
// 2. ARTICULATED BOWLER RIG RENDERER
// ================================================================
export function drawArticulatedBowler(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  k: BowlerKinematics
) {
  const scale = t.scale ?? 1.0;
  const facingDir = t.facing === "LEFT" ? -1 : 1;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scale * facingDir, scale);
  if (t.rotationDeg) {
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
  }
  if (t.opacity !== undefined) {
    ctx.globalAlpha = t.opacity;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-3, -18 + k.torsoY);
  ctx.lineTo(k.frontLegX, k.frontLegY);
  ctx.moveTo(-3, -18 + k.torsoY);
  ctx.lineTo(k.backLegX, k.backLegY);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(k.frontLegX - 2, k.frontLegY - 2, 6, 3);
  ctx.fillRect(k.backLegX - 2, k.backLegY - 2, 6, 3);

  ctx.save();
  ctx.translate(0, -22 + k.torsoY);
  ctx.rotate(k.torsoAngleRad);
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-7, -14, 14, 18, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, -20, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(1, -22, 6, 2.5);
  ctx.restore();

  ctx.save();
  ctx.translate(0, -32 + k.torsoY);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-4 + Math.cos(k.nonBowlingArmAngleRad) * 14, Math.sin(k.nonBowlingArmAngleRad) * 14);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(3 + Math.cos(k.bowlingArmAngleRad) * 16, Math.sin(k.bowlingArmAngleRad) * 16);
  ctx.stroke();
  ctx.fillStyle = "#d4a373";
  ctx.beginPath();
  ctx.arc(3 + Math.cos(k.bowlingArmAngleRad) * 17, Math.sin(k.bowlingArmAngleRad) * 17, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.restore();
}

// ================================================================
// 3. ARTICULATED WICKETKEEPER RIG RENDERER
// ================================================================
export function drawArticulatedWicketkeeper(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  k: KeeperKinematics
) {
  const scale = t.scale ?? 1.0;
  const facingDir = t.facing === "LEFT" ? -1 : 1;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scale * facingDir, scale);
  if (t.rotationDeg) {
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
  }
  if (t.opacity !== undefined) {
    ctx.globalAlpha = t.opacity;
  }

  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyY = lerp(-20, -32, k.crouchElevation);
  const headY = lerp(-32, -46, k.crouchElevation);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  const kneeSpread = lerp(8, 4, k.crouchElevation);
  const legHeight = lerp(14, 20, k.crouchElevation);
  ctx.fillRect(-kneeSpread - 4, -legHeight, 6, legHeight);
  ctx.fillRect(kneeSpread - 2, -legHeight, 6, legHeight);
  ctx.strokeRect(-kneeSpread - 4, -legHeight, 6, legHeight);
  ctx.strokeRect(kneeSpread - 2, -legHeight, 6, legHeight);

  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-kneeSpread - 6, -2, 9, 3);
  ctx.fillRect(kneeSpread - 2, -2, 9, 3);

  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(k.torsoAngleRad);
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-8, -12, 16, 16, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(k.headTiltRad);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(1, -3, 7, 3);
  ctx.restore();

  ctx.fillStyle = "#16a34a";
  ctx.strokeStyle = "#14532d";
  ctx.lineWidth = 1;

  if (k.crouchElevation > 0.8) {
    ctx.beginPath();
    ctx.arc(-8, k.gloveY, 6, 0, Math.PI * 2);
    ctx.arc(8, k.gloveY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.ellipse(k.gloveX, k.gloveY, 7.5, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(k.gloveX - 1, k.gloveY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ================================================================
// 4. ARTICULATED FIELDER RIG RENDERER
// ================================================================
export function drawArticulatedFielder(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  k: FielderKinematics
) {
  const scale = t.scale ?? 1.0;
  const facingDir = t.facing === "LEFT" ? -1 : 1;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scale * facingDir, scale);
  if (t.rotationDeg) {
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
  }
  if (t.opacity !== undefined) {
    ctx.globalAlpha = t.opacity;
  }

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(0, 2, k.isSliding ? 38 : 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.save();
  ctx.translate(0, -14);
  ctx.rotate(k.torsoAngleRad);
  ctx.fillStyle = "#0f172a"; // Colored training jersey
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-8, -12, 16, 16, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Head
  ctx.save();
  ctx.translate(k.headX, k.headY);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(1, -3, 7, 3); // Cap peak
  ctx.restore();

  // Sliding legs / Stride legs
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(k.frontLegX, k.frontLegY);
  ctx.moveTo(0, -10);
  ctx.lineTo(k.backLegX, k.backLegY);
  ctx.stroke();

  // Shoes
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(k.frontLegX - 3, k.frontLegY - 2, 7, 3);
  ctx.fillRect(k.backLegX - 3, k.backLegY - 2, 7, 3);

  // Outstretched Intercept Arm
  ctx.save();
  ctx.translate(0, -18);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-24, 6);
  ctx.stroke();
  // Hand
  ctx.fillStyle = "#d4a373";
  ctx.beginPath();
  ctx.arc(-26, 6, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// ================================================================
// 5. STUMPS & ZING BAILS
// ================================================================
export function drawStumpsAndBails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { scale?: number; bailsDislodged?: boolean; dislodgeProgress?: number; isZing?: boolean } = {}
) {
  const scale = opts.scale ?? 1.0;
  const isDislodged = opts.bailsDislodged ?? false;
  const dislodgeT = opts.dislodgeProgress ?? (isDislodged ? 1.0 : 0.0);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f59e0b";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 0.6;

  for (let i = -1; i <= 1; i++) {
    const stumpX = i * 6.5;
    ctx.beginPath();
    ctx.roundRect(stumpX - 1.6, -34, 3.2, 34, [1, 1, 0, 0]);
    ctx.fill();
    ctx.stroke();
  }

  if (!isDislodged || dislodgeT <= 0.0) {
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 0.5;
    ctx.fillRect(-9, -37, 8, 3);
    ctx.strokeRect(-9, -37, 8, 3);
    ctx.fillRect(1, -37, 8, 3);
    ctx.strokeRect(1, -37, 8, 3);
  } else {
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 8;

    const b1X = -9 - dislodgeT * 24;
    const b1Y = -37 - dislodgeT * 18 + dislodgeT * dislodgeT * 26;
    ctx.save();
    ctx.translate(b1X, b1Y);
    ctx.rotate(-dislodgeT * 3);
    ctx.fillRect(-4, -1.5, 8, 3);
    ctx.restore();

    const b2X = 1 + dislodgeT * 22;
    const b2Y = -37 - dislodgeT * 22 + dislodgeT * dislodgeT * 30;
    ctx.save();
    ctx.translate(b2X, b2Y);
    ctx.rotate(dislodgeT * 3.5);
    ctx.fillRect(-4, -1.5, 8, 3);
    ctx.restore();

    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ================================================================
// 6. CRICKET BALL (3D Shaded Sphere with Seam & Motion Blur)
// ================================================================
export function drawCricketBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { radius?: number; seamAngleRad?: number; shadowY?: number; motionTrail?: boolean; prevX?: number; prevY?: number } = {}
) {
  const r = opts.radius ?? 5.5;
  const seamAngle = opts.seamAngleRad ?? 0.0;

  ctx.save();

  if (opts.motionTrail && opts.prevX !== undefined && opts.prevY !== undefined) {
    ctx.strokeStyle = "rgba(220, 38, 38, 0.25)";
    ctx.lineWidth = r * 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(opts.prevX, opts.prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  if (opts.shadowY !== undefined) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(x + 1.5, opts.shadowY, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, "#ef4444");
  grad.addColorStop(0.7, "#dc2626");
  grad.addColorStop(1, "#7f1d1d");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 0.6;
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.85, r * 0.22, seamAngle, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
