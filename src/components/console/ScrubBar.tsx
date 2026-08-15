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
  fps?: number;
  frameStepMs?: number;
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
  fps = 50,
  frameStepMs = 20,
}) => {
  const speeds = [0.1, 0.25, 0.5, 1.0];

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTimeChange(parseFloat(e.target.value));
  };

  const handleMarkerClick = (timeMs: number) => {
    onTimeChange(timeMs);
    sounds.playClick(950);
  };

  // Format virtual timecode (MM:SS:FF based on active feed's FPS)
  const totalSeconds = Math.floor(currentTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const frameInSecond = Math.floor(((currentTimeMs % 1000) / 1000) * fps);
  const timecode = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}:${frameInSecond.toString().padStart(2, "0")}`;

  const currentFrameNumber = Math.round(currentTimeMs / frameStepMs);

  return (
    <div className="hardware-panel rounded-xl p-3 font-mono select-none text-slate-200 space-y-2.5">
      {/* Timeline Scrubber Track with Clickable Keyframe Diamond Markers */}
      <div className="relative w-full pt-1 pb-1">
        <input
          type="range"
          min={minTimeMs}
          max={maxTimeMs}
          step={frameStepMs}
          value={currentTimeMs}
          onChange={handleSliderChange}
          className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 border border-slate-800 focus:outline-none"
        />

        {/* Keyframe Interactive Marker Layer */}
        <div className="relative w-full h-8 mt-0.5">
          {keyFrameMarkers.map((marker, i) => {
            const markerPos =
              ((marker.timeMs - minTimeMs) / (maxTimeMs - minTimeMs)) * 100;
            if (markerPos < 0 || markerPos > 100) return null;

            const isNearCurrent = Math.abs(currentTimeMs - marker.timeMs) <= Math.max(30, frameStepMs * 2);
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
                {/* Diamond Marker Pin */}
                <div
                  className={`w-3.5 h-3.5 rotate-45 border transition-all duration-150 ${
                    isNearCurrent
                      ? "ring-2 ring-white scale-125 shadow-lg"
                      : "opacity-80 group-hover:opacity-100 group-hover:scale-110"
                  }`}
                  style={{
                    backgroundColor: marker.color,
                    borderColor: isNearCurrent ? "#FFFFFF" : "rgba(0,0,0,0.6)",
                  }}
                />

                {/* Staggered Label Badge to prevent overlapping tags */}
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap transition-all duration-150 ${
                    isStaggered ? "mt-3" : "mt-0.5"
                  } ${
                    isNearCurrent
                      ? "bg-slate-900 text-cyan-300 border-cyan-400 font-black shadow-md scale-105"
                      : "bg-slate-950/90 text-slate-400 border-slate-800 group-hover:text-slate-200 group-hover:border-slate-600"
                  }`}
                >
                  {marker.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Transport Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
        {/* Left: Frame Steppers & Shuttle Controls */}
        <div className="flex items-center space-x-1.5">
          {/* -5 Frames */}
          <button
            type="button"
            onClick={() => onStep(-5)}
            title={`Step back 5 frames (${5 * frameStepMs}ms)`}
            className="transport-btn px-2 py-1.5 rounded flex items-center gap-0.5 text-xs font-bold"
          >
            <ChevronsLeft size={14} />
            <span>-5F</span>
          </button>

          {/* -1 Frame */}
          <button
            type="button"
            onClick={() => onStep(-1)}
            title={`Step back 1 frame (${frameStepMs}ms)`}
            className="transport-btn px-2 py-1.5 rounded flex items-center gap-0.5 text-xs font-bold"
          >
            <ChevronLeft size={14} />
            <span>-1F</span>
          </button>

          {/* PLAY / PAUSE Button */}
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause Replay" : "Play Replay"}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold tracking-wider transition-all duration-150 ${
              isPlaying
                ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.6)] font-black"
                : "transport-btn text-cyan-400"
            }`}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying ? "PAUSE" : "PLAY"}</span>
          </button>

          {/* +1 Frame */}
          <button
            type="button"
            onClick={() => onStep(1)}
            title={`Step forward 1 frame (${frameStepMs}ms)`}
            className="transport-btn px-2 py-1.5 rounded flex items-center gap-0.5 text-xs font-bold"
          >
            <span>+1F</span>
            <ChevronRight size={14} />
          </button>

          {/* +5 Frames */}
          <button
            type="button"
            onClick={() => onStep(5)}
            title={`Step forward 5 frames (${5 * frameStepMs}ms)`}
            className="transport-btn px-2 py-1.5 rounded flex items-center gap-0.5 text-xs font-bold"
          >
            <span>+5F</span>
            <ChevronsRight size={14} />
          </button>

          {/* ROCK & ROLL Shuttle Button */}
          <button
            type="button"
            onClick={onToggleRockAndRoll}
            title="Rock & Roll: Continuously shuttle-loop around decisive impact/bail frame"
            className={`px-2.5 py-1.5 rounded flex items-center gap-1.5 text-xs font-bold transition-all duration-150 ${
              isRockAndRoll
                ? "bg-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.6)] font-black animate-pulse"
                : "transport-btn text-amber-400 hover:text-amber-300"
            }`}
          >
            <Repeat size={13} className={isRockAndRoll ? "animate-spin" : ""} />
            <span>ROCK & ROLL</span>
          </button>
        </div>

        {/* Right: Variable Playback Speeds, Frame Counter & Live Virtual Timecode */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Speed Selector Buttons */}
          <div className="flex items-center space-x-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-500 font-bold px-1 uppercase tracking-wider">
              SPEED:
            </span>
            {speeds.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSpeedChange(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                  playbackSpeed === spd
                    ? "bg-cyan-950 border border-cyan-500/70 text-cyan-300 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Frame Counter Indicator */}
          <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <Crosshair size={12} className="text-cyan-400" />
            <span className="text-[11px] text-slate-400 font-bold">FRAME:</span>
            <span className="text-cyan-300 font-black tabular-nums">{currentFrameNumber}</span>
          </div>

          {/* Virtual Broadcast Timecode */}
          <div className="flex items-center space-x-1.5 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <Clock size={12} className="text-amber-400" />
            <span className="text-[10px] text-slate-500 font-bold">TIMECODE:</span>
            <span className="text-amber-300 font-black tabular-nums">{timecode}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
