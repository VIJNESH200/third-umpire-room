import React, { useState } from "react";
import type { RunOutData } from "../../types/scenario";
import { solveRunOutReplayState } from "../../engine/runOutPhysics";
import { ZoomIn, Crosshair, Video } from "lucide-react";

interface StrikerStumpCamViewProps {
  runOut: RunOutData;
  currentTimeMs: number;
}

/**
 * 3D Perspective Projection for CAM 10 (Striker Stump Ground Cam)
 * Origin (0,0,0) is at the base of the middle stump on the bowling crease.
 * - worldX: distance along pitch corridor from stumps (0 to 3500mm). Popping crease is at X = 1220mm.
 * - worldY: lateral offset across pitch (-1500mm off-side to +1500mm leg-side).
 * - worldZ: height above pitch turf (0 = turf, >0 = airborne).
 */
export function projectPitchToCAM10(
  worldX: number,
  worldY: number,
  worldZ: number = 0
): { x: number; y: number; scale: number } {
  // Camera world coordinates: placed 1.1m behind stumps, 1.8m on off-side, 380mm height
  const camX = -1100;
  const camY = -1800;
  const camZ = 380;

  // Normalized camera basis vectors
  const fx = 0.797;
  const fy = 0.592;
  const fz = -0.115;

  const rx = 0.597;
  const ry = -0.802;
  const rz = 0.0;

  const ux = -0.092;
  const uy = -0.069;
  const uz = 0.993;

  const dx = worldX - camX;
  const dy = worldY - camY;
  const dz = worldZ - camZ;

  const depth = dx * fx + dy * fy + dz * fz;
  const u = dx * rx + dy * ry + dz * rz;
  const v = dx * ux + dy * uy + dz * uz;

  const focal = 380;
  const centerX = 235;
  const centerY = 160;

  const screenX = centerX + (u / depth) * focal;
  const screenY = centerY - (v / depth) * focal;
  const scale = focal / depth;

  return { x: screenX, y: screenY, scale };
}

