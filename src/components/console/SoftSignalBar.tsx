import React, { useState, useEffect, useRef, useCallback } from "react";
import { Clock, Hand, HelpCircle } from "lucide-react";
import { sounds } from "../../engine/audioSynth";

interface SoftSignalBarProps {
  timeLimitSeconds?: number;
  onDecision: (choice: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS", elapsedMs: number) => void;
}

export const SoftSignalBar: React.FC<SoftSignalBarProps> = ({
  timeLimitSeconds = 10,
  onDecision,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(timeLimitSeconds);
  const [submitted, setSubmitted] = useState<boolean>(false);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  const stableOnDecision = useCallback(onDecision, []);

  useEffect(() => {
    startTimeRef.current = Date.now();
    setTimeLeft(timeLimitSeconds);
    setSubmitted(false);

    timerRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        const remaining = Math.max(0, timeLimitSeconds - elapsed);

        // Sound cues for countdown
        if (remaining <= 3.0 && remaining > 0) {
          sounds.playCountdownTick(true);
        } else if (remaining <= 6.0 && remaining > 0 && Math.floor(remaining) !== Math.floor(prev)) {
          sounds.playCountdownTick(false);
        }

        if (remaining <= 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          stableOnDecision("SEND_UPSTAIRS", timeLimitSeconds * 1000);
          return 0;
        }
        return remaining;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLimitSeconds, stableOnDecision]);

  const handleChoice = (choice: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS") => {
    if (submitted) return; // Prevent double submission
    setSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const elapsedMs = Math.min(timeLimitSeconds * 1000, Date.now() - startTimeRef.current);
    sounds.playClick(choice === "OUT" ? 700 : choice === "NOT_OUT" ? 900 : 800);
    onDecision(choice, elapsedMs);
  };

  const progressPercent = (timeLeft / timeLimitSeconds) * 100;
  const isUrgent = timeLeft <= 3.5;
  const isCritical = timeLeft <= 1.5;

  return (
    <div className="select-none font-mono">
      {/* Countdown Timer Bar — prominent arc-style progress */}
      <div className="relative bg-slate-950/90 border border-slate-800 rounded-xl p-4 backdrop-blur-sm">
        {/* Timer Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Clock
              size={16}
              className={
                isCritical
                  ? "text-rose-400 animate-spin"
                  : isUrgent
                  ? "text-amber-400 animate-pulse"
                  : "text-slate-400"
              }
            />
            <span className="text-[11px] font-bold text-slate-300 tracking-wider">
              INITIAL REVIEW WINDOW
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`text-2xl font-black tabular-nums tracking-tighter ${
                isCritical
                  ? "text-rose-400"
                  : isUrgent
                  ? "text-amber-300"
                  : "text-slate-100"
              }`}
            >
              {timeLeft.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-500 font-bold">SEC</span>
          </div>
        </div>

        {/* Clean Progress Bar */}
        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
          <div
            className={`h-full rounded-full transition-all duration-100 ${
              isCritical
                ? "bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
                : isUrgent
                ? "bg-amber-400"
                : "bg-emerald-400"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Instinct Prompt */}
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
          Make your call from the initial broadcast evidence. Forensic review tools will unlock after your signal.
        </p>

        {/* 3 Decision Buttons — Umpire Signal Style */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {/* OUT */}
          <button
            onClick={() => handleChoice("OUT")}
            disabled={submitted}
            className={`group relative overflow-hidden py-4 rounded-lg border-2 transition-all font-bold flex flex-col items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isUrgent
                ? "border-rose-500/80 bg-rose-950/60 hover:bg-rose-900/80 shadow-lg shadow-rose-500/10"
                : "border-rose-600/40 bg-rose-950/30 hover:bg-rose-950/60 hover:border-rose-500/60"
            }`}
          >
            <Hand size={22} className="text-rose-400 rotate-180" />
            <span className="text-lg font-black tracking-wider text-rose-300">
              OUT
            </span>
            <span className="text-[9px] text-rose-400/70 font-normal">
              Finger raised
            </span>
          </button>

          {/* NOT OUT */}
          <button
            onClick={() => handleChoice("NOT_OUT")}
            disabled={submitted}
            className={`group relative overflow-hidden py-4 rounded-lg border-2 transition-all font-bold flex flex-col items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
              isUrgent
                ? "border-emerald-500/80 bg-emerald-950/60 hover:bg-emerald-900/80 shadow-lg shadow-emerald-500/10"
                : "border-emerald-600/40 bg-emerald-950/30 hover:bg-emerald-950/60 hover:border-emerald-500/60"
            }`}
          >
            <Hand size={22} className="text-emerald-400" />
            <span className="text-lg font-black tracking-wider text-emerald-300">
              NOT OUT
            </span>
            <span className="text-[9px] text-emerald-400/70 font-normal">
              Safe signal
            </span>
          </button>

          {/* SEND UPSTAIRS */}
          <button
            onClick={() => handleChoice("SEND_UPSTAIRS")}
            disabled={submitted}
            className="group relative overflow-hidden py-4 rounded-lg border-2 border-slate-700/60 bg-slate-900/50 hover:bg-slate-800/60 hover:border-slate-600 transition-all font-bold flex flex-col items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <HelpCircle size={22} className="text-amber-400" />
            <span className="text-sm font-black tracking-wider text-slate-300">
              UNSURE
            </span>
            <span className="text-[9px] text-slate-500 font-normal">
              Send upstairs
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
