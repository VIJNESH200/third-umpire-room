import React, { useState } from "react";
import type { StumpingData } from "../../types/scenario";
import { solveStumpingReplayState } from "../../engine/stumpingPhysics";
import { ZoomIn } from "lucide-react";

interface StumpingCreaseZoomProps {
  stumping: StumpingData;
  currentTimeMs: number;
  onTimeChange?: (timeMs: number) => void;
}

export const StumpingCreaseZoom: React.FC<StumpingCreaseZoomProps> = ({
  stumping,
  currentTimeMs,
}) => {
  const [opticalZoom, setOpticalZoom] = useState<"1.0x" | "1.5x">("1.0x");

  // Canonical deterministic physical replay state
  const state = solveStumpingReplayState(stumping, currentTimeMs);

  // Projection Geometry:
  // Popping crease reference line at X = 250
  // Striker Stumps at X = 130
  const creaseX = 250;
  const stumpsX = 130;
  const groundY = 195;
  const pxPerMm = 1.2;

  // Stumps & Zing bails from canonical state
  const bailsDislodged = state.stumps.bailsSeparating;
  const bailDisplacementY = state.stumps.bailDisplacementMm.z * 0.14;
  const bailRotation = state.stumps.bailRotationDeg;

  // Rear boot geometry:
  // Offset in mm (+ inside ground behind crease, - outside/in front)
  // Behind crease line means screen X is left of crease line: creaseX - offset * pxPerMm
  const toeX = creaseX - state.batter.toeCreaseOffsetMm * pxPerMm;
  const bootAltitude = state.batter.toeAltitudeMm * 0.85;
  const isAirborne = !state.batter.isGrounded;

  // Virtual 500 FPS frame counter
  const currentFrame = Math.round((currentTimeMs / 1000) * 500);

  // Dynamic optical zoom framing:
  // 1.0x Wide: Frames striker stumps, bails, popping crease, and rear boot reach
  // 1.5x Close: Magnifies crease line, shoe sole, spikes, and turf contact
  const activeViewBox = opticalZoom === "1.5x" ? "130 90 240 160" : "80 65 340 205";

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-1.5 select-none font-mono text-slate-200">
      {/* Top Monitor Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 02 • 500 FPS STUMPING / CREASE
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} / 1100 • 500FPS
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Optical Zoom Toggle */}
          <button
            type="button"
            onClick={() => setOpticalZoom(opticalZoom === "1.0x" ? "1.5x" : "1.0x")}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-200 hover:text-white flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95"
          >
            <ZoomIn size={12} className="text-amber-400" />
            <span>{opticalZoom}</span>
          </button>
        </div>
      </div>

      {/* Main Slow-Mo SVG Canvas */}
      <div className="relative flex-1 min-h-0 mt-1 bg-gradient-to-b from-[#09111c] via-[#060c14] to-[#03060a] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg
          viewBox={activeViewBox}
          className="w-full h-full object-contain transition-all duration-200 z-10"
        >
          <defs>
            {/* Natural Grass Turf Gradient */}
            <linearGradient id="stumpCreaseGrass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a24" />
              <stop offset="60%" stopColor="#142618" />
              <stop offset="100%" stopColor="#0c180f" />
            </linearGradient>

            {/* Natural Pitch Clay Surface Gradient */}
            <linearGradient id="stumpCreasePitch" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a38865" />
              <stop offset="50%" stopColor="#8c7352" />
              <stop offset="100%" stopColor="#6e583c" />
            </linearGradient>

            {/* Boot White Leather Gradient */}
            <linearGradient id="bootLeather" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>

            {/* Boot Outsole Rubber Gradient */}
            <linearGradient id="bootSole" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>

            {/* Cricket Bat Willow Grain Gradient */}
            <linearGradient id="batWillow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e8cfad" />
              <stop offset="50%" stopColor="#d8bc93" />
              <stop offset="100%" stopColor="#be9f72" />
            </linearGradient>

            {/* Bat Rubber Grip Gradient */}
            <linearGradient id="batGripGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#881337" />
              <stop offset="100%" stopColor="#4c0519" />
            </linearGradient>
          </defs>

          {/* Outfield Grass (Left of Stumps) */}
          <rect x="0" y="0" width={stumpsX} height="300" fill="url(#stumpCreaseGrass)" />

          {/* 22-Yard Pitch Strip */}
          <rect x={stumpsX} y="0" width="400" height="300" fill="url(#stumpCreasePitch)" />

          {/* Pitch Turf Transition Line */}
          <line x1={stumpsX} y1="0" x2={stumpsX} y2="300" stroke="#3d2c18" strokeWidth="1" opacity="0.4" />

          {/* White Painted Popping Crease (60mm wide band centered at creaseX) */}
          <rect x={creaseX - 3} y="0" width="6" height="300" fill="#ffffff" opacity="0.95" />
          <text
            x={creaseX + 8}
            y="78"
            fill="#ffffff"
            opacity="0.8"
            fontSize="8"
            fontWeight="bold"
            fontFamily="monospace"
            letterSpacing="1"
          >
            POPPING CREASE
          </text>



          {/* Striker Stumps & Zing Bails Assembly */}
          <g transform={`translate(${stumpsX}, ${groundY})`}>
            {/* Grounding Base */}
            <rect x="-18" y="0" width="36" height="5" fill="#334155" />
            {/* 3 Wooden Stumps */}
            <rect x="-14" y="-72" width="6" height="72" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
            <rect x="-3" y="-72" width="6" height="72" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
            <rect x="8" y="-72" width="6" height="72" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />

            {/* Zing Bails with LED Flash on Dislodgement */}
            <g transform={`translate(0, ${-72 - bailDisplacementY}) rotate(${bailRotation})`}>
              <rect
                x="-16"
                y="-6"
                width="32"
                height="6"
                fill={bailsDislodged ? "#EF4444" : "#F59E0B"}
                rx="1"
                stroke={bailsDislodged ? "#FCA5A5" : "#B45309"}
                strokeWidth="0.8"
              />
              {bailsDislodged && (
                <circle cx="0" cy="-3" r="5" fill="#EF4444" opacity="0.9" />
              )}
            </g>
          </g>

          {/* Batter's Grounded Cricket Bat (Positioned naturally in stance) */}
          <g transform={`translate(${creaseX + 28}, ${groundY - 60}) rotate(-14)`}>
            {/* Bat Turf Contact Shadow */}
            <ellipse cx="6" cy="62" rx="12" ry="2.5" fill="#000000" opacity="0.45" />

            {/* Cane Handle & Rubber Grip */}
            <rect x="3.5" y="-18" width="5" height="26" fill="url(#batGripGrad)" rx="1" />
            <line x1="3.5" y1="-10" x2="8.5" y2="-10" stroke="#f43f5e" strokeWidth="0.5" />
            <line x1="3.5" y1="-2" x2="8.5" y2="-2" stroke="#f43f5e" strokeWidth="0.5" />

            {/* English Willow Bat Blade */}
            <path
              d="M 1,8 
                 L 11,8 
                 L 11,58 
                 C 11,61 9,62 6,62 
                 C 3,62 1,61 1,58 
                 Z"
              fill="url(#batWillow)"
              stroke="#8c6d46"
              strokeWidth="0.6"
            />
            {/* Rubber Toe Guard */}
            <path
              d="M 1,57 L 11,57 L 11,58 C 11,61 9,62 6,62 C 3,62 1,61 1,58 Z"
              fill="#1e293b"
            />
          </g>

          {/* Batter's Articulated Rear Boot Assembly */}
          {/* Boot Toe Anchor sits at toeX, rotated by footAngleRad around toe contact point */}
          <g transform={`translate(${toeX}, ${groundY - bootAltitude})`}>
            {/* Dynamic Turf Contact Shadow */}
            <ellipse
              cx="-18"
              cy={3 + bootAltitude}
              rx={isAirborne ? 20 : 26}
              ry={isAirborne ? 2.5 : 4}
              fill="#000000"
              opacity={isAirborne ? 0.22 : 0.65}
            />

            {/* Articulated Cricket Shoe & Spikes rotated by heel lift */}
            {/* Toe anchored at 0 pointing +X toward bowler, heel extends -X toward stumps */}
            <g transform={`rotate(${(-state.batter.footAngleRad * 180) / Math.PI} 0 0)`}>
              {/* White Flannel Trouser Cuff & Ankle Sock */}
              <path
                d="M -28,-18 L -36,-17 L -34,-8 L -24,-8 Z"
                fill="#f8fafc"
                stroke="#cbd5e1"
                strokeWidth="0.8"
              />
              <path
                d="M -24,-8 L -34,-8 L -33,-3 L -23,-3 Z"
                fill="#e2e8f0"
                stroke="#94a3b8"
                strokeWidth="0.6"
              />

              {/* Upper Leather Shoe Body (Toe at 0 pointing +X, Heel at -38 pointing -X) */}
              <path
                d="M 0,0 
                   C -2,-5 -8,-12 -18,-13 
                   C -24,-14 -32,-13 -36,-8 
                   C -39,-5 -40,0 -38,2 
                   L 0,2 Z"
                fill="url(#bootLeather)"
                stroke="#94a3b8"
                strokeWidth="0.8"
              />

              {/* Toe Cap Reinforcement (Pointing +X toward bowler) */}
              <path
                d="M 0,0 C -2,-4 -6,-7 -10,-8 L -10,2 L 0,2 Z"
                fill="#f1f5f9"
                stroke="#cbd5e1"
                strokeWidth="0.5"
              />

              {/* Shoe Laces & Tongue */}
              <line x1="-16" y1="-12" x2="-22" y2="-9" stroke="#64748b" strokeWidth="0.8" />
              <line x1="-18" y1="-10" x2="-24" y2="-7" stroke="#64748b" strokeWidth="0.8" />
              <line x1="-20" y1="-8" x2="-26" y2="-5" stroke="#64748b" strokeWidth="0.8" />

              {/* Molded Outsole */}
              <rect x="-38" y="2" width="38" height="3" fill="url(#bootSole)" rx="0.5" />

              {/* Metal Cricket Spikes / Studs */}
              <polygon points="-4,5 -6,5 -5,8" fill="#cbd5e1" />
              <polygon points="-12,5 -14,5 -13,8" fill="#cbd5e1" />
              <polygon points="-26,5 -28,5 -27,8" fill="#cbd5e1" />
              <polygon points="-34,5 -36,5 -35,8" fill="#cbd5e1" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
};
