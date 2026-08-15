import React, { useState } from "react";
import type { RunOutData } from "../../types/scenario";
import { ZoomIn, Crosshair, Video } from "lucide-react";

interface StrikerStumpCamViewProps {
  runOut: RunOutData;
  currentTimeMs: number;
}

export const StrikerStumpCamView: React.FC<StrikerStumpCamViewProps> = ({
  runOut,
  currentTimeMs,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.25);
  const [showLaser, setShowLaser] = useState<boolean>(true);

  // Physics animation formulas
  const bailsTime = runOut.bailsDislodgedFrameMs; // default ~1500ms
  const bailsDislodged = currentTimeMs >= bailsTime;

  // Normalized bat motion progress (1000ms to 2000ms)
  const batProgress = Math.max(0, Math.min(1, (currentTimeMs - 1000) / 1000));

  // In stump cam perspective (low angle looking down-pitch from striker stumps towards bowler end):
  // Stumps are in the immediate foreground/left (X=110, Y=140 to 240)
  // Popping crease line extends across the pitch ahead at depth Z/Y (perspective Y=190, X=150 to 450)
  // Bat slides towards the camera and across the crease line from deep (far X=420, Y=175 -> near X=190, Y=225)
  const batTipX = 430 - batProgress * 250;
  const batTipY = 175 + batProgress * 50;

  // Zing bail flight animation upon spigot groove separation
  const bailDelta = currentTimeMs - bailsTime;
  const bailDisplacementY = bailsDislodged ? Math.min(32, bailDelta * 0.14) : 0;
  const bailDisplacementX = bailsDislodged ? Math.min(20, bailDelta * 0.08) : 0;
  const bailRotation = bailsDislodged ? Math.min(42, bailDelta * 0.28) : 0;

  // Virtual 500 FPS frame counter
  const currentFrame = Math.round((currentTimeMs / 1000) * 500);

  // Grounding vs Airborne Bat
  const isAirborne = runOut.batBounced && !runOut.batGrounded;
  const batAltitude = isAirborne ? 10 : 0;

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Monitor Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 10 • STRIKER STUMP GROUND CAM (500 FPS)
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} / 1100 • LOW-ANGLE
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
            onClick={() => setZoomLevel(zoomLevel === 1.25 ? 1.65 : 1.25)}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-300 flex items-center gap-1"
          >
            <ZoomIn size={12} className="text-amber-400" />
            <span>{zoomLevel.toFixed(2)}x</span>
          </button>
        </div>
      </div>

      {/* Main Slow-Mo Canvas Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#09121a] via-[#050a10] to-[#020508] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg
          viewBox="0 0 500 280"
          className="w-full h-full max-h-[350px] transition-transform duration-150 z-10"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            {/* Turf Grass Gradient */}
            <linearGradient id="stumpTurf" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#142c1e" />
              <stop offset="100%" stopColor="#0c1b12" />
            </linearGradient>

            {/* Pitch Clay Strip in Low-Angle Perspective */}
            <linearGradient id="stumpPitchClay" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a38865" />
              <stop offset="50%" stopColor="#8f7655" />
              <stop offset="100%" stopColor="#7a6345" />
            </linearGradient>

            {/* Willow Wood Texture Gradient */}
            <linearGradient id="stumpWillow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="40%" stopColor="#c2710c" />
              <stop offset="70%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>

          {/* Outfield Grass */}
          <rect x="0" y="0" width="500" height="280" fill="url(#stumpTurf)" />

          {/* Perspective Pitch Corridor receding from Near (Bottom-Left) to Far (Top-Right) */}
          <polygon
            points="40,280 480,150 430,135 0,230"
            fill="url(#stumpPitchClay)"
          />
          {/* Pitch surface wear strip */}
          <polygon
            points="70,280 460,155 425,142 30,240"
            fill="#b89a74"
            opacity="0.3"
          />

          {/* Popping Crease White Line in Ground Perspective (Trapezoid line across pitch corridor) */}
          <polygon
            points="240,245 350,178 356,180 244,248"
            fill="#FFFFFF"
            opacity="0.95"
          />
          <text x="260" y="225" fill="#38BDF8" fontSize="8" fontFamily="monospace" fontWeight="bold" transform="rotate(-30 260 225)">
            POPPING CREASE
          </text>

          {/* Laser Guide Alignment Beam across Popping Crease Plane */}
          {showLaser && (
            <line
              x1="220"
              y1="258"
              x2="370"
              y2="168"
              stroke="#00E5FF"
              strokeWidth="1.2"
              strokeDasharray="4 2"
              opacity="0.85"
            />
          )}

          {/* Sliding Cricket Bat entering from top-right towards popping crease */}
          <g transform={`translate(${batTipX}, ${batTipY - batAltitude})`}>
            {/* Dynamic Ground Shadow */}
            <ellipse
              cx="45"
              cy={2 + batAltitude}
              rx="55"
              ry="5"
              fill="#000000"
              opacity={isAirborne ? 0.25 : 0.65}
              transform="rotate(-15)"
            />

            {/* Bat Blade in Low-Angle Ground Perspective */}
            <path
              d="M 0,0 L 85,-18 L 88,-12 L 3,6 Z"
              fill="url(#stumpWillow)"
              stroke="#78350f"
              strokeWidth="0.8"
            />
            {/* White Protective Toe Cap */}
            <circle cx="0" cy="1" r="3" fill="#FFFFFF" stroke="#334155" strokeWidth="0.5" />

            {/* Cane Handle & Rubber Grip */}
            <path
              d="M 85,-18 Q 110,-24 125,-20"
              fill="none"
              stroke="#0284C7"
              strokeWidth="4.5"
              strokeLinecap="round"
            />

            {/* Batter Glove at Handle */}
            <circle cx="115" cy="-22" r="6" fill="#f8fafc" stroke="#64748b" strokeWidth="0.8" />
            <circle cx="102" cy="-21" r="5.5" fill="#0284c7" stroke="#0369a1" strokeWidth="0.6" />
          </g>

          {/* Striker Stumps Assembly in Near Foreground (Left-side low-angle perspective) */}
          <g transform="translate(100, 240)">
            {/* Stump Base Shadow */}
            <ellipse cx="0" cy="2" rx="22" ry="5" fill="rgba(0,0,0,0.6)" />

            {/* Socket Ground Base Plate */}
            <polygon points="-18,-2 18,-2 22,2 -22,2" fill="#1e293b" />

            {/* Off Stump (Far left) */}
            <rect x="-14" y="-105" width="7" height="105" fill="#cbd5e1" stroke="#334155" strokeWidth="0.6" rx="1" />
            {/* Middle Stump */}
            <rect x="-3.5" y="-108" width="7" height="108" fill="#e2e8f0" stroke="#334155" strokeWidth="0.6" rx="1" />
            {/* Leg Stump (Near right) */}
            <rect x="7" y="-111" width="7.5" height="111" fill="#cbd5e1" stroke="#334155" strokeWidth="0.6" rx="1" />

            {/* Zing Bails with LED Glow & Separation */}
            <g
              transform={`translate(${bailDisplacementX}, ${-110 - bailDisplacementY}) rotate(${bailRotation})`}
            >
              {/* Wooden Bail Crossbars */}
              <rect
                x="-16"
                y="-7"
                width="34"
                height="7"
                fill={bailsDislodged ? "#EF4444" : "#F59E0B"}
                rx="1.5"
                stroke={bailsDislodged ? "#FCA5A5" : "#B45309"}
                strokeWidth="0.8"
              />
              {/* Zing Internal LED Core */}
              {bailsDislodged ? (
                <>
                  <circle cx="0" cy="-3.5" r="7" fill="#EF4444" opacity="0.8" />
                  <circle cx="0" cy="-3.5" r="3" fill="#FFFFFF" />
                </>
              ) : (
                <rect x="-10" y="-5" width="20" height="3" fill="#FDE68A" opacity="0.6" rx="0.5" />
              )}
            </g>
          </g>
        </svg>

        {/* Real-time Camera Feed Overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-[11px] font-bold border border-cyan-500/40 bg-cyan-950/80 text-cyan-200 backdrop-blur-md flex items-center gap-2 shadow-lg">
            <Video size={13} className="text-cyan-400" />
            <span>CAMERA: STRIKER STUMP GROUND CAM (CAM 10)</span>
          </div>
        </div>
      </div>

      {/* Neutral Diagnostics Footer */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">SENSOR FEED</div>
          <div className="text-[11px] font-black text-cyan-300">500 FPS HIGH-SPEED</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">TIMECODE</div>
          <div className="text-[11px] font-black text-slate-200">
            00:01:{(currentTimeMs % 1000).toString().padStart(3, "0")}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">PERSPECTIVE</div>
          <div className="text-[11px] font-black text-amber-300">STUMP-LEVEL LOW ANGLE</div>
        </div>
      </div>
    </div>
  );
};
