import React, { useEffect, useState } from "react";
import type { Scenario } from "../../types/scenario";
import { Camera } from "lucide-react";

interface IncidentReplayFeedProps {
  scenario: Scenario;
}

export const IncidentReplayFeed: React.FC<IncidentReplayFeedProps> = ({ scenario }) => {
  const [timecode, setTimecode] = useState("00:14:28:19");

  useEffect(() => {
    const interval = setInterval(() => {
      setTimecode((prev) => {
        const parts = prev.split(":");
        let frames = parseInt(parts[3], 10) + 1;
        let secs = parseInt(parts[2], 10);
        if (frames >= 25) { frames = 0; secs += 1; }
        return `${parts[0]}:${parts[1]}:${secs.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;
      });
    }, 40);
    return () => clearInterval(interval);
  }, []);

  const getCameraLabel = () => {
    switch (scenario.incidentType) {
      case "LBW": return "CAM 01 • PITCH END BROADCAST";
      case "RUN_OUT":
      case "STUMPING": return "CAM 02 • SQUARE LEG BROADCAST";
      case "CAUGHT_BEHIND": return "CAM 03 • SLIP CAM BROADCAST";
      case "BOUNDARY": return "CAM 04 • BOUNDARY TRACKING";
    }
  };

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 select-none" style={{ minHeight: 280 }}>
      {/* Base background — warm broadcast green turf */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a3a26] via-[#153020] to-[#0f2318]" />

      {/* Subtle vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.5)_100%)]" />

      {/* Film grain texture */}
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none z-30"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.7' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }}
      />

      {/* SVG Scene dynamically driven by scenario.initialEvidence */}
      <svg viewBox="0 0 600 380" className="relative w-full h-full z-10" preserveAspectRatio="xMidYMid meet">
        {scenario.incidentType === "LBW" && <LBWScene scenario={scenario} />}
        {(scenario.incidentType === "RUN_OUT" || scenario.incidentType === "STUMPING") && <RunOutScene scenario={scenario} />}
        {scenario.incidentType === "CAUGHT_BEHIND" && <CaughtBehindScene scenario={scenario} />}
        {scenario.incidentType === "BOUNDARY" && <BoundaryScene scenario={scenario} />}
      </svg>

      {/* Camera Label — Top Left */}
      <div className="absolute top-3 left-3 z-40 bg-black/65 px-3 py-1.5 rounded flex items-center gap-2 border border-white/10 backdrop-blur-sm">
        <Camera className="w-3.5 h-3.5 text-white/80" />
        <span className="text-white/90 text-[11px] font-mono font-bold tracking-wide">{getCameraLabel()}</span>
      </div>

      {/* REPLAY Badge — Top Right */}
      <div className="absolute top-3 right-3 z-40 bg-black/65 px-3 py-1.5 rounded flex items-center gap-2 border border-white/10 backdrop-blur-sm">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-white/90 text-[11px] font-mono font-bold tracking-wider">REPLAY</span>
      </div>

      {/* Timecode — Bottom Right */}
      <div className="absolute bottom-3 right-3 z-40 bg-black/65 px-3 py-1.5 rounded border border-white/10 backdrop-blur-sm">
        <span className="text-white/80 text-sm font-mono font-bold tracking-wider tabular-nums">{timecode}</span>
      </div>

      {/* Speed Badge for LBW — Bottom Left */}
      {scenario.incidentType === "LBW" && scenario.lbw && (
        <div className="absolute bottom-3 left-3 z-40 bg-black/65 px-3 py-1.5 rounded border border-white/10 backdrop-blur-sm flex items-center gap-2">
          <span className="text-cyan-300 text-[11px] font-mono font-bold">{scenario.lbw.ballSpeedKph} KPH</span>
          <span className="text-white/50 text-[10px]">•</span>
          <span className="text-white/70 text-[10px] font-mono">{scenario.lbw.spinOrPace}</span>
        </div>
      )}

      {/* Dive Type for Run Out — Bottom Left */}
      {(scenario.incidentType === "RUN_OUT" || scenario.incidentType === "STUMPING") && scenario.runOut && (
        <div className="absolute bottom-3 left-3 z-40 bg-black/65 px-3 py-1.5 rounded border border-white/10 backdrop-blur-sm">
          <span className="text-amber-300 text-[11px] font-mono font-bold">
            {scenario.incidentType === "STUMPING" ? "STUMPING CHECK" : `${scenario.runOut.diveType} • RUN OUT CHECK`}
          </span>
        </div>
      )}

      {/* Appeal Type — Bottom Left for Caught Behind */}
      {scenario.incidentType === "CAUGHT_BEHIND" && (
        <div className="absolute bottom-3 left-3 z-40 bg-black/65 px-3 py-1.5 rounded border border-white/10 backdrop-blur-sm">
          <span className="text-rose-300 text-[11px] font-mono font-bold">EDGE APPEAL • INITIAL BROADCAST</span>
        </div>
      )}

      {/* Boundary Type — Bottom Left */}
      {scenario.incidentType === "BOUNDARY" && (
        <div className="absolute bottom-3 left-3 z-40 bg-black/65 px-3 py-1.5 rounded border border-white/10 backdrop-blur-sm">
          <span className="text-emerald-300 text-[11px] font-mono font-bold">BOUNDARY CUSHION CHECK</span>
        </div>
      )}
    </div>
  );
};

/* ================================================================
   LBW SCENE — Dynamic Initial Broadcast Perspective
   Driven by LBWInitialEvidence: pitch line, impact point, shot type,
   and visual stump threat without revealing Hawk-Eye debug data.
   ================================================================ */
const LBWScene = ({ scenario }: { scenario: Scenario }) => {
  const ev = scenario.initialEvidence?.lbw;
  const lbw = scenario.lbw;

  // Base coordinates on pitch (center X = 300)
  const pitchCenterX = 300;

  // Calculate dynamic pitch bounce X from evidence / scenario
  let pitchBounceX = pitchCenterX;
  if (ev) {
    if (ev.apparentPitchLine === "OUTSIDE_LEG") pitchBounceX = pitchCenterX - 45;
    else if (ev.apparentPitchLine === "OUTSIDE_OFF") pitchBounceX = pitchCenterX + 42;
    else pitchBounceX = pitchCenterX + (lbw ? lbw.pitchX * 25 : 0);
  } else if (lbw) {
    pitchBounceX = pitchCenterX + lbw.pitchX * 35;
  }

  // Calculate dynamic impact X on pad
  let padImpactX = pitchCenterX;
  if (ev) {
    if (ev.apparentImpactLine === "OUTSIDE_OFF") padImpactX = pitchCenterX + 38;
    else if (ev.apparentImpactLine === "OUTSIDE_LEG") padImpactX = pitchCenterX - 40;
    else padImpactX = pitchCenterX + (lbw ? lbw.impactX * 20 : 0);
  } else if (lbw) {
    padImpactX = pitchCenterX + lbw.impactX * 30;
  }

  // Calculate dynamic impact Y (shin / knee roll / high thigh)
  let impactY = 310;
  if (ev?.apparentHeight === "LOW_SHIN") impactY = 325;
  else if (ev?.apparentHeight === "HIGH_THIGH") impactY = 290;

  // Shot type styling
  const shotType = ev?.shotOfferedType || (lbw?.shotOffered ? "DEFENSIVE_FORWARD" : "PADDED_AWAY_NO_SHOT");
  const isNoShot = shotType === "PADDED_AWAY_NO_SHOT" || shotType === "LEAVE_WITHDRAWN";

  // Batter stance position
  const batterX = pitchCenterX + (ev?.batterStanceShiftX || 0) - 20;

  return (
    <g>
      {/* Clay Pitch Strip */}
      <polygon points="230,40 370,40 440,370 160,370" fill="#b49b78" opacity="0.75" />
      <polygon points="250,40 350,40 410,370 190,370" fill="#c5ad8b" opacity="0.35" />

      {/* Bowling Crease */}
      <line x1="240" y1="65" x2="360" y2="65" stroke="white" strokeWidth="1.5" opacity="0.6" />

      {/* Popping Crease (Batter End) */}
      <line x1="175" y1="330" x2="425" y2="330" stroke="white" strokeWidth="2.5" opacity="0.85" />

      {/* Non-Striker Stumps (Top) */}
      <g transform="translate(300, 40)">
        <rect x="-10" y="-8" width="4" height="10" fill="#d97706" opacity="0.5" />
        <rect x="-2" y="-8" width="4" height="10" fill="#d97706" opacity="0.5" />
        <rect x="6" y="-8" width="4" height="10" fill="#d97706" opacity="0.5" />
      </g>

      {/* Striker Stumps (Bottom - exact target alignment) */}
      <g transform="translate(300, 350)">
        <rect x="-18" y="0" width="36" height="2.5" fill="#334155" />
        <rect x="-14" y="-30" width="5" height="30" fill="#d97706" stroke="#78350f" strokeWidth="0.4" />
        <rect x="-2.5" y="-32" width="5" height="32" fill="#f59e0b" stroke="#78350f" strokeWidth="0.4" />
        <rect x="9" y="-30" width="5" height="30" fill="#d97706" stroke="#78350f" strokeWidth="0.4" />
        <rect x="-15" y="-33" width="15" height="2.5" fill="#f59e0b" rx="1" />
        <rect x="0" y="-33" width="15" height="2.5" fill="#f59e0b" rx="1" />
      </g>

      {/* Bowler Silhouette (Top) */}
      <g transform="translate(300, 50)">
        <circle cx="0" cy="0" r="10" fill="#1a1a1a" opacity="0.7" />
        <rect x="-7" y="10" width="14" height="18" fill="#1a1a1a" opacity="0.6" rx="3" />
      </g>

      {/* Batter Silhouette in Adaptive Stance (Bottom) */}
      <g transform={`translate(${batterX}, 275)`}>
        {/* Head / Helmet */}
        <circle cx="0" cy="0" r="10" fill="#1a1a1a" />
        <rect x="-8" y="-4" width="16" height="4" fill="#333" rx="1" />
        {/* Torso */}
        <rect x="-9" y="10" width="18" height="28" fill="#1a1a1a" rx="4" />
        {/* Front Pad (White) */}
        <rect x="6" y="25" width="13" height="34" rx="3" fill="#f0f0f0" stroke="#94a3b8" strokeWidth="0.6" />
        {/* Knee Roll Ribs on Pad */}
        <line x1="6" y1="36" x2="19" y2="36" stroke="#cbd5e1" strokeWidth="1" />
        <line x1="6" y1="44" x2="19" y2="44" stroke="#cbd5e1" strokeWidth="1" />
        {/* Back Pad */}
        <rect x="-14" y="27" width="10" height="28" rx="2" fill="#e8e8e8" opacity="0.6" />

        {/* Bat Stance based on shotOfferedType */}
        {isNoShot ? (
          // Shouldering Arms / Leave: Bat held high behind shoulder
          <rect x="-24" y="-8" width="5" height="40" rx="1" fill="#d97706" stroke="#78350f" strokeWidth="0.5" transform="rotate(-35 -22 12)" />
        ) : (
          // Forward Defensive: Bat held in line with pad
          <rect x={ev && ev.batPadSeparationMm < 20 ? "-6" : "-18"} y="8" width="5" height="44" rx="1" fill="#d97706" stroke="#78350f" strokeWidth="0.5" transform="rotate(-15 -15 30)" />
        )}

        {/* Shoes */}
        <ellipse cx="13" cy="60" rx="7" ry="3" fill="#222" />
        <ellipse cx="-9" cy="58" rx="6" ry="3" fill="#222" />
      </g>

      {/* Pitch Bounce Scuff mark */}
      <ellipse cx={pitchBounceX} cy="185" rx="8" ry="4" fill="#5c4530" opacity="0.6" />

      {/* Dynamic Delivery Arc (Bowler -> Pitch Bounce -> Pad Impact) */}
      <path
        d={`M 300,55 Q ${(300 + pitchBounceX) / 2},115 ${pitchBounceX},185 Q ${(pitchBounceX + padImpactX) / 2},250 ${padImpactX},${impactY}`}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />

      {/* Dynamic Moving Cricket Ball */}
      <circle r="5.5" fill="#dc2626" stroke="#991b1b" strokeWidth="0.8">
        <animate
          attributeName="cx"
          values={`300;${pitchBounceX};${padImpactX}`}
          keyTimes="0;0.55;1"
          dur="2.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values={`55;185;${impactY}`}
          keyTimes="0;0.55;1"
          dur="2.2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Pad Impact Flash */}
      <circle cx={padImpactX} cy={impactY} r="16" fill="#FACC15">
        <animate
          attributeName="opacity"
          values="0;0;0;0.8;0"
          keyTimes="0;0.7;0.88;0.94;1"
          dur="2.2s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};

/* ================================================================
   RUN OUT / STUMPING SCENE — Dynamic Side-on Crease Camera
   Driven by RunOutInitialEvidence: dive technique, margin pixels,
   occlusion level, and bail ignition timing.
   ================================================================ */
const RunOutScene = ({ scenario }: { scenario: Scenario }) => {
  const ev = scenario.initialEvidence?.runOut;
  const runOut = scenario.runOut;

  const diveTechnique = ev?.runnerDiveTechnique || (runOut?.diveType === "DIVE" ? "FULL_DIVE" : "FEET_FIRST_SLIDE");
  const marginPx = ev?.visualMarginPixels ?? (runOut ? Math.round(runOut.creaseMarginMm * 0.45) : 0);

  // Crease is at X = 250
  const creaseX = 250;

  // Stumps at X = 160
  const stumpsX = 160;

  // Bat reach position based on marginPx (creaseX + marginPx)
  // If marginPx > 0, bat tip reaches to X = 250 - marginPx (inside crease!)
  // If marginPx < 0, bat tip stops at X = 250 + |marginPx| (short of crease!)
  const batTipTargetX = creaseX - marginPx;

  return (
    <g>
      {/* Turf */}
      <rect x="0" y="210" width="600" height="170" fill="#1a3a26" />
      <line x1="0" y1="210" x2="600" y2="210" stroke="#2a4d38" strokeWidth="1.5" />

      {/* Popping Crease White Line */}
      <rect x={creaseX - 2} y="210" width="4" height="170" fill="white" opacity="0.95" />
      <text x={creaseX + 8} y="225" fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="monospace" fontWeight="bold">
        POPPING CREASE
      </text>

      {/* Stumps Assembly at X=160 */}
      <g transform={`translate(${stumpsX}, 210)`}>
        <rect x="-15" y="0" width="30" height="4" fill="#334155" />
        <rect x="-11" y="-62" width="5" height="62" fill="#cbd5e1" stroke="#475569" strokeWidth="0.4" />
        <rect x="-2.5" y="-62" width="5" height="62" fill="#cbd5e1" stroke="#475569" strokeWidth="0.4" />
        <rect x="6" y="-62" width="5" height="62" fill="#cbd5e1" stroke="#475569" strokeWidth="0.4" />

        {/* Zing Bails with Pulse on Dislodgement */}
        <rect x="-12" y="-65" width="12" height="3" fill="#f59e0b" rx="1" />
        <rect x="1" y="-65" width="12" height="3" fill="#f59e0b" rx="1" />
      </g>

      {/* Wicketkeeper / Bowler at Stumps */}
      <g transform="translate(125, 210)">
        <circle cx="0" cy="-45" r="8" fill="#1e293b" />
        <rect x="-6" y="-37" width="12" height="24" fill="#1e293b" rx="2" />
        <rect x="-7" y="-13" width="6" height="13" fill="#1e293b" />
        <rect x="1" y="-13" width="6" height="13" fill="#1e293b" />
        {/* Glove catching ball at stumps */}
        <circle cx="32" cy="-22" r="7" fill="#16a34a" opacity="0.9" />
      </g>

      {/* Batter Diving / Sliding toward Crease with Dynamic Reach */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`120, 0; 0, 0; 0, 0`}
          keyTimes="0; 0.7; 1"
          dur="2.4s"
          repeatCount="indefinite"
        />

        <g transform={`translate(${batTipTargetX + 65}, 195)`}>
          {/* Body posture based on diveTechnique */}
          {diveTechnique === "FULL_DIVE" ? (
            <>
              <circle cx="45" cy="5" r="10" fill="#1a1a1a" />
              <ellipse cx="20" cy="10" rx="30" ry="10" fill="#1a1a1a" />
              <line x1="0" y1="10" x2="-35" y2="18" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
            </>
          ) : diveTechnique === "FEET_FIRST_SLIDE" ? (
            <>
              <circle cx="50" cy="-5" r="10" fill="#1a1a1a" />
              <rect x="5" y="0" width="50" height="14" fill="#1a1a1a" rx="5" />
              <line x1="5" y1="10" x2="-25" y2="16" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="15" cy="-20" r="10" fill="#1a1a1a" />
              <rect x="5" y="-10" width="20" height="30" fill="#1a1a1a" rx="4" />
              <rect x="5" y="20" width="8" height="20" fill="#1a1a1a" rx="2" />
            </>
          )}

          {/* Extended Cricket Bat */}
          <g>
            <rect x="-65" y="6" width="75" height="8" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            <circle cx="-63" cy="10" r="3.5" fill="white" stroke="#94a3b8" strokeWidth="0.5" />
          </g>

          {/* Ground shadow */}
          <ellipse cx="10" cy="18" rx="55" ry="4" fill="rgba(0,0,0,0.35)" />
        </g>
      </g>

      {/* Incoming Throw Ball hitting Stumps */}
      <circle r="5" fill="#dc2626" stroke="#991b1b" strokeWidth="0.8">
        <animate
          attributeName="cx"
          values="50;160;160"
          keyTimes="0;0.68;1"
          dur="2.4s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values="80;185;185"
          keyTimes="0;0.68;1"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Bail Ignition Flash at Moment of Impact */}
      <circle cx={stumpsX} cy="148" r="15" fill="#EF4444">
        <animate
          attributeName="opacity"
          values="0;0;0.8;0.3;0"
          keyTimes="0;0.65;0.7;0.85;1"
          dur="2.4s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};

/* ================================================================
   CAUGHT BEHIND SCENE — Dynamic Side-on Edge Proximity
   Driven by CaughtBehindInitialEvidence: bat angle, deflection angle,
   apparent gap pixels, and keeper glove position.
   ================================================================ */
const CaughtBehindScene = ({ scenario }: { scenario: Scenario }) => {
  const ev = scenario.initialEvidence?.caughtBehind;
  const cb = scenario.caughtBehind;

  const batAngle = ev?.batAngleDeg ?? 12;
  const deflectionAngle = ev?.apparentDeflectionAngleDeg ?? (cb?.hasEdge ? 2.5 : 0);
  const gapPx = ev?.apparentGapPixels ?? (cb?.hasEdge ? 0 : 16);

  // Bat outside edge contact X
  const batEdgeX = 368;
  const ballStartX = batEdgeX + gapPx + 150;
  const ballTransitX = batEdgeX + gapPx;

  // If deflection occurs, ball trajectory deviates down-left towards keeper
  const ballEndX = deflectionAngle > 0 ? 215 : 180;
  const ballEndY = deflectionAngle > 0 ? 230 : 210;

  return (
    <g>
      {/* Pitch surface */}
      <rect x="0" y="260" width="600" height="120" fill="#b49b78" opacity="0.4" />
      <line x1="0" y1="260" x2="600" y2="260" stroke="#8a7353" strokeWidth="1" />

      {/* Stumps */}
      <g transform="translate(310, 260)">
        <rect x="-12" y="-50" width="4.5" height="50" fill="#cbd5e1" stroke="#475569" strokeWidth="0.4" />
        <rect x="-2.25" y="-52" width="4.5" height="52" fill="#cbd5e1" stroke="#475569" strokeWidth="0.4" />
        <rect x="7.5" y="-50" width="4.5" height="50" fill="#cbd5e1" stroke="#475569" strokeWidth="0.4" />
        <rect x="-13" y="-54" width="12" height="2.5" fill="#f59e0b" rx="1" />
        <rect x="1" y="-54" width="12" height="2.5" fill="#f59e0b" rx="1" />
      </g>

      {/* Batter playing shot */}
      <g transform="translate(400, 160)">
        <circle cx="0" cy="0" r="14" fill="#1a1a1a" />
        <rect x="-5" y="-4" width="10" height="4" fill="#333" rx="1" />
        <rect x="-12" y="14" width="24" height="40" fill="#1a1a1a" rx="5" />
        {/* Front pad */}
        <rect x="8" y="40" width="12" height="34" rx="3" fill="#f0f0f0" stroke="#94a3b8" strokeWidth="0.5" />
        <rect x="-14" y="42" width="10" height="30" rx="2" fill="#e8e8e8" opacity="0.5" />

        {/* Bat Blade with dynamic angle */}
        <rect
          x="-32"
          y="15"
          width="6"
          height="52"
          rx="1.5"
          fill="#d97706"
          stroke="#78350f"
          strokeWidth="0.6"
          transform={`rotate(${batAngle} -29 41)`}
        />

        {/* Shoes */}
        <ellipse cx="14" cy="76" rx="8" ry="3" fill="#222" />
        <ellipse cx="-8" cy="74" rx="6" ry="3" fill="#222" />
      </g>

      {/* Wicketkeeper crouching behind stumps */}
      <g transform="translate(200, 200)">
        <circle cx="0" cy="0" r="12" fill="#2a2a2a" />
        <rect x="-10" y="12" width="20" height="30" fill="#2a2a2a" rx="4" />
        <rect x="-14" y="35" width="8" height="22" fill="#2a2a2a" rx="2" />
        <rect x="6" y="35" width="8" height="22" fill="#2a2a2a" rx="2" />
        {/* Gloves extended ready */}
        <circle cx="22" cy="30" r="8" fill="#16a34a" opacity="0.85" />
        <circle cx="28" cy="22" r="7" fill="#16a34a" opacity="0.75" />
      </g>

      {/* Dynamic Ball Flight Passing Bat Edge */}
      <circle r="5.5" fill="#dc2626" stroke="#991b1b" strokeWidth="0.8">
        <animate
          attributeName="cx"
          values={`${ballStartX};${ballTransitX};${ballEndX}`}
          keyTimes="0;0.45;1"
          dur="2.2s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values={`195;205;${ballEndY}`}
          keyTimes="0;0.45;1"
          dur="2.2s"
          repeatCount="indefinite"
        />
      </circle>

      {/* Contact Spark Flash if edge occurs */}
      {deflectionAngle > 0 && (
        <circle cx={batEdgeX} cy="205" r="10" fill="#FACC15">
          <animate
            attributeName="opacity"
            values="0;0;0.8;0"
            keyTimes="0;0.42;0.48;0.6"
            dur="2.2s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </g>
  );
};

/* ================================================================
   BOUNDARY SCENE — Dynamic Boundary Rope Tracking Camera
   Driven by BoundaryInitialEvidence: dive angle, cushion interaction,
   ball toss height, and release timing relationship.
   ================================================================ */
const BoundaryScene = ({ scenario }: { scenario: Scenario }) => {
  const ev = scenario.initialEvidence?.boundary;
  const b = scenario.boundary;

  const isBoundary = b?.isBoundary ?? false;
  const cushionApexX = 280;

  // Fielder sliding distance based on cushion interaction
  let slideReachX = cushionApexX - 35;
  if (ev?.apparentCushionInteraction === "DEEP_CUSHION_COMPRESSION" || isBoundary) {
    slideReachX = cushionApexX + 15; // crosses onto cushion
  } else if (ev?.apparentCushionInteraction === "GRAZING_CUSHION_EDGE") {
    slideReachX = cushionApexX - 5; // right at cushion boundary
  }

  const tossHeight = ev?.ballTossHeightPixels ?? (isBoundary ? 0 : 70);

  return (
    <g>
      {/* Outfield Grass */}
      <rect x="0" y="0" width="600" height="220" fill="#1a3a26" />

      {/* Boundary Rope / Cushion Zone */}
      <rect x="0" y="220" width="600" height="160" fill="#0d1b12" />

      {/* White Boundary Line */}
      <line x1="0" y1="222" x2="600" y2="222" stroke="white" strokeWidth="2.5" opacity="0.8" />

      {/* Boundary Foam Cushion at X=200 to 440 */}
      <polygon points="180,222 420,222 440,260 160,260" fill="#d97706" stroke="#78350f" strokeWidth="1" />
      <text x="300" y="247" textAnchor="middle" fill="white" fontSize="10" fontFamily="monospace" fontWeight="bold" opacity="0.7">
        BOUNDARY CUSHION
      </text>

      {/* Fielder in Athletic Dive */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="100, 0; 0, 0; 0, 0"
          keyTimes="0; 0.65; 1"
          dur="2.5s"
          repeatCount="indefinite"
        />

        <g transform={`translate(${slideReachX}, 180)`}>
          {/* Head */}
          <circle cx="30" cy="-5" r="10" fill="#1a1a1a" />
          {/* Horizontal dive body */}
          <ellipse cx="10" cy="5" rx="28" ry="10" fill="#1a1a1a" />
          {/* Arm reaching/flicking */}
          <line x1="-15" y1="8" x2="-55" y2="18" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          {/* Legs trailing */}
          <line x1="35" y1="5" x2="55" y2="-10" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          <line x1="30" y1="10" x2="50" y2="5" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
          {/* Ground shadow */}
          <ellipse cx="5" cy="18" rx="45" ry="4" fill="rgba(0,0,0,0.3)" />
        </g>
      </g>

      {/* Ball in Motion (Held or Flicked back into Play) */}
      <circle r="5.5" fill="#dc2626" stroke="#991b1b" strokeWidth="0.8">
        <animate
          attributeName="cx"
          values={`${slideReachX + 40};${slideReachX - 55};${isBoundary ? slideReachX - 55 : slideReachX - 110}`}
          keyTimes="0;0.65;1"
          dur="2.5s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="cy"
          values={`170;198;${isBoundary ? 198 : 198 - tossHeight}`}
          keyTimes="0;0.65;1"
          dur="2.5s"
          repeatCount="indefinite"
        />
      </circle>
    </g>
  );
};
