import React, { useEffect, useRef, useState } from "react";
import type { Scenario } from "../../types/scenario";
import { Camera } from "lucide-react";
import {
  mapPhase1TimeToReplayTime,
  solveRunOutReplayState,
} from "../../engine/runOutPhysics";
import {
  lerp,
  clamp,
  solveLBWBatterKinematics,
  solveLBWBowlerKinematics,
  solveCaughtBehindBatterKinematics,
  solveCaughtBehindKeeperKinematics,
  solveRunOutRunnerKinematics,
  solveStumpingBatterKinematics,
  solveStumpingKeeperKinematics,
  solveBoundaryFielderKinematics,
  drawArticulatedBatter,
  drawArticulatedRunner,
  drawArticulatedBowler,
  drawArticulatedWicketkeeper,
  drawArticulatedFielder,
  drawStumpsAndBails,
  drawCricketBall,
} from "./actorRigs";

interface IncidentReplayFeedProps {
  scenario: Scenario;
}

export const IncidentReplayFeed: React.FC<IncidentReplayFeedProps> = ({ scenario }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [timecode, setTimecode] = useState("00:14:28:12");

  // Broadcast camera labels
  const getCameraLabel = () => {
    switch (scenario.incidentType) {
      case "LBW": return "CAM 01 • PITCH END BROADCAST";
      case "RUN_OUT": return "CAM 02 • SQUARE LEG BROADCAST";
      case "STUMPING": return "CAM 02 • SIDE-ON STUMPING CAM";
      case "CAUGHT_BEHIND": return "CAM 03 • SLIP CAM BROADCAST";
      case "BOUNDARY": return "CAM 04 • BOUNDARY TRACKING";
    }
  };

  // Replay clip duration in milliseconds (standard broadcast 2.8s replay loop)
  const CLIP_DURATION_MS = 2800;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();

    const render = (now: number) => {
      const elapsed = (now - startTime) % CLIP_DURATION_MS;
      const progress = elapsed / CLIP_DURATION_MS; // 0.0 to 1.0

      // Standard broadcast 25fps timecode calculation
      const totalSeconds = Math.floor(elapsed / 1000);
      const frameInSecond = Math.floor((elapsed % 1000) / 40); // 0 to 24 frames
      const formattedSecs = (28 + totalSeconds).toString().padStart(2, "0");
      const formattedFrames = frameInSecond.toString().padStart(2, "0");
      setTimecode(`00:14:${formattedSecs}:${formattedFrames}`);

      const width = canvas.width;
      const height = canvas.height;

      // Canonical replay timeline mapping (600ms to 2200ms)
      const canonicalTimeMs = mapPhase1TimeToReplayTime(elapsed, CLIP_DURATION_MS);

      // Clear frame
      ctx.clearRect(0, 0, width, height);

      // Render incident-specific broadcast replay using common actor rigs
      if (scenario.incidentType === "LBW") {
        renderLBWBroadcast(ctx, width, height, progress, scenario);
      } else if (scenario.incidentType === "RUN_OUT") {
        renderRunOutBroadcast(ctx, width, height, progress, scenario, canonicalTimeMs);
      } else if (scenario.incidentType === "STUMPING") {
        renderStumpingBroadcast(ctx, width, height, progress, scenario, canonicalTimeMs);
      } else if (scenario.incidentType === "CAUGHT_BEHIND") {
        renderCaughtBehindBroadcast(ctx, width, height, progress, scenario);
      } else if (scenario.incidentType === "BOUNDARY") {
        renderBoundaryBroadcast(ctx, width, height, progress, scenario);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [scenario]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800/90 bg-[#0a140d] select-none shadow-2xl flex flex-col justify-center items-center" style={{ minHeight: 280 }}>
      {/* High-Performance Canvas Replay Viewport */}
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="w-full h-full object-contain block"
      />

      {/* Subtle Broadcast CRT Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_60%,rgba(0,0,0,0.6)_100%)] pointer-events-none" />

      {/* Camera Label — Top Left */}
      <div className="absolute top-3 left-3 z-30 bg-black/75 px-3 py-1.5 rounded flex items-center gap-2 border border-white/10 backdrop-blur-md shadow-lg">
        <Camera className="w-3.5 h-3.5 text-white/80" />
        <span className="text-white/90 text-[11px] font-mono font-bold tracking-wider">{getCameraLabel()}</span>
      </div>

      {/* REPLAY Badge — Top Right */}
      <div className="absolute top-3 right-3 z-30 bg-black/75 px-3 py-1.5 rounded flex items-center gap-2 border border-white/10 backdrop-blur-md shadow-lg">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-white/90 text-[11px] font-mono font-bold tracking-widest">LIVE REPLAY</span>
      </div>

      {/* Timecode — Bottom Right */}
      <div className="absolute bottom-3 right-3 z-30 bg-black/75 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md shadow-lg">
        <span className="text-white/80 text-xs font-mono font-bold tracking-wider tabular-nums">{timecode}</span>
      </div>

      {/* Broadcast Info Strap — Bottom Left */}
      {scenario.incidentType === "LBW" && scenario.lbw && (
        <div className="absolute bottom-3 left-3 z-30 bg-black/75 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md shadow-lg flex items-center gap-2">
          <span className="text-cyan-300 text-[11px] font-mono font-bold">{scenario.lbw.ballSpeedKph} KPH</span>
          <span className="text-white/40 text-[10px]">•</span>
          <span className="text-white/70 text-[10px] font-mono">{scenario.lbw.spinOrPace}</span>
        </div>
      )}

      {scenario.incidentType === "RUN_OUT" && (
        <div className="absolute bottom-3 left-3 z-30 bg-black/75 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md shadow-lg">
          <span className="text-amber-300 text-[11px] font-mono font-bold">RUN OUT APPEAL</span>
        </div>
      )}

      {scenario.incidentType === "STUMPING" && (
        <div className="absolute bottom-3 left-3 z-30 bg-black/75 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md shadow-lg">
          <span className="text-amber-300 text-[11px] font-mono font-bold">STUMPING APPEAL</span>
        </div>
      )}

      {scenario.incidentType === "CAUGHT_BEHIND" && (
        <div className="absolute bottom-3 left-3 z-30 bg-black/75 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md shadow-lg">
          <span className="text-rose-300 text-[11px] font-mono font-bold">CAUGHT BEHIND APPEAL</span>
        </div>
      )}

      {scenario.incidentType === "BOUNDARY" && (
        <div className="absolute bottom-3 left-3 z-30 bg-black/75 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md shadow-lg">
          <span className="text-emerald-300 text-[11px] font-mono font-bold">BOUNDARY CUSHION CHECK</span>
        </div>
      )}
    </div>
  );
};

/* ================================================================
   22-YARD CRICKET PITCH GEOMETRY & BOWLER-END CAMERA PROJECTION
   Perspective Viewpoint: Bowler-End Umpire / Pitch-End Broadcast Cam
   The camera sits at the bowler end looking down the pitch towards the striker.

   Spatial Order (Top / Far to Bottom / Near / Camera):
   TOP / FAR:
     STRIKER-END STUMPS (0.17h, scale ≈ 0.48, behind batsman)
             ↑
          BATSMAN & STRIKER POPPING CREASE (0.23h, scale ≈ 0.58)
             ↑
           PITCH BOUNCE ZONE (0.48h)
             ↑
           PITCH WEAR STRIP & 22-YARD SURFACE
             ↑
     BOWLER POPPING CREASE (0.78h - front foot landing & crease check)
             ↑
     BOWLER ACTOR (0.78h - 0.80h, scale ≈ 1.08, delivering down-pitch)
             ↑
     BOWLER-END STUMPS (0.87h, scale ≈ 1.15, in foreground)
             ↑
   BOTTOM / NEAR / CAMERA
   ================================================================ */
export interface PitchStation {
  name: string;
  depth: number;
  x: number;
  y: number;
  halfWidth: number;
  scale: number;
}

export function computePitchStations(w: number, h: number) {
  // Far end of pitch (Striker End / Top of Screen)
  const pitchTopY = h * 0.12;
  const pitchTopLeftX = w * 0.38;
  const pitchTopRightX = w * 0.62;

  // Near end of pitch (Bowler End / Bottom of Screen / Camera)
  const pitchBottomY = h * 0.94;
  const pitchBottomLeftX = w * 0.16;
  const pitchBottomRightX = w * 0.84;

  // Depth parameter d from 0.0 (Far / Striker End) to 1.0 (Near / Bowler End)
  const project = (depth: number): PitchStation => {
    const t = clamp(depth, 0, 1);
    const y = lerp(pitchTopY, pitchBottomY, t);
    const leftX = lerp(pitchTopLeftX, pitchBottomLeftX, t);
    const rightX = lerp(pitchTopRightX, pitchBottomRightX, t);
    const x = (leftX + rightX) / 2;
    const halfWidth = (rightX - leftX) / 2;
    // Scale: smaller at far striker end (0.48), larger at near bowler end (1.15)
    const scale = lerp(0.48, 1.15, t);
    return { name: "", depth, x, y, halfWidth, scale };
  };

  return {
    pitchTopY,
    pitchBottomY,
    pitchTopLeftX,
    pitchTopRightX,
    pitchBottomLeftX,
    pitchBottomRightX,
    // Far Striker End Stations:
    strikerWicket: { ...project(0.06), name: "STRIKER_WICKET" }, // Far bowling crease (0.17h)
    strikerCrease: { ...project(0.14), name: "STRIKER_CREASE" }, // Far popping crease & batsman (0.23h)
    pitchBounce: { ...project(0.44), name: "PITCH_BOUNCE" },     // Pitch bounce landing zone (0.48h)
    // Near Bowler End Stations:
    bowlerCrease: { ...project(0.80), name: "BOWLER_CREASE" },   // Bowler popping crease line (0.78h)
    bowlerRelease: { ...project(0.82), name: "BOWLER_RELEASE" }, // Bowler delivery anchor (0.79h)
    bowlerWicket: { ...project(0.92), name: "BOWLER_WICKET" },   // Bowler stumps in foreground (0.87h)
    projectDepth: project,
  };
}

/* ================================================================
   1. LBW BROADCAST REPLAY RENDERER (BOWLER-END UMPIRE PERSPECTIVE)
   ================================================================ */
function renderLBWBroadcast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  scenario: Scenario
) {
  const ev = scenario.initialEvidence?.lbw;
  const lbw = scenario.lbw;

  // --- 1. Compute Pitch Geometry from Physical Model ---
  const pitch = computePitchStations(w, h);

  // --- 2. Determine Batter Handedness & Delivery Angle ---
  const isLeftHand = (lbw?.batterHand ?? "RIGHT") === "LEFT";
  const deliveryLine = ev?.deliveryLine || "OVER_WICKET";
  const isNoBall = lbw?.isNoBall ?? false;
  const overstepMm = lbw?.frontFootOverstepMm ?? 0;

  // --- 3. Outfield Grass Background ---
  const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
  gradGrass.addColorStop(0, "#122a1b");
  gradGrass.addColorStop(0.6, "#183925");
  gradGrass.addColorStop(1, "#0e2015");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, w, h);

  // Stadium lighting ground ambience
  const gradLight = ctx.createRadialGradient(w * 0.50, h * 0.45, 20, w * 0.50, h * 0.45, w * 0.6);
  gradLight.addColorStop(0, "rgba(255, 255, 220, 0.06)");
  gradLight.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradLight;
  ctx.fillRect(0, 0, w, h);

  // --- 4. 22-Yard Pitch Surface Trapezoid (Receding from Bowler to Striker) ---
  ctx.save();
  ctx.fillStyle = "#bda384";
  ctx.beginPath();
  ctx.moveTo(pitch.pitchTopLeftX, pitch.pitchTopY);
  ctx.lineTo(pitch.pitchTopRightX, pitch.pitchTopY);
  ctx.lineTo(pitch.pitchBottomRightX, pitch.pitchBottomY);
  ctx.lineTo(pitch.pitchBottomLeftX, pitch.pitchBottomY);
  ctx.closePath();
  ctx.fill();

  // Pitch Wear Track down the 22-yard corridor
  ctx.fillStyle = "#cca885";
  ctx.beginPath();
  ctx.moveTo(pitch.strikerWicket.x - pitch.strikerWicket.halfWidth * 0.6, pitch.pitchTopY);
  ctx.lineTo(pitch.strikerWicket.x + pitch.strikerWicket.halfWidth * 0.6, pitch.pitchTopY);
  ctx.lineTo(pitch.bowlerWicket.x + pitch.bowlerWicket.halfWidth * 0.6, pitch.pitchBottomY);
  ctx.lineTo(pitch.bowlerWicket.x - pitch.bowlerWicket.halfWidth * 0.6, pitch.pitchBottomY);
  ctx.closePath();
  ctx.fill();

  // --- 5. Far Striker-End Creases & Stumps (Far / Top) ---
  // A. Striker's Bowling Crease (Behind Batsman)
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(pitch.strikerWicket.x - pitch.strikerWicket.halfWidth * 0.70, pitch.strikerWicket.y);
  ctx.lineTo(pitch.strikerWicket.x + pitch.strikerWicket.halfWidth * 0.70, pitch.strikerWicket.y);
  ctx.stroke();

  // B. Striker-End Stumps (Rendered BEHIND Batsman at far bowling crease)
  drawStumpsAndBails(ctx, pitch.strikerWicket.x, pitch.strikerWicket.y, {
    scale: pitch.strikerWicket.scale,
  });

  // C. Striker's Popping Crease (where Batsman stands)
  ctx.strokeStyle = "rgba(255,255,255,0.80)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(pitch.strikerCrease.x - pitch.strikerCrease.halfWidth * 0.90, pitch.strikerCrease.y);
  ctx.lineTo(pitch.strikerCrease.x + pitch.strikerCrease.halfWidth * 0.90, pitch.strikerCrease.y);
  ctx.stroke();

  // --- 6. Far Batsman Actor (Facing Bowler / Camera) ---
  const shotType = ev?.shotOfferedType || (lbw?.shotOffered ? "DEFENSIVE_FORWARD" : "PADDED_AWAY_NO_SHOT");
  const isNoShot = shotType === "PADDED_AWAY_NO_SHOT" || shotType === "LEAVE_WITHDRAWN";

  // Batter stance facing: Right-hander faces off-side (screen-left from bowler's view), Left-hander faces screen-right
  const batterFacing = isLeftHand ? "RIGHT" : "LEFT";
  const guardOffsetX = isLeftHand ? -2 : 2;
  const stanceShiftX = (ev?.batterStanceShiftX || 0) * 0.18;
  const batterAnchorX = pitch.strikerCrease.x + guardOffsetX + stanceShiftX;
  const batterAnchorY = pitch.strikerCrease.y;

  const batterK = solveLBWBatterKinematics(
    p,
    isNoShot,
    shotType,
    ev?.batPadSeparationMm
  );
  drawArticulatedBatter(
    ctx,
    { x: batterAnchorX, y: batterAnchorY, scale: pitch.strikerCrease.scale, facing: batterFacing },
    batterK
  );

  // --- 7. Ball Pitch Bounce Target & Scuff Mark ---
  let pitchBounceX = pitch.pitchBounce.x;
  if (ev) {
    if (ev.apparentPitchLine === "OUTSIDE_LEG") pitchBounceX = pitch.pitchBounce.x + (isLeftHand ? -18 : 18);
    else if (ev.apparentPitchLine === "OUTSIDE_OFF") pitchBounceX = pitch.pitchBounce.x + (isLeftHand ? 18 : -18);
    else pitchBounceX = pitch.pitchBounce.x + (lbw ? lbw.pitchX * 14 : 0);
  } else if (lbw) {
    pitchBounceX = pitch.pitchBounce.x + lbw.pitchX * 16;
  }

  if (p >= 0.48) {
    ctx.fillStyle = "rgba(80,58,40,0.55)";
    ctx.beginPath();
    ctx.ellipse(pitchBounceX, pitch.pitchBounce.y, 4.5, 2.0, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- 8. Near Bowler-End Creases & Stumps (Near / Foreground) ---
  // A. Bowler's Popping Crease (Crucial line for No-Ball Crease Check)
  ctx.strokeStyle = "rgba(255,255,255,0.90)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pitch.bowlerCrease.x - pitch.bowlerCrease.halfWidth * 0.95, pitch.bowlerCrease.y);
  ctx.lineTo(pitch.bowlerCrease.x + pitch.bowlerCrease.halfWidth * 0.95, pitch.bowlerCrease.y);
  ctx.stroke();

  // B. Bowler's Bowling Crease
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pitch.bowlerWicket.x - pitch.bowlerWicket.halfWidth * 0.85, pitch.bowlerWicket.y);
  ctx.lineTo(pitch.bowlerWicket.x + pitch.bowlerWicket.halfWidth * 0.85, pitch.bowlerWicket.y);
  ctx.stroke();

  // C. Bowler-End Stumps (Rendered in Foreground near camera)
  drawStumpsAndBails(ctx, pitch.bowlerWicket.x, pitch.bowlerWicket.y, {
    scale: pitch.bowlerWicket.scale,
  });

  // --- 9. Bowler Actor (Delivering at Popping Crease with Legal / No-Ball Foot Placement) ---
  let bowlerApproachOffsetX = -16; // Standard right-arm over the wicket (releases from left of bowler stumps)
  if (deliveryLine === "ROUND_WICKET") bowlerApproachOffsetX = +18;
  else if (deliveryLine === "WIDE_OF_CREASE") bowlerApproachOffsetX = -28;

  const bowlerX = pitch.bowlerCrease.x + bowlerApproachOffsetX;
  const bowlerY = pitch.bowlerCrease.y;
  const bowlerK = solveLBWBowlerKinematics(p, {
    isNoBall,
    frontFootOverstepMm: overstepMm,
    deliveryLine,
  });
  drawArticulatedBowler(
    ctx,
    { x: bowlerX, y: bowlerY, scale: 1.08, facing: "RIGHT" },
    bowlerK
  );

  // --- 10. Ball Flight & Trajectory (Receding from Bowler to Batsman) ---
  let padImpactX = pitch.strikerCrease.x;
  if (ev) {
    if (ev.apparentImpactLine === "OUTSIDE_OFF") padImpactX = pitch.strikerCrease.x + (isLeftHand ? 14 : -14);
    else if (ev.apparentImpactLine === "OUTSIDE_LEG") padImpactX = pitch.strikerCrease.x + (isLeftHand ? -14 : 14);
    else padImpactX = pitch.strikerCrease.x + (lbw ? lbw.impactX * 10 : 0);
  } else if (lbw) {
    padImpactX = pitch.strikerCrease.x + lbw.impactX * 12;
  }

  let impactY = pitch.strikerCrease.y - 6;
  if (ev?.apparentHeight === "LOW_SHIN") impactY = pitch.strikerCrease.y - 2;
  else if (ev?.apparentHeight === "HIGH_THIGH") impactY = pitch.strikerCrease.y - 12;

  let ballX = bowlerX;
  let ballY = bowlerY;
  let ballRadius = 6.0;
  let prevBallX = ballX;
  let prevBallY = ballY;

  if (p < 0.20) {
    // Bowler windmill arm release in foreground
    const rad = bowlerK.bowlingArmAngleRad;
    ballX = bowlerX + 3 + Math.cos(rad) * 18;
    ballY = bowlerY - 32 + Math.sin(rad) * 18;
    ballRadius = 6.0;
  } else if (p >= 0.20 && p < 0.48) {
    // Delivery flight: recedes down-pitch from bowler's hand to pitch bounce
    const t = (p - 0.20) / 0.28;
    const releaseX = bowlerX + 3;
    const releaseY = bowlerY - 32;
    ballX = releaseX + (pitchBounceX - releaseX) * t;
    ballY = releaseY + (pitch.pitchBounce.y - releaseY) * (t * t);
    ballRadius = 6.0 - t * 1.8; // 6.0px -> 4.2px (receding into distance)
    prevBallX = ballX - (pitchBounceX - releaseX) * 0.05;
    prevBallY = ballY + 4;
  } else if (p >= 0.48 && p < 0.68) {
    // Rise from bounce to batsman pad at far end
    const t = (p - 0.48) / 0.20;
    ballX = pitchBounceX + (padImpactX - pitchBounceX) * t;
    ballY = pitch.pitchBounce.y + (impactY - pitch.pitchBounce.y) * t;
    ballRadius = 4.2 - t * 1.2; // 4.2px -> 3.0px
    prevBallX = ballX - (padImpactX - pitchBounceX) * 0.05;
    prevBallY = ballY + 2;
  } else {
    // Post-impact deflection or continuation past pad towards far stumps
    const t = (p - 0.68) / 0.32;
    ballX = padImpactX + (lbw?.impactX ? lbw.impactX * 8 * t : (isLeftHand ? 3 : -3) * t);
    ballY = impactY - t * 10;
    ballRadius = 3.0;
    prevBallX = ballX - 1;
    prevBallY = ballY + 1;
  }

  drawCricketBall(ctx, ballX, ballY, {
    radius: ballRadius,
    seamAngleRad: p * Math.PI * 6,
    shadowY: Math.min(pitch.bowlerWicket.y + 4, ballY + ballRadius * 1.1),
    motionTrail: p >= 0.20 && p < 0.68,
    prevX: prevBallX,
    prevY: prevBallY,
  });

  ctx.restore();
}

/* ================================================================
   2. RUN OUT BROADCAST REPLAY RENDERER (SQUARE LEG BROADCAST)
   ================================================================ */
function renderRunOutBroadcast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  scenario: Scenario,
  canonicalTimeMs: number
) {
  const ro = scenario.runOut;
  const state = ro ? solveRunOutReplayState(ro, canonicalTimeMs) : null;

  // --- 1. Outfield Grass with Mowing Bands & Ambience ---
  const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
  gradGrass.addColorStop(0, "#132b1c");
  gradGrass.addColorStop(0.5, "#183824");
  gradGrass.addColorStop(1, "#0d1e13");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, w, h);

  // Stadium lighting ambient glow
  const gradLight = ctx.createRadialGradient(w * 0.45, h * 0.50, 30, w * 0.45, h * 0.50, w * 0.65);
  gradLight.addColorStop(0, "rgba(255, 255, 230, 0.07)");
  gradLight.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradLight;
  ctx.fillRect(0, 0, w, h);

  // --- 2. 22-Yard Pitch Strip (Side-On Perspective) ---
  const pitchTopY = h * 0.50;
  const pitchHeight = h * 0.50;

  // Pitch base
  const gradPitch = ctx.createLinearGradient(0, pitchTopY, 0, h);
  gradPitch.addColorStop(0, "#b89a74");
  gradPitch.addColorStop(0.4, "#a88a64");
  gradPitch.addColorStop(1, "#8e724e");
  ctx.fillStyle = gradPitch;
  ctx.fillRect(0, pitchTopY, w, pitchHeight);

  // Pitch top edge bevel / grass fringe
  ctx.strokeStyle = "#4d3d29";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, pitchTopY);
  ctx.lineTo(w, pitchTopY);
  ctx.stroke();

  // Pitch worn turf corridor
  ctx.fillStyle = "rgba(140, 110, 75, 0.25)";
  ctx.fillRect(0, pitchTopY + 12, w, pitchHeight - 24);

  // --- 3. Painted White Crease Markings ---
  const creaseX = w * 0.42;
  const stumpsX = w * 0.24;
  const stumpsBaseY = pitchTopY + 8;

  // A. Bowling Crease Line (passes through stumps)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(stumpsX, pitchTopY);
  ctx.lineTo(stumpsX, h);
  ctx.stroke();

  // B. Popping Crease White Line (where runner must ground bat/body)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(creaseX - 2.5, pitchTopY, 5, pitchHeight);

  // Popping crease painted text
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "bold 8px monospace";
  ctx.fillText("POPPING CREASE", creaseX + 6, pitchTopY + 18);
  ctx.restore();

  // --- 4. Striker Stumps & Zing Bails (Driven by canonical state.stumps) ---
  const bailsBroke = state ? state.stumps.bailsSeparating : p >= 0.62;
  const dislodgeProgress = state
    ? clamp((canonicalTimeMs - state.timeline.bailsDislodgedMs) / 300, 0, 1)
    : (bailsBroke ? (p - 0.62) / 0.38 : 0.0);

  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, {
    scale: 1.12,
    bailsDislodged: bailsBroke,
    dislodgeProgress,
    isZing: true,
  });

  // --- 5. Wicketkeeper at Stumps Gathering the Throw ---
  const keeperK = solveCaughtBehindKeeperKinematics(p * 0.6, false);
  drawArticulatedWicketkeeper(
    ctx,
    { x: stumpsX - 26, y: stumpsBaseY + 6, scale: 1.05, facing: "RIGHT" },
    keeperK
  );

  // --- 6. Incoming Throw Trajectory from Deep (Driven by canonical state.ball) ---
  const ballInFlight = state ? state.ball.isInFlight : p < 0.62;
  if (ballInFlight) {
    const tThrow = state ? state.ball.throwProgress : p / 0.62;
    const originX = w * 0.98;
    const originY = h * 0.18;
    const targetX = stumpsX + 4;
    const targetY = stumpsBaseY - 16;

    // Parabolic arc for throw
    const throwX = originX + (targetX - originX) * tThrow;
    const arcHeight = Math.sin(tThrow * Math.PI) * 22;
    const throwY = originY + (targetY - originY) * tThrow - arcHeight;

    const prevT = Math.max(0, tThrow - 0.04);
    const prevArc = Math.sin(prevT * Math.PI) * 22;
    const prevThrowX = originX + (targetX - originX) * prevT;
    const prevThrowY = originY + (targetY - originY) * prevT - prevArc;

    drawCricketBall(ctx, throwX, throwY, {
      radius: 4.8,
      seamAngleRad: p * Math.PI * 10,
      shadowY: Math.min(pitchTopY + 40, throwY + 24),
      motionTrail: tThrow > 0.05,
      prevX: prevThrowX,
      prevY: prevThrowY,
    });
  }

  // --- 7. Single Coherent Athlete Runner Kinematics & Sliding Reach (Driven by canonical state.runner) ---
  let runnerX: number;
  let runnerK = state?.runner.kinematics;

  if (state && runnerK) {
    const marginPx = Math.round(state.bat.marginFromCreaseMm * 0.45);
    const reachOffset = runnerK.diveProgress > 0 ? 65 : 35;
    runnerX = creaseX - marginPx + reachOffset;
  } else {
    const ev = scenario.initialEvidence?.runOut;
    const marginPx = ev?.visualMarginPixels ?? (ro ? Math.round(ro.creaseMarginMm * 0.45) : 0);
    const fallbackResult = solveRunOutRunnerKinematics(p, creaseX, marginPx, ev?.runnerDiveTechnique);
    runnerX = fallbackResult.runnerX;
    runnerK = fallbackResult.runnerK;
  }

  // Sliding turf dust spray during high-speed ground reach
  if (state ? (state.phase === "GROUNDED_SLIDE" || state.phase === "POST_INCIDENT") : (p >= 0.56 && p < 0.88)) {
    const dustT = state ? clamp((canonicalTimeMs - state.timeline.batReachStartMs) / 600, 0, 1) : (p - 0.56) / 0.32;
    ctx.save();
    ctx.fillStyle = "rgba(180, 150, 110, 0.35)";
    for (let i = 0; i < 4; i++) {
      const offsetX = runnerX + (i * 12) - dustT * 20;
      const offsetY = stumpsBaseY + 12 + Math.sin(i * 1.5) * 3;
      ctx.beginPath();
      ctx.ellipse(offsetX, offsetY, 8 * (1 - dustT * 0.5), 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawArticulatedRunner(
    ctx,
    { x: runnerX, y: stumpsBaseY + 12, scale: 1.12, facing: "LEFT" },
    runnerK
  );
}

/* ================================================================
   3. STUMPING BROADCAST REPLAY RENDERER (SIDE-ON STUMPING CAM)
   ================================================================ */
function renderStumpingBroadcast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  scenario: Scenario,
  canonicalTimeMs: number
) {
  const ro = scenario.runOut;
  const state = ro ? solveRunOutReplayState(ro, canonicalTimeMs) : null;

  // --- 1. Outfield Grass ---
  const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
  gradGrass.addColorStop(0, "#132b1c");
  gradGrass.addColorStop(0.5, "#183824");
  gradGrass.addColorStop(1, "#0d1e13");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, w, h);

  // --- 2. 22-Yard Pitch Strip ---
  const pitchTopY = h * 0.52;
  const pitchHeight = h * 0.48;

  const gradPitch = ctx.createLinearGradient(0, pitchTopY, 0, h);
  gradPitch.addColorStop(0, "#ba9c77");
  gradPitch.addColorStop(0.5, "#a68862");
  gradPitch.addColorStop(1, "#8a6d49");
  ctx.fillStyle = gradPitch;
  ctx.fillRect(0, pitchTopY, w, pitchHeight);

  ctx.strokeStyle = "#4d3d29";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, pitchTopY);
  ctx.lineTo(w, pitchTopY);
  ctx.stroke();

  // --- 3. Painted White Creases ---
  const creaseX = w * 0.46;
  const stumpsX = w * 0.28;
  const stumpsBaseY = pitchTopY + 6;

  // Bowling crease line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(stumpsX, pitchTopY);
  ctx.lineTo(stumpsX, h);
  ctx.stroke();

  // Popping crease line
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(creaseX - 2.5, pitchTopY, 5, pitchHeight);

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "bold 8px monospace";
  ctx.fillText("POPPING CREASE", creaseX + 6, pitchTopY + 18);
  ctx.restore();

  // --- 4. Striker Stumps & Zing Bails (Driven by canonical state.stumps) ---
  const bailsBroke = state ? state.stumps.bailsSeparating : p >= 0.65;
  const dislodgeProgress = state
    ? clamp((canonicalTimeMs - state.timeline.bailsDislodgedMs) / 300, 0, 1)
    : (bailsBroke ? (p - 0.65) / 0.35 : 0.0);

  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, {
    scale: 1.15,
    bailsDislodged: bailsBroke,
    dislodgeProgress,
    isZing: true,
  });

  // --- 5. Wicketkeeper Rapid Stumping Whip ---
  const keeperK = solveStumpingKeeperKinematics(p);
  drawArticulatedWicketkeeper(
    ctx,
    { x: stumpsX - 22, y: stumpsBaseY + 4, scale: 1.15, facing: "RIGHT" },
    keeperK
  );

  // --- 6. Batter Advance & Back-Foot Drag ---
  const marginPx = state ? Math.round(state.bat.marginFromCreaseMm * 0.45) : (ro ? Math.round(ro.creaseMarginMm * 0.45) : 0);
  const stumpingResult = solveStumpingBatterKinematics(p, creaseX, marginPx);

  drawArticulatedBatter(
    ctx,
    { x: stumpingResult.batterX, y: stumpsBaseY + 8, scale: 1.15, facing: "LEFT" },
    stumpingResult.batterK
  );

  // --- 7. Ball Flight Past Bat to Wicketkeeper ---
  const ballInFlight = state ? state.ball.isInFlight : p < 0.52;
  if (ballInFlight) {
    const t = state ? state.ball.throwProgress : p / 0.52;
    const originX = w * 0.88;
    const originY = h * 0.32;
    const targetX = stumpsX + 16;
    const targetY = stumpsBaseY - 20;

    const bX = originX + (targetX - originX) * t;
    const bY = originY + (targetY - originY) * t;
    const prevBX = originX + (targetX - originX) * Math.max(0, t - 0.05);
    const prevBY = originY + (targetY - originY) * Math.max(0, t - 0.05);

    drawCricketBall(ctx, bX, bY, {
      radius: 5.0,
      seamAngleRad: p * Math.PI * 6,
      motionTrail: t > 0.15,
      prevX: prevBX,
      prevY: prevBY,
    });
  }
}

