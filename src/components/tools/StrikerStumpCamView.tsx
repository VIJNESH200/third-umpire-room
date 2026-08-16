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
export interface CAM10Projection {
  x: number;
  y: number;
  scale: number;
  depth: number;
  isBehindCamera: boolean;
  isValid: boolean;
}

export function getPointDepth(worldX: number, worldY: number, worldZ: number = 0): number {
  const camX = -1100;
  const camY = -1800;
  const camZ = 380;

  const fx = 0.797;
  const fy = 0.592;
  const fz = -0.115;

  const dx = worldX - camX;
  const dy = worldY - camY;
  const dz = worldZ - camZ;

  return dx * fx + dy * fy + dz * fz;
}

export function projectPitchToCAM10(
  worldX: number,
  worldY: number,
  worldZ: number = 0,
  nearPlane: number = 200
): CAM10Projection {
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

  const isBehindCamera = depth < nearPlane;
  // If behind near plane, clamp to safe near plane to prevent negative depth inversion
  const safeDepth = Math.max(nearPlane, depth);

  const focal = 380;
  const centerX = 235;
  const centerY = 160;

  const screenX = centerX + (u / safeDepth) * focal;
  const screenY = centerY - (v / safeDepth) * focal;
  const scale = focal / safeDepth;

  // Safe viewport bounds
  const isWithinBounds = screenX >= -300 && screenX <= 800 && screenY >= -300 && screenY <= 600;
  const isValid = !isBehindCamera && isWithinBounds;

  return { x: screenX, y: screenY, scale, depth, isBehindCamera, isValid };
}

/**
 * 3D Line Segment Clipper against the camera near-plane.
 * If one endpoint is behind the camera near plane, it is clipped along the 3D ray to depth = nearPlane.
 */
