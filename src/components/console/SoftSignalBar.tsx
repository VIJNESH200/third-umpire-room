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

  // Keep a fresh reference to onDecision to prevent stale closure bugs
  const onDecisionRef = useRef(onDecision);
  useEffect(() => {
    onDecisionRef.current = onDecision;
  }, [onDecision]);

  const handleTimeout = useCallback(() => {
    onDecisionRef.current("SEND_UPSTAIRS", timeLimitSeconds * 1000);
  }, [timeLimitSeconds]);

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
          handleTimeout();
          return 0;
        }
        return remaining;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLimitSeconds, handleTimeout]);

  const handleChoice = (choice: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS") => {
    if (submitted) return; // Prevent double submission
    setSubmitted(true);
    if (timerRef.current) clearInterval(timerRef.current);
    const elapsedMs = Math.min(timeLimitSeconds * 1000, Date.now() - startTimeRef.current);
    sounds.playClick(choice === "OUT" ? 700 : choice === "NOT_OUT" ? 900 : 800);
    onDecisionRef.current(choice, elapsedMs);
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

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800/80 mb-4">
          <div
            className={`h-full transition-all duration-100 ease-linear rounded-full ${
              isCritical
                ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                : isUrgent
                ? "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Instruction Guidance */}
        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Make your call from the <strong className="text-slate-200">initial broadcast evidence</strong>. Forensic review tools will <span className="text-cyan-400 font-bold">unlock</span> after your signal.
        </p>

        {/* 3 Prominent Decision Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* OUT Button */}
          <button
            type="button"
            disabled={submitted}
            onClick={() => handleChoice("OUT")}
            className="group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 border-rose-500/40 bg-rose-950/20 hover:bg-rose-900/40 hover:border-rose-400 active:scale-[0.98] transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center mb-2 group-hover:bg-rose-500/20 group-hover:scale-110 transition-transform">
              <Hand size={20} className="text-rose-400 rotate-90" />
            </div>
            <span className="text-lg font-black text-rose-400 tracking-wider">
              OUT
            </span>
            <span className="text-[10px] text-rose-400/70 font-sans tracking-tight mt-0.5">
              Finger raised
            </span>
          </button>

          {/* NOT OUT Button */}
          <button
            type="button"
            disabled={submitted}
            onClick={() => handleChoice("NOT_OUT")}
            className="group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 border-emerald-500/40 bg-emerald-950/20 hover:bg-emerald-900/40 hover:border-emerald-400 active:scale-[0.98] transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center mb-2 group-hover:bg-emerald-500/20 group-hover:scale-110 transition-transform">
              <Hand size={20} className="text-emerald-400" />
            </div>
            <span className="text-lg font-black text-emerald-400 tracking-wider">
              NOT OUT
            </span>
            <span className="text-[10px] text-emerald-400/70 font-sans tracking-tight mt-0.5">
              Safe signal
            </span>
          </button>

          {/* UNSURE / SEND UPSTAIRS Button */}
          <button
            type="button"
            disabled={submitted}
            onClick={() => handleChoice("SEND_UPSTAIRS")}
            className="group relative flex flex-col items-center justify-center p-4 rounded-xl border-2 border-slate-700 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-500 active:scale-[0.98] transition-all cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-2 group-hover:bg-slate-700 group-hover:scale-110 transition-transform">
              <HelpCircle size={20} className="text-amber-400" />
            </div>
            <span className="text-lg font-black text-slate-200 tracking-wider">
              UNSURE
            </span>
            <span className="text-[10px] text-slate-400 font-sans tracking-tight mt-0.5">
              Send upstairs
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
