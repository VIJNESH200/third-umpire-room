import React, { useState } from "react";
import type { CaughtBehindData } from "../../types/scenario";
import { Flame, Eye } from "lucide-react";

interface HotSpotIRViewProps {
  caughtBehind: CaughtBehindData;
  currentTimeMs: number;
}

export const HotSpotIRView: React.FC<HotSpotIRViewProps> = ({
  caughtBehind,
  currentTimeMs,
}) => {
  const [isInverted, setIsInverted] = useState<boolean>(false); // White-Hot vs Black-Hot

  const minTime = 800;
  const maxTime = 1600;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));

  const contactTime = caughtBehind.ballPassesBatFrameMs; // ~1200ms

  // Ball motion down the blade
  const ballProgress = Math.max(0, Math.min(1, (clampedTime - minTime) / (maxTime - minTime)));
  const ballY = 40 + ballProgress * 220;
  const ballX = caughtBehind.hasEdge ? 215 : 215 + caughtBehind.gapMm * 1.6;

  // Thermal Friction Spot Physics
  // Edge spot appears at or after contactTime if hasEdge is true
  const edgeDelta = clampedTime - contactTime;
  const hasEdgeSpot = caughtBehind.hasEdge && edgeDelta >= 0;
  // Intensity decays slowly as heat dissipates
  const edgeSpotOpacity = hasEdgeSpot ? Math.max(0.3, Math.min(1, 1 - edgeDelta / 900)) : 0;
  const edgeSpotRadius = hasEdgeSpot ? Math.min(9, 4 + (edgeDelta / 150)) : 0;

  // Pad Distractor Spot Physics
  const padContactTime = caughtBehind.distractorTimeMs || 1350;
  const padDelta = clampedTime - padContactTime;
  const hasPadSpot = caughtBehind.distractorNoise && caughtBehind.distractorType === "PAD" && padDelta >= 0;
  const padSpotOpacity = hasPadSpot ? Math.max(0.2, Math.min(0.9, 1 - padDelta / 800)) : 0;

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

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
            FRAME {currentFrame} • THERMAL 300FPS
          </span>
        </div>

        <button
          onClick={() => setIsInverted(!isInverted)}
          className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 text-slate-300 hover:text-white"
        >
          <Eye size={12} className="text-cyan-400" />
          <span>{isInverted ? "BLACK-HOT IR" : "WHITE-HOT IR"}</span>
        </button>
      </div>

      {/* Main Thermal Viewport */}
      <div className={`relative flex-1 min-h-[230px] my-2 rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner ${
        isInverted ? "bg-[#e2e8f0]" : "bg-[#05070a]"
      }`}>
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-25" />

        <svg viewBox="0 0 500 320" className="w-full h-full max-h-[340px] z-10">
          <defs>
            <filter id="thermalGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Thermal Silhouette of Batter playing defensive push/drive */}
          <g transform="translate(140, 70)">
            {/* Batter Body (Thermal Mid-Grey) */}
            <circle cx="0" cy="0" r="18" fill={isInverted ? "#475569" : "#1e293b"} />
            <rect x="-14" y="16" width="30" height="65" rx="5" fill={isInverted ? "#475569" : "#1e293b"} />
            {/* Pad */}
            <rect x="10" y="70" width="22" height="90" rx="4" fill={isInverted ? "#334155" : "#334155"} />

            {/* Thermal Spot on Pad if pad contact occurred */}
            {hasPadSpot && (
              <g transform="translate(21, 105)" filter="url(#thermalGlow)">
                <circle cx="0" cy="0" r="12" fill={isInverted ? "#0f172a" : "#FFFFFF"} opacity={padSpotOpacity} />
                <circle cx="0" cy="0" r="6" fill={isInverted ? "#000000" : "#fbbf24"} opacity={padSpotOpacity} />
              </g>
            )}
          </g>

          {/* Cricket Bat (Thermal Cool Grey Blade) */}
          <g transform="translate(200, 40)">
            {/* Bat Blade */}
            <rect
              x="0"
              y="0"
              width="24"
              height="240"
              rx="3"
              fill={isInverted ? "#64748b" : "#1e293b"}
              stroke={isInverted ? "#94a3b8" : "#334155"}
              strokeWidth="0.8"
            />
            {/* Outside Edge Guide Line */}
            <line x1="24" y1="0" x2="24" y2="240" stroke={isInverted ? "#0f172a" : "#475569"} strokeWidth="1" />

            {/* HotSpot Thermal Friction Spot on Bat Outside Edge */}
            {hasEdgeSpot && (
              <g transform="translate(24, 110)" filter="url(#thermalGlow)">
                {/* Glowing Heat Halo */}
                <ellipse cx="0" cy="0" rx={edgeSpotRadius * 1.5} ry={edgeSpotRadius * 2.2} fill={isInverted ? "#000000" : "#FFFFFF"} opacity={edgeSpotOpacity} />
                <ellipse cx="0" cy="0" rx={edgeSpotRadius * 0.8} ry={edgeSpotRadius * 1.2} fill={isInverted ? "#1e293b" : "#67e8f9"} opacity={edgeSpotOpacity * 0.9} />
                {/* Friction Core */}
                <circle cx="0" cy="0" r={Math.max(2, edgeSpotRadius * 0.4)} fill={isInverted ? "#000000" : "#FFFFFF"} />
              </g>
            )}
          </g>

          {/* Incoming Red Cricket Ball (Appears as Thermal Silhouette in IR) */}
          <circle
            cx={ballX}
            cy={ballY}
            r="12"
            fill={isInverted ? "#334155" : "#0f172a"}
            stroke={isInverted ? "#64748b" : "#475569"}
            strokeWidth="1.2"
          />

          {/* Friction Contact Callout when Edge occurs */}
          {hasEdgeSpot && (
            <g transform="translate(270, 150)">
              <rect x="0" y="-12" width="180" height="24" rx="4" fill={isInverted ? "rgba(15,23,42,0.8)" : "rgba(255,255,255,0.9)"} />
              <text x="90" y="4" textAnchor="middle" fill={isInverted ? "#FFFFFF" : "#0f172a"} fontSize="10" fontFamily="monospace" fontWeight="900">
                THERMAL FRICTION SIGNATURE
              </text>
            </g>
          )}
        </svg>

        {/* Real-time Status Overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div
            className={`px-3 py-1.5 rounded-md text-xs font-bold border backdrop-blur-md shadow-lg flex items-center gap-1.5 ${
              hasEdgeSpot
                ? "bg-rose-950/90 border-rose-500 text-rose-200"
                : "bg-slate-950/90 border-slate-700 text-slate-300"
            }`}
          >
            <Flame size={13} className={hasEdgeSpot ? "text-rose-400" : "text-slate-500"} />
            <span>
              {hasEdgeSpot
                ? "HOTSPOT DETECTED: OUTSIDE EDGE FRICTION HEAT"
                : clampedTime >= contactTime
                ? "NO THERMAL EMISSION ON BAT EDGE (CLEAN)"
                : "AWAITING BALL ARRIVAL AT BAT PLANE"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">INFRARED SENSOR</div>
          <div className="text-[11px] font-black text-pink-300">THERMAL 300 FPS</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">EDGE HEAT MARK</div>
          <div className={`text-[11px] font-black ${caughtBehind.hasEdge ? "text-rose-400" : "text-emerald-400"}`}>
            {caughtBehind.hasEdge ? "POSITIVE (CONFIRMED)" : "NEGATIVE (NO SPOT)"}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">OPTICAL SEPARATION</div>
          <div className="text-[11px] font-black text-cyan-300">
            {caughtBehind.hasEdge ? "0 mm (CONTACT)" : `${caughtBehind.gapMm} mm GAP`}
          </div>
        </div>
      </div>
    </div>
  );
};
