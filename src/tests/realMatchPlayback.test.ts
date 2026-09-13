/**
 * src/tests/realMatchPlayback.test.ts
 *
 * Comprehensive verification suite for the Real Match Data & DRS Overlay architecture.
 * Proves all 8 required architectural criteria:
 * 1. A real match can be loaded and conforms to type contracts.
 * 2. Balls can be advanced deterministically.
 * 3. Score and wickets are read and aggregated correctly.
 * 4. The source match data is strictly immutable and not mutated.
 * 5. A DRS overlay changes the effective outcome.
 * 6. Removing the overlay restores the original outcome.
 * 7. Applying an overlay does not require copying or cloning the entire match.
 * 8. Replaying the same sequence produces identical results.
 */

import { REPRESENTATIVE_T20_MATCH } from "../data/realMatches/representativeT20Match";
import { T20_WC_2024_FINAL } from "../data/realMatches/t20Wc2024Final";
import {
  RealMatchPlaybackSession,
  createLbwDrsConsequence,
  createRunOutDrsConsequence,
  createStumpingDrsConsequence,
  createCaughtBehindDrsConsequence,
  createBoundaryDrsConsequence,
  createDrsConsequence,
  calculateReviewRetention,
  getEffectiveBall,
  computePlaybackState,
} from "../engine/realMatchPlayback";
import {
  evaluateDRSLBW,
  evaluateRunOut,
  evaluateStumping,
  evaluateCaughtBehind,
  evaluateBoundary,
} from "../engine/drsRules";
import type {
  LBWData,
  RunOutData,
  StumpingData,
  CaughtBehindData,
  BoundaryData,
} from "../types/scenario";
import type { DrsOutcomeOverride, RealDelivery } from "../types/realMatch";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`[PASS] ${message}`);
}

console.log("=======================================================");
console.log("   REAL MATCH PLAYBACK & DRS OVERLAY TEST SUITE");
console.log("=======================================================\n");

// ============================================================================
// SUITE 1: MATCH LOADING & CONTRACT VALIDITY
// ============================================================================
console.log("--- Suite 1: Match Loading & Contract Validity ---");
{
  assert(
    REPRESENTATIVE_T20_MATCH.id === "MATCH_MUM_BLR_2026_01",
    "S1.1: Match ID matches expected identifier"
  );
  assert(
    REPRESENTATIVE_T20_MATCH.format === "T20",
    "S1.2: Match format is T20"
  );
  assert(
    REPRESENTATIVE_T20_MATCH.homeTeamId === "FRAN_MUM",
    "S1.3: Home team is FRAN_MUM (Mumbai)"
  );
  assert(
    REPRESENTATIVE_T20_MATCH.awayTeamId === "FRAN_BLR",
    "S1.4: Away team is FRAN_BLR (Bengaluru)"
  );
  assert(
    REPRESENTATIVE_T20_MATCH.innings.length === 2,
    "S1.5: Match contains exactly 2 innings"
  );

  const inn1 = REPRESENTATIVE_T20_MATCH.innings[0];
  const inn2 = REPRESENTATIVE_T20_MATCH.innings[1];

  assert(
    inn1.deliveries.length === 12,
    "S1.6: Innings 1 contains 12 deliveries (2 complete overs)"
  );
  assert(
    inn2.deliveries.length === 6,
    "S1.7: Innings 2 contains 6 deliveries (1 complete over)"
  );

  // Validate delivery ID schema
  for (const delivery of inn1.deliveries) {
    assert(
      delivery.id.startsWith("1_"),
      `S1.8: Innings 1 delivery ${delivery.id} conforms to prefix schema`
    );
  }
}

// ============================================================================
// SUITE 2: DETERMINISTIC PLAYBACK ADVANCEMENT
// ============================================================================
console.log("\n--- Suite 2: Deterministic Playback Advancement ---");
{
  const session = new RealMatchPlaybackSession(REPRESENTATIVE_T20_MATCH);

  // Initial position: Innings 1, Ball 0
  let cursor = session.getCursor();
  assert(
    cursor.inningsIndex === 0 && cursor.deliveryIndex === 0,
    "S2.1: Session initializes at innings 0, delivery 0"
  );

  let currentDelivery = session.getCurrentDelivery();
  assert(currentDelivery !== null, "S2.2: Initial delivery is non-null");
  assert(
    currentDelivery?.delivery.id === "1_0_1",
    "S2.3: Initial delivery ID is 1_0_1"
  );

  // Advance through Innings 1 (11 more balls)
  for (let i = 1; i <= 11; i++) {
    const advanced = session.stepForward();
    assert(advanced === true, `S2.4: Step forward to delivery index ${i} succeeded`);
    assert(
      session.getCursor().deliveryIndex === i,
      `S2.5: Cursor deliveryIndex is ${i}`
    );
  }

  // 12th step: Should seamlessly transition to Innings 2, delivery 0
  const crossedInnings = session.stepForward();
  assert(
    crossedInnings === true,
    "S2.6: Transition to Innings 2 succeeded"
  );
  cursor = session.getCursor();
  assert(
    cursor.inningsIndex === 1 && cursor.deliveryIndex === 0,
    "S2.7: Cursor is now at innings 1, delivery 0"
  );
  assert(
    session.getCurrentDelivery()?.delivery.id === "2_0_1",
    "S2.8: Current delivery ID is 2_0_1"
  );

  // Step through remaining balls of Innings 2
  for (let i = 1; i < 6; i++) {
    session.stepForward();
  }
  assert(
    session.getCurrentState().isComplete === true,
    "S2.9: isComplete is true at the final delivery of the match"
  );

  // Further forward steps should fail gracefully
  const atEnd = session.stepForward();
  assert(atEnd === false, "S2.10: Stepping beyond end of match returns false");

  // Step backward
  const steppedBack = session.stepBackward();
  assert(steppedBack === true, "S2.11: Stepping backward returns true");
  assert(
    session.getCursor().deliveryIndex === 4,
    "S2.12: Delivery index is now 4 after backward step"
  );

  // SeekTo test
  const seekSuccess = session.seekTo(0, 3);
  assert(seekSuccess === true, "S2.13: Seeking to (0, 3) succeeded");
  assert(
    session.getCurrentDelivery()?.delivery.id === "1_0_4",
    "S2.14: Current delivery after seek is 1_0_4"
  );
}

// ============================================================================
// SUITE 3: ACCURATE SCORE & WICKET ACCUMULATION
// ============================================================================
console.log("\n--- Suite 3: Accurate Score & Wicket Accumulation ---");
{
  const session = new RealMatchPlaybackSession(REPRESENTATIVE_T20_MATCH);

  // Canonical Innings 1 expected scores and wickets at each ball:
  // 1_0_1: 0 runs, 0 wkt -> (0, 0)
  // 1_0_2: 4 runs, 0 wkt -> (4, 0)
  // 1_0_3: 1 run,  0 wkt -> (5, 0)
  // 1_0_4: 0 runs, 0 wkt -> (5, 0)
  // 1_0_5: 2 runs, 0 wkt -> (7, 0)
  // 1_0_6: 1 run,  0 wkt -> (8, 0)
  // 1_1_1: 0 runs, 0 wkt -> (8, 0)
  // 1_1_2: 0 runs, 1 wkt -> (8, 1) [Wicket: Nadkarni caught]
  // 1_1_3: 1 run,  1 wkt -> (9, 1)
  // 1_1_4: 6 runs, 1 wkt -> (15, 1)
  // 1_1_5: 0 runs, 1 wkt -> (15, 1)
  // 1_1_6: 1 run,  1 wkt -> (16, 1)
  const expectedTotals = [
    { score: 0, wickets: 0 },
    { score: 4, wickets: 0 },
    { score: 5, wickets: 0 },
    { score: 5, wickets: 0 },
    { score: 7, wickets: 0 },
    { score: 8, wickets: 0 },
    { score: 8, wickets: 0 },
    { score: 8, wickets: 1 },
    { score: 9, wickets: 1 },
    { score: 15, wickets: 1 },
    { score: 15, wickets: 1 },
    { score: 16, wickets: 1 },
  ];

  for (let i = 0; i < expectedTotals.length; i++) {
    session.seekTo(0, i);
    const state = session.getCurrentState();
    const expected = expectedTotals[i];
    assert(
      state.score === expected.score,
      `S3.${i + 1}a: Ball ${i} score is ${state.score} (expected ${expected.score})`
    );
    assert(
      state.wickets === expected.wickets,
      `S3.${i + 1}b: Ball ${i} wickets is ${state.wickets} (expected ${expected.wickets})`
    );
  }

  // Check striker, non-striker, and bowler at ball 7 (1_1_2)
  session.seekTo(0, 7);
  const stateAtWicket = session.getCurrentState();
  assert(
    stateAtWicket.striker === "Nadkarni",
    "S3.13: Striker at ball 7 is Nadkarni"
  );
  assert(
    stateAtWicket.bowler === "Iyengar",
    "S3.14: Bowler at ball 7 is Iyengar"
  );
}

// ============================================================================
// SUITE 4: SOURCE MATCH IMMUTABILITY
// ============================================================================
console.log("\n--- Suite 4: Source Match Immutability ---");
{
  assert(
    Object.isFrozen(REPRESENTATIVE_T20_MATCH),
    "S4.1: Root match object is deeply frozen"
  );
  assert(
    Object.isFrozen(REPRESENTATIVE_T20_MATCH.innings),
    "S4.2: Innings array is frozen"
  );
  assert(
    Object.isFrozen(REPRESENTATIVE_T20_MATCH.innings[0].deliveries),
    "S4.3: Innings 1 deliveries array is frozen"
  );
  assert(
    Object.isFrozen(REPRESENTATIVE_T20_MATCH.innings[0].deliveries[0]),
    "S4.4: First delivery object is frozen"
  );
  assert(
    Object.isFrozen(REPRESENTATIVE_T20_MATCH.innings[0].deliveries[0].outcome),
    "S4.5: First delivery outcome object is frozen"
  );

  // Attempt to mutate property on frozen delivery (should throw in strict mode or fail)
  let threwMutationError = false;
  try {
    const mutableRef = REPRESENTATIVE_T20_MATCH as unknown as Record<string, unknown>;
    mutableRef.venue = "Mutated Stadium";
  } catch {
    threwMutationError = true;
  }
  assert(
    threwMutationError || REPRESENTATIVE_T20_MATCH.venue === "Marine Drive Stadium",
    "S4.6: Modifying match properties is rejected"
  );
}

// ============================================================================
// SUITE 5: DRS OVERLAY CHANGES EFFECTIVE OUTCOME
// ============================================================================
console.log("\n--- Suite 5: DRS Overlay Changes Effective Outcome ---");
{
  const session = new RealMatchPlaybackSession(REPRESENTATIVE_T20_MATCH);

  // --------------------------------------------------------------------------
  // Scenario A: Dot Ball (1_0_1) overridden to LBW Wicket
  // --------------------------------------------------------------------------
  session.seekTo(0, 0);
  const baselineBall0 = session.getCurrentDelivery()!;
  assert(
    baselineBall0.effectiveOutcome.wicket === undefined,
    "S5.1: Baseline ball 1_0_1 has no wicket"
  );
  assert(
    baselineBall0.isOverridden === false,
    "S5.2: Baseline ball 1_0_1 is not overridden"
  );

  const lbwOverride: DrsOutcomeOverride = {
    ballId: "1_0_1",
    originalOutcome: baselineBall0.delivery.outcome,
    drsOutcome: {
      runsBatter: 0,
      wicket: {
        kind: "LBW",
        playerOut: "Nadkarni",
      },
    },
    applied: true,
    reason: "Pitching in-line, impact in-line, hitting leg stump",
  };

  session.applyOverlay(lbwOverride);

  const effectiveBall0 = session.getCurrentDelivery()!;
  assert(
    effectiveBall0.isOverridden === true,
    "S5.3: Ball 1_0_1 is now marked as overridden"
  );
  assert(
    effectiveBall0.effectiveOutcome.wicket?.kind === "LBW",
    "S5.4: Effective outcome reflects LBW dismissal"
  );

  const stateAfterLbw = session.getCurrentState();
  assert(
    stateAfterLbw.wickets === 1,
    "S5.5: Match wickets is now 1 at ball 0 (was 0)"
  );

  // --------------------------------------------------------------------------
  // Scenario B: Real Caught Dismissal (1_1_2) overturned to Not Out (0 runs)
  // --------------------------------------------------------------------------
  session.seekTo(0, 7); // Ball 1_1_2
  const baselineWicketBall = session.getCurrentDelivery()!;
  assert(
    baselineWicketBall.delivery.outcome.wicket?.kind === "CAUGHT",
    "S5.6: Baseline ball 1_1_2 was a CAUGHT dismissal"
  );

  const notOutOverride: DrsOutcomeOverride = {
    ballId: "1_1_2",
    originalOutcome: baselineWicketBall.delivery.outcome,
    drsOutcome: { runsBatter: 0 }, // Overturned: No edge on UltraEdge
    applied: true,
    reason: "No contact on UltraEdge; daylight visible between bat and ball",
  };

  session.applyOverlay(notOutOverride);

  const effectiveBall7 = session.getCurrentDelivery()!;
  assert(
    effectiveBall7.isOverridden === true,
    "S5.7: Ball 1_1_2 is marked as overridden"
  );
  assert(
    effectiveBall7.effectiveOutcome.wicket === undefined,
    "S5.8: Effective outcome has no wicket"
  );

  // At ball 7: LBW at ball 0 still active (+1), but caught at ball 7 overturned (-1) -> net wickets = 1
  const stateAfterOverturn = session.getCurrentState();
  assert(
    stateAfterOverturn.wickets === 1,
    "S5.9: Net wickets at ball 7 is 1 (1 from ball 0 override, 0 from ball 7 overturned)"
  );
}

// ============================================================================
// SUITE 6: REMOVING OVERLAY RESTORES BASELINE
// ============================================================================
console.log("\n--- Suite 6: Removing Overlay Restores Baseline ---");
{
  const session = new RealMatchPlaybackSession(REPRESENTATIVE_T20_MATCH);

  const override: DrsOutcomeOverride = {
    ballId: "1_0_1",
    originalOutcome: { runsBatter: 0 },
    drsOutcome: { runsBatter: 0, wicket: { kind: "LBW", playerOut: "Nadkarni" } },
    applied: true,
  };

  session.applyOverlay(override);
  assert(
    session.getCurrentState().wickets === 1,
    "S6.1: Overlay applies and wickets is 1"
  );

  // Remove overlay
  const removed = session.removeOverlay("1_0_1");
  assert(removed === true, "S6.2: removeOverlay('1_0_1') returned true");

  const restoredBall = session.getCurrentDelivery()!;
  assert(
    restoredBall.isOverridden === false,
    "S6.3: Restored ball is no longer overridden"
  );
  assert(
    restoredBall.effectiveOutcome.wicket === undefined,
    "S6.4: Restored ball has no wicket"
  );
  assert(
    session.getCurrentState().wickets === 0,
    "S6.5: Match wickets immediately restored to baseline 0"
  );

  // Test clearOverlays
  session.applyOverlay(override);
  assert(session.getOverlays().size === 1, "S6.6: Overlay size is 1");
  session.clearOverlays();
  assert(session.getOverlays().size === 0, "S6.7: Overlay size is 0 after clearOverlays()");
  assert(
    session.getCurrentState().wickets === 0,
    "S6.8: Match state restored to baseline 0 after clearOverlays()"
  );
}

