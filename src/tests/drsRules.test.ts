import {
  evaluateDRSLBW,
  evaluateRunOut,
  evaluateCaughtBehind,
  evaluateBoundary,
  checkDRSCompliance,
} from "../engine/drsRules";
import { generateScenario, generateSession } from "../engine/scenarioGenerator";
import { computeSessionStats, getRankInfo } from "../engine/scoring";
import type {
  LBWData,
  RunOutData,
  CaughtBehindData,
  BoundaryData,
  IncidentResult,
} from "../types/scenario";

function runAllDRSTests() {
  console.log("=================================================");
  console.log("   THIRD UMPIRE ROOM: FULL DRS TEST SUITE       ");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${detail ? `-> ${detail}` : ""}`);
      failed++;
    }
  }

  const baseLBW: LBWData = {
    isNoBall: false,
    frontFootOverstepMm: 0,
    batContactBeforePad: false,
    firstContactType: "PAD_FIRST",
    ultraEdgeSpikeAtBatFrame: false,
    pitchingZone: "IN_LINE",
    impactZone: "IN_LINE",
    impactHeight: 45,
    projectedStumpHit: "CLEARLY_HITTING",
    impactDistance: 2.0,
    batterHand: "RIGHT",
    shotOffered: true,
    spinOrPace: "PACE",
    ballSpeedKph: 140,
    pitchX: 0,
    impactX: 0,
    stumpHitX: 0,
    stumpHitHeightCm: 45,
    hawkeyeTrajectory: [],
  };

  console.log("\n--- GROUP 1: GATE 0 PRE-BALL-TRACKING ELIGIBILITY ---");
  // Test 1: Gate 0A - Front foot no-ball overturns on-field OUT to NOT OUT
  {
    const lbwNoBall: LBWData = { ...baseLBW, isNoBall: true, frontFootOverstepMm: 25 };
    const evalOut = evaluateDRSLBW(lbwNoBall, "OUT");
    assert(evalOut.correctFinalVerdict === "NOT_OUT" && evalOut.overturnRequired === true && evalOut.failedGate === "GATE_0A_NO_BALL",
      "Gate 0A: No-ball overturns on-field OUT to NOT OUT");
  }

  // Test 2: Gate 0A - Front foot no-ball confirms on-field NOT OUT
  {
    const lbwNoBall: LBWData = { ...baseLBW, isNoBall: true, frontFootOverstepMm: 30 };
    const evalNotOut = evaluateDRSLBW(lbwNoBall, "NOT_OUT");
    assert(evalNotOut.correctFinalVerdict === "NOT_OUT" && evalNotOut.overturnRequired === false && evalNotOut.failedGate === "GATE_0A_NO_BALL",
      "Gate 0A: No-ball confirms on-field NOT OUT");
  }

  // Test 3: Gate 0B - Prior bat contact overturns on-field OUT to NOT OUT
  {
    const lbwBatFirst: LBWData = { ...baseLBW, batContactBeforePad: true, firstContactType: "BAT_FIRST", ultraEdgeSpikeAtBatFrame: true };
    const evalOut = evaluateDRSLBW(lbwBatFirst, "OUT");
    assert(evalOut.correctFinalVerdict === "NOT_OUT" && evalOut.overturnRequired === true && evalOut.failedGate === "GATE_0B_BAT_FIRST",
      "Gate 0B: Bat-first contact overturns on-field OUT to NOT OUT");
  }

  // Test 4: Gate 0B - Prior bat contact confirms on-field NOT OUT
  {
    const lbwBatFirst: LBWData = { ...baseLBW, batContactBeforePad: true, firstContactType: "BAT_FIRST", ultraEdgeSpikeAtBatFrame: true };
    const evalNotOut = evaluateDRSLBW(lbwBatFirst, "NOT_OUT");
    assert(evalNotOut.correctFinalVerdict === "NOT_OUT" && evalNotOut.overturnRequired === false && evalNotOut.failedGate === "GATE_0B_BAT_FIRST",
      "Gate 0B: Bat-first contact confirms on-field NOT OUT");
  }

  console.log("\n--- GROUP 2: GATE 1 (PITCHING) & GATE 2 (IMPACT) ---");
  // Test 5: Gate 1 - Pitching Outside Leg is absolute NOT OUT
  {
    const lbwOutsideLeg: LBWData = { ...baseLBW, pitchingZone: "OUTSIDE_LEG" };
    const evalOut = evaluateDRSLBW(lbwOutsideLeg, "OUT");
    assert(evalOut.correctFinalVerdict === "NOT_OUT" && evalOut.overturnRequired === true && evalOut.failedGate === "GATE_1_PITCHING_LEG",
      "Gate 1: Pitching outside leg overturns OUT to NOT OUT");
  }

  // Test 6: Gate 1 - Pitching Outside Off is legal for LBW
  {
    const lbwOutsideOff: LBWData = { ...baseLBW, pitchingZone: "OUTSIDE_OFF" };
    const evalOut = evaluateDRSLBW(lbwOutsideOff, "OUT");
    assert(evalOut.correctFinalVerdict === "OUT" && evalOut.overturnRequired === false && evalOut.pitchingValid === true,
      "Gate 1: Pitching outside off is a legal line for LBW");
  }

  // Test 7: Gate 2 - Impact Outside Off WITH shot offered -> NOT OUT
  {
    const lbwImpactOffShot: LBWData = { ...baseLBW, impactZone: "OUTSIDE_LINE_PLAYING_SHOT", shotOffered: true };
    const evalOut = evaluateDRSLBW(lbwImpactOffShot, "OUT");
    assert(evalOut.correctFinalVerdict === "NOT_OUT" && evalOut.overturnRequired === true && evalOut.failedGate === "GATE_2_IMPACT_OFF",
      "Gate 2: Impact outside off with shot offered -> NOT OUT");
  }

  // Test 8: Gate 2 - Impact Outside Off with NO shot offered -> Valid for OUT
  {
    const lbwImpactOffNoShot: LBWData = { ...baseLBW, impactZone: "OUTSIDE_LINE_NO_SHOT", shotOffered: false };
    const evalNotOut = evaluateDRSLBW(lbwImpactOffNoShot, "NOT_OUT");
    assert(evalNotOut.correctFinalVerdict === "OUT" && evalNotOut.overturnRequired === true && evalNotOut.impactValid === true,
      "Gate 2: Impact outside off with NO stroke offered allows overturn to OUT");
  }

  console.log("\n--- GROUP 3: GATE 3 (WICKETS PROJECTION & UMPIRE'S CALL BRANCHES) ---");
  // Test 9: On-field OUT + Missing Stumps -> Overturn to NOT OUT
  {
    const lbwMissing: LBWData = { ...baseLBW, projectedStumpHit: "MISSING" };
    const evalOut = evaluateDRSLBW(lbwMissing, "OUT");
    assert(evalOut.correctFinalVerdict === "NOT_OUT" && evalOut.overturnRequired === true && evalOut.failedGate === "GATE_3_MISSING_WICKETS",
      "Gate 3: On-field OUT + MISSING -> OVERTURN to NOT_OUT");
  }

  // Test 10: On-field OUT + Umpire's Call -> STANDS as OUT (No overturn)
  {
    const lbwUC: LBWData = { ...baseLBW, projectedStumpHit: "UMPIRES_CALL" };
    const evalOut = evaluateDRSLBW(lbwUC, "OUT");
    assert(evalOut.correctFinalVerdict === "OUT" && evalOut.overturnRequired === false && evalOut.isUmpiresCall === true,
      "Gate 3: On-field OUT + UMPIRES_CALL -> STANDS as OUT");
  }

  // Test 11: On-field OUT + Clearly Hitting -> CONFIRMED OUT
  {
    const lbwHitting: LBWData = { ...baseLBW, projectedStumpHit: "CLEARLY_HITTING" };
    const evalOut = evaluateDRSLBW(lbwHitting, "OUT");
    assert(evalOut.correctFinalVerdict === "OUT" && evalOut.overturnRequired === false && evalOut.wicketsHitting === true,
      "Gate 3: On-field OUT + CLEARLY_HITTING -> CONFIRMED OUT");
  }

  // Test 12: On-field NOT_OUT + Missing Stumps -> CONFIRMED NOT OUT
  {
    const lbwMissing: LBWData = { ...baseLBW, projectedStumpHit: "MISSING" };
    const evalNotOut = evaluateDRSLBW(lbwMissing, "NOT_OUT");
    assert(evalNotOut.correctFinalVerdict === "NOT_OUT" && evalNotOut.overturnRequired === false && evalNotOut.failedGate === "GATE_3_MISSING_WICKETS",
      "Gate 3: On-field NOT_OUT + MISSING -> CONFIRMED NOT_OUT");
  }

  // Test 13: On-field NOT_OUT + Umpire's Call -> STANDS as NOT OUT (No overturn)
  {
    const lbwUC: LBWData = { ...baseLBW, projectedStumpHit: "UMPIRES_CALL" };
    const evalNotOut = evaluateDRSLBW(lbwUC, "NOT_OUT");
    assert(evalNotOut.correctFinalVerdict === "NOT_OUT" && evalNotOut.overturnRequired === false && evalNotOut.isUmpiresCall === true,
      "Gate 3: On-field NOT_OUT + UMPIRES_CALL -> STANDS as NOT_OUT");
  }

  // Test 14: On-field NOT_OUT + Clearly Hitting -> OVERTURN to OUT
  {
    const lbwHitting: LBWData = { ...baseLBW, projectedStumpHit: "CLEARLY_HITTING" };
    const evalNotOut = evaluateDRSLBW(lbwHitting, "NOT_OUT");
    assert(evalNotOut.correctFinalVerdict === "OUT" && evalNotOut.overturnRequired === true && evalNotOut.wicketsHitting === true,
      "Gate 3: On-field NOT_OUT + CLEARLY_HITTING -> OVERTURN to OUT");
  }

  console.log("\n--- GROUP 4: RUN-OUT, STUMPING, ULTRAEDGE & BOUNDARY RULES ---");
  // Test 15: Run Out: Bails dislodged before bat grounded -> OUT
  {
    const roData: RunOutData = {
      bailsDislodgedFrameMs: 1500,
      groundedFrameMs: 1650,
      marginMs: 150,
      batGrounded: true,
      batBounced: false,
      diveType: "DIVE",
      creaseMarginMm: -50,
      fielderThrow: "Direct Hit",
      keeperOrBowler: "Bowler",
    };
    const evalRo = evaluateRunOut(roData, "REFERRED");
    assert(evalRo.correctFinalVerdict === "OUT", "Run-Out: Bails dislodged before bat grounded -> OUT");
  }

  // Test 16: Run Out: Bat grounded before bails dislodged -> NOT OUT
  {
    const roData: RunOutData = {
      bailsDislodgedFrameMs: 1500,
      groundedFrameMs: 1350,
      marginMs: -150,
      batGrounded: true,
      batBounced: false,
      diveType: "SLIDE",
      creaseMarginMm: 45,
      fielderThrow: "Direct Hit",
      keeperOrBowler: "Bowler",
    };
    const evalRo = evaluateRunOut(roData, "REFERRED");
    assert(evalRo.correctFinalVerdict === "NOT_OUT", "Run-Out: Bat safely grounded before bails -> NOT OUT");
  }

  // Test 17: Run Out: Bat bounced/airborne at dislodgement frame -> OUT
  {
    const roData: RunOutData = {
      bailsDislodgedFrameMs: 1500,
      groundedFrameMs: 1300,
      marginMs: -200,
      batGrounded: false,
      batBounced: true,
      diveType: "SLIDE",
      creaseMarginMm: 10,
      fielderThrow: "Direct Hit",
      keeperOrBowler: "Bowler",
    };
    const evalRo = evaluateRunOut(roData, "REFERRED");
    assert(evalRo.correctFinalVerdict === "OUT", "Run-Out: Bat bounced airborne at time of dislodgement -> OUT");
  }

  // Test 18: Caught Behind: Conclusive edge -> OUT
  {
    const cbData: CaughtBehindData = {
      hasEdge: true,
      waveformSpikeTimeMs: 1200,
      distractorNoise: false,
      distractorTimeMs: null,
      distractorType: null,
      proximityFrameMs: 1200,
      spikeIntensity: 0.85,
      ballPassesBatFrameMs: 1200,
      gapMm: 0,
      soundType: "WOODY_SNICK",
    };
    const evalCb = evaluateCaughtBehind(cbData, "NOT_OUT");
    assert(evalCb.correctFinalVerdict === "OUT" && evalCb.overturnRequired === true,
      "Caught Behind: Conclusive edge overturns on-field NOT OUT to OUT");
  }

  // Test 19: Caught Behind: Pad decoy noise with daylight gap -> NOT OUT
  {
    const cbData: CaughtBehindData = {
      hasEdge: false,
      waveformSpikeTimeMs: null,
      distractorNoise: true,
      distractorTimeMs: 1320,
      distractorType: "PAD",
      proximityFrameMs: 1200,
      spikeIntensity: 0.1,
      ballPassesBatFrameMs: 1200,
      gapMm: 24,
      soundType: "DULL_THUD",
    };
    const evalCb = evaluateCaughtBehind(cbData, "OUT");
    assert(evalCb.correctFinalVerdict === "NOT_OUT" && evalCb.overturnRequired === true,
      "Caught Behind: Pad decoy noise with daylight overturns on-field OUT to NOT OUT");
  }

  // Test 20: Boundary: Touching cushion with ball -> NOT OUT (Boundary awarded)
  {
    const bData: BoundaryData = {
      ropeContactFrameMs: 1400,
      releaseFrameMs: 1480,
      isBoundary: true,
      fielderTouchingRopeWhileInContact: true,
      marginMm: 50,
      catchOrSave: "BOUNDARY_TOUCH",
    };
    const evalB = evaluateBoundary(bData, "REFERRED");
    assert(evalB.correctFinalVerdict === "NOT_OUT", "Boundary: Touching cushion with ball -> Boundary awarded (NOT OUT)");
  }

  // Test 21: Boundary: Clean release before rope touch -> OUT (Catch awarded)
  {
    const bData: BoundaryData = {
      ropeContactFrameMs: 1400,
      releaseFrameMs: 1320,
      isBoundary: false,
      fielderTouchingRopeWhileInContact: false,
      marginMm: -50,
      catchOrSave: "RELAY_CATCH",
    };
    const evalB = evaluateBoundary(bData, "REFERRED");
    assert(evalB.correctFinalVerdict === "OUT", "Boundary: Clean aerial catch inside field of play -> OUT");
  }

  console.log("\n--- GROUP 5: SCENARIO GENERATOR INVARIANTS & DETERMINISM ---");
  // Test 22: Deterministic Generation
  {
    const s1 = generateScenario(424242);
    const s2 = generateScenario(424242);
    assert(JSON.stringify(s1) === JSON.stringify(s2), "Generator Determinism: Identical seed produces identical scenario");
  }

  // Test 23: Generator Override parameters
  {
    const sLBW = generateScenario(12345, "LBW", "HOWLER");
    assert(sLBW.incidentType === "LBW" && sLBW.difficultyTier === "HOWLER", "Generator Override: Correctly forces LBW and HOWLER tier");
  }

  // Test 24: Session Generator returns exact count
  {
    const session = generateSession(8, 9999);
    assert(session.length === 8, "Generator Session: Generates requested incident count");
  }

  console.log("\n--- GROUP 6: SCORING ENGINE & UMPIRE'S CALL IQ (UCI) FIX ---");
  // Test 25: UCI Denominator Calculation
  {
    const history: IncidentResult[] = [
      { scenarioId: "1", incidentType: "LBW", difficultyTier: "MARGINAL", softSignal: "OUT", softSignalTimeMs: 4000, softSignalCorrect: true, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: true, umpiresCallComplied: true, timeSpentReviewingMs: 10000, toolsUsed: ["PITCH_MAP"] },
      { scenarioId: "2", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: "OUT", softSignalTimeMs: 4000, softSignalCorrect: true, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 10000, toolsUsed: ["PITCH_MAP"] },
      { scenarioId: "3", incidentType: "LBW", difficultyTier: "HOWLER", softSignal: "OUT", softSignalTimeMs: 4000, softSignalCorrect: false, finalVerdict: "NOT_OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: false, timeSpentReviewingMs: 10000, toolsUsed: ["PITCH_MAP"] },
      { scenarioId: "4", incidentType: "RUN_OUT", difficultyTier: "MARGINAL", softSignal: "OUT", softSignalTimeMs: 4000, softSignalCorrect: true, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 10000, toolsUsed: ["CREASE_ZOOM"] },
    ];

    const stats = computeSessionStats(history);
    assert(stats.qualifyingUCIIncidents === 2, "Scoring UCI: Correctly identifies 2 qualifying incidents (1 LBW UC + 1 Howler)");
    assert(stats.umpiresCallIQ === 50, "Scoring UCI: Correctly computes 50% UCI on qualifying incidents only");
  }

  // Test 26: Soft Signal Instinct metric ignores neutral SEND_UPSTAIRS
  {
    const history: IncidentResult[] = [
      { scenarioId: "1", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: "OUT", softSignalTimeMs: 4000, softSignalCorrect: true, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 0, toolsUsed: [] },
      { scenarioId: "2", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: "NOT_OUT", softSignalTimeMs: 4000, softSignalCorrect: false, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 0, toolsUsed: [] },
      { scenarioId: "3", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: "SEND_UPSTAIRS", softSignalTimeMs: 4000, softSignalCorrect: false, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 0, toolsUsed: [] },
    ];
    const stats = computeSessionStats(history);
    assert(stats.softSignalInstinct === 50, "Scoring: Evaluates soft signal instinct ignoring SEND_UPSTAIRS neutral calls");
  }

  // Test 27: Streak tracking calculation
  {
    const history: IncidentResult[] = [
      { scenarioId: "S1", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: null, softSignalTimeMs: 0, softSignalCorrect: false, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 0, toolsUsed: [] },
      { scenarioId: "S2", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: null, softSignalTimeMs: 0, softSignalCorrect: false, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 0, toolsUsed: [] },
      { scenarioId: "S3", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: null, softSignalTimeMs: 0, softSignalCorrect: false, finalVerdict: "NOT_OUT", finalVerdictCorrect: false, isUmpiresCallScenario: false, umpiresCallComplied: false, timeSpentReviewingMs: 0, toolsUsed: [] },
      { scenarioId: "S4", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: null, softSignalTimeMs: 0, softSignalCorrect: false, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 0, toolsUsed: [] },
    ];
    const stats = computeSessionStats(history);
    assert(stats.longestStreak === 2, "Scoring: Correctly computes longest correct decision streak");
  }

  // Test 28: Rank Ladder bounds
  {
    assert(getRankInfo(35).tier === "Third Umpire Trainee", "Rank Ladder: 35 OVR -> Third Umpire Trainee");
    assert(getRankInfo(55).tier === "Club Level Official", "Rank Ladder: 55 OVR -> Club Level Official");
    assert(getRankInfo(70).tier === "TV Umpire", "Rank Ladder: 70 OVR -> TV Umpire");
    assert(getRankInfo(82).tier === "ICC Panel Umpire", "Rank Ladder: 82 OVR -> ICC Panel Umpire");
    assert(getRankInfo(95).tier === "ICC Elite Panel", "Rank Ladder: 95 OVR -> ICC Elite Panel");
  }

  // Test 29: Howler Detection metric
  {
    const history: IncidentResult[] = [
      { scenarioId: "H1", incidentType: "LBW", difficultyTier: "HOWLER", softSignal: null, softSignalTimeMs: 0, softSignalCorrect: false, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 0, toolsUsed: [] },
      { scenarioId: "H2", incidentType: "LBW", difficultyTier: "HOWLER", softSignal: null, softSignalTimeMs: 0, softSignalCorrect: false, finalVerdict: "NOT_OUT", finalVerdictCorrect: false, isUmpiresCallScenario: false, umpiresCallComplied: false, timeSpentReviewingMs: 0, toolsUsed: [] },
      { scenarioId: "N1", incidentType: "LBW", difficultyTier: "CLEAR", softSignal: null, softSignalTimeMs: 0, softSignalCorrect: false, finalVerdict: "OUT", finalVerdictCorrect: true, isUmpiresCallScenario: false, umpiresCallComplied: true, timeSpentReviewingMs: 0, toolsUsed: [] },
    ];
    const stats = computeSessionStats(history);
    assert(stats.howlerDetection === 50, "Scoring: Howler detection computed as 50% across 2 howler scenarios");
  }

  // Test 30: DRS Compliance check for Umpire's Call on NOT_OUT
  {
    const drsUC = evaluateDRSLBW({ ...baseLBW, projectedStumpHit: "UMPIRES_CALL" }, "NOT_OUT");
    const userOverturnedToOut = checkDRSCompliance("LBW", "OUT", "NOT_OUT", drsUC);
    assert(userOverturnedToOut.complied === false, "DRS Compliance: Flags improper overturn to OUT on Umpire's Call");
    const userUpheldNotOut = checkDRSCompliance("LBW", "NOT_OUT", "NOT_OUT", drsUC);
    assert(userUpheldNotOut.complied === true, "DRS Compliance: Approves upholding NOT_OUT on Umpire's Call");
  }

  console.log("\n--- GROUP 7: PHASE 1 INITIAL EVIDENCE SYSTEM & DETERMINISM ---");
  // Test 31: Evidence Determinism
  {
    const s1 = generateScenario(55555);
    const s2 = generateScenario(55555);
    assert(JSON.stringify(s1.initialEvidence) === JSON.stringify(s2.initialEvidence),
      "Evidence Determinism: Identical seed yields identical Phase 1 initial evidence");
  }

  // Test 32: Evidence Diversity across different seeds
  {
    const s1 = generateScenario(1001, "LBW");
    const s2 = generateScenario(2002, "LBW");
    assert(s1.initialEvidence?.lbw !== undefined && s2.initialEvidence?.lbw !== undefined,
      "Evidence Diversity: Generates valid evidence across different seeds");
  }

  // Test 33: Difficulty Tiers affect visual ambiguity scores
  {
    const sClear = generateScenario(7771, "LBW", "CLEAR");
    const sMarginal = generateScenario(7772, "LBW", "MARGINAL");
    const scoreClear = sClear.initialEvidence?.lbw?.visualAmbiguityScore ?? 0;
    const scoreMarginal = sMarginal.initialEvidence?.lbw?.visualAmbiguityScore ?? 0;
    assert(scoreClear < 0.3 && scoreMarginal > 0.7,
      "Difficulty Tiers: CLEAR has low ambiguity (<0.3) while MARGINAL has high ambiguity (>0.7)");
  }

  // Test 34: No Phase 2 forensic coordinates leaked into initial evidence
  {
    const sLBW = generateScenario(8881, "LBW");
    const ev = sLBW.initialEvidence?.lbw as unknown as Record<string, unknown>;
    assert(ev.hawkeyeTrajectory === undefined && ev.stumpHitHeightCm === undefined && ev.firstContactType === undefined,
      "Forensic Separation: Initial evidence does not leak Phase 2 3D coordinates or exact heights");
  }

  // Test 35: LBW initial evidence matches ground truth pitching zone
  {
    const sLeg = generateScenario(9991, "LBW", "CLEAR");
    if (sLeg.lbw?.pitchingZone === "OUTSIDE_LEG") {
      assert(sLeg.initialEvidence?.lbw?.apparentPitchLine === "OUTSIDE_LEG",
        "LBW Evidence Consistency: Outside leg pitch reflects in apparent pitch line");
    } else {
      assert(sLeg.initialEvidence?.lbw?.apparentPitchLine !== undefined,
        "LBW Evidence Consistency: Apparent pitch line is defined and consistent");
    }
  }

  // Test 36: Caught Behind initial evidence matches edge state
  {
    const sEdge = generateScenario(4441, "CAUGHT_BEHIND", "CLEAR");
    if (sEdge.caughtBehind?.hasEdge) {
      assert(sEdge.initialEvidence?.caughtBehind?.apparentDeflectionAngleDeg! > 0,
        "Caught Behind Evidence: Edge scenario produces noticeable apparent deflection in CLEAR tier");
    } else {
      assert(sEdge.initialEvidence?.caughtBehind?.apparentGapPixels! > 0,
        "Caught Behind Evidence: No-edge scenario produces visible daylight gap in CLEAR tier");
    }
  }

  // Test 37: Run-Out initial evidence reflects margin direction
  {
    const sRo = generateScenario(3331, "RUN_OUT", "CLEAR");
    const isOut = sRo.drsEvaluation.correctFinalVerdict === "OUT";
    const marginPx = sRo.initialEvidence?.runOut?.visualMarginPixels ?? 0;
    assert(isOut ? marginPx < 0 : marginPx > 0,
      "Run-Out Evidence: Margin pixels direction matches OUT (negative/short) vs SAFE (positive/inside)");
  }

  // Test 38: Boundary initial evidence reflects touch vs release
  {
    const sB = generateScenario(2221, "BOUNDARY", "CLEAR");
    const isBoundary = sB.boundary?.isBoundary;
    const releaseTiming = sB.initialEvidence?.boundary?.apparentReleaseTiming;
    assert(isBoundary ? releaseTiming === "HELD_OVER_ROPE" : releaseTiming === "EARLY_LOB",
      "Boundary Evidence: Release timing in CLEAR matches held over rope vs early lob");
  }

  // Test 39: All 5 incident types produce valid, non-null initial evidence
  {
    const types = ["LBW", "RUN_OUT", "STUMPING", "CAUGHT_BEHIND", "BOUNDARY"] as const;
    let allValid = true;
    for (const t of types) {
      const scn = generateScenario(12345, t);
      if (!scn.initialEvidence) allValid = false;
    }
    assert(allValid, "Initial Evidence: All 5 incident types produce complete initial evidence objects");
  }

  console.log("=================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================");

  if (failed > 0) {
    throw new Error(`DRS unit test suite encountered ${failed} failure(s).`);
  }
}

runAllDRSTests();
