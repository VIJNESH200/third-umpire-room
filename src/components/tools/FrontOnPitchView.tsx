import React, { useEffect, useRef } from "react";
import type { LBWData } from "../../types/scenario";
import { drawCricketBall } from "../instinct/actorRigs";
import {
  solveLBWReplayState,
  LBW_TIMESTAMPS,
  type LBWReplayState,
} from "../../engine/lbwPhysics";

interface FrontOnPitchViewProps {
  lbw: LBWData;
  currentTimeMs: number;
}

// High-definition render canvas dimensions (matches wide broadcast viewport)
const W = 1200;
const H = 500;

type Vec3 = { x: number; y: number; z: number };
type Camera = {
  position: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  focal: number;
};

// Math Helpers
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
const unit = (a: Vec3): Vec3 => mul(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));

/**
 * Constructs an elevated 15° off-axis broadcast camera that smoothly zooms
 * and tracks down-pitch onto the striker's front pad and wickets at impact.
 */
function makeCamera(timeMs: number): Camera {
  // Smooth optical zoom progress into impact (like an 80x broadcast lens)
  const rawProgress = clamp01((timeMs - 880) / 600);
  const zoomT = smoothstep(rawProgress);

  // Elevated broadcast camera position behind bowler
  const position: Vec3 = {
    x: lerp(-0.85, -0.65, zoomT),
    y: lerp(3.8, 3.2, zoomT),
    z: lerp(21.5, 19.5, zoomT),
  };

  // Look-at Target: Smoothly pans onto striker popping crease & front pad
  const target: Vec3 = {
    x: lerp(0.0, 0.04, zoomT),
    y: lerp(0.95, 0.80, zoomT),
    z: lerp(3.2, 0.90, zoomT),
  };

  const forward = unit(sub(target, position));
  const right = unit(cross(forward, { x: 0, y: 1, z: 0 }));
  const up = unit(cross(right, forward));
  const focal = lerp(1200, 2750, zoomT);

  return { position, forward, right, up, focal };
}

/**
 * Projects a 3D world-space coordinate to screen pixels.
 */
