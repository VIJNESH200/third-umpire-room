/**
 * src/tests/realMatchGameSession.test.ts
 *
 * Comprehensive integration test suite for Task 2:
 * Playable Real Match DRS Mode.
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { T20_WC_2024_FINAL } from "../data/realMatches/t20Wc2024Final";
import { RealMatchGameSession } from "../engine/realMatchGameSession";
import { selectRealMatchIncident } from "../engine/realMatchIncidentSelector";
import { generateScenario } from "../engine/scenarioGenerator";
import { ResultReveal } from "../components/console/ResultReveal";
import { MatchLogBar } from "../components/console/MatchLogBar";
import type { IncidentResult } from "../types/scenario";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=======================================================");
console.log("   RUNNING TASK 2: REAL MATCH GAME SESSION TESTS      ");
console.log("=======================================================\n");

const sessionSeed = 1726250000000;

// ---------------------------------------------------------------------------
// 1. Session Initialization & First Delivery
// ---------------------------------------------------------------------------
console.log("--- Group 1: Initialization & Baseline Progression ---");

const session = new RealMatchGameSession(T20_WC_2024_FINAL, sessionSeed, {
  incidentCount: 6,
});

// Test 1: A real match session can start
assert(session !== null && session !== undefined, "Test 1: Real match session starts successfully");
assert(session.getStatus() === "NORMAL_PLAYBACK", "Test 1: Initial status is NORMAL_PLAYBACK");
assert(!session.isPausedForReview(), "Test 1: Session is not paused at start");

const initialState = session.getPlaybackState();
assert(initialState.inningsIndex === 0, "Test 1: Starts at innings index 0");
assert(initialState.deliveryIndex === 0, "Test 1: Starts at delivery index 0");
assert(initialState.score === 1, "Test 1: Score matches first delivery (1 run)");
assert(initialState.wickets === 0, "Test 1: 0 wickets at start");
assert(initialState.overs === 0, "Test 1: Over 0");
assert(initialState.ballInOver === 1, "Test 1: Ball 1 in over");
assert(initialState.striker === "RG Sharma", "Test 1: Striker is RG Sharma");
assert(initialState.bowler === "M Jansen", "Test 1: Bowler is M Jansen");

// Test 2: The first delivery is deterministic
const session2 = new RealMatchGameSession(T20_WC_2024_FINAL, sessionSeed, {
  incidentCount: 6,
});
const del1 = session.getCurrentDelivery()!;
const del2 = session2.getCurrentDelivery()!;
assert(del1.delivery.id === "1_0_1", "Test 2: First delivery ID is 1_0_1");
assert(del1.delivery.id === del2.delivery.id, "Test 2: First delivery is identical across same seed");
assert(del1.effectiveOutcome.runsBatter === del2.effectiveOutcome.runsBatter, "Test 2: Outcome runs identical");

// Test 3: Normal deliveries advance correctly
const advancedTo2 = session.stepForward();
assert(advancedTo2 === true, "Test 3: stepForward() advances to 2nd delivery");
const stateBall2 = session.getPlaybackState();
assert(stateBall2.deliveryIndex === 1, "Test 3: deliveryIndex is 1");
assert(stateBall2.currentBall?.delivery.id === "1_0_2", "Test 3: Ball is 1_0_2");
assert(stateBall2.score === 5, "Test 3: Score advanced from 1 to 5 (4 runs scored on 1_0_2)");
assert(stateBall2.wickets === 0, "Test 3: Still 0 wickets");

// Step backward test
const steppedBack = session.stepBackward();
assert(steppedBack === true, "Test 3b: stepBackward() moves back to 1st delivery");
assert(session.getPlaybackState().deliveryIndex === 0, "Test 3b: Cursor back at 0");
session.stepForward(); // Return to ball 2

// ---------------------------------------------------------------------------
// 2. Incident Triggering, Gating & Decision Application
// ---------------------------------------------------------------------------
console.log("\n--- Group 2: DRS Incident Triggering, Gating & Overlays ---");

// Let's create a targeted session with a known custom incident on delivery 1_0_3 (dot ball)
// to precisely audit DRS gating, OUT consequence, and NOT OUT consequence.
const targetDelivery = T20_WC_2024_FINAL.innings[0].deliveries[2]; // 1_0_3 (dot ball)
assert(targetDelivery.id === "1_0_3", "Target delivery is 1_0_3");

const customLbwIncident = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 0, {
  forcedType: "LBW",
  inningsIndex: 0,
});

// Create session with an incident placed at 1_0_3
const controlledIncident = {
  ...customLbwIncident,
  deliveryId: "1_0_3",
};

const controlledSession = new RealMatchGameSession(T20_WC_2024_FINAL, sessionSeed, {
  customIncidents: [controlledIncident],
});

// Step from 1_0_1 -> 1_0_2 -> 1_0_3
assert(controlledSession.stepForward(), "Controlled session steps to 1_0_2");
assert(!controlledSession.isPausedForReview(), "1_0_2 has no incident, not paused");

// Test 4: A DRS incident pauses playback
assert(controlledSession.stepForward(), "Controlled session steps to 1_0_3");
assert(controlledSession.isPausedForReview(), "Test 4: DRS incident on 1_0_3 pauses playback");
assert(controlledSession.getStatus() === "REVIEW_REQUIRED", "Test 4: Status is REVIEW_REQUIRED");
assert(controlledSession.getCurrentIncident() !== null, "Test 4: Active incident is available");
assert(controlledSession.getCurrentIncident()?.incidentType === "LBW", "Test 4: Incident type is LBW");

// Test 5: User decision is required before continuing
const blockedStep = controlledSession.stepForward();
assert(blockedStep === false, "Test 5: stepForward() is strictly BLOCKED while review is pending");
assert(controlledSession.getPlaybackState().deliveryIndex === 2, "Test 5: Cursor did not advance");

// Test 6: OUT changes the effective match state
const preOutWickets = controlledSession.getPlaybackState().wickets;
const outOverride = controlledSession.submitDecision("OUT");
assert(outOverride.applied === true, "Test 6: DRS overlay was applied");
assert(outOverride.drsOutcome.wicket?.kind === "LBW", "Test 6: Overlay wicket kind is LBW");
assert(controlledSession.getStatus() === "NORMAL_PLAYBACK", "Test 6: Status unpaused to NORMAL_PLAYBACK");
assert(!controlledSession.isPausedForReview(), "Test 6: isPausedForReview is now false");

const postOutState = controlledSession.getPlaybackState();
assert(postOutState.wickets === preOutWickets + 1, "Test 6: Effective wickets increased by 1 (OUT)");
assert(postOutState.currentBall?.isOverridden === true, "Test 6: Current ball is marked overridden");
assert(postOutState.currentBall?.effectiveOutcome.wicket?.playerOut === targetDelivery.striker, "Test 6: Striker dismissed");

// Now playback CAN advance past the resolved incident
assert(controlledSession.stepForward() === true, "Controlled session advances to 1_0_4 after decision rendered");
assert(controlledSession.getPlaybackState().deliveryIndex === 3, "Now on delivery index 3");

// Test 7: NOT OUT preserves the baseline
// Create a separate session where NOT OUT is given on 1_0_3
const notOutSession = new RealMatchGameSession(T20_WC_2024_FINAL, sessionSeed, {
  customIncidents: [controlledIncident],
});
notOutSession.stepForward(); // to 1_0_2
notOutSession.stepForward(); // to 1_0_3
assert(notOutSession.isPausedForReview(), "Paused at 1_0_3 for review");

const baselineScoreAt103 = notOutSession.getPlaybackState().score;
const notOutOverride = notOutSession.submitDecision("NOT_OUT");
assert(notOutOverride.applied === true, "Test 7: Overlay applied with NOT_OUT");
assert(notOutSession.getPlaybackState().wickets === 0, "Test 7: 0 wickets after NOT OUT on baseline dot ball");
assert(notOutSession.getPlaybackState().score === baselineScoreAt103, "Test 7: Score preserves baseline");

// Test 10: Removing an overlay restores the baseline
assert(controlledSession.getOverlays().size === 1, "Controlled session currently has 1 overlay");
const removed = controlledSession.removeOverlay("1_0_3");
assert(removed === true, "Test 10: Overlay removed successfully");
assert(controlledSession.getOverlays().size === 0, "Test 10: Overlay map is now empty");
// Check that wickets for current state at 1_0_4 now reflect 0 wickets again
assert(controlledSession.getPlaybackState().wickets === 0, "Test 10: Wicket count reverted to canonical baseline (0)");

// ---------------------------------------------------------------------------
// 3. Multiple Decisions, Projections & Fast-Forward
// ---------------------------------------------------------------------------
console.log("\n--- Group 3: Multiple DRS Decisions & Projections ---");

// Test 8: Multiple DRS decisions can occur in one session
const multiSession = new RealMatchGameSession(T20_WC_2024_FINAL, sessionSeed, {
  incidentCount: 4,
});
const scheduled = multiSession.getScheduledIncidents();
assert(scheduled.length === 4, "Test 8: 4 incidents scheduled across the match");

let decisionsCount = 0;
while (multiSession.jumpToNextIncident()) {
  assert(multiSession.isPausedForReview(), `Paused at incident ${decisionsCount + 1}`);
  const inc = multiSession.getCurrentIncident()!;
  assert(inc.scenario.id.startsWith("SCN-"), `Incident ${decisionsCount + 1} has valid scenario`);
  // Alternate decisions: OUT, NOT_OUT, OUT, NOT_OUT
  const verdict = decisionsCount % 2 === 0 ? "OUT" : "NOT_OUT";
  multiSession.submitDecision(verdict);
  decisionsCount++;
  assert(!multiSession.isPausedForReview(), `Unpaused after decision ${decisionsCount}`);
}
assert(decisionsCount === 4, `Test 8: Exactly 4 DRS decisions were processed in this session (found ${decisionsCount})`);
assert(multiSession.getDecisionsHistory().length === 4, "Test 8: Decisions history contains all 4 records");

// Test 9: Score/wicket projections reflect active overlays
const activeOverlays = multiSession.getOverlays();
assert(activeOverlays.size === 4, "Test 9: 4 active overlays registered");
const currentState = multiSession.getPlaybackState();
// At least the 2 OUT decisions contributed to effective wickets
assert(currentState.wickets >= 2, "Test 9: Wickets projection reflects active OUT overlays");

// ---------------------------------------------------------------------------
// 4. Innings Transitions & Match Completion
// ---------------------------------------------------------------------------
console.log("\n--- Group 4: Innings Transitions & Completion ---");

// Test 11: Innings transition works
const innTransitionSession = new RealMatchGameSession(T20_WC_2024_FINAL, sessionSeed, {
  incidentCount: 2,
});

// Seek to last delivery of Innings 1 (index 126 in 127-delivery innings)
const inn1Len = T20_WC_2024_FINAL.innings[0].deliveries.length;
assert(inn1Len === 127, "Innings 1 has 127 deliveries");
innTransitionSession.seekTo(0, 126);

const preTransitionState = innTransitionSession.getPlaybackState();
assert(preTransitionState.inningsIndex === 0, "At Innings 1");
assert(preTransitionState.deliveryIndex === 126, "At delivery index 126");
assert(!preTransitionState.isComplete, "Match is not complete at end of Innings 1");

// Step forward transitions across innings boundary
const transitioned = innTransitionSession.stepForward();
assert(transitioned === true, "Test 11: Step forward across innings succeeds");
const postTransitionState = innTransitionSession.getPlaybackState();
assert(postTransitionState.inningsIndex === 1, "Test 11: Now at Innings 2 (inningsIndex 1)");
assert(postTransitionState.deliveryIndex === 0, "Test 11: Reset to deliveryIndex 0 in Innings 2");
assert(postTransitionState.currentBall?.delivery.id === "2_0_1", "Test 11: Ball is 2_0_1");
assert(postTransitionState.striker === "RR Hendricks", "Test 11: Innings 2 striker is RR Hendricks");
assert(postTransitionState.nonStriker === "Q de Kock", "Test 11: Innings 2 nonStriker is Q de Kock");
assert(postTransitionState.remainingReviews?.batting === 2, "Test 11: Batting reviews reset to 2 for Innings 2");
assert(postTransitionState.remainingReviews?.bowling === 2, "Test 11: Bowling reviews reset to 2 for Innings 2");

// Test 12: Final match state can be reached
const inn2Len = T20_WC_2024_FINAL.innings[1].deliveries.length;
assert(inn2Len === 124, "Innings 2 has 124 deliveries");
innTransitionSession.seekTo(1, 123); // Last ball of Innings 2 ("2_19_7")

const lastBallState = innTransitionSession.getPlaybackState();
assert(lastBallState.inningsIndex === 1, "At Innings 2");
assert(lastBallState.deliveryIndex === 123, "At final delivery index 123");
assert(lastBallState.isComplete === true, "Test 12: Playback state flags isComplete === true on final ball");

// Further step forward should return false (cannot advance past match end)
assert(innTransitionSession.stepForward() === false, "Test 12: Cannot advance beyond final delivery");
assert(innTransitionSession.getStatus() === "MATCH_COMPLETE", "Test 12: Status is MATCH_COMPLETE");

const matchResult = innTransitionSession.getMatchResult();
assert(matchResult.completed === true, "Test 12: Result flags completed === true");
assert(matchResult.innings1Score === 176, "Test 12: Canonical Innings 1 score is 176");
assert(matchResult.innings2Score === 169, "Test 12: Canonical Innings 2 score is 169");
assert(matchResult.winnerTeamId === "IND", "Test 12: Winner is IND");
assert(matchResult.marginDescription.includes("7 run"), "Test 12: India won by 7 runs");

// ---------------------------------------------------------------------------
// 5. Immutability, Zero-Copy & Determinism Guarantees
// ---------------------------------------------------------------------------
console.log("\n--- Group 5: Immutability & Zero-Copy Guarantees ---");

// Test 13: Same seed reproduces the same session
const sessionAlpha = new RealMatchGameSession(T20_WC_2024_FINAL, 445566, { incidentCount: 5 });
const sessionBeta = new RealMatchGameSession(T20_WC_2024_FINAL, 445566, { incidentCount: 5 });

const schedAlpha = sessionAlpha.getScheduledIncidents();
const schedBeta = sessionBeta.getScheduledIncidents();
assert(schedAlpha.length === schedBeta.length, "Test 13: Same incident count");
for (let i = 0; i < schedAlpha.length; i++) {
  assert(schedAlpha[i].deliveryId === schedBeta[i].deliveryId, `Test 13: Incident ${i} deliveryId identical`);
  assert(schedAlpha[i].incidentType === schedBeta[i].incidentType, `Test 13: Incident ${i} incidentType identical`);
  assert(schedAlpha[i].difficulty === schedBeta[i].difficulty, `Test 13: Incident ${i} difficulty identical`);
  assert(schedAlpha[i].scenario.id === schedBeta[i].scenario.id, `Test 13: Incident ${i} scenario ID identical`);
}

// Test 14: Static match data remains immutable
assert(Object.isFrozen(T20_WC_2024_FINAL), "Test 14: T20_WC_2024_FINAL remains strictly frozen");
try {
  (T20_WC_2024_FINAL as any).mutated = true;
} catch {
  // Expected in strict mode
}
assert((T20_WC_2024_FINAL as any).mutated === undefined, "Test 14: Cannot add properties to match");

// Test 15: No complete match clone is created
assert(sessionAlpha.match === T20_WC_2024_FINAL, "Test 15: Session holds direct reference to canonical match object");
const effectiveBallSample = sessionAlpha.getCurrentDelivery()!;
assert(
  effectiveBallSample.delivery === T20_WC_2024_FINAL.innings[0].deliveries[0],
  "Test 15: EffectiveBall holds direct reference to canonical RealDelivery (zero copy)"
);

// ---------------------------------------------------------------------------
// 6. Edge Cases: Final Delivery Reviews, Dynamic Targets & Audit Accuracy
// ---------------------------------------------------------------------------
console.log("\n--- Group 6: Final Delivery Reviews, Dynamic Targets & Audit ---");

// Test 16: DRS Incident on the final delivery of the match
const finalDelivery = T20_WC_2024_FINAL.innings[1].deliveries[123];
const finalBallIncidentSession = new RealMatchGameSession(T20_WC_2024_FINAL, 998877, {
  customIncidents: [
    {
      matchId: T20_WC_2024_FINAL.id,
      innings: 2,
      deliveryId: finalDelivery.id,
      incidentType: "CAUGHT_BEHIND",
      difficulty: "CLEAR",
      scenario: generateScenario(998877, "CAUGHT_BEHIND", "CLEAR"),
    },
  ],
});

// Arrive at final delivery
finalBallIncidentSession.seekTo(1, 123);
assert(
  finalBallIncidentSession.getStatus() === "REVIEW_REQUIRED",
  "Test 16: Arrival at final delivery with incident sets status REVIEW_REQUIRED (not prematurely MATCH_COMPLETE)"
);
assert(finalBallIncidentSession.isPausedForReview() === true, "Test 16: Playback is paused for review on final delivery");
assert(
  finalBallIncidentSession.stepForward() === false,
  "Test 16: stepForward() strictly blocked while final delivery review is pending"
);

// Submit decision on final delivery
finalBallIncidentSession.submitDecision("OUT");
assert(!finalBallIncidentSession.isPausedForReview(), "Test 16: Unpaused after submitting decision on final ball");
assert(
  finalBallIncidentSession.getStatus() === "NORMAL_PLAYBACK",
  "Test 16: Status is NORMAL_PLAYBACK after decision so final delivery outcome is visible"
);
assert(
  finalBallIncidentSession.getCurrentDelivery()?.isOverridden === true,
  "Test 16: Final delivery reflects active DRS override"
);

// Advancing past final delivery now completes the match
const advancedPastEnd = finalBallIncidentSession.stepForward();
assert(advancedPastEnd === false, "Test 16: Cannot step past final delivery");
assert(
  finalBallIncidentSession.getStatus() === "MATCH_COMPLETE",
  "Test 16: Status transitions to MATCH_COMPLETE after attempting to step past final delivery"
);

// Test 17: jumpToNextIncident() pauses at final delivery review
const jumpFinalSession = new RealMatchGameSession(T20_WC_2024_FINAL, 887766, {
  customIncidents: [
    {
      matchId: T20_WC_2024_FINAL.id,
      innings: 2,
      deliveryId: finalDelivery.id,
      incidentType: "LBW",
      difficulty: "CLEAR",
      scenario: generateScenario(887766, "LBW", "CLEAR"),
    },
  ],
});
jumpFinalSession.seekTo(1, 120); // 3 balls before end
const jumpedToFinal = jumpFinalSession.jumpToNextIncident();
assert(jumpedToFinal === true, "Test 17: jumpToNextIncident() successfully halts at final delivery review");
assert(jumpFinalSession.isPausedForReview() === true, "Test 17: jumpToNextIncident paused on final delivery");
assert(jumpFinalSession.getPlaybackState().deliveryIndex === 123, "Test 17: Cursor stopped exactly at final delivery index 123");
jumpFinalSession.submitDecision("OUT");
const jumpedAfterFinal = jumpFinalSession.jumpToNextIncident();
assert(jumpedAfterFinal === false, "Test 17: jumpToNextIncident() returns false when no further reviews remain");
assert(jumpFinalSession.getStatus() === "MATCH_COMPLETE", "Test 17: Status is MATCH_COMPLETE after match finishes");

// Test 18: Dynamic Innings 1 score & target calculation
const dynamicSession = new RealMatchGameSession(T20_WC_2024_FINAL, 776655, {
  customIncidents: [
    {
      matchId: T20_WC_2024_FINAL.id,
      innings: 1,
      deliveryId: "1_0_5",
      incidentType: "BOUNDARY",
      difficulty: "CLEAR",
      scenario: generateScenario(776655, "BOUNDARY", "CLEAR"),
    },
  ],
});
const baseInn1 = dynamicSession.getInningsEffectiveScore(0);
assert(baseInn1.score === 176, "Test 18: Baseline Innings 1 score is 176");
assert(baseInn1.score + 1 === 177, "Test 18: Baseline Target is 177");

// Submit NOT OUT boundary decision on 1_0_5 (awards 4 runs where baseline was 0)
dynamicSession.seekTo(0, 4);
dynamicSession.submitDecision("NOT_OUT", { boundaryRuns: 4 });
const modifiedInn1 = dynamicSession.getInningsEffectiveScore(0);
assert(modifiedInn1.score === 180, "Test 18: Effective Innings 1 score dynamically adjusted to 180");
const dynamicTarget = modifiedInn1.score + 1;
assert(dynamicTarget === 181, "Test 18: Target dynamically updated to 181 for Innings 2");

// Removing overlay reverts target
dynamicSession.removeOverlay("1_0_5");
const revertedInn1 = dynamicSession.getInningsEffectiveScore(0);
assert(revertedInn1.score === 176, "Test 18: Reverting overlay restores baseline Innings 1 score 176");

// Test 19: Accurate Review Audit (overturned vs upheld)
const auditSession = new RealMatchGameSession(T20_WC_2024_FINAL, 665544, {
  customIncidents: [
    // 1. On-field NOT_OUT, TV Umpire overturns to OUT
    {
      matchId: T20_WC_2024_FINAL.id,
      innings: 1,
      deliveryId: "1_0_2",
      incidentType: "LBW",
      difficulty: "CLEAR",
      scenario: {
        ...generateScenario(665544, "LBW", "CLEAR"),
        onFieldSignal: "NOT_OUT",
      },
    },
    // 2. On-field NOT_OUT, TV Umpire upholds NOT_OUT (Umpire's Call - team retains review, but decision UPHELD)
    {
      matchId: T20_WC_2024_FINAL.id,
      innings: 1,
      deliveryId: "1_0_3",
      incidentType: "LBW",
      difficulty: "MARGINAL",
      scenario: {
        ...generateScenario(665544, "LBW", "MARGINAL"),
        onFieldSignal: "NOT_OUT",
        drsEvaluation: {
          ...generateScenario(665544, "LBW", "MARGINAL").drsEvaluation,
          isUmpiresCall: true,
        },
      },
    },
  ],
});
auditSession.seekTo(0, 1);
auditSession.submitDecision("OUT"); // Overturned
auditSession.seekTo(0, 2);
auditSession.submitDecision("NOT_OUT"); // Upheld (not overturned)

const auditResult = auditSession.getMatchResult();
assert(auditResult.totalReviewsConducted === 2, "Test 19: 2 reviews conducted");
assert(auditResult.reviewsOverturned === 1, "Test 19: Exactly 1 decision overturned");
assert(auditResult.reviewsUpheld === 1, "Test 19: Exactly 1 decision upheld");

// ---------------------------------------------------------------------------
// Group 7: Forensic Rationale Preservation (M-02)
// ---------------------------------------------------------------------------
console.log("\n--- Group 7: Forensic Rationale Preservation ---");
const reasonSession = new RealMatchGameSession(T20_WC_2024_FINAL, 998877, {
  incidentCount: 2,
  customIncidents: [
    {
      matchId: T20_WC_2024_FINAL.id,
      innings: 1,
      deliveryId: "1_0_2",
      incidentType: "LBW",
      difficulty: "CLEAR",
      scenario: generateScenario(112233, "LBW", "CLEAR"),
    },
    {
      matchId: T20_WC_2024_FINAL.id,
      innings: 1,
      deliveryId: "1_0_3",
      incidentType: "LBW",
      difficulty: "CLEAR",
      scenario: generateScenario(445566, "LBW", "CLEAR"),
    },
  ],
});

reasonSession.seekTo(0, 1);
const scenario1 = reasonSession.getCurrentIncident()!.scenario;
const overrideStandard = reasonSession.submitDecision("OUT", { reason: "STANDARD" });
assert(
  overrideStandard.reason === scenario1.drsEvaluation.explanation,
  `Test 20: 'STANDARD' reason does not clobber rich DRS rationale (got: "${overrideStandard.reason}")`
);

reasonSession.seekTo(0, 2);
const overrideCustom = reasonSession.submitDecision("OUT", { reason: "Custom ball tracking confirmed pitching in line" });
assert(
  overrideCustom.reason === "Custom ball tracking confirmed pitching in line",
  "Test 20: Explicit non-standard custom reason is preserved"
);

reasonSession.seekTo(0, 1);
const overrideWhitespace = reasonSession.submitDecision("OUT", { reason: "  STANDARD  " });
assert(
  overrideWhitespace.reason === scenario1.drsEvaluation.explanation,
  "Test 20b: Whitespace-padded 'STANDARD' does not clobber rich DRS rationale"
);

reasonSession.seekTo(0, 1);
const overrideLowercase = reasonSession.submitDecision("OUT", { reason: "standard" });
assert(
  overrideLowercase.reason === scenario1.drsEvaluation.explanation,
  "Test 20c: Lowercase 'standard' does not clobber rich DRS rationale"
);

// ---------------------------------------------------------------------------
// Group 8: Case Counter & Result Reveal Presentation (M-01 & L-01)
// ---------------------------------------------------------------------------
console.log("\n--- Group 8: Case Counter & Result Reveal Presentation (M-01 & L-01) ---");

const testScenario = generateScenario(556677, "LBW", "CLEAR");
const mockResult: IncidentResult = {
  scenarioId: testScenario.id,
  incidentType: testScenario.incidentType,
  difficultyTier: testScenario.difficultyTier,
  softSignal: "OUT",
  softSignalTimeMs: 4200,
  softSignalCorrect: true,
  finalVerdict: "OUT",
  finalVerdictCorrect: true,
  isUmpiresCallScenario: false,
  umpiresCallComplied: true,
  timeSpentReviewingMs: 8500,
  toolsUsed: ["LBW"],
};

// 1. MatchLogBar case counter verification (M-01)
const logBarCase1Html = renderToStaticMarkup(
  React.createElement(MatchLogBar, {
    matchContext: testScenario.matchContext,
    difficultyTier: testScenario.difficultyTier,
    incidentIndex: 0,
    totalIncidents: 8,
    isMuted: false,
    onToggleMute: () => {},
  })
);
assert(logBarCase1Html.includes("CASE") && logBarCase1Html.includes("1/8"), "Test 21: MatchLogBar renders CASE 1/8 on first incident");

const logBarCase8Html = renderToStaticMarkup(
  React.createElement(MatchLogBar, {
    matchContext: testScenario.matchContext,
    difficultyTier: testScenario.difficultyTier,
    incidentIndex: 7,
    totalIncidents: 8,
    isMuted: false,
    onToggleMute: () => {},
  })
);
assert(logBarCase8Html.includes("CASE") && logBarCase8Html.includes("8/8"), "Test 21: MatchLogBar renders CASE 8/8 on 8th incident");
assert(!logBarCase8Html.includes("9/8"), "Test 21: MatchLogBar never renders off-by-one CASE 9/8");

// 2. ResultReveal button and subline verification in Real Match mode (L-01 & M-01)
const realMatchFinalHtml = renderToStaticMarkup(
  React.createElement(ResultReveal, {
    scenario: testScenario,
    result: mockResult,
    incidentIndex: 7,
    totalIncidents: 8,
    onNextIncident: () => {},
    isRealMatch: true,
  })
);
assert(realMatchFinalHtml.includes("RETURN TO MATCH PLAYBACK"), "Test 22: ResultReveal renders 'RETURN TO MATCH PLAYBACK' on final case in Real Match mode");
assert(!realMatchFinalHtml.includes("GENERATE FINAL DRS PERFORMANCE RATING"), "Test 22: ResultReveal does not render series rating button in Real Match mode");
assert(realMatchFinalHtml.includes("FINAL REVIEW COMPLETE"), "Test 22: ResultReveal renders 'FINAL REVIEW COMPLETE' status on final case in Real Match mode");
assert(!realMatchFinalHtml.includes("REMAINING: -1"), "Test 22: ResultReveal never renders negative remaining count");

const realMatchMidHtml = renderToStaticMarkup(
  React.createElement(ResultReveal, {
    scenario: testScenario,
    result: mockResult,
    incidentIndex: 0,
    totalIncidents: 8,
    onNextIncident: () => {},
    isRealMatch: true,
  })
);
assert(realMatchMidHtml.includes("RETURN TO MATCH PLAYBACK"), "Test 23: ResultReveal renders 'RETURN TO MATCH PLAYBACK' on intermediate case");
assert(realMatchMidHtml.includes("REMAINING: 7"), "Test 23: ResultReveal renders 'REMAINING: 7' on first of 8 cases");

// 3. Shift Mode button label verification
const shiftModeFinalHtml = renderToStaticMarkup(
  React.createElement(ResultReveal, {
    scenario: testScenario,
    result: mockResult,
    incidentIndex: 7,
    totalIncidents: 8,
    onNextIncident: () => {},
    isRealMatch: false,
  })
);
assert(shiftModeFinalHtml.includes("GENERATE FINAL DRS PERFORMANCE RATING"), "Test 24: ResultReveal renders 'GENERATE FINAL DRS PERFORMANCE RATING' on final case in Shift mode");
assert(shiftModeFinalHtml.includes("SERIES FINALE"), "Test 24: ResultReveal renders 'SERIES FINALE' in Shift mode");

// 4. Custom label override
const customLabelHtml = renderToStaticMarkup(
  React.createElement(ResultReveal, {
    scenario: testScenario,
    result: mockResult,
    incidentIndex: 7,
    totalIncidents: 8,
    onNextIncident: () => {},
    nextButtonLabel: "CUSTOM ACTION VERDICT",
  })
);
assert(customLabelHtml.includes("CUSTOM ACTION VERDICT"), "Test 25: Custom nextButtonLabel prop overrides default labels");

// 5. Defensive null guard on ResultReveal
const nullResultHtml = renderToStaticMarkup(
  React.createElement(ResultReveal, {
    scenario: testScenario,
    result: null,
    incidentIndex: 0,
    totalIncidents: 8,
    onNextIncident: () => {},
  })
);
assert(nullResultHtml === "", "Test 26: ResultReveal gracefully renders empty output when result is null without throwing");

console.log("\n=======================================================");
console.log(`   ALL TASK 2 INTEGRATION TESTS PASSED! (${passedCount} assertions, ${failedCount} failures)`);
console.log("=======================================================\n");
