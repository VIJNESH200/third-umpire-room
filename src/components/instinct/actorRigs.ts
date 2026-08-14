/**
 * actorRigs.ts
 * Reusable procedural 2D cricket actor and equipment rendering system.
 * Provides articulated, stylized broadcast-grade figures for Batter, Bowler,
 * Wicketkeeper, Fielder, and Cricket Equipment (Bat, Ball, Stumps, Zing Bails).
 */

export interface ActorTransform {
  x: number;
  y: number;
  scale?: number;
  rotationDeg?: number;
  facing?: "LEFT" | "RIGHT";
  opacity?: number;
}

export type BatterPoseType =
  | "NEUTRAL_STANCE"
  | "FORWARD_DEFENCE"
  | "COVER_DRIVE"
  | "LEAVE_ARMS"
  | "PAD_IMPACT"
  | "RUNNING"
  | "DIVING"
  | "SLIDING";

export interface BatterOptions {
  pose: BatterPoseType;
  shotProgress?: number; // 0.0 to 1.0
  batAngleDeg?: number;
  batPadSeparationMm?: number;
  stanceShiftX?: number;
  isLeftHanded?: boolean;
  hasPadImpact?: boolean;
  impactHeightRatio?: number; // 0.0 (shin) to 1.0 (high thigh)
}

export type BowlerPoseType =
  | "RUN_UP"
  | "DELIVERY_STRIDE"
  | "WINDUP_RELEASE"
  | "FOLLOW_THROUGH"
  | "APPEAL";

export interface BowlerOptions {
  pose: BowlerPoseType;
  cycleProgress?: number; // 0.0 to 1.0
  armAngleDeg?: number;
  isSpin?: boolean;
}

export type KeeperPoseType =
  | "CROUCH_WAIT"
  | "GLOVE_REACH"
  | "CATCH_GATHER"
  | "APPEAL_STAND";

export interface KeeperOptions {
  pose: KeeperPoseType;
  cycleProgress?: number; // 0.0 to 1.0
  gloveOffsetX?: number;
  gloveOffsetY?: number;
}

export interface StumpsOptions {
  scale?: number;
  bailsDislodged?: boolean;
  dislodgeProgress?: number; // 0.0 to 1.0
  isZing?: boolean;
}

export interface BallOptions {
  radius?: number;
  seamAngleRad?: number;
  shadowY?: number;
}

