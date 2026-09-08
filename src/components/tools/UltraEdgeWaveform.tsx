import React, { useRef, useEffect, useMemo, useState } from "react";
import type { CaughtBehindData, Scenario } from "../../types/scenario";
import { Volume2, Activity, AlertTriangle, Eye } from "lucide-react";
import { sounds } from "../../engine/audioSynth";
import {
  solveUltraEdgeSignal,
  sampleUltraEdgeAmplitude,
  findNearestTransient,
  solveCaughtBehindSlipCorridor,
} from "../../engine/caughtBehindPhysics";
import {
  solveCaughtBehindBatterKinematics,
  solveCaughtBehindKeeperKinematics,
  drawArticulatedBatter,
  drawArticulatedWicketkeeper,
  drawStumpsAndBails,
  drawCricketBall,
  calculateBatOutsideEdgeScreenPos,
} from "../instinct/actorRigs";

interface UltraEdgeWaveformProps {
  caughtBehind: CaughtBehindData;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
  scenario?: Scenario;
}

/**
 * CAM 04 — UltraEdge Broadcast Synchronizer (Concept 1: Authentic Broadcast Dual-Feed).
 *
 * Left Panel: High-speed super slow-motion optical replay (500 FPS) zoomed on popping crease.
 * Right Panel: Frame-accurate stump-microphone acoustic oscilloscope with illuminated frame needle.
 *
 * Adjudication is derived purely from physical optical evidence (ball-bat proximity) and temporal
 * alignment of sound transients, free of CAD widgets, caliper labels, or biased verdict hints.
 */