export const StrikerStumpCamView: React.FC<StrikerStumpCamViewProps> = ({
  runOut,
  currentTimeMs,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1.25);
  const [showLaser, setShowLaser] = useState<boolean>(true);

  // Canonical shared physical replay state
  const state = solveRunOutReplayState(runOut, currentTimeMs);

  // Project Pitch Surface Corners (from Stumps X=0 to Deep Pitch X=3600)
  const pitchNearLeft = projectPitchToCAM10(0, -1500, 0);
  const pitchNearRight = projectPitchToCAM10(0, 1500, 0);
  const pitchFarRight = projectPitchToCAM10(3600, 1500, 0);
  const pitchFarLeft = projectPitchToCAM10(3600, -1500, 0);

  // Project Popping Crease White Line at X = 1220mm
  const creaseLeft = projectPitchToCAM10(1220, -1350, 0);
  const creaseRight = projectPitchToCAM10(1220, 1350, 0);
  const creaseLeftBack = projectPitchToCAM10(1170, -1350, 0);
  const creaseRightBack = projectPitchToCAM10(1170, 1350, 0);

  // Project Laser Guide
  const laserLeft = projectPitchToCAM10(1220, -1600, 0);
  const laserRight = projectPitchToCAM10(1220, 1600, 0);

  // Project Stumps (Base and Top for Middle, Off, Leg)
  const offStumpBase = projectPitchToCAM10(0, -114, 0);
  const offStumpTop = projectPitchToCAM10(0, -114, 711);

  const midStumpBase = projectPitchToCAM10(0, 0, 0);
  const midStumpTop = projectPitchToCAM10(0, 0, 711);

  const legStumpBase = projectPitchToCAM10(0, 114, 0);
  const legStumpTop = projectPitchToCAM10(0, 114, 711);

  // Project Bat Tip, Handle, and Ground Shadow
  const pTip = projectPitchToCAM10(
    state.bat.tipWorldX,
    state.bat.tipWorldY,
    state.bat.tipWorldZ
  );
  const pHandle = projectPitchToCAM10(
    state.bat.handleWorldX,
    state.bat.handleWorldY,
    state.bat.handleWorldZ
  );

  const pShadowTip = projectPitchToCAM10(
    state.bat.tipWorldX,
    state.bat.tipWorldY,
    0
  );
  const pShadowHandle = projectPitchToCAM10(
    state.bat.handleWorldX,
    state.bat.handleWorldY,
    0
  );

  // Project Zing bails from canonical state
  const bailsDislodged = state.stumps.bailsSeparating;
  const bailZ = state.stumps.bailDisplacementMm.z;
  const bailX = state.stumps.bailDisplacementMm.x;
  const bailY = state.stumps.bailDisplacementMm.y;

  const bailCenter = projectPitchToCAM10(bailX, bailY, 711 + bailZ);
  const bailRotation = state.stumps.bailRotationDeg;

  // Virtual 500 FPS frame counter
  const currentFrame = Math.round((currentTimeMs / 1000) * 500);

  // Grounding vs Airborne Bat
  const isAirborne = !state.bat.isGrounded;

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Monitor Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 10 • STRIKER STUMP GROUND CAM (500 FPS)
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} / 1100 • LOW-ANGLE
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* Crease Laser Guide Toggle */}
          <button
            onClick={() => setShowLaser(!showLaser)}
            className={`tactical-btn px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors ${
              showLaser ? "text-cyan-300 border-cyan-500/50 bg-cyan-950/40" : "text-slate-400"
            }`}
          >
            <Crosshair size={12} className={showLaser ? "text-cyan-400" : "text-slate-500"} />
            <span>Crease Guide</span>
          </button>

          {/* Optical Zoom Toggle */}
          <button
            onClick={() => setZoomLevel(zoomLevel === 1.25 ? 1.65 : 1.25)}
            className="tactical-btn px-2.5 py-1 rounded text-[11px] font-bold text-slate-300 flex items-center gap-1"
          >
            <ZoomIn size={12} className="text-amber-400" />
            <span>{zoomLevel.toFixed(2)}x</span>
          </button>
        </div>
      </div>

      {/* Main Slow-Mo Canvas Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#09121a] via-[#050a10] to-[#020508] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />

        <svg
          viewBox="0 0 500 280"
          className="w-full h-full max-h-[350px] transition-transform duration-150 z-10"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <defs>
            {/* Turf Grass Gradient */}
            <linearGradient id="stumpTurf" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#142c1e" />
              <stop offset="100%" stopColor="#0c1b12" />
            </linearGradient>

            {/* Pitch Clay Strip in Low-Angle Perspective */}
            <linearGradient id="stumpPitchClay" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#a38865" />
              <stop offset="50%" stopColor="#8f7655" />
              <stop offset="100%" stopColor="#7a6345" />
            </linearGradient>

            {/* Willow Wood Texture Gradient */}
            <linearGradient id="stumpWillow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="40%" stopColor="#c2710c" />
              <stop offset="70%" stopColor="#b45309" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>
          </defs>

          {/* Outfield Grass */}
          <rect x="0" y="0" width="500" height="280" fill="url(#stumpTurf)" />

          {/* Perspective Pitch Corridor receding from Stumps (Left) to Deep Pitch (Right) */}
          <polygon
            points={`${pitchNearLeft.x},${pitchNearLeft.y} ${pitchNearRight.x},${pitchNearRight.y} ${pitchFarRight.x},${pitchFarRight.y} ${pitchFarLeft.x},${pitchFarLeft.y}`}
            fill="url(#stumpPitchClay)"
          />

          {/* Pitch surface wear strip */}
          <polygon
            points={`${pitchNearLeft.x + 15},${pitchNearLeft.y - 4} ${pitchNearRight.x - 10},${pitchNearRight.y + 2} ${pitchFarRight.x - 8},${pitchFarRight.y + 1} ${pitchFarLeft.x + 10},${pitchFarLeft.y - 2}`}
            fill="#b89a74"
            opacity="0.25"
          />

          {/* Popping Crease White Line in 3D Perspective (Runs across pitch at X = 1220mm) */}
          <polygon
            points={`${creaseLeft.x},${creaseLeft.y} ${creaseRight.x},${creaseRight.y} ${creaseRightBack.x},${creaseRightBack.y} ${creaseLeftBack.x},${creaseLeftBack.y}`}
            fill="#FFFFFF"
            opacity="0.95"
          />
          <text
            x={(creaseLeft.x + creaseRight.x) / 2 - 20}
            y={(creaseLeft.y + creaseRight.y) / 2 - 8}
            fill="#38BDF8"
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
            transform={`rotate(-12 ${(creaseLeft.x + creaseRight.x) / 2} ${(creaseLeft.y + creaseRight.y) / 2})`}
          >
            POPPING CREASE
          </text>

          {/* Laser Guide Alignment Beam along Popping Crease Plane */}
          {showLaser && (
            <line
              x1={laserLeft.x}
              y1={laserLeft.y}
              x2={laserRight.x}
              y2={laserRight.y}
              stroke="#00E5FF"
              strokeWidth="1.2"
              strokeDasharray="4 2"
              opacity="0.85"
            />
          )}

          {/* Dynamic Ground Shadow of Bat on Turf (Z = 0) */}
          <line
            x1={pShadowTip.x}
            y1={pShadowTip.y}
            x2={pShadowHandle.x}
            y2={pShadowHandle.y}
            stroke="#000000"
            strokeWidth={10 * pShadowTip.scale}
            strokeLinecap="round"
            opacity={isAirborne ? 0.20 : 0.60}
          />

          {/* Cricket Bat Blade & Handle projected in 3D Space */}
          <g>
            {/* Bat Blade Line / Polygon from Tip to Shoulder */}
            {/* Blade thickness offset perpendicular to blade axis */}
            {(() => {
              const bladeLength = Math.hypot(pHandle.x - pTip.x, pHandle.y - pTip.y);
              const nx = (-(pHandle.y - pTip.y) / Math.max(1, bladeLength)) * (6.5 * pTip.scale);
              const ny = ((pHandle.x - pTip.x) / Math.max(1, bladeLength)) * (6.5 * pTip.scale);

              // Bat shoulder is ~75% along handle path
              const pShoulder = {
                x: pTip.x + (pHandle.x - pTip.x) * 0.72,
                y: pTip.y + (pHandle.y - pTip.y) * 0.72,
              };

              return (
                <>
                  {/* Willow Blade Body */}
                  <polygon
                    points={`${pTip.x},${pTip.y} ${pShoulder.x + nx},${pShoulder.y + ny} ${pShoulder.x - nx},${pShoulder.y - ny}`}
                    fill="url(#stumpWillow)"
                    stroke="#78350f"
                    strokeWidth="0.8"
                  />

                  {/* Protective White Toe Cap at Bat Tip */}
                  <circle
                    cx={pTip.x}
                    cy={pTip.y}
                    r={3.2 * pTip.scale}
                    fill="#FFFFFF"
                    stroke="#334155"
                    strokeWidth="0.5"
                  />

                  {/* Cane Handle & Rubber Grip */}
                  <line
                    x1={pShoulder.x}
                    y1={pShoulder.y}
                    x2={pHandle.x}
                    y2={pHandle.y}
                    stroke="#0284C7"
                    strokeWidth={4.5 * pTip.scale}
                    strokeLinecap="round"
                  />

                  {/* Runner Glove at Handle End */}
                  <circle
                    cx={pHandle.x}
                    cy={pHandle.y}
                    r={5.5 * pTip.scale}
                    fill="#f8fafc"
                    stroke="#64748b"
                    strokeWidth="0.8"
                  />
                </>
              );
            })()}
          </g>

          {/* Striker Stumps Assembly in 3D (Left-side Foreground) */}
          <g>
            {/* Stump Base Shadow */}
            <ellipse
              cx={midStumpBase.x}
              cy={midStumpBase.y + 1}
              rx={22}
              ry={6}
              fill="rgba(0,0,0,0.6)"
            />

            {/* Socket Ground Base Plate */}
            <polygon
              points={`${offStumpBase.x - 14},${offStumpBase.y - 2} ${legStumpBase.x + 14},${legStumpBase.y - 2} ${legStumpBase.x + 18},${legStumpBase.y + 3} ${offStumpBase.x - 18},${offStumpBase.y + 3}`}
              fill="#1e293b"
            />

            {/* Off Stump */}
            <line
              x1={offStumpBase.x}
              y1={offStumpBase.y}
              x2={offStumpTop.x}
              y2={offStumpTop.y}
              stroke="#cbd5e1"
              strokeWidth={7 * offStumpBase.scale}
              strokeLinecap="round"
            />

            {/* Middle Stump */}
            <line
              x1={midStumpBase.x}
              y1={midStumpBase.y}
              x2={midStumpTop.x}
              y2={midStumpTop.y}
              stroke="#e2e8f0"
              strokeWidth={7.5 * midStumpBase.scale}
              strokeLinecap="round"
            />

            {/* Leg Stump */}
            <line
              x1={legStumpBase.x}
              y1={legStumpBase.y}
              x2={legStumpTop.x}
              y2={legStumpTop.y}
              stroke="#cbd5e1"
              strokeWidth={7 * legStumpBase.scale}
              strokeLinecap="round"
            />

            {/* Zing Bails with LED Glow & Separation */}
            <g
              transform={`translate(${bailCenter.x - midStumpTop.x}, ${bailCenter.y - midStumpTop.y}) rotate(${bailRotation} ${midStumpTop.x} ${midStumpTop.y})`}
            >
              {/* Wooden Bail Crossbar */}
              <line
                x1={offStumpTop.x - 5}
                y1={offStumpTop.y - 4}
                x2={legStumpTop.x + 5}
                y2={legStumpTop.y - 4}
                stroke={bailsDislodged ? "#EF4444" : "#F59E0B"}
                strokeWidth={5 * midStumpTop.scale}
                strokeLinecap="round"
              />

              {/* Zing Internal LED Core */}
              {bailsDislodged ? (
                <>
                  <circle
                    cx={midStumpTop.x}
                    cy={midStumpTop.y - 4}
                    r={6.5 * midStumpTop.scale}
                    fill="#EF4444"
                    opacity="0.85"
                  />
                  <circle
                    cx={midStumpTop.x}
                    cy={midStumpTop.y - 4}
                    r={3 * midStumpTop.scale}
                    fill="#FFFFFF"
                  />
                </>
              ) : (
                <circle
                  cx={midStumpTop.x}
                  cy={midStumpTop.y - 4}
                  r={2.5 * midStumpTop.scale}
                  fill="#FDE68A"
                  opacity="0.7"
                />
              )}
            </g>
          </g>
        </svg>

        {/* Real-time Camera Feed Overlay */}
        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5 font-mono">
          <div className="px-3 py-1.5 rounded-md text-[11px] font-bold border border-cyan-500/40 bg-cyan-950/80 text-cyan-200 backdrop-blur-md flex items-center gap-2 shadow-lg">
            <Video size={13} className="text-cyan-400" />
            <span>CAMERA: STRIKER STUMP GROUND CAM (CAM 10)</span>
          </div>
        </div>
      </div>

      {/* Neutral Diagnostics Footer */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">SENSOR FEED</div>
          <div className="text-[11px] font-black text-cyan-300">500 FPS HIGH-SPEED</div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">TIMECODE</div>
          <div className="text-[11px] font-black text-slate-200">
            00:01:{(currentTimeMs % 1000).toString().padStart(3, "0")}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">PERSPECTIVE</div>
          <div className="text-[11px] font-black text-amber-300">STUMP-LEVEL LOW ANGLE</div>
        </div>
      </div>
    </div>
  );
};
