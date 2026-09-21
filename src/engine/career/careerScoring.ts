/**
 * src/engine/career/careerScoring.ts
 *
 * Pure scoring and reputation evaluation functions for Career Mode.
 * Evaluates fan sentiment, critic assessments, and match rating.
 */

import type { CriticalMomentType, MatchImportance } from "../../types/career";
import type { DifficultyTier } from "../../types/scenario";
import { CAREER_CONSTANTS } from "./careerConstants";

/**
 * Clamps a numerical value within [min, max], defaulting to [0, 100].
 */
export function clampScore(value: number, min: number = 0, max: number = 100): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

/**
 * Calculates the fan sentiment delta for an individual DRS incident decision.
 * Fans react intensely to critical match situations (final over, hat-trick, milestone),
 * and their reaction scales with overall match importance.
 */
export function calculateFanImpact(
  isCorrect: boolean,
  criticalMoment: CriticalMomentType,
  matchImportance: MatchImportance = "NORMAL",
  isMatchDecided: boolean = false
): number {
  const isCritical = criticalMoment !== "NORMAL";
  let baseDelta: number;

  if (isMatchDecided && !isCorrect) {
    // A wrong decision in a match already mathematically settled generates muted frustration
    baseDelta = CAREER_CONSTANTS.FAN_DELTAS.WRONG_DECIDED;
  } else if (isCritical) {
    baseDelta = isCorrect
      ? CAREER_CONSTANTS.FAN_DELTAS.CORRECT_CRITICAL
      : CAREER_CONSTANTS.FAN_DELTAS.WRONG_CRITICAL;
  } else {
    baseDelta = isCorrect
      ? CAREER_CONSTANTS.FAN_DELTAS.CORRECT_NORMAL
      : CAREER_CONSTANTS.FAN_DELTAS.WRONG_NORMAL;
  }

  const multiplier = CAREER_CONSTANTS.MATCH_IMPORTANCE_FAN_MULTIPLIER[matchImportance] ?? 1.0;
  return Math.round(baseDelta * multiplier);
}

/**
 * Calculates the critic sentiment delta for an individual DRS incident decision.
 * Critics evaluate technical decision difficulty and precision rather than team favoritism:
 * - Obvious calls (CLEAR): small reward for correct, severe penalty for wrong.
 * - Marginal calls (MARGINAL): large reward for correct, moderate penalty for wrong.
 * - Howlers (HOWLER): large reward for overturning, massive penalty for missing.
 */
export function calculateCriticImpact(
  isCorrect: boolean,
  difficulty: DifficultyTier,
  isUmpiresCall: boolean = false,
  compliedWithUmpiresCall: boolean = true
): number {
  let delta: number;

  if (isCorrect) {
    if (difficulty === "HOWLER") {
      delta = CAREER_CONSTANTS.CRITIC_DELTAS.CORRECT_HOWLER;
    } else if (difficulty === "MARGINAL") {
      delta = CAREER_CONSTANTS.CRITIC_DELTAS.CORRECT_MARGINAL;
    } else {
      delta = CAREER_CONSTANTS.CRITIC_DELTAS.CORRECT_CLEAR;
    }

    // Bonus for faithfully adhering to ICC Umpire's Call boundary protocol
    if (isUmpiresCall && compliedWithUmpiresCall) {
      delta += CAREER_CONSTANTS.CRITIC_DELTAS.UMPIRES_CALL_COMPLIANCE_BONUS;
    }
  } else {
    if (difficulty === "HOWLER") {
      delta = CAREER_CONSTANTS.CRITIC_DELTAS.WRONG_HOWLER;
    } else if (difficulty === "MARGINAL") {
      delta = CAREER_CONSTANTS.CRITIC_DELTAS.WRONG_MARGINAL;
    } else {
      delta = CAREER_CONSTANTS.CRITIC_DELTAS.WRONG_CLEAR;
    }
  }

  return delta;
}

/**
 * Calculates the post-match Match Rating on a standard 0.0 – 10.0 scale.
 * Combines accuracy percentage (up to 7.0), difficulty handling (up to 1.5),
 * and critical moments adjudicated correctly (up to 1.5).
 */
export function calculateMatchRating(
  totalDecisions: number,
  correctDecisions: number,
  difficultDecisionsHandled: number,
  criticalHandledCorrectly: number
): number {
  if (totalDecisions <= 0) return 5.0;

  const accuracyFraction = correctDecisions / totalDecisions;
  const accuracyComponent = accuracyFraction * 7.0;

  const difficultyComponent = Math.min(1.5, (difficultDecisionsHandled / totalDecisions) * 2.0);
  const criticalComponent = Math.min(1.5, criticalHandledCorrectly * 0.5);

  const rawRating = accuracyComponent + difficultyComponent + criticalComponent;
  return Math.round(Math.min(10.0, Math.max(1.0, rawRating)) * 10) / 10;
}
