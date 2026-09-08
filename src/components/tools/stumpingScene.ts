import type { StumpingData } from "../../types/scenario";
import { solveStumpingReplayState } from "../../engine/stumpingPhysics";
import {
  drawStumpsAndBails,
  drawArticulatedWicketkeeper,
  drawArticulatedBatter,
  drawCricketBall,
  solveStumpingKeeperKinematics,
  solveStumpingBatterKinematics,
  clamp,
} from "../instinct/actorRigs";

/**
 * Renders the single unified canonical Stumping cricket scene into the given canvas context.
 * World coordinate contract:
 *   pitchTopY = height * 0.52
 *   stumpsX = width * 0.28
 *   creaseX = width * 0.46
 *   stumpsBaseY = pitchTopY + 6
 *
 * Used by:
 *   - Phase 1: IncidentReplayFeed (full broadcast perspective at 640x360)
 *   - Phase 2: StumpingEvidenceReview (Window A Keeper Close-Up & Window B Tight Crease Close-Up at 800x450)
 */
export function renderCanonicalStumpingScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stumping: StumpingData,
  currentTimeMs: number,
  progress?: number
): void {
  const state = solveStumpingReplayState(stumping, currentTimeMs);
  const p = progress !== undefined ? progress : clamp(currentTimeMs / 2200, 0, 1);

  // --- 1. Outfield Grass ---
  const gradGrass = ctx.createLinearGradient(0, 0, 0, height);
  gradGrass.addColorStop(0, "#132b1c");
  gradGrass.addColorStop(0.5, "#183824");
  gradGrass.addColorStop(1, "#0d1e13");
  ctx.fillStyle = gradGrass;
  ctx.fillRect(0, 0, width, height);

  // --- 2. 22-Yard Pitch Strip ---
  const pitchTopY = height * 0.52;
  const pitchHeight = height * 0.48;

  const gradPitch = ctx.createLinearGradient(0, pitchTopY, 0, height);
  gradPitch.addColorStop(0, "#ba9c77");
  gradPitch.addColorStop(0.5, "#a68862");
  gradPitch.addColorStop(1, "#8a6d49");
  ctx.fillStyle = gradPitch;
  ctx.fillRect(0, pitchTopY, width, pitchHeight);

  ctx.strokeStyle = "#4d3d29";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, pitchTopY);
  ctx.lineTo(width, pitchTopY);
  ctx.stroke();

  // --- 3. Painted White Creases ---
  const creaseX = width * 0.46;
  const stumpsX = width * 0.28;
  const stumpsBaseY = pitchTopY + 6;

  // Bowling crease line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(stumpsX, pitchTopY);
  ctx.lineTo(stumpsX, height);
  ctx.stroke();

  // Popping crease line
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(creaseX - 2.5, pitchTopY, 5, pitchHeight);

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "bold 8px monospace";
  ctx.fillText("POPPING CREASE", creaseX + 6, pitchTopY + 18);
  ctx.restore();

  // --- 4. Striker Stumps & Zing Bails ---
  const bailsBroke = state.stumps.bailsSeparating;
  const dislodgeProgress = clamp(
    (currentTimeMs - state.timeline.bailsDislodgedMs) / 300,
    0,
    1
  );

  drawStumpsAndBails(ctx, stumpsX, stumpsBaseY, {
    scale: 1.15,
    bailsDislodged: bailsBroke,
    dislodgeProgress,
    isZing: true,
  });

  // --- 5. Wicketkeeper Stumping Whip Kinematics ---
  const keeperK = solveStumpingKeeperKinematics(p);
  drawArticulatedWicketkeeper(
    ctx,
    { x: stumpsX - 22, y: stumpsBaseY + 4, scale: 1.15, facing: "RIGHT" },
    keeperK
  );

  // --- 6. Batter Stationary Stance & Rear-Leg Pendulum Kinematics ---
  const marginPx = state.batter.isGrounded ? -10 : 10;
  const stumpingResult = solveStumpingBatterKinematics(p, creaseX, marginPx);

  drawArticulatedBatter(
    ctx,
    { x: stumpingResult.batterX, y: stumpsBaseY + 8, scale: 1.15, facing: "RIGHT" },
    stumpingResult.batterK
  );

  // --- 7. Ball Flight to Wicketkeeper Gloves ---
  if (state.ball.isInFlight) {
    const t = state.ball.flightProgress;
    const originX = width * 0.88;
    const originY = height * 0.32;
    const targetX = stumpsX - 22 + keeperK.gloveX * 1.15;
    const targetY = stumpsBaseY + 4 + keeperK.gloveY * 1.15;

    const bX = originX + (targetX - originX) * t;
    const bY = originY + (targetY - originY) * t;
    const prevBX = originX + (targetX - originX) * Math.max(0, t - 0.05);
    const prevBY = originY + (targetY - originY) * Math.max(0, t - 0.05);

    drawCricketBall(ctx, bX, bY, {
      radius: 5.0,
      seamAngleRad: p * Math.PI * 6,
      motionTrail: t > 0.15,
      prevX: prevBX,
      prevY: prevBY,
    });
  } else {
    // Secured in keeper's gloves
    const gloveBallX = stumpsX - 22 + keeperK.gloveX * 1.15;
    const gloveBallY = stumpsBaseY + 4 + keeperK.gloveY * 1.15;
    drawCricketBall(ctx, gloveBallX, gloveBallY, {
      radius: 4.5,
      seamAngleRad: 0.2,
      motionTrail: false,
    });
  }
}
