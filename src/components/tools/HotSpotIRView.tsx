import React, { useMemo, useState } from "react";
import type { CaughtBehindData } from "../../types/scenario";
import { Flame, Eye } from "lucide-react";
import {
  solveHotSpotThermal,
  solveHotSpotThermalFrame,
  HOTSPOT_WINDOW_START_MS,
  HOTSPOT_WINDOW_END_MS,
  BLADE_WIDTH_MM,
  OUTSIDE_EDGE_X_MM,
  BAT_BLADE_TOP_Y_MM,
  BAT_BLADE_BOTTOM_Y_MM,
} from "../../engine/hotspotThermal";

interface HotSpotIRViewProps {
  caughtBehind: CaughtBehindData;
  currentTimeMs: number;
}

type IrPalette = "WHITE_HOT" | "BLACK_HOT";

// ------------------------------------------------------------------
// Scene projection: bat-local millimetres onto the SVG viewport.
// ------------------------------------------------------------------
const VIEW_W = 340;
const VIEW_H = 320;
const SCALE_X = 2.4;
const CENTER_X = 175;
const xPx = (xMm: number) => CENTER_X + xMm * SCALE_X;
const yPx = (yMm: number) => yMm - BAT_BLADE_TOP_Y_MM;

/**
 * IR luminance ramp: cool charcoal -> gunmetal -> warm grey ->
 * incandescent white. BLACK-HOT renders the inverse luminance, exactly
 * like a real thermal imager's polarity toggle. Presentation only: the
 * palette never carries outcome information.
 */
