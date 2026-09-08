import React, { useState } from "react";
import type {
  DecisionVerdict,
  OnFieldSignal,
} from "../../types/scenario";
import { Send, AlertTriangle } from "lucide-react";
import { sounds } from "../../engine/audioSynth";

/** Task 7 — LBW evidence review checklist. Transmission (normal mode) is
 *  gated until the player has genuinely inspected each forensic feed. The
 *  flags are set by real review actions in ConsoleLayout: transport use on
 *  CAM 01 while the replay feed is active, and walking the Hawk-Eye stage
 *  sequence through to the Stage 5 wickets projection — stage 1 alone never
 *  completes ball-track review. Never bare clicks. */
export interface ReviewChecklist {
  replay: boolean; // CAM 01 — transport interaction while the replay feed is active
  trackStage: number; // CAM 03 — furthest Hawk-Eye stage revealed in order (0..5)
}

const TRACK_REVIEW_COMPLETE_STAGE = 5;

interface VerdictPanelProps {
  incidentType: string;
  onFieldSignal: OnFieldSignal;
  playerBatGroundedMs?: number | null;
  playerBailsDislodgedMs?: number | null;
  onVerdictSubmit: (
    verdict: DecisionVerdict,
    dismissalReason: string,
    playerTimings?: { playerBatGroundedMs: number | null; playerBailsDislodgedMs: number | null }
  ) => void;
  trainingMode?: boolean;
  /** Provided for LBW incidents; gates transmission in normal mode. */
  reviewChecklist?: ReviewChecklist;
}

