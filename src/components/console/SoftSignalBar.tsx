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
      if ((window as any).__PHASE1_PROGRESS__ !== undefined) return;
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
    <div className="select-none font-sans">
      {/* Countdown Timer Bar — Television On-Screen Graphics Style */}
      <div className="relative bg-[#0D121B] border border-[#1E293B] rounded-xl p-4 shadow-xl">
        {/* Timer Header */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center space-x-2">
            <Clock
              size={15}
              className={
                isCritical
                  ? "text-red-500 animate-spin"
                  : isUrgent
                  ? "text-amber-400 animate-pulse"
                  : "text-slate-400"
              }
            />
            <span className="text-xs font-black text-white uppercase tracking-wider font-display">
              INITIAL INSTINCT CALL WINDOW
            </span>
          </div>

          <div className="flex items-center space-x-1.5">
            <span
              className={`text-2xl font-black font-mono tabular-nums tracking-tight ${
                isCritical
                  ? "text-red-400"
                  : isUrgent
                  ? "text-amber-400"
                  : "text-white"
              }`}
            >
              {timeLeft.toFixed(1)}
            </span>
            <span className="text-[10px] text-slate-400 font-bold uppercase font-display">SEC</span>
          </div>
        </div>

        {/* Dynamic Progress Bar */}
        <div className="w-full bg-[#06090F] h-2 rounded-full overflow-hidden border border-[#1E293B] mb-3.5">
          <div
            className={`h-full transition-all duration-100 ease-linear rounded-full ${
              isCritical
                ? "bg-red-600"
                : isUrgent
                ? "bg-amber-500"
                : "bg-slate-300"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Instruction Guidance */}
        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed font-sans">
          Make your instinct call from the broadcast feed. Detailed forensic telemetry unlocks in Phase 2.
        </p>

        {/* 3 Prominent Decision Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* OUT Button */}
          <button
            type="button"
            disabled={submitted}
            onClick={() => handleChoice("OUT")}
            className="group relative flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-red-800/60 bg-[#1A0D14] hover:bg-[#2A1220] hover:border-red-500 active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-full bg-red-950/80 border border-red-700/60 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Hand size={18} className="text-red-400 rotate-90" />
            </div>
            <span className="text-lg font-black text-red-300 font-display tracking-wider uppercase">
              OUT
            </span>
            <span className="text-[10px] text-red-200/70 font-medium">
              Finger raised
            </span>
          </button>

          {/* NOT OUT Button */}
          <button
            type="button"
            disabled={submitted}
            onClick={() => handleChoice("NOT_OUT")}
            className="group relative flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-emerald-800/60 bg-[#0C1A14] hover:bg-[#122A20] hover:border-emerald-500 active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-full bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <Hand size={18} className="text-emerald-400" />
            </div>
            <span className="text-lg font-black text-emerald-300 font-display tracking-wider uppercase">
              NOT OUT
            </span>
            <span className="text-[10px] text-emerald-200/70 font-medium">
              Safe signal
            </span>
          </button>

          {/* UNSURE / SEND UPSTAIRS Button */}
          <button
            type="button"
            disabled={submitted}
            onClick={() => handleChoice("SEND_UPSTAIRS")}
            className="group relative flex flex-col items-center justify-center p-3.5 rounded-xl border-2 border-[#243147] bg-[#111724] hover:bg-[#1A2336] hover:border-slate-500 active:scale-[0.98] transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-full bg-[#0B0F18] border border-[#243147] flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
              <HelpCircle size={18} className="text-amber-400" />
            </div>
            <span className="text-lg font-black text-slate-200 font-display tracking-wider uppercase">
              UNSURE
            </span>
            <span className="text-[10px] text-slate-400 font-medium">
              Send upstairs
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
