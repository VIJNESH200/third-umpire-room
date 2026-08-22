import React, { useState, useEffect, useRef } from "react";
import type {
  Scenario,
  DecisionVerdict,
  IncidentResult,
} from "../../types/scenario";
import { MatchLogBar } from "./MatchLogBar";
import { ReplayViewport } from "./ReplayViewport";
import { ScrubBar, KeyframeMarker } from "./ScrubBar";
import { ToolPalette } from "./ToolPalette";
import { SoftSignalBar } from "./SoftSignalBar";
import { VerdictPanel } from "./VerdictPanel";
import { ResultReveal } from "./ResultReveal";
import { IncidentReplayFeed } from "../instinct/IncidentReplayFeed";
import { sounds } from "../../engine/audioSynth";
import { Tv, Radio, Crosshair, Clock } from "lucide-react";

export type ConsolePhase = "SOFT_SIGNAL" | "REVIEW" | "RESULT";

interface ConsoleLayoutProps {
  scenario: Scenario;
  phase: ConsolePhase;
  incidentIndex: number;
  totalIncidents: number;
  isMuted: boolean;
  currentResult: IncidentResult | null;
  onToggleMute: () => void;
  onSoftSignalSubmit: (choice: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS", elapsedMs: number) => void;
  onFinalVerdictSubmit: (
    verdict: DecisionVerdict,
    dismissalReason: string,
    playerTimings?: { playerBatGroundedMs: number | null; playerBailsDislodgedMs: number | null }
  ) => void;
  onNextIncident: () => void;
  trainingMode?: boolean;
}

export const ConsoleLayout: React.FC<ConsoleLayoutProps> = ({
  scenario,
  phase,
  incidentIndex,
  totalIncidents,
  isMuted,
  currentResult,
  onToggleMute,
  onSoftSignalSubmit,
  onFinalVerdictSubmit,
  onNextIncident,
  trainingMode = false,
}) => {
  // Get initial primary tool for scenario
  const getDefaultTool = (type: string) => {
    switch (type) {
      case "LBW": return "BROADCAST_FRONT";
      case "RUN_OUT":
      case "STUMPING": return "CREASE_ZOOM";
      case "CAUGHT_BEHIND": return "ULTRAEDGE";
      case "BOUNDARY": return "BOUNDARY_ZOOM";
      default: return "BROADCAST_FRONT";
    }
  };

  const [activeTool, setActiveTool] = useState<string>(() => getDefaultTool(scenario.incidentType));

  // Player Manual Forensic Evidence Markers for Run-Out / Stumping
  const [playerBatGroundedMs, setPlayerBatGroundedMs] = useState<number | null>(null);
  const [playerBailsDislodgedMs, setPlayerBailsDislodgedMs] = useState<number | null>(null);

  // Task 7 — LBW evidence review states. Transmission is gated (normal mode)
  // until the player has genuinely inspected each forensic feed: transport
  // interaction on CAM 01 (replay), and at least one manual Hawk-Eye stage reveal
  // on CAM 03 (ball track).
  const [replayReviewed, setReplayReviewed] = useState<boolean>(false);
  const [trackReviewed, setTrackReviewed] = useState<boolean>(false);
  const isLbwReview = scenario.incidentType === "LBW" && phase === "REVIEW";

  // Reset active tool & markers whenever scenario changes
  useEffect(() => {
    setActiveTool(getDefaultTool(scenario.incidentType));
    setCurrentTimeMs(1200);
    stopTransportLoop();
    setIsPlaying(false);
    setIsRockAndRoll(false);
    setPlayerBatGroundedMs(null);
    setPlayerBailsDislodgedMs(null);
    setReplayReviewed(false);
    setTrackReviewed(false);
  }, [scenario.id, scenario.incidentType]);

  // Central Shared Timeline & Transport Engine
  const minTimeMs = 600;
  const maxTimeMs = 2200;
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(1200);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRockAndRoll, setIsRockAndRoll] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.5);
  const [scanlinesEnabled, setScanlinesEnabled] = useState<boolean>(true);
  // Mirror of the last committed canonical time. Used to re-assert a known-good
  // timestamp whenever the transport halts (see pauseTransport below).
  const currentTimeMsRef = useRef<number>(1200);
  useEffect(() => {
    currentTimeMsRef.current = currentTimeMs;
  }, [currentTimeMs]);

  // Derive logical frame rate from active camera feed
  const getActiveCameraFps = (tool: string): number => {
    if (tool === "CREASE_ZOOM" || tool === "STUMP_CAM") return 500; // 500 FPS High Speed Camera (1 frame = 2ms)
    if (tool === "SUPER_SLOW_MO") return 1000; // 1000 FPS Ultra Motion (1 frame = 1ms)
    if (tool === "BOUNDARY_ZOOM") return 120; // 120 FPS High Speed (1 frame = 8.33ms)
    return 50; // Standard 50 FPS broadcast (1 frame = 20ms)
  };

  const currentFps = getActiveCameraFps(activeTool);
  const frameStepMs = 1000 / currentFps;

  // Rock & Roll Direction: 1 = forward, -1 = reverse
  const rnrDirectionRef = useRef<number>(1);
  const animFrameRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(performance.now());
  // State drives the controls; these refs synchronously stop a queued frame
  // before a Run-Out step or camera switch can advance the canonical clock.
  const playbackIntentRef = useRef<boolean>(false);
  const rockAndRollIntentRef = useRef<boolean>(false);
  // Monotonic transport generation. Every Run-Out start/stop increments it so a
  // clock update queued by a killed animation frame is recognized as stale and
  // discarded instead of leaking into a later unrelated render (e.g. changing
  // the timestamp when switching Run-Out cameras after Rock & Roll).
  const transportEpochRef = useRef<number>(0);

  const stopTransportLoop = () => {
    transportEpochRef.current += 1;
    playbackIntentRef.current = false;
    rockAndRollIntentRef.current = false;
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const pauseTransport = () => {
    stopTransportLoop();
    setIsPlaying(false);
    setIsRockAndRoll(false);
    // Re-assert the last committed canonical time AFTER invalidating queued
    // updates. React applies queued updaters in order, so this absolute set is
    // applied last and overrides any stale clock update that slipped through,
    // guaranteeing a halt (pause / step / scrub / camera switch) never changes
    // the visible Run-Out timestamp.
    setCurrentTimeMs(currentTimeMsRef.current);
  };

  // Determine key focal event timestamp for Rock & Roll shuttle looping
  const getFocalEventTimeMs = (): number => {
    if (scenario.incidentType === "RUN_OUT" && scenario.runOut) {
      return scenario.runOut.bailsDislodgedFrameMs;
    }
    if (scenario.incidentType === "CAUGHT_BEHIND" && scenario.caughtBehind) {
      return scenario.caughtBehind.ballPassesBatFrameMs;
    }
    if (scenario.incidentType === "BOUNDARY" && scenario.boundary) {
      return scenario.boundary.ropeContactFrameMs;
    }
    if (scenario.incidentType === "LBW") {
      return 1500; // Pad impact frame
    }
    return 1400;
  };

  // High-Precision Real-time Transport Animation Loop
  useEffect(() => {
    const isRunOutTransport = scenario.incidentType === "RUN_OUT";
    if (!isPlaying && !isRockAndRoll) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastTimestampRef.current = performance.now();

    // Queue a canonical-clock update. For Run-Out, each queued updater captures
    // the current transport generation and no-ops if it was superseded between
    // frame execution and React's flush (PAUSE / camera switch in the same
    // tick). Non-Run-Out incident types keep the original direct update.
    const queueReplayClockUpdate = (computeNext: (prev: number) => number) => {
      if (!isRunOutTransport) {
        setCurrentTimeMs(computeNext);
        return;
      }
      const epochAtSchedule = transportEpochRef.current;
      setCurrentTimeMs((prev) =>
        epochAtSchedule !== transportEpochRef.current ? prev : computeNext(prev)
      );
    };

    const loop = (now: number) => {
      if (isRunOutTransport && !playbackIntentRef.current && !rockAndRollIntentRef.current) {
        animFrameRef.current = null;
        return;
      }
      const deltaRealMs = now - lastTimestampRef.current;
      lastTimestampRef.current = now;

      if (isRunOutTransport ? playbackIntentRef.current : isPlaying) {
        // Linear forward replay at chosen playback speed
        const deltaReplayMs = deltaRealMs * playbackSpeed;
        queueReplayClockUpdate((prev) => {
          const next = prev + deltaReplayMs;
          if (next >= maxTimeMs) {
            return minTimeMs; // Seamless broadcast loop
          }
          return next;
        });
      } else if (isRunOutTransport ? rockAndRollIntentRef.current : isRockAndRoll) {
        // Shuttle oscillation around the focal incident frame (+/- 160ms)
        const focalTime = getFocalEventTimeMs();
        const rnrMin = Math.max(minTimeMs, focalTime - 160);
        const rnrMax = Math.min(maxTimeMs, focalTime + 160);
        const deltaReplayMs = deltaRealMs * playbackSpeed * 0.45 * rnrDirectionRef.current;

        queueReplayClockUpdate((prev) => {
          let next = prev + deltaReplayMs;
          if (next >= rnrMax) {
            rnrDirectionRef.current = -1;
            next = rnrMax;
          } else if (next <= rnrMin) {
            rnrDirectionRef.current = 1;
            next = rnrMin;
          }
          return next;
        });
      }

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isRockAndRoll, playbackSpeed, maxTimeMs, minTimeMs, scenario]);

  // Task 7 — mark genuine review interaction: transport actions (play, step,
  // seek, shuttle, scrub) taken while CAM 01 is active count as having
  // reviewed the replay feed.
  const markTransportReview = () => {
    if (!isLbwReview || trainingMode) return;
    if (activeTool === "BROADCAST_FRONT") setReplayReviewed(true);
  };

  // Task 5B — Hawk-Eye manual stage reveals count as ball-track review
  const handleStageChange = (stage: number) => {
    if (isLbwReview && !trainingMode && stage >= 1) setTrackReviewed(true);
  };

  // Frame Stepping (scaled to active feed's FPS: 500fps -> 2ms/frame, 50fps -> 20ms/frame)
  const handleStep = (frames: number) => {
    if (scenario.incidentType === "RUN_OUT") {
      pauseTransport();
    } else {
      setIsPlaying(false);
      setIsRockAndRoll(false);
    }
    markTransportReview();
    const stepDeltaMs = frames * frameStepMs;
    setCurrentTimeMs((prev) => Math.max(minTimeMs, Math.min(maxTimeMs, prev + stepDeltaMs)));
    sounds.playClick(850 + frames * 30);
  };

  const togglePlay = () => {
    if (scenario.incidentType === "RUN_OUT") {
      const nextPlaying = !playbackIntentRef.current;
      pauseTransport();
      playbackIntentRef.current = nextPlaying;
      setIsRockAndRoll(false);
      setIsPlaying(nextPlaying);
    } else {
      setIsRockAndRoll(false);
      setIsPlaying((playing) => !playing);
    }
    markTransportReview();
    sounds.playClick(750);
  };

  const toggleRockAndRoll = () => {
    if (scenario.incidentType === "RUN_OUT") {
      const nextRockAndRoll = !rockAndRollIntentRef.current;
      pauseTransport();
      rockAndRollIntentRef.current = nextRockAndRoll;
      setIsPlaying(false);
      setIsRockAndRoll(nextRockAndRoll);
    } else {
      setIsPlaying(false);
      setIsRockAndRoll((rocking) => !rocking);
    }
    markTransportReview();
    sounds.playClick(850);
  };

  const handleTimeChange = (newTimeMs: number) => {
    if (scenario.incidentType === "RUN_OUT") pauseTransport();
    markTransportReview();
    setCurrentTimeMs(Math.max(minTimeMs, Math.min(maxTimeMs, newTimeMs)));
  };

  const handleToolSelect = (tool: string) => {
    // Run-Out camera feeds are alternate projections of the current physical
    // state. Switching freezes that state; it never seeks or reinitializes it.
    if (scenario.incidentType === "RUN_OUT") pauseTransport();
    setActiveTool(tool);
  };

  // Comprehensive Event Keyframe Markers
  const getKeyframeMarkers = (): KeyframeMarker[] => {
    if (scenario.incidentType === "LBW") {
      return [
        { label: "Bowler Release", timeMs: 800, color: "#38BDF8" },
        { label: "Pitch Bounce", timeMs: 1200, color: "#FACC15" },
        { label: "Pad Impact", timeMs: 1500, color: "#EF4444" },
      ];
    }
    if (scenario.incidentType === "RUN_OUT" || scenario.incidentType === "STUMPING") {
      const markers: KeyframeMarker[] = [];
      if (playerBatGroundedMs !== null) {
        const frameNum = Math.round((playerBatGroundedMs / 1000) * currentFps);
        markers.push({
          label: `Bat Grounded (F${frameNum})`,
          timeMs: playerBatGroundedMs,
          color: "#38BDF8",
        });
      }
      if (playerBailsDislodgedMs !== null) {
        const frameNum = Math.round((playerBailsDislodgedMs / 1000) * currentFps);
        markers.push({
          label: `Bails Dislodged (F${frameNum})`,
          timeMs: playerBailsDislodgedMs,
          color: "#FACC15",
        });
      }
      return markers;
    }
    if (scenario.incidentType === "CAUGHT_BEHIND" && scenario.caughtBehind) {
      const markers: KeyframeMarker[] = [
        { label: "Ball Passing Bat", timeMs: scenario.caughtBehind.ballPassesBatFrameMs, color: "#00E5FF" },
      ];
      if (scenario.caughtBehind.waveformSpikeTimeMs) {
        markers.push({ label: "UltraEdge Spike", timeMs: scenario.caughtBehind.waveformSpikeTimeMs, color: "#EC4899" });
      }
      if (scenario.caughtBehind.distractorTimeMs) {
        markers.push({ label: "Pad Sound", timeMs: scenario.caughtBehind.distractorTimeMs, color: "#F59E0B" });
      }
      return markers;
    }
    if (scenario.incidentType === "BOUNDARY" && scenario.boundary) {
      return [
        { label: "Rope Contact", timeMs: scenario.boundary.ropeContactFrameMs, color: "#FF2E4C" },
        { label: "Ball Release", timeMs: scenario.boundary.releaseFrameMs, color: "#00E676" },
      ];
    }
    return [];
  };

  const getIncidentLabel = () => {
    switch (scenario.incidentType) {
      case "LBW": return "LBW APPEAL";
      case "RUN_OUT": return "RUN OUT REFERRAL";
      case "STUMPING": return "STUMPING REFERRAL";
      case "CAUGHT_BEHIND": return "CAUGHT BEHIND APPEAL";
      case "BOUNDARY": return "BOUNDARY CHECK";
      default: return "REVIEW";
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-screen bg-[#05070B] text-slate-100 overflow-hidden font-mono select-none console-chassis">
      {/* Optional CRT Scanline Overlay */}
      {scanlinesEnabled && (
        <div className="pointer-events-none absolute inset-0 z-50 scanlines-overlay opacity-25 mix-blend-overlay" />
      )}

      {/* Top Match Log Bar (Blinded during Phase 1) */}
      <MatchLogBar
        matchContext={scenario.matchContext}
        difficultyTier={scenario.difficultyTier}
        incidentIndex={incidentIndex}
        totalIncidents={totalIncidents}
        isMuted={isMuted}
        isBlinded={phase === "SOFT_SIGNAL"}
        onToggleMute={onToggleMute}
      />

      {/* Physical Workstation Tally Strip */}
      <div className="hardware-panel border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-xs text-slate-400 shrink-0">
        <div className="flex items-center space-x-3">
          {/* Hex Bolt */}
          <div className="hex-screw" />

          {/* Active Broadcast Tally Lamp */}
          <div className="flex items-center space-x-2 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                phase === "SOFT_SIGNAL"
                  ? "tally-lamp-amber animate-ping"
                  : phase === "REVIEW"
                  ? "tally-lamp-red animate-pulse"
                  : "tally-lamp-green"
              }`}
            />
            <span className="font-bold text-[11px] text-slate-200 tracking-wider font-display">
              {phase === "SOFT_SIGNAL"
                ? "PHASE 1: INITIAL REVIEW"
                : phase === "REVIEW"
                ? "PHASE 2: ON-AIR REVIEW ACTIVE"
                : "PHASE 3: VERDICT TRANSMITTED"}
            </span>
          </div>

          <span className="text-slate-600">|</span>

          <span className="text-slate-300 font-bold truncate max-w-[320px] sm:max-w-lg">
            {scenario.incidentTitle}
          </span>
        </div>

        {/* Workstation CRT & Lighting Tools */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setScanlinesEnabled(!scanlinesEnabled)}
            className={`tactical-btn px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1.5 transition-colors ${
              scanlinesEnabled
                ? "bg-cyan-950/60 border-cyan-500/60 text-cyan-300"
                : "text-slate-500"
            }`}
          >
            <Tv size={11} />
            <span>CRT SCANLINES</span>
          </button>

          {/* Hex Bolt */}
          <div className="hex-screw" />
        </div>
      </div>

      {/* Main Review Room Workstation Console (Split View) */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 overflow-y-auto min-h-0">
        {/* Left Column (8 Cols): Replay Viewport / Soft Signal / Result */}
        <div className="lg:col-span-8 flex flex-col gap-2.5 min-h-0">
          {phase === "SOFT_SIGNAL" ? (
            /* PHASE 1: INSTINCT / INITIAL REVIEW */
            <div className="flex flex-col flex-1 gap-3 min-h-0">
              <div className="flex-1 min-h-[280px]">
                <IncidentReplayFeed scenario={scenario} />
              </div>
              <SoftSignalBar
                timeLimitSeconds={15}
                onDecision={onSoftSignalSubmit}
              />
            </div>
          ) : phase === "REVIEW" ? (
            /* PHASE 2: FORENSIC REVIEW */
            <div className="flex flex-col flex-1 gap-2.5 min-h-0">
              {/* Dynamic Camera Feed Viewport */}
              <div className="flex-1 min-h-[280px]">
                <ReplayViewport
                  scenario={scenario}
                  activeTool={activeTool}
                  currentTimeMs={currentTimeMs}
                  onTimeChange={handleTimeChange}
                  onStageChange={handleStageChange}
                  trainingMode={trainingMode}
                />
              </div>

              {/* Forensic Timing Marker Deck (Player observations for Run-Out / Stumping) */}
              {(scenario.incidentType === "RUN_OUT" || scenario.incidentType === "STUMPING") && (
                <div className="hardware-panel p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2.5 font-mono text-xs border border-slate-700/60 shadow-md">
                  <div className="flex items-center gap-2">
                    <Crosshair size={14} className="text-cyan-400" />
                    <span className="text-[11px] font-bold text-slate-300 font-display">FORENSIC TIMING MARKERS</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Mark Bat Grounded Button & Display */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerBatGroundedMs(currentTimeMs);
                          sounds.playClick(900);
                        }}
                        className={`px-2.5 py-1.5 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                          playerBatGroundedMs !== null
                            ? "bg-cyan-950/80 border-cyan-500 text-cyan-200"
                            : "bg-slate-900 border-slate-700 hover:border-cyan-500 text-slate-300"
                        }`}
                      >
                        <span>MARK BAT GROUNDED</span>
                      </button>
                      {playerBatGroundedMs !== null ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleTimeChange(playerBatGroundedMs);
                            sounds.playClick(800);
                          }}
                          title="Click to jump to marked frame"
                          className="text-[10px] text-cyan-300 bg-cyan-950/90 border border-cyan-500/50 px-2 py-1 rounded font-bold hover:underline"
                        >
                          FRAME {Math.round((playerBatGroundedMs / 1000) * currentFps)} ({playerBatGroundedMs}ms)
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic px-1">[NOT MARKED]</span>
                      )}
                    </div>

                    {/* Mark Bails Dislodged Button & Display */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerBailsDislodgedMs(currentTimeMs);
                          sounds.playClick(950);
                        }}
                        className={`px-2.5 py-1.5 rounded text-[11px] font-bold transition-all flex items-center gap-1.5 border ${
                          playerBailsDislodgedMs !== null
                            ? "bg-amber-950/80 border-amber-500 text-amber-200"
                            : "bg-slate-900 border-slate-700 hover:border-amber-500 text-slate-300"
                        }`}
                      >
                        <span>MARK BAILS DISLODGED</span>
                      </button>
                      {playerBailsDislodgedMs !== null ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleTimeChange(playerBailsDislodgedMs);
                            sounds.playClick(800);
                          }}
                          title="Click to jump to marked frame"
                          className="text-[10px] text-amber-300 bg-amber-950/90 border border-amber-500/50 px-2 py-1 rounded font-bold hover:underline"
                        >
                          FRAME {Math.round((playerBailsDislodgedMs / 1000) * currentFps)} ({playerBailsDislodgedMs}ms)
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic px-1">[NOT MARKED]</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Central Replay Transport Scrub Bar */}
              <ScrubBar
                currentTimeMs={currentTimeMs}
                minTimeMs={minTimeMs}
                maxTimeMs={maxTimeMs}
                isPlaying={isPlaying}
                isRockAndRoll={isRockAndRoll}
                playbackSpeed={playbackSpeed}
                onTimeChange={handleTimeChange}
                onTogglePlay={togglePlay}
                onToggleRockAndRoll={toggleRockAndRoll}
                onSpeedChange={setPlaybackSpeed}
                onStep={handleStep}
                keyFrameMarkers={getKeyframeMarkers()}
                fps={currentFps}
                frameStepMs={frameStepMs}
              />
            </div>
          ) : (
            /* PHASE 3: RESULT REVEAL */
            currentResult && (
              <ResultReveal
                scenario={scenario}
                result={currentResult}
                incidentIndex={incidentIndex}
                totalIncidents={totalIncidents}
                onNextIncident={onNextIncident}
              />
            )
          )}
        </div>

        {/* Right Column (4 Cols): Camera Matrix, Verdict Panel, Comms */}
        <div className="lg:col-span-4 flex flex-col gap-3 min-h-0 overflow-y-auto">
          {phase === "SOFT_SIGNAL" ? (
            /* Phase 1 Right Column */
            <>
              <div className="hardware-panel rounded-xl p-3.5 text-xs space-y-2.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-bold text-amber-300 tracking-wider text-[11px]">
                      INCIDENT ALERT
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    {getIncidentLabel()}
                  </span>
                </div>

                <p className="text-slate-200 text-[11px] leading-relaxed">
                  {scenario.description}
                </p>

                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-slate-500 font-bold">MATCH SITUATION</div>
                  <div className="text-[11px] text-slate-200 font-medium leading-relaxed">
                    {scenario.matchContext.matchSituation}
                  </div>
                </div>

                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-slate-500 font-bold">ON-FIELD SIGNAL</div>
                  <div className="text-[11px] text-amber-300 font-black">
                    REFERRED TO TV UMPIRE
                  </div>
                </div>
              </div>

              {/* Broadcast Radio Comms Log */}
              <div className="hardware-panel rounded-xl p-3 text-xs space-y-2 shadow-lg">
                <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] border-b border-slate-800 pb-1.5">
                  <Radio size={12} className="text-cyan-400 animate-pulse" />
                  <span className="font-bold text-slate-200 tracking-wider">OFFICIAL RADIO COMMS LOG</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-[11px]">
                  {scenario.commsDialogue.map((msg, i) => (
                    <div key={i} className="flex flex-col bg-slate-950/80 p-1.5 rounded border border-slate-800">
                      <span className="text-[9px] font-bold text-cyan-400">
                        [{msg.speaker.replace("_", " ")}]
                      </span>
                      <span className="text-slate-300">{msg.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* Phase 2 & 3 Right Column */
            <>
              {/* Context-Sensitive Camera Matrix */}
              <ToolPalette
                incidentType={scenario.incidentType}
                activeTool={activeTool}
                onSelectTool={handleToolSelect}
              />

              {/* TV Umpire Verdict Transmitter */}
              {phase === "REVIEW" && (
                <VerdictPanel
                  incidentType={scenario.incidentType}
                  onFieldSignal={scenario.onFieldSignal}
                  playerBatGroundedMs={playerBatGroundedMs}
                  playerBailsDislodgedMs={playerBailsDislodgedMs}
                  onVerdictSubmit={onFinalVerdictSubmit}
                  trainingMode={trainingMode}
                  reviewChecklist={
                    scenario.incidentType === "LBW"
                      ? { replay: replayReviewed, track: trackReviewed }
                      : undefined
                  }
                />
              )}

              {/* Broadcast Radio Comms Log */}
              <div className="hardware-panel rounded-xl p-3 text-xs space-y-2 shadow-lg">
                <div className="flex items-center space-x-1.5 text-slate-400 text-[10px] border-b border-slate-800 pb-1.5">
                  <Radio size={12} className="text-cyan-400 animate-pulse" />
                  <span className="font-bold text-slate-200 tracking-wider">OFFICIAL RADIO COMMS LOG</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 text-[11px]">
                  {scenario.commsDialogue.map((msg, i) => (
                    <div key={i} className="flex flex-col bg-slate-950/80 p-1.5 rounded border border-slate-800">
                      <span className="text-[9px] font-bold text-cyan-400">
                        [{msg.speaker.replace("_", " ")}]
                      </span>
                      <span className="text-slate-300">{msg.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
