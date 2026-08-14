import React from "react";
import type { Scenario, IncidentResult } from "../../types/scenario";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Radio,
  Award,
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
  const isLastIncident = incidentIndex + 1 >= totalIncidents;

  const handleNext = () => {
    sounds.playClick(900);
    onNextIncident();
  };

  return (
    <div className="hardware-panel rounded-xl p-5 font-mono select-none shadow-2xl flex flex-col gap-4 animate-fadeIn text-slate-200">
      {/* Top Banner Verdict Status */}
      <div className="flex items-center justify-between pb-3 border-b border-console-800">
        <div className="flex items-center space-x-2.5">
          {isVerdictCorrect ? (
            <span className="flex items-center space-x-2 text-emerald-400 font-black text-base font-display">
              <CheckCircle2 size={20} className="text-emerald-400" />
              <span>VERDICT VERIFIED: OFFICIAL DECISION UPHELD</span>
            </span>
          ) : (
            <span className="flex items-center space-x-2 text-rose-400 font-black text-base font-display">
              <XCircle size={20} className="text-rose-400" />
              <span>VERDICT BREACH: PROTOCOL ERROR</span>
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-xs text-slate-400">CORRECT GROUND TRUTH:</span>
          <span
            className={`font-black px-3 py-1 rounded text-xs border ${
              scenario.correctFinalVerdict === "OUT"
                ? "bg-rose-950/90 border-rose-500 text-rose-300"
                : "bg-emerald-950/90 border-emerald-500 text-emerald-300"
            }`}
          >
            {scenario.correctFinalVerdict}
          </span>
        </div>
      </div>

      {/* Decision Summary Comparison Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Soft Signal */}
        <div className="bg-console-950 p-3.5 rounded-lg border border-console-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 font-bold">1. INSTINCT SOFT SIGNAL</div>
          <div className="text-base font-black text-slate-200 my-1 font-display">
            {result.softSignal || "NONE"}
          </div>
          <div className="text-[11px]">
            {result.softSignalCorrect ? (
              <span className="text-emerald-400 font-bold">Matched Outcome (+Speed Bonus)</span>
            ) : result.softSignal === "SEND_UPSTAIRS" ? (
              <span className="text-amber-400">Referred (Neutral)</span>
            ) : (
              <span className="text-rose-400">Incorrect Gut Instinct</span>
            )}
          </div>
        </div>

        {/* Your Final Verdict */}
        <div className="bg-console-950 p-3.5 rounded-lg border border-console-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 font-bold">2. YOUR FINAL VERDICT</div>
          <div className={`text-base font-black my-1 font-display ${result.finalVerdictCorrect ? "text-emerald-400" : "text-rose-400"}`}>
            {result.finalVerdict}
          </div>
          <div className="text-[11px] text-slate-400">
            {scenario.onFieldSignal !== "REFERRED" && scenario.onFieldSignal !== result.finalVerdict
              ? "Overturned On-Field"
              : "Confirmed On-Field"}
          </div>
        </div>

        {/* Umpire's Call Compliance */}
        <div className="bg-console-950 p-3.5 rounded-lg border border-console-800 flex flex-col justify-between">
          <div className="text-[10px] text-slate-400 font-bold">3. UMPIRE'S CALL & DRS IQ</div>
          <div className="text-base font-bold my-1">
            {result.umpiresCallComplied ? (
              <span className="text-cyan-400">Complied with Protocol</span>
            ) : (
              <span className="text-rose-400">DRS Protocol Error</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate">
            {scenario.drsEvaluation.isUmpiresCall ? "Umpire's Call Enforced" : "Conclusive Evidence"}
          </div>
        </div>
      </div>

      {/* Official DRS Rule Explanation */}
      <div className="bg-cyan-950/20 border border-cyan-500/30 p-3.5 rounded-lg text-xs space-y-1.5">
        <div className="flex items-center space-x-1.5 text-cyan-300 font-bold text-[11px]">
          <Award size={13} className="text-cyan-400" />
          <span>OFFICIAL ICC DRS EVALUATION & CITATION:</span>
        </div>
        <p className="text-slate-300 text-xs leading-relaxed">
          {scenario.drsEvaluation.explanation}
        </p>
        <div className="text-[10px] text-cyan-400/80 font-mono">
          Citation: {scenario.drsEvaluation.ruleCitation}
        </div>
      </div>

      {/* Broadcast Radio Comms & Stadium Flavor */}
      <div className="bg-console-950 p-3 rounded-lg border border-console-800 space-y-2 text-xs">
        <div className="flex items-center space-x-1.5 text-slate-400 text-[10px]">
          <Radio size={12} className="text-rose-400 animate-pulse" />
          <span className="font-bold text-slate-300">BROADCAST RADIO COMMS</span>
        </div>
        <div className="text-slate-300 italic text-[11px] bg-console-900/60 p-2.5 rounded border border-console-850">
          “{scenario.crowdReaction.commentary}”
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
          <span>{scenario.crowdReaction.battingFanReaction}</span>
        </div>
      </div>

      {/* Next Button */}
      <div className="flex justify-end pt-1">
        <button
          onClick={handleNext}
          className="flex items-center space-x-2 px-6 py-3 rounded-xl font-black text-xs bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 shadow-xl shadow-cyan-500/25 transition-all active:scale-95 font-display"
        >
          <span>{isLastIncident ? "GENERATE SESSION STAT CARD" : "NEXT INCIDENT APPEAL"}</span>
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
};
