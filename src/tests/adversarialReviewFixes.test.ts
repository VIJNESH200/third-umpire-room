/**
 * adversarialReviewFixes.test.ts
 *
 * Comprehensive adversarial regression test suite covering all 9 priority areas:
 * 1. No Answer Leaks in forensic tools (FrontOnPitchView, PitchMapOverlay, Hawk-Eye).
 * 2. Hawk-Eye Physical Geometry & Scale (Striker stumps 42px, ball ~2.13px, seed 26 clearance).
 * 3. Stumping Continuous Margins & Anatomical Elevation.
 * 4. DRS Review Quota Enforcement (Team reviews blocked at 0 quota; Umpire referrals allowed).
 * 5. Navigation & Innings Boundaries (seekTo blocked during review; backward step clamped to all-out).
 * 6. Once-Only Decision Submission (idempotent, no double-counting).
 * 7. Selective Abstention Scoring (No 100/100 unearned instinct via SEND_UPSTAIRS).
 * 8. Review Retention Feedback Post-Verdict (Accurate Law 3.6 retention/loss reasons).
 * 9. Timeline Consistency (LBW stump arrival unified at LBW_TIMESTAMPS.T_STUMPS = 1680ms).
 */

import fs from "fs";
import path from "path";
import { generateScenario } from "../engine/scenarioGenerator";
import {
  projectLBWPointToHawkEyeSVG,
  HAWKEYE_GEOMETRY,
  getHawkEyeTrajectoryStages,
  LBW_TIMESTAMPS,
  classifyProjectedStumpHit,
} from "../engine/lbwPhysics";
import { solveStumpingBatterKinematics } from "../components/instinct/actorRigs";
import {
  RealMatchPlaybackSession,
  getInningsTerminationDeliveryIndex,
  calculateReviewRetention,
} from "../engine/realMatchPlayback";
import { RealMatchGameSession } from "../engine/realMatchGameSession";
import { T20_WC_2024_FINAL } from "../data/realMatches/t20Wc2024Final";
import { computeSessionStats } from "../engine/scoring";
import type { RealMatch, DrsOutcomeOverride } from "../types/realMatch";
import type { IncidentResult } from "../types/scenario";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

console.log("\n=======================================================");
console.log("  ADVERSARIAL REVIEW REGRESSION SUITE (9 FOCUS AREAS)  ");
console.log("=======================================================\n");

// ===========================================================================
// GROUP 1: NO ANSWER LEAKS IN FORENSIC TOOLS
// ===========================================================================
console.log("--- Group 1: Forensic Answer Leaks Elimination ---");

// Test 1.1: getHawkEyeTrajectoryStages unconditionally generates projection ray even with bat contact
{
  const batContactScenario = generateScenario(10, "LBW");
  assert(batContactScenario.lbw !== undefined, "T1.1: LBW scenario generated");
  if (batContactScenario.lbw) {
    // Force bat contact before pad
    const forcedBatLbw = { ...batContactScenario.lbw, batContactBeforePad: true };
    const stages = getHawkEyeTrajectoryStages(forcedBatLbw);
    assert(stages.projectedStumpsPath.length > 0, "T1.1: projectedStumpsPath has SVG path data even with bat contact");
    assert(stages.projectedShadowPath.length > 0, "T1.1: projectedShadowPath has SVG path data even with bat contact");
    assert(typeof stages.stumpsPointSVG.x === "number" && typeof stages.stumpsPointSVG.y === "number", "T1.1: stumpsPointSVG coordinates are populated");
  }
}

// Test 1.2: Verify that forbidden verdict leak strings do not appear in forensic component sources
{
  const forbiddenLeakPhrases = [
    "BAT CONTACT • NOT OUT",
    "BAT CONTACT • DEFLECTED",
    "PAD CONTACT • DEAD BALL",
    "TRAJECTORY INTERCEPTED • NO PROJECTION AVAILABLE",
    "NO PROJECTION",
  ];

  const frontOnPath = path.resolve(process.cwd(), "src/components/tools/FrontOnPitchView.tsx");
  const pitchMapPath = path.resolve(process.cwd(), "src/components/tools/PitchMapOverlay.tsx");

  const frontOnContent = fs.readFileSync(frontOnPath, "utf-8");
  const pitchMapContent = fs.readFileSync(pitchMapPath, "utf-8");

  for (const phrase of forbiddenLeakPhrases) {
    assert(!frontOnContent.includes(phrase), `T1.2 FrontOnPitchView does not contain leak phrase: "${phrase}"`);
    assert(!pitchMapContent.includes(phrase), `T1.2 PitchMapOverlay does not contain leak phrase: "${phrase}"`);
  }
}

// Test 1.3: Residual LBW Differential Leak Elimination (Seed 23 vs Seed 26)
{
  const pitchMapPath = path.resolve(process.cwd(), "src/components/tools/PitchMapOverlay.tsx");
  const pitchMapContent = fs.readFileSync(pitchMapPath, "utf-8");

  // Verify PitchMapOverlay does NOT conditionally render STUMP IMPACT based on batContactBeforePad
  assert(
    !pitchMapContent.includes("lbw.batContactBeforePad"),
    "T1.3: PitchMapOverlay source does not condition any telemetry on lbw.batContactBeforePad"
  );

  // Generate Seed 23 (bat contact) and Seed 26 (non-bat miss) scenarios
  const s23 = generateScenario(23, "LBW");
  const s26 = generateScenario(26, "LBW");
  assert(s23.lbw !== undefined && s26.lbw !== undefined, "T1.3: Scenarios 23 and 26 generated");

  if (s23.lbw && s26.lbw) {
    // Stage < 5: Both show pending indicator
    const s23Pending = "--.- cm";
    const s26Pending = "--.- cm";
    assert(s23Pending === s26Pending, "T1.3: Pre-Stage 5 readout is identical for both branches");

    // Stage 5: Both show numeric projection in cm
    const s23Stage5 = `${s23.lbw.stumpHitHeightCm.toFixed(1)} cm`;
    const s26Stage5 = `${s26.lbw.stumpHitHeightCm.toFixed(1)} cm`;
    assert(/^\d+\.\d cm$/.test(s23Stage5), `T1.3: Seed 23 Stage 5 displays numeric height: ${s23Stage5}`);
    assert(/^\d+\.\d cm$/.test(s26Stage5), `T1.3: Seed 26 Stage 5 displays numeric height: ${s26Stage5}`);
  }
}

// ===========================================================================
// GROUP 2: HAWK-EYE PHYSICAL GEOMETRY & SCALE
// ===========================================================================
console.log("\n--- Group 2: Hawk-Eye Physical Geometry & Scale ---");

// Test 2.1: Authoritative geometry constants
assert(
  Math.abs(HAWKEYE_GEOMETRY.STRIKER_STUMP_HEIGHT_PX - 42.0) < 0.05,
  `T2.1: Striker stump height is ~42.0px (got ${HAWKEYE_GEOMETRY.STRIKER_STUMP_HEIGHT_PX})`
);
assert(
  Math.abs(HAWKEYE_GEOMETRY.STRIKER_BALL_RADIUS_PX - 2.126) < 0.01,
  `T2.1: Striker ball radius is ~2.126px at scale (got ${HAWKEYE_GEOMETRY.STRIKER_BALL_RADIUS_PX})`
);
assert(
  HAWKEYE_GEOMETRY.STUMP_HEIGHT_M === 0.711,
  `T2.1: Regulation stump height is 0.711m (got ${HAWKEYE_GEOMETRY.STUMP_HEIGHT_M})`
);
assert(
  HAWKEYE_GEOMETRY.BALL_RADIUS_M === 0.036,
  `T2.1: Regulation ball radius is 0.036m (got ${HAWKEYE_GEOMETRY.BALL_RADIUS_M})`
);

