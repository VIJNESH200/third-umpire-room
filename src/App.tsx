import React, { useState, useEffect, useRef } from "react";
import type {
  Scenario,
  IncidentResult,
  SessionStats,
  DecisionVerdict,
  PlayerVerdictChoice,
  IncidentType,
  GameplayStage,
} from "./types/scenario";
import type { RemainingReviews } from "./types/matchContext";
import type {
  CareerProfile,
  CareerMatchAssignment,
  BettingMarket,
  PreMatchBet,
  BribeOffer,
  CorruptionContract,
  CareerIncidentRecord,
  CareerMatchReport,
} from "./types/career";
import { generateScenario } from "./engine/scenarioGenerator";
import { generateSessionIncidents } from "./engine/randomIncidentEngine";
import { checkDRSCompliance } from "./engine/drsRules";
import { computeSessionStats } from "./engine/scoring";
import { ThirdUmpireGameSession } from "./engine/thirdUmpireGameSession";
import {
  loadCareerProfile,
  saveCareerProfile,
  resetCareerProfile,
  computeCareerMatchReport,
  applyCareerMatchReport,
} from "./engine/career/careerState";
import { generateMatchAssignment } from "./engine/career/matchGenerator";
import { generateBettingMarket } from "./engine/career/betting";
import {
  generateBribeOffer,
  evaluateCorruptDecision,
} from "./engine/career/corruption";
import {
  calculateFanImpact,
  calculateCriticImpact,
} from "./engine/career/careerScoring";
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
  Trophy,
} from "lucide-react";
import { T20_WC_2024_FINAL } from "./data/realMatches/t20Wc2024Final";
import { RealMatchGameSession } from "./engine/realMatchGameSession";
import { RealMatchPlaybackView } from "./components/realMatch/RealMatchPlaybackView";
import type { RealMatchDrsIncident } from "./types/realMatch";
import { CareerDashboard } from "./components/career/CareerDashboard";
import { PreMatchScreen } from "./components/career/PreMatchScreen";
import { MobilePhoneModal } from "./components/career/MobilePhoneModal";
import { MatchReportView } from "./components/career/MatchReportView";
import { CareerEndingModal } from "./components/career/CareerEndingModal";

