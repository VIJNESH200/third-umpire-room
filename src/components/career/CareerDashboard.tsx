/**
 * src/components/career/CareerDashboard.tsx
 *
 * Primary career hub and overview panel for League Umpire Career Mode.
 * Displays financial progression towards ₹1,000,000, reputation meters,
 * career tier status, statistics, and next match assignment.
 */

import React from "react";
import {
  Users,
  Award,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Smartphone,
  ChevronRight,
  Briefcase,
  Home,
} from "lucide-react";
import type {
  CareerProfile,
  CareerMatchAssignment,
  PreMatchBet,
  BribeOffer,
  CorruptionContract,
} from "../../types/career";
import { CAREER_CONSTANTS, getTierInfo } from "../../engine/career/careerConstants";

interface CareerDashboardProps {
  readonly profile: CareerProfile;
  readonly nextAssignment: CareerMatchAssignment;
  readonly onProceedToPreMatch: () => void;
  readonly onOpenPhone: () => void;
  readonly onResetCareer: () => void;
  readonly onExitToMainMenu: () => void;
  readonly currentBet: PreMatchBet | null;
  readonly bribeOffer: BribeOffer | null;
  readonly activeContract: CorruptionContract | null;
}

export const CareerDashboard: React.FC<CareerDashboardProps> = ({
  profile,
  nextAssignment,
  onProceedToPreMatch,
  onOpenPhone,
  onResetCareer,
  onExitToMainMenu,
  currentBet: _currentBet,
  bribeOffer,
  activeContract,
}) => {
  const tierInfo = getTierInfo(profile.careerTier);
  const winPercent = Math.min(
    100,
    Math.round((profile.money / CAREER_CONSTANTS.TARGET_WIN_BALANCE) * 100)
  );

  const accuracyPercent =
    profile.totalDecisions > 0
      ? Math.round((profile.correctDecisions / profile.totalDecisions) * 100)
      : 100;

  const hasUnreadBribe =
    bribeOffer && bribeOffer.status === "OFFERED" && !activeContract;

  return (
    <div className="min-h-screen w-screen bg-[#070A10] text-slate-100 flex flex-col p-4 sm:p-6 select-none font-sans overflow-y-auto">
      {/* Top Bar */}
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-cyan-400">
            <Briefcase size={20} />
          </div>
          <div>
            <div className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
              PROFESSIONAL UMPIRE CAREER
            </div>
            <h1 className="text-xl sm:text-2xl font-black font-display tracking-wide uppercase text-white">
              LEAGUE COMMAND CENTER
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Mobile Phone launcher */}
          <button
            type="button"
            onClick={onOpenPhone}
            aria-label="Open mobile phone communication hub"
            className="relative px-3.5 py-2 rounded-xl bg-[#141B28] hover:bg-[#1E283C] text-slate-200 border border-slate-700/80 font-bold text-xs flex items-center space-x-2 transition-all cursor-pointer shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <Smartphone size={15} className="text-cyan-400" />
            <span className="hidden sm:inline font-mono">PHONE</span>
            {hasUnreadBribe && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            )}
          </button>

          {/* Main Menu exit */}
          <button
            type="button"
            onClick={onExitToMainMenu}
            aria-label="Return to Main Menu"
            className="p-2 rounded-xl bg-[#141B28] hover:bg-[#1E283C] text-slate-400 hover:text-white border border-slate-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            title="Return to Main Menu"
          >
            <Home size={18} />
          </button>
        </div>
      </div>

      <div className="max-w-5xl w-full mx-auto space-y-6">
        {/* Row 1: Financial Goal & Tier Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Main Balance Card */}
          <div className="md:col-span-2 bg-[#0D121B] border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                  CAREER LIQUID BALANCE
                </span>
                <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight mt-1">
                  ₹{profile.money.toLocaleString()}
                  <span className="text-xs text-slate-400 font-sans ml-2 font-normal">
                    / ₹{CAREER_CONSTANTS.TARGET_WIN_BALANCE.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold">
                {winPercent}% TO TARGET
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 space-y-1.5">
              <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${winPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>₹0</span>
                <span>₹500,000</span>
                <span>₹1,000,000 (VICTORY)</span>
              </div>
            </div>
          </div>

          {/* Tier Status Card */}
          <div className="bg-[#0D121B] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                OFFICIATING TIER
              </span>
              <div className="text-xl font-black text-amber-400 font-display uppercase tracking-wide mt-1">
                TIER {tierInfo.level}: {tierInfo.shortName}
              </div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {tierInfo.description}
              </p>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-300">
              <span>Base Fee:</span>
              <span className="font-bold text-amber-300">
                ₹{tierInfo.baseMatchFee.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Row 2: Four Core Meters */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* FANS */}
          <div className="bg-[#0D121B] border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center space-x-1.5 text-slate-300">
                <Users size={14} className="text-cyan-400" />
                <span>FANS</span>
              </span>
              <span className="font-mono font-bold text-cyan-400">{profile.fanScore}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-cyan-400 h-full rounded-full transition-all"
                style={{ width: `${profile.fanScore}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400">Momentum & popularity</div>
          </div>

          {/* CRITICS */}
          <div className="bg-[#0D121B] border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center space-x-1.5 text-slate-300">
                <Award size={14} className="text-amber-400" />
                <span>CRITICS</span>
              </span>
              <span className="font-mono font-bold text-amber-400">{profile.criticScore}%</span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-400 h-full rounded-full transition-all"
                style={{ width: `${profile.criticScore}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400">Technical scrutiny</div>
          </div>

          {/* INTEGRITY */}
          <div className="bg-[#0D121B] border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center space-x-1.5 text-slate-300">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>INTEGRITY</span>
              </span>
              <span
                className={`font-mono font-bold ${
                  profile.integrityScore >= 70 ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {profile.integrityScore}%
              </span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all"
                style={{ width: `${profile.integrityScore}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400">Trust & ACU standing</div>
          </div>

          {/* INVESTIGATION RISK */}
          <div className="bg-[#0D121B] border border-slate-800 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center space-x-1.5 text-slate-300">
                <AlertTriangle size={14} className="text-red-400" />
                <span>ACU RISK</span>
              </span>
              <span
                className={`font-mono font-bold ${
                  profile.investigationRisk > 40 ? "text-red-400" : "text-slate-300"
                }`}
              >
                {profile.investigationRisk}%
              </span>
            </div>
            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
              <div
                className="bg-red-500 h-full rounded-full transition-all"
                style={{ width: `${profile.investigationRisk}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400">Surveillance probability</div>
          </div>
        </div>

        {/* Row 3: Next Match Assignment Card */}
        <div className="bg-[#0D121B] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                NEXT FIXTURE ASSIGNMENT • MATCH #{nextAssignment.matchNumber}
              </span>
              <div className="text-lg font-bold text-white font-display">
                {nextAssignment.leagueName}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span
                className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-bold ${
                  nextAssignment.matchImportance === "CRITICAL"
                    ? "bg-red-950 text-red-300 border border-red-800"
                    : nextAssignment.matchImportance === "HIGH"
                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                    : "bg-slate-800 text-slate-300"
                }`}
              >
                {nextAssignment.matchImportance} IMPORTANCE
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                FEE: ₹{nextAssignment.matchFee.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Teams Matchup Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-4 py-2">
            {/* Home Team */}
            <div className="sm:col-span-2 p-4 rounded-xl bg-[#070A10] border border-slate-800 flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black font-display text-white text-base shadow"
                style={{ backgroundColor: nextAssignment.homeTeam.primaryColor }}
              >
                {nextAssignment.homeTeam.shortCode}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs text-slate-400 font-mono">HOME</div>
                <div className="text-sm font-bold text-white truncate">
                  {nextAssignment.homeTeam.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {nextAssignment.homeTeam.city}
                </div>
              </div>
            </div>

            {/* VS Divider */}
            <div className="text-center font-display font-black text-slate-600 text-lg sm:text-xl">
              VS
            </div>

            {/* Away Team */}
            <div className="sm:col-span-2 p-4 rounded-xl bg-[#070A10] border border-slate-800 flex items-center space-x-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black font-display text-white text-base shadow"
                style={{ backgroundColor: nextAssignment.awayTeam.primaryColor }}
              >
                {nextAssignment.awayTeam.shortCode}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs text-slate-400 font-mono">AWAY</div>
                <div className="text-sm font-bold text-white truncate">
                  {nextAssignment.awayTeam.name}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {nextAssignment.awayTeam.city}
                </div>
              </div>
            </div>
          </div>

          {/* Venue & Incidents Metadata */}
          <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80 gap-2 font-mono">
            <div>
              Venue: <span className="text-slate-200">{nextAssignment.venue}</span>
            </div>
            <div>
              Target Incidents:{" "}
              <span className="text-slate-200">{nextAssignment.incidentCount} Reviews</span>
            </div>
          </div>

          {/* Action CTA */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onProceedToPreMatch}
              className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs font-display tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <span>PROCEED TO PRE-MATCH BRIEFING</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Footer: Career Stats & Reset option */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-800/60 font-mono">
          <div className="flex items-center space-x-4">
            <span>Matches: {profile.matchesCompleted}</span>
            <span>Total Decisions: {profile.totalDecisions}</span>
            <span>Accuracy: {accuracyPercent}%</span>
          </div>

          <button
            type="button"
            onClick={onResetCareer}
            aria-label="Reset Career Progress"
            className="flex items-center space-x-1.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-red-400"
          >
            <RotateCcw size={12} />
            <span>Reset Career Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
