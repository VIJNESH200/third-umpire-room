/**
 * src/tests/career.test.ts
 *
 * Comprehensive test suite for League Umpire Career Mode.
 *
 * Verifies:
 * 1. Career state initialization, balance targets, win condition, and termination.
 * 2. Deterministic match generation, fictional teams, scoreboard simulation, and incident generation.
 * 3. Fan and critic sentiment dynamics across critical moments and difficulty tiers.
 * 4. Pre-match sports betting: odds generation, validation, winning payout, and loss resolution.
 * 5. Bribery & corruption: offer creation, acceptance/decline, corrupt favor detection, contract resolution,
 *    and ability to stay honest after accepting.
 * 6. Career progression: threshold promotions, balance carry-forward, and match report consolidation.
 * 7. End-to-end integration with DRS physics and ThirdUmpireGameSession review loop.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  createInitialCareerProfile,
  computeCareerMatchReport,
  applyCareerMatchReport,
} from "../engine/career/careerState";
import {
  CAREER_CONSTANTS,
} from "../engine/career/careerConstants";
import {
  calculateFanImpact,
  calculateCriticImpact,
  calculateMatchRating,
} from "../engine/career/careerScoring";
import {
  generateBettingMarket,
  validateBet,
  createPreMatchBet,
  resolveBet,
} from "../engine/career/betting";
import {
  generateBribeOffer,
  acceptBribeOffer,
  evaluateCorruptDecision,
  resolveBribeContract,
  performInvestigationCheck,
} from "../engine/career/corruption";
import {
  generateMatchAssignment,
  CAREER_TEAMS,
} from "../engine/career/matchGenerator";
import {
  evaluateTierProgression,
  checkCareerWinCondition,
  checkCareerTermination,
} from "../engine/career/careerProgression";
import { ThirdUmpireGameSession } from "../engine/thirdUmpireGameSession";
import type { CareerIncidentRecord } from "../types/career";

describe("League Umpire Career Mode Test Suite", () => {
  // ==========================================================================
  // Group 1: Career Profile & Victory / Termination Invariants
  // ==========================================================================
  describe("Group 1: Career Profile & Life Cycle", () => {
    it("C1.1: new career starts with correct default values and balance", () => {
      const profile = createInitialCareerProfile("TEST-UMP");
      assert.equal(profile.id, "TEST-UMP");
      assert.equal(profile.money, CAREER_CONSTANTS.STARTING_BALANCE);
      assert.equal(profile.careerTier, 1);
      assert.equal(profile.matchesCompleted, 0);
      assert.equal(profile.fanScore, CAREER_CONSTANTS.INITIAL_FAN_SCORE);
      assert.equal(profile.criticScore, CAREER_CONSTANTS.INITIAL_CRITIC_SCORE);
      assert.equal(profile.integrityScore, CAREER_CONSTANTS.INITIAL_INTEGRITY_SCORE);
      assert.equal(profile.investigationRisk, CAREER_CONSTANTS.INITIAL_INVESTIGATION_RISK);
      assert.equal(profile.careerStatus, "ACTIVE");
    });

    it("C1.2: correctly detects ₹1,000,000 career win condition", () => {
      assert.equal(checkCareerWinCondition(999_999), false);
      assert.equal(checkCareerWinCondition(1_000_000), true);
      assert.equal(checkCareerWinCondition(1_250_000), true);
    });

    it("C1.3: correctly detects career termination when caught", () => {
      assert.equal(checkCareerTermination("NONE"), false);
      assert.equal(checkCareerTermination("UNDER_WATCH"), false);
      assert.equal(checkCareerTermination("FINED"), false);
      assert.equal(checkCareerTermination("CAUGHT"), true);
    });
  });

  // ==========================================================================
  // Group 2: Match Generation & Incidents
  // ==========================================================================
  describe("Group 2: Deterministic Match & Incident Generation", () => {
    it("C2.1: generates valid match assignments with distinct fictional teams", () => {
      const match = generateMatchAssignment(1, 1, 99);
      assert.ok(match.matchId.startsWith("MATCH-"));
      assert.notEqual(match.homeTeam.id, match.awayTeam.id);
      assert.ok(match.matchFee >= 4_500 && match.matchFee <= 5_500);
      assert.equal(match.incidentCount, 6);
      assert.equal(match.incidents.length, 6);
      assert.ok(match.scoreboard.projectedWinnerId);
    });

    it("C2.2: identical seeds produce strictly identical match assignments", () => {
      const matchA = generateMatchAssignment(2, 5, 8888);
      const matchB = generateMatchAssignment(2, 5, 8888);

      assert.equal(matchA.homeTeam.id, matchB.homeTeam.id);
      assert.equal(matchA.awayTeam.id, matchB.awayTeam.id);
      assert.equal(matchA.matchFee, matchB.matchFee);
      assert.equal(matchA.incidents.length, matchB.incidents.length);

      for (let i = 0; i < matchA.incidents.length; i++) {
        assert.equal(matchA.incidents[i].id, matchB.incidents[i].id);
        assert.equal(
          matchA.incidents[i].scenario.correctFinalVerdict,
          matchB.incidents[i].scenario.correctFinalVerdict
        );
      }
    });

    it("C2.3: higher tier matches provide higher match fees and incident quotas", () => {
      const tier1Match = generateMatchAssignment(1, 1, 10);
      const tier3Match = generateMatchAssignment(3, 1, 10);
      const tier5Match = generateMatchAssignment(5, 1, 10);

      assert.ok(tier3Match.matchFee > tier1Match.matchFee);
      assert.ok(tier5Match.matchFee > tier3Match.matchFee);
      assert.equal(tier1Match.incidentCount, 6);
      assert.equal(tier3Match.incidentCount, 8);
      assert.equal(tier5Match.incidentCount, 8);
    });
  });

  // ==========================================================================
  // Group 3: Reputation Systems (Fans, Critics, Match Rating)
  // ==========================================================================
  describe("Group 3: Reputation Mechanics", () => {
    it("C3.1: fan sentiment changes more sharply on critical moments than normal moments", () => {
      const correctNormal = calculateFanImpact(true, "NORMAL", "NORMAL");
      const correctCritical = calculateFanImpact(true, "FINAL_OVER", "NORMAL");
      const wrongNormal = calculateFanImpact(false, "NORMAL", "NORMAL");
      const wrongCritical = calculateFanImpact(false, "FINAL_OVER", "NORMAL");

      assert.ok(correctCritical > correctNormal, "Critical correct should boost fans more than normal correct");
      assert.ok(wrongCritical < wrongNormal, "Critical wrong should drop fans far more than normal wrong");
      assert.ok(correctNormal > 0);
      assert.ok(wrongNormal < 0);
    });

    it("C3.2: critic sentiment scales by technical difficulty", () => {
      const correctClear = calculateCriticImpact(true, "CLEAR");
      const correctMarginal = calculateCriticImpact(true, "MARGINAL");
      const correctHowler = calculateCriticImpact(true, "HOWLER");

      assert.ok(correctMarginal > correctClear, "Marginal correct must award more critic praise than obvious clear call");
      assert.ok(correctHowler > correctMarginal, "Howler overturn must award highest critic praise");

      const wrongClear = calculateCriticImpact(false, "CLEAR");
      const wrongMarginal = calculateCriticImpact(false, "MARGINAL");
      assert.ok(wrongClear < wrongMarginal, "Obvious clear blunder must penalize critics more heavily than marginal 50-50 call");
    });

    it("C3.3: match rating combines accuracy, difficulty, and high pressure execution", () => {
      const ratingFlawless = calculateMatchRating(8, 8, 4, 3);
      const ratingMediocre = calculateMatchRating(8, 4, 2, 1);
      const ratingPoor = calculateMatchRating(8, 2, 0, 0);

      assert.ok(ratingFlawless >= 9.0);
      assert.ok(ratingMediocre >= 4.0 && ratingMediocre <= 6.5);
      assert.ok(ratingPoor < 3.5);
    });
  });

  // ==========================================================================
  // Group 4: Pre-Match Sports Betting
  // ==========================================================================
  describe("Group 4: Pre-Match Betting System", () => {
    it("C4.1: generates valid betting market with reasonable odds for both teams", () => {
      const homeTeam = CAREER_TEAMS[0];
      const awayTeam = CAREER_TEAMS[1];
      const market = generateBettingMarket("M-01", homeTeam, awayTeam, 100);

      assert.equal(market.homeOdds.teamId, homeTeam.id);
      assert.equal(market.awayOdds.teamId, awayTeam.id);
      assert.ok(market.homeOdds.oddsMultiplier >= 1.5 && market.homeOdds.oddsMultiplier <= 2.8);
      assert.ok(market.awayOdds.oddsMultiplier >= 1.5 && market.awayOdds.oddsMultiplier <= 2.8);
    });

    it("C4.2: validates bet amount against minimum and current player balance", () => {
      const balance = 10_000;
      assert.equal(validateBet(200, balance).valid, false, "Bet below min amount (₹500) must be rejected");
      assert.equal(validateBet(15_000, balance).valid, false, "Bet exceeding player balance must be rejected");
      assert.equal(validateBet(-500, balance).valid, false, "Negative bet must be rejected");
      assert.equal(validateBet(5_000, balance).valid, true, "Valid bet within bounds must be accepted");
    });

    it("C4.3: resolves winning bet with payout and net profit", () => {
      const bet = createPreMatchBet("M-01", "FRAN_MUM", "Mumbai Mariners", 2_000, 2.10);
      const resolution = resolveBet(bet, "FRAN_MUM");

      assert.equal(resolution.won, true);
      assert.equal(resolution.stake, 2_000);
      assert.equal(resolution.payout, 4_200);
      assert.equal(resolution.netProfitOrLoss, 2_200);
    });

    it("C4.4: resolves losing bet with 0 payout and negative net loss", () => {
      const bet = createPreMatchBet("M-01", "FRAN_MUM", "Mumbai Mariners", 2_000, 2.10);
      const resolution = resolveBet(bet, "FRAN_DEL");

      assert.equal(resolution.won, false);
      assert.equal(resolution.payout, 0);
      assert.equal(resolution.netProfitOrLoss, -2_000);
    });
  });

  // ==========================================================================
  // Group 5: Bribery, Corruption & Investigation Risk
  // ==========================================================================
  describe("Group 5: Bribery & Corruption System", () => {
    it("C5.1: generates bribe offer and allows acceptance into active contract", () => {
      const homeTeam = CAREER_TEAMS[0];
      const awayTeam = CAREER_TEAMS[1];
      const offer = generateBribeOffer("M-01", 2, homeTeam, awayTeam, 102);

      if (offer) {
        assert.ok(offer.bribeAmount >= 25_000);
        assert.ok(offer.targetTeamId === homeTeam.id || offer.targetTeamId === awayTeam.id);

        const contract = acceptBribeOffer(offer);
        assert.equal(contract.offerId, offer.id);
        assert.equal(contract.targetTeamId, offer.targetTeamId);
        assert.equal(contract.fulfilled, false);
      }
    });

    it("C5.2: detects corrupt favor when umpire renders wrong decision benefiting target team", () => {
      const targetTeamId = "FRAN_MUM";
      const otherTeamId = "FRAN_DEL";
      const contract = {
        offerId: "O-1",
        targetTeamId,
        targetTeamName: "Mumbai",
        bribeAmount: 35_000,
        fulfilled: false,
      };

      // Mock incident where target team is BATTING, physical truth is OUT (LBW), but umpire rules NOT_OUT
      const incidentBatting = {
        id: "INC-1",
        incidentIndex: 0,
        criticalMoment: "NORMAL" as const,
        momentDescription: "test",
        battingTeamId: targetTeamId,
        bowlingTeamId: otherTeamId,
        batterName: "Batter",
        bowlerName: "Bowler",
        overNumber: 5,
        ballInOver: 2,
        matchPressure: "LOW" as const,
        scenario: {
          correctFinalVerdict: "OUT" as const,
        } as any,
      };

      const isCorrupt = evaluateCorruptDecision(contract, incidentBatting, "NOT_OUT");
      assert.equal(isCorrupt, true, "Deliberately saving target team's batter with wrong NOT_OUT is corrupt favor");

      const honestCall = evaluateCorruptDecision(contract, incidentBatting, "OUT");
      assert.equal(honestCall, false, "Correct OUT verdict is never a corrupt favor");
    });

    it("C5.3: player can accept bribe and still make correct decisions without fulfilling corruption", () => {
      const contract = {
        offerId: "O-2",
        targetTeamId: "FRAN_MUM",
        targetTeamName: "Mumbai",
        bribeAmount: 35_000,
        fulfilled: false, // Player stayed honest!
      };

      const resolution = resolveBribeContract(contract);
      assert.equal(resolution.accepted, true);
      assert.equal(resolution.fulfilled, false);
      assert.equal(resolution.payout, 0, "No payout received if condition not fulfilled");
      assert.equal(resolution.integrityDelta, CAREER_CONSTANTS.BRIBE_CONFIG.ACCEPT_INTEGRITY_PENALTY);
      assert.equal(resolution.investigationRiskDelta, CAREER_CONSTANTS.BRIBE_CONFIG.ACCEPT_RISK_BUMP);
    });

    it("C5.4: fulfilled bribe awards payout but heavily damages integrity and spikes risk", () => {
      const contract = {
        offerId: "O-3",
        targetTeamId: "FRAN_MUM",
        targetTeamName: "Mumbai",
        bribeAmount: 40_000,
        fulfilled: true,
      };

      const resolution = resolveBribeContract(contract);
      assert.equal(resolution.fulfilled, true);
      assert.equal(resolution.payout, 40_000);
      assert.equal(resolution.integrityDelta, CAREER_CONSTANTS.BRIBE_CONFIG.FULFILLED_INTEGRITY_PENALTY);
      assert.equal(resolution.investigationRiskDelta, CAREER_CONSTANTS.BRIBE_CONFIG.FULFILLED_RISK_BUMP);
    });

    it("C5.5: investigation check triggers CAUGHT when risk is dangerously high", () => {
      // Very high risk (80%) and low integrity
      const result = performInvestigationCheck(20, 85, 2, 1);
      assert.equal(result.outcome, "CAUGHT");
    });
  });

  // ==========================================================================
  // Group 6: Career Progression & Match Report Consolidation
  // ==========================================================================
  describe("Group 6: Career Progression & Report Consolidation", () => {
    it("C6.1: promotes umpire to higher tier when matches and reputation criteria are met", () => {
      // Tier 1 -> Tier 2 requires 2 matches and 45 avg rep
      const resultNotReady = evaluateTierProgression(1, 60, 60, 1);
      assert.equal(resultNotReady.promoted, false);

      const resultReady = evaluateTierProgression(3, 55, 55, 1);
      assert.equal(resultReady.promoted, true);
      assert.equal(resultReady.newTier, 2);
    });

    it("C6.2: consolidates full match report and updates profile correctly", () => {
      const profile = createInitialCareerProfile("UMP-PRO");
      const match = generateMatchAssignment(1, 1, 42);

      // Create fake incident records (all correct)
      const records: CareerIncidentRecord[] = match.incidents.map((inc) => ({
        incident: inc,
        result: {
          scenarioId: inc.scenario.id,
          finalVerdict: inc.scenario.correctFinalVerdict,
          finalVerdictCorrect: true,
        } as any,
        isCorrect: true,
        fanDelta: 4,
        criticDelta: 5,
        corruptFavorAwarded: false,
      }));

      const report = computeCareerMatchReport(match, records, null, null, profile, 42);

      assert.equal(report.totalIncidents, 6);
      assert.equal(report.correctDecisions, 6);
      assert.equal(report.accuracyPercent, 100);
      assert.ok(report.performanceBonus > 0, "100% accuracy should award performance bonus");
      assert.ok(report.totalEarningsNet > match.matchFee);

      const updatedProfile = applyCareerMatchReport(profile, report);
      assert.equal(updatedProfile.matchesCompleted, 1);
      assert.equal(updatedProfile.totalDecisions, 6);
      assert.equal(updatedProfile.correctDecisions, 6);
      assert.equal(updatedProfile.money, report.newBalance);
      assert.ok(updatedProfile.fanScore > profile.fanScore);
      assert.ok(updatedProfile.criticScore > profile.criticScore);
    });
  });

  // ==========================================================================
  // Group 7: DRS Vertical Slice Integration Invariants
  // ==========================================================================
  describe("Group 7: DRS Engine & LBW Vertical Slice Integration", () => {
    it("C7.1: match incidents plug directly into ThirdUmpireGameSession and execute valid LBW review", () => {
      const match = generateMatchAssignment(1, 1, 777);
      const scenarios = match.incidents.map((inc) => inc.scenario);

      const session = new ThirdUmpireGameSession(scenarios, 777);
      assert.equal(session.totalIncidents, match.incidentCount);
      assert.equal(session.getStage(), "INCIDENT_INTRO");

      // Advance to review active
      session.advanceToOnFieldDecision();
      session.initiateReview();
      session.enterWorkstation();
      assert.equal(session.getStage(), "REVIEW_ACTIVE");

      const curScenario = session.getCurrentScenario();
      assert.ok(curScenario);
      assert.equal(curScenario.incidentType, "LBW");
      assert.ok(curScenario.lbw, "LBW data must be present");

      // Submit physical truth
      const result = session.submitVerdict(curScenario.correctFinalVerdict);
      assert.ok(result);
      assert.equal(result.finalVerdictCorrect, true);
      assert.equal(session.getStage(), "RESULT_REVEAL");
    });
  });
});
