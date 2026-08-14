import React, { useEffect, useRef, useState } from "react";
import type { Scenario } from "../../types/scenario";
import { Camera } from "lucide-react";

interface IncidentReplayFeedProps {
  scenario: Scenario;
}

export const IncidentReplayFeed: React.FC<IncidentReplayFeedProps> = ({ scenario }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [timecode, setTimecode] = useState("00:14:28:19");

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

      // Update timecode smoothly
      const frameNum = Math.floor(progress * 50);
      const secNum = 28 + Math.floor(elapsed / 1000);
      setTimecode(`00:14:${secNum.toString().padStart(2, "0")}:${frameNum.toString().padStart(2, "0")}`);

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
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800/90 bg-[#0c1610] select-none shadow-2xl flex flex-col justify-center items-center" style={{ minHeight: 280 }}>
      {/* High-Performance Canvas Replay Viewport */}
      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        className="w-full h-full object-contain block"
      />

      {/* Subtle Broadcast CRT Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.65)_100%)] pointer-events-none" />

      {/* Subtle Noise Texture */}
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

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

      {/* Match Speed / Info Badge — Bottom Left */}
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
   Pitch-end broadcast perspective down the wicket showing bowler run-up,
   delivery release, pitch bounce scuff, dynamic batter stance & pad impact.
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

  // 1. Draw Outfield Grass with mowing lines
  const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
  gradGrass.addColorStop(0, "#132b1c");
  gradGrass.addColorStop(0.5, "#183824");
  gradGrass.addColorStop(1, "#0f2316");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, w, h);

  // 2. 3D Perspective Clay Pitch Strip
  ctx.save();
  ctx.fillStyle = "#bfa78a";
  ctx.beginPath();
  ctx.moveTo(w * 0.38, h * 0.12);
  ctx.lineTo(w * 0.62, h * 0.12);
  ctx.lineTo(w * 0.74, h * 0.94);
  ctx.lineTo(w * 0.26, h * 0.94);
  ctx.closePath();
  ctx.fill();

  // Pitch texture & wear corridor
  ctx.fillStyle = "#cca885";
  ctx.beginPath();
  ctx.moveTo(w * 0.42, h * 0.12);
  ctx.lineTo(w * 0.58, h * 0.12);
  ctx.lineTo(w * 0.68, h * 0.94);
  ctx.lineTo(w * 0.32, h * 0.94);
  ctx.closePath();
  ctx.fill();

  // Crease lines
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 1.5;
  // Bowling crease
  ctx.beginPath();
  ctx.moveTo(w * 0.39, h * 0.17);
  ctx.lineTo(w * 0.61, h * 0.17);
  ctx.stroke();
  // Popping crease (striker end)
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.28, h * 0.85);
  ctx.lineTo(w * 0.72, h * 0.85);
  ctx.stroke();

  // Non-striker stumps (top)
  ctx.fillStyle = "#d97706";
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(w * 0.5 + i * 4 - 1, h * 0.11 - 8, 2.5, 8);
  }

  // Striker stumps (bottom)
  const stumpsCenterX = w * 0.5;
  const stumpsY = h * 0.90;
  ctx.fillStyle = "#f59e0b";
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(stumpsCenterX + i * 7 - 2, stumpsY - 32, 4, 32);
  }
  // Bails
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(stumpsCenterX - 10, stumpsY - 35, 9, 3);
  ctx.fillRect(stumpsCenterX + 1, stumpsY - 35, 9, 3);

  // 3. Physical Delivery Timeline & Positions
  // Pitch bounce occurs at p = 0.50
  // Pad impact occurs at p = 0.70
  // Post-impact appeal occurs at p > 0.70

  const pitchCenter = w * 0.5;
  let pitchBounceX = pitchCenter;
  if (ev) {
    if (ev.apparentPitchLine === "OUTSIDE_LEG") pitchBounceX = pitchCenter - 48;
    else if (ev.apparentPitchLine === "OUTSIDE_OFF") pitchBounceX = pitchCenter + 45;
    else pitchBounceX = pitchCenter + (lbw ? lbw.pitchX * 28 : 0);
  } else if (lbw) {
    pitchBounceX = pitchCenter + lbw.pitchX * 36;
  }

  let padImpactX = pitchCenter;
  if (ev) {
    if (ev.apparentImpactLine === "OUTSIDE_OFF") padImpactX = pitchCenter + 40;
    else if (ev.apparentImpactLine === "OUTSIDE_LEG") padImpactX = pitchCenter - 42;
    else padImpactX = pitchCenter + (lbw ? lbw.impactX * 22 : 0);
  } else if (lbw) {
    padImpactX = pitchCenter + lbw.impactX * 30;
  }

  let impactY = h * 0.78;
  if (ev?.apparentHeight === "LOW_SHIN") impactY = h * 0.82;
  else if (ev?.apparentHeight === "HIGH_THIGH") impactY = h * 0.73;

  const shotType = ev?.shotOfferedType || (lbw?.shotOffered ? "DEFENSIVE_FORWARD" : "PADDED_AWAY_NO_SHOT");
  const isNoShot = shotType === "PADDED_AWAY_NO_SHOT" || shotType === "LEAVE_WITHDRAWN";
  const batterX = pitchCenter + (ev?.batterStanceShiftX || 0) - 22;

  // 4. Bowler Animation (Top)
  const bowlerY = h * 0.14;
  ctx.fillStyle = "#1e293b";
  // Bowler head & body
  ctx.beginPath();
  ctx.arc(pitchCenter, bowlerY - 10, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(pitchCenter - 4, bowlerY - 4, 8, 14);

  // Bowler arm motion
  let armAngle = Math.PI * 0.2;
  if (p < 0.25) {
    armAngle = (p / 0.25) * Math.PI * 2;
  } else if (p > 0.75) {
    // Appealing pose (arms up)
    armAngle = -Math.PI * 0.7;
  }
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pitchCenter, bowlerY);
  ctx.lineTo(pitchCenter + Math.cos(armAngle) * 12, bowlerY + Math.sin(armAngle) * 12);
  ctx.stroke();

  // 5. Batter Animation in Stance (Bottom)
  const batterY = h * 0.72;
  ctx.fillStyle = "#0f172a";
  // Head
  ctx.beginPath();
  ctx.arc(batterX, batterY - 8, 8, 0, Math.PI * 2);
  ctx.fill();
  // Helmet visor
  ctx.fillStyle = "#334155";
  ctx.fillRect(batterX - 7, batterY - 11, 14, 3);
  // Torso
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(batterX - 7, batterY, 15, 24);

  // White Pads
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  // Front pad
  ctx.fillRect(batterX + 4, batterY + 12, 11, 28);
  ctx.strokeRect(batterX + 4, batterY + 12, 11, 28);
  // Pad knee roll lines
  ctx.strokeStyle = "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(batterX + 4, batterY + 22);
  ctx.lineTo(batterX + 15, batterY + 22);
  ctx.moveTo(batterX + 4, batterY + 28);
  ctx.lineTo(batterX + 15, batterY + 28);
  ctx.stroke();

  // Bat Stance
  ctx.fillStyle = "#d97706";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 0.8;
  if (isNoShot) {
    // Bat raised behind shoulder
    ctx.save();
    ctx.translate(batterX - 16, batterY - 6);
    ctx.rotate(-Math.PI * 0.25);
    ctx.fillRect(0, 0, 4.5, 34);
    ctx.strokeRect(0, 0, 4.5, 34);
    ctx.restore();
  } else {
    // Forward defensive bat position
    const batSeparation = ev ? ev.batPadSeparationMm : 60;
    const batOffset = batSeparation < 25 ? -2 : -12;
    ctx.save();
    ctx.translate(batterX + batOffset, batterY + 6);
    ctx.rotate(-Math.PI * 0.08);
    ctx.fillRect(0, 0, 4.5, 38);
    ctx.strokeRect(0, 0, 4.5, 38);
    ctx.restore();
  }

  // 6. Ball Motion & Trajectory Calculation
  let ballX = pitchCenter;
  let ballY = bowlerY;
  let ballRadius = 3;
  let ballVisible = true;

  if (p < 0.20) {
    // Ball in bowler's hand
    ballX = pitchCenter + Math.cos(armAngle) * 10;
    ballY = bowlerY + Math.sin(armAngle) * 10;
    ballRadius = 2.5;
  } else if (p >= 0.20 && p < 0.50) {
    // Flight from bowler release to pitch bounce
    const t = (p - 0.20) / 0.30;
    ballX = pitchCenter + (pitchBounceX - pitchCenter) * t;
    ballY = bowlerY + (h * 0.48 - bowlerY) * (t * t); // Parabolic fall
    ballRadius = 2.5 + t * 2.5;
  } else if (p >= 0.50 && p < 0.70) {
    // Rise from pitch bounce to pad impact
    const t = (p - 0.50) / 0.20;
    ballX = pitchBounceX + (padImpactX - pitchBounceX) * t;
    ballY = h * 0.48 + (impactY - h * 0.48) * t;
    ballRadius = 5.0 + t * 2.0;

    // Pitch bounce scuff mark
    ctx.fillStyle = "rgba(92,69,48,0.7)";
    ctx.beginPath();
    ctx.ellipse(pitchBounceX, h * 0.48, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Impact occurred! Ball deadens & falls or deflects slightly
    const t = (p - 0.70) / 0.30;
    ballX = padImpactX + (lbw?.impactX ? lbw.impactX * 15 * t : 5 * t);
    ballY = impactY + t * 18;
    ballRadius = 7.0;

    // Flash / impact burst right at moment of impact
    if (p < 0.76) {
      ctx.fillStyle = "rgba(250, 204, 21, 0.75)";
      ctx.beginPath();
      ctx.arc(padImpactX, impactY, 14, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Cricket Ball with 3D Seam
  if (ballVisible) {
    // Ball Shadow on pitch
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(ballX + 2, ballY + ballRadius * 1.2, ballRadius * 1.1, ballRadius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Red Ball
    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#991b1b";
    ctx.lineWidth = 1;
    ctx.stroke();

    // White Seam
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(ballX, ballY, ballRadius * 0.8, ballRadius * 0.2, p * Math.PI * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/* ================================================================
   2. RUN OUT / STUMPING BROADCAST REPLAY RENDERER
   Square-leg broadcast perspective showing sprinting/diving runner,
   incoming throw from deep fielder, and bails breaking at the stumps.
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

  // Popping Crease White Line (X = w * 0.42)
  const creaseX = w * 0.42;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(creaseX - 2, h * 0.52, 4, h * 0.48);

  // Stumps at X = w * 0.26
  const stumpsX = w * 0.26;
  const stumpsBaseY = h * 0.52;

  // Wicketkeeper at Stumps
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(stumpsX - 24, stumpsBaseY - 36, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(stumpsX - 30, stumpsBaseY - 26, 14, 26);
  // Keeper green gloves
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.arc(stumpsX + 6, stumpsBaseY - 14, 6, 0, Math.PI * 2);
  ctx.fill();

  // Physical Timing:
  // Throw arrives and bails break at p = 0.62
  const bailsBroke = p >= 0.62;

  // Draw Stumps
  ctx.fillStyle = "#cbd5e1";
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 0.5;
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(stumpsX + i * 6 - 2, stumpsBaseY - 48, 4, 48);
    ctx.strokeRect(stumpsX + i * 6 - 2, stumpsBaseY - 48, 4, 48);
  }

  // Zing Bails
  if (!bailsBroke) {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(stumpsX - 9, stumpsBaseY - 51, 8, 3);
    ctx.fillRect(stumpsX + 1, stumpsBaseY - 51, 8, 3);
  } else {
    // Bails Dislodged & Flying with Red LED Glow
    const flyT = (p - 0.62) / 0.38;
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 10;
    // Bail 1 flying left
    ctx.fillRect(stumpsX - 12 - flyT * 22, stumpsBaseY - 54 - flyT * 18 + flyT * flyT * 25, 7, 3);
    // Bail 2 flying right
    ctx.fillRect(stumpsX + 3 + flyT * 18, stumpsBaseY - 52 - flyT * 22 + flyT * flyT * 28, 7, 3);
    ctx.shadowBlur = 0;
  }

  // Incoming Ball Throw from Deep Fielder
  if (p < 0.62) {
    const tThrow = p / 0.62;
    const throwX = w * 0.95 + (stumpsX - w * 0.95) * tThrow;
    const throwY = h * 0.25 + (stumpsBaseY - 14 - h * 0.25) * tThrow;

    ctx.fillStyle = "#dc2626";
    ctx.beginPath();
    ctx.arc(throwX, throwY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Motion blur trail
    ctx.strokeStyle = "rgba(220, 38, 38, 0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(throwX + 12, throwY - 4);
    ctx.lineTo(throwX, throwY);
    ctx.stroke();
  }

  // Runner Slide / Dive Kinematics
  const marginPx = ev?.visualMarginPixels ?? (ro ? Math.round(ro.creaseMarginMm * 0.45) : 0);
  const targetBatTipX = creaseX - marginPx; // Safe = inside (left of line), Out = short (right of line)

  // Runner moves in from right (w * 0.85 -> target position)
  let currentRunnerX = w * 0.85;
  if (p < 0.62) {
    const tRun = p / 0.62;
    currentRunnerX = w * 0.85 + (targetBatTipX + 70 - w * 0.85) * (tRun * tRun);
  } else {
    const tPost = (p - 0.62) / 0.38;
    currentRunnerX = targetBatTipX + 70 - tPost * 25; // Slide momentum carries through
  }

  const diveTechnique = ev?.runnerDiveTechnique || "FULL_DIVE";
  const runnerY = stumpsBaseY + 6;

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(currentRunnerX, runnerY + 12, 45, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw Runner Body
  ctx.fillStyle = "#0f172a";
  if (diveTechnique === "FULL_DIVE" || diveTechnique === "FEET_FIRST_SLIDE") {
    // Horizontal Superman Dive
    ctx.beginPath();
    ctx.arc(currentRunnerX + 35, runnerY - 6, 8, 0, Math.PI * 2); // Head
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(currentRunnerX + 10, runnerY - 2, 24, 7, 0, 0, Math.PI * 2); // Torso
    ctx.fill();
    // Arm reaching forward
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(currentRunnerX - 10, runnerY - 2);
    ctx.lineTo(currentRunnerX - 35, runnerY + 4);
    ctx.stroke();

    // Bat held in hand stretching towards crease
    ctx.fillStyle = "#d97706";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 0.8;
    ctx.fillRect(currentRunnerX - 70, runnerY + 2, 42, 6);
    ctx.strokeRect(currentRunnerX - 70, runnerY + 2, 42, 6);
    // Bat handle & rubber grip
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(currentRunnerX - 36, runnerY + 3.5, 12, 3);
  } else {
    // Upright Sprint / Desperate Lunge
    ctx.beginPath();
    ctx.arc(currentRunnerX + 12, runnerY - 28, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(currentRunnerX + 4, runnerY - 20, 16, 26);
    // Bat lunge
    ctx.fillStyle = "#d97706";
    ctx.fillRect(currentRunnerX - 45, runnerY + 2, 45, 6);
  }
}

/* ================================================================
   3. CAUGHT BEHIND BROADCAST REPLAY RENDERER
   Slip-cam / 45-degree broadcast angle showing delivery, batter stroke,
   outside edge passage, micro-deflection / daylight, and keeper catch.
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
  ctx.fillRect(0, h * 0.65, w, h * 0.35);

  // Stumps at X = w * 0.48
  const stumpsX = w * 0.48;
  const stumpsBaseY = h * 0.65;
  ctx.fillStyle = "#cbd5e1";
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(stumpsX + i * 5 - 1.5, stumpsBaseY - 42, 3.5, 42);
  }

  // Batter Stance (Right side of stumps at w * 0.62)
  const batterX = w * 0.62;
  const batterY = h * 0.50;

  ctx.fillStyle = "#0f172a";
  // Head
  ctx.beginPath();
  ctx.arc(batterX, batterY - 10, 9, 0, Math.PI * 2);
  ctx.fill();
  // Torso
  ctx.fillRect(batterX - 8, batterY, 16, 30);
  // White front pad
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(batterX - 14, batterY + 22, 10, 32);

  // Bat Blade Angle & Swing Motion
  const batAngle = ev?.batAngleDeg ?? 14;
  const swingProgress = p < 0.50 ? p / 0.50 : 1.0;
  const currentAngle = (batAngle * Math.PI) / 180 + (1.0 - swingProgress) * 0.15;

  ctx.save();
  ctx.translate(batterX - 22, batterY + 14);
  ctx.rotate(currentAngle);
  ctx.fillStyle = "#d97706";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 0.8;
  ctx.fillRect(-2.5, 0, 5, 48);
  ctx.strokeRect(-2.5, 0, 5, 48);
  ctx.restore();

  // Wicketkeeper Crouching Behind (Left side at w * 0.30)
  const keeperX = w * 0.30;
  const keeperY = h * 0.54;

  const keeperAppealing = p > 0.72;
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(keeperX, keeperY - (keeperAppealing ? 14 : 4), 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(keeperX - 6, keeperY + (keeperAppealing ? -6 : 4), 12, 24);

  // Keeper green gloves
  ctx.fillStyle = "#16a34a";
  const gloveY = keeperAppealing ? keeperY - 20 : keeperY + 12;
  ctx.beginPath();
  ctx.arc(keeperX + 16, gloveY, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // Ball Trajectory & Edge Passage
  // Ball reaches bat at p = 0.50
  const batContactX = batterX - 22;
  const batContactY = batterY + 36;

  const hasEdge = cb?.hasEdge ?? false;
  const deflectionAngle = ev?.apparentDeflectionAngleDeg ?? (hasEdge ? 2.5 : 0);
  const gapPx = ev?.apparentGapPixels ?? (hasEdge ? 0 : 16);

  let ballX = w * 0.95;
  let ballY = h * 0.38;

  if (p < 0.50) {
    // Inbound flight to bat
    const t = p / 0.50;
    ballX = w * 0.95 + (batContactX + gapPx - w * 0.95) * t;
    ballY = h * 0.38 + (batContactY - h * 0.38) * t;
  } else {
    // Flight after bat towards keeper
    const t = (p - 0.50) / 0.50;
    const targetX = keeperX + 16;
    const targetY = deflectionAngle > 0 ? gloveY + 4 : gloveY;
    ballX = batContactX + gapPx + (targetX - (batContactX + gapPx)) * t;
    ballY = batContactY + (targetY - batContactY) * t;

    // Contact spark flash if edge occurs
    if (hasEdge && p < 0.56) {
      ctx.fillStyle = "rgba(250, 204, 21, 0.85)";
      ctx.beginPath();
      ctx.arc(batContactX, batContactY, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Draw Cricket Ball
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(ballX, ballY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#991b1b";
  ctx.lineWidth = 0.8;
  ctx.stroke();
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
  // Intercept & flick moment at p = 0.58
  const cushionApexX = cushionX - 20;
  let slideTargetX = cushionApexX - 30;
  if (ev?.apparentCushionInteraction === "DEEP_CUSHION_COMPRESSION" || isBoundary) {
    slideTargetX = cushionApexX + 15; // crosses onto cushion
  } else if (ev?.apparentCushionInteraction === "GRAZING_CUSHION_EDGE") {
    slideTargetX = cushionApexX - 4; // right at cushion boundary
  }

  let currentFielderX = w * 0.82;
  if (p < 0.58) {
    const t = p / 0.58;
    currentFielderX = w * 0.82 + (slideTargetX - w * 0.82) * (t * t);
  } else {
    const t = (p - 0.58) / 0.42;
    currentFielderX = slideTargetX + t * 12; // Skidding momentum
  }

  const fielderY = h * 0.55;

  // Fielder horizontal sliding body
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(currentFielderX + 30, fielderY - 4, 8, 0, Math.PI * 2); // Head
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(currentFielderX + 8, fielderY, 24, 7, 0, 0, Math.PI * 2); // Torso
  ctx.fill();
  // Outstretched arm
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(currentFielderX - 8, fielderY);
  ctx.lineTo(currentFielderX - 32, fielderY + 4);
  ctx.stroke();

  // Ball Flight & Relay Flick
  const tossHeight = ev?.ballTossHeightPixels ?? (isBoundary ? 0 : 65);
  let ballX = currentFielderX - 32;
  let ballY = fielderY + 4;

  if (p >= 0.58) {
    const tFlick = (p - 0.58) / 0.42;
    if (!isBoundary) {
      // Ball tossed back into field of play
      ballX = currentFielderX - 32 - tFlick * 45;
      ballY = fielderY + 4 - Math.sin(tFlick * Math.PI) * tossHeight;
    } else {
      // Ball retained in hands while sliding into cushion
      ballX = currentFielderX - 30;
      ballY = fielderY + 4;
    }
  }

  // Draw Ball
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(ballX, ballY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#991b1b";
  ctx.lineWidth = 0.8;
  ctx.stroke();
}
