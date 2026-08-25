import React, { useEffect, useRef, useState } from "react";
import type { Scenario } from "../../types/scenario";
import { Camera } from "lucide-react";
import {
  mapPhase1TimeToReplayTime,
  solveRunOutReplayState,
} from "../../engine/runOutPhysics";
import { projectToPhase1 } from "../../engine/cameraProjections";
import { solveCaughtBehindBallState } from "../../engine/caughtBehindPhysics";
import {
  lerp,
  clamp,
  smoothstep,
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
      const forcedProgress = (window as any).__PHASE1_PROGRESS__;
      const elapsed = typeof forcedProgress === "number" 
        ? forcedProgress * CLIP_DURATION_MS 
        : (now - startTime) % CLIP_DURATION_MS;
      const progress = typeof forcedProgress === "number" ? forcedProgress : elapsed / CLIP_DURATION_MS; // 0.0 to 1.0

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

export function computePitchStations(w: number, h: number, p = 0) {
  // Smooth camera dolly & tracking zoom towards striker
  const zoomT = smoothstep(0.16, 0.62, p);
  const zoom = lerp(1.0, 2.25, zoomT);

  // Wide shot (p = 0): balanced framing showing 22-yard pitch and bowler
  // Zoom shot (p >= 0.62): camera dollies down-pitch, centering on striker and crease
  const basePitchTopY = h * 0.18;
  const basePitchBottomY = h * 0.92;
  const targetPitchTopY = h * 0.22;
  const targetPitchBottomY = h * 1.60;

  const pitchTopY = lerp(basePitchTopY, targetPitchTopY, zoomT);
  const pitchBottomY = lerp(basePitchBottomY, targetPitchBottomY, zoomT);

  const baseTopWidth = w * 0.26;
  const baseBottomWidth = w * 0.70;
  const targetTopWidth = w * 0.54;
  const targetBottomWidth = w * 1.45;

  const topWidth = lerp(baseTopWidth, targetTopWidth, zoomT);
  const bottomWidth = lerp(baseBottomWidth, targetBottomWidth, zoomT);

  const pitchTopLeftX = w * 0.50 - topWidth / 2;
  const pitchTopRightX = w * 0.50 + topWidth / 2;
  const pitchBottomLeftX = w * 0.50 - bottomWidth / 2;
  const pitchBottomRightX = w * 0.50 + bottomWidth / 2;

  // Depth parameter d from 0.0 (Far / Striker End) to 1.0 (Near / Bowler End)
  const project = (depth: number): PitchStation => {
    const t = clamp(depth, 0, 1);
    const y = lerp(pitchTopY, pitchBottomY, t);
    const leftX = lerp(pitchTopLeftX, pitchBottomLeftX, t);
    const rightX = lerp(pitchTopRightX, pitchBottomRightX, t);
    const x = (leftX + rightX) / 2;
    const halfWidth = (rightX - leftX) / 2;
    // Perspective scale: far end base scale (0.52) to near end (1.12), magnified by camera zoom
    const baseScale = lerp(0.52, 1.12, t);
    const scale = baseScale * zoom;
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
    strikerWicket: { ...project(0.06), name: "STRIKER_WICKET" }, // Far bowling crease (behind batter)
    strikerCrease: { ...project(0.14), name: "STRIKER_CREASE" }, // Far popping crease & batsman
    pitchBounce: { ...project(0.46), name: "PITCH_BOUNCE" },     // Pitch bounce landing zone
    // Near Bowler End Stations:
    bowlerCrease: { ...project(0.78), name: "BOWLER_CREASE" },   // Bowler popping crease line
    bowlerRelease: { ...project(0.80), name: "BOWLER_RELEASE" }, // Bowler delivery anchor
    bowlerWicket: { ...project(0.90), name: "BOWLER_WICKET" },   // Bowler stumps in foreground
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

  // --- 1. Compute Dynamic Pitch Geometry with Tracking Zoom ---
  const pitch = computePitchStations(w, h, p);

  // --- 2. Determine Batter Handedness & Delivery Angle ---
  const isLeftHand = (lbw?.batterHand ?? "RIGHT") === "LEFT";
  const deliveryLine = ev?.deliveryLine || "OVER_WICKET";
  const isNoBall = lbw?.isNoBall ?? false;
  const overstepMm = lbw?.frontFootOverstepMm ?? 0;

  // --- 3. Outfield Grass Background ---
  const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
  gradGrass.addColorStop(0, "#122a1b");
  gradGrass.addColorStop(0.5, "#183925");
  gradGrass.addColorStop(1, "#0e2015");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, w, h);

  // Stadium lighting ground ambience
  const gradLight = ctx.createRadialGradient(w * 0.50, h * 0.45, 20, w * 0.50, h * 0.45, w * 0.6);
  gradLight.addColorStop(0, "rgba(255, 255, 220, 0.08)");
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
  ctx.moveTo(pitch.strikerWicket.x - pitch.strikerWicket.halfWidth * 0.65, pitch.pitchTopY);
  ctx.lineTo(pitch.strikerWicket.x + pitch.strikerWicket.halfWidth * 0.65, pitch.pitchTopY);
  ctx.lineTo(pitch.bowlerWicket.x + pitch.bowlerWicket.halfWidth * 0.65, pitch.pitchBottomY);
  ctx.lineTo(pitch.bowlerWicket.x - pitch.bowlerWicket.halfWidth * 0.65, pitch.pitchBottomY);
  ctx.closePath();
  ctx.fill();

  // --- 5. Far Striker-End Creases & Stumps (Behind Batsman) ---
  // A. Striker's Bowling Crease (Behind Batsman)
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pitch.strikerWicket.x - pitch.strikerWicket.halfWidth * 0.75, pitch.strikerWicket.y);
  ctx.lineTo(pitch.strikerWicket.x + pitch.strikerWicket.halfWidth * 0.75, pitch.strikerWicket.y);
  ctx.stroke();

  // B. Striker-End Stumps (Rendered at true 71.1cm relative scale behind batter)
  drawStumpsAndBails(ctx, pitch.strikerWicket.x, pitch.strikerWicket.y, {
    scale: pitch.strikerWicket.scale * 0.60,
  });

  // C. Striker's Popping Crease (where Batsman stands)
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pitch.strikerCrease.x - pitch.strikerCrease.halfWidth * 0.92, pitch.strikerCrease.y);
  ctx.lineTo(pitch.strikerCrease.x + pitch.strikerCrease.halfWidth * 0.92, pitch.strikerCrease.y);
  ctx.stroke();

  // --- 6. Far Batsman Actor (Hero of the Scene — ~2.7x Stump Height) ---
  const shotType = ev?.shotOfferedType || (lbw?.shotOffered ? "DEFENSIVE_FORWARD" : "PADDED_AWAY_NO_SHOT");
  const isNoShot = shotType === "PADDED_AWAY_NO_SHOT" || shotType === "LEAVE_WITHDRAWN";

  // Batter stance facing: Right-hander faces off-side, Left-hander faces leg-side
  const batterFacing = isLeftHand ? "RIGHT" : "LEFT";
  const guardOffsetX = isLeftHand ? -2 : 2;
  const stanceShiftX = (ev?.batterStanceShiftX || 0) * 0.22;
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
    { x: batterAnchorX, y: batterAnchorY, scale: pitch.strikerCrease.scale * 1.28, facing: batterFacing },
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

  if (p >= 0.46) {
    ctx.fillStyle = "rgba(80,58,40,0.65)";
    ctx.beginPath();
    ctx.ellipse(pitchBounceX, pitch.pitchBounce.y, 6.0, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(220,195,160,0.4)";
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // --- 8. Near Bowler-End Creases & Stumps (Visible in wide framing) ---
  if (p < 0.40) {
    const bowlerEndAlpha = clamp(1 - (p - 0.18) / 0.22, 0, 1);
    ctx.save();
    ctx.globalAlpha = bowlerEndAlpha;

    // A. Bowler's Popping Crease
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

    // C. Bowler-End Stumps in Foreground
    drawStumpsAndBails(ctx, pitch.bowlerWicket.x, pitch.bowlerWicket.y, {
      scale: pitch.bowlerWicket.scale * 0.65,
    });

    // D. Bowler Actor (Delivering at Popping Crease)
    let bowlerApproachOffsetX = -16;
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
      { x: bowlerX, y: bowlerY, scale: pitch.bowlerCrease.scale * 0.95, facing: "RIGHT" },
      bowlerK
    );

    ctx.restore();
  }

  // --- 9. Ball Flight & Trajectory (Receding to Striker, Magnified at Impact) ---
  let padImpactX = pitch.strikerCrease.x;
  if (ev) {
    if (ev.apparentImpactLine === "OUTSIDE_OFF") padImpactX = pitch.strikerCrease.x + (isLeftHand ? 14 : -14);
    else if (ev.apparentImpactLine === "OUTSIDE_LEG") padImpactX = pitch.strikerCrease.x + (isLeftHand ? -14 : 14);
    else padImpactX = pitch.strikerCrease.x + (lbw ? lbw.impactX * 10 : 0);
  } else if (lbw) {
    padImpactX = pitch.strikerCrease.x + lbw.impactX * 12;
  }

  // Pad impact point anchored to batter leg
  const batterScale = pitch.strikerCrease.scale * 1.28;
  let impactY = batterAnchorY - 14 * batterScale;
  if (ev?.apparentHeight === "LOW_SHIN") impactY = batterAnchorY - 6 * batterScale;
  else if (ev?.apparentHeight === "HIGH_THIGH") impactY = batterAnchorY - 24 * batterScale;

  let bowlerApproachOffsetX = -16;
  if (deliveryLine === "ROUND_WICKET") bowlerApproachOffsetX = +18;
  else if (deliveryLine === "WIDE_OF_CREASE") bowlerApproachOffsetX = -28;
  const bowlerReleaseAnchorX = pitch.bowlerCrease.x + bowlerApproachOffsetX;
  const bowlerReleaseAnchorY = pitch.bowlerCrease.y;

  let ballX = bowlerReleaseAnchorX;
  let ballY = bowlerReleaseAnchorY;
  let ballRadius = 5.2;
  let prevBallX = ballX;
  let prevBallY = ballY;

  if (p < 0.20) {
    // Bowler windmill arm release in foreground
    const bowlerK = solveLBWBowlerKinematics(p, { isNoBall, frontFootOverstepMm: overstepMm, deliveryLine });
    const rad = bowlerK.bowlingArmAngleRad;
    ballX = bowlerReleaseAnchorX + 3 + Math.cos(rad) * (18 * pitch.bowlerCrease.scale * 0.95);
    ballY = bowlerReleaseAnchorY - 32 * pitch.bowlerCrease.scale * 0.95 + Math.sin(rad) * (18 * pitch.bowlerCrease.scale * 0.95);
    ballRadius = 5.2;
    prevBallX = ballX;
    prevBallY = ballY;
  } else if (p >= 0.20 && p < 0.46) {
    // Delivery flight: travels down-pitch from release to pitch bounce
    const t = (p - 0.20) / 0.26;
    const releaseX = bowlerReleaseAnchorX + 3;
    const releaseY = bowlerReleaseAnchorY - 32 * pitch.bowlerCrease.scale * 0.95;
    ballX = releaseX + (pitchBounceX - releaseX) * t;
    ballY = releaseY + (pitch.pitchBounce.y - releaseY) * (t * t);
    ballRadius = lerp(5.2, 4.4, t);
    prevBallX = ballX - (pitchBounceX - releaseX) * 0.05;
    prevBallY = ballY + 4;
  } else if (p >= 0.46 && p < 0.68) {
    // Rise from bounce to batsman pad (magnified with camera tracking zoom)
    const t = (p - 0.46) / 0.22;
    ballX = pitchBounceX + (padImpactX - pitchBounceX) * t;
    ballY = pitch.pitchBounce.y + (impactY - pitch.pitchBounce.y) * t - Math.sin(t * Math.PI) * 6;
    ballRadius = lerp(4.4, 5.8, t);
    prevBallX = ballX - (padImpactX - pitchBounceX) * 0.05;
    prevBallY = ballY + 2;
  } else {
    // Post-impact deflection / dead ball drop near crease
    const t = (p - 0.68) / 0.32;
    ballX = padImpactX + (lbw?.impactX ? lbw.impactX * 10 * t : (isLeftHand ? 4 : -4) * t);
    ballY = impactY + t * 14;
    ballRadius = 5.8;
    prevBallX = ballX - 1;
    prevBallY = ballY - 1;
  }

  // Factual pad impact cue flash
  if (p >= 0.68 && p < 0.78) {
    const flashK = 1 - (p - 0.68) / 0.10;
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.85 * flashK})`;
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.arc(padImpactX, impactY, (8 + (1 - flashK) * 14) * (pitch.strikerCrease.scale * 0.7), 0, Math.PI * 2);
    ctx.stroke();
  }

  drawCricketBall(ctx, ballX, ballY, {
    radius: ballRadius,
    seamAngleRad: p * Math.PI * 6,
    shadowY: Math.min(pitch.strikerCrease.y + 4, ballY + ballRadius * 1.1),
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

  // --- 5. Wicketkeeper at Stumps (Driven by canonical state.keeper) ---
  if (state) {
    const keeperProj = projectToPhase1(state.keeper.worldX, state.keeper.worldY, state.keeper.worldZ, w, h);
    drawArticulatedWicketkeeper(
      ctx,
      { x: keeperProj.screenX, y: keeperProj.screenY, scale: 1.05, facing: "RIGHT" },
      state.keeper.kinematics
    );
  } else {
    const keeperK = solveCaughtBehindKeeperKinematics(p * 0.6, false);
    drawArticulatedWicketkeeper(
      ctx,
      { x: stumpsX - 26, y: stumpsBaseY + 6, scale: 1.05, facing: "RIGHT" },
      keeperK
    );
  }

  // --- 6. Incoming Throw Trajectory from Deep (Driven by canonical state.ball world coordinates) ---
  const ballInFlight = state ? state.ball.isInFlight : p < 0.62;
  if (ballInFlight && state) {
    const ballProj = projectToPhase1(state.ball.worldX, state.ball.worldY, state.ball.worldZ, w, h);

    // Previous frame for motion trail
    const prevState = ro ? solveRunOutReplayState(ro, canonicalTimeMs - 20) : null;
    const prevBallProj = prevState
      ? projectToPhase1(prevState.ball.worldX, prevState.ball.worldY, prevState.ball.worldZ, w, h)
      : { screenX: ballProj.screenX + 12, screenY: ballProj.screenY - 4, scale: 1 };

    drawCricketBall(ctx, ballProj.screenX, ballProj.screenY, {
      radius: 4.8,
      seamAngleRad: p * Math.PI * 10,
      shadowY: Math.min(pitchTopY + 40, ballProj.screenY + 24),
      motionTrail: state.ball.throwProgress > 0.05,
      prevX: prevBallProj.screenX,
      prevY: prevBallProj.screenY,
    });
  } else if (ballInFlight) {
    // Fallback when state is null
    const tThrow = p / 0.62;
    const originX = w * 0.98;
    const originY = h * 0.18;
    const targetX = stumpsX + 4;
    const targetY = stumpsBaseY - 16;
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

  // --- 7. Single Coherent Athlete Runner (Driven by canonical state.runner world coordinates) ---
  let runnerX: number;
  let runnerK = state?.runner.kinematics;

  if (state && runnerK) {
    // Project runner world-space position through Phase 1 camera
    const runnerProj = projectToPhase1(state.runner.worldX, state.runner.worldY, state.runner.worldZ, w, h);
    runnerX = runnerProj.screenX;
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
   4. CAUGHT BEHIND BROADCAST REPLAY RENDERER (SLIP CAM, DEPTH VIEW)
   Camera relationship: CAMERA → BATTER → STRIKER STUMPS → WICKETKEEPER.
   Every station is derived from the physical wicket (metres from the
   striker stumps plane, +X toward the bowler) and pushed through one
   perspective ground-plane projection — no free-floating screen fractions:
     striker stumps      0 m
     popping crease     +1.22 m (Laws of Cricket, in front of the stumps)
     batter guard       +1.06 m (feet just behind the crease line)
     wicketkeeper       −8.5 m (on the outfield behind the wicket)
     camera             +6.0 m (low bowler-side broadcast position)
   The ball corridor itself communicates the incident: clean miss =
   daylight past the edge; edge = deflection into the gloves.
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
  const hasEdge = cb?.hasEdge ?? false;

  // --- 0. World stations & perspective ground-plane projection ---
  const CAM_X = 6.0;
  const HORIZON_H = 0.16;
  const PERSP_K = 3.48;
  const EYE_D0 = 1.0;
  const WORLD_STUMPS_X = 0;
  const WORLD_POPPING_CREASE_X = 1.22;
  const WORLD_BATTER_GUARD_X = 1.06;
  const WORLD_KEEPER_X = -8.5;
  const WORLD_PITCH_FAR_END_X = -1.22;

  const camDist = (worldX: number) => CAM_X - worldX;
  const groundY = (worldX: number) =>
    h * (HORIZON_H + PERSP_K / (camDist(worldX) + EYE_D0));
  const depthFactor = (worldX: number) => PERSP_K / (camDist(worldX) + EYE_D0);
  const BATTER_RIG_SCALE = 1.3;
  const actorScale = (worldX: number) =>
    (BATTER_RIG_SCALE * depthFactor(worldX)) / depthFactor(WORLD_BATTER_GUARD_X);
  const CORRIDOR_CX = w * 0.5;
  const stripHalfW = (worldX: number) =>
    w * 0.27 * (depthFactor(worldX) / depthFactor(WORLD_BATTER_GUARD_X));

  // --- 1. Turf & perspective clay strip receding to the far bowling crease ---
  const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
  gradGrass.addColorStop(0, "#122a1b");
  gradGrass.addColorStop(0.6, "#183925");
  gradGrass.addColorStop(1, "#0e2015");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, w, h);

  const farEndY = groundY(WORLD_PITCH_FAR_END_X);
  const nearCutD = PERSP_K / (0.94 - HORIZON_H) - EYE_D0;
  const nearCutX = CAM_X - nearCutD;
  const nearCutY = groundY(nearCutX);

  const gradPitch = ctx.createLinearGradient(0, farEndY, 0, nearCutY);
  gradPitch.addColorStop(0, "#9a8161");
  gradPitch.addColorStop(0.5, "#b49b78");
  gradPitch.addColorStop(1, "#ad9275");
  ctx.fillStyle = gradPitch;
  ctx.beginPath();
  ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_PITCH_FAR_END_X), farEndY);
  ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_PITCH_FAR_END_X), farEndY);
  ctx.lineTo(CORRIDOR_CX + stripHalfW(nearCutX), nearCutY);
  ctx.lineTo(CORRIDOR_CX - stripHalfW(nearCutX), nearCutY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4d3d29";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // --- 2. Crease geometry (all three lines derived from the same stations) ---
  // Far bowling crease (end of the clay strip, behind the striker wicket)
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.0;
  ctx.beginPath();
  ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_PITCH_FAR_END_X) * 0.9, farEndY);
  ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_PITCH_FAR_END_X) * 0.9, farEndY);
  ctx.stroke();

  // Striker bowling crease (through the stumps plane)
  const stumpsY = groundY(WORLD_STUMPS_X);
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_STUMPS_X) * 0.9, stumpsY + 2);
  ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_STUMPS_X) * 0.9, stumpsY + 2);
  ctx.stroke();

  // Striker popping crease (the batter takes guard immediately behind this line)
  const creaseY = groundY(WORLD_POPPING_CREASE_X);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_POPPING_CREASE_X) * 0.95, creaseY);
  ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_POPPING_CREASE_X) * 0.95, creaseY);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "bold 8px monospace";
  ctx.fillText("POPPING CREASE", CORRIDOR_CX - stripHalfW(WORLD_POPPING_CREASE_X) * 0.9, creaseY - 5);

  // --- 3. Wicketkeeper (farthest actor: behind the striker wicket on the outfield) ---
  const keeperX = w * 0.485;
  const keeperY = groundY(WORLD_KEEPER_X);
  const keeperScale = actorScale(WORLD_KEEPER_X);
  const keeperK = solveCaughtBehindKeeperKinematics(p, hasEdge);
  drawArticulatedWicketkeeper(
    ctx,
    { x: keeperX, y: keeperY, scale: keeperScale, facing: "RIGHT" },
    keeperK
  );

  // --- 4. Striker stumps (between the batter and the keeper) ---
  drawStumpsAndBails(ctx, CORRIDOR_CX, stumpsY + 2, {
    scale: actorScale(WORLD_STUMPS_X),
  });

  // --- 5. Batter (nearest the camera; guard just behind the popping crease) ---
  const batterX = w * 0.52;
  const batterY = groundY(WORLD_BATTER_GUARD_X);
  const batterK = solveCaughtBehindBatterKinematics(
    p,
    ev?.shotType,
    ev?.batAngleDeg ?? 14
  );
  const batterFacing: "LEFT" | "RIGHT" = "LEFT";

  // --- 6. Ball corridor (delivery over the camera → bat plane → gloves / daylight) ---
  // The canonical corridor solver owns the motion. A clean miss is one
  // continuous arc that holds its line past the bat; only a genuine edge
  // deflects. See src/engine/caughtBehindPhysics.ts.
  const gapPx = ev?.apparentGapPixels ?? (hasEdge ? 0 : 18);
  const batEdgeX = batterX - 26 * BATTER_RIG_SCALE; // bat edge in front of the batter
  const batEdgeY = batterY - 30 * BATTER_RIG_SCALE;

  // Keeper glove target (local glove offsets scaled with the keeper rig)
  const gloveTargetX = keeperX + 14 * keeperScale;
  const gloveTargetY = keeperY - 18 * keeperScale;

  // The bowler releases over the camera: the delivery enters at the near frame
  // edge and recedes down the corridor to the bat plane.
  const ballState = solveCaughtBehindBallState(
    {
      entryX: w * 0.5,
      entryY: h * 0.965,
      batEdgeX,
      batEdgeY,
      gloveX: gloveTargetX,
      gloveY: gloveTargetY,
      gapPx,
      hasEdge,
      deflectionAngleDeg: ev?.apparentDeflectionAngleDeg ?? 0,
    },
    p
  );

  drawCricketBall(ctx, ballState.x, ballState.y, {
    radius: ballState.radius,
    seamAngleRad: p * Math.PI * 6,
    shadowY: ballState.y + 24,
    motionTrail: p >= 0.15 && p <= 0.85,
    prevX: ballState.prevX,
    prevY: ballState.prevY,
  });

  // --- 7. Batter drawn last (nearest the slip camera) ---
  drawArticulatedBatter(
    ctx,
    { x: batterX, y: batterY, scale: BATTER_RIG_SCALE, facing: batterFacing },
    batterK
  );
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