// ============================================================================
// SUITE 7: ZERO MATCH COPYING / REFERENCE IDENTITY
// ============================================================================
console.log("\n--- Suite 7: Zero Match Copying / Reference Identity ---");
{
  const session = new RealMatchPlaybackSession(REPRESENTATIVE_T20_MATCH);

  // Check strict reference equality of match
  assert(
    session.match === REPRESENTATIVE_T20_MATCH,
    "S7.1: session.match is strictly reference-equal to source match"
  );

  session.seekTo(0, 3);
  const effectiveBall = session.getCurrentDelivery()!;
  const rawDelivery = REPRESENTATIVE_T20_MATCH.innings[0].deliveries[3];

  assert(
    effectiveBall.delivery === rawDelivery,
    "S7.2: EffectiveBall.delivery is strictly reference-equal to raw delivery object"
  );

  // Apply overlay
  session.applyOverlay({
    ballId: "1_0_4",
    originalOutcome: rawDelivery.outcome,
    drsOutcome: { runsBatter: 4 },
    applied: true,
  });

  // Re-verify match and delivery references are 100% untouched
  assert(
    session.match === REPRESENTATIVE_T20_MATCH,
    "S7.3: session.match is still strictly reference-equal after applying overlay"
  );
  assert(
    session.getCurrentDelivery()!.delivery === rawDelivery,
    "S7.4: Delivery reference is still strictly identical after applying overlay"
  );
  assert(
    REPRESENTATIVE_T20_MATCH.innings[0].deliveries[3].outcome.runsBatter === 0,
    "S7.5: Source match delivery outcome is completely untouched (still 0 runs)"
  );
}

// ============================================================================
// SUITE 8: DETERMINISTIC REPLAY IDENTITY
// ============================================================================
console.log("\n--- Suite 8: Deterministic Replay Identity ---");
{
  const testOverride: DrsOutcomeOverride = {
    ballId: "1_0_2",
    originalOutcome: { runsBatter: 4 },
    drsOutcome: { runsBatter: 0, wicket: { kind: "LBW", playerOut: "Nadkarni" } },
    applied: true,
  };

  // Run Session A
  const sessionA = new RealMatchPlaybackSession(REPRESENTATIVE_T20_MATCH);
  sessionA.applyOverlay(testOverride);

  // Run Session B
  const sessionB = new RealMatchPlaybackSession(REPRESENTATIVE_T20_MATCH);
  sessionB.applyOverlay(testOverride);

  // Step both sessions across all deliveries and assert absolute state equality
  let stepIndex = 0;
  while (true) {
    const stateA = sessionA.getCurrentState();
    const stateB = sessionB.getCurrentState();

    assert(
      stateA.score === stateB.score,
      `S8.${stepIndex + 1}a: Step ${stepIndex} scores match (${stateA.score} === ${stateB.score})`
    );
    assert(
      stateA.wickets === stateB.wickets,
      `S8.${stepIndex + 1}b: Step ${stepIndex} wickets match (${stateA.wickets} === ${stateB.wickets})`
    );
    assert(
      stateA.striker === stateB.striker,
      `S8.${stepIndex + 1}c: Step ${stepIndex} striker matches (${stateA.striker})`
    );
    assert(
      stateA.bowler === stateB.bowler,
      `S8.${stepIndex + 1}d: Step ${stepIndex} bowler matches (${stateA.bowler})`
    );

    const advancedA = sessionA.stepForward();
    const advancedB = sessionB.stepForward();
    assert(
      advancedA === advancedB,
      `S8.${stepIndex + 1}e: Step ${stepIndex} advancement match (${advancedA} === ${advancedB})`
    );

    if (!advancedA) {
      break;
    }
    stepIndex++;
  }
}

// ============================================================================
// SUITE 9: DRS REVIEW QUOTA TRACKING & DEFENSIVE ENCAPSULATION
// ============================================================================
console.log("\n--- Suite 9: DRS Review Quota Tracking & Encapsulation ---");
{
  const session = new RealMatchPlaybackSession(REPRESENTATIVE_T20_MATCH);

  // Initial reviews should be 2 for each team
  const initialState = session.getCurrentState();
  assert(
    initialState.remainingReviews?.batting === 2,
    "S9.1: Batting team starts with 2 DRS reviews"
  );
  assert(
    initialState.remainingReviews?.bowling === 2,
    "S9.2: Bowling team starts with 2 DRS reviews"
  );

  // Apply an unsuccessful bowling review on ball 1_0_1
  session.applyOverlay({
    ballId: "1_0_1",
    originalOutcome: { runsBatter: 0 },
    drsOutcome: { runsBatter: 0 }, // Not out confirmed -> review lost
    applied: true,
    reviewingSide: "BOWLING",
    reviewRetained: false,
    reason: "Missing leg stump; original NOT OUT decision stands",
  });

  const stateAfterLostReview = session.getCurrentState();
  assert(
    stateAfterLostReview.remainingReviews?.bowling === 1,
    "S9.3: Bowling team reviews deducted to 1 after unsuccessful review"
  );
  assert(
    stateAfterLostReview.remainingReviews?.batting === 2,
    "S9.4: Batting team reviews untouched (still 2)"
  );

  // Apply a successful batting review on ball 1_1_2 (overturned caught dismissal)
  session.seekTo(0, 7);
  session.applyOverlay({
    ballId: "1_1_2",
    originalOutcome: { runsBatter: 0, wicket: { kind: "CAUGHT", playerOut: "Nadkarni" } },
    drsOutcome: { runsBatter: 0 },
    applied: true,
    reviewingSide: "BATTING",
    reviewRetained: true, // Successful overturn -> review retained
    reason: "No spike on UltraEdge; review successful",
  });

  const stateAfterRetainedReview = session.getCurrentState();
  assert(
    stateAfterRetainedReview.remainingReviews?.batting === 2,
    "S9.5: Batting team retains both reviews after successful overturn"
  );
  assert(
    stateAfterRetainedReview.remainingReviews?.bowling === 1,
    "S9.6: Bowling team still has 1 review remaining"
  );

  // Encapsulation test: modifying returned map from getOverlays() does not mutate session
  const overlaysCopy = session.getOverlays() as unknown as Map<string, unknown>;
  overlaysCopy.clear();
  assert(
    session.getOverlays().size === 2,
    "S9.7: Mutating map returned by getOverlays() does not affect session internal state"
  );
}

// ============================================================================
// SUITE 10: LBW DRS INTEGRATION WITH VERIFIED 2024 T20 WC FINAL FIXTURE
// Proves the complete flow:
// Real delivery (1_2_3: Kohli facing Rabada, dot ball)
//    ↓
// LBW DRS incident (Gate 0..3 physics/evidence)
//    ↓
// Existing LBW rule evaluation (evaluateDRSLBW)
//    ↓
// Umpire review decision (OUT or NOT_OUT)
//    ↓
// Sparse DRS overlay (createLbwDrsConsequence)
//    ↓
// Effective match outcome & score progression
// ============================================================================
console.log("\n--- Suite 10: LBW DRS Integration with 2024 T20 WC Final Fixture ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn1Deliveries = fixture.innings[0].deliveries;

  // Selected delivery: 1_2_3 (Innings 1, Over 2, Ball 3, deliveryIndex: 14)
  // Striker: V Kohli, Non-striker: SA Yadav, Bowler: K Rabada
  // Baseline outcome: 0 runs, no wicket
  const deliveryIndex = 14;
  const realDelivery = inn1Deliveries[deliveryIndex];

  assert(realDelivery.id === "1_2_3", "S10.1: Target delivery is 1_2_3");
  assert(realDelivery.striker === "V Kohli", "S10.2: Striker facing delivery 1_2_3 is V Kohli");
  assert(realDelivery.bowler === "K Rabada", "S10.3: Bowler is K Rabada");
  assert(realDelivery.outcome.runsBatter === 0, "S10.4: Baseline runs off bat is 0");
  assert(realDelivery.outcome.wicket === undefined, "S10.5: Baseline outcome has no wicket");

  // Verify baseline match state before DRS intervention
  const baselineSession = new RealMatchPlaybackSession(fixture);
  baselineSession.seekTo(0, deliveryIndex);
  const baselineStateAtDelivery = baselineSession.getCurrentState();
  assert(
    baselineStateAtDelivery.score === 23,
    `S10.6: Baseline score at ball 1_2_3 is 23 (found ${baselineStateAtDelivery.score})`
  );
  assert(
    baselineStateAtDelivery.wickets === 2,
    `S10.7: Baseline wickets at ball 1_2_3 is 2 (found ${baselineStateAtDelivery.wickets})`
  );

  // Baseline state at end of innings
  baselineSession.seekTo(0, 126);
  const baselineInn1EndState = baselineSession.getCurrentState();
  assert(
    baselineInn1EndState.score === 176 && baselineInn1EndState.wickets === 7,
    `S10.8: Baseline Innings 1 ends at 176/7 (found ${baselineInn1EndState.score}/${baselineInn1EndState.wickets})`
  );

  // --------------------------------------------------------------------------
  // Sub-scenario 1: LBW OUT (South Africa review overturned: NOT OUT -> OUT)
  // Real Rabada delivery hits Kohli's pad; on-field call is NOT OUT.
  // South Africa reviews. Ball-tracking shows: Fair delivery, Pad first, Pitching in line,
  // Impact in line, Clearly Hitting middle stump.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 1: LBW OUT via DRS Overturn -");
  const lbwOutData: LBWData = {
    isNoBall: false,
    frontFootOverstepMm: 0,
    batContactBeforePad: false,
    firstContactType: "PAD_FIRST",
    ultraEdgeSpikeAtBatFrame: false,
    pitchingZone: "IN_LINE",
    impactZone: "IN_LINE",
    impactHeight: 48,
    projectedStumpHit: "CLEARLY_HITTING",
    impactDistance: 2.2,
    batterHand: "RIGHT",
    shotOffered: true,
    spinOrPace: "PACE",
    ballSpeedKph: 142,
    pitchX: 0.02,
    impactX: 0.01,
    stumpHitX: -0.02,
    stumpHitHeightCm: 46.5,
    hawkeyeTrajectory: [],
  };

  // 1. Evaluate verdict using canonical DRS engine
  const drsEvalOut = evaluateDRSLBW(lbwOutData, "NOT_OUT");
  assert(drsEvalOut.gate0FairDelivery === true, "S10.9: Gate 0A Fair delivery passed");
  assert(drsEvalOut.gate0NoPriorBat === true, "S10.10: Gate 0B No prior bat passed");
  assert(drsEvalOut.pitchingValid === true, "S10.11: Gate 1 Pitching in line passed");
  assert(drsEvalOut.impactValid === true, "S10.12: Gate 2 Impact in line passed");
  assert(drsEvalOut.wicketsHitting === true, "S10.13: Gate 3 Wickets hitting passed");
  assert(drsEvalOut.correctFinalVerdict === "OUT", "S10.14: DRS verdict is OUT");
  assert(drsEvalOut.overturnRequired === true, "S10.15: Overturn required from NOT_OUT to OUT");

  // 2. Generate sparse DRS consequence
  const consequenceOut = createLbwDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalOut.correctFinalVerdict,
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    reason: drsEvalOut.explanation,
    isUmpiresCall: drsEvalOut.isUmpiresCall,
  });

  assert(consequenceOut.ballId === "1_2_3", "S10.16: Override targets ballId 1_2_3");
  assert(consequenceOut.applied === true, "S10.17: Override is marked applied");
  assert(consequenceOut.reviewingSide === "BOWLING", "S10.18: Reviewing side is BOWLING (SA)");
  assert(consequenceOut.reviewRetained === true, "S10.19: Bowling review retained on successful overturn");
  assert(consequenceOut.drsOutcome.wicket !== undefined, "S10.20: Effective DRS outcome has wicket");
  assert(consequenceOut.drsOutcome.wicket?.kind === "LBW", "S10.21: Dismissal kind is LBW");
  assert(consequenceOut.drsOutcome.wicket?.playerOut === "V Kohli", "S10.22: Dismissed player is V Kohli");
  assert(consequenceOut.drsOutcome.runsBatter === 0, "S10.23: Runs off bat remains 0");

  // 3. Apply consequence to playback session
  const playSession = new RealMatchPlaybackSession(fixture);
  playSession.applyOverlay(consequenceOut);

  // 4. Verify effective ball at delivery position
  playSession.seekTo(0, deliveryIndex);
  const effectiveBallAtWicket = playSession.getCurrentDelivery()!;
  assert(effectiveBallAtWicket.isOverridden === true, "S10.24: Ball 1_2_3 is marked overridden");
  assert(effectiveBallAtWicket.effectiveOutcome.wicket?.kind === "LBW", "S10.25: Effective ball has LBW dismissal");
  assert(effectiveBallAtWicket.effectiveOutcome.wicket?.playerOut === "V Kohli", "S10.26: Dismissed player is V Kohli");
  assert(effectiveBallAtWicket.delivery === realDelivery, "S10.27: Reference equality preserved to immutable real delivery");

  // 5. Verify match state at delivery position
  const stateAtWicket = playSession.getCurrentState();
  assert(stateAtWicket.score === 23, `S10.28: Score at 1_2_3 remains 23 (found ${stateAtWicket.score})`);
  assert(stateAtWicket.wickets === 3, `S10.29: Wickets at 1_2_3 increases from 2 to 3 (found ${stateAtWicket.wickets})`);
  assert(stateAtWicket.remainingReviews?.bowling === 2, "S10.30: Bowling reviews intact at 2");

  // 6. Verify subsequent playback progression reflects the wicket
  // Move to next ball (1_2_4, deliveryIndex 15)
  playSession.stepForward();
  assert(playSession.getCursor().deliveryIndex === 15, "S10.31: Cursor advanced to ball 15 (1_2_4)");
  const stateAfterWicket = playSession.getCurrentState();
  assert(stateAfterWicket.score === 24, `S10.32: Score increases to 24 (found ${stateAfterWicket.score})`);
  assert(stateAfterWicket.wickets === 3, `S10.33: Wickets remains 3 at delivery 15 (found ${stateAfterWicket.wickets})`);

  // Move to end of Innings 1: Total wickets should now be 8 (was 7 baseline)
  playSession.seekTo(0, 126);
  const endInningsStateWithOut = playSession.getCurrentState();
  assert(
    endInningsStateWithOut.score === 176,
    `S10.34: End of innings score remains 176 (found ${endInningsStateWithOut.score})`
  );
  assert(
    endInningsStateWithOut.wickets === 8,
    `S10.35: End of innings wickets increases from 7 to 8 (found ${endInningsStateWithOut.wickets})`
  );

  // 7. Removing overlay restores canonical baseline outcome
  const removed = playSession.removeOverlay("1_2_3");
  assert(removed === true, "S10.36: Overlay was removed");
  playSession.seekTo(0, deliveryIndex);
  const restoredBall = playSession.getCurrentDelivery()!;
  assert(restoredBall.isOverridden === false, "S10.37: Ball is no longer overridden");
  assert(restoredBall.effectiveOutcome.wicket === undefined, "S10.38: Ball wicket is undefined again");
  const restoredStateAtDelivery = playSession.getCurrentState();
  assert(restoredStateAtDelivery.wickets === 2, "S10.39: Wickets restored to baseline 2");

  playSession.seekTo(0, 126);
  const restoredEndState = playSession.getCurrentState();
  assert(restoredEndState.wickets === 7, "S10.40: Innings end wickets restored to baseline 7");

  // --------------------------------------------------------------------------
  // Sub-scenario 2: LBW NOT OUT (South Africa review fails: NOT OUT upheld)
  // Ball missing leg stump -> NOT OUT confirmed -> Bowling review deducted to 1.
  // Effective delivery retains baseline non-wicket outcome; no wicket added.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 2: LBW NOT OUT via DRS Confirmation -");
  const lbwNotOutData: LBWData = {
    isNoBall: false,
    frontFootOverstepMm: 0,
    batContactBeforePad: false,
    firstContactType: "PAD_FIRST",
    ultraEdgeSpikeAtBatFrame: false,
    pitchingZone: "IN_LINE",
    impactZone: "IN_LINE",
    impactHeight: 48,
    projectedStumpHit: "MISSING", // Ball missing leg stump
    impactDistance: 2.2,
    batterHand: "RIGHT",
    shotOffered: true,
    spinOrPace: "PACE",
    ballSpeedKph: 140,
    pitchX: 0.05,
    impactX: 0.12,
    stumpHitX: 0.28,
    stumpHitHeightCm: 45,
    hawkeyeTrajectory: [],
  };

  const drsEvalNotOut = evaluateDRSLBW(lbwNotOutData, "NOT_OUT");
  assert(drsEvalNotOut.correctFinalVerdict === "NOT_OUT", "S10.41: DRS verdict is NOT_OUT");
  assert(drsEvalNotOut.overturnRequired === false, "S10.42: No overturn required; NOT OUT stands");
  assert(drsEvalNotOut.failedGate === "GATE_3_MISSING_WICKETS", "S10.43: Failed gate is missing wickets");

  const consequenceNotOut = createLbwDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalNotOut.correctFinalVerdict,
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    reason: drsEvalNotOut.explanation,
    isUmpiresCall: drsEvalNotOut.isUmpiresCall,
  });

  assert(consequenceNotOut.ballId === "1_2_3", "S10.44: Consequence targets 1_2_3");
  assert(consequenceNotOut.drsOutcome.wicket === undefined, "S10.45: Effective outcome has NO wicket");
  assert(consequenceNotOut.reviewRetained === false, "S10.46: Bowling review NOT retained (lost)");

  playSession.applyOverlay(consequenceNotOut);
  playSession.seekTo(0, deliveryIndex);
  const stateAfterNotOutReview = playSession.getCurrentState();
  assert(
    stateAfterNotOutReview.wickets === 2,
    `S10.47: Wickets at 1_2_3 remains baseline 2 (found ${stateAfterNotOutReview.wickets})`
  );
  assert(
    stateAfterNotOutReview.score === 23,
    `S10.48: Score at 1_2_3 remains baseline 23 (found ${stateAfterNotOutReview.score})`
  );
  assert(
    stateAfterNotOutReview.remainingReviews?.bowling === 1,
    `S10.49: Bowling team lost a review: now 1 (found ${stateAfterNotOutReview.remainingReviews?.bowling})`
  );
  assert(
    stateAfterNotOutReview.remainingReviews?.batting === 2,
    "S10.50: Batting team reviews untouched at 2"
  );
}

