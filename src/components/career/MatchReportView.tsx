/**
 * src/components/career/MatchReportView.tsx
 *
 * Post-match report screen for Career Mode.
 * Consolidated breakdown of match results, player decision accuracy,
 * reputation deltas, financial outcomes (fee, bonus, bets, bribes, fines),
 * ACU investigation findings, and new career balance.
 */

import React from "react";
import {
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import type { CareerMatchReport } from "../../types/career";
import { CAREER_CONSTANTS } from "../../engine/career/careerConstants";

interface MatchReportViewProps {
  readonly report: CareerMatchReport;
  readonly onContinue: () => void;
}

export const MatchReportView: React.FC<MatchReportViewProps> = ({
  report,
  onContinue,
}) => {
  return (
    <div className="min-h-screen w-screen bg-[#070A10] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans overflow-y-auto">
      <div className="max-w-2xl w-full bg-[#0D121B] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
        {/* Header */}
        <div className="text-center space-y-1 border-b border-slate-800 pb-4">
          <div className="flex items-center justify-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold">
              OFFICIAL MATCH CONCLUDED
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-display tracking-wide uppercase text-white">
            MATCH REPORT
          </h1>
        </div>

        {/* Match Result Scorecard */}
        <div className="bg-[#070A10] border border-slate-800 rounded-2xl p-4 text-center space-y-2 shadow-inner">
          <div className="flex justify-between items-center text-sm font-bold text-white px-3">
            <span>{report.homeTeam.name}</span>
            <span className="font-mono text-slate-300">{report.finalScoreHome}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold text-white px-3">
            <span>{report.awayTeam.name}</span>
            <span className="font-mono text-slate-300">{report.finalScoreAway}</span>
          </div>
          <div className="pt-2 border-t border-slate-800/80 text-xs font-mono text-emerald-400 font-bold">
            Winner: {report.winnerTeamName}
          </div>
        </div>

        {/* Umpire Performance Card */}
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold flex items-center justify-between">
            <span>OFFICIATING ACCURACY</span>
            <span className="text-amber-400 font-display">
              RATING: {report.matchRating.toFixed(1)} / 10.0
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-[#070A10] border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">DECISIONS</div>
              <div className="text-base font-black text-white font-mono mt-0.5">
                {report.totalIncidents}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#070A10] border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">CORRECT</div>
              <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                {report.correctDecisions}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#070A10] border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">ACCURACY</div>
              <div className="text-base font-black text-cyan-400 font-mono mt-0.5">
                {report.accuracyPercent}%
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#070A10] border border-slate-800">
              <div className="text-[10px] text-slate-400 font-mono">REPUTATION</div>
              <div className="text-xs font-mono font-bold mt-1 flex justify-center space-x-2">
                <span className={report.fanDelta >= 0 ? "text-cyan-400" : "text-red-400"}>
                  F:{report.fanDelta > 0 ? `+${report.fanDelta}` : report.fanDelta}
                </span>
                <span className={report.criticDelta >= 0 ? "text-amber-400" : "text-red-400"}>
                  C:{report.criticDelta > 0 ? `+${report.criticDelta}` : report.criticDelta}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="bg-[#121826] border border-slate-800 rounded-2xl p-4 space-y-2 text-xs font-mono">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-bold mb-2">
            FINANCIAL AUDIT
          </div>

          <div className="flex justify-between text-slate-300">
            <span>Match Fee:</span>
            <span className="text-emerald-400 font-bold">
              +₹{report.matchFee.toLocaleString()}
            </span>
          </div>

          {report.performanceBonus > 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Performance Accuracy Bonus:</span>
              <span className="text-emerald-400 font-bold">
                +₹{report.performanceBonus.toLocaleString()}
              </span>
            </div>
          )}

          {report.bettingNet !== 0 && (
            <div className="flex justify-between text-slate-300">
              <span>Pre-Match Betting Payout:</span>
              <span
                className={`font-bold ${
                  report.bettingNet > 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {report.bettingNet > 0 ? "+" : ""}₹{report.bettingNet.toLocaleString()}
              </span>
            </div>
          )}

          {report.bribeNet > 0 && (
            <div className="flex justify-between text-purple-300">
              <span>Illicit Syndicate Payout:</span>
              <span className="font-bold text-purple-400">
                +₹{report.bribeNet.toLocaleString()}
              </span>
            </div>
          )}

          {report.penaltyAmount > 0 && (
            <div className="flex justify-between text-red-300">
              <span>Disciplinary ACU Fine:</span>
              <span className="font-bold text-red-400">
                -₹{report.penaltyAmount.toLocaleString()}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm">
            <span className="text-white">Net Earnings:</span>
            <span
              className={
                report.totalEarningsNet >= 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {report.totalEarningsNet >= 0 ? "+" : ""}₹
              {report.totalEarningsNet.toLocaleString()}
            </span>
          </div>

          <div className="flex justify-between text-slate-400 pt-1">
            <span>New Balance:</span>
            <span className="text-white font-bold font-mono">
              ₹{report.newBalance.toLocaleString()}{" "}
              <span className="text-[10px] text-slate-500 font-normal">
                / ₹{CAREER_CONSTANTS.TARGET_WIN_BALANCE.toLocaleString()}
              </span>
            </span>
          </div>
        </div>

        {/* ACU & Integrity Audit Outcome */}
        {report.investigationOutcome !== "NONE" && (
          <div
            className={`p-3.5 rounded-2xl border text-xs space-y-1 font-mono ${
              report.careerTerminated
                ? "bg-red-950/70 border-red-500 text-red-200"
                : report.investigationOutcome === "FINED"
                ? "bg-amber-950/50 border-amber-600 text-amber-200"
                : "bg-slate-900 border-slate-700 text-slate-300"
            }`}
          >
            <div className="flex items-center space-x-1.5 font-bold uppercase">
              <ShieldAlert size={14} />
              <span>ACU INVESTIGATION OUTCOME: {report.investigationOutcome}</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {report.investigationDescription}
            </p>
          </div>
        )}

        {/* Continue Button */}
        <button
          type="button"
          onClick={onContinue}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-sm font-display tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-xl active:scale-95 cursor-pointer"
        >
          <span>CONTINUE TO DASHBOARD</span>
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};
