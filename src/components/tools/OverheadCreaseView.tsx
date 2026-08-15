import React, { useState } from "react";
import type { RunOutData } from "../../types/scenario";
import { Crosshair } from "lucide-react";

interface OverheadCreaseViewProps {
  runOut: RunOutData;
  currentTimeMs: number;
}

export const OverheadCreaseView: React.FC<OverheadCreaseViewProps> = ({
  runOut,
  currentTimeMs,
}) => {
  const [showLaser, setShowLaser] = useState<boolean>(true);

  const minTime = 800;
  const maxTime = 2200;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));

  // Physics animation formula
  const bailsTime = runOut.bailsDislodgedFrameMs; // default ~1500ms
  const isBailsDislodged = clampedTime >= bailsTime;

  // Bat sliding progress (from right to left)
  const batProgress = Math.max(0, Math.min(1, (clampedTime - 1000) / 1000));

  // Crease is at X = 250
  const creaseX = 250;

  // Bat tip position (moves from right X=420 across crease to X=140)
  const batTipX = 420 - batProgress * 280;
  const isPastCrease = batTipX < creaseX;

  // Millimeters past/short of crease
  const currentMarginMm = Math.round((creaseX - batTipX) * 2.5);

  // Stumps at X = 130 (Top-down circles)
  const stumpsX = 130;

  // Airborne / bounced bat check
  const isAirborne = runOut.batBounced && !runOut.batGrounded;

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 07 • OVERHEAD BIRD'S EYE CREASE FEED
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 4K TOP-DOWN
          </span>
        </div>

        <button
          onClick={() => setShowLaser(!showLaser)}
          className={`tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
            showLaser ? "text-cyan-300 border-cyan-500/50 bg-cyan-950/40" : "text-slate-400"
          }`}
        >
          <Crosshair size={12} className="text-cyan-400" />
          <span>{showLaser ? "CREASE LASER ON" : "CREASE LASER OFF"}</span>
        </button>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#09151e] via-[#060e15] to-[#03070b] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 500 320" className="w-full h-full max-h-[340px] z-10">
          <defs>
            <linearGradient id="overheadTurf" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#152f20" />
              <stop offset="100%" stopColor="#0d1e14" />
            </linearGradient>
            <linearGradient id="overheadPitch" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9a815f" />
              <stop offset="100%" stopColor="#876f50" />
            </linearGradient>
            <linearGradient id="batTopGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="50%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>

          {/* Outfield Grass */}
          <rect x="0" y="0" width="500" height="320" fill="url(#overheadTurf)" />

          {/* Pitch Strip Top-Down (Horizontal strip across screen) */}
          <rect x="0" y="40" width="500" height="240" fill="url(#overheadPitch)" />

          {/* White Return Crease Lines (Top & Bottom) */}
          <line x1="0" y1="40" x2="500" y2="40" stroke="#FFFFFF" strokeWidth="2" opacity="0.8" />
          <line x1="0" y1="280" x2="500" y2="280" stroke="#FFFFFF" strokeWidth="2" opacity="0.8" />

          {/* Popping Crease Line at X=250 */}
          <rect x={creaseX - 3} y="40" width="6" height="240" fill="#FFFFFF" opacity="0.95" />
          <text x={creaseX + 10} y="60" fill="#FFFFFF" opacity="0.75" fontSize="9" fontFamily="monospace" fontWeight="bold">
            POPPING CREASE
          </text>

          {/* Stumps Top-Down (3 circles for stumps + horizontal bails) at X=130 */}
          <g transform={`translate(${stumpsX}, 160)`}>
            {/* Stump base shadow */}
            <rect x="-10" y="-35" width="20" height="70" fill="#1e293b" rx="4" />
            {/* Off stump top */}
            <circle cx="0" cy="-24" r="6" fill={isBailsDislodged ? "#ef4444" : "#f59e0b"} stroke="#78350f" strokeWidth="1" />
            {/* Middle stump top */}
            <circle cx="0" cy="0" r="6" fill={isBailsDislodged ? "#ef4444" : "#f59e0b"} stroke="#78350f" strokeWidth="1" />
            {/* Leg stump top */}
            <circle cx="0" cy="24" r="6" fill={isBailsDislodged ? "#ef4444" : "#f59e0b"} stroke="#78350f" strokeWidth="1" />

            {/* Bails across stump heads */}
            {!isBailsDislodged ? (
              <>
                <line x1="0" y1="-24" x2="0" y2="0" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
                <line x1="0" y1="0" x2="0" y2="24" stroke="#fbbf24" strokeWidth="3.5" strokeLinecap="round" />
              </>
            ) : (
              // Bails detached / displaced
              <>
                <line x1="-12" y1="-30" x2="6" y2="-12" stroke="#ff2e4c" strokeWidth="3" strokeLinecap="round" />
                <line x1="10" y1="8" x2="16" y2="32" stroke="#ff2e4c" strokeWidth="3" strokeLinecap="round" />
              </>
            )}
          </g>

          {/* Laser Crease Projection Line */}
          {showLaser && (
            <line
              x1={creaseX}
              y1="0"
              x2={creaseX}
              y2="320"
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeDasharray="4 2"
            />
          )}

          {/* Bat Top-Down View Sliding Across Pitch */}
          <g transform={`translate(${batTipX}, 160)`}>
            {/* Bat shadow on ground */}
            <rect
              x="0"
              y={isAirborne ? "12" : "-8"}
              width="150"
              height="16"
              rx="4"
              fill="rgba(0,0,0,0.4)"
              opacity={isAirborne ? 0.3 : 0.7}
            />

            {/* Bat Blade */}
            <rect
              x="0"
              y="-7"
              width="110"
              height="14"
              rx="2"
              fill="url(#batTopGrad)"
              stroke="#78350f"
              strokeWidth="0.8"
            />
            {/* Bat Rubber Handle */}
            <rect
              x="110"
              y="-4"
              width="50"
              height="8"
              rx="2"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="0.8"
            />
            {/* White Rubber Grip Ribs */}
            <line x1="120" y1="-4" x2="120" y2="4" stroke="#FFFFFF" strokeWidth="0.8" />
            <line x1="130" y1="-4" x2="130" y2="4" stroke="#FFFFFF" strokeWidth="0.8" />
            <line x1="140" y1="-4" x2="140" y2="4" stroke="#FFFFFF" strokeWidth="0.8" />

            {/* Bat Tip Contact Point Marker */}
            <circle cx="0" cy="0" r="4" fill="#38BDF8" stroke="#FFFFFF" strokeWidth="1" />
          </g>

          {/* Distance Indicator Arrow between Crease and Bat Tip */}
          <line
            x1={creaseX}
            y1="195"
            x2={batTipX}
            y2="195"
            stroke={isPastCrease ? "#10B981" : "#EF4444"}
            strokeWidth="1.5"
          />
          <circle cx={creaseX} cy="195" r="2.5" fill={isPastCrease ? "#10B981" : "#EF4444"} />
          <circle cx={batTipX} cy="195" r="2.5" fill={isPastCrease ? "#10B981" : "#EF4444"} />
        </svg>

        {/* Real-time Camera Feed Overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-[11px] font-bold border border-cyan-500/40 bg-cyan-950/80 text-cyan-200 backdrop-blur-md shadow-lg">
            CAMERA: OVERHEAD POPPING CREASE (CAM 07)
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">SENSOR</div>
          <div className="text-[11px] font-black text-cyan-300">HIGH-SPEED OVERHEAD 4K</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">TIMECODE</div>
          <div className="text-[11px] font-black text-slate-200">
            00:01:{(clampedTime % 1000).toString().padStart(3, "0")}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">ALIGNMENT</div>
          <div className="text-[11px] font-black text-amber-300">ORTHOGRAPHIC CREASE</div>
        </div>
      </div>
    </div>
  );
};
