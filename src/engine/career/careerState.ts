/**
 * src/engine/career/careerState.ts
 *
 * Authoritative career session state, persistence, and post-match report consolidation.
 * Keeps DRS physics independent while handling money, reputation, and progression.
 */

import type {
  CareerProfile,
  CareerMatchAssignment,
  CareerIncidentRecord,
  CareerMatchReport,
  PreMatchBet,
  CorruptionContract,
} from "../../types/career";
import { CAREER_CONSTANTS, getTierInfo } from "./careerConstants";
import { clampScore, calculateMatchRating } from "./careerScoring";
import { resolveBet } from "./betting";
import {
  resolveBribeContract,
  performInvestigationCheck,
} from "./corruption";
import {
  evaluateTierProgression,
  checkCareerWinCondition,
  checkCareerTermination,
} from "./careerProgression";

/**
 * Creates a fresh, default career profile.
 */
export function createInitialCareerProfile(id: string = "UMP-001"): CareerProfile {
  return {
    id,
    money: CAREER_CONSTANTS.STARTING_BALANCE,
    careerTier: 1,
    matchesCompleted: 0,
    totalDecisions: 0,
    correctDecisions: 0,
    fanScore: CAREER_CONSTANTS.INITIAL_FAN_SCORE,
    criticScore: CAREER_CONSTANTS.INITIAL_CRITIC_SCORE,
    integrityScore: CAREER_CONSTANTS.INITIAL_INTEGRITY_SCORE,
    investigationRisk: CAREER_CONSTANTS.INITIAL_INVESTIGATION_RISK,
    currentLeague: CAREER_CONSTANTS.TIERS[1].name,
    currentSeason: 1,
    careerStatus: "ACTIVE",
  };
}

/**
 * Safely persists player profile to browser localStorage.
 */
export function saveCareerProfile(profile: CareerProfile): boolean {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(
        CAREER_CONSTANTS.STORAGE_KEY,
        JSON.stringify(profile)
      );
      return true;
    }
  } catch (err) {
    console.warn("Failed to persist career profile to localStorage:", err);
  }
  return false;
}

/**
 * Loads persisted career profile from localStorage, or initializes a new one.
 */
export function loadCareerProfile(): CareerProfile {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = window.localStorage.getItem(CAREER_CONSTANTS.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.money === "number" &&
          typeof parsed.careerTier === "number" &&
          typeof parsed.fanScore === "number" &&
          typeof parsed.criticScore === "number"
        ) {
          return parsed as CareerProfile;
        }
      }
    }
  } catch (err) {
    console.warn("Failed to parse stored career profile, starting fresh:", err);
  }
  return createInitialCareerProfile();
}

/**
 * Clears saved career profile and returns a fresh starting profile.
 */
export function resetCareerProfile(): CareerProfile {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(CAREER_CONSTANTS.STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Failed to clear localStorage career profile:", err);
  }
  return createInitialCareerProfile();
}

/**
 * Consolidates all match events, wagers, corruption contracts, and decisions
 * into an authoritative Match Report.
 */
