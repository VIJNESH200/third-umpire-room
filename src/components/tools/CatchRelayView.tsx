import React, { useRef, useEffect } from "react";
import type { BoundaryData } from "../../types/scenario";
import {
  solveBoundaryReplayState,
  projectWideRelayCoords,
  resolveBoundaryArchetype,
} from "../../engine/boundaryPhysics";
import {
  drawAthleticBoundaryFielder,
  drawCricketBall,
  clamp,
} from "../instinct/actorRigs";

interface CatchRelayViewProps {
  boundary: BoundaryData;
  currentTimeMs: number;
}

export const CatchRelayView: React.FC<CatchRelayViewProps> = ({
  boundary,
  currentTimeMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const VIEW_W = 500;
  const VIEW_H = 320;

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Solve canonical physical state
    const state = solveBoundaryReplayState(boundary, currentTimeMs);
    const archetype = resolveBoundaryArchetype(boundary);

    // Clear
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    // ─── Background: outfield turf ───
    const turfGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    turfGrad.addColorStop(0, "#1a3827");
    turfGrad.addColorStop(0.6, "#163020");
    turfGrad.addColorStop(1, "#10251a");
    ctx.fillStyle = turfGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Mow stripes
    ctx.globalAlpha = 0.05;
    for (let sy = 0; sy < VIEW_H; sy += 20) {
      ctx.fillStyle = sy % 40 === 0 ? "#2a5e38" : "#1a3d25";
      ctx.fillRect(0, sy, VIEW_W, 20);
    }
    ctx.globalAlpha = 1.0;

    // ─── Boundary rope/cushion area ───
    // worldX = 0 (cushion front) maps to screenX ~ 350
    const cushionScreenX = projectWideRelayCoords(0.0, 0.0, 0.0, VIEW_W, VIEW_H).screenX;

    // Out-of-bounds zone behind rope
    ctx.fillStyle = "#09140e";
    ctx.fillRect(cushionScreenX + 12, 0, VIEW_W - cushionScreenX - 12, VIEW_H);

    // Boundary foam cushion strip (vertical in wide cam)
    const cushGrad = ctx.createLinearGradient(cushionScreenX, 0, cushionScreenX + 12, 0);
    cushGrad.addColorStop(0, "#f59e0b");
    cushGrad.addColorStop(0.5, "#d97706");
    cushGrad.addColorStop(1, "#b45309");
    ctx.fillStyle = cushGrad;
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.roundRect(cushionScreenX, 40, 12, VIEW_H - 80, 2);
    ctx.fill();
    ctx.stroke();

    // White boundary line behind cushion
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cushionScreenX + 14, 40);
    ctx.lineTo(cushionScreenX + 14, VIEW_H - 40);
    ctx.stroke();

    // Guide line (pursuit baseline)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H * 0.62);
    ctx.lineTo(cushionScreenX, VIEW_H * 0.62);
    ctx.stroke();
    ctx.setLineDash([]);

    // ─── Partner Fielder (relay scenarios) ───
    if (state.partnerFielder) {
      const partnerScreen = projectWideRelayCoords(
        state.partnerFielder.x,
        state.partnerFielder.y,
        state.partnerFielder.z,
        VIEW_W,
        VIEW_H
      );

      drawAthleticBoundaryFielder(ctx, {
        x: clamp(partnerScreen.screenX, 30, VIEW_W - 30),
        y: clamp(partnerScreen.screenY, 30, VIEW_H - 30),
        scale: 1.1,
        facing: "RIGHT",
      }, {
        pose: state.partnerFielder.hasCaughtBall ? "PARTNER_GATHER" : "SPRINT",
        elevationM: state.partnerFielder.z,
        jerseyColor: "#1e3a5f",
      });
    }

    // ─── Primary Fielder ───
    const fielderScreen = projectWideRelayCoords(
      state.primaryFielder.x,
      0.0,
      state.primaryFielder.z,
      VIEW_W,
      VIEW_H
    );

    // Determine pose
    let pose: "SPRINT" | "AIRBORNE" | "SLIDE" | "RELAY_FLICK" | "PARTNER_GATHER" = "SPRINT";
    if (state.phase === "ROPE_TRANSIT" || state.phase === "COMPLETION") {
      pose = state.primaryFielder.isSliding ? "SLIDE" : "SPRINT";
    } else if (state.phase === "RELAY_AIRBORNE") {
      pose = "RELAY_FLICK";
    } else if (state.phase === "INTERCEPTION" || state.phase === "CATCH_CONTROL") {
      if (state.primaryFielder.isAirborne) {
        pose = "AIRBORNE";
      } else if (state.primaryFielder.isSliding) {
        pose = "SLIDE";
      }
    }
    if (archetype === "AIRBORNE_RELAY" && state.primaryFielder.isAirborne) {
      pose = "AIRBORNE";
    }

    drawAthleticBoundaryFielder(ctx, {
      x: clamp(fielderScreen.screenX, 30, VIEW_W - 30),
      y: clamp(fielderScreen.screenY, 30, VIEW_H - 30),
      scale: 1.3,
      facing: "RIGHT",
    }, {
      pose,
      torsoAngleRad: state.primaryFielder.torsoAngleRad,
      elevationM: state.primaryFielder.z,
    });

    // ─── Cricket Ball ───
    const ballScreen = projectWideRelayCoords(
      state.ball.x,
      state.ball.y,
      state.ball.z,
      VIEW_W,
      VIEW_H
    );

    if (state.ball.x > -8.0) {
      drawCricketBall(ctx,
        clamp(ballScreen.screenX, 10, VIEW_W - 10),
        clamp(ballScreen.screenY, 10, VIEW_H - 10),
        {
          radius: ballScreen.radiusPx,
          seamAngleRad: currentTimeMs * 0.008,
          motionTrail: state.ball.isInFlight,
        }
      );
    }

    // ─── Ball trajectory trace (relay toss arc) ───
    if (state.ball.isRelayed && state.ball.isInFlight && state.partnerFielder) {
      const startScreen = projectWideRelayCoords(
        state.primaryFielder.handsPoint.x,
        state.primaryFielder.handsPoint.y,
        state.primaryFielder.handsPoint.z,
        VIEW_W, VIEW_H
      );
      const endScreen = projectWideRelayCoords(
        state.partnerFielder.handsPoint.x,
        state.partnerFielder.handsPoint.y,
        state.partnerFielder.handsPoint.z,
        VIEW_W, VIEW_H
      );

      ctx.save();
      ctx.strokeStyle = "rgba(220, 38, 38, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(startScreen.screenX, startScreen.screenY);
      const midX = (startScreen.screenX + endScreen.screenX) / 2;
      const midY = Math.min(startScreen.screenY, endScreen.screenY) - 30;
      ctx.quadraticCurveTo(midX, midY, endScreen.screenX, endScreen.screenY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // ─── Cushion contact indicator ───
    if (state.cushion.isContacted) {
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(currentTimeMs * 0.012);
      ctx.fillStyle = "#FACC15";
      ctx.beginPath();
      ctx.arc(cushionScreenX + 6, fielderScreen.screenY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(cushionScreenX + 6, fielderScreen.screenY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

  }, [boundary, currentTimeMs]);

  // Phase label for neutral telemetry overlay
  const state = solveBoundaryReplayState(boundary, currentTimeMs);
  const archetype = resolveBoundaryArchetype(boundary);

  const phaseLabel = (() => {
    switch (state.phase) {
      case "PURSUIT": return "FIELDER PURSUIT";
      case "INTERCEPTION": return "INTERCEPTION";
      case "CATCH_CONTROL": return "CATCH GATHERING";
      case "ROPE_TRANSIT": return "BOUNDARY PROXIMITY";
      case "RELAY_AIRBORNE": return "AERIAL RELAY";
      case "COMPLETION": return "SEQUENCE COMPLETE";
      default: return "TRACKING";
    }
  })();

  const archetypeLabel = (() => {
    switch (archetype) {
      case "SLIDING_CATCH": return "SLIDING BOUNDARY";
      case "AIRBORNE_RELAY": return "AIRBORNE RELAY";
      case "RUNNING_ROPE_CATCH": return "RUNNING BOUNDARY";
      default: return "BOUNDARY";
    }
  })();

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 09 • BROADCAST WIDE BOUNDARY RELAY CAM
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 1080P 50FPS
          </span>
        </div>

        <div className="text-[11px] text-slate-400">
          TRACKING: <span className="text-cyan-300 font-bold">{archetypeLabel}</span>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 min-h-0 mt-2 bg-gradient-to-b from-[#0e1a24] via-[#09121a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="w-full h-full object-contain z-10"
          style={{ imageRendering: "auto" }}
        />

        {/* Neutral phase telemetry overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-xs font-bold border backdrop-blur-md shadow-lg bg-slate-950/90 border-slate-700 text-slate-300">
            {phaseLabel}
          </div>
        </div>
      </div>
    </div>
  );
};
