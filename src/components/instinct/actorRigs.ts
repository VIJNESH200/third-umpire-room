/**
 * actorRigs.ts
 * Procedural 2D Cricket Actor Rig & Continuous Kinematics Animation System.
 * Provides continuous smooth articulation, weight, momentum, and follow-through
 * for Batter, Bowler, Wicketkeeper, Stumps, and Cricket Ball in Phase 1 broadcast replays.
 */

export interface ActorTransform {
  x: number;
  y: number;
  scale?: number;
  rotationDeg?: number;
  facing?: "LEFT" | "RIGHT";
  opacity?: number;
}

// Math & Easing Helpers
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInQuad(t: number): number {
  return t * t;
}

export function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

// ================================================================
// KINEMATIC DATA STRUCTURES
// ================================================================
export interface BatterKinematics {
  torsoAngleRad: number;
  headX: number;
  headY: number;
  headTiltRad: number;
  frontLegX: number;
  frontLegY: number;
  backLegX: number;
  backLegY: number;
  batPivotX: number;
  batPivotY: number;
  batRotRad: number;
  padRecoilX: number;
  padRecoilY: number;
}

export interface BowlerKinematics {
  torsoAngleRad: number;
  torsoY: number;
  headTiltRad: number;
  bowlingArmAngleRad: number;
  nonBowlingArmAngleRad: number;
  frontLegX: number;
  frontLegY: number;
  backLegX: number;
  backLegY: number;
  appealElevation: number; // 0.0 (bowling) to 1.0 (appealing)
}

export interface KeeperKinematics {
  crouchElevation: number; // 0.0 (deep crouch) to 1.0 (full standing appeal)
  torsoAngleRad: number;
  headTiltRad: number;
  gloveX: number;
  gloveY: number;
  isGlovesOpen: boolean;
}

// ================================================================
// CONTINUOUS KINEMATIC SOLVERS
// ================================================================

/**
 * Solves continuous batter kinematics across the 2.8s replay loop for LBW.
 * Neutral -> Trigger stride -> Forward defence / leave -> Pad impact recoil -> Hold.
 */
export function solveLBWBatterKinematics(
  p: number,
  isNoShot: boolean,
  _shotType: string,
  batPadSeparationMm: number = 60
): BatterKinematics {
  let stride = 0.0;
  let impactRecoil = 0.0;

  if (p < 0.20) {
    // 0% - 20%: Neutral stance with subtle breathing weight shift
    stride = 0.0;
  } else if (p >= 0.20 && p < 0.50) {
    // 20% - 50%: Smooth trigger movement & forward stride
    const t = (p - 0.20) / 0.30;
    stride = easeInOutQuad(t);
  } else {
    // 50% - 100%: Stride held firmly
    stride = 1.0;
  }

  // Pad Impact recoil at p = 0.70
  if (p >= 0.70 && p < 0.85) {
    const t = (p - 0.70) / 0.15;
    impactRecoil = Math.sin(t * Math.PI) * 2.5; // Absorbs momentum and settles
  }

  const torsoAngleRad = lerp(-0.04, isNoShot ? -0.15 : 0.12, stride);
  const headX = lerp(-2, isNoShot ? -6 : 4, stride);
  const headY = lerp(-54, isNoShot ? -56 : -50, stride);
  const headTiltRad = lerp(0.0, isNoShot ? -0.1 : 0.15, stride);

  const frontLegX = lerp(4, isNoShot ? 2 : 14, stride) - impactRecoil * 0.5;
  const frontLegY = lerp(-28, -28, stride);
  const backLegX = lerp(-10, isNoShot ? -8 : -12, stride);
  const backLegY = lerp(-28, -28, stride);

  let targetBatPivotX = 8;
  let targetBatPivotY = -30;
  let targetBatRot = 0.16;

  if (isNoShot) {
    targetBatPivotX = -14;
    targetBatPivotY = -44;
    targetBatRot = -0.65; // High shoulder leave
  } else {
    // Forward defensive with bat positioned close to pad
    const batOffset = batPadSeparationMm < 25 ? -2 : -10;
    targetBatPivotX = frontLegX + batOffset;
  }

  const batPivotX = lerp(-6, targetBatPivotX, stride);
  const batPivotY = lerp(-34, targetBatPivotY, stride);
  const batRotRad = lerp(0.08, targetBatRot, stride);

  return {
    torsoAngleRad,
    headX,
    headY,
    headTiltRad,
    frontLegX,
    frontLegY,
    backLegX,
    backLegY,
    batPivotX,
    batPivotY,
    batRotRad,
    padRecoilX: -impactRecoil,
    padRecoilY: 0,
  };
}

