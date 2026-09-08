import React, { useState, useEffect } from "react";
import type { Scenario, IncidentType } from "../../types/scenario";
import {
  Camera,
  Activity,
  ZoomIn,
  Layers,
  Crosshair,
  Bookmark,
  Eye,
} from "lucide-react";
import { sounds } from "../../engine/audioSynth";

interface CameraSwitcherAnglesProps {
  scenario: Scenario;
  activeTool: string;
  onSelectTool: (toolId: string) => void;
  currentTimeMs: number;
  onTimeChange: (timeMs: number) => void;
  fps: number;
  playerBatGroundedMs?: number | null;
  playerBailsDislodgedMs?: number | null;
  timingTelemetrySlot?: React.ReactNode;
}

interface CameraConfig {
  id: string;
  camCode: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  renderThumbnail: () => React.ReactNode;
}

interface KeyFrameItem {
  id: string;
  frameNum: number;
  timeMs: number;
  label: string;
  isCustom?: boolean;
}

export const CameraSwitcherAngles: React.FC<CameraSwitcherAnglesProps> = ({
  scenario,
  activeTool,
  onSelectTool,
  currentTimeMs,
  onTimeChange,
  fps,
  playerBatGroundedMs,
  playerBailsDislodgedMs,
  timingTelemetrySlot,
}) => {
  const [userMarkers, setUserMarkers] = useState<KeyFrameItem[]>([]);

  // Build camera configuration per scenario incident type
  const getCameraConfigs = (type: IncidentType): CameraConfig[] => {
    switch (type) {
      case "CAUGHT_BEHIND":
        return [
          {
            id: "ULTRAEDGE",
            camCode: "CAM 02 ULTRAEDGE",
            label: "UltraEdge",
            description: "Ultra slow-mo • Edge detect",
            icon: <Activity size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                {/* Dark dual-feed split */}
                <rect width="160" height="100" fill="#080f1a" />
                <rect x="2" y="2" width="76" height="96" fill="#0c1626" rx="2" />
                <rect x="82" y="2" width="76" height="96" fill="#070c14" rx="2" />
                {/* Left: Bat and Ball close-up */}
                <rect x="42" y="15" width="10" height="70" fill="#f59e0b" rx="2" transform="rotate(-15 42 15)" />
                <circle cx="34" cy="50" r="5" fill="#ef4444" />
                {/* Right: Waveform trace */}
                <path
                  d="M 86,50 L 105,50 L 110,48 L 114,52 L 118,50 L 122,25 L 126,75 L 130,50 L 155,50"
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                  fill="none"
                />
                {/* Waveform transit needle */}
                <line x1="124" y1="5" x2="124" y2="95" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2,2" />
              </svg>
            ),
          },
        ];

      case "BOUNDARY":
        return [
          {
            id: "BOUNDARY_ZOOM",
            camCode: "CAM 05 CUSHION ZOOM",
            label: "Cushion Zoom",
            description: "Telephoto macro • Rope margin",
            icon: <ZoomIn size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#14301d" />
                {/* Boundary rope / foam wedge */}
                <polygon points="120,0 160,0 160,100 120,100" fill="#ea580c" />
                <line x1="120" y1="0" x2="120" y2="100" stroke="#fff" strokeWidth="2" />
                {/* Sliding fielder lead boot */}
                <rect x="80" y="60" width="32" height="12" fill="#38bdf8" rx="3" transform="rotate(-10 80 60)" />
                {/* Hands & Ball */}
                <circle cx="65" cy="45" r="5" fill="#ef4444" />
                <circle cx="62" cy="47" r="3" fill="#fdba74" />
              </svg>
            ),
          },
          {
            id: "RELAY_CAM",
            camCode: "CAM 09 CATCH RELAY",
            label: "Catch Relay",
            description: "Elevated 45° • Spatial continuity",
            icon: <Camera size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#0f2617" />
                {/* Curved boundary rope */}
                <path d="M 0,85 Q 80,60 160,85" stroke="#f97316" strokeWidth="4" fill="none" />
                <path d="M 0,85 Q 80,60 160,85" stroke="#fff" strokeWidth="1" strokeDasharray="4,4" fill="none" />
                {/* Airborne fielder */}
                <circle cx="75" cy="35" r="4" fill="#38bdf8" />
                <line x1="75" y1="39" x2="80" y2="52" stroke="#38bdf8" strokeWidth="2.5" />
                {/* Partner fielder */}
                <circle cx="115" cy="50" r="4" fill="#22c55e" />
                <line x1="115" y1="54" x2="115" y2="68" stroke="#22c55e" strokeWidth="2.5" />
              </svg>
            ),
          },
          {
            id: "INSTINCT_CAM",
            camCode: "CAM 04 TRACKING",
            label: "Tracking Cam",
            description: "Wide tracking • Field perspective",
            icon: <Eye size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#0d1b11" />
                {/* Outfield mow stripes */}
                <line x1="0" y1="25" x2="160" y2="25" stroke="#163820" strokeWidth="8" />
                <line x1="0" y1="55" x2="160" y2="55" stroke="#163820" strokeWidth="8" />
                <line x1="0" y1="85" x2="160" y2="85" stroke="#163820" strokeWidth="8" />
                {/* Parabolic ball trajectory arc */}
                <path d="M 10,80 Q 70,10 130,55" stroke="#facc15" strokeWidth="1.5" strokeDasharray="3,2" fill="none" />
                <circle cx="130" cy="55" r="4" fill="#ef4444" />
                <circle cx="135" cy="62" r="3" fill="#38bdf8" />
              </svg>
            ),
          },
        ];

      case "LBW":
        return [
          {
            id: "BROADCAST_FRONT",
            camCode: "CAM 01 IMPACT REPLAY",
            label: "Impact Replay",
            description: "Front-on zoom • Pitch corridor",
            icon: <Camera size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#132c1c" />
                <polygon points="65,0 95,0 120,100 40,100" fill="#a48c6f" />
                <line x1="45" y1="70" x2="115" y2="70" stroke="#fff" strokeWidth="1.5" />
                {/* Stumps & Batter Pad */}
                <rect x="76" y="50" width="8" height="22" fill="#fbbf24" rx="1" />
                <rect x="68" y="48" width="8" height="25" fill="#f1f5f9" rx="2" />
                <circle cx="70" cy="60" r="3.5" fill="#ef4444" />
              </svg>
            ),
          },
          {
            id: "PITCH_MAP",
            camCode: "CAM 03 HAWK-EYE 3D",
            label: "Hawk-Eye 3D",
            description: "Virtual ball tracking & path",
            icon: <Crosshair size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#081426" />
                <polygon points="65,10 95,10 125,95 35,95" fill="#0c2340" />
                {/* 3D Ball path */}
                <path d="M 80,15 L 82,50 L 78,80" stroke="#38bdf8" strokeWidth="2" fill="none" />
                {/* Impact point & Projected wickets */}
                <circle cx="82" cy="50" r="3" fill="#facc15" />
                <rect x="74" y="68" width="12" height="18" stroke="#ef4444" strokeWidth="1" fill="none" />
              </svg>
            ),
          },
        ];

      case "STUMPING":
        return [
          {
            id: "CREASE_ZOOM",
            camCode: "CAM 02 500FPS CREASE",
            label: "Crease 500fps",
            description: "500 FPS slow-mo • Foot/bat grounding & bails",
            icon: <ZoomIn size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#132c1c" />
                <polygon points="0,30 160,30 160,100 0,100" fill="#9e8568" />
                {/* White popping crease line */}
                <line x1="0" y1="58" x2="160" y2="58" stroke="#fff" strokeWidth="2.5" />
                {/* Stumps & Dislodged Bail */}
                <rect x="135" y="25" width="5" height="45" fill="#fbbf24" rx="1" />
                <rect x="128" y="15" width="10" height="3" fill="#f59e0b" rx="1" transform="rotate(-30 128 15)" />
                {/* Foot/boot reaching back towards crease */}
                <ellipse cx="80" cy="58" rx="14" ry="6" fill="#38bdf8" />
                <rect x="76" y="44" width="8" height="16" fill="#ffffff" rx="2" />
              </svg>
            ),
          },
          {
            id: "SIDE_ON_POP",
            camCode: "CAM 01 SIDE-ON KEEPER",
            label: "Side-On Keeper",
            description: "Keeper gather • Wicket put down",
            icon: <Camera size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#0d1f14" />
                <rect x="0" y="50" width="160" height="50" fill="#8f785d" />
                <line x1="0" y1="65" x2="160" y2="65" stroke="#fff" strokeWidth="1.5" />
                {/* Stumps */}
                <rect x="130" y="40" width="4" height="30" fill="#fbbf24" />
                {/* Keeper crouching behind stumps */}
                <circle cx="145" cy="38" r="4" fill="#38bdf8" />
                <circle cx="134" cy="46" r="3" fill="#fdba74" />
                {/* Batter advancing */}
                <circle cx="65" cy="36" r="4" fill="#f1f5f9" />
                <line x1="65" y1="40" x2="72" y2="65" stroke="#f1f5f9" strokeWidth="2" />
              </svg>
            ),
          },
        ];

      case "RUN_OUT":
      default:
        return [
          {
            id: "CREASE_ZOOM",
            camCode: "CAM 02 CREASE 500FPS",
            label: "Crease 500fps",
            description: "Ultra slow-mo • Line clearance",
            icon: <ZoomIn size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#132c1c" />
                <polygon points="0,30 160,30 160,100 0,100" fill="#9e8568" />
                {/* White popping crease line */}
                <line x1="0" y1="58" x2="160" y2="58" stroke="#fff" strokeWidth="2.5" />
                {/* Stumps & Dislodged Bail */}
                <rect x="135" y="25" width="5" height="45" fill="#fbbf24" rx="1" />
                <rect x="128" y="15" width="10" height="3" fill="#f59e0b" rx="1" transform="rotate(-30 128 15)" />
                {/* Bat sliding towards line */}
                <polygon points="50,56 100,56 95,50 48,50" fill="#d97706" />
              </svg>
            ),
          },
          {
            id: "SIDE_ON_POP",
            camCode: "CAM 01 SIDE-ON WIDE",
            label: "Side-On Wide",
            description: "Wide pitch • Stumps & crease",
            icon: <Camera size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#0d1f14" />
                <rect x="0" y="50" width="160" height="50" fill="#8f785d" />
                <line x1="0" y1="65" x2="160" y2="65" stroke="#fff" strokeWidth="1.5" />
                {/* Stumps and runner */}
                <rect x="140" y="40" width="4" height="30" fill="#fbbf24" />
                <circle cx="70" cy="45" r="4" fill="#38bdf8" />
                <line x1="70" y1="49" x2="82" y2="65" stroke="#38bdf8" strokeWidth="2" />
              </svg>
            ),
          },
          {
            id: "OVERHEAD",
            camCode: "CAM 07 OVERHEAD",
            label: "Overhead",
            description: "Bird's-eye • Bat grounding line",
            icon: <Layers size={13} />,
            renderThumbnail: () => (
              <svg className="w-full h-full" viewBox="0 0 160 100" fill="none" preserveAspectRatio="none">
                <rect width="160" height="100" fill="#947c61" />
                {/* Popping Crease line top-down */}
                <line x1="80" y1="0" x2="80" y2="100" stroke="#fff" strokeWidth="3" />
                {/* 3 Stumps top view */}
                <circle cx="140" cy="42" r="3" fill="#fbbf24" />
                <circle cx="140" cy="50" r="3" fill="#fbbf24" />
                <circle cx="140" cy="58" r="3" fill="#fbbf24" />
                {/* Bat blade grounded over crease */}
                <rect x="45" y="46" width="42" height="8" fill="#b45309" rx="1" />
              </svg>
            ),
          },
        ];
    }
  };

  // Get default keyframe markers per scenario
  const getDefaultKeyFrames = (): KeyFrameItem[] => {
    switch (scenario.incidentType) {
      case "CAUGHT_BEHIND":
        return [
          { id: "kf-pre", frameNum: 58, timeMs: 1160, label: "Pre-contact" },
          { id: "kf-transit", frameNum: 60, timeMs: 1200, label: "Bat-plane transit" },
          { id: "kf-post", frameNum: 62, timeMs: 1240, label: "Post-contact" },
          { id: "kf-past", frameNum: 68, timeMs: 1360, label: "Ball past bat" },
        ];
      case "BOUNDARY":
        return [
          { id: "kf-flight", frameNum: 50, timeMs: 1000, label: "Ball flight" },
          { id: "kf-intercept", frameNum: 60, timeMs: 1200, label: "First contact" },
          { id: "kf-rope", frameNum: 70, timeMs: 1400, label: "Cushion approach" },
          { id: "kf-ground", frameNum: 80, timeMs: 1600, label: "Ground contact" },
        ];
      case "LBW":
        return [
          { id: "kf-release", frameNum: 40, timeMs: 800, label: "Bowler release" },
          { id: "kf-bounce", frameNum: 60, timeMs: 1200, label: "Pitch bounce" },
          { id: "kf-impact", frameNum: 75, timeMs: 1500, label: "Pad impact" },
          { id: "kf-wickets", frameNum: 90, timeMs: 1800, label: "Stump arrival" },
        ];
      case "RUN_OUT":
        return [];
      case "STUMPING":
        return [
          { id: "kf-st-gathered", frameNum: Math.round((1040 / 1000) * fps), timeMs: 1040, label: "Ball gathered" },
        ];
      default:
        return [];
    }
  };

  const cameraConfigs = getCameraConfigs(scenario.incidentType);
  const defaultKeyFrames = getDefaultKeyFrames();

  // Reset user markers when scenario changes
  useEffect(() => {
    setUserMarkers([]);
  }, [scenario.id, scenario.incidentType]);

  // Synchronize active tool with available cameras
  useEffect(() => {
    if (cameraConfigs.length > 0 && !cameraConfigs.some((cam) => cam.id === activeTool)) {
      onSelectTool(cameraConfigs[0].id);
    }
  }, [cameraConfigs, activeTool, onSelectTool]);

  // Current frame calculated from canonical timeline
  const currentFrame = Math.round((currentTimeMs / 1000) * fps);

  // Handle Mark Event
  const handleMarkEvent = () => {
    if (
      userMarkers.some(
        (m) =>
          m.frameNum === currentFrame ||
          Math.abs(m.timeMs - currentTimeMs) < Math.max(1, 1000 / fps / 2)
      )
    ) {
      return;
    }
    const newMarker: KeyFrameItem = {
      id: `custom-${currentFrame}-${Date.now()}`,
      frameNum: currentFrame,
      timeMs: currentTimeMs,
      label: `Marked Event`,
      isCustom: true,
    };
    setUserMarkers((prev) => [...prev, newMarker]);
    sounds.playClick(950);
  };

  // Derive automatic keyframe markers from operator's marked evidence
  const autoMarkers: KeyFrameItem[] = [];
  if (playerBatGroundedMs !== null && playerBatGroundedMs !== undefined) {
    autoMarkers.push({
      id: "auto-bat-grounded",
      frameNum: Math.round((playerBatGroundedMs / 1000) * fps),
      timeMs: playerBatGroundedMs,
      label: scenario.incidentType === "STUMPING" ? "Bat/foot grounded" : "Bat grounded",
    });
  }
  if (playerBailsDislodgedMs !== null && playerBailsDislodgedMs !== undefined) {
    autoMarkers.push({
      id: "auto-bails-dislodged",
      frameNum: Math.round((playerBailsDislodgedMs / 1000) * fps),
      timeMs: playerBailsDislodgedMs,
      label: "Bails dislodged",
    });
  }

  // Deduplicate user markers against auto markers
  const filteredUserMarkers = userMarkers.filter(
    (um) => !autoMarkers.some((am) => am.frameNum === um.frameNum || Math.abs(am.timeMs - um.timeMs) < Math.max(1, 1000 / fps / 2))
  );

  const baseKeyFrames = scenario.incidentType === "RUN_OUT" ? [] : defaultKeyFrames;
  // Deduplicate base keyframes if an auto marker has the same purpose
  const filteredBaseKeyFrames = baseKeyFrames.filter(
    (bk) => !autoMarkers.some((am) => am.label.toLowerCase().includes("bails") && bk.label.toLowerCase().includes("bails"))
  );

  const allKeyFrames = [...filteredBaseKeyFrames, ...autoMarkers, ...filteredUserMarkers].sort((a, b) =>
    a.timeMs !== b.timeMs ? a.timeMs - b.timeMs : a.frameNum - b.frameNum
  );

  // Timing Delta calculation when both marks are present
  const hasBothTimingMarkers =
    playerBatGroundedMs !== null &&
    playerBatGroundedMs !== undefined &&
    playerBailsDislodgedMs !== null &&
    playerBailsDislodgedMs !== undefined;

  const deltaMs = hasBothTimingMarkers
    ? Math.abs(playerBailsDislodgedMs! - playerBatGroundedMs!)
    : 0;
  const deltaFrames = hasBothTimingMarkers
    ? Math.abs(
        Math.round((playerBailsDislodgedMs! / 1000) * fps) -
        Math.round((playerBatGroundedMs! / 1000) * fps)
      )
    : 0;
  const deltaColorClass = hasBothTimingMarkers
    ? playerBatGroundedMs! < playerBailsDislodgedMs!
      ? "text-emerald-400"
      : "text-red-400"
    : "text-neutral-300";

  return (
    <>
      {/* Column 1: Camera Switcher & Angles */}
      <div className="lg:col-span-5 flex flex-col justify-between gap-1.5 font-sans pr-0 lg:pr-2.5">
          {/* Column 1 Content: Stumping Dual Forensic Deck vs Camera Switcher */}
          {scenario.incidentType === "STUMPING" ? (
            /* STUMPING PHASE 2: SYNCHRONIZED FORENSIC STATUS DECK */
            <div className="space-y-1.5">
              <div className="flex items-center justify-between pb-1 border-b border-[#27272a]">
                <span className="text-xs font-bold tracking-wider text-neutral-200 uppercase">
                  SYNCHRONIZED FORENSIC SUITE
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded-xs border border-cyan-700/50 uppercase font-semibold">
                  DUAL 500 FPS STREAM
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="p-1.5 rounded-sm border border-cyan-500/50 bg-[#161618] flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-[10.5px] font-bold text-neutral-200 truncate">
                      WINDOW A • KEEPER / WICKET
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                  </div>
                  <p className="text-[9.5px] text-cyan-400 font-mono truncate leading-tight mt-0.5">
                    500 FPS CLOSE-UP • ACTIVE
                  </p>
                </div>

                <div className="p-1.5 rounded-sm border border-amber-500/50 bg-[#161618] flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] sm:text-[10.5px] font-bold text-neutral-200 truncate">
                      WINDOW B • FOOT / CREASE
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  </div>
                  <p className="text-[9.5px] text-amber-400 font-mono truncate leading-tight mt-0.5">
                    500 FPS CLOSE-UP • ACTIVE
                  </p>
                </div>
              </div>

              <div className="text-[10px] text-neutral-400 font-sans italic px-0.5">
                Dual macro viewports locked to canonical replay timeline (2ms/frame).
              </div>
            </div>
          ) : (
            <>
              {/* 1. Header Bar with Clean Title & Camera Switcher Tabs */}
              <div className="flex items-center justify-between pb-1 border-b border-[#27272a]">
                <span className="text-xs font-bold tracking-wider text-neutral-200 uppercase">
                  CAMERA ANGLES
                </span>

                {/* Camera Toggle Buttons Ribbon in Header */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {cameraConfigs.map((cam) => {
                    const isActive = activeTool === cam.id;
                    return (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => {
                          onSelectTool(cam.id);
                          sounds.playClick(850);
                        }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium tracking-wide transition-colors border cursor-pointer whitespace-nowrap ${
                          isActive
                            ? "bg-[#27272a] border-cyan-500 text-white font-semibold"
                            : "bg-[#1a1a1b] hover:bg-[#242426] border-[#27272a] text-neutral-400 hover:text-white"
                        }`}
                      >
                        <span>{cam.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Camera Thumbnail Preview Cards */}
              {cameraConfigs.length === 1 ? (
                // Single Camera (Caught Behind: UltraEdge)
                <div
                  onClick={() => {
                    onSelectTool(cameraConfigs[0].id);
                    sounds.playClick(850);
                  }}
                  className="flex items-center gap-3 p-1.5 rounded-sm border border-cyan-500 bg-[#1a1a1b] cursor-pointer group"
                >
                  <div className="relative w-36 h-14 sm:h-16 rounded-xs overflow-hidden shrink-0 bg-black border border-[#27272a]">
                    {cameraConfigs[0].renderThumbnail()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-200 uppercase">
                        {cameraConfigs[0].label}
                      </span>
                      <span className="text-[9.5px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded-xs border border-cyan-700/50">
                        PRIMARY FORENSIC FEED
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-400 font-sans mt-0.5 truncate leading-snug">
                      {cameraConfigs[0].description} • Optical slow-mo & acoustic trace
                    </p>
                  </div>
                </div>
              ) : (
                // 2 or 3 Cameras (LBW, Run Out, Boundary)
                <div
                  className={`grid gap-1.5 ${
                    cameraConfigs.length === 2 ? "grid-cols-2" : "grid-cols-3"
                  }`}
                >
                  {cameraConfigs.map((cam) => {
                    const isActive = activeTool === cam.id;
                    return (
                      <div
                        key={cam.id}
                        onClick={() => {
                          onSelectTool(cam.id);
                          sounds.playClick(850);
                        }}
                        className={`flex flex-col rounded-sm border transition-colors cursor-pointer group overflow-hidden ${
                          isActive
                            ? "border-cyan-500 bg-[#1a1a1b]"
                            : "border-[#27272a] bg-[#161618] hover:border-neutral-500"
                        }`}
                      >
                        {/* Visual SVG Thumbnail */}
                        <div className="relative w-full aspect-[16/9] bg-black overflow-hidden max-h-[52px] sm:max-h-[58px]">
                          {cam.renderThumbnail()}
                        </div>

                        {/* Underneath Caption */}
                        <div className="p-1 bg-[#121213] border-t border-[#27272a] flex flex-col justify-center">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] sm:text-[10.5px] font-semibold text-neutral-200 truncate">
                              {cam.label}
                            </span>
                            {isActive && (
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                            )}
                          </div>
                          <p className="text-[9.5px] text-neutral-400 font-sans truncate leading-tight mt-0.5">
                            {cam.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

        {/* Optional Timing Telemetry inside Camera Switcher column */}
        {timingTelemetrySlot}
      </div>

      {/* Column 2: Key Frames */}
      <div className="lg:col-span-3 flex flex-col justify-between gap-1.5 font-sans px-0 lg:px-2.5">
        <div className="space-y-1.5">
          {/* Key Frames Header with + MARK EVENT Button */}
          <div className="flex items-center justify-between pb-1 border-b border-[#27272a]">
            <span className="text-xs font-bold tracking-wider text-neutral-200 uppercase">
              KEY FRAMES
            </span>
            <button
              type="button"
              onClick={handleMarkEvent}
              className="flex items-center gap-1 py-0.5 px-2 rounded-sm bg-[#1a1a1b] hover:bg-[#27272a] border border-[#27272a] text-neutral-300 hover:text-white text-[10.5px] font-medium tracking-wide transition-colors cursor-pointer"
            >
              <Bookmark size={11} className="text-neutral-400" />
              <span>+ MARK EVENT</span>
            </button>
          </div>

          {/* Key Frames List (Clean rows with bullet indicators) */}
          <div className="space-y-0.5 max-h-[102px] overflow-y-auto pr-0.5">
            {allKeyFrames.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-4 text-center select-none">
                <span className="text-xs text-neutral-400 italic">No marked events</span>
                <span className="text-[10px] text-neutral-500 mt-0.5">
                  Press + MARK EVENT to bookmark frames
                </span>
              </div>
            ) : (
              <>
                {allKeyFrames.map((kf) => {
                  const isCurrent =
                    currentFrame === kf.frameNum ||
                    Math.abs(currentTimeMs - kf.timeMs) < Math.max(1, 1000 / fps / 2);
                  return (
                    <button
                      key={kf.id}
                      type="button"
                      onClick={() => {
                        onTimeChange(kf.timeMs);
                        sounds.playClick(800);
                      }}
                      className={`w-full flex items-center gap-2 px-2 py-0.5 rounded-xs text-xs font-mono transition-colors text-left cursor-pointer ${
                        isCurrent
                          ? "bg-[#1a1a1b] text-white font-bold border-l-2 border-cyan-400"
                          : "text-neutral-400 hover:text-neutral-200 hover:bg-[#1a1a1b]/50 border-l-2 border-transparent"
                      }`}
                    >
                      <span className="text-xs shrink-0 select-none">
                        {isCurrent ? "●" : "○"}
                      </span>
                      <span className="font-mono text-neutral-200 text-[11px]">
                        F{kf.frameNum}
                      </span>
                      <span className="truncate font-sans text-neutral-300 text-[11px]">
                        {kf.label}
                      </span>
                    </button>
                  );
                })}

                {/* Timing Delta readout when both marks are present */}
                {hasBothTimingMarkers && (
                  <div className="flex items-center justify-between px-2 py-1 mt-1 rounded-xs bg-[#161618] border border-[#27272a] font-mono text-[11px]">
                    <span className="text-neutral-400 font-sans text-[10px] font-semibold">DELTA</span>
                    <span className={`font-bold ${deltaColorClass}`}>
                      Δ{deltaFrames}F ({deltaMs}ms)
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
