/**
 * boundaryPhysics.ts
 * Canonical Boundary Event Physics Engine & Unified Timeline State Model.
 *
 * Provides a single deterministic physical replay state for any Boundary scenario
 * across all camera views:
 * - CAM 04: Phase 1 Broadcast Tracking Camera (elevated outfield view)
 * - CAM 05: Phase 2 Macro Cushion Zoom (telephoto contact quadrant)
 * - CAM 09: Phase 2 Wide Boundary Relay Cam (45-degree elevated spatial continuity)
 *
 * Implements MCC Law 19 (Boundary) and Law 33 (Caught):
 * - Checks whether ball contact coincides with grounded contact on or beyond the boundary.
 * - Models clean airborne release prior to boundary contact.
 * - Handles relay reception where second fielder is grounded inside the rope.
 */

import type { BoundaryData, BoundaryArchetype } from "../types/scenario";
import {
  lerp,
  clamp,
  easeInQuad,
  easeInOutQuad,
  easeOutCubic,
  smoothstep,
  FielderKinematics,
  solveBoundaryFielderKinematics,
} from "../components/instinct/actorRigs";

// ================================================================
// 1. TIMELINE ANCHORS & ARCHETYPES (R1)
// ================================================================

export interface BoundaryEventTimeline {
  deliveryTimeMs: number;       // e.g. 800ms (shot lofted by batter towards deep boundary)
  ballApexMs: number;           // e.g. 1050ms (peak of lofted ball flight in outfield)
  firstBallContactMs: number;   // e.g. 1260ms - 1320ms (fielder first touches / gathers ball)
  catchControlMs: number;       // e.g. 1300ms - 1360ms (moment of firm catch control)
  boundaryContactMs: number;    // e.g. 1400ms (moment fielder reaches boundary rope / cushion plane)
  boundaryReleaseMs: number;    // e.g. 1340ms (clean aerial release) or 1480ms (late release)
  finalGroundContactMs: number; // e.g. 1550ms (fielder slides to a stop or lands)
  catchCompletionMs: number;    // e.g. 1750ms (partner gathers or catch completed)
  postIncidentMs: number;       // 2200ms (end of review sequence)
}

export type BoundaryReplayPhase =
  | "PURSUIT"
  | "INTERCEPTION"
  | "CATCH_CONTROL"
  | "ROPE_TRANSIT"
  | "RELAY_AIRBORNE"
  | "COMPLETION";

// ================================================================
// 2. PHYSICAL STATE INTERFACES
// ================================================================

/**
 * 3D coordinate system:
 * X (meters): along chase axis towards boundary.
 *   X < 0: inside field of play (infield/outfield).
 *   X = 0: front edge of the boundary foam cushion / inner edge of rope.
 *   X > 0: on or beyond the boundary line.
 * Y (meters): lateral position along the boundary rope arc (0 = central line of action).
 * Z (meters): vertical altitude above turf (0 = ground level).
 */
export interface BoundaryBallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radiusM: number;
  isControlled: boolean;
  isInFlight: boolean;
  isRelayed: boolean;
  carrier: "PRIMARY" | "PARTNER" | "NONE";
}

export interface BoundaryFielderState {
  x: number;
  y: number;
  z: number;
  isAirborne: boolean;
  isGrounded: boolean;
  isSliding: boolean;
  isTouchingCushion: boolean;
  cushionClearanceMm: number; // Signed: > 0 = contact/compression, < 0 = daylight gap
  bootPoint: { x: number; y: number; z: number };
  handsPoint: { x: number; y: number; z: number };
  torsoAngleRad: number;
  kinematics: FielderKinematics;
}

export interface BoundaryPartnerState {
  x: number;
  y: number;
  z: number;
  isGrounded: boolean;
  hasCaughtBall: boolean;
  handsPoint: { x: number; y: number; z: number };
}

export interface BoundaryCushionState {
  frontEdgeX: number; // 0.0m
  widthM: number;     // 0.25m (250mm wide foam wedge)
  heightM: number;    // 0.20m (200mm high)
  compressionMm: number;
  isContacted: boolean;
}

export interface MCCComplianceResult {
  isBoundary: boolean;
  isFairCatch: boolean;
  ballHeldAtBoundaryContact: boolean;
  cleanAirborneRelease: boolean;
  partnerGroundedInsideBoundary: boolean;
  ruleCitation: string;
  verdictExplanation: string;
}

