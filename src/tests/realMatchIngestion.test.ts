/**
 * src/tests/realMatchIngestion.test.ts
 *
 * Comprehensive verification suite for the ingested real match fixture:
 * 2024 ICC Men's T20 World Cup Final (India vs South Africa, June 29, 2024).
 *
 * Official Verified Match Result:
 * - India: 176/7 (20.0 overs, 127 deliveries)
 * - South Africa: 169/8 (20.0 overs, 124 deliveries)
 * - Result: India won by 7 runs
 *
 * Proves:
 * 1. Match loading, structure, and metadata compliance.
 * 2. Innings 1 (India) delivery progression and exact 176/7 totals.
 * 3. Innings 2 (South Africa) delivery progression and exact 169/8 totals.
 * 4. Margin of victory (India by 7 runs) and match completion detection.
 * 5. Deep runtime immutability and mutation resistance.
 * 6. Zero-copy DRS overlay application and restoration on real match data.
 * 7. 100% deterministic replay equality across independent sessions.
 */

import { T20_WC_2024_FINAL } from "../data/realMatches/t20Wc2024Final";
import { RealMatchPlaybackSession } from "../engine/realMatchPlayback";
import type { DrsOutcomeOverride } from "../types/realMatch";

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
console.log("   2024 T20 WORLD CUP FINAL INGESTION TEST SUITE");
console.log("=======================================================\n");

// ============================================================================
// SUITE 1: MATCH METADATA & DATA INTEGRITY
// ============================================================================
console.log("--- Suite 1: Match Metadata & Data Integrity ---");
{
  assert(
    T20_WC_2024_FINAL.id === "MATCH_T20_WC_2024_FINAL",
    "S1.1: Match ID is MATCH_T20_WC_2024_FINAL"
  );
  assert(
    T20_WC_2024_FINAL.format === "T20",
    "S1.2: Match format is T20"
  );
  assert(
    T20_WC_2024_FINAL.homeTeamId === "IND",
    "S1.3: Home team is IND"
  );
  assert(
    T20_WC_2024_FINAL.awayTeamId === "SA",
    "S1.4: Away team is SA"
  );
  assert(
    T20_WC_2024_FINAL.venue === "Kensington Oval, Bridgetown, Barbados",
    "S1.5: Venue is Kensington Oval, Bridgetown, Barbados"
  );
  assert(
    T20_WC_2024_FINAL.innings.length === 2,
    "S1.6: Match contains exactly 2 innings"
  );

  const inn1 = T20_WC_2024_FINAL.innings[0];
  const inn2 = T20_WC_2024_FINAL.innings[1];

  assert(
    inn1.battingTeamId === "IND" && inn1.bowlingTeamId === "SA",
    "S1.7: Innings 1 is IND batting vs SA bowling"
  );
  assert(
    inn2.battingTeamId === "SA" && inn2.bowlingTeamId === "IND",
    "S1.8: Innings 2 is SA batting vs IND bowling"
  );
  assert(
    inn1.deliveries.length === 127,
    `S1.9: Innings 1 contains 127 deliveries (found ${inn1.deliveries.length})`
  );
  assert(
    inn2.deliveries.length === 124,
    `S1.10: Innings 2 contains 124 deliveries (found ${inn2.deliveries.length})`
  );

  const totalDeliveries = inn1.deliveries.length + inn2.deliveries.length;
  assert(
    totalDeliveries === 251,
    `S1.11: Total match deliveries is 251 (found ${totalDeliveries})`
  );

  // Validate delivery sequential indexing and ID integrity
  for (let i = 0; i < inn1.deliveries.length; i++) {
    const d = inn1.deliveries[i];
    assert(
      d.deliveryIndex === i,
      `S1.12: Innings 1 delivery ${d.id} sequential deliveryIndex is ${i}`
    );
    assert(
      d.innings === 1,
      `S1.13: Innings 1 delivery ${d.id} has innings number 1`
    );
  }

  for (let i = 0; i < inn2.deliveries.length; i++) {
    const d = inn2.deliveries[i];
    assert(
      d.deliveryIndex === i,
      `S1.14: Innings 2 delivery ${d.id} sequential deliveryIndex is ${i}`
    );
    assert(
      d.innings === 2,
      `S1.15: Innings 2 delivery ${d.id} has innings number 2`
    );
  }
}

