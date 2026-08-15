import React, { useEffect, useRef, useState } from "react";
import type { Scenario } from "../../types/scenario";
import { Camera } from "lucide-react";
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

      // Clear frame
      ctx.clearRect(0, 0, width, height);

      // Render incident-specific broadcast replay using common actor rigs
      if (scenario.incidentType === "LBW") {
        renderLBWBroadcast(ctx, width, height, progress, scenario);
      } else if (scenario.incidentType === "RUN_OUT") {
        renderRunOutBroadcast(ctx, width, height, progress, scenario);
      } else if (scenario.incidentType === "STUMPING") {
        renderStumpingBroadcast(ctx, width, height, progress, scenario);
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
   1. LBW BROADCAST REPLAY RENDERER
   Strict geometric pitch reference frame:
   Centerline, bowling crease, popping crease, striker stumps,
   and ball corridor all share the exact geometric axis.
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

  // --- 1. Outfield Grass Background ---
  const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
  gradGrass.addColorStop(0, "#122a1b");
  gradGrass.addColorStop(0.6, "#183925");
  gradGrass.addColorStop(1, "#0e2015");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, w, h);

  // --- 2. Geometric Pitch Definition & Coordinate System ---
  const pitchTopY = h * 0.16;
  const pitchBottomY = h * 0.94;
  const pitchTopLeftX = w * 0.32;
  const pitchTopRightX = w * 0.58;
  const pitchBottomLeftX = w * 0.22;
  const pitchBottomRightX = w * 0.72;

  const pitchBowlingCenterX = (pitchTopLeftX + pitchTopRightX) / 2; // w * 0.45
  const pitchStrikerCenterX = (pitchBottomLeftX + pitchBottomRightX) / 2; // w * 0.47

  // Centerline X coordinate function along pitch Y
  const getPitchCenterX = (y: number): number => {
    const tY = clamp((y - pitchTopY) / (pitchBottomY - pitchTopY), 0, 1);
    return lerp(pitchBowlingCenterX, pitchStrikerCenterX, tY);
  };

  // Half-width function along pitch Y
  const getPitchHalfWidth = (y: number): number => {
    const tY = clamp((y - pitchTopY) / (pitchBottomY - pitchTopY), 0, 1);
    const leftX = lerp(pitchTopLeftX, pitchBottomLeftX, tY);
    const rightX = lerp(pitchTopRightX, pitchBottomRightX, tY);
    return (rightX - leftX) / 2;
  };

  // Render Pitch Surface
  ctx.save();
  ctx.fillStyle = "#bda384";
  ctx.beginPath();
  ctx.moveTo(pitchTopLeftX, pitchTopY);
  ctx.lineTo(pitchTopRightX, pitchTopY);
  ctx.lineTo(pitchBottomRightX, pitchBottomY);
  ctx.lineTo(pitchBottomLeftX, pitchBottomY);
  ctx.closePath();
  ctx.fill();

  // Pitch Wear Track (symmetrically along pitch centerline)
  ctx.fillStyle = "#cca885";
  ctx.beginPath();
  ctx.moveTo(pitchBowlingCenterX - getPitchHalfWidth(pitchTopY) * 0.6, pitchTopY);
  ctx.lineTo(pitchBowlingCenterX + getPitchHalfWidth(pitchTopY) * 0.6, pitchTopY);
  ctx.lineTo(pitchStrikerCenterX + getPitchHalfWidth(pitchBottomY) * 0.6, pitchBottomY);
  ctx.lineTo(pitchStrikerCenterX - getPitchHalfWidth(pitchBottomY) * 0.6, pitchBottomY);
  ctx.closePath();
  ctx.fill();

  // --- 3. Geometric Creases (Centered on Pitch Axis) ---
  // A. Bowling Crease (Top)
  const bowlingCreaseY = h * 0.20;
  const bowlingCreaseCenterX = getPitchCenterX(bowlingCreaseY);
  const bowlingCreaseHalfWidth = getPitchHalfWidth(bowlingCreaseY) * 0.85;

  ctx.strokeStyle = "rgba(255,255,255,0.70)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bowlingCreaseCenterX - bowlingCreaseHalfWidth, bowlingCreaseY);
  ctx.lineTo(bowlingCreaseCenterX + bowlingCreaseHalfWidth, bowlingCreaseY);
  ctx.stroke();

  // B. Striker Bowling Crease (at Stumps)
  const strikerCreaseY = h * 0.86;
  const stumpsX = getPitchCenterX(strikerCreaseY);
  const stumpsBaseY = strikerCreaseY;
  const strikerCreaseHalfWidth = getPitchHalfWidth(strikerCreaseY) * 0.70;

  ctx.strokeStyle = "rgba(255,255,255,0.50)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(stumpsX - strikerCreaseHalfWidth, strikerCreaseY);
  ctx.lineTo(stumpsX + strikerCreaseHalfWidth, strikerCreaseY);
  ctx.stroke();

  // C. Popping Crease (in front of Stumps)
  const poppingCreaseY = h * 0.77;
  const poppingCreaseCenterX = getPitchCenterX(poppingCreaseY);
  const poppingCreaseHalfWidth = getPitchHalfWidth(poppingCreaseY) * 0.95;

  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(poppingCreaseCenterX - poppingCreaseHalfWidth, poppingCreaseY);
  ctx.lineTo(poppingCreaseCenterX + poppingCreaseHalfWidth, poppingCreaseY);
  ctx.stroke();

  // --- 4. Striker Stumps (Centered on Pitch Axis) ---
  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, { scale: 1.0 });

  // --- 5. Kinematics Targets along Pitch Axis ---
  const bounceY = h * 0.48;
  const pitchBounceCenterX = getPitchCenterX(bounceY);

  let pitchBounceX = pitchBounceCenterX;
  if (ev) {
    if (ev.apparentPitchLine === "OUTSIDE_LEG") pitchBounceX = pitchBounceCenterX - 34;
    else if (ev.apparentPitchLine === "OUTSIDE_OFF") pitchBounceX = pitchBounceCenterX + 32;
    else pitchBounceX = pitchBounceCenterX + (lbw ? lbw.pitchX * 24 : 0);
  } else if (lbw) {
    pitchBounceX = pitchBounceCenterX + lbw.pitchX * 28;
  }

  let impactY = h * 0.69;
  if (ev?.apparentHeight === "LOW_SHIN") impactY = h * 0.73;
  else if (ev?.apparentHeight === "HIGH_THIGH") impactY = h * 0.63;

  const impactPitchCenterX = getPitchCenterX(impactY);
  let padImpactX = impactPitchCenterX - 6;
  if (ev) {
    if (ev.apparentImpactLine === "OUTSIDE_OFF") padImpactX = impactPitchCenterX + 28;
    else if (ev.apparentImpactLine === "OUTSIDE_LEG") padImpactX = impactPitchCenterX - 30;
    else padImpactX = impactPitchCenterX - 6 + (lbw ? lbw.impactX * 18 : 0);
  } else if (lbw) {
    padImpactX = impactPitchCenterX - 6 + lbw.impactX * 22;
  }

  const shotType = ev?.shotOfferedType || (lbw?.shotOffered ? "DEFENSIVE_FORWARD" : "PADDED_AWAY_NO_SHOT");
  const isNoShot = shotType === "PADDED_AWAY_NO_SHOT" || shotType === "LEAVE_WITHDRAWN";

  // --- 6. Striker Batter Positioning (Bug 1B) ---
  // Batter stands forward on popping crease, offset naturally to leg-side of stumps
  const batterBaseX = poppingCreaseCenterX - 16 + (ev?.batterStanceShiftX || 0) * 0.35;
  const batterY = poppingCreaseY;

  // Bowler at Top of Pitch
  const bowlerX = pitchBowlingCenterX;
  const bowlerY = pitchTopY;
  const bowlerK = solveLBWBowlerKinematics(p);
  drawArticulatedBowler(
    ctx,
    { x: bowlerX, y: bowlerY + 18, scale: 0.88, facing: "RIGHT" },
    bowlerK
  );

  // Batter Articulated Kinematic Rig
  const batterK = solveLBWBatterKinematics(
    p,
    isNoShot,
    shotType,
    ev?.batPadSeparationMm
  );
  drawArticulatedBatter(
    ctx,
    { x: batterBaseX, y: batterY, scale: 1.08, facing: "RIGHT" },
    batterK
  );

  // --- 7. Ball Trajectory Corridor (from Bowler to Batter) ---
  let ballX = bowlerX;
  let ballY = bowlerY;
  let ballRadius = 2.5;
  let prevBallX = ballX;
  let prevBallY = ballY;

  if (p < 0.20) {
    const rad = bowlerK.bowlingArmAngleRad;
    ballX = bowlerX + 3 + Math.cos(rad) * 16;
    ballY = bowlerY + 18 - 32 + Math.sin(rad) * 16;
  } else if (p >= 0.20 && p < 0.50) {
    const t = (p - 0.20) / 0.30;
    ballX = bowlerX + (pitchBounceX - bowlerX) * t;
    ballY = bowlerY + (bounceY - bowlerY) * (t * t);
    ballRadius = 2.5 + t * 2.5;
    prevBallX = ballX - (pitchBounceX - bowlerX) * 0.04;
    prevBallY = ballY - 6;
  } else if (p >= 0.50 && p < 0.70) {
    const t = (p - 0.50) / 0.20;
    ballX = pitchBounceX + (padImpactX - pitchBounceX) * t;
    ballY = bounceY + (impactY - bounceY) * t;
    ballRadius = 5.0 + t * 1.8;
    prevBallX = ballX - (padImpactX - pitchBounceX) * 0.05;
    prevBallY = ballY - 4;

    ctx.fillStyle = "rgba(80,58,40,0.6)";
    ctx.beginPath();
    ctx.ellipse(pitchBounceX, bounceY, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const t = (p - 0.70) / 0.30;
    ballX = padImpactX + (lbw?.impactX ? lbw.impactX * 12 * t : 4 * t);
    ballY = impactY + t * 16;
    ballRadius = 6.8;
  }

  drawCricketBall(ctx, ballX, ballY, {
    radius: ballRadius,
    seamAngleRad: p * Math.PI * 4,
    shadowY: Math.min(strikerCreaseY, ballY + ballRadius * 1.2),
    motionTrail: p >= 0.20 && p < 0.70,
    prevX: prevBallX,
    prevY: prevBallY,
  });

  ctx.restore();
}

