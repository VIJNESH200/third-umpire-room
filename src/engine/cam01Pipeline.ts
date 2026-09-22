/**
 * cam01Pipeline.ts
 * Dedicated CAM 01 Replay Render Pipeline for LBW Broadcast Replay.
 *
 * Architecture:
 *   canonical replay time (currentTimeMs)
 *   -> canonical physical state + continuous visual kinematics
 *   -> CAM01ReplayFrame
 *   -> renderReplayFrame(ctx, frame)
 *
 * Complete decoupling of physical/animation state derivation from canvas rendering.
 */

import type { LBWData } from "../types/scenario";
import {
  solveLBWReplayState,
  getLBWWaypoints,
  LBW_TIMESTAMPS,
  type Vec3,
} from "./lbwPhysics";
import { drawCricketBall } from "../components/instinct/actorRigs";

export const CAM01_CANVAS_WIDTH = 1200;
export const CAM01_CANVAS_HEIGHT = 500;

const W = CAM01_CANVAS_WIDTH;
const H = CAM01_CANVAS_HEIGHT;

// Math Helpers
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const mul = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const unit = (a: Vec3): Vec3 => mul(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  focal: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
}

export interface StumpsVisualData {
  shadowA: ScreenPoint;
  shadowB: ScreenPoint;
  stumps: { base: ScreenPoint; top: ScreenPoint; width: number; isMiddle: boolean }[];
  bails: { a: ScreenPoint; b: ScreenPoint }[];
}

export interface CreaseLineVisualData {
  a: ScreenPoint;
  b: ScreenPoint;
  lineWidth: number;
  alpha: number;
}

export interface PitchVisualData {
  corners: ScreenPoint[];
  creases: CreaseLineVisualData[];
  bounceScuff?: { x: number; y: number; opacity: number };
}

export interface BatterVisualData {
  anchorWorld: Vec3;
  originScreen: ScreenPoint;
  ex: { x: number; y: number };
  ey: { x: number; y: number };
  hand: number;
  backPadX: number;
  frontPadX: number;
  stride: number;
  swing: number;
  recoil: number;
  torsoTilt: number;
  headTilt: number;
  gloveX: number;
  gloveY: number;
  batAngleRad: number;
  footBackScreen: ScreenPoint;
  footFrontScreen: ScreenPoint;
}

export interface BallVisualData {
  worldPos: Vec3;
  screenPos: ScreenPoint;
  prevScreenPos: ScreenPoint;
  radius: number;
  seamAngleRad: number;
  motionTrail: boolean;
  isDead: boolean;
  shadowY?: number;
}

export interface ImpactRippleVisualData {
  center: ScreenPoint;
  radius: number;
  alpha: number;
  color: string;
}

export type EventPhaseName =
  | "BOWLER GATHER & RELEASE"
  | "DELIVERY IN FLIGHT"
  | "PITCH BOUNCE"
  | "APPROACHING STRIKER"
  | "POINT OF IMPACT"
  | "AFTERMATH";

export interface CAM01ReplayFrame {
  timeMs: number;
  frameIndex: number;
  phase: EventPhaseName;
  camera: CameraPose;
  pitch: PitchVisualData;
  stumps: StumpsVisualData;
  batter: BatterVisualData;
  ball: BallVisualData;
  impactRipple?: ImpactRippleVisualData;
}

/**
 * Constructs the broadcast camera pose for CAM 01.
 * High-behind bowler broadcast camera that provides:
 * - Wide view of bowler delivery stride & release at 600-800ms
 * - Gentle tracking and subtle optical zoom towards the striker
 * - Clear visibility of pitch, ball, batter, and stumps at all times
 */