/**
 * Solves continuous bowler kinematics across the 2.8s replay loop for LBW.
 * Run-up -> Delivery stride & 360° arm windmill -> Follow-through -> Smooth appeal.
 */
export function solveLBWBowlerKinematics(p: number): BowlerKinematics {
  let torsoAngleRad = 0.08;
  let torsoY = 0;
  let bowlingArmAngleRad = 0.8;
  let nonBowlingArmAngleRad = -0.6;
  let frontLegX = 6;
  let frontLegY = 0;
  let backLegX = -10;
  let backLegY = -4;
  let appealElevation = 0.0;

  if (p < 0.12) {
    // Run-up & gather stride
    const t = p / 0.12;
    const strideCycle = Math.sin(t * Math.PI * 4);
    frontLegX = 4 + strideCycle * 6;
    backLegX = -8 - strideCycle * 6;
    torsoY = Math.abs(strideCycle) * 2;
    bowlingArmAngleRad = 0.5 + Math.sin(t * Math.PI * 2) * 0.8;
    nonBowlingArmAngleRad = -0.5 - Math.sin(t * Math.PI * 2) * 0.8;
  } else if (p >= 0.12 && p < 0.22) {
    // Delivery gather & continuous 360° arm windmill sweep
    const t = (p - 0.12) / 0.10;
    const smoothT = easeInOutQuad(t);
    // Arm rotates from behind back (-PI/2) over top (PI/2) to release point (1.3PI)
    bowlingArmAngleRad = lerp(-Math.PI * 0.5, Math.PI * 1.35, smoothT);
    nonBowlingArmAngleRad = lerp(Math.PI * 0.6, -Math.PI * 0.4, smoothT);
    torsoAngleRad = lerp(0.05, 0.35, smoothT);
    frontLegX = lerp(2, 9, smoothT);
    backLegX = lerp(-6, -14, smoothT);
  } else if (p >= 0.22 && p < 0.65) {
    // Follow-through momentum
    const t = (p - 0.22) / 0.43;
    const smoothT = easeOutCubic(t);
    bowlingArmAngleRad = lerp(Math.PI * 1.35, Math.PI * 0.6, smoothT);
    nonBowlingArmAngleRad = lerp(-Math.PI * 0.4, 0.2, smoothT);
    torsoAngleRad = lerp(0.35, 0.15, smoothT);
    frontLegX = lerp(9, 6, smoothT);
    backLegX = lerp(-14, -8, smoothT);
  } else {
    // 65% - 100%: Smooth transition into passionate LBW appeal
    const t = (p - 0.65) / 0.25;
    appealElevation = clamp(easeInOutQuad(t), 0, 1);
    torsoAngleRad = lerp(0.15, -0.15, appealElevation);
    bowlingArmAngleRad = lerp(Math.PI * 0.6, -Math.PI * 0.75, appealElevation);
    nonBowlingArmAngleRad = lerp(0.2, -Math.PI * 0.75, appealElevation);
    frontLegX = lerp(6, 4, appealElevation);
    backLegX = lerp(-8, -4, appealElevation);
  }

  return {
    torsoAngleRad,
    torsoY,
    headTiltRad: lerp(0.1, -0.2, appealElevation),
    bowlingArmAngleRad,
    nonBowlingArmAngleRad,
    frontLegX,
    frontLegY,
    backLegX,
    backLegY,
    appealElevation,
  };
}

