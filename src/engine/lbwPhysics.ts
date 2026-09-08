/**
 * lbwPhysics.ts
 * Canonical 3D delivery physics and trajectory solver for LBW incidents.
 *
 * Single Source of Truth for:
 * 1. Ball 3D position (X, Y, Z) and velocity at any replay timestamp t ∈ [600, 2200]
 * 2. Canonical trajectory waypoints: Bowler Release -> Pitch Bounce -> Pad/Bat Impact -> Stumps Hit
 * 3. Physical bat contact detection, deflection dynamics, and bat-pad separation
 * 4. Coordinate projection to CAM 01 3D world space and CAM 03 Hawk-Eye SVG space
 */

import type { LBWData } from "../types/scenario";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const LBW_TIMESTAMPS = {
  T_NEUTRAL: 600,
  T_RELEASE: 800,
  T_BOUNCE: 1200,
  T_INTERCEPT: 1410, // Frame of potential bat contact
  T_IMPACT: 1500,    // Frame of pad impact / dead ball
  T_STUMPS: 1680,    // Projected arrival at striker stumps plane
  T_END: 2200,
} as const;

export interface LBWWaypoints {
  release: Vec3;
  bounce: Vec3;
  impact: Vec3;
  stumps: Vec3;
  batContact: Vec3;
}

export interface LBWReplayState {
  currentTimeMs: number;
  ball: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    inFlight: boolean;
    hasBounced: boolean;
    hasHitBat: boolean;
    hasHitPad: boolean;
    isDead: boolean;
  };
  batter: {
    anchor: Vec3;
    frontPadWorld: Vec3;
    backPadWorld: Vec3;
    batGloveWorld: Vec3;
    batTipWorld: Vec3;
    batAngleRad: number;
    stride: number;
    swing: number;
    hasDeflectedBall: boolean;
  };
  waypoints: LBWWaypoints;
}

export function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function mul(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

export function bezier(p0: Vec3, p1: Vec3, p2: Vec3, t: number): Vec3 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    z: u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
  };
}

/**
 * Returns the canonical 3D waypoints for an LBW scenario.
 * Pitch coordinate space:
 * - Striker stumps base: (0, 0, 0)
 * - +X: lateral right (from bowler's perspective looking down pitch)
 * - -X: lateral left
 * - +Y: vertical height above turf in meters
 * - +Z: distance along pitch towards bowler in meters (striker stumps Z = 0, popping crease Z = 1.22, bowler stumps Z = 20.12)
 */
export function getLBWWaypoints(lbw: LBWData): LBWWaypoints {
  const release: Vec3 = {
    x: lbw.pitchX * 0.35,
    y: 2.15,
    z: 18.2,
  };

  const bounce: Vec3 = {
    x: lbw.pitchX,
    y: 0.036,
    z: 6.5,
  };

  const stumps: Vec3 = {
    x: lbw.stumpHitX,
    y: Math.max(0.15, Math.min(0.95, lbw.stumpHitHeightCm / 100)),
    z: 0.0,
  };

  // Pad impact point is the exact position on continuous trajectory at T_IMPACT (1500ms)
  const uImpact = (LBW_TIMESTAMPS.T_IMPACT - LBW_TIMESTAMPS.T_BOUNCE) / (LBW_TIMESTAMPS.T_STUMPS - LBW_TIMESTAMPS.T_BOUNCE); // 0.625
  const yApex = Math.max(0.68, stumps.y + 0.18);
  const ctrlPost: Vec3 = {
    x: lerp(bounce.x, stumps.x, 0.5),
    y: yApex,
    z: lerp(bounce.z, stumps.z, 0.5),
  };
  const impact = bezier(bounce, ctrlPost, stumps, uImpact);

  // Bat intercept waypoint on the delivery line at T_INTERCEPT (1410ms)
  const uIntercept = (LBW_TIMESTAMPS.T_INTERCEPT - LBW_TIMESTAMPS.T_BOUNCE) / (LBW_TIMESTAMPS.T_STUMPS - LBW_TIMESTAMPS.T_BOUNCE); // 0.4375
  const batContact = bezier(bounce, ctrlPost, stumps, uIntercept);

  return { release, bounce, impact, stumps, batContact };
}

/**
 * Solves the complete physical state of the LBW delivery at timeMs.
 * Both CAM 01 and CAM 03 must consume this function as the single source of truth.
 */
