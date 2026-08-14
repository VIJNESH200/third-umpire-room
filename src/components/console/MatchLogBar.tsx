import React from "react";
import type { MatchContext, DifficultyTier } from "../../types/scenario";
import { Volume2, VolumeX } from "lucide-react";

interface MatchLogBarProps {
  matchContext: MatchContext;
  difficultyTier: DifficultyTier;
  incidentIndex: number;
  totalIncidents: number;
  isMuted: boolean;
  isBlinded?: boolean;
  onToggleMute: () => void;
}

export const MatchLogBar: React.FC<MatchLogBarProps> = ({
  matchContext,
  difficultyTier,
  incidentIndex,
  totalIncidents,
  isMuted,
  isBlinded = false,
  onToggleMute,
}) => {
  const displaySignal = isBlinded ? "REFERRED" : matchContext.onFieldSignal;

  return (
    <header className="bg-console-900 border-b border-console-750 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none font-mono">
      {/* Left: Broadcast Brand & Incident Counter */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1.5 bg-console-950 px-2.5 py-1 rounded border border-console-800">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-black tracking-wider text-slate-100 font-display">
            3RD UMPIRE ROOM
          </span>
          <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-500/30">
            DRS CONSOLE
          </span>
        </div>

        {/* Incident Shift Counter */}
        <div className="flex items-center space-x-1 text-xs text-slate-300">
          <span className="text-slate-500 text-[11px]">INCIDENT:</span>
          <span className="font-bold text-cyan-400 bg-console-850 px-2 py-0.5 rounded border border-console-750">
            {incidentIndex + 1} / {totalIncidents}
          </span>
        </div>

        {/* Difficulty Badge */}
        <div className="hidden sm:flex items-center">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
              difficultyTier === "CLEAR"
                ? "bg-emerald-950/50 text-emerald-400 border-emerald-600/40"
                : difficultyTier === "MARGINAL"
                ? "bg-amber-950/50 text-amber-400 border-amber-600/40"
                : "bg-rose-950/50 text-rose-400 border-rose-600/40 animate-pulse"
            }`}
          >
            {difficultyTier} TIER
          </span>
        </div>
      </div>

      {/* Center: Live Match Context Scorecard */}
      <div className="flex items-center space-x-3 text-xs bg-console-950/80 px-3 py-1 rounded border border-console-800">
        <div className="flex items-center space-x-2">
          <span className="font-bold text-slate-200">{matchContext.battingTeam}</span>
          <span className="text-cyan-400 font-black text-sm">{matchContext.battingTeamScore}</span>
          <span className="text-slate-400 text-[11px]">({matchContext.over}.{matchContext.ballInOver} ov)</span>
        </div>

        <span className="text-slate-600">|</span>

        {/* Batter & Bowler */}
        <div className="hidden md:flex items-center space-x-3 text-[11px]">
          <div>
            <span className="text-slate-500">BAT: </span>
            <span className="text-slate-200 font-medium">{matchContext.batter}</span>
            <span className="text-cyan-400 font-bold ml-1">[{matchContext.batterScore}]</span>
          </div>
          <div>
            <span className="text-slate-500">BOWL: </span>
            <span className="text-slate-200 font-medium">{matchContext.bowler}</span>
            <span className="text-amber-400 font-bold ml-1">[{matchContext.bowlerFigures}]</span>
          </div>
        </div>

        <span className="text-slate-600">|</span>

        {/* On-Field Signal */}
        <div className="flex items-center space-x-1.5">
          <span className="text-slate-500 text-[10px]">ON-FIELD:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
              displaySignal === "OUT"
                ? "bg-rose-950/80 border-rose-500/80 text-rose-300"
                : displaySignal === "NOT_OUT"
                ? "bg-emerald-950/80 border-emerald-500/80 text-emerald-300"
                : "bg-amber-950/80 border-amber-500/80 text-amber-300"
            }`}
          >
            {displaySignal}
          </span>
        </div>
      </div>

      {/* Right: Audio Control & Tournament Tag */}
      <div className="flex items-center space-x-2">
        <div className="hidden lg:block text-right">
          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
            {matchContext.tournament}
          </div>
        </div>

        {/* Mute SFX button */}
        <button
          onClick={onToggleMute}
          className="p-1.5 rounded bg-console-850 hover:bg-console-750 text-slate-300 border border-console-750 transition-colors"
          title={isMuted ? "Unmute sound effects" : "Mute sound effects"}
        >
          {isMuted ? <VolumeX size={14} className="text-rose-400" /> : <Volume2 size={14} className="text-emerald-400" />}
        </button>
      </div>
    </header>
  );
};