/* ================================================================
   2. RUN OUT BROADCAST REPLAY RENDERER
   ================================================================ */
function renderRunOutBroadcast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  scenario: Scenario
) {
  const ev = scenario.initialEvidence?.runOut;
  const ro = scenario.runOut;

  // Pitch & turf
  ctx.fillStyle = "#153020";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#a88e72";
  ctx.fillRect(0, h * 0.52, w, h * 0.48);

  const creaseX = w * 0.44;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(creaseX - 2, h * 0.52, 4, h * 0.48);

  // Stumps
  const stumpsX = w * 0.28;
  const stumpsBaseY = h * 0.52;
  const bailsBroke = p >= 0.62;
  const dislodgeT = bailsBroke ? (p - 0.62) / 0.38 : 0.0;

  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, {
    scale: 1.1,
    bailsDislodged: bailsBroke,
    dislodgeProgress: dislodgeT,
    isZing: true,
  });

  // Wicketkeeper at Stumps
  const keeperK = solveCaughtBehindKeeperKinematics(p * 0.5, false);
  drawArticulatedWicketkeeper(
    ctx,
    { x: stumpsX - 24, y: stumpsBaseY + 6, scale: 1.0, facing: "RIGHT" },
    keeperK
  );

  // Incoming Ball Throw
  if (p < 0.62) {
    const tThrow = p / 0.62;
    const throwX = w * 0.95 + (stumpsX - w * 0.95) * tThrow;
    const throwY = h * 0.25 + (stumpsBaseY - 14 - h * 0.25) * tThrow;

    drawCricketBall(ctx, throwX, throwY, {
      radius: 4.5,
      seamAngleRad: p * Math.PI * 8,
    });
  }

  // Articulated Runner Kinematics
  const marginPx = ev?.visualMarginPixels ?? (ro ? Math.round(ro.creaseMarginMm * 0.45) : 0);
  const runnerResult = solveRunOutRunnerKinematics(
    p,
    creaseX,
    marginPx,
    ev?.runnerDiveTechnique
  );

  drawArticulatedBatter(
    ctx,
    { x: runnerResult.runnerX, y: stumpsBaseY + 12, scale: 1.1, facing: "LEFT" },
    runnerResult.batterK
  );
}

