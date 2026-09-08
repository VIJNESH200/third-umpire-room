import React, { useEffect, useRef } from "react";
import type { StumpingData } from "../../types/scenario";
import { solveStumpingReplayState } from "../../engine/stumpingPhysics";
import {
  clamp,
  solveStumpingKeeperKinematics,
  solveStumpingBatterKinematics,
  drawArticulatedBatter,
  drawArticulatedWicketkeeper,
  drawStumpsAndBails,
  drawCricketBall,
} from "../instinct/actorRigs";

interface StumpingSideOnKeeperViewProps {
  stumping: StumpingData;
  currentTimeMs: number;
}

export const StumpingSideOnKeeperView: React.FC<StumpingSideOnKeeperViewProps> = ({
  stumping,
  currentTimeMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canonical physical replay state
  const state = solveStumpingReplayState(stumping, currentTimeMs);
  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    // --- 1. Outfield Grass ---
    const gradGrass = ctx.createLinearGradient(0, 0, 0, H);
    gradGrass.addColorStop(0, "#132b1c");
    gradGrass.addColorStop(0.5, "#183824");
    gradGrass.addColorStop(1, "#0d1e13");
    ctx.fillStyle = gradGrass;
    ctx.fillRect(0, 0, W, H);

    // --- 2. 22-Yard Pitch Strip ---
    const pitchTopY = H * 0.52;
    const pitchHeight = H * 0.48;

    const gradPitch = ctx.createLinearGradient(0, pitchTopY, 0, H);
    gradPitch.addColorStop(0, "#ba9c77");
    gradPitch.addColorStop(0.5, "#a68862");
    gradPitch.addColorStop(1, "#8a6d49");
    ctx.fillStyle = gradPitch;
    ctx.fillRect(0, pitchTopY, W, pitchHeight);

    ctx.strokeStyle = "#4d3d29";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, pitchTopY);
    ctx.lineTo(W, pitchTopY);
    ctx.stroke();

    // --- 3. Painted White Creases ---
    const creaseX = W * 0.46;
    const stumpsX = W * 0.28;
    const stumpsBaseY = pitchTopY + 6;

    // Bowling crease line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(stumpsX, pitchTopY);
    ctx.lineTo(stumpsX, H);
    ctx.stroke();

    // Popping crease line
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(creaseX - 2.5, pitchTopY, 5, pitchHeight);

    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.font = "bold 8px monospace";
    ctx.fillText("POPPING CREASE", creaseX + 6, pitchTopY + 18);
    ctx.restore();

    const p = clamp(currentTimeMs / 2200, 0, 1);

    // --- 4. Striker Stumps & Zing Bails ---
    const bailsBroke = state.stumps.bailsSeparating;
    const dislodgeProgress = clamp(
      (currentTimeMs - state.timeline.bailsDislodgedMs) / 300,
      0,
      1
    );

    drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, {
      scale: 1.15,
      bailsDislodged: bailsBroke,
      dislodgeProgress,
      isZing: true,
    });

    // --- 5. Wicketkeeper Stumping Whip Kinematics ---
    const keeperK = solveStumpingKeeperKinematics(p);
    drawArticulatedWicketkeeper(
      ctx,
      { x: stumpsX - 22, y: stumpsBaseY + 4, scale: 1.15, facing: "RIGHT" },
      keeperK
    );

    // --- 6. Batter Stationary Stance with Rear-Leg Pendulum Kinematics ---
    const marginPx = state.batter.isGrounded ? -10 : 10;
    const stumpingResult = solveStumpingBatterKinematics(p, creaseX, marginPx);

    drawArticulatedBatter(
      ctx,
      { x: stumpingResult.batterX, y: stumpsBaseY + 8, scale: 1.15, facing: "RIGHT" },
      stumpingResult.batterK
    );

    // --- 7. Ball Flight to Wicketkeeper Gloves ---
    if (state.ball.isInFlight) {
      const t = state.ball.flightProgress;
      const originX = W * 0.88;
      const originY = H * 0.32;
      const targetX = stumpsX - 22 + keeperK.gloveX * 1.15;
      const targetY = stumpsBaseY + 4 + keeperK.gloveY * 1.15;

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
    } else {
      // Secured in keeper's gloves
      const gloveBallX = stumpsX - 22 + keeperK.gloveX * 1.15;
      const gloveBallY = stumpsBaseY + 4 + keeperK.gloveY * 1.15;
      drawCricketBall(ctx, gloveBallX, gloveBallY, {
        radius: 4.5,
        seamAngleRad: 0.2,
        motionTrail: false,
      });
    }
  }, [state, currentTimeMs]);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-1.5 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 01 • SIDE-ON KEEPER (STUMPING)
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 1080P 50FPS
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/40 px-2 py-0.5 rounded">
            STRIKER END
          </span>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 min-h-0 mt-1 bg-gradient-to-b from-[#09151e] via-[#060e15] to-[#03070b] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full object-contain z-10"
        />
      </div>
    </div>
  );
};
