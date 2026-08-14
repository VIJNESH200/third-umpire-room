import React from "react";
import type { IncidentType } from "../../types/scenario";
import {
  Activity,
  Crosshair,
  Camera,
  Layers,
  ZoomIn,
  Flame,
  Sliders,
  Tv,
} from "lucide-react";
import { sounds } from "../../engine/audioSynth";

interface ToolPaletteProps {
  incidentType: IncidentType;
  activeTool: string;
  onSelectTool: (toolId: string) => void;
}

export interface ToolOption {
  id: string;
  label: string;
  camCode: string;
  icon: React.ReactNode;
  badge?: string;
}

export const ToolPalette: React.FC<ToolPaletteProps> = ({
  incidentType,
  activeTool,
  onSelectTool,
}) => {
  const getTools = (): ToolOption[] => {
    switch (incidentType) {
      case "LBW":
        return [
          { id: "PITCH_MAP", camCode: "CAM 03", label: "Hawk-Eye 3D", icon: <Crosshair size={14} />, badge: "PITCH MAP" },
          { id: "BROADCAST_FRONT", camCode: "CAM 01", label: "Front-On Cam", icon: <Camera size={14} /> },
          { id: "STUMP_PROJECTION", camCode: "CAM 06", label: "Stump Face", icon: <Layers size={14} /> },
        ];
      case "RUN_OUT":
      case "STUMPING":
        return [
          { id: "CREASE_ZOOM", camCode: "CAM 02", label: "Crease 500fps", icon: <ZoomIn size={14} />, badge: "ZING BAIL" },
          { id: "SIDE_ON_POP", camCode: "CAM 01", label: "Side-On Wide", icon: <Camera size={14} /> },
          { id: "OVERHEAD", camCode: "CAM 07", label: "Overhead Crease", icon: <Layers size={14} /> },
        ];
      case "CAUGHT_BEHIND":
        return [
          { id: "ULTRAEDGE", camCode: "CAM 04", label: "UltraEdge Wave", icon: <Activity size={14} />, badge: "MIC SNICKO" },
          { id: "HOTSPOT", camCode: "CAM 08", label: "HotSpot IR", icon: <Flame size={14} />, badge: "THERMAL" },
          { id: "SUPER_SLOW", camCode: "CAM 02", label: "Super Slow-Mo", icon: <Camera size={14} /> },
        ];
      case "BOUNDARY":
        return [
          { id: "BOUNDARY_ZOOM", camCode: "CAM 05", label: "Rope Cushion", icon: <ZoomIn size={14} />, badge: "4K ROPE" },
          { id: "RELAY_CAM", camCode: "CAM 09", label: "Catch Relay Cam", icon: <Camera size={14} /> },
        ];
      default:
        return [{ id: "DEFAULT", camCode: "CAM 01", label: "Replay Vision", icon: <Camera size={14} /> }];
    }
  };

  const tools = getTools();

  const handleToolClick = (id: string) => {
    onSelectTool(id);
    sounds.playClick(850);
  };

  return (
    <div className="hardware-panel rounded-xl p-3 font-mono select-none flex flex-col gap-2.5 shadow-lg">
      <div className="flex items-center justify-between text-xs text-slate-400 border-b border-console-800 pb-2">
        <span className="flex items-center gap-1.5 font-bold text-slate-200">
          <Sliders size={13} className="text-cyan-400" />
          CAMERA MATRIX
        </span>
        <span className="text-[10px] bg-console-950 px-2 py-0.5 rounded border border-console-800 text-slate-400">
          {incidentType} FEEDS
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => handleToolClick(tool.id)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-xs transition-all border shadow-sm active:scale-98 ${
                isActive
                  ? "bg-gradient-to-r from-cyan-950 to-console-900 border-cyan-500/80 text-cyan-200 shadow-cyan-500/20 font-bold ring-1 ring-cyan-500/40"
                  : "tactical-btn text-slate-300 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                  isActive ? "bg-cyan-500 text-slate-950 border-cyan-400" : "bg-console-950 text-slate-400 border-console-800"
                }`}>
                  {tool.camCode}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={isActive ? "text-cyan-400" : "text-slate-400"}>
                    {tool.icon}
                  </span>
                  <span>{tool.label}</span>
                </span>
              </div>

              {tool.badge && (
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                    isActive
                      ? "bg-cyan-400/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-console-950 text-slate-500 border border-console-800"
                  }`}
                >
                  {tool.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