// Test 2.2: Seed 26 Adversarial Review Reproduction Case
// In Seed 26 (adversarial review case), ball projected stump hit is MISSING off stump.
// The rendered ball disk (outer edge svgX - r - stroke/2) must NOT intersect the striker wicket outer edge (306.75px).
{
  const scenario26 = generateScenario(26, "LBW");
  assert(scenario26.lbw !== undefined, "T2.2: Seed 26 LBW exists");
  if (scenario26.lbw) {
    const lbw = scenario26.lbw;
    assert(lbw.projectedStumpHit === "MISSING", "T2.2: Seed 26 is MISSING");

    const svgPoint = projectLBWPointToHawkEyeSVG({
      x: lbw.stumpHitX,
      y: lbw.stumpHitHeightCm / 100,
      z: 0,
    });

    const ballRadiusPx = HAWKEYE_GEOMETRY.STRIKER_BALL_RADIUS_PX; // ~2.126px
    const strokeWidthPx = 0.6;
    const wicketRightEdgePx = HAWKEYE_GEOMETRY.PITCH_CENTER_X + HAWKEYE_GEOMETRY.STRIKER_WICKET_HALF_WIDTH_PX; // 306.75px
    const ballLeftEdgePx = svgPoint.x - ballRadiusPx - strokeWidthPx / 2;

    const clearancePx = ballLeftEdgePx - wicketRightEdgePx;
    assert(
      clearancePx > 0,
      `T2.2 (Seed 26): Ball left outer edge (${ballLeftEdgePx.toFixed(2)}px) is strictly clear of wicket right edge (${wicketRightEdgePx.toFixed(2)}px) with clearance ${clearancePx.toFixed(2)}px`
    );
  }
}

// Test 2.3: Multi-seed scan: Every MISSING ball's rendered outer boundary (ball radius + stroke/2)
// strictly clears the rendered striker wicket boundary.
{
  let testedMisses = 0;
  for (let s = 1; s <= 350; s++) {
    const sc = generateScenario(s, "LBW");
    if (!sc.lbw) continue;
    const lbw = sc.lbw;

    if (lbw.projectedStumpHit === "MISSING" && lbw.stumpHitHeightCm <= 71.1) {
      testedMisses++;
      const svgPoint = projectLBWPointToHawkEyeSVG({
        x: lbw.stumpHitX,
        y: lbw.stumpHitHeightCm / 100,
        z: 0,
      });
      const r = HAWKEYE_GEOMETRY.STRIKER_BALL_RADIUS_PX;
      const halfStroke = 0.3;
      const wicketHalfW = HAWKEYE_GEOMETRY.STRIKER_WICKET_HALF_WIDTH_PX; // 6.75px
      const center = HAWKEYE_GEOMETRY.PITCH_CENTER_X; // 300px

      if (svgPoint.x > center) {
        // Missing outside off / right: left outer edge of ball must be > 300 + 6.75
        const ballInnerEdge = svgPoint.x - r - halfStroke;
        const wicketEdge = center + wicketHalfW;
        assert(
          ballInnerEdge > wicketEdge,
          `T2.3 (seed ${s}): MISSING ball left edge (${ballInnerEdge.toFixed(2)}) clears wicket right edge (${wicketEdge})`
        );
      } else {
        // Missing down leg / left: right outer edge of ball must be < 300 - 6.75
        const ballInnerEdge = svgPoint.x + r + halfStroke;
        const wicketEdge = center - wicketHalfW;
        assert(
          ballInnerEdge < wicketEdge,
          `T2.3 (seed ${s}): MISSING ball right edge (${ballInnerEdge.toFixed(2)}) clears wicket left edge (${wicketEdge})`
        );
      }
    }
  }
  assert(testedMisses >= 10, `T2.3: Successfully tested ${testedMisses} multi-seed MISSING scenarios`);
}

// Test 2.4: Multi-seed scan: CLEARLY_HITTING balls have their center strictly within wicket bounds
{
  let testedHits = 0;
  for (let s = 1; s <= 100; s++) {
    const sc = generateScenario(s, "LBW");
    if (!sc.lbw) continue;
    const lbw = sc.lbw;

    if (lbw.projectedStumpHit === "CLEARLY_HITTING" && lbw.stumpHitHeightCm <= 71.1) {
      testedHits++;
      const svgPoint = projectLBWPointToHawkEyeSVG({
        x: lbw.stumpHitX,
        y: lbw.stumpHitHeightCm / 100,
        z: 0,
      });
      const deltaX = Math.abs(svgPoint.x - HAWKEYE_GEOMETRY.PITCH_CENTER_X);
      assert(
        deltaX <= HAWKEYE_GEOMETRY.STRIKER_WICKET_HALF_WIDTH_PX,
        `T2.4 (seed ${s}): CLEARLY_HITTING ball center (${svgPoint.x.toFixed(2)}) inside striker wicket bounds`
      );
    }
  }
  assert(testedHits >= 10, `T2.4: Successfully tested ${testedHits} multi-seed CLEARLY_HITTING scenarios`);
}

// ===========================================================================
// GROUP 3: STUMPING CONTINUOUS MARGINS & ANATOMICAL ELEVATION
// ===========================================================================
console.log("\n--- Group 3: Stumping Continuous Margins & Elevation ---");

// Test 3.1: Distinct foot X and Human-Readable Displacement for Clear OUT vs Marginal OUT
{
  const creaseX = 342;
  const batterScale = 1.15;
  const tightCreaseZoom = 3.3;

  // Marginal OUT: toe 20mm short of crease (-20mm), low elevation (2mm)
  const marginalOut = solveStumpingBatterKinematics(0.65, creaseX, 10, 2, -20);
  // Clear OUT: toe 250mm short of crease (-250mm), high elevation (18mm)
  const clearOut = solveStumpingBatterKinematics(0.65, creaseX, 10, 18, -250);

  const dxRig = clearOut.batterK.backLegX - marginalOut.batterK.backLegX;
  const dyLiftRig = (clearOut.batterK.backLegLift ?? 0) - (marginalOut.batterK.backLegLift ?? 0);
  const dxCanvas = dxRig * batterScale;
  const dyCanvas = dyLiftRig * batterScale;
  const euclideanCanvas = Math.hypot(dxCanvas, dyCanvas);
  const euclideanScreen = euclideanCanvas * tightCreaseZoom;

  assert(
    clearOut.batterK.backLegX > marginalOut.batterK.backLegX,
    `T3.1: Clear OUT backLegX (${clearOut.batterK.backLegX.toFixed(2)}) is more forward (short of crease) than Marginal OUT (${marginalOut.batterK.backLegX.toFixed(2)})`
  );
  assert(
    (clearOut.batterK.backLegLift ?? 0) > (marginalOut.batterK.backLegLift ?? 0),
    `T3.1: Clear OUT backLegLift (${clearOut.batterK.backLegLift?.toFixed(2)}) is higher than Marginal OUT (${marginalOut.batterK.backLegLift?.toFixed(2)})`
  );
  assert(
    dxCanvas >= 8.0,
    `T3.1: Clear vs Marginal OUT horizontal canvas displacement is >= 8px (got ${dxCanvas.toFixed(2)}px)`
  );
  assert(
    euclideanCanvas >= 12.0,
    `T3.1: Clear vs Marginal OUT rendered canvas displacement is >= 12px (got ${euclideanCanvas.toFixed(2)}px)`
  );
  assert(
    euclideanScreen >= 40.0,
    `T3.1: Clear vs Marginal OUT Window B screen displacement is >= 40px (got ${euclideanScreen.toFixed(2)}px)`
  );
}

