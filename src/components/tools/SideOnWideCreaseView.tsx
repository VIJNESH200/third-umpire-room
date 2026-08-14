import React from "react";
import type { RunOutData } from "../../types/scenario";

interface SideOnWideCreaseViewProps {
  runOut: RunOutData;
  currentTimeMs: number;
}

export const SideOnWideCreaseView: React.FC<SideOnWideCreaseViewProps> = ({
  runOut,
  currentTimeMs,
}) => {
  const minTime = 800;
  const maxTime = 2200;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));

  // Normalized timeline progress
  const progress = (clampedTime - minTime) / (maxTime - minTime);

  // Timing events
  const bailsTime = runOut.bailsDislodgedFrameMs; // default ~1500ms
  const isBailsDislodged = clampedTime >= bailsTime;

  // Batsman sprinting/diving across pitch (from right X=480 to crease X=180)
  const batterX = 460 - progress * 320;

  // Incoming throw ball from deep (top-left/center X=50, Y=40 towards stumps at X=120, Y=220)
  const ballProgress = Math.min(1, Math.max(0, (clampedTime - 900) / (bailsTime - 900)));
  const throwBallX = 30 + ballProgress * 90;
  const throwBallY = 60 + ballProgress * 150;

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 01 • BROADCAST SIDE-ON WIDE ANGLE
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 1080P 50FPS
          </span>
        </div>

        <div className="text-[11px] text-slate-400">
          THROW: <span className="text-cyan-300 font-bold">{runOut.fielderThrow}</span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#0e1824] via-[#09101a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 500 320" className="w-full h-full max-h-[340px] z-10">
          <defs>
            <linearGradient id="wideTurfGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#173322" />
              <stop offset="100%" stopColor="#0e2015" />
            </linearGradient>
            <linearGradient id="widePitchGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#a88e6b" />
              <stop offset="100%" stopColor="#8a7353" />
            </linearGradient>
          </defs>

          {/* Outfield Grass */}
          <rect x="0" y="0" width="500" height="320" fill="url(#wideTurfGrad)" />

          {/* Pitch Strip Side-on View */}
          <rect x="0" y="210" width="500" height="90" fill="url(#widePitchGrad)" />
          <line x1="0" y1="210" x2="500" y2="210" stroke="#6e5c43" strokeWidth="1.5" />

          {/* Popping Crease White Line */}
          <rect x="180" y="210" width="4" height="90" fill="#FFFFFF" opacity="0.95" />
          <text x="186" y="225" fill="#FFFFFF" opacity="0.8" fontSize="8" fontFamily="monospace" fontWeight="bold">
            POPPING CREASE
          </text>

          {/* Bowling Crease Line */}
          <line x1="120" y1="210" x2="120" y2="300" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />

          {/* Stumps at X=120 */}
          <g transform="translate(120, 210)">
            <rect x="-10" y="0" width="20" height="3" fill="#334155" />
            <rect x="-6" y="-38" width="3.5" height="38" fill={isBailsDislodged ? "#ef4444" : "#cbd5e1"} stroke="#475569" strokeWidth="0.4" />
            <rect x="-1" y="-38" width="3.5" height="38" fill={isBailsDislodged ? "#ef4444" : "#cbd5e1"} stroke="#475569" strokeWidth="0.4" />
            <rect x="4" y="-38" width="3.5" height="38" fill={isBailsDislodged ? "#ef4444" : "#cbd5e1"} stroke="#475569" strokeWidth="0.4" />

            {/* Bails / Zing Flash */}
            {isBailsDislodged ? (
              <g className="animate-pulse">
                <circle cx="0" cy="-40" r="14" fill="#ef4444" opacity="0.6" />
                <rect x="-12" y="-55" width="10" height="3" fill="#ff2e4c" transform="rotate(-30)" />
                <rect x="4" y="-50" width="10" height="3" fill="#ff2e4c" transform="rotate(25)" />
              </g>
            ) : (
              <>
                <rect x="-7" y="-41" width="8" height="2.5" fill="#f59e0b" rx="0.5" />
                <rect x="0" y="-41" width="8" height="2.5" fill="#f59e0b" rx="0.5" />
              </>
            )}
          </g>

          {/* Wicketkeeper / Bowler Collecting the Ball at Stumps */}
          <g transform="translate(85, 210)">
            <circle cx="0" cy="-48" r="8" fill="#1e293b" />
            <rect x="-6" y="-40" width="12" height="24" fill="#1e293b" rx="2" />
            {/* Crouching legs */}
            <rect x="-8" y="-16" width="6" height="16" fill="#1e293b" />
            <rect x="2" y="-16" width="6" height="16" fill="#1e293b" />
            {/* Extended Arms collecting */}
            <line x1="4" y1="-32" x2="30" y2="-20" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <circle cx="32" cy="-20" r="6" fill="#16a34a" />
          </g>

          {/* Fielder's Incoming Throw in Air */}
          {clampedTime < bailsTime && (
            <g>
              {/* Ball trajectory path */}
              <line x1="30" y1="60" x2="120" y2="210" stroke="rgba(239, 68, 68, 0.25)" strokeWidth="1.5" strokeDasharray="3 3" />
              {/* Moving ball */}
              <circle cx={throwBallX} cy={throwBallY} r="5" fill="#dc2626" stroke="#FFFFFF" strokeWidth="0.8" />
            </g>
          )}

          {/* Batsman Sprinting / Diving */}
          <g transform={`translate(${batterX}, 210)`}>
            {/* Ground shadow */}
            <ellipse cx="0" cy="0" rx="35" ry="4" fill="rgba(0,0,0,0.35)" />

            {runOut.diveType === "DIVE" ? (
              // Full Horizontal Dive Pose
              <g transform="translate(0, -12)">
                <circle cx="40" cy="-5" r="9" fill="#0f172a" />
                <ellipse cx="15" cy="0" rx="28" ry="9" fill="#1e293b" />
                {/* Bat arm stretched forward */}
                <line x1="-10" y1="0" x2="-45" y2="8" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
                {/* Bat */}
                <rect x="-85" y="4" width="45" height="7" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
                {/* Legs behind */}
                <line x1="35" y1="0" x2="65" y2="-12" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
                <line x1="30" y1="4" x2="60" y2="4" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
              </g>
            ) : runOut.diveType === "SLIDE" ? (
              // Sliding Slide Pose
              <g transform="translate(0, -10)">
                <circle cx="35" cy="-20" r="9" fill="#0f172a" />
                <rect x="0" y="-12" width="40" height="15" fill="#1e293b" rx="4" />
                {/* Front leg extended */}
                <line x1="0" y1="0" x2="-25" y2="6" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
                {/* Bat arm reaching */}
                <line x1="5" y1="-8" x2="-35" y2="4" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
                <rect x="-75" y="0" width="45" height="7" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
              </g>
            ) : (
              // Standing Runner Sprinting
              <g transform="translate(0, -35)">
                <circle cx="15" cy="-15" r="9" fill="#0f172a" />
                <rect x="0" y="-6" width="22" height="28" fill="#1e293b" rx="3" />
                {/* Legs running */}
                <line x1="5" y1="22" x2="-15" y2="35" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
                <line x1="15" y1="22" x2="35" y2="35" stroke="#1e293b" strokeWidth="5" strokeLinecap="round" />
                {/* Bat reaching */}
                <line x1="0" y1="4" x2="-30" y2="24" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
                <rect x="-65" y="20" width="40" height="7" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
              </g>
            )}
          </g>
        </svg>

        {/* Real-time Status Overlay */}
        <div className="absolute top-2.5 left-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono backdrop-blur-sm z-20">
          <span className="text-slate-400 font-bold">STATE: </span>
          <span className={isBailsDislodged ? "text-rose-400 font-black" : "text-cyan-300 font-bold"}>
            {isBailsDislodged ? "ZING BAILS DISLODGED" : "BATTER SPRINTING TO CREASE"}
          </span>
        </div>
      </div>

      {/* Footer Metrics */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">VIEW ANGLE</div>
          <div className="text-[11px] font-black text-slate-200">SIDE-ON WIDE (CAM 01)</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">DISLODGEMENT FRAME</div>
          <div className="text-[11px] font-black text-rose-300">{runOut.bailsDislodgedFrameMs} ms</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">DIVE TECHNIQUE</div>
          <div className="text-[11px] font-black text-amber-300">{runOut.diveType}</div>
        </div>
      </div>
    </div>
  );
};