// ============================================================================
// SUITE 11: IMMUTABILITY, ZERO-COPY & REPLAY DETERMINISM GUARANTEES
// ============================================================================
console.log("\n--- Suite 11: Immutability, Zero-Copy & Replay Determinism ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn1 = fixture.innings[0];
  const targetDelivery = inn1.deliveries[14];

  // 1. Target delivery and its outcome objects remain strictly frozen
  assert(Object.isFrozen(targetDelivery), "S11.1: Target delivery is frozen");
  assert(Object.isFrozen(targetDelivery.outcome), "S11.2: Target delivery outcome is frozen");

  // 2. Deliveries array reference identity is strictly preserved
  const originalDeliveriesRef = inn1.deliveries;
  const originalInningsRef = fixture.innings;

  const session = new RealMatchPlaybackSession(fixture);
  const lbwOverride = createLbwDrsConsequence({
    delivery: targetDelivery,
    verdict: "OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    reason: "Pitching in-line, impact in-line, hitting",
  });
  session.applyOverlay(lbwOverride);

  assert(
    fixture.innings === originalInningsRef,
    "S11.3: fixture.innings reference is unchanged"
  );
  assert(
    fixture.innings[0].deliveries === originalDeliveriesRef,
    "S11.4: Innings deliveries array reference is unchanged (zero-copy)"
  );
  assert(
    fixture.innings[0].deliveries[14] === targetDelivery,
    "S11.5: Target delivery object reference is unchanged"
  );
  assert(
    targetDelivery.outcome.wicket === undefined,
    "S11.6: Target delivery outcome is completely untouched"
  );

  // 3. Deterministic replay equality: two sessions with identical overlay produce identical state traces
  const sessionA = new RealMatchPlaybackSession(fixture);
  const sessionB = new RealMatchPlaybackSession(fixture);
  sessionA.applyOverlay(lbwOverride);
  sessionB.applyOverlay(lbwOverride);

  for (let d = 0; d < 20; d++) {
    sessionA.seekTo(0, d);
    sessionB.seekTo(0, d);
    const stateA = sessionA.getCurrentState();
    const stateB = sessionB.getCurrentState();
    assert(
      stateA.score === stateB.score &&
      stateA.wickets === stateB.wickets &&
      stateA.deliveryIndex === stateB.deliveryIndex &&
      stateA.remainingReviews?.bowling === stateB.remainingReviews?.bowling,
      `S11.7.${d}: Replay state parity strictly identical at ball ${d}`
    );
  }
}

// ============================================================================
// SUITE 12: EXTENDED LBW DRS CONFLICT RESOLUTION & REVERSAL EDGE CASES
// ============================================================================
console.log("\n--- Suite 12: Batting Reviews, Umpire's Call & Multi-Overlay In-Innings ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn1Deliveries = fixture.innings[0].deliveries;

  // 1. Batting review overturning on-field OUT -> NOT_OUT (wicket stripped, review retained)
  // Take ball 1_1_6 (deliveryIndex 11: RR Pant caught by de Kock)
  const caughtDelivery = inn1Deliveries[11];
  assert(caughtDelivery.outcome.wicket?.playerOut === "RR Pant", "S12.1: Delivery 1_1_6 baseline wicket is RR Pant");

  const battingOverturn = createLbwDrsConsequence({
    delivery: caughtDelivery,
    verdict: "NOT_OUT",
    onFieldSignal: "OUT",
    reviewingSide: "BATTING",
    reason: "UltraEdge confirms inside edge before pad / bat before wicket",
  });
  assert(battingOverturn.reviewRetained === true, "S12.2: Batting review retained on successful overturn");
  assert(battingOverturn.drsOutcome.wicket === undefined, "S12.3: Overturned outcome has no wicket");

  const session = new RealMatchPlaybackSession(fixture);
  session.applyOverlay(battingOverturn);
  session.seekTo(0, 11);
  const stateAt11 = session.getCurrentState();
  assert(stateAt11.wickets === 1, `S12.4: Wickets at ball 11 is 1 instead of 2 (found ${stateAt11.wickets})`);
  assert(stateAt11.remainingReviews?.batting === 2, "S12.5: Batting reviews remain 2");

  // 2. Bowling review with Umpire's Call: NOT_OUT stands, but review is retained!
  const targetBall14 = inn1Deliveries[14];
  const umpiresCallBowling = createLbwDrsConsequence({
    delivery: targetBall14,
    verdict: "NOT_OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    isUmpiresCall: true,
    reason: "Wickets: Umpire's Call (clipping leg stump)",
  });
  assert(umpiresCallBowling.reviewRetained === true, "S12.6: Bowling review retained on Umpire's Call");
  session.applyOverlay(umpiresCallBowling);
  session.seekTo(0, 14);
  const stateAt14 = session.getCurrentState();
  assert(stateAt14.remainingReviews?.bowling === 2, "S12.7: Bowling reviews still 2 due to Umpire's Call");

  // 3. Batting review with Umpire's Call: OUT confirmed, but review is retained!
  const umpiresCallBatting = createLbwDrsConsequence({
    delivery: targetBall14,
    verdict: "OUT",
    onFieldSignal: "OUT",
    reviewingSide: "BATTING",
    isUmpiresCall: true,
    reason: "Wickets: Umpire's Call (clipping leg stump)",
  });
  assert(umpiresCallBatting.reviewRetained === true, "S12.8: Batting review retained on Umpire's Call");

  // 4. Simultaneous multiple overlays in the same innings
  // Re-apply LBW OUT on ball 1_2_3 (deliveryIndex 14) while ball 1_1_6 is still overturned to NOT OUT
  const lbwOut14 = createLbwDrsConsequence({
    delivery: targetBall14,
    verdict: "OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    reason: "Hitting middle stump",
  });
  session.applyOverlay(lbwOut14);
  // Now session has:
  // - 1_1_6: baseline OUT -> overridden NOT_OUT (-1 wicket)
  // - 1_2_3: baseline NOT_OUT -> overridden OUT (+1 wicket)
  // Net wickets at ball 14 should equal baseline wickets (2)
  session.seekTo(0, 14);
  const multiOverlayState = session.getCurrentState();
  assert(multiOverlayState.wickets === 2, `S12.9: Net wickets at ball 14 remains 2 (found ${multiOverlayState.wickets})`);

  // Verify at innings end: baseline 7 wickets -> -1 + 1 = 7 wickets
  session.seekTo(0, 126);
  const multiOverlayEndState = session.getCurrentState();
  assert(multiOverlayEndState.wickets === 7, `S12.10: End of innings wickets is 7 (found ${multiOverlayEndState.wickets})`);
}

