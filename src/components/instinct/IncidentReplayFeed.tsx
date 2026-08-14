import React, { useEffect, useRef, useState } from "react";
import type { Scenario } from "../../types/scenario";
import { Camera } from "lucide-react";
import {
  drawBatter,
  drawBowler,
  drawWicketkeeper,
  drawStumpsAndBails,
  drawCricketBall,
  type BatterPoseType,
  type BowlerPoseType,
  type KeeperPoseType,
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
      case "RUN_OUT":
      case "STUMPING": return "CAM 02 • SQUARE LEG BROADCAST";
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

      // Render incident-specific broadcast replay
      if (scenario.incidentType === "LBW") {
        renderLBWBroadcast(ctx, width, height, progress, scenario);
      } else if (scenario.incidentType === "RUN_OUT" || scenario.incidentType === "STUMPING") {
        renderRunOutBroadcast(ctx, width, height, progress, scenario);
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

      {(scenario.incidentType === "RUN_OUT" || scenario.incidentType === "STUMPING") && (
        <div className="absolute bottom-3 left-3 z-30 bg-black/75 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md shadow-lg">
          <span className="text-amber-300 text-[11px] font-mono font-bold">
            {scenario.incidentType === "STUMPING" ? "STUMPING APPEAL" : "RUN OUT APPEAL"}
          </span>
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
   Uses articulated Batter & Bowler actor rigs, realistic 3D pitch,
   seam rotation, pitch bounce, pad impact height and bowler appeal.
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

  // 1. Outfield Grass with mowing gradient
  const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
  gradGrass.addColorStop(0, "#122a1b");
  gradGrass.addColorStop(0.6, "#183925");
  gradGrass.addColorStop(1, "#0e2015");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, w, h);

  // 2. 3D Perspective Clay Pitch Strip
  ctx.save();
  ctx.fillStyle = "#bda384";
  ctx.beginPath();
  ctx.moveTo(w * 0.32, h * 0.16);
  ctx.lineTo(w * 0.58, h * 0.16);
  ctx.lineTo(w * 0.72, h * 0.92);
  ctx.lineTo(w * 0.22, h * 0.92);
  ctx.closePath();
  ctx.fill();

  // Pitch wear pattern
  ctx.fillStyle = "#cca885";
  ctx.beginPath();
  ctx.moveTo(w * 0.37, h * 0.16);
  ctx.lineTo(w * 0.53, h * 0.16);
  ctx.lineTo(w * 0.64, h * 0.92);
  ctx.lineTo(w * 0.30, h * 0.92);
  ctx.closePath();
  ctx.fill();

  // Bowling crease (top)
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.33, h * 0.20);
  ctx.lineTo(w * 0.57, h * 0.20);
  ctx.stroke();

  // Popping crease (striker end)
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.24, h * 0.84);
  ctx.lineTo(w * 0.70, h * 0.84);
  ctx.stroke();

  // Striker Stumps (X = w * 0.54, Base Y = h * 0.86)
  const stumpsX = w * 0.54;
  const stumpsBaseY = h * 0.86;
  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, { scale: 1.15 });

  // Calculate Delivery Trajectory based on Scenario Evidence
  const pitchCenter = w * 0.45;
  let pitchBounceX = pitchCenter;
  if (ev) {
    if (ev.apparentPitchLine === "OUTSIDE_LEG") pitchBounceX = stumpsX - 38;
    else if (ev.apparentPitchLine === "OUTSIDE_OFF") pitchBounceX = stumpsX + 35;
    else pitchBounceX = stumpsX - 6 + (lbw ? lbw.pitchX * 22 : 0);
  } else if (lbw) {
    pitchBounceX = stumpsX - 6 + lbw.pitchX * 30;
  }

  let padImpactX = stumpsX - 6;
  if (ev) {
    if (ev.apparentImpactLine === "OUTSIDE_OFF") padImpactX = stumpsX + 30;
    else if (ev.apparentImpactLine === "OUTSIDE_LEG") padImpactX = stumpsX - 32;
    else padImpactX = stumpsX - 6 + (lbw ? lbw.impactX * 18 : 0);
  } else if (lbw) {
    padImpactX = stumpsX - 6 + lbw.impactX * 24;
  }

  let impactY = h * 0.74; // Knee roll default
  if (ev?.apparentHeight === "LOW_SHIN") impactY = h * 0.79;
  else if (ev?.apparentHeight === "HIGH_THIGH") impactY = h * 0.67;

  const shotType = ev?.shotOfferedType || (lbw?.shotOffered ? "DEFENSIVE_FORWARD" : "PADDED_AWAY_NO_SHOT");
  const isNoShot = shotType === "PADDED_AWAY_NO_SHOT" || shotType === "LEAVE_WITHDRAWN";
  const batterX = stumpsX - 22 + (ev?.batterStanceShiftX || 0);

  // Bowler at top of pitch
  const bowlerX = w * 0.45;
  const bowlerY = h * 0.16;

  let bowlerPose: BowlerPoseType = "RUN_UP";
  let armAngle = 45;

  if (p < 0.20) {
    bowlerPose = "WINDUP_RELEASE";
    armAngle = (p / 0.20) * 360;
  } else if (p >= 0.20 && p < 0.72) {
    bowlerPose = "FOLLOW_THROUGH";
    armAngle = 120;
  } else {
    bowlerPose = "APPEAL";
    armAngle = -135;
  }

  drawBowler(
    ctx,
    { x: bowlerX, y: bowlerY + 18, scale: 0.88, facing: "RIGHT" },
    { pose: bowlerPose, armAngleDeg: armAngle }
  );

  // Batter in Stance at Crease
  const batterY = h * 0.84;
  let batterPose: BatterPoseType = "NEUTRAL_STANCE";

  if (p < 0.25) {
    batterPose = "NEUTRAL_STANCE";
  } else if (p >= 0.25 && p < 0.70) {
    if (isNoShot) batterPose = "LEAVE_ARMS";
    else if (shotType === "DRIVE_ATTEMPT") batterPose = "COVER_DRIVE";
    else batterPose = "FORWARD_DEFENCE";
  } else {
    if (isNoShot) batterPose = "LEAVE_ARMS";
    else batterPose = "PAD_IMPACT";
  }

  drawBatter(
    ctx,
    { x: batterX, y: batterY, scale: 1.18, facing: "RIGHT" },
    {
      pose: batterPose,
      batPadSeparationMm: ev?.batPadSeparationMm,
      batAngleDeg: isNoShot ? -35 : 14,
      hasPadImpact: p >= 0.70,
    }
  );

  // Ball Delivery Physics & Trajectory
  let ballX = bowlerX;
  let ballY = bowlerY;
  let ballRadius = 2.5;

  if (p < 0.20) {
    const rad = (armAngle * Math.PI) / 180;
    ballX = bowlerX + Math.cos(rad) * 8;
    ballY = bowlerY + 2 + Math.sin(rad) * 8;
  } else if (p >= 0.20 && p < 0.50) {
    // Release to pitch bounce
    const t = (p - 0.20) / 0.30;
    ballX = bowlerX + (pitchBounceX - bowlerX) * t;
    ballY = bowlerY + (h * 0.50 - bowlerY) * (t * t);
    ballRadius = 2.5 + t * 2.5;
  } else if (p >= 0.50 && p < 0.70) {
    // Rise from bounce to pad impact
    const t = (p - 0.50) / 0.20;
    ballX = pitchBounceX + (padImpactX - pitchBounceX) * t;
    ballY = h * 0.50 + (impactY - h * 0.50) * t;
    ballRadius = 5.0 + t * 1.8;

    // Pitch bounce scuff mark
    ctx.fillStyle = "rgba(80,58,40,0.6)";
    ctx.beginPath();
    ctx.ellipse(pitchBounceX, h * 0.50, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Post-impact: Ball drops naturally to pitch
    const t = (p - 0.70) / 0.30;
    ballX = padImpactX + (lbw?.impactX ? lbw.impactX * 12 * t : 4 * t);
    ballY = impactY + t * 16;
    ballRadius = 6.8;
  }

  // Draw Cricket Ball using shared primitive
  drawCricketBall(ctx, ballX, ballY, {
    radius: ballRadius,
    seamAngleRad: p * Math.PI * 4,
    shadowY: Math.min(h * 0.88, ballY + ballRadius * 1.2),
  });

  ctx.restore();
}

