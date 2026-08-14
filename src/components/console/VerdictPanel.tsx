import React, { useState } from "react";
import type {
  DecisionVerdict,
  OnFieldSignal,
  DRSRuleEvaluation,
} from "../../types/scenario";
import { Send, AlertTriangle, ShieldCheck, Scale, Award, Lock } from "lucide-react";
import { sounds } from "../../engine/audioSynth";

interface VerdictPanelProps {
  incidentType: string;
  onFieldSignal: OnFieldSignal;
  drsEvaluation: DRSRuleEvaluation;
  onVerdictSubmit: (verdict: DecisionVerdict, dismissalReason: string) => void;
}

export const VerdictPanel: React.FC<VerdictPanelProps> = ({
  incidentType,
  onFieldSignal,
  drsEvaluation,
  onVerdictSubmit,
}) => {
  const [selectedVerdict, setSelectedVerdict] = useState<DecisionVerdict | null>(null);
  const [dismissalReason, setDismissalReason] = useState<string>("STANDARD");

  const handleSelectVerdict = (verdict: DecisionVerdict) => {
    setSelectedVerdict(verdict);
    sounds.playClick(verdict === "OUT" ? 650 : 850);
  };

  const handleTransmit = () => {
    if (!selectedVerdict) return;
    sounds.playVerdictReveal(true);
    onVerdictSubmit(selectedVerdict, dismissalReason);
  };

  const isUmpiresCall = incidentType === "LBW" && drsEvaluation.isUmpiresCall;

  return (
    <div className="hardware-panel rounded-xl p-3.5 font-mono select-none text-slate-200 space-y-3 shadow-xl">
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-2 border-b border-console-800">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full tally-lamp-amber" />
          <span className="text-xs font-bold tracking-wider text-amber-300 font-display">
            TV UMPIRE VERDICT TRANSMITTER
          </span>
        </div>
        <span className="text-[10px] bg-console-950 text-slate-400 px-2 py-0.5 rounded border border-console-800">
          OFFICIAL ICC DRS PROTOCOL
        </span>
      </div>

      {/* On-Field Standard of Proof Box */}
      <div className="bg-console-950 p-2.5 rounded-lg border border-console-800 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-[11px]">ORIGINAL ON-FIELD CALL:</span>
          <span
            className={`font-black px-2 py-0.5 rounded text-xs border ${
              onFieldSignal === "OUT"
                ? "bg-rose-950/90 border-rose-500 text-rose-300"
                : onFieldSignal === "NOT_OUT"
                ? "bg-emerald-950/90 border-emerald-500 text-emerald-300"
                : "bg-amber-950/90 border-amber-500 text-amber-300"
            }`}
          >
            {onFieldSignal}
          </span>
        </div>

        {/* DRS Law Standard of Proof Guidance */}
        <div className="text-[11px] text-slate-300 flex items-start gap-1.5 pt-1 border-t border-console-850">
          <Scale size={13} className="text-cyan-400 shrink-0 mt-0.5" />
          <span>
            {onFieldSignal === "OUT"
              ? "Overturn requires conclusive evidence of Missing Stumps, Pitching Outside Leg, or Edge."
              : onFieldSignal === "NOT_OUT"
              ? "Overturn requires conclusive evidence of Clearly Hitting (all 4 gates passed)."
              : "Direct referral: Base verdict purely on visual slow-motion evidence."}
          </span>
        </div>

        {isUmpiresCall && (
          <div className="bg-amber-950/40 border border-amber-500/40 p-2 rounded text-[11px] text-amber-300 flex items-center gap-1.5 animate-pulse">
            <Award size={13} className="text-amber-400 shrink-0" />
            <span><b>DRS LAW 3.4:</b> 'Umpire's Call' requires upholding the on-field decision ({onFieldSignal}).</span>
          </div>
        )}
      </div>

      {/* Primary Verdict Selection Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        {/* OUT */}
        <button
          onClick={() => handleSelectVerdict("OUT")}
          className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 shadow-lg active:scale-95 ${
            selectedVerdict === "OUT"
              ? "bg-rose-900 border-rose-400 text-white ring-2 ring-rose-500/50 shadow-rose-600/30"
              : "bg-rose-950/40 hover:bg-rose-900/60 border-rose-800/60 text-rose-200 hover:border-rose-500/60"
          }`}
        >
          <span className="text-base font-black tracking-widest font-display">OUT</span>
          <span className="text-[10px] text-rose-300/80">
            {onFieldSignal === "OUT" ? "Confirm On-Field" : "Overturn to OUT"}
          </span>
        </button>

        {/* NOT OUT */}
        <button
          onClick={() => handleSelectVerdict("NOT_OUT")}
          className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-1 shadow-lg active:scale-95 ${
            selectedVerdict === "NOT_OUT"
              ? "bg-emerald-900 border-emerald-400 text-white ring-2 ring-emerald-500/50 shadow-emerald-600/30"
              : "bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/60 text-emerald-200 hover:border-emerald-500/60"
          }`}
        >
          <span className="text-base font-black tracking-widest font-display">NOT OUT</span>
          <span className="text-[10px] text-emerald-300/80">
            {onFieldSignal === "NOT_OUT" ? "Confirm On-Field" : "Overturn to NOT OUT"}
          </span>
        </button>
      </div>

      {/* Final Transmission Trigger */}
      <button
        disabled={!selectedVerdict}
        onClick={handleTransmit}
        className={`w-full py-3 rounded-xl font-black text-xs tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-xl font-display ${
          selectedVerdict
            ? "bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 shadow-cyan-500/25 active:scale-98 cursor-pointer"
            : "bg-console-950 text-slate-600 border border-console-800 cursor-not-allowed opacity-60"
        }`}
      >
        <Send size={13} />
        <span>TRANSMIT VERDICT TO ON-FIELD SCREEN</span>
      </button>
    </div>
  );
};