// ============================================================================
// SUITE 13: RUN OUT DRS INTEGRATION WITH VERIFIED 2024 T20 WC FINAL FIXTURE
// Proves the complete flow:
// Real delivery (1_0_1: Rohit Sharma facing Marco Jansen, 1 run scored)
//    ↓
// Run Out DRS incident (crease margin / bails dislodgement timeline)
//    ↓
// Existing Run Out rule evaluation (evaluateRunOut)
//    ↓
// Umpire referral or DRS review verdict (OUT or NOT_OUT)
//    ↓
// Sparse DRS overlay (createRunOutDrsConsequence)
//    ↓
// Effective match outcome (preserves completed runs, assigns correct batter)
// Note: Injected incidents are fictional gameplay overlays for consequence testing.
// ============================================================================
console.log("\n--- Suite 13: Run Out DRS Integration with 2024 T20 WC Final Fixture ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn1Deliveries = fixture.innings[0].deliveries;

  // Selected delivery: 1_0_1 (Innings 1, Over 0, Ball 1, deliveryIndex: 0)
  // Striker: RG Sharma, Non-striker: V Kohli, Bowler: M Jansen
  // Baseline outcome: 1 run off bat, no wicket
  const deliveryIndex = 0;
  const realDelivery = inn1Deliveries[deliveryIndex];

  assert(realDelivery.id === "1_0_1", "S13.1: Target delivery is 1_0_1");
  assert(realDelivery.striker === "RG Sharma", "S13.2: Striker is RG Sharma");
  assert(realDelivery.nonStriker === "V Kohli", "S13.3: Non-striker is V Kohli");
  assert(realDelivery.outcome.runsBatter === 1, "S13.4: Baseline runs off bat is 1");
  assert(realDelivery.outcome.wicket === undefined, "S13.5: Baseline has no wicket");

  // --------------------------------------------------------------------------
  // Sub-scenario 1: Striker Run Out (RG Sharma) - Umpire Referral OUT
  // Batters run a single; throw comes in to keeper end; RG Sharma is short of crease.
  // Law 38 consequence: 1 run scored stands + RG Sharma is RUN OUT.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 1: Striker Run Out (RG Sharma OUT, 1 run preserved) -");
  const runOutStrikerData: RunOutData = {
    bailsDislodgedFrameMs: 1450,
    groundedFrameMs: 1490,
    marginMs: 40, // +40ms short of crease -> OUT
    batGrounded: false,
    batBounced: false,
    diveType: "SLIDE",
    creaseMarginMm: -35,
    fielderThrow: "KA Maharaj",
    keeperOrBowler: "Q de Kock",
  };

  const drsEvalStrikerOut = evaluateRunOut(runOutStrikerData, "REFERRED");
  assert(drsEvalStrikerOut.correctFinalVerdict === "OUT", "S13.6: DRS verdict is OUT");
  assert(drsEvalStrikerOut.ruleCitation.includes("Law 29 / 38"), "S13.7: Rule citation is Law 29 / 38");

  const runOutStrikerConsequence = createRunOutDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalStrikerOut.correctFinalVerdict,
    onFieldSignal: "REFERRED",
    dismissedBatter: "RG Sharma",
    fielders: ["KA Maharaj", "Q de Kock"],
    reason: drsEvalStrikerOut.explanation,
  });

  assert(runOutStrikerConsequence.ballId === "1_0_1", "S13.8: Override targets ballId 1_0_1");
  assert(runOutStrikerConsequence.applied === true, "S13.9: Override is marked applied");
  assert(runOutStrikerConsequence.drsOutcome.runsBatter === 1, "S13.10: Delivery runsBatter 1 is strictly preserved");
  assert(runOutStrikerConsequence.drsOutcome.wicket !== undefined, "S13.11: Effective outcome includes wicket");
  assert(runOutStrikerConsequence.drsOutcome.wicket?.kind === "RUN_OUT", "S13.12: Dismissal kind is RUN_OUT");
  assert(runOutStrikerConsequence.drsOutcome.wicket?.playerOut === "RG Sharma", "S13.13: Dismissed player is RG Sharma");
  assert(runOutStrikerConsequence.drsOutcome.wicket?.fielders?.[0] === "KA Maharaj", "S13.14: Thrower recorded as KA Maharaj");
  assert(runOutStrikerConsequence.reviewingSide === undefined, "S13.15: Umpire referral has no reviewingSide");
  assert(runOutStrikerConsequence.reviewRetained === true, "S13.16: Review retained is true (no review lost)");

  // Apply to session and test playback state
  const runOutSession = new RealMatchPlaybackSession(fixture);
  runOutSession.applyOverlay(runOutStrikerConsequence);
  runOutSession.seekTo(0, 0);

  const stateAtBall0 = runOutSession.getCurrentState();
  assert(stateAtBall0.score === 1, `S13.17: Score at ball 0 is 1 (found ${stateAtBall0.score})`);
  assert(stateAtBall0.wickets === 1, `S13.18: Wickets at ball 0 is 1 (found ${stateAtBall0.wickets})`);
  assert(stateAtBall0.remainingReviews?.bowling === 2, "S13.19: Bowling reviews untouched at 2");
  assert(stateAtBall0.remainingReviews?.batting === 2, "S13.20: Batting reviews untouched at 2");

  // Step forward to ball 1 (1_0_2: V Kohli 4 runs)
  runOutSession.stepForward();
  const stateAtBall1 = runOutSession.getCurrentState();
  assert(stateAtBall1.score === 5, `S13.21: Score at ball 1 is 5 (1 + 4 = 5, found ${stateAtBall1.score})`);
  assert(stateAtBall1.wickets === 1, `S13.22: Wickets remains 1 at ball 1 (found ${stateAtBall1.wickets})`);

  // Verify at end of Innings 1: Total wickets increases from 7 to 8
  runOutSession.seekTo(0, 126);
  const inn1EndWithRunOut = runOutSession.getCurrentState();
  assert(inn1EndWithRunOut.score === 176, "S13.23: Innings 1 score remains 176");
  assert(inn1EndWithRunOut.wickets === 8, "S13.24: Innings 1 wickets is 8 (baseline 7 + 1 run out)");

  // --------------------------------------------------------------------------
  // Sub-scenario 2: Non-striker Run Out (V Kohli) via dismissedEnd
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 2: Non-striker Run Out (V Kohli OUT via dismissedEnd) -");
  const runOutNonStrikerConsequence = createRunOutDrsConsequence({
    delivery: realDelivery,
    verdict: "OUT",
    onFieldSignal: "REFERRED",
    dismissedEnd: "NON_STRIKER",
    fielders: ["M Jansen"],
    reason: "Bowler deflected ball onto non-striker stumps while V Kohli backed up too far",
  });

  assert(
    runOutNonStrikerConsequence.drsOutcome.wicket?.playerOut === "V Kohli",
    "S13.25: Non-striker V Kohli is correctly identified as playerOut"
  );
  assert(
    runOutNonStrikerConsequence.drsOutcome.runsBatter === 1,
    "S13.26: 1 run is preserved when non-striker is run out"
  );

  // --------------------------------------------------------------------------
  // Sub-scenario 3: Explicit completed runs on multiple-run delivery (1_0_4, 2 runs)
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 3: Completed runs override on multiple-run delivery -");
  const delivery104 = inn1Deliveries[3]; // 1_0_4: 2 runs
  assert(delivery104.id === "1_0_4", "S13.27: Delivery 1_0_4 verified");
  assert(delivery104.outcome.runsBatter === 2, "S13.28: Baseline runs is 2");

  const runOutThirdRunConsequence = createRunOutDrsConsequence({
    delivery: delivery104,
    verdict: "OUT",
    runsCompleted: 2, // completed 2 runs, run out attempting 3rd run
    dismissedBatter: "V Kohli",
    reason: "Batters completed 2 runs; run out attempting 3rd",
  });
  assert(
    runOutThirdRunConsequence.drsOutcome.runsBatter === 2,
    "S13.29: Completed runs explicitly set to 2"
  );
  assert(
    runOutThirdRunConsequence.drsOutcome.wicket?.playerOut === "V Kohli",
    "S13.30: Dismissed batter is V Kohli"
  );

  // --------------------------------------------------------------------------
  // Sub-scenario 4: Run Out NOT OUT (safe reach)
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 4: Run Out NOT OUT (safe reach) -");
  const runOutSafeData: RunOutData = {
    bailsDislodgedFrameMs: 1450,
    groundedFrameMs: 1410,
    marginMs: -40, // -40ms grounded before dislodgement -> NOT OUT
    batGrounded: true,
    batBounced: false,
    diveType: "DIVE",
    creaseMarginMm: 25,
    fielderThrow: "KA Maharaj",
    keeperOrBowler: "Q de Kock",
  };

  const drsEvalSafe = evaluateRunOut(runOutSafeData, "REFERRED");
  assert(drsEvalSafe.correctFinalVerdict === "NOT_OUT", "S13.31: DRS verdict is NOT_OUT");

  const runOutSafeConsequence = createRunOutDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalSafe.correctFinalVerdict,
    onFieldSignal: "REFERRED",
    reason: drsEvalSafe.explanation,
  });

  assert(runOutSafeConsequence.drsOutcome.wicket === undefined, "S13.32: Safe consequence has NO wicket");
  assert(runOutSafeConsequence.drsOutcome.runsBatter === 1, "S13.33: 1 run preserved on NOT OUT");

  // --------------------------------------------------------------------------
  // Sub-scenario 5: Team review quota behavior on Run Out
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 5: Team review quota handling for Run Out -");
  // Bowling team reviews on-field NOT_OUT, verdict is NOT_OUT -> review lost
  const unsuccessfulBowlingReview = createRunOutDrsConsequence({
    delivery: realDelivery,
    verdict: "NOT_OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    reason: "Batter grounded bat before bails dislodged",
  });
  assert(unsuccessfulBowlingReview.reviewRetained === false, "S13.34: Bowling review lost on confirmed NOT OUT");

  // Bowling team reviews on-field NOT_OUT, verdict is OUT -> review retained
  const successfulBowlingReview = createRunOutDrsConsequence({
    delivery: realDelivery,
    verdict: "OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    reason: "Batter short of crease",
  });
  assert(successfulBowlingReview.reviewRetained === true, "S13.35: Bowling review retained on overturn to OUT");

  // Batting team reviews on-field OUT, verdict is NOT_OUT -> review retained
  const successfulBattingReview = createRunOutDrsConsequence({
    delivery: realDelivery,
    verdict: "NOT_OUT",
    onFieldSignal: "OUT",
    reviewingSide: "BATTING",
    reason: "Batter grounded bat before bails dislodged",
  });
  assert(successfulBattingReview.reviewRetained === true, "S13.36: Batting review retained on overturn to NOT OUT");

  // --------------------------------------------------------------------------
  // Sub-scenario 6: Overlay removal restores baseline
  // --------------------------------------------------------------------------
  const sessionToClear = new RealMatchPlaybackSession(fixture);
  sessionToClear.applyOverlay(runOutStrikerConsequence);
  assert(sessionToClear.getCurrentState().wickets === 1, "S13.37: Wicket present with overlay");
  sessionToClear.removeOverlay("1_0_1");
  assert(sessionToClear.getCurrentState().wickets === 0, "S13.38: Baseline restored after removeOverlay");
}

// ============================================================================
// SUITE 14: STUMPING DRS INTEGRATION WITH VERIFIED 2024 T20 WC FINAL FIXTURE
// Proves the complete flow:
// Real delivery (1_9_1: Axar Patel facing Tabraiz Shamsi, dot ball)
//    ↓
// Stumping DRS incident (crease margin / toe airborne / bails dislodgement)
//    ↓
// Existing Stumping rule evaluation (evaluateStumping)
//    ↓
// Law 39 rule check (including No Ball protection)
//    ↓
// Sparse DRS overlay (createStumpingDrsConsequence)
//    ↓
// Effective match outcome (OUT / NOT OUT / No Ball safety)
// ============================================================================
console.log("\n--- Suite 14: Stumping DRS Integration with 2024 T20 WC Final Fixture ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn1Deliveries = fixture.innings[0].deliveries;

  // Selected delivery: 1_9_3 (Innings 1, Over 9, Ball 3, deliveryIndex: 56)
  // Striker: AR Patel, Non-striker: V Kohli, Bowler: T Shamsi (wrist spinner)
  // Baseline outcome: 0 runs off bat, dot ball, no wicket
  const deliveryIndex = 56;
  const realDelivery = inn1Deliveries[deliveryIndex];

  assert(realDelivery.id === "1_9_3", "S14.1: Target delivery is 1_9_3");
  assert(realDelivery.striker === "AR Patel", "S14.2: Striker is AR Patel");
  assert(realDelivery.bowler === "T Shamsi", "S14.3: Bowler is T Shamsi");
  assert(realDelivery.outcome.runsBatter === 0, "S14.4: Baseline runs off bat is 0");
  assert(realDelivery.outcome.wicket === undefined, "S14.5: Baseline outcome has no wicket");

  // Verify baseline state at delivery 56
  const baseSession = new RealMatchPlaybackSession(fixture);
  baseSession.seekTo(0, deliveryIndex);
  const baselineStateAt56 = baseSession.getCurrentState();
  assert(baselineStateAt56.score === 70, `S14.6: Baseline score at delivery 56 is 70 (found ${baselineStateAt56.score})`);
  assert(baselineStateAt56.wickets === 3, `S14.7: Baseline wickets at delivery 56 is 3 (found ${baselineStateAt56.wickets})`);

  // --------------------------------------------------------------------------
  // Sub-scenario 1: Stumping OUT
  // Axar steps out to Shamsi, misses spin, de Kock whips bails with rear foot airborne.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 1: Stumping OUT -");
  const stumpingOutData: StumpingData = {
    bailsDislodgedFrameMs: 1500,
    groundedFrameMs: 1545,
    marginMs: 45, // +45ms behind bails dislodged -> OUT
    creaseMarginMm: -18,
    footGrounded: false,
    heelRaised: true,
    toeAirborneAtBreak: true,
    ballArrivalMs: 1040,
    keeperGatherMs: 1160,
    keeperWhipMs: 1350,
    batterStanceCreaseX: 420,
    keeperOrBowler: "Wicketkeeper",
  };

  const drsEvalStumpingOut = evaluateStumping(stumpingOutData, "REFERRED");
  assert(drsEvalStumpingOut.correctFinalVerdict === "OUT", "S14.8: DRS stumping verdict is OUT");
  assert(drsEvalStumpingOut.ruleCitation === "Law 39 - Stumped", "S14.9: Rule citation is Law 39 - Stumped");

  const stumpingOutConsequence = createStumpingDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalStumpingOut.correctFinalVerdict,
    onFieldSignal: "REFERRED",
    dismissedBatter: "AR Patel",
    wicketkeeper: "Q de Kock",
    reason: drsEvalStumpingOut.explanation,
  });

  assert(stumpingOutConsequence.ballId === "1_9_3", "S14.10: Targets ballId 1_9_3");
  assert(stumpingOutConsequence.applied === true, "S14.11: Applied is true");
  assert(stumpingOutConsequence.drsOutcome.runsBatter === 0, "S14.12: Batter runs remains 0");
  assert(stumpingOutConsequence.drsOutcome.wicket !== undefined, "S14.13: Effective outcome includes wicket");
  assert(stumpingOutConsequence.drsOutcome.wicket?.kind === "STUMPED", "S14.14: Dismissal kind is STUMPED");
  assert(stumpingOutConsequence.drsOutcome.wicket?.playerOut === "AR Patel", "S14.15: Dismissed player is AR Patel");
  assert(stumpingOutConsequence.drsOutcome.wicket?.fielders?.[0] === "Q de Kock", "S14.16: Wicketkeeper is Q de Kock");

  // Apply to session and test playback state
  const stumpingSession = new RealMatchPlaybackSession(fixture);
  stumpingSession.applyOverlay(stumpingOutConsequence);
  stumpingSession.seekTo(0, deliveryIndex);

  const stateWithStumping = stumpingSession.getCurrentState();
  assert(stateWithStumping.score === 70, `S14.17: Score remains 70 (found ${stateWithStumping.score})`);
  assert(stateWithStumping.wickets === 4, `S14.18: Wickets increments from 3 to 4 (found ${stateWithStumping.wickets})`);

  // End of Innings 1 wickets increases from 7 to 8
  stumpingSession.seekTo(0, 126);
  const endInningsStateStumped = stumpingSession.getCurrentState();
  assert(endInningsStateStumped.wickets === 8, "S14.19: End of innings wickets is 8");

  // --------------------------------------------------------------------------
  // Sub-scenario 2: Stumping NOT OUT (grounded behind crease)
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 2: Stumping NOT OUT -");
  const stumpingNotOutData: StumpingData = {
    bailsDislodgedFrameMs: 1500,
    groundedFrameMs: 1470,
    marginMs: -30, // safely grounded 30ms before bails broken
    creaseMarginMm: 12,
    footGrounded: true,
    heelRaised: false,
    toeAirborneAtBreak: false,
    ballArrivalMs: 1040,
    keeperGatherMs: 1160,
    keeperWhipMs: 1350,
    batterStanceCreaseX: 420,
    keeperOrBowler: "Wicketkeeper",
  };

  const drsEvalStumpingNotOut = evaluateStumping(stumpingNotOutData, "REFERRED");
  assert(drsEvalStumpingNotOut.correctFinalVerdict === "NOT_OUT", "S14.20: DRS stumping verdict is NOT_OUT");

  const stumpingNotOutConsequence = createStumpingDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalStumpingNotOut.correctFinalVerdict,
    onFieldSignal: "REFERRED",
    dismissedBatter: "AR Patel",
    wicketkeeper: "Q de Kock",
    reason: drsEvalStumpingNotOut.explanation,
  });

  assert(stumpingNotOutConsequence.drsOutcome.wicket === undefined, "S14.21: Outcome has NO wicket");
  assert(stumpingNotOutConsequence.drsOutcome.runsBatter === 0, "S14.22: Batter runs is 0");

  stumpingSession.applyOverlay(stumpingNotOutConsequence);
  stumpingSession.seekTo(0, deliveryIndex);
  const stateAfterNotOut = stumpingSession.getCurrentState();
  assert(stateAfterNotOut.wickets === 3, "S14.23: Wickets remains baseline 3");

  // --------------------------------------------------------------------------
  // Sub-scenario 3: Stumping No Ball handling (Law 39.1 Protection)
  // Law 39.1: Batter CANNOT be stumped off a No Ball.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 3: Stumping No Ball handling (Law 39.1) -");
  // Test 3a: Explicit isNoBall parameter overrides requested OUT verdict to NOT_OUT
  const stumpingNoBallConsequence = createStumpingDrsConsequence({
    delivery: realDelivery,
    verdict: "OUT",
    isNoBall: true,
    dismissedBatter: "AR Patel",
    wicketkeeper: "Q de Kock",
  });

  assert(stumpingNoBallConsequence.drsOutcome.wicket === undefined, "S14.24: No wicket on No Ball delivery per Law 39.1");
  assert(Boolean(stumpingNoBallConsequence.reason?.includes("Law 39.1")), "S14.25: Reason explains Law 39.1 No Ball protection");

  // Test 3b: Delivery with baseline No Ball extra protects batter automatically
  const syntheticNoBallDelivery: RealDelivery = {
    ...realDelivery,
    id: "1_9_1_nb",
    outcome: {
      runsBatter: 0,
      runsExtras: 1,
      extras: { type: "NO_BALLS", runs: 1 },
    },
  };

  const stumpingOnBaselineNoBall = createStumpingDrsConsequence({
    delivery: syntheticNoBallDelivery,
    verdict: "OUT",
  });
  assert(stumpingOnBaselineNoBall.drsOutcome.wicket === undefined, "S14.26: Baseline No Ball prevents stumping wicket");
  assert(stumpingOnBaselineNoBall.drsOutcome.runsExtras === 1, "S14.27: 1 No Ball extra run is preserved");
  assert(stumpingOnBaselineNoBall.drsOutcome.extras?.type === "NO_BALLS", "S14.28: Extras type NO_BALLS preserved");

  // --------------------------------------------------------------------------
  // Sub-scenario 4: Stumping off Wide (Permitted under Law 39.1)
  // Delivery 2_19_5 is a real Wide bowled by HH Pandya (1 run extra)
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 4: Stumping off Wide delivery (Law 39.1) -");
  const wideDelivery = fixture.innings[1].deliveries[121]; // 2_19_5: WIDE
  assert(wideDelivery.outcome.extras?.type === "WIDES", "S14.29: Delivery is a Wide");

  const stumpingOffWideConsequence = createStumpingDrsConsequence({
    delivery: wideDelivery,
    verdict: "OUT",
    wicketkeeper: "RR Pant",
  });
  assert(stumpingOffWideConsequence.drsOutcome.wicket !== undefined, "S14.30: Stumping off Wide IS a wicket");
  assert(stumpingOffWideConsequence.drsOutcome.wicket?.kind === "STUMPED", "S14.31: Dismissal is STUMPED");
  assert(stumpingOffWideConsequence.drsOutcome.runsExtras === 1, "S14.32: Wide extra is preserved");
  assert(stumpingOffWideConsequence.drsOutcome.extras?.type === "WIDES", "S14.33: Wide extras type preserved");

  // --------------------------------------------------------------------------
  // Sub-scenario 5: Overlay removal restores baseline
  // --------------------------------------------------------------------------
  stumpingSession.removeOverlay("1_9_3");
  stumpingSession.seekTo(0, deliveryIndex);
  assert(stumpingSession.getCurrentState().wickets === 3, "S14.34: Removing overlay restores baseline wickets 3");
}


