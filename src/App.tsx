import React, { useState, useEffect, useRef } from "react";
import type {
  Scenario,
  IncidentResult,
  SessionStats,
  DecisionVerdict,
  IncidentType,
} from "./types/scenario";
import { generateScenario } from "./engine/scenarioGenerator";
import { generateSessionIncidents } from "./engine/randomIncidentEngine";
import { checkDRSCompliance } from "./engine/drsRules";
import { computeSessionStats } from "./engine/scoring";
import { ConsoleLayout, ConsolePhase } from "./components/console/ConsoleLayout";
import { ResultCard } from "./components/card/ResultCard";
import { sounds } from "./engine/audioSynth";
import {
  Play,
  Award,
  Crosshair,
  Activity,
  ZoomIn,
  Flame,
  Volume2,
  VolumeX,
  Zap,
  GraduationCap,
  Tv,
} from "lucide-react";
import { T20_WC_2024_FINAL } from "./data/realMatches/t20Wc2024Final";
import { RealMatchGameSession } from "./engine/realMatchGameSession";
import { RealMatchPlaybackView } from "./components/realMatch/RealMatchPlaybackView";
import type { RealMatchDrsIncident } from "./types/realMatch";

type AppState = "BRIEFING" | "INCIDENT" | "CARD_REVEAL" | "REAL_MATCH" | "REAL_MATCH_REVIEW";

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("BRIEFING");
  const [sessionScenarios, setSessionScenarios] = useState<Scenario[]>([]);
  const [currentIncidentIndex, setCurrentIncidentIndex] = useState<number>(0);
  const [consolePhase, setConsolePhase] = useState<ConsolePhase>("SOFT_SIGNAL");

  // Per-incident tracking
  const [softSignalChoice, setSoftSignalChoice] = useState<"OUT" | "NOT_OUT" | "SEND_UPSTAIRS" | null>(null);
  const [softSignalElapsedMs, setSoftSignalElapsedMs] = useState<number>(0);
  const [currentIncidentResult, setCurrentIncidentResult] = useState<IncidentResult | null>(null);
  const [reviewStartTime, setReviewStartTime] = useState<number>(0);

  // Session history
  const [incidentHistory, setIncidentHistory] = useState<IncidentResult[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  // Training mode: forensic assists (AUTO ALL, review checklist auto-complete)
  const [trainingMode, setTrainingMode] = useState<boolean>(false);

  // Real Match DRS Mode state
  const realMatchSessionRef = useRef<RealMatchGameSession | null>(null);
  const [activeRealMatchIncident, setActiveRealMatchIncident] = useState<RealMatchDrsIncident | null>(null);
  const [activeReviewIndex, setActiveReviewIndex] = useState<number>(0);

  const startRealMatch = (incidentCount: number = 8, startingSeed: number = Date.now()) => {
    sounds.playRadioChirp();
    const session = new RealMatchGameSession(T20_WC_2024_FINAL, startingSeed, { incidentCount });
    realMatchSessionRef.current = session;
    setActiveRealMatchIncident(null);
    setActiveReviewIndex(0);
    setAppState("REAL_MATCH");
  };

  const handleEnterRealMatchReview = (incident: RealMatchDrsIncident) => {
    sounds.playRadioChirp();
    setActiveRealMatchIncident(incident);
    setActiveReviewIndex(realMatchSessionRef.current?.getDecisionsHistory().length ?? 0);
    setSoftSignalChoice(null);
    setCurrentIncidentResult(null);
    setConsolePhase("SOFT_SIGNAL");
    setAppState("REAL_MATCH_REVIEW");
  };


  // Start new shift
  const startNewShift = (count: number = 8, forcedType?: IncidentType) => {
    sounds.playRadioChirp();
    const sessionSeed = Date.now();
    const scenarios = forcedType
      ? generateSessionIncidents(sessionSeed, count, { weights: { [forcedType]: 1 } })
      : generateSessionIncidents(sessionSeed, count);

    setSessionScenarios(scenarios);
    setCurrentIncidentIndex(0);
    setIncidentHistory([]);
    setSoftSignalChoice(null);
    setCurrentIncidentResult(null);
    setConsolePhase("SOFT_SIGNAL");
    setAppState("INCIDENT");
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  // Phase 1: Soft signal instinct submitted
  const handleSoftSignalSubmit = (
    choice: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS",
    elapsedMs: number
  ) => {
    setSoftSignalChoice(choice);
    setSoftSignalElapsedMs(elapsedMs);
    setReviewStartTime(Date.now());
    setConsolePhase("REVIEW");
    sounds.playClick(850);
  };

  // Phase 2: Final verdict submitted
  const handleFinalVerdictSubmit = (
    verdict: DecisionVerdict,
    _dismissalReason: string,
    playerTimings?: { playerBatGroundedMs: number | null; playerBailsDislodgedMs: number | null },
    softSignalOverride?: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS",
    elapsedMsOverride?: number
  ) => {
    const isRealMatchReview = appState === "REAL_MATCH_REVIEW" && activeRealMatchIncident !== null;
    const currentScenario = isRealMatchReview
      ? activeRealMatchIncident.scenario
      : sessionScenarios[currentIncidentIndex];

    if (!currentScenario) return;

    if (isRealMatchReview && realMatchSessionRef.current) {
      const customReason =
        _dismissalReason &&
        _dismissalReason.trim() !== "" &&
        _dismissalReason.trim().toUpperCase() !== "STANDARD"
          ? _dismissalReason.trim()
          : undefined;
      realMatchSessionRef.current.submitDecision(verdict, {
        reason: customReason,
      });
    }

    const isVerdictCorrect = verdict === currentScenario.correctFinalVerdict;

    const effectiveSoftSignal = softSignalOverride ?? softSignalChoice;
    const effectiveSoftElapsed = elapsedMsOverride ?? softSignalElapsedMs;

    const isSoftCorrect =
      effectiveSoftSignal !== null &&
      effectiveSoftSignal !== "SEND_UPSTAIRS" &&
      effectiveSoftSignal === currentScenario.correctFinalVerdict;

    const compliance = checkDRSCompliance(
      currentScenario.incidentType,
      verdict,
      currentScenario.onFieldSignal,
      currentScenario.drsEvaluation
    );

    const result: IncidentResult = {
      scenarioId: currentScenario.id,
      incidentType: currentScenario.incidentType,
      difficultyTier: currentScenario.difficultyTier,
      softSignal: effectiveSoftSignal,
      softSignalTimeMs: effectiveSoftElapsed,
      softSignalCorrect: isSoftCorrect,
      finalVerdict: verdict,
      finalVerdictCorrect: isVerdictCorrect,
      isUmpiresCallScenario: currentScenario.drsEvaluation.isUmpiresCall,
      umpiresCallComplied: compliance.complied,
      timeSpentReviewingMs: Date.now() - reviewStartTime,
      toolsUsed: [currentScenario.incidentType],
      playerBatGroundedMs: playerTimings?.playerBatGroundedMs,
      playerBailsDislodgedMs: playerTimings?.playerBailsDislodgedMs,
    };

    setCurrentIncidentResult(result);
    setIncidentHistory((prev) => [...prev, result]);
    setConsolePhase("RESULT");
  };

  const handleNextIncident = () => {
    if (appState === "REAL_MATCH_REVIEW") {
      setActiveRealMatchIncident(null);
      setCurrentIncidentResult(null);
      setSoftSignalChoice(null);
      setAppState("REAL_MATCH");
      return;
    }

    const nextIndex = currentIncidentIndex + 1;
    if (nextIndex < sessionScenarios.length) {
      setCurrentIncidentIndex(nextIndex);
      setSoftSignalChoice(null);
      setCurrentIncidentResult(null);
      setConsolePhase("SOFT_SIGNAL");
    } else {
      const allResults = [...incidentHistory];
      const stats = computeSessionStats(allResults);
      setSessionStats(stats);
      setAppState("CARD_REVEAL");
    }
  };

  const submitFinalVerdictRef = useRef(handleFinalVerdictSubmit);
  submitFinalVerdictRef.current = handleFinalVerdictSubmit;
  const setSoftSignalChoiceRef = useRef(setSoftSignalChoice);
  setSoftSignalChoiceRef.current = setSoftSignalChoice;
  const setSoftSignalElapsedMsRef = useRef(setSoftSignalElapsedMs);
  setSoftSignalElapsedMsRef.current = setSoftSignalElapsedMs;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__startIncident = (type: IncidentType, seed: number = Date.now(), totalCount: number = 1) => {
      const scenario = generateScenario(seed, type);
      const scenarios =
        totalCount > 1
          ? [scenario, ...Array.from({ length: totalCount - 1 }, (_, i) => generateScenario(seed + i + 1, type))]
          : [scenario];
      setSessionScenarios(scenarios);
      setCurrentIncidentIndex(0);
      setIncidentHistory([]);
      setSoftSignalChoice(null);
      setCurrentIncidentResult(null);
      setConsolePhase("SOFT_SIGNAL");
      setAppState("INCIDENT");
    };
    (window as any).__startSession = (seed: number = Date.now(), count: number = 8) => {
      const scenarios = generateSessionIncidents(seed, count);
      setSessionScenarios(scenarios);
      setCurrentIncidentIndex(0);
      setIncidentHistory([]);
      setSoftSignalChoice(null);
      setCurrentIncidentResult(null);
      setConsolePhase("SOFT_SIGNAL");
      setAppState("INCIDENT");
    };
    (window as any).__setPhase = (phase: ConsolePhase) => {
      setConsolePhase(phase);
    };
    (window as any).__submitVerdict = (verdict: DecisionVerdict, softSignal: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS" = "NOT_OUT", elapsedMs: number = 4000) => {
      setSoftSignalChoiceRef.current(softSignal);
      setSoftSignalElapsedMsRef.current(elapsedMs);
      submitFinalVerdictRef.current(verdict, "Test evaluation", undefined, softSignal, elapsedMs);
    };
    (window as any).__startRealMatch = (seed: number = Date.now(), incidentCount: number = 8) => {
      startRealMatch(incidentCount, seed);
    };
    (window as any).__getRealMatchSession = () => realMatchSessionRef.current;
  }, []);

  // 1. BRIEFING SCREEN
  if (appState === "BRIEFING") {
    return (
      <div className="min-h-screen w-screen bg-[#070A10] text-slate-100 flex flex-col items-center justify-center p-4 font-sans select-none">
        <div className="max-w-2xl w-full bg-[#0D121B] border border-[#1E293B] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b border-[#1E293B] pb-4">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-400 font-display">
                ICC TELEVISION REVIEW CONTROL ROOM
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1.5 rounded-lg bg-[#141B28] hover:bg-[#1E283C] text-slate-400 hover:text-white border border-[#243147] transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-emerald-400" />}
            </button>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black font-display tracking-wide text-white uppercase">
              THIRD UMPIRE ROOM
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              Step into the television broadcast control room. Receive live on-field appeals, render 10-second instinct signals, analyze high-speed telemetry, and uphold the official ICC DRS protocols.
            </p>
          </div>

          {/* 4 Review Disciplines Preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-sans">
            <div className="p-3 bg-[#06090F] rounded-xl border border-[#1E293B] flex flex-col items-center text-center gap-1.5">
              <Crosshair size={20} className="text-slate-300" />
              <span className="font-extrabold text-slate-100 font-display text-sm tracking-wide">Hawk-Eye LBW</span>
              <span className="text-[10px] text-slate-400 font-mono">Fair Delivery & 3D Path</span>
            </div>
            <div className="p-3 bg-[#06090F] rounded-xl border border-[#1E293B] flex flex-col items-center text-center gap-1.5">
              <ZoomIn size={20} className="text-amber-400" />
              <span className="font-extrabold text-slate-100 font-display text-sm tracking-wide">Crease 500fps</span>
              <span className="text-[10px] text-slate-400 font-mono">Zing Bail Dislodgement</span>
            </div>
            <div className="p-3 bg-[#06090F] rounded-xl border border-[#1E293B] flex flex-col items-center text-center gap-1.5">
              <Activity size={20} className="text-pink-400" />
              <span className="font-extrabold text-slate-100 font-display text-sm tracking-wide">UltraEdge Wave</span>
              <span className="text-[10px] text-slate-400 font-mono">Acoustic Snickometer</span>
            </div>
            <div className="p-3 bg-[#06090F] rounded-xl border border-[#1E293B] flex flex-col items-center text-center gap-1.5">
              <Flame size={20} className="text-emerald-400" />
              <span className="font-extrabold text-slate-100 font-display text-sm tracking-wide">Boundary Rope</span>
              <span className="text-[10px] text-slate-400 font-mono">4K Cushion Contact</span>
            </div>
          </div>

          {/* DRS Rule Reminder Callout */}
          <div className="bg-[#0B0F17] border border-[#1E293B] p-3.5 rounded-xl text-xs space-y-1">
            <div className="font-black text-slate-300 flex items-center gap-1.5 font-display tracking-wider uppercase">
              <Award size={14} className="text-amber-400" />
              <span>OFFICIAL ICC DRS PROTOCOL ACTIVE:</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              No-ball deliveries or prior bat contact immediately invalidate LBW tracking. If trajectory indicates <b>Umpire's Call</b>, the original on-field decision <b>MUST STAND</b>.
            </p>
          </div>

          {/* Mode Selection Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={() => startRealMatch(8)}
              className="py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-lg border border-amber-400/40 transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer"
              title="Play through the verified 2024 ICC T20 World Cup Final with live DRS incident injection"
            >
              <Tv size={14} />
              <span>REAL MATCH (2024 FINAL)</span>
            </button>

            <button
              type="button"
              onClick={() => startNewShift(8)}
              className="flex-1 py-3.5 px-4 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-md border border-white/20 transition-all active:scale-95 font-display uppercase tracking-wider cursor-pointer"
            >
              <Play size={14} fill="currentColor" />
              <span>REVIEW SHIFT (8)</span>
            </button>

            <button
              type="button"
              onClick={() => startNewShift(5)}
              className="py-3.5 px-4 rounded-xl bg-[#141B28] hover:bg-[#1E283C] text-slate-200 border border-[#243147] font-black text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer"
            >
              <Zap size={14} className="text-amber-400" />
              <span>RAPID (5)</span>
            </button>

            <button
              type="button"
              onClick={() => setTrainingMode((t) => !t)}
              className={`py-3.5 px-4 rounded-xl font-black text-xs flex items-center justify-center space-x-1.5 border transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer ${
                trainingMode
                  ? "bg-emerald-950/80 border-emerald-500 text-emerald-300"
                  : "bg-[#141B28] hover:bg-[#1E283C] text-slate-400 border-[#243147]"
              }`}
              title="Training assists: AUTO ALL ball-tracking and auto-satisfied evidence review"
            >
              <GraduationCap size={14} className={trainingMode ? "text-emerald-400" : "text-slate-500"} />
              <span>TRAINING {trainingMode ? "ON" : "OFF"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. ACTIVE INCIDENT CONSOLE (RAPID / REVIEW SHIFT)
  if (appState === "INCIDENT") {
    const currentScenario = sessionScenarios[currentIncidentIndex];
    return (
      <ConsoleLayout
        scenario={currentScenario}
        phase={consolePhase}
        incidentIndex={currentIncidentIndex}
        totalIncidents={sessionScenarios.length}
        isMuted={isMuted}
        currentResult={currentIncidentResult}
        onToggleMute={handleToggleMute}
        onSoftSignalSubmit={handleSoftSignalSubmit}
        onFinalVerdictSubmit={handleFinalVerdictSubmit}
        onNextIncident={handleNextIncident}
        trainingMode={trainingMode}
      />
    );
  }

  // 3. REAL MATCH DRS PLAYBACK VIEW
  if (appState === "REAL_MATCH" && realMatchSessionRef.current) {
    return (
      <RealMatchPlaybackView
        session={realMatchSessionRef.current}
        onEnterReview={handleEnterRealMatchReview}
        onExitMatch={() => setAppState("BRIEFING")}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />
    );
  }

  // 4. REAL MATCH DRS REVIEW (reuses ConsoleLayout!)
  if (appState === "REAL_MATCH_REVIEW" && activeRealMatchIncident) {
    return (
      <ConsoleLayout
        scenario={activeRealMatchIncident.scenario}
        phase={consolePhase}
        incidentIndex={activeReviewIndex}
        totalIncidents={realMatchSessionRef.current?.incidentCount ?? 8}
        isMuted={isMuted}
        currentResult={currentIncidentResult}
        onToggleMute={handleToggleMute}
        onSoftSignalSubmit={handleSoftSignalSubmit}
        onFinalVerdictSubmit={handleFinalVerdictSubmit}
        onNextIncident={handleNextIncident}
        trainingMode={trainingMode}
        isRealMatch={true}
      />
    );
  }

  // 5. SESSION COMPLETE & CARD EXPORT
  if (appState === "CARD_REVEAL" && sessionStats) {
    return (
      <ResultCard
        stats={sessionStats}
        onRestart={() => setAppState("BRIEFING")}
      />
    );
  }

  return null;
};

export default App;
