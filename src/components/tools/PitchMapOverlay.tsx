import React, { useState } from "react";
import type { LBWData, OnFieldSignal } from "../../types/scenario";
import {
  Play,
  RotateCcw,
  Crosshair,
  Footprints,
  Activity,
} from "lucide-react";
import { sounds } from "../../engine/audioSynth";

interface PitchMapOverlayProps {
  lbw: LBWData;
  onFieldSignal: OnFieldSignal;
  onStageChange?: (stage: number) => void;
  /** Training assist: shows the AUTO ALL bulk-reveal button. Normal gameplay
   *  requires the player to reveal each evidence stage manually. */
  trainingMode?: boolean;
}

export const PitchMapOverlay: React.FC<PitchMapOverlayProps> = ({
  lbw,
  onStageChange,
  trainingMode = false,
}) => {
  // Stages:
  // 0: Idle, 1: Front Foot (No-Ball Check), 2: UltraEdge Bat Check, 3: Pitching Zone, 4: Impact Zone, 5: Wickets Projection
  const [revealStage, setRevealStage] = useState<number>(0);
  const maxStages = 5;

  const advanceStage = () => {
    const next = Math.min(maxStages, revealStage + 1);
    setRevealStage(next);
    sounds.playHawkEyePing(next);
    onStageChange?.(next);
  };

  const resetStage = () => {
    setRevealStage(0);
    sounds.playClick(600);
    onStageChange?.(0);
  };

  const revealAll = () => {
    setRevealStage(maxStages);
    sounds.playHawkEyePing(maxStages);
    onStageChange?.(maxStages);
  };

  // Geometric coordinates for authentic 3D perspective pitch
  const pitchCenterX = 250;
  const pitchDotX = pitchCenterX + lbw.pitchX * 170;
  const pitchDotY = 135;
  const impactDotX = pitchCenterX + lbw.impactX * 155;
  const impactDotY = 265;
  const stumpTargetX = pitchCenterX + lbw.stumpHitX * 140;

  // Neutral evidence colour: the tool presents physical measurements only.
  // Gate/verdict conclusions stay internal to the DRS engine — the player makes the call.
  const EVIDENCE_COLOR = "#38BDF8";

  const getStageTitle = (stage: number) => {
    switch (stage) {
      case 0: return "1. CHECK FAIR DELIVERY";
      case 1: return "2. CHECK BAT EDGE";
      case 2: return "3. CHECK PITCHING";
      case 3: return "4. CHECK IMPACT";
      case 4: return "5. PROJECT TO STUMPS";
      default: return "REVIEW COMPLETE";
    }
  };

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Broadcast Monitor Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            HAWK-EYE 3D BALL TRACKING
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            {lbw.ballSpeedKph} KM/H • {lbw.spinOrPace}
          </span>
        </div>

        {/* Tactical Control Actions */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={resetStage}
            className="tactical-btn p-1.5 rounded text-slate-400 hover:text-white transition-colors"
            title="Reset telemetry sequence"
          >
            <RotateCcw size={13} />
          </button>
          {trainingMode && (
            <button
              onClick={revealAll}
              className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-300 transition-colors"
              title="Training assist: reveal all telemetry stages at once"
            >
              AUTO ALL
            </button>
          )}
          {revealStage < maxStages && (
            <button
              onClick={advanceStage}
              className="px-3.5 py-1 rounded text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md shadow-cyan-500/25 flex items-center space-x-1.5 active:scale-95 font-display"
            >
              <span>{getStageTitle(revealStage)}</span>
              <Play size={11} fill="currentColor" />
            </button>
          )}
        </div>
      </div>

      {/* 3D Visualizer Canvas & Overlays */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#0e1626] via-[#09101c] to-[#040812] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        {/* Broadcast TV scanline */}
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 500 370" className="w-full h-full max-h-[360px] z-10">
          <defs>
            {/* Realistic Clay Wicket Strip */}
            <linearGradient id="clayWicket" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#b49b78" />
              <stop offset="50%" stopColor="#c5ad8b" />
              <stop offset="100%" stopColor="#a88e6b" />
            </linearGradient>

            {/* Outfield Grass */}
            <linearGradient id="outfieldGrass" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a29" />
              <stop offset="100%" stopColor="#14281c" />
            </linearGradient>

            {/* Corridor Glow */}
            <linearGradient id="corridorGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.25" />
            </linearGradient>
          </defs>

          {/* Outfield Grass Field */}
          <rect x="0" y="0" width="500" height="370" fill="url(#outfieldGrass)" />

          {/* 22-Yard Clay Cricket Pitch Strip */}
          <polygon
            points="170,50 330,50 415,345 85,345"
            fill="url(#clayWicket)"
            stroke="#8a7353"
            strokeWidth="1.5"
          />

          {/* Wicket-to-Wicket In-Line Corridor (Between Stumps) */}
          <polygon
            points="220,50 280,50 302,345 198,345"
            fill="url(#corridorGlow)"
            stroke="#0284C7"
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.85"
          />

          {/* Bowling Crease (Top) & Return Creases */}
          <line x1="160" y1="75" x2="340" y2="75" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.8" />
          <line x1="195" y1="50" x2="195" y2="85" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
          <line x1="305" y1="50" x2="305" y2="85" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />

          {/* Popping Crease (Bottom) & Return Creases */}
          <line x1="95" y1="315" x2="405" y2="315" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.95" />
          <line x1="140" y1="315" x2="130" y2="345" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.7" />
          <line x1="360" y1="315" x2="370" y2="345" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.7" />
          <text x="105" y="310" fill="#FFFFFF" opacity="0.8" fontSize="8" fontFamily="monospace" fontWeight="bold">
            POPPING CREASE
          </text>

          {/* Non-Striker Wickets (Top) */}
          <g transform="translate(250, 50)">
            <rect x="-12" y="-12" width="24" height="12" fill="#475569" opacity="0.5" />
            <rect x="-8" y="-12" width="2" height="12" fill="#d97706" />
            <rect x="-1" y="-12" width="2" height="12" fill="#d97706" />
            <rect x="6" y="-12" width="2" height="12" fill="#d97706" />
          </g>

          {/* Striker Wickets (Bottom) */}
          <g transform="translate(250, 345)">
            <rect x="-38" y="0" width="76" height="3" fill="#334155" />
            <rect x="-30" y="-34" width="5.5" height="34" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            <rect x="-2.75" y="-36" width="5.5" height="36" fill="#f59e0b" stroke="#78350f" strokeWidth="0.5" />
            <rect x="24.5" y="-34" width="5.5" height="34" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            <rect x="-32" y="-37" width="32" height="3.5" fill="#f59e0b" rx="1" />
            <rect x="0" y="-37" width="32" height="3.5" fill="#f59e0b" rx="1" />
          </g>

          {/* Batter Stance Silhouette (Realistic Batting Pad Profile) */}
          <g transform={`translate(${impactDotX}, 280)`} opacity="0.5">
            <ellipse cx="0" cy="0" rx="16" ry="6" fill="#000000" />
            {/* Batting Pad (White with Knee Rolls) */}
            <rect x="-10" y="-35" width="20" height="35" rx="3" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.8" />
            <line x1="-10" y1="-24" x2="10" y2="-24" stroke="#cbd5e1" strokeWidth="1.5" />
            <line x1="-10" y1="-14" x2="10" y2="-14" stroke="#cbd5e1" strokeWidth="1.5" />
            {/* Batter Shoe */}
            <ellipse cx="0" cy="2" rx="10" ry="4" fill="#334155" />
          </g>

          {/* STAGE 3+: Delivery Parabolic Arc with Dynamic Ground Shadow */}
          {revealStage >= 3 && (
            <g className="animate-fadeIn">
              {/* Ground Shadow on Pitch */}
              <path
                d={`M 250,50 L ${pitchDotX},${pitchDotY}`}
                fill="none"
                stroke="#000000"
                strokeWidth="2.5"
                opacity="0.45"
              />
              {/* Ball Flight Line in Air */}
              <path
                d={`M 250,20 Q ${(250 + pitchDotX) / 2},${(20 + pitchDotY) / 2 - 20} ${pitchDotX},${pitchDotY}`}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.5"
                strokeDasharray="4 3"
              />
              {/* Pitch Landing Turf Scuff & Halo */}
              <ellipse
                cx={pitchDotX}
                cy={pitchDotY}
                rx="14"
                ry="7"
                fill={EVIDENCE_COLOR}
                fillOpacity="0.35"
                stroke={EVIDENCE_COLOR}
                strokeWidth="2"
              />
              <circle cx={pitchDotX} cy={pitchDotY} r="4.5" fill="#FFFFFF" stroke="#0f172a" strokeWidth="1" />
              <text
                x={pitchDotX + 18}
                y={pitchDotY + 4}
                fill={EVIDENCE_COLOR}
                fontSize="11"
                fontFamily="monospace"
                fontWeight="900"
              >
                PITCH POINT
              </text>
            </g>
          )}

          {/* STAGE 4+: Bounce Arc to Pad Impact */}
          {revealStage >= 4 && (
            <g className="animate-fadeIn">
              <path
                d={`M ${pitchDotX},${pitchDotY} Q ${(pitchDotX + impactDotX) / 2},${(pitchDotY + impactDotY) / 2 - 15} ${impactDotX},${impactDotY}`}
                fill="none"
                stroke="#FACC15"
                strokeWidth="3"
              />
              {/* Pad Impact Circle */}
              <circle
                cx={impactDotX}
                cy={impactDotY}
                r="10"
                fill={EVIDENCE_COLOR}
                fillOpacity="0.4"
                stroke={EVIDENCE_COLOR}
                strokeWidth="2"
              />
              <circle cx={impactDotX} cy={impactDotY} r="4.5" fill="#FFFFFF" stroke="#0f172a" strokeWidth="1" />
              <text
                x={impactDotX > 250 ? impactDotX - 195 : impactDotX + 18}
                y={impactDotY + 4}
                fill={EVIDENCE_COLOR}
                fontSize="11"
                fontFamily="monospace"
                fontWeight="900"
              >
                IMPACT • {lbw.impactDistance}m FROM STUMPS
              </text>
            </g>
          )}

          {/* STAGE 5: Projected Path to Stumps */}
          {revealStage >= 5 && (
            <g className="animate-fadeIn">
              <path
                d={`M ${impactDotX},${impactDotY} L ${stumpTargetX},345`}
                fill="none"
                stroke={EVIDENCE_COLOR}
                strokeWidth="3.5"
              />
              <circle
                cx={stumpTargetX}
                cy={345}
                r="8.5"
                fill={EVIDENCE_COLOR}
                fillOpacity="0.8"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Live Gate 0 Telemetry Cards (Top Left Overlay) — raw physical evidence only */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 z-20">
          {revealStage >= 1 && (
            <div className="px-3 py-1.5 rounded-md text-[11px] font-mono border backdrop-blur-md flex items-center gap-2 shadow-lg animate-fadeIn bg-slate-950/90 border-cyan-500/50 text-cyan-200">
              <Footprints size={13} className="text-cyan-400" />
              <div>
                <span className="font-black">FRONT FOOT: </span>
                <span>{lbw.isNoBall ? `HEEL +${lbw.frontFootOverstepMm}mm PAST LINE` : "HEEL BEHIND LINE"}</span>
              </div>
            </div>
          )}

          {revealStage >= 2 && (
            <div className="px-3 py-1.5 rounded-md text-[11px] font-mono border backdrop-blur-md flex items-center gap-2 shadow-lg animate-fadeIn bg-slate-950/90 border-cyan-500/50 text-cyan-200">
              <Activity size={13} className="text-cyan-400" />
              <div>
                <span className="font-black">ULTRAEDGE: </span>
                <span>{lbw.batContactBeforePad ? "BAT CONTACT SIGNAL" : "NO BAT SIGNAL"}</span>
              </div>
            </div>
          )}
        </div>

        {/* Clean Broadcast Stump Target Box HUD (Top Right) */}
        <div className="absolute top-2.5 right-2.5 w-40 bg-slate-950/95 border border-slate-700 rounded-lg p-2.5 backdrop-blur-md shadow-2xl z-20">
          <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1 mb-1.5 font-bold">
            <span className="flex items-center gap-1 text-cyan-300">
              <Crosshair size={11} className="text-cyan-400" />
              STUMP IMPACT
            </span>
            {/* Stage-gated: the projected impact height is Stage-5 evidence and
                must stay hidden until the wickets projection is revealed. */}
            <span className="text-slate-200">
              {revealStage >= 5 ? `${lbw.stumpHitHeightCm.toFixed(1)} cm` : "--.- cm"}
            </span>
          </div>

          <svg viewBox="0 0 100 80" className="w-full h-20 bg-[#070b14] rounded border border-slate-800">
            {/* 3 Wooden Stumps */}
            <rect x="27" y="18" width="5" height="58" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            <rect x="47.5" y="15" width="5" height="61" fill="#f59e0b" stroke="#78350f" strokeWidth="0.5" />
            <rect x="68" y="18" width="5" height="58" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            {/* Bails */}
            <rect x="25" y="14" width="25" height="3" fill="#f59e0b" rx="1" />
            <rect x="50" y="14" width="25" height="3" fill="#f59e0b" rx="1" />

            {/* Official 50% Umpire's Call Outer Margin */}
            <rect
              x="21"
              y="9"
              width="58"
              height="67"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="0.8"
              strokeDasharray="2 2"
              opacity="0.8"
            />

            {revealStage >= 5 ? (
              <g className="animate-fadeIn">
                <circle
                  cx={50 + lbw.stumpHitX * 90}
                  cy={76 - (lbw.stumpHitHeightCm / 71.1) * 58}
                  r="7"
                  fill={EVIDENCE_COLOR}
                  fillOpacity="0.85"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              </g>
            ) : (
              <text x="50" y="48" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace" fontWeight="bold">
                PROJECTION PENDING
              </text>
            )}
          </svg>

          {/* Projection Status Pill — stage status only, never the outcome */}
          <div className="mt-1.5 text-center text-[10px] font-black tracking-wider">
            {revealStage < 5 ? (
              <span className="text-slate-500">STAGE PENDING</span>
            ) : (
              <span className="text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-600/40">
                PROJECTION SHOWN • MAKE YOUR CALL
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5-Gate Review Sequence Cards — evidence pointers & neutral measurements only */}
      <div className="grid grid-cols-5 gap-2 pt-1 font-mono">
        {/* Gate 0A */}
        <div className={`p-2 rounded-lg border transition-all ${
          revealStage >= 1
            ? "bg-slate-800/60 border-cyan-700/50 text-cyan-200"
            : "bg-slate-900 border-slate-800 text-slate-500"
        }`}>
          <div className="text-[9px] text-slate-400 font-bold">0A. FRONT FOOT</div>
          <div className="text-xs font-black truncate">
            {revealStage >= 1 ? (lbw.isNoBall ? `+${lbw.frontFootOverstepMm}mm PAST` : "BEHIND LINE") : "PENDING"}
          </div>
        </div>

        {/* Gate 0B */}
        <div className={`p-2 rounded-lg border transition-all ${
          revealStage >= 2
            ? "bg-slate-800/60 border-cyan-700/50 text-cyan-200"
            : "bg-slate-900 border-slate-800 text-slate-500"
        }`}>
          <div className="text-[9px] text-slate-400 font-bold">0B. BAT SIGNAL</div>
          <div className="text-xs font-black truncate">
            {revealStage >= 2 ? (lbw.batContactBeforePad ? "CONTACT" : "NO SIGNAL") : "PENDING"}
          </div>
        </div>

        {/* Gate 1 */}
        <div className={`p-2 rounded-lg border transition-all ${
          revealStage >= 3
            ? "bg-slate-800/60 border-cyan-700/50 text-cyan-200"
            : "bg-slate-900 border-slate-800 text-slate-500"
        }`}>
          <div className="text-[9px] text-slate-400 font-bold">1. PITCHING</div>
          <div className="text-xs font-black truncate">
            {revealStage >= 3 ? "SEE PITCH MAP" : "PENDING"}
          </div>
        </div>

        {/* Gate 2 */}
        <div className={`p-2 rounded-lg border transition-all ${
          revealStage >= 4
            ? "bg-slate-800/60 border-cyan-700/50 text-cyan-200"
            : "bg-slate-900 border-slate-800 text-slate-500"
        }`}>
          <div className="text-[9px] text-slate-400 font-bold">2. IMPACT</div>
          <div className="text-xs font-black truncate">
            {revealStage >= 4 ? `${lbw.impactDistance}m FROM STUMPS` : "PENDING"}
          </div>
        </div>

        {/* Gate 3 */}
        <div className={`p-2 rounded-lg border transition-all ${
          revealStage >= 5
            ? "bg-slate-800/60 border-cyan-700/50 text-cyan-200"
            : "bg-slate-900 border-slate-800 text-slate-500"
        }`}>
          <div className="text-[9px] text-slate-400 font-bold">3. WICKETS</div>
          <div className="text-xs font-black truncate">
            {revealStage >= 5 ? `${lbw.stumpHitHeightCm.toFixed(1)}cm HEIGHT` : "PENDING"}
          </div>
        </div>
      </div>
    </div>
  );
};
