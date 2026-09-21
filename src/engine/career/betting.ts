/**
 * src/engine/career/betting.ts
 *
 * Pre-match sports wagering engine for Career Mode.
 * Completely independent of DRS physics and in-game umpire decision engines.
 */

import type { Team } from "../../types/league";
import type {
  BettingMarket,
  BettingOdds,
  PreMatchBet,
  BetResolution,
} from "../../types/career";
import { SeededRandom } from "../scenarioGenerator";
import { CAREER_CONSTANTS } from "./careerConstants";

/**
 * Generates pre-match betting odds for a fixture deterministically.
 */
export function generateBettingMarket(
  matchId: string,
  homeTeam: Team,
  awayTeam: Team,
  seed: number
): BettingMarket {
  const rng = new SeededRandom(seed ^ 0x5a5a5a5a);

  // Base home advantage gives slight edge to home team
  const homeFavorite = rng.boolean(0.55);
  const spread = rng.range(0.15, 0.40);

  const homeMultiplier = homeFavorite
    ? Math.round((1.70 + rng.range(0.0, 0.15)) * 100) / 100
    : Math.round((2.00 + spread) * 100) / 100;

  const awayMultiplier = homeFavorite
    ? Math.round((2.00 + spread) * 100) / 100
    : Math.round((1.70 + rng.range(0.0, 0.15)) * 100) / 100;

  const homeOdds: BettingOdds = {
    teamId: homeTeam.id,
    teamName: homeTeam.name,
    oddsMultiplier: homeMultiplier,
  };

  const awayOdds: BettingOdds = {
    teamId: awayTeam.id,
    teamName: awayTeam.name,
    oddsMultiplier: awayMultiplier,
  };

  return {
    matchId,
    homeOdds,
    awayOdds,
  };
}

/**
 * Validates whether a proposed bet is legal given current player balance.
 */
export function validateBet(
  stake: number,
  currentBalance: number
): { valid: boolean; reason?: string } {
  if (!Number.isFinite(stake) || stake <= 0) {
    return { valid: false, reason: "Stake must be a positive number." };
  }

  const roundedStake = Math.floor(stake);
  if (roundedStake < CAREER_CONSTANTS.MIN_BET_AMOUNT) {
    return {
      valid: false,
      reason: `Minimum bet is ₹${CAREER_CONSTANTS.MIN_BET_AMOUNT.toLocaleString()}.`,
    };
  }

  if (roundedStake > currentBalance) {
    return {
      valid: false,
      reason: `Insufficient funds. Your available balance is ₹${currentBalance.toLocaleString()}.`,
    };
  }

  return { valid: true };
}

/**
 * Creates a validated PreMatchBet object.
 */
export function createPreMatchBet(
  matchId: string,
  teamId: string,
  teamName: string,
  stake: number,
  odds: number
): PreMatchBet {
  const cleanStake = Math.floor(stake);
  const potentialPayout = Math.round(cleanStake * odds);

  return {
    matchId,
    teamId,
    teamName,
    stake: cleanStake,
    odds,
    potentialPayout,
  };
}

/**
 * Resolves a pre-match bet against the authoritative match outcome.
 */
export function resolveBet(
  bet: PreMatchBet,
  matchWinnerTeamId: string
): BetResolution {
  const won = bet.teamId === matchWinnerTeamId;
  if (won) {
    const payout = bet.potentialPayout;
    return {
      won: true,
      stake: bet.stake,
      payout,
      netProfitOrLoss: payout - bet.stake,
    };
  }

  return {
    won: false,
    stake: bet.stake,
    payout: 0,
    netProfitOrLoss: -bet.stake,
  };
}