export const VerdictPanel: React.FC<VerdictPanelProps> = ({
  incidentType,
  onFieldSignal,
  playerBatGroundedMs = null,
  playerBailsDislodgedMs = null,
  onVerdictSubmit,
  trainingMode = false,
  reviewChecklist,
}) => {
  const [selectedVerdict, setSelectedVerdict] = useState<DecisionVerdict | null>(null);
  const dismissalReason = "STANDARD";

  const isRunOutOrStumping = incidentType === "RUN_OUT" || incidentType === "STUMPING";
  const areMarkersPlaced = !isRunOutOrStumping || (playerBatGroundedMs !== null && playerBailsDislodgedMs !== null);
  const evidenceReviewComplete =
    trainingMode || reviewChecklist === undefined
      ? true
      : reviewChecklist.replay &&
        reviewChecklist.trackStage >= TRACK_REVIEW_COMPLETE_STAGE;
  const canTransmit = selectedVerdict !== null && areMarkersPlaced && evidenceReviewComplete;

  const handleSelectVerdict = (verdict: DecisionVerdict) => {
    setSelectedVerdict(verdict);
    sounds.playClick(verdict === "OUT" ? 650 : 850);
  };

  const handleTransmit = () => {
    if (!canTransmit || !selectedVerdict) return;
    sounds.playVerdictReveal(true);
    onVerdictSubmit(selectedVerdict, dismissalReason, {
      playerBatGroundedMs,
      playerBailsDislodgedMs,
    });
  };

  return (
    <div className="space-y-1.5 select-none text-neutral-200 font-sans">
      {/* Header Banner with Inline On-Field Call */}
      <div className="flex items-center justify-between pb-1 border-b border-[#27272a]">
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 bg-amber-500 shrink-0" />
          <span className="text-xs font-bold tracking-wider text-neutral-200 uppercase">
            DECISION STATION
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-neutral-400 font-semibold uppercase">ON-FIELD:</span>
          <span
            className={`font-bold px-1.5 py-0.5 rounded-sm text-[10px] font-mono tracking-wider border ${
              onFieldSignal === "OUT"
                ? "bg-red-950/60 border-red-700/60 text-red-300"
                : onFieldSignal === "NOT_OUT"
                ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                : "bg-amber-950/60 border-amber-700/60 text-amber-300"
            }`}
          >
            {onFieldSignal}
          </span>
        </div>
      </div>

      {/* LBW Evidence Review States — Gated progression checklist */}
      {reviewChecklist && !trainingMode && (
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { key: "replay", label: "REPLAY", done: reviewChecklist.replay, progress: "" },
              {
                key: "track",
                label: "BALL TRACKING",
                done: reviewChecklist.trackStage >= TRACK_REVIEW_COMPLETE_STAGE,
                progress:
                  reviewChecklist.trackStage > 0 && reviewChecklist.trackStage < TRACK_REVIEW_COMPLETE_STAGE
                    ? ` (${reviewChecklist.trackStage}/${TRACK_REVIEW_COMPLETE_STAGE})`
                    : "",
              },
            ] as const
          ).map((chip) => (
            <div
              key={chip.key}
              className={`px-2 py-1 rounded-sm text-[10px] sm:text-[10.5px] font-semibold text-center border transition-all ${
                chip.done
                  ? "bg-emerald-950/40 border-emerald-600/50 text-emerald-300"
                  : "bg-[#161618] border-[#27272a] text-neutral-400"
              }`}
            >
              {chip.done ? "✓ " : "○ "}
              {chip.label}
              {!chip.done && chip.progress && (
                <span className="font-normal opacity-80">{chip.progress}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Primary Verdict Selection Buttons (Wordle-inspired rectangular tiles) */}
      <div className="grid grid-cols-2 gap-1.5">
        {/* OUT Button */}
        <button
          type="button"
          onClick={() => handleSelectVerdict("OUT")}
          className={`py-2 px-3 rounded-sm border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-98 ${
            selectedVerdict === "OUT"
              ? "bg-[#b53b3b] border-red-500 text-white font-bold"
              : "bg-[#1a1a1b] hover:bg-[#242426] border-[#27272a] hover:border-neutral-500 text-neutral-200"
          }`}
        >
          <span className="text-sm sm:text-base font-bold tracking-widest uppercase">OUT</span>
          <span className={`text-[10px] sm:text-[10.5px] leading-none ${selectedVerdict === "OUT" ? "text-white/80" : "text-neutral-400"}`}>
            {onFieldSignal === "OUT" ? "Confirm On-Field" : "Overturn to OUT"}
          </span>
        </button>

        {/* NOT OUT Button */}
        <button
          type="button"
          onClick={() => handleSelectVerdict("NOT_OUT")}
          className={`py-2 px-3 rounded-sm border transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-98 ${
            selectedVerdict === "NOT_OUT"
              ? "bg-[#538d4e] border-emerald-500 text-white font-bold"
              : "bg-[#1a1a1b] hover:bg-[#242426] border-[#27272a] hover:border-neutral-500 text-neutral-200"
          }`}
        >
          <span className="text-sm sm:text-base font-bold tracking-widest uppercase">NOT OUT</span>
          <span className={`text-[10px] sm:text-[10.5px] leading-none ${selectedVerdict === "NOT_OUT" ? "text-white/80" : "text-neutral-400"}`}>
            {onFieldSignal === "NOT_OUT" ? "Confirm On-Field" : "Overturn to NOT OUT"}
          </span>
        </button>
      </div>

      {/* Forensic Marker Placement Warning for Run-Out / Stumping */}
      {isRunOutOrStumping && !areMarkersPlaced && (
        <div className="bg-[#1a1a1b] border border-amber-600/40 px-2 py-1 rounded-sm text-[10px] text-amber-300 flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-400 shrink-0" />
          <span>
            <b>TIMING REQUIRED:</b> Mark bat & bails.
          </span>
        </div>
      )}

      {/* Final Transmission Trigger */}
      <button
        type="button"
        disabled={!canTransmit}
        onClick={handleTransmit}
        className={`w-full py-2 rounded-sm font-bold text-xs sm:text-[12.5px] tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 ${
          canTransmit
            ? "bg-white hover:bg-neutral-200 text-black cursor-pointer active:scale-98"
            : "bg-[#1a1a1b] text-neutral-600 border border-[#27272a] cursor-not-allowed opacity-60"
        }`}
      >
        <Send size={12} />
        <span>TRANSMIT DECISION</span>
      </button>
    </div>
  );
};