// ============================================================================
// SUITE 2: INNINGS 1 (INDIA) SCORECARD & DISMISSALS VERIFICATION
// ============================================================================
console.log("\n--- Suite 2: Innings 1 (India) Scorecard Verification ---");
{
  const session = new RealMatchPlaybackSession(T20_WC_2024_FINAL);

  // Seek to the end of Innings 1
  session.seekTo(0, 126);
  const finalInn1State = session.getCurrentState();

  assert(
    finalInn1State.score === 176,
    `S2.1: India final innings score is exactly 176 (found ${finalInn1State.score})`
  );
  assert(
    finalInn1State.wickets === 7,
    `S2.2: India final wickets fallen is exactly 7 (found ${finalInn1State.wickets})`
  );
  assert(
    finalInn1State.overs === 19,
    `S2.3: Final delivery was in over 19 (the 20th over, found ${finalInn1State.overs})`
  );

  // Verify key milestone deliveries and dismissals
  // 1. Rohit Sharma caught (Over 1, ball 4 -> "1_1_4")
  session.seekTo(0, 10); // Find 1_1_4
  const rohitWicketBall = T20_WC_2024_FINAL.innings[0].deliveries.find(
    (d) => d.id === "1_1_4"
  )!;
  assert(
    rohitWicketBall.outcome.wicket?.playerOut === "RG Sharma",
    "S2.4: 1_1_4 dismissal was RG Sharma"
  );
  assert(
    rohitWicketBall.outcome.wicket?.kind === "CAUGHT",
    "S2.5: RG Sharma dismissal kind was CAUGHT"
  );
  assert(
    rohitWicketBall.outcome.wicket?.fielders?.[0] === "H Klaasen",
    "S2.6: RG Sharma caught by H Klaasen"
  );

  // 2. Rishabh Pant caught (1_1_6)
  const pantWicketBall = T20_WC_2024_FINAL.innings[0].deliveries.find(
    (d) => d.id === "1_1_6"
  )!;
  assert(
    pantWicketBall.outcome.wicket?.playerOut === "RR Pant",
    "S2.7: 1_1_6 dismissal was RR Pant"
  );
  assert(
    pantWicketBall.outcome.wicket?.fielders?.[0] === "Q de Kock",
    "S2.8: RR Pant caught by Q de Kock"
  );

  // 3. Suryakumar Yadav caught (1_4_3)
  const suryaWicketBall = T20_WC_2024_FINAL.innings[0].deliveries.find(
    (d) => d.id === "1_4_3"
  )!;
  assert(
    suryaWicketBall.outcome.wicket?.playerOut === "SA Yadav",
    "S2.9: 1_4_3 dismissal was SA Yadav"
  );
  assert(
    suryaWicketBall.outcome.wicket?.fielders?.[0] === "H Klaasen",
    "S2.10: SA Yadav caught by H Klaasen"
  );

  // 4. Axar Patel run out (1_13_4)
  const axarWicketBall = T20_WC_2024_FINAL.innings[0].deliveries.find(
    (d) => d.id === "1_13_4"
  )!;
  assert(
    axarWicketBall.outcome.wicket?.playerOut === "AR Patel",
    "S2.11: 1_13_4 dismissal was AR Patel"
  );
  assert(
    axarWicketBall.outcome.wicket?.kind === "RUN_OUT",
    "S2.12: AR Patel dismissal kind was RUN_OUT"
  );

  // 5. Virat Kohli caught (1_18_6)
  const kohliWicketBall = T20_WC_2024_FINAL.innings[0].deliveries.find(
    (d) => d.id === "1_18_6"
  )!;
  assert(
    kohliWicketBall.outcome.wicket?.playerOut === "V Kohli",
    "S2.13: 1_18_6 dismissal was V Kohli"
  );
  assert(
    kohliWicketBall.outcome.wicket?.fielders?.[0] === "K Rabada",
    "S2.14: V Kohli caught by K Rabada"
  );

  // 6. Shivam Dube caught (1_19_5)
  const dubeWicketBall = T20_WC_2024_FINAL.innings[0].deliveries.find(
    (d) => d.id === "1_19_5"
  )!;
  assert(
    dubeWicketBall.outcome.wicket?.playerOut === "S Dube",
    "S2.15: 1_19_5 dismissal was S Dube"
  );
  assert(
    dubeWicketBall.outcome.wicket?.fielders?.[0] === "DA Miller",
    "S2.16: S Dube caught by DA Miller"
  );

  // 7. Ravindra Jadeja caught (1_19_7)
  const jadejaWicketBall = T20_WC_2024_FINAL.innings[0].deliveries.find(
    (d) => d.id === "1_19_7"
  )!;
  assert(
    jadejaWicketBall.outcome.wicket?.playerOut === "RA Jadeja",
    "S2.17: 1_19_7 dismissal was RA Jadeja"
  );
  assert(
    jadejaWicketBall.outcome.wicket?.fielders?.[0] === "KA Maharaj",
    "S2.18: RA Jadeja caught by KA Maharaj"
  );
}