/* ================================================================
   3. STUMPING BROADCAST REPLAY RENDERER
   ================================================================ */
function renderStumpingBroadcast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  scenario: Scenario
) {
  const ev = scenario.initialEvidence?.runOut;
  const ro = scenario.runOut;

  // Turf & clay
  ctx.fillStyle = "#153020";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ad9275";
  ctx.fillRect(0, h * 0.54, w, h * 0.46);

  const creaseX = w * 0.48;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(creaseX - 2, h * 0.54, 4, h * 0.46);

  const stumpsX = w * 0.32;
  const stumpsBaseY = h * 0.54;
  const bailsBroke = p >= 0.65;
  const dislodgeT = bailsBroke ? (p - 0.65) / 0.35 : 0.0;

  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, {
    scale: 1.15,
    bailsDislodged: bailsBroke,
    dislodgeProgress: dislodgeT,
    isZing: true,
  });

  // Wicketkeeper rapid stumping whip
  const keeperK = solveStumpingKeeperKinematics(p);
  drawArticulatedWicketkeeper(
    ctx,
    { x: stumpsX - 20, y: stumpsBaseY + 4, scale: 1.15, facing: "RIGHT" },
    keeperK
  );

  // Batter advance & back-foot drag
  const marginPx = ev?.visualMarginPixels ?? (ro ? Math.round(ro.creaseMarginMm * 0.45) : 0);
  const stumpingResult = solveStumpingBatterKinematics(p, creaseX, marginPx);

  drawArticulatedBatter(
    ctx,
    { x: stumpingResult.batterX, y: stumpsBaseY + 8, scale: 1.15, facing: "LEFT" },
    stumpingResult.batterK
  );

  // Ball flight past bat to keeper
  if (p < 0.50) {
    const t = p / 0.50;
    const bX = w * 0.85 + (stumpsX + 18 - w * 0.85) * t;
    const bY = h * 0.38 + (stumpsBaseY - 20 - h * 0.38) * t;
    drawCricketBall(ctx, bX, bY, { radius: 5.0, seamAngleRad: p * Math.PI * 6 });
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