export function clipAndProjectSegment(
  p1: { x: number; y: number; z: number },
  p2: { x: number; y: number; z: number },
  nearPlane: number = 200
): {
  visible: boolean;
  p1: CAM10Projection;
  p2: CAM10Projection;
} {
  const d1 = getPointDepth(p1.x, p1.y, p1.z);
  const d2 = getPointDepth(p2.x, p2.y, p2.z);

  // If both behind near plane, completely invisible
  if (d1 < nearPlane && d2 < nearPlane) {
    return {
      visible: false,
      p1: projectPitchToCAM10(p1.x, p1.y, p1.z, nearPlane),
      p2: projectPitchToCAM10(p2.x, p2.y, p2.z, nearPlane),
    };
  }

  let clippedP1 = { ...p1 };
  let clippedP2 = { ...p2 };

  // If p1 is behind near plane, clip along segment to nearPlane
  if (d1 < nearPlane) {
    const t = (nearPlane - d1) / (d2 - d1);
    clippedP1 = {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
      z: p1.z + t * (p2.z - p1.z),
    };
  }

  // If p2 is behind near plane, clip along segment to nearPlane
  if (d2 < nearPlane) {
    const t = (nearPlane - d2) / (d1 - d2);
    clippedP2 = {
      x: p2.x + t * (p1.x - p2.x),
      y: p2.y + t * (p1.y - p2.y),
      z: p2.z + t * (p1.z - p2.z),
    };
  }

  const proj1 = projectPitchToCAM10(clippedP1.x, clippedP1.y, clippedP1.z, nearPlane);
  const proj2 = projectPitchToCAM10(clippedP2.x, clippedP2.y, clippedP2.z, nearPlane);

  return {
    visible: true,
    p1: proj1,
    p2: proj2,
  };
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

  // Project Bat Tip & Handle with 3D Near-Plane Frustum Clipping
  const batSegment = clipAndProjectSegment(
    {
      x: state.bat.tipWorldX,
      y: state.bat.tipWorldY,
      z: state.bat.tipWorldZ,
    },
    {
      x: state.bat.handleWorldX,
      y: state.bat.handleWorldY,
      z: state.bat.handleWorldZ,
    }
  );

  // Project Bat Shadow with 3D Near-Plane Frustum Clipping
  const shadowSegment = clipAndProjectSegment(
    {
      x: state.bat.tipWorldX,
      y: state.bat.tipWorldY,
      z: 0,
    },
    {
      x: state.bat.handleWorldX,
      y: state.bat.handleWorldY,
      z: 0,
    }
  );

  // Project Ball and Ball Shadow in 3D
  const ballProj = projectPitchToCAM10(
    state.ball.worldX,
    state.ball.worldY,
    state.ball.worldZ
  );
  const ballShadowProj = projectPitchToCAM10(
    state.ball.worldX,
    state.ball.worldY,
    0
  );

  // --- TWO INDIVIDUAL ZING BAILS WITH LOCAL BALLISTIC FLIGHT ---
  const bailsDislodged = state.stumps.bailsSeparating;
  const dtDislodgeMs = Math.max(0, currentTimeMs - state.timeline.bailsDislodgedMs);

  // Bail 1: Off-Middle Bail (spans -114mm to 0mm at resting height 716mm)
  let b1WorldX = 0;
  let b1WorldY = -57;
  let b1WorldZ = 716;
  let b1RotRad = 0;

  // Bail 2: Middle-Leg Bail (spans 0mm to +114mm at resting height 716mm)
  let b2WorldX = 0;
  let b2WorldY = 57;
  let b2WorldZ = 716;
  let b2RotRad = 0;

  if (bailsDislodged && dtDislodgeMs > 0) {
    // Flight duration ~340ms, then settles on turf
    const tFlight1 = Math.min(1, dtDislodgeMs / 320);
    const tFlight2 = Math.min(1, dtDislodgeMs / 360);

    // Bail 1 (Off-Side): pops up, drifts outward to off side, settles on turf near stumps
    const arcZ1 = Math.sin(tFlight1 * Math.PI) * 75 - tFlight1 * tFlight1 * 40;
    b1WorldX = -tFlight1 * 35; // slightly behind stumps in throw direction
    b1WorldY = -57 - tFlight1 * 105; // outward to off-side
    b1WorldZ = Math.max(12, 716 + arcZ1 - tFlight1 * 710); // lands on turf Z ≈ 12mm
    b1RotRad = tFlight1 * 1.35; // ~77 degrees tumble

    // Bail 2 (Leg-Side): pops up higher, drifts outward to leg side, settles on turf
    const arcZ2 = Math.sin(tFlight2 * Math.PI) * 90 - tFlight2 * tFlight2 * 50;
    b2WorldX = -tFlight2 * 45; // slightly behind stumps
    b2WorldY = 57 + tFlight2 * 120; // outward to leg-side
    b2WorldZ = Math.max(12, 716 + arcZ2 - tFlight2 * 710); // lands on turf Z ≈ 12mm
    b2RotRad = -tFlight2 * 1.55; // ~89 degrees tumble
  }

  // Compute 3D endpoints & clipping for Bail 1 (Off-Middle)
  const halfW = 52;
  const b1Segment = clipAndProjectSegment(
    {
      x: b1WorldX,
      y: b1WorldY - halfW * Math.cos(b1RotRad),
      z: b1WorldZ - halfW * Math.sin(b1RotRad),
    },
    {
      x: b1WorldX,
      y: b1WorldY + halfW * Math.cos(b1RotRad),
      z: b1WorldZ + halfW * Math.sin(b1RotRad),
    }
  );
  const b1Center = projectPitchToCAM10(b1WorldX, b1WorldY, b1WorldZ);

  // Compute 3D endpoints & clipping for Bail 2 (Middle-Leg)
  const b2Segment = clipAndProjectSegment(
    {
      x: b2WorldX,
      y: b2WorldY - halfW * Math.cos(b2RotRad),
      z: b2WorldZ - halfW * Math.sin(b2RotRad),
    },
    {
      x: b2WorldX,
      y: b2WorldY + halfW * Math.cos(b2RotRad),
      z: b2WorldZ + halfW * Math.sin(b2RotRad),
    }
  );
  const b2Center = projectPitchToCAM10(b2WorldX, b2WorldY, b2WorldZ);

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

          {/* Dynamic Ground Shadow of Bat on Turf (Z = 0) with Frustum Protection */}
          {shadowSegment.visible && (
            <line
              x1={shadowSegment.p1.x}
              y1={shadowSegment.p1.y}
              x2={shadowSegment.p2.x}
              y2={shadowSegment.p2.y}
              stroke="#000000"
              strokeWidth={10 * shadowSegment.p1.scale}
              strokeLinecap="round"
              opacity={isAirborne ? 0.20 : 0.60}
            />
          )}

          {/* Cricket Bat Blade & Handle projected in 3D Space with Frustum Protection */}
          {batSegment.visible && (
            <g>
              {(() => {
                const pTip = batSegment.p1;
                const pHandle = batSegment.p2;
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
          )}

          {/* Incoming Ball & Ball Shadow in 3D */}
          {ballShadowProj.isValid && (
            <ellipse
              cx={ballShadowProj.x}
              cy={ballShadowProj.y}
              rx={6 * ballShadowProj.scale}
              ry={2.5 * ballShadowProj.scale}
              fill="rgba(0,0,0,0.5)"
            />
          )}
          {ballProj.isValid && (
            <g>
              {/* Ball Core */}
              <circle
                cx={ballProj.x}
                cy={ballProj.y}
                r={6.5 * ballProj.scale}
                fill="#DC2626"
                stroke="#991B1B"
                strokeWidth="0.8"
              />
              {/* Ball Specular Highlight */}
              <circle
                cx={ballProj.x - 2 * ballProj.scale}
                cy={ballProj.y - 2 * ballProj.scale}
                r={2 * ballProj.scale}
                fill="#FFFFFF"
                opacity={0.6}
              />
              {/* Ball Seam Line */}
              <line
                x1={ballProj.x - 5 * ballProj.scale}
                y1={ballProj.y + 1 * ballProj.scale}
                x2={ballProj.x + 5 * ballProj.scale}
                y2={ballProj.y - 1 * ballProj.scale}
                stroke="#FFFFFF"
                strokeWidth="0.8"
                strokeDasharray="1.5 1"
                opacity={0.7}
              />
            </g>
          )}

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
            {offStumpBase.isValid && offStumpTop.isValid && (
              <line
                x1={offStumpBase.x}
                y1={offStumpBase.y}
                x2={offStumpTop.x}
                y2={offStumpTop.y}
                stroke="#cbd5e1"
                strokeWidth={7 * offStumpBase.scale}
                strokeLinecap="round"
              />
            )}

            {/* Middle Stump */}
            {midStumpBase.isValid && midStumpTop.isValid && (
              <line
                x1={midStumpBase.x}
                y1={midStumpBase.y}
                x2={midStumpTop.x}
                y2={midStumpTop.y}
                stroke="#e2e8f0"
                strokeWidth={7.5 * midStumpBase.scale}
                strokeLinecap="round"
              />
            )}

            {/* Leg Stump */}
            {legStumpBase.isValid && legStumpTop.isValid && (
              <line
                x1={legStumpBase.x}
                y1={legStumpBase.y}
                x2={legStumpTop.x}
                y2={legStumpTop.y}
                stroke="#cbd5e1"
                strokeWidth={7 * legStumpBase.scale}
                strokeLinecap="round"
              />
            )}

            {/* Bail 1 (Off-Middle Bail) with Zing LED & Separation */}
            {b1Segment.visible && (
              <g>
                <line
                  x1={b1Segment.p1.x}
                  y1={b1Segment.p1.y}
                  x2={b1Segment.p2.x}
                  y2={b1Segment.p2.y}
                  stroke={bailsDislodged ? "#EF4444" : "#F59E0B"}
                  strokeWidth={4.5 * b1Center.scale}
                  strokeLinecap="round"
                />
                {b1Center.isValid && (
                  bailsDislodged ? (
                    <>
                      <circle
                        cx={b1Center.x}
                        cy={b1Center.y}
                        r={5.5 * b1Center.scale}
                        fill="#EF4444"
                        opacity={0.85}
                      />
                      <circle
                        cx={b1Center.x}
                        cy={b1Center.y}
                        r={2.5 * b1Center.scale}
                        fill="#FFFFFF"
                      />
                    </>
                  ) : (
                    <circle
                      cx={b1Center.x}
                      cy={b1Center.y}
                      r={2.0 * b1Center.scale}
                      fill="#FDE68A"
                      opacity={0.7}
                    />
                  )
                )}
              </g>
            )}

            {/* Bail 2 (Middle-Leg Bail) with Zing LED & Separation */}
            {b2Segment.visible && (
              <g>
                <line
                  x1={b2Segment.p1.x}
                  y1={b2Segment.p1.y}
                  x2={b2Segment.p2.x}
                  y2={b2Segment.p2.y}
                  stroke={bailsDislodged ? "#EF4444" : "#F59E0B"}
                  strokeWidth={4.5 * b2Center.scale}
                  strokeLinecap="round"
                />
                {b2Center.isValid && (
                  bailsDislodged ? (
                    <>
                      <circle
                        cx={b2Center.x}
                        cy={b2Center.y}
                        r={5.5 * b2Center.scale}
                        fill="#EF4444"
                        opacity={0.85}
                      />
                      <circle
                        cx={b2Center.x}
                        cy={b2Center.y}
                        r={2.5 * b2Center.scale}
                        fill="#FFFFFF"
                      />
                    </>
                  ) : (
                    <circle
                      cx={b2Center.x}
                      cy={b2Center.y}
                      r={2.0 * b2Center.scale}
                      fill="#FDE68A"
                      opacity={0.7}
                    />
                  )
                )}
              </g>
            )}
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
