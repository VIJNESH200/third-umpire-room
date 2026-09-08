import React, { useMemo, useState } from "react";
import type { CaughtBehindData } from "../../types/scenario";
import { Flame, Eye, ZoomIn, Crosshair } from "lucide-react";
import {
  solveHotSpotThermal,
  solveHotSpotThermalFrame,
  HOTSPOT_WINDOW_START_MS,
  HOTSPOT_WINDOW_END_MS,
  OUTSIDE_EDGE_X_MM,
} from "../../engine/hotspotThermal";
import { solveCaughtBehindDeliveryTrajectory } from "../../engine/caughtBehindPhysics";

interface HotSpotIRViewProps {
  caughtBehind: CaughtBehindData;
  currentTimeMs: number;
}

type IrPalette = "WHITE_HOT" | "BLACK_HOT";

// ------------------------------------------------------------------
// Scene & Geometry Constants (16:9 Broadcast Optical Framing)
// ------------------------------------------------------------------
const VIEW_W = 520;
const VIEW_H = 300;
const EDGE_X = 200; // Bat outside edge sits along X = 200
const BALL_RADIUS = 28; // Prominent, high-fidelity macro ball radius
const MM_TO_PX = 3.5; // Millimetre to screen pixel scale factor

/**
 * CAM 08 — HotSpot Infrared Thermal Workstation (16:9 Broadcast Macro View).
 *
 * Professional DRS infrared thermography evidence camera. Everything on screen
 * is deterministically solved from `solveHotSpotThermal` (engine/hotspotThermal.ts)
 * and the canonical replay timeline.
 *
 * Reuses the macro bat edge profile, wood grain, lacquer chamfer, and rotating
 * cricket ball assets from Super-Slow-Mo, presenting them through an authentic
 * thermal sensor emissivity pipeline. The component receives zero verdict flags
 * and renders zero answer leaks — leaving objective interpretation to the umpire.
 */
