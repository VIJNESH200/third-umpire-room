/**
 * cam01Pipeline.ts
 * 2D Broadcast Television Slow-Motion Replay Pipeline for CAM 01.
 *
 * Visually controlled 2D broadcast animation that presents an authentic, readable,
 * slow-motion television replay of an LBW appeal:
 * - Prominent hero batter (~140px) with articulated stance, trigger, stride, bat downswing, and impact recoil.
 * - Foreground bowler delivery stride and windmill arm release cue (600ms - 850ms).
 * - Stable 2D cricket pitch with painted popping and bowling creases, wear corridor, and scuff mark.
 * - Prominent wooden stumps and bails with turf contact shadow.
 * - High-visibility red cricket ball with sphere shading, rotating seam, motion blur, and turf shadow.
 * - Unambiguous bat/pad visual evidence: clear daylight when bat misses, direct contact when bat hits.
 * - Driven strictly by the canonical timeline clock (currentTimeMs) with zero physics tampering.
 */

import type { LBWData } from "../types/scenario";
import { LBW_TIMESTAMPS } from "./lbwPhysics";

export const CAM01_CANVAS_WIDTH = 1200;
export const CAM01_CANVAS_HEIGHT = 500;

const W = CAM01_CANVAS_WIDTH;
const H = CAM01_CANVAS_HEIGHT;
export const BAT_BLADE_LENGTH = 62;

// Math & Easing Helpers
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
export const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);
export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export interface ScreenPoint2D {
  x: number;
  y: number;
}

export interface StumpsVisual2D {
  baseX: number;
  baseY: number;
  width: number;
  height: number;
  stumpSpacing: number;
  bailsY: number;
}

export interface BatterVisual2D {
  x: number;
  y: number;
  scale: number;
  hand: 1 | -1; // 1 = right-hand, -1 = left-hand
  stride: number; // 0 (stance) -> 1 (full forward press)
  triggerOffset: number; // back-and-across shuffle
  batAngleRad: number; // bat blade rotation angle
  batPivot: ScreenPoint2D;
  batTip: ScreenPoint2D;
  frontPad: ScreenPoint2D;
  backPad: ScreenPoint2D;
  recoilX: number;
  recoilY: number;
  torsoTilt: number;
  headTilt: number;
  shotOffered: boolean;
  batFirst: boolean;
}

export interface BowlerVisual2D {
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  scale: number;
  armAngleRad: number;
  releasePoint: ScreenPoint2D;
}

export interface BallVisual2D {
  x: number;
  y: number;
  radius: number;
  seamAngleRad: number;
  shadowY: number;
  prevX: number;
  prevY: number;
  motionTrail: boolean;
  trailAlpha: number;
}

export interface ImpactRipple2D {
  x: number;
  y: number;
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
  cameraZoom: number;
  cameraPanY: number;
  pitch: {
    topLeft: ScreenPoint2D;
    topRight: ScreenPoint2D;
    bottomLeft: ScreenPoint2D;
    bottomRight: ScreenPoint2D;
    strikerBowlingCreaseY: number;
    strikerPoppingCreaseY: number;
    strikerCreaseWidth: number;
    bowlerPoppingCreaseY: number;
    bounceScuff?: { x: number; y: number; opacity: number };
  };
  stumps: StumpsVisual2D;
  bowler: BowlerVisual2D;
  batter: BatterVisual2D;
  ball: BallVisual2D;
  impactRipple?: ImpactRipple2D;
}

/**
 * Computes the authoritative visual frame state for CAM 01 at any given timeMs.
 * Pure mathematical model producing stable 2D broadcast animation data.
 */
