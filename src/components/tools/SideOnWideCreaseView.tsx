import React, { useEffect, useRef } from "react";
import type { RunOutData } from "../../types/scenario";
import { solveRunOutReplayState } from "../../engine/runOutPhysics";
import { projectToCAM01 } from "../../engine/cameraProjections";
import { clamp } from "../instinct/actorRigs";
import {
  drawArticulatedRunner,
  drawArticulatedWicketkeeper,
  drawStumpsAndBails,
  drawCricketBall,
} from "../instinct/actorRigs";

interface SideOnWideCreaseViewProps {
  runOut: RunOutData;
  currentTimeMs: number;
}

// Rig constants: the articulated runner rig is drawn at this scale, facing the
// crease (LEFT). Local rig +x is "forward" (toward the stumps on screen).
const RUNNER_SCALE = 1.1;
const RUNNER_FACING = -1;

/**
 * CAM 01 • BROADCAST SIDE-ON WIDE ANGLE
 *
 * Every actor is rendered from the SAME canonical RunOutReplayState as
 * CAM 02 / CAM 07 / CAM 10 at the same canonical timestamp:
 *   - runner body & pose  ← state.runner (world position + forward-kinematic tree)
 *   - bat                 ← state.bat world tip anchored through the runner's hands
 *   - keeper              ← state.keeper (world position + gather kinematics)
 *   - ball                ← state.ball (world position, with motion trail)
 *   - Zing bails          ← state.stumps + canonical timeline
 * Only the projection/framing is CAM 01-specific (projectToCAM01).
 */
export const SideOnWideCreaseView: React.FC<SideOnWideCreaseViewProps> = ({
  runOut,
  currentTimeMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // Canonical shared physical replay state
    const state = solveRunOutReplayState(runOut, currentTimeMs);

    ctx.clearRect(0, 0, W, H);

    // --- 1. Outfield Turf ---
    const gradTurf = ctx.createLinearGradient(0, 0, 0, H);
    gradTurf.addColorStop(0, "#173322");
    gradTurf.addColorStop(1, "#0e2015");
    ctx.fillStyle = gradTurf;
    ctx.fillRect(0, 0, W, H);

    // --- 2. Pitch Strip (Side-On Band) ---
    const gradPitch = ctx.createLinearGradient(0, 210, 0, H);
    gradPitch.addColorStop(0, "#a88e6b");
    gradPitch.addColorStop(1, "#8a7353");
    ctx.fillStyle = gradPitch;
    ctx.fillRect(0, 210, W, H - 210);
    ctx.strokeStyle = "#6e5c43";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 210);
    ctx.lineTo(W, 210);
    ctx.stroke();

    // --- 3. Painted Creases (worldX anchors via projectToCAM01) ---
    const creaseProj = projectToCAM01(1220, 0, 0);
    const bowlingCreaseProj = projectToCAM01(0, 0, 0);

    // Popping crease white band
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(creaseProj.screenX - 2, 210, 4, H - 210);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    ctx.font = "bold 8px monospace";
    ctx.fillText("POPPING CREASE", creaseProj.screenX + 6, 225);

    // Bowling crease line (through the stumps)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bowlingCreaseProj.screenX, 210);
    ctx.lineTo(bowlingCreaseProj.screenX, H);
    ctx.stroke();

    // --- 4. Wicketkeeper (behind the stumps; canonical gather kinematics) ---
    const keeperProj = projectToCAM01(
      state.keeper.worldX,
      state.keeper.worldY,
      state.keeper.worldZ
    );
    drawArticulatedWicketkeeper(
      ctx,
      { x: keeperProj.screenX, y: keeperProj.screenY, scale: 1.0, facing: "RIGHT" },
      state.keeper.kinematics
    );

    // --- 5. Striker Stumps & Zing Bails (canonical bail state) ---
    const dislodgeProgress = clamp(state.stumps.bailRotationDeg / 55, 0, 1);
    drawStumpsAndBails(ctx, bowlingCreaseProj.screenX, 210, {
      scale: 1.15,
      bailsDislodged: state.stumps.bailsSeparating,
      dislodgeProgress,
      isZing: true,
    });

    // --- 6. Incoming Throw (canonical ball world position + trail) ---
    const ballProj = projectToCAM01(state.ball.worldX, state.ball.worldY, state.ball.worldZ);
    const prevState = solveRunOutReplayState(runOut, Math.max(600, currentTimeMs - 20));
    const prevBallProj = projectToCAM01(
      prevState.ball.worldX,
      prevState.ball.worldY,
      prevState.ball.worldZ
    );
    drawCricketBall(ctx, ballProj.screenX, ballProj.screenY, {
      radius: 4.5,
      seamAngleRad: (currentTimeMs / 1000) * Math.PI * 10,
      motionTrail: state.ball.throwProgress > 0.05,
      prevX: prevBallProj.screenX,
      prevY: prevBallProj.screenY,
    });

    // --- 7. Runner (canonical world position + forward-kinematic rig) ---
    const runnerProj = projectToCAM01(
      state.runner.worldX,
      state.runner.worldY,
      state.runner.worldZ
    );

    // Anchor the rig's bat to the canonical world-space bat tip once the reach
    // phase begins, so the bat location matches CAM 02 / CAM 07 / CAM 10 exactly
    // while remaining connected to the runner's hands.
    let batTipLocal: { x: number; y: number } | undefined;
    if (state.currentTimeMs >= state.timeline.batReachStartMs - 80) {
      const tipProj = projectToCAM01(state.bat.tipWorldX, state.bat.tipWorldY, state.bat.tipWorldZ);
      const local = {
        x: (tipProj.screenX - runnerProj.screenX) / (RUNNER_FACING * RUNNER_SCALE),
        y: (tipProj.screenY - runnerProj.screenY) / RUNNER_SCALE,
      };
      // Only anchor when the canonical tip is at/ahead of the hands — otherwise
      // the runner still carries the bat in the natural grip pose.
      if (local.x > -6) {
        batTipLocal = local;
      }
    }

    drawArticulatedRunner(
      ctx,
      { x: runnerProj.screenX, y: runnerProj.screenY, scale: RUNNER_SCALE, facing: "LEFT" },
      state.runner.kinematics,
      { batTipLocal }
    );
  }, [runOut, currentTimeMs]);

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 01 • BROADCAST SIDE-ON WIDE ANGLE
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 1080P 50FPS
          </span>
        </div>

        <div className="text-[11px] text-slate-400">
          THROW: <span className="text-cyan-300 font-bold">{runOut.fielderThrow}</span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#0e1824] via-[#09101a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <canvas
          ref={canvasRef}
          width={500}
          height={320}
          className="w-full h-full max-h-[340px] object-contain z-10"
        />

        {/* Real-time Camera Feed Overlay */}
        <div className="absolute top-2.5 left-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono backdrop-blur-sm z-20">
          <span className="text-slate-400 font-bold">CAMERA: </span>
          <span className="text-cyan-300 font-bold">
            SIDE-ON WIDE (1080P 50FPS)
          </span>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">VIEW ANGLE</div>
          <div className="text-[11px] font-black text-slate-200">SIDE-ON WIDE (CAM 01)</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">FRAME RATE</div>
          <div className="text-[11px] font-black text-cyan-300">50 FPS HIGH-DEFINITION</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">DIVE TECHNIQUE</div>
          <div className="text-[11px] font-black text-amber-300">{runOut.diveType}</div>
        </div>
      </div>
    </div>
  );
};
