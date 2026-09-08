import React, { useEffect, useRef } from "react";
import type { StumpingData } from "../../types/scenario";
import { solveStumpingReplayState } from "../../engine/stumpingPhysics";
import { renderCanonicalStumpingScene } from "./stumpingScene";


// Option B — Tight Crease Camera: permanent 3.3x optical crop centered on popping crease & rear boot
export const TIGHT_CREASE_FRAMING = {
  zoom: 3.3,
  targetX: 342,
  targetY: 225,
} as const;

// Keeper / Wicket: 3.0x optical crop centered on striker stumps and keeper gloves
export const KEEPER_WICKET_FRAMING = {
  zoom: 3.0,
  targetX: 224,
  targetY: 195,
} as const;

interface StumpingEvidenceReviewProps {
  stumping: StumpingData;
  currentTimeMs: number;
  onTimeChange?: (timeMs: number) => void;
}

export const StumpingEvidenceReview: React.FC<StumpingEvidenceReviewProps> = ({
  stumping,
  currentTimeMs,
}) => {
  const windowACanvasRef = useRef<HTMLCanvasElement | null>(null);
  const windowBCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canonical physical replay state (shared between both windows)
  const state = solveStumpingReplayState(stumping, currentTimeMs);

  // 500 FPS Virtual Frame Calculation (2ms per frame)
  const currentFrame = Math.round((currentTimeMs / 1000) * 500);

  // SMPTE-style timecode (00:01:ss:ff at 500 FPS)
  const totalSeconds = currentTimeMs / 1000;
  const sec = Math.floor(totalSeconds % 60);
  const subFrame = Math.floor(((currentTimeMs % 1000) / 1000) * 500);
  const tcString = `00:01:${String(sec).padStart(2, "0")}:${String(subFrame).padStart(3, "0")}`;

  const bailsDislodged = state.stumps.bailsSeparating;

  // Render optical camera crops onto canvases
  useEffect(() => {
    const W = 800;
    const H = 450;

    // --- WINDOW A: KEEPER / WICKET CLOSE-UP ---
    // Camera centers tightly on striker stumps, Zing bails, and keeper gloves with optical zoom 3.0x
    if (windowACanvasRef.current) {
      const canvasA = windowACanvasRef.current;
      const ctxA = canvasA.getContext("2d");
      if (ctxA) {
        ctxA.clearRect(0, 0, W, H);
        ctxA.save();
        ctxA.translate(W / 2, H / 2);
        ctxA.scale(KEEPER_WICKET_FRAMING.zoom, KEEPER_WICKET_FRAMING.zoom);
        ctxA.translate(-KEEPER_WICKET_FRAMING.targetX, -KEEPER_WICKET_FRAMING.targetY);
        renderCanonicalStumpingScene(ctxA, W, H, stumping, currentTimeMs);
        ctxA.restore();
      }
    }

    // --- WINDOW B: FOOT / CREASE CLOSE-UP (OPTION B — TIGHT CREASE CAMERA) ---
    // Optical zoom 3.3x, centered on popping crease & rear boot (X=342, Y=225)
    // Frames: popping crease, rear boot, batting pad, lower leg, connected hip, with background stumps
    if (windowBCanvasRef.current) {
      const canvasB = windowBCanvasRef.current;
      const ctxB = canvasB.getContext("2d");
      if (ctxB) {
        ctxB.clearRect(0, 0, W, H);
        ctxB.save();
        ctxB.translate(W / 2, H / 2);
        ctxB.scale(TIGHT_CREASE_FRAMING.zoom, TIGHT_CREASE_FRAMING.zoom);
        ctxB.translate(-TIGHT_CREASE_FRAMING.targetX, -TIGHT_CREASE_FRAMING.targetY);
        renderCanonicalStumpingScene(ctxB, W, H, stumping, currentTimeMs);
        ctxB.restore();
      }
    }
  }, [stumping, currentTimeMs]);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-1.5 select-none font-mono text-slate-200">
      {/* Top Workstation Header */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            STUMPING EVIDENCE REVIEW • DUAL 500 FPS SYNCHRONIZED SUITE
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} / 1100 • 500FPS • TC {tcString}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/40 border border-cyan-500/40 px-2 py-0.5 rounded">
            SYNCHRONIZED DUAL FORENSIC STREAM
          </span>
        </div>
      </div>

      {/* Dual-Window Split Viewport Container with clean 1px divider */}
      <div className="relative flex-1 min-h-0 mt-1 grid grid-cols-1 md:grid-cols-2 rounded-lg border border-slate-800 overflow-hidden bg-black divide-y md:divide-y-0 md:divide-x divide-[#27272a] shadow-inner">
        {/* ================================================================= */}
        {/* WINDOW A: KEEPER / WICKET • 500 FPS CLOSE-UP                     */}
        {/* ================================================================= */}
        <div className="relative flex flex-col h-full bg-[#080d14] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20 z-20" />

          {/* Window A Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b121c] border-b border-slate-800 z-10 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
              <span className="text-xs font-bold text-cyan-200 tracking-wide">
                KEEPER / WICKET • 500 FPS CLOSE-UP
              </span>
            </div>
            <div className="flex items-center gap-2">
              {bailsDislodged ? (
                <span className="text-[10px] font-mono font-bold text-red-400 bg-red-950/60 border border-red-500/60 px-2 py-0.5 rounded flex items-center gap-1.5 shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  ZING FLASH • BAILS DISLODGED
                </span>
              ) : (
                <span className="text-[10px] font-mono text-amber-300 bg-amber-950/40 border border-amber-500/40 px-2 py-0.5 rounded">
                  BAILS INTACT
                </span>
              )}
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                F{currentFrame}
              </span>
            </div>
          </div>

          {/* Window A Core Question Prompt Bar */}
          <div className="px-3 py-1 bg-[#070c14] border-b border-slate-800/80 flex items-center justify-between text-[10.5px] font-sans font-semibold z-10 shrink-0">
            <span className="text-cyan-300/90 tracking-wide">
              CORE QUESTION: WHEN WERE THE BAILS DISLODGED?
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              FOCUS: WICKET / GLOVES
            </span>
          </div>

          {/* Window A Optical Canvas Viewport */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center p-1 bg-[#050b12]">
            <canvas
              ref={windowACanvasRef}
              width={800}
              height={450}
              className="w-full h-full object-contain z-10"
            />
          </div>
        </div>

        {/* ================================================================= */}
        {/* WINDOW B: FOOT / CREASE • 500 FPS CLOSE-UP                       */}
        {/* ================================================================= */}
        <div className="relative flex flex-col h-full bg-[#080d14] overflow-hidden">
          <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20 z-20" />

          {/* Window B Header */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#0b121c] border-b border-slate-800 z-10 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
              <span className="text-xs font-bold text-amber-200 tracking-wide">
                FOOT / CREASE • 500 FPS CLOSE-UP
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/50 border border-amber-500/40 px-2 py-0.5 rounded">
                3.3× OPTICAL CLOSE-UP
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-300 bg-slate-800/60 border border-slate-700/60 px-2 py-0.5 rounded">
                PURE OPTICAL EVIDENCE
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700/60">
                F{currentFrame}
              </span>
            </div>
          </div>

          {/* Window B Core Question Prompt Bar */}
          <div className="px-3 py-1 bg-[#070c14] border-b border-slate-800/80 flex items-center justify-between text-[10.5px] font-sans font-semibold z-10 shrink-0">
            <span className="text-amber-300/90 tracking-wide">
              CORE QUESTION: WHERE WAS THE STRIKER'S GROUNDED CONTACT?
            </span>
            <span className="font-mono text-[10px] text-slate-400">
              FOCUS: BOOT / POPPING CREASE
            </span>
          </div>

          {/* Window B Optical Canvas Viewport (STRICT ZERO-CAD OVERLAYS) */}
          <div className="relative flex-1 min-h-0 flex items-center justify-center p-1 bg-[#050b12]">
            <canvas
              ref={windowBCanvasRef}
              width={800}
              height={450}
              className="w-full h-full object-contain z-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
