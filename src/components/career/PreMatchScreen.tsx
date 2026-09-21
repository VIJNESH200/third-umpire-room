/**
 * src/components/career/PreMatchScreen.tsx
 *
 * Pre-Match Briefing Screen for Career Mode.
 * Presents match details, team matchup, fee, importance, player's current standings,
 * and grants access to the personal mobile phone for pre-match wagering and bribe interactions.
 */

import React from "react";
import {
  Smartphone,
  Play,
  ArrowLeft,
  MapPin,
} from "lucide-react";
import type {
  CareerProfile,
  CareerMatchAssignment,
  PreMatchBet,
  BribeOffer,
  CorruptionContract,
} from "../../types/career";

interface PreMatchScreenProps {
  readonly profile: CareerProfile;
  readonly assignment: CareerMatchAssignment;
  readonly onStartMatch: () => void;
  readonly onBackToDashboard: () => void;
  readonly onOpenPhone: () => void;
  readonly currentBet: PreMatchBet | null;
  readonly bribeOffer: BribeOffer | null;
  readonly activeContract: CorruptionContract | null;
}

export const PreMatchScreen: React.FC<PreMatchScreenProps> = ({
  profile,
  assignment,
  onStartMatch,
  onBackToDashboard,
  onOpenPhone,
  currentBet,
  bribeOffer,
  activeContract,
}) => {
  const hasUnreadBribe =
    bribeOffer && bribeOffer.status === "OFFERED" && !activeContract;

  return (
    <div className="min-h-screen w-screen bg-[#070A10] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans overflow-y-auto">
      <div className="max-w-2xl w-full bg-[#0D121B] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <button
            type="button"
            onClick={onBackToDashboard}
            aria-label="Back to career dashboard"
            className="flex items-center space-x-1.5 text-xs font-mono text-slate-400 hover:text-white transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
          >
            <ArrowLeft size={14} />
            <span>DASHBOARD</span>
          </button>

          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">
              OFFICIAL MATCH APPOINTMENT
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenPhone}
            aria-label="Open mobile device"
            className="relative p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Open Phone (Wagers & Messages)"
          >
            <Smartphone size={16} className="text-cyan-400" />
            {hasUnreadBribe && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            )}
          </button>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <span className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase font-bold">
            {assignment.leagueName}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black font-display tracking-wide uppercase text-white">
            MATCH BRIEFING
          </h1>
        </div>

        {/* Teams Matchup Showcase */}
        <div className="bg-[#070A10] border border-slate-800/90 rounded-2xl p-5 shadow-inner">
          <div className="grid grid-cols-5 items-center gap-3">
            {/* Home */}
            <div className="col-span-2 text-center space-y-2">
              <div
                className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-black font-display text-white text-xl shadow-lg border border-white/10"
                style={{ backgroundColor: assignment.homeTeam.primaryColor }}
              >
                {assignment.homeTeam.shortCode}
              </div>
              <div>
                <div className="text-xs font-mono text-slate-400 uppercase">HOME</div>
                <div className="text-sm font-bold text-white leading-tight">
                  {assignment.homeTeam.name}
                </div>
              </div>
            </div>

            {/* VS */}
            <div className="col-span-1 text-center font-display font-black text-slate-600 text-lg">
              VS
            </div>

            {/* Away */}
            <div className="col-span-2 text-center space-y-2">
              <div
                className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center font-black font-display text-white text-xl shadow-lg border border-white/10"
                style={{ backgroundColor: assignment.awayTeam.primaryColor }}
              >
                {assignment.awayTeam.shortCode}
              </div>
              <div>
                <div className="text-xs font-mono text-slate-400 uppercase">AWAY</div>
                <div className="text-sm font-bold text-white leading-tight">
                  {assignment.awayTeam.name}
                </div>
              </div>
            </div>
          </div>

          {/* Details Row */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs font-mono">
            <div className="flex items-center space-x-2 text-slate-300">
              <MapPin size={14} className="text-slate-400 shrink-0" />
              <span className="truncate">{assignment.venue}</span>
            </div>
            <div className="flex items-center justify-end space-x-2 text-slate-300">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  assignment.matchImportance === "CRITICAL"
                    ? "bg-red-950 text-red-300 border border-red-800"
                    : assignment.matchImportance === "HIGH"
                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {assignment.matchImportance} IMPORTANCE
              </span>
            </div>
          </div>
        </div>

        {/* Current Standing & Fee */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
          <div className="p-3 bg-[#070A10] rounded-xl border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase">MATCH FEE</div>
            <div className="text-sm font-black text-emerald-400 font-mono mt-0.5">
              ₹{assignment.matchFee.toLocaleString()}
            </div>
          </div>

          <div className="p-3 bg-[#070A10] rounded-xl border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase">FANS</div>
            <div className="text-sm font-bold text-cyan-400 font-mono mt-0.5">
              {profile.fanScore}%
            </div>
          </div>

          <div className="p-3 bg-[#070A10] rounded-xl border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase">CRITICS</div>
            <div className="text-sm font-bold text-amber-400 font-mono mt-0.5">
              {profile.criticScore}%
            </div>
          </div>

          <div className="p-3 bg-[#070A10] rounded-xl border border-slate-800/80">
            <div className="text-[10px] font-mono text-slate-400 uppercase">BALANCE</div>
            <div className="text-sm font-bold text-white font-mono mt-0.5">
              ₹{profile.money.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Smartphone Quick Preview Bar */}
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center space-x-3 text-left">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400 shrink-0">
              <Smartphone size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-white">PERSONAL MOBILE DEVICE</div>
              <div className="text-[11px] text-slate-400">
                {currentBet
                  ? `Active Wager: ₹${currentBet.stake.toLocaleString()} on ${currentBet.teamName}`
                  : hasUnreadBribe
                  ? "Incoming encrypted offer pending review"
                  : "Pre-match wagering & encrypted communications"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPhone}
            aria-label="Open personal mobile device"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-[#1A2234] hover:bg-[#24314A] text-slate-200 hover:text-white border border-slate-700 text-xs font-bold font-mono transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            OPEN PHONE
          </button>
        </div>

        {/* Start Match CTA */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onStartMatch}
            aria-label="Start Match and enter third umpire broadcast workstation"
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm font-display tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-xl active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <Play size={16} fill="currentColor" />
            <span>START MATCH (ENTER THIRD UMPIRE ROOM)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
