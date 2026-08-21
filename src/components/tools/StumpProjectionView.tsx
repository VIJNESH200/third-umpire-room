import React from "react";
import type { LBWData } from "../../types/scenario";
import { Crosshair } from "lucide-react";

interface StumpProjectionViewProps {
  lbw: LBWData;
  currentTimeMs: number;
}

export const StumpProjectionView: React.FC<StumpProjectionViewProps> = ({
  lbw,
  currentTimeMs,
}) => {
  // Timeline: 1500ms = impact, 1800ms = projected arrival at stumps plane
  const minTime = 1200;
  const maxTime = 2000;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));

  // Trajectory interpolation from pad impact to stumps plane
  const arrivalProgress = Math.max(0, Math.min(1, (clampedTime - 1400) / 400));

  // Stump dimensions in SVG canvas (500x320)
  // Center is at X = 250, ground line at Y = 270
  // Stump height 71.1 cm = 180 SVG pixels (approx 2.53 px / cm)
  const groundY = 270;
  const stumpHeightPx = 180;
  const topOfStumpsY = groundY - stumpHeightPx; // 90

  // Lateral coordinates
  const stumpWidthPx = 22;
  const middleStumpX = 250;
  const offStumpX = middleStumpX + (lbw.batterHand === "RIGHT" ? -55 : 55);
  const legStumpX = middleStumpX + (lbw.batterHand === "RIGHT" ? 55 : -55);

  // Ball target coordinates at stumps
  const targetX = middleStumpX + lbw.stumpHitX * 220;
  const targetY = groundY - (lbw.stumpHitHeightCm / 71.1) * stumpHeightPx;

  // Impact starting coordinates
  const impactStartX = middleStumpX + lbw.impactX * 240;
  const impactStartY = groundY - (lbw.impactHeight / 71.1) * stumpHeightPx;

  // Current ball position along projection
  const currentBallX = impactStartX + (targetX - impactStartX) * arrivalProgress;
  const currentBallY = impactStartY + (targetY - impactStartY) * arrivalProgress;

  // Neutral evidence colour for the projection — the outcome stays internal to the DRS engine.
  const EVIDENCE_COLOR = "#38BDF8";

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 06 • STUMP FACE 2D ELEVATION PROJECTION
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • EYE-LEVEL
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <span className="text-slate-400">PROJECTED HEIGHT:</span>
          <span className="font-black text-cyan-300">{lbw.stumpHitHeightCm.toFixed(1)} CM</span>
          <span className="text-slate-500">/ 71.1 CM</span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#09111c] via-[#060c14] to-[#03060a] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 500 320" className="w-full h-full max-h-[340px] z-10">
          <defs>
            <linearGradient id="stumpWoodGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            <linearGradient id="bailWoodGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Turf Base Ground Line */}
          <rect x="0" y={groundY} width="500" height="50" fill="#14281c" />
          <line x1="0" y1={groundY} x2="500" y2={groundY} stroke="#254a33" strokeWidth="2" />
          <text x="20" y={groundY + 20} fill="#475569" fontSize="10" fontFamily="monospace">
            PITCH SURFACE (0.0 CM)
          </text>

          {/* Stumps Target Framing Grid */}
          {/* Top of Stumps 71.1cm line */}
          <line x1="80" y1={topOfStumpsY} x2="420" y2={topOfStumpsY} stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeDasharray="3 3" />
          <text x="425" y={topOfStumpsY + 3} fill="#94a3b8" fontSize="8" fontFamily="monospace">
            71.1 CM (TOP)
          </text>

          {/* 50% Umpire's Call Zone Zone Box */}
          <rect
            x={Math.min(offStumpX, legStumpX) - stumpWidthPx / 2 - 14}
            y={topOfStumpsY - 18}
            width={Math.abs(offStumpX - legStumpX) + stumpWidthPx + 28}
            height={stumpHeightPx + 18}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.6"
          />
          <text
            x="250"
            y={topOfStumpsY - 24}
            textAnchor="middle"
            fill="#f59e0b"
            fontSize="8"
            fontFamily="monospace"
            fontWeight="bold"
          >
            50% MARGIN REFERENCE ZONE
          </text>

          {/* The 3 Stumps */}
          {/* Off Stump */}
          <rect
            x={offStumpX - stumpWidthPx / 2}
            y={topOfStumpsY}
            width={stumpWidthPx}
            height={stumpHeightPx}
            rx="3"
            fill="url(#stumpWoodGrad)"
            stroke="#78350f"
            strokeWidth="0.8"
          />
          {/* Middle Stump */}
          <rect
            x={middleStumpX - stumpWidthPx / 2}
            y={topOfStumpsY - 3}
            width={stumpWidthPx}
            height={stumpHeightPx + 3}
            rx="3"
            fill="url(#stumpWoodGrad)"
            stroke="#78350f"
            strokeWidth="0.8"
          />
          {/* Leg Stump */}
          <rect
            x={legStumpX - stumpWidthPx / 2}
            y={topOfStumpsY}
            width={stumpWidthPx}
            height={stumpHeightPx}
            rx="3"
            fill="url(#stumpWoodGrad)"
            stroke="#78350f"
            strokeWidth="0.8"
          />

          {/* Bails */}
          <rect
            x={Math.min(offStumpX, middleStumpX) - stumpWidthPx / 2}
            y={topOfStumpsY - 10}
            width={Math.abs(offStumpX - middleStumpX) + stumpWidthPx}
            height="7"
            rx="2"
            fill="url(#bailWoodGrad)"
            stroke="#78350f"
            strokeWidth="0.6"
          />
          <rect
            x={Math.min(legStumpX, middleStumpX) - stumpWidthPx / 2}
            y={topOfStumpsY - 10}
            width={Math.abs(legStumpX - middleStumpX) + stumpWidthPx}
            height="7"
            rx="2"
            fill="url(#bailWoodGrad)"
            stroke="#78350f"
            strokeWidth="0.6"
          />

          {/* Stump Labels */}
          <text x={offStumpX} y={groundY + 15} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">
            {lbw.batterHand === "RIGHT" ? "OFF" : "LEG"}
          </text>
          <text x={middleStumpX} y={groundY + 15} textAnchor="middle" fill="#cbd5e1" fontSize="9" fontFamily="monospace" fontWeight="bold">
            MIDDLE
          </text>
          <text x={legStumpX} y={groundY + 15} textAnchor="middle" fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">
            {lbw.batterHand === "RIGHT" ? "LEG" : "OFF"}
          </text>

          {/* Projected Flight Path Line from Impact */}
          <line
            x1={impactStartX}
            y1={impactStartY}
            x2={targetX}
            y2={targetY}
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth="2"
            strokeDasharray="4 3"
          />

          {/* Stumps Target Point Projection Ghost */}
          <circle
            cx={targetX}
            cy={targetY}
            r="16"
            fill={EVIDENCE_COLOR}
            fillOpacity="0.25"
            stroke={EVIDENCE_COLOR}
            strokeWidth="2"
          />

          {/* Current Ball Marker on Plane */}
          <circle
            cx={currentBallX}
            cy={currentBallY}
            r="15"
            fill="#dc2626"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          {/* Seam */}
          <line
            x1={currentBallX - 10}
            y1={currentBallY}
            x2={currentBallX + 10}
            y2={currentBallY}
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeDasharray="2 1"
          />

          {/* Laser Crosshair at Ball Center */}
          <line x1={currentBallX - 25} y1={currentBallY} x2={currentBallX + 25} y2={currentBallY} stroke="#38BDF8" strokeWidth="0.8" />
          <line x1={currentBallX} y1={currentBallY - 25} x2={currentBallX} y2={currentBallY + 25} stroke="#38BDF8" strokeWidth="0.8" />
        </svg>

        {/* Projection Feed HUD Banner — neutral status, never the outcome */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-xs font-black border backdrop-blur-md shadow-xl flex items-center gap-2 bg-slate-950/90 border-cyan-500/50 text-cyan-200">
            <Crosshair size={14} className="text-cyan-400" />
            <span>PROJECTED PATH AT STUMP PLANE</span>
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">HORIZONTAL OFFSET</div>
          <div className="text-[11px] font-black text-cyan-300">
            {lbw.stumpHitX > 0 ? `+${(lbw.stumpHitX * 100).toFixed(1)} cm (LEG)` : `${(lbw.stumpHitX * 100).toFixed(1)} cm (OFF)`}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">VERTICAL HEIGHT</div>
          <div className="text-[11px] font-black text-amber-300">
            {lbw.stumpHitHeightCm.toFixed(1)} cm / 71.1 cm
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">PROJECTION</div>
          <div className="text-[11px] font-black text-cyan-300">
            AT STUMP PLANE
          </div>
        </div>
      </div>
    </div>
  );
};
