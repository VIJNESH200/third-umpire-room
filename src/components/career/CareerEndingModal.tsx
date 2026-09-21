/**
 * src/components/career/CareerEndingModal.tsx
 *
 * Game Over / Victory modal presentations for Career Mode:
 * - CAREER COMPLETE (₹1,000,000 target achieved)
 * - CAREER TERMINATED (Caught by ACU for corruption)
 */

import React from "react";
import { Trophy, AlertOctagon, RotateCcw } from "lucide-react";
import type { CareerProfile } from "../../types/career";

interface CareerEndingModalProps {
  readonly profile: CareerProfile;
  readonly isVictory: boolean;
  readonly onRestartCareer: () => void;
  readonly onDismiss?: () => void;
}

export const CareerEndingModal: React.FC<CareerEndingModalProps> = ({
  profile,
  isVictory,
  onRestartCareer,
  onDismiss,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isVictory ? "Career Complete Victory" : "Career Terminated"}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none font-sans"
    >
      <div
        className={`max-w-md w-full rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6 border ${
          isVictory
            ? "bg-[#091515] border-emerald-500/60 shadow-emerald-950/50"
            : "bg-[#180A0A] border-red-600/70 shadow-red-950/50"
        }`}
      >
        {/* Icon Emblem */}
        <div className="flex justify-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${
              isVictory
                ? "bg-emerald-950 border-2 border-emerald-400 text-emerald-400"
                : "bg-red-950 border-2 border-red-500 text-red-500"
            }`}
          >
            {isVictory ? <Trophy size={42} /> : <AlertOctagon size={42} />}
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-2">
          <span
            className={`text-xs font-mono font-bold tracking-widest uppercase ${
              isVictory ? "text-emerald-400" : "text-red-400"
            }`}
          >
            {isVictory ? "CAREER COMPLETE" : "CAREER TERMINATED"}
          </span>

          <h2 className="text-2xl sm:text-3xl font-black font-display tracking-wide uppercase text-white">
            {isVictory ? "LEGENDARY RETIREMENT" : "LICENSE REVOKED"}
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-sm mx-auto">
            {isVictory
              ? `Congratulations! You have amassed ₹${profile.money.toLocaleString()}, surpassing the ₹1,000,000 threshold to retire at the summit of world cricket officiating.`
              : "The Anti-Corruption Unit and ICC Disciplinary Tribunal have gathered irrefutable evidence of compromised decisions. Your television umpiring credentials have been permanently revoked."}
          </p>
        </div>

        {/* Career Summary Card */}
        <div className="bg-black/50 border border-slate-800 rounded-2xl p-4 text-xs font-mono space-y-2 text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">Final Balance:</span>
            <span className="text-white font-bold">₹{profile.money.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Matches Officiated:</span>
            <span className="text-white font-bold">{profile.matchesCompleted}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Decision Accuracy:</span>
            <span className="text-cyan-400 font-bold">
              {profile.totalDecisions > 0
                ? Math.round((profile.correctDecisions / profile.totalDecisions) * 100)
                : 100}
              %
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Final Integrity Score:</span>
            <span
              className={`font-bold ${
                profile.integrityScore >= 60 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {profile.integrityScore}%
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={onRestartCareer}
            aria-label="Restart and begin a new umpire career"
            className={`w-full py-3.5 rounded-2xl font-black text-xs font-display tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-lg active:scale-95 cursor-pointer focus:outline-none focus-visible:ring-2 ${
              isVictory
                ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 focus-visible:ring-emerald-300"
                : "bg-red-600 hover:bg-red-500 text-white focus-visible:ring-red-400"
            }`}
          >
            <RotateCcw size={15} />
            <span>START NEW CAREER</span>
          </button>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss ending modal and inspect match report"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-mono transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              View Final Statistics
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
