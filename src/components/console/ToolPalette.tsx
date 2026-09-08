import React from "react";
import type { IncidentType } from "../../types/scenario";
import {
  Activity,
  Crosshair,
  Camera,
  Layers,
  ZoomIn,
  Flame,
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
          { id: "BROADCAST_FRONT", camCode: "CAM 01", label: "Impact Replay", icon: <Camera size={13} /> },
          { id: "PITCH_MAP", camCode: "CAM 03", label: "Hawk-Eye 3D", icon: <Crosshair size={13} /> },
        ];
      case "RUN_OUT":
        return [
          { id: "CREASE_ZOOM", camCode: "CAM 02", label: "Crease 500fps", icon: <ZoomIn size={13} /> },
          { id: "SIDE_ON_POP", camCode: "CAM 01", label: "Side-On Wide", icon: <Camera size={13} /> },
          { id: "OVERHEAD", camCode: "CAM 07", label: "Overhead", icon: <Layers size={13} /> },
        ];
      case "STUMPING":
        return [
          { id: "CREASE_ZOOM", camCode: "CAM 02", label: "Crease 500fps", icon: <ZoomIn size={13} /> },
          { id: "SIDE_ON_POP", camCode: "CAM 01", label: "Side-On Keeper", icon: <Camera size={13} /> },
        ];
      case "CAUGHT_BEHIND":
        return [
          { id: "BROADCAST_SLIP", camCode: "CAM 01", label: "Slip Cam", icon: <Camera size={13} /> },
          { id: "ULTRAEDGE", camCode: "CAM 04", label: "UltraEdge", icon: <Activity size={13} /> },
        ];
      case "BOUNDARY":
        return [
          { id: "BOUNDARY_ZOOM", camCode: "CAM 05", label: "Rope Cushion", icon: <ZoomIn size={13} /> },
          { id: "RELAY_CAM", camCode: "CAM 09", label: "Catch Relay", icon: <Camera size={13} /> },
        ];
      default:
        return [{ id: "DEFAULT", camCode: "CAM 01", label: "Replay", icon: <Camera size={13} /> }];
    }
  };

  const tools = getTools();

  const handleToolClick = (id: string) => {
    onSelectTool(id);
    sounds.playClick(850);
  };

  return (
    <div className="flex flex-wrap gap-1.5 select-none font-sans">
      {tools.map((tool) => {
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => handleToolClick(tool.id)}
            title={`${tool.camCode} \u2014 ${tool.label}`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-all border cursor-pointer active:scale-95 ${
              isActive
                ? "bg-[#182232] border-slate-500/70 text-white font-bold shadow-sm"
                : "bg-[#111722] hover:bg-[#182130] border-[#1E293B] text-slate-400 hover:text-white hover:border-[#2D3D58]"
            }`}
          >
            {isActive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
            <span className={isActive ? "text-slate-200" : "text-slate-500"}>{tool.icon}</span>
            <span className="font-semibold">{tool.label}</span>
          </button>
        );
      })}
    </div>
  );
};