export function computeCareerMatchReport(
  assignment: CareerMatchAssignment,
  records: readonly CareerIncidentRecord[],
  bet: PreMatchBet | null,
  bribeContract: CorruptionContract | null,
  profile: CareerProfile,
  matchSeed: number = 42
): CareerMatchReport {
  const totalIncidents = records.length;
  const correctDecisions = records.filter((r) => r.isCorrect).length;
  const accuracyPercent =
    totalIncidents > 0 ? Math.round((correctDecisions / totalIncidents) * 100) : 100;

  // Reputation deltas
  const fanDelta = records.reduce((acc, r) => acc + r.fanDelta, 0);
  const criticDelta = records.reduce((acc, r) => acc + r.criticDelta, 0);

  const difficultHandled = records.filter(
    (r) => r.incident.scenario.difficultyTier !== "CLEAR" && r.isCorrect
  ).length;
  const criticalHandled = records.filter(
    (r) => r.incident.criticalMoment !== "NORMAL" && r.isCorrect
  ).length;

  const matchRating = calculateMatchRating(
    totalIncidents,
    correctDecisions,
    difficultHandled,
    criticalHandled
  );

  // Performance Bonus
  let performanceBonus = 0;
  if (accuracyPercent === 100 && totalIncidents > 0) {
    performanceBonus = Math.round(
      assignment.matchFee * CAREER_CONSTANTS.BONUSES.PERFECT_ACCURACY_BONUS_MULTIPLIER
    );
  } else if (accuracyPercent >= 85) {
    performanceBonus = Math.round(
      assignment.matchFee * CAREER_CONSTANTS.BONUSES.HIGH_ACCURACY_BONUS_MULTIPLIER
    );
  }

  // Betting outcome
  const betRes = bet
    ? resolveBet(bet, assignment.scoreboard.projectedWinnerId)
    : { won: false, stake: 0, payout: 0, netProfitOrLoss: 0 };
  const bettingNet = betRes.netProfitOrLoss;

  // Bribe outcome
  const bribeRes = resolveBribeContract(bribeContract);
  const bribeNet = bribeRes.payout;

  // Clean match recovery if no illicit bribe fulfilled
  const cleanMatchBonus =
    !bribeRes.fulfilled && !bribeRes.accepted
      ? CAREER_CONSTANTS.BRIBE_CONFIG.CLEAN_MATCH_INTEGRITY_RECOVERY
      : 0;
  const cleanMatchRiskDecay =
    !bribeRes.fulfilled && !bribeRes.accepted
      ? CAREER_CONSTANTS.BRIBE_CONFIG.CLEAN_MATCH_RISK_DECAY
      : 0;

  const integrityDelta = bribeRes.integrityDelta + cleanMatchBonus;
  const investigationRiskDelta = bribeRes.investigationRiskDelta - cleanMatchRiskDecay;

  // Predicted post-match risk for investigation check
  const projectedRisk = clampScore(profile.investigationRisk + investigationRiskDelta);
  const projectedIntegrity = clampScore(profile.integrityScore + integrityDelta);

  // Investigation outcome
  const investigationCheck = performInvestigationCheck(
    projectedIntegrity,
    projectedRisk,
    assignment.tierLevel,
    matchSeed
  );

  const penaltyAmount = investigationCheck.penaltyAmount;
  const totalEarningsNet =
    assignment.matchFee + performanceBonus + bettingNet + bribeNet - penaltyAmount;

  const previousBalance = profile.money;
  const newBalance = Math.max(0, previousBalance + totalEarningsNet);

  const careerWinAchieved = checkCareerWinCondition(newBalance);
  const careerTerminated = checkCareerTermination(investigationCheck.outcome);

  const winnerName =
    assignment.scoreboard.projectedWinnerId === assignment.homeTeam.id
      ? assignment.homeTeam.name
      : assignment.awayTeam.name;

  return {
    matchId: assignment.matchId,
    homeTeam: assignment.homeTeam,
    awayTeam: assignment.awayTeam,
    finalScoreHome: assignment.scoreboard.homeTeamScore,
    finalScoreAway: assignment.scoreboard.awayTeamScore,
    winnerTeamName: winnerName,

    totalIncidents,
    correctDecisions,
    accuracyPercent,
    matchRating,

    fanDelta,
    criticDelta,
    integrityDelta,
    investigationRiskDelta,

    matchFee: assignment.matchFee,
    performanceBonus,
    bettingNet,
    bribeNet,
    penaltyAmount,
    totalEarningsNet,

    previousBalance,
    newBalance,
    careerWinAchieved,

    investigationOutcome: investigationCheck.outcome,
    investigationDescription: investigationCheck.description,
    careerTerminated,

    records,
  };
}

/**
 * Applies the Match Report findings to the player's profile and checks for promotions.
 */
export function applyCareerMatchReport(
  profile: CareerProfile,
  report: CareerMatchReport
): CareerProfile {
  const updatedMatches = profile.matchesCompleted + 1;
  const updatedTotalDecisions = profile.totalDecisions + report.totalIncidents;
  const updatedCorrectDecisions = profile.correctDecisions + report.correctDecisions;

  const updatedFan = clampScore(profile.fanScore + report.fanDelta);
  const updatedCritic = clampScore(profile.criticScore + report.criticDelta);
  const updatedIntegrity = clampScore(profile.integrityScore + report.integrityDelta);
  const updatedRisk = clampScore(profile.investigationRisk + report.investigationRiskDelta);

  let updatedStatus = profile.careerStatus;
  if (report.careerTerminated) {
    updatedStatus = "TERMINATED";
  } else if (report.careerWinAchieved) {
    updatedStatus = "COMPLETED";
  }

  // Check promotion
  const promotion = evaluateTierProgression(
    updatedMatches,
    updatedFan,
    updatedCritic,
    profile.careerTier
  );

  const newTier = promotion.promoted ? promotion.newTier : profile.careerTier;
  const tierInfo = getTierInfo(newTier);

  const updatedProfile: CareerProfile = {
    ...profile,
    money: report.newBalance,
    careerTier: newTier,
    matchesCompleted: updatedMatches,
    totalDecisions: updatedTotalDecisions,
    correctDecisions: updatedCorrectDecisions,
    fanScore: updatedFan,
    criticScore: updatedCritic,
    integrityScore: updatedIntegrity,
    investigationRisk: updatedRisk,
    currentLeague: tierInfo.name,
    careerStatus: updatedStatus,
  };

  saveCareerProfile(updatedProfile);
  return updatedProfile;
}
