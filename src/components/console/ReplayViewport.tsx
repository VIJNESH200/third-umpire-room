import React from "react";
import type { Scenario } from "../../types/scenario";
import { PitchMapOverlay } from "../tools/PitchMapOverlay";
import { FrontOnPitchView } from "../tools/FrontOnPitchView";
import { StumpProjectionView } from "../tools/StumpProjectionView";
import { CreaseZoom } from "../tools/CreaseZoom";
import { SideOnWideCreaseView } from "../tools/SideOnWideCreaseView";
import { OverheadCreaseView } from "../tools/OverheadCreaseView";
import { UltraEdgeWaveform } from "../tools/UltraEdgeWaveform";
import { HotSpotIRView } from "../tools/HotSpotIRView";
import { SuperSlowEdgeView } from "../tools/SuperSlowEdgeView";
import { BoundaryZoom } from "../tools/BoundaryZoom";
import { CatchRelayView } from "../tools/CatchRelayView";

interface ReplayViewportProps {
  scenario: Scenario;
  activeTool: string;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
  onStageChange?: (stage: number) => void;
}

export const ReplayViewport: React.FC<ReplayViewportProps> = ({
  scenario,
  activeTool,
  currentTimeMs,
  onTimeChange,
  onStageChange,
}) => {
  const renderContent = () => {
    // 1. LBW Incidents
    if (scenario.incidentType === "LBW" && scenario.lbw) {
      if (activeTool === "PITCH_MAP") {
        return (
          <PitchMapOverlay
            lbw={scenario.lbw}
            onFieldSignal={scenario.onFieldSignal}
            onStageChange={onStageChange}
          />
        );
      }
      if (activeTool === "BROADCAST_FRONT") {
        return (
          <FrontOnPitchView
            lbw={scenario.lbw}
            currentTimeMs={currentTimeMs}
          />
        );
      }
      if (activeTool === "STUMP_PROJECTION") {
        return (
          <StumpProjectionView
            lbw={scenario.lbw}
            currentTimeMs={currentTimeMs}
          />
        );
      }
      // Fallback
      return (
        <PitchMapOverlay
          lbw={scenario.lbw}
          onFieldSignal={scenario.onFieldSignal}
          onStageChange={onStageChange}
        />
      );
    }

    // 2. RUN OUT & STUMPING Incidents
    if ((scenario.incidentType === "RUN_OUT" || scenario.incidentType === "STUMPING") && scenario.runOut) {
      if (activeTool === "CREASE_ZOOM") {
        return (
          <CreaseZoom
            runOut={scenario.runOut}
            currentTimeMs={currentTimeMs}
            onTimeChange={onTimeChange}
          />
        );
      }
      if (activeTool === "SIDE_ON_POP") {
        return (
          <SideOnWideCreaseView
            runOut={scenario.runOut}
            currentTimeMs={currentTimeMs}
          />
        );
      }
      if (activeTool === "OVERHEAD") {
        return (
          <OverheadCreaseView
            runOut={scenario.runOut}
            currentTimeMs={currentTimeMs}
          />
        );
      }
      // Fallback
      return (
        <CreaseZoom
          runOut={scenario.runOut}
          currentTimeMs={currentTimeMs}
          onTimeChange={onTimeChange}
        />
      );
    }

    // 3. CAUGHT BEHIND Incidents
    if (scenario.incidentType === "CAUGHT_BEHIND" && scenario.caughtBehind) {
      if (activeTool === "ULTRAEDGE") {
        return (
          <UltraEdgeWaveform
            caughtBehind={scenario.caughtBehind}
            currentTimeMs={currentTimeMs}
            onTimeChange={onTimeChange}
          />
        );
      }
      if (activeTool === "HOTSPOT") {
        return (
          <HotSpotIRView
            caughtBehind={scenario.caughtBehind}
            currentTimeMs={currentTimeMs}
          />
        );
      }
      if (activeTool === "SUPER_SLOW") {
        return (
          <SuperSlowEdgeView
            caughtBehind={scenario.caughtBehind}
            currentTimeMs={currentTimeMs}
          />
        );
      }
      // Fallback
      return (
        <UltraEdgeWaveform
          caughtBehind={scenario.caughtBehind}
          currentTimeMs={currentTimeMs}
          onTimeChange={onTimeChange}
        />
      );
    }

    // 4. BOUNDARY Incidents
    if (scenario.incidentType === "BOUNDARY" && scenario.boundary) {
      if (activeTool === "BOUNDARY_ZOOM") {
        return (
          <BoundaryZoom
            boundary={scenario.boundary}
            currentTimeMs={currentTimeMs}
            onTimeChange={onTimeChange}
          />
        );
      }
      if (activeTool === "RELAY_CAM") {
        return (
          <CatchRelayView
            boundary={scenario.boundary}
            currentTimeMs={currentTimeMs}
          />
        );
      }
      // Fallback
      return (
        <BoundaryZoom
          boundary={scenario.boundary}
          currentTimeMs={currentTimeMs}
          onTimeChange={onTimeChange}
        />
      );
    }

    return (
      <div className="flex items-center justify-center h-full monitor-frame rounded-xl border border-slate-700/80 p-6 font-mono text-slate-400">
        Review Telemetry Loading...
      </div>
    );
  };

  return <div className="h-full w-full">{renderContent()}</div>;
};
