import React, { useState, useMemo } from "react";
import type { LBWData, OnFieldSignal } from "../../types/scenario";
import {
  Play,
  RotateCcw,
  Crosshair,
  Footprints,
  Activity,
} from "lucide-react";
import { sounds } from "../../engine/audioSynth";
import { getHawkEyeTrajectoryStages } from "../../engine/lbwPhysics";

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

  // Authoritative continuous 3D delivery trajectory & projection for CAM 03 Hawk-Eye
  const trajectoryStages = useMemo(() => getHawkEyeTrajectoryStages(lbw), [lbw]);

  // Neutral evidence colour: physical measurements only
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
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-1.5 select-none font-mono text-slate-200">
      {/* Top Broadcast Monitor Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            HAWK-EYE 3D BALL TRACKING
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            {lbw.ballSpeedKph} KM/H • {lbw.spinOrPace}
          </span>
          <span className="text-[10px] text-cyan-400/90 font-bold hidden sm:inline">
            [BOWLER END CAMERA]
          </span>
        </div>

        {/* Tactical Control Actions */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={resetStage}
            className="tactical-btn p-1.5 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Reset telemetry sequence"
          >
            <RotateCcw size={13} />
          </button>
          {trainingMode && (
            <button
              onClick={revealAll}
              className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-300 transition-colors cursor-pointer"
              title="Training assist: reveal all telemetry stages at once"
            >
              AUTO ALL
            </button>
          )}
          {revealStage < maxStages && (
            <button
              onClick={advanceStage}
              className="px-3.5 py-1 rounded text-xs font-black bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md shadow-cyan-500/25 flex items-center space-x-1.5 active:scale-95 font-display cursor-pointer"
            >
              <span>{getStageTitle(revealStage)}</span>
              <Play size={11} fill="currentColor" />
            </button>
          )}
        </div>
      </div>

      {/* 3D Visualizer Canvas & Overlays */}
      <div className="relative flex-1 min-h-0 my-0.5 bg-gradient-to-b from-[#0e1626] via-[#09101c] to-[#040812] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        {/* Broadcast TV scanline */}
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg viewBox="0 0 600 350" className="w-full h-full z-10">
          <defs>
            {/* Strict Pitch Trapezoid Clip Path — Prevents geometry from bleeding onto outfield */}
            <clipPath id="pitchClip">
              <polygon points="45,335 555,335 390,65 210,65" />
            </clipPath>

            {/* Realistic Clay Wicket Strip */}
            <linearGradient id="clayWicket" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#bfa583" />
              <stop offset="60%" stopColor="#ad9372" />
              <stop offset="100%" stopColor="#9b8162" />
            </linearGradient>

            {/* Seamless Outfield Turf Gradient */}
            <radialGradient id="outfieldGrass" cx="50%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#14281c" />
              <stop offset="60%" stopColor="#0d1b13" />
              <stop offset="100%" stopColor="#070e0a" />
            </radialGradient>

            {/* In-Line Corridor Glow */}
            <linearGradient id="corridorGlow" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Outfield Grass Field */}
          <rect x="0" y="0" width="600" height="350" fill="url(#outfieldGrass)" />

          {/* 22-Yard Clay Cricket Pitch Strip (Bowler End wide at bottom, Striker End narrow at top) */}
          <polygon
            points="45,335 555,335 390,65 210,65"
            fill="url(#clayWicket)"
            stroke="#7d674b"
            strokeWidth="1.5"
          />

          {/* Pitch Surface Overlay Group — Strictly clipped to pitch boundaries */}
          <g clipPath="url(#pitchClip)">
            {/* Wicket-to-Wicket In-Line Corridor (Between Stumps) */}
            <polygon
              points="260,335 340,335 315,65 285,65"
              fill="url(#corridorGlow)"
              stroke="#0284C7"
              strokeWidth="1"
              strokeDasharray="4 3"
              opacity="0.85"
            />
          </g>

          {/* Bowling Crease (Bottom / Bowler End) */}
          <line x1="55" y1="318" x2="545" y2="318" stroke="#FFFFFF" strokeWidth="2.2" opacity="0.9" />
          <line x1="85" y1="318" x2="70" y2="335" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.6" />
          <line x1="515" y1="318" x2="530" y2="335" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.6" />
          <text x="65" y="312" fill="#FFFFFF" opacity="0.75" fontSize="8" fontFamily="monospace" fontWeight="bold">
            BOWLING CREASE
          </text>

          {/* Non-Striker Wickets (Bottom End Base) */}
          <g transform="translate(300, 335)">
            <rect x="-20" y="-2" width="40" height="4" fill="#334155" />
            <rect x="-16" y="-18" width="4" height="18" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            <rect x="-2" y="-19" width="4" height="19" fill="#f59e0b" stroke="#78350f" strokeWidth="0.5" />
            <rect x="12" y="-18" width="4" height="18" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            <rect x="-17" y="-20" width="17" height="2" fill="#f59e0b" rx="0.5" />
            <rect x="0" y="-20" width="17" height="2" fill="#f59e0b" rx="0.5" />
          </g>

          {/* Popping Crease (Top / Striker End) & Return Creases */}
          <line x1="200" y1="82" x2="400" y2="82" stroke="#FFFFFF" strokeWidth="1.8" opacity="0.9" />
          <line x1="215" y1="65" x2="210" y2="82" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
          <line x1="385" y1="65" x2="390" y2="82" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
          <text x="120" y="85" fill="#FFFFFF" opacity="0.7" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
            POPPING CREASE
          </text>

          {/* Striker Wickets (Top End Target) */}
          <g transform="translate(300, 65)">
            <rect x="-26" y="0" width="52" height="2.5" fill="#1e293b" />
            {/* 3 Stumps standing tall */}
            <rect x="-20" y="-34" width="5" height="34" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            <rect x="-2.5" y="-36" width="5" height="36" fill="#f59e0b" stroke="#78350f" strokeWidth="0.5" />
            <rect x="15" y="-34" width="5" height="34" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
            {/* Bails */}
            <rect x="-21" y="-38" width="21" height="3" fill="#f59e0b" rx="0.8" />
            <rect x="0" y="-38" width="21" height="3" fill="#f59e0b" rx="0.8" />
          </g>

          {/* Batter Stance Silhouette (At Striker Popping Crease) */}
          <g transform={`translate(${trajectoryStages.impactPointSVG.x}, ${trajectoryStages.impactGroundSVG.y})`} opacity="0.6">
            <ellipse cx="0" cy="0" rx="14" ry="4" fill="#000000" />
            {/* Batting Pad (White with Knee Rolls) */}
            <rect x="-8" y="-28" width="16" height="28" rx="2.5" fill="#f8fafc" stroke="#94a3b8" strokeWidth="0.7" />
            <line x1="-8" y1="-19" x2="8" y2="-19" stroke="#cbd5e1" strokeWidth="1.2" />
            <line x1="-8" y1="-11" x2="8" y2="-11" stroke="#cbd5e1" strokeWidth="1.2" />
            {/* Batter Shoe */}
            <ellipse cx="0" cy="1" rx="9" ry="3" fill="#334155" />
          </g>

          {/* STAGE 3+: Delivery Trajectory Arc (Bowler Release -> Pitch Point) */}
          {revealStage >= 3 && (
            <g className="animate-fadeIn">
              {/* Ground Shadow along pitch — strictly clipped to pitch */}
              <g clipPath="url(#pitchClip)">
                <path
                  d={trajectoryStages.flightShadowPath}
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2.5"
                  opacity="0.4"
                />
              </g>
              {/* Ball Flight Arc in Air */}
              <path
                d={trajectoryStages.flightArcPath}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3"
                strokeDasharray="5 3"
              />
              {/* Pitch Landing Turf Scuff & Halo */}
              <ellipse
                cx={trajectoryStages.pitchPointSVG.x}
                cy={trajectoryStages.pitchPointSVG.y}
                rx="16"
                ry="8"
                fill={EVIDENCE_COLOR}
                fillOpacity="0.35"
                stroke={EVIDENCE_COLOR}
                strokeWidth="2"
              />
              <circle cx={trajectoryStages.pitchPointSVG.x} cy={trajectoryStages.pitchPointSVG.y} r="4.5" fill="#FFFFFF" stroke="#0f172a" strokeWidth="1" />
              <text
                x={trajectoryStages.pitchPointSVG.x + 20}
                y={trajectoryStages.pitchPointSVG.y + 4}
                fill={EVIDENCE_COLOR}
                fontSize="11"
                fontFamily="monospace"
                fontWeight="900"
              >
                PITCH POINT
              </text>
            </g>
          )}

          {/* STAGE 4+: Bounce Arc to Bat or Pad Impact */}
          {revealStage >= 4 && (
            <g className="animate-fadeIn">
              {/* Ground Shadow along pitch */}
              <g clipPath="url(#pitchClip)">
                <path
                  d={trajectoryStages.bounceShadowPath}
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2.5"
                  opacity="0.4"
                />
              </g>

              {lbw.batContactBeforePad ? (
                <>
                  {/* Bounce Arc to Bat Contact */}
                  <path
                    d={trajectoryStages.bounceArcPath}
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="3.2"
                  />
                  {/* Deflected Arc off Bat */}
                  <path
                    d={trajectoryStages.deflectedArcPath}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.8"
                    strokeDasharray="4 3"
                  />
                  {/* Bat Contact Marker */}
                  <circle
                    cx={trajectoryStages.batContactPointSVG.x}
                    cy={trajectoryStages.batContactPointSVG.y}
                    r="10"
                    fill="#38BDF8"
                    fillOpacity="0.45"
                    stroke="#38BDF8"
                    strokeWidth="2"
                  />
                  <circle cx={trajectoryStages.batContactPointSVG.x} cy={trajectoryStages.batContactPointSVG.y} r="4.5" fill="#FFFFFF" stroke="#0f172a" strokeWidth="1" />
                  <text
                    x={trajectoryStages.batContactPointSVG.x > 300 ? trajectoryStages.batContactPointSVG.x - 220 : trajectoryStages.batContactPointSVG.x + 16}
                    y={trajectoryStages.batContactPointSVG.y + 4}
                    fill="#38BDF8"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="900"
                  >
                    BAT CONTACT DETECTED
                  </text>
                </>
              ) : (
                <>
                  {/* Bounce Arc to Pad Impact */}
                  <path
                    d={trajectoryStages.bounceArcPath}
                    fill="none"
                    stroke="#FACC15"
                    strokeWidth="3.2"
                  />
                  {/* Pad Impact Circle */}
                  <circle
                    cx={trajectoryStages.impactPointSVG.x}
                    cy={trajectoryStages.impactPointSVG.y}
                    r="10"
                    fill={EVIDENCE_COLOR}
                    fillOpacity="0.45"
                    stroke={EVIDENCE_COLOR}
                    strokeWidth="2"
                  />
                  <circle cx={trajectoryStages.impactPointSVG.x} cy={trajectoryStages.impactPointSVG.y} r="4.5" fill="#FFFFFF" stroke="#0f172a" strokeWidth="1" />
                  <text
                    x={trajectoryStages.impactPointSVG.x > 300 ? trajectoryStages.impactPointSVG.x - 200 : trajectoryStages.impactPointSVG.x + 16}
                    y={trajectoryStages.impactPointSVG.y + 4}
                    fill={EVIDENCE_COLOR}
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="900"
                  >
                    IMPACT • {lbw.impactDistance}m FROM STUMPS
                  </text>
                </>
              )}
            </g>
          )}

          {/* STAGE 5: Projected Path to Striker Stumps (Only if no prior bat contact) */}
          {revealStage >= 5 && !lbw.batContactBeforePad && (
            <g className="animate-fadeIn">
              {/* Virtual Projected Shadow */}
              <g clipPath="url(#pitchClip)">
                <path
                  d={trajectoryStages.projectedShadowPath}
                  fill="none"
                  stroke="#000000"
                  strokeWidth="2.5"
                  opacity="0.4"
                />
              </g>
              {/* Virtual Projected Ray */}
              <path
                d={trajectoryStages.projectedStumpsPath}
                fill="none"
                stroke={EVIDENCE_COLOR}
                strokeWidth="3.5"
              />
              {/* Target Impact Marker on Stumps */}
              <circle
                cx={trajectoryStages.stumpsPointSVG.x}
                cy={trajectoryStages.stumpsPointSVG.y}
                r="7.5"
                fill={EVIDENCE_COLOR}
                fillOpacity="0.85"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
            </g>
          )}

          {/* STAGE 5 (If prior bat contact): Invalidation Banner */}
          {revealStage >= 5 && lbw.batContactBeforePad && (
            <g className="animate-fadeIn">
              <rect
                x="150"
                y="15"
                width="300"
                height="30"
                rx="6"
                fill="#0F172A"
                fillOpacity="0.92"
                stroke="#38BDF8"
                strokeWidth="1.5"
              />
              <text
                x="300"
                y="34"
                textAnchor="middle"
                fill="#38BDF8"
                fontSize="11"
                fontFamily="monospace"
                fontWeight="bold"
              >
                PRIOR BAT CONTACT • TRACKING INELIGIBLE
              </text>
            </g>
          )}
        </svg>

        {/* Live Gate 0 Telemetry Cards (Top Left Overlay) */}
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
            <span className="text-slate-200">
              {revealStage >= 5
                ? lbw.batContactBeforePad
                  ? "INELIGIBLE"
                  : `${lbw.stumpHitHeightCm.toFixed(1)} cm`
                : "--.- cm"}
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

            {revealStage >= 5 && !lbw.batContactBeforePad ? (
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
            ) : revealStage >= 5 && lbw.batContactBeforePad ? (
              <text x="50" y="48" textAnchor="middle" fill="#38bdf8" fontSize="7.5" fontFamily="monospace" fontWeight="bold">
                BAT CONTACT
              </text>
            ) : (
              <text x="50" y="48" textAnchor="middle" fill="#64748b" fontSize="8" fontFamily="monospace" fontWeight="bold">
                PROJECTION PENDING
              </text>
            )}
          </svg>

          {/* Projection Status Pill */}
          <div className="mt-1.5 text-center text-[10px] font-black tracking-wider">
            {revealStage < 5 ? (
              <span className="text-slate-500">STAGE PENDING</span>
            ) : lbw.batContactBeforePad ? (
              <span className="text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-600/40">
                BAT CONTACT • NOT OUT
              </span>
            ) : (
              <span className="text-cyan-300 bg-cyan-950/70 px-2 py-0.5 rounded border border-cyan-600/40">
                PROJECTION SHOWN • MAKE YOUR CALL
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
