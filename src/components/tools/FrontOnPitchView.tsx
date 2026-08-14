import React from "react";
import type { LBWData } from "../../types/scenario";

interface FrontOnPitchViewProps {
  lbw: LBWData;
  currentTimeMs: number;
}

export const FrontOnPitchView: React.FC<FrontOnPitchViewProps> = ({
  lbw,
  currentTimeMs,
}) => {
  // Timeline: 600ms = bowler release, 1200ms = pitch bounce, 1500ms = pad impact
  const minTime = 600;
  const maxTime = 2000;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));

  // Trajectory progress: 0 to 1
  const t = (clampedTime - minTime) / (maxTime - minTime);

  // Ball flight physics from bowler's end (top center) down to batter (bottom)
  // Y goes from 50 (bowler release) to 270 (pad impact)
  const ballY = 50 + t * 240;

  // Ball X travels from release center (250) towards impact X
  const impactX = 250 + lbw.impactX * 130;
  const pitchX = 250 + lbw.pitchX * 110;

  let ballX = 250;
  if (t < 0.45) {
    // Flight to pitch
    const subT = t / 0.45;
    ballX = 250 + (pitchX - 250) * subT;
  } else {
    // Off the pitch to pad impact
    const subT = (t - 0.45) / 0.55;
    ballX = pitchX + (impactX - pitchX) * subT;
  }

  // Ball radius perspective: starts small (3px) at bowler, grows to 10px at batter
  const ballRadius = 3 + t * 8;

  // Has pad impact occurred?
  const isImpacted = clampedTime >= 1500;

  // Frame calculation for broadcast HUD
  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 01 • BROADCAST FRONT-ON PITCH FEED
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 1080P 60FPS
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          <span>SPEED: <b className="text-cyan-300">{lbw.ballSpeedKph} KM/H</b></span>
          <span>•</span>
          <span>TYPE: <b className="text-slate-200">{lbw.spinOrPace}</b></span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#0c1624] via-[#08101a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 500 320" className="w-full h-full max-h-[340px] z-10">
          <defs>
            <linearGradient id="frontPitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8a7353" />
              <stop offset="60%" stopColor="#b49b78" />
              <stop offset="100%" stopColor="#a88e6b" />
            </linearGradient>
            <linearGradient id="frontTurfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#12251a" />
              <stop offset="100%" stopColor="#0d1b13" />
            </linearGradient>
          </defs>

          {/* Outfield Grass */}
          <rect x="0" y="0" width="500" height="320" fill="url(#frontTurfGrad)" />

          {/* 3D Perspective Pitch Trapezoid */}
          <polygon
            points="220,40 280,40 430,310 70,310"
            fill="url(#frontPitchGrad)"
            stroke="#6e5c43"
            strokeWidth="1.5"
          />

          {/* Bowling Crease (Top) */}
          <line x1="210" y1="55" x2="290" y2="55" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />

          {/* Popping Crease (Bottom) */}
          <line x1="90" y1="280" x2="410" y2="280" stroke="#FFFFFF" strokeWidth="2" opacity="0.9" />

          {/* Non-Striker Bowler Silhouette (Top) */}
          <g transform="translate(250, 42)">
            <circle cx="0" cy="-6" r="6" fill="#1e293b" />
            <rect x="-4" y="0" width="8" height="14" fill="#1e293b" rx="2" />
          </g>

          {/* Striker Stumps (Bottom, behind batter) */}
          <g transform="translate(250, 280)">
            <rect x="-18" y="0" width="36" height="3" fill="#334155" />
            <rect x="-14" y="-30" width="4.5" height="30" fill="#d97706" stroke="#78350f" strokeWidth="0.4" />
            <rect x="-2.25" y="-32" width="4.5" height="32" fill="#f59e0b" stroke="#78350f" strokeWidth="0.4" />
            <rect x="9.5" y="-30" width="4.5" height="30" fill="#d97706" stroke="#78350f" strokeWidth="0.4" />
            <rect x="-15" y="-34" width="14" height="2.5" fill="#f59e0b" rx="0.5" />
            <rect x="1" y="-34" width="14" height="2.5" fill="#f59e0b" rx="0.5" />
          </g>

          {/* Batter Stance Silhouette in Front of Stumps */}
          <g transform={`translate(${impactX}, 240)`}>
            {/* Batter Head / Helmet */}
            <circle cx="0" cy="-28" r="10" fill="#0f172a" />
            <rect x="-7" y="-31" width="14" height="5" fill="#334155" rx="1" />
            {/* Torso */}
            <rect x="-12" y="-18" width="24" height="34" fill="#1e293b" rx="4" />
            {/* White Batting Front Pad */}
            <rect x="-7" y="10" width="14" height="42" rx="3" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.8" />
            {/* Knee Roll Ribs */}
            <line x1="-7" y1="22" x2="7" y2="22" stroke="#cbd5e1" strokeWidth="1.2" />
            <line x1="-7" y1="32" x2="7" y2="32" stroke="#cbd5e1" strokeWidth="1.2" />
            {/* Bat Blade Held at Angle */}
            <rect x="-22" y="-5" width="6" height="48" rx="1.5" fill="#d97706" stroke="#78350f" strokeWidth="0.6" transform="rotate(-15 -19 19)" />
            {/* Shoe */}
            <ellipse cx="0" cy="53" rx="10" ry="4" fill="#0f172a" />
          </g>

          {/* Pitch Bounce Mark Scuff */}
          {clampedTime >= 1100 && (
            <ellipse
              cx={pitchX}
              cy={170}
              rx="9"
              ry="4"
              fill="#523e2b"
              opacity="0.7"
            />
          )}

          {/* Delivery Flight Path Guide (Subtle) */}
          <path
            d={`M 250,50 Q ${(250 + pitchX) / 2},110 ${pitchX},170 Q ${(pitchX + impactX) / 2},220 ${impactX},275`}
            fill="none"
            stroke="rgba(56, 189, 248, 0.2)"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* Moving Red Cricket Ball */}
          <circle
            cx={ballX}
            cy={ballY}
            r={ballRadius}
            fill="#dc2626"
            stroke="#991b1b"
            strokeWidth="0.8"
          />
          {/* Ball Seam */}
          <line
            x1={ballX - ballRadius * 0.7}
            y1={ballY}
            x2={ballX + ballRadius * 0.7}
            y2={ballY}
            stroke="#FFFFFF"
            strokeWidth="0.8"
            strokeDasharray="1 1"
          />

          {/* Pad Impact Flash */}
          {isImpacted && (
            <g transform={`translate(${impactX}, 275)`}>
              <circle cx="0" cy="0" r="14" fill="#FACC15" opacity="0.4" />
              <circle cx="0" cy="0" r="6" fill="#FFFFFF" opacity="0.8" />
            </g>
          )}
        </svg>

        {/* Real-time Flight Phase Indicator */}
        <div className="absolute top-2.5 left-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono backdrop-blur-sm z-20">
          <span className="text-slate-400 font-bold">STATUS: </span>
          <span className="text-cyan-300 font-black">
            {clampedTime < 1100
              ? "BALL IN FLIGHT"
              : clampedTime < 1500
              ? "PITCHED & BOUNCING"
              : "PAD IMPACT OCCURRED"}
          </span>
        </div>

        {/* Hint to switch to Hawk-Eye */}
        <div className="absolute bottom-2.5 right-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1 rounded text-[10px] text-slate-300 backdrop-blur-sm z-20">
          SWITCH TO <b className="text-cyan-300">CAM 03 (HAWK-EYE 3D)</b> FOR 5-GATE TELEMETRY
        </div>
      </div>

      {/* Footer Info */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">OPTICAL PERSPECTIVE</div>
          <div className="text-[11px] font-black text-slate-200">FRONT-ON BROADCAST</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">BOWLER RELEASE</div>
          <div className="text-[11px] font-black text-cyan-300">OVER THE WICKET</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">IMPACT STATUS</div>
          <div className="text-[11px] font-black text-amber-300">
            {isImpacted ? "IMPACT CONFIRMED" : "APPROACHING PAD"}
          </div>
        </div>
      </div>
    </div>
  );
};
