import React, { useRef, useEffect } from "react";
import type { CaughtBehindData, Scenario } from "../../types/scenario";
import {
  solveCaughtBehindSlipCorridor,
} from "../../engine/caughtBehindPhysics";
import {
  solveCaughtBehindBatterKinematics,
  solveCaughtBehindKeeperKinematics,
  drawArticulatedBatter,
  drawArticulatedWicketkeeper,
  drawStumpsAndBails,
  drawCricketBall,
  calculateBatOutsideEdgeScreenPos,
} from "../instinct/actorRigs";

interface SlipCamReplayViewProps {
  caughtBehind: CaughtBehindData;
  currentTimeMs: number;
  scenario?: Scenario;
}

/**
 * CAM 01 — Slip Cam Broadcast Replay (Phase 2 Forensic Camera).
 *
 * Consumes the exact same authoritative 3D delivery trajectory as UltraEdge and HotSpot.
 * Enables third umpire review of the delivery flight, pitch bounce, bat outside edge pass,
 * and wicketkeeper carry synchronized with the console timeline.
 */
export const SlipCamReplayView: React.FC<SlipCamReplayViewProps> = ({
  caughtBehind,
  currentTimeMs,
  scenario,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Perspective Stations
    const CAM_X = 6.0;
    const HORIZON_H = 0.16;
    const PERSP_K = 3.48;
    const EYE_D0 = 1.0;
    const WORLD_STUMPS_X = 0;
    const WORLD_POPPING_CREASE_X = 1.22;
    const WORLD_BATTER_GUARD_X = 1.06;
    const WORLD_KEEPER_X = -1.8;
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

    // Turf & Pitch Strip
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

    // Crease Lines
    const stumpsY = groundY(WORLD_STUMPS_X);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_STUMPS_X) * 0.9, stumpsY + 2);
    ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_STUMPS_X) * 0.9, stumpsY + 2);
    ctx.stroke();

    const creaseY = groundY(WORLD_POPPING_CREASE_X);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_POPPING_CREASE_X) * 0.95, creaseY);
    ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_POPPING_CREASE_X) * 0.95, creaseY);
    ctx.stroke();

    // Normalized progress p from canonical timeline (600ms to 2200ms)
    const p = Math.max(0, Math.min(1, (currentTimeMs - 600) / 1600));

    // Wicketkeeper stationed directly behind striker stumps in a fixed, planted stance
    const keeperX = w * 0.47;
    const keeperY = groundY(WORLD_KEEPER_X);
    const keeperScale = actorScale(WORLD_KEEPER_X);
    const keeperK = solveCaughtBehindKeeperKinematics(p, caughtBehind.hasEdge);
    drawArticulatedWicketkeeper(
      ctx,
      { x: keeperX, y: keeperY, scale: keeperScale, facing: "RIGHT" },
      keeperK
    );

    // Striker Stumps
    drawStumpsAndBails(ctx, CORRIDOR_CX, stumpsY + 2, {
      scale: actorScale(WORLD_STUMPS_X),
    });

    // Batter
    const batterX = w * 0.52;
    const batterY = groundY(WORLD_BATTER_GUARD_X);
    const batterK = solveCaughtBehindBatterKinematics(
      p,
      scenario?.initialEvidence?.caughtBehind?.shotType,
      scenario?.initialEvidence?.caughtBehind?.batAngleDeg ?? 14
    );
    const transitP = Math.max(0, Math.min(1, (1200 - 600) / 1600));
    const transitBatterK = solveCaughtBehindBatterKinematics(
      transitP,
      scenario?.initialEvidence?.caughtBehind?.shotType,
      scenario?.initialEvidence?.caughtBehind?.batAngleDeg ?? 14
    );
    const { batEdgeX, batEdgeY } = calculateBatOutsideEdgeScreenPos(
      batterX,
      batterY,
      transitBatterK,
      BATTER_RIG_SCALE,
      "LEFT"
    );

    // Terminal glove endpoint from the keeper rig
    const gloveX = keeperX + 14 * keeperScale;
    const gloveY = keeperY + keeperK.gloveY * keeperScale;

    // Calibrated 2.5D visual delivery corridor across four physical anchors:
    // Release (800ms) -> Bounce (1050ms) -> Bat Transit (1200ms) -> Keeper Gloves (1300ms)
    const current = solveCaughtBehindSlipCorridor(
      caughtBehind,
      currentTimeMs,
      w,
      h,
      batEdgeX,
      batEdgeY,
      gloveX,
      gloveY
    );
    const past = solveCaughtBehindSlipCorridor(
      caughtBehind,
      Math.max(600, currentTimeMs - 24),
      w,
      h,
      batEdgeX,
      batEdgeY,
      gloveX,
      gloveY
    );

    drawCricketBall(ctx, current.x, current.y, {
      radius: current.radius,
      seamAngleRad: (currentTimeMs / 1000) * Math.PI * 6,
      shadowY: current.y + 24,
      motionTrail: currentTimeMs >= 850 && currentTimeMs <= 1350,
      prevX: past.x,
      prevY: past.y,
    });

    // Batter drawn in foreground
    drawArticulatedBatter(
      ctx,
      { x: batterX, y: batterY, scale: BATTER_RIG_SCALE, facing: "LEFT" },
      batterK
    );
  }, [caughtBehind, currentTimeMs, scenario]);

  const transitMs = caughtBehind.ballPassesBatFrameMs || 1200;
  const isAtTransit = Math.abs(currentTimeMs - transitMs) <= 30;

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Monitor Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 01 • SLIP CORDON BROADCAST REPLAY
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-emerald-300 font-semibold">
            500 FPS HIGH-SPEED OPTICAL
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAtTransit && (
            <span className="text-[10px] bg-cyan-950/80 text-cyan-300 font-bold px-2 py-0.5 rounded border border-cyan-800 animate-pulse">
              BAT-PLANE TRANSIT
            </span>
          )}
          <span className="text-xs font-bold text-slate-400">
            {currentTimeMs.toFixed(0)} ms
          </span>
        </div>
      </div>

      {/* Main Video Viewport */}
      <div className="relative flex-1 rounded-lg border border-slate-800 overflow-hidden my-2 flex items-center justify-center bg-[#0a140d]">
        <canvas
          ref={canvasRef}
          width={640}
          height={360}
          className="w-full h-full object-contain"
        />

        {/* Broadcast HUD overlay */}
        <div className="absolute top-2 left-2 z-20 flex items-center gap-2">
          <span className="text-[9px] font-mono font-bold bg-black/75 text-white px-2 py-0.5 rounded border border-white/10">
            CAM 01 • LIVE TRACKING
          </span>
        </div>
      </div>

      {/* Footer Telemetry */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">FRAME RATE</div>
          <div className="text-[11px] font-black text-emerald-300">500 FPS SHUTTER</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">OPTICAL PERSPECTIVE</div>
          <div className="text-[11px] font-black text-cyan-300">OFF-SIDE SLIP CORRIDOR</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">DELIVERY SYNCHRONIZATION</div>
          <div className="text-[11px] font-black text-slate-200">100% CANONICAL TRAJECTORY</div>
        </div>
      </div>
    </div>
  );
};
