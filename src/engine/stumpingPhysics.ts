import type { StumpingData } from "../types/scenario";

export interface StumpingReplayState {
  timeMs: number;
  progress: number;
  batter: {
    stanceX: number;
    heelRaised: boolean;
    heelElevationNorm: number;
    toeAltitudeMm: number;
    isGrounded: boolean;
    toeCreaseOffsetMm: number;
    footAngleRad: number;
  };
  keeper: {
    gatherProgress: number;
    isBallSecured: boolean;
    isGlovesAtStumps: boolean;
    crouchElevation: number;
    gloveX: number;
    gloveY: number;
  };
  stumps: {
    bailsSeparating: boolean;
    bailDisplacementMm: { x: number; y: number; z: number };
    bailRotationDeg: number;
  };
  ball: {
    isInFlight: boolean;
    flightProgress: number;
    isHeldByKeeper: boolean;
  };
  timeline: {
    ballArrivalMs: number;
    keeperGatherMs: number;
    keeperWhipMs: number;
    bailsDislodgedMs: number;
    groundedMs: number;
    marginMs: number;
  };
}

export function solveStumpingReplayState(
  stumping: StumpingData,
  timeMs: number
): StumpingReplayState {
  const totalDuration = 2200;
  const progress = Math.min(1, Math.max(0, timeMs / totalDuration));

  // --- Ball & Keeper Timeline ---
  const ballArrivalMs = stumping.ballArrivalMs ?? 1040;
  const keeperGatherMs = stumping.keeperGatherMs ?? 1160;
  const keeperWhipMs = stumping.keeperWhipMs ?? 1350;
  const bailsDislodgedMs = stumping.bailsDislodgedFrameMs ?? 1500;
  const groundedMs = stumping.groundedFrameMs ?? (bailsDislodgedMs + stumping.marginMs);
  const marginMs = stumping.marginMs;

  const isInFlight = timeMs < ballArrivalMs;
  const flightProgress = Math.min(1, Math.max(0, timeMs / ballArrivalMs));
  const isBallSecured = timeMs >= keeperGatherMs;
  const gatherProgress = Math.min(1, Math.max(0, (timeMs - ballArrivalMs) / (keeperGatherMs - ballArrivalMs || 1)));

  // Keeper whip towards stumps (starts ~1350ms, impacts ~1500ms)
  const isGlovesAtStumps = timeMs >= bailsDislodgedMs - 40;

  // Keeper crouch / gather kinematics
  let crouchElevation = 0.0;
  let gloveX = 14;
  let gloveY = -18;
  if (timeMs < ballArrivalMs) {
    crouchElevation = 0.0;
    gloveX = 14;
    gloveY = -18;
  } else if (timeMs < keeperGatherMs) {
    const t = (timeMs - ballArrivalMs) / (keeperGatherMs - ballArrivalMs);
    gloveX = 14 + t * 6;
    gloveY = -18 - t * 2;
    crouchElevation = t * 0.1;
  } else if (timeMs < bailsDislodgedMs) {
    const t = (timeMs - keeperGatherMs) / (bailsDislodgedMs - keeperGatherMs);
    gloveX = 20 - t * 6; // whip towards stumps
    gloveY = -20 + t * 2;
    crouchElevation = 0.1 + t * 0.2;
  } else {
    const t = Math.min(1, (timeMs - bailsDislodgedMs) / 500);
    gloveX = 14 - t * 14;
    gloveY = -18 - t * 30; // appeal
    crouchElevation = 0.3 + t * 0.7;
  }

  // --- Stumps & Zing Bails ---
  const bailsSeparating = timeMs >= bailsDislodgedMs;
  let bailDisplacementMm = { x: 0, y: 0, z: 0 };
  let bailRotationDeg = 0;
  if (bailsSeparating) {
    const dt = Math.min(1, (timeMs - bailsDislodgedMs) / 300);
    bailDisplacementMm = {
      x: dt * 70,
      y: dt * 35,
      z: dt * 50,
    };
    bailRotationDeg = dt * 50;
  }

  // --- Batter Stationary Upper Body & Rear-Leg Kinematics ---
  // Stance is fixed at batterStanceCreaseX (creaseX + 10)
  const stanceX = stumping.batterStanceCreaseX ?? 300;

  // Heel lift: begins as ball approaches (~800ms) and peaks at ~1200ms
  let heelElevationNorm = 0.0;
  if (timeMs >= 800 && timeMs < 1200) {
    heelElevationNorm = (timeMs - 800) / 400;
  } else if (timeMs >= 1200) {
    heelElevationNorm = 1.0;
  }
  const heelRaised = heelElevationNorm > 0.3;

  // Toe altitude & grounding:
  let toeAltitudeMm = 0;
  let isGrounded = true;

  if (marginMs < 0) {
    // NOT OUT: Toe lifts during delivery, but grounds BEFORE bails break (groundedMs < bailsDislodgedMs)
    if (timeMs < 950) {
      toeAltitudeMm = 0;
      isGrounded = true;
    } else if (timeMs < groundedMs) {
      const t = (timeMs - 950) / (groundedMs - 950);
      toeAltitudeMm = Math.sin(t * Math.PI) * 18;
      isGrounded = false;
    } else {
      // Grounded safely behind crease line before bails dislodge
      toeAltitudeMm = 0;
      isGrounded = true;
    }
  } else {
    // OUT: Toe lifts during delivery and remains airborne (or on line) when bails break at 1500ms
    if (timeMs < 950) {
      toeAltitudeMm = 0;
      isGrounded = true;
    } else if (timeMs < groundedMs) {
      const t = Math.min(1, (timeMs - 950) / (groundedMs - 950));
      // Parabolic arc that stays elevated at 1500ms
      toeAltitudeMm = Math.max(6, Math.sin(t * Math.PI * 0.85) * 22);
      isGrounded = false;
    } else {
      // Late touch down after bails broken
      toeAltitudeMm = 0;
      isGrounded = true;
    }
  }

  // Toe distance relative to popping crease (in mm, + behind crease, - short/in front)
  // Base stance clearance is +25mm behind crease
  let toeCreaseOffsetMm = 25;
  if (timeMs < 1000) {
    toeCreaseOffsetMm = 25;
  } else if (timeMs < bailsDislodgedMs) {
    const t = (timeMs - 1000) / (bailsDislodgedMs - 1000);
    toeCreaseOffsetMm = 25 + (stumping.creaseMarginMm - 25) * t;
  } else {
    // Post-break recovery drag
    const t = Math.min(1, (timeMs - bailsDislodgedMs) / 400);
    toeCreaseOffsetMm = stumping.creaseMarginMm + (35 - stumping.creaseMarginMm) * t;
  }

  const footAngleRad = -heelElevationNorm * 0.45;

  return {
    timeMs,
    progress,
    batter: {
      stanceX,
      heelRaised,
      heelElevationNorm,
      toeAltitudeMm,
      isGrounded,
      toeCreaseOffsetMm,
      footAngleRad,
    },
    keeper: {
      gatherProgress,
      isBallSecured,
      isGlovesAtStumps,
      crouchElevation,
      gloveX,
      gloveY,
    },
    stumps: {
      bailsSeparating,
      bailDisplacementMm,
      bailRotationDeg,
    },
    ball: {
      isInFlight,
      flightProgress,
      isHeldByKeeper: isBallSecured,
    },
    timeline: {
      ballArrivalMs,
      keeperGatherMs,
      keeperWhipMs,
      bailsDislodgedMs,
      groundedMs,
      marginMs,
    },
  };
}
