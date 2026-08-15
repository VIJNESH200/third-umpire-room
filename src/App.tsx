import React, { useState } from "react";
import type {
  Scenario,
  IncidentResult,
  SessionStats,
  DecisionVerdict,
  IncidentType,
} from "./types/scenario";
import { generateSession, generateScenario } from "./engine/scenarioGenerator";
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
} from "lucide-react";

type AppState = "BRIEFING" | "INCIDENT" | "CARD_REVEAL";

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

  // Start new shift
  const startNewShift = (count: number = 8, forcedType?: IncidentType) => {
    sounds.playRadioChirp();
    const scenarios = forcedType
      ? Array.from({ length: count }, (_, i) => generateScenario(Date.now() + i * 53, forcedType))
      : generateSession(count, Date.now());

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
    playerTimings?: { playerBatGroundedMs: number | null; playerBailsDislodgedMs: number | null }
  ) => {
    const currentScenario = sessionScenarios[currentIncidentIndex];
    const isVerdictCorrect = verdict === currentScenario.correctFinalVerdict;

    const isSoftCorrect =
      softSignalChoice !== null &&
      softSignalChoice !== "SEND_UPSTAIRS" &&
      softSignalChoice === currentScenario.correctFinalVerdict;

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
      softSignal: softSignalChoice,
      softSignalTimeMs: softSignalElapsedMs,
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

  // 1. BRIEFING SCREEN
  if (appState === "BRIEFING") {
    return (
      <div className="min-h-screen w-screen bg-console-950 text-slate-100 flex flex-col items-center justify-center p-4 font-mono select-none">
        <div className="max-w-2xl w-full bg-console-900 border border-console-750 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-fadeIn">
          {/* Header Banner */}
          <div className="flex items-center justify-between border-b border-console-800 pb-4">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold uppercase tracking-widest text-cyan-400 font-display">
                ICC BROADCAST REVIEW CONSOLE
              </span>
            </div>
            <button
              onClick={handleToggleMute}
              className="p-1.5 rounded bg-console-850 hover:bg-console-800 text-slate-400 border border-console-750"
            >
              {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} className="text-emerald-400" />}
            </button>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight text-white">
              THIRD UMPIRE ROOM
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto">
              A desk-based cricket review simulator inspired by ICC DRS protocols. Receive live appeals, make blind instinct calls in 10s, inspect slow-mo telemetry, and uphold the Umpire's Call rulebook.
            </p>
          </div>

          {/* 4 Review Disciplines Preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="p-3 bg-console-950 rounded-lg border border-console-800 flex flex-col items-center text-center gap-1.5">
              <Crosshair size={20} className="text-cyan-400" />
              <span className="font-bold text-slate-200">Hawk-Eye LBW</span>
              <span className="text-[10px] text-slate-500">Fair Ball & 3D Path</span>
            </div>
            <div className="p-3 bg-console-950 rounded-lg border border-console-800 flex flex-col items-center text-center gap-1.5">
              <ZoomIn size={20} className="text-amber-400" />
              <span className="font-bold text-slate-200">Crease 500fps</span>
              <span className="text-[10px] text-slate-500">Zing Bail Ignition</span>
            </div>
            <div className="p-3 bg-console-950 rounded-lg border border-console-800 flex flex-col items-center text-center gap-1.5">
              <Activity size={20} className="text-pink-400" />
              <span className="font-bold text-slate-200">UltraEdge Wave</span>
              <span className="text-[10px] text-slate-500">Acoustic Snicko</span>
            </div>
            <div className="p-3 bg-console-950 rounded-lg border border-console-800 flex flex-col items-center text-center gap-1.5">
              <Flame size={20} className="text-emerald-400" />
              <span className="font-bold text-slate-200">Boundary Rope</span>
              <span className="text-[10px] text-slate-500">4K Cushion Check</span>
            </div>
          </div>

          {/* DRS Rule Reminder Callout */}
          <div className="bg-cyan-950/20 border border-cyan-500/30 p-3.5 rounded-lg text-xs space-y-1">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Award size={13} className="text-cyan-400" />
              <span>THE UMPIRE'S CALL & GATE RULES ARE ACTIVE:</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              No-ball deliveries or prior bat contact immediately terminate ball-tracking. If ball-tracking shows <b>Umpire's Call</b>, the original on-field decision <b>MUST STAND</b>.
            </p>
          </div>

          {/* Mode Selection Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => startNewShift(8)}
              className="flex-1 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/25 transition-all active:scale-95 font-display"
            >
              <Play size={14} fill="currentColor" />
              <span>START REVIEW SHIFT (8 INCIDENTS)</span>
            </button>

            <button
              onClick={() => startNewShift(5)}
              className="py-3 px-4 rounded-xl bg-console-850 hover:bg-console-800 text-slate-200 border border-console-750 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95"
            >
              <Zap size={13} className="text-amber-400" />
              <span>RAPID (5)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. ACTIVE INCIDENT CONSOLE
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
      />
    );
  }

  // 3. SESSION COMPLETE & CARD EXPORT
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