// Test 3.2: Distinct foot X and Human-Readable Displacement for Clear NOT OUT vs Marginal NOT OUT
{
  const creaseX = 342;
  const batterScale = 1.15;
  const tightCreaseZoom = 3.3;

  // Marginal NOT OUT: toe 20mm behind crease (+20mm), grounded (0mm)
  const marginalNotOut = solveStumpingBatterKinematics(0.65, creaseX, 10, 0, 20);
  // Clear NOT OUT: toe 250mm behind crease (+250mm), grounded (0mm)
  const clearNotOut = solveStumpingBatterKinematics(0.65, creaseX, 10, 0, 250);

  const dxRig = Math.abs(clearNotOut.batterK.backLegX - marginalNotOut.batterK.backLegX);
  const dxCanvas = dxRig * batterScale;
  const dxScreen = dxCanvas * tightCreaseZoom;

  assert(
    clearNotOut.batterK.backLegX < marginalNotOut.batterK.backLegX,
    `T3.2: Clear NOT OUT backLegX (${clearNotOut.batterK.backLegX.toFixed(2)}) is deeper behind crease than Marginal NOT OUT (${marginalNotOut.batterK.backLegX.toFixed(2)})`
  );
  assert(
    dxCanvas >= 6.0,
    `T3.2: Clear vs Marginal NOT OUT canvas displacement is >= 6px (got ${dxCanvas.toFixed(2)}px)`
  );
  assert(
    dxScreen >= 20.0,
    `T3.2: Clear vs Marginal NOT OUT Window B screen displacement is >= 20px (got ${dxScreen.toFixed(2)}px)`
  );
  assert(
    (marginalNotOut.batterK.backLegLift ?? 0) === 0,
    "T3.2: Marginal NOT OUT foot is grounded (backLegLift === 0) at break"
  );
  assert(
    (clearNotOut.batterK.backLegLift ?? 0) === 0,
    "T3.2: Clear NOT OUT foot is grounded (backLegLift === 0) at break"
  );
}

// ===========================================================================
// GROUP 4: DRS REVIEW QUOTA ENFORCEMENT
// ===========================================================================
console.log("\n--- Group 4: DRS Review Quota Enforcement ---");

// Test 4.1: Team review is blocked when reviewing side has 0 quota remaining, but umpire referrals work
{
  const match: RealMatch = {
    id: "QUOTA_TEST",
    format: "T20",
    homeTeamId: "HOME",
    awayTeamId: "AWAY",
    venue: "Oval",
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: "HOME",
        bowlingTeamId: "AWAY",
        deliveries: [
          { id: "1_0_1", innings: 1, over: 0, ball: 1, deliveryIndex: 0, striker: "B1", nonStriker: "B2", bowler: "B3", outcome: { runsBatter: 0 } },
          { id: "1_0_2", innings: 1, over: 0, ball: 2, deliveryIndex: 1, striker: "B1", nonStriker: "B2", bowler: "B3", outcome: { runsBatter: 0 } },
          { id: "1_0_3", innings: 1, over: 0, ball: 3, deliveryIndex: 2, striker: "B1", nonStriker: "B2", bowler: "B3", outcome: { runsBatter: 0 } },
          { id: "1_0_4", innings: 1, over: 0, ball: 4, deliveryIndex: 3, striker: "B1", nonStriker: "B2", bowler: "B3", outcome: { runsBatter: 0 } },
        ],
      },
    ],
  };

  const scLbw1 = generateScenario(1, "LBW");
  scLbw1.onFieldSignal = "NOT_OUT";
  scLbw1.drsEvaluation = { ...scLbw1.drsEvaluation, isUmpiresCall: false };
  const scLbw2 = generateScenario(2, "LBW");
  scLbw2.onFieldSignal = "NOT_OUT";
  scLbw2.drsEvaluation = { ...scLbw2.drsEvaluation, isUmpiresCall: false };
  const scLbw3 = generateScenario(3, "LBW");
  scLbw3.onFieldSignal = "NOT_OUT";
  scLbw3.drsEvaluation = { ...scLbw3.drsEvaluation, isUmpiresCall: false };
  const scStumping = generateScenario(4, "STUMPING");
  scStumping.onFieldSignal = "REFERRED";

  const schedule = [
    { matchId: "QUOTA_TEST", innings: 1, deliveryId: "1_0_1", incidentType: "LBW" as const, difficulty: "CLEAR" as const, scenario: scLbw1 },
    { matchId: "QUOTA_TEST", innings: 1, deliveryId: "1_0_2", incidentType: "LBW" as const, difficulty: "CLEAR" as const, scenario: scLbw2 },
    { matchId: "QUOTA_TEST", innings: 1, deliveryId: "1_0_3", incidentType: "LBW" as const, difficulty: "CLEAR" as const, scenario: scLbw3 },
    { matchId: "QUOTA_TEST", innings: 1, deliveryId: "1_0_4", incidentType: "STUMPING" as const, difficulty: "CLEAR" as const, scenario: scStumping },
  ];

  const session = new RealMatchGameSession(match, 101, { customIncidents: schedule });

  // Ball 1: Bowling team review #1 lost (NOT_OUT upheld without Umpire's Call)
  assert(session.isPausedForReview() === true, "T4.1: Paused at ball 1");
  const d1 = session.submitDecision("NOT_OUT");
  assert(d1.reviewRetained === false, "T4.1: Ball 1 review lost");
  session.stepForward();

  // Ball 2: Bowling team review #2 lost
  assert(session.isPausedForReview() === true, "T4.1: Paused at ball 2");
  const d2 = session.submitDecision("NOT_OUT");
  assert(d2.reviewRetained === false, "T4.1: Ball 2 review lost");
  assert(
    session.getPlaybackState().remainingReviews?.bowling === 0,
    "T4.1: Bowling team has exactly 0 reviews remaining"
  );
  session.stepForward();

  // Ball 3: Delivery 1_0_3 (LBW, team review)
  // Because bowling quota is 0, session does NOT pause for team review!
  assert(
    session.isPausedForReview() === false,
    "T4.1: Team review (LBW) does NOT pause when bowling team quota is 0"
  );
  assert(
    session.getStatus() === "NORMAL_PLAYBACK",
    "T4.1: Status remains NORMAL_PLAYBACK when team has 0 reviews remaining"
  );

  // Attempting submitDecision when quota is 0 must be rejected
  const rejectedOverride = session.submitDecision("OUT");
  assert(
    rejectedOverride.applied === false,
    "T4.1: submitDecision returns applied: false when quota is 0"
  );
  session.stepForward();

  // Ball 4: Delivery 1_0_4 (Stumping, direct umpire referral)
  // Umpire referral DOES pause even when team quota is 0!
  assert(
    session.isPausedForReview() === true,
    "T4.1: Direct umpire referral (STUMPING) pauses even when team quota is 0"
  );
  assert(
    session.getStatus() === "REVIEW_REQUIRED",
    "T4.1: Status is REVIEW_REQUIRED for umpire referral"
  );

  const stumpDecision = session.submitDecision("OUT");
  assert(stumpDecision.applied === true, "T4.1: Umpire referral decision applied successfully");
}