export interface BoundaryReplayState {
  currentTimeMs: number;
  timeline: BoundaryEventTimeline;
  archetype: BoundaryArchetype;
  phase: BoundaryReplayPhase;
  isBoundary: boolean;
  marginMm: number;
  ball: BoundaryBallState;
  primaryFielder: BoundaryFielderState;
  partnerFielder?: BoundaryPartnerState;
  cushion: BoundaryCushionState;
  mccCompliance: MCCComplianceResult;
}

// ================================================================
// 3. CANONICAL TIMELINE DERIVATION
// ================================================================

export function resolveBoundaryArchetype(data: BoundaryData): BoundaryArchetype {
  if (data.archetype) return data.archetype;
  if (data.catchOrSave === "RELAY_CATCH") return "AIRBORNE_RELAY";
  if (data.catchOrSave === "OVER_THE_ROPE") return "RUNNING_ROPE_CATCH";
  return "SLIDING_CATCH";
}

export function getBoundaryEventTimeline(data: BoundaryData): BoundaryEventTimeline {
  const deliveryTimeMs = data.deliveryTimeMs ?? 800;
  const boundaryContactMs = data.boundaryContactMs ?? data.ropeContactFrameMs ?? 1400;
  const archetype = resolveBoundaryArchetype(data);

  let firstBallContactMs = data.firstBallContactMs;
  let catchControlMs = data.catchControlMs;
  let boundaryReleaseMs = data.boundaryReleaseMs ?? data.releaseFrameMs;
  let finalGroundContactMs = data.finalGroundContactMs ?? 1550;
  let catchCompletionMs = data.catchCompletionMs;

  if (archetype === "AIRBORNE_RELAY") {
    firstBallContactMs = firstBallContactMs ?? 1260;
    catchControlMs = catchControlMs ?? 1300;
    // For airborne relay: if clean catch, must release before rope contact (1400ms)
    // If boundary, release occurs after rope contact or ball is held
    if (boundaryReleaseMs === undefined) {
      boundaryReleaseMs = data.isBoundary ? boundaryContactMs + 60 : boundaryContactMs - 60;
    }
    catchCompletionMs = catchCompletionMs ?? 1750;
  } else if (archetype === "RUNNING_ROPE_CATCH") {
    firstBallContactMs = firstBallContactMs ?? 1310;
    catchControlMs = catchControlMs ?? 1350;
    boundaryReleaseMs = boundaryReleaseMs ?? (data.isBoundary ? boundaryContactMs + 100 : boundaryContactMs - 80);
    catchCompletionMs = catchCompletionMs ?? 1600;
  } else {
    // SLIDING_CATCH
    firstBallContactMs = firstBallContactMs ?? 1280;
    catchControlMs = catchControlMs ?? 1330;
    boundaryReleaseMs = boundaryReleaseMs ?? (data.isBoundary ? boundaryContactMs + 80 : boundaryContactMs - 80);
    catchCompletionMs = catchCompletionMs ?? 1550;
  }

  return {
    deliveryTimeMs,
    ballApexMs: 1040,
    firstBallContactMs,
    catchControlMs,
    boundaryContactMs,
    boundaryReleaseMs,
    finalGroundContactMs,
    catchCompletionMs,
    postIncidentMs: 2200,
  };
}

// ================================================================
// 4. MCC LAW 19 & 33 COMPLIANCE EVALUATOR (R2)
// ================================================================

/**
 * Evaluates cricket boundary rules per MCC Laws 19 (Boundary) and 33 (Caught):
 * - Law 19.4 / 19.5: Boundary is scored if a fielder in contact with the ball touches the boundary
 *   or any object grounded beyond the boundary.
 * - Law 33.2 / 19.5.2: A catch is fair if the fielder's first contact with the ball was made while
 *   grounded inside the boundary, and subsequent airborne contacts are preceded by clean release
 *   before touching the boundary, and final grounding occurs inside the boundary.
 */
