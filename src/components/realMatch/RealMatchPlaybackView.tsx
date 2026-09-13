/**
 * src/components/realMatch/RealMatchPlaybackView.tsx
 *
 * Broadcast control room playback view for the Real Match DRS Mode.
 * Renders live scoreboard, delivery details, DRS overrides, and review alerts.
 */

import React, { useState, useEffect, useRef } from "react";
import type { RealMatchGameSession } from "../../engine/realMatchGameSession";
import type { RealMatchDrsIncident } from "../../types/realMatch";
import {
  Play,
  Pause,
  ChevronRight,
  ChevronLeft,
  FastForward,
  RotateCcw,
  AlertTriangle,
  Award,
  CheckCircle2,
  Tv,
  Volume2,
  VolumeX,
} from "lucide-react";

interface RealMatchPlaybackViewProps {
  session: RealMatchGameSession;
  onEnterReview: (incident: RealMatchDrsIncident) => void;
  onExitMatch: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
}

export const RealMatchPlaybackView: React.FC<RealMatchPlaybackViewProps> = ({
  session,
  onEnterReview,
  onExitMatch,
  isMuted,
  onToggleMute,
}) => {
  const [, setRenderTick] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const timerRef = useRef<number | null>(null);

  const forceUpdate = () => setRenderTick((t) => t + 1);

  const state = session.getPlaybackState();
  const currentBall = session.getCurrentDelivery();
  const currentIncident = session.getCurrentIncident();
  const isPausedForReview = session.isPausedForReview();
  const status = session.getStatus();
  const match = session.match;

  const currentInnings = match.innings[state.inningsIndex];
  const isFirstInnings = state.inningsIndex === 0;

  // Stop auto-play if review is required or match completes
  useEffect(() => {
    if (isPausedForReview || status === "MATCH_COMPLETE") {
      setIsPlaying(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isPausedForReview, status]);

  // Auto-play tick loop
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setInterval(() => {
        if (session.isPausedForReview() || session.getStatus() === "MATCH_COMPLETE") {
          setIsPlaying(false);
          return;
        }
        const advanced = session.stepForward();
        if (!advanced) {
          setIsPlaying(false);
        }
        forceUpdate();
      }, 1200);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying, session]);

  const handleStepForward = () => {
    session.stepForward();
    forceUpdate();
  };

  const handleStepBackward = () => {
    session.stepBackward();
    forceUpdate();
  };

  const handleJumpToNextIncident = () => {
    setIsPlaying(false);
    session.jumpToNextIncident();
    forceUpdate();
  };

  const handleToggleAutoPlay = () => {
    if (isPausedForReview || status === "MATCH_COMPLETE") return;
    setIsPlaying((prev) => !prev);
  };

  const handleRemoveOverlay = (deliveryId: string) => {
    session.removeOverlay(deliveryId);
    forceUpdate();
  };

  // Helper for delivery outcome label
  const renderOutcomeBadge = () => {
    if (!currentBall) return null;
    const outcome = currentBall.effectiveOutcome;
    const isOverridden = currentBall.isOverridden;

    if (outcome.wicket) {
      return (
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded bg-red-950/80 border border-red-600 text-red-300 font-black text-xs uppercase tracking-wider font-mono">
            WICKET: {outcome.wicket.kind} ({outcome.wicket.playerOut})
          </span>
          {isOverridden && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold font-mono">
              DRS OVERRIDE ACTIVE
            </span>
          )}
        </div>
      );
    }

    if (outcome.extras) {
      return (
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-600 text-amber-300 font-black text-xs uppercase tracking-wider font-mono">
            EXTRA: {outcome.extras.type} (+{outcome.extras.runs})
          </span>
          {isOverridden && (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-bold font-mono">
              DRS OVERRIDE ACTIVE
            </span>
          )}
        </div>
      );
    }

    if (outcome.runsBatter === 4) {
      return (
        <span className="px-2.5 py-1 rounded bg-blue-950/80 border border-blue-500 text-blue-300 font-black text-xs uppercase tracking-wider font-mono">
          FOUR RUNS (4)
        </span>
      );
    }

    if (outcome.runsBatter === 6) {
      return (
        <span className="px-2.5 py-1 rounded bg-purple-950/80 border border-purple-500 text-purple-300 font-black text-xs uppercase tracking-wider font-mono">
          SIX RUNS (6)
        </span>
      );
    }

    if (outcome.runsBatter === 0) {
      return (
        <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-black text-xs uppercase tracking-wider font-mono">
          DOT BALL (0)
        </span>
      );
    }

    return (
      <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-300 font-black text-xs uppercase tracking-wider font-mono">
        {outcome.runsBatter} RUN{outcome.runsBatter > 1 ? "S" : ""}
      </span>
    );
  };

  // Match complete summary screen
  if (status === "MATCH_COMPLETE") {
    const result = session.getMatchResult();
    return (
      <div className="min-h-screen w-screen bg-[#070A10] text-slate-100 flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="max-w-2xl w-full bg-[#0D121B] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <div className="flex items-center space-x-2">
              <Award className="text-amber-400" size={20} />
              <span className="text-xs font-black uppercase tracking-widest text-slate-300 font-display">
                MATCH COMPLETE — OFFICIAL DRS ADJUDICATION SUMMARY
              </span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black font-display text-white uppercase">
              {match.venue}
            </h1>
            <p className="text-xl font-bold text-amber-400 font-display">
              {result.marginDescription}
            </p>
          </div>

          {/* Innings comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#080C14] border border-[#1E293B] p-4 rounded-xl text-center space-y-1">
              <div className="text-xs font-bold text-slate-400 font-display uppercase tracking-wider">
                {match.innings[0]?.battingTeamId ?? "IND"} INNINGS 1
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {result.innings1Score} / {result.innings1Wickets}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">20.0 OVERS</div>
            </div>

            <div className="bg-[#080C14] border border-[#1E293B] p-4 rounded-xl text-center space-y-1">
              <div className="text-xs font-bold text-slate-400 font-display uppercase tracking-wider">
                {match.innings[1]?.battingTeamId ?? "SA"} INNINGS 2
              </div>
              <div className="text-3xl font-black text-white font-mono">
                {result.innings2Score} / {result.innings2Wickets}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">20.0 OVERS</div>
            </div>
          </div>

          {/* DRS intervention audit */}
          <div className="bg-[#080C14] border border-[#1E293B] p-4 rounded-xl space-y-2">
            <div className="text-xs font-black uppercase tracking-wider text-slate-300 font-display flex items-center gap-1.5">
              <Tv size={14} className="text-emerald-400" />
              <span>DRS TELEVISION REVIEWS AUDIT:</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
              <div className="p-2 bg-[#0E1522] rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">Total Reviews</div>
                <div className="text-lg font-bold text-white">{result.totalReviewsConducted}</div>
              </div>
              <div className="p-2 bg-[#0E1522] rounded border border-slate-800">
                <div className="text-[10px] text-emerald-400">Decisions Overturned</div>
                <div className="text-lg font-bold text-emerald-400">{result.reviewsOverturned}</div>
              </div>
              <div className="p-2 bg-[#0E1522] rounded border border-slate-800">
                <div className="text-[10px] text-slate-400">Decisions Upheld</div>
                <div className="text-lg font-bold text-slate-200">{result.reviewsUpheld}</div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onExitMatch}
              className="w-full py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-md transition-all font-display uppercase tracking-wider cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>RETURN TO CONTROL ROOM</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-[#070A10] text-slate-100 flex flex-col p-4 font-sans select-none">
      {/* 1. Header Broadcast Bar */}
      <div className="max-w-5xl w-full mx-auto bg-[#0D121B] border border-[#1E293B] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1E293B] pb-3 gap-2">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-slate-300 font-display">
              ICC WORLD CUP 2024 FINAL | LIVE MATCH FEED
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onToggleMute && (
              <button
                type="button"
                onClick={onToggleMute}
                className="p-1.5 rounded-lg bg-[#141B28] hover:bg-[#1E283C] text-slate-400 hover:text-white border border-[#243147] transition-colors cursor-pointer"
                title={isMuted ? "Unmute Audio" : "Mute Audio"}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-emerald-400" />}
              </button>
            )}
            <button
              type="button"
              onClick={onExitMatch}
              className="py-1 px-3 rounded-lg bg-[#141B28] hover:bg-[#1E283C] text-slate-400 hover:text-white border border-[#243147] text-[11px] font-bold font-display uppercase tracking-wider cursor-pointer"
            >
              Exit Match
            </button>
          </div>
        </div>

        {/* 2. Main Live Scoreboard */}
        <div className="bg-[#080C14] border border-[#1E293B] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-left">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-display">
              {currentInnings?.battingTeamId === "IND" ? "INDIA" : "SOUTH AFRICA"} (INNINGS {state.inningsIndex + 1})
            </div>
            <div className="flex items-baseline space-x-3 justify-center sm:justify-start">
              <span className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight">
                {state.score} / {state.wickets}
              </span>
              <span className="text-lg font-bold text-slate-400 font-mono">
                ({state.overs}.{state.ballInOver} / 20.0 ov)
              </span>
            </div>
            {!isFirstInnings && (() => {
              const inn1Stats = session.getInningsEffectiveScore(0);
              const dynamicTarget = inn1Stats.score + 1;
              const runsNeeded = Math.max(0, dynamicTarget - state.score);
              return (
                <div className="text-xs text-amber-400 font-mono font-medium">
                  Target: {dynamicTarget} | South Africa need {runsNeeded} runs
                </div>
              );
            })()}
          </div>

          {/* DRS Reviews Remaining */}
          <div className="flex items-center space-x-4 text-xs font-mono bg-[#0D131F] p-3 rounded-lg border border-slate-800">
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase">Batting Reviews</div>
              <div className="text-base font-bold text-emerald-400">
                {state.remainingReviews?.batting ?? 2} / 2
              </div>
            </div>
            <div className="w-[1px] h-6 bg-slate-700" />
            <div className="text-center">
              <div className="text-[10px] text-slate-400 uppercase">Bowling Reviews</div>
              <div className="text-base font-bold text-emerald-400">
                {state.remainingReviews?.bowling ?? 2} / 2
              </div>
            </div>
          </div>
        </div>

        {/* 3. Current Delivery Inspector Card */}
        <div className="bg-[#080C14] border border-[#1E293B] rounded-xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 font-mono">
                OVER {state.overs}.{state.ballInOver}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-300">
                Ball ID: {currentBall?.delivery.id ?? "—"}
              </span>
            </div>
            <div>{renderOutcomeBadge()}</div>
          </div>

          {/* Batters & Bowler on this delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs font-mono">
            <div className="p-2.5 bg-[#0D131F] rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Striker:</span>
              <span className="font-bold text-white">{state.striker || "—"}</span>
            </div>
            <div className="p-2.5 bg-[#0D131F] rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Non-Striker:</span>
              <span className="font-bold text-slate-300">{state.nonStriker || "—"}</span>
            </div>
            <div className="p-2.5 bg-[#0D131F] rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Bowler:</span>
              <span className="font-bold text-slate-300">{state.bowler || "—"}</span>
            </div>
          </div>

          {/* Active Override details with revert button */}
          {currentBall?.isOverridden && (
            <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle2 size={16} className="text-amber-400 shrink-0" />
                <span className="text-xs font-mono text-amber-200">
                  DRS Consequence Active: {session.getOverlays().get(currentBall.delivery.id)?.reason ?? "Decision Overridden"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveOverlay(currentBall.delivery.id)}
                className="px-2 py-1 rounded bg-amber-900/60 hover:bg-amber-800 text-amber-200 text-[10px] font-mono font-bold uppercase transition-colors cursor-pointer"
              >
                Revert Baseline
              </button>
            </div>
          )}
        </div>

        {/* 4. DRS Incident Referral Action Banner (High Visibility when review required) */}
        {isPausedForReview && currentIncident && (
          <div className="p-5 bg-gradient-to-r from-red-950/80 via-amber-950/70 to-red-950/80 border-2 border-amber-500 rounded-xl space-y-3 animate-pulse shadow-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="text-amber-400" size={22} />
              <span className="text-sm font-black text-amber-300 uppercase tracking-widest font-display">
                ⚡ ON-FIELD APPEAL — DRS REVIEW INITIATED
              </span>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-sans">
              Standing umpires have received an appeal for <b>{currentIncident.incidentType}</b> (Tier: <b>{currentIncident.difficulty}</b>).
              Playback is paused. Step into the Third Umpire Control Room to inspect Hawk-Eye ball tracking, UltraEdge audio telemetry, and high-speed vision.
            </p>
            <button
              type="button"
              onClick={() => onEnterReview(currentIncident)}
              className="w-full py-3.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-xl transition-all active:scale-95 font-display uppercase tracking-wider cursor-pointer"
            >
              <Tv size={16} />
              <span>ENTER THIRD UMPIRE REVIEW WORKSTATION</span>
            </button>
          </div>
        )}

        {/* 5. Playback Transport Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleStepBackward}
              disabled={state.deliveryIndex <= 0 && state.inningsIndex === 0}
              className="flex-1 sm:flex-none p-2.5 rounded-lg bg-[#141B28] hover:bg-[#1E283C] disabled:opacity-40 disabled:hover:bg-[#141B28] text-slate-200 border border-[#243147] transition-all cursor-pointer"
              title="Previous Delivery"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={handleToggleAutoPlay}
              disabled={isPausedForReview}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-lg font-black text-xs flex items-center justify-center space-x-1.5 border transition-all cursor-pointer font-display uppercase tracking-wider ${
                isPlaying
                  ? "bg-amber-500/20 border-amber-500 text-amber-300"
                  : "bg-[#141B28] hover:bg-[#1E283C] text-slate-200 border-[#243147]"
              }`}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? "PAUSE" : "AUTO-PLAY"}</span>
            </button>

            <button
              type="button"
              onClick={handleStepForward}
              disabled={isPausedForReview}
              className="flex-1 sm:flex-none p-2.5 rounded-lg bg-[#141B28] hover:bg-[#1E283C] disabled:opacity-40 disabled:hover:bg-[#141B28] text-slate-200 border border-[#243147] transition-all cursor-pointer"
              title={isPausedForReview ? "Review decision required" : "Next Delivery"}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleJumpToNextIncident}
              disabled={isPausedForReview}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-600/50 font-black text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 font-display uppercase tracking-wider cursor-pointer"
            >
              <FastForward size={14} />
              <span>JUMP TO NEXT REVIEW</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