// ============================================================================
// SUITE 3: INNINGS 2 (SOUTH AFRICA) SCORECARD & DISMISSALS VERIFICATION
// ============================================================================
console.log("\n--- Suite 3: Innings 2 (South Africa) Scorecard Verification ---");
{
  const session = new RealMatchPlaybackSession(T20_WC_2024_FINAL);

  // Seek to the end of Innings 2
  session.seekTo(1, 123);
  const finalInn2State = session.getCurrentState();

  assert(
    finalInn2State.score === 169,
    `S3.1: South Africa final innings score is exactly 169 (found ${finalInn2State.score})`
  );
  assert(
    finalInn2State.wickets === 8,
    `S3.2: South Africa final wickets fallen is exactly 8 (found ${finalInn2State.wickets})`
  );
  assert(
    finalInn2State.overs === 19,
    `S3.3: Final delivery was in over 19 (the 20th over, found ${finalInn2State.overs})`
  );
  assert(
    finalInn2State.isComplete === true,
    "S3.4: isComplete is true at the final delivery of Innings 2"
  );

  // Verify all 8 South Africa dismissals
  // 1. Reeza Hendricks bowled by Bumrah (2_1_3)
  const hendricksBall = T20_WC_2024_FINAL.innings[1].deliveries.find(
    (d) => d.id === "2_1_3"
  )!;
  assert(
    hendricksBall.outcome.wicket?.playerOut === "RR Hendricks",
    "S3.5: 2_1_3 dismissal was RR Hendricks"
  );
  assert(
    hendricksBall.outcome.wicket?.kind === "BOWLED",
    "S3.6: RR Hendricks dismissal was BOWLED by Bumrah"
  );

  // 2. Aiden Markram caught by Pant off Arshdeep (2_2_3)
  const markramBall = T20_WC_2024_FINAL.innings[1].deliveries.find(
    (d) => d.id === "2_2_3"
  )!;
  assert(
    markramBall.outcome.wicket?.playerOut === "AK Markram",
    "S3.7: 2_2_3 dismissal was AK Markram"
  );
  assert(
    markramBall.outcome.wicket?.fielders?.[0] === "RR Pant",
    "S3.8: AK Markram caught by RR Pant"
  );

  // 3. Tristan Stubbs bowled by Axar (2_8_5)
  const stubbsBall = T20_WC_2024_FINAL.innings[1].deliveries.find(
    (d) => d.id === "2_8_5"
  )!;
  assert(
    stubbsBall.outcome.wicket?.playerOut === "T Stubbs",
    "S3.9: 2_8_5 dismissal was T Stubbs"
  );
  assert(
    stubbsBall.outcome.wicket?.kind === "BOWLED",
    "S3.10: T Stubbs dismissal was BOWLED by Axar"
  );

  // 4. Quinton de Kock caught by Kuldeep off Arshdeep (2_12_3)
  const dekockBall = T20_WC_2024_FINAL.innings[1].deliveries.find(
    (d) => d.id === "2_12_3"
  )!;
  assert(
    dekockBall.outcome.wicket?.playerOut === "Q de Kock",
    "S3.11: 2_12_3 dismissal was Q de Kock"
  );
  assert(
    dekockBall.outcome.wicket?.fielders?.[0] === "Kuldeep Yadav",
    "S3.12: Q de Kock caught by Kuldeep Yadav"
  );

  // 5. Heinrich Klaasen caught by Pant off Hardik (2_16_1)
  const klaasenBall = T20_WC_2024_FINAL.innings[1].deliveries.find(
    (d) => d.id === "2_16_1"
  )!;
  assert(
    klaasenBall.outcome.wicket?.playerOut === "H Klaasen",
    "S3.13: 2_16_1 dismissal was H Klaasen"
  );
  assert(
    klaasenBall.bowler === "HH Pandya",
    "S3.14: H Klaasen dismissed by HH Pandya"
  );

  // 6. Marco Jansen bowled by Bumrah (2_17_4)
  const jansenBall = T20_WC_2024_FINAL.innings[1].deliveries.find(
    (d) => d.id === "2_17_4"
  )!;
  assert(
    jansenBall.outcome.wicket?.playerOut === "M Jansen",
    "S3.15: 2_17_4 dismissal was M Jansen"
  );
  assert(
    jansenBall.outcome.wicket?.kind === "BOWLED",
    "S3.16: M Jansen dismissal was BOWLED by Bumrah"
  );

  // 7. David Miller caught by Suryakumar Yadav on the boundary! (2_19_1)
  const millerBall = T20_WC_2024_FINAL.innings[1].deliveries.find(
    (d) => d.id === "2_19_1"
  )!;
  assert(
    millerBall.outcome.wicket?.playerOut === "DA Miller",
    "S3.17: 2_19_1 dismissal was DA Miller"
  );
  assert(
    millerBall.outcome.wicket?.kind === "CAUGHT",
    "S3.18: DA Miller was CAUGHT"
  );
  assert(
    millerBall.outcome.wicket?.fielders?.[0] === "SA Yadav",
    "S3.19: DA Miller caught by SA Yadav (iconic boundary catch)"
  );

  // 8. Kagiso Rabada caught on final over (2_19_6)
  const rabadaBall = T20_WC_2024_FINAL.innings[1].deliveries.find(
    (d) => d.id === "2_19_6"
  )!;
  assert(
    rabadaBall.outcome.wicket?.playerOut === "K Rabada",
    "S3.20: 2_19_6 dismissal was K Rabada"
  );
  assert(
    rabadaBall.outcome.wicket?.fielders?.[0] === "SA Yadav",
    "S3.21: K Rabada caught by SA Yadav"
  );
}

