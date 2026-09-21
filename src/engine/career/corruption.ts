/**
 * src/engine/career/corruption.ts
 *
 * Bribery offers, corruption contracts, and investigation risk engine.
 * Governs illicit proposals, condition evaluation, and disciplinary checks.
 */

import type { Team } from "../../types/league";
import type {
  BribeOffer,
  CorruptionContract,
  BribeResolution,
  CareerIncident,
  InvestigationCheckResult,
  CareerTierLevel,
} from "../../types/career";
import type { DecisionVerdict } from "../../types/scenario";
import { SeededRandom } from "../scenarioGenerator";
import { CAREER_CONSTANTS } from "./careerConstants";

/**
 * Deterministically decides whether an illicit bribe offer is sent for a match,
 * and generates the offer details.
 */
export function generateBribeOffer(
  matchId: string,
  tierLevel: CareerTierLevel,
  homeTeam: Team,
  awayTeam: Team,
  matchSeed: number,
  forceOffer: boolean = false,
  matchNumber?: number
): BribeOffer | null {
  const diffusedSeed = (Math.imul(matchSeed ^ 0xbadc0de, 0x45d9f3b) ^ (matchSeed >>> 16)) >>> 0;
  const rng = new SeededRandom(diffusedSeed);
  const chance = CAREER_CONSTANTS.BRIBE_CONFIG.OFFER_CHANCE_BY_TIER[tierLevel] ?? 0.4;

  // Introductory match #1 guarantees an offer so the player experiences the core moral dilemma
  const isIntroductoryOffer = matchNumber === 1;

  if (!forceOffer && !isIntroductoryOffer && rng.next() > chance) {
    return null;
  }

  // Pick target team favored by the syndicate
  const targetTeam = rng.boolean(0.5) ? homeTeam : awayTeam;
  const baseAmount = CAREER_CONSTANTS.BRIBE_CONFIG.BASE_BRIBE_BY_TIER[tierLevel] ?? 35_000;
  // Variance: ±15%
  const bribeAmount = Math.round(baseAmount * (1 + rng.range(-0.15, 0.15)));

  const syndicates = [
    "International Syndicate",
    "Private Betting Syndicate",
    "An Anonymous Stakeholder",
    "Offshore Bookmaker",
    "Influential Franchise Patron",
  ];
  const sender = rng.pick(syndicates);

  return {
    id: `BRIBE-${matchId}-${rng.rangeInt(100, 999)}`,
    matchId,
    sender,
    text: `We have considerable exposure on ${targetTeam.name}. Ensure they get the benefit on a critical call today. ₹${bribeAmount.toLocaleString()} will be transferred to your offshore account.`,
    targetTeamId: targetTeam.id,
    targetTeamName: targetTeam.name,
    bribeAmount,
    status: "OFFERED",
  };
}

/**
 * Creates an active CorruptionContract when player accepts an illicit proposal.
 */
export function acceptBribeOffer(offer: BribeOffer): CorruptionContract {
  return {
    offerId: offer.id,
    targetTeamId: offer.targetTeamId,
    targetTeamName: offer.targetTeamName,
    bribeAmount: offer.bribeAmount,
    fulfilled: false,
  };
}

/**
 * Checks whether an umpire's decision constitutes a corrupt favor benefiting the target team.
 * A corrupt favor occurs when the player deliberately renders an INCORRECT decision
 * that confers an unfair advantage to the syndicate's target team:
 * - Target team is BATTING: true physical call is OUT, but player gives NOT_OUT (protects batter).
 * - Target team is BOWLING: true physical call is NOT_OUT, but player gives OUT (awards unfair wicket).
 */