// ============================================================================
// SUITE 15: CAUGHT BEHIND DRS INTEGRATION WITH VERIFIED 2024 T20 WC FINAL FIXTURE
// Proves the complete flow:
// Real delivery (1_1_6: Rishabh Pant caught behind by Quinton de Kock off Keshav Maharaj)
//    ↓
// Caught Behind DRS incident (UltraEdge acoustic spike / daylight gap)
//    ↓
// Existing Caught Behind rule evaluation (evaluateCaughtBehind)
//    ↓
// Sparse DRS overlay (createCaughtBehindDrsConsequence)
//    ↓
// Effective match outcome (overturn OUT -> NOT OUT strips wicket & retains review;
//                          overturn NOT OUT -> OUT adds caught dismissal)
// ============================================================================
console.log("\n--- Suite 15: Caught Behind DRS Integration with 2024 T20 WC Final Fixture ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn1Deliveries = fixture.innings[0].deliveries;

  // Selected delivery: 1_1_6 (Innings 1, Over 1, Ball 6, deliveryIndex: 11)
  // Striker: RR Pant, Non-striker: V Kohli, Bowler: KA Maharaj
  // Baseline outcome: CAUGHT by Q de Kock, 0 runs
  const deliveryIndex = 11;
  const realDelivery = inn1Deliveries[deliveryIndex];

  assert(realDelivery.id === "1_1_6", "S15.1: Target delivery is 1_1_6");
  assert(realDelivery.striker === "RR Pant", "S15.2: Striker is RR Pant");
  assert(realDelivery.bowler === "KA Maharaj", "S15.3: Bowler is KA Maharaj");
  assert(realDelivery.outcome.wicket?.kind === "CAUGHT", "S15.4: Baseline has CAUGHT dismissal");
  assert(realDelivery.outcome.wicket?.playerOut === "RR Pant", "S15.5: Baseline playerOut is RR Pant");
  assert(realDelivery.outcome.wicket?.fielders?.[0] === "Q de Kock", "S15.6: Catcher is Q de Kock");

  // --------------------------------------------------------------------------
  // Sub-scenario 1: Overturn on-field OUT to NOT OUT (Batting Review)
  // UltraEdge shows clear daylight gap; acoustic noise was bat scraping ground / pad.
  // Law 33 consequence: Decision overturned to NOT OUT, wicket removed, review retained.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 1: Batting Review Overturns OUT to NOT OUT -");
  const caughtBehindNotOutData: CaughtBehindData = {
    hasEdge: false,
    waveformSpikeTimeMs: null,
    distractorNoise: true,
    distractorTimeMs: 1420,
    distractorType: "PAD",
    proximityFrameMs: 1400,
    spikeIntensity: 0.1,
    ballPassesBatFrameMs: 1400,
    gapMm: 14,
    soundType: "DULL_THUD",
  };

  const drsEvalNotOut = evaluateCaughtBehind(caughtBehindNotOutData, "OUT");
  assert(drsEvalNotOut.correctFinalVerdict === "NOT_OUT", "S15.7: DRS verdict is NOT_OUT");
  assert(drsEvalNotOut.overturnRequired === true, "S15.8: Overturn required from OUT to NOT_OUT");

  const cbNotOutConsequence = createCaughtBehindDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalNotOut.correctFinalVerdict,
    onFieldSignal: "OUT",
    reviewingSide: "BATTING",
    dismissedBatter: "RR Pant",
    catcher: "Q de Kock",
    reason: drsEvalNotOut.explanation,
  });

  assert(cbNotOutConsequence.ballId === "1_1_6", "S15.9: Target ballId is 1_1_6");
  assert(cbNotOutConsequence.applied === true, "S15.10: Applied is true");
  assert(cbNotOutConsequence.reviewingSide === "BATTING", "S15.11: Reviewing side is BATTING");
  assert(cbNotOutConsequence.reviewRetained === true, "S15.12: Batting review retained on successful overturn");
  assert(cbNotOutConsequence.drsOutcome.wicket === undefined, "S15.13: Effective outcome strips the wicket");
  assert(cbNotOutConsequence.drsOutcome.runsBatter === 0, "S15.14: Runs off bat remains 0");

  // Apply to session: wickets at delivery 11 should be 1 instead of baseline 2
  const cbSession = new RealMatchPlaybackSession(fixture);
  cbSession.applyOverlay(cbNotOutConsequence);
  cbSession.seekTo(0, deliveryIndex);

  const stateOverturnedToNotOut = cbSession.getCurrentState();
  assert(stateOverturnedToNotOut.score === 23, "S15.15: Score at ball 11 remains 23");
  assert(stateOverturnedToNotOut.wickets === 1, `S15.16: Wickets at ball 11 reduced to 1 (found ${stateOverturnedToNotOut.wickets})`);
  assert(stateOverturnedToNotOut.remainingReviews?.batting === 2, "S15.17: Batting reviews retained at 2");

  // End of Innings 1 wickets should be 6 (was 7 baseline)
  cbSession.seekTo(0, 126);
  const inn1EndWithoutPantWicket = cbSession.getCurrentState();
  assert(inn1EndWithoutPantWicket.wickets === 6, "S15.18: Innings 1 wickets reduced to 6");

  // --------------------------------------------------------------------------
  // Sub-scenario 2: Overturn on-field NOT OUT to OUT (Bowling Review on 1_2_1)
  // Delivery 1_2_1: V Kohli facing K Rabada, baseline dot ball.
  // Bowler reviews; UltraEdge confirms acoustic spike at edge passing frame.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 2: Bowling Review Overturns NOT OUT to OUT -");
  const delivery121 = inn1Deliveries[12]; // 1_2_1: V Kohli dot ball
  assert(delivery121.id === "1_2_1", "S15.19: Delivery 1_2_1 verified");
  assert(delivery121.outcome.wicket === undefined, "S15.20: Baseline has no wicket");

  const caughtBehindOutData: CaughtBehindData = {
    hasEdge: true,
    waveformSpikeTimeMs: 1380,
    distractorNoise: false,
    distractorTimeMs: null,
    distractorType: null,
    proximityFrameMs: 1380,
    spikeIntensity: 0.88,
    ballPassesBatFrameMs: 1380,
    gapMm: 0,
    soundType: "WOODY_SNICK",
  };

  const drsEvalOut = evaluateCaughtBehind(caughtBehindOutData, "NOT_OUT");
  assert(drsEvalOut.correctFinalVerdict === "OUT", "S15.21: DRS verdict is OUT");
  assert(drsEvalOut.overturnRequired === true, "S15.22: Overturn required from NOT_OUT to OUT");

  const cbOutConsequence = createCaughtBehindDrsConsequence({
    delivery: delivery121,
    verdict: drsEvalOut.correctFinalVerdict,
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    dismissedBatter: "V Kohli",
    catcher: "Q de Kock",
    reason: drsEvalOut.explanation,
  });

  assert(cbOutConsequence.drsOutcome.wicket !== undefined, "S15.23: Effective outcome has wicket");
  assert(cbOutConsequence.drsOutcome.wicket?.kind === "CAUGHT", "S15.24: Dismissal kind is CAUGHT");
  assert(cbOutConsequence.drsOutcome.wicket?.playerOut === "V Kohli", "S15.25: Dismissed player is V Kohli");
  assert(cbOutConsequence.drsOutcome.wicket?.fielders?.[0] === "Q de Kock", "S15.26: Catcher recorded as Q de Kock");
  assert(cbOutConsequence.reviewRetained === true, "S15.27: Bowling review retained on successful overturn");

  cbSession.applyOverlay(cbOutConsequence);
  cbSession.seekTo(0, 12);
  const stateAfterKohliCaught = cbSession.getCurrentState();
  // Ball 11 was Pant overturned (-1), ball 12 is Kohli caught (+1) -> net wickets = baseline 2
  assert(stateAfterKohliCaught.wickets === 2, `S15.28: Net wickets at ball 12 is 2 (found ${stateAfterKohliCaught.wickets})`);
  assert(stateAfterKohliCaught.remainingReviews?.bowling === 2, "S15.29: Bowling reviews retained at 2");

  // --------------------------------------------------------------------------
  // Sub-scenario 3: Bowling review fails (NOT OUT confirmed on 1_2_2)
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 3: Bowling review fails on Caught Behind -");
  const delivery122 = inn1Deliveries[13];
  const cbUnsuccessfulConsequence = createCaughtBehindDrsConsequence({
    delivery: delivery122,
    verdict: "NOT_OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
  });
  assert(cbUnsuccessfulConsequence.reviewRetained === false, "S15.30: Bowling review lost on confirmed NOT OUT");
  cbSession.applyOverlay(cbUnsuccessfulConsequence);
  cbSession.seekTo(0, 13);
  assert(
    cbSession.getCurrentState().remainingReviews?.bowling === 1,
    "S15.31: Bowling team reviews deducted to 1"
  );

  // --------------------------------------------------------------------------
  // Sub-scenario 4: Overlay removal restores baseline
  // --------------------------------------------------------------------------
  cbSession.removeOverlay("1_1_6");
  cbSession.removeOverlay("1_2_1");
  cbSession.removeOverlay("1_2_2");
  cbSession.seekTo(0, deliveryIndex);
  assert(
    cbSession.getCurrentDelivery()?.effectiveOutcome.wicket?.playerOut === "RR Pant",
    "S15.32: Baseline Pant wicket restored after overlay removal"
  );
}