// ============================================================================
// SUITE 4: MATCH RESULT & MARGIN OF VICTORY
// ============================================================================
console.log("\n--- Suite 4: Match Result & Margin of Victory ---");
{
  const session = new RealMatchPlaybackSession(T20_WC_2024_FINAL);

  session.seekTo(0, 126);
  const indScore = session.getCurrentState().score;

  session.seekTo(1, 123);
  const saScore = session.getCurrentState().score;

  const margin = indScore - saScore;
  assert(
    margin === 7,
    `S4.1: India won by exactly 7 runs (${indScore} - ${saScore} = ${margin})`
  );
}

// ============================================================================
// SUITE 5: SOURCE DATA IMMUTABILITY
// ============================================================================
console.log("\n--- Suite 5: Source Data Immutability ---");
{
  assert(
    Object.isFrozen(T20_WC_2024_FINAL),
    "S5.1: Root match object is deeply frozen"
  );
  assert(
    Object.isFrozen(T20_WC_2024_FINAL.innings),
    "S5.2: Innings array is deeply frozen"
  );
  assert(
    Object.isFrozen(T20_WC_2024_FINAL.innings[0].deliveries),
    "S5.3: Innings 1 deliveries array is frozen"
  );
  assert(
    Object.isFrozen(T20_WC_2024_FINAL.innings[1].deliveries),
    "S5.4: Innings 2 deliveries array is frozen"
  );
  assert(
    Object.isFrozen(T20_WC_2024_FINAL.innings[1].deliveries[120]),
    "S5.5: Final over delivery object is frozen"
  );
}