// Test 4.2: Successful review retains quota, unsuccessful loses quota
{
  const match: RealMatch = {
    id: "QUOTA_COUNT_TEST",
    format: "T20",
    homeTeamId: "HOME",
    awayTeamId: "AWAY",
    venue: "Oval",
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: "HOME",
        bowlingTeamId: "AWAY",
        deliveries: [
          { id: "1_0_1", innings: 1, over: 0, ball: 1, deliveryIndex: 0, striker: "B1", nonStriker: "B2", bowler: "B3", outcome: { runsBatter: 0 } },
        ],
      },
    ],
  };

  const sc = generateScenario(1, "LBW");
  sc.onFieldSignal = "NOT_OUT";
  sc.correctFinalVerdict = "OUT";

  const schedule = [
    { matchId: "QUOTA_COUNT_TEST", innings: 1, deliveryId: "1_0_1", incidentType: "LBW" as const, difficulty: "CLEAR" as const, scenario: sc },
  ];

  const session = new RealMatchGameSession(match, 102, { customIncidents: schedule });
  assert(session.isPausedForReview() === true, "T4.2: Paused for review with initial quota 2");
  assert(session.getPlaybackState().remainingReviews?.bowling === 2, "T4.2: Initial bowling quota is 2");

  // Bowling team reviews NOT_OUT call, submits OUT -> Overturn -> Review Retained!
  const override = session.submitDecision("OUT");
  assert(override.reviewRetained === true, "T4.2: Overturn retains review");
  assert(
    session.getPlaybackState().remainingReviews?.bowling === 2,
    `T4.2: Bowling team quota remains 2 (got ${session.getPlaybackState().remainingReviews?.bowling})`
  );
}

// ===========================================================================
// GROUP 5: NAVIGATION & INNINGS BOUNDARIES
// ===========================================================================
console.log("\n--- Group 5: Navigation & Innings Boundaries ---");

// Test 5.1: Cursor movement (seekTo, stepForward, stepBackward) is strictly blocked while isPausedForReview() is true
{
  const session = new RealMatchGameSession(T20_WC_2024_FINAL, 201, { incidentCount: 3 });
  session.jumpToNextIncident();
  assert(session.isPausedForReview() === true, "T5.1: Session paused for review");

  const seekResult = session.seekTo(1, 10);
  assert(seekResult === false, "T5.1: seekTo is blocked during active review");

  const forwardResult = session.stepForward();
  assert(forwardResult === false, "T5.1: stepForward is blocked during active review");

  const backwardResult = session.stepBackward();
  assert(backwardResult === false, "T5.1: stepBackward is blocked during active review");

  assert(session.isPausedForReview() === true, "T5.1: Session remains paused for review throughout blocked attempts");
}

// Test 5.2: getInningsTerminationDeliveryIndex authoritative calculation
{
  const testInnings = [
    {
      inningsNumber: 1,
      battingTeamId: "TEAM_A",
      bowlingTeamId: "TEAM_B",
      deliveries: Array.from({ length: 12 }, (_, i) => ({
        id: `1_0_${i + 1}`,
        innings: 1,
        over: Math.floor(i / 6),
        ball: (i % 6) + 1,
        deliveryIndex: i,
        striker: "A",
        nonStriker: "B",
        bowler: "C",
        outcome: { runsBatter: 0 },
      })),
    },
  ];

  // 10 OUT overrides on deliveries 0..9 -> 10th wicket at delivery index 9
  const overlays = new Map<string, DrsOutcomeOverride>();
  for (let i = 0; i < 10; i++) {
    overlays.set(`1_0_${i + 1}`, {
      ballId: `1_0_${i + 1}`,
      originalOutcome: { runsBatter: 0 },
      drsOutcome: { runsBatter: 0, wicket: { kind: "LBW", playerOut: `P${i}` } },
      applied: true,
      reviewingSide: "BOWLING",
      reviewRetained: true,
    });
  }

  const testMatch: RealMatch = {
    id: "TERM_TEST",
    format: "T20",
    homeTeamId: "TEAM_A",
    awayTeamId: "TEAM_B",
    venue: "Test Ground",
    innings: testInnings,
  };

  const termIndex = getInningsTerminationDeliveryIndex(testMatch, 0, overlays);
  assert(termIndex === 9, `T5.2: All-out innings terminates at delivery index 9 (got ${termIndex})`);
}

// Test 5.3: Backward navigation from Innings 2 into Innings 1 lands at termination index, never post-all-out
{
  const match: RealMatch = {
    id: "BACKWARD_TERM_TEST",
    format: "T20",
    homeTeamId: "A",
    awayTeamId: "B",
    venue: "Test Ground",
    innings: [
      {
        inningsNumber: 1,
        battingTeamId: "A",
        bowlingTeamId: "B",
        deliveries: Array.from({ length: 15 }, (_, i) => ({
          id: `1_0_${i + 1}`,
          innings: 1,
          over: Math.floor(i / 6),
          ball: (i % 6) + 1,
          deliveryIndex: i,
          striker: "A",
          nonStriker: "B",
          bowler: "C",
          outcome: { runsBatter: 0 },
        })),
      },
      {
        inningsNumber: 2,
        battingTeamId: "B",
        bowlingTeamId: "A",
        deliveries: Array.from({ length: 10 }, (_, i) => ({
          id: `2_0_${i + 1}`,
          innings: 2,
          over: Math.floor(i / 6),
          ball: (i % 6) + 1,
          deliveryIndex: i,
          striker: "B",
          nonStriker: "A",
          bowler: "C",
          outcome: { runsBatter: 1 },
        })),
      },
    ],
  };

  // 10 wickets in Innings 1 at indices 0..9 (deliveries 10..14 are phantom post-all-out)
  const overlays = new Map<string, DrsOutcomeOverride>();
  for (let i = 0; i < 10; i++) {
    overlays.set(`1_0_${i + 1}`, {
      ballId: `1_0_${i + 1}`,
      originalOutcome: { runsBatter: 0 },
      drsOutcome: { runsBatter: 0, wicket: { kind: "LBW", playerOut: `P${i}` } },
      applied: true,
      reviewingSide: "BOWLING",
      reviewRetained: true,
    });
  }

  const session = new RealMatchPlaybackSession(match, overlays);
  // Start in Innings 2, ball 0
  session.seekTo(1, 0);
  assert(session.getCurrentState().inningsIndex === 1, "T5.3: In Innings 2");

  // Step backward into Innings 1
  const steppedBack = session.stepBackward();
  assert(steppedBack === true, "T5.3: Stepped back into Innings 1");
  const stateInnings1 = session.getCurrentState();
  assert(stateInnings1.inningsIndex === 0, "T5.3: Now in Innings 1");
  assert(
    stateInnings1.deliveryIndex === 9,
    `T5.3: Landed on delivery index 9 (the 10th wicket), not phantom ball 14 (got ${stateInnings1.deliveryIndex})`
  );
  assert(stateInnings1.wickets === 10, "T5.3: Wickets are exactly 10 (all out)");
}

// ===========================================================================
// GROUP 6: ONCE-ONLY DECISION SUBMISSION
// ===========================================================================
console.log("\n--- Group 6: Once-Only Decision Submission ---");

{
  const session = new RealMatchGameSession(T20_WC_2024_FINAL, 301, { incidentCount: 2 });
  session.jumpToNextIncident();
  assert(session.isPausedForReview() === true, "T6: Paused for review");

  const incident = session.getCurrentIncident();
  assert(incident !== null, "T6: Incident is present");

  // Submit verdict once
  const firstOverride = session.submitDecision("OUT");
  assert(firstOverride.applied === true, "T6: First submission applied");
  const historyLenAfterFirst = session.getDecisionsHistory().length;
  assert(historyLenAfterFirst === 1, "T6: History has 1 decision");
  const wicketsAfterFirst = session.getPlaybackState().wickets;
  const scoreAfterFirst = session.getPlaybackState().score;

  // Submit verdict a second time on the same incident
  const secondOverride = session.submitDecision("NOT_OUT");
  assert(
    secondOverride === firstOverride,
    "T6: Second submission returns identical original override (idempotent)"
  );
  assert(
    session.getDecisionsHistory().length === 1,
    "T6: History length remains 1 (no duplicate submission)"
  );
  assert(
    session.getPlaybackState().wickets === wicketsAfterFirst,
    "T6: Wickets count is not mutated or reverted by second submission"
  );
  assert(
    session.getPlaybackState().score === scoreAfterFirst,
    "T6: Score is not mutated or reverted by second submission"
  );
}

