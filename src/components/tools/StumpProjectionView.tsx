import React from "react";
import type { LBWData } from "../../types/scenario";
import { Crosshair } from "lucide-react";

interface StumpProjectionViewProps {
  lbw: LBWData;
  currentTimeMs: number;
}

/* ================================================================
   CAM 06 • STUMP FACE 2D ELEVATION (LBW)
   Purpose: "How much wicket overlap is there?"

   The ball/stump relationship is the hero, drawn at TRUE relative
   scale so the overlap is visually judgeable:
     stump height 71.1 cm → 200 px   (2.813 px/cm)
     stump zone width 22.86 cm → 64 px
     ball diameter 7.2 cm → 20.2 px (drawn as an honest ball, not a dot)
   The dashed amber box extends the striking zone by one ball radius
   on every side — the edge-of-ball overlap reference. The projection
   position comes from raw scenario physics; no classification is
   ever rendered. Numbers stay secondary.
   ================================================================ */

const PX_PER_CM = 2.813;
const GROUND_Y = 290;
const STUMP_H_PX = 71.1 * PX_PER_CM; // 200
const ZONE_HALF_W = 32; // 22.86 cm stump zone → ±32 px outer edge
const STUMP_GAP = 28; // stump centres at middle ± 0, ±28
const STUMP_W = 11;
const BALL_R = (7.2 * PX_PER_CM) / 2; // 10.1
const VIEW_CX = 250;