/**
 * Solves continuous batter kinematics for Caught Behind (Corridor of Uncertainty).
 * Neutral -> Backlift & downswing arc -> Ball transit -> Follow-through -> Head track.
 */
export function solveCaughtBehindBatterKinematics(
  p: number,
  _shotType: string = "FORWARD_DEFENCE",
  batAngleDeg: number = 14
): BatterKinematics {
  let swing = 0.0;
  let followThrough = 0.0;

  if (p < 0.25) {
    // Stance & subtle backlift
    const t = p / 0.25;
    swing = t * 0.15;
  } else if (p >= 0.25 && p < 0.50) {
    // Active downswing arc to meet delivery at p = 0.50
    const t = (p - 0.25) / 0.25;
    swing = lerp(0.15, 0.85, easeInOutQuad(t));
  } else if (p >= 0.50 && p < 0.75) {
    // Follow-through extension
    const t = (p - 0.50) / 0.25;
    followThrough = easeOutCubic(t);
    swing = lerp(0.85, 1.0, followThrough);
  } else {
    // Hold follow-through
    swing = 1.0;
    followThrough = 1.0;
  }

  const baseAngleRad = (batAngleDeg * Math.PI) / 180;
  const batRotRad = lerp(-0.25, baseAngleRad + 0.15, swing);
  const torsoAngleRad = lerp(0.04, 0.20, swing);

  const headX = lerp(0, 6, swing);
  const headY = lerp(-54, -48, swing);
  const headTiltRad = lerp(0.05, 0.18, swing);

  const frontLegX = lerp(8, 16, swing);
  const frontLegY = -28;
  const backLegX = lerp(-10, -12, swing);
  const backLegY = -28;

  const batPivotX = lerp(-4, 10, swing);
  const batPivotY = lerp(-38, -28, swing);

  return {
    torsoAngleRad,
    headX,
    headY,
    headTiltRad,
    frontLegX,
    frontLegY,
    backLegX,
    backLegY,
    batPivotX,
    batPivotY,
    batRotRad,
    padRecoilX: 0,
    padRecoilY: 0,
  };
}

/**
 * Solves continuous wicketkeeper kinematics for Caught Behind.
 * Crouch wait -> Glove dynamic reach towards ball line -> Catch gather -> Rising appeal.
 */
export function solveCaughtBehindKeeperKinematics(
  p: number,
  hasEdge: boolean
): KeeperKinematics {
  let crouchElevation = 0.0;
  let gloveX = 12;
  let gloveY = -16;
  let isGlovesOpen = true;

  if (p < 0.35) {
    // Deep crouch waiting
    crouchElevation = 0.0;
    gloveX = 12;
    gloveY = -16;
  } else if (p >= 0.35 && p < 0.52) {
    // Dynamic glove extension towards incoming delivery line
    const t = (p - 0.35) / 0.17;
    const smoothT = easeInOutQuad(t);
    gloveX = lerp(12, 18, smoothT);
    gloveY = lerp(-16, hasEdge ? -22 : -20, smoothT);
    crouchElevation = lerp(0.0, 0.1, smoothT);
  } else if (p >= 0.52 && p < 0.70) {
    // Catch cushioned gather towards body
    const t = (p - 0.52) / 0.18;
    const smoothT = easeOutCubic(t);
    gloveX = lerp(18, 14, smoothT);
    gloveY = lerp(-22, -18, smoothT);
    isGlovesOpen = false; // Clamped around ball
    crouchElevation = lerp(0.1, 0.25, smoothT);
  } else {
    // 70% - 100%: Smooth rise into standing appeal
    const t = (p - 0.70) / 0.25;
    const smoothT = clamp(easeInOutQuad(t), 0, 1);
    crouchElevation = lerp(0.25, 1.0, smoothT);
    gloveX = lerp(14, 0, smoothT);
    gloveY = lerp(-18, -52, smoothT);
  }

  const torsoAngleRad = lerp(0.15, -0.1, crouchElevation);
  const headTiltRad = lerp(0.1, -0.2, crouchElevation);

  return {
    crouchElevation,
    torsoAngleRad,
    headTiltRad,
    gloveX,
    gloveY,
    isGlovesOpen,
  };
}