/* ================================================================
   2. CAUGHT BEHIND BROADCAST REPLAY RENDERER
   Tighter broadcast slip camera using articulated Batter and
   Wicketkeeper actor rigs to judge daylight vs micro-deflection.
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

  // Turf surface
  ctx.fillStyle = "#142d1e";
  ctx.fillRect(0, 0, w, h);

  // Clay pitch strip
  ctx.fillStyle = "#ad9275";
  ctx.fillRect(0, h * 0.58, w, h * 0.42);

  // Stumps at X = w * 0.46
  const stumpsX = w * 0.46;
  const stumpsBaseY = h * 0.60;
  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, { scale: 1.25 });

  // Batter Stance (Center-Right at w * 0.60, Base Y = h * 0.66)
  const batterX = w * 0.60;
  const batterY = h * 0.66;

  let batterPose: BatterPoseType = "FORWARD_DEFENCE";
  if (ev?.shotType === "COVER_DRIVE") batterPose = "COVER_DRIVE";
  else if (ev?.shotType === "LATE_CUT") batterPose = "NEUTRAL_STANCE";

  drawBatter(
    ctx,
    { x: batterX, y: batterY, scale: 1.25, facing: "LEFT" },
    {
      pose: batterPose,
      batAngleDeg: ev?.batAngleDeg ?? 14,
    }
  );

  // Wicketkeeper Crouching Behind Stumps (Left at w * 0.26, Base Y = h * 0.64)
  const keeperX = w * 0.26;
  const keeperY = h * 0.64;

  let keeperPose: KeeperPoseType = "CROUCH_WAIT";
  if (p >= 0.45 && p < 0.72) keeperPose = "CATCH_GATHER";
  else if (p >= 0.72) keeperPose = "APPEAL_STAND";

  drawWicketkeeper(
    ctx,
    { x: keeperX, y: keeperY, scale: 1.22, facing: "RIGHT" },
    {
      pose: keeperPose,
      gloveOffsetX: p >= 0.45 ? 6 : 0,
      gloveOffsetY: p >= 0.45 ? -4 : 0,
    }
  );

  // Ball Trajectory & Edge Passage
  const batEdgeX = batterX - 28;
  const batEdgeY = batterY - 34;

  const hasEdge = cb?.hasEdge ?? false;
  const deflectionAngle = ev?.apparentDeflectionAngleDeg ?? (hasEdge ? 2.6 : 0);
  const gapPx = ev?.apparentGapPixels ?? (hasEdge ? 0 : 18);

  let ballX = w * 0.96;
  let ballY = h * 0.32;

  if (p < 0.50) {
    const t = p / 0.50;
    ballX = w * 0.96 + (batEdgeX + gapPx - w * 0.96) * t;
    ballY = h * 0.32 + (batEdgeY - h * 0.32) * t;
  } else {
    const t = (p - 0.50) / 0.50;
    const targetX = keeperX + 24;
    const targetY = deflectionAngle > 0 ? keeperY - 22 : keeperY - 26;
    ballX = batEdgeX + gapPx + (targetX - (batEdgeX + gapPx)) * t;
    ballY = batEdgeY + (targetY - batEdgeY) * t;
  }

  // Draw Cricket Ball (NO artificial sparks or flashes!)
  drawCricketBall(ctx, ballX, ballY, {
    radius: 5.5,
    seamAngleRad: p * Math.PI * 6,
    shadowY: h * 0.65,
  });
}

/* ================================================================
   3. RUN OUT / STUMPING BROADCAST REPLAY RENDERER
   Wide square-leg broadcast camera showing fast-moving runner,
   incoming throw from deep, bails breaking at stumps, and bat reach.
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

  // Turf background
  ctx.fillStyle = "#153020";
  ctx.fillRect(0, 0, w, h);

  // Pitch surface strip
  ctx.fillStyle = "#a88e72";
  ctx.fillRect(0, h * 0.52, w, h * 0.48);

  // Popping Crease White Line (X = w * 0.44)
  const creaseX = w * 0.44;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(creaseX - 2, h * 0.52, 4, h * 0.48);

  // Stumps at X = w * 0.28
  const stumpsX = w * 0.28;
  const stumpsBaseY = h * 0.52;

  // Wicketkeeper at Stumps
  drawWicketkeeper(
    ctx,
    { x: stumpsX - 24, y: stumpsBaseY + 6, scale: 1.0, facing: "RIGHT" },
    { pose: "CROUCH_WAIT" }
  );

  // Timing: Bails break at p = 0.62
  const bailsBroke = p >= 0.62;
  const dislodgeT = bailsBroke ? (p - 0.62) / 0.38 : 0.0;

  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, {
    scale: 1.1,
    bailsDislodged: bailsBroke,
    dislodgeProgress: dislodgeT,
    isZing: true,
  });

  // Incoming Ball Throw from Deep Fielder
  if (p < 0.62) {
    const tThrow = p / 0.62;
    const throwX = w * 0.95 + (stumpsX - w * 0.95) * tThrow;
    const throwY = h * 0.25 + (stumpsBaseY - 14 - h * 0.25) * tThrow;

    drawCricketBall(ctx, throwX, throwY, {
      radius: 4.5,
      seamAngleRad: p * Math.PI * 8,
    });
  }

  // Runner Slide / Dive Kinematics
  const marginPx = ev?.visualMarginPixels ?? (ro ? Math.round(ro.creaseMarginMm * 0.45) : 0);
  const targetBatTipX = creaseX - marginPx; // Safe = past line (left), Out = short (right)

  let currentRunnerX = w * 0.85;
  if (p < 0.62) {
    const tRun = p / 0.62;
    currentRunnerX = w * 0.85 + (targetBatTipX + 70 - w * 0.85) * (tRun * tRun);
  } else {
    const tPost = (p - 0.62) / 0.38;
    currentRunnerX = targetBatTipX + 70 - tPost * 25;
  }

  const diveTechnique = ev?.runnerDiveTechnique || "FULL_DIVE";
  const runnerY = stumpsBaseY + 12;

  // Draw Batter in Diving/Running pose
  drawBatter(
    ctx,
    { x: currentRunnerX - 35, y: runnerY, scale: 1.1, facing: "LEFT" },
    {
      pose: diveTechnique === "UPRIGHT_RUN" ? "RUNNING" : "DIVING",
    }
  );
}

/* ================================================================
   4. BOUNDARY BROADCAST REPLAY RENDERER
   Wide boundary tracking camera showing running outfielder, athletic slide,
   cushion interaction, and ball release arc.
   ================================================================ */