/* ================================================================
   4. CAUGHT BEHIND BROADCAST REPLAY RENDERER
   ================================================================ */
function renderCaughtBehindBroadcast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  scenario: Scenario
) {
  const ev = scenario.initialEvidence?.caughtBehind;
  const cb = scenario.caughtBehind;

  ctx.fillStyle = "#142d1e";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ad9275";
  ctx.fillRect(0, h * 0.58, w, h * 0.42);

  const stumpsX = w * 0.46;
  const stumpsBaseY = h * 0.60;
  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, { scale: 1.25 });

  const batterX = w * 0.60;
  const batterY = h * 0.66;
  const batterK = solveCaughtBehindBatterKinematics(
    p,
    ev?.shotType,
    ev?.batAngleDeg ?? 14
  );

  drawArticulatedBatter(
    ctx,
    { x: batterX, y: batterY, scale: 1.25, facing: "LEFT" },
    batterK
  );

  const keeperX = w * 0.26;
  const keeperY = h * 0.64;
  const hasEdge = cb?.hasEdge ?? false;
  const keeperK = solveCaughtBehindKeeperKinematics(p, hasEdge);

  drawArticulatedWicketkeeper(
    ctx,
    { x: keeperX, y: keeperY, scale: 1.22, facing: "RIGHT" },
    keeperK
  );

  const batEdgeX = batterX - 28;
  const batEdgeY = batterY - 34;
  const deflectionAngle = ev?.apparentDeflectionAngleDeg ?? (hasEdge ? 2.6 : 0);
  const gapPx = ev?.apparentGapPixels ?? (hasEdge ? 0 : 18);

  let ballX = w * 0.96;
  let ballY = h * 0.32;
  let prevBallX = ballX;
  let prevBallY = ballY;

  if (p < 0.50) {
    const t = p / 0.50;
    ballX = w * 0.96 + (batEdgeX + gapPx - w * 0.96) * t;
    ballY = h * 0.32 + (batEdgeY - h * 0.32) * t;
    prevBallX = ballX + 16;
    prevBallY = ballY - 4;
  } else {
    const t = (p - 0.50) / 0.50;
    const targetX = keeperX + 24;
    const targetY = deflectionAngle > 0 ? keeperY - 22 : keeperY - 26;
    ballX = batEdgeX + gapPx + (targetX - (batEdgeX + gapPx)) * t;
    ballY = batEdgeY + (targetY - batEdgeY) * t;
    prevBallX = ballX + 12;
    prevBallY = ballY - 2;
  }

  drawCricketBall(ctx, ballX, ballY, {
    radius: 5.5,
    seamAngleRad: p * Math.PI * 6,
    shadowY: h * 0.65,
    motionTrail: p >= 0.20 && p < 0.70,
    prevX: prevBallX,
    prevY: prevBallY,
  });
}

