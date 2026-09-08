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
    <div className="px-3 py-1 select-none text-neutral-200 space-y-0.5 bg-[#121213]">
      {/* Timeline Scrubber Track with Clickable Keyframe Diamond Markers */}
      <div className="relative w-full h-3 flex items-center">
        <input
          type="range"
          min={minTimeMs}
          max={maxTimeMs}
          step={frameStepMs}
          value={currentTimeMs}
          onChange={handleSliderChange}
          className="w-full h-1 bg-[#27272a] rounded-none appearance-none cursor-pointer accent-white focus:outline-none z-10"
        />

        {/* Keyframe Interactive Marker Layer — clickable diamond pips overlaid directly on track */}
        {keyFrameMarkers.map((marker, i) => {
          const markerPos =
            ((marker.timeMs - minTimeMs) / (maxTimeMs - minTimeMs)) * 100;
          if (markerPos < 0 || markerPos > 100) return null;

          const isNearCurrent = Math.abs(currentTimeMs - marker.timeMs) <= Math.max(30, frameStepMs * 2);

          return (
            <button
              key={i}
              type="button"
              onClick={() => handleMarkerClick(marker.timeMs)}
              title={`Seek to ${marker.label} (${marker.timeMs}ms)`}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group cursor-pointer pointer-events-auto transition-transform hover:scale-125 focus:outline-none z-20"
              style={{ left: `${markerPos}%` }}
            >
              {/* Diamond Marker Pin */}
              <div
                className={`w-2 h-2 rotate-45 border transition-all duration-100 ${
                  isNearCurrent
                    ? "ring-1 ring-white scale-110"
                    : "opacity-75 group-hover:opacity-100"
                }`}
                style={{
                  backgroundColor: marker.color,
                  borderColor: isNearCurrent ? "#FFFFFF" : "rgba(0,0,0,0.8)",
                }}
              />
            </button>
          );
        })}
      </div>

      {/* Main Transport Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#27272a]">
        {/* Left: Frame Steppers & Shuttle Controls */}
        <div className="flex items-center space-x-1">
          {/* -5 Frames */}
          <button
            type="button"
            onClick={() => onStep(-5)}
            title={`Step back 5 frames (${5 * frameStepMs}ms)`}
            className="px-2 py-0.5 rounded-sm text-xs font-mono cursor-pointer transition-colors bg-[#1a1a1b] hover:bg-[#27272a] border border-[#27272a] text-neutral-400 hover:text-white flex items-center gap-1"
          >
            <ChevronsLeft size={12} />
            <span>-5F</span>
          </button>

          {/* -1 Frame */}
          <button
            type="button"
            onClick={() => onStep(-1)}
            title={`Step back 1 frame (${frameStepMs}ms)`}
            className="px-2 py-0.5 rounded-sm text-xs font-mono cursor-pointer transition-colors bg-[#1a1a1b] hover:bg-[#27272a] border border-[#27272a] text-neutral-300 hover:text-white flex items-center gap-1"
          >
            <ChevronLeft size={12} />
            <span>-1F</span>
          </button>

          {/* PLAY / PAUSE Button (Prominent Wordle Tile) */}
          <button
            type="button"
            onClick={onTogglePlay}
            title={isPlaying ? "Pause Replay" : "Play Replay"}
            className={`px-3.5 py-0.5 rounded-sm text-xs font-bold tracking-wider transition-all uppercase cursor-pointer flex items-center gap-1.5 ${
              isPlaying
                ? "bg-white text-black hover:bg-neutral-200"
                : "bg-white text-black hover:bg-neutral-200"
            }`}
          >
            {isPlaying ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            <span>{isPlaying ? "PAUSE" : "PLAY"}</span>
          </button>

          {/* +1 Frame */}
          <button
            type="button"
            onClick={() => onStep(1)}
            title={`Step forward 1 frame (${frameStepMs}ms)`}
            className="px-2 py-0.5 rounded-sm text-xs font-mono cursor-pointer transition-colors bg-[#1a1a1b] hover:bg-[#27272a] border border-[#27272a] text-neutral-300 hover:text-white flex items-center gap-1"
          >
            <span>+1F</span>
            <ChevronRight size={12} />
          </button>

          {/* +5 Frames */}
          <button
            type="button"
            onClick={() => onStep(5)}
            title={`Step forward 5 frames (${5 * frameStepMs}ms)`}
            className="px-2 py-0.5 rounded-sm text-xs font-mono cursor-pointer transition-colors bg-[#1a1a1b] hover:bg-[#27272a] border border-[#27272a] text-neutral-400 hover:text-white flex items-center gap-1"
          >
            <span>+5F</span>
            <ChevronsRight size={12} />
          </button>

          {/* ROCK & ROLL Shuttle Button */}
          <button
            type="button"
            onClick={onToggleRockAndRoll}
            title="Rock & Roll: Continuously shuttle-loop around decisive impact/bail frame"
            className={`px-2.5 py-0.5 rounded-sm text-xs font-semibold tracking-wide transition-colors uppercase cursor-pointer flex items-center gap-1.5 border ${
              isRockAndRoll
                ? "bg-amber-600 border-amber-500 text-white font-bold"
                : "bg-[#1a1a1b] hover:bg-[#27272a] border-[#27272a] text-amber-400 hover:text-amber-300"
            }`}
          >
            <Repeat size={12} />
            <span>ROCK & ROLL</span>
          </button>
        </div>

        {/* Right: Variable Playback Speeds, Frame Counter & Live Virtual Timecode */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Speed Selector Buttons */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider">
              SPEED:
            </span>
            {speeds.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onSpeedChange(spd)}
                className={`px-1.5 py-0.5 rounded-sm text-xs font-mono transition-colors cursor-pointer ${
                  playbackSpeed === spd
                    ? "bg-[#27272a] text-white font-bold border border-[#3f3f46]"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <span className="text-neutral-700 select-none">•</span>

          {/* Frame Counter Indicator */}
          <div className="flex items-center space-x-1 font-mono">
            <span className="text-[10px] text-neutral-500 font-sans uppercase">FRAME:</span>
            <span className="text-neutral-200 font-bold text-xs tabular-nums">{currentFrameNumber}</span>
          </div>

          <span className="text-neutral-700 select-none">•</span>

          {/* Virtual Broadcast Timecode */}
          <div className="flex items-center space-x-1 font-mono">
            <span className="text-[10px] text-neutral-500 font-sans uppercase">TC:</span>
            <span className="text-neutral-300 text-xs tabular-nums">{timecode}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