// ============================================================================
// SUITE 16: BOUNDARY CATCH DRS INTEGRATION WITH VERIFIED 2024 T20 WC FINAL FIXTURE
// Proves the complete flow:
// Real delivery (2_19_1: David Miller facing Hardik Pandya, iconic catch by Suryakumar Yadav)
//    ↓
// Boundary DRS incident (cushion contact margin / release timing / rope interaction)
//    ↓
// Existing Boundary rule evaluation (evaluateBoundary)
//    ↓
// Sparse DRS overlay (createBoundaryDrsConsequence)
//    ↓
// Effective match outcome (clean catch OUT confirmed vs cushion contact NOT OUT / Six)
// ============================================================================
console.log("\n--- Suite 16: Boundary Catch DRS Integration with 2024 T20 WC Final Fixture ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn2Deliveries = fixture.innings[1].deliveries;

  // Selected delivery: 2_19_1 (Innings 2, Over 19, Ball 1, deliveryIndex: 117)
  // Striker: DA Miller, Non-striker: K Rabada, Bowler: HH Pandya
  // Baseline outcome: CAUGHT by SA Yadav, 0 runs
  const deliveryIndex = 117;
  const realDelivery = inn2Deliveries[deliveryIndex];

  assert(realDelivery.id === "2_19_1", "S16.1: Target delivery is 2_19_1 (iconic final over)");
  assert(realDelivery.striker === "DA Miller", "S16.2: Striker is DA Miller");
  assert(realDelivery.bowler === "HH Pandya", "S16.3: Bowler is HH Pandya");
  assert(realDelivery.outcome.wicket?.kind === "CAUGHT", "S16.4: Baseline outcome is CAUGHT");
  assert(realDelivery.outcome.wicket?.playerOut === "DA Miller", "S16.5: Dismissed player is DA Miller");
  assert(realDelivery.outcome.wicket?.fielders?.[0] === "SA Yadav", "S16.6: Catcher is SA Yadav");

  // Verify baseline state at delivery 117
  const baseSession = new RealMatchPlaybackSession(fixture);
  baseSession.seekTo(1, deliveryIndex);
  const baselineStateAt117 = baseSession.getCurrentState();
  assert(baselineStateAt117.score === 161, `S16.7: Baseline score at 2_19_1 is 161 (found ${baselineStateAt117.score})`);
  assert(baselineStateAt117.wickets === 7, `S16.8: Baseline wickets at 2_19_1 is 7 (found ${baselineStateAt117.wickets})`);

  // End of match baseline
  baseSession.seekTo(1, 123);
  const baselineMatchEnd = baseSession.getCurrentState();
  assert(baselineMatchEnd.score === 169 && baselineMatchEnd.wickets === 8, "S16.9: South Africa finishes at 169/8");

  // --------------------------------------------------------------------------
  // Sub-scenario 1: Clean boundary catch confirmed OUT
  // Replay confirms Suryakumar Yadav released ball cleanly before touching rope,
  // re-established feet inside field of play, and completed catch cleanly.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 1: Clean boundary catch confirmed OUT -");
  const boundaryCleanData: BoundaryData = {
    ropeContactFrameMs: 0,
    releaseFrameMs: 1400,
    isBoundary: false,
    fielderTouchingRopeWhileInContact: false,
    marginMm: 24, // 24mm clear daylight inside boundary rope
    catchOrSave: "RELAY_CATCH",
  };

  const drsEvalCleanCatch = evaluateBoundary(boundaryCleanData, "REFERRED");
  assert(drsEvalCleanCatch.correctFinalVerdict === "OUT", "S16.10: DRS boundary verdict is OUT");
  assert(drsEvalCleanCatch.ruleCitation.includes("Clean Catch Inside Boundary"), "S16.11: Clean catch citation verified");

  const boundaryCleanConsequence = createBoundaryDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalCleanCatch.correctFinalVerdict,
    onFieldSignal: "REFERRED",
    dismissedBatter: "DA Miller",
    fielders: ["SA Yadav"],
    reason: drsEvalCleanCatch.explanation,
  });

  assert(boundaryCleanConsequence.ballId === "2_19_1", "S16.12: Target ballId is 2_19_1");
  assert(boundaryCleanConsequence.applied === true, "S16.13: Applied is true");
  assert(boundaryCleanConsequence.drsOutcome.runsBatter === 0, "S16.14: Batter runs is 0");
  assert(boundaryCleanConsequence.drsOutcome.wicket?.kind === "CAUGHT", "S16.15: Dismissal kind is CAUGHT");
  assert(boundaryCleanConsequence.drsOutcome.wicket?.playerOut === "DA Miller", "S16.16: Dismissed player is DA Miller");
  assert(boundaryCleanConsequence.drsOutcome.wicket?.fielders?.[0] === "SA Yadav", "S16.17: Catcher is SA Yadav");

  const boundarySession = new RealMatchPlaybackSession(fixture);
  boundarySession.applyOverlay(boundaryCleanConsequence);
  boundarySession.seekTo(1, deliveryIndex);
  const stateWithCleanCatch = boundarySession.getCurrentState();
  assert(stateWithCleanCatch.score === 161, "S16.18: Score remains 161");
  assert(stateWithCleanCatch.wickets === 7, "S16.19: Wickets remains 7 at 2_19_1");

  // --------------------------------------------------------------------------
  // Sub-scenario 2: Overturn on-field OUT to Boundary Six (Fielder cushion contact)
  // Fictional test overlay: Replay camera reveals boot heel compressed boundary cushion!
  // Law 19 consequence: Overturn OUT to NOT OUT, strip catch dismissal, award 6 runs!
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 2: Overturn OUT to Boundary Six (cushion contact) -");
  const boundaryContactData: BoundaryData = {
    ropeContactFrameMs: 1450,
    releaseFrameMs: 1520,
    isBoundary: true,
    fielderTouchingRopeWhileInContact: true,
    marginMm: 4, // 4mm contact with cushion
    catchOrSave: "BOUNDARY_TOUCH",
  };

  const drsEvalContact = evaluateBoundary(boundaryContactData, "REFERRED");
  assert(drsEvalContact.correctFinalVerdict === "NOT_OUT", "S16.20: DRS verdict is NOT_OUT");
  assert(drsEvalContact.ruleCitation.includes("Law 19 - Boundary Cushion Contact"), "S16.21: Rule citation Law 19");

  const boundarySixConsequence = createBoundaryDrsConsequence({
    delivery: realDelivery,
    verdict: drsEvalContact.correctFinalVerdict,
    onFieldSignal: "REFERRED",
    boundaryRuns: 6, // 6 runs awarded under Law 19.7 for boundary over the rope
    reason: drsEvalContact.explanation,
  });

  assert(boundarySixConsequence.drsOutcome.wicket === undefined, "S16.22: Catch dismissal is stripped");
  assert(boundarySixConsequence.drsOutcome.runsBatter === 6, "S16.23: 6 runs awarded off bat");

  // Apply to session and test effective state
  boundarySession.applyOverlay(boundarySixConsequence);
  boundarySession.seekTo(1, deliveryIndex);
  const stateWithSix = boundarySession.getCurrentState();
  assert(stateWithSix.score === 167, `S16.24: Score increases from 161 to 167 (found ${stateWithSix.score})`);
  assert(stateWithSix.wickets === 6, `S16.25: Wickets decreases from 7 to 6 (found ${stateWithSix.wickets})`);

  // Verify at end of match: South Africa score becomes 175 (was 169), wickets becomes 7 (was 8)
  boundarySession.seekTo(1, 123);
  const matchEndWithSix = boundarySession.getCurrentState();
  assert(
    matchEndWithSix.score === 175,
    `S16.26: Match end score increases by 6 to 175 (found ${matchEndWithSix.score})`
  );
  assert(
    matchEndWithSix.wickets === 7,
    `S16.27: Match end wickets decreases to 7 (found ${matchEndWithSix.wickets})`
  );

  // --------------------------------------------------------------------------
  // Sub-scenario 3: Boundary check on baseline boundary four (1_0_2)
  // Delivery 1_0_2: V Kohli 4 runs off Jansen. Umpire checks if cleanly fielded.
  // --------------------------------------------------------------------------
  console.log("  - Sub-scenario 3: Baseline boundary check preserves 4 runs -");
  const delivery102 = fixture.innings[0].deliveries[1]; // 1_0_2: 4 runs
  assert(delivery102.outcome.runsBatter === 4, "S16.28: Baseline runs is 4");

  const boundaryFourConfirmed = createBoundaryDrsConsequence({
    delivery: delivery102,
    verdict: "NOT_OUT",
    onFieldSignal: "REFERRED",
  });
  assert(boundaryFourConfirmed.drsOutcome.runsBatter === 4, "S16.29: Baseline 4 runs preserved");
  assert(boundaryFourConfirmed.drsOutcome.wicket === undefined, "S16.30: No wicket present");

  // --------------------------------------------------------------------------
  // Sub-scenario 4: Overlay removal restores baseline
  // --------------------------------------------------------------------------
  boundarySession.removeOverlay("2_19_1");
  boundarySession.seekTo(1, deliveryIndex);
  assert(
    boundarySession.getCurrentDelivery()?.effectiveOutcome.wicket?.playerOut === "DA Miller",
    "S16.31: Removing boundary overlay restores baseline Miller catch"
  );
  assert(
    boundarySession.getCurrentState().score === 161,
    "S16.32: Removing boundary overlay restores baseline score 161"
  );
}

// ============================================================================
// SUITE 17: UNIFIED DISPATCHER & REVIEW RETENTION TRUTH TABLE
// ============================================================================
console.log("\n--- Suite 17: Unified Dispatcher & Review Retention Truth Table ---");
{
  const fixture = T20_WC_2024_FINAL;
  const d0 = fixture.innings[0].deliveries[0];
  const d1 = fixture.innings[0].deliveries[1];
  const d2 = fixture.innings[0].deliveries[2];
  const d3 = fixture.innings[0].deliveries[3];
  const d4 = fixture.innings[0].deliveries[4];

  // 1. Unified createDrsConsequence dispatcher tests for all 5 incident types
  const lbwRes = createDrsConsequence({
    incidentType: "LBW",
    delivery: d0,
    verdict: "OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
  });
  assert(lbwRes.drsOutcome.wicket?.kind === "LBW", "S17.1: Dispatcher handles LBW");

  const runOutRes = createDrsConsequence({
    incidentType: "RUN_OUT",
    delivery: d1,
    verdict: "OUT",
    dismissedBatter: "V Kohli",
  });
  assert(runOutRes.drsOutcome.wicket?.kind === "RUN_OUT", "S17.2: Dispatcher handles RUN_OUT");

  const stumpingRes = createDrsConsequence({
    incidentType: "STUMPING",
    delivery: d2,
    verdict: "OUT",
    wicketkeeper: "Q de Kock",
  });
  assert(stumpingRes.drsOutcome.wicket?.kind === "STUMPED", "S17.3: Dispatcher handles STUMPING");

  const cbRes = createDrsConsequence({
    incidentType: "CAUGHT_BEHIND",
    delivery: d3,
    verdict: "OUT",
    onFieldSignal: "NOT_OUT",
    catcher: "Q de Kock",
  });
  assert(cbRes.drsOutcome.wicket?.kind === "CAUGHT", "S17.4: Dispatcher handles CAUGHT_BEHIND");

  const boundaryRes = createDrsConsequence({
    incidentType: "BOUNDARY",
    delivery: d4,
    verdict: "OUT",
    fielders: ["SA Yadav"],
  });
  assert(boundaryRes.drsOutcome.wicket?.kind === "CAUGHT", "S17.5: Dispatcher handles BOUNDARY");

  // 2. Truth table testing for calculateReviewRetention
  // 2a. Umpire referral: no team review used
  const refRes = calculateReviewRetention({ verdict: "OUT", onFieldSignal: "REFERRED" });
  assert(refRes.reviewingSide === undefined && refRes.reviewRetained === true, "S17.6: Umpire referral consumes no reviews");

  // 2b. Bowling review: overturn NOT_OUT -> OUT retains review
  const bowlOverturn = calculateReviewRetention({ verdict: "OUT", onFieldSignal: "NOT_OUT", reviewingSide: "BOWLING" });
  assert(bowlOverturn.reviewRetained === true, "S17.7: Bowling overturn retains review");

  // 2c. Bowling review: NOT_OUT stands -> review lost
  const bowlLost = calculateReviewRetention({ verdict: "NOT_OUT", onFieldSignal: "NOT_OUT", reviewingSide: "BOWLING", isUmpiresCall: false });
  assert(bowlLost.reviewRetained === false, "S17.8: Bowling review lost when NOT OUT confirmed");

  // 2d. Bowling review: NOT_OUT stands on Umpire's Call -> review retained!
  const bowlUc = calculateReviewRetention({ verdict: "NOT_OUT", onFieldSignal: "NOT_OUT", reviewingSide: "BOWLING", isUmpiresCall: true });
  assert(bowlUc.reviewRetained === true, "S17.9: Bowling review retained on Umpire's Call NOT OUT");

  // 2e. Batting review: overturn OUT -> NOT_OUT retains review
  const batOverturn = calculateReviewRetention({ verdict: "NOT_OUT", onFieldSignal: "OUT", reviewingSide: "BATTING" });
  assert(batOverturn.reviewRetained === true, "S17.10: Batting overturn retains review");

  // 2f. Batting review: OUT confirmed -> review lost
  const batLost = calculateReviewRetention({ verdict: "OUT", onFieldSignal: "OUT", reviewingSide: "BATTING", isUmpiresCall: false });
  assert(batLost.reviewRetained === false, "S17.11: Batting review lost when OUT confirmed");

  // 2g. Batting review: OUT confirmed on Umpire's Call -> review retained!
  const batUc = calculateReviewRetention({ verdict: "OUT", onFieldSignal: "OUT", reviewingSide: "BATTING", isUmpiresCall: true });
  assert(batUc.reviewRetained === true, "S17.12: Batting review retained on Umpire's Call OUT");
}

// ============================================================================
// SUITE 18: MULTI-OVERLAY COEXISTENCE & INDEPENDENT LIFECYCLES ACROSS ALL 5 TYPES
// ============================================================================
console.log("\n--- Suite 18: Multi-Overlay Coexistence & Independent Lifecycles ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn1Deliveries = fixture.innings[0].deliveries;
  const inn2Deliveries = fixture.innings[1].deliveries;

  const session = new RealMatchPlaybackSession(fixture);

  // Apply 5 simultaneous overlays across distinct deliveries in both innings:
  // 1. Delivery 1_0_1 (idx 0): RUN OUT OUT (RG Sharma, 1 run + wicket)
  session.applyOverlay(
    createRunOutDrsConsequence({
      delivery: inn1Deliveries[0],
      verdict: "OUT",
      dismissedBatter: "RG Sharma",
    })
  );

  // 2. Delivery 1_1_6 (idx 11): CAUGHT BEHIND NOT OUT (RR Pant overturned, wicket stripped)
  session.applyOverlay(
    createCaughtBehindDrsConsequence({
      delivery: inn1Deliveries[11],
      verdict: "NOT_OUT",
      onFieldSignal: "OUT",
      reviewingSide: "BATTING",
    })
  );

  // 3. Delivery 1_2_3 (idx 14): LBW OUT (V Kohli overturned to OUT)
  session.applyOverlay(
    createLbwDrsConsequence({
      delivery: inn1Deliveries[14],
      verdict: "OUT",
      onFieldSignal: "NOT_OUT",
      reviewingSide: "BOWLING",
    })
  );

  // 4. Delivery 1_9_3 (idx 56): STUMPING OUT (AR Patel stumped by de Kock)
  session.applyOverlay(
    createStumpingDrsConsequence({
      delivery: inn1Deliveries[56],
      verdict: "OUT",
      dismissedBatter: "AR Patel",
      wicketkeeper: "Q de Kock",
    })
  );

  // 5. Delivery 2_19_1 (inn 2, idx 117): BOUNDARY CATCH NOT OUT (DA Miller catch overturned to Six)
  session.applyOverlay(
    createBoundaryDrsConsequence({
      delivery: inn2Deliveries[117],
      verdict: "NOT_OUT",
      boundaryRuns: 6,
    })
  );

  // Verify all 5 overlays are registered in session
  assert(session.getOverlays().size === 5, "S18.1: Exactly 5 overlays registered simultaneously");

  // Verify individual deliveries have their expected effective outcomes:
  // Ball 1_0_1
  session.seekTo(0, 0);
  const b0 = session.getCurrentDelivery()!;
  assert(b0.isOverridden === true, "S18.2: Ball 1_0_1 is overridden");
  assert(b0.effectiveOutcome.wicket?.kind === "RUN_OUT", "S18.3: Ball 1_0_1 effective wicket is RUN_OUT");
  assert(b0.effectiveOutcome.runsBatter === 1, "S18.4: Ball 1_0_1 preserves 1 run");

  // Ball 1_1_6
  session.seekTo(0, 11);
  const b11 = session.getCurrentDelivery()!;
  assert(b11.isOverridden === true, "S18.5: Ball 1_1_6 is overridden");
  assert(b11.effectiveOutcome.wicket === undefined, "S18.6: Ball 1_1_6 wicket stripped (NOT OUT)");

  // Ball 1_2_3
  session.seekTo(0, 14);
  const b14 = session.getCurrentDelivery()!;
  assert(b14.isOverridden === true, "S18.7: Ball 1_2_3 is overridden");
  assert(b14.effectiveOutcome.wicket?.kind === "LBW", "S18.8: Ball 1_2_3 effective wicket is LBW");

  // Ball 1_9_3
  session.seekTo(0, 56);
  const b56 = session.getCurrentDelivery()!;
  assert(b56.isOverridden === true, "S18.9: Ball 1_9_3 is overridden");
  assert(b56.effectiveOutcome.wicket?.kind === "STUMPED", "S18.10: Ball 1_9_3 effective wicket is STUMPED");

  // Ball 2_19_1
  session.seekTo(1, 117);
  const b117 = session.getCurrentDelivery()!;
  assert(b117.isOverridden === true, "S18.11: Ball 2_19_1 is overridden");
  assert(b117.effectiveOutcome.wicket === undefined, "S18.12: Ball 2_19_1 catch stripped");
  assert(b117.effectiveOutcome.runsBatter === 6, "S18.13: Ball 2_19_1 awarded 6 runs");

  // Verify composite macro states:
  // End of Innings 1:
  // Baseline Innings 1: 176/7
  // Overlays applied:
  // +1 wicket (Run out at 0)
  // -1 wicket (Pant catch overturned at 11)
  // +1 wicket (Kohli LBW at 14)
  // +1 wicket (Axar stumping at 56)
  // Net wickets = 7 + 1 - 1 + 1 + 1 = 9 wickets!
  session.seekTo(0, 126);
  const inn1EndState = session.getCurrentState();
  assert(inn1EndState.score === 176, `S18.14: Innings 1 score is 176 (found ${inn1EndState.score})`);
  assert(inn1EndState.wickets === 9, `S18.15: Innings 1 wickets is 9 (found ${inn1EndState.wickets})`);

  // End of Innings 2:
  // Baseline Innings 2: 169/8
  // Overlays applied:
  // -1 wicket (Miller catch overturned at 117)
  // +6 runs (awarded six at 117)
  // Net score = 169 + 6 = 175
  // Net wickets = 8 - 1 = 7 wickets!
  session.seekTo(1, 123);
  const inn2EndState = session.getCurrentState();
  assert(inn2EndState.score === 175, `S18.16: Innings 2 score is 175 (found ${inn2EndState.score})`);
  assert(inn2EndState.wickets === 7, `S18.17: Innings 2 wickets is 7 (found ${inn2EndState.wickets})`);

  // --------------------------------------------------------------------------
  // Independent Removal: Removing one overlay does NOT affect others
  // --------------------------------------------------------------------------
  // Remove 1_2_3 (LBW)
  const removedLbw = session.removeOverlay("1_2_3");
  assert(removedLbw === true, "S18.18: Successfully removed overlay 1_2_3");
  assert(session.getOverlays().size === 4, "S18.19: Overlay count decreases to 4");

  // Ball 1_2_3 should now be baseline (not overridden)
  session.seekTo(0, 14);
  assert(session.getCurrentDelivery()?.isOverridden === false, "S18.20: Ball 1_2_3 reverted to baseline");

  // The other 4 overlays must remain completely intact:
  assert(session.getOverlay("1_0_1") !== undefined, "S18.21: Overlay 1_0_1 remains active");
  assert(session.getOverlay("1_1_6") !== undefined, "S18.22: Overlay 1_1_6 remains active");
  assert(session.getOverlay("1_9_3") !== undefined, "S18.23: Overlay 1_9_3 remains active");
  assert(session.getOverlay("2_19_1") !== undefined, "S18.24: Overlay 2_19_1 remains active");


  // Remove 2_19_1 (Boundary)
  session.removeOverlay("2_19_1");
  assert(session.getOverlays().size === 3, "S18.25: Overlay count decreases to 3");
  session.seekTo(1, 117);
  assert(session.getCurrentDelivery()?.isOverridden === false, "S18.26: Ball 2_19_1 reverted to baseline");
  assert(
    session.getCurrentDelivery()?.effectiveOutcome.wicket?.playerOut === "DA Miller",
    "S18.27: Miller catch restored on 2_19_1"
  );

  // Clear all overlays: completely restores baseline match state
  session.clearOverlays();
  assert(session.getOverlays().size === 0, "S18.28: Overlays cleared to 0");

  session.seekTo(0, 126);
  assert(session.getCurrentState().wickets === 7, "S18.29: Innings 1 wickets restored to baseline 7");
  session.seekTo(1, 123);
  assert(session.getCurrentState().score === 169, "S18.30: Innings 2 score restored to baseline 169");
  assert(session.getCurrentState().wickets === 8, "S18.31: Innings 2 wickets restored to baseline 8");

  // --------------------------------------------------------------------------
  // Immutability & Reference Stability Guarantees
  // --------------------------------------------------------------------------
  assert(Object.isFrozen(fixture), "S18.32: Match fixture remains frozen");
  assert(Object.isFrozen(inn1Deliveries[0]), "S18.33: Delivery 1_0_1 remains frozen");
  assert(inn1Deliveries[0].outcome.wicket === undefined, "S18.34: Delivery 1_0_1 outcome was never mutated");
  assert(inn1Deliveries[11].outcome.wicket !== undefined, "S18.35: Delivery 1_1_6 baseline wicket intact");
}