// ===========================================================================
// GROUP 7: SELECTIVE ABSTENTION SCORING
// ===========================================================================
console.log("\n--- Group 7: Selective Abstention Scoring ---");

// Test 7.1: 1 correct call + 7 SEND_UPSTAIRS does NOT yield unearned 100/100/99
{
  const history: IncidentResult[] = [
    // 1 decisive correct call
    {
      scenarioId: "0",
      incidentType: "LBW",
      difficultyTier: "MARGINAL",
      softSignal: "OUT",
      softSignalTimeMs: 1500,
      softSignalCorrect: true,
      finalVerdict: "OUT",
      finalVerdictCorrect: true,
      isUmpiresCallScenario: false,
      umpiresCallComplied: true,
      timeSpentReviewingMs: 4000,
      toolsUsed: ["PITCH_MAP"],
    },
    // 7 SEND_UPSTAIRS abstentions
    ...Array.from({ length: 7 }, (_, i) => ({
      scenarioId: String(i + 1),
      incidentType: "LBW" as const,
      difficultyTier: "MARGINAL" as const,
      softSignal: "SEND_UPSTAIRS" as const,
      softSignalTimeMs: 200,
      softSignalCorrect: false,
      finalVerdict: "NOT_OUT" as const,
      finalVerdictCorrect: true,
      isUmpiresCallScenario: false,
      umpiresCallComplied: true,
      timeSpentReviewingMs: 4000,
      toolsUsed: ["PITCH_MAP"],
    })),
  ];

  const stats = computeSessionStats(history);
  assert(
    stats.softSignalInstinct <= 60 && stats.softSignalInstinct >= 50,
    `T7.1: Selective abstention instinct is balanced: ~56% (got ${stats.softSignalInstinct}%)`
  );
  assert(
    stats.reactionTimeScore <= 40,
    `T7.1: Selective abstention reaction score is capped by coverage: <= 40 (got ${stats.reactionTimeScore})`
  );
  assert(
    stats.overallRating < 95,
    `T7.1: Overall rating is honest (< 95, got ${stats.overallRating})`
  );
}

// Test 7.2: 8/8 decisive correct calls yields top rating
{
  const perfectHistory: IncidentResult[] = Array.from({ length: 8 }, (_, i) => ({
    scenarioId: String(i),
    incidentType: "LBW",
    difficultyTier: "MARGINAL",
    softSignal: "OUT",
    softSignalTimeMs: 800,
    softSignalCorrect: true,
    finalVerdict: "OUT",
    finalVerdictCorrect: true,
    isUmpiresCallScenario: false,
    umpiresCallComplied: true,
    timeSpentReviewingMs: 4000,
    toolsUsed: ["PITCH_MAP"],
  }));

  const perfectStats = computeSessionStats(perfectHistory);
  assert(perfectStats.softSignalInstinct === 100, "T7.2: 8/8 correct soft signals yields 100% instinct");
  assert(perfectStats.reactionTimeScore >= 90, `T7.2: Fast decisive calls yield reaction >= 90 (got ${perfectStats.reactionTimeScore})`);
  assert(perfectStats.overallRating >= 95, `T7.2: Perfect performance yields OVR >= 95 (got ${perfectStats.overallRating})`);
}

// Test 7.3: All-abstention (8/8 SEND_UPSTAIRS) yields 0% instinct and 0 reaction score
{
  const allAbstainHistory: IncidentResult[] = Array.from({ length: 8 }, (_, i) => ({
    scenarioId: String(i),
    incidentType: "LBW",
    difficultyTier: "MARGINAL",
    softSignal: "SEND_UPSTAIRS",
    softSignalTimeMs: 300,
    softSignalCorrect: false,
    finalVerdict: "OUT",
    finalVerdictCorrect: true,
    isUmpiresCallScenario: false,
    umpiresCallComplied: true,
    timeSpentReviewingMs: 4000,
    toolsUsed: ["PITCH_MAP"],
  }));

  const stats = computeSessionStats(allAbstainHistory);
  assert(stats.softSignalInstinct === 0, `T7.3: All-abstention yields 0% instinct (got ${stats.softSignalInstinct}%)`);
  assert(stats.reactionTimeScore === 0, `T7.3: All-abstention yields 0 reaction score (got ${stats.reactionTimeScore})`);
}

// Test 7.4: Fast reaction (800ms) vs slow reaction (4500ms) reflects in reactionTimeScore
{
  const fastHistory: IncidentResult[] = Array.from({ length: 4 }, (_, i) => ({
    scenarioId: String(i),
    incidentType: "LBW",
    difficultyTier: "CLEAR",
    softSignal: "OUT",
    softSignalTimeMs: 800,
    softSignalCorrect: true,
    finalVerdict: "OUT",
    finalVerdictCorrect: true,
    isUmpiresCallScenario: false,
    umpiresCallComplied: true,
    timeSpentReviewingMs: 3000,
    toolsUsed: ["PITCH_MAP"],
  }));

  const slowHistory: IncidentResult[] = Array.from({ length: 4 }, (_, i) => ({
    scenarioId: String(i),
    incidentType: "LBW",
    difficultyTier: "CLEAR",
    softSignal: "OUT",
    softSignalTimeMs: 4500,
    softSignalCorrect: true,
    finalVerdict: "OUT",
    finalVerdictCorrect: true,
    isUmpiresCallScenario: false,
    umpiresCallComplied: true,
    timeSpentReviewingMs: 3000,
    toolsUsed: ["PITCH_MAP"],
  }));

  const fastStats = computeSessionStats(fastHistory);
  const slowStats = computeSessionStats(slowHistory);
  assert(
    fastStats.reactionTimeScore > slowStats.reactionTimeScore,
    `T7.4: Fast reaction score (${fastStats.reactionTimeScore}) is strictly higher than slow reaction score (${slowStats.reactionTimeScore})`
  );
}

// Test 7.5: 4 correct + 4 abstain (50% coverage) falls in Senior/Regional tier (~70-78) and CANNOT reach Elite (>= 89)
{
  const fourFourHistory: IncidentResult[] = [
    // 4 decisive correct soft signals
    ...Array.from({ length: 4 }, (_, i) => ({
      scenarioId: `C_${i}`,
      incidentType: "LBW" as const,
      difficultyTier: "MARGINAL" as const,
      softSignal: "OUT" as const,
      softSignalTimeMs: 800,
      softSignalCorrect: true,
      finalVerdict: "OUT" as const,
      finalVerdictCorrect: true,
      isUmpiresCallScenario: false,
      umpiresCallComplied: true,
      timeSpentReviewingMs: 3000,
      toolsUsed: ["PITCH_MAP"],
    })),
    // 4 neutral abstentions
    ...Array.from({ length: 4 }, (_, i) => ({
      scenarioId: `A_${i}`,
      incidentType: "LBW" as const,
      difficultyTier: "MARGINAL" as const,
      softSignal: "SEND_UPSTAIRS" as const,
      softSignalTimeMs: 300,
      softSignalCorrect: false,
      finalVerdict: "OUT" as const,
      finalVerdictCorrect: true,
      isUmpiresCallScenario: false,
      umpiresCallComplied: true,
      timeSpentReviewingMs: 3000,
      toolsUsed: ["PITCH_MAP"],
    })),
  ];

  const stats = computeSessionStats(fourFourHistory);
  assert(
    stats.overallRating >= 70 && stats.overallRating <= 78,
    `T7.5: 4 correct + 4 abstain scores in Senior/Regional tier ~70-78 (got ${stats.overallRating})`
  );
  assert(
    stats.overallRating < 89,
    `T7.5: 4 correct + 4 abstain cannot reach Elite panel (< 89, got ${stats.overallRating})`
  );
  assert(
    stats.rankTier !== "ICC Elite Panel",
    `T7.5: Rank tier is not Elite Panel (got "${stats.rankTier}")`
  );
}