function project(camera: Camera, point: Vec3) {
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
 * Renders a closed 3D polygon on the turf.
 */
function worldPath(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  points: Vec3[],
  close = false
) {
  const first = project(camera, points[0]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  points.slice(1).forEach((pt) => {
    const p = project(camera, pt);
    ctx.lineTo(p.x, p.y);
  });
  if (close) ctx.closePath();
}

/**
 * Renders a crisp 3D crease line on the pitch surface.
 */
function groundLine(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  a: Vec3,
  b: Vec3,
  width: number,
  alpha: number
) {
  const pa = project(camera, a);
  const pb = project(camera, b);
  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pa.x, pa.y);
  ctx.lineTo(pb.x, pb.y);
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws realistic 3-stump striker wicket with bails and ground contact shadow.
 */
function drawStumps(ctx: CanvasRenderingContext2D, camera: Camera) {
  const wicketZ = 0.0;
  const stumpHeight = 0.711;

  // Ground contact shadow under stumps
  const shadowA = project(camera, { x: -0.32, y: 0, z: wicketZ - 0.06 });
  const shadowB = project(camera, { x: 0.32, y: 0, z: wicketZ - 0.06 });
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(shadowA.x, shadowA.y);
  ctx.lineTo(shadowB.x, shadowB.y);
  ctx.stroke();

  // 3 Stumps (Off, Middle, Leg)
  const stumpPositions = [-0.114, 0.0, 0.114];
  stumpPositions.forEach((x, index) => {
    const base = project(camera, { x, y: 0.0, z: wicketZ });
    const top = project(camera, { x, y: stumpHeight, z: wicketZ });
    const side = project(camera, { x: x + 0.024, y: 0.0, z: wicketZ });
    const stumpWidth = Math.max(4.2, Math.abs(side.x - base.x) * 1.8);

    // Wooden stump shading
    ctx.strokeStyle = "#78350F";
    ctx.lineWidth = stumpWidth + 2;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();

    ctx.strokeStyle = index === 1 ? "#F59E0B" : "#D97706";
    ctx.lineWidth = stumpWidth;
    ctx.beginPath();
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(top.x, top.y);
    ctx.stroke();
  });

  // 2 Bails across the 3 stumps
  [
    [-0.114, 0.0],
    [0.0, 0.114],
  ].forEach(([x1, x2]) => {
    const a = project(camera, { x: x1, y: stumpHeight + 0.025, z: wicketZ });
    const b = project(camera, { x: x2, y: stumpHeight + 0.025, z: wicketZ });
    ctx.strokeStyle = "#78350F";
    ctx.lineWidth = 4.8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.strokeStyle = "#FCD34D";
    ctx.lineWidth = 3.0;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });

  ctx.restore();
}

/**
 * Draws a full-bodied stylized cricket batter with clear pad separation,
 * distinct front pad with knee rolls, helmet, and authentic forward defensive/drive stroke.
 */
function drawBatter(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  lbw: LBWData,
  replayState: LBWReplayState
) {
  const { currentTimeMs: timeMs, batter } = replayState;
  const hand = lbw.batterHand === "RIGHT" ? 1 : -1;

  // Stride progress into delivery: forward press towards popping crease
  const stride = batter.stride;

  // Impact recoil shudder
  const isImpact = timeMs >= LBW_TIMESTAMPS.T_IMPACT && timeMs < 1680;
  const recoil = isImpact
    ? Math.sin(((timeMs - LBW_TIMESTAMPS.T_IMPACT) / 140) * Math.PI * 2) *
      Math.exp(-(timeMs - LBW_TIMESTAMPS.T_IMPACT) / 90)
    : 0;

  // Striker base stance anchor on popping crease
  const anchor = batter.anchor;
  const origin = project(camera, anchor);
  const px = project(camera, add(anchor, { x: 1, y: 0, z: 0 }));
  const py = project(camera, add(anchor, { x: 0, y: 1, z: 0 }));
  const ex = { x: px.x - origin.x, y: px.y - origin.y };
  const ey = { x: py.x - origin.x, y: py.y - origin.y };

  // Coordinates relative to anchor for local 2D transform
  const frontPadX = batter.frontPadWorld.x - anchor.x;
  const backPadX = batter.backPadWorld.x - anchor.x;

  const gloveX = batter.batGloveWorld.x - anchor.x;
  const gloveY = batter.batGloveWorld.y;
  const batAngle = batter.batAngleRad;

  // Ground shadow under batter
  const footBack = project(camera, batter.backPadWorld);
  const footFront = project(camera, { x: batter.frontPadWorld.x, y: 0, z: batter.frontPadWorld.z });
  ctx.save();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.48)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(footBack.x, footBack.y);
  ctx.lineTo(footFront.x, footFront.y);
  ctx.stroke();

  // Apply projected 2D transformation matrix for local batter rig
  ctx.setTransform(ex.x, ex.y, ey.x, ey.y, origin.x, origin.y);
  ctx.lineCap = "round";

  // 1. Back Leg & Pad (Anchored on batting crease)
  ctx.save();
  ctx.translate(backPadX, 0.02);
  // Back thigh & pants
  ctx.strokeStyle = "#E2E8F0";
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(0, 0.98);
  ctx.lineTo(0, 0.48);
  ctx.stroke();

  // Back Pad (White batting pad)
  ctx.fillStyle = "#F1F5F9";
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.roundRect(-0.09, 0.02, 0.18, 0.52, 0.035);
  ctx.fill();
  ctx.stroke();

  // Back Shoe
  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.ellipse(0, -0.01, 0.11, 0.045, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Front Leg & Pad (Prominent, with knee rolls and straps)
  ctx.save();
  ctx.translate(frontPadX + recoil * 0.025, 0.02);
  ctx.rotate(hand * (0.05 + stride * 0.03));

  // Front Thigh & Pants
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 0.2;
  ctx.beginPath();
  ctx.moveTo(hand * -0.04, 1.0);
  ctx.lineTo(0, 0.54);
  ctx.stroke();

  // Front Batting Pad Shell (Crisp White)
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

  // Front Shoe (Grounded on turf)
  ctx.fillStyle = "#0F172A";
  ctx.beginPath();
  ctx.ellipse(hand * 0.03, -0.015, 0.13, 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Torso & Team Jersey (Believable chest width and stance)
  ctx.save();
  ctx.translate(0, 1.0 + recoil * 0.015);
  ctx.rotate(hand * (-0.05 - stride * 0.04));

  // Main Jersey Body
  ctx.fillStyle = "#1E293B";
  ctx.strokeStyle = "#0F172A";
  ctx.lineWidth = 0.022;
  ctx.beginPath();
  ctx.roundRect(-0.24, 0.0, 0.48, 0.66, 0.08);
  ctx.fill();
  ctx.stroke();

  // Team Gold / Cyan Trim
  ctx.strokeStyle = "#38BDF8";
  ctx.lineWidth = 0.024;
  ctx.beginPath();
  ctx.moveTo(hand * -0.18, 0.08);
  ctx.lineTo(hand * -0.18, 0.58);
  ctx.stroke();

  // Jersey Number
  ctx.fillStyle = "#F8FAFC";
  ctx.font = "bold 0.16px monospace";
  ctx.textAlign = "center";
  ctx.fillText("18", 0, 0.35);
  ctx.restore();

  // 4. Head & Protective Helmet (With face grille)
  const headX = hand * -0.05;
  ctx.save();
  ctx.translate(headX, 1.84 + recoil * 0.015);
  ctx.rotate(hand * -0.06);

  // Dark Navy Helmet Shell
  ctx.fillStyle = "#0F172A";
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.arc(0, 0, 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Batter Face & Skin
  ctx.fillStyle = "#D4A373";
  ctx.beginPath();
  ctx.ellipse(hand * 0.08, -0.01, 0.065, 0.075, 0, 0, Math.PI * 2);
  ctx.fill();

  // Helmet Peak & Grille
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

  // 5. Arms & Bat Blade
  const shoulderY = 1.54;
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.11;
  ctx.beginPath();
  ctx.moveTo(hand * 0.18, shoulderY);
  ctx.lineTo(gloveX + hand * 0.03, gloveY);
  ctx.stroke();

  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 0.115;
  ctx.beginPath();
  ctx.moveTo(hand * -0.16, shoulderY);
  ctx.lineTo(gloveX - hand * 0.03, gloveY);
  ctx.stroke();

  // Bat Blade & Handle
  ctx.save();
  ctx.translate(gloveX, gloveY);
  ctx.rotate(batAngle);

  // Rubber Grip Handle
  ctx.fillStyle = "#0284C7";
  ctx.strokeStyle = "#0369A1";
  ctx.lineWidth = 0.016;
  ctx.beginPath();
  ctx.roundRect(-0.03, 0.0, 0.06, 0.30, 0.02);
  ctx.fill();
  ctx.stroke();

  // English Willow Wooden Blade
  ctx.fillStyle = "#D97706";
  ctx.strokeStyle = "#78350F";
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.roundRect(-0.065, -0.78, 0.13, 0.78, 0.03);
  ctx.fill();
  ctx.stroke();

  // White Blade Face / Colored Edge Stickers
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(-0.065, -0.78, 0.13, 0.08);
  ctx.restore();

  // Batting Gloves (White with knuckle padding)
  ctx.fillStyle = "#F8FAFC";
  ctx.strokeStyle = "#94A3B8";
  ctx.lineWidth = 0.015;
  [-0.035, 0.04].forEach((dx) => {
    ctx.beginPath();
    ctx.arc(gloveX + dx * hand, gloveY, 0.065, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

export const FrontOnPitchView: React.FC<FrontOnPitchViewProps> = ({
  lbw,
  currentTimeMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const timeMs = Math.max(600, Math.min(2200, currentTimeMs));
    const camera = makeCamera(timeMs);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // 1. Stadium Outfield Grass & Atmospheric Glow
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

    // 2. 22-Yard Clay Cricket Pitch Strip
    const pitchCorners: Vec3[] = [
      { x: -1.524, y: 0, z: -1.8 },
      { x: 1.524, y: 0, z: -1.8 },
      { x: 1.524, y: 0, z: 20.2 },
      { x: -1.524, y: 0, z: 20.2 },
    ];
    worldPath(ctx, camera, pitchCorners, true);
    const turf = ctx.createLinearGradient(0, 110, 0, 420);
    turf.addColorStop(0, "#80684c");
    turf.addColorStop(0.55, "#b0936b");
    turf.addColorStop(1, "#927654");
    ctx.fillStyle = turf;
    ctx.fill();
    ctx.strokeStyle = "rgba(91, 66, 42, 0.85)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 3. Official Pitch Crease Lines
    // Bowling Crease at Striker Stumps (Z = 0.0m)
    groundLine(
      ctx,
      camera,
      { x: -1.524, y: 0.005, z: 0.0 },
      { x: 1.524, y: 0.005, z: 0.0 },
      1.8,
      0.65
    );
    // Striker Popping Crease (Z = 1.22m)
    groundLine(
      ctx,
      camera,
      { x: -1.524, y: 0.008, z: 1.22 },
      { x: 1.524, y: 0.008, z: 1.22 },
      3.2,
      0.95
    );
    // Return Creases
    groundLine(
      ctx,
      camera,
      { x: -1.32, y: 0.006, z: 0.0 },
      { x: -1.32, y: 0.006, z: 2.44 },
      1.5,
      0.7
    );
    groundLine(
      ctx,
      camera,
      { x: 1.32, y: 0.006, z: 0.0 },
      { x: 1.32, y: 0.006, z: 2.44 },
      1.5,
      0.7
    );

    // 4. Solve Canonical LBW Delivery State
    const replayState = solveLBWReplayState(lbw, timeMs);

    // Turf Landing Scuff Mark (Revealed once ball bounces)
    if (timeMs >= LBW_TIMESTAMPS.T_BOUNCE) {
      const mark = project(camera, replayState.waypoints.bounce);
      ctx.fillStyle = "rgba(65, 44, 25, 0.72)";
      ctx.beginPath();
      ctx.ellipse(mark.x, mark.y, 12, 4.5, -0.15, 0, Math.PI * 2);
      ctx.fill();
    }

    // 5. Striker Stumps & Batter
    drawStumps(ctx, camera);
    drawBatter(ctx, camera, lbw, replayState);

    // 6. Ball Trajectory & Motion Dynamics from canonical physics
    const ballPos = replayState.ball;
    const pBall = project(camera, ballPos);
    const pPrev = project(camera, {
      x: ballPos.x - ballPos.vx * 0.02,
      y: ballPos.y - ballPos.vy * 0.02,
      z: ballPos.z - ballPos.vz * 0.02,
    });
    const pRadius = Math.max(
      5.2,
      Math.abs(project(camera, add(ballPos, { x: 0.076, y: 0, z: 0 })).x - pBall.x)
    );

    // 7. Impact Shockwave Ripple Effect
    // Bat impact ripple (if prior bat contact at T_INTERCEPT)
    if (
      lbw.batContactBeforePad &&
      timeMs >= LBW_TIMESTAMPS.T_INTERCEPT &&
      timeMs < LBW_TIMESTAMPS.T_INTERCEPT + 180
    ) {
      const k = 1 - (timeMs - LBW_TIMESTAMPS.T_INTERCEPT) / 180;
      const pBat = project(camera, replayState.waypoints.batContact);
      ctx.save();
      ctx.strokeStyle = `rgba(56, 189, 248, ${0.9 * k})`;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.arc(pBat.x, pBat.y, pRadius + (1 - k) * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Pad impact ripple (if pad contact)
    if (
      !lbw.batContactBeforePad &&
      timeMs >= LBW_TIMESTAMPS.T_IMPACT &&
      timeMs < 1680
    ) {
      const k = 1 - (timeMs - LBW_TIMESTAMPS.T_IMPACT) / 180;
      const pImpact = project(camera, replayState.waypoints.impact);
      ctx.save();
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.85 * k})`;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(pImpact.x, pImpact.y, pRadius + (1 - k) * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 8. Render Cricket Ball with Seam & Motion Trail
    drawCricketBall(ctx, pBall.x, pBall.y, {
      radius: pRadius,
      seamAngleRad: (timeMs / 1000) * Math.PI * 8,
      motionTrail: !ballPos.isDead && timeMs > LBW_TIMESTAMPS.T_RELEASE + 30,
      prevX: pPrev.x,
      prevY: pPrev.y,
    });
  }, [lbw, currentTimeMs]);

  const statusTime = Math.max(600, Math.min(2200, currentTimeMs));
  const statusText =
    statusTime < LBW_TIMESTAMPS.T_RELEASE
      ? "GATHER & RELEASE"
      : statusTime < LBW_TIMESTAMPS.T_BOUNCE
      ? "DELIVERY IN FLIGHT"
      : statusTime < LBW_TIMESTAMPS.T_IMPACT
      ? "OFF THE PITCH"
      : lbw.batContactBeforePad
      ? "BAT CONTACT • DEFLECTED"
      : "PAD CONTACT • DEAD BALL";

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-1.5 select-none font-mono text-slate-200">
      {/* Broadcast Header Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 01 • BROADCAST IMPACT REPLAY
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 50 FPS
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          <span>
            SPEED: <b className="text-cyan-300">{lbw.ballSpeedKph} KM/H</b>
          </span>
          <span>•</span>
          <span>
            TYPE: <b className="text-slate-200">{lbw.spinOrPace}</b>
          </span>
        </div>
      </div>

      {/* Replay Video Canvas */}
      <div className="relative flex-1 min-h-0 mt-1 bg-gradient-to-b from-[#0c1624] via-[#08101a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full h-full object-contain block z-10"
        />

        {/* Live Replay Overlay Badges */}
        <div className="absolute top-2.5 left-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono backdrop-blur-sm z-20">
          <span className="text-slate-400 font-bold">STATUS: </span>
          <span className="text-cyan-300 font-black">{statusText}</span>
        </div>

        <div className="absolute bottom-2.5 right-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1 rounded text-[10px] text-slate-300 backdrop-blur-sm z-20">
          STRIKER SLOW-MO REPLAY • <b className="text-cyan-300">CAM 03</b> HAWK-EYE
        </div>
      </div>
    </div>
  );
};

