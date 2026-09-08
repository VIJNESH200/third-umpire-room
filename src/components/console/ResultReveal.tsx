import React from "react";
import type { Scenario, IncidentResult } from "../../types/scenario";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ChevronRight,
  ExternalLink,
  Info,
  BarChart2,
  AlertCircle,
} from "lucide-react";
import { sounds } from "../../engine/audioSynth";

interface ResultRevealProps {
  scenario: Scenario;
  result: IncidentResult;
  incidentIndex: number;
  totalIncidents: number;
  onNextIncident: () => void;
}

export const ResultReveal: React.FC<ResultRevealProps> = ({
  scenario,
  result,
  incidentIndex,
  totalIncidents,
  onNextIncident,
}) => {
  const isVerdictCorrect = result.finalVerdictCorrect;
  const isLastIncident = incidentIndex >= totalIncidents - 1;
  const isProtocolBreach = !isVerdictCorrect && scenario.drsEvaluation.failedGate !== undefined && scenario.drsEvaluation.failedGate !== "NONE";

  const handleNext = () => {
    sounds.playClick(900);
    onNextIncident();
  };

  const getHeadline = () => {
    if (isProtocolBreach) {
      return "Verdict Breach: Protocol Error Recorded";
    }
    if (isVerdictCorrect) {
      return "Verdict Verified: Official Decision Upheld";
    }
    return "Verdict Overruled: Protocol Gate Error";
  };

  const getSubtext = () => {
    if (isProtocolBreach || !isVerdictCorrect) {
      return "Third umpire ruling diverges from conclusive physical evidence or protocol gate requirements.";
    }
    return "Third umpire adjudication adheres to ICC playing conditions. Match record updated.";
  };

  const getOfficialLawUrl = (type: string): { url: string; lawName: string } => {
    switch (type) {
      case "STUMPING":
        return {
          url: "https://www.lords.org/mcc/the-laws/stumped",
          lawName: "MCC Law 39 — Stumped",
        };
      case "LBW":
        return {
          url: "https://www.lords.org/mcc/the-laws/leg-before-wicket",
          lawName: "MCC Law 36 — Leg Before Wicket",
        };
      case "CAUGHT_BEHIND":
        return {
          url: "https://www.lords.org/mcc/the-laws/caught",
          lawName: "MCC Law 33 — Caught",
        };
      case "RUN_OUT":
        return {
          url: "https://www.lords.org/mcc/the-laws/run-out",
          lawName: "MCC Law 38 — Run Out",
        };
      case "BOUNDARY":
        return {
          url: "https://www.lords.org/mcc/the-laws/boundaries",
          lawName: "MCC Law 19 — Boundaries",
        };
      default:
        return {
          url: "https://www.lords.org/mcc/the-laws-of-cricket",
          lawName: "MCC Laws of Cricket",
        };
    }
  };

  const lawInfo = getOfficialLawUrl(scenario.incidentType);

  return (
    <div className="w-full bg-[#0b0f17]/95 backdrop-blur-md rounded-2xl p-6 sm:p-7 select-none shadow-2xl flex flex-col gap-5 text-neutral-200 border border-[#1f2633] font-sans relative overflow-hidden">
      {/* 1. Broadcast Header & Official Verdict Status Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1f2633]">
        {/* Left: Refined Alert Badge & Editorial Typography */}
        <div className="flex items-center gap-4">
          {/* Circular Indicator */}
          {isVerdictCorrect && !isProtocolBreach ? (
            <div className="relative flex items-center justify-center w-14 h-14 rounded-full border border-emerald-500/50 bg-[#0d2218] text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.35)] shrink-0">
              <div className="absolute inset-1 rounded-full border border-emerald-500/25 pointer-events-none" />
              <CheckCircle2 size={24} className="relative z-10" />
            </div>
          ) : (
            <div className="relative flex items-center justify-center w-14 h-14 rounded-full border border-rose-500/50 bg-[#220d13] text-rose-400 shadow-[0_0_24px_rgba(244,63,94,0.35)] shrink-0">
              <div className="absolute inset-1 rounded-full border border-rose-500/25 pointer-events-none" />
              <AlertTriangle size={24} className="relative z-10" />
            </div>
          )}

          <div>
            <div className="text-[11px] font-mono font-bold tracking-[0.2em] text-[#d4af37] uppercase mb-0.5">
              DRS REVIEW
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl md:text-[26px] font-serif font-normal text-white tracking-tight">
                {getHeadline()}
              </h1>
              <span className="text-[10.5px] font-mono text-neutral-400 border border-[#232c3b] bg-[#111722] px-2.5 py-0.5 rounded-sm tracking-wider">
                CASE {incidentIndex + 1}/{totalIncidents}
              </span>
            </div>
            <p className="text-[13px] text-neutral-400 font-sans mt-0.5">
              {getSubtext()}
            </p>
          </div>
        </div>

        {/* Right: On-Field Decision vs Canonical Truth Status Tiles */}
        <div className="flex items-center gap-2.5">
          {/* On-Field Decision */}
          <div className="bg-[#111723] border border-[#20293a] px-5 py-2.5 rounded-lg text-left min-w-[135px]">
            <div className="text-[9.5px] font-bold text-neutral-400 tracking-wider uppercase font-sans">
              ON-FIELD DECISION
            </div>
            <div className="text-base sm:text-lg font-bold text-neutral-100 font-sans tracking-wide mt-0.5">
              {scenario.onFieldSignal.replace(/_/g, " ")}
            </div>
          </div>

          {/* Canonical Truth */}
          <div
            className={`border px-5 py-2.5 rounded-lg min-w-[155px] flex items-center justify-between ${
              scenario.correctFinalVerdict === "OUT"
                ? "bg-[#1c1014] border-rose-500/50"
                : "bg-[#0b1b16] border-emerald-500/50"
            }`}
          >
            <div>
              <div className="text-[9.5px] font-bold text-neutral-400 tracking-wider uppercase font-sans">
                CANONICAL TRUTH
              </div>
              <div
                className={`text-base sm:text-lg font-bold tracking-wide mt-0.5 ${
                  scenario.correctFinalVerdict === "OUT" ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {scenario.correctFinalVerdict.replace(/_/g, " ")}
              </div>
            </div>
            <div className="ml-3 shrink-0">
              {scenario.correctFinalVerdict === "OUT" ? (
                <XCircle size={20} className="text-rose-400" />
              ) : (
                <CheckCircle2 size={20} className="text-emerald-400" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Workstation Body: 2-Column Balanced Editorial Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0">
        {/* Left Column: Evidence Gates & Official DRS Protocol (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between gap-4">
          {/* A. Evidence Gates Section */}
          <div className="space-y-2">
            {/* Section Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="w-1 h-3.5 bg-rose-500 rounded-full mr-2 shrink-0" />
                <span className="text-xs font-bold text-neutral-200 tracking-wider uppercase font-sans">
                  {scenario.incidentType === "LBW"
                    ? "HAWK-EYE 3D BALL TRACKING GATES"
                    : scenario.incidentType === "CAUGHT_BEHIND"
                    ? "ULTRAEDGE ACOUSTIC & OPTICAL EVIDENCE"
                    : scenario.incidentType === "BOUNDARY"
                    ? "BOUNDARY CUSHION TELEMETRY & CONTACT GATES"
                    : "CREASE TIMING & BAIL DISLODGEMENT GATES"}
                </span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                {scenario.incidentType === "LBW"
                  ? "SYNCHRONIZED CAM 01 & CAM 03"
                  : scenario.incidentType === "CAUGHT_BEHIND"
                  ? "SYNCHRONIZED SLIP CAM & STUMP MIC"
                  : scenario.incidentType === "BOUNDARY"
                  ? "CAM 05 ULTRA-HD MACRO"
                  : "500 FPS HIGH-SPEED SENSOR"}
              </span>
            </div>

            {/* 3 Evidence Gate Cards */}
            {scenario.incidentType === "LBW" && scenario.lbw ? (
              <div className="grid grid-cols-3 gap-2.5">
                {/* Gate 1: Pitching */}
                <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                  <div className="min-w-0 pr-2">
                    <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                      01 PITCHING
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap flex items-center">
                      {scenario.lbw.pitchingZone === "OUTSIDE_LEG" ? (
                        <>
                          <span>OUTSIDE</span>
                          <span className="ml-1.5">LEG</span>
                        </>
                      ) : scenario.lbw.pitchingZone === "OUTSIDE_OFF" ? (
                        <>
                          <span>OUTSIDE</span>
                          <span className="ml-1.5">OFF</span>
                        </>
                      ) : (
                        <>
                          <span>IN</span>
                          <span className="ml-1.5">LINE</span>
                        </>
                      )}
                    </div>
                    <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                  </div>
                  {/* Schematic Isometric Pitch Map */}
                  <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 56 44" fill="none">
                    <rect width="56" height="44" fill="#0c111a" />
                    <polygon points="16,6 40,6 52,40 4,40" fill="#141f2e" stroke="#1f2f45" strokeWidth="0.8" />
                    <line x1="28" y1="6" x2="28" y2="40" stroke="#223348" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
                    <line x1="22" y1="6" x2="16" y2="40" stroke="#223348" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
                    <line x1="34" y1="6" x2="40" y2="40" stroke="#223348" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
                    <line x1="8" y1="30" x2="48" y2="30" stroke="#ffffff" strokeWidth="1" opacity="0.85" />
                    <line
                      x1="28"
                      y1="6"
                      x2={scenario.lbw.pitchingZone === "OUTSIDE_OFF" ? 42 : scenario.lbw.pitchingZone === "IN_LINE" ? 28 : 14}
                      y2={28}
                      stroke="#38bdf8"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                    <circle
                      cx={scenario.lbw.pitchingZone === "OUTSIDE_OFF" ? 42 : scenario.lbw.pitchingZone === "IN_LINE" ? 28 : 14}
                      cy={28}
                      r={3.5}
                      fill="#ffffff"
                      stroke="#38bdf8"
                      strokeWidth="1.2"
                    />
                  </svg>
                </div>

                {/* Gate 2: Impact */}
                <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                  <div className="min-w-0 pr-2">
                    <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                      02 IMPACT
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                      {scenario.lbw.impactZone === "IN_LINE" ? (
                        <span>IN&nbsp;LINE</span>
                      ) : scenario.lbw.impactZone === "OUTSIDE_LINE_PLAYING_SHOT" ? (
                        <span>OUTSIDE&nbsp;(SHOT)</span>
                      ) : (
                        <span>OUTSIDE&nbsp;(NO SHOT)</span>
                      )}
                    </div>
                    <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                  </div>
                  {/* Schematic Isometric Impact Map */}
                  <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 56 44" fill="none">
                    <rect width="56" height="44" fill="#0c111a" />
                    <polygon points="16,6 40,6 52,40 4,40" fill="#141f2e" stroke="#1f2f45" strokeWidth="0.8" />
                    <line x1="8" y1="30" x2="48" y2="30" stroke="#223348" strokeWidth="0.8" strokeDasharray="1.5,1.5" />
                    <line
                      x1={scenario.lbw.pitchingZone === "OUTSIDE_OFF" ? 42 : scenario.lbw.pitchingZone === "IN_LINE" ? 28 : 14}
                      y1={38}
                      x2={scenario.lbw.impactZone === "IN_LINE" ? 28 : scenario.lbw.impactZone === "OUTSIDE_LINE_PLAYING_SHOT" ? 40 : 16}
                      y2={12}
                      stroke="#38bdf8"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                    <circle
                      cx={scenario.lbw.impactZone === "IN_LINE" ? 28 : scenario.lbw.impactZone === "OUTSIDE_LINE_PLAYING_SHOT" ? 40 : 16}
                      cy={22}
                      r={3.5}
                      fill="#ef4444"
                      stroke="#fca5a5"
                      strokeWidth="1.2"
                    />
                  </svg>
                </div>

                {/* Gate 3: Wickets */}
                <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                  <div className="min-w-0 pr-2">
                    <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                      03 WICKETS
                    </div>
                    <div
                      className={`text-xs sm:text-sm font-bold uppercase tracking-wide mt-0.5 whitespace-nowrap ${
                        scenario.lbw.projectedStumpHit === "CLEARLY_HITTING"
                          ? "text-rose-400"
                          : scenario.lbw.projectedStumpHit === "UMPIRES_CALL"
                          ? "text-[#eab308]"
                          : "text-emerald-400"
                      }`}
                    >
                      {scenario.lbw.projectedStumpHit === "CLEARLY_HITTING" ? (
                        <span>HITTING</span>
                      ) : scenario.lbw.projectedStumpHit === "UMPIRES_CALL" ? (
                        <span>UMPIRE'S&nbsp;CALL</span>
                      ) : (
                        <span>MISSING</span>
                      )}
                    </div>
                    <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                  </div>
                  {/* Schematic 3D Stumps Projection */}
                  <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 56 44" fill="none">
                    <rect width="56" height="44" fill="#0c111a" />
                    <polygon points="8,40 48,40 44,32 12,32" fill="#182434" />
                    <rect x="21" y="14" width="2.5" height="24" rx="0.5" fill="#eab308" />
                    <rect x="26.75" y="14" width="2.5" height="24" rx="0.5" fill="#eab308" />
                    <rect x="32.5" y="14" width="2.5" height="24" rx="0.5" fill="#eab308" />
                    <rect x="20" y="12" width="7" height="2" rx="0.5" fill="#facc15" />
                    <rect x="29" y="12" width="7" height="2" rx="0.5" fill="#facc15" />
                    <line x1="2" y1="24" x2="54" y2="24" stroke="#f59e0b" strokeWidth="1" strokeDasharray="1.5,1.5" />
                    <circle
                      cx={
                        scenario.lbw.projectedStumpHit === "CLEARLY_HITTING"
                          ? 28
                          : scenario.lbw.projectedStumpHit === "UMPIRES_CALL"
                          ? 34.5
                          : 11
                      }
                      cy={24}
                      r={3.5}
                      fill={
                        scenario.lbw.projectedStumpHit === "CLEARLY_HITTING"
                          ? "#ef4444"
                          : scenario.lbw.projectedStumpHit === "UMPIRES_CALL"
                          ? "#f59e0b"
                          : "#22c55e"
                      }
                      stroke="#ffffff"
                      strokeWidth="0.8"
                    />
                  </svg>
                </div>
              </div>
              ) : scenario.incidentType === "CAUGHT_BEHIND" && scenario.caughtBehind ? (
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Gate 1: Acoustic */}
                  <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                    <div className="min-w-0 pr-2">
                      <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                        01 ACOUSTIC TRACE
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                        {scenario.caughtBehind.hasEdge ? "SPIKE DETECTED" : "QUIET BASELINE"}
                      </div>
                      <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                    </div>
                    <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                      <rect width="48" height="40" rx="2" fill="#0c111a" />
                      {scenario.caughtBehind.hasEdge ? (
                        <path d="M 4,20 L 16,20 L 20,18 L 24,6 L 28,34 L 32,20 L 44,20" stroke="#f43f5e" strokeWidth="1.5" />
                      ) : (
                        <line x1="4" y1="20" x2="44" y2="20" stroke="#38bdf8" strokeWidth="1.2" strokeDasharray="2,2" />
                      )}
                    </svg>
                  </div>

                  {/* Gate 2: Optical */}
                  <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                    <div className="min-w-0 pr-2">
                      <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                        02 OPTICAL CORRIDOR
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                        {scenario.caughtBehind.hasEdge ? "BAT CONTACT" : "DAYLIGHT CLEAR"}
                      </div>
                      <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                    </div>
                    <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                      <rect width="48" height="40" rx="2" fill="#0c111a" />
                      <rect x="20" y="8" width="6" height="24" rx="1" fill="#d97706" transform="rotate(-15 20 8)" />
                      <circle cx={scenario.caughtBehind.hasEdge ? 17 : 11} cy={20} r={3} fill="#ef4444" />
                    </svg>
                  </div>

                  {/* Gate 3: Catch */}
                  <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                    <div className="min-w-0 pr-2">
                      <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                        03 CATCH ARRIVAL
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                        {scenario.correctFinalVerdict === "OUT" ? "CLEAN CATCH" : "INCONCLUSIVE"}
                      </div>
                      <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                    </div>
                    <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                      <rect width="48" height="40" rx="2" fill="#0c111a" />
                      <path d="M 16,14 Q 24,10 32,14 L 30,28 Q 24,32 18,28 Z" fill="#22c55e" opacity="0.6" />
                      <circle cx="24" cy="20" r="3" fill="#ef4444" />
                    </svg>
                  </div>
                </div>
              ) : scenario.incidentType === "BOUNDARY" && scenario.boundary ? (
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Gate 1: Release */}
                  <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                    <div className="min-w-0 pr-2">
                      <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                        01 AIRBORNE RELEASE
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                        {scenario.boundary.archetype === "AIRBORNE_RELAY" ? "AIRBORNE RELAY" : "GROUND BOUND"}
                      </div>
                      <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                    </div>
                    <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                      <rect width="48" height="40" rx="2" fill="#0c111a" />
                      <path d="M 6,32 Q 24,10 42,24" stroke="#facc15" strokeWidth="1.5" fill="none" />
                      <circle cx="30" cy="18" r="3" fill="#ef4444" />
                    </svg>
                  </div>

                  {/* Gate 2: Lead Boot Margin */}
                  <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                    <div className="min-w-0 pr-2">
                      <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                        02 CUSHION MARGIN
                      </div>
                      <div
                        className={`text-xs sm:text-sm font-bold uppercase tracking-wide mt-0.5 whitespace-nowrap ${
                          scenario.boundary.marginMm < 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {scenario.boundary.marginMm < 0
                          ? `${scenario.boundary.marginMm}mm (DAYLIGHT)`
                          : `+${scenario.boundary.marginMm}mm (CONTACT)`}
                      </div>
                      <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                    </div>
                    <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                      <rect width="48" height="40" rx="2" fill="#0c111a" />
                      <polygon points="34,6 46,6 46,34 34,34" fill="#ea580c" />
                      <line x1="34" y1="6" x2="34" y2="34" stroke="#ffffff" strokeWidth="1.5" />
                      <rect x="18" y="24" width="12" height="5" rx="1" fill="#38bdf8" />
                    </svg>
                  </div>

                  {/* Gate 3: Completion */}
                  <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                    <div className="min-w-0 pr-2">
                      <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                        03 DISPOSAL
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                        {!scenario.boundary.isBoundary ? "CLEAN CATCH" : "FOUR CONCEDED"}
                      </div>
                      <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                    </div>
                    <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                      <rect width="48" height="40" rx="2" fill="#0c111a" />
                      <circle cx="24" cy="20" r="4" fill="#22c55e" />
                      <line x1="16" y1="32" x2="32" y2="32" stroke="#22c55e" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
              ) : (
                // Run Out & Stumping
                scenario.runOut && (
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Gate 1: Bat Grounding */}
                    <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                      <div className="min-w-0 pr-2">
                        <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                          01 BAT GROUNDING
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                          {result.playerBatGroundedMs !== null && result.playerBatGroundedMs !== undefined
                            ? `${Math.round(result.playerBatGroundedMs)}ms`
                            : `${scenario.runOut.groundedFrameMs}ms`}
                        </div>
                        <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                      </div>
                      <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                        <rect width="48" height="40" rx="2" fill="#0c111a" />
                        <line x1="24" y1="4" x2="24" y2="36" stroke="#ffffff" strokeWidth="1.5" />
                        <polygon points="12,24 28,24 26,20 10,20" fill="#d97706" />
                      </svg>
                    </div>

                    {/* Gate 2: Bails Dislodged */}
                    <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                      <div className="min-w-0 pr-2">
                        <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                          02 BAILS DISLODGED
                        </div>
                        <div className="text-xs sm:text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5 whitespace-nowrap">
                          {scenario.runOut.bailsDislodgedFrameMs}ms
                        </div>
                        <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                      </div>
                      <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                        <rect width="48" height="40" rx="2" fill="#0c111a" />
                        <rect x="30" y="16" width="3" height="20" fill="#fbbf24" />
                        <rect x="24" y="10" width="8" height="2.5" rx="0.5" fill="#f59e0b" transform="rotate(-30 24 10)" />
                      </svg>
                    </div>

                    {/* Gate 3: Margin */}
                    <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3 flex items-center justify-between min-h-[72px]">
                      <div className="min-w-0 pr-2">
                        <div className="text-[9.5px] font-mono font-bold text-[#d4af37] uppercase tracking-wider">
                          03 PHYSICAL MARGIN
                        </div>
                        <div
                          className={`text-xs sm:text-sm font-bold uppercase tracking-wide mt-0.5 whitespace-nowrap ${
                            scenario.runOut.creaseMarginMm > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {scenario.runOut.creaseMarginMm > 0
                            ? `+${scenario.runOut.creaseMarginMm}mm (SAFE)`
                            : `${scenario.runOut.creaseMarginMm}mm (SHORT)`}
                        </div>
                        <div className="w-6 h-[1.5px] bg-neutral-600/70 mt-1" />
                      </div>
                      <svg className="w-14 h-11 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 48 40" fill="none">
                        <rect width="48" height="40" rx="2" fill="#0c111a" />
                        <line x1="20" y1="4" x2="20" y2="36" stroke="#ffffff" strokeWidth="1.5" />
                        <line x1="28" y1="4" x2="28" y2="36" stroke="#38bdf8" strokeWidth="1" strokeDasharray="1,1" />
                      </svg>
                    </div>
                  </div>
                )
              )}
          </div>

          {/* B. ICC DRS Protocol Citation & Governing Law Card */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <BookOpen size={14} className="text-[#d4af37]" />
              <span className="text-xs font-bold text-neutral-200 tracking-wider uppercase font-sans">
                ICC DRS PROTOCOL CITATION & GOVERNING LAW
              </span>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed font-sans">
              {scenario.drsEvaluation.explanation}
            </p>

            {/* Official Clause Box — Navigational to Official MCC Laws */}
            <a
              href={lawInfo.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`Read ${lawInfo.lawName} on lords.org`}
              className="bg-[#111722] border border-[#20293a] hover:border-[#c5a059]/60 hover:bg-[#151e2d] transition-all rounded-lg p-3 flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-[#161f2e] border border-[#253347] group-hover:border-[#c5a059]/50 flex items-center justify-center text-[#d4af37] shrink-0 transition-colors">
                  <BookOpen size={15} />
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-neutral-200 group-hover:text-white flex items-center gap-1.5 transition-colors">
                    <span>{scenario.drsEvaluation.ruleCitation}</span>
                    <ExternalLink size={11} className="text-[#d4af37] opacity-70 group-hover:opacity-100" />
                  </div>
                  <div className="text-[11px] text-neutral-400 font-sans mt-0.5">
                    {scenario.drsEvaluation.isUmpiresCall
                      ? `Umpire's Call Upheld (Original Decision ${scenario.onFieldSignal.replace(/_/g, " ")} stands)`
                      : "Conclusive Evidence Standard Applied"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10.5px] font-mono text-neutral-400 group-hover:text-[#d4af37] transition-colors">
                <span className="hidden sm:inline">OFFICIAL MCC LAW</span>
                <ChevronRight size={16} className="text-neutral-500 group-hover:text-[#d4af37] group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </a>

            {/* Commentary / Legal Quote */}
            <p className="text-xs text-neutral-400 italic font-serif leading-relaxed pt-0.5 pl-1">
              “{scenario.crowdReaction.commentary.replace(/^["“]+|["”]+$/g, "")}”
            </p>
          </div>
        </div>

        {/* Right Column: Decision Performance Review & Next Incident Action (5 cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4">
          {/* Decision Performance Review Card */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart2 size={14} className="text-rose-500" />
                <span className="text-xs font-bold text-neutral-200 tracking-wider uppercase font-sans">
                  DECISION PERFORMANCE REVIEW
                </span>
              </div>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                EVALUATION MATRIX
              </span>
            </div>

            <div className="bg-[#111722] border border-[#20293a] rounded-lg p-3.5 space-y-3">
              {/* Row 1: Instinct Signal */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] font-bold text-neutral-400 tracking-wider uppercase font-sans">
                    1. INSTINCT SIGNAL (PHASE 1)
                  </div>
                  <div className="text-sm font-bold text-neutral-100 uppercase tracking-wide mt-0.5">
                    {result.softSignal ? result.softSignal.replace(/_/g, " ") : "NOT GIVEN"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {result.softSignalCorrect ? (
                    <>
                      <span className="border border-emerald-500/40 bg-emerald-950/40 text-emerald-400 text-xs font-mono font-medium px-2.5 py-0.5 rounded flex items-center gap-1.5">
                        MATCHED (+{result.softSignalTimeMs ? `${(result.softSignalTimeMs / 1000).toFixed(1)}s` : "4.0ms"})
                      </span>
                      <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    </>
                  ) : result.softSignal === "SEND_UPSTAIRS" ? (
                    <>
                      <span className="border border-amber-500/40 bg-amber-950/40 text-amber-300 text-xs font-mono font-medium px-2.5 py-0.5 rounded">
                        REFERRED
                      </span>
                      <AlertCircle size={16} className="text-amber-400 shrink-0" />
                    </>
                  ) : (
                    <>
                      <span className="border border-rose-500/40 bg-rose-950/40 text-rose-400 text-xs font-mono font-medium px-2.5 py-0.5 rounded">
                        INCORRECT
                      </span>
                      <XCircle size={16} className="text-rose-400 shrink-0" />
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-[#1e2738]" />

              {/* Row 2: Final Verdict */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] font-bold text-neutral-400 tracking-wider uppercase font-sans">
                    2. FINAL VERDICT (PHASE 2)
                  </div>
                  <div
                    className={`text-sm font-bold uppercase tracking-wide mt-0.5 ${
                      result.finalVerdictCorrect ? "text-neutral-100" : "text-rose-400"
                    }`}
                  >
                    {result.finalVerdict.replace(/_/g, " ")}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`border text-xs font-bold tracking-wider px-2.5 py-0.5 rounded ${
                      result.finalVerdictCorrect
                        ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                        : "border-rose-500/40 bg-rose-950/40 text-rose-400"
                    }`}
                  >
                    {result.finalVerdictCorrect ? "CORRECT" : "INCORRECT"}
                  </span>
                  {result.finalVerdictCorrect ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-rose-400 shrink-0" />
                  )}
                </div>
              </div>

              <div className="border-t border-[#1e2738]" />

              {/* Row 3: DRS Protocol IQ */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[9.5px] font-bold text-neutral-400 tracking-wider uppercase font-sans">
                    3. DRS PROTOCOL IQ
                  </div>
                  <div className="text-sm font-bold uppercase tracking-wide mt-0.5">
                    {result.umpiresCallComplied ? (
                      <span className="text-emerald-400">COMPLIED</span>
                    ) : (
                      <span className="text-rose-400">PROTOCOL BREACH</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-sans">
                  <span>{scenario.drsEvaluation.isUmpiresCall ? "Umpire's Call Enforced" : "Conclusive Evidence"}</span>
                  <Info size={14} className="text-neutral-400 shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Next Adjudication Command Deck */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-neutral-400 uppercase tracking-wider font-sans">
                NEXT ADJUDICATION
              </span>
              <span className="font-mono text-neutral-500">
                {isLastIncident ? "SERIES FINALE" : `REMAINING: ${totalIncidents - incidentIndex - 1}`}
              </span>
            </div>

            {/* Primary Action Button (Warm Gold / Champagne Broadcast Finish) */}
            <button
              type="button"
              onClick={handleNext}
              className="w-full py-3.5 px-6 rounded-lg font-bold text-xs sm:text-sm tracking-[0.15em] uppercase flex items-center justify-center gap-2.5 cursor-pointer transition-all shadow-[0_4px_20px_rgba(216,183,108,0.25)] active:scale-[0.99] bg-gradient-to-r from-[#d8b76c] via-[#ecd599] to-[#c9a456] text-[#121214] hover:brightness-105 border border-[#ecd599]/60"
            >
              <ArrowRight size={18} className="text-[#121214] stroke-[2.5]" />
              <span>{isLastIncident ? "GENERATE FINAL DRS PERFORMANCE RATING" : "NEXT INCIDENT"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
