import React, { useRef, useEffect } from "react";
import { SessionStats } from "../../types/scenario";
import { getRankInfo } from "../../engine/scoring";
import { exportCardAsPng } from "./cardExport";
import confetti from "canvas-confetti";
import {
  Download,
  RotateCcw,
  Shield,
  Trophy,
  Award,
} from "lucide-react";
import { sounds } from "../../engine/audioSynth";

interface ResultCardProps {
  stats: SessionStats;
  onRestart: () => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ stats, onRestart }) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const rankInfo = getRankInfo(stats.overallRating);

  useEffect(() => {
    // Trigger celebratory confetti if high rating
    if (stats.overallRating >= 60) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#E5A93B", "#00E5FF", "#00E676", "#A855F7"],
      });
    }
  }, [stats.overallRating]);

  const handleDownload = () => {
    if (cardRef.current) {
      sounds.playClick(950);
      exportCardAsPng(
        cardRef.current,
        `third-umpire-card-${stats.overallRating}OVR.png`
      );
    }
  };

  const handlePlayAgain = () => {
    sounds.playClick(800);
    onRestart();
  };

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen bg-[#070A10] font-sans select-none animate-fadeIn text-slate-100">
      {/* Top Session Accomplishment Header */}
      <div className="text-center mb-5 space-y-1">
        <div className="flex items-center justify-center space-x-2 text-slate-400 text-xs font-black uppercase tracking-widest font-display">
          <Trophy size={15} className="text-amber-400" />
          <span>SESSION COMPLETE • OFFICIAL DRS RATING CARD</span>
        </div>
        <h1 className="text-3xl font-black text-white font-display tracking-wide uppercase">
          UMPIRE PERFORMANCE ASSESSMENT
        </h1>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          Your shift across {stats.totalIncidents} review incidents has been evaluated under official ICC DRS protocols.
        </p>
      </div>

      {/* The FIFA Ultimate Team Style Card */}
      <div
        ref={cardRef}
        className="relative w-80 sm:w-96 rounded-2xl p-5 border-2 shadow-2xl overflow-hidden transition-all duration-300 transform hover:scale-[1.01]"
        style={{
          background:
            stats.overallRating >= 89
              ? "linear-gradient(135deg, #101c2e 0%, #1e1136 50%, #0d1e2e 100%)"
              : stats.overallRating >= 76
              ? "linear-gradient(135deg, #18152e 0%, #261642 50%, #13122b 100%)"
              : stats.overallRating >= 61
              ? "linear-gradient(135deg, #2b1f09 0%, #3d2c0b 50%, #1c1505 100%)"
              : "linear-gradient(135deg, #1c2430 0%, #131822 100%)",
          borderColor: rankInfo.badgeColor,
          boxShadow: `0 0 35px ${rankInfo.badgeColor}33`,
        }}
      >
        {/* Card Holographic / Metallic Top Ribbon */}
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
          <div className="flex items-center space-x-2">
            <Shield size={18} style={{ color: rankInfo.badgeColor }} />
            <span className="text-xs font-black tracking-widest uppercase text-slate-200 font-display">
              ICC DRS REVIEW ROOM
            </span>
          </div>
          <span
            className="text-[10px] font-black px-2 py-0.5 rounded uppercase font-display tracking-wider"
            style={{
              backgroundColor: `${rankInfo.badgeColor}22`,
              color: rankInfo.badgeColor,
              border: `1px solid ${rankInfo.badgeColor}55`,
            }}
          >
            {rankInfo.cardTheme.toUpperCase()}
          </span>
        </div>

        {/* Card Header: Rating, Position, Avatar */}
        <div className="flex items-center justify-between py-4">
          <div className="flex flex-col items-center">
            {/* OVR Number */}
            <span
              className="text-6xl font-black font-display leading-none tracking-tighter"
              style={{ color: rankInfo.badgeColor }}
            >
              {stats.overallRating}
            </span>
            <span className="text-xs font-black text-slate-300 tracking-widest mt-1 font-display">
              OVR
            </span>
            <span className="text-[10px] text-slate-400 font-extrabold font-mono">3RD</span>
          </div>

          {/* Center Graphic Badge / Silhouette */}
          <div className="relative flex flex-col items-center justify-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center border-2 shadow-inner"
              style={{
                borderColor: rankInfo.badgeColor,
                background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.4) 100%)",
              }}
            >
              <Award size={36} style={{ color: rankInfo.badgeColor }} />
            </div>
          </div>
        </div>

        {/* Rank Tier Banner */}
        <div
          className="text-center py-1.5 px-3 rounded-lg my-1 font-black text-xs sm:text-sm uppercase tracking-wider font-display border shadow-sm"
          style={{
            backgroundColor: `${rankInfo.badgeColor}20`,
            borderColor: `${rankInfo.badgeColor}60`,
            color: rankInfo.badgeColor,
          }}
        >
          {stats.rankTier}
        </div>

        {/* 6 Key Stats Grid (FUT Hex Pattern) */}
        <div className="grid grid-cols-2 gap-2 my-4 pt-2 border-t border-slate-700/60 text-xs">
          {/* SSI: Soft Signal Instinct */}
          <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono">
            <span className="text-slate-400 font-bold font-sans">SSI</span>
            <span className="font-black text-white">{stats.softSignalInstinct}%</span>
          </div>

          {/* RVP: Review Precision */}
          <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono">
            <span className="text-slate-400 font-bold font-sans">RVP</span>
            <span className="font-black text-emerald-400">{stats.reviewPrecision}%</span>
          </div>

          {/* UCI: Umpire's Call IQ */}
          <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono">
            <span className="text-slate-400 font-bold font-sans">UCI</span>
            <span className="font-black text-emerald-400">{stats.umpiresCallIQ}%</span>
          </div>

          {/* RXN: Reaction Time */}
          <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono">
            <span className="text-slate-400 font-bold font-sans">RXN</span>
            <span className="font-black text-amber-400">{stats.reactionTimeSeconds}s</span>
          </div>

          {/* CST: Consistency */}
          <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono">
            <span className="text-slate-400 font-bold font-sans">CST</span>
            <span className="font-black text-white">{stats.consistency}%</span>
          </div>

          {/* HWL: Howler Detection */}
          <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded border border-white/5 font-mono">
            <span className="text-slate-400 font-bold font-sans">HWL</span>
            <span className="font-black text-red-400">{stats.howlerDetection}%</span>
          </div>
        </div>

        {/* Card Footer Metadata */}
        <div className="flex items-center justify-between text-[9px] text-slate-400 pt-2 border-t border-slate-700/60 font-mono">
          <span>{today} • {stats.totalIncidents} INCIDENTS</span>
          <span className="text-slate-300 font-bold">THIRD UMPIRE ROOM</span>
        </div>
      </div>

      {/* Action Buttons Below Card */}
      <div className="flex items-center space-x-3 mt-6">
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-white text-slate-950 font-black text-xs shadow-md transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer"
        >
          <Download size={14} />
          <span>EXPORT STAT CARD (PNG)</span>
        </button>

        <button
          type="button"
          onClick={handlePlayAgain}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-lg bg-[#141B28] hover:bg-[#1E283C] text-slate-200 border border-[#243147] font-black text-xs transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer"
        >
          <RotateCcw size={14} />
          <span>NEW REVIEW SHIFT</span>
        </button>
      </div>

      {/* Detailed Stat Legend */}
      <div className="mt-8 max-w-lg w-full bg-[#0D121B] border border-[#1E293B] rounded-lg p-3.5 text-[11px] text-slate-400 space-y-1">
        <div className="font-black text-slate-300 text-xs border-b border-[#1E293B] pb-1 mb-1 font-display tracking-wider uppercase">
          METRIC DEFINITIONS:
        </div>
        <div>• <b>SSI (Soft Signal Instinct):</b> Gut decision accuracy before unlocking slow-motion telemetry.</div>
        <div>• <b>RVP (Review Precision):</b> % of correct final decisions across all DRS incidents.</div>
        <div>• <b>UCI (Umpire's Call IQ):</b> Compliance with ICC Umpire's Call & Overturn rule constraints.</div>
        <div>• <b>RXN (Reaction Speed):</b> Normalized instinct response time during soft signal phase.</div>
        <div>• <b>HWL (Howler Detection):</b> Courage and accuracy in overturning egregious on-field errors.</div>
      </div>
    </div>
  );
};
