/**
 * src/tests/thirdUmpireGameplayLoop.test.ts
 *
 * Comprehensive behavioral test suite for the Third Umpire Room foundation
 * and complete LBW / DRS vertical slice.
 *
 * Covers:
 * 1. Match context loading and display data integrity.
 * 2. On-field decision support (OUT & NOT OUT) and bi-directional overturn capability.
 * 3. Review eligibility rules and quota enforcement (blocking team review at 0 reviews; umpire referral exemption).
 * 4. DRS workstation stage progression (INTRO -> ON_FIELD -> ENTRY -> ACTIVE -> RESULT -> NEXT).
 * 5. Player verdict choices (OUT, NOT OUT, SEND UPSTAIRS).
 * 6. Once-only decision submission immutability (idempotency, protection against double penalty).
 * 7. Official result computation (accurate distinction between canonical overturn vs upheld, and player correctness).
 * 8. ICC DRS review deduction and retention rules across successful, unsuccessful, and Umpire's Call reviews.
 * 9. Clean next incident transitions (state reset while carrying forward quotas and match history).
 * 10. Deterministic scenario progression and compatibility with Real Match mode.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ThirdUmpireGameSession, calculateIncidentScore } from "../engine/thirdUmpireGameSession";
import { generateScenario } from "../engine/scenarioGenerator";
import { RealMatchGameSession } from "../engine/realMatchGameSession";
import { T20_WC_2024_FINAL } from "../data/realMatches/t20Wc2024Final";
import type { Scenario, IncidentResult } from "../types/scenario";

describe("Third Umpire Gameplay Loop & LBW Vertical Slice", () => {
  // --------------------------------------------------------------------------
  // Group 1: Match Context Loading & Presentation Integrity
  // --------------------------------------------------------------------------
  describe("Group 1: Match Context Loading & Presentation Integrity", () => {
    it("T1.1: initializes session with valid match context and 2-2 review quota", () => {
      const session = new ThirdUmpireGameSession(5, 42, { forcedType: "LBW" });
      assert.equal(session.totalIncidents, 5);
      assert.equal(session.getCurrentIndex(), 0);
      assert.equal(session.getStage(), "INCIDENT_INTRO");

      const quota = session.getRemainingReviews();
      assert.equal(quota.batting, 2, "Batting side must start with 2 reviews");
      assert.equal(quota.bowling, 2, "Bowling side must start with 2 reviews");

      const scenario = session.getCurrentScenario();
      assert.ok(scenario, "Current scenario should be loaded");
      assert.equal(scenario.incidentType, "LBW");
      assert.ok(scenario.matchContext.battingTeam, "Batting team name must be present");
      assert.ok(scenario.matchContext.bowlingTeam, "Bowling team name must be present");
      assert.ok(scenario.matchContext.batter, "Batter name must be present");
      assert.ok(scenario.matchContext.bowler, "Bowler name must be present");
      assert.ok(typeof scenario.matchContext.over === "number", "Over number must be numeric");
    });

    it("T1.2: deterministic seed generation guarantees identical scenarios across instances", () => {
      const sessionA = new ThirdUmpireGameSession(4, 12345, { forcedType: "LBW" });
      const sessionB = new ThirdUmpireGameSession(4, 12345, { forcedType: "LBW" });

      for (let i = 0; i < 4; i++) {
        const scA = sessionA.getCurrentScenario();
        const scB = sessionB.getCurrentScenario();
        assert.ok(scA && scB);
        assert.equal(scA.id, scB.id, `Scenario ID mismatch at index ${i}`);
        assert.equal(scA.onFieldSignal, scB.onFieldSignal, `On-field signal mismatch at index ${i}`);
        assert.equal(scA.correctFinalVerdict, scB.correctFinalVerdict, `Physical truth mismatch at index ${i}`);
        sessionA.nextIncident();
        sessionB.nextIncident();
      }
    });
  });

  // --------------------------------------------------------------------------
  // Group 2: Review Eligibility & Quota Enforcement Rules
  // --------------------------------------------------------------------------
  describe("Group 2: Review Eligibility & Quota Enforcement Rules", () => {
    it("T2.1: team review for on-field NOT OUT identifies bowling side and checks bowling quota", () => {
      // Seed 18 produces onFieldSignal = NOT_OUT
      const scenario = generateScenario(18, "LBW");
      assert.equal(scenario.onFieldSignal, "NOT_OUT");

      const session = new ThirdUmpireGameSession([scenario], 18, {
        startingReviews: { batting: 2, bowling: 1 },
      });

      const elig = session.getReviewEligibility();
      assert.equal(elig.isTeamReview, true);
      assert.equal(elig.reviewingSide, "BOWLING");
      assert.equal(elig.quotaAvailable, 1);
      assert.equal(elig.canReview, true);
    });

    it("T2.2: team review for on-field OUT identifies batting side and checks batting quota", () => {
      // Seed 1 produces onFieldSignal = OUT
      const scenario = generateScenario(1, "LBW");
      assert.equal(scenario.onFieldSignal, "OUT");

      const session = new ThirdUmpireGameSession([scenario], 1, {
        startingReviews: { batting: 1, bowling: 2 },
      });

      const elig = session.getReviewEligibility();
      assert.equal(elig.isTeamReview, true);
      assert.equal(elig.reviewingSide, "BATTING");
      assert.equal(elig.quotaAvailable, 1);
      assert.equal(elig.canReview, true);
    });

    it("T2.3: zero quota strictly blocks team review request", () => {
      const scenarioNotOut = generateScenario(18, "LBW"); // On-field NOT_OUT -> bowling side reviews
      const sessionA = new ThirdUmpireGameSession([scenarioNotOut], 18, {
        startingReviews: { batting: 2, bowling: 0 },
      });

      const eligA = sessionA.getReviewEligibility();
      assert.equal(eligA.canReview, false, "Bowling team with 0 quota must be blocked from review");
      assert.equal(sessionA.initiateReview(), false, "initiateReview must return false when quota is 0");

      const scenarioOut = generateScenario(1, "LBW"); // On-field OUT -> batting side reviews
      const sessionB = new ThirdUmpireGameSession([scenarioOut], 1, {
        startingReviews: { batting: 0, bowling: 2 },
      });

      const eligB = sessionB.getReviewEligibility();
      assert.equal(eligB.canReview, false, "Batting team with 0 quota must be blocked from review");
      assert.equal(sessionB.initiateReview(), false, "initiateReview must return false when batting quota is 0");
    });

    it("T2.4: direct umpire referrals (Run Out, Stumping, Boundary) are exempt from team quota", () => {
      const runOutScenario = generateScenario(5, "RUN_OUT");
      assert.equal(runOutScenario.onFieldSignal, "REFERRED");

      const session = new ThirdUmpireGameSession([runOutScenario], 5, {
        startingReviews: { batting: 0, bowling: 0 },
      });

      const elig = session.getReviewEligibility();
      assert.equal(elig.isTeamReview, false);
      assert.equal(elig.reviewingSide, "UMPIRE");
      assert.equal(elig.canReview, true, "Umpire referrals are always eligible regardless of team quotas");
      assert.equal(session.initiateReview(), true);
    });

    it("T2.5: blocked review when side has 0 quota upholds on-field call without negative quota deduction", () => {
      const scenario = generateScenario(18, "LBW"); // onField NOT_OUT, bowling team reviews
      const session = new ThirdUmpireGameSession([scenario], 18, {
        startingReviews: { batting: 2, bowling: 0 },
      });

      assert.equal(session.getReviewEligibility().canReview, false);
      const result = session.submitVerdict("OUT", { isReviewBlocked: true });
      assert.ok(result);
      assert.equal(result.isReviewBlocked, true);
      assert.equal(result.finalVerdict, "NOT_OUT", "On-field call stands when review is blocked");
      assert.equal(result.scoreEarned, 0);
      assert.equal(session.getRemainingReviews().bowling, 0, "Quota must remain 0 and never go negative");
    });
  });

  // --------------------------------------------------------------------------
  // Group 3: Workflow State Machine Transitions
  // --------------------------------------------------------------------------
  describe("Group 3: Workflow State Machine Transitions", () => {
    it("T3.1: correctly advances through INTRO -> ON_FIELD -> ENTRY -> ACTIVE", () => {
      const session = new ThirdUmpireGameSession(1, 100, { forcedType: "LBW" });
      assert.equal(session.getStage(), "INCIDENT_INTRO");

      assert.equal(session.advanceToOnFieldDecision(), true);
      assert.equal(session.getStage(), "ON_FIELD_DECISION");

      assert.equal(session.initiateReview(), true);
      assert.equal(session.getStage(), "REVIEW_ENTRY");

      assert.equal(session.enterWorkstation(), true);
      assert.equal(session.getStage(), "REVIEW_ACTIVE");
    });

    it("T3.2: blocks invalid transitions out of sequence", () => {
      const session = new ThirdUmpireGameSession(1, 100, { forcedType: "LBW" });
      assert.equal(session.getStage(), "INCIDENT_INTRO");

      // Cannot advance to ON_FIELD if already in ON_FIELD
      session.advanceToOnFieldDecision();
      assert.equal(session.advanceToOnFieldDecision(), false);
    });

    it("T3.3: correctly advances from RESULT_REVEAL to CONSEQUENCE via advanceToConsequence()", () => {
      const session = new ThirdUmpireGameSession(1, 100, { forcedType: "LBW" });
      session.enterWorkstation();
      session.submitVerdict("OUT");
      assert.equal(session.getStage(), "RESULT_REVEAL");

      assert.equal(session.advanceToConsequence(), true);
      assert.equal(session.getStage(), "CONSEQUENCE");

      // Cannot advance to CONSEQUENCE again
      assert.equal(session.advanceToConsequence(), false);
    });
  });

  // --------------------------------------------------------------------------
  // Group 4: Verdict Submission, Overturns, and Once-Only Immutability
  // --------------------------------------------------------------------------
  describe("Group 4: Verdict Submission, Overturns, and Once-Only Immutability", () => {
    it("T4.1: Case 1 - On-field NOT OUT overturned to OUT (bowling review successful, quota retained)", () => {
      // Seed 18: onField = NOT_OUT, physical truth = OUT
      const scenario = generateScenario(18, "LBW");
      assert.equal(scenario.onFieldSignal, "NOT_OUT");
      assert.equal(scenario.correctFinalVerdict, "OUT");

      const session = new ThirdUmpireGameSession([scenario], 18);
      session.enterWorkstation();

      // Third Umpire rules OUT
      const result = session.submitVerdict("OUT");
      assert.ok(result);
      assert.equal(result.finalVerdict, "OUT");
      assert.equal(result.finalVerdictCorrect, true);
      assert.equal(session.getStage(), "RESULT_REVEAL");

      const history = session.getDecisionsHistory();
      assert.equal(history.length, 1);
      assert.equal(history[0].isOverturn, true, "Decision must be flagged as an overturn");
      assert.equal(history[0].isVerdictCorrect, true, "Player verdict matches physical truth");
      assert.equal(history[0].reviewRetained, true, "Successful bowling review retains quota");

      const remaining = session.getRemainingReviews();
      assert.equal(remaining.bowling, 2, "Bowling reviews must remain 2");
      assert.equal(remaining.batting, 2, "Batting reviews must remain 2");
    });

    it("T4.2: Case 2 - On-field OUT overturned to NOT OUT (batting review successful, quota retained)", () => {
      // Seed 1: onField = OUT, physical truth = NOT_OUT
      const scenario = generateScenario(1, "LBW");
      assert.equal(scenario.onFieldSignal, "OUT");
      assert.equal(scenario.correctFinalVerdict, "NOT_OUT");

      const session = new ThirdUmpireGameSession([scenario], 1);
      session.enterWorkstation();

      // Third Umpire rules NOT_OUT
      const result = session.submitVerdict("NOT_OUT");
      assert.ok(result);
      assert.equal(result.finalVerdict, "NOT_OUT");
      assert.equal(result.finalVerdictCorrect, true);

      const history = session.getDecisionsHistory();
      assert.equal(history[0].isOverturn, true, "Decision must be flagged as an overturn");
      assert.equal(history[0].reviewRetained, true, "Successful batting review retains quota");

      const remaining = session.getRemainingReviews();
      assert.equal(remaining.batting, 2, "Batting reviews must remain 2");
    });

    it("T4.3: Case 3 - On-field decision UPHELD (unsuccessful review loses quota)", () => {
      // Seed 20: onField = OUT, physical truth = OUT (Batting side reviews incorrectly)
      const scenario = generateScenario(20, "LBW");
      assert.equal(scenario.onFieldSignal, "OUT");
      assert.equal(scenario.correctFinalVerdict, "OUT");

      const session = new ThirdUmpireGameSession([scenario], 20);
      session.enterWorkstation();

      // Third Umpire confirms OUT (upholds on-field decision)
      const result = session.submitVerdict("OUT");
      assert.ok(result);
      assert.equal(result.finalVerdict, "OUT");
      assert.equal(result.finalVerdictCorrect, true);

      const history = session.getDecisionsHistory();
      assert.equal(history[0].isOverturn, false, "Decision is UPHELD, not an overturn");
      assert.equal(history[0].reviewRetained, false, "Unsuccessful review is lost under ICC rules");

      const remaining = session.getRemainingReviews();
      assert.equal(remaining.batting, 1, "Batting side loses 1 review");
      assert.equal(remaining.bowling, 2, "Bowling side reviews unaffected");
    });

    it("T4.4: Once-Only Invariant - duplicate verdict submissions are strictly idempotent and cannot mutate state", () => {
      const scenario = generateScenario(20, "LBW");
      const session = new ThirdUmpireGameSession([scenario], 20);
      session.enterWorkstation();

      // First submission
      const result1 = session.submitVerdict("OUT");
      assert.ok(result1);
      assert.equal(session.getRemainingReviews().batting, 1);
      assert.equal(session.getDecisionsHistory().length, 1);
      assert.equal(session.isDecided(), true);

      // Attempt second submission (double click / replay attack)
      const result2 = session.submitVerdict("NOT_OUT");
      assert.equal(result2, result1, "Duplicate submission must return original result");
      assert.equal(session.getRemainingReviews().batting, 1, "Quota must NOT be deducted again");
      assert.equal(session.getDecisionsHistory().length, 1, "Decision history must not contain duplicate records");
      assert.equal(session.getDecisionsHistory()[0].playerVerdict, "OUT", "Original verdict must not be overwritten");
    });

    it("T4.5: SEND UPSTAIRS choice upholds on-field signal with anti-abstention scoring", () => {
      // Seed 20: onField = OUT
      const scenario = generateScenario(20, "LBW");
      const session = new ThirdUmpireGameSession([scenario], 20);
      session.enterWorkstation();

      const result = session.submitVerdict("SEND_UPSTAIRS");
      assert.ok(result);
      assert.equal(result.finalVerdict, "OUT", "SEND_UPSTAIRS must uphold on-field signal");
      assert.equal(result.finalVerdictCorrect, false, "SEND_UPSTAIRS cannot score correctness points");

      const history = session.getDecisionsHistory();
      assert.equal(history[0].playerVerdict, "SEND_UPSTAIRS");
      assert.equal(history[0].effectiveVerdict, "OUT");
    });

    it("T4.6: calculateIncidentScore enforces anti-abstention (0 pts for SEND_UPSTAIRS) and awards bonuses", () => {
      const dummyScenario = generateScenario(1, "LBW");
      const dummyResult: IncidentResult = {
        scenarioId: dummyScenario.id,
        incidentType: dummyScenario.incidentType,
        difficultyTier: dummyScenario.difficultyTier,
        playerVerdictChoice: "OUT",
        finalVerdict: "OUT",
        finalVerdictCorrect: true,
        softSignal: null,
        softSignalTimeMs: 0,
        softSignalCorrect: false,
        isUmpiresCallScenario: false,
        umpiresCallComplied: false,
        timeSpentReviewingMs: 15000,
        toolsUsed: [],
      };

      // 1. Anti-abstention: SEND_UPSTAIRS always awards 0 points
      const scoreSendUpstairs = calculateIncidentScore(
        { ...dummyResult, playerVerdictChoice: "SEND_UPSTAIRS" },
        dummyScenario
      );
      assert.equal(scoreSendUpstairs.points, 0, "SEND_UPSTAIRS must award 0 points to prevent abstention exploits");

      // 2. Incorrect verdict awards 0 points
      const scoreIncorrect = calculateIncidentScore(
        { ...dummyResult, finalVerdictCorrect: false },
        dummyScenario
      );
      assert.equal(scoreIncorrect.points, 0, "Incorrect verdict must award 0 points");

      // 3. Standard correct verdict awards base 100 points
      const standardScenario: Scenario = {
        ...dummyScenario,
        difficultyTier: "CLEAR",
        drsEvaluation: { ...dummyScenario.drsEvaluation, isUmpiresCall: false },
      };
      const scoreBase = calculateIncidentScore(dummyResult, standardScenario);
      assert.equal(scoreBase.points, 100, "Standard correct verdict awards 100 base points");

      // 4. Correctly overturning a Howler awards 125 points (+25 bonus)
      const howlerScenario: Scenario = {
        ...dummyScenario,
        difficultyTier: "HOWLER",
      };
      const scoreHowler = calculateIncidentScore(dummyResult, howlerScenario);
      assert.equal(scoreHowler.points, 125, "Correctly overturned Howler awards 125 points (100 base + 25 bonus)");

      // 5. Correctly upholding / adhering to Umpire's Call awards 120 points (+20 bonus)
      const ucScenario: Scenario = {
        ...dummyScenario,
        difficultyTier: "CLEAR",
        drsEvaluation: { ...dummyScenario.drsEvaluation, isUmpiresCall: true },
      };
      const scoreUmpiresCall = calculateIncidentScore(
        { ...dummyResult, umpiresCallComplied: true },
        ucScenario
      );
      assert.equal(scoreUmpiresCall.points, 120, "Correct Umpire's Call adjudication awards 120 points (100 base + 20 bonus)");
    });
  });

  // --------------------------------------------------------------------------
  // Group 5: Review Retention Under ICC Umpire's Call
  // --------------------------------------------------------------------------
  describe("Group 5: Review Retention Under ICC Umpire's Call", () => {
    it("T5.1: Umpire's Call retains review for reviewing side even when on-field signal is upheld", () => {
      // Find a scenario with Umpire's Call
      let ucScenario: Scenario | null = null;
      for (let s = 1; s <= 50; s++) {
        const sc = generateScenario(s, "LBW");
        if (sc.drsEvaluation.isUmpiresCall) {
          ucScenario = sc;
          break;
        }
      }
      assert.ok(ucScenario, "Must find at least one Umpire's Call scenario in seeds 1..50");

      const session = new ThirdUmpireGameSession([ucScenario], 42);
      session.enterWorkstation();

      // Adjudicate upholding on-field call
      const onFieldVerdict = ucScenario.onFieldSignal === "OUT" ? "OUT" : "NOT_OUT";
      session.submitVerdict(onFieldVerdict);

      const history = session.getDecisionsHistory();
      assert.equal(history[0].reviewRetained, true, "Review MUST be retained on Umpire's Call");

      const remaining = session.getRemainingReviews();
      assert.equal(remaining.batting, 2, "Batting reviews preserved");
      assert.equal(remaining.bowling, 2, "Bowling reviews preserved");
    });
  });

  // --------------------------------------------------------------------------
  // Group 6: Next Incident Progression & Consequence Transition
  // --------------------------------------------------------------------------
  describe("Group 6: Next Incident Progression & Consequence Transition", () => {
    it("T6.1: carries forward remaining reviews and history while resetting transient incident state", () => {
      // Scenario 1: Seed 20 (onField OUT, correct OUT) -> Batting review fails, quota drops to 1
      const sc1 = generateScenario(20, "LBW");
      // Scenario 2: Seed 18 (onField NOT_OUT, correct OUT)
      const sc2 = generateScenario(18, "LBW");

      const session = new ThirdUmpireGameSession([sc1, sc2], 999);
      session.enterWorkstation();

      // Decide incident 1
      session.submitVerdict("OUT");
      assert.equal(session.getRemainingReviews().batting, 1);

      // Advance to next incident
      const hasNext = session.nextIncident();
      assert.equal(hasNext, true, "Should advance to incident 2");
      assert.equal(session.getCurrentIndex(), 1);
      assert.equal(session.getStage(), "INCIDENT_INTRO");
      assert.equal(session.getCurrentResult(), null, "Transient currentResult must be reset to null");
      assert.equal(session.isDecided(), false, "Incident 2 is not yet decided");

      // Verify quota persisted
      assert.equal(session.getRemainingReviews().batting, 1, "Batting quota must persist at 1");
      assert.equal(session.getRemainingReviews().bowling, 2, "Bowling quota must persist at 2");

      // Decide incident 2
      session.enterWorkstation();
      session.submitVerdict("OUT");
      assert.equal(session.getDecisionsHistory().length, 2, "Decision history must contain both incidents");

      // Advance past end
      const pastEnd = session.nextIncident();
      assert.equal(pastEnd, false, "nextIncident returns false when session complete");
      assert.equal(session.getStage(), "SESSION_COMPLETE");

      // Session stats
      const stats = session.computeStats();
      assert.equal(stats.totalIncidents, 2);
      assert.ok(stats.reviewPrecision >= 0);
      assert.ok(stats.overallRating >= 0);
    });
  });

  // --------------------------------------------------------------------------
  // Group 7: Real Match Session DRS Review Compatibility
  // --------------------------------------------------------------------------
  describe("Group 7: Real Match Session DRS Review Compatibility", () => {
    it("T7.1: Real Match session provides remaining reviews and updates properly on DRS decisions", () => {
      const session = new RealMatchGameSession(T20_WC_2024_FINAL, 42, { incidentCount: 4 });
      const initialReviews = session.getRemainingReviews();
      assert.equal(initialReviews.batting, 2);
      assert.equal(initialReviews.bowling, 2);

      // Step to first incident
      while (!session.isPausedForReview() && session.stepForward()) {
        // stepping
      }

      assert.equal(session.isPausedForReview(), true);
      const incident = session.getCurrentIncident();
      assert.ok(incident);

      // Submit decision
      session.submitDecision(incident.scenario.correctFinalVerdict);
      assert.equal(session.isPausedForReview(), false);

      const postReviews = session.getRemainingReviews();
      assert.ok(postReviews.batting >= 0 && postReviews.batting <= 2);
      assert.ok(postReviews.bowling >= 0 && postReviews.bowling <= 2);
    });

    it("T7.2: Real Match DRS review submission does not double-decrement quota on unsuccessful review", () => {
      const session = new RealMatchGameSession(T20_WC_2024_FINAL, 42, { incidentCount: 4 });
      const initialReviews = session.getRemainingReviews();
      assert.equal(initialReviews.batting, 2);
      assert.equal(initialReviews.bowling, 2);

      // Step to first incident
      while (!session.isPausedForReview() && session.stepForward()) {
        // stepping
      }
      assert.equal(session.isPausedForReview(), true);

      const incident = session.getCurrentIncident();
      assert.ok(incident);
      const onFieldSignal = incident.scenario.onFieldSignal;
      const reviewingSide = onFieldSignal === "OUT" ? "batting" : "bowling";

      const startingQuota = initialReviews[reviewingSide];
      const outcome = session.submitDecision(onFieldSignal === "OUT" ? "OUT" : "NOT_OUT");

      const afterReviews = session.getRemainingReviews();
      if (!outcome.reviewRetained) {
        assert.equal(afterReviews[reviewingSide], startingQuota - 1, "Exactly 1 review must be deducted on unsuccessful review");
      } else {
        assert.equal(afterReviews[reviewingSide], startingQuota, "Quota preserved on retained review");
      }
    });
  });
});