// ================================================================
// 1. ARTICULATED BATTER RIG RENDERER
// ================================================================
export function drawArticulatedBatter(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  k: BatterKinematics
) {
  const scale = t.scale ?? 1.0;
  const facingDir = t.facing === "LEFT" ? -1 : 1;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scale * facingDir, scale);
  if (t.rotationDeg) {
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
  }
  if (t.opacity !== undefined) {
    ctx.globalAlpha = t.opacity;
  }

  // --- Ground Contact Shadow ---
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(k.frontLegX * 0.5, 0, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- 1. Rear Leg & Rear Pad (Underlayer) ---
  ctx.save();
  ctx.translate(k.backLegX, k.backLegY);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(-4, 0, 8, 14);
  // Rear pad
  ctx.fillStyle = "#cbd5e1";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(-5, 12, 10, 24, 2);
  ctx.fill();
  ctx.stroke();
  // Rear shoe
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.ellipse(-2, 36, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- 2. Torso & Flannels ---
  ctx.save();
  ctx.translate(0, -32);
  ctx.rotate(k.torsoAngleRad);
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-10, -18, 20, 26, [4, 4, 2, 2]);
  ctx.fill();
  ctx.stroke();
  // Collar detail
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.moveTo(-4, -18);
  ctx.lineTo(0, -10);
  ctx.lineTo(4, -18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // --- 3. Head & Protective Helmet ---
  ctx.save();
  ctx.translate(k.headX, k.headY);
  ctx.rotate(k.headTiltRad);
  // Helmet Shell
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  // Helmet Visor Peak
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(1, -3, 9, 4, 1);
  ctx.fill();
  // Face Profile
  ctx.fillStyle = "#d4a373";
  ctx.beginPath();
  ctx.arc(2, 2, 5, 0, Math.PI * 2);
  ctx.fill();
  // Metal Grille
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(3, -1);
  ctx.lineTo(8, 3);
  ctx.lineTo(3, 7);
  ctx.moveTo(5, 1);
  ctx.lineTo(9, 6);
  ctx.stroke();
  ctx.restore();

  // --- 4. Front Leg & Front Batting Pad (with Recoil) ---
  ctx.save();
  ctx.translate(k.frontLegX + k.padRecoilX, k.frontLegY + k.padRecoilY);
  // Thigh
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(-5, 0, 10, 14);

  // Front Batting Pad
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-6, 10, 13, 26, 3);
  ctx.fill();
  ctx.stroke();

  // 3 Horizontal Knee Roll Ridges
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-5, 18);
  ctx.lineTo(6, 18);
  ctx.moveTo(-5, 23);
  ctx.lineTo(6, 23);
  ctx.moveTo(-5, 28);
  ctx.lineTo(6, 28);
  ctx.stroke();

  // Top hat wing
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(-5, 8, 11, 4, 1);
  ctx.fill();

  // Spiked Shoe
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(3, 36, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 34, 5, 2);
  ctx.restore();

  // --- 5. Arms, Gloves & Contoured Willow Bat ---
  ctx.save();
  ctx.translate(k.batPivotX, k.batPivotY);
  ctx.rotate(k.batRotRad);

  // Bat Handle (Cane with white grip)
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.6;
  ctx.fillRect(-2, -18, 4, 18);
  ctx.strokeRect(-2, -18, 4, 18);

  // Dual Batting Gloves (Top & Bottom Hand)
  ctx.fillStyle = "#0284c7";
  ctx.beginPath();
  ctx.roundRect(-4, -14, 8, 7, 2);
  ctx.roundRect(-4, -6, 8, 7, 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-3, -12, 6, 2.5);
  ctx.fillRect(-3, -4, 6, 2.5);

  // English Willow Blade
  ctx.fillStyle = "#d97706";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-3.5, 0, 7, 46, [1, 1, 3, 3]);
  ctx.fill();
  ctx.stroke();

  // Willow Spine Contour
  ctx.fillStyle = "#b45309";
  ctx.fillRect(-1.5, 4, 3, 38);
  // Red/Gold Branding Decal
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-3, 2, 6, 6);

  ctx.restore();

  ctx.restore();
}

