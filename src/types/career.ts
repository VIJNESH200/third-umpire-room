/**
 * src/types/career.ts
 *
 * Core type definitions for League Umpire Career Mode.
 * Defines career profile, tiers, reputation, critical moments,
 * betting markets, bribery contracts, and match reports.
 *
 * Boundary rules:
 * - Pure type definitions only.
 * - Independent of DRS physics engines and camera rendering.
 * - Follows Google TypeScript style conventions (named exports, readonly properties).
 */

import type { Team } from "./league";
import type { Scenario, IncidentResult } from "./scenario";

/**
 * Progression tiers for the fictional league career.
 * 1 = Local League, up to 5 = Elite League.
 */
export type CareerTierLevel = 1 | 2 | 3 | 4 | 5;

export interface CareerTierInfo {
  readonly level: CareerTierLevel;
  readonly name: string;
  readonly shortName: string;
  readonly minMatches: number;
  readonly minReputation: number;
  readonly baseMatchFee: number;
  readonly incidentCount: number;
  readonly description: string;
}

/**
 * Overall career status.
 */
export type CareerStatus = "ACTIVE" | "COMPLETED" | "TERMINATED";

/**
 * Critical match moment classification for fan sentiment impact.
 */
export type CriticalMomentType =
  | "NORMAL"
  | "HAT_TRICK"
  | "MILESTONE"
  | "FINAL_OVER"
  | "MATCH_DECIDING"
  | "HIGH_PRESSURE";

/**
 * Match importance level.
 */
export type MatchImportance = "LOW" | "NORMAL" | "HIGH" | "CRITICAL";

/**
 * Lightweight player career profile.
 */
export interface CareerProfile {
  readonly id: string;
  money: number;
  careerTier: CareerTierLevel;
  matchesCompleted: number;
  totalDecisions: number;
  correctDecisions: number;
  fanScore: number;          // 0 - 100
  criticScore: number;       // 0 - 100
  integrityScore: number;    // 0 - 100
  investigationRisk: number; // 0 - 100
  currentLeague: string;
  currentSeason: number;
  careerStatus: CareerStatus;
}

/**
 * Match score context for background simulation.
 */
export interface MatchScoreboard {
  readonly homeTeamScore: string;
  readonly awayTeamScore: string;
  readonly currentInnings: 1 | 2;
  readonly currentOver: number;
  readonly currentBall: number;
  readonly targetRuns?: number;
  readonly runsRequired?: number;
  readonly ballsRemaining?: number;
  readonly projectedWinnerId: string;
}

/**
 * Career incident context linking physical DRS scenario to league macro state.
 */
export interface CareerIncident {
  readonly id: string;
  readonly incidentIndex: number;
  readonly scenario: Scenario;
  readonly criticalMoment: CriticalMomentType;
  readonly momentDescription: string;
  readonly battingTeamId: string;
  readonly bowlingTeamId: string;
  readonly batterName: string;
  readonly bowlerName: string;
  readonly overNumber: number;
  readonly ballInOver: number;
  readonly matchPressure: "LOW" | "MODERATE" | "INTENSE";
}

/**
 * Match assignment presented to player in Career Dashboard.
 */
export interface CareerMatchAssignment {
  readonly matchId: string;
  readonly matchNumber: number;
  readonly homeTeam: Team;
  readonly awayTeam: Team;
  readonly venue: string;
  readonly leagueName: string;
  readonly tierLevel: CareerTierLevel;
  readonly matchImportance: MatchImportance;
  readonly matchFee: number;
  readonly incidentCount: number;
  readonly incidents: readonly CareerIncident[];
  readonly scoreboard: MatchScoreboard;
}

/**
 * Betting market for pre-match wagering.
 */
export interface BettingOdds {
  readonly teamId: string;
  readonly teamName: string;
  readonly oddsMultiplier: number; // e.g. 1.85
}

export interface BettingMarket {
  readonly matchId: string;
  readonly homeOdds: BettingOdds;
  readonly awayOdds: BettingOdds;
}

/**
 * Player's pre-match bet.
 */
export interface PreMatchBet {
  readonly matchId: string;
  readonly teamId: string;
  readonly teamName: string;
  readonly stake: number;
  readonly odds: number;
  readonly potentialPayout: number;
}

export interface BetResolution {
  readonly won: boolean;
  readonly stake: number;
  readonly netProfitOrLoss: number;
  readonly payout: number;
}

/**
 * Bribery offer received via mobile phone.
 */
export interface BribeOffer {
  readonly id: string;
  readonly matchId: string;
  readonly sender: string;
  readonly text: string;
  readonly targetTeamId: string;
  readonly targetTeamName: string;
  readonly bribeAmount: number;
  readonly status: "OFFERED" | "ACCEPTED" | "DECLINED" | "IGNORED";
}

/**
 * Active corruption contract following accepted bribe.
 */
export interface CorruptionContract {
  readonly offerId: string;
  readonly targetTeamId: string;
  readonly targetTeamName: string;
  readonly bribeAmount: number;
  fulfilled: boolean;
  benefitedDecisionScenarioId?: string;
}

export interface BribeResolution {
  readonly accepted: boolean;
  readonly fulfilled: boolean;
  readonly payout: number;
  readonly integrityDelta: number;
  readonly investigationRiskDelta: number;
}

/**
 * End-of-match investigation outcome.
 */
export type InvestigationOutcome = "NONE" | "UNDER_WATCH" | "FINED" | "CAUGHT";

export interface InvestigationCheckResult {
  readonly outcome: InvestigationOutcome;
  readonly penaltyAmount: number;
  readonly description: string;
}

/**
 * Individual adjudicated incident record in a career match.
 */
export interface CareerIncidentRecord {
  readonly incident: CareerIncident;
  readonly result: IncidentResult;
  readonly isCorrect: boolean;
  readonly fanDelta: number;
  readonly criticDelta: number;
  readonly corruptFavorAwarded: boolean;
}

/**
 * Comprehensive Match Report calculated at match completion.
 */
export interface CareerMatchReport {
  readonly matchId: string;
  readonly homeTeam: Team;
  readonly awayTeam: Team;
  readonly finalScoreHome: string;
  readonly finalScoreAway: string;
  readonly winnerTeamName: string;

  // Performance
  readonly totalIncidents: number;
  readonly correctDecisions: number;
  readonly accuracyPercent: number;
  readonly matchRating: number; // 0.0 - 10.0

  // Reputation Deltas
  readonly fanDelta: number;
  readonly criticDelta: number;
  readonly integrityDelta: number;
  readonly investigationRiskDelta: number;

  // Financial Breakdown
  readonly matchFee: number;
  readonly performanceBonus: number;
  readonly bettingNet: number;
  readonly bribeNet: number;
  readonly penaltyAmount: number;
  readonly totalEarningsNet: number;

  // Final updated totals
  readonly previousBalance: number;
  readonly newBalance: number;
  readonly careerWinAchieved: boolean;

  // Investigation & Integrity status
  readonly investigationOutcome: InvestigationOutcome;
  readonly investigationDescription: string;
  readonly careerTerminated: boolean;

  // Incident Records
  readonly records: readonly CareerIncidentRecord[];
}