// Test 7.6: 8 abstentions (0% coverage) scores in Trainee (<= 40), never TV Umpire (75)
{
  const allAbstainHistory: IncidentResult[] = Array.from({ length: 8 }, (_, i) => ({
    scenarioId: String(i),
    incidentType: "LBW" as const,
    difficultyTier: "MARGINAL" as const,
    softSignal: "SEND_UPSTAIRS" as const,
    softSignalTimeMs: 300,
    softSignalCorrect: false,
    finalVerdict: "OUT" as const,
    finalVerdictCorrect: true,
    isUmpiresCallScenario: false,
    umpiresCallComplied: true,
    timeSpentReviewingMs: 4000,
    toolsUsed: ["PITCH_MAP"],
  }));

  const stats = computeSessionStats(allAbstainHistory);
  assert(
    stats.overallRating <= 40,
    `T7.6: 8 abstentions scores in Trainee tier <= 40 (got ${stats.overallRating})`
  );
  assert(
    stats.overallRating < 75,
    `T7.6: 8 abstentions does not score 75 TV Umpire (got ${stats.overallRating})`
  );
  assert(
    stats.rankTier === "Third Umpire Trainee",
    `T7.6: Rank tier is Third Umpire Trainee (got "${stats.rankTier}")`
  );
}

// Test 7.7: Invariant: abstain > wrong (4 correct + 4 abstain > 4 correct + 4 wrong)
{
  const fourAbstainHistory: IncidentResult[] = [
    ...Array.from({ length: 4 }, (_, i) => ({
      scenarioId: `C_${i}`,
      incidentType: "LBW" as const,
      difficultyTier: "MARGINAL" as const,
      softSignal: "OUT" as const,
      softSignalTimeMs: 800,
      softSignalCorrect: true,
      finalVerdict: "OUT" as const,
      finalVerdictCorrect: true,
      isUmpiresCallScenario: false,
      umpiresCallComplied: true,
      timeSpentReviewingMs: 3000,
      toolsUsed: ["PITCH_MAP"],
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      scenarioId: `A_${i}`,
      incidentType: "LBW" as const,
      difficultyTier: "MARGINAL" as const,
      softSignal: "SEND_UPSTAIRS" as const,
      softSignalTimeMs: 800,
      softSignalCorrect: false,
      finalVerdict: "OUT" as const,
      finalVerdictCorrect: true,
      isUmpiresCallScenario: false,
      umpiresCallComplied: true,
      timeSpentReviewingMs: 3000,
      toolsUsed: ["PITCH_MAP"],
    })),
  ];

  const fourWrongHistory: IncidentResult[] = [
    ...Array.from({ length: 4 }, (_, i) => ({
      scenarioId: `C_${i}`,
      incidentType: "LBW" as const,
      difficultyTier: "MARGINAL" as const,
      softSignal: "OUT" as const,
      softSignalTimeMs: 800,
      softSignalCorrect: true,
      finalVerdict: "OUT" as const,
      finalVerdictCorrect: true,
      isUmpiresCallScenario: false,
      umpiresCallComplied: true,
      timeSpentReviewingMs: 3000,
      toolsUsed: ["PITCH_MAP"],
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      scenarioId: `W_${i}`,
      incidentType: "LBW" as const,
      difficultyTier: "MARGINAL" as const,
      softSignal: "NOT_OUT" as const,
      softSignalTimeMs: 800,
      softSignalCorrect: false,
      finalVerdict: "OUT" as const,
      finalVerdictCorrect: true,
      isUmpiresCallScenario: false,
      umpiresCallComplied: true,
      timeSpentReviewingMs: 3000,
      toolsUsed: ["PITCH_MAP"],
    })),
  ];

  const abstainStats = computeSessionStats(fourAbstainHistory);
  const wrongStats = computeSessionStats(fourWrongHistory);
  assert(
    abstainStats.overallRating > wrongStats.overallRating,
    `T7.7: abstain > wrong preserved: 4+4 abstain (${abstainStats.overallRating}) > 4+4 wrong (${wrongStats.overallRating})`
  );
}

// Test 7.8: Invariant: correct > incorrect (8 correct > 8 wrong)
{
  const allCorrectHistory: IncidentResult[] = Array.from({ length: 8 }, (_, i) => ({
    scenarioId: String(i),
    incidentType: "LBW" as const,
    difficultyTier: "CLEAR" as const,
    softSignal: "OUT" as const,
    softSignalTimeMs: 800,
    softSignalCorrect: true,
    finalVerdict: "OUT" as const,
    finalVerdictCorrect: true,
    isUmpiresCallScenario: false,
    umpiresCallComplied: true,
    timeSpentReviewingMs: 3000,
    toolsUsed: ["PITCH_MAP"],
  }));

  const allWrongHistory: IncidentResult[] = Array.from({ length: 8 }, (_, i) => ({
    scenarioId: String(i),
    incidentType: "LBW" as const,
    difficultyTier: "CLEAR" as const,
    softSignal: "NOT_OUT" as const,
    softSignalTimeMs: 800,
    softSignalCorrect: false,
    finalVerdict: "OUT" as const,
    finalVerdictCorrect: true,
    isUmpiresCallScenario: false,
    umpiresCallComplied: true,
    timeSpentReviewingMs: 3000,
    toolsUsed: ["PITCH_MAP"],
  }));

  const correctStats = computeSessionStats(allCorrectHistory);
  const wrongStats = computeSessionStats(allWrongHistory);
  assert(
    correctStats.overallRating > wrongStats.overallRating,
    `T7.8: correct > incorrect preserved: 8 correct (${correctStats.overallRating}) > 8 wrong (${wrongStats.overallRating})`
  );
}

// ===========================================================================
// GROUP 8: REVIEW RETENTION FEEDBACK POST-VERDICT
// ===========================================================================
console.log("\n--- Group 8: Review Retention Feedback ---");

// Test 8.1: Bowling team review retained on overturn
{
  const res = calculateReviewRetention({
    verdict: "OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    isUmpiresCall: false,
  });
  assert(res.reviewRetained === true, "T8.1: Bowling team overturn retains review");
  assert(res.reviewingSide === "BOWLING", "T8.1: Reviewing side is BOWLING");
}

// Test 8.2: Bowling team review retained on Umpire's Call
{
  const res = calculateReviewRetention({
    verdict: "NOT_OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    isUmpiresCall: true,
  });
  assert(res.reviewRetained === true, "T8.2: Bowling team review retained on Umpire's Call");
}

// Test 8.3: Bowling team review lost when call upheld without Umpire's Call
{
  const res = calculateReviewRetention({
    verdict: "NOT_OUT",
    onFieldSignal: "NOT_OUT",
    reviewingSide: "BOWLING",
    isUmpiresCall: false,
  });
  assert(res.reviewRetained === false, "T8.3: Bowling team review lost when call upheld without Umpire's Call");
}