export function solveLBWReplayState(lbw: LBWData, timeMs: number): LBWReplayState {
  const waypoints = getLBWWaypoints(lbw);
  const hand = lbw.batterHand === "RIGHT" ? 1 : -1;

  // Stride progress: forward press into the line of delivery
  const stride = clamp01((timeMs - 840) / 460);

  // Bat swing dynamics: forward stroke if shot offered, tucked leave if no shot
  let swing = 0;
  if (lbw.shotOffered) {
    const swingStart = lbw.batContactBeforePad ? 1080 : 1140;
    const swingDuration = lbw.batContactBeforePad ? 320 : 340;
    swing = clamp01((timeMs - swingStart) / swingDuration);
  }

  // Batter base anchor on popping crease
  const anchor: Vec3 = { x: hand * 0.14, y: 0, z: 1.15 };

  // Back foot remains anchored on crease
  const backPadX = hand * -0.16;
  const backPadWorld: Vec3 = {
    x: anchor.x + backPadX,
    y: 0,
    z: 0.85,
  };

  // Front pad strides into the delivery line:
  // At neutral (stride = 0), aligns with authentic batting stance hand * 0.24
  // At impact (stride = 1), front pad is aligned to receive the ball at waypoints.impact.x
  const neutralFrontPadOffset = hand * 0.24;
  const targetFrontPadOffset = waypoints.impact.x - anchor.x;
  const frontPadX = lerp(neutralFrontPadOffset, targetFrontPadOffset, stride);
  const frontPadZ = lerp(1.32, waypoints.impact.z, stride);

  const frontPadWorld: Vec3 = {
    x: anchor.x + frontPadX,
    y: waypoints.impact.y,
    z: frontPadZ,
  };

  // Bat positioning and angle:
  // - If NO SHOT OFFERED: bat raised up/withdrawn, clear daylight to pad
  // - If SHOT OFFERED but NO BAT CONTACT: bat comes down alongside pad with 8cm clearance (inside edge beaten)
  // - If BAT CONTACT: bat aligns directly with ball at T_INTERCEPT (1410ms)
  let batOffsetFromPad = 0;
  let batAngle = -0.04 * hand;
  let gloveY = 1.22;

  if (!lbw.shotOffered) {
    // Tucked bat leave: held up at chest level with vertical alignment
    gloveY = lerp(1.22, 1.28, swing);
    batOffsetFromPad = hand * -0.16; // Pulled behind pad
    batAngle = -0.04 * hand;
  } else if (!lbw.batContactBeforePad) {
    // Shot offered, clean miss: bat comes down vertically alongside front pad
    // Blade remains naturally aligned with hands; never twists inward towards body
    // 135mm offset from pad center provides ~34mm of unambiguous visible daylight outside the 36mm ball radius
    gloveY = lerp(1.22, 0.78, swing);
    batOffsetFromPad = hand * 0.135; // 135mm offset -> 34mm visible daylight between ball edge and bat edge
    batAngle = lerp(-0.04 * hand, -0.01 * hand, swing);
  } else {
    // Prior bat contact: bat blade directly on delivery line
    gloveY = lerp(1.22, 0.78, swing);
    batOffsetFromPad = 0.0; // Directly on delivery line
    batAngle = lerp(-0.04 * hand, 0.01 * hand, swing);
  }

  const gloveX = lerp(hand * 0.12, frontPadX + batOffsetFromPad, swing);
  const bladeDir = { x: Math.sin(batAngle), y: -Math.cos(batAngle) };
  const bladeLength = 0.78;

  const batGloveWorld: Vec3 = {
    x: anchor.x + gloveX,
    y: gloveY,
    z: lerp(1.15, frontPadZ + (lbw.batContactBeforePad ? 0.10 : 0.02), swing),
  };

  const batTipWorld: Vec3 = {
    x: batGloveWorld.x + bladeDir.x * bladeLength,
    y: batGloveWorld.y + bladeDir.y * bladeLength,
    z: batGloveWorld.z,
  };

  // Authoritative Ball State Evaluation
  const { T_RELEASE, T_BOUNCE, T_INTERCEPT, T_IMPACT } = LBW_TIMESTAMPS;
  let ballPos: Vec3;
  let ballVel: Vec3;
  let inFlight = false;
  let hasBounced = false;
  let hasHitBat = false;
  let hasHitPad = false;
  let isDead = false;

  if (timeMs < T_RELEASE) {
    ballPos = { ...waypoints.release };
    ballVel = { x: 0, y: 0, z: 0 };
  } else if (timeMs < T_BOUNCE) {
    inFlight = true;
    const unhindered = solveUnhinderedBallTrajectory(lbw, timeMs);
    ballPos = unhindered.pos;
    ballVel = unhindered.vel;
  } else if (timeMs <= T_IMPACT) {
    inFlight = true;
    hasBounced = true;

    if (lbw.batContactBeforePad && timeMs >= T_INTERCEPT) {
      // Prior Bat Contact Occurred at T_INTERCEPT
      hasHitBat = true;
      const interceptState = solveUnhinderedBallTrajectory(lbw, T_INTERCEPT);
      const postTimeSec = (timeMs - T_INTERCEPT) / 1000;
      const deflectVel: Vec3 = {
        x: hand * -1.8,
        y: 0.45,
        z: -2.9,
      };
      ballPos = add(interceptState.pos, mul(deflectVel, postTimeSec));
      ballVel = deflectVel;
    } else {
      const unhindered = solveUnhinderedBallTrajectory(lbw, timeMs);
      ballPos = unhindered.pos;
      ballVel = unhindered.vel;
      if (timeMs === T_IMPACT) {
        hasHitPad = true;
      }
    }
  } else {
    // After T_IMPACT (timeMs > 1500ms)
    hasBounced = true;
    if (lbw.batContactBeforePad) {
      hasHitBat = true;
      const interceptState = solveUnhinderedBallTrajectory(lbw, T_INTERCEPT);
      const postTimeSec = (timeMs - T_INTERCEPT) / 1000;
      const deflectVel: Vec3 = {
        x: hand * -1.8,
        y: 0.45,
        z: -2.9,
      };
      ballPos = add(interceptState.pos, mul(deflectVel, postTimeSec));
      ballVel = deflectVel;
    } else {
      // Clean pad impact: in broadcast slow-mo replay, ball dies on pad
      hasHitPad = true;
      isDead = true;
      const d = clamp01((timeMs - T_IMPACT) / 280);
      ballPos = {
        x: waypoints.impact.x + hand * 0.04 * d,
        y: waypoints.impact.y * (1 - d),
        z: waypoints.impact.z - 0.08 * d,
      };
      ballVel = { x: 0, y: 0, z: 0 };
    }
  }

  return {
    currentTimeMs: timeMs,
    ball: {
      x: ballPos.x,
      y: ballPos.y,
      z: ballPos.z,
      vx: ballVel.x,
      vy: ballVel.y,
      vz: ballVel.z,
      inFlight,
      hasBounced,
      hasHitBat,
      hasHitPad,
      isDead,
    },
    batter: {
      anchor,
      frontPadWorld,
      backPadWorld,
      batGloveWorld,
      batTipWorld,
      batAngleRad: batAngle,
      stride,
      swing,
      hasDeflectedBall: hasHitBat,
    },
    waypoints,
  };
}