type AppState =
  | "BRIEFING"
  | "INCIDENT"
  | "CARD_REVEAL"
  | "REAL_MATCH"
  | "REAL_MATCH_REVIEW"
  | "CAREER_DASHBOARD"
  | "CAREER_PRE_MATCH"
  | "CAREER_MATCH"
  | "CAREER_REPORT";

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>("BRIEFING");
  const [sessionScenarios, setSessionScenarios] = useState<Scenario[]>([]);
  const [currentIncidentIndex, setCurrentIncidentIndex] = useState<number>(0);
  const [consolePhase, setConsolePhase] = useState<ConsolePhase>("SOFT_SIGNAL");
  const [gameplayStage, setGameplayStage] = useState<GameplayStage>("INCIDENT_INTRO");
  const [remainingReviews, setRemainingReviews] = useState<RemainingReviews>({ batting: 2, bowling: 2 });
  const thirdUmpireSessionRef = useRef<ThirdUmpireGameSession | null>(null);

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

  // Career Mode state
  const [careerProfile, setCareerProfile] = useState<CareerProfile>(loadCareerProfile);
  const [careerAssignment, setCareerAssignment] = useState<CareerMatchAssignment | null>(null);
  const [careerBettingMarket, setCareerBettingMarket] = useState<BettingMarket | null>(null);
  const [careerBet, setCareerBet] = useState<PreMatchBet | null>(null);
  const [careerBribeOffer, setCareerBribeOffer] = useState<BribeOffer | null>(null);
  const [careerActiveContract, setCareerActiveContract] = useState<CorruptionContract | null>(null);
  const [careerIncidentRecords, setCareerIncidentRecords] = useState<CareerIncidentRecord[]>([]);
  const careerIncidentRecordsRef = useRef<CareerIncidentRecord[]>([]);
  careerIncidentRecordsRef.current = careerIncidentRecords;
  const [careerMatchReport, setCareerMatchReport] = useState<CareerMatchReport | null>(null);
  const [isPhoneOpen, setIsPhoneOpen] = useState<boolean>(false);
  const [careerEndingStatus, setCareerEndingStatus] = useState<"VICTORY" | "TERMINATED" | null>(null);

  const prepareCareerMatchAssignment = (profile: CareerProfile) => {
    const matchNum = profile.matchesCompleted + 1;
    const matchSeed = 42 + matchNum * 99991;
    const assignment = generateMatchAssignment(profile.careerTier, matchNum, 42);
    const market = generateBettingMarket(assignment.matchId, assignment.homeTeam, assignment.awayTeam, matchSeed);
    const bribe = generateBribeOffer(
      assignment.matchId,
      profile.careerTier,
      assignment.homeTeam,
      assignment.awayTeam,
      matchSeed,
      false,
      matchNum
    );

    setCareerAssignment(assignment);
    setCareerBettingMarket(market);
    setCareerBet(null);
    setCareerBribeOffer(bribe);
    setCareerActiveContract(null);
    setCareerIncidentRecords([]);
    careerIncidentRecordsRef.current = [];
    setCareerMatchReport(null);
  };

  const startCareerMode = () => {
    sounds.playRadioChirp();
    const profile = loadCareerProfile();
    setCareerProfile(profile);
    prepareCareerMatchAssignment(profile);
    setAppState("CAREER_DASHBOARD");
  };

  const startRealMatch = (incidentCount: number = 8, startingSeed: number = Date.now()) => {
    sounds.playRadioChirp();
    const session = new RealMatchGameSession(T20_WC_2024_FINAL, startingSeed, { incidentCount });
    realMatchSessionRef.current = session;
    setActiveRealMatchIncident(null);
    setActiveReviewIndex(0);
    setRemainingReviews(session.getRemainingReviews());
    setGameplayStage("INCIDENT_INTRO");
    setAppState("REAL_MATCH");
  };

  const handleEnterRealMatchReview = (incident: RealMatchDrsIncident) => {
    sounds.playRadioChirp();
    setActiveRealMatchIncident(incident);
    setActiveReviewIndex(realMatchSessionRef.current?.getDecisionsHistory().length ?? 0);
    setSoftSignalChoice(null);
    setCurrentIncidentResult(null);
    if (realMatchSessionRef.current) {
      setRemainingReviews(realMatchSessionRef.current.getRemainingReviews());
    }
    setGameplayStage("INCIDENT_INTRO");
    setConsolePhase("SOFT_SIGNAL");
    setAppState("REAL_MATCH_REVIEW");
  };

  // Start new shift
  const startNewShift = (count: number = 8, forcedType?: IncidentType) => {
    sounds.playRadioChirp();
    const sessionSeed = Date.now();
    const scenarios = forcedType
      ? generateSessionIncidents(sessionSeed, count, {
          weights: {
            LBW: forcedType === "LBW" ? 1 : 0,
            RUN_OUT: forcedType === "RUN_OUT" ? 1 : 0,
            CAUGHT_BEHIND: forcedType === "CAUGHT_BEHIND" ? 1 : 0,
            STUMPING: forcedType === "STUMPING" ? 1 : 0,
            BOUNDARY: forcedType === "BOUNDARY" ? 1 : 0,
          },
        })
      : generateSessionIncidents(sessionSeed, count);

    const session = new ThirdUmpireGameSession(scenarios, sessionSeed);
    thirdUmpireSessionRef.current = session;
    setSessionScenarios(scenarios);
    setCurrentIncidentIndex(0);
    setIncidentHistory([]);
    setSoftSignalChoice(null);
    setCurrentIncidentResult(null);
    setRemainingReviews(session.getRemainingReviews());
    setGameplayStage(session.getStage());
    setConsolePhase("SOFT_SIGNAL");
    setAppState("INCIDENT");
  };

  // Start Career Match
  const handleStartCareerMatch = () => {
    if (!careerAssignment) return;
    sounds.playRadioChirp();
    const scenarios = careerAssignment.incidents.map((inc) => inc.scenario);
    const session = new ThirdUmpireGameSession(scenarios, 42 + careerAssignment.matchNumber);
    thirdUmpireSessionRef.current = session;
    setSessionScenarios(scenarios);
    setCurrentIncidentIndex(0);
    setIncidentHistory([]);
    setCareerIncidentRecords([]);
    careerIncidentRecordsRef.current = [];
    setSoftSignalChoice(null);
    setCurrentIncidentResult(null);
    setRemainingReviews(session.getRemainingReviews());
    setGameplayStage(session.getStage());
    setConsolePhase("SOFT_SIGNAL");
    setAppState("CAREER_MATCH");
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sounds.setMuted(next);
  };

  // Stage Transitions
  const handleAdvanceToOnField = () => {
    thirdUmpireSessionRef.current?.advanceToOnFieldDecision();
    setGameplayStage(thirdUmpireSessionRef.current?.getStage() ?? "ON_FIELD_DECISION");
  };

  const handleInitiateReview = () => {
    const ok = thirdUmpireSessionRef.current?.initiateReview();
    if (ok) {
      setGameplayStage(thirdUmpireSessionRef.current?.getStage() ?? "REVIEW_ENTRY");
    }
  };

  const handleEnterWorkstation = () => {
    thirdUmpireSessionRef.current?.enterWorkstation();
    setGameplayStage(thirdUmpireSessionRef.current?.getStage() ?? "REVIEW_ACTIVE");
    setConsolePhase("REVIEW");
  };

  // Phase 1: Soft signal instinct submitted
  const handleSoftSignalSubmit = (
    choice: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS",
    elapsedMs: number
  ) => {
    setSoftSignalChoice(choice);
    setSoftSignalElapsedMs(elapsedMs);
    setReviewStartTime(Date.now());
    thirdUmpireSessionRef.current?.enterWorkstation();
    setGameplayStage(thirdUmpireSessionRef.current?.getStage() ?? "REVIEW_ACTIVE");
    setConsolePhase("REVIEW");
    sounds.playClick(850);
  };

  // Phase 2: Final verdict submitted
  const handleFinalVerdictSubmit = (
    verdict: DecisionVerdict | PlayerVerdictChoice,
    _dismissalReason: string,
    playerTimings?: { playerBatGroundedMs: number | null; playerBailsDislodgedMs: number | null },
    softSignalOverride?: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS",
    elapsedMsOverride?: number
  ) => {
    if (consolePhase === "RESULT") {
      return;
    }

    const isRealMatchReview = appState === "REAL_MATCH_REVIEW" && activeRealMatchIncident !== null;
    const isCareerReview = appState === "CAREER_MATCH" && careerAssignment !== null;

    if (!isRealMatchReview && thirdUmpireSessionRef.current) {
      if (thirdUmpireSessionRef.current.isDecided()) {
        return;
      }
      const effectiveSoft = softSignalOverride ?? softSignalChoice;
      const effectiveElapsed = elapsedMsOverride ?? softSignalElapsedMs;
      const res = thirdUmpireSessionRef.current.submitVerdict(verdict, {
        dismissalReason: _dismissalReason,
        playerBatGroundedMs: playerTimings?.playerBatGroundedMs,
        playerBailsDislodgedMs: playerTimings?.playerBailsDislodgedMs,
        softSignalChoice: effectiveSoft,
        softSignalElapsedMs: effectiveElapsed,
      });
      if (res) {
        setCurrentIncidentResult(res);
        setIncidentHistory((prev) => [...prev, res]);
        setRemainingReviews(thirdUmpireSessionRef.current.getRemainingReviews());
        setGameplayStage(thirdUmpireSessionRef.current.getStage());
        setConsolePhase("RESULT");

        // Handle Career Incident Recording
        if (isCareerReview && careerAssignment) {
          const currentInc = careerAssignment.incidents[currentIncidentIndex];
          if (currentInc) {
            let corruptFavor = false;
            if (careerActiveContract && !careerActiveContract.fulfilled) {
              const isCorrupt = evaluateCorruptDecision(
                careerActiveContract,
                currentInc,
                res.finalVerdict
              );
              if (isCorrupt) {
                corruptFavor = true;
                setCareerActiveContract((prev) =>
                  prev
                    ? {
                        ...prev,
                        fulfilled: true,
                        benefitedDecisionScenarioId: currentInc.scenario.id,
                      }
                    : null
                );
              }
            }

            const fanDelta = calculateFanImpact(
              res.finalVerdictCorrect,
              currentInc.criticalMoment,
              careerAssignment.matchImportance,
              currentInc.isMatchDecided ?? false
            );
            const criticDelta = calculateCriticImpact(
              res.finalVerdictCorrect,
              currentInc.scenario.difficultyTier,
              currentInc.scenario.drsEvaluation.isUmpiresCall,
              res.umpiresCallComplied
            );

            const rec: CareerIncidentRecord = {
              incident: currentInc,
              result: res,
              isCorrect: res.finalVerdictCorrect,
              fanDelta,
              criticDelta,
              corruptFavorAwarded: corruptFavor,
            };
            careerIncidentRecordsRef.current = [...careerIncidentRecordsRef.current, rec];
            setCareerIncidentRecords((prev) => [...prev, rec]);
          }
        }
        return;
      }
    }

    const currentScenario = isRealMatchReview
      ? activeRealMatchIncident.scenario
      : sessionScenarios[currentIncidentIndex];

    if (!currentScenario) return;

    const effectiveVerdict: DecisionVerdict =
      verdict === "SEND_UPSTAIRS"
        ? (currentScenario.onFieldSignal === "OUT" ? "OUT" : "NOT_OUT")
        : (verdict as DecisionVerdict);

    if (isRealMatchReview && realMatchSessionRef.current) {
      const customReason =
        _dismissalReason &&
        _dismissalReason.trim() !== "" &&
        _dismissalReason.trim().toUpperCase() !== "STANDARD"
          ? _dismissalReason.trim()
          : undefined;
      realMatchSessionRef.current.submitDecision(effectiveVerdict, {
        reason: customReason,
      });
      setRemainingReviews(realMatchSessionRef.current.getRemainingReviews());
    }

    const isVerdictCorrect = effectiveVerdict === currentScenario.correctFinalVerdict;
    const effectiveSoftSignal = softSignalOverride ?? softSignalChoice;
    const effectiveSoftElapsed = elapsedMsOverride ?? softSignalElapsedMs;

    const isSoftCorrect =
      effectiveSoftSignal !== null &&
      effectiveSoftSignal !== "SEND_UPSTAIRS" &&
      effectiveSoftSignal === currentScenario.correctFinalVerdict;

    const compliance = checkDRSCompliance(
      currentScenario.incidentType,
      effectiveVerdict,
      currentScenario.onFieldSignal,
      currentScenario.drsEvaluation
    );

    const result: IncidentResult = {
      scenarioId: currentScenario.id,
      incidentType: currentScenario.incidentType,
      difficultyTier: currentScenario.difficultyTier,
      playerVerdictChoice: verdict,
      softSignal: effectiveSoftSignal,
      softSignalTimeMs: effectiveSoftElapsed,
      softSignalCorrect: isSoftCorrect,
      finalVerdict: effectiveVerdict,
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
    setGameplayStage("RESULT_REVEAL");
    setConsolePhase("RESULT");
  };

  const handleNextIncident = () => {
    if (appState === "REAL_MATCH_REVIEW") {
      setActiveRealMatchIncident(null);
      setCurrentIncidentResult(null);
      setSoftSignalChoice(null);
      setGameplayStage("INCIDENT_INTRO");
      setAppState("REAL_MATCH");
      return;
    }

    if (appState === "CAREER_MATCH") {
      if (thirdUmpireSessionRef.current) {
        const hasNext = thirdUmpireSessionRef.current.nextIncident();
        if (hasNext) {
          setCurrentIncidentIndex(thirdUmpireSessionRef.current.getCurrentIndex());
          setSoftSignalChoice(null);
          setCurrentIncidentResult(null);
          setGameplayStage(thirdUmpireSessionRef.current.getStage());
          setConsolePhase("SOFT_SIGNAL");
        } else {
          // Career Match Completed! Consolidate report
          if (careerAssignment) {
            const records = careerIncidentRecordsRef.current;
            const report = computeCareerMatchReport(
              careerAssignment,
              records,
              careerBet,
              careerActiveContract,
              careerProfile,
              42 + careerAssignment.matchNumber * 99991
            );
            const updated = applyCareerMatchReport(careerProfile, report);
            setCareerProfile(updated);
            setCareerMatchReport(report);
            setAppState("CAREER_REPORT");
          }
        }
      }
      return;
    }

    if (thirdUmpireSessionRef.current) {
      const hasNext = thirdUmpireSessionRef.current.nextIncident();
      if (hasNext) {
        setCurrentIncidentIndex(thirdUmpireSessionRef.current.getCurrentIndex());
        setSoftSignalChoice(null);
        setCurrentIncidentResult(null);
        setGameplayStage(thirdUmpireSessionRef.current.getStage());
        setConsolePhase("SOFT_SIGNAL");
      } else {
        const stats = thirdUmpireSessionRef.current.computeStats();
        setSessionStats(stats);
        setGameplayStage("SESSION_COMPLETE");
        setAppState("CARD_REVEAL");
      }
      return;
    }

    const nextIndex = currentIncidentIndex + 1;
    if (nextIndex < sessionScenarios.length) {
      setCurrentIncidentIndex(nextIndex);
      setSoftSignalChoice(null);
      setCurrentIncidentResult(null);
      setGameplayStage("INCIDENT_INTRO");
      setConsolePhase("SOFT_SIGNAL");
    } else {
      const stats = computeSessionStats(incidentHistory);
      setSessionStats(stats);
      setGameplayStage("SESSION_COMPLETE");
      setAppState("CARD_REVEAL");
    }
  };

  const handleContinueFromReport = () => {
    if (!careerMatchReport) return;
    if (careerMatchReport.careerTerminated) {
      setCareerEndingStatus("TERMINATED");
      return;
    }
    if (careerMatchReport.careerWinAchieved) {
      setCareerEndingStatus("VICTORY");
      return;
    }
    const current = loadCareerProfile();
    prepareCareerMatchAssignment(current);
    setAppState("CAREER_DASHBOARD");
  };

  const handleResetCareer = () => {
    const fresh = resetCareerProfile();
    setCareerProfile(fresh);
    prepareCareerMatchAssignment(fresh);
    setCareerEndingStatus(null);
    setAppState("CAREER_DASHBOARD");
  };

  const submitFinalVerdictRef = useRef(handleFinalVerdictSubmit);
  submitFinalVerdictRef.current = handleFinalVerdictSubmit;
  const setSoftSignalChoiceRef = useRef(setSoftSignalChoice);
  setSoftSignalChoiceRef.current = setSoftSignalChoice;
  const setSoftSignalElapsedMsRef = useRef(setSoftSignalElapsedMs);
  setSoftSignalElapsedMsRef.current = setSoftSignalElapsedMs;
  const remainingReviewsRef = useRef(remainingReviews);
  remainingReviewsRef.current = remainingReviews;
  const gameplayStageRef = useRef(gameplayStage);
  gameplayStageRef.current = gameplayStage;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as any).__startIncident = (
      type: IncidentType,
      seed: number = Date.now(),
      totalCount: number = 1,
      options?: { startingReviews?: { batting: number; bowling: number } }
    ) => {
      const scenario = generateScenario(seed, type);
      const scenarios =
        totalCount > 1
          ? [scenario, ...Array.from({ length: totalCount - 1 }, (_, i) => generateScenario(seed + i + 1, type))]
          : [scenario];
      const session = new ThirdUmpireGameSession(scenarios, seed, options);
      thirdUmpireSessionRef.current = session;
      setSessionScenarios(scenarios);
      setCurrentIncidentIndex(0);
      setIncidentHistory([]);
      setSoftSignalChoice(null);
      setCurrentIncidentResult(null);
      setRemainingReviews(session.getRemainingReviews());
      setGameplayStage(session.getStage());
      setConsolePhase("SOFT_SIGNAL");
      setAppState("INCIDENT");
    };
    (window as any).__startSession = (seed: number = Date.now(), count: number = 8) => {
      const scenarios = generateSessionIncidents(seed, count);
      const session = new ThirdUmpireGameSession(scenarios, seed);
      thirdUmpireSessionRef.current = session;
      setSessionScenarios(scenarios);
      setCurrentIncidentIndex(0);
      setIncidentHistory([]);
      setSoftSignalChoice(null);
      setCurrentIncidentResult(null);
      setRemainingReviews(session.getRemainingReviews());
      setGameplayStage(session.getStage());
      setConsolePhase("SOFT_SIGNAL");
      setAppState("INCIDENT");
    };
    (window as any).__setPhase = (phase: ConsolePhase) => {
      setConsolePhase(phase);
    };
    (window as any).__setStage = (stage: GameplayStage) => {
      thirdUmpireSessionRef.current?.setStage(stage);
      setGameplayStage(stage);
    };
    (window as any).__submitVerdict = (
      verdict: DecisionVerdict | PlayerVerdictChoice,
      softSignal: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS" = "NOT_OUT",
      elapsedMs: number = 4000
    ) => {
      setSoftSignalChoiceRef.current(softSignal);
      setSoftSignalElapsedMsRef.current(elapsedMs);
      submitFinalVerdictRef.current(verdict, "Test evaluation", undefined, softSignal, elapsedMs);
    };
    (window as any).__startRealMatch = (seed: number = Date.now(), incidentCount: number = 8) => {
      startRealMatch(incidentCount, seed);
    };
    (window as any).__startCareerMode = () => startCareerMode();
    (window as any).__getCareerProfile = () => careerProfile;
    (window as any).__setCareerProfile = (override: Partial<CareerProfile>) => {
      setCareerProfile((prev) => {
        const updated = { ...prev, ...override };
        saveCareerProfile(updated);
        return updated;
      });
    };
    (window as any).__getCareerAssignment = () => careerAssignment;
    (window as any).__openPhone = (open: boolean = true) => setIsPhoneOpen(open);
    (window as any).__setCareerEnding = (status: "VICTORY" | "TERMINATED" | null) =>
      setCareerEndingStatus(status);
    (window as any).__getRealMatchSession = () => realMatchSessionRef.current;
    (window as any).__getGameSession = () => thirdUmpireSessionRef.current;
    (window as any).__getRemainingReviews = () => remainingReviewsRef.current;
    (window as any).__getGameplayStage = () =>
      thirdUmpireSessionRef.current?.getStage() ?? gameplayStageRef.current;
    (window as any).__setTrainingMode = (on: boolean) => setTrainingMode(on);
  }, [careerProfile, careerAssignment]);

  // Modal: Phone
  const renderPhoneModal = () => (
    <MobilePhoneModal
      profile={careerProfile}
      isOpen={isPhoneOpen}
      onClose={() => setIsPhoneOpen(false)}
      bettingMarket={careerBettingMarket}
      currentBet={careerBet}
      onPlaceBet={(bet) => setCareerBet(bet)}
      bribeOffer={careerBribeOffer}
      activeContract={careerActiveContract}
      onAcceptBribe={(contract) => {
        setCareerActiveContract(contract);
        setCareerBribeOffer((prev) => (prev ? { ...prev, status: "ACCEPTED" } : null));
      }}
      onDeclineBribe={() => {
        setCareerBribeOffer((prev) => (prev ? { ...prev, status: "DECLINED" } : null));
      }}
      isMatchLive={appState === "CAREER_MATCH"}
    />
  );

  // Modal: Career Ending
  const renderEndingModal = () => {
    if (!careerEndingStatus) return null;
    return (
      <CareerEndingModal
        profile={careerProfile}
        isVictory={careerEndingStatus === "VICTORY"}
        onRestartCareer={handleResetCareer}
        onDismiss={() => setCareerEndingStatus(null)}
      />
    );
  };

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
              title={isMuted ? "Unmute audio" : "Mute audio"}
              aria-label={isMuted ? "Unmute audio" : "Mute audio"}
              className="p-1.5 rounded-lg bg-[#141B28] hover:bg-[#1E283C] text-slate-400 hover:text-white border border-[#243147] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} className="text-emerald-400" />}
            </button>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-4xl sm:text-5xl font-black font-display tracking-wide text-white uppercase">
              THIRD UMPIRE ROOM
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
              Step into the television broadcast control room. Officiate multi-tier league fixtures, manage fan & critic reputation, earn match fees, navigate illicit temptations, and amass ₹1,000,000.
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
          <div className="space-y-3 pt-2">
            {/* Primary Hero: LEAGUE UMPIRE CAREER MODE */}
            <button
              type="button"
              onClick={startCareerMode}
              className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm flex items-center justify-center space-x-2.5 shadow-xl border border-emerald-300/40 transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer"
              title="Embark on an authentic multi-tier league umpire career with reputation, wagers, and corruption"
            >
              <Trophy size={18} />
              <span>PLAY LEAGUE UMPIRE CAREER MODE</span>
            </button>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={() => startRealMatch(8)}
                className="py-3 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md border border-amber-400/40 transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer"
                title="Play through the verified 2024 ICC T20 World Cup Final with live DRS incident injection"
              >
                <Tv size={14} />
                <span>REAL MATCH</span>
              </button>

              <button
                type="button"
                onClick={() => startNewShift(8)}
                className="flex-1 py-3 px-3 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-black text-xs flex items-center justify-center space-x-1.5 shadow-md border border-white/20 transition-all active:scale-95 font-display uppercase tracking-wider cursor-pointer"
              >
                <Play size={14} fill="currentColor" />
                <span>SHIFT (8)</span>
              </button>

              <button
                type="button"
                onClick={() => startNewShift(5)}
                className="py-3 px-3 rounded-xl bg-[#141B28] hover:bg-[#1E283C] text-slate-200 border border-[#243147] font-black text-xs flex items-center justify-center space-x-1.5 transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer"
              >
                <Zap size={14} className="text-amber-400" />
                <span>RAPID (5)</span>
              </button>

              <button
                type="button"
                onClick={() => setTrainingMode((t) => !t)}
                className={`py-3 px-3 rounded-xl font-black text-xs flex items-center justify-center space-x-1.5 border transition-all active:scale-95 uppercase font-display tracking-wider cursor-pointer ${
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
      </div>
    );
  }

  // 2. CAREER DASHBOARD
  if (appState === "CAREER_DASHBOARD" && careerAssignment) {
    return (
      <>
        <CareerDashboard
          profile={careerProfile}
          nextAssignment={careerAssignment}
          onProceedToPreMatch={() => setAppState("CAREER_PRE_MATCH")}
          onOpenPhone={() => setIsPhoneOpen(true)}
          onResetCareer={handleResetCareer}
          onExitToMainMenu={() => setAppState("BRIEFING")}
          currentBet={careerBet}
          bribeOffer={careerBribeOffer}
          activeContract={careerActiveContract}
        />
        {renderPhoneModal()}
        {renderEndingModal()}
      </>
    );
  }

  // 3. CAREER PRE-MATCH BRIEFING
  if (appState === "CAREER_PRE_MATCH" && careerAssignment) {
    return (
      <>
        <PreMatchScreen
          profile={careerProfile}
          assignment={careerAssignment}
          onStartMatch={handleStartCareerMatch}
          onBackToDashboard={() => setAppState("CAREER_DASHBOARD")}
          onOpenPhone={() => setIsPhoneOpen(true)}
          currentBet={careerBet}
          bribeOffer={careerBribeOffer}
          activeContract={careerActiveContract}
        />
        {renderPhoneModal()}
        {renderEndingModal()}
      </>
    );
  }

  // 4. CAREER DRS MATCH CONSOLE (LBW Vertical Slice)
  if (appState === "CAREER_MATCH" && careerAssignment) {
    const currentInc = careerAssignment.incidents[currentIncidentIndex];
    return (
      <>
        <ConsoleLayout
          scenario={currentInc?.scenario ?? sessionScenarios[currentIncidentIndex]}
          phase={consolePhase}
          gameplayStage={gameplayStage}
          incidentIndex={currentIncidentIndex}
          totalIncidents={careerAssignment.incidentCount}
          isMuted={isMuted}
          currentResult={currentIncidentResult}
          onToggleMute={handleToggleMute}
          onAdvanceToOnField={handleAdvanceToOnField}
          onInitiateReview={handleInitiateReview}
          onEnterWorkstation={handleEnterWorkstation}
          onSoftSignalSubmit={handleSoftSignalSubmit}
          onFinalVerdictSubmit={handleFinalVerdictSubmit}
          onNextIncident={handleNextIncident}
          trainingMode={trainingMode}
          remainingReviews={remainingReviews}
        />
        {renderPhoneModal()}
        {renderEndingModal()}
      </>
    );
  }

  // 5. CAREER MATCH REPORT
  if (appState === "CAREER_REPORT" && careerMatchReport) {
    return (
      <>
        <MatchReportView
          report={careerMatchReport}
          onContinue={handleContinueFromReport}
        />
        {renderEndingModal()}
      </>
    );
  }

  // 6. ACTIVE INCIDENT CONSOLE (RAPID / REVIEW SHIFT)
  if (appState === "INCIDENT") {
    const currentScenario = sessionScenarios[currentIncidentIndex];
    return (
      <ConsoleLayout
        scenario={currentScenario}
        phase={consolePhase}
        gameplayStage={gameplayStage}
        incidentIndex={currentIncidentIndex}
        totalIncidents={sessionScenarios.length}
        isMuted={isMuted}
        currentResult={currentIncidentResult}
        onToggleMute={handleToggleMute}
        onAdvanceToOnField={handleAdvanceToOnField}
        onInitiateReview={handleInitiateReview}
        onEnterWorkstation={handleEnterWorkstation}
        onSoftSignalSubmit={handleSoftSignalSubmit}
        onFinalVerdictSubmit={handleFinalVerdictSubmit}
        onNextIncident={handleNextIncident}
        trainingMode={trainingMode}
        remainingReviews={remainingReviews}
      />
    );
  }

  // 7. REAL MATCH DRS PLAYBACK VIEW
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

  // 8. REAL MATCH DRS REVIEW (reuses ConsoleLayout!)
  if (appState === "REAL_MATCH_REVIEW" && activeRealMatchIncident) {
    return (
      <ConsoleLayout
        scenario={activeRealMatchIncident.scenario}
        phase={consolePhase}
        gameplayStage={gameplayStage}
        incidentIndex={activeReviewIndex}
        totalIncidents={realMatchSessionRef.current?.incidentCount ?? 8}
        isMuted={isMuted}
        currentResult={currentIncidentResult}
        onToggleMute={handleToggleMute}
        onAdvanceToOnField={handleAdvanceToOnField}
        onInitiateReview={handleInitiateReview}
        onEnterWorkstation={handleEnterWorkstation}
        onSoftSignalSubmit={handleSoftSignalSubmit}
        onFinalVerdictSubmit={handleFinalVerdictSubmit}
        onNextIncident={handleNextIncident}
        trainingMode={trainingMode}
        isRealMatch={true}
        remainingReviews={remainingReviews}
      />
    );
  }

  // 9. SESSION COMPLETE & CARD EXPORT
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