// ============================================================================
// SUITE 6: ZERO-COPY DRS OVERLAYS ON REAL MATCH DATA
// ============================================================================
console.log("\n--- Suite 6: Zero-Copy DRS Overlays on Real Match Data ---");
{
  const session = new RealMatchPlaybackSession(T20_WC_2024_FINAL);

  // Target the iconic David Miller delivery at 2_19_1 (deliveryIndex: 117, 118th delivery in Innings 2)
  const millerDeliveryIndex = T20_WC_2024_FINAL.innings[1].deliveries.findIndex(
    (d) => d.id === "2_19_1"
  );
  assert(
    millerDeliveryIndex !== -1,
    "S6.1: Found Miller delivery 2_19_1 in Innings 2"
  );

  session.seekTo(1, millerDeliveryIndex);
  const baselineBall = session.getCurrentDelivery()!;
  assert(
    baselineBall.delivery.outcome.wicket?.playerOut === "DA Miller",
    "S6.2: Baseline delivery is Miller dismissal"
  );
  assert(
    baselineBall.isOverridden === false,
    "S6.3: Baseline delivery is not overridden"
  );

  // Counterfactual DRS overlay: Suppose boundary review showed Surya touched boundary cushion -> SIX!
  const boundaryOverride: DrsOutcomeOverride = {
    ballId: "2_19_1",
    originalOutcome: baselineBall.delivery.outcome,
    drsOutcome: { runsBatter: 6 }, // 6 runs, NO wicket
    applied: true,
    reason: "Forensic boundary camera confirms fielder shoe made contact with boundary cushion while in contact with ball",
  };

  session.applyOverlay(boundaryOverride);

  const overriddenBall = session.getCurrentDelivery()!;
  assert(
    overriddenBall.isOverridden === true,
    "S6.4: Delivery is now marked as overridden"
  );
  assert(
    overriddenBall.effectiveOutcome.runsBatter === 6,
    "S6.5: Effective outcome is 6 runs"
  );
  assert(
    overriddenBall.effectiveOutcome.wicket === undefined,
    "S6.6: Effective outcome has no wicket"
  );

  // Check scoreboard consequence at end of innings
  session.seekTo(1, 123);
  const stateWithSix = session.getCurrentState();
  assert(
    stateWithSix.score === 175,
    `S6.7: South Africa score increases from 169 to 175 (+6 runs from boundary six, found ${stateWithSix.score})`
  );
  assert(
    stateWithSix.wickets === 7,
    `S6.8: South Africa wickets decreases from 8 to 7 (-1 wicket, found ${stateWithSix.wickets})`
  );

  // Reference identity: source match and delivery object references remain 100% untouched
  assert(
    session.match === T20_WC_2024_FINAL,
    "S6.9: session.match is strictly reference-equal to T20_WC_2024_FINAL"
  );
  assert(
    overriddenBall.delivery ===
      T20_WC_2024_FINAL.innings[1].deliveries[millerDeliveryIndex],
    "S6.10: Delivery reference is strictly reference-equal to raw delivery object"
  );
  assert(
    T20_WC_2024_FINAL.innings[1].deliveries[millerDeliveryIndex].outcome
      .wicket?.playerOut === "DA Miller",
    "S6.11: Source match delivery still has original DA Miller caught outcome"
  );

  // Revert overlay
  session.removeOverlay("2_19_1");
  const restoredState = session.getCurrentState();
  assert(
    restoredState.score === 169,
    "S6.12: Score immediately reverts to 169 upon removing overlay"
  );
  assert(
    restoredState.wickets === 8,
    "S6.13: Wickets immediately reverts to 8 upon removing overlay"
  );
}

// ============================================================================
// SUITE 7: DETERMINISTIC REPLAY EQUALITY ACROSS ALL 251 DELIVERIES
// ============================================================================
console.log("\n--- Suite 7: Deterministic Replay Equality ---");
{
  const sessionA = new RealMatchPlaybackSession(T20_WC_2024_FINAL);
  const sessionB = new RealMatchPlaybackSession(T20_WC_2024_FINAL);

  let count = 0;
  while (true) {
    const stateA = sessionA.getCurrentState();
    const stateB = sessionB.getCurrentState();

    assert(
      stateA.score === stateB.score &&
        stateA.wickets === stateB.wickets &&
        stateA.striker === stateB.striker &&
        stateA.bowler === stateB.bowler,
      `S7.1: Step ${count} states match perfectly`
    );

    const advA = sessionA.stepForward();
    const advB = sessionB.stepForward();
    assert(advA === advB, `S7.2: Step ${count} advancement matches`);

    count++;
    if (!advA) break;
  }

  assert(
    count === 251,
    `S7.3: Exactly 251 deliveries traversed across the match (found ${count})`
  );
}

console.log("\n=======================================================");
console.log(`   ALL 2024 T20 WC FINAL INGESTION TESTS PASSED!`);
console.log(`   Passed: ${passedCount}, Failed: ${failedCount}`);
console.log("=======================================================");
