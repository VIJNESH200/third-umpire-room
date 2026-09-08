import React from "react";
import type { Scenario } from "../../types/scenario";
import { PitchMapOverlay } from "../tools/PitchMapOverlay";
import { FrontOnPitchView } from "../tools/FrontOnPitchView";
import { CreaseZoom } from "../tools/CreaseZoom";
import { StumpingEvidenceReview } from "../tools/StumpingEvidenceReview";
import { SideOnWideCreaseView } from "../tools/SideOnWideCreaseView";
import { OverheadCreaseView } from "../tools/OverheadCreaseView";
import { UltraEdgeWaveform } from "../tools/UltraEdgeWaveform";
import { HotSpotIRView } from "../tools/HotSpotIRView";
import { BoundaryZoom } from "../tools/BoundaryZoom";
import { CatchRelayView } from "../tools/CatchRelayView";
import { SlipCamReplayView } from "../tools/SlipCamReplayView";
import { StumpProjectionView } from "../tools/StumpProjectionView";
import { IncidentReplayFeed } from "../instinct/IncidentReplayFeed";

interface ReplayViewportProps {
  scenario: Scenario;
  activeTool: string;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
  onStageChange?: (stage: number) => void;
  trainingMode?: boolean;
}

export const ReplayViewport: React.FC<ReplayViewportProps> = ({
  scenario,
  activeTool,
  currentTimeMs,
  onTimeChange,
  onStageChange,
  trainingMode = false,
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
            trainingMode={trainingMode}
          />
        );
      }
      if (activeTool === "STUMP_PROJ") {
        return (
          <StumpProjectionView
            lbw={scenario.lbw}
            currentTimeMs={currentTimeMs}
          />
        );
      }
      // Default / BROADCAST_FRONT (CAM 01)
      return (
        <FrontOnPitchView
          lbw={scenario.lbw}
          currentTimeMs={currentTimeMs}
        />
      );
    }

    // 2. RUN OUT Incidents
    if (scenario.incidentType === "RUN_OUT" && scenario.runOut) {
      if (activeTool === "CREASE_ZOOM") {
        return (
          <CreaseZoom
            runOut={scenario.runOut}
            currentTimeMs={currentTimeMs}
            onTimeChange={onTimeChange}
            incidentType={scenario.incidentType}
          />
        );
      }
      if (activeTool === "SIDE_ON_POP") {
        return (
          <SideOnWideCreaseView
            runOut={scenario.runOut}
            currentTimeMs={currentTimeMs}
            incidentType={scenario.incidentType}
          />
        );
      }
      if (activeTool === "OVERHEAD") {
        return (
          <OverheadCreaseView
            runOut={scenario.runOut}
            currentTimeMs={currentTimeMs}
            incidentType={scenario.incidentType}
          />
        );
      }
      // Fallback
      return (
        <CreaseZoom
          runOut={scenario.runOut}
          currentTimeMs={currentTimeMs}
          onTimeChange={onTimeChange}
          incidentType={scenario.incidentType}
        />
      );
    }

    // 2b. STUMPING Incidents
    if (scenario.incidentType === "STUMPING" && scenario.stumping) {
      return (
        <StumpingEvidenceReview
          stumping={scenario.stumping}
          currentTimeMs={currentTimeMs}
          onTimeChange={onTimeChange}
        />
      );
    }

    // 3. CAUGHT BEHIND Incidents
    if (scenario.incidentType === "CAUGHT_BEHIND" && scenario.caughtBehind) {
      if (activeTool === "BROADCAST_SLIP") {
        return (
          <SlipCamReplayView
            caughtBehind={scenario.caughtBehind}
            currentTimeMs={currentTimeMs}
            scenario={scenario}
          />
        );
      }
      if (activeTool === "ULTRAEDGE") {
        return (
          <UltraEdgeWaveform
            caughtBehind={scenario.caughtBehind}
            currentTimeMs={currentTimeMs}
            onTimeChange={onTimeChange}
            scenario={scenario}
          />
        );
      }
      if (activeTool === "HOTSPOT" || activeTool === "STUMP_CAM") {
        return (
          <HotSpotIRView
            caughtBehind={scenario.caughtBehind}
            currentTimeMs={currentTimeMs}
          />
        );
      }

      // Fallback: Default to UltraEdge
      return (
        <UltraEdgeWaveform
          caughtBehind={scenario.caughtBehind}
          currentTimeMs={currentTimeMs}
          onTimeChange={onTimeChange}
          scenario={scenario}
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
      if (activeTool === "INSTINCT_CAM") {
        return (
          <div className="h-full w-full">
            <IncidentReplayFeed scenario={scenario} />
          </div>
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