// ================================================================
// 2. ARTICULATED BOWLER RIG RENDERER
// ================================================================
export function drawArticulatedBowler(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  k: BowlerKinematics
) {
  const scale = t.scale ?? 1.0;
  const facingDir = t.facing === "LEFT" ? -1 : 1;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scale * facingDir, scale);
  if (t.rotationDeg) {
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
  }
  if (t.opacity !== undefined) {
    ctx.globalAlpha = t.opacity;
  }

  // Ground shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // --- Stride Legs ---
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-3, -18 + k.torsoY);
  ctx.lineTo(k.frontLegX, k.frontLegY);
  ctx.moveTo(-3, -18 + k.torsoY);
  ctx.lineTo(k.backLegX, k.backLegY);
  ctx.stroke();

  // Shoes
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(k.frontLegX - 2, k.frontLegY - 2, 6, 3);
  ctx.fillRect(k.backLegX - 2, k.backLegY - 2, 6, 3);

  // --- Torso & Flannels ---
  ctx.save();
  ctx.translate(0, -22 + k.torsoY);
  ctx.rotate(k.torsoAngleRad);
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-7, -14, 14, 18, 3);
  ctx.fill();
  ctx.stroke();

  // Head & Cap
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, -20, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(1, -22, 6, 2.5);
  ctx.restore();

  // --- Articulated Arms ---
  ctx.save();
  ctx.translate(0, -32 + k.torsoY);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2.5;

  // Non-bowling arm
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-4 + Math.cos(k.nonBowlingArmAngleRad) * 14, Math.sin(k.nonBowlingArmAngleRad) * 14);
  ctx.stroke();

  // Bowling windmill arm
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(3 + Math.cos(k.bowlingArmAngleRad) * 16, Math.sin(k.bowlingArmAngleRad) * 16);
  ctx.stroke();
  // Bowling hand
  ctx.fillStyle = "#d4a373";
  ctx.beginPath();
  ctx.arc(3 + Math.cos(k.bowlingArmAngleRad) * 17, Math.sin(k.bowlingArmAngleRad) * 17, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.restore();
}