function renderBoundaryBroadcast(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  scenario: Scenario
) {
  const ev = scenario.initialEvidence?.boundary;
  const b = scenario.boundary;
  const isBoundary = b?.isBoundary ?? false;

  // Outfield green grass
  ctx.fillStyle = "#183b25";
  ctx.fillRect(0, 0, w, h * 0.62);

  // Beyond boundary advertising apron
  ctx.fillStyle = "#0c1810";
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  // White boundary rope line
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, h * 0.62);
  ctx.lineTo(w, h * 0.62);
  ctx.stroke();

  // Orange Foam Boundary Cushion at Center
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

  // Cushion text
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.fillText("BOUNDARY CUSHION", cushionX, cushionY + 18);

  // Fielder Slide / Interception Kinematics
  const cushionApexX = cushionX - 20;
  let slideTargetX = cushionApexX - 30;
  if (ev?.apparentCushionInteraction === "DEEP_CUSHION_COMPRESSION" || isBoundary) {
    slideTargetX = cushionApexX + 15;
  } else if (ev?.apparentCushionInteraction === "GRAZING_CUSHION_EDGE") {
    slideTargetX = cushionApexX - 4;
  }

  let currentFielderX = w * 0.82;
  if (p < 0.58) {
    const t = p / 0.58;
    currentFielderX = w * 0.82 + (slideTargetX - w * 0.82) * (t * t);
  } else {
    const t = (p - 0.58) / 0.42;
    currentFielderX = slideTargetX + t * 12;
  }

  const fielderY = h * 0.60;

  // Draw Fielder in sliding pose
  drawBatter(
    ctx,
    { x: currentFielderX, y: fielderY, scale: 1.05, facing: "LEFT" },
    { pose: "SLIDING" }
  );

  // Ball Flight & Relay Flick
  const tossHeight = ev?.ballTossHeightPixels ?? (isBoundary ? 0 : 65);
  let ballX = currentFielderX - 32;
  let ballY = fielderY - 8;

  if (p >= 0.58) {
    const tFlick = (p - 0.58) / 0.42;
    if (!isBoundary) {
      ballX = currentFielderX - 32 - tFlick * 45;
      ballY = fielderY - 8 - Math.sin(tFlick * Math.PI) * tossHeight;
    } else {
      ballX = currentFielderX - 30;
      ballY = fielderY - 8;
    }
  }

  // Draw Ball
  drawCricketBall(ctx, ballX, ballY, {
    radius: 4.5,
    seamAngleRad: p * Math.PI * 6,
  });
}
