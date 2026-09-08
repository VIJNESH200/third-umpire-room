import React, { useState } from "react";
import type { RunOutData, IncidentType } from "../../types/scenario";
import { solveRunOutReplayState } from "../../engine/runOutPhysics";
import { projectToCAM02 } from "../../engine/cameraProjections";
import { ZoomIn, Crosshair, Zap } from "lucide-react";

interface CreaseZoomProps {
  runOut: RunOutData;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
  incidentType?: IncidentType;
}

export const CreaseZoom: React.FC<CreaseZoomProps> = ({
  runOut,
  currentTimeMs,
  incidentType,
}) => {
  const [opticalZoom, setOpticalZoom] = useState<"1.0x" | "1.5x">("1.0x");
  const [showLaser, setShowLaser] = useState<boolean>(true);

  // Canonical shared physical replay state
  const state = solveRunOutReplayState(runOut, currentTimeMs);

  // Projection Geometry:
  // Crease is at X = 250 (popping crease reference line)
  // Stumps are at X = 160
  const creaseX = 250;
  const stumpsX = 160;

  // Project bat tip and handle from canonical world-space through CAM 02 camera
  const batTipProj = projectToCAM02(state.bat.tipWorldX, state.bat.tipWorldY, state.bat.tipWorldZ);
  const batTipX = batTipProj.screenX;

  // Project bat altitude from canonical state (0 = grounded)
  const batAltitude = state.bat.tipAltitudeMm * 0.85;

  // Project Zing bails from canonical state
  const bailsDislodged = state.stumps.bailsSeparating;
  const bailDisplacementY = state.stumps.bailDisplacementMm.z * 0.14;
  const bailRotation = state.stumps.bailRotationDeg;

  // Virtual 500 FPS frame counter
  const currentFrame = Math.round((currentTimeMs / 1000) * 500);

  // Action-prioritized dynamic camera framing
  // 1.0x Wide: Frames stumps, bails, popping crease, and bat reach tightly without dead sky
  // 1.5x Close: Magnifies crease crossing and bail separation with native vector sharpness
  const activeViewBox = opticalZoom === "1.5x" ? "125 90 250 165" : "80 65 340 205";

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-1.5 select-none font-mono text-slate-200">
      {/* Top Monitor Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            {incidentType === "STUMPING"
              ? "CAM 02 • 500 FPS STUMPING / CREASE"
              : "CAM 02 • 500 FPS HIGH-SPEED POPPING CREASE"}
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} / 1100 • 500FPS
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Crease Laser Guide Toggle */}
          <button
            onClick={() => setShowLaser(!showLaser)}
            className={`tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showLaser ? "text-cyan-300 border-cyan-500/50 bg-cyan-950/40" : "text-slate-400"
            }`}
          >
            <Crosshair size={12} className={showLaser ? "text-cyan-400" : "text-slate-500"} />
            <span>Crease Guide</span>
          </button>

          {/* Optical Zoom Toggle */}
          <button
            onClick={() => setOpticalZoom(opticalZoom === "1.0x" ? "1.5x" : "1.0x")}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-200 hover:text-white flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <ZoomIn size={12} className="text-amber-400" />
            <span>{opticalZoom}</span>
          </button>
        </div>
      </div>

      {/* Main Slow-Mo Canvas */}
      <div className="relative flex-1 min-h-0 mt-1 bg-gradient-to-b from-[#09111c] via-[#060c14] to-[#03060a] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg
          viewBox={activeViewBox}
          className="w-full h-full object-contain transition-all duration-200 z-10"
        >
          <defs>
            {/* Natural Grass Turf Gradient */}
            <linearGradient id="creaseGrass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a28" />
              <stop offset="100%" stopColor="#12251a" />
            </linearGradient>

            {/* Willow Wood Texture Gradient */}
            <linearGradient id="willowGrain" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="40%" stopColor="#c2710c" />
              <stop offset="70%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>

          {/* Turf Surface — spans seamlessly across full pitch canvas */}
          <rect x="-200" y="195" width="900" height="150" fill="url(#creaseGrass)" />
          <line x1="-200" y1="195" x2="700" y2="195" stroke="#2a4d38" strokeWidth="1.5" />

          {/* Painted White Popping Crease Line */}
          <rect x={creaseX - 2} y="195" width="4" height="120" fill="#FFFFFF" opacity="0.95" />
          <text x={creaseX - 35} y="188" fill="#38BDF8" fontSize="8" fontFamily="monospace" fontWeight="bold">
            POPPING CREASE
          </text>

          {/* Laser Guide Beam Alignment */}
          {showLaser && (
            <line
              x1={creaseX}
              y1="40"
              x2={creaseX}
              y2="300"
              stroke="#00E5FF"
              strokeWidth="1.2"
              strokeDasharray="4 2"
              opacity="0.85"
            />
          )}

          {/* Neutral Optical Millimetre Reference Scale — anchored to the crease line.
              Derived from the CAM 02 projection itself (stumps 0 → crease 1220mm spans
              90 screen px), so ticks are physically accurate. Measurement reference
              only: it never states where the bat is relative to the line. */}
          {(() => {
            const pxPerMm = (creaseX - stumpsX) / 1220;
            const rulerY = 238;
            const spanMm = 200;
            const ticks: number[] = [];
            for (let mm = -spanMm; mm <= spanMm; mm += 50) ticks.push(mm);
            return (
              <g>
                <line
                  x1={creaseX - spanMm * pxPerMm}
                  y1={rulerY}
                  x2={creaseX + spanMm * pxPerMm}
                  y2={rulerY}
                  stroke="#38BDF8"
                  strokeWidth="0.8"
                  opacity="0.7"
                />
                {ticks.map((mm) => {
                  const major = mm % 100 === 0;
                  const tx = creaseX + mm * pxPerMm;
                  return (
                    <g key={mm}>
                      <line
                        x1={tx}
                        y1={rulerY - (major ? 7 : 4)}
                        x2={tx}
                        y2={rulerY}
                        stroke="#38BDF8"
                        strokeWidth={major ? 0.9 : 0.6}
                        opacity={major ? 0.9 : 0.55}
                      />
                      {major && (
                        <text
                          x={tx}
                          y={rulerY + 8}
                          textAnchor="middle"
                          fill="#7DD3FC"
                          fontSize="6.5"
                          fontFamily="monospace"
                        >
                          {mm === 0 ? "0" : mm > 0 ? `+${mm}` : `${mm}`}
                        </text>
                      )}
                    </g>
                  );
                })}
                <text
                  x={creaseX - spanMm * pxPerMm}
                  y={rulerY - 12}
                  fill="#38BDF8"
                  fontSize="7"
                  fontFamily="monospace"
                  fontWeight="bold"
                  opacity="0.85"
                >
                  OPTICAL MM SCALE • 0 = CREASE LINE
                </text>
              </g>
            );
          })()}

          {/* Zing Wicket Assembly at Bowler/Keeper End */}
          <g transform={`translate(${stumpsX}, 195)`}>
            {/* Grounding Socket Base */}
            <rect x="-18" y="0" width="36" height="5" fill="#334155" />
            {/* 3 Wooden Stumps */}
            <rect x="-14" y="-72" width="6" height="72" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
            <rect x="-3" y="-72" width="6" height="72" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
            <rect x="8" y="-72" width="6" height="72" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />

            {/* Zing Bails with LED Flash & Spigot Separation */}
            <g
              transform={`translate(0, ${-72 - bailDisplacementY}) rotate(${bailRotation})`}
            >
              <rect
                x="-16"
                y="-6"
                width="32"
                height="6"
                fill={bailsDislodged ? "#EF4444" : "#F59E0B"}
                rx="1"
                stroke={bailsDislodged ? "#FCA5A5" : "#B45309"}
                strokeWidth="0.8"
              />
              {bailsDislodged && (
                <circle cx="0" cy="-3" r="5" fill="#EF4444" opacity="0.9" />
              )}
            </g>
          </g>

          {/* Sliding Cricket Bat with Natural Willow Grain & Grounding Shadow */}
          <g transform={`translate(${batTipX}, ${195 - batAltitude})`}>
            {/* Dynamic Ground Shadow (Fades if Bat is Airborne) */}
            <ellipse
              cx="55"
              cy={3 + batAltitude}
              rx="65"
              ry="4"
              fill="#000000"
              opacity={!state.bat.isGrounded ? 0.2 : 0.65}
            />

            {/* Willow Blade Geometry */}
            <path
              d="M 0,0 L 110,-28 L 114,-22 L 4,4 Z"
              fill="url(#willowGrain)"
              stroke="#78350f"
              strokeWidth="0.8"
            />
            {/* White Protective Toe Cap */}
            <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" stroke="#334155" strokeWidth="0.5" />

            {/* Cane Handle & Rubber Grip */}
            <path
              d="M 110,-28 Q 135,-35 150,-30"
              fill="none"
              stroke="#0284C7"
              strokeWidth="5"
              strokeLinecap="round"
            />

            {/* Batter Glove at Handle */}
            <circle cx="140" cy="-33" r="7" fill="#f8fafc" stroke="#64748b" strokeWidth="0.8" />
          </g>
        </svg>

        {/* Neutral Zing Camera Sensor HUD (Top Left) */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-[11px] border border-cyan-500/40 bg-cyan-950/80 text-cyan-200 backdrop-blur-md flex items-center gap-2 shadow-lg">
            <Zap size={13} className="text-cyan-400" />
            <div>
              <span className="font-black">ZING CAMERA: </span>
              <span className="text-slate-300">ACTIVE FEED (500 FPS)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