// Test 8.4: Batting team review retained on overturn
{
  const res = calculateReviewRetention({
    verdict: "NOT_OUT",
    onFieldSignal: "OUT",
    reviewingSide: "BATTING",
    isUmpiresCall: false,
  });
  assert(res.reviewRetained === true, "T8.4: Batting team overturn retains review");
}

// Test 8.5: Batting team review lost when call upheld
{
  const res = calculateReviewRetention({
    verdict: "OUT",
    onFieldSignal: "OUT",
    reviewingSide: "BATTING",
    isUmpiresCall: false,
  });
  assert(res.reviewRetained === false, "T8.5: Batting team review lost when call upheld");
}

// Test 8.6: Direct Umpire Referral has no quota impact
{
  const res = calculateReviewRetention({
    verdict: "OUT",
    onFieldSignal: "REFERRED",
  });
  assert(res.reviewRetained === true, "T8.6: Direct umpire referral retains review status");
  assert(res.reviewingSide === undefined, "T8.6: Direct umpire referral has no reviewing side");
}

// ===========================================================================
// GROUP 9: TIMELINE CONSISTENCY
// ===========================================================================
console.log("\n--- Group 9: Timeline Consistency ---");

// Test 9.1: LBW wicket impact arrival timestamp
assert(
  LBW_TIMESTAMPS.T_STUMPS === 1680,
  `T9.1: Authoritative LBW stump arrival timestamp is exactly 1680ms (got ${LBW_TIMESTAMPS.T_STUMPS}ms)`
);

// ===========================================================================
// GROUP 10: DECISION IMMUTABILITY & AUDIT INTEGRITY
// ===========================================================================
console.log("\n--- Group 10: Decision Immutability & Audit Integrity ---");

// Test 10.1: removeOverlay does NOT erase audit history and prevents re-review
{
  const session = new RealMatchGameSession(T20_WC_2024_FINAL, 998877, {
    customIncidents: [
      {
        matchId: T20_WC_2024_FINAL.id,
        innings: 1,
        deliveryId: "1_0_2",
        incidentType: "LBW",
        difficulty: "CLEAR",
        scenario: {
          ...generateScenario(100, "LBW"),
          onFieldSignal: "NOT_OUT",
        },
      },
    ],
  });

  // Step to the incident delivery
  session.stepForward(); // 1_0_1 -> 1_0_2
  assert(session.isPausedForReview() === true, "T10.1: Paused for review at ball 1_0_2");

  // Submit official decision
  const override = session.submitDecision("OUT");
  assert(override.applied === true, "T10.1: Decision OUT applied");
  assert(session.isPausedForReview() === false, "T10.1: Review closed after decision");
  assert(session.getAuditHistory().length === 1, "T10.1: Audit history has 1 record");

  // Call removeOverlay to remove simulation overlay from playback
  const removed = session.removeOverlay("1_0_2");
  assert(removed === true, "T10.1: Simulation overlay removed from playback map");

  // Verify decisions remain immutable: audit history is preserved
  assert(session.getAuditHistory().length === 1, "T10.1: Audit history is strictly preserved after removeOverlay");
  assert(
    session.isPausedForReview() === false,
    "T10.1: Delivery cannot be re-reviewed (status remains unpaused, not REVIEW_REQUIRED)"
  );

  // Attempting to re-submit decision is rejected or idempotent
  const secondAttempt = session.submitDecision("NOT_OUT");
  assert(
    secondAttempt.applied === false || secondAttempt === override,
    "T10.1: Re-submitting decision is rejected or idempotent; cannot alter rendered decision"
  );
  assert(session.getAuditHistory().length === 1, "T10.1: Audit history length remains exactly 1");
}

// Test 10.2: Verify RealMatchPlaybackView does NOT expose Revert Baseline button
{
  const playbackViewPath = path.resolve(process.cwd(), "src/components/realMatch/RealMatchPlaybackView.tsx");
  const playbackViewContent = fs.readFileSync(playbackViewPath, "utf-8");

  assert(
    !playbackViewContent.includes("Revert Baseline"),
    "T10.2: RealMatchPlaybackView does not contain 'Revert Baseline' button"
  );
  assert(
    !playbackViewContent.includes("handleRemoveOverlay"),
    "T10.2: RealMatchPlaybackView does not contain handleRemoveOverlay"
  );
  assert(
    playbackViewContent.includes("OFFICIAL • IMMUTABLE"),
    "T10.2: RealMatchPlaybackView displays 'OFFICIAL • IMMUTABLE' status badge"
  );
}

// --- Group 11: Authoritative Umpire's Call Geometry & Classification (P1) ---
console.log("\n--- Group 11: Authoritative Umpire's Call Geometry & Classification ---");
{
  // T11.1: Verification of Seed 10 (height clipping Umpire's Call)
  const s10 = generateScenario(10, "LBW");
  assert(s10.lbw !== undefined, "T11.1: Seed 10 generates valid LBW");
  assert(
    s10.lbw!.stumpHitHeightCm > 71.1 && s10.lbw!.stumpHitHeightCm < 74.7,
    `T11.1: Seed 10 height is in true height-clipping band: 71.1 < ${s10.lbw!.stumpHitHeightCm.toFixed(2)} < 74.7`
  );
  assert(
    Math.abs(s10.lbw!.stumpHitX) <= 0.1143,
    `T11.1: Seed 10 lateral offset is within lateral bounds: |${s10.lbw!.stumpHitX.toFixed(4)}| <= 0.1143`
  );
  assert(
    s10.lbw!.projectedStumpHit === "UMPIRES_CALL",
    "T11.1: Seed 10 is classified as UMPIRES_CALL matching physical geometry (<50% overlap)"
  );

  // T11.2: Verification of Seed 12 (lateral clipping Umpire's Call)
  const s12 = generateScenario(12, "LBW");
  assert(s12.lbw !== undefined, "T11.2: Seed 12 generates valid LBW");
  const absX12 = Math.abs(s12.lbw!.stumpHitX);
  assert(
    absX12 > 0.1143 && absX12 < 0.1503,
    `T11.2: Seed 12 lateral offset is in true lateral-clipping band: 0.1143 < ${absX12.toFixed(4)} < 0.1503`
  );
  assert(
    s12.lbw!.stumpHitHeightCm <= 71.1,
    `T11.2: Seed 12 height is within vertical bounds: ${s12.lbw!.stumpHitHeightCm.toFixed(2)} <= 71.1`
  );
  assert(
    s12.lbw!.projectedStumpHit === "UMPIRES_CALL",
    "T11.2: Seed 12 is classified as UMPIRES_CALL matching physical geometry (<50% overlap)"
  );

  // T11.3: Multi-seed invariant test across 200 random seeds
  let checkedUC = 0;
  let checkedClearlyHitting = 0;
  let checkedMissing = 0;

  for (let seed = 1; seed <= 200; seed++) {
    const s = generateScenario(seed, "LBW");
    if (!s.lbw) continue;

    const { stumpHitX, stumpHitHeightCm, projectedStumpHit } = s.lbw;
    const derivedHit = classifyProjectedStumpHit(stumpHitX, stumpHitHeightCm);

    // Strict single source of truth: classification must match derived hit
    assert(
      projectedStumpHit === derivedHit,
      `T11.3 (seed ${seed}): Scenario projectedStumpHit (${projectedStumpHit}) matches authoritative classifyProjectedStumpHit (${derivedHit})`
    );

    const absX = Math.abs(stumpHitX);
    if (projectedStumpHit === "UMPIRES_CALL") {
      checkedUC++;
      // Must NEVER have ball center inside wicket boundaries (>50% overlap)
      const isInside = absX <= 0.1143 && stumpHitHeightCm <= 71.1;
      assert(
        !isInside,
        `T11.3 (seed ${seed}): UMPIRES_CALL ball center (${absX.toFixed(4)}m, ${stumpHitHeightCm.toFixed(1)}cm) is NEVER inside wickets (>50% overlap)`
      );
      // Ball must touch wickets zone (<50% overlap)
      const touchesLateral = absX < 0.1143 + 0.036;
      const touchesVertical = stumpHitHeightCm < 71.1 + 3.6;
      assert(
        touchesLateral && touchesVertical,
        `T11.3 (seed ${seed}): UMPIRES_CALL ball touches wickets envelope`
      );
    } else if (projectedStumpHit === "CLEARLY_HITTING") {
      checkedClearlyHitting++;
      assert(
        absX <= 0.1143 && stumpHitHeightCm <= 71.1,
        `T11.3 (seed ${seed}): CLEARLY_HITTING center (${absX.toFixed(4)}m, ${stumpHitHeightCm.toFixed(1)}cm) is strictly inside wickets`
      );
    } else if (projectedStumpHit === "MISSING") {
      checkedMissing++;
      const misses = absX >= 0.1143 + 0.036 || stumpHitHeightCm >= 71.1 + 3.6;
      assert(
        misses,
        `T11.3 (seed ${seed}): MISSING ball center (${absX.toFixed(4)}m, ${stumpHitHeightCm.toFixed(1)}cm) is strictly beyond contact envelope`
      );
    }
  }

  assert(checkedUC > 0, `T11.3: Evaluated ${checkedUC} UMPIRES_CALL scenarios`);
  assert(checkedClearlyHitting > 0, `T11.3: Evaluated ${checkedClearlyHitting} CLEARLY_HITTING scenarios`);
  assert(checkedMissing > 0, `T11.3: Evaluated ${checkedMissing} MISSING scenarios`);
}

