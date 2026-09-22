import React, { useEffect, useRef } from "react";
import type { LBWData } from "../../types/scenario";
import {
  getReplayFrameAtTime,
  renderReplayFrame,
  CAM01_CANVAS_WIDTH,
  CAM01_CANVAS_HEIGHT,
} from "../../engine/cam01Pipeline";

interface FrontOnPitchViewProps {
  lbw: LBWData;
  currentTimeMs: number;
}

export const FrontOnPitchView: React.FC<FrontOnPitchViewProps> = ({
  lbw,
  currentTimeMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute authoritative frame data for current time
  const frame = getReplayFrameAtTime(lbw, currentTimeMs);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    renderReplayFrame(ctx, frame);
  }, [frame]);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-1.5 select-none font-mono text-slate-200">
      {/* Broadcast Header Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 01 • BROADCAST IMPACT REPLAY
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {frame.frameIndex} • 50 FPS
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          <span>
            SPEED: <b className="text-cyan-300">{lbw.ballSpeedKph} KM/H</b>
          </span>
          <span>•</span>
          <span>
            TYPE: <b className="text-slate-200">{lbw.spinOrPace}</b>
          </span>
        </div>
      </div>

      {/* Replay Video Canvas */}
      <div className="relative flex-1 min-h-0 mt-1 bg-gradient-to-b from-[#0c1624] via-[#08101a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />
        <canvas
          ref={canvasRef}
          width={CAM01_CANVAS_WIDTH}
          height={CAM01_CANVAS_HEIGHT}
          className="w-full h-full object-contain block z-10"
        />

        {/* Live Replay Overlay Badges */}
        <div className="absolute top-2.5 left-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono backdrop-blur-sm z-20">
          <span className="text-slate-400 font-bold">STATUS: </span>
          <span className="text-cyan-300 font-black">{frame.phase}</span>
        </div>

        <div className="absolute bottom-2.5 right-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1 rounded text-[10px] text-slate-300 backdrop-blur-sm z-20">
          STRIKER SLOW-MO REPLAY • <b className="text-cyan-300">CAM 03</b> HAWK-EYE
        </div>
      </div>
    </div>
  );
};