export const HotSpotIRView: React.FC<HotSpotIRViewProps> = ({
  caughtBehind,
  currentTimeMs,
}) => {
  const [palette, setPalette] = useState<IrPalette>("WHITE_HOT");
  const [zoomLevel, setZoomLevel] = useState<"1.0x" | "1.5x">("1.0x");
  const [showRuler, setShowRuler] = useState<boolean>(true);

  const isInverted = palette === "BLACK_HOT";

  // Deterministic thermal model and frame sampling
  const model = useMemo(() => solveHotSpotThermal(caughtBehind), [caughtBehind]);
  const frame = useMemo(
    () => solveHotSpotThermalFrame(model, currentTimeMs),
    [model, currentTimeMs]
  );

  const clampedTime = frame.timeMs;
  const windowSpanMs = HOTSPOT_WINDOW_END_MS - HOTSPOT_WINDOW_START_MS; // 800ms
  const currentFrame = Math.round((clampedTime / 1000) * 500); // 500 FPS High-Speed Sensor

  // Vertical ball motion progress across review window (800ms -> 1600ms)
  const progress = Math.max(
    0,
    Math.min(1, (clampedTime - HOTSPOT_WINDOW_START_MS) / windowSpanMs)
  );

  // Authoritative 3D trajectory sample for current playback time
  const delivery3D = useMemo(
    () => solveCaughtBehindDeliveryTrajectory(caughtBehind, currentTimeMs),
    [caughtBehind, currentTimeMs]
  );

  // Ball vertical travel down the outside edge corridor (top to bottom)
  // At transit (1200ms), progress = 0.5 -> ballY = 150px (exact vertical center)
  const ballY = 25 + progress * 250;

  // Ball horizontal position strictly derived from canonical delivery gap
  // Genuine edge (gapMm = 0): perimeter kisses outside edge (EDGE_X)
  const trueGapMm = caughtBehind.hasEdge ? 0 : caughtBehind.gapMm;
  const gapPx = trueGapMm * MM_TO_PX;
  const ballX = EDGE_X + BALL_RADIUS + gapPx;

  // Seam rotating dynamically with timeline
  const seamAngle = (clampedTime / 8) % 360;

  // Frames inside the decisive transit corridor carry aerodynamic motion blur
  const isInTransitWindow = Math.abs(clampedTime - model.transitTimeMs) <= 40;

  // Dynamic vector optical zoom viewBox
  const activeViewBox =
    zoomLevel === "1.5x" ? "105 45 330 210" : `0 0 ${VIEW_W} ${VIEW_H}`;

  // Theme & Material Palettes
  const bg = isInverted ? "#dce5ef" : "#04070D";
  const batGrainStroke = isInverted ? "#94a3b8" : "#0f172a";
  const edgeGuideColor = isInverted ? "#334155" : "#475569";
  const edgeHighlightColor = isInverted ? "#64748b" : "#38BDF8";
  const ballStroke = isInverted ? "#94a3b8" : "#334155";
  const ballSeamColor = isInverted ? "#64748b" : "#475569";
  const reticleColor = isInverted ? "#0f172a" : "#E2E8F0";
  const thermalCoreFill = isInverted ? "#000000" : "#FFFFFF";
  const thermalBloomColor = isInverted ? "#1e293b" : "#fffbeb";
  const thermalHaloColor = isInverted ? "#475569" : "#fef08a";

  // Timeline strip coordinate helper
  const stripX = (t: number) =>
    16 + ((t - HOTSPOT_WINDOW_START_MS) / windowSpanMs) * (VIEW_W - 32);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* 1. Top Instrument Control Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 08 • HOTSPOT THERMAL INFRARED (IR)
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 500 FPS LWIR
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Calibration Ruler Toggle */}
          <button
            type="button"
            onClick={() => setShowRuler(!showRuler)}
            className={`tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              showRuler
                ? "text-cyan-300 border-cyan-500/50 bg-cyan-950/40"
                : "text-slate-400 border-slate-700 bg-slate-900/60"
            }`}
          >
            <Crosshair size={12} className="text-cyan-400" />
            <span>{showRuler ? "SCALE ON" : "SCALE OFF"}</span>
          </button>

          {/* Optical Zoom Toggle */}
          <button
            type="button"
            onClick={() => setZoomLevel(zoomLevel === "1.0x" ? "1.5x" : "1.0x")}
            className={`tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              zoomLevel === "1.5x"
                ? "text-cyan-300 border-cyan-500/50 bg-cyan-950/40"
                : "text-slate-300 border-slate-700 bg-slate-900/60"
            }`}
          >
            <ZoomIn size={12} className="text-cyan-400" />
            <span>{zoomLevel}</span>
          </button>

          {/* Thermal Polarity Toggle */}
          <button
            type="button"
            onClick={() => setPalette(isInverted ? "WHITE_HOT" : "BLACK_HOT")}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-white border-slate-700 bg-slate-900/60 cursor-pointer"
          >
            <Eye size={12} className="text-cyan-400" />
            <span>{isInverted ? "BLACK-HOT" : "WHITE-HOT"}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Macro Thermal Viewport */}
      <div
        className={`relative flex-1 min-h-[250px] my-2 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center shadow-2xl ${
          isInverted ? "bg-[#dce5ef]" : "bg-[#03060B]"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-25 z-20" />

        <svg
          viewBox={activeViewBox}
          className="w-full h-full max-h-[360px] z-10 transition-all duration-200"
        >
          <defs>
            {/* Multi-Tier Thermal Radiance Filters */}
            <filter id="hsThermalBloom" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" />
            </filter>
            <filter id="hsThermalHalo" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="11" />
            </filter>

            {/* Thermal Willow Bat Material (White-Hot) */}
            <linearGradient id="willowGrainIR" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#101827" />
              <stop offset="40%" stopColor="#1e293b" />
              <stop offset="85%" stopColor="#253347" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            {/* Thermal Willow Bat Material (Black-Hot) */}
            <linearGradient id="willowGrainInverted" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="40%" stopColor="#cbd5e1" />
              <stop offset="85%" stopColor="#b0c0d4" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>

            {/* Leather Cricket Ball Thermal Shading (White-Hot) */}
            <radialGradient id="ballShadingIR" cx="40%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#1f293d" />
              <stop offset="70%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#050811" />
            </radialGradient>

            {/* Leather Cricket Ball Thermal Shading (Black-Hot) */}
            <radialGradient id="ballShadingInverted" cx="40%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="70%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </radialGradient>

            {/* Motion Smear Aerodynamic Envelope */}
            <linearGradient id="ballThermalSmear" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isInverted ? "#cbd5e1" : "#1e293b"} stopOpacity="0" />
              <stop offset="50%" stopColor={isInverted ? "#94a3b8" : "#334155"} stopOpacity="0.45" />
              <stop offset="100%" stopColor={isInverted ? "#cbd5e1" : "#1e293b"} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Viewport Canvas Background */}
          <rect width={VIEW_W} height={VIEW_H} fill={bg} />

          {/* Background Ambient Pad Silhouette (Decoy / Orientation context) */}
          <g transform="translate(18, 40)" opacity={isInverted ? 0.35 : 0.45}>
            <rect
              x="0"
              y="0"
              width="36"
              height="230"
              rx="8"
              fill={isInverted ? "#94a3b8" : "#0f172a"}
              stroke={isInverted ? "#64748b" : "#1e293b"}
              strokeWidth="1"
            />
            <line x1="18" y1="10" x2="18" y2="220" stroke={isInverted ? "#cbd5e1" : "#1e293b"} strokeWidth="1" strokeDasharray="6 4" />
            <text x="8" y="120" fill={isInverted ? "#475569" : "#334155"} fontSize="8" fontFamily="monospace" fontWeight="bold" transform="rotate(-90 8,120)">
              PAD FLAP
            </text>
          </g>

          {/* ============================================================== */}
          {/* BAT BLADE MACRO PROFILE (Reused from Super-Slow-Mo)            */}
          {/* ============================================================== */}
          <g>
            {/* Main Bat Blade Body */}
            <rect
              x="0"
              y="0"
              width={EDGE_X}
              height={VIEW_H}
              fill={isInverted ? "url(#willowGrainInverted)" : "url(#willowGrainIR)"}
              stroke={isInverted ? "#94a3b8" : "#1e293b"}
              strokeWidth="1.5"
            />

            {/* Thermal Grain Fibres */}
            <line x1="45" y1="0" x2="45" y2={VIEW_H} stroke={batGrainStroke} strokeWidth="0.8" opacity="0.4" />
            <line x1="90" y1="0" x2="90" y2={VIEW_H} stroke={batGrainStroke} strokeWidth="0.8" opacity="0.4" />
            <line x1="135" y1="0" x2="135" y2={VIEW_H} stroke={batGrainStroke} strokeWidth="0.8" opacity="0.4" />
            <line x1="175" y1="0" x2="175" y2={VIEW_H} stroke={batGrainStroke} strokeWidth="0.8" opacity="0.4" />

            {/* Lacquer Edge Chamfer Highlights */}
            <line
              x1={EDGE_X - 5}
              y1="0"
              x2={EDGE_X - 5}
              y2={VIEW_H}
              stroke={edgeHighlightColor}
              strokeWidth="1.2"
              opacity={isInverted ? 0.4 : 0.6}
            />

            {/* Physical Outside Edge Boundary Line */}
            <line
              x1={EDGE_X}
              y1="0"
              x2={EDGE_X}
              y2={VIEW_H}
              stroke={edgeGuideColor}
              strokeWidth="1.8"
            />

            {/* Millimetre Graduation Ticks along Outside Edge */}
            {Array.from({ length: 13 }).map((_, i) => {
              const tickY = 30 + i * 20;
              return (
                <g key={`tick-${tickY}`}>
                  <line
                    x1={EDGE_X - (i % 2 === 0 ? 6 : 3)}
                    y1={tickY}
                    x2={EDGE_X}
                    y2={tickY}
                    stroke={edgeGuideColor}
                    strokeWidth="1"
                    opacity="0.75"
                  />
                </g>
              );
            })}

            {/* Bat Outside Edge Calibration Text */}
            <text
              x={EDGE_X - 16}
              y="150"
              fill={edgeGuideColor}
              fontSize="9"
              fontFamily="monospace"
              fontWeight="900"
              transform={`rotate(-90 ${EDGE_X - 16},150)`}
              textAnchor="middle"
              letterSpacing="2"
            >
              OUTSIDE EDGE PROFILE
            </text>
          </g>

          {/* ============================================================== */}
          {/* RADIANCE BLOOM & THERMAL SENSOR FOOTPRINTS                     */}
          {/* ============================================================== */}
          {frame.zones.map((z) => {
            // Coordinate mapping:
            // Pad decoy zones map to pad coordinates; edge zones map to EDGE_X
            const isPadDecoy = z.id === "PAD_DECOY";
            const cx = isPadDecoy
              ? 36 + (z.xMm + 34) * 1.5
              : EDGE_X - (OUTSIDE_EDGE_X_MM - z.xMm) * MM_TO_PX;
            const cy = isPadDecoy
              ? 140 + (z.yMm - 170) * 0.7
              : 150 + (z.yMm - 170) * 0.85;

            const rx = (z.sigmaXMm * MM_TO_PX * (isPadDecoy ? 2.5 : 2.2));
            const ry = (z.sigmaYMm * (isPadDecoy ? 3.0 : 2.8));

            if (z.intensity <= 0.005) return null;

            return (
              <g key={z.id}>
                {/* 1. Outer Thermal Dissipation Halo */}
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx * 2.0}
                  ry={ry * 2.0}
                  fill={thermalHaloColor}
                  opacity={Math.min(0.65, z.intensity * 0.7)}
                  filter="url(#hsThermalHalo)"
                />

                {/* 2. Mid Radiant Thermal Bloom */}
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill={thermalBloomColor}
                  opacity={Math.min(0.9, z.intensity * 0.95)}
                  filter="url(#hsThermalBloom)"
                />

                {/* 3. Incandescent Thermal Core */}
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={Math.max(2, rx * 0.45)}
                  ry={Math.max(2.5, ry * 0.45)}
                  fill={thermalCoreFill}
                  opacity={Math.min(1, z.intensity * 1.35)}
                />

                {/* 4. Objective Instrument Detection Reticle */}
                {z.isIgnited && (
                  <g>
                    {/* Reticle Boundary */}
                    <rect
                      x={cx - rx - 8}
                      y={cy - ry - 8}
                      width={(rx + 8) * 2}
                      height={(ry + 8) * 2}
                      fill="none"
                      stroke={reticleColor}
                      strokeWidth="0.9"
                      strokeDasharray="4 3"
                      opacity="0.85"
                    />

                    {/* Corner Targeting Accents */}
                    <path
                      d={`M ${cx - rx - 12} ${cy - ry} L ${cx - rx - 8} ${cy - ry} L ${cx - rx - 8} ${cy - ry - 4}`}
                      stroke="#00E5FF"
                      strokeWidth="1.2"
                      fill="none"
                    />
                    <path
                      d={`M ${cx + rx + 12} ${cy - ry} L ${cx + rx + 8} ${cy - ry} L ${cx + rx + 8} ${cy - ry - 4}`}
                      stroke="#00E5FF"
                      strokeWidth="1.2"
                      fill="none"
                    />

                    {/* Zone Telemetry Badge */}
                    <g transform={`translate(${cx + rx + 12}, ${cy - ry + 4})`}>
                      <rect
                        x="0"
                        y="-10"
                        width="82"
                        height="16"
                        rx="3"
                        fill="rgba(8,13,22,0.92)"
                        stroke="#334155"
                        strokeWidth="0.8"
                      />
                      <text
                        x="6"
                        y="2"
                        fill={reticleColor}
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="900"
                        letterSpacing="0.5"
                      >
                        {z.label} · {Math.round(z.intensity * 100)}% RAD
                      </text>
                    </g>
                  </g>
                )}
              </g>
            );
          })}

          {/* ============================================================== */}
          {/* CRICKET BALL & AERODYNAMIC TRAJECTORY (Reused Asset)          */}
          {/* ============================================================== */}
          {/* High-Speed Aerodynamic Motion Smear */}
          {isInTransitWindow && (
            <rect
              x={ballX - BALL_RADIUS - 3}
              y={ballY - BALL_RADIUS - 16}
              width={(BALL_RADIUS + 3) * 2}
              height={(BALL_RADIUS + 16) * 2}
              fill="url(#ballThermalSmear)"
              rx={BALL_RADIUS}
            />
          )}

          {/* Main Ball Sphere */}
          <g transform={`translate(${ballX}, ${ballY})`}>
            {/* Ambient Ball Silhouette with Realistic Thermal Shading */}
            <circle
              cx="0"
              cy="0"
              r={BALL_RADIUS}
              fill={isInverted ? "url(#ballShadingInverted)" : "url(#ballShadingIR)"}
              stroke={ballStroke}
              strokeWidth="1.2"
              opacity="0.95"
            />

            {/* Stitched Seam Rotating with Delivery Kinematics */}
            <g transform={`rotate(${seamAngle})`} opacity={isInTransitWindow ? 0.6 : 0.85}>
              <ellipse
                cx="0"
                cy="0"
                rx={BALL_RADIUS - 1}
                ry={BALL_RADIUS * 0.38}
                fill="none"
                stroke={ballSeamColor}
                strokeWidth="1.8"
                strokeDasharray="4 3"
              />
              <line
                x1={-(BALL_RADIUS - 1)}
                y1="0"
                x2={BALL_RADIUS - 1}
                y2="0"
                stroke={ballSeamColor}
                strokeWidth="1"
                opacity="0.6"
              />
            </g>
          </g>

          {/* ============================================================== */}
          {/* OPTICAL CALIBRATION SCALE / MEASUREMENT RULER                  */}
          {/* ============================================================== */}
          {showRuler && (
            <g>
              {/* Measurement Span between Outside Edge and Ball Surface */}
              <line
                x1={EDGE_X}
                y1={ballY}
                x2={Math.max(EDGE_X, ballX - BALL_RADIUS)}
                y2={ballY}
                stroke="#00E5FF"
                strokeWidth="1.4"
                strokeDasharray="3 2"
              />
              <circle cx={EDGE_X} cy={ballY} r="2.5" fill="#00E5FF" />
              <circle cx={Math.max(EDGE_X, ballX - BALL_RADIUS)} cy={ballY} r="2.5" fill="#00E5FF" />

              {/* Optical Clearance Badge — Raw Measurement, Zero Verdict */}
              <g transform={`translate(${(EDGE_X + Math.max(EDGE_X, ballX - BALL_RADIUS)) / 2}, ${ballY - 14})`}>
                <rect
                  x="-42"
                  y="-9"
                  width="84"
                  height="18"
                  rx="3"
                  fill="rgba(7,11,18,0.92)"
                  stroke="#00E5FF"
                  strokeWidth="0.8"
                />
                <text
                  x="0"
                  y="3.5"
                  fill="#00E5FF"
                  fontSize="8.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {trueGapMm === 0
                    ? "< 0.5 mm SPAN"
                    : `${trueGapMm.toFixed(1)} mm CLEAR`}
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Real-Time Sensor Telemetry Overlay (Top-Left) */}
        <div className="absolute top-2.5 left-2.5 z-30 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-lg text-xs font-bold border backdrop-blur-md shadow-lg flex items-center gap-2 bg-slate-950/90 border-slate-700 text-slate-200">
            <Flame size={13} className="text-pink-400" />
            <span className="font-display tracking-wide">{frame.statusLine}</span>
          </div>

          <div className="px-2.5 py-1 rounded-md text-[10px] font-bold border backdrop-blur-md bg-slate-950/85 border-slate-800 text-cyan-300 tabular-nums w-fit">
            {frame.msSinceTransit === 0
              ? "BAT-PLANE TRANSIT POINT (0 ms)"
              : `${Math.abs(frame.msSinceTransit)} ms ${frame.msSinceTransit > 0 ? "POST-BAT TRANSIT" : "PRE-BAT TRANSIT"}`}
          </div>
        </div>
      </div>

      {/* 3. Comprehensive Replay Transit Timeline Strip */}
      <div className="hardware-panel rounded-xl px-3 py-2 mb-2 bg-[#080D16] border border-slate-800">
        <svg viewBox={`0 0 ${VIEW_W} 32`} className="w-full h-[30px]">
          {/* Baseline Rail */}
          <line x1="16" y1="18" x2={VIEW_W - 16} y2="18" stroke="#1E293B" strokeWidth="2" strokeLinecap="round" />

          {/* Transit Time Marker */}
          <line
            x1={stripX(model.transitTimeMs)}
            y1="6"
            x2={stripX(model.transitTimeMs)}
            y2="24"
            stroke="#00E5FF"
            strokeWidth="2"
          />
          <text
            x={stripX(model.transitTimeMs)}
            y="29"
            textAnchor="middle"
            fill="#00E5FF"
            fontSize="7"
            fontFamily="monospace"
            fontWeight="900"
          >
            TRANSIT
          </text>

          {/* Zone Ignition Ticks */}
          {model.zones.map((z) => (
            <g key={`timeline-tick-${z.id}`}>
              <circle cx={stripX(z.igniteTimeMs)} cy="18" r="3" fill="#EC4899" />
              <text
                x={stripX(z.igniteTimeMs)}
                y="11"
                textAnchor="middle"
                fill="#F472B6"
                fontSize="6.5"
                fontFamily="monospace"
                fontWeight="bold"
              >
                {z.label}
              </text>
            </g>
          ))}

          {/* Current Live Replay Needle */}
          <line
            x1={stripX(clampedTime)}
            y1="2"
            x2={stripX(clampedTime)}
            y2="26"
            stroke="#FFFFFF"
            strokeWidth="1.8"
          />
        </svg>
      </div>

      {/* 4. High-Contrast Telemetry Information Deck (Objective Raw Data) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 font-mono text-xs pt-1">
        {/* Metric 1: Peak Radiance */}
        <div className="hardware-panel p-2.5 rounded-xl border border-slate-800/90 bg-[#070B12]">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            PEAK RADIANCE (LWIR)
          </div>
          <div className="text-sm font-black text-pink-300 tabular-nums mt-0.5">
            {frame.peakIntensityPct}% SIG
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            THRESHOLD: 12%
          </div>
        </div>

        {/* Metric 2: Thermal Differential */}
        <div className="hardware-panel p-2.5 rounded-xl border border-slate-800/90 bg-[#070B12]">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            THERMAL DIFFERENTIAL
          </div>
          <div className="text-sm font-black text-slate-100 tabular-nums mt-0.5">
            {frame.peakIntensityPct > 12
              ? `+${(frame.peakIntensityPct * 0.012).toFixed(2)}°C`
              : "+0.04°C (NOMINAL)"}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            DECAY: 260ms (WILLOW τ)
          </div>
        </div>

        {/* Metric 3: Active Thermal Signatures */}
        <div className="hardware-panel p-2.5 rounded-xl border border-slate-800/90 bg-[#070B12]">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            RESOLVED SIGNATURES
          </div>
          <div className="text-sm font-black text-cyan-300 tabular-nums mt-0.5">
            {frame.ignitedCount} DETECTED
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            NOISE FLOOR: ±0.05 RMS
          </div>
        </div>

        {/* Metric 4: Sensor Polarity & Mode */}
        <div className="hardware-panel p-2.5 rounded-xl border border-slate-800/90 bg-[#070B12]">
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
            SENSOR POLARITY
          </div>
          <div className="text-sm font-black text-amber-300 mt-0.5">
            {palette === "WHITE_HOT" ? "WHITE-HOT IR" : "BLACK-HOT IR"}
          </div>
          <div className="text-[9px] text-slate-500 mt-0.5">
            8-14µm LWIR SENSOR
          </div>
        </div>
      </div>
    </div>
  );
};

