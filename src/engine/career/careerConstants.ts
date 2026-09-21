/**
 * src/engine/career/careerConstants.ts
 *
 * Centralized configuration and balancing constants for Career Mode.
 * All financial values, reputation deltas, progression thresholds,
 * and probability weights are defined here for maintainable game balancing.
 */

import type {
  CareerTierInfo,
  CareerTierLevel,
  CriticalMomentType,
  MatchImportance,
} from "../../types/career";

export const CAREER_CONSTANTS = {
  // Financial Targets
  STARTING_BALANCE: 10_000,
  TARGET_WIN_BALANCE: 1_000_000,
  MIN_BET_AMOUNT: 500,

  // Initial Reputation Scores
  INITIAL_FAN_SCORE: 50,
  INITIAL_CRITIC_SCORE: 50,
  INITIAL_INTEGRITY_SCORE: 100,
  INITIAL_INVESTIGATION_RISK: 0,

  // Storage
  STORAGE_KEY: "third_umpire_career_v1",

  // Tiers
  TIERS: {
    1: {
      level: 1,
      name: "Local Club Championship",
      shortName: "Local League",
      minMatches: 0,
      minReputation: 0,
      baseMatchFee: 5_000,
      incidentCount: 6,
      description: "Grassroots weekend tournament. Modest crowds and basic broadcast gear.",
    },
    2: {
      level: 2,
      name: "City Premier League",
      shortName: "City League",
      minMatches: 2,
      minReputation: 45,
      baseMatchFee: 12_000,
      incidentCount: 6,
      description: "Regional metropolitan league with high attendance and vocal fanbases.",
    },
    3: {
      level: 3,
      name: "Super T20 League",
      shortName: "Premier League",
      minMatches: 5,
      minReputation: 58,
      baseMatchFee: 28_000,
      incidentCount: 8,
      description: "Prime-time televised league with intense media scrutiny and high stakes.",
    },
    4: {
      level: 4,
      name: "National T20 Trophy",
      shortName: "National League",
      minMatches: 9,
      minReputation: 70,
      baseMatchFee: 60_000,
      incidentCount: 8,
      description: "Top-tier franchise championship with star international athletes.",
    },
    5: {
      level: 5,
      name: "Elite Champions League",
      shortName: "Elite League",
      minMatches: 14,
      minReputation: 82,
      baseMatchFee: 120_000,
      incidentCount: 8,
      description: "The pinnacle of domestic franchise cricket. Massive TV audiences.",
    },
  } as const satisfies Record<CareerTierLevel, CareerTierInfo>,

  // Fan Sentiment Deltas (Score Range 0 - 100)
  FAN_DELTAS: {
    CORRECT_CRITICAL: 8,
    CORRECT_NORMAL: 3,
    WRONG_CRITICAL: -12,
    WRONG_NORMAL: -4,
    WRONG_DECIDED: -2,
  },

  // Match Importance Multipliers for Fan Sentiment
  MATCH_IMPORTANCE_FAN_MULTIPLIER: {
    LOW: 0.8,
    NORMAL: 1.0,
    HIGH: 1.3,
    CRITICAL: 1.6,
  } as const satisfies Record<MatchImportance, number>,

  // Critic Sentiment Deltas (Score Range 0 - 100)
  CRITIC_DELTAS: {
    CORRECT_CLEAR: 3,
    CORRECT_MARGINAL: 7,
    CORRECT_HOWLER: 10,
    WRONG_CLEAR: -10,
    WRONG_MARGINAL: -4,
    WRONG_HOWLER: -14,
    UMPIRES_CALL_COMPLIANCE_BONUS: 2,
  } as const satisfies Record<string, number>,

  // Bribery & Corruption Parameters
  BRIBE_CONFIG: {
    OFFER_CHANCE_BY_TIER: {
      1: 0.30,
      2: 0.45,
      3: 0.55,
      4: 0.65,
      5: 0.75,
    } as const satisfies Record<CareerTierLevel, number>,
    BASE_BRIBE_BY_TIER: {
      1: 15_000,
      2: 35_000,
      3: 65_000,
      4: 130_000,
      5: 250_000,
    } as const satisfies Record<CareerTierLevel, number>,
    ACCEPT_INTEGRITY_PENALTY: -10,
    ACCEPT_RISK_BUMP: 10,
    FULFILLED_INTEGRITY_PENALTY: -25,
    FULFILLED_RISK_BUMP: 30,
    CLEAN_MATCH_INTEGRITY_RECOVERY: 3,
    CLEAN_MATCH_RISK_DECAY: 5,
  },

  // Investigation & Termination Parameters
  INVESTIGATION: {
    CAUGHT_RISK_THRESHOLD: 40,      // Minimum risk required to trigger potential CAUGHT
    FINE_AMOUNT_BY_TIER: {
      1: 5_000,
      2: 12_000,
      3: 30_000,
      4: 75_000,
      5: 150_000,
    } as const satisfies Record<CareerTierLevel, number>,
  },

  // Performance Bonuses
  BONUSES: {
    PERFECT_ACCURACY_BONUS_MULTIPLIER: 0.5, // 50% of base fee
    HIGH_ACCURACY_BONUS_MULTIPLIER: 0.25,   // 25% of base fee (accuracy >= 85%)
  },
} as const;

/**
 * Returns tier details for a given tier level.
 */
export function getTierInfo(level: CareerTierLevel): CareerTierInfo {
  return CAREER_CONSTANTS.TIERS[level] ?? CAREER_CONSTANTS.TIERS[1];
}

/**
 * Helper to check if a critical moment represents high match tension.
 */
export function isHighPressureMoment(moment: CriticalMomentType): boolean {
  return moment !== "NORMAL";
}