export function getReplayFrameAtTime(lbw: LBWData, currentTimeMs: number): CAM01ReplayFrame {
  const timeMs = Math.max(600, Math.min(2200, currentTimeMs));
  const hand: 1 | -1 = lbw.batterHand === "RIGHT" ? 1 : -1;
  const isShot = lbw.shotOffered;
  const isBatFirst = lbw.batContactBeforePad;

  // 1. Event Phase
  let phase: EventPhaseName = "BOWLER GATHER & RELEASE";
  if (timeMs >= LBW_TIMESTAMPS.T_IMPACT + 100) {
    phase = "AFTERMATH";
  } else if (timeMs >= LBW_TIMESTAMPS.T_IMPACT - 20) {
    phase = "POINT OF IMPACT";
  } else if (timeMs >= LBW_TIMESTAMPS.T_BOUNCE + 60) {
    phase = "APPROACHING STRIKER";
  } else if (timeMs >= LBW_TIMESTAMPS.T_BOUNCE - 20) {
    phase = "PITCH BOUNCE";
  } else if (timeMs >= LBW_TIMESTAMPS.T_RELEASE) {
    phase = "DELIVERY IN FLIGHT";
  }

  // 2. Subtle Broadcast Optical Zoom & Framing
  // Frame gently tightens from 1.0x at release to 1.22x at impact, centering on striker
  const zoomProgress = smoothstep(clamp01((timeMs - 800) / 700));
  const cameraZoom = lerp(1.0, 1.22, zoomProgress);
  const cameraPanY = lerp(0, 35, zoomProgress);

  // 3. Stable 2D Pitch Layout
  const centerX = W * 0.50;
  // Striker end geometry (top of pitch)
  const strikerWicketY = 195;
  const strikerPoppingCreaseY = 245;
  const strikerCreaseHalfWidth = 210;

  // Bowler end geometry (foreground bottom of pitch)
  const bowlerPoppingCreaseY = 460;
  const pitchTopHalfWidth = 230;
  const pitchBottomHalfWidth = 440;

  const pitchTopLeft: ScreenPoint2D = { x: centerX - pitchTopHalfWidth, y: 165 };
  const pitchTopRight: ScreenPoint2D = { x: centerX + pitchTopHalfWidth, y: 165 };
  const pitchBottomLeft: ScreenPoint2D = { x: centerX - pitchBottomHalfWidth, y: 495 };
  const pitchBottomRight: ScreenPoint2D = { x: centerX + pitchBottomHalfWidth, y: 495 };

  // 4. Stumps & Bails Geometry
  const stumps: StumpsVisual2D = {
    baseX: centerX,
    baseY: strikerWicketY,
    width: 38,
    height: 58,
    stumpSpacing: 13,
    bailsY: strikerWicketY - 58,
  };

  // 5. Batter Kinematics & Animation State Machine
  // Stance -> Trigger -> Stride -> Bat Swing -> Impact Recoil -> Reaction
  const batterBaseX = centerX + hand * 8;
  const batterBaseY = strikerPoppingCreaseY;
  const batterScale = 1.0;

  // A. Trigger movement (600ms - 850ms): rear foot shuffles back-and-across
  const triggerT = smoothstep(clamp01((timeMs - 620) / 230));
  const triggerOffset = triggerT * -10 * hand;

  // B. Forward Stride (840ms - 1380ms): front foot strides forward towards popping crease
  const strideT = smoothstep(clamp01((timeMs - 850) / 480));
  const frontPadX = batterBaseX + hand * lerp(18, 38, strideT);
  const frontPadY = batterBaseY - lerp(4, 12, strideT);
  const backPadX = batterBaseX - hand * 22 + triggerOffset;
  const backPadY = batterBaseY;

  // C. Bat Swing & Articulation (1050ms - 1500ms)
  // Backlift tap (600-850), downswing (1050-1450), impact hold (1500+)
  let batDownswing = 0;
  if (isShot) {
    const swingStart = isBatFirst ? 1040 : 1100;
    const swingDuration = isBatFirst ? 360 : 380;
    batDownswing = smoothstep(clamp01((timeMs - swingStart) / swingDuration));
  }

  // Bat angle and position:
  // - If SHOT OFFERED & BAT FIRST: bat connects directly with ball at T_INTERCEPT (1410ms)
  // - If SHOT OFFERED & CLEAN MISS: bat comes down vertically alongside front pad with 28-36px visible daylight
  // - If NO SHOT OFFERED: bat withdrawn / tucked behind pad with clear daylight
  let targetBatAngleRad: number;
  let batGripOffsetX: number;
  let batGripOffsetY: number;

  if (!isShot) {
    // Tucked leave / shouldered arms
    targetBatAngleRad = -0.32 * hand;
    batGripOffsetX = -hand * 18;
    batGripOffsetY = -80;
  } else if (isBatFirst) {
    // Bat first: bat connects cleanly in line of delivery
    targetBatAngleRad = lerp(-0.45 * hand, 0.08 * hand, batDownswing);
    batGripOffsetX = hand * lerp(-8, 34, batDownswing);
    batGripOffsetY = lerp(-88, -48, batDownswing);
  } else {
    // Clean miss: bat comes down vertically alongside front pad
    // Guaranteed 32px of unambiguous visible daylight outside the front pad
    targetBatAngleRad = lerp(-0.45 * hand, -0.04 * hand, batDownswing);
    batGripOffsetX = hand * lerp(-8, 64, batDownswing);
    batGripOffsetY = lerp(-88, -46, batDownswing);
  }

  // Backlift raised stance angle (600ms - 850ms)
  const initialBatAngleRad = -0.52 * hand;
  const currentBatAngleRad = isShot
    ? lerp(initialBatAngleRad, targetBatAngleRad, batDownswing)
    : targetBatAngleRad;

  const batPivot: ScreenPoint2D = {
    x: batterBaseX + batGripOffsetX,
    y: batterBaseY + batGripOffsetY,
  };

  const batTip: ScreenPoint2D = {
    x: batPivot.x + Math.sin(currentBatAngleRad) * BAT_BLADE_LENGTH,
    y: batPivot.y + Math.cos(currentBatAngleRad) * BAT_BLADE_LENGTH,
  };

  // D. Impact Recoil & Vibration (1500ms - 1850ms)
  const isPostImpact = timeMs >= LBW_TIMESTAMPS.T_IMPACT && timeMs < 1850;
  const postImpactSec = (timeMs - LBW_TIMESTAMPS.T_IMPACT) / 1000;
  const recoilMagnitude = isPostImpact
    ? Math.sin(postImpactSec * Math.PI * 16) * Math.exp(-postImpactSec * 9) * 4.5
    : 0;

  const recoilX = recoilMagnitude === 0 ? 0 : -hand * recoilMagnitude;
  const recoilY = recoilMagnitude === 0 ? 0 : -recoilMagnitude * 0.3;

  const batter: BatterVisual2D = {
    x: batterBaseX,
    y: batterBaseY,
    scale: batterScale,
    hand,
    stride: strideT,
    triggerOffset,
    batAngleRad: currentBatAngleRad,
    batPivot,
    batTip,
    frontPad: { x: frontPadX + recoilX, y: frontPadY + recoilY },
    backPad: { x: backPadX, y: backPadY },
    recoilX,
    recoilY,
    torsoTilt: hand * (-0.04 - strideT * 0.05),
    headTilt: hand * (-0.03 + strideT * 0.06),
    shotOffered: isShot,
    batFirst: isBatFirst,
  };

  // 6. Foreground Bowler Delivery Cue (600ms - 900ms)
  const bowlerX = centerX - 45;
  const bowlerY = bowlerPoppingCreaseY - 5;
  const bowlerScale = 1.15;
  const bowlerOpacity = clamp01(1 - (timeMs - 820) / 160);

  // Arm windmill rotation: comes from high gather (-PI*0.4) to release (PI*1.25) at 800ms
  let armAngleRad = Math.PI * 1.25;
  if (timeMs < 800) {
    const t = (timeMs - 600) / 200;
    armAngleRad = lerp(-Math.PI * 0.4, Math.PI * 1.25, smoothstep(t));
  } else {
    const t = clamp01((timeMs - 800) / 150);
    armAngleRad = lerp(Math.PI * 1.25, Math.PI * 0.65, easeOutQuad(t));
  }

  const bowlerShoulderY = bowlerY - 65 * bowlerScale;
  const bowlerArmRadius = 38 * bowlerScale;
  const bowlerReleasePoint: ScreenPoint2D = {
    x: bowlerX + 18 + Math.cos(armAngleRad) * bowlerArmRadius,
    y: bowlerShoulderY + Math.sin(armAngleRad) * bowlerArmRadius,
  };

  const releaseArmAngleRad = Math.PI * 1.25;
  const staticReleasePoint: ScreenPoint2D = {
    x: bowlerX + 18 + Math.cos(releaseArmAngleRad) * bowlerArmRadius,
    y: bowlerShoulderY + Math.sin(releaseArmAngleRad) * bowlerArmRadius,
  };

  const bowler: BowlerVisual2D = {
    visible: timeMs < 950,
    opacity: bowlerOpacity,
    x: bowlerX,
    y: bowlerY,
    scale: bowlerScale,
    armAngleRad,
    releasePoint: bowlerReleasePoint,
  };

  // 7. High-Visibility Ball Trajectory Mapping
  // Canonical waypoints mapped into clear, visually readable 2D path
  // Bowler Hand (800ms) -> Pitch Bounce (1200ms) -> Striker Impact (1500ms) -> Aftermath (1500-2200ms)
  const bounceScreenX = centerX + lbw.pitchX * 55;
  const bounceScreenY = 312;

  // Impact target on batter front pad / bat
  const padContactScreenX = frontPadX;
  const padContactScreenY = frontPadY - 26;
  const batContactScreenX = batTip.x;
  const batContactScreenY = batTip.y - 12;

  const targetImpactX = isBatFirst ? batContactScreenX : padContactScreenX;
  const targetImpactY = isBatFirst ? batContactScreenY : padContactScreenY;

  let ballX = bowlerReleasePoint.x;
  let ballY = bowlerReleasePoint.y;
  let prevBallX = ballX;
  let prevBallY = ballY;
  let ballRadius = 8.8;
  let motionTrail = false;
  let trailAlpha = 0;
  let shadowY = bowlerPoppingCreaseY;

  if (timeMs < 800) {
    // 600ms - 800ms: Held in bowler's delivery hand as arm whips over
    ballX = bowlerReleasePoint.x;
    ballY = bowlerReleasePoint.y;
    ballRadius = 9.2;
    prevBallX = ballX - 2;
    prevBallY = ballY + 4;
    motionTrail = timeMs > 700;
    trailAlpha = clamp01((timeMs - 700) / 100) * 0.45;
    shadowY = bowlerY + 2;
  } else if (timeMs < 1200) {
    // 800ms - 1200ms: Flight arc down-pitch from release to pitch bounce
    const t = (timeMs - 800) / 400;
    const releaseX = staticReleasePoint.x;
    const releaseY = staticReleasePoint.y;

    // Smooth bezier flight curve
    const ctrlX = lerp(releaseX, bounceScreenX, 0.5);
    const ctrlY = lerp(releaseY, bounceScreenY, 0.4) - 16; // Air arc flight

    const u = 1 - t;
    ballX = u * u * releaseX + 2 * u * t * ctrlX + t * t * bounceScreenX;
    ballY = u * u * releaseY + 2 * u * t * ctrlY + t * t * bounceScreenY;
    ballRadius = lerp(9.2, 7.6, t);

    // Velocity trail
    const dt = 0.03;
    const tPrev = Math.max(0, t - dt);
    const uPrev = 1 - tPrev;
    prevBallX = uPrev * uPrev * releaseX + 2 * uPrev * tPrev * ctrlX + tPrev * tPrev * bounceScreenX;
    prevBallY = uPrev * uPrev * releaseY + 2 * uPrev * tPrev * ctrlY + tPrev * tPrev * bounceScreenY;

    motionTrail = true;
    trailAlpha = 0.55;
    shadowY = lerp(bowlerY, bounceScreenY, t);
  } else if (timeMs <= 1500) {
    // 1200ms - 1500ms: Off-pitch bounce rising into striker pad / bat
    const t = (timeMs - 1200) / 300;
    const ctrlX = lerp(bounceScreenX, targetImpactX, 0.5);
    const ctrlY = Math.min(bounceScreenY, targetImpactY) - 18; // bounce arc

    const u = 1 - t;
    ballX = u * u * bounceScreenX + 2 * u * t * ctrlX + t * t * targetImpactX;
    ballY = u * u * bounceScreenY + 2 * u * t * ctrlY + t * t * targetImpactY;
    ballRadius = lerp(7.6, 7.2, t);

    const dt = 0.04;
    const tPrev = Math.max(0, t - dt);
    const uPrev = 1 - tPrev;
    prevBallX = uPrev * uPrev * bounceScreenX + 2 * uPrev * tPrev * ctrlX + tPrev * tPrev * targetImpactX;
    prevBallY = uPrev * uPrev * bounceScreenY + 2 * uPrev * tPrev * ctrlY + tPrev * tPrev * targetImpactY;

    motionTrail = true;
    trailAlpha = 0.65;
    shadowY = lerp(bounceScreenY, strikerPoppingCreaseY, t);
  } else {
    // 1500ms - 2200ms: Aftermath
    const t = clamp01((timeMs - 1500) / 450);
    if (isBatFirst) {
      // Bat deflection: ball flies off bat face with velocity
      const deflectX = hand * -65 * t;
      const deflectY = 35 * t + t * t * 40;
      ballX = targetImpactX + deflectX;
      ballY = targetImpactY + deflectY;
      prevBallX = ballX - hand * -4;
      prevBallY = ballY - 3;
      motionTrail = t < 0.6;
      trailAlpha = (1 - t) * 0.5;
      shadowY = strikerPoppingCreaseY;
    } else {
      // Pad impact: ball drops naturally down the pad and settles on pitch turf
      const dropT = easeOutQuad(t);
      ballX = targetImpactX + hand * 4 * dropT;
      ballY = lerp(targetImpactY, strikerPoppingCreaseY + 6, dropT);
      prevBallX = ballX;
      prevBallY = ballY - 2;
      motionTrail = t < 0.35;
      trailAlpha = (1 - t) * 0.4;
      shadowY = strikerPoppingCreaseY + 6;
    }
    ballRadius = 7.2;
  }

  const ball: BallVisual2D = {
    x: ballX,
    y: ballY,
    radius: ballRadius,
    seamAngleRad: (timeMs / 1000) * 8 * Math.PI,
    shadowY,
    prevX: prevBallX,
    prevY: prevBallY,
    motionTrail,
    trailAlpha,
  };

  // 8. Pitch Scuff Mark (Revealed at and after bounce)
  let bounceScuff: { x: number; y: number; opacity: number } | undefined;
  if (timeMs >= 1200) {
    const scuffFadeIn = clamp01((timeMs - 1200) / 80);
    bounceScuff = {
      x: bounceScreenX,
      y: bounceScreenY,
      opacity: 0.78 * scuffFadeIn,
    };
  }

  // 9. Impact Ripple Visual Cue
  let impactRipple: ImpactRipple2D | undefined;
  if (timeMs >= 1500 && timeMs < 1720) {
    const rippleT = (timeMs - 1500) / 220;
    const rippleRadius = ballRadius + rippleT * 26;
    const rippleAlpha = (1 - rippleT) * 0.9;
    impactRipple = {
      x: targetImpactX,
      y: targetImpactY,
      radius: rippleRadius,
      alpha: rippleAlpha,
      color: isBatFirst ? "#38BDF8" : "#FACC15",
    };
  }

  const frameIndex = Math.round((timeMs / 1000) * 50);

  return {
    timeMs,
    frameIndex,
    phase,
    cameraZoom,
    cameraPanY,
    pitch: {
      topLeft: pitchTopLeft,
      topRight: pitchTopRight,
      bottomLeft: pitchBottomLeft,
      bottomRight: pitchBottomRight,
      strikerBowlingCreaseY: strikerWicketY,
      strikerPoppingCreaseY: strikerPoppingCreaseY,
      strikerCreaseWidth: strikerCreaseHalfWidth * 2,
      bowlerPoppingCreaseY,
      bounceScuff,
    },
    stumps,
    bowler,
    batter,
    ball,
    impactRipple,
  };
}