export function evaluateMCCLawCompliance(
  data: BoundaryData,
  timeline: BoundaryEventTimeline
): MCCComplianceResult {
  const isBoundary = data.isBoundary;
  const archetype = resolveBoundaryArchetype(data);
  const marginMm = data.marginMm;

  const cleanAirborneRelease =
    archetype === "AIRBORNE_RELAY"
      ? timeline.boundaryReleaseMs < timeline.boundaryContactMs
      : !isBoundary;

  const ballHeldAtBoundaryContact = !cleanAirborneRelease || isBoundary;
  const partnerGroundedInsideBoundary = archetype === "AIRBORNE_RELAY";
  const isFairCatch = !isBoundary;

  let ruleCitation = isBoundary
    ? "Law 19.4 / 19.5 - Boundary Cushion Contact"
    : "Law 33.2 / 19.5 - Clean Catch Inside Boundary";

  let verdictExplanation = "";
  if (isBoundary) {
    if (archetype === "AIRBORNE_RELAY") {
      verdictExplanation = `Replay confirms the fielder had not cleanly released the ball prior to touching the boundary cushion/ground beyond the boundary (${marginMm}mm contact). Boundary awarded. NOT OUT.`;
    } else {
      verdictExplanation = `Replay confirms the fielder's boot was in contact with the boundary cushion while simultaneously holding the ball (${marginMm}mm contact). Boundary awarded. NOT OUT.`;
    }
  } else {
    if (archetype === "AIRBORNE_RELAY") {
      verdictExplanation = `Clean relay catch verified. Fielder released the ball cleanly prior to crossing the boundary cushion, and the relay partner was grounded inside the boundary. OUT.`;
    } else {
      verdictExplanation = `Clean catch verified. Visible daylight between the fielder and boundary cushion throughout the slide (${Math.abs(marginMm)}mm clearance). OUT.`;
    }
  }

  return {
    isBoundary,
    isFairCatch,
    ballHeldAtBoundaryContact,
    cleanAirborneRelease,
    partnerGroundedInsideBoundary,
    ruleCitation,
    verdictExplanation,
  };
}

// ================================================================
// 5. CANONICAL PHYSICAL REPLAY STATE SOLVER (R1, R3, R4, R5)
// ================================================================

