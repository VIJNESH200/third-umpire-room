import React, { useState } from "react";
import type { CaughtBehindData } from "../../types/scenario";
import { ZoomIn, Crosshair } from "lucide-react";

interface SuperSlowEdgeViewProps {
  caughtBehind: CaughtBehindData;
  currentTimeMs: number;
}

export const SuperSlowEdgeView: React.FC<SuperSlowEdgeViewProps> = ({
  caughtBehind,
  currentTimeMs,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.5);
  const [showRuler, setShowRuler] = useState<boolean>(true);

  const minTime = 800;
  const maxTime = 1600;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));

  const contactTime = caughtBehind.ballPassesBatFrameMs; // ~1200ms

  // Ball motion progress
  const progress = Math.max(0, Math.min(1, (clampedTime - minTime) / (maxTime - minTime)));

  // Ball vertical travel from top to bottom
  const ballY = 30 + progress * 240;

  // Ball horizontal distance: bat outside edge is at X = 180
  // Ball radius is 32px
  // If edge: ball center is at 180 + 32 = 212
  // If gap: ball center is at 212 + gapMm * 3.5
  const edgeX = 180;
  const ballRadius = 32;
  const ballX = caughtBehind.hasEdge
    ? edgeX + ballRadius
    : edgeX + ballRadius + caughtBehind.gapMm * 3.5;

  // Contact status
  const isAtContactFrame = Math.abs(clampedTime - contactTime) <= 40;

  // Seam angle rotating with time
  const seamAngle = (clampedTime / 10) % 360;

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 02 • 1000 FPS OPTICAL MACRO EDGE CAM
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 1000FPS MACRO
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowRuler(!showRuler)}
            className={`tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors ${
              showRuler ? "text-cyan-300 border-cyan-500/50 bg-cyan-950/40" : "text-slate-400"
            }`}
          >
            <Crosshair size={12} className="text-cyan-400" />
            <span>{showRuler ? "RULER ON" : "RULER OFF"}</span>
          </button>

          <button
            onClick={() => setZoomLevel(zoomLevel === 1.5 ? 2.0 : 1.5)}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-300 flex items-center gap-1"
          >
            <ZoomIn size={12} className="text-cyan-400" />
            <span>{zoomLevel.toFixed(1)}x</span>
          </button>
        </div>
      </div>

      {/* Main Macro Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#0a111b] via-[#060c14] to-[#03060a] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg
          viewBox="0 0 500 320"
          className="w-full h-full max-h-[340px] transition-transform duration-150 z-10"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            {/* English Willow Grain Texture */}
            <linearGradient id="willowGrain" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#b45309" />
              <stop offset="30%" stopColor="#d97706" />
              <stop offset="70%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>

            {/* Leather Cricket Ball Texture */}
            <radialGradient id="ballShading" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="70%" stopColor="#b91c1c" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </radialGradient>
          </defs>

          {/* Cricket Bat Outside Edge Profile (Left half of frame) */}
          <g>
            {/* Main Bat Blade Wood */}
            <rect
              x="0"
              y="0"
              width={edgeX}
              height="320"
              fill="url(#willowGrain)"
              stroke="#78350f"
              strokeWidth="1.5"
            />
            {/* Wood Grain Fibres */}
            <line x1="30" y1="0" x2="30" y2="320" stroke="#78350f" strokeWidth="0.8" opacity="0.4" />
            <line x1="70" y1="0" x2="70" y2="320" stroke="#78350f" strokeWidth="0.8" opacity="0.4" />
            <line x1="120" y1="0" x2="120" y2="320" stroke="#78350f" strokeWidth="0.8" opacity="0.4" />
            <line x1="160" y1="0" x2="160" y2="320" stroke="#78350f" strokeWidth="0.8" opacity="0.4" />

            {/* Lacquer Edge Chamfer Highlights */}
            <line x1={edgeX - 4} y1="0" x2={edgeX - 4} y2="320" stroke="#fde68a" strokeWidth="1" opacity="0.6" />
            <line x1={edgeX} y1="0" x2={edgeX} y2="320" stroke="#451a03" strokeWidth="2" />

            {/* Edge Label text */}
            <text x="140" y="160" fill="#451a03" fontSize="12" fontFamily="monospace" fontWeight="900" transform="rotate(-90 140,160)" textAnchor="middle">
              BAT OUTSIDE EDGE
            </text>
          </g>

          {/* Red Cricket Ball (Right side, traveling past edge) */}
          <g transform={`translate(${ballX}, ${ballY})`}>
            {/* Ball Sphere with Realistic Shading */}
            <circle cx="0" cy="0" r={ballRadius} fill="url(#ballShading)" stroke="#450a0a" strokeWidth="1.2" />

            {/* Stitched White Seam Rotating */}
            <g transform={`rotate(${seamAngle})`}>
              <ellipse cx="0" cy="0" rx={ballRadius - 1} ry={ballRadius * 0.4} fill="none" stroke="#FFFFFF" strokeWidth="2" strokeDasharray="3 2" />
              <line x1={-(ballRadius - 1)} y1="0" x2={ballRadius - 1} y2="0" stroke="#FFFFFF" strokeWidth="1" opacity="0.7" />
            </g>
          </g>

          {/* Laser Ruler Measurement between Bat Edge & Ball Surface */}
          {showRuler && (
            <g>
              {/* Daylight Ruler Line */}
              <line
                x1={edgeX}
                y1={ballY}
                x2={ballX - ballRadius}
                y2={ballY}
                stroke="#38BDF8"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />
              <circle cx={edgeX} cy={ballY} r="2.5" fill="#38BDF8" />
              <circle cx={ballX - ballRadius} cy={ballY} r="2.5" fill="#38BDF8" />

              {/* Daylight Measurement Badge */}
              <g transform={`translate(${(edgeX + ballX - ballRadius) / 2}, ${ballY - 14})`}>
                <rect x="-35" y="-9" width="70" height="18" rx="3" fill="rgba(15,23,42,0.9)" stroke="#38BDF8" strokeWidth="0.8" />
                <text x="0" y="3.5" fill="#38BDF8" fontSize="9" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                  {caughtBehind.hasEdge ? "0.0 mm" : `${caughtBehind.gapMm}.0 mm`}
                </text>
              </g>
            </g>
          )}

          {/* Microscopic Impact Contact Spark if Edge occurs */}
          {caughtBehind.hasEdge && isAtContactFrame && (
            <g transform={`translate(${edgeX}, ${ballY})`}>
              <circle cx="0" cy="0" r="10" fill="#FACC15" opacity="0.6" className="animate-ping" />
              <circle cx="0" cy="0" r="4" fill="#FFFFFF" />
            </g>
          )}
        </svg>

        {/* Real-time Status Overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div
            className={`px-3 py-1.5 rounded-md text-xs font-bold border backdrop-blur-md shadow-lg flex items-center gap-1.5 ${
              caughtBehind.hasEdge
                ? "bg-rose-950/90 border-rose-500 text-rose-200"
                : "bg-emerald-950/90 border-emerald-500 text-emerald-200"
            }`}
          >
            {caughtBehind.hasEdge
              ? "OPTICAL CONTACT CONFIRMED: ZERO DAYLIGHT (EDGE IMPACT)"
              : `CLEAR OPTICAL DAYLIGHT: ${caughtBehind.gapMm} mm GAP MAINTAINED`}
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">OPTICAL CLEARANCE</div>
          <div className={`text-[11px] font-black ${caughtBehind.hasEdge ? "text-rose-400" : "text-emerald-400"}`}>
            {caughtBehind.hasEdge ? "0 mm (BAT CONTACT)" : `${caughtBehind.gapMm} mm (DAYLIGHT)`}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">FRAME RATE</div>
          <div className="text-[11px] font-black text-cyan-300">1000 FPS ULTRA-MACRO</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">BAT SEPARATION</div>
          <div className="text-[11px] font-black text-amber-300">
            {Math.abs(currentTimeMs - contactTime) < 30 ? "AT TRANSIT POINT" : `${Math.round(currentTimeMs - contactTime)} ms`}
          </div>
        </div>
      </div>
    </div>
  );
};
