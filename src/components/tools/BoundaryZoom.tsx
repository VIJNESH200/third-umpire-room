import React, { useState } from "react";
import type { BoundaryData } from "../../types/scenario";
import { ZoomIn, Crosshair } from "lucide-react";

interface BoundaryZoomProps {
  boundary: BoundaryData;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
}

export const BoundaryZoom: React.FC<BoundaryZoomProps> = ({
  boundary,
  currentTimeMs,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.4);
  const [showGuide, setShowGuide] = useState<boolean>(true);

  const minTime = 800;
  const maxTime = 2200;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));

  // Normalized timeline progress: 0 to 1
  const progress = (clampedTime - minTime) / (maxTime - minTime);

  const contactTime = boundary.ropeContactFrameMs; // ~1400ms
  const releaseTime = boundary.releaseFrameMs; // if boundary: 1480ms, if clean catch: 1320ms

  const isRopeContact = clampedTime >= contactTime;
  const isBallHeld = clampedTime < releaseTime;
  const simultaneousTouch = isRopeContact && isBallHeld;

  // Fielder foot sliding horizontally towards cushion (cushion apex at X=240)
  // Starts at X=120, slides to X=245 at contactTime, slides past to X=280
  const footX = 110 + progress * 160;

  // Ball position: in hand while held, tossed upward/away if released
  let ballX = footX + 10;
  let ballY = 115;

  if (!isBallHeld) {
    // Released / lobbed in air
    const releaseProgress = Math.min(1, (clampedTime - releaseTime) / (maxTime - releaseTime));
    ballX = footX - 10 - releaseProgress * 60;
    ballY = 115 - Math.sin(releaseProgress * Math.PI) * 75;
  }

  // Cushion compression amount
  const isCushionCompressed = footX >= 235;

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

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
            FRAME {currentFrame} • 4K 120FPS
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
            onClick={() => setZoomLevel(zoomLevel === 1.4 ? 1.9 : 1.4)}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-300 flex items-center gap-1"
          >
            <ZoomIn size={12} className="text-amber-400" />
            <span>{zoomLevel.toFixed(1)}x</span>
          </button>
        </div>
      </div>

      {/* Main Visualizer */}
      <div className="relative flex-1 min-h-[220px] my-2 bg-gradient-to-b from-[#09111c] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg
          viewBox="0 0 500 280"
          className="w-full h-full max-h-[350px] transition-transform duration-150 z-10"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            <linearGradient id="cushionTurf" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a3625" />
              <stop offset="100%" stopColor="#102318" />
            </linearGradient>
            <linearGradient id="cushionFoam" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Outfield Grass Turf */}
          <rect x="0" y="0" width="500" height="280" fill="url(#cushionTurf)" />
          <line x1="0" y1="180" x2="500" y2="180" stroke="#254a33" strokeWidth="2" />

          {/* Boundary Rope Foam Cushion (Triangular Wedge) at X=240 */}
          <polygon
            points={
              isCushionCompressed
                ? "180,180 320,180 335,210 165,210"
                : "180,180 320,180 340,210 160,210"
            }
            fill={simultaneousTouch ? "#EF4444" : "url(#cushionFoam)"}
            stroke={simultaneousTouch ? "#FCA5A5" : "#78350f"}
            strokeWidth="1.5"
            className="transition-colors duration-100"
          />
          <text x="250" y="198" fill="#FFFFFF" fontSize="9" fontFamily="monospace" fontWeight="900" textAnchor="middle">
            BOUNDARY CUSHION
          </text>

          {/* White Boundary Line behind Cushion */}
          <line x1="160" y1="210" x2="340" y2="210" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9" />

          {/* Laser Guide Alignment Line */}
          {showGuide && (
            <line
              x1="240"
              y1="40"
              x2="240"
              y2="250"
              stroke="#38BDF8"
              strokeWidth="1.2"
              strokeDasharray="4 2"
            />
          )}

          {/* Sliding Fielder Silhouette (Spikes / Leg / Hand) */}
          <g transform={`translate(${footX}, 180)`}>
            {/* Ground contact shadow */}
            <ellipse cx="-20" cy="2" rx="45" ry="5" fill="rgba(0,0,0,0.4)" />

            {/* Sliding Knee / Thigh */}
            <path
              d="M -70,-20 L -30,0 L 0,0 L -15,-15 Z"
              fill="#1e293b"
              stroke="#0f172a"
              strokeWidth="1"
            />
            {/* Fielder Boot Spikes */}
            <ellipse cx="0" cy="0" rx="14" ry="6" fill="#0f172a" stroke="#334155" strokeWidth="0.8" />
            <circle cx="10" cy="0" r="3" fill="#FFFFFF" />

            {/* Fielder Hand / Arm (Reaching up with ball or releasing) */}
            <path
              d="M -40,-25 Q -10,-45 10,-60"
              fill="none"
              stroke="#1e293b"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="10" cy="-60" r="6" fill="#334155" />
          </g>

          {/* Red Cricket Ball in Hand / Air */}
          <circle
            cx={ballX}
            cy={ballY}
            r="9.5"
            fill="#dc2626"
            stroke="#991b1b"
            strokeWidth="1"
          />
          {/* Ball Seam */}
          <line
            x1={ballX - 7}
            y1={ballY}
            x2={ballX + 7}
            y2={ballY}
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeDasharray="2 1"
          />

          {/* Contact Spark Flash when cushion is touched */}
          {isRopeContact && (
            <g transform="translate(240, 180)">
              <circle cx="0" cy="0" r="14" fill={simultaneousTouch ? "#EF4444" : "#FACC15"} opacity="0.6" className="animate-ping" />
              <circle cx="0" cy="0" r="5" fill="#FFFFFF" />
            </g>
          )}
        </svg>

        {/* Live Contact Telemetry Overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div
            className={`px-3 py-1.5 rounded-md text-[11px] font-bold border backdrop-blur-md shadow-lg ${
              simultaneousTouch
                ? "bg-rose-950/90 border-rose-500 text-rose-200"
                : isRopeContact
                ? "bg-emerald-950/90 border-emerald-500 text-emerald-200"
                : "bg-cyan-950/90 border-cyan-500 text-cyan-200"
            }`}
          >
            {simultaneousTouch
              ? "CUSHION CONTACT DETECTED (SIMULTANEOUS TOUCH — BOUNDARY)"
              : isRopeContact
              ? "CLEAN RELEASE BEFORE CUSHION CONTACT"
              : "AERIAL CATCH IN PROGRESS / IN PLAY"}
          </div>
        </div>
      </div>

      {/* Diagnostics */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">CONTACT DELTA</div>
          <div className="text-[11px] font-black text-cyan-300">
            {Math.round(currentTimeMs - contactTime)} ms
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">RELEASE TIMING</div>
          <div className="text-[11px] font-black text-slate-200">
            {isBallHeld ? `HELD (${Math.round(releaseTime - currentTimeMs)}ms to rel)` : "RELEASED / IN AIR"}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">DECISION IMPACT</div>
          <div className={`text-[11px] font-black ${boundary.isBoundary ? "text-rose-400" : "text-emerald-400"}`}>
            {boundary.isBoundary ? "BOUNDARY AWARDED (NOT OUT)" : "CLEAN CATCH (OUT)"}
          </div>
        </div>
      </div>
    </div>
  );
};
