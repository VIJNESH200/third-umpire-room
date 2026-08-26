import React from "react";
import type { BoundaryData } from "../../types/scenario";

interface CatchRelayViewProps {
  boundary: BoundaryData;
  currentTimeMs: number;
}

export const CatchRelayView: React.FC<CatchRelayViewProps> = ({
  boundary,
  currentTimeMs,
}) => {
  const minTime = 800;
  const maxTime = 2200;
  const clampedTime = Math.max(minTime, Math.min(maxTime, currentTimeMs));

  // Normalized timeline
  const progress = (clampedTime - minTime) / (maxTime - minTime);

  const contactTime = boundary.ropeContactFrameMs; // ~1400ms
  const releaseTime = boundary.releaseFrameMs; // if boundary: contactTime + 80, if clean: contactTime - 80

  const isRopeContact = clampedTime >= contactTime;
  const isBallReleased = clampedTime >= releaseTime;

  // Fielder running/sliding from outfield (X=120) towards boundary rope (X=350)
  const fielderX = 120 + progress * 240;

  // Ball in hand vs in air after relay flick
  let ballX = fielderX + 15;
  let ballY = 190;

  if (isBallReleased) {
    // Ball lobbed up and backward into the field of play
    const airProgress = (clampedTime - releaseTime) / (maxTime - releaseTime);
    ballX = fielderX - 10 - airProgress * 90;
    ballY = 180 - Math.sin(airProgress * Math.PI) * 80;
  }

  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 09 • BROADCAST WIDE BOUNDARY RELAY CAM
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 1080P 50FPS
          </span>
        </div>

        <div className="text-[11px] text-slate-400">
          TRACKING: <span className="text-cyan-300 font-bold">BOUNDARY INTERACTION</span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#0e1a24] via-[#09121a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 500 320" className="w-full h-full max-h-[340px] z-10">
          <defs>
            <linearGradient id="relayTurf" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1a3827" />
              <stop offset="100%" stopColor="#10251a" />
            </linearGradient>
            <linearGradient id="relayCushion" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
          </defs>

          {/* Outfield Grass Field */}
          <rect x="0" y="0" width="360" height="320" fill="url(#relayTurf)" />

          {/* Out of Bounds Perimeter Grass (Behind Rope) */}
          <rect x="360" y="0" width="140" height="320" fill="#09140e" />

          {/* Boundary LED Advertising Boards & Foam Cushion at X=360 */}
          <rect
            x="360"
            y="60"
            width="22"
            height="230"
            rx="3"
            fill="url(#relayCushion)"
            stroke="#78350f"
            strokeWidth="1.2"
          />
          <text
            x="372"
            y="175"
            fill="#FFFFFF"
            fontSize="9"
            fontFamily="monospace"
            fontWeight="bold"
            transform="rotate(90 372,175)"
            textAnchor="middle"
          >
            BOUNDARY CUSHION
          </text>

          {/* White Boundary Line behind Cushion */}
          <line x1="384" y1="60" x2="384" y2="290" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.9" />

          {/* Boundary Run-Up Guide */}
          <line x1="0" y1="220" x2="360" y2="220" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Relay Partner Fielder inside play (waiting for lob in relay scenario) */}
          {boundary.catchOrSave === "RELAY_CATCH" && (
            <g transform="translate(160, 160)">
              <circle cx="0" cy="-28" r="8" fill="#1e293b" />
              <rect x="-6" y="-20" width="12" height="24" fill="#1e293b" rx="2" />
              {/* Ready arms extended */}
              <line x1="-6" y1="-14" x2="-14" y2="-2" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
              <line x1="6" y1="-14" x2="16" y2="-8" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
              <ellipse cx="0" cy="18" rx="14" ry="4" fill="rgba(0,0,0,0.3)" />
              <text x="0" y="-34" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">
                RELAY FIELDER
              </text>
            </g>
          )}

          {/* Diving Boundary Fielder Silhouette */}
          <g transform={`translate(${fielderX}, 210)`}>
            {/* Ground shadow */}
            <ellipse cx="0" cy="10" rx="35" ry="5" fill="rgba(0,0,0,0.35)" />

            {/* Horizontal Dive Body */}
            <circle cx="35" cy="-8" r="9" fill="#0f172a" />
            <ellipse cx="10" cy="0" rx="30" ry="10" fill="#1e293b" />

            {/* Arms reaching/flicking */}
            <line x1="20" y1="-4" x2="40" y2={isBallReleased ? "-24" : "4"} stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />

            {/* Trailing Sliding Legs */}
            <line x1="-15" y1="2" x2="-45" y2="4" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="-10" y1="6" x2="-40" y2="12" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />

            {/* Fielder Boot (Checks if touching rope) */}
            <ellipse cx="45" cy="4" rx="7" ry="4" fill="#334155" />
          </g>

          {/* Red Cricket Ball in Motion */}
          <circle cx={ballX} cy={ballY} r="7" fill="#dc2626" stroke="#FFFFFF" strokeWidth="0.8" />

          {/* Contact Laser Indicator */}
          {isRopeContact && (
            <g transform="translate(360, 210)">
              <circle cx="0" cy="0" r="16" fill="#FACC15" opacity="0.45" className="animate-ping" />
              <circle cx="0" cy="0" r="6" fill="#FFFFFF" />
            </g>
          )}
        </svg>

        {/* Real-time Status Overlay — neutral instrument state only */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-xs font-bold border backdrop-blur-md shadow-lg bg-slate-950/90 border-slate-700 text-slate-300">
            {isRopeContact
              ? (!isBallReleased ? "BOUNDARY CONTACT ZONE (BALL IN HAND)" : "BOUNDARY CONTACT ZONE (BALL AIRBORNE)")
              : "BOUNDARY PURSUIT IN PROGRESS"}
          </div>
        </div>
      </div>

      {/* Neutral Diagnostics Footer */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">SENSOR FEED</div>
          <div className="text-[11px] font-black text-cyan-300">
            1080P 50FPS BROADCAST
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">BALL STATUS</div>
          <div className="text-[11px] font-black text-slate-200">
            {isBallReleased ? "RELEASED / IN AIR" : "HELD IN HAND"}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">ROPE INTERACTION</div>
          <div className="text-[11px] font-black text-amber-300">
            {isRopeContact ? "AT BOUNDARY CUSHION" : "OUTFIELD PURSUIT"}
          </div>
        </div>
      </div>
    </div>
  );
};
