import React from "react";
import type { MatchContext, DifficultyTier } from "../../types/scenario";
import { Volume2, VolumeX } from "lucide-react";

type PhaseIndicator = "SOFT_SIGNAL" | "REVIEW" | "RESULT";

interface MatchLogBarProps {
  matchContext: MatchContext;
  difficultyTier: DifficultyTier;
  incidentIndex: number;
  totalIncidents: number;
  isMuted: boolean;
  isBlinded?: boolean;
  phase?: PhaseIndicator;
  onToggleMute: () => void;
}

export const MatchLogBar: React.FC<MatchLogBarProps> = ({
  matchContext,
  difficultyTier: _difficultyTier,
  incidentIndex,
  totalIncidents,
  isMuted,
  isBlinded = false,
  phase,
  onToggleMute,
}) => {
  const displaySignal = isBlinded ? "REFERRED" : matchContext.onFieldSignal;

  return (
    <header className="broadcast-scorebug px-3 py-1.5 flex items-center justify-between gap-3 select-none text-neutral-200 font-sans overflow-hidden whitespace-nowrap bg-[#121213]">
      {/* Left: TV Broadcast Identity & Case Progress */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
          <span className="text-xs font-bold tracking-wider uppercase text-neutral-200">
            3RD UMPIRE DRS
          </span>
          <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">
            LIVE
          </span>
        </div>

        <span className="text-neutral-700 select-none">•</span>

        {/* Case Progress */}
        <div className="flex items-center space-x-1.5 text-xs">
          <span className="text-neutral-400 uppercase tracking-wider text-[11px]">CASE</span>
          <span className="font-mono font-semibold text-neutral-200">
            {incidentIndex + 1}/{totalIncidents}
          </span>
        </div>

        {/* Phase Indicator */}
        {phase && (
          <>
            <span className="text-neutral-700 select-none">•</span>
            <div className="flex items-center space-x-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  phase === "SOFT_SIGNAL"
                    ? "bg-amber-400"
                    : phase === "REVIEW"
                    ? "bg-red-500"
                    : "bg-emerald-400"
                }`}
              />
              <span className="text-[11px] font-mono uppercase text-neutral-400">
                {phase === "SOFT_SIGNAL" ? "PHASE 1" : phase === "REVIEW" ? "PHASE 2" : "PHASE 3"}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Center: Clean Typographical Scorebug Strip */}
      <div className="flex items-center space-x-3 text-xs text-neutral-300">
        {/* Team Score */}
        <div className="flex items-center space-x-1.5">
          <span className="font-bold tracking-wide uppercase text-white">
            {matchContext.battingTeam}
          </span>
          <span className="text-white font-bold font-mono tabular-nums">
            {matchContext.battingTeamScore}
          </span>
          <span className="text-neutral-400 text-[11px] font-mono">
            ({matchContext.over}.{matchContext.ballInOver} ov)
          </span>
        </div>

        <span className="text-neutral-700 select-none">•</span>

        {/* Batter & Bowler Figures */}
        <div className="hidden md:flex items-center space-x-3 text-[11px]">
          <div className="flex items-center space-x-1.5">
            <span className="text-neutral-400 font-medium">BAT:</span>
            <span className="text-neutral-200 font-semibold">{matchContext.batter}</span>
            <span className="text-neutral-300 font-mono">
              {matchContext.batterScore}
            </span>
          </div>
          <span className="text-neutral-700 select-none">•</span>
          <div className="flex items-center space-x-1.5">
            <span className="text-neutral-400 font-medium">BOWL:</span>
            <span className="text-neutral-200 font-semibold">{matchContext.bowler}</span>
            <span className="text-neutral-300 font-mono">
              {matchContext.bowlerFigures}
            </span>
          </div>
        </div>

        <span className="text-neutral-700 select-none">•</span>

        {/* Original On-Field Signal */}
        <div className="flex items-center space-x-1.5">
          <span className="text-neutral-400 text-[10px] font-bold uppercase tracking-wider">ON-FIELD:</span>
          <span
            className={`font-bold px-1.5 py-0.5 rounded-sm text-[10.5px] font-mono tracking-wider border ${
              displaySignal === "OUT"
                ? "bg-red-950/60 border-red-700/60 text-red-300"
                : displaySignal === "NOT_OUT"
                ? "bg-emerald-950/60 border-emerald-700/60 text-emerald-300"
                : "bg-amber-950/60 border-amber-700/60 text-amber-300"
            }`}
          >
            {displaySignal}
          </span>
        </div>
      </div>

      {/* Right: Venue Tag & Audio Control */}
      <div className="flex items-center space-x-3">
        <div className="hidden lg:block text-right">
          <div className="text-[11px] text-neutral-400 truncate max-w-[220px]">
            {matchContext.tournament}
          </div>
        </div>

        {/* Audio Mute Button */}
        <button
          type="button"
          onClick={onToggleMute}
          className="p-1 rounded-sm bg-[#1a1a1b] hover:bg-[#27272a] text-neutral-300 border border-[#27272a] transition-colors cursor-pointer"
          title={isMuted ? "Unmute audio" : "Mute audio"}
        >
          {isMuted ? <VolumeX size={13} className="text-red-400" /> : <Volume2 size={13} className="text-neutral-300" />}
        </button>
      </div>
    </header>
  );
};