export const StumpProjectionView: React.FC<StumpProjectionViewProps> = ({
  lbw,
  currentTimeMs,
}) => {
  // Timeline: 1500ms = pad impact, 1800ms = projected arrival at stumps plane
  const minTime = 1200;
  const maxTime = 2000;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));
  const arrivalProgress = Math.max(0, Math.min(1, (clampedTime - 1400) / 400));
  const hasArrived = clampedTime >= 1800;

  const topOfStumpsY = GROUND_Y - STUMP_H_PX; // 90
  const bailTopY = topOfStumpsY - 7;

  // Reference zone: striking zone grown by one ball radius per side
  const refHalfW = ZONE_HALF_W + BALL_R;
  const refTopY = bailTopY - BALL_R;

  // Lateral stump stations (handedness mirrors the face of the wicket)
  const isRight = lbw.batterHand === "RIGHT";
  const offStumpX = VIEW_CX + (isRight ? -STUMP_GAP : STUMP_GAP);
  const legStumpX = VIEW_CX + (isRight ? STUMP_GAP : -STUMP_GAP);

  // Projected ball at the stump plane (raw physics, cm→px at true scale)
  const targetX = VIEW_CX + lbw.stumpHitX * 100 * PX_PER_CM;
  const targetY = GROUND_Y - lbw.stumpHitHeightCm * PX_PER_CM;
  const impactStartX = VIEW_CX + lbw.impactX * 100 * PX_PER_CM;
  const impactStartY = GROUND_Y - lbw.impactHeight * PX_PER_CM;
  const currentBallX =
    impactStartX + (targetX - impactStartX) * arrivalProgress;
  const currentBallY =
    impactStartY + (targetY - impactStartY) * arrivalProgress;

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  // Height ruler ticks (cm → y), neutral measurement aid
  const rulerTicks = [0, 25, 50, 71.1, 90];

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 06 • STUMP FACE — TRUE-SCALE OVERLAP
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • EYE-LEVEL
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[11px]">
          <span className="text-slate-400">PROJECTED HEIGHT:</span>
          <span className="font-black text-cyan-300">
            {lbw.stumpHitHeightCm.toFixed(1)} CM
          </span>
          <span className="text-slate-500">/ 71.1 CM</span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#09111c] via-[#060c14] to-[#03060a] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 500 320" className="w-full h-full max-h-[340px] z-10">
          <defs>
            <linearGradient id="stumpWoodGrad6" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
            <linearGradient id="bailWoodGrad6" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>

          {/* Turf ground band */}
          <rect x="0" y={GROUND_Y} width="500" height="30" fill="#14281c" />
          <line x1="0" y1={GROUND_Y} x2="500" y2={GROUND_Y} stroke="#254a33" strokeWidth="2" />
          <text x="14" y={GROUND_Y + 20} fill="#475569" fontSize="10" fontFamily="monospace">
            PITCH SURFACE (0.0 CM)
          </text>

          {/* Height ruler — neutral measurement aid */}
          {rulerTicks.map((cm) => {
            const y = GROUND_Y - cm * PX_PER_CM;
            const isTop = Math.abs(cm - 71.1) < 0.01;
            return (
              <g key={cm}>
                <line
                  x1="440"
                  y1={y}
                  x2="456"
                  y2={y}
                  stroke={isTop ? "#F59E0B" : "#475569"}
                  strokeWidth={isTop ? 1.6 : 1}
                  opacity={isTop ? 0.9 : 0.7}
                />
                <text
                  x="460"
                  y={y + 3}
                  fill={isTop ? "#F59E0B" : "#64748b"}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight={isTop ? "bold" : "normal"}
                >
                  {cm === 71.1 ? "71.1" : cm}
                </text>
              </g>
            );
          })}
          <line x1="448" y1={GROUND_Y - 90 * PX_PER_CM} x2="448" y2={GROUND_Y} stroke="#334155" strokeWidth="1" />

          {/* 50% edge-of-ball reference zone (striking zone + 1 ball radius) */}
          <rect
            x={VIEW_CX - refHalfW}
            y={refTopY}
            width={refHalfW * 2}
            height={GROUND_Y - refTopY}
            fill="rgba(245, 158, 11, 0.05)"
            stroke="#F59E0B"
            strokeWidth="1.2"
            strokeDasharray="5 4"
            opacity="0.85"
          />
          <text
            x={VIEW_CX}
            y={refTopY - 8}
            textAnchor="middle"
            fill="#F59E0B"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
          >
            EDGE-OF-BALL REFERENCE ZONE (50%)
          </text>

          {/* The three stumps (hero scale) */}
          {[offStumpX, VIEW_CX, legStumpX].map((sx, i) => (
            <rect
              key={i}
              x={sx - STUMP_W / 2}
              y={topOfStumpsY}
              width={STUMP_W}
              height={STUMP_H_PX}
              rx="2.5"
              fill="url(#stumpWoodGrad6)"
              stroke="#78350f"
              strokeWidth="1"
            />
          ))}

          {/* Bails (each spans a stump gap) */}
          <rect
            x={(offStumpX + VIEW_CX) / 2 - 15}
            y={bailTopY}
            width="30"
            height="7"
            rx="2"
            fill="url(#bailWoodGrad6)"
            stroke="#78350f"
            strokeWidth="0.8"
          />
          <rect
            x={(VIEW_CX + legStumpX) / 2 - 15}
            y={bailTopY}
            width="30"
            height="7"
            rx="2"
            fill="url(#bailWoodGrad6)"
            stroke="#78350f"
            strokeWidth="0.8"
          />

          {/* Stump labels */}
          <text x={offStumpX} y={GROUND_Y + 14} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="bold">
            {isRight ? "OFF" : "LEG"}
          </text>
          <text x={VIEW_CX} y={GROUND_Y + 14} textAnchor="middle" fill="#cbd5e1" fontSize="10" fontFamily="monospace" fontWeight="bold">
            MIDDLE
          </text>
          <text x={legStumpX} y={GROUND_Y + 14} textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="monospace" fontWeight="bold">
            {isRight ? "LEG" : "OFF"}
          </text>

          {/* Projected flight path from pad impact to the stump plane */}
          <line
            x1={impactStartX}
            y1={impactStartY}
            x2={targetX}
            y2={targetY}
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
          {/* Pad impact origin marker */}
          <circle cx={impactStartX} cy={impactStartY} r="4" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1" />

          {/* Full-size ghost ball at the target (always visible as reference) */}
          <circle
            cx={targetX}
            cy={targetY}
            r={BALL_R}
            fill="rgba(56, 189, 248, 0.12)"
            stroke="rgba(56, 189, 248, 0.8)"
            strokeWidth="1.6"
            strokeDasharray="4 2.5"
          />

          {/* In-flight marker along the projection; solid ball on arrival */}
          {hasArrived ? (
            <g>
              <circle cx={targetX} cy={targetY} r={BALL_R} fill="#dc2626" stroke="#FFFFFF" strokeWidth="1.8" />
              <line
                x1={targetX - BALL_R * 0.65}
                y1={targetY}
                x2={targetX + BALL_R * 0.65}
                y2={targetY}
                stroke="#FFFFFF"
                strokeWidth="1.2"
                strokeDasharray="2 1"
              />
            </g>
          ) : (
            <g>
              <circle cx={currentBallX} cy={currentBallY} r="5" fill="#dc2626" stroke="#FFFFFF" strokeWidth="1.2" />
              <line x1={currentBallX - 18} y1={currentBallY} x2={currentBallX + 18} y2={currentBallY} stroke="#38BDF8" strokeWidth="0.8" />
              <line x1={currentBallX} y1={currentBallY - 18} x2={currentBallX} y2={currentBallY + 18} stroke="#38BDF8" strokeWidth="0.8" />
            </g>
          )}

          {/* True-scale legend */}
          <g transform="translate(70, 60)">
            <circle cx="0" cy="0" r={BALL_R} fill="#dc2626" stroke="#FFFFFF" strokeWidth="1" opacity="0.9" />
            <text x="16" y="-2" fill="#94a3b8" fontSize="9" fontFamily="monospace" fontWeight="bold">
              BALL Ø 7.2 CM
            </text>
            <text x="16" y="9" fill="#64748b" fontSize="8" fontFamily="monospace">
              STUMPS 22.9 CM WIDE • TRUE SCALE
            </text>
          </g>
        </svg>

        {/* Compact neutral status chip — never the outcome */}
        <div className="absolute top-2.5 left-2.5 z-20 font-mono">
          <div className="px-3 py-1.5 rounded-md text-xs font-black border backdrop-blur-md shadow-xl flex items-center gap-2 bg-slate-950/90 border-cyan-500/50 text-cyan-200">
            <Crosshair size={14} className="text-cyan-400" />
            <span>PROJECTED PATH AT STUMP PLANE</span>
          </div>
        </div>
      </div>

      {/* Slim secondary telemetry strip (numbers only — no classification) */}
      <div className="flex items-center justify-center gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="text-[9px] text-slate-400 font-bold">
            HORIZONTAL OFFSET
          </span>
          <span className="text-[11px] font-black text-cyan-300">
            {lbw.stumpHitX > 0
              ? `+${(lbw.stumpHitX * 100).toFixed(1)} cm (LEG)`
              : `${(lbw.stumpHitX * 100).toFixed(1)} cm (OFF)`}
          </span>
        </div>
        <div className="hardware-panel px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="text-[9px] text-slate-400 font-bold">
            HEIGHT AT PLANE
          </span>
          <span className="text-[11px] font-black text-amber-300">
            {lbw.stumpHitHeightCm.toFixed(1)} cm / 71.1 cm
          </span>
        </div>
      </div>
    </div>
  );
};
