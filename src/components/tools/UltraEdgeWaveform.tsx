import React, { useRef, useEffect, useMemo, useState } from "react";
import type { CaughtBehindData } from "../../types/scenario";
import { Volume2, Activity, AlertTriangle } from "lucide-react";
import { sounds } from "../../engine/audioSynth";
import {
  solveUltraEdgeSignal,
  sampleUltraEdgeAmplitude,
  findNearestTransient,
  solveEdgeOpticalEvidence,
} from "../../engine/caughtBehindPhysics";

interface UltraEdgeWaveformProps {
  caughtBehind: CaughtBehindData;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
}

/**
 * CAM 04 — UltraEdge stump-microphone telemetry.
 *
 * The scope draws every transient in the review window without labelling its
 * source. A bat edge, a pad contact and ambient kit noise occupy overlapping
 * amplitude and frequency bands, so the only usable discriminator is how
 * closely a transient aligns with the frame in which the ball passed the bat.
 * The speaker plays the same signal the scope draws, so what the operator
 * hears always matches what they see.
 */
export const UltraEdgeWaveform: React.FC<UltraEdgeWaveformProps> = ({
  caughtBehind,
  currentTimeMs,
  onTimeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  const signal = useMemo(() => solveUltraEdgeSignal(caughtBehind), [caughtBehind]);
  const optical = useMemo(() => solveEdgeOpticalEvidence(caughtBehind), [caughtBehind]);
  const nearest = useMemo(() => findNearestTransient(signal), [signal]);

  const minTime = signal.windowStartMs;
  const maxTime = signal.windowEndMs;
  const transitTime = signal.batPlaneTimeMs;

  // Draw the synchronized stump-mic scope.
  useEffect(() => {
    const canvas = canvasRef.current;
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

    // Transit window: the frames in which the ball crossed the bat plane. The
    // operator checks alignment against this band; the band itself asserts
    // nothing about contact.
    const transitX = ((transitTime - minTime) / (maxTime - minTime)) * width;
    ctx.fillStyle = "rgba(56, 189, 248, 0.06)";
    ctx.fillRect(transitX - 22, 0, 44, height);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(transitX - 22, 0, 44, height);

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

    // Current Scrub Time Needle Indicator
    const currentNeedleX = ((currentTimeMs - minTime) / (maxTime - minTime)) * width;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(currentNeedleX, 0);
    ctx.lineTo(currentNeedleX, height);
    ctx.stroke();

    // Needle Top Indicator
    ctx.fillStyle = "#38BDF8";
    ctx.beginPath();
    ctx.moveTo(currentNeedleX - 4, 0);
    ctx.lineTo(currentNeedleX + 4, 0);
    ctx.lineTo(currentNeedleX, 7);
    ctx.closePath();
    ctx.fill();
  }, [signal, currentTimeMs, transitTime, minTime, maxTime]);

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

  // Magnified bat-ball proximity uses the same blur-limited optical evidence
  // as CAM 02, so this panel cannot leak the verdict either.
  const ballProgress = Math.max(0, Math.min(1, (currentTimeMs - minTime) / (maxTime - minTime)));
  const ballY = 20 + ballProgress * 180;
  const ballX = 76 + optical.apparentSeparationMm * 1.4;

  const alignmentOffsetMs = nearest ? Math.round(nearest.offsetMs) : null;

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Monitor Bar */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 04 • ULTRAEDGE / SNICKOMETER ACOUSTIC TELEMETRY
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            STUMP MIC SYNC
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
        <div className="mt-2 flex items-start gap-1.5 rounded border border-amber-500/40 bg-amber-950/40 px-2 py-1.5 text-[10px] text-amber-200">
          <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-400" />
          <span>{audioNotice}</span>
        </div>
      )}

      {/* Split View: Optical Zoom (Left) + Decibel Scope (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 my-2 flex-1 min-h-[220px]">
        {/* Left Column (5 Cols): Optical Super-Slow Bat-Ball Proximity Cam */}
        <div className="md:col-span-5 relative bg-gradient-to-b from-[#09111c] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center p-2 shadow-inner">
          <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

          <svg viewBox="0 0 160 220" className="w-full h-full max-h-[240px] z-10">
            <defs>
              <linearGradient id="batBladeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#92400e" />
              </linearGradient>
            </defs>

            {/* Cricket Bat Blade */}
            <rect x="25" y="20" width="34" height="180" rx="3" fill="url(#batBladeGrad)" stroke="#78350f" strokeWidth="1.2" />
            <text x="42" y="115" fill="#451a03" fontSize="9" fontFamily="monospace" fontWeight="900" transform="rotate(-90 42,115)" textAnchor="middle">
              BAT OUTSIDE EDGE
            </text>

            {/* Motion smear envelope: the reason fine separations cannot be read */}
            <rect
              x={ballX - 13 - optical.blurToleranceMm * 0.7}
              y={ballY - 13}
              width={(13 + optical.blurToleranceMm * 0.7) * 2}
              height="26"
              fill="#dc2626"
              opacity="0.22"
            />

            {/* Red Cricket Ball with Stitched White Seam */}
            <circle cx={ballX} cy={ballY} r="13" fill="#dc2626" stroke="#991b1b" strokeWidth="1" opacity="0.92" />
            <line x1={ballX - 9} y1={ballY} x2={ballX + 9} y2={ballY} stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2 1" opacity="0.7" />

            {/* Laser Gap Ruler, limited by the blur envelope */}
            <line
              x1="59"
              y1={ballY}
              x2={Math.max(59, ballX - 13 - optical.blurToleranceMm * 0.7)}
              y2={ballY}
              stroke="#38BDF8"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
            <circle cx="59" cy={ballY} r="2" fill="#38BDF8" />
            <circle cx={Math.max(59, ballX - 13 - optical.blurToleranceMm * 0.7)} cy={ballY} r="2" fill="#38BDF8" />
          </svg>

          {/* Resolved separation badge */}
          <div className="absolute bottom-2 left-2 z-20">
            <span className="text-[10px] font-mono font-bold bg-slate-950/90 text-cyan-300 px-2 py-0.5 rounded border border-slate-700">
              {optical.reading === "VISIBLE_DAYLIGHT"
                ? `RESOLVED: ${optical.apparentSeparationMm.toFixed(1)} mm DAYLIGHT`
                : `UNRESOLVED: < ${optical.blurToleranceMm} mm`}
            </span>
          </div>
        </div>

        {/* Right Column (7 Cols): Broadcast HTML5 Canvas Decibel Scope */}
        <div className="md:col-span-7 relative bg-[#070c14] rounded-lg border border-slate-800 overflow-hidden flex flex-col p-2 shadow-inner">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1 font-bold text-rose-400">
              <Activity size={12} />
              DECIBEL SPECTRUM
            </span>
            <span className="text-slate-500 font-bold">CLICK TO SCRUB NEEDLE</span>
          </div>

          <canvas
            ref={canvasRef}
            width={480}
            height={190}
            onClick={handleCanvasClick}
            className="w-full h-full rounded cursor-crosshair"
          />
        </div>
      </div>

      {/* Telemetry Diagnostics Footer. Reports measurements, not conclusions. */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">TRANSIENTS DETECTED</div>
          <div className="text-[11px] font-black text-cyan-300 truncate">
            {signal.transients.length} IN WINDOW
          </div>
        </div>

        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">NEAREST TO TRANSIT</div>
          <div className="text-[11px] font-black text-rose-300 truncate">
            {alignmentOffsetMs === null
              ? "NONE"
              : `${alignmentOffsetMs > 0 ? "+" : ""}${alignmentOffsetMs} ms`}
          </div>
        </div>

        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">PEAK AMPLITUDE</div>
          <div className="text-[11px] font-black text-amber-300 truncate">
            {nearest ? `${Math.round(nearest.transient.amplitude * 100)}%` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
};
