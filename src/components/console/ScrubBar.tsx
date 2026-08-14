import React from "react";
import {
  Play,
  Pause,
  Repeat,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Crosshair,
} from "lucide-react";
import { sounds } from "../../engine/audioSynth";

export interface KeyframeMarker {
  label: string;
  timeMs: number;
  color: string;
}

interface ScrubBarProps {
  currentTimeMs: number;
  minTimeMs?: number;
  maxTimeMs?: number;
  isPlaying: boolean;
  isRockAndRoll: boolean;
  playbackSpeed: number;
  onTimeChange: (timeMs: number) => void;
  onTogglePlay: () => void;
  onToggleRockAndRoll: () => void;
  onSpeedChange: (speed: number) => void;
  onStep: (frames: number) => void;
  keyFrameMarkers?: KeyframeMarker[];
}

export const ScrubBar: React.FC<ScrubBarProps> = ({
  currentTimeMs,
  minTimeMs = 600,
  maxTimeMs = 2200,
  isPlaying,
  isRockAndRoll,
  playbackSpeed,
  onTimeChange,
  onTogglePlay,
  onToggleRockAndRoll,
  onSpeedChange,
  onStep,
  keyFrameMarkers = [],
}) => {
  const speeds = [0.1, 0.25, 0.5, 1.0];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTimeChange(parseFloat(e.target.value));
  };

  const handleMarkerClick = (timeMs: number) => {
    onTimeChange(timeMs);
    sounds.playClick(950);
  };

  // Format virtual timecode (MM:SS:FF where 1 sec = 50 frames, 1 frame = 20ms)
  const totalSeconds = Math.floor(currentTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frames = Math.floor(((currentTimeMs % 1000) / 1000) * 50);
  const timecode = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frames.toString().padStart(2, "0")}`;

  const currentFrameNumber = Math.round(currentTimeMs / 20);

  return (
    <div className="hardware-panel rounded-xl p-3 font-mono select-none text-slate-200 space-y-2.5">
      {/* Timeline Scrubber Track with Clickable Keyframe Diamond Markers */}
      <div className="relative w-full pt-1 pb-1">
        <input
          type="range"
          min={minTimeMs}
          max={maxTimeMs}
          step={20}
          value={currentTimeMs}
          onChange={handleSliderChange}
          className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800 focus:outline-none"
        />

        {/* Keyframe Interactive Marker Layer (with staggered heights to prevent overlap) */}
        <div className="relative w-full h-8 mt-0.5">
          {keyFrameMarkers.map((marker, i) => {
            const markerPos =
              ((marker.timeMs - minTimeMs) / (maxTimeMs - minTimeMs)) * 100;
            if (markerPos < 0 || markerPos > 100) return null;

            const isNearCurrent = Math.abs(currentTimeMs - marker.timeMs) <= 30;
            const isStaggered = i % 2 === 1;

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleMarkerClick(marker.timeMs)}
                title={`Seek to ${marker.label} (${marker.timeMs}ms)`}
                className="absolute top-0 flex flex-col items-center -translate-x-1/2 group cursor-pointer pointer-events-auto transition-transform hover:scale-110 focus:outline-none z-10"
                style={{ left: `${markerPos}%` }}
              >
                {/* Diamond Pin */}
                <div
                  className={`w-2.5 h-2.5 rotate-45 border transition-all ${
                    isNearCurrent
                      ? "scale-125 ring-2 ring-white border-white shadow-lg"
                      : "border-slate-900 shadow-md group-hover:scale-110"
                  }`}
                  style={{ backgroundColor: marker.color }}
                />
                {/* Label Badge with Staggered Y Offset */}
                <span
                  className={`text-[9px] font-black whitespace-nowrap px-1.5 py-0.2 rounded border transition-all ${
                    isStaggered ? "mt-2.5" : "mt-0.5"
                  } ${
                    isNearCurrent
                      ? "bg-slate-900 border-white text-white shadow-md font-bold"
                      : "bg-slate-950/95 border-slate-800 text-slate-300 group-hover:border-slate-600"
                  }`}
                  style={{ color: isNearCurrent ? "#FFFFFF" : marker.color }}
                >
                  {marker.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Industrial Transport Deck Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
        {/* Frame Stepper Group & Play / Pause */}
        <div className="flex items-center space-x-1.5">
          {/* -5 Frames */}
          <button
            onClick={() => onStep(-5)}
            className="tactical-btn px-2.5 py-1.5 rounded text-slate-300 hover:text-white flex items-center gap-0.5 text-xs"
            title="Step back 5 frames (-100ms)"
          >
            <ChevronsLeft size={14} />
            <span className="text-[10px] font-bold">-5F</span>
          </button>

          {/* -1 Frame */}
          <button
            onClick={() => onStep(-1)}
            className="tactical-btn px-2.5 py-1.5 rounded text-slate-300 hover:text-white flex items-center gap-0.5 text-xs"
            title="Step back 1 frame (-20ms)"
          >
            <ChevronLeft size={14} />
            <span className="text-[10px] font-bold">-1F</span>
          </button>

          {/* PLAY / PAUSE Main Transport Button */}
          <button
            onClick={onTogglePlay}
            className={`tactical-btn px-4 py-1.5 rounded font-black flex items-center space-x-1.5 shadow-md active:scale-95 transition-all ${
              isPlaying
                ? "bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 border-amber-300 shadow-amber-500/25 ring-1 ring-amber-400"
                : "bg-gradient-to-r from-cyan-500 to-cyan-400 text-slate-950 border-cyan-300 shadow-cyan-500/25 hover:from-cyan-400 hover:to-cyan-300"
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={14} fill="currentColor" />
                <span className="text-xs">PAUSE</span>
              </>
            ) : (
              <>
                <Play size={14} fill="currentColor" />
                <span className="text-xs">PLAY</span>
              </>
            )}
          </button>

          {/* +1 Frame */}
          <button
            onClick={() => onStep(1)}
            className="tactical-btn px-2.5 py-1.5 rounded text-slate-300 hover:text-white flex items-center gap-0.5 text-xs"
            title="Step forward 1 frame (+20ms)"
          >
            <span className="text-[10px] font-bold">+1F</span>
            <ChevronRight size={14} />
          </button>

          {/* +5 Frames */}
          <button
            onClick={() => onStep(5)}
            className="tactical-btn px-2.5 py-1.5 rounded text-slate-300 hover:text-white flex items-center gap-0.5 text-xs"
            title="Step forward 5 frames (+100ms)"
          >
            <span className="text-[10px] font-bold">+5F</span>
            <ChevronsRight size={14} />
          </button>

          {/* Rock & Roll Shuttle Loop Toggle */}
          <button
            onClick={onToggleRockAndRoll}
            className={`tactical-btn px-3 py-1.5 rounded font-bold text-xs flex items-center space-x-1.5 transition-all ml-1.5 ${
              isRockAndRoll
                ? "bg-amber-950/80 border-amber-400 text-amber-300 shadow-md shadow-amber-500/30 ring-1 ring-amber-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
            title="Toggle Rock & Roll shuttle loop around key action event"
          >
            <Repeat size={13} className={isRockAndRoll ? "animate-spin" : ""} />
            <span>ROCK & ROLL</span>
          </button>
        </div>

        {/* Speed Selector, Frame Counter & Timecode */}
        <div className="flex items-center space-x-2.5">
          {/* Speed Buttons */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-[11px]">
            <span className="text-slate-500 px-1 text-[10px] font-bold">SPEED:</span>
            {speeds.map((s) => (
              <button
                key={s}
                onClick={() => onSpeedChange(s)}
                className={`px-2 py-0.5 rounded font-black transition-colors ${
                  playbackSpeed === s
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          {/* Frame Counter HUD */}
          <div className="hidden sm:flex items-center space-x-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
            <Crosshair size={12} className="text-cyan-400" />
            <span className="text-slate-500 text-[10px]">FRAME:</span>
            <span className="font-mono font-bold text-slate-200 tabular-nums">
              {currentFrameNumber}
            </span>
          </div>

          {/* Broadcast Timecode HUD */}
          <div className="flex items-center space-x-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-xs">
            <Clock size={13} className="text-cyan-400" />
            <span className="text-slate-500 text-[10px]">TIMECODE:</span>
            <span className="font-mono font-black text-cyan-300 tracking-wider tabular-nums">
              {timecode}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