export function solveBoundaryReplayState(
  data: BoundaryData,
  currentTimeMs: number
): BoundaryReplayState {
  const timeline = getBoundaryEventTimeline(data);
  const archetype = resolveBoundaryArchetype(data);
  const isBoundary = data.isBoundary;
  const marginMm = data.marginMm;
  const clampedTime = clamp(currentTimeMs, timeline.deliveryTimeMs, timeline.postIncidentMs);

  // Phase determination
  let phase: BoundaryReplayPhase = "PURSUIT";
  if (clampedTime < timeline.firstBallContactMs) {
    phase = "PURSUIT";
  } else if (clampedTime < timeline.catchControlMs) {
    phase = "INTERCEPTION";
  } else if (clampedTime < timeline.boundaryContactMs) {
    phase = "CATCH_CONTROL";
  } else if (clampedTime < timeline.finalGroundContactMs) {
    phase = archetype === "AIRBORNE_RELAY" ? "RELAY_AIRBORNE" : "ROPE_TRANSIT";
  } else {
    phase = "COMPLETION";
  }

  // -------------------------------------------------------------
  // Fielder World Position & Kinematics
  // -------------------------------------------------------------
  // Boundary cushion front edge is at X = 0.0m.
  // Closest approach to cushion happens around boundaryContactMs (1400ms).
  // marginMm > 0: boot penetrates cushion by marginMm (e.g. +24mm = +0.024m).
  // marginMm < 0: boot stops short of cushion by |marginMm| (e.g. -35mm = -0.035m daylight).
  const maxApproachX = marginMm / 1000;

  let fielderX = -4.5;
  let fielderY = 0.0;
  let fielderZ = 0.0;
  let isAirborne = false;
  let isGrounded = true;
  let isSliding = false;
  let torsoAngleRad = 0.25;

  // Pose-specific forward-foot offsets from pelvis/root to lead boot:
  // Sliding: lead foot extends ~0.45m forward towards cushion
  // Running/sprint: lead foot reaches ~0.20m forward
  const slideLeadBootOffset = 0.45;
  const runLeadBootOffset = 0.20;

  if (archetype === "AIRBORNE_RELAY") {
    // Pursuit -> Jump Launch -> Aerial Flight -> Land over rope
    const jumpLaunchMs = timeline.firstBallContactMs - 120; // ~1140ms
    const landMs = timeline.boundaryContactMs + 60; // ~1460ms

    if (clampedTime < jumpLaunchMs) {
      const t = (clampedTime - timeline.deliveryTimeMs) / (jumpLaunchMs - timeline.deliveryTimeMs);
      fielderX = lerp(-6.0, -1.8, easeInQuad(t));
      fielderZ = 0.0;
      isAirborne = false;
      isGrounded = true;
      torsoAngleRad = 0.35;
    } else if (clampedTime < landMs) {
      const t = (clampedTime - jumpLaunchMs) / (landMs - jumpLaunchMs);
      fielderX = lerp(-1.8, (maxApproachX - runLeadBootOffset) + 0.35, easeOutCubic(t));
      // Parabolic jump arc: peak height ~ 0.75m
      fielderZ = 0.75 * Math.sin(t * Math.PI);
      isAirborne = fielderZ > 0.05;
      isGrounded = !isAirborne;
      torsoAngleRad = lerp(0.35, -0.2, t);
    } else {
      const t = (clampedTime - landMs) / (timeline.postIncidentMs - landMs);
      fielderX = (maxApproachX - runLeadBootOffset) + 0.35 + t * 0.15;
      fielderZ = 0.0;
      isAirborne = false;
      isGrounded = true;
      torsoAngleRad = -0.1;
    }
  } else if (archetype === "RUNNING_ROPE_CATCH") {
    // Fast sprint along rope -> gather -> foot plant check
    const targetPelvisX = maxApproachX - runLeadBootOffset;
    if (clampedTime < timeline.boundaryContactMs) {
      const t = (clampedTime - timeline.deliveryTimeMs) / (timeline.boundaryContactMs - timeline.deliveryTimeMs);
      fielderX = lerp(-5.0, targetPelvisX, easeOutCubic(t));
      fielderZ = 0.0;
      torsoAngleRad = lerp(0.4, 0.15, t);
    } else {
      const t = (clampedTime - timeline.boundaryContactMs) / (timeline.postIncidentMs - timeline.boundaryContactMs);
      // If boundary, momentum penetrates into cushion; if clean catch, fielder maintains footing inside boundary
      const postDrift = isBoundary ? 0.08 * easeOutCubic(t) : 0.0;
      fielderX = targetPelvisX + postDrift;
      fielderZ = 0.0;
      torsoAngleRad = 0.1;
    }
  } else {
    // SLIDING_CATCH
    // Sprint pursuit (800-1180ms) -> drop into slide (1180-1400ms) -> halt/momentum (1400-2200ms)
    const targetPelvisX = maxApproachX - slideLeadBootOffset;
    const slideStartMs = 1180;
    if (clampedTime < slideStartMs) {
      const t = (clampedTime - timeline.deliveryTimeMs) / (slideStartMs - timeline.deliveryTimeMs);
      fielderX = lerp(-5.5, -2.2, easeInQuad(t));
      fielderZ = 0.0;
      isSliding = false;
      torsoAngleRad = 0.32;
    } else if (clampedTime < timeline.boundaryContactMs) {
      const t = (clampedTime - slideStartMs) / (timeline.boundaryContactMs - slideStartMs);
      fielderX = lerp(-2.2, targetPelvisX, easeOutCubic(t));
      fielderZ = 0.0;
      isSliding = true;
      torsoAngleRad = lerp(0.32, Math.PI * 0.40, t);
    } else {
      const t = (clampedTime - timeline.boundaryContactMs) / (timeline.postIncidentMs - timeline.boundaryContactMs);
      // If boundary, slips into cushion; if clean catch, halts firmly at closest approach short of cushion
      const haltDrift = isBoundary ? 0.08 * easeOutCubic(t) : 0.0;
      fielderX = targetPelvisX + haltDrift;
      fielderZ = 0.0;
      isSliding = true;
      torsoAngleRad = Math.PI * 0.40;
    }
  }

  // Calculate boot and hand points relative to world origin
  // In our coordinate space: boot extends forward towards cushion in slide/running
  const bootX = fielderX + (isSliding ? slideLeadBootOffset : runLeadBootOffset);
  const bootY = fielderY;
  const bootZ = fielderZ;

  // Hands point relative to world origin:
  // Derived from the pose and lead-boot anchor so that the physical ball coordinates
  // and the rendered athletic rig hands strictly agree in screen space across all archetypes.
  let handsX = bootX + 0.028;
  let handsZ = bootZ + 0.64;

  if (isSliding) {
    handsX = bootX + 0.005;
    handsZ = bootZ + 0.42;
  } else if (isAirborne) {
    handsX = bootX + 0.028;
    handsZ = bootZ + 0.85;
  }
  const handsY = fielderY;

  // Clearance to cushion front edge (X = 0) in mm
  // bootX >= 0: contact/penetration into cushion
  // bootX < 0: daylight gap between boot and cushion
  const cushionClearanceMm = bootX * 1000;
  const isTouchingCushion = clampedTime >= timeline.boundaryContactMs && isBoundary && bootX >= -0.002;

  const cushionCompressionMm = isTouchingCushion
    ? clamp(Math.max(marginMm, (bootX) * 1000), 2, 45)
    : 0;

  // -------------------------------------------------------------
  // Ball 3D Trajectory (R4)
  // -------------------------------------------------------------
  let ballX = -18.0;
  let ballY = 0.0;
  let ballZ = 0.5;
  let ballVx = 0.0;
  let ballVy = 0.0;
  let ballVz = 0.0;
  let isControlled = false;
  let isInFlight = true;
  let isRelayed = false;
  let carrier: "PRIMARY" | "PARTNER" | "NONE" = "NONE";

  const partnerHandsX = -3.2;
  const partnerHandsY = 0.0;
  const partnerHandsZ = 1.15;

  if (clampedTime < timeline.firstBallContactMs) {
    // 1. Outfield Parabolic Flight from Batter to Intercept Hand Point
    const t = (clampedTime - timeline.deliveryTimeMs) / (timeline.firstBallContactMs - timeline.deliveryTimeMs);
    const interceptHandsX = handsX;
    const interceptHandsZ = handsZ;

    ballX = lerp(-18.0, interceptHandsX, easeOutCubic(t));
    ballY = lerp(0.4, handsY, t);

    // Parabolic arc: launches from bat (Z ~ 1.5m), reaches apex Z ~ 6.5m at t ~ 0.55, lands in hands
    const arcT = clamp(t, 0, 1);
    const apexHeight = 6.2;
    ballZ = lerp(1.5, interceptHandsZ, arcT) + apexHeight * Math.sin(arcT * Math.PI);

    ballVx = (interceptHandsX - (-18.0)) / ((timeline.firstBallContactMs - timeline.deliveryTimeMs) / 1000);
    ballVz = -3.5;
    isControlled = false;
    isInFlight = true;
    carrier = "NONE";
  } else if (clampedTime < timeline.boundaryReleaseMs) {
    // 2. Ball firmly controlled in primary fielder's hands
    ballX = handsX;
    ballY = handsY;
    ballZ = handsZ;
    ballVx = 0.0;
    ballVy = 0.0;
    ballVz = 0.0;
    isControlled = true;
    isInFlight = false;
    carrier = "PRIMARY";
  } else {
    // 3. Post-release: either held (if no release needed) or lobbed/relayed into field of play
    if (archetype === "AIRBORNE_RELAY") {
      isRelayed = true;
      if (clampedTime < timeline.catchCompletionMs) {
        // High parabolic toss arcing backwards into field of play towards partner
        const t = (clampedTime - timeline.boundaryReleaseMs) / (timeline.catchCompletionMs - timeline.boundaryReleaseMs);
        const releaseX = handsX;
        const releaseZ = handsZ;

        ballX = lerp(releaseX, partnerHandsX, easeOutCubic(t));
        ballY = lerp(handsY, partnerHandsY, t);
        // Parabolic toss arc: rises 1.6m above release, then falls to partner's hands
        ballZ = lerp(releaseZ, partnerHandsZ, t) + 1.6 * Math.sin(t * Math.PI);
        isControlled = false;
        isInFlight = true;
        carrier = "NONE";
      } else {
        // Caught securely by relay partner
        ballX = partnerHandsX;
        ballY = partnerHandsY;
        ballZ = partnerHandsZ;
        isControlled = true;
        isInFlight = false;
        carrier = "PARTNER";
      }
    } else {
      // Caught and retained in primary fielder's hands
      ballX = handsX;
      ballY = handsY;
      ballZ = handsZ;
      isControlled = true;
      isInFlight = false;
      carrier = "PRIMARY";
    }
  }

  // -------------------------------------------------------------
  // Primary Fielder Kinematics Compatibility Structure
  // -------------------------------------------------------------
  const slideProgress = isSliding
    ? clamp((clampedTime - 1180) / (timeline.boundaryContactMs - 1180), 0, 1)
    : 0.0;

  // Normalized progress 0 to 1 across full incident clip
  const fullProgress = clamp((clampedTime - timeline.deliveryTimeMs) / (timeline.postIncidentMs - timeline.deliveryTimeMs), 0, 1);
  const legacyK = solveBoundaryFielderKinematics(fullProgress, isBoundary, 300).fielderK;

  const primaryFielder: BoundaryFielderState = {
    x: fielderX,
    y: fielderY,
    z: fielderZ,
    isAirborne,
    isGrounded,
    isSliding,
    isTouchingCushion,
    cushionClearanceMm,
    bootPoint: { x: bootX, y: bootY, z: bootZ },
    handsPoint: { x: handsX, y: handsY, z: handsZ },
    torsoAngleRad,
    kinematics: {
      ...legacyK,
      torsoAngleRad,
      isSliding,
      slideProgress,
    },
  };

  const partnerFielder: BoundaryPartnerState | undefined =
    archetype === "AIRBORNE_RELAY"
      ? {
          x: -3.5,
          y: 0.0,
          z: 0.0,
          isGrounded: true,
          hasCaughtBall: clampedTime >= timeline.catchCompletionMs,
          handsPoint: { x: partnerHandsX, y: partnerHandsY, z: partnerHandsZ },
        }
      : undefined;

  const cushion: BoundaryCushionState = {
    frontEdgeX: 0.0,
    widthM: 0.25,
    heightM: 0.20,
    compressionMm: cushionCompressionMm,
    isContacted: isTouchingCushion,
  };

  const mccCompliance = evaluateMCCLawCompliance(data, timeline);

  return {
    currentTimeMs: clampedTime,
    timeline,
    archetype,
    phase,
    isBoundary,
    marginMm,
    ball: {
      x: ballX,
      y: ballY,
      z: ballZ,
      vx: ballVx,
      vy: ballVy,
      vz: ballVz,
      radiusM: 0.036, // 72mm cricket ball diameter
      isControlled,
      isInFlight,
      isRelayed,
      carrier,
    },
    primaryFielder,
    partnerFielder,
    cushion,
    mccCompliance,
  };
}