/**
 * Pure 2D Canvas Renderer for CAM 01 Broadcast Television Slow-Motion Replay.
 */
export function renderReplayFrame(ctx: CanvasRenderingContext2D, frame: CAM01ReplayFrame): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Apply subtle optical broadcast zoom & pan centered on the striker
  const zoom = frame.cameraZoom;
  const panY = frame.cameraPanY;
  ctx.translate(W * 0.5, H * 0.5);
  ctx.scale(zoom, zoom);
  ctx.translate(-W * 0.5, -H * 0.5 + panY);

  // 1. Stadium Grass Outfield & Atmospheric Backdrop
  const outfield = ctx.createLinearGradient(0, 0, 0, H);
  outfield.addColorStop(0, "#0b1b11");
  outfield.addColorStop(0.5, "#132d1d");
  outfield.addColorStop(1, "#0a190f");
  ctx.fillStyle = outfield;
  ctx.fillRect(-200, -200, W + 400, H + 400);

  // Subtle diagonal mower stripes
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.022)";
  ctx.lineWidth = 42;
  for (let x = -300; x < W + 400; x += 84) {
    ctx.beginPath();
    ctx.moveTo(x, -200);
    ctx.lineTo(x + 200, H + 200);
    ctx.stroke();
  }
  ctx.restore();

  // Stadium lighting floodlight glow
  const floodlight = ctx.createRadialGradient(W * 0.5, 240, 30, W * 0.5, 240, 480);
  floodlight.addColorStop(0, "rgba(254, 240, 138, 0.14)");
  floodlight.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = floodlight;
  ctx.fillRect(-200, -200, W + 400, H + 400);

  // 2. 22-Yard Clay Cricket Pitch Strip
  const { pitch } = frame;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pitch.topLeft.x, pitch.topLeft.y);
  ctx.lineTo(pitch.topRight.x, pitch.topRight.y);
  ctx.lineTo(pitch.bottomRight.x, pitch.bottomRight.y);
  ctx.lineTo(pitch.bottomLeft.x, pitch.bottomLeft.y);
  ctx.closePath();

  // Natural clay gradient (striker end to bowler end)
  const turfGrad = ctx.createLinearGradient(0, pitch.topLeft.y, 0, pitch.bottomLeft.y);
  turfGrad.addColorStop(0, "#a88965");
  turfGrad.addColorStop(0.45, "#be9f79");
  turfGrad.addColorStop(1, "#947754");
  ctx.fillStyle = turfGrad;
  ctx.fill();

  // Pitch edge border line
  ctx.strokeStyle = "rgba(75, 52, 30, 0.85)";
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Central pitch wear corridor
  const wearTopHalfW = 100;
  const wearBottomHalfW = 190;
  ctx.fillStyle = "rgba(205, 175, 140, 0.28)";
  ctx.beginPath();
  ctx.moveTo(W * 0.5 - wearTopHalfW, pitch.topLeft.y);
  ctx.lineTo(W * 0.5 + wearTopHalfW, pitch.topLeft.y);
  ctx.lineTo(W * 0.5 + wearBottomHalfW, pitch.bottomLeft.y);
  ctx.lineTo(W * 0.5 - wearBottomHalfW, pitch.bottomLeft.y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // 3. Crease Lines
  // Striker Bowling Crease (through stumps)
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(W * 0.5 - 180, pitch.strikerBowlingCreaseY);
  ctx.lineTo(W * 0.5 + 180, pitch.strikerBowlingCreaseY);
  ctx.stroke();

  // Striker Popping Crease (Prominent white painted line)
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 3.6;
  ctx.beginPath();
  ctx.moveTo(W * 0.5 - pitch.strikerCreaseWidth * 0.5, pitch.strikerPoppingCreaseY);
  ctx.lineTo(W * 0.5 + pitch.strikerCreaseWidth * 0.5, pitch.strikerPoppingCreaseY);
  ctx.stroke();

  // Return creases flanking popping crease
  ctx.lineWidth = 2.0;
  [-pitch.strikerCreaseWidth * 0.5, pitch.strikerCreaseWidth * 0.5].forEach((rx) => {
    ctx.beginPath();
    ctx.moveTo(W * 0.5 + rx, pitch.strikerBowlingCreaseY);
    ctx.lineTo(W * 0.5 + rx, pitch.strikerPoppingCreaseY + 45);
    ctx.stroke();
  });

  // Bowler Popping Crease (in foreground)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 3.8;
  ctx.beginPath();
  ctx.moveTo(W * 0.5 - 340, pitch.bowlerPoppingCreaseY);
  ctx.lineTo(W * 0.5 + 340, pitch.bowlerPoppingCreaseY);
  ctx.stroke();
  ctx.restore();

  // 4. Pitch Bounce Turf Scuff Mark
  if (pitch.bounceScuff) {
    const { x, y, opacity } = pitch.bounceScuff;
    ctx.save();
    ctx.fillStyle = `rgba(55, 36, 18, ${opacity})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 14, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(230, 205, 170, ${opacity * 0.6})`;
    ctx.lineWidth = 1.0;
    ctx.stroke();
    ctx.restore();
  }

  // 5. Stumps & Bails (Striker End — Behind Batsman)
  const { stumps } = frame;
  // Contact ground shadow under stumps
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath();
  ctx.ellipse(stumps.baseX, stumps.baseY + 1, stumps.width * 0.65, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3 Stumps (Off, Middle, Leg)
  const stumpOffsets = [-stumps.stumpSpacing, 0, stumps.stumpSpacing];
  stumpOffsets.forEach((sx, idx) => {
    const sxPos = stumps.baseX + sx;
    // Wooden stump timber
    ctx.fillStyle = idx === 1 ? "#F59E0B" : "#D97706";
    ctx.strokeStyle = "#78350F";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(sxPos - 2.5, stumps.baseY - stumps.height, 5.0, stumps.height, [1.5, 1.5, 0, 0]);
    ctx.fill();
    ctx.stroke();
  });

  // 2 Bails across stumps
  [
    [-stumps.stumpSpacing * 0.5, stumps.stumpSpacing * 0.5],
    [stumps.stumpSpacing * 0.5, stumps.stumpSpacing * 1.5],
  ].forEach(([x1, x2]) => {
    ctx.fillStyle = "#FCD34D";
    ctx.strokeStyle = "#78350F";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(stumps.baseX + x1 - 5, stumps.bailsY - 2.5, Math.abs(x2 - x1) + 2, 4.0, 1.2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();

  // 6. Hero Batter Rig (Prominent, Authentically Articulated 2D Cricket Batsman)
  const { batter } = frame;
  ctx.save();
  const hand = batter.hand;

  // Ground shadow under batter
  ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
  ctx.beginPath();
  ctx.ellipse(
    (batter.frontPad.x + batter.backPad.x) * 0.5,
    batter.y + 2,
    42,
    9,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  // A. Back Leg & Rear Flannel Pad
  ctx.save();
  ctx.translate(batter.backPad.x, batter.backPad.y);

  // Rear thigh
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -68);
  ctx.lineTo(0, -38);
  ctx.stroke();

  // Rear batting pad (white with slate outline)
  ctx.fillStyle = "#F1F5F9";
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-8, -42, 16, 42, 3.5);
  ctx.fill();
  ctx.stroke();

  // Rear cricket boot (white with black cleats)
  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.ellipse(0, 1, 9, 3.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(0, -1, 8, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // B. Front Leg & Hero Batting Pad (Clear knee roll, cane ribs, impact shudder)
  ctx.save();
  ctx.translate(batter.frontPad.x, batter.frontPad.y);

  // Front thigh
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-hand * 4, -72);
  ctx.lineTo(0, -42);
  ctx.stroke();

  // Front pad shell (crisp white)
  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-10, -48, 20, 50, 4.0);
  ctx.fill();
  ctx.stroke();

  // Knee Roll Cushion
  ctx.fillStyle = "#E2E8F0";
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-9, -38, 18, 11, 2.5);
  ctx.fill();
  ctx.stroke();

  // 3 Vertical Cane Ribs
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1.6;
  [-5, 0, 5].forEach((rx) => {
    ctx.beginPath();
    ctx.moveTo(rx, -45);
    ctx.lineTo(rx, -4);
    ctx.stroke();
  });

  // Front cricket boot
  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.ellipse(hand * 2, 2, 10, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.ellipse(hand * 2, 0, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // C. Torso & Team Jersey
  const torsoX = (batter.frontPad.x + batter.backPad.x) * 0.5;
  const torsoY = batter.y - 74 + batter.recoilY * 0.5;
  ctx.save();
  ctx.translate(torsoX, torsoY);
  ctx.rotate(batter.torsoTilt);

  // Dark Navy Jersey Body
  ctx.fillStyle = "#1E293B";
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-18, -44, 36, 48, [6, 6, 3, 3]);
  ctx.fill();
  ctx.stroke();

  // Cyan Team Side Stripe
  ctx.strokeStyle = "#38BDF8";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(hand * -13, -38);
  ctx.lineTo(hand * -13, -2);
  ctx.stroke();

  // Jersey Number "18"
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.fillText("18", 0, -18);
  ctx.restore();

  // D. Head & Protective Helmet with Face Grille
  const headX = torsoX + hand * -3;
  const headY = torsoY - 56;
  ctx.save();
  ctx.translate(headX, headY);
  ctx.rotate(batter.headTilt);

  // Helmet Shell
  ctx.fillStyle = "#0F172A";
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Face profile & skin
  ctx.fillStyle = "#D4A373";
  ctx.beginPath();
  ctx.ellipse(hand * 6, -1, 5.5, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Helmet Peak Visor
  ctx.fillStyle = "#050B14";
  ctx.beginPath();
  ctx.moveTo(hand * 9, -2);
  ctx.lineTo(hand * 20, 2);
  ctx.lineTo(hand * 9, 6);
  ctx.closePath();
  ctx.fill();

  // Protective Titanium Face Grille
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(hand * 11, 2);
  ctx.lineTo(hand * 2, 7);
  ctx.moveTo(hand * 13, 5);
  ctx.lineTo(hand * 4, 10);
  ctx.stroke();
  ctx.restore();

  // E. Arms & Bat Blade
  const shoulderX = torsoX + hand * 10;
  const shoulderY = torsoY - 38;
  const rearShoulderX = torsoX - hand * 12;

  // Rear arm
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 8.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(rearShoulderX, shoulderY);
  ctx.lineTo(batter.batPivot.x - hand * 4, batter.batPivot.y);
  ctx.stroke();

  // Lead arm
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 9.0;
  ctx.beginPath();
  ctx.moveTo(shoulderX, shoulderY);
  ctx.lineTo(batter.batPivot.x + hand * 3, batter.batPivot.y);
  ctx.stroke();

  // Bat Handle & English Willow Blade
  ctx.save();
  ctx.translate(batter.batPivot.x, batter.batPivot.y);
  ctx.rotate(batter.batAngleRad);

  // Rubber Handle Grip
  ctx.fillStyle = "#0284C7";
  ctx.strokeStyle = "#0369A1";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.roundRect(-2.8, -22, 5.6, 22, 1.5);
  ctx.fill();
  ctx.stroke();

  // Willow Blade
  ctx.fillStyle = "#D97706";
  ctx.strokeStyle = "#78350F";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-5.5, 0, 11, BAT_BLADE_LENGTH, 2.5);
  ctx.fill();
  ctx.stroke();

  // Face Sticker
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(-5.5, 4, 11, 8);
  ctx.restore();

  // Batting Gloves (Padded white gloves)
  ctx.fillStyle = "#F8FAFC";
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 1.2;
  [-3, 3].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(batter.batPivot.x + dx * hand, batter.batPivot.y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.restore();

  // 7. Foreground Bowler Silhouette (Visible at release cue 600ms - 850ms)
  const { bowler } = frame;
  if (bowler.visible && bowler.opacity > 0.01) {
    ctx.save();
    ctx.globalAlpha = bowler.opacity;

    // Bowler Stride & Body Silhouette
    ctx.fillStyle = "#0F172A";
    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 2.0;

    // Bowler Front Leg plant
    ctx.beginPath();
    ctx.ellipse(bowler.x + 12, bowler.y, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Torso
    ctx.beginPath();
    ctx.roundRect(bowler.x - 14, bowler.y - 75, 28, 55, 6);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(bowler.x, bowler.y - 88, 12, 0, Math.PI * 2);
    ctx.fill();

    // Bowling Arm Windmill
    const shoulderYPos = bowler.y - 68;
    ctx.strokeStyle = "#1E293B";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(bowler.x + 8, shoulderYPos);
    ctx.lineTo(bowler.releasePoint.x, bowler.releasePoint.y);
    ctx.stroke();

    ctx.restore();
  }

  // 8. Impact Ripple Visual Cue
  if (frame.impactRipple) {
    const { x, y, radius, alpha, color } = frame.impactRipple;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 9. High-Visibility Cricket Ball with Motion Blur & Rotating Seam
  const { ball } = frame;
  ctx.save();

  // Motion Trail / Motion Blur in flight
  if (ball.motionTrail && ball.trailAlpha > 0.01) {
    ctx.strokeStyle = "rgba(220, 38, 38, " + ball.trailAlpha + ")";
    ctx.lineWidth = ball.radius * 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(ball.prevX, ball.prevY);
    ctx.lineTo(ball.x, ball.y);
    ctx.stroke();
  }

  // Ball Ground Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
  ctx.beginPath();
  ctx.ellipse(ball.x, ball.shadowY, ball.radius * 1.05, ball.radius * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4-Piece Cricket Ball Shading (Radial 3D Sphere)
  const r = ball.radius;
  const ballGrad = ctx.createRadialGradient(
    ball.x - r * 0.32,
    ball.y - r * 0.32,
    r * 0.12,
    ball.x,
    ball.y,
    r
  );
  ballGrad.addColorStop(0, "#ff5555");
  ballGrad.addColorStop(0.65, "#dc2626");
  ballGrad.addColorStop(1, "#7f1d1d");

  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Ball Core Rim
  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  // White Stitched Seam
  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.seamAngleRad);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.88, r * 0.26, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // Restore optical zoom transform
}
