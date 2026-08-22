import React from "react";
import type { LBWData } from "../../types/scenario";
import { Crosshair } from "lucide-react";

interface StumpProjectionViewProps {
  lbw: LBWData;
  currentTimeMs: number;
}

/* ================================================================
   CAM 06 • STUMP FACE — SPECIALIST OVERLAP INSTRUMENT (LBW)
   Purpose: "How much of the projected ball overlaps the wicket?"

   CAM 03 answers WHERE the ball projects. CAM 06 measures HOW MUCH
   of it overlaps, at instrument precision:

     • The wicket is the hero at true elevation scale
       (71.1 cm stumps, 22.86 cm zone, 7.2 cm ball — one rule for
       every element, so edges can be compared by eye).
     • The dashed amber box is the 50% overlap reference: the ball
       CENTRE inside the box means at least half the ball is on the
       stumps; the box top is the bail line.
     • A lateral caliper (bottom) and a height ruler (left) read the
       projection in centimetres against the zone edges.
     • The optical magnifier enlarges the critical edge — whichever
       of the side line or the bail line the ball is closest to —
       with a 1 cm comparator scale across the gap.

   Sync: the shared canonical transport drives the projection marker
   1200ms pitch bounce → 1500ms pad impact → 1800ms stump-plane
   arrival. Position comes from raw scenario physics only; no
   classification, outcome or verdict colour is ever rendered.
   ================================================================ */

// Canonical anchors (ms) — shared transport.
const T_BOUNCE = 1200;
const T_IMPACT = 1500;
const T_ARRIVAL = 1800;

// True elevation scale: everything below uses CM→PX through this.
const PX_PER_CM = 3.094; // stump height 71.1cm → 220px hero
const GROUND_Y = 306;
const STUMP_H_PX = 71.1 * PX_PER_CM; // 220
const STUMP_TOP_Y = GROUND_Y - STUMP_H_PX; // 86
const BAIL_TOP_Y = STUMP_TOP_Y - 8; // bails sit above the stump tops
const ZONE_HALF_W = 11.43 * PX_PER_CM; // 35.4 — outer edge of the wicket
const BALL_R = 3.6 * PX_PER_CM; // 11.1 — true half-diameter
const STUMP_W = 3.5 * PX_PER_CM; // 10.8
const STUMP_GAP = ZONE_HALF_W - STUMP_W / 2; // centres at ±29.9
const VIEW_CX = 250;

// stumpHitX is a normalised line coordinate; 0.22 of it corresponds
// to the outer edge of the wicket (same geometry the CAM 03 stump
// HUD draws against). Convert to true centimetres so the caliper,
// the ruler and the printed numbers all measure the same thing.
const X_UNIT_CM = 11.43 / 0.22; // ≈ 51.95 cm per unit
const stumpHitCmX = (stumpHitX: number) => stumpHitX * X_UNIT_CM;
const impactCmX = (impactX: number) => impactX * X_UNIT_CM;