// ================================================================
// 6. PROJECTION HELPERS FOR BROADCAST CAMERAS
// ================================================================

/**
 * CAM 05 Macro Cushion Zoom projection:
 * Maps physical contact quadrant coordinates (meters relative to cushion front edge)
 * to 500x280 SVG/Canvas viewport space.
 * Cushion front edge is positioned at X = 250, ground line at Y = 180.
 * Zero jitter across rock-and-roll stepping (±5 frames).
 */
export function projectMacroBoundaryCoords(
  worldX: number,
  worldZ: number,
  viewWidth: number = 500,
  viewHeight: number = 280
): { screenX: number; screenY: number } {
  // Cushion front edge (worldX = 0) is at screenX = 250
  // Scale factor: 1 meter = 400 pixels along boundary axis in macro view (1mm = 0.4px)
  const pxPerMeterX = 400;
  // Calibrated vertical projection (75 px/m) to ensure ball and hands remain comfortably visible
  // during peak interception window without clipping at top of viewport
  const pxPerMeterZ = 75;
  const groundY = viewHeight * 0.72; // ~201.6px

  const screenX = 250 + worldX * pxPerMeterX;
  const screenY = groundY - worldZ * pxPerMeterZ;

  return { screenX, screenY };
}

/**
 * CAM 09 Wide Relay Cam projection:
 * Maps physical 3D coordinates (meters) to 45-degree elevated boundary perspective.
 * Viewport: 500x320.
 * Boundary rope runs vertically/curved at X = 350.
 */
export function projectWideRelayCoords(
  worldX: number,
  worldY: number,
  worldZ: number,
  viewWidth: number = 500,
  viewHeight: number = 320
): { screenX: number; screenY: number; radiusPx: number } {
  // Cushion front edge (worldX = 0) maps to screenX = 350
  // Field of play extends left (worldX < 0 -> screenX < 350)
  const pxPerMeterX = 40;
  const pxPerMeterY = 15;
  const pxPerMeterZ = 35;

  const originX = 350;
  const originY = 200;

  const screenX = originX + worldX * pxPerMeterX;
  const screenY = originY + worldY * pxPerMeterY - worldZ * pxPerMeterZ;
  const radiusPx = clamp(5 + (worldZ * 1.5), 4, 8);

  return { screenX, screenY, radiusPx };
}
