/**
 * src/engine/career/careerProgression.ts
 *
 * Tier progression and milestone validation rules for Career Mode.
 */

import type {
  CareerTierLevel,
  InvestigationOutcome,
} from "../../types/career";
import { CAREER_CONSTANTS, getTierInfo } from "./careerConstants";

export interface TierEvaluationResult {
  readonly currentTier: CareerTierLevel;
  readonly newTier: CareerTierLevel;
  readonly promoted: boolean;
  readonly reason?: string;
}

/**
 * Checks whether an umpire has earned promotion to a higher competition tier
 * based on completed match experience and average reputation (fans + critics).
 */
export function evaluateTierProgression(
  matchesCompleted: number,
  fanScore: number,
  criticScore: number,
  currentTier: CareerTierLevel
): TierEvaluationResult {
  const avgReputation = Math.round((fanScore + criticScore) / 2);

  // Check highest qualifying tier from 5 down to currentTier + 1
  for (let targetLevel = 5 as CareerTierLevel; targetLevel > currentTier; targetLevel--) {
    const tierInfo = getTierInfo(targetLevel);
    if (
      matchesCompleted >= tierInfo.minMatches &&
      avgReputation >= tierInfo.minReputation
    ) {
      return {
        currentTier,
        newTier: targetLevel,
        promoted: true,
        reason: `Promoted to ${tierInfo.name}! (Matches: ${matchesCompleted}, Reputation: ${avgReputation})`,
      };
    }
  }

  return {
    currentTier,
    newTier: currentTier,
    promoted: false,
  };
}

/**
 * Checks whether player has fulfilled the ultimate career objective: reaching ₹1,000,000.
 */
export function checkCareerWinCondition(balance: number): boolean {
  return balance >= CAREER_CONSTANTS.TARGET_WIN_BALANCE;
}

/**
 * Checks whether career was terminated due to anti-corruption findings.
 */
export function checkCareerTermination(outcome: InvestigationOutcome): boolean {
  return outcome === "CAUGHT";
}