// Caliper scale (bottom strip) is a 2× instrument readout.
const CAL_PX_PER_CM = 6;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const StumpProjectionView: React.FC<StumpProjectionViewProps> = ({
  lbw,
  currentTimeMs,
}) => {
  // --- Shared canonical clock ---
  const clampedTime = Math.max(T_BOUNCE, Math.min(2000, currentTimeMs));
  const segBounceToPad = clamp01((clampedTime - T_BOUNCE) / (T_IMPACT - T_BOUNCE));
  const segPadToPlane = clamp01((clampedTime - T_IMPACT) / (T_ARRIVAL - T_IMPACT));
  const hasArrived = clampedTime >= T_ARRIVAL;

  // --- Projection geometry (true cm at the stump plane) ---
  const targetCm = {
    x: stumpHitCmX(lbw.stumpHitX),
    y: lbw.stumpHitHeightCm,
  };
  const targetX = VIEW_CX + targetCm.x * PX_PER_CM;
  const targetY = GROUND_Y - targetCm.y * PX_PER_CM;
  const impactX = VIEW_CX + impactCmX(lbw.impactX) * PX_PER_CM;
  const impactY = GROUND_Y - lbw.impactHeight * PX_PER_CM;
  // Pitch bounce anchor: schematic origin of the post-bounce segment.
  const bounceX = impactX - 46;
  const bounceY = Math.min(GROUND_Y - 6, impactY + 62);

  const marker =
    clampedTime < T_IMPACT
      ? {
          x: bounceX + (impactX - bounceX) * segBounceToPad,
          y: bounceY + (impactY - bounceY) * segBounceToPad,
        }
      : {
          x: impactX + (targetX - impactX) * segPadToPlane,
          y: impactY + (targetY - impactY) * segPadToPlane,
        };

  // --- Critical margins for the magnifier: signed distance from the ball
  //     CENTRE to the boundary it is closest to — the near side line or
  //     the bail line. Positive = centre inside the 50% conditions. ---
  const sideCenterCm = 11.43 - Math.abs(targetCm.x); // + = centre within the wicket lines
  const bailCenterCm = 71.1 - lbw.stumpHitHeightCm; // + = centre below the bail line
  const sideEdgeX = VIEW_CX + Math.sign(targetCm.x || 1) * ZONE_HALF_W;

  const focusHorizontal = Math.abs(sideCenterCm) <= Math.abs(bailCenterCm);
  const focus = focusHorizontal
    ? { x: (targetX + sideEdgeX) / 2, y: targetY }
    : { x: targetX, y: (targetY + BAIL_TOP_Y) / 2 };

  const MAG = { cx: 408, cy: 84, r: 56, zoom: 2.6 };
  const magTransform = `translate(${MAG.cx} ${MAG.cy}) scale(${MAG.zoom}) translate(${-focus.x} ${-focus.y})`;

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);
  const isRight = lbw.batterHand === "RIGHT";
  const offStumpX = VIEW_CX + (isRight ? -STUMP_GAP : STUMP_GAP);
  const legStumpX = VIEW_CX + (isRight ? STUMP_GAP : -STUMP_GAP);

  // Ruler + caliper tick sets (cm)
  const rulerCms = [0, 10, 20, 30, 40, 50, 60, 71.1, 80, 90];
  const calCms = [-20, -15, -10, -5, 0, 5, 10, 15, 20];

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 06 • STUMP FACE — OVERLAP INSTRUMENT
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • EYE-LEVEL
          </span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#09111c] via-[#060c14] to-[#03060a] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 500 350" className="w-full h-full max-h-[340px] z-10">
          <defs>
            <linearGradient id="stumpWoodGrad6" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f5a623" />
              <stop offset="50%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#8a5a10" />
            </linearGradient>
            <linearGradient id="bailWoodGrad6" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
            <clipPath id="magClip6">
              <circle cx={MAG.cx} cy={MAG.cy} r={MAG.r} />
            </clipPath>
          </defs>

          {/* Faint 10 cm measurement grid — fills the frame with scale */}
          {Array.from({ length: 13 }, (_, i) => VIEW_CX - 180 + i * 30.94).map((x) => (
            <line key={`gv${x}`} x1={x} y1={STUMP_TOP_Y - 20} x2={x} y2={GROUND_Y} stroke="#132033" strokeWidth="0.6" />
          ))}
          {Array.from({ length: 9 }, (_, i) => GROUND_Y - i * 30.94).map((y) => (
            <line key={`gh${y}`} x1={VIEW_CX - 180} y1={y} x2={VIEW_CX + 180} y2={y} stroke="#132033" strokeWidth="0.6" />
          ))}

          {/* Turf ground band */}
          <rect x="0" y={GROUND_Y} width="500" height="44" fill="#122318" />
          <line x1="0" y1={GROUND_Y} x2="500" y2={GROUND_Y} stroke="#2a4a35" strokeWidth="2" />

          {/* ===== 50% overlap reference zone (ball CENTRE inside ⇒ ≥50% on the wicket) ===== */}
          <rect
            x={VIEW_CX - ZONE_HALF_W}
            y={BAIL_TOP_Y}
            width={ZONE_HALF_W * 2}
            height={GROUND_Y - BAIL_TOP_Y}
            fill="rgba(245, 158, 11, 0.06)"
            stroke="#F59E0B"
            strokeWidth="1.4"
            strokeDasharray="6 4"
            opacity="0.9"
          />
          <text x={VIEW_CX} y={14} textAnchor="middle" fill="#F59E0B" fontSize="9" fontFamily="monospace" fontWeight="bold" opacity="0.9">
            50% OVERLAP REFERENCE ZONE
          </text>
          <text x={VIEW_CX} y={25} textAnchor="middle" fill="#92703a" fontSize="7.5" fontFamily="monospace">
            BALL CENTRE INSIDE ZONE = AT LEAST HALF THE BALL ON THE WICKET
          </text>

          {/* ===== The wicket (hero, true scale) ===== */}
          {[offStumpX, VIEW_CX, legStumpX].map((sx, i) => (
            <g key={i}>
              <rect
                x={sx - STUMP_W / 2}
                y={STUMP_TOP_Y}
                width={STUMP_W}
                height={STUMP_H_PX}
                rx="2"
                fill="url(#stumpWoodGrad6)"
                stroke="#6b4413"
                strokeWidth="1"
              />
              <line x1={sx - STUMP_W / 6} y1={STUMP_TOP_Y + 6} x2={sx - STUMP_W / 6} y2={GROUND_Y - 8} stroke="#f8c56a" strokeWidth="1" opacity="0.5" />
            </g>
          ))}
          {/* Bails */}
          <rect x={(offStumpX + VIEW_CX) / 2 - 16} y={BAIL_TOP_Y} width="32" height="8" rx="2.5" fill="url(#bailWoodGrad6)" stroke="#78350f" strokeWidth="0.8" />
          <rect x={(VIEW_CX + legStumpX) / 2 - 16} y={BAIL_TOP_Y} width="32" height="8" rx="2.5" fill="url(#bailWoodGrad6)" stroke="#78350f" strokeWidth="0.8" />

          {/* Stump station labels */}
          <text x={offStumpX} y={GROUND_Y + 13} textAnchor="middle" fill="#8fa3b8" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
            {isRight ? "OFF" : "LEG"}
          </text>
          <text x={VIEW_CX} y={GROUND_Y + 13} textAnchor="middle" fill="#c4d2e0" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
            MIDDLE
          </text>
          <text x={legStumpX} y={GROUND_Y + 13} textAnchor="middle" fill="#8fa3b8" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
            {isRight ? "LEG" : "OFF"}
          </text>

          {/* ===== Height ruler (left) — neutral measurement aid ===== */}
          {rulerCms.map((cm) => {
            const y = GROUND_Y - cm * PX_PER_CM;
            const isStumpTop = Math.abs(cm - 71.1) < 0.01;
            return (
              <g key={cm}>
                <line x1="40" y1={y} x2="52" y2={y} stroke={isStumpTop ? "#F59E0B" : "#4a5b70"} strokeWidth={isStumpTop ? 1.6 : 1} />
                <text x="37" y={y + 2.6} textAnchor="end" fill={isStumpTop ? "#F59E0B" : "#64748b"} fontSize="8" fontFamily="monospace" fontWeight={isStumpTop ? "bold" : "normal"}>
                  {isStumpTop ? "71.1" : cm}
                </text>
              </g>
            );
          })}
          <line x1="46" y1={GROUND_Y - 90 * PX_PER_CM} x2="46" y2={GROUND_Y} stroke="#334155" strokeWidth="1" />
          <text x="14" y={STUMP_TOP_Y - 26} fill="#5b6c81" fontSize="7.5" fontFamily="monospace" fontWeight="bold" transform={`rotate(-90 14 ${STUMP_TOP_Y - 26})`}>
            HEIGHT AT PLANE (CM)
          </text>
          {/* Bail-height line linking the ruler to the zone top */}
          <line x1="46" y1={BAIL_TOP_Y} x2={VIEW_CX - ZONE_HALF_W} y2={BAIL_TOP_Y} stroke="#F59E0B" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.5" />
          {/* Ball-height needle (measures the projected height) */}
          <line x1="44" y1={targetY} x2={targetX - BALL_R - 2} y2={targetY} stroke="#dc2626" strokeWidth="0.9" opacity="0.75" />
          <path d={`M44 ${targetY} l5 -2.6 v5.2 z`} fill="#dc2626" />

          {/* ===== Projection: pitch bounce → pad impact → stump plane ===== */}
          {/* Pitch anchor (1200ms event — syncs with CAM 01 / CAM 03) */}
          <path d={`M ${bounceX} ${bounceY} l 3.5 6 h -7 z`} fill="#64748b" opacity="0.8" />
          <text x={bounceX - 6} y={bounceY + 16} textAnchor="middle" fill="#4e6076" fontSize="7.5" fontFamily="monospace">
            PITCH
          </text>
          <line x1={bounceX} y1={bounceY} x2={impactX} y2={impactY} stroke="rgba(100, 116, 139, 0.45)" strokeWidth="1.4" strokeDasharray="3 4" />
          <line x1={impactX} y1={impactY} x2={targetX} y2={targetY} stroke="rgba(56, 189, 248, 0.5)" strokeWidth="2" strokeDasharray="5 3" />
          {/* Pad impact origin */}
          <circle cx={impactX} cy={impactY} r="4" fill="#FACC15" stroke="#FFFFFF" strokeWidth="1" />
          <text x={impactX + 7} y={impactY + 3} fill="#a09546" fontSize="7.5" fontFamily="monospace">
            PAD
          </text>

          {/* Ghost ball at the trajectory endpoint (always visible) */}
          <circle cx={targetX} cy={targetY} r={BALL_R} fill="rgba(56, 189, 248, 0.10)" stroke="rgba(56, 189, 248, 0.75)" strokeWidth="1.4" strokeDasharray="4 2.5" />

          {/* In-flight marker; solid true-scale ball at arrival */}
          {hasArrived ? (
            <g>
              <circle cx={targetX} cy={targetY} r={BALL_R} fill="#dc2626" stroke="#FFFFFF" strokeWidth="1.6" />
              <ellipse cx={targetX} cy={targetY} rx={BALL_R * 0.85} ry={BALL_R * 0.25} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="0.9" />
            </g>
          ) : (
            <g>
              <circle cx={marker.x} cy={marker.y} r="5" fill="#dc2626" stroke="#FFFFFF" strokeWidth="1.2" />
              <line x1={marker.x - 14} y1={marker.y} x2={marker.x + 14} y2={marker.y} stroke="#38BDF8" strokeWidth="0.7" />
              <line x1={marker.x} y1={marker.y - 14} x2={marker.x} y2={marker.y + 14} stroke="#38BDF8" strokeWidth="0.7" />
            </g>
          )}

          {/* ===== Lateral caliper (bottom) — 2× instrument readout ===== */}
          <g>
            <line x1={VIEW_CX - 20 * CAL_PX_PER_CM} y1="332" x2={VIEW_CX + 20 * CAL_PX_PER_CM} y2="332" stroke="#4a5b70" strokeWidth="1.2" />
            {calCms.map((cm) => (
              <g key={cm}>
                <line x1={VIEW_CX + cm * CAL_PX_PER_CM} y1="328" x2={VIEW_CX + cm * CAL_PX_PER_CM} y2="336" stroke="#4a5b70" strokeWidth={cm === 0 ? 1.6 : 1} />
                {cm % 10 === 0 && (
                  <text x={VIEW_CX + cm * CAL_PX_PER_CM} y="345" textAnchor="middle" fill="#5b6c81" fontSize="7.5" fontFamily="monospace">
                    {cm > 0 ? `+${cm}` : cm}
                  </text>
                )}
              </g>
            ))}
            {/* Zone edges on the caliper */}
            {[-11.43, 11.43].map((cm) => (
              <line key={cm} x1={VIEW_CX + cm * CAL_PX_PER_CM} y1="325" x2={VIEW_CX + cm * CAL_PX_PER_CM} y2="339" stroke="#F59E0B" strokeWidth="1.4" />
            ))}
            {/* Ball centre needle (lateral position, same cm as the hero) */}
            <line x1={VIEW_CX + targetCm.x * CAL_PX_PER_CM} y1="322" x2={VIEW_CX + targetCm.x * CAL_PX_PER_CM} y2="339" stroke="#dc2626" strokeWidth="1.6" />
            <path d={`M${VIEW_CX + targetCm.x * CAL_PX_PER_CM} 321 l3.4 5 h-6.8 z`} fill="#dc2626" />
            <text x={VIEW_CX - 20 * CAL_PX_PER_CM} y="322" fill="#5b6c81" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
              LATERAL CALIPER (CM FROM MIDDLE)
            </text>
            <text x={VIEW_CX + 11.43 * CAL_PX_PER_CM + 3} y="324" fill="#F59E0B" fontSize="7" fontFamily="monospace">
              ZONE
            </text>
          </g>

          {/* ===== Optical edge magnifier — enlarges the critical edge ===== */}
          <line x1={focus.x} y1={focus.y} x2={MAG.cx - MAG.r - 4} y2={MAG.cy} stroke="#38BDF8" strokeWidth="0.7" strokeDasharray="2 3" opacity="0.6" />
          <g clipPath="url(#magClip6)">
            <rect x={MAG.cx - MAG.r} y={MAG.cy - MAG.r} width={MAG.r * 2} height={MAG.r * 2} fill="#050a12" opacity="0.92" />
            <g transform={magTransform}>
              {/* 1 cm comparator ticks along the measured axis */}
              {Array.from({ length: 9 }, (_, i) => -4 + i).map((cm) => {
                const off = cm * PX_PER_CM;
                return focusHorizontal ? (
                  <line key={cm} x1={focus.x + off} y1={focus.y - 14} x2={focus.x + off} y2={focus.y + 14} stroke="#38BDF8" strokeWidth={0.35} opacity="0.8" />
                ) : (
                  <line key={cm} x1={focus.x - 14} y1={focus.y + off} x2={focus.x + 14} y2={focus.y + off} stroke="#38BDF8" strokeWidth={0.35} opacity="0.8" />
                );
              })}
              {/* The boundary being judged */}
              {focusHorizontal ? (
                <line x1={sideEdgeX} y1={focus.y - 26} x2={sideEdgeX} y2={focus.y + 26} stroke="#F59E0B" strokeWidth={1.1} strokeDasharray="3 2" />
              ) : (
                <line x1={focus.x - 26} y1={BAIL_TOP_Y} x2={focus.x + 26} y2={BAIL_TOP_Y} stroke="#F59E0B" strokeWidth={1.1} strokeDasharray="3 2" />
              )}
              {/* Ball CENTRE line — the 50% reference comparison */}
              {focusHorizontal ? (
                <line x1={targetX} y1={focus.y - 26} x2={targetX} y2={focus.y + 26} stroke="#7dd3fc" strokeWidth={0.5} />
              ) : (
                <line x1={focus.x - 26} y1={targetY} x2={focus.x + 26} y2={targetY} stroke="#7dd3fc" strokeWidth={0.5} />
              )}
              {/* The ball itself, true scale (magnified by the group) */}
              <circle cx={targetX} cy={targetY} r={BALL_R} fill="#dc2626" stroke="#FFFFFF" strokeWidth={0.9} opacity={hasArrived ? 1 : 0.55} />
            </g>
          </g>
          <circle cx={MAG.cx} cy={MAG.cy} r={MAG.r} fill="none" stroke="#38BDF8" strokeWidth="1.6" />
          <circle cx={MAG.cx} cy={MAG.cy} r={MAG.r + 3} fill="none" stroke="#1e4a63" strokeWidth="0.8" />
          <text x={MAG.cx - MAG.r + 8} y={MAG.cy - MAG.r + 14} fill="#7dd3fc" fontSize="8" fontFamily="monospace" fontWeight="bold">
            EDGE ×2.6
          </text>
          {/* Gap readout — a measurement, never a classification */}
          <rect x={MAG.cx - 52} y={MAG.cy + MAG.r - 26} width="104" height="18" rx="3" fill="#02060c" stroke="#1e4a63" strokeWidth="0.8" />
          <text x={MAG.cx} y={MAG.cy + MAG.r - 13} textAnchor="middle" fill="#e2e8f0" fontSize="8.5" fontFamily="monospace" fontWeight="bold">
            {focusHorizontal
              ? `CENTRE ${Math.abs(sideCenterCm).toFixed(1)} CM ${sideCenterCm >= 0 ? "INSIDE LINE" : "OUTSIDE LINE"}`
              : `CENTRE ${Math.abs(bailCenterCm).toFixed(1)} CM ${bailCenterCm >= 0 ? "BELOW BAIL" : "ABOVE BAIL"}`}
          </text>
        </svg>

        {/* Compact neutral status chip — never the outcome */}
        <div className="absolute top-2.5 left-2.5 z-20 font-mono">
          <div className="px-3 py-1.5 rounded-md text-xs font-black border backdrop-blur-md shadow-xl flex items-center gap-2 bg-slate-950/90 border-cyan-500/50 text-cyan-200">
            <Crosshair size={14} className="text-cyan-400" />
            <span>PROJECTED PATH AT STUMP PLANE</span>
          </div>
        </div>
      </div>

      {/* Slim secondary telemetry strip (measurements only — no classification) */}
      <div className="flex items-center justify-center gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="text-[9px] text-slate-400 font-bold">
            HORIZONTAL OFFSET
          </span>
          <span className="text-[11px] font-black text-cyan-300">
            {targetCm.x >= 0
              ? `+${targetCm.x.toFixed(1)} cm (LEG)`
              : `${targetCm.x.toFixed(1)} cm (OFF)`}
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
        <div className="hardware-panel px-3 py-1.5 rounded-lg flex items-center gap-2">
          <span className="text-[9px] text-slate-400 font-bold">BALL Ø</span>
          <span className="text-[11px] font-black text-slate-200">7.2 CM TRUE SCALE</span>
        </div>
      </div>
    </div>
  );
};
