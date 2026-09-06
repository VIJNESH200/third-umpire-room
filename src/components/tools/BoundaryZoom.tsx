import React, { useRef, useEffect, useState } from "react";
import type { BoundaryData } from "../../types/scenario";
import { ZoomIn, Crosshair } from "lucide-react";
import {
  solveBoundaryReplayState,
  projectMacroBoundaryCoords,
  resolveBoundaryArchetype,
} from "../../engine/boundaryPhysics";
import {
  drawAthleticBoundaryFielder,
  drawCricketBall,
  clamp,
} from "../instinct/actorRigs";

interface BoundaryZoomProps {
  boundary: BoundaryData;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
}

export const BoundaryZoom: React.FC<BoundaryZoomProps> = ({
  boundary,
  currentTimeMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [showGuide, setShowGuide] = useState<boolean>(true);

  const VIEW_W = 500;
  const VIEW_H = 280;

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

    // ─── Background: outfield turf gradient ───
    const turfGrad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    turfGrad.addColorStop(0, "#1a3625");
    turfGrad.addColorStop(0.55, "#163020");
    turfGrad.addColorStop(1, "#0c1810");
    ctx.fillStyle = turfGrad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // ─── Boundary Cushion (realistic foam wedge) ───
    // Cushion front edge is at worldX = 0.0m → screenX = 250
    const cushionFront = projectMacroBoundaryCoords(0.0, 0.0, VIEW_W, VIEW_H);
    const cushionBackX = projectMacroBoundaryCoords(0.25, 0.0, VIEW_W, VIEW_H).screenX; // 250mm = 0.25m wide
    const cushionTopY = projectMacroBoundaryCoords(0.0, 0.20, VIEW_W, VIEW_H).screenY; // 200mm = 0.20m high
    const groundY = cushionFront.screenY;

    // Ground line
    ctx.strokeStyle = "#254a33";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(VIEW_W, groundY);
    ctx.stroke();

    // Mow stripe pattern
    ctx.globalAlpha = 0.06;
    for (let sx = 0; sx < VIEW_W; sx += 28) {
      ctx.fillStyle = sx % 56 === 0 ? "#2a5e38" : "#1a3d25";
      ctx.fillRect(sx, 0, 28, groundY);
    }
    ctx.globalAlpha = 1.0;

    // Compression deformation
    const compressionPx = state.cushion.compressionMm * 0.4; // 1mm = 0.4px

    // Foam cushion body — trapezoidal wedge
    const cushGrad = ctx.createLinearGradient(cushionFront.screenX, cushionTopY, cushionBackX, groundY);
    cushGrad.addColorStop(0, "#f59e0b");
    cushGrad.addColorStop(0.5, "#d97706");
    cushGrad.addColorStop(1, "#b45309");
    ctx.fillStyle = cushGrad;
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Top face (slightly compressed inward)
    ctx.moveTo(cushionFront.screenX + compressionPx, cushionTopY);
    ctx.lineTo(cushionBackX, cushionTopY + 4);
    // Right face (ground)
    ctx.lineTo(cushionBackX + 8, groundY);
    // Bottom
    ctx.lineTo(cushionFront.screenX - 4, groundY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // White boundary line behind cushion
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cushionBackX + 10, groundY - 40);
    ctx.lineTo(cushionBackX + 10, groundY + 30);
    ctx.stroke();

    // ─── Laser Guide Alignment Line ───
    if (showGuide) {
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 1.0;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(cushionFront.screenX, 20);
      ctx.lineTo(cushionFront.screenX, VIEW_H - 20);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ─── Primary Fielder & Lead-Boot Anchor Contract (P1) ───
    const bootScreen = projectMacroBoundaryCoords(
      state.primaryFielder.bootPoint.x,
      state.primaryFielder.bootPoint.z,
      VIEW_W,
      VIEW_H
    );

    // Determine pose from phase
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
    } else if (state.phase === "PURSUIT") {
      pose = "SPRINT";
    }
    // Override: for AIRBORNE_RELAY archetype during aerial phase
    if (archetype === "AIRBORNE_RELAY" && state.primaryFielder.isAirborne) {
      pose = "AIRBORNE";
    }

    // Lead-boot anchor calibration: align athletic rig's rendered lead foot exactly with bootScreen
    const leadFootRigOffset =
      (pose === "SLIDE" ? 32 : pose === "AIRBORNE" || pose === "RELAY_FLICK" ? 16 : 14) * 1.6;
    const rigScreenX = bootScreen.screenX - leadFootRigOffset;

    drawAthleticBoundaryFielder(ctx, {
      x: clamp(rigScreenX, -80, VIEW_W + 80),
      y: clamp(bootScreen.screenY, 40, groundY),
      scale: 1.6,
      facing: "RIGHT",
    }, {
      pose,
      torsoAngleRad: state.primaryFielder.torsoAngleRad,
      elevationM: state.primaryFielder.z,
    });

    // ─── Cricket Ball ───
    const ballScreen = projectMacroBoundaryCoords(
      state.ball.x,
      state.ball.z,
      VIEW_W,
      VIEW_H
    );

    // Only render ball if it's near the macro frame (not way out in outfield)
    if (state.ball.x > -2.0) {
      drawCricketBall(ctx, ballScreen.screenX, ballScreen.screenY, {
        radius: 7,
        seamAngleRad: currentTimeMs * 0.006,
        shadowY: groundY,
      });
    }

    // ─── Contact flash when cushion is contacted ───
    if (state.cushion.isContacted) {
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(currentTimeMs * 0.015);
      ctx.fillStyle = "#FACC15";
      ctx.beginPath();
      ctx.arc(cushionFront.screenX, groundY, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(cushionFront.screenX, groundY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ─── Boot-to-cushion measurement line (neutral telemetry - P3) ───
    if (state.phase !== "PURSUIT" && showGuide) {
      ctx.save();
      ctx.strokeStyle = "#38BDF8";
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(bootScreen.screenX, bootScreen.screenY);
      ctx.lineTo(cushionFront.screenX, bootScreen.screenY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Clearance measurement label (mm value only — neutral cyan, no verdict signaling)
      const clearanceMm = state.primaryFielder.cushionClearanceMm;
      const labelX = (bootScreen.screenX + cushionFront.screenX) / 2;
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = "#38BDF8";
      ctx.fillText(
        `${clearanceMm >= 0 ? "+" : ""}${clearanceMm.toFixed(0)}mm`,
        labelX,
        bootScreen.screenY - 6
      );
      ctx.restore();
    }

  }, [boundary, currentTimeMs, zoomLevel, showGuide]);

  // Determine current phase for neutral status display
  const state = solveBoundaryReplayState(boundary, currentTimeMs);

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

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 05 • 4K ULTRA-HD BOUNDARY CUSHION ZOOM
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 4K 50FPS
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowGuide(!showGuide)}
            className={`tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
              showGuide ? "text-cyan-300 border-cyan-500/50 bg-cyan-950/40" : "text-slate-400"
            }`}
          >
            <Crosshair size={12} className="text-cyan-400" />
            <span>{showGuide ? "LASER ON" : "LASER OFF"}</span>
          </button>

          <button
            onClick={() => setZoomLevel(zoomLevel === 1.0 ? 1.4 : 1.0)}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-300 flex items-center gap-1"
          >
            <ZoomIn size={12} className="text-amber-400" />
            <span>{zoomLevel.toFixed(1)}x</span>
          </button>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative flex-1 min-h-0 mt-2 bg-gradient-to-b from-[#09111c] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <canvas
          ref={canvasRef}
          width={VIEW_W}
          height={VIEW_H}
          className="w-full h-full object-contain transition-transform duration-150 z-10"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "250px 70%",
            imageRendering: "auto",
          }}
        />

        {/* Neutral phase telemetry overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-[11px] font-bold border backdrop-blur-md shadow-lg bg-slate-950/90 border-slate-700 text-slate-300">
            {phaseLabel}
          </div>
        </div>
      </div>
    </div>
  );
};
