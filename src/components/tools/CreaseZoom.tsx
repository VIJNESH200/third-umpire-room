import React, { useState } from "react";
import type { RunOutData } from "../../types/scenario";
import { ZoomIn, Crosshair, Zap } from "lucide-react";

interface CreaseZoomProps {
  runOut: RunOutData;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
}

export const CreaseZoom: React.FC<CreaseZoomProps> = ({
  runOut,
  currentTimeMs,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.35);
  const [showLaser, setShowLaser] = useState<boolean>(true);

  // Physics animation formulas
  const bailsTime = runOut.bailsDislodgedFrameMs; // default ~1500ms
  const bailsDislodged = currentTimeMs >= bailsTime;
  const batProgress = Math.max(0, Math.min(1, (currentTimeMs - 1000) / 1000));

  // Crease is at X = 250
  const creaseX = 250;
  const batTipX = 380 - batProgress * 260; // moves from right to left across crease
  const isPastCrease = batTipX < creaseX;

  // Stumps at X = 160
  const stumpsX = 160;

  // Zing bail flight animation upon spigot groove separation
  const bailDelta = currentTimeMs - bailsTime;
  const bailDisplacementY = bailsDislodged ? Math.min(30, bailDelta * 0.12) : 0;
  const bailRotation = bailsDislodged ? Math.min(35, bailDelta * 0.25) : 0;

  // Virtual 500 FPS frame counter
  const currentFrame = Math.round((currentTimeMs / 1000) * 500);

  // Grounding vs Airborne Bat
  const isAirborne = runOut.batBounced && !runOut.batGrounded;
  const batAltitude = isAirborne ? 12 : 0;

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Monitor Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 02 • 500 FPS HIGH-SPEED POPPING CREASE
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} / 1100 • 500FPS
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Crease Laser Guide Toggle */}
          <button
            onClick={() => setShowLaser(!showLaser)}
            className={`tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
              showLaser ? "text-cyan-300 border-cyan-500/50 bg-cyan-950/40" : "text-slate-400"
            }`}
          >
            <Crosshair size={12} className={showLaser ? "text-cyan-400" : "text-slate-500"} />
            <span>Crease Guide</span>
          </button>

          {/* Optical Zoom Toggle */}
          <button
            onClick={() => setZoomLevel(zoomLevel === 1.35 ? 1.8 : 1.35)}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-300 flex items-center gap-1"
          >
            <ZoomIn size={12} className="text-amber-400" />
            <span>{zoomLevel.toFixed(2)}x</span>
          </button>
        </div>
      </div>

      {/* Main Slow-Mo Canvas */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#09111c] via-[#060c14] to-[#03060a] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg
          viewBox="0 0 500 280"
          className="w-full h-full max-h-[350px] transition-transform duration-150 z-10"
          style={{ transform: `scale(${zoomLevel})` }}
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

          {/* Turf Surface */}
          <rect x="0" y="195" width="500" height="85" fill="url(#creaseGrass)" />
          <line x1="0" y1="195" x2="500" y2="195" stroke="#2a4d38" strokeWidth="1.5" />

          {/* Painted White Popping Crease Line */}
          <rect x={creaseX - 2} y="195" width="4" height="85" fill="#FFFFFF" opacity="0.95" />
          <text x={creaseX - 35} y="188" fill="#38BDF8" fontSize="8" fontFamily="monospace" fontWeight="bold">
            POPPING CREASE
          </text>

          {/* Laser Guide Beam Alignment */}
          {showLaser && (
            <line
              x1={creaseX}
              y1="40"
              x2={creaseX}
              y2="280"
              stroke="#00E5FF"
              strokeWidth="1.2"
              strokeDasharray="4 2"
              opacity="0.85"
            />
          )}

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
              opacity={isAirborne ? 0.2 : 0.65}
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

        {/* Real-time Zing Sensor HUD (Top Left) */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div
            className={`px-3 py-1.5 rounded-md text-[11px] border backdrop-blur-md flex items-center gap-2 shadow-lg ${
              bailsDislodged
                ? "bg-rose-950/90 border-rose-500 text-rose-200"
                : "bg-emerald-950/90 border-emerald-500/60 text-emerald-200"
            }`}
          >
            <Zap size={13} className={bailsDislodged ? "text-rose-400" : "text-emerald-400"} />
            <div>
              <span className="font-black">ZING SENSOR: </span>
              <span>{bailsDislodged ? "BAILS DISLODGED (IGNITED)" : "INTACT IN GROOVE"}</span>
            </div>
          </div>
        </div>

        {/* Crease Grounding Status HUD (Bottom Left) */}
        <div className="absolute bottom-2.5 left-2.5 z-20 font-mono">
          <div
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold border backdrop-blur-md shadow-lg ${
              isAirborne
                ? "bg-rose-950/90 border-rose-500 text-rose-200"
                : isPastCrease
                ? "bg-emerald-950/90 border-emerald-500 text-emerald-200"
                : "bg-amber-950/90 border-amber-500 text-amber-200"
            }`}
          >
            GROUNDING: {isAirborne ? "BAT AIRBORNE / BOUNCED" : isPastCrease ? "BAT GROUNDED BEHIND LINE" : "BAT SHORT OF CREASE"}
          </div>
        </div>
      </div>

      {/* Diagnostics Footer */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">FRAME RATE</div>
          <div className="text-[11px] font-black text-cyan-300">500 FPS HIGH-SPEED</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">CREASE MARGIN</div>
          <div className={`text-[11px] font-black ${isPastCrease ? "text-emerald-400" : "text-rose-400"}`}>
            {runOut.creaseMarginMm > 0 ? `+${runOut.creaseMarginMm} mm (SAFE)` : `${runOut.creaseMarginMm} mm (OUT)`}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">BAILS SEPARATION</div>
          <div className="text-[11px] font-black text-amber-300">
            {bailsDislodged ? `+${Math.round(bailDelta)} ms DISPLACED` : "INTACT IN GROOVE"}
          </div>
        </div>
      </div>
    </div>
  );
};