/**
 * Solves the unhindered physical trajectory of the delivery at timeMs.
 * This represents the true natural flight of the ball from bowler release,
 * off the pitch, to the wickets, assuming no physical interception.
 */
export function solveUnhinderedBallTrajectory(lbw: LBWData, timeMs: number): {
  pos: Vec3;
  vel: Vec3;
} {
  const waypoints = getLBWWaypoints(lbw);
  const { T_RELEASE, T_BOUNCE, T_STUMPS } = LBW_TIMESTAMPS;

  if (timeMs < T_RELEASE) {
    return {
      pos: { ...waypoints.release },
      vel: { x: 0, y: 0, z: 0 },
    };
  }

  if (timeMs < T_BOUNCE) {
    // Pre-bounce flight arc in air (Release -> Bounce)
    const f = clamp01((timeMs - T_RELEASE) / (T_BOUNCE - T_RELEASE));
    const dt = (T_BOUNCE - T_RELEASE) / 1000;
    const ctrl: Vec3 = {
      x: lerp(waypoints.release.x, waypoints.bounce.x, 0.5),
      y: 3.25,
      z: lerp(waypoints.release.z, waypoints.bounce.z, 0.5),
    };
    const pos = bezier(waypoints.release, ctrl, waypoints.bounce, f);
    const vel: Vec3 = {
      x: (2 * (1 - f) * (ctrl.x - waypoints.release.x) + 2 * f * (waypoints.bounce.x - ctrl.x)) / dt,
      y: (2 * (1 - f) * (ctrl.y - waypoints.release.y) + 2 * f * (waypoints.bounce.y - ctrl.y)) / dt,
      z: (2 * (1 - f) * (ctrl.z - waypoints.release.z) + 2 * f * (waypoints.bounce.z - ctrl.z)) / dt,
    };
    return { pos, vel };
  }

  // Post-bounce continuous flight (Bounce -> Stumps)
  // Strictly collinear in X and Z: zero lateral kink or direction reversal
  const u = clamp01((timeMs - T_BOUNCE) / (T_STUMPS - T_BOUNCE));
  const dtPost = (T_STUMPS - T_BOUNCE) / 1000;
  const yApex = Math.max(0.68, waypoints.stumps.y + 0.18);
  const ctrlPost: Vec3 = {
    x: lerp(waypoints.bounce.x, waypoints.stumps.x, 0.5),
    y: yApex,
    z: lerp(waypoints.bounce.z, waypoints.stumps.z, 0.5),
  };
  const pos = bezier(waypoints.bounce, ctrlPost, waypoints.stumps, u);
  const vel: Vec3 = {
    x: (2 * (1 - u) * (ctrlPost.x - waypoints.bounce.x) + 2 * u * (waypoints.stumps.x - ctrlPost.x)) / dtPost,
    y: (2 * (1 - u) * (ctrlPost.y - waypoints.bounce.y) + 2 * u * (waypoints.stumps.y - ctrlPost.y)) / dtPost,
    z: (2 * (1 - u) * (ctrlPost.z - waypoints.bounce.z) + 2 * u * (waypoints.stumps.z - ctrlPost.z)) / dtPost,
  };

  if (timeMs > T_STUMPS) {
    const extraSec = (timeMs - T_STUMPS) / 1000;
    return {
      pos: add(pos, mul(vel, extraSec)),
      vel,
    };
  }

  return { pos, vel };
}