// ============================================================================
// SUITE 19: EXTENDED CONSEQUENCE & EDGE CASE AUDITS
// Thoroughly validates all audited consequence edge cases:
// 1. Run Out NOT_OUT respects explicit runsCompleted on non-wicket baseline
// 2. Boundary NOT_OUT preserves non-wicket baseline runs (no arbitrary inflation to 4)
// 3. Fielder preservation when fielders omitted on baseline wicket deliveries
// 4. Optional onFieldSignal in CaughtBehindDrsConsequenceParams
// 5. Law 36.1 No Ball protection for LBW
// 6. Law 33.1 No Ball protection for Caught Behind and Boundary Catch
// 7. Stumping No Ball 1-run penalty concession when isNoBall is flagged
// 8. Session constructor accepts array of DrsOutcomeOverride
// 9. incidentType tracking across all 5 consequence generators
// 10. Exhaustive error handling in unified createDrsConsequence dispatcher
// 11. applied: false overlay deactivation branch
// 12. MCC Dead Ball extras clearance on OUT dismissals (LBW, Caught Behind, Boundary Catch)
// 13. isOverridden flag accuracy on upheld non-wicket reviews
// ============================================================================
console.log("\n--- Suite 19: Extended Consequence & Edge Case Audits ---");
{
  const fixture = T20_WC_2024_FINAL;
  const inn1Deliveries = fixture.innings[0].deliveries;
  const inn2Deliveries = fixture.innings[1].deliveries;

  // 1. Run Out NOT_OUT with runsCompleted on baseline 1-run delivery (1_0_1)
  const d0 = inn1Deliveries[0]; // 1_0_1: 1 run, no wicket
  const runOutNotOutTwoRuns = createRunOutDrsConsequence({
    delivery: d0,
    verdict: "NOT_OUT",
    runsCompleted: 2,
    reason: "Batters completed 2 runs safely before bails broken",
  });
  assert(runOutNotOutTwoRuns.drsOutcome.runsBatter === 2, "S19.1: Run Out NOT_OUT respects explicit completed runs (2 runs)");
  assert(runOutNotOutTwoRuns.drsOutcome.wicket === undefined, "S19.2: Run Out NOT_OUT contains no wicket");
  assert(runOutNotOutTwoRuns.incidentType === "RUN_OUT", "S19.3: Run Out override records incidentType RUN_OUT");

  // 2. Boundary NOT_OUT on baseline non-wicket delivery (1_0_1 has 1 run)
  // Spec requirement: "NOT OUT must preserve the baseline"
  const boundaryNotOutOnSingle = createBoundaryDrsConsequence({
    delivery: d0,
    verdict: "NOT_OUT",
    reason: "Fielder stopped ball inside boundary rope",
  });
  assert(
    boundaryNotOutOnSingle.drsOutcome.runsBatter === 1,
    `S19.4: Boundary NOT_OUT on single preserves baseline 1 run (found ${boundaryNotOutOnSingle.drsOutcome.runsBatter})`
  );
  assert(boundaryNotOutOnSingle.drsOutcome.wicket === undefined, "S19.5: Boundary NOT_OUT has no wicket");
  assert(boundaryNotOutOnSingle.incidentType === "BOUNDARY", "S19.6: Boundary override records incidentType BOUNDARY");

  // 3. Fielder preservation when fielders omitted on baseline wicket delivery
  // Delivery 2_19_1 baseline has CAUGHT by SA Yadav
  const d117 = inn2Deliveries[117];
  assert(d117.outcome.wicket?.fielders?.[0] === "SA Yadav", "S19.7: Baseline catcher is SA Yadav");

  const boundaryCatchFielderPreserved = createBoundaryDrsConsequence({
    delivery: d117,
    verdict: "OUT",
    // fielders omitted: should preserve SA Yadav from baseline
  });
  assert(
    boundaryCatchFielderPreserved.drsOutcome.wicket?.fielders?.[0] === "SA Yadav",
    "S19.8: Boundary consequence preserves baseline catcher when fielders parameter is omitted"
  );

  // Delivery 1_1_6 baseline has CAUGHT by Q de Kock
  const d11 = inn1Deliveries[11];
  assert(d11.outcome.wicket?.fielders?.[0] === "Q de Kock", "S19.9: Baseline catcher is Q de Kock");

  const cbFielderPreserved = createCaughtBehindDrsConsequence({
    delivery: d11,
    verdict: "OUT",
    // catcher omitted: should preserve Q de Kock from baseline
  });
  assert(
    cbFielderPreserved.drsOutcome.wicket?.fielders?.[0] === "Q de Kock",
    "S19.10: Caught behind consequence preserves baseline catcher when catcher parameter is omitted"
  );

  // 4. Optional onFieldSignal in CaughtBehindDrsConsequenceParams
  const cbWithoutSignal = createCaughtBehindDrsConsequence({
    delivery: d0,
    verdict: "OUT",
    catcher: "Q de Kock",
  });
  assert(cbWithoutSignal.drsOutcome.wicket?.kind === "CAUGHT", "S19.11: Caught behind compiles and executes without onFieldSignal");
  assert(cbWithoutSignal.reviewingSide === "BOWLING", "S19.12: Default reviewingSide inferred as BOWLING for non-wicket baseline");
  assert(cbWithoutSignal.incidentType === "CAUGHT_BEHIND", "S19.13: Caught behind override records incidentType CAUGHT_BEHIND");

  // 5. Law 36.1 No Ball protection for LBW
  const lbwNoBall = createLbwDrsConsequence({
    delivery: d0,
    verdict: "OUT",
    isNoBall: true,
  });
  assert(lbwNoBall.drsOutcome.wicket === undefined, "S19.14: Law 36.1 prevents LBW dismissal on No Ball");
  assert(lbwNoBall.drsOutcome.runsExtras === 1, "S19.15: LBW No Ball awards 1-run penalty extra");
  assert(lbwNoBall.drsOutcome.extras?.type === "NO_BALLS", "S19.16: LBW No Ball extra type is NO_BALLS");
  assert(lbwNoBall.incidentType === "LBW", "S19.17: LBW override records incidentType LBW");

  // 6. Law 33.1 No Ball protection for Caught Behind and Boundary Catch
  const cbNoBall = createCaughtBehindDrsConsequence({
    delivery: d0,
    verdict: "OUT",
    isNoBall: true,
  });
  assert(cbNoBall.drsOutcome.wicket === undefined, "S19.18: Law 33.1 prevents Caught Behind dismissal on No Ball");
  assert(cbNoBall.drsOutcome.runsExtras === 1, "S19.19: Caught Behind No Ball awards 1-run penalty extra");

  const boundaryNoBall = createBoundaryDrsConsequence({
    delivery: d0,
    verdict: "OUT",
    isNoBall: true,
  });
  assert(boundaryNoBall.drsOutcome.wicket === undefined, "S19.20: Law 33.1 prevents Boundary Catch dismissal on No Ball");
  assert(boundaryNoBall.drsOutcome.runsExtras === 1, "S19.21: Boundary No Ball awards 1-run penalty extra");

  // 7. Stumping No Ball 1-run penalty concession
  const stumpingNoBallPenalty = createStumpingDrsConsequence({
    delivery: d0,
    verdict: "OUT",
    isNoBall: true,
  });
  assert(stumpingNoBallPenalty.drsOutcome.wicket === undefined, "S19.22: Stumping prevented on No Ball per Law 39.1");
  assert(stumpingNoBallPenalty.drsOutcome.runsExtras === 1, "S19.23: Stumping No Ball awards 1-run penalty extra on legal delivery");
  assert(stumpingNoBallPenalty.drsOutcome.extras?.type === "NO_BALLS", "S19.24: Extras type is NO_BALLS");

  // 8. Session constructor accepts array of DrsOutcomeOverride
  const arraySession = new RealMatchPlaybackSession(fixture, [
    runOutNotOutTwoRuns,
    boundaryCatchFielderPreserved,
  ]);
  assert(arraySession.getOverlays().size === 2, "S19.25: Session initialized with array of overrides has 2 overlays");
  assert(arraySession.getOverlay("1_0_1") !== undefined, "S19.26: Ball 1_0_1 present from array initialization");
  assert(arraySession.getOverlay("2_19_1") !== undefined, "S19.27: Ball 2_19_1 present from array initialization");
  arraySession.seekTo(0, 0);
  assert(arraySession.getCurrentDelivery()?.effectiveOutcome.runsBatter === 2, "S19.28: Effective outcome derived correctly from array-initialized session");

  // 9. incidentType tracking across all 5 consequence generators
  const stumpingOv = createStumpingDrsConsequence({ delivery: d0, verdict: "OUT" });
  assert(stumpingOv.incidentType === "STUMPING", "S19.29: Stumping override records incidentType STUMPING");

  const dispLbw = createDrsConsequence({ incidentType: "LBW", delivery: d0, verdict: "OUT" });
  assert(dispLbw.incidentType === "LBW", "S19.30: Dispatcher LBW has incidentType LBW");

  const dispRunOut = createDrsConsequence({ incidentType: "RUN_OUT", delivery: d0, verdict: "OUT" });
  assert(dispRunOut.incidentType === "RUN_OUT", "S19.31: Dispatcher RUN_OUT has incidentType RUN_OUT");

  const dispStumping = createDrsConsequence({ incidentType: "STUMPING", delivery: d0, verdict: "OUT" });
  assert(dispStumping.incidentType === "STUMPING", "S19.32: Dispatcher STUMPING has incidentType STUMPING");

  const dispCaughtBehind = createDrsConsequence({ incidentType: "CAUGHT_BEHIND", delivery: d0, verdict: "OUT" });
  assert(dispCaughtBehind.incidentType === "CAUGHT_BEHIND", "S19.33: Dispatcher CAUGHT_BEHIND has incidentType CAUGHT_BEHIND");

  const dispBoundary = createDrsConsequence({ incidentType: "BOUNDARY", delivery: d0, verdict: "OUT" });
  assert(dispBoundary.incidentType === "BOUNDARY", "S19.34: Dispatcher BOUNDARY has incidentType BOUNDARY");

  // 10. Exhaustive error handling in unified createDrsConsequence dispatcher
  let caughtExhaustiveError = false;
  try {
    // @ts-expect-error Testing invalid runtime incidentType
    createDrsConsequence({ incidentType: "UNSUPPORTED_TYPE", delivery: d0, verdict: "OUT" });
  } catch (err: unknown) {
    caughtExhaustiveError = (err as Error).message.includes("Unsupported DRS incident type");
  }
  assert(caughtExhaustiveError, "S19.35: Unified dispatcher throws on unrecognized incident type");
  assert(typeof createDrsConsequence === "function", "S19.36: createDrsConsequence exported as pure function");

  // 11. applied: false Overlay Deactivation Branch (L2 Audit)
  // Registering an overlay with applied: false must bypass the override, leave the effective ball
  // as baseline, evaluate isOverridden as false, and not deduct team reviews in playback state.
  const inactiveCaughtBehind: DrsOutcomeOverride = {
    ballId: d11.id,
    incidentType: "CAUGHT_BEHIND",
    originalOutcome: d11.outcome,
    drsOutcome: { runsBatter: 0 }, // Would strip wicket if applied
    applied: false,
    reviewingSide: "BOWLING",
    reviewRetained: false, // Would deduct review if applied
    reason: "Deactivated override test",
  };
  const deactMap = new Map<string, DrsOutcomeOverride>([[d11.id, inactiveCaughtBehind]]);
  const deactEffectiveBall = getEffectiveBall(d11, deactMap);
  assert(deactEffectiveBall.isOverridden === false, "S19.37: Inactive overlay (applied: false) yields isOverridden === false");
  assert(deactEffectiveBall.effectiveOutcome === d11.outcome, "S19.38: Inactive overlay leaves effectiveOutcome as pure baseline");
  assert(deactEffectiveBall.effectiveOutcome.wicket !== undefined, "S19.39: Baseline wicket retained under inactive overlay");

  const deactState = computePlaybackState(fixture, 0, 11, deactMap);
  assert(deactState.remainingReviews?.bowling === 2, "S19.40: Inactive overlay does not deduct team reviews in playback state");
  assert(deactState.wickets === 2, "S19.41: Inactive overlay does not alter baseline wicket count");

  // Also verify through RealMatchPlaybackSession
  const deactSession = new RealMatchPlaybackSession(fixture, [inactiveCaughtBehind]);
  deactSession.seekTo(0, 11);
  assert(deactSession.getCurrentDelivery()?.isOverridden === false, "S19.42: Session current delivery isOverridden is false for applied: false");
  assert(deactSession.getCurrentDelivery()?.effectiveOutcome.wicket !== undefined, "S19.43: Session current delivery retains baseline wicket");
  assert(deactSession.getCurrentState().remainingReviews?.bowling === 2, "S19.44: Session current state bowling reviews remain 2");

  // 12. MCC Dead Ball Extra Runs Clearance on Dismissals (M1 Audit: Law 20.1.1.3, 26, 33, 36)
  // When an on-field NOT OUT delivery is overturned to OUT for LBW, Caught Behind, or Boundary Catch,
  // the ball becomes dead at dismissal. Baseline extras (leg byes, byes, wides) must NOT be retained.
  // In contrast, RUN_OUT preserves completed runs/extras (Law 38.3), and STUMPING preserves wides (Law 39.1).

  // Synthetic delivery with 4 Leg Byes
  const deliveryWithLegByes: RealDelivery = {
    id: "1_5_3",
    innings: 1,
    over: 5,
    ball: 3,
    deliveryIndex: 32,
    striker: "V Kohli",
    nonStriker: "AR Patel",
    bowler: "KA Maharaj",
    outcome: {
      runsBatter: 0,
      runsExtras: 4,
      extras: { type: "LEGBYES", runs: 4 },
    },
  };

  // Synthetic delivery with 1 Wide extra
  const deliveryWithWide: RealDelivery = {
    id: "1_5_4",
    innings: 1,
    over: 5,
    ball: 4,
    deliveryIndex: 33,
    striker: "V Kohli",
    nonStriker: "AR Patel",
    bowler: "KA Maharaj",
    outcome: {
      runsBatter: 0,
      runsExtras: 1,
      extras: { type: "WIDES", runs: 1 },
    },
  };

  // Synthetic delivery with 2 Byes
  const deliveryWithByes: RealDelivery = {
    id: "1_5_5",
    innings: 1,
    over: 5,
    ball: 5,
    deliveryIndex: 34,
    striker: "AR Patel",
    nonStriker: "V Kohli",
    bowler: "KA Maharaj",
    outcome: {
      runsBatter: 0,
      runsExtras: 2,
      extras: { type: "BYES", runs: 2 },
    },
  };

  // (a) LBW overturn clears leg byes
  const lbwLegByesOverturned = createLbwDrsConsequence({
    delivery: deliveryWithLegByes,
    verdict: "OUT",
    reason: "Ball struck pad in line, hitting wickets; dead ball under Law 20.1.1.3",
  });
  assert(lbwLegByesOverturned.drsOutcome.runsBatter === 0, "S19.45: LBW OUT has 0 batter runs");
  assert(lbwLegByesOverturned.drsOutcome.runsExtras === undefined, "S19.46: LBW OUT clears baseline runsExtras");
  assert(lbwLegByesOverturned.drsOutcome.extras === undefined, "S19.47: LBW OUT clears baseline extras breakdown");
  assert(lbwLegByesOverturned.drsOutcome.wicket?.kind === "LBW", "S19.48: LBW OUT creates LBW wicket");

  // (b) Caught Behind overturn clears byes
  const cbByesOverturned = createCaughtBehindDrsConsequence({
    delivery: deliveryWithByes,
    verdict: "OUT",
    catcher: "Q de Kock",
    reason: "Edge detected; catch completed, dead ball under Law 20.1.1.3",
  });
  assert(cbByesOverturned.drsOutcome.runsBatter === 0, "S19.49: Caught Behind OUT has 0 batter runs");
  assert(cbByesOverturned.drsOutcome.runsExtras === undefined, "S19.50: Caught Behind OUT clears baseline runsExtras");
  assert(cbByesOverturned.drsOutcome.extras === undefined, "S19.51: Caught Behind OUT clears baseline extras breakdown");
  assert(cbByesOverturned.drsOutcome.wicket?.kind === "CAUGHT", "S19.52: Caught Behind OUT creates CAUGHT wicket");

  // (c) Boundary Catch overturn clears leg byes
  const boundaryCatchExtrasOverturned = createBoundaryDrsConsequence({
    delivery: deliveryWithLegByes,
    verdict: "OUT",
    fielders: ["SA Yadav"],
    reason: "Clean boundary catch; dead ball under Law 20.1.1.3",
  });
  assert(boundaryCatchExtrasOverturned.drsOutcome.runsBatter === 0, "S19.53: Boundary Catch OUT has 0 batter runs");
  assert(boundaryCatchExtrasOverturned.drsOutcome.runsExtras === undefined, "S19.54: Boundary Catch OUT clears baseline runsExtras");
  assert(boundaryCatchExtrasOverturned.drsOutcome.extras === undefined, "S19.55: Boundary Catch OUT clears baseline extras breakdown");
  assert(boundaryCatchExtrasOverturned.drsOutcome.wicket?.kind === "CAUGHT", "S19.56: Boundary Catch OUT creates CAUGHT wicket");

  // (d) Run Out preserves completed extras per Law 38.3
  const runOutWithExtras = createRunOutDrsConsequence({
    delivery: deliveryWithLegByes,
    verdict: "OUT",
    runsCompleted: 1,
    fielders: ["KA Maharaj"],
  });
  assert(runOutWithExtras.drsOutcome.runsExtras === 4, "S19.57: Run Out preserves baseline runsExtras per Law 38.3");
  assert(runOutWithExtras.drsOutcome.extras?.type === "LEGBYES", "S19.58: Run Out preserves baseline extras type");
  assert(runOutWithExtras.drsOutcome.wicket?.kind === "RUN_OUT", "S19.59: Run Out produces RUN_OUT wicket");

  // (e) Stumping preserves wide extra per Law 39.1
  const stumpingWideDelivery = createStumpingDrsConsequence({
    delivery: deliveryWithWide,
    verdict: "OUT",
    wicketkeeper: "Q de Kock",
  });
  assert(stumpingWideDelivery.drsOutcome.runsExtras === 1, "S19.60: Stumping preserves Wide extra per Law 39.1");
  assert(stumpingWideDelivery.drsOutcome.extras?.type === "WIDES", "S19.61: Stumping preserves Wide extra type");
  assert(stumpingWideDelivery.drsOutcome.wicket?.kind === "STUMPED", "S19.62: Stumping produces STUMPED wicket");

  // 13. isOverridden Accuracy on Upheld Non-Wicket Reviews (M2 Audit)
  // When an unsuccessful challenge occurs on a non-wicket ball (verdict NOT_OUT),
  // drsOutcome matches delivery.outcome, but isOverridden must evaluate to true because an active
  // applied overlay exists in overlayMap and team reviews were decremented.
  const dotBallDelivery = inn1Deliveries[4]; // 1_0_5: 0 runs, no wicket
  const upheldBowlingReview = createLbwDrsConsequence({
    delivery: dotBallDelivery,
    verdict: "NOT_OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    isUmpiresCall: false,
    reason: "Pitching outside leg, NOT OUT confirmed",
  });
  assert(upheldBowlingReview.applied === true, "S19.63: Override applied is true");
  assert(upheldBowlingReview.reviewRetained === false, "S19.64: Bowling team lost review on confirmed NOT_OUT");
  assert(upheldBowlingReview.drsOutcome.runsBatter === dotBallDelivery.outcome.runsBatter, "S19.65: drsOutcome runsBatter matches baseline");
  assert(upheldBowlingReview.drsOutcome.wicket === undefined, "S19.66: drsOutcome has no wicket (matches baseline)");

  const upheldMap = new Map<string, DrsOutcomeOverride>([[dotBallDelivery.id, upheldBowlingReview]]);
  const upheldEffectiveBall = getEffectiveBall(dotBallDelivery, upheldMap);
  assert(upheldEffectiveBall.isOverridden === true, "S19.67: EffectiveBall.isOverridden is true when active NOT_OUT override is applied to dot ball");

  // Session playback verifies isOverridden and review deduction
  const upheldSession = new RealMatchPlaybackSession(fixture, [upheldBowlingReview]);
  upheldSession.seekTo(0, 4); // 1_0_5
  assert(upheldSession.getCurrentDelivery()?.isOverridden === true, "S19.68: Session getCurrentDelivery().isOverridden is true for upheld review");
  assert(upheldSession.getCurrentState().remainingReviews?.bowling === 1, "S19.69: Bowling reviews decremented to 1 due to unsuccessful review");
  assert(upheldSession.getCurrentState().score === 11, "S19.70: Score remains 11 (no spurious runs)");
  assert(upheldSession.getCurrentState().wickets === 0, "S19.71: Wickets remain 0");

  // Removing overlay restores isOverridden to false
  upheldSession.removeOverlay(dotBallDelivery.id);
  assert(upheldSession.getCurrentDelivery()?.isOverridden === false, "S19.72: getCurrentDelivery().isOverridden reverts to false after overlay removal");
  assert(upheldSession.getCurrentState().remainingReviews?.bowling === 2, "S19.73: Bowling reviews restored to 2 after overlay removal");

  // 14. Run Out dismissedEnd Precedence over Baseline RUN_OUT Wicket
  // When baseline already has a RUN_OUT wicket (e.g. 1_13_4: AR Patel run out),
  // passing dismissedEnd: "STRIKER" must dismiss striker (V Kohli), NOT retain AR Patel.
  // Passing dismissedEnd: "NON_STRIKER" must dismiss non-striker (AR Patel).
  const runOutBaselineDelivery = inn1Deliveries[84]; // 1_13_4
  assert(runOutBaselineDelivery.outcome.wicket?.kind === "RUN_OUT", "S19.74: Baseline 1_13_4 is RUN_OUT");
  assert(runOutBaselineDelivery.outcome.wicket?.playerOut === "AR Patel", "S19.75: Baseline 1_13_4 playerOut is AR Patel (non-striker)");

  // Review clarifies run out occurred at striker's end (V Kohli)
  const runOutStrikerOverride = createRunOutDrsConsequence({
    delivery: runOutBaselineDelivery,
    verdict: "OUT",
    dismissedEnd: "STRIKER",
    reason: "Replay shows V Kohli short at striker end, NOT AR Patel",
  });
  assert(
    runOutStrikerOverride.drsOutcome.wicket?.playerOut === "V Kohli",
    "S19.76: dismissedEnd STRIKER overrides baseline RUN_OUT non-striker wicket to V Kohli"
  );

  // Review confirms non-striker end
  const runOutNonStrikerOverride = createRunOutDrsConsequence({
    delivery: runOutBaselineDelivery,
    verdict: "OUT",
    dismissedEnd: "NON_STRIKER",
  });
  assert(
    runOutNonStrikerOverride.drsOutcome.wicket?.playerOut === "AR Patel",
    "S19.77: dismissedEnd NON_STRIKER resolves to AR Patel"
  );

  // When dismissedEnd is omitted on baseline RUN_OUT, baseline playerOut is preserved
  const runOutOmittedEndOverride = createRunOutDrsConsequence({
    delivery: runOutBaselineDelivery,
    verdict: "OUT",
  });
  assert(
    runOutOmittedEndOverride.drsOutcome.wicket?.playerOut === "AR Patel",
    "S19.78: Omitting dismissedEnd preserves baseline playerOut on existing RUN_OUT delivery"
  );

  // 15. Stumping OUT Clears Baseline Byes and Leg Byes (MCC Law 20.1.1.3, 26, 39.1)
  // When overturned to STUMPED, the ball is dead at dismissal; byes/leg byes cannot be scored.
  const stumpingLegByesOverturned = createStumpingDrsConsequence({
    delivery: deliveryWithLegByes,
    verdict: "OUT",
    wicketkeeper: "Q de Kock",
    reason: "Striker out of ground, stumped cleanly; dead ball under Law 20.1.1.3",
  });
  assert(stumpingLegByesOverturned.drsOutcome.runsBatter === 0, "S19.79: Stumping OUT has 0 batter runs");
  assert(stumpingLegByesOverturned.drsOutcome.runsExtras === undefined, "S19.80: Stumping OUT clears baseline leg byes");
  assert(stumpingLegByesOverturned.drsOutcome.extras === undefined, "S19.81: Stumping OUT clears baseline extras object");
  assert(stumpingLegByesOverturned.drsOutcome.wicket?.kind === "STUMPED", "S19.82: Stumping OUT creates STUMPED wicket");

  const stumpingByesOverturned = createStumpingDrsConsequence({
    delivery: deliveryWithByes,
    verdict: "OUT",
    wicketkeeper: "Q de Kock",
  });
  assert(stumpingByesOverturned.drsOutcome.runsExtras === undefined, "S19.83: Stumping OUT clears baseline byes");

  // 16. computePlaybackState and deriveEffectiveOutcome safe against omitted overlayMap
  const baselineStateNoMap = computePlaybackState(fixture, 0, 0);
  assert(baselineStateNoMap.score === 1, "S19.84: computePlaybackState works safely without overlayMap");
  assert(baselineStateNoMap.remainingReviews?.batting === 2, "S19.85: Default batting reviews is 2 without map");
  assert(baselineStateNoMap.remainingReviews?.bowling === 2, "S19.86: Default bowling reviews is 2 without map");

  const invalidMatchState = computePlaybackState(fixture, -1, -1);
  assert(invalidMatchState.remainingReviews?.batting === 2, "S19.87: Invalid match state provides default batting reviews");
  assert(invalidMatchState.remainingReviews?.bowling === 2, "S19.88: Invalid match state provides default bowling reviews");

  const effectiveBallNoMap = getEffectiveBall(d0);
  assert(effectiveBallNoMap.isOverridden === false, "S19.89: getEffectiveBall works safely without overlayMap");
  assert(effectiveBallNoMap.effectiveOutcome.runsBatter === 1, "S19.90: Effective outcome matches baseline without overlayMap");

  // 17. createLbwDrsConsequence on-field signal inference for baseline wicket delivery
  const d11Wicket = inn1Deliveries[11]; // 1_1_6: CAUGHT wicket
  const lbwOverturnOnWicket = createLbwDrsConsequence({
    delivery: d11Wicket,
    verdict: "NOT_OUT",
    reason: "Batting review: UltraEdge shows bat hit pad before ball hit pad, overturn OUT to NOT OUT",
  });
  assert(lbwOverturnOnWicket.reviewingSide === "BATTING", "S19.91: Baseline wicket infers reviewingSide BATTING for LBW overturn");
  assert(lbwOverturnOnWicket.reviewRetained === true, "S19.92: Batting review retained on NOT_OUT overturn");
}

console.log("\n=======================================================");
console.log(`   ALL REAL MATCH PLAYBACK TESTS PASSED!`);
console.log(`   Passed: ${passedCount}, Failed: ${failedCount}`);
console.log("=======================================================");