function irRamp(level: number, inverted: boolean): string {
  const t = Math.max(0, Math.min(1, inverted ? 1 - level : level));
  const stops: Array<[number, number, number]> = [
    [7, 10, 17],
    [30, 41, 59],
    [148, 163, 184],
    [255, 247, 214],
  ];
  const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
  const f = t * (stops.length - 1) - seg;
  const c = stops[seg].map((lo, i) => Math.round(lo + (stops[seg + 1][i] - lo) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/**
 * CAM 08 — HotSpot infrared element.
 *
 * Neutral forensic evidence view. Everything on screen is solved from
 * `solveHotSpotThermal` (engine/hotspotThermal.ts) and the canonical replay
 * clock — the component receives no verdict flag and branches on none. The
 * IR picture always contains an ambient blade, deterministic sensor noise
 * and at least one measurable radiance zone whose intensity band overlaps
 * between a genuine edge and a fine pass, so reading the incident requires
 * interpreting intensity, placement against the outside-edge line, decay
 * and timing alignment together with the acoustic evidence.
 */
export const HotSpotIRView: React.FC<HotSpotIRViewProps> = ({
  caughtBehind,
  currentTimeMs,
}) => {
  const [palette, setPalette] = useState<IrPalette>("WHITE_HOT");
  const isInverted = palette === "BLACK_HOT";

  const model = useMemo(() => solveHotSpotThermal(caughtBehind), [caughtBehind]);
  const frame = useMemo(
    () => solveHotSpotThermalFrame(model, currentTimeMs),
    [model, currentTimeMs]
  );

  const windowSpanMs = HOTSPOT_WINDOW_END_MS - HOTSPOT_WINDOW_START_MS;
  const clampedTime = frame.timeMs;
  const currentFrame = Math.round((clampedTime / 1000) * 50);

  // Canonical-clock ball silhouette: a cool body crossing the bat plane.
  // Purely kinematic timing context — its path encodes nothing about contact.
  const flightP = Math.max(
    0,
    Math.min(1, (clampedTime - HOTSPOT_WINDOW_START_MS) / windowSpanMs)
  );
  const ballY = 26 + flightP * 275;
  const ballX = xPx(OUTSIDE_EDGE_X_MM + 2.5);

  // Thermal polarity colours.
  const bg = isInverted ? "#dde4ee" : "#04060a";
  const bodyFill = isInverted ? "#5b6b80" : "#16202f";
  const padFill = isInverted ? "#4c5a6e" : "#202e40";
  const bladeFill = irRamp(frame.ambientLevel, isInverted);
  const bladeStroke = isInverted ? "#94a3b8" : "#334155";
  const guideLine = isInverted ? "#334155" : "#475569";
  const zoneFill = isInverted ? "#0b0f16" : "#ffffff";
  const ballFill = isInverted ? "#3a4859" : "#101826";
  const ballStroke = isInverted ? "#64748b" : "#475569";
  const reticleColor = isInverted ? "#0f172a" : "#e2e8f0";

  // Timeline strip geometry (viewBox 0 0 400 40).
  const stripX = (t: number) =>
    12 + ((t - HOTSPOT_WINDOW_START_MS) / windowSpanMs) * 376;

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-500 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 08 • HOTSPOT THERMAL INFRARED (IR)
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • IR ELEMENT LIVE
          </span>
        </div>

        <button
          onClick={() => setPalette(isInverted ? "WHITE_HOT" : "BLACK_HOT")}
          className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-white"
        >
          <Eye size={12} className="text-cyan-400" />
          <span>{isInverted ? "BLACK-HOT IR" : "WHITE-HOT IR"}</span>
        </button>
      </div>

      {/* Main Thermal Viewport */}
      <div
        className={`relative flex-1 min-h-[230px] my-2 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner ${
          isInverted ? "bg-[#e2e8f0]" : "bg-[#05070a]"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-25" />

        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="w-full h-full max-h-[330px] z-10">
          <defs>
            <filter id="hsZoneBlur" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>

          <rect width={VIEW_W} height={VIEW_H} fill={bg} />

          {/* Batter silhouette (thermal mid-tone) */}
          <g transform="translate(38, 66)">
            <circle cx="0" cy="0" r="16" fill={bodyFill} />
            <rect x="-13" y="14" width="27" height="62" rx="5" fill={bodyFill} />
          </g>

          {/* Pad */}
          <rect
            x={xPx(-47)}
            y={yPx(70)}
            width={23 * SCALE_X}
            height={145}
            rx="4"
            fill={padFill}
            stroke={bladeStroke}
            strokeWidth="0.8"
          />
          {/* Pad decoy zone renders through the same zone pipeline below */}

          {/* Bat blade */}
          <g>
            <rect
              x={xPx(-BLADE_WIDTH_MM / 2)}
              y={yPx(BAT_BLADE_TOP_Y_MM)}
              width={BLADE_WIDTH_MM * SCALE_X}
              height={BAT_BLADE_BOTTOM_Y_MM - BAT_BLADE_TOP_Y_MM}
              rx="3"
              fill={bladeFill}
              stroke={bladeStroke}
              strokeWidth="0.9"
            />
            {/* Outside-edge reference line */}
            <line
              x1={xPx(OUTSIDE_EDGE_X_MM)}
              y1={yPx(BAT_BLADE_TOP_Y_MM)}
              x2={xPx(OUTSIDE_EDGE_X_MM)}
              y2={yPx(BAT_BLADE_BOTTOM_Y_MM)}
              stroke={guideLine}
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text
              x={xPx(OUTSIDE_EDGE_X_MM) + 5}
              y={yPx(BAT_BLADE_BOTTOM_Y_MM) - 8}
              fill={guideLine}
              fontSize="8"
              fontFamily="monospace"
              fontWeight="700"
            >
              OUTSIDE EDGE
            </text>
          </g>

          {/* Radiance zones — identical pipeline for every zone regardless
              of origin: ambient scuff, pad decoy or primary signature. */}
          {frame.zones.map((z) => {
            const cx = xPx(z.xMm);
            const cy = yPx(z.yMm);
            const rx = z.sigmaXMm * SCALE_X * 2.1;
            const ry = z.sigmaYMm * 2.1;
            return (
              <g key={z.id}>
                {z.intensity > 0.005 && (
                  <ellipse
                    cx={cx}
                    cy={cy}
                    rx={rx}
                    ry={ry}
                    fill={zoneFill}
                    opacity={Math.min(1, z.intensity * 1.15)}
                    filter="url(#hsZoneBlur)"
                  />
                )}
                {z.isIgnited && (
                  <g>
                    <rect
                      x={cx - rx - 6}
                      y={cy - ry - 6}
                      width={(rx + 6) * 2}
                      height={(ry + 6) * 2}
                      fill="none"
                      stroke={reticleColor}
                      strokeWidth="0.9"
                      strokeDasharray="5 4"
                      opacity="0.75"
                    />
                    <text
                      x={cx + rx + 10}
                      y={cy - ry - 2}
                      fill={reticleColor}
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="900"
                      opacity="0.95"
                    >
                      {z.label} · {Math.round(z.intensity * 100)}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Incoming ball silhouette */}
          <circle
            cx={ballX}
            cy={ballY}
            r="11"
            fill={ballFill}
            stroke={ballStroke}
            strokeWidth="1.2"
          />
        </svg>

        {/* Real-time Status Overlay — instrument state only */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-xs font-bold border backdrop-blur-md shadow-lg flex items-center gap-1.5 bg-slate-950/90 border-slate-700 text-slate-300">
            <Flame size={13} className="text-pink-400" />
            <span>{frame.statusLine}</span>
          </div>
          <div className="px-3 py-1 rounded-md text-[10px] font-bold border backdrop-blur-md bg-slate-950/85 border-slate-800 text-cyan-300 tabular-nums w-fit">
            {frame.msSinceTransit >= 0 ? "T+" : "T-"}
            {Math.abs(frame.msSinceTransit)} ms VS BAT-PLANE TRANSIT
          </div>
        </div>
      </div>

      {/* Timing Context Strip: ignitions vs transit vs scrub needle */}
      <div className="hardware-panel rounded-lg px-2 py-1.5 mb-2">
        <svg viewBox="0 0 400 40" className="w-full h-[38px]">
          <line x1="12" y1="24" x2="388" y2="24" stroke="#334155" strokeWidth="1.4" />
          {/* Transit tick */}
          <line
            x1={stripX(model.transitTimeMs)}
            y1="8"
            x2={stripX(model.transitTimeMs)}
            y2="30"
            stroke="#38BDF8"
            strokeWidth="2"
          />
          <text
            x={stripX(model.transitTimeMs)}
            y="38"
            textAnchor="middle"
            fill="#38BDF8"
            fontSize="7.5"
            fontFamily="monospace"
            fontWeight="900"
          >
            TRANSIT
          </text>
          {/* Zone ignition ticks (neutral colour, chronological labels) */}
          {model.zones.map((z) => (
            <g key={`tick-${z.id}`}>
              <circle cx={stripX(z.igniteTimeMs)} cy="24" r="3" fill="#94a3b8" />
              <text
                x={stripX(z.igniteTimeMs)}
                y="14"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="7"
                fontFamily="monospace"
                fontWeight="700"
              >
                {z.label}
              </text>
            </g>
          ))}
          {/* Scrub needle */}
          <line
            x1={stripX(clampedTime)}
            y1="4"
            x2={stripX(clampedTime)}
            y2="34"
            stroke="#FFFFFF"
            strokeWidth="1.6"
          />
        </svg>
      </div>

      {/* Footer Metrics — measurements only, never conclusions */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">PEAK RADIANCE</div>
          <div className="text-[11px] font-black text-pink-300 tabular-nums">
            {frame.peakIntensityPct}% SIG
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">ZONES ABOVE THRESHOLD</div>
          <div className="text-[11px] font-black text-slate-200 tabular-nums">
            {frame.ignitedCount} DETECTED
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">SENSOR POLARITY</div>
          <div className="text-[11px] font-black text-cyan-300">
            {isInverted ? "BLACK-HOT" : "WHITE-HOT"}
          </div>
        </div>
      </div>
    </div>
  );
};