export function makeCAM01Camera(timeMs: number): CameraPose {
  // Smooth tracking progression across the replay timeline
  const trackT = smoothstep(clamp01((timeMs - 600) / 950));

  // Camera Position: elevated behind the bowler, tracking slightly down-pitch
  const position: Vec3 = {
    x: lerp(-1.35, -0.80, trackT),
    y: lerp(4.50, 3.40, trackT),
    z: lerp(26.50, 21.80, trackT),
  };

  // Camera Target: smoothly shifts from pitch center towards popping crease & front pad
  const target: Vec3 = {
    x: lerp(0.00, 0.04, trackT),
    y: lerp(1.10, 0.82, trackT),
    z: lerp(4.50, 1.15, trackT),
  };

  const forward = unit(sub(target, position));
  const right = unit(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = unit(cross(right, forward));
  const focal = lerp(1150, 1850, trackT);

  return { position, target, forward, right, up, focal };
}

/**
 * Projects a 3D world point to 2D canvas screen pixels.
 */
export function projectCAM01(camera: CameraPose, point: Vec3): ScreenPoint {
  const rel = sub(point, camera.position);
  const depth = dot(rel, camera.forward);
  const safeDepth = Math.max(0.15, depth);
  return {
    x: W / 2 + (dot(rel, camera.right) * camera.focal) / safeDepth,
    y: H / 2 - (dot(rel, camera.up) * camera.focal) / safeDepth,
    depth: safeDepth,
  };
}

/**
 * Computes the authoritative visual frame state for CAM 01 at any given timeMs.
 * Pure function: zero side-effects, zero canvas calls.
 */
export function getReplayFrameAtTime(lbw: LBWData, currentTimeMs: number): CAM01ReplayFrame {
  const timeMs = Math.max(600, Math.min(2200, currentTimeMs));
  const camera = makeCAM01Camera(timeMs);
  const waypoints = getLBWWaypoints(lbw);
  const hand = lbw.batterHand === "RIGHT" ? 1 : -1;
  const canonicalState = solveLBWReplayState(lbw, timeMs);

  // 1. Event Phase Identification
  let phase: EventPhaseName = "BOWLER GATHER & RELEASE";
  if (timeMs >= LBW_TIMESTAMPS.T_IMPACT + 100) {
    phase = "AFTERMATH";
  } else if (timeMs >= LBW_TIMESTAMPS.T_IMPACT - 20) {
    phase = "POINT OF IMPACT";
  } else if (timeMs >= LBW_TIMESTAMPS.T_BOUNCE + 50) {
    phase = "APPROACHING STRIKER";
  } else if (timeMs >= LBW_TIMESTAMPS.T_BOUNCE - 20) {
    phase = "PITCH BOUNCE";
  } else if (timeMs >= LBW_TIMESTAMPS.T_RELEASE) {
    phase = "DELIVERY IN FLIGHT";
  }

  // 2. Continuous Ball Kinematics
  let worldBallPos: Vec3;
  let prevWorldBallPos: Vec3;
  let isDead = false;
  let motionTrail = false;

  if (timeMs < LBW_TIMESTAMPS.T_RELEASE) {
    // 600ms - 800ms: Bowler gather & delivery arm swing leading into release point
    const gatherT = (timeMs - 600) / (LBW_TIMESTAMPS.T_RELEASE - 600); // 0 to 1
    const dt = 15;
    const prevGatherT = Math.max(0, (timeMs - dt - 600) / (LBW_TIMESTAMPS.T_RELEASE - 600));

    worldBallPos = {
      x: lerp(waypoints.release.x - 0.28, waypoints.release.x, gatherT),
      y: lerp(2.65, waypoints.release.y, gatherT * gatherT),
      z: lerp(20.80, waypoints.release.z, gatherT),
    };
    prevWorldBallPos = {
      x: lerp(waypoints.release.x - 0.28, waypoints.release.x, prevGatherT),
      y: lerp(2.65, waypoints.release.y, prevGatherT * prevGatherT),
      z: lerp(20.80, waypoints.release.z, prevGatherT),
    };
    motionTrail = timeMs > 660;
  } else if (timeMs <= LBW_TIMESTAMPS.T_IMPACT) {
    // 800ms - 1500ms: Canonical delivery trajectory (in flight & off pitch)
    worldBallPos = canonicalState.ball;
    const dtSec = 0.02;
    prevWorldBallPos = {
      x: worldBallPos.x - canonicalState.ball.vx * dtSec,
      y: worldBallPos.y - canonicalState.ball.vy * dtSec,
      z: worldBallPos.z - canonicalState.ball.vz * dtSec,
    };
    motionTrail = true;
  } else {
    // 1500ms - 2200ms: Aftermath
    if (lbw.batContactBeforePad) {
      // Deflected trajectory
      worldBallPos = canonicalState.ball;
      const dtSec = 0.02;
      prevWorldBallPos = {
        x: worldBallPos.x - canonicalState.ball.vx * dtSec,
        y: worldBallPos.y - canonicalState.ball.vy * dtSec,
        z: worldBallPos.z - canonicalState.ball.vz * dtSec,
      };
      motionTrail = true;
    } else {
      // Pad impact: ball rolls/drops off pad to turf rest
      isDead = true;
      const afterT = clamp01((timeMs - LBW_TIMESTAMPS.T_IMPACT) / 320);
      const afterEase = smoothstep(afterT);
      worldBallPos = {
        x: waypoints.impact.x + hand * 0.04 * afterEase,
        y: lerp(waypoints.impact.y, 0.036, afterEase),
        z: waypoints.impact.z - 0.12 * afterEase,
      };
      const prevAfterT = clamp01((timeMs - 20 - LBW_TIMESTAMPS.T_IMPACT) / 320);
      const prevAfterEase = smoothstep(prevAfterT);
      prevWorldBallPos = {
        x: waypoints.impact.x + hand * 0.04 * prevAfterEase,
        y: lerp(waypoints.impact.y, 0.036, prevAfterEase),
        z: waypoints.impact.z - 0.12 * prevAfterEase,
      };
      motionTrail = afterT < 0.85;
    }
  }

  const pBall = projectCAM01(camera, worldBallPos);
  const pPrevBall = projectCAM01(camera, prevWorldBallPos);

  // Ball radius scaling with distance
  const pBallOffset = projectCAM01(camera, add(worldBallPos, { x: 0.076, y: 0, z: 0 }));
  const ballRadius = Math.max(5.5, Math.min(18.0, Math.abs(pBallOffset.x - pBall.x)));

  // Ground shadow projection under ball
  const pShadow = projectCAM01(camera, { x: worldBallPos.x, y: 0.005, z: worldBallPos.z });

  const ball: BallVisualData = {
    worldPos: worldBallPos,
    screenPos: pBall,
    prevScreenPos: pPrevBall,
    radius: ballRadius,
    seamAngleRad: (timeMs / 1000) * 8 * Math.PI,
    motionTrail,
    isDead,
    shadowY: pShadow.y,
  };

  // 3. Continuous Batter Kinematics
  // Setup & trigger movement (600ms - 850ms)
  const triggerT = smoothstep(clamp01((timeMs - 620) / 240));
  const triggerWeightShift = triggerT * -0.04 * hand;

  // Stride forward (840ms - 1380ms)
  const strideT = smoothstep(clamp01((timeMs - 840) / 480));

  // Bat swing
  let swing = 0;
  if (lbw.shotOffered) {
    const swingStart = lbw.batContactBeforePad ? 1060 : 1120;
    const swingDuration = lbw.batContactBeforePad ? 340 : 360;
    swing = smoothstep(clamp01((timeMs - swingStart) / swingDuration));
  }

  // Impact recoil shudder (1500ms - 1850ms)
  const isPostImpact = timeMs >= LBW_TIMESTAMPS.T_IMPACT && timeMs < 1850;
  const postImpactSec = (timeMs - LBW_TIMESTAMPS.T_IMPACT) / 1000;
  const recoil = isPostImpact
    ? Math.sin(postImpactSec * Math.PI * 14) * Math.exp(-postImpactSec * 10)
    : 0;

  const anchor = canonicalState.batter.anchor;
  const originScreen = projectCAM01(camera, anchor);
  const px = projectCAM01(camera, add(anchor, { x: 1, y: 0, z: 0 }));
  const py = projectCAM01(camera, add(anchor, { x: 0, y: 1, z: 0 }));
  const ex = { x: px.x - originScreen.x, y: px.y - originScreen.y };
  const ey = { x: py.x - originScreen.x, y: py.y - originScreen.y };

  const backPadX = canonicalState.batter.backPadWorld.x - anchor.x + triggerWeightShift;
  const frontPadX = canonicalState.batter.frontPadWorld.x - anchor.x;

  const footBackScreen = projectCAM01(camera, {
    ...canonicalState.batter.backPadWorld,
    x: canonicalState.batter.backPadWorld.x + triggerWeightShift,
  });
  const footFrontScreen = projectCAM01(camera, {
    x: canonicalState.batter.frontPadWorld.x,
    y: 0,
    z: canonicalState.batter.frontPadWorld.z,
  });

  const batter: BatterVisualData = {
    anchorWorld: anchor,
    originScreen,
    ex,
    ey,
    hand,
    backPadX,
    frontPadX,
    stride: strideT,
    swing,
    recoil,
    torsoTilt: hand * (-0.05 - strideT * 0.04),
    headTilt: hand * -0.06,
    gloveX: canonicalState.batter.batGloveWorld.x - anchor.x,
    gloveY: canonicalState.batter.batGloveWorld.y,
    batAngleRad: canonicalState.batter.batAngleRad,
    footBackScreen,
    footFrontScreen,
  };

  // 4. Stumps & Bails Geometry
  const wicketZ = 0.0;
  const stumpHeight = 0.711;
  const shadowA = projectCAM01(camera, { x: -0.32, y: 0, z: wicketZ - 0.06 });
  const shadowB = projectCAM01(camera, { x: 0.32, y: 0, z: wicketZ - 0.06 });

  const stumpPositions = [-0.114, 0.0, 0.114];
  const stumpVisuals = stumpPositions.map((x, index) => {
    const base = projectCAM01(camera, { x, y: 0.0, z: wicketZ });
    const top = projectCAM01(camera, { x, y: stumpHeight, z: wicketZ });
    const side = projectCAM01(camera, { x: x + 0.024, y: 0.0, z: wicketZ });
    const stumpWidth = Math.max(4.2, Math.abs(side.x - base.x) * 1.8);
    return { base, top, width: stumpWidth, isMiddle: index === 1 };
  });

  const bails = [
    [-0.114, 0.0],
    [0.0, 0.114],
  ].map(([x1, x2]) => ({
    a: projectCAM01(camera, { x: x1, y: stumpHeight + 0.025, z: wicketZ }),
    b: projectCAM01(camera, { x: x2, y: stumpHeight + 0.025, z: wicketZ }),
  }));

  const stumps: StumpsVisualData = {
    shadowA,
    shadowB,
    stumps: stumpVisuals,
    bails,
  };

  // 5. Pitch & Crease Lines
  const pitchCorners: Vec3[] = [
    { x: -1.524, y: 0, z: -1.8 },
    { x: 1.524, y: 0, z: -1.8 },
    { x: 1.524, y: 0, z: 20.2 },
    { x: -1.524, y: 0, z: 20.2 },
  ];
  const pitchCornerScreen = pitchCorners.map((pt) => projectCAM01(camera, pt));

  const creases: CreaseLineVisualData[] = [
    // Bowling Crease at Striker Stumps (Z = 0.0m)
    {
      a: projectCAM01(camera, { x: -1.524, y: 0.005, z: 0.0 }),
      b: projectCAM01(camera, { x: 1.524, y: 0.005, z: 0.0 }),
      lineWidth: 1.8,
      alpha: 0.65,
    },
    // Striker Popping Crease (Z = 1.22m)
    {
      a: projectCAM01(camera, { x: -1.524, y: 0.008, z: 1.22 }),
      b: projectCAM01(camera, { x: 1.524, y: 0.008, z: 1.22 }),
      lineWidth: 3.2,
      alpha: 0.95,
    },
    // Return Creases
    {
      a: projectCAM01(camera, { x: -1.32, y: 0.006, z: 0.0 }),
      b: projectCAM01(camera, { x: -1.32, y: 0.006, z: 2.44 }),
      lineWidth: 1.5,
      alpha: 0.7,
    },
    {
      a: projectCAM01(camera, { x: 1.32, y: 0.006, z: 0.0 }),
      b: projectCAM01(camera, { x: 1.32, y: 0.006, z: 2.44 }),
      lineWidth: 1.5,
      alpha: 0.7,
    },
  ];

  let bounceScuff: { x: number; y: number; opacity: number } | undefined;
  if (timeMs >= LBW_TIMESTAMPS.T_BOUNCE) {
    const scuffScreen = projectCAM01(camera, waypoints.bounce);
    const scuffFadeIn = clamp01((timeMs - LBW_TIMESTAMPS.T_BOUNCE) / 100);
    bounceScuff = { x: scuffScreen.x, y: scuffScreen.y, opacity: 0.72 * scuffFadeIn };
  }

  const pitch: PitchVisualData = {
    corners: pitchCornerScreen,
    creases,
    bounceScuff,
  };

  // 6. Impact Ripples
  let impactRipple: ImpactRippleVisualData | undefined;
  if (
    lbw.batContactBeforePad &&
    timeMs >= LBW_TIMESTAMPS.T_INTERCEPT &&
    timeMs < LBW_TIMESTAMPS.T_INTERCEPT + 200
  ) {
    const k = 1 - (timeMs - LBW_TIMESTAMPS.T_INTERCEPT) / 200;
    const center = projectCAM01(camera, waypoints.batContact);
    impactRipple = {
      center,
      radius: ballRadius + (1 - k) * 22,
      alpha: 0.9 * k,
      color: "#38BDF8", // Cyan ripple for bat contact
    };
  } else if (
    !lbw.batContactBeforePad &&
    timeMs >= LBW_TIMESTAMPS.T_IMPACT &&
    timeMs < LBW_TIMESTAMPS.T_IMPACT + 200
  ) {
    const k = 1 - (timeMs - LBW_TIMESTAMPS.T_IMPACT) / 200;
    const center = projectCAM01(camera, waypoints.impact);
    impactRipple = {
      center,
      radius: ballRadius + (1 - k) * 18,
      alpha: 0.85 * k,
      color: "#FACC15", // Amber ripple for pad impact
    };
  }

  const frameIndex = Math.round((timeMs / 1000) * 50);

  return {
    timeMs,
    frameIndex,
    phase,
    camera,
    pitch,
    stumps,
    batter,
    ball,
    impactRipple,
  };
}

/**
 * Pure canvas rendering engine for CAM 01.
 * Consumes the pre-calculated CAM01ReplayFrame and draws the full scene.
 */
export function renderReplayFrame(ctx: CanvasRenderingContext2D, frame: CAM01ReplayFrame): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // 1. Stadium Outfield & Atmospheric Backdrop
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#08131d");
  sky.addColorStop(0.45, "#0f2318");
  sky.addColorStop(1, "#07170e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const ambientGlow = ctx.createRadialGradient(
    W * 0.5,
    H * 0.55,
    40,
    W * 0.5,
    H * 0.55,
    420
  );
  ambientGlow.addColorStop(0, "rgba(254, 240, 138, 0.12)");
  ambientGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = ambientGlow;
  ctx.fillRect(0, 0, W, H);

  // 2. 22-Yard Clay Pitch Strip
  const corners = frame.pitch.corners;
  if (corners.length >= 4) {
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();

    const turf = ctx.createLinearGradient(0, 110, 0, 440);
    turf.addColorStop(0, "#80684c");
    turf.addColorStop(0.55, "#b0936b");
    turf.addColorStop(1, "#927654");
    ctx.fillStyle = turf;
    ctx.fill();

    ctx.strokeStyle = "rgba(91, 66, 42, 0.85)";
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  // 3. Crease Lines
  frame.pitch.creases.forEach((crease) => {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${crease.alpha})`;
    ctx.lineWidth = crease.lineWidth;
    ctx.beginPath();
    ctx.moveTo(crease.a.x, crease.a.y);
    ctx.lineTo(crease.b.x, crease.b.y);
    ctx.stroke();
    ctx.restore();
  });

  // 4. Turf Bounce Scuff Mark
  if (frame.pitch.bounceScuff) {
    const { x, y, opacity } = frame.pitch.bounceScuff;
    ctx.save();
    ctx.fillStyle = `rgba(65, 44, 25, ${opacity})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 12, 4.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 5. Stumps & Bails
  const { stumps } = frame;
  // Stumps Ground Shadow
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(stumps.shadowA.x, stumps.shadowA.y);
  ctx.lineTo(stumps.shadowB.x, stumps.shadowB.y);
  ctx.stroke();

  // 3 Wooden Stumps
  stumps.stumps.forEach((s) => {
    ctx.strokeStyle = "#78350F";
    ctx.lineWidth = s.width + 2;
    ctx.beginPath();
    ctx.moveTo(s.base.x, s.base.y);
    ctx.lineTo(s.top.x, s.top.y);
    ctx.stroke();

    ctx.strokeStyle = s.isMiddle ? "#F59E0B" : "#D97706";
    ctx.lineWidth = s.width;
    ctx.beginPath();
    ctx.moveTo(s.base.x, s.base.y);
    ctx.lineTo(s.top.x, s.top.y);
    ctx.stroke();
  });

  // 2 Bails
  stumps.bails.forEach((b) => {
    ctx.strokeStyle = "#78350F";
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(b.a.x, b.a.y);
    ctx.lineTo(b.b.x, b.b.y);
    ctx.stroke();

    ctx.strokeStyle = "#FCD34D";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(b.a.x, b.a.y);
    ctx.lineTo(b.b.x, b.b.y);
    ctx.stroke();
  });
  ctx.restore();

  // 6. Batter Rig
  const { batter } = frame;
  // Ground Shadow under Batter
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.48)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(batter.footBackScreen.x, batter.footBackScreen.y);
  ctx.lineTo(batter.footFrontScreen.x, batter.footFrontScreen.y);
  ctx.stroke();
  ctx.restore();

  // Local 2D transformed coordinate system for Batter
  ctx.save();
  ctx.setTransform(
    batter.ex.x,
    batter.ex.y,
    batter.ey.x,
    batter.ey.y,
    batter.originScreen.x,
    batter.originScreen.y
  );
  ctx.lineCap = "round";

  const hand = batter.hand;

  // A. Back Leg & Pad
  ctx.save();
  ctx.translate(batter.backPadX, 0.02);
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(0, 0.98);
  ctx.lineTo(0, 0.48);
  ctx.stroke();

  ctx.fillStyle = "#F1F5F9";
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.roundRect(-0.09, 0.02, 0.18, 0.52, 0.035);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.ellipse(0, -0.01, 0.11, 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // B. Front Leg & Pad (Prominent, with knee rolls and cane ribs)
  ctx.save();
  ctx.translate(batter.frontPadX + batter.recoil * 0.025, 0.02);
  ctx.rotate(hand * (0.05 + batter.stride * 0.03));

  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(hand * -0.04, 1.0);
  ctx.lineTo(0, 0.54);
  ctx.stroke();

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.roundRect(-0.115, 0.02, 0.23, 0.62, 0.05);
  ctx.fill();
  ctx.stroke();

  // Knee Roll Cushion
  ctx.fillStyle = "#E2E8F0";
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.roundRect(-0.105, 0.42, 0.21, 0.12, 0.025);
  ctx.fill();
  ctx.stroke();

  // 3 Vertical Cane Ribs
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 0.02;
  [-0.06, 0.0, 0.06].forEach((rx) => {
    ctx.beginPath();
    ctx.moveTo(rx, 0.06);
    ctx.lineTo(rx, 0.40);
    ctx.stroke();
  });

  // Front Shoe
  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.ellipse(hand * 0.03, -0.015, 0.13, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // C. Torso & Jersey
  ctx.save();
  ctx.translate(0, 1.0 + batter.recoil * 0.015);
  ctx.rotate(batter.torsoTilt);

  ctx.fillStyle = "#1E293B";
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.roundRect(-0.24, 0.0, 0.48, 0.66, 0.08);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "#38BDF8";
  ctx.lineWidth = 0.024;
  ctx.beginPath();
  ctx.moveTo(hand * -0.18, 0.08);
  ctx.lineTo(hand * -0.18, 0.58);
  ctx.stroke();

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "bold 0.16px monospace";
  ctx.textAlign = "center";
  ctx.fillText("18", 0, 0.35);
  ctx.restore();

  // D. Head & Helmet
  const headX = hand * -0.05;
  ctx.save();
  ctx.translate(headX, 1.84 + batter.recoil * 0.015);
  ctx.rotate(batter.headTilt);

  ctx.fillStyle = "#0F172A";
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.arc(0, 0, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Skin tone
  ctx.fillStyle = "#D4A373";
  ctx.beginPath();
  ctx.ellipse(hand * 0.08, -0.01, 0.065, 0.075, 0, 0, Math.PI * 2);
  ctx.fill();

  // Grille
  ctx.fillStyle = "#050B14";
  ctx.beginPath();
  ctx.moveTo(hand * 0.11, -0.01);
  ctx.lineTo(hand * 0.26, 0.03);
  ctx.lineTo(hand * 0.11, 0.07);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.moveTo(hand * 0.15, 0.03);
  ctx.lineTo(hand * 0.03, 0.08);
  ctx.stroke();
  ctx.restore();

  // E. Arms & Bat Blade
  const shoulderY = 1.54;
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.11;
  ctx.beginPath();
  ctx.moveTo(hand * 0.18, shoulderY);
  ctx.lineTo(batter.gloveX + hand * 0.03, batter.gloveY);
  ctx.stroke();

  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 0.115;
  ctx.beginPath();
  ctx.moveTo(hand * -0.16, shoulderY);
  ctx.lineTo(batter.gloveX - hand * 0.03, batter.gloveY);
  ctx.stroke();

  // Bat
  ctx.save();
  ctx.translate(batter.gloveX, batter.gloveY);
  ctx.rotate(batter.batAngleRad);

  // Handle
  ctx.fillStyle = "#0284C7";
  ctx.strokeStyle = "#0369A1";
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.roundRect(-0.03, 0.0, 0.06, 0.30, 0.02);
  ctx.fill();
  ctx.stroke();

  // Willow Blade
  ctx.fillStyle = "#D97706";
  ctx.strokeStyle = "#78350F";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.roundRect(-0.065, -0.78, 0.13, 0.78, 0.03);
  ctx.fill();
  ctx.stroke();

  // Face Sticker
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(-0.065, -0.78, 0.13, 0.08);
  ctx.restore();

  // Batting Gloves
  ctx.fillStyle = "#F8FAFC";
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 0.015;
  [-0.035, 0.04].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(batter.gloveX + dx * hand, batter.gloveY, 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore(); // Restore from local batter transform

  // 7. Impact Shockwave Ripple
  if (frame.impactRipple) {
    const { center, radius, alpha, color } = frame.impactRipple;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 8. Cricket Ball with Seam & Motion Blur
  const { ball } = frame;
  drawCricketBall(ctx, ball.screenPos.x, ball.screenPos.y, {
    radius: ball.radius,
    seamAngleRad: ball.seamAngleRad,
    shadowY: ball.shadowY,
    motionTrail: ball.motionTrail,
    prevX: ball.prevScreenPos.x,
    prevY: ball.prevScreenPos.y,
  });

  ctx.restore();
}
