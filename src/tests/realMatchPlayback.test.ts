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
import {
  RealMatchPlaybackSession,
  deriveEffectiveOutcome,
  getEffectiveBall,
  computePlaybackState,
} from "../engine/realMatchPlayback";
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

console.log("\n=======================================================");
console.log(`   ALL REAL MATCH PLAYBACK TESTS PASSED!`);
console.log(`   Passed: ${passedCount}, Failed: ${failedCount}`);
console.log("=======================================================");

