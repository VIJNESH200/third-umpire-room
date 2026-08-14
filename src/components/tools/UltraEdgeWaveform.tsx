import React, { useRef, useEffect } from "react";
import type { CaughtBehindData } from "../../types/scenario";
import { Volume2, Activity } from "lucide-react";
import { sounds } from "../../engine/audioSynth";

interface UltraEdgeWaveformProps {
  caughtBehind: CaughtBehindData;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
}

export const UltraEdgeWaveform: React.FC<UltraEdgeWaveformProps> = ({
  caughtBehind,
  currentTimeMs,
  onTimeChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const minTime = 800;
  const maxTime = 1600;
  const contactTime = caughtBehind.ballPassesBatFrameMs; // ~1200ms

  // Draw synchronized audio decibel waveform onto canvas
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

    // Synchronized Contact Window (Cyan Frame)
    const contactX = ((contactTime - minTime) / (maxTime - minTime)) * width;
    ctx.fillStyle = "rgba(56, 189, 248, 0.06)";
    ctx.fillRect(contactX - 22, 0, 44, height);
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(contactX - 22, 0, 44, height);

    // Render Procedural UltraEdge Waveform
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#F43F5E"; // Clean broadcast magenta/rose
    ctx.shadowColor = "rgba(244, 63, 94, 0.5)";
    ctx.shadowBlur = 4;

    const numPoints = 220;
    for (let i = 0; i < numPoints; i++) {
      const t = minTime + (i / numPoints) * (maxTime - minTime);
      const x = (i / numPoints) * width;

      // Realistic microphone ambient noise floor
      let amplitude = (Math.sin(i * 0.4) * 3.5) + (Math.cos(i * 0.85) * 2.5);

      // 1. Wood Edge Spike (Multi-harmonic high-frequency resonant burst)
      if (caughtBehind.hasEdge && caughtBehind.waveformSpikeTimeMs) {
        const delta = Math.abs(t - caughtBehind.waveformSpikeTimeMs);
        if (delta < 50) {
          const envelope = Math.exp(-delta / 16);
          amplitude += Math.sin(delta * 0.8) * 52 * envelope * caughtBehind.spikeIntensity;
        }
      }

      // 2. Decoy Distractor Noise (Low-frequency pad / clothing brush)
      if (caughtBehind.distractorNoise && caughtBehind.distractorTimeMs) {
        const delta = Math.abs(t - caughtBehind.distractorTimeMs);
        if (delta < 75) {
          const envelope = Math.exp(-delta / 30);
          amplitude += Math.sin(delta * 0.22) * 25 * envelope;
        }
      }

      const y = centerY + amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

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
  }, [caughtBehind, currentTimeMs, contactTime]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = minTime + ratio * (maxTime - minTime);
    onTimeChange(newTime);
    sounds.playClick(900);
  };

  const handlePlaySound = () => {
    if (caughtBehind.hasEdge) {
      sounds.playUltraEdgeSound("WOODY_SNICK");
    } else if (caughtBehind.distractorNoise) {
      sounds.playUltraEdgeSound("DULL_THUD");
    } else {
      sounds.playUltraEdgeSound("SILENCE");
    }
  };

  // Magnified Bat-Ball Proximity parameters
  const ballProgress = Math.max(0, Math.min(1, (currentTimeMs - minTime) / (maxTime - minTime)));
  const ballY = 20 + ballProgress * 180;
  const ballX = caughtBehind.hasEdge ? 76 : 76 + caughtBehind.gapMm * 1.4;

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

            {/* Red Cricket Ball with Stitched White Seam */}
            <circle cx={ballX} cy={ballY} r="13" fill="#dc2626" stroke="#991b1b" strokeWidth="1" />
            <line x1={ballX - 9} y1={ballY} x2={ballX + 9} y2={ballY} stroke="#FFFFFF" strokeWidth="1.2" strokeDasharray="2 1" />

            {/* Laser Gap Ruler */}
            <line x1="59" y1={ballY} x2={ballX - 13} y2={ballY} stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="2 2" />
            <circle cx="59" cy={ballY} r="2" fill="#38BDF8" />
            <circle cx={ballX - 13} cy={ballY} r="2" fill="#38BDF8" />
          </svg>

          {/* Gap Readout Badge */}
          <div className="absolute bottom-2 left-2 z-20">
            <span className="text-[10px] font-mono font-bold bg-slate-950/90 text-cyan-300 px-2 py-0.5 rounded border border-slate-700">
              GAP: {caughtBehind.gapMm} mm {caughtBehind.gapMm > 0 ? "(CLEAR DAYLIGHT)" : "(EDGE CONTACT)"}
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

      {/* Telemetry Diagnostics Footer */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">TIMELINE SYNC</div>
          <div className="text-[11px] font-black text-cyan-300 truncate">
            {caughtBehind.hasEdge ? "EDGE SPIKE ALIGNED" : "FLATLINE / CLEAN"}
          </div>
        </div>

        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">FREQUENCY SIGNATURE</div>
          <div className="text-[11px] font-black text-rose-300 truncate">
            {caughtBehind.soundType.replace("_", " ")}
          </div>
        </div>

        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">OPTICAL CLEARANCE</div>
          <div className="text-[11px] font-black text-amber-300 truncate">
            {caughtBehind.hasEdge ? "ZERO GAP / WOOD IMPACT" : `${caughtBehind.gapMm}mm CLEAR DAYLIGHT`}
          </div>
        </div>
      </div>
    </div>
  );
};