// ================================================================
// 1. BATTER RIG (Articulated Cricket Batsman)
// ================================================================
export function drawBatter(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  opts: BatterOptions
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
  ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pose-specific coordinates & joint angles
  let torsoAngle = -0.04;
  let headX = -2;
  let headY = -54;
  let frontLegX = 4;
  let frontLegY = -28;
  let backLegX = -10;
  let backLegY = -28;
  let batPivotX = -6;
  let batPivotY = -34;
  let batRot = (opts.batAngleDeg ?? 14) * (Math.PI / 180);

  if (opts.pose === "FORWARD_DEFENCE") {
    torsoAngle = 0.12;
    headX = 4;
    headY = -50;
    frontLegX = 14;
    backLegX = -12;
    batPivotX = 8;
    batPivotY = -30;
    batRot = 0.18;
  } else if (opts.pose === "COVER_DRIVE") {
    torsoAngle = 0.22;
    headX = 8;
    headY = -48;
    frontLegX = 18;
    backLegX = -14;
    batPivotX = 12;
    batPivotY = -26;
    batRot = 0.38;
  } else if (opts.pose === "LEAVE_ARMS") {
    torsoAngle = -0.15;
    headX = -6;
    headY = -56;
    frontLegX = 2;
    backLegX = -8;
    batPivotX = -14;
    batPivotY = -42;
    batRot = -0.65; // Bat raised behind shoulder
  } else if (opts.pose === "PAD_IMPACT") {
    torsoAngle = 0.08;
    headX = 2;
    headY = -52;
    frontLegX = 10;
    backLegX = -10;
    batPivotX = 4;
    batPivotY = -32;
    batRot = 0.12;
  } else if (opts.pose === "DIVING" || opts.pose === "SLIDING") {
    torsoAngle = Math.PI * 0.45;
    headX = 28;
    headY = -12;
    frontLegX = -24;
    backLegX = -36;
    batPivotX = 22;
    batPivotY = -4;
    batRot = 0.05;
  }

  // --- 1. Rear Leg & Rear Pad (Underlayer) ---
  ctx.save();
  ctx.translate(backLegX, backLegY);
  // Rear thigh
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
  ctx.rotate(torsoAngle);
  // White/cream flannel shirt
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-10, -18, 20, 26, [4, 4, 2, 2]);
  ctx.fill();
  ctx.stroke();
  // Collar / V-neck detail
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
  ctx.translate(headX, headY);
  // Helmet Shell (Dark Navy/Green)
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  // Helmet Visor Peak
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(1, -3, 9, 4, 1);
  ctx.fill();
  // Face & Beard Profile
  ctx.fillStyle = "#d4a373";
  ctx.beginPath();
  ctx.arc(2, 2, 5, 0, Math.PI * 2);
  ctx.fill();
  // Metal Grille / Face Guard
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

  // --- 4. Front Leg & Front Batting Pad ---
  ctx.save();
  ctx.translate(frontLegX, frontLegY);
  // Front thigh
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(-5, 0, 10, 14);

  // Front Batting Pad (High-definition cricket pad)
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-6, 10, 13, 26, 3);
  ctx.fill();
  ctx.stroke();

  // Pad Knee Rolls & Bolsters (3 horizontal ridges)
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

  // Top hat / wing protector
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(-5, 8, 11, 4, 1);
  ctx.fill();

  // Front Spiked Shoe
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.ellipse(3, 36, 8, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // White shoe trim
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 34, 5, 2);
  ctx.restore();

  // --- 5. Arms, Batting Gloves & English Willow Bat ---
  ctx.save();
  ctx.translate(batPivotX, batPivotY);
  ctx.rotate(batRot);

  // Bat Handle (Cane with white rubber grip)
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.6;
  ctx.fillRect(-2, -18, 4, 18);
  ctx.strokeRect(-2, -18, 4, 18);

  // Dual Batting Gloves (Grip hands attached to handle)
  ctx.fillStyle = "#0284c7"; // Glove accent
  ctx.beginPath();
  ctx.roundRect(-4, -14, 8, 7, 2); // Top hand
  ctx.roundRect(-4, -6, 8, 7, 2);  // Bottom hand
  ctx.fill();
  // White glove sausage padding
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-3, -12, 6, 2.5);
  ctx.fillRect(-3, -4, 6, 2.5);

  // English Willow Cricket Bat Blade
  ctx.fillStyle = "#d97706"; // Willow wood tone
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-3.5, 0, 7, 46, [1, 1, 3, 3]);
  ctx.fill();
  ctx.stroke();

  // Bat Face Contour & Spine Highlight
  ctx.fillStyle = "#b45309";
  ctx.fillRect(-1.5, 4, 3, 38);
  // Red/Gold Branding Sticker on Shoulders
  ctx.fillStyle = "#dc2626";
  ctx.fillRect(-3, 2, 6, 6);

  ctx.restore();

  ctx.restore();
}