export const UltraEdgeWaveform: React.FC<UltraEdgeWaveformProps> = ({
  caughtBehind,
  currentTimeMs,
  onTimeChange,
  scenario,
}) => {
  const audioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const opticalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  const signal = useMemo(() => solveUltraEdgeSignal(caughtBehind), [caughtBehind]);
  const nearest = useMemo(() => findNearestTransient(signal), [signal]);

  const minTime = signal.windowStartMs;
  const maxTime = signal.windowEndMs;
  const transitTime = signal.batPlaneTimeMs;

  // Exact Canonical Frame Indexing (50 FPS, 20ms/frame)
  // F59 = 1180ms, F60 = 1200ms (Bat Transit), F61 = 1220ms
  const currentFrame = Math.round(currentTimeMs / 20);
  const transitFrame = Math.round(transitTime / 20);
  const isAtTransit = Math.abs(currentTimeMs - transitTime) <= 12;

  // Draw the synchronized stump-mic scope.
  useEffect(() => {
    const canvas = audioCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerY = height / 2;

    // Clear background to clean dark charcoal broadcast scope
    ctx.fillStyle = "#070c14";
    ctx.fillRect(0, 0, width, height);

    // Draw Oscilloscope Decibel Grid & Labels
    ctx.strokeStyle = "#172336";
    ctx.lineWidth = 1;

    for (let x = 0; x < width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 20; y < height; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // dB Scale Markings (Left Axis)
    ctx.fillStyle = "#475569";
    ctx.font = "8px monospace";
    ctx.fillText(" 0dB", 4, 16);
    ctx.fillText("-20dB", 4, centerY - 25);
    ctx.fillText("-40dB", 4, centerY + 35);

    // Transit window: the frames in which the ball crossed the bat plane (F60, 1200ms).
    // The operator checks alignment against this band; the band itself asserts nothing about contact.
    const transitX = ((transitTime - minTime) / (maxTime - minTime)) * width;
    ctx.fillStyle = "rgba(56, 189, 248, 0.07)";
    ctx.fillRect(transitX - 22, 0, 44, height);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(transitX - 22, 0, 44, height);

    // Neutral Transit Window Marker Header
    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 8px monospace";
    ctx.fillText("TRANSIT (F60)", transitX - 22, 12);

    // Render the acoustic trace from the shared signal model.
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#F43F5E"; // Clean broadcast magenta/rose
    ctx.shadowColor = "rgba(244, 63, 94, 0.5)";
    ctx.shadowBlur = 4;

    const numPoints = 480;
    const AMP_PX = 62; // full-scale deflection in pixels
    for (let i = 0; i < numPoints; i++) {
      const t = minTime + (i / numPoints) * (maxTime - minTime);
      const x = (i / numPoints) * width;
      const y = centerY + sampleUltraEdgeAmplitude(signal, t) * AMP_PX;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Unlabelled candidate markers. Each marker says "a transient occurred
    // here", not what caused it.
    for (const tr of signal.transients) {
      const tx = ((tr.timeMs - minTime) / (maxTime - minTime)) * width;
      if (tx < 0 || tx > width) continue;
      ctx.strokeStyle = "rgba(226, 232, 240, 0.35)";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(tx, 8);
      ctx.lineTo(tx, height - 8);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(226, 232, 240, 0.8)";
      ctx.beginPath();
      ctx.arc(tx, 8, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle +/- 1-Frame Context Bracket around the current frame [F-1, F+1]
    // 1 frame at 50 FPS = 20ms
    const prevFrameX = ((currentTimeMs - 20 - minTime) / (maxTime - minTime)) * width;
    const nextFrameX = ((currentTimeMs + 20 - minTime) / (maxTime - minTime)) * width;
    const currentNeedleX = ((currentTimeMs - minTime) / (maxTime - minTime)) * width;

    // Soft bracket highlight across the 3-frame comparative window (F-1 -> F -> F+1)
    ctx.fillStyle = "rgba(56, 189, 248, 0.05)";
    ctx.fillRect(prevFrameX, 0, nextFrameX - prevFrameX, height);

    // Dotted boundary lines at F-1 and F+1
    ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(prevFrameX, 0);
    ctx.lineTo(prevFrameX, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(nextFrameX, 0);
    ctx.lineTo(nextFrameX, height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Subtle F-1 and F+1 tick labels at bottom
    ctx.font = "7px monospace";
    ctx.fillStyle = "rgba(148, 163, 184, 0.6)";
    ctx.fillText(`F${currentFrame - 1}`, Math.max(2, prevFrameX - 8), height - 4);
    ctx.fillText(`F${currentFrame + 1}`, Math.min(width - 24, nextFrameX - 8), height - 4);

    // Current Frame Needle: illuminated, crisp, prominent yet restrained
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255, 255, 255, 0.7)";
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(currentNeedleX, 0);
    ctx.lineTo(currentNeedleX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Needle Top Pointer (Cyan Chevron)
    ctx.fillStyle = "#38BDF8";
    ctx.beginPath();
    ctx.moveTo(currentNeedleX - 5, 0);
    ctx.lineTo(currentNeedleX + 5, 0);
    ctx.lineTo(currentNeedleX, 8);
    ctx.closePath();
    ctx.fill();

    // Needle Bottom Pointer (Cyan Chevron)
    ctx.beginPath();
    ctx.moveTo(currentNeedleX - 5, height);
    ctx.lineTo(currentNeedleX + 5, height);
    ctx.lineTo(currentNeedleX, height - 8);
    ctx.closePath();
    ctx.fill();
  }, [signal, currentTimeMs, transitTime, minTime, maxTime, currentFrame]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = minTime + ratio * (maxTime - minTime);
    onTimeChange(newTime);
    sounds.playClick(900);
  };

  /**
   * Plays the stump microphone.
   *
   * Runs inside the click handler so the browser treats it as a user gesture,
   * then awaits `unlock()` before scheduling the buffer. If playback is still
   * unavailable, the reason is shown in the panel rather than failing silently.
   */
  const handlePlaySound = async () => {
    setAudioNotice(null);
    const played = await sounds.playStumpMicSignal(
      (timeMs) => sampleUltraEdgeAmplitude(signal, timeMs),
      minTime,
      maxTime,
      { playbackRate: 0.3 }
    );
    if (!played) {
      const reason = sounds.getUnavailableReason();
      setAudioNotice(
        reason === "MUTED"
          ? "Audio is muted. Unmute in the console header to listen."
          : reason === "NO_AUDIO_CONTEXT"
          ? "This browser does not expose the Web Audio API."
          : "The browser blocked audio playback. Interact with the page, then try again."
      );
    }
  };

  // ================================================================
  // 1. LEFT PANEL: HIGH-SPEED OPTICAL SUPER SLOW-MO REPLAY
  // ================================================================
  useEffect(() => {
    const canvas = opticalCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Logical 16:9 broadcast scene dimensions (matching canonical SlipCam geometry)
    const SCENE_W = 640;
    const SCENE_H = 360;

    // Perspective Station Constants (calibrated in 640x360 logical coordinate space)
    const CAM_X = 6.0;
    const HORIZON_H = 0.16;
    const PERSP_K = 3.48;
    const EYE_D0 = 1.0;
    const WORLD_STUMPS_X = 0;
    const WORLD_POPPING_CREASE_X = 1.22;
    const WORLD_BATTER_GUARD_X = 1.06;
    const WORLD_KEEPER_X = -1.8;
    const WORLD_PITCH_FAR_END_X = -1.22;

    const camDist = (worldX: number) => CAM_X - worldX;
    const groundY = (worldX: number) =>
      SCENE_H * (HORIZON_H + PERSP_K / (camDist(worldX) + EYE_D0));
    const depthFactor = (worldX: number) => PERSP_K / (camDist(worldX) + EYE_D0);
    const BATTER_RIG_SCALE = 1.3;
    const actorScale = (worldX: number) =>
      (BATTER_RIG_SCALE * depthFactor(worldX)) / depthFactor(WORLD_BATTER_GUARD_X);
    const CORRIDOR_CX = SCENE_W * 0.5;
    const stripHalfW = (worldX: number) =>
      SCENE_W * 0.27 * (depthFactor(worldX) / depthFactor(WORLD_BATTER_GUARD_X));

    // Normalized progress p from canonical timeline (600ms to 2200ms)
    const p = Math.max(0, Math.min(1, (currentTimeMs - 600) / 1600));

    // Batter & Bat Placement in logical 16:9 space
    const batterX = SCENE_W * 0.52;
    const batterY = groundY(WORLD_BATTER_GUARD_X);
    const batterK = solveCaughtBehindBatterKinematics(
      p,
      scenario?.initialEvidence?.caughtBehind?.shotType,
      scenario?.initialEvidence?.caughtBehind?.batAngleDeg ?? 14
    );

    // Anchor the delivery corridor waypoint 2 at physical bat transit pose (t = 1200ms, p = 0.375)
    // using exact forward kinematics from calculateBatOutsideEdgeScreenPos so ball touches bat seamlessly on edge
    const transitP = Math.max(0, Math.min(1, (1200 - 600) / 1600));
    const transitBatterK = solveCaughtBehindBatterKinematics(
      transitP,
      scenario?.initialEvidence?.caughtBehind?.shotType,
      scenario?.initialEvidence?.caughtBehind?.batAngleDeg ?? 14
    );
    const { batEdgeX, batEdgeY } = calculateBatOutsideEdgeScreenPos(
      batterX,
      batterY,
      transitBatterK,
      BATTER_RIG_SCALE,
      "LEFT"
    );

    // Wicketkeeper Stationed Behind Striker Stumps in logical space
    const keeperX = SCENE_W * 0.47;
    const keeperY = groundY(WORLD_KEEPER_X);
    const keeperScale = actorScale(WORLD_KEEPER_X);
    const keeperK = solveCaughtBehindKeeperKinematics(p, caughtBehind.hasEdge);

    // Terminal glove endpoint from the keeper rig
    const gloveX = keeperX + 14 * keeperScale;
    const gloveY = keeperY + keeperK.gloveY * keeperScale;

    // Calibrated 2.5D visual delivery corridor evaluated in canonical 16:9 coordinates
    const current = solveCaughtBehindSlipCorridor(
      caughtBehind,
      currentTimeMs,
      SCENE_W,
      SCENE_H,
      batEdgeX,
      batEdgeY,
      gloveX,
      gloveY
    );
    const past = solveCaughtBehindSlipCorridor(
      caughtBehind,
      Math.max(600, currentTimeMs - 24),
      SCENE_W,
      SCENE_H,
      batEdgeX,
      batEdgeY,
      gloveX,
      gloveY
    );

    // -------------------------------------------------------------
    // DEDICATED ULTRAEDGE BROADCAST CAMERA CROP & ZOOM
    // -------------------------------------------------------------
    // Acts as a dedicated high-speed optical camera tracking the delivery corridor
    // and framing the bat-ball impact zone.
    //
    // Base composition: Deliberate medium crease shot (BASE_ZOOM = 1.30) framing the
    // popping crease, delivery corridor, batsman, stumps, and wicketkeeper carry.
    //
    // Macro transit composition: Telephoto close-up (MACRO_ZOOM = 2.25) focused on the
    // willow outside edge and ball transit corridor.
    //
    // Motion profile:
    // - Smooth easing into the transit zone (880ms - 1140ms)
    // - STRICTLY LOCKED across F57 - F63 (1140ms - 1260ms), guaranteeing zero camera
    //   motion or frame jitter when single-stepping across F59, F60, and F61
    // - Smooth release after transit (1260ms - 1460ms) back to base crease framing
    const BASE_ZOOM = 1.18;
    const MACRO_ZOOM = 2.05;

    const baseFocusX = SCENE_W * 0.50;
    const baseFocusY = 236;

    const transitFocusX = batEdgeX - 6;
    const transitFocusY = batEdgeY - 27;

    let zoomFactor = 0;
    if (currentTimeMs >= 1140 && currentTimeMs <= 1260) {
      zoomFactor = 1.0; // Strictly locked macro zoom across F57 - F63
    } else if (currentTimeMs > 880 && currentTimeMs < 1140) {
      const u = (currentTimeMs - 880) / (1140 - 880);
      zoomFactor = u * u * (3 - 2 * u);
    } else if (currentTimeMs > 1260 && currentTimeMs < 1460) {
      const u = (currentTimeMs - 1260) / (1460 - 1260);
      zoomFactor = 1.0 - u * u * (3 - 2 * u);
    } else {
      zoomFactor = 0.0;
    }

    const camZoom = BASE_ZOOM + (MACRO_ZOOM - BASE_ZOOM) * zoomFactor;
    const camFocusX = baseFocusX + (transitFocusX - baseFocusX) * zoomFactor;
    const camFocusY = baseFocusY + (transitFocusY - baseFocusY) * zoomFactor;

    // Base Monitor Fill
    const gradGrass = ctx.createLinearGradient(0, 0, 0, h);
    gradGrass.addColorStop(0, "#0c1a12");
    gradGrass.addColorStop(0.6, "#12261b");
    gradGrass.addColorStop(1, "#0a160f");
    ctx.fillStyle = gradGrass;
    ctx.fillRect(0, 0, w, h);

    // Render 3D/2.5D Optical World inside Camera Viewport (Uniform scale preserves 1:1 aspect)
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-camFocusX, -camFocusY);

    // Expanded grass fill to prevent edge clipping under telephoto zoom
    ctx.fillStyle = gradGrass;
    ctx.fillRect(-SCENE_W * 2, -SCENE_H * 2, SCENE_W * 5, SCENE_H * 5);

    // Turf & Pitch Strip
    const farEndY = groundY(WORLD_PITCH_FAR_END_X);
    const nearCutD = PERSP_K / (0.94 - HORIZON_H) - EYE_D0;
    const nearCutX = CAM_X - nearCutD;
    const nearCutY = groundY(nearCutX);

    const gradPitch = ctx.createLinearGradient(0, farEndY, 0, nearCutY);
    gradPitch.addColorStop(0, "#917757");
    gradPitch.addColorStop(0.5, "#a88e6d");
    gradPitch.addColorStop(1, "#a08666");
    ctx.fillStyle = gradPitch;
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_PITCH_FAR_END_X), farEndY);
    ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_PITCH_FAR_END_X), farEndY);
    ctx.lineTo(CORRIDOR_CX + stripHalfW(nearCutX), nearCutY);
    ctx.lineTo(CORRIDOR_CX - stripHalfW(nearCutX), nearCutY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3e3120";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Crease Lines
    const stumpsY = groundY(WORLD_STUMPS_X);
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_STUMPS_X) * 0.9, stumpsY + 2);
    ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_STUMPS_X) * 0.9, stumpsY + 2);
    ctx.stroke();

    const creaseY = groundY(WORLD_POPPING_CREASE_X);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - stripHalfW(WORLD_POPPING_CREASE_X) * 0.95, creaseY);
    ctx.lineTo(CORRIDOR_CX + stripHalfW(WORLD_POPPING_CREASE_X) * 0.95, creaseY);
    ctx.stroke();

    // Wicketkeeper (stationed behind stumps)
    drawArticulatedWicketkeeper(
      ctx,
      { x: keeperX, y: keeperY, scale: keeperScale, facing: "RIGHT" },
      keeperK
    );

    // Striker Stumps
    drawStumpsAndBails(ctx, CORRIDOR_CX, stumpsY + 2, {
      scale: actorScale(WORLD_STUMPS_X),
    });

    // Batter drawn at crease
    drawArticulatedBatter(
      ctx,
      { x: batterX, y: batterY, scale: BATTER_RIG_SCALE, facing: "LEFT" },
      batterK
    );

    // Cricket Ball with seam and 500 FPS motion trail (drawn in foreground along off-side corridor)
    drawCricketBall(ctx, current.x, current.y, {
      radius: current.radius,
      seamAngleRad: (currentTimeMs / 1000) * Math.PI * 6,
      shadowY: current.y + 24,
      motionTrail: currentTimeMs >= 850 && currentTimeMs <= 1350,
      prevX: past.x,
      prevY: past.y,
    });

    ctx.restore();

    // -------------------------------------------------------------
    // BROADCAST CAMERA MONITOR OVERLAYS (Drawn in fixed screen space)
    // -------------------------------------------------------------
    // Broadcast Camera Viewfinder Crosshairs (Corners)
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1.2;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(10, 20);
    ctx.lineTo(10, 10);
    ctx.lineTo(20, 10);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(w - 20, 10);
    ctx.lineTo(w - 10, 10);
    ctx.lineTo(w - 10, 20);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(10, h - 20);
    ctx.lineTo(10, h - 10);
    ctx.lineTo(20, h - 10);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(w - 20, h - 10);
    ctx.lineTo(w - 10, h - 10);
    ctx.lineTo(w - 10, h - 20);
    ctx.stroke();

    // Broadcast Camera Watermark
    ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
    ctx.font = "bold 8px monospace";
    ctx.fillText("500 FPS HIGH-SPEED OPTICAL", 16, 20);
    if (currentTimeMs >= 1140 && currentTimeMs <= 1260) {
      ctx.fillStyle = "rgba(56, 189, 248, 0.65)";
      ctx.fillText("CREASE MACRO LOCK", 16, 31);
    }
  }, [caughtBehind, currentTimeMs, scenario]);

  const alignmentOffsetMs = nearest ? Math.round(nearest.offsetMs) : null;

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-1.5 select-none font-mono text-slate-200">
      {/* Top Monitor Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            ULTRAEDGE • BROADCAST AUDIO-VIDEO SYNCHRONIZER
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-cyan-300 font-semibold">
            500 FPS SHUTTER • STUMP MIC SYNC
          </span>
        </div>

        <button
          onClick={handlePlaySound}
          className="tactical-btn px-3 py-1 rounded text-xs font-bold text-rose-300 hover:text-rose-200 border-rose-500/40 flex items-center gap-1.5 shadow-sm"
        >
          <Volume2 size={13} className="text-rose-400" />
          <span>LISTEN TO MIC</span>
        </button>
      </div>

      {audioNotice && (
        <div className="mt-1 flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-950/40 px-2 py-0.5 text-[10px] text-amber-200">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" />
          <span>{audioNotice}</span>
        </div>
      )}

      {/* Main Evidence Split View (50 / 50 Broadcast Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 my-0.5 flex-1 min-h-0 h-full">
        {/* Left Column (6 Cols): HIGH-SPEED OPTICAL SUPER SLOW-MO REPLAY */}
        <div className="md:col-span-6 relative bg-gradient-to-b from-[#0a121e] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex flex-col p-1 shadow-inner h-full">
          <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-15" />

          {/* Panel Header with Synchronized Frame & Time */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5 border-b border-slate-800/80 pb-0.5 z-20">
            <div className="flex items-center gap-1.5">
              <Eye size={12} className="text-cyan-400" />
              <span className="font-bold text-slate-100 tracking-wider">
                OPTICAL SUPER SLOW-MO
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300 font-mono">
                F{currentFrame} • {currentTimeMs} ms
              </span>
              <span className={`text-[10px] font-bold ${isAtTransit ? "text-cyan-400" : "text-slate-500"}`}>
                {isAtTransit ? "BAT TRANSIT" : currentTimeMs < transitTime ? "APPROACH" : "POST-TRANSIT"}
              </span>
            </div>
          </div>

          {/* Optical Canvas */}
          <div className="relative w-full flex-1 flex items-center justify-center bg-black/40 rounded overflow-hidden min-h-0">
            <canvas
              ref={opticalCanvasRef}
              width={540}
              height={270}
              className="w-full h-full object-contain rounded"
            />
          </div>
        </div>

        {/* Right Column (6 Cols): SYNCHRONIZED ACOUSTIC OSCILLOSCOPE */}
        <div className="md:col-span-6 relative bg-[#070c14] rounded-lg border border-slate-800 overflow-hidden flex flex-col p-1 shadow-inner h-full">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5 border-b border-slate-800/80 pb-0.5">
            <div className="flex items-center gap-1.5 font-bold text-rose-400">
              <Activity size={12} />
              <span>STUMP MIC ACOUSTIC TRACE</span>
            </div>
            <span className="text-[9px] text-slate-500">
              CLICK TO SCRUB NEEDLE
            </span>
          </div>

          {/* Audio Canvas */}
          <div className="relative w-full flex-1 flex items-center justify-center bg-black/40 rounded overflow-hidden min-h-0">
            <canvas
              ref={audioCanvasRef}
              width={540}
              height={270}
              onClick={handleCanvasClick}
              className="w-full h-full object-contain rounded cursor-crosshair"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