// ================================================================
// 3. ARTICULATED WICKETKEEPER RIG RENDERER
// ================================================================
export function drawArticulatedWicketkeeper(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  k: KeeperKinematics
) {
  const scale = t.scale ?? 1.0;
  const facingDir = t.facing === "LEFT" ? -1 : 1;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.scale(scale * facingDir, scale);
  if (t.rotationDeg) {
    ctx.rotate((t.rotationDeg * Math.PI) / 180);
  }
  if (t.opacity !== undefined) {
    ctx.globalAlpha = t.opacity;
  }

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyY = lerp(-20, -32, k.crouchElevation);
  const headY = lerp(-32, -46, k.crouchElevation);

  // Legs
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  const kneeSpread = lerp(8, 4, k.crouchElevation);
  const legHeight = lerp(14, 20, k.crouchElevation);
  ctx.fillRect(-kneeSpread - 4, -legHeight, 6, legHeight);
  ctx.fillRect(kneeSpread - 2, -legHeight, 6, legHeight);
  ctx.strokeRect(-kneeSpread - 4, -legHeight, 6, legHeight);
  ctx.strokeRect(kneeSpread - 2, -legHeight, 6, legHeight);

  // Shoes
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-kneeSpread - 6, -2, 9, 3);
  ctx.fillRect(kneeSpread - 2, -2, 9, 3);

  // Torso
  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(k.torsoAngleRad);
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-8, -12, 16, 16, 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Head
  ctx.save();
  ctx.translate(0, headY);
  ctx.rotate(k.headTiltRad);
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(1, -3, 7, 3);
  ctx.restore();

  // Webbed Green Keeping Gloves
  ctx.fillStyle = "#16a34a";
  ctx.strokeStyle = "#14532d";
  ctx.lineWidth = 1;

  if (k.crouchElevation > 0.8) {
    // Both gloves overhead in appeal
    ctx.beginPath();
    ctx.arc(-8, k.gloveY, 6, 0, Math.PI * 2);
    ctx.arc(8, k.gloveY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Catching cupped gloves
    ctx.beginPath();
    ctx.ellipse(k.gloveX, k.gloveY, 7.5, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Inner palm
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(k.gloveX - 1, k.gloveY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ================================================================
// 4. STUMPS & ZING BAILS
// ================================================================
export function drawStumpsAndBails(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { scale?: number; bailsDislodged?: boolean; dislodgeProgress?: number; isZing?: boolean } = {}
) {
  const scale = opts.scale ?? 1.0;
  const isDislodged = opts.bailsDislodged ?? false;
  const dislodgeT = opts.dislodgeProgress ?? (isDislodged ? 1.0 : 0.0);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // Stumps Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3 Wooden Stumps
  ctx.fillStyle = "#f59e0b";
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 0.6;

  for (let i = -1; i <= 1; i++) {
    const stumpX = i * 6.5;
    ctx.beginPath();
    ctx.roundRect(stumpX - 1.6, -34, 3.2, 34, [1, 1, 0, 0]);
    ctx.fill();
    ctx.stroke();
  }

  // Wooden Bails vs Zing Illuminated Bails
  if (!isDislodged || dislodgeT <= 0.0) {
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 0.5;
    ctx.fillRect(-9, -37, 8, 3);
    ctx.strokeRect(-9, -37, 8, 3);
    ctx.fillRect(1, -37, 8, 3);
    ctx.strokeRect(1, -37, 8, 3);
  } else {
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 8;

    const b1X = -9 - dislodgeT * 24;
    const b1Y = -37 - dislodgeT * 18 + dislodgeT * dislodgeT * 26;
    ctx.save();
    ctx.translate(b1X, b1Y);
    ctx.rotate(-dislodgeT * 3);
    ctx.fillRect(-4, -1.5, 8, 3);
    ctx.restore();

    const b2X = 1 + dislodgeT * 22;
    const b2Y = -37 - dislodgeT * 22 + dislodgeT * dislodgeT * 30;
    ctx.save();
    ctx.translate(b2X, b2Y);
    ctx.rotate(dislodgeT * 3.5);
    ctx.fillRect(-4, -1.5, 8, 3);
    ctx.restore();

    ctx.shadowBlur = 0;
  }

  ctx.restore();
}

// ================================================================
// 5. CRICKET BALL (3D Shaded Sphere with Seam & Motion Blur)
// ================================================================
export function drawCricketBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: { radius?: number; seamAngleRad?: number; shadowY?: number; motionTrail?: boolean; prevX?: number; prevY?: number } = {}
) {
  const r = opts.radius ?? 5.5;
  const seamAngle = opts.seamAngleRad ?? 0.0;

  ctx.save();

  // Subtle Motion Trail
  if (opts.motionTrail && opts.prevX !== undefined && opts.prevY !== undefined) {
    ctx.strokeStyle = "rgba(220, 38, 38, 0.25)";
    ctx.lineWidth = r * 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(opts.prevX, opts.prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // Shadow
  if (opts.shadowY !== undefined) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(x + 1.5, opts.shadowY, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3D Shaded Sphere
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, "#ef4444");
  grad.addColorStop(0.7, "#dc2626");
  grad.addColorStop(1, "#7f1d1d");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#7f1d1d";
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Stitched Seam
  ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.85, r * 0.22, seamAngle, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}