/**
 * Projects a 3D world-space coordinate into the 2D SVG canvas of CAM 03 Hawk-Eye (600x350 viewBox).
 * Pitch trapezoid in SVG:
 * - Striker stumps at Z = 0: top line Y = 65, width = 180px, center = 300
 * - Bowler stumps at Z = 20.12: bottom line Y = 335, width = 510px, center = 300
 */
export function projectLBWPointToHawkEyeSVG(point3D: Vec3): { x: number; y: number } {
  const pitchCenterX = 300;
  const zClamped = Math.max(0, Math.min(20.12, point3D.z));
  const w = zClamped / 20.12;

  // Lateral perspective scale (180px / 3.048m -> 510px / 3.048m)
  const scale = lerp(59.0551, 167.3228, w);
  const groundY = lerp(65, 335, w);

  const svgX = pitchCenterX + point3D.x * scale;

  // Vertical perspective foreshortening factor for elevated camera
  const heightScale = lerp(59.07, 30.2, w);
  const heightOffset = point3D.y * heightScale;
  const svgY = groundY - heightOffset;

  return { x: svgX, y: svgY };
}

function pointsToSvgPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

/**
 * Generates continuous sampled paths for Hawk-Eye 3D rendering.
 * Stage 3: Flight Arc (Release -> Bounce)
 * Stage 4: Bounce Arc (Bounce -> Pad Impact or Bat Intercept)
 * Stage 5: Projected Virtual Ray to Striker Stumps (Impact -> Stumps)
 */