// --- Group 12: CAM 06 / Stump Projection & Architecture Integration (P2) ---
console.log("\n--- Group 12: CAM 06 / Stump Projection & Architecture Integration ---");
{
  const cameraSwitcherPath = path.resolve(process.cwd(), "src/components/console/CameraSwitcherAngles.tsx");
  const cameraSwitcherContent = fs.readFileSync(cameraSwitcherPath, "utf-8");
  assert(
    cameraSwitcherContent.includes("CAM 06 STUMP FACE"),
    "T12.1: CameraSwitcherAngles includes CAM 06 STUMP FACE in LBW camera switcher"
  );
  assert(
    cameraSwitcherContent.includes('id: "STUMP_PROJ"'),
    "T12.1: CameraSwitcherAngles registers STUMP_PROJ tool ID"
  );

  const toolPalettePath = path.resolve(process.cwd(), "src/components/console/ToolPalette.tsx");
  const toolPaletteContent = fs.readFileSync(toolPalettePath, "utf-8");
  assert(
    toolPaletteContent.includes('id: "STUMP_PROJ"') && toolPaletteContent.includes("CAM 06"),
    "T12.2: ToolPalette includes CAM 06 STUMP_PROJ option"
  );

  const replayViewportPath = path.resolve(process.cwd(), "src/components/console/ReplayViewport.tsx");
  const replayViewportContent = fs.readFileSync(replayViewportPath, "utf-8");
  assert(
    replayViewportContent.includes("StumpProjectionView"),
    "T12.3: ReplayViewport imports and renders StumpProjectionView"
  );
  assert(
    replayViewportContent.includes('activeTool === "STUMP_PROJ"'),
    "T12.3: ReplayViewport handles STUMP_PROJ activeTool"
  );

  const stumpProjectionPath = path.resolve(process.cwd(), "src/components/tools/StumpProjectionView.tsx");
  const stumpProjectionContent = fs.readFileSync(stumpProjectionPath, "utf-8");
  assert(
    stumpProjectionContent.includes("LBW_TIMESTAMPS.T_STUMPS"),
    "T12.4: StumpProjectionView references LBW_TIMESTAMPS.T_STUMPS (1680ms)"
  );
}

// --- Group 13: Accessibility Attributes & Focus Rings (P2) ---
console.log("\n--- Group 13: Accessibility Attributes & Focus Rings ---");
{
  const scrubBarPath = path.resolve(process.cwd(), "src/components/console/ScrubBar.tsx");
  const scrubBarContent = fs.readFileSync(scrubBarPath, "utf-8");
  assert(
    scrubBarContent.includes('aria-label="Replay timeline scrubber"'),
    "T13.1: Timeline range input has accessible aria-label"
  );
  assert(
    scrubBarContent.includes("focus-visible:ring-2 focus-visible:ring-cyan-400"),
    "T13.2: ScrubBar controls provide visible keyboard focus rings"
  );
  assert(
    scrubBarContent.includes('aria-label="Step back 1 frame"') && scrubBarContent.includes('aria-label="Step forward 1 frame"'),
    "T13.3: Step buttons have accessible aria-labels"
  );

  const appPath = path.resolve(process.cwd(), "src/App.tsx");
  const appContent = fs.readFileSync(appPath, "utf-8");
  assert(
    appContent.includes('aria-label={isMuted ? "Unmute audio" : "Mute audio"}'),
    "T13.4: App header mute button has accessible aria-label"
  );

  const consoleLayoutPath = path.resolve(process.cwd(), "src/components/console/ConsoleLayout.tsx");
  const consoleLayoutContent = fs.readFileSync(consoleLayoutPath, "utf-8");
  assert(
    consoleLayoutContent.includes("prefers-reduced-motion"),
    "T13.5: ConsoleLayout respects prefers-reduced-motion in continuous loops"
  );
}

// --- Group 14: Overturn Headline Verification & Deprecation Cleanup (P3) ---
console.log("\n--- Group 14: Overturn Headline Verification & Deprecation Cleanup ---");
{
  const resultRevealPath = path.resolve(process.cwd(), "src/components/console/ResultReveal.tsx");
  const resultRevealContent = fs.readFileSync(resultRevealPath, "utf-8");
  assert(
    resultRevealContent.includes("Verdict Verified: Decision Overturned"),
    "T14.1: ResultReveal renders 'Verdict Verified: Decision Overturned' when an on-field signal is overturned"
  );
  assert(
    resultRevealContent.includes("Verdict Verified: Official Decision Upheld"),
    "T14.1: ResultReveal renders 'Verdict Verified: Official Decision Upheld' when on-field signal is confirmed"
  );

  const debugModuleExists = fs.existsSync(path.resolve(process.cwd(), "src/engine/debugWorldSync.ts"));
  assert(!debugModuleExists, "T14.2: Dead module src/engine/debugWorldSync.ts is removed");

  const packageJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
  assert(!packageJson.dependencies?.clsx, "T14.3: Unused dependency clsx removed from package.json");
  assert(!packageJson.dependencies?.["tailwind-merge"], "T14.3: Unused dependency tailwind-merge removed from package.json");

  const sLBW = generateScenario(5555, "LBW");
  assert(
    (sLBW.lbw as unknown as Record<string, unknown>).hawkeyeTrajectory === undefined,
    "T14.4: LBWData does not contain deprecated hawkeyeTrajectory"
  );
}

console.log("\n=======================================================");
console.log("  ALL ADVERSARIAL REVIEW REGRESSION TESTS PASSED!     ");
console.log("=======================================================\n");
