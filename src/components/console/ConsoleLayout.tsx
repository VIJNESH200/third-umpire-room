import React, { useState, useEffect, useRef } from "react";
import type {
  Scenario,
  DecisionVerdict,
  IncidentResult,
} from "../../types/scenario";
import { MatchLogBar } from "./MatchLogBar";
import { ReplayViewport } from "./ReplayViewport";
import { ScrubBar, KeyframeMarker } from "./ScrubBar";
import { CameraSwitcherAngles } from "./CameraSwitcherAngles";
import { SoftSignalBar } from "./SoftSignalBar";
import { VerdictPanel } from "./VerdictPanel";
import { ResultReveal } from "./ResultReveal";
import { IncidentReplayFeed } from "../instinct/IncidentReplayFeed";
import { sounds } from "../../engine/audioSynth";
import { isTextEntryTarget, resolveReplayShortcut } from "../../engine/replayKeyboard";
import { Radio, Crosshair, ChevronDown, ChevronUp, Zap } from "lucide-react";

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
  // interaction on CAM 01 (replay), and the full sequential Hawk-Eye reveal on
  // CAM 03 — trackStageReached records how far the ball-track sequence has
  // actually been walked (5 = wickets projection shown); stage 1 alone never
  // satisfies it.
  const [replayReviewed, setReplayReviewed] = useState<boolean>(false);
  const [trackStageReached, setTrackStageReached] = useState<number>(0);
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
    setTrackStageReached(0);
  }, [scenario.id, scenario.incidentType]);

  // Central Shared Timeline & Transport Engine
  const minTimeMs = 600;
  const maxTimeMs = 2200;
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(1200);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isRockAndRoll, setIsRockAndRoll] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(0.5);
  const [scanlinesEnabled] = useState<boolean>(true);
  // Mirror of the last committed canonical time. Used to re-assert a known-good
  // timestamp whenever the transport halts (see pauseTransport below).
  const currentTimeMsRef = useRef<number>(1200);
  useEffect(() => {
    currentTimeMsRef.current = currentTimeMs;
  }, [currentTimeMs]);

  // Derive logical frame rate from active camera feed
  const getActiveCameraFps = (tool: string): number => {
    if (scenario.incidentType === "STUMPING") return 500; // 500 FPS Virtual High Speed Forensic Suite (1 frame = 2ms)
    if (tool === "CREASE_ZOOM" || tool === "HOTSPOT") return 500; // 500 FPS High Speed Camera (1 frame = 2ms)
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
    if (scenario.incidentType === "STUMPING" && scenario.stumping) {
      return scenario.stumping.bailsDislodgedFrameMs;
    }
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

  // Keyboard shortcuts for the canonical replay transport (SPACE, arrows,
  // Shift+arrows). Active only on a replay-capable screen — the forensic
  // REVIEW phase, which owns the shared ScrubBar timeline. The handlers
  // below are the SAME functions the on-screen buttons call, so keyboard
  // and mouse drive one identical timeline; no second clock exists.
  // preventDefault stops SPACE from scrolling or re-triggering a focused
  // button and keeps arrows from scrolling the console; typing targets
  // (input/textarea/select/contenteditable) are left untouched.
  const replayShortcutsActive = phase === "REVIEW";
  // Latest-handler mirrors: the listener is registered once per phase while
  // these closures capture per-render transport state (speed, intents,
  // frameStepMs), so the refs keep it driving the live timeline without
  // re-subscribing on every render.
  const togglePlayRef = useRef<() => void>(() => {});
  const handleStepRef = useRef<(frames: number) => void>(() => {});
  useEffect(() => {
    if (!replayShortcutsActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTextEntryTarget(event.target)) return;

      const command = resolveReplayShortcut(event.key, event.shiftKey);
      if (!command) return;

      event.preventDefault();
      if (command.type === "TOGGLE_PLAY") {
        togglePlayRef.current();
      } else {
        handleStepRef.current(command.frames);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [replayShortcutsActive]);

  // Task 7 — mark genuine review interaction: transport actions (play, step,
  // seek, shuttle, scrub) taken while CAM 01 is active count as having
  // reviewed the replay feed.
  const markTransportReview = () => {
    if (!isLbwReview || trainingMode) return;
    if (activeTool === "BROADCAST_FRONT") setReplayReviewed(true);
  };

  // Task 5B — Hawk-Eye review progress: the checklist records the furthest
  // stage the player has actually revealed in order (PitchMapOverlay only
  // advances sequentially). Reaching Stage 5 — the wickets projection — is
  // what completes ball-track review; a single early stage never does.
  const handleStageChange = (stage: number) => {
    if (!isLbwReview || trainingMode) return;
    setTrackStageReached((prev) => Math.max(prev, stage));
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

  // Keep the keyboard listener pointed at the live transport closures.
  togglePlayRef.current = togglePlay;
  handleStepRef.current = handleStep;

  const handleToolSelect = (tool: string) => {
    // Every camera feed is an alternate projection of the same canonical
    // replay state. Switching therefore halts transport on ALL incident
    // types: stopTransportLoop cancels/invalidate the old animation loop
    // (epoch bump discards any queued clock update), the absolute set in
    // pauseTransport re-asserts canonical time exactly, and the new camera
    // mounts rendering precisely that frame in a PAUSED state. Playback
    // resumes only when the operator explicitly presses PLAY again. No
    // camera ever owns its own clock.
    pauseTransport();
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
      const transitMs = scenario.caughtBehind.ballPassesBatFrameMs;
      const frameNum = Math.round((transitMs / 1000) * currentFps);
      return [
        { label: `Bat-Plane Transit (F${frameNum})`, timeMs: transitMs, color: "#38BDF8" },
      ];
    }
    if (scenario.incidentType === "BOUNDARY" && scenario.boundary) {
      return [
        { label: "Rope Contact", timeMs: scenario.boundary.ropeContactFrameMs, color: "#FF2E4C" },
        { label: "Ball Release", timeMs: scenario.boundary.releaseFrameMs, color: "#00E676" },
      ];
    }
    return [];
  };


  return (
    <div className="relative flex flex-col min-h-screen lg:h-screen w-screen bg-[#121213] text-neutral-200 overflow-y-auto lg:overflow-hidden font-sans select-none console-chassis">
      {/* Optional CRT Scanline Overlay */}
      {scanlinesEnabled && (
        <div className="pointer-events-none absolute inset-0 z-50 scanlines-overlay opacity-20 mix-blend-overlay" />
      )}

      {/* Top Match Log Bar (Blinded during Phase 1) */}
      <MatchLogBar
        matchContext={scenario.matchContext}
        difficultyTier={scenario.difficultyTier}
        incidentIndex={incidentIndex}
        totalIncidents={totalIncidents}
        isMuted={isMuted}
        isBlinded={phase === "SOFT_SIGNAL"}
        phase={phase}
        onToggleMute={onToggleMute}
      />

      {/* Main Review Room Workstation Console */}
      {phase === "SOFT_SIGNAL" ? (
        /* PHASE 1: Full-width cinematic broadcast experience */
        <div className="flex-1 flex flex-col gap-2.5 p-3 overflow-y-auto min-h-0">
          <div className="flex-1 min-h-[280px]">
            <IncidentReplayFeed scenario={scenario} />
          </div>
          <SoftSignalBar
            timeLimitSeconds={15}
            onDecision={onSoftSignalSubmit}
          />
        </div>
      ) : phase === "REVIEW" ? (
        /* PHASE 2: Full-Width Stacked Forensic Workstation */
        <div className="flex-1 flex flex-col gap-1.5 p-2 overflow-hidden min-h-0">
          {/* Top Unit: Dominant Forensic Viewport + Transport Chassis */}
          <div className="flex-1 flex flex-col min-h-0 rounded-sm overflow-hidden border border-[#27272a] bg-black">
            {/* Dynamic Camera Feed Viewport */}
            <div className="flex-1 min-h-0 relative">
              <ReplayViewport
                scenario={scenario}
                activeTool={activeTool}
                currentTimeMs={currentTimeMs}
                onTimeChange={handleTimeChange}
                onStageChange={handleStageChange}
                trainingMode={trainingMode}
              />
            </div>

            {/* Seamless Lower Transport Chassis (Active for video replay feeds; hidden for Hawk-Eye 3D) */}
            {activeTool !== "PITCH_MAP" && (
              <div className="shrink-0 border-t border-[#27272a] bg-[#121213]">
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
            )}
          </div>

          {/* Bottom Control Rack: Single unified surface divided by 1px vertical borders */}
          <div className="bg-[#121213] border border-[#27272a] rounded-sm p-2 sm:p-2.5 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-0 lg:divide-x divide-[#27272a] shrink-0">
            {/* Camera Switcher (5 cols) & Key Frames (3 cols) */}
            <CameraSwitcherAngles
              scenario={scenario}
              activeTool={activeTool}
              onSelectTool={handleToolSelect}
              currentTimeMs={currentTimeMs}
              onTimeChange={handleTimeChange}
              fps={currentFps}
              playerBatGroundedMs={playerBatGroundedMs}
              playerBailsDislodgedMs={playerBailsDislodgedMs}
              timingTelemetrySlot={
                (scenario.incidentType === "RUN_OUT" || scenario.incidentType === "STUMPING") ? (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#27272a] text-xs font-sans">
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[#1a1a1b] border border-[#27272a] text-[9px] font-bold text-neutral-400 uppercase font-mono shrink-0">
                      <span>TIMING</span>
                    </div>

                    {/* Mark Bat Grounded */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerBatGroundedMs(currentTimeMs);
                          sounds.playClick(900);
                        }}
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-tight transition-colors flex items-center gap-1 border cursor-pointer ${
                          playerBatGroundedMs !== null
                            ? "bg-emerald-950/50 border-emerald-500 text-emerald-300"
                            : "bg-[#1a1a1b] hover:bg-[#242426] border-[#27272a] text-neutral-300"
                        }`}
                      >
                        <Crosshair size={11} className={playerBatGroundedMs !== null ? "text-emerald-400" : "text-neutral-400"} />
                        <span>{scenario.incidentType === "STUMPING" ? "BAT / FOOT GROUNDED" : "BAT GROUNDED"}</span>
                      </button>
                      {playerBatGroundedMs !== null ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleTimeChange(playerBatGroundedMs);
                            sounds.playClick(800);
                          }}
                          title="Click to jump to marked frame"
                          className="text-[10px] font-mono font-bold text-emerald-300 bg-emerald-950/60 border border-emerald-500/60 px-1 py-0.5 rounded-sm hover:underline cursor-pointer"
                        >
                          F{Math.round((playerBatGroundedMs / 1000) * currentFps)}
                        </button>
                      ) : (
                        <span className="text-[9px] font-mono text-neutral-500 bg-[#161618] border border-[#27272a] px-1 py-0.5 rounded-sm">
                          NOT SET
                        </span>
                      )}
                    </div>

                    {/* Mark Bails Dislodged */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setPlayerBailsDislodgedMs(currentTimeMs);
                          sounds.playClick(950);
                        }}
                        className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold uppercase tracking-tight transition-colors flex items-center gap-1 border cursor-pointer ${
                          playerBailsDislodgedMs !== null
                            ? "bg-amber-950/50 border-amber-500 text-amber-300"
                            : "bg-[#1a1a1b] hover:bg-[#242426] border-[#27272a] text-neutral-300"
                        }`}
                      >
                        <Zap size={11} className={playerBailsDislodgedMs !== null ? "text-amber-400" : "text-neutral-400"} />
                        <span>BAILS DISLODGED</span>
                      </button>
                      {playerBailsDislodgedMs !== null ? (
                        <button
                          type="button"
                          onClick={() => {
                            handleTimeChange(playerBailsDislodgedMs);
                            sounds.playClick(800);
                          }}
                          title="Click to jump to marked frame"
                          className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/60 px-1 py-0.5 rounded-sm hover:underline cursor-pointer"
                        >
                          F{Math.round((playerBailsDislodgedMs / 1000) * currentFps)}
                        </button>
                      ) : (
                        <span className="text-[9px] font-mono text-neutral-500 bg-[#161618] border border-[#27272a] px-1 py-0.5 rounded-sm">
                          NOT SET
                        </span>
                      )}
                    </div>

                    {/* Live Timing Delta Readout if both set */}
                    {playerBatGroundedMs !== null && playerBailsDislodgedMs !== null && (
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[#161618] border border-[#27272a] font-mono text-[10px] font-bold text-neutral-300 shrink-0">
                        <span className="text-neutral-500">Δ</span>
                        <span className={playerBatGroundedMs < playerBailsDislodgedMs ? "text-emerald-400" : "text-red-400"}>
                          {Math.abs(Math.round(((playerBailsDislodgedMs - playerBatGroundedMs) / 1000) * currentFps))}F
                        </span>
                        <span className="text-neutral-500 text-[9px]">
                          ({Math.abs(playerBailsDislodgedMs - playerBatGroundedMs)}ms)
                        </span>
                      </div>
                    )}
                  </div>
                ) : undefined
              }
            />

            {/* Column 3: TV Umpire Decision Station */}
            <div className="lg:col-span-4 flex flex-col justify-between pl-0 lg:pl-2.5 font-sans">
              <VerdictPanel
                incidentType={scenario.incidentType}
                onFieldSignal={scenario.onFieldSignal}
                playerBatGroundedMs={playerBatGroundedMs}
                playerBailsDislodgedMs={playerBailsDislodgedMs}
                onVerdictSubmit={onFinalVerdictSubmit}
                trainingMode={trainingMode}
                reviewChecklist={
                  scenario.incidentType === "LBW"
                    ? { replay: replayReviewed, trackStage: trackStageReached }
                    : undefined
                }
              />
            </div>
          </div>

          {/* Full-width Commentary Ticker */}
          <div className="w-full shrink-0">
            <CommsTickerWidget commsDialogue={scenario.commsDialogue} />
          </div>
        </div>
      ) : (
        /* PHASE 3: RESULT REVEAL (Editorial Broadcast Atmosphere) */
        currentResult && (
          <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden bg-[#06080e] select-none">
            {/* 1. Cinematic Night Stadium Atmosphere Backdrop */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
              {/* Radial Stadium Darkness Vignette */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,#111824_0%,#06080e_75%)]" />

              {/* Upper Left Floodlight Bank & Atmospheric Bloom */}
              <div className="absolute -top-16 -left-16 w-[600px] h-[500px] bg-[radial-gradient(circle,rgba(240,246,255,0.22)_0%,rgba(180,210,255,0.08)_35%,transparent_65%)] blur-2xl pointer-events-none" />
              <svg className="absolute top-3 left-4 w-40 h-32 opacity-90" viewBox="0 0 160 128" fill="none">
                <g transform="rotate(14 80 64)">
                  {/* Light Tower Frame */}
                  <path d="M 24,96 L 56,24 L 104,24 L 136,96" stroke="#2a384e" strokeWidth="2" strokeDasharray="3,3" />
                  <rect x="46" y="16" width="68" height="48" rx="4" fill="#0d1420" stroke="#384f70" strokeWidth="1.5" />
                  {/* Floodlight Bulbs Grid */}
                  {[0, 1, 2].map((row) =>
                    [0, 1, 2, 3].map((col) => (
                      <g key={`l-${row}-${col}`}>
                        <circle cx={54 + col * 17} cy={26 + row * 14} r={5} fill="#ffffff" />
                        <circle cx={54 + col * 17} cy={26 + row * 14} r={8} fill="#e0f2fe" opacity="0.45" />
                      </g>
                    ))
                  )}
                  {/* Atmospheric Downward Beam */}
                  <polygon points="46,64 114,64 160,128 0,128" fill="url(#beamLeft)" opacity="0.14" />
                </g>
                <defs>
                  <linearGradient id="beamLeft" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Upper Right Floodlight Bank & Bloom */}
              <div className="absolute -top-16 -right-16 w-[600px] h-[500px] bg-[radial-gradient(circle,rgba(240,246,255,0.18)_0%,rgba(180,210,255,0.06)_35%,transparent_65%)] blur-2xl pointer-events-none" />
              <svg className="absolute top-3 right-4 w-40 h-32 opacity-85" viewBox="0 0 160 128" fill="none">
                <g transform="rotate(-14 80 64)">
                  {/* Light Tower Frame */}
                  <path d="M 136,96 L 104,24 L 56,24 L 24,96" stroke="#2a384e" strokeWidth="2" strokeDasharray="3,3" />
                  <rect x="46" y="16" width="68" height="48" rx="4" fill="#0d1420" stroke="#384f70" strokeWidth="1.5" />
                  {/* Floodlight Bulbs Grid */}
                  {[0, 1, 2].map((row) =>
                    [0, 1, 2, 3].map((col) => (
                      <g key={`r-${row}-${col}`}>
                        <circle cx={54 + col * 17} cy={26 + row * 14} r={5} fill="#ffffff" />
                        <circle cx={54 + col * 17} cy={26 + row * 14} r={8} fill="#e0f2fe" opacity="0.45" />
                      </g>
                    ))
                  )}
                </g>
              </svg>

              {/* Bottom Turf Ground Gradient */}
              <div className="absolute bottom-0 inset-x-0 h-48 bg-[linear-gradient(to_top,rgba(8,26,17,0.75)_0%,rgba(6,15,11,0.45)_50%,transparent_100%)] pointer-events-none" />

              {/* Realistic Red Cricket Ball on Turf (Bottom-Right Corner) */}
              <div className="absolute -bottom-20 -right-12 pointer-events-none w-72 h-72 select-none opacity-95 hidden sm:block">
                <svg className="w-full h-full drop-shadow-[0_25px_30px_rgba(0,0,0,0.95)]" viewBox="0 0 200 200" fill="none">
                  <defs>
                    <radialGradient id="ballShade" cx="36%" cy="30%" r="68%">
                      <stop offset="0%" stopColor="#f87171" />
                      <stop offset="25%" stopColor="#dc2626" />
                      <stop offset="55%" stopColor="#991b1b" />
                      <stop offset="85%" stopColor="#581010" />
                      <stop offset="100%" stopColor="#2c0808" />
                    </radialGradient>
                    <radialGradient id="turfShadow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#010402" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#010402" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  {/* Soft turf cast shadow */}
                  <ellipse cx="100" cy="180" rx="90" ry="22" fill="url(#turfShadow)" />
                  {/* Leather Sphere */}
                  <circle cx="100" cy="100" r="82" fill="url(#ballShade)" />
                  {/* Gloss Specular Arc */}
                  <ellipse cx="68" cy="62" rx="32" ry="20" fill="#fecaca" opacity="0.22" transform="rotate(-28 68 62)" />
                  {/* Leather Raised Seam Band */}
                  <path d="M 40,40 Q 100,100 160,160" stroke="#3b0808" strokeWidth="8" opacity="0.75" />
                  {/* Double Parallel Stitched Seam with Diagonal White Thread */}
                  <path d="M 43,39 Q 103,99 163,159" stroke="#ffffff" strokeWidth="2.2" strokeDasharray="3.5,3" opacity="0.9" />
                  <path d="M 37,45 Q 97,105 157,165" stroke="#ffffff" strokeWidth="2.2" strokeDasharray="3.5,3" opacity="0.9" />
                  {/* Subtle Secondary Highlight */}
                  <path d="M 35,85 A 75 75 0 0 1 125,30" stroke="#ffffff" strokeWidth="1" opacity="0.15" />
                </svg>
              </div>
            </div>

            {/* 2. Main Centered Review Console */}
            <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-2 md:p-4 overflow-y-auto min-h-0 my-auto justify-center z-10 relative">
              <ResultReveal
                scenario={scenario}
                result={currentResult}
                incidentIndex={incidentIndex}
                totalIncidents={totalIncidents}
                onNextIncident={onNextIncident}
              />
            </div>

            {/* 3. Official ICC Broadcast Footer Bar */}
            <footer className="w-full py-2.5 px-6 border-t border-[#18202c] bg-[#07090e]/95 backdrop-blur-md flex items-center justify-between text-[11px] font-sans text-neutral-400 select-none shrink-0 z-20">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 font-bold tracking-wider text-neutral-300">
                  <span className="w-4 h-4 rounded-full border border-neutral-400 flex items-center justify-center text-[7px] font-bold text-neutral-300 font-mono">
                    ICC
                  </span>
                  <span>ICC THIRD UMPIRE SYSTEM</span>
                </div>
                <span className="text-neutral-600 select-none">|</span>
                <div className="flex items-center gap-2 text-neutral-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                  <span>All decisions subject to ICC regulations</span>
                </div>
              </div>
              <div className="font-mono text-[10px] tracking-[0.2em] text-neutral-400 flex items-center gap-3">
                <span>ACCURACY</span>
                <span className="text-neutral-600 select-none">|</span>
                <span>INTEGRITY</span>
                <span className="text-neutral-600 select-none">|</span>
                <span>FAIR PLAY</span>
              </div>
            </footer>
          </div>
        )
      )}
    </div>
  );
};

/** Collapsible radio comms ticker — shows latest message, expandable. */
const CommsTickerWidget: React.FC<{ commsDialogue: Array<{ speaker: string; text: string }> }> = ({ commsDialogue }) => {
  const [expanded, setExpanded] = React.useState(false);
  const latest = commsDialogue[commsDialogue.length - 1];
  if (!latest) return null;

  return (
    <div className="text-xs font-sans">
      {/* Ticker header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-1 bg-[#121213] rounded-sm border border-[#27272a] hover:border-[#3f3f46] transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Radio size={12} className="text-neutral-400 shrink-0" />
          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0">COMMS</span>
          <span className="text-xs text-neutral-300 truncate font-normal">
            <span className="text-neutral-200 font-semibold">{latest.speaker.replace("_", " ")}</span>
            {" — "}
            {latest.text}
          </span>
        </div>
        {expanded ? <ChevronUp size={13} className="text-neutral-400 shrink-0" /> : <ChevronDown size={13} className="text-neutral-400 shrink-0" />}
      </button>

      {/* Expanded log */}
      {expanded && (
        <div className="mt-0.5 space-y-0.5 max-h-32 overflow-y-auto px-1 bg-[#121213] border border-[#27272a] rounded-sm">
          {commsDialogue.map((msg, i) => (
            <div key={i} className="flex gap-2 px-2 py-0.5 text-[11px]">
              <span className="text-neutral-400 font-semibold uppercase shrink-0 text-[10px]">
                {msg.speaker.replace("_", " ")}
              </span>
              <span className="text-neutral-300">{msg.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