/* ================================================================
   5. BOUNDARY BROADCAST REPLAY RENDERER
   ================================================================ */
function renderBoundaryBroadcast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  scenario: Scenario
) {
  const b = scenario.boundary;
  const isBoundary = b?.isBoundary ?? false;

  ctx.fillStyle = "#183b25";
  ctx.fillRect(0, 0, w, h * 0.62);
  ctx.fillStyle = "#0c1810";
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.lineTo(w, h * 0.62);
  ctx.stroke();

  const cushionX = w * 0.50;
  const cushionY = h * 0.62;
  ctx.fillStyle = "#ea580c";
  ctx.strokeStyle = "#9a3412";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cushionX - 120, cushionY);
  ctx.lineTo(cushionX + 120, cushionY);
  ctx.lineTo(cushionX + 140, cushionY + 28);
  ctx.lineTo(cushionX - 140, cushionY + 28);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("BOUNDARY CUSHION", cushionX, cushionY + 18);

  const boundaryResult = solveBoundaryFielderKinematics(
    p,
    isBoundary,
    cushionX - 20
  );

  drawArticulatedFielder(
    ctx,
    { x: boundaryResult.fielderX, y: h * 0.58, scale: 1.1, facing: "LEFT" },
    boundaryResult.fielderK
  );

  drawCricketBall(ctx, boundaryResult.ballX, boundaryResult.ballY, {
    radius: 4.8,
    seamAngleRad: p * Math.PI * 6,
  });
}