export function getHawkEyeTrajectoryStages(lbw: LBWData) {
  const waypoints = getLBWWaypoints(lbw);
  const { T_RELEASE, T_BOUNCE, T_INTERCEPT, T_IMPACT, T_STUMPS } = LBW_TIMESTAMPS;

  // Stage 3: Flight Arc & Shadow (Release -> Bounce)
  const flightPoints: { x: number; y: number }[] = [];
  const flightShadow: { x: number; y: number }[] = [];
  for (let t = T_RELEASE; t <= T_BOUNCE; t += 20) {
    const s = solveUnhinderedBallTrajectory(lbw, t);
    flightPoints.push(projectLBWPointToHawkEyeSVG(s.pos));
    flightShadow.push(projectLBWPointToHawkEyeSVG({ x: s.pos.x, y: 0, z: s.pos.z }));
  }

  // Stage 4: Bounce Arc & Shadow (Bounce -> Impact / Bat Contact)
  const bouncePoints: { x: number; y: number }[] = [];
  const bounceShadow: { x: number; y: number }[] = [];
  const endStage4Time = lbw.batContactBeforePad ? T_INTERCEPT : T_IMPACT;
  for (let t = T_BOUNCE; t <= endStage4Time; t += 15) {
    const s = solveUnhinderedBallTrajectory(lbw, t);
    bouncePoints.push(projectLBWPointToHawkEyeSVG(s.pos));
    bounceShadow.push(projectLBWPointToHawkEyeSVG({ x: s.pos.x, y: 0, z: s.pos.z }));
  }

  // Deflected Arc (if bat contact)
  const deflectedPoints: { x: number; y: number }[] = [];
  if (lbw.batContactBeforePad) {
    for (let t = T_INTERCEPT; t <= 1720; t += 20) {
      const s = solveLBWReplayState(lbw, t);
      deflectedPoints.push(projectLBWPointToHawkEyeSVG(s.ball));
    }
  }

  // Stage 5: Virtual Projected Path to Striker Stumps (Impact -> Stumps)
  // Continuous continuation along the exact same post-bounce path
  const projectedPoints: { x: number; y: number }[] = [];
  const projectedShadow: { x: number; y: number }[] = [];
  if (!lbw.batContactBeforePad) {
    for (let t = T_IMPACT; t <= T_STUMPS; t += 15) {
      const s = solveUnhinderedBallTrajectory(lbw, t);
      projectedPoints.push(projectLBWPointToHawkEyeSVG(s.pos));
      projectedShadow.push(projectLBWPointToHawkEyeSVG({ x: s.pos.x, y: 0, z: s.pos.z }));
    }
  }

  const releasePointSVG = projectLBWPointToHawkEyeSVG(waypoints.release);
  const pitchPointSVG = projectLBWPointToHawkEyeSVG(waypoints.bounce);
  const impactPointSVG = projectLBWPointToHawkEyeSVG(waypoints.impact);
  const impactGroundSVG = projectLBWPointToHawkEyeSVG({ x: waypoints.impact.x, y: 0, z: waypoints.impact.z });
  const stumpsPointSVG = projectLBWPointToHawkEyeSVG(waypoints.stumps);
  const batContactPointSVG = projectLBWPointToHawkEyeSVG(waypoints.batContact);

  return {
    flightArcPath: pointsToSvgPath(flightPoints),
    flightShadowPath: pointsToSvgPath(flightShadow),
    bounceArcPath: pointsToSvgPath(bouncePoints),
    bounceShadowPath: pointsToSvgPath(bounceShadow),
    deflectedArcPath: pointsToSvgPath(deflectedPoints),
    projectedStumpsPath: pointsToSvgPath(projectedPoints),
    projectedShadowPath: pointsToSvgPath(projectedShadow),
    releasePointSVG,
    pitchPointSVG,
    impactPointSVG,
    impactGroundSVG,
    stumpsPointSVG,
    batContactPointSVG,
    waypoints,
  };
}

/**
 * Returns diagnostic world-space coordinates and velocities at critical trajectory checkpoints
 * for acceptance testing and verification.
 */
export function getBallStateLog(lbw: LBWData) {
  const checkpoints = [
    { label: "release", timeMs: LBW_TIMESTAMPS.T_RELEASE },
    { label: "just before bounce", timeMs: LBW_TIMESTAMPS.T_BOUNCE - 20 },
    { label: "bounce", timeMs: LBW_TIMESTAMPS.T_BOUNCE },
    { label: "1-2 frames after bounce", timeMs: LBW_TIMESTAMPS.T_BOUNCE + 40 },
    { label: "batter arrival", timeMs: LBW_TIMESTAMPS.T_INTERCEPT },
    { label: "impact", timeMs: LBW_TIMESTAMPS.T_IMPACT },
  ];

  return checkpoints.map((cp) => {
    const s = solveLBWReplayState(lbw, cp.timeMs);
    return {
      label: cp.label,
      timeMs: cp.timeMs,
      pos: {
        x: parseFloat(s.ball.x.toFixed(4)),
        y: parseFloat(s.ball.y.toFixed(4)),
        z: parseFloat(s.ball.z.toFixed(4)),
      },
      vel: {
        vx: parseFloat(s.ball.vx.toFixed(4)),
        vy: parseFloat(s.ball.vy.toFixed(4)),
        vz: parseFloat(s.ball.vz.toFixed(4)),
      },
    };
  });
}