// ================================================================
// 2. BOWLER RIG (Articulated Delivery Stride & Arm Windmill)
// ================================================================
export function drawBowler(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  opts: BowlerOptions
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

  let bodyTilt = 0.1;
  let armAngle = (opts.armAngleDeg ?? 45) * (Math.PI / 180);

  if (opts.pose === "APPEAL") {
    bodyTilt = -0.15;
    armAngle = -Math.PI * 0.75; // Both arms thrust upwards
  } else if (opts.pose === "FOLLOW_THROUGH") {
    bodyTilt = 0.35;
    armAngle = Math.PI * 0.6;
  }

  // --- Legs & Stride ---
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";

  if (opts.pose === "APPEAL") {
    // Standing appealing
    ctx.beginPath();
    ctx.moveTo(-4, -18);
    ctx.lineTo(-5, 0);
    ctx.moveTo(4, -18);
    ctx.lineTo(5, 0);
    ctx.stroke();
  } else {
    // Landing delivery stride
    ctx.beginPath();
    ctx.moveTo(-3, -18);
    ctx.lineTo(8, -1); // Front landing foot
    ctx.moveTo(-3, -18);
    ctx.lineTo(-12, -8); // Trailing kicking leg
    ctx.stroke();
  }

  // Shoes
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(opts.pose === "APPEAL" ? -7 : 6, -3, 6, 3);
  ctx.fillRect(opts.pose === "APPEAL" ? 3 : -14, opts.pose === "APPEAL" ? -3 : -10, 6, 3);

  // --- Torso & Flannels ---
  ctx.save();
  ctx.translate(0, -22);
  ctx.rotate(bodyTilt);
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
  // Cap peak
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(1, -22, 6, 2.5);
  ctx.restore();

  // --- Bowling Arm & Release Action ---
  ctx.save();
  ctx.translate(0, -32);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2.5;

  if (opts.pose === "APPEAL") {
    // Dual appeal arms
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-9, -16);
    ctx.moveTo(4, 0);
    ctx.lineTo(9, -16);
    ctx.stroke();
  } else {
    // Non-bowling arm pull-down
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-8, 8);
    ctx.stroke();

    // High windmill bowling arm
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.lineTo(3 + Math.cos(armAngle) * 16, Math.sin(armAngle) * 16);
    ctx.stroke();
    // Hand
    ctx.fillStyle = "#d4a373";
    ctx.beginPath();
    ctx.arc(3 + Math.cos(armAngle) * 17, Math.sin(armAngle) * 17, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

// ================================================================
// 3. WICKETKEEPER RIG (Crouched Keeping Stance & Webbed Gloves)
// ================================================================
export function drawWicketkeeper(
  ctx: CanvasRenderingContext2D,
  t: ActorTransform,
  opts: KeeperOptions
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

  const isAppealing = opts.pose === "APPEAL_STAND";
  const bodyY = isAppealing ? -32 : -20;
  const headY = isAppealing ? -46 : -32;

  // --- Crouched Legs & Compact Pads ---
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  if (!isAppealing) {
    // Wide flexed knees
    ctx.fillRect(-12, -14, 8, 14);
    ctx.fillRect(4, -14, 8, 14);
    ctx.strokeRect(-12, -14, 8, 14);
    ctx.strokeRect(4, -14, 8, 14);
  } else {
    // Straightened legs
    ctx.fillRect(-8, -20, 6, 20);
    ctx.fillRect(2, -20, 6, 20);
    ctx.strokeRect(-8, -20, 6, 20);
    ctx.strokeRect(2, -20, 6, 20);
  }

  // Shoes
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(-14, -2, 9, 3);
  ctx.fillRect(5, -2, 9, 3);

  // --- Torso & Keeping Jersey ---
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(-8, bodyY, 16, isAppealing ? 18 : 14, 2);
  ctx.fill();
  ctx.stroke();

  // --- Head & Cap/Helmet ---
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(0, headY, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(1, headY - 3, 7, 3); // Peak

  // --- Wicketkeeping Webbed Gloves ---
  const gloveX = (opts.gloveOffsetX ?? 0) + (isAppealing ? 0 : 12);
  const gloveY = (opts.gloveOffsetY ?? 0) + (isAppealing ? -52 : -16);

  ctx.fillStyle = "#16a34a"; // Green keeping gloves
  ctx.strokeStyle = "#14532d";
  ctx.lineWidth = 1;

  if (isAppealing) {
    // Both gloves raised high
    ctx.beginPath();
    ctx.arc(-8, gloveY, 6, 0, Math.PI * 2);
    ctx.arc(8, gloveY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Cupped catching gloves with thumb webbing
    ctx.beginPath();
    ctx.ellipse(gloveX, gloveY, 7.5, 6, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Inner palm cushion
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(gloveX - 1, gloveY, 3, 0, Math.PI * 2);
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
  opts: StumpsOptions = {}
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

  // 3 Wooden Stumps (Off, Middle, Leg)
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
    // Intact in spigot grooves
    ctx.fillStyle = "#fbbf24";
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 0.5;
    ctx.fillRect(-9, -37, 8, 3);
    ctx.strokeRect(-9, -37, 8, 3);
    ctx.fillRect(1, -37, 8, 3);
    ctx.strokeRect(1, -37, 8, 3);
  } else {
    // Flying dislodged bails with red Zing LED glow
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 8;

    // Bail 1 flying left
    const b1X = -9 - dislodgeT * 24;
    const b1Y = -37 - dislodgeT * 18 + dislodgeT * dislodgeT * 26;
    ctx.save();
    ctx.translate(b1X, b1Y);
    ctx.rotate(-dislodgeT * 3);
    ctx.fillRect(-4, -1.5, 8, 3);
    ctx.restore();

    // Bail 2 flying right
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
// 5. CRICKET BALL (3D Shaded Sphere with Seam)
// ================================================================
export function drawCricketBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: BallOptions = {}
) {
  const r = opts.radius ?? 5.5;
  const seamAngle = opts.seamAngleRad ?? 0.0;

  ctx.save();

  // Shadow
  if (opts.shadowY !== undefined) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(x + 1.5, opts.shadowY, r * 1.1, r * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Red Leather Sphere with Radial Specular Highlight
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