export function evaluateCorruptDecision(
  contract: CorruptionContract,
  incident: CareerIncident,
  playerVerdict: DecisionVerdict | "SEND_UPSTAIRS"
): boolean {
  // An abstention / referral to on-field call is not a corrupt favor
  if (playerVerdict === "SEND_UPSTAIRS") {
    return false;
  }

  const physicalTruth = incident.scenario.correctFinalVerdict;
  const isCorrect = playerVerdict === physicalTruth;

  // A correct decision is never a corrupt favor
  if (isCorrect) {
    return false;
  }

  const isTargetBatting = incident.battingTeamId === contract.targetTeamId;
  const isTargetBowling = incident.bowlingTeamId === contract.targetTeamId;

  // 1. Target team is batting, physical truth was OUT, player saved them with NOT_OUT
  if (isTargetBatting && physicalTruth === "OUT" && playerVerdict === "NOT_OUT") {
    return true;
  }

  // 2. Target team is bowling, physical truth was NOT_OUT, player gave opponents OUT
  if (isTargetBowling && physicalTruth === "NOT_OUT" && playerVerdict === "OUT") {
    return true;
  }

  return false;
}

/**
 * Resolves an active corruption contract at match conclusion.
 */
export function resolveBribeContract(
  contract: CorruptionContract | null
): BribeResolution {
  if (!contract) {
    return {
      accepted: false,
      fulfilled: false,
      payout: 0,
      integrityDelta: 0,
      investigationRiskDelta: 0,
    };
  }

  if (contract.fulfilled) {
    return {
      accepted: true,
      fulfilled: true,
      payout: contract.bribeAmount,
      integrityDelta: CAREER_CONSTANTS.BRIBE_CONFIG.FULFILLED_INTEGRITY_PENALTY,
      investigationRiskDelta: CAREER_CONSTANTS.BRIBE_CONFIG.FULFILLED_RISK_BUMP,
    };
  }

  // Accepted but player stayed honest or opportunity did not arise
  return {
    accepted: true,
    fulfilled: false,
    payout: 0,
    integrityDelta: CAREER_CONSTANTS.BRIBE_CONFIG.ACCEPT_INTEGRITY_PENALTY,
    investigationRiskDelta: CAREER_CONSTANTS.BRIBE_CONFIG.ACCEPT_RISK_BUMP,
  };
}

/**
 * Performs the post-match integrity check and disciplinary investigation.
 */
export function performInvestigationCheck(
  integrityScore: number,
  investigationRisk: number,
  tierLevel: CareerTierLevel,
  matchSeed: number
): InvestigationCheckResult {
  if (investigationRisk <= 0) {
    return {
      outcome: "NONE",
      penaltyAmount: 0,
      description: "No integrity inquiries flagged. Conduct clean.",
    };
  }

  const rng = new SeededRandom(matchSeed ^ 0xac1d7e57);
  const roll = rng.range(0, 100);

  // If roll is higher than current investigation risk, player avoids scrutiny this match
  if (roll >= investigationRisk) {
    return {
      outcome: "NONE",
      penaltyAmount: 0,
      description: "Routine match audit completed without formal investigation.",
    };
  }

  // Investigation triggered!
  if (investigationRisk >= 65 || integrityScore < 30) {
    return {
      outcome: "CAUGHT",
      penaltyAmount: 0,
      description: "Anti-Corruption Unit sting uncovered undeniable pattern of suspicious verdicts. Immediate career revocation.",
    };
  }

  if (investigationRisk >= 40 || integrityScore < 60) {
    const tierFine = CAREER_CONSTANTS.INVESTIGATION.FINE_AMOUNT_BY_TIER[tierLevel] ?? 15_000;
    return {
      outcome: "FINED",
      penaltyAmount: tierFine,
      description: `Integrity committee flagged irregular decision patterns. Disciplinary fine of ₹${tierFine.toLocaleString()} assessed.`,
    };
  }

  return {
    outcome: "UNDER_WATCH",
    penaltyAmount: 0,
    description: "Official advisory issued by the Umpiring Standards Panel. Performance placed under enhanced surveillance.",
  };
}
