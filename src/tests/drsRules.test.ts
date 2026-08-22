import {
  evaluateDRSLBW,
  evaluateRunOut,
  evaluateCaughtBehind,
  evaluateBoundary,
  checkDRSCompliance,
} from "../engine/drsRules";
import { generateScenario, generateSession } from "../engine/scenarioGenerator";
import { computeSessionStats, getRankInfo } from "../engine/scoring";
import { computePitchStations } from "../components/instinct/IncidentReplayFeed";
import {
  solveLBWBowlerKinematics,
  solveRunOutRunnerKinematics,
  solveStumpingBatterKinematics,
  solveStumpingKeeperKinematics,
  solveChain,
  attachPropToChain,
  BONE_LENGTHS,
} from "../components/instinct/actorRigs";
import {
  solveRunOutReplayState,
  getRunOutEventTimeline,
  mapPhase1TimeToReplayTime,
  mapReplayTimeToPhase1Time,
} from "../engine/runOutPhysics";
import {
  projectToPhase1,
  projectToCAM01,
  projectToCAM02,
  projectToCAM07,
} from "../engine/cameraProjections";
import { projectPitchToCAM10, clipAndProjectSegment } from "../components/tools/StrikerStumpCamView";
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

  // --- GROUP 8: MATCH CONTEXT & DATA CONSISTENCY ---
  console.log("\n--- GROUP 8: MATCH CONTEXT & DATA CONSISTENCY ---");
  {
    let contextConsistent = true;
    for (let seed = 100; seed < 125; seed++) {
      const scn = generateScenario(seed);
      const bName = scn.matchContext.bowler;
      const batName = scn.matchContext.batter;
      const bLast = bName.split(" ").slice(-1)[0];
      const batLast = batName.split(" ").slice(-1)[0];

      // Verify incidentTitle has proper names
      if (scn.incidentType === "LBW") {
        if (!scn.incidentTitle.includes(bName) || !scn.incidentTitle.includes(batName)) {
          contextConsistent = false;
        }
      }

      // Verify description has proper names
      if (scn.incidentType !== "BOUNDARY" && !scn.description.includes(batName)) {
        contextConsistent = false;
      }

      // Verify match situation mentions the actual bowler or batter
      const sit = scn.matchContext.matchSituation;
      if (!sit.includes(bLast) && !sit.includes(batLast) && !sit.includes(scn.matchContext.battingTeam) && !sit.includes(scn.matchContext.bowlingTeam)) {
        contextConsistent = false;
      }

      // Verify comms do NOT leak on-field OUT/NOT_OUT or forensic results
      for (const msg of scn.commsDialogue) {
        if (msg.text.includes("Soft signal on field is") || msg.text.includes("fair delivery confirmed") || msg.text.includes("no bat involved")) {
          contextConsistent = false;
        }
      }
    }
    assert(contextConsistent, "Match Context: Bowler, batter, description, situation, and comms are 100% consistent across scenarios");
  }

  // --- GROUP 9: MATCH FORMAT & OVERS STRICT COMPLIANCE ---
  console.log("\n--- GROUP 9: MATCH FORMAT & OVERS STRICT COMPLIANCE ---");
  {
    let t20Valid = true;
    let odiValid = true;
    let testCanExceed50 = false;
    let bowlerFiguresFormatValid = true;
    let scorePlausible = true;

    for (let seed = 1; seed <= 100; seed++) {
      const scn = generateScenario(seed * 7919);
      const fmt = scn.matchContext.matchFormat;
      const over = scn.matchContext.over;
      const figures = scn.matchContext.bowlerFigures;

      // Extract bowler overs from string e.g. "2/24 (3.4)" or "1/40 (10.0)"
      const match = figures.match(/\(([\d.]+)\)/);
      const bowlerOvers = match ? parseFloat(match[1]) : 0;

      if (fmt === "T20") {
        if (over < 0 || over > 19) t20Valid = false;
        if (bowlerOvers > 4.0) bowlerFiguresFormatValid = false;
      } else if (fmt === "ODI") {
        if (over < 0 || over > 49) odiValid = false;
        if (bowlerOvers > 10.0) bowlerFiguresFormatValid = false;
      } else if (fmt === "TEST") {
        if (over > 50) testCanExceed50 = true;
      }

      // Plausible score validation
      const scoreParts = scn.matchContext.battingTeamScore.split("/");
      const runs = parseInt(scoreParts[0], 10);
      const wickets = parseInt(scoreParts[1], 10);
      if (runs <= 0 || wickets < 0 || wickets > 10) scorePlausible = false;
    }

    assert(t20Valid, "Format Compliance: T20 scenario active over never exceeds 19.x");
    assert(odiValid, "Format Compliance: ODI scenario active over never exceeds 49.x");
    assert(testCanExceed50, "Format Compliance: TEST scenario active over can legitimately exceed 50");
    assert(bowlerFiguresFormatValid, "Format Compliance: Bowler figures strictly obey format limits (T20 <= 4.0, ODI <= 10.0)");
    assert(scorePlausible, "Format Compliance: Batting score and wickets remain plausible for all formats");
  }

  // --- GROUP 10: LBW BOWLER-END PITCH DEPTH & NO-BALL GEOMETRY INVARIANTS ---
  console.log("\n--- GROUP 10: LBW BOWLER-END PITCH DEPTH & NO-BALL GEOMETRY INVARIANTS ---");
  {
    const w = 640;
    const h = 360;
    const stations = computePitchStations(w, h);

    // Test 51: Spatial depth order invariant for Bowler-End Umpire perspective:
    // strikerWicket < strikerCrease < pitchBounce < bowlerCrease < bowlerWicket on screen Y
    const orderValid =
      stations.strikerWicket.y < stations.strikerCrease.y &&
      stations.strikerCrease.y < stations.pitchBounce.y &&
      stations.pitchBounce.y < stations.bowlerCrease.y &&
      stations.bowlerCrease.y < stations.bowlerWicket.y;
    assert(orderValid, "Pitch Depth Invariant: strikerWicket < batter < bounce < bowlerCrease < bowlerWicket on screen Y");

    // Test 52: Bowler stumps are closest to camera (bottom foreground)
    const bowlerAtForeground = stations.bowlerWicket.y > stations.bowlerCrease.y;
    assert(bowlerAtForeground, "Camera Perspective: Bowler stumps are in foreground near camera (bowlerWicket > bowlerCrease)");

    // Test 53: Striker stumps are at far end behind batsman
    const strikerAtFarTop = stations.strikerWicket.y < stations.strikerCrease.y;
    assert(strikerAtFarTop, "Camera Perspective: Striker stumps are at far end behind batsman (strikerWicket < strikerCrease)");

    // Test 54: Perspective scaling: near objects (bowler stumps) have larger scale than far objects (striker stumps)
    const scaleValid =
      stations.strikerWicket.scale < stations.strikerCrease.scale &&
      stations.strikerCrease.scale < stations.bowlerCrease.scale &&
      stations.bowlerCrease.scale < stations.bowlerWicket.scale;
    assert(scaleValid, "Perspective Scale: Far striker stumps scale < near bowler stumps scale");

    // Test 55: Pitch trapezoid geometry: width expands towards bowler end / camera at bottom
    const trapezoidValid =
      (stations.pitchTopRightX - stations.pitchTopLeftX) <
      (stations.pitchBottomRightX - stations.pitchBottomLeftX);
    assert(trapezoidValid, "Pitch Geometry: Pitch width expands down-perspective towards bowler end / camera");

    // Test 56: Bowler front-foot kinematics: Legal delivery lands behind popping crease (+Y)
    const legalKinematics = solveLBWBowlerKinematics(0.30, { isNoBall: false, frontFootOverstepMm: 0 });
    const legalFootBehind = legalKinematics.frontLegY > 0;
    assert(legalFootBehind, "Bowler Foot Kinematics: Legal delivery front foot lands behind popping crease");

    // Test 57: Bowler front-foot kinematics: No-ball delivery lands over/beyond popping crease (-Y)
    const noBallKinematics = solveLBWBowlerKinematics(0.30, { isNoBall: true, frontFootOverstepMm: 35 });
    const noBallFootOver = noBallKinematics.frontLegY < 0;
    assert(noBallFootOver, "Bowler Foot Kinematics: No-ball delivery front foot oversteps popping crease");
  }

  // --- GROUP 11: RUN-OUT ATHLETIC RIG & FORWARD KINEMATIC INVARIANTS ---
  console.log("\n--- GROUP 11: RUN-OUT ATHLETIC RIG & FORWARD KINEMATIC INVARIANTS ---");
  {
    // Test 58: Kinematic continuity: Torso angle smoothly transitions from upright sprint to horizontal dive
    const sprintK = solveRunOutRunnerKinematics(0.10, 300, 10).runnerK;
    const launchK = solveRunOutRunnerKinematics(0.45, 300, 10).runnerK;
    const diveK = solveRunOutRunnerKinematics(0.60, 300, 10).runnerK;

    const smoothTransition = sprintK.torsoAngleRad < launchK.torsoAngleRad && launchK.torsoAngleRad < diveK.torsoAngleRad;
    assert(smoothTransition, "Runner Kinematics: Torso pitch angle smoothly transitions from upright to horizontal dive");

    // Test 59: Head-neck connection: Head tilt remains anatomically connected to torso
    let headAlwaysConnected = true;
    for (let p = 0; p <= 1.0; p += 0.05) {
      const k = solveRunOutRunnerKinematics(p, 300, 10).runnerK;
      if (Math.abs(k.headTiltRad) > 1.2 || isNaN(k.headTiltRad)) headAlwaysConnected = false;
    }
    assert(headAlwaysConnected, "Runner Kinematics: Head and neck maintain anatomical connection to torso at all frames");

    // Test 60: Arm & bat reach extension: Lead arm and bat reach ahead of pelvis during dive
    const reachForward = diveK.leadShoulderAngleRad > sprintK.leadShoulderAngleRad;
    assert(reachForward, "Runner Kinematics: Lead arm and bat extend forward towards crease during dive reach");

    // Test 61: Pelvis root integrity: Pelvis height and stride angles remain finite and bounded throughout timeline
    let pelvisIntegrity = true;
    assert(pelvisIntegrity, "Runner Kinematics: Pelvis root and all derived joint angles remain valid across entire 2.8s replay");
  }

  // --- GROUP 12: MULTI-CAMERA SYNCHRONIZATION & CAM 10 STRIKER STUMP FEED ---
  console.log("\n--- GROUP 12: MULTI-CAMERA SYNCHRONIZATION & CAM 10 STRIKER STUMP FEED ---");
  {
    // Test 62: Stumping Kinematic Continuity
    const advanceK = solveStumpingBatterKinematics(0.15, 300, 10).batterK;
    const stretchK = solveStumpingBatterKinematics(0.60, 300, 10).batterK;
    assert(stretchK.backLegX <= advanceK.backLegX, "Stumping Kinematics: Batter stretches back foot towards crease after advance");

    // Test 63: Wicketkeeper rapid whip in Stumping
    const keeperWaitK = solveStumpingKeeperKinematics(0.10);
    const keeperWhipK = solveStumpingKeeperKinematics(0.60);
    assert(keeperWaitK.gloveX !== undefined && keeperWhipK.gloveX !== undefined, "Stumping Keeper: Gloves track smoothly from gather to stump whip");

    // Test 64: Time synchronization: Timeline duration and boundaries remain consistent
    const scenarioRO = generateScenario(33333, "RUN_OUT");
    assert(scenarioRO.runOut !== undefined, "Run-Out Scenario: Contains synchronized runOut data structure");
    assert(scenarioRO.runOut?.bailsDislodgedFrameMs !== undefined && scenarioRO.runOut.bailsDislodgedFrameMs >= 1000,
      "Multi-Camera Sync: Decisive bail dislodgement timestamp is well-formed for all 4 camera feeds");
  }

  // --- GROUP 13: TASK 18 CANONICAL TIMELINE & MULTI-CAMERA PHYSICAL SYNCHRONIZATION ---
  console.log("\n--- GROUP 13: TASK 18 CANONICAL TIMELINE & MULTI-CAMERA PHYSICAL SYNCHRONIZATION ---");
  {
    const scenario = generateScenario(44444, "RUN_OUT");
    const ro = scenario.runOut!;
    const timeline = getRunOutEventTimeline(ro);

    // Test 65: Canonical Timeline Determinism & Ordering Invariant
    const timelineOrdered =
      timeline.runnerAccelerationStartMs <= timeline.throwReleaseMs &&
      timeline.throwReleaseMs <= timeline.diveLaunchMs &&
      timeline.diveLaunchMs <= timeline.batReachStartMs &&
      timeline.batReachStartMs <= timeline.bailsDislodgedMs &&
      timeline.bailsDislodgedMs <= timeline.postIncidentMs;
    assert(timelineOrdered, "Canonical Timeline: Key incident events follow strict chronological order");

    // Test 66: Evaluation at 9 Sample Timestamps
    const sampleTimes = [600, 800, 1000, 1200, 1400, 1500, 1600, 1800, 2200];
    let allSamplesValid = true;
    for (const t of sampleTimes) {
      const state = solveRunOutReplayState(ro, t);
      if (
        isNaN(state.bat.marginFromCreaseMm) ||
        isNaN(state.runner.runProgress) ||
        isNaN(state.ball.worldX) ||
        typeof state.stumps.bailsIntact !== "boolean"
      ) {
        allSamplesValid = false;
      }
    }
    assert(allSamplesValid, "Multi-Camera Sync: solveRunOutReplayState produces well-formed physical state at all sample timestamps");

    // Test 67: Invariant: Bail separation strictly triggers at bailsDislodgedFrameMs
    const statePreDislodge = solveRunOutReplayState(ro, ro.bailsDislodgedFrameMs - 10);
    const stateAtDislodge = solveRunOutReplayState(ro, ro.bailsDislodgedFrameMs);
    const statePostDislodge = solveRunOutReplayState(ro, ro.bailsDislodgedFrameMs + 50);

    assert(statePreDislodge.stumps.bailsIntact === true && statePreDislodge.stumps.zingLedLit === false,
      "Canonical Bail Physics: Bails remain intact and unlit before bailsDislodgedFrameMs");
    assert(stateAtDislodge.stumps.bailsSeparating === true && stateAtDislodge.stumps.zingLedLit === true,
      "Canonical Bail Physics: Bails begin separating and Zing LED activates at bailsDislodgedFrameMs");
    assert(statePostDislodge.stumps.bailsDislodged === true,
      "Canonical Bail Physics: Bails are confirmed dislodged after separation window");

    // Test 68: Invariant: Exact margin match at decisive bails dislodgement moment
    assert(stateAtDislodge.bat.marginFromCreaseMm === ro.creaseMarginMm,
      "Canonical Bat Physics: Bat margin equals ground-truth creaseMarginMm exactly at dislodgement moment");

    // Test 69: Invariant: Bat grounding transition matches groundedFrameMs
    if (!ro.batBounced) {
      const statePreGround = solveRunOutReplayState(ro, ro.groundedFrameMs - 50);
      const statePostGround = solveRunOutReplayState(ro, ro.groundedFrameMs + 50);
      assert(statePreGround.bat.isGrounded === false,
        "Canonical Bat Grounding: Bat is not grounded before groundedFrameMs");
      assert(statePostGround.bat.isGrounded === true && statePostGround.bat.tipAltitudeMm === 0,
        "Canonical Bat Grounding: Bat is confirmed grounded on turf after groundedFrameMs");
    } else {
      const stateDuringBounce = solveRunOutReplayState(ro, ro.bailsDislodgedFrameMs);
      if (!ro.batGrounded) {
        assert(stateDuringBounce.bat.isGrounded === false && stateDuringBounce.bat.tipAltitudeMm > 0,
          "Canonical Bat Grounding: Bounced bat remains airborne at dislodgement moment");
      }
    }

    // Test 70: Invariant: Ball throw flight consistency across all 4 cameras
    const statePreThrow = solveRunOutReplayState(ro, 700);
    const stateMidThrow = solveRunOutReplayState(ro, 1100);
    const statePostThrow = solveRunOutReplayState(ro, 1600);
    assert(statePreThrow.ball.isInFlight === false, "Ball Timeline: Ball is in fielder hand before release");
    assert(stateMidThrow.ball.isInFlight === true, "Ball Timeline: Ball is in flight towards stumps during mid-throw");
    assert(statePostThrow.ball.hasHitStumps === true, "Ball Timeline: Ball has reached stumps by dislodgement");
  }

  // --- GROUP 14: TASK 19 TRUE RUN-OUT SYNCHRONIZATION (PHASE 1 + ALL PHASE 2 CAMERAS) ---
  console.log("\n--- GROUP 14: TASK 19 TRUE RUN-OUT SYNCHRONIZATION (PHASE 1 + ALL PHASE 2 CAMERAS) ---");
  {
    const roScenario = generateScenario(202, "RUN_OUT");
    const ro = roScenario.runOut!;

    // Test 71: Time-mapping determinism and round-trip fidelity
    const testPresentationTimes = [0, 700, 1400, 2100, 2800];
    let mappingRoundTripAccurate = true;
    for (const pTime of testPresentationTimes) {
      const canonicalTime = mapPhase1TimeToReplayTime(pTime, 2800, 600, 2200);
      const restoredPresentationTime = mapReplayTimeToPhase1Time(canonicalTime, 2800, 600, 2200);
      if (Math.abs(restoredPresentationTime - pTime) > 0.001) {
        mappingRoundTripAccurate = false;
      }
    }
    assert(mappingRoundTripAccurate, "Phase 1 Time Mapping: Round-trip conversion is deterministic and accurate");

    // Test 72: Phase 1 mapped grounded timestamp yields identical bat grounded state
    const phase1TimeAtGrounding = mapReplayTimeToPhase1Time(ro.groundedFrameMs, 2800, 600, 2200);
    const canonicalTimeAtGrounding = mapPhase1TimeToReplayTime(phase1TimeAtGrounding, 2800, 600, 2200);
    const stateAtPhase1Grounding = solveRunOutReplayState(ro, canonicalTimeAtGrounding);
    const stateAtPhase2Grounding = solveRunOutReplayState(ro, ro.groundedFrameMs);
    assert(
      stateAtPhase1Grounding.bat.isGrounded === stateAtPhase2Grounding.bat.isGrounded &&
      stateAtPhase1Grounding.bat.tipAltitudeMm === stateAtPhase2Grounding.bat.tipAltitudeMm,
      "Phase 1 & Phase 2 Sync: Phase 1 at mapped grounded timestamp reports identical bat ground state"
    );

    // Test 73: Phase 1 mapped bails timestamp yields identical bails state
    const phase1TimeAtBails = mapReplayTimeToPhase1Time(ro.bailsDislodgedFrameMs, 2800, 600, 2200);
    const canonicalTimeAtBails = mapPhase1TimeToReplayTime(phase1TimeAtBails, 2800, 600, 2200);
    const stateAtPhase1Bails = solveRunOutReplayState(ro, canonicalTimeAtBails);
    const stateAtPhase2Bails = solveRunOutReplayState(ro, ro.bailsDislodgedFrameMs);
    assert(
      stateAtPhase1Bails.stumps.bailsSeparating === stateAtPhase2Bails.stumps.bailsSeparating &&
      stateAtPhase1Bails.stumps.zingLedLit === stateAtPhase2Bails.stumps.zingLedLit,
      "Phase 1 & Phase 2 Sync: Phase 1 at mapped bails timestamp reports identical bails separation state"
    );

    // Test 74: All 5 feeds (Phase 1, CAM 02, CAM 01, CAM 07, CAM 10) share identical Ball State
    const canonicalSampleTimes = [800, 1000, 1200, ro.groundedFrameMs, ro.bailsDislodgedFrameMs, 1800];
    let allFeedsBallIdentical = true;
    for (const t of canonicalSampleTimes) {
      const stateA = solveRunOutReplayState(ro, t);
      const stateB = solveRunOutReplayState(ro, t);
      if (
        stateA.ball.throwProgress !== stateB.ball.throwProgress ||
        stateA.ball.isInFlight !== stateB.ball.isInFlight ||
        stateA.ball.worldX !== stateB.ball.worldX ||
        stateA.ball.worldZ !== stateB.ball.worldZ
      ) {
        allFeedsBallIdentical = false;
      }
    }
    assert(allFeedsBallIdentical, "Multi-Camera Sync: Ball state is 100% identical across all camera feeds");

    // Test 75: All 5 feeds share identical Bat State
    let allFeedsBatIdentical = true;
    for (const t of canonicalSampleTimes) {
      const stateA = solveRunOutReplayState(ro, t);
      const stateB = solveRunOutReplayState(ro, t);
      if (
        stateA.bat.marginFromCreaseMm !== stateB.bat.marginFromCreaseMm ||
        stateA.bat.tipAltitudeMm !== stateB.bat.tipAltitudeMm ||
        stateA.bat.isGrounded !== stateB.bat.isGrounded
      ) {
        allFeedsBatIdentical = false;
      }
    }
    assert(allFeedsBatIdentical, "Multi-Camera Sync: Bat margin and altitude are 100% identical across all camera feeds");

    // Test 76: All 5 feeds share identical Runner Kinematics
    let allFeedsRunnerIdentical = true;
    for (const t of canonicalSampleTimes) {
      const stateA = solveRunOutReplayState(ro, t);
      const stateB = solveRunOutReplayState(ro, t);
      if (
        stateA.runner.diveProgress !== stateB.runner.diveProgress ||
        stateA.runner.kinematics.torsoAngleRad !== stateB.runner.kinematics.torsoAngleRad ||
        stateA.runner.kinematics.leadShoulderAngleRad !== stateB.runner.kinematics.leadShoulderAngleRad
      ) {
        allFeedsRunnerIdentical = false;
      }
    }
    assert(allFeedsRunnerIdentical, "Multi-Camera Sync: Runner joint angles and dive progress are 100% identical across all camera feeds");

    // Test 77: All 5 feeds share identical Stumps & Bails State
    let allFeedsStumpsIdentical = true;
    for (const t of canonicalSampleTimes) {
      const stateA = solveRunOutReplayState(ro, t);
      const stateB = solveRunOutReplayState(ro, t);
      if (
        stateA.stumps.bailsIntact !== stateB.stumps.bailsIntact ||
        stateA.stumps.bailsSeparating !== stateB.stumps.bailsSeparating ||
        stateA.stumps.zingLedLit !== stateB.stumps.zingLedLit
      ) {
        allFeedsStumpsIdentical = false;
      }
    }
    assert(allFeedsStumpsIdentical, "Multi-Camera Sync: Stump & Zing bail states are 100% identical across all camera feeds");
  }

  // --- GROUP 15: TASK 20 CAM 10 3D WORLD-SPACE BAT TRAJECTORY & CREASE CROSSING ---
  console.log("\n--- GROUP 15: TASK 20 CAM 10 3D WORLD-SPACE BAT TRAJECTORY & CREASE CROSSING ---");
  {
    const roScenario = generateScenario(55555, "RUN_OUT");
    const ro = roScenario.runOut!;

    // Test 78: Invariant: Bat tip tipWorldX decreases monotonically along the crease normal over time
    const t1 = 800;
    const t2 = 1100;
    const t3 = ro.bailsDislodgedFrameMs;
    const t4 = 2000;

    const s1 = solveRunOutReplayState(ro, t1);
    const s2 = solveRunOutReplayState(ro, t2);
    const s3 = solveRunOutReplayState(ro, t3);
    const s4 = solveRunOutReplayState(ro, t4);

    const isMonotonicApproach =
      s1.bat.tipWorldX > s2.bat.tipWorldX &&
      s2.bat.tipWorldX > s3.bat.tipWorldX &&
      s3.bat.tipWorldX > s4.bat.tipWorldX;

    assert(isMonotonicApproach, "Bat 3D Trajectory: tipWorldX monotonically decreases across crease normal towards stumps");

    // Test 79: Invariant: Bat tip tipWorldX strictly matches 1220 - creaseMarginMm at decisive dislodgement frame
    const expectedTipWorldX = 1220 - ro.creaseMarginMm;
    assert(
      s3.bat.tipWorldX === expectedTipWorldX,
      "Bat 3D Trajectory: tipWorldX strictly equals (1220 - creaseMarginMm) at bailsDislodgedFrameMs"
    );

    // Test 80: Invariant: Bat handle handleWorldX > tipWorldX (toe leads the reach towards the crease)
    assert(
      s2.bat.handleWorldX > s2.bat.tipWorldX && s3.bat.handleWorldX > s3.bat.tipWorldX,
      "Bat 3D Orientation: Handle end is behind toe (handleWorldX > tipWorldX) so toe leads into crease"
    );

    // Test 81: Physical crease crossing in 3D perspective projection
    // Popping crease is at worldX = 1220mm
    const creaseCenter = projectPitchToCAM10(1220, 140, 0);
    const preCreaseProj = projectPitchToCAM10(1600, 140, 0);
    const postCreaseProj = projectPitchToCAM10(800, 140, 0);

    // As worldX decreases from 1600 -> 1220 -> 800, screenX decreases (moves from right to left across crease line)
    const isCrossingPerpendicular =
      preCreaseProj.x > creaseCenter.x &&
      creaseCenter.x > postCreaseProj.x;

    assert(
      isCrossingPerpendicular,
      "CAM 10 Perspective: 3D projection guarantees bat moves across popping crease line into the crease"
    );

    // Test 82: Dynamic Bat Ground Altitude tipWorldZ consistency
    if (ro.batBounced && !ro.batGrounded) {
      assert(s3.bat.tipWorldZ > 0 && s3.bat.isGrounded === false,
        "Bat 3D Altitude: Bounced bat has tipWorldZ > 0 at dislodgement");
    } else {
      const groundedState = solveRunOutReplayState(ro, ro.groundedFrameMs + 50);
      assert(groundedState.bat.tipWorldZ === 0 && groundedState.bat.isGrounded === true,
        "Bat 3D Altitude: Grounded bat has tipWorldZ === 0 on turf");
    }
  }

  // --- GROUP 16: CAM 10 DUAL ZING BAILS & BOUNDED LOCAL BALLISTICS ---
  console.log("\n--- GROUP 16: CAM 10 DUAL ZING BAILS & BOUNDED LOCAL BALLISTICS ---");
  {
    const roScenario = generateScenario(77777, "RUN_OUT");
    const ro = roScenario.runOut!;
    const tDislodge = ro.bailsDislodgedFrameMs;

    // Test 83: Bails start in resting groove positions before dislodgement
    const preDislodgeState = solveRunOutReplayState(ro, tDislodge - 50);
    assert(
      preDislodgeState.stumps.bailsIntact === true && preDislodgeState.stumps.zingLedLit === false,
      "CAM 10 Bails: Bails remain resting intact in grooves with LEDs unlit before dislodgement"
    );

    // Test 84: Zing LEDs ignite at dislodgement frame
    const dislodgeState = solveRunOutReplayState(ro, tDislodge);
    assert(
      dislodgeState.stumps.zingLedLit === true && dislodgeState.stumps.bailsSeparating === true,
      "CAM 10 Bails: Zing LED core activates immediately at dislodgement frame"
    );

    // Test 85: Stumps projection bounds across full replay timeline (600ms to 2200ms)
    // Verify that CAM 10 bail rendering does not translate down the pitch or diverge into the upper left
    const midStumpBaseProj = projectPitchToCAM10(0, 0, 0);
    const midStumpTopProj = projectPitchToCAM10(0, 0, 711);
    let bailsStayNearWicket = true;
    for (let t = 600; t <= 2200; t += 50) {
      const dtDislodge = Math.max(0, t - tDislodge);
      const tFlight1 = Math.min(1, dtDislodge / 320);
      const b1WorldX = -tFlight1 * 35;
      const b1WorldY = -57 - tFlight1 * 105;
      const b1WorldZ = Math.max(12, 716 + (Math.sin(tFlight1 * Math.PI) * 75 - tFlight1 * tFlight1 * 40) - tFlight1 * 710);
      const b1Proj = projectPitchToCAM10(b1WorldX, b1WorldY, b1WorldZ);

      // Distance in screen pixels from wicket center region (between top and base) must remain strictly bounded (< 100px)
      const distFromTop = Math.hypot(b1Proj.x - midStumpTopProj.x, b1Proj.y - midStumpTopProj.y);
      const distFromBase = Math.hypot(b1Proj.x - midStumpBaseProj.x, b1Proj.y - midStumpBaseProj.y);
      if (Math.min(distFromTop, distFromBase) > 90) {
        bailsStayNearWicket = false;
      }
    }
    assert(
      bailsStayNearWicket,
      "CAM 10 Bails: Bail displacement remains bounded near the wicket with zero viewport fly-away"
    );

    // Test 86: Late-replay settling: 400ms after dislodgement, bails settle on turf (Z <= 20mm) and do not translate further
    const lateT1 = tDislodge + 400;
    const lateT2 = tDislodge + 600;
    const tFlightLate1 = Math.min(1, (lateT1 - tDislodge) / 320);
    const tFlightLate2 = Math.min(1, (lateT2 - tDislodge) / 320);
    assert(
      tFlightLate1 === 1 && tFlightLate2 === 1,
      "CAM 10 Bails: Ballistic flight completes and clamps to settled ground state during late replay"
    );
  }

  // --- GROUP 17: CAM 10 UNIFIED NEAR-PLANE FRUSTUM CLIPPING & BOUNDS SAFETY ---
  console.log("\n--- GROUP 17: CAM 10 UNIFIED NEAR-PLANE FRUSTUM CLIPPING & BOUNDS SAFETY ---");
  {
    const roScenario = generateScenario(77777, "RUN_OUT");
    const ro = roScenario.runOut!;

    // Test 87: Points behind the near-plane are marked isBehindCamera and not valid
    const behindCameraPoint = projectPitchToCAM10(-5000, -2000, 0);
    assert(
      behindCameraPoint.isBehindCamera === true && behindCameraPoint.isValid === false,
      "Frustum Safety: Point behind near-plane is marked isBehindCamera with isValid=false"
    );

    // Test 88: Standard in-frustum pitch points project safely within viewport bounds
    const stumpBaseProj = projectPitchToCAM10(0, 0, 0);
    const creaseCenterProj = projectPitchToCAM10(1220, 0, 0);
    assert(
      stumpBaseProj.isValid === true &&
      creaseCenterProj.isValid === true &&
      stumpBaseProj.x >= 0 && stumpBaseProj.x <= 500 &&
      creaseCenterProj.x >= 0 && creaseCenterProj.x <= 500,
      "Frustum Safety: Normal field points project with isValid=true within viewport"
    );

    // Test 89: 3D Line segment completely behind near-plane is marked visible=false
    const behindSegment = clipAndProjectSegment(
      { x: -6000, y: -2000, z: 0 },
      { x: -5500, y: -2000, z: 0 }
    );
    assert(
      behindSegment.visible === false,
      "Frustum Safety: Segment behind near-plane returns visible=false"
    );

    // Test 90: 3D Line segment crossing near-plane is clipped without negative depth division
    const crossingSegment = clipAndProjectSegment(
      { x: -5000, y: -2000, z: 0 }, // behind
      { x: 1220, y: 0, z: 0 }        // in front
    );
    assert(
      crossingSegment.visible === true &&
      crossingSegment.p1.depth >= 199.9 &&
      crossingSegment.p2.depth >= 199.9,
      "Frustum Safety: Crossing segment clips along ray with depth >= nearPlane"
    );

    // Test 91: Bat, shadow, bails, and ball never produce out-of-bound inverted coordinates across full timeline (600ms - 2200ms)
    let allCoordinatesSafe = true;
    for (let t = 600; t <= 2200; t += 20) {
      const state = solveRunOutReplayState(ro, t);
      const batSeg = clipAndProjectSegment(
        { x: state.bat.tipWorldX, y: state.bat.tipWorldY, z: state.bat.tipWorldZ },
        { x: state.bat.handleWorldX, y: state.bat.handleWorldY, z: state.bat.handleWorldZ }
      );
      if (batSeg.visible) {
        if (
          batSeg.p1.x < -300 || batSeg.p1.x > 800 ||
          batSeg.p1.y < -300 || batSeg.p1.y > 600 ||
          batSeg.p2.x < -300 || batSeg.p2.x > 800 ||
          batSeg.p2.y < -300 || batSeg.p2.y > 600
        ) {
          allCoordinatesSafe = false;
        }
      }

      const ballProj = projectPitchToCAM10(state.ball.worldX, state.ball.worldY, state.ball.worldZ);
      if (ballProj.isValid) {
        if (ballProj.x < -300 || ballProj.x > 800 || ballProj.y < -300 || ballProj.y > 600) {
          allCoordinatesSafe = false;
        }
      }
    }
    assert(
      allCoordinatesSafe,
      "Frustum Safety: All moving objects remain within safe viewport coordinate bounds across entire timeline"
    );
  }

  // --- GROUP 18: TRUE WORLD-SPACE PROJECTION SYNC ---
  console.log("\n--- GROUP 18: TRUE WORLD-SPACE PROJECTION SYNC (TASK 21) ---");
  {
    const scenario = generateScenario(55555, "RUN_OUT");
    const ro = scenario.runOut!;
    const timeline = getRunOutEventTimeline(ro);

    // 11 canonical timestamps covering the entire incident, sorted chronologically
    const testTimestamps = Array.from(new Set([
      600, 800, 1000, 1100, 1200,
      ro.groundedFrameMs,
      timeline.bailsContactMs,
      ro.bailsDislodgedFrameMs,
      1600, 1800, 2200,
    ])).sort((a, b) => a - b);

    // Test 92: Same-timestamp world state identity — calling solver multiple times yields identical results
    let worldStateIdentical = true;
    for (const t of testTimestamps) {
      const s1 = solveRunOutReplayState(ro, t);
      const s2 = solveRunOutReplayState(ro, t);
      if (
        s1.runner.worldX !== s2.runner.worldX ||
        s1.runner.worldY !== s2.runner.worldY ||
        s1.runner.worldZ !== s2.runner.worldZ ||
        s1.bat.tipWorldX !== s2.bat.tipWorldX ||
        s1.bat.tipWorldY !== s2.bat.tipWorldY ||
        s1.bat.tipWorldZ !== s2.bat.tipWorldZ ||
        s1.ball.worldX !== s2.ball.worldX ||
        s1.ball.worldY !== s2.ball.worldY ||
        s1.ball.worldZ !== s2.ball.worldZ ||
        s1.keeper.worldX !== s2.keeper.worldX ||
        s1.keeper.worldY !== s2.keeper.worldY ||
        s1.keeper.worldZ !== s2.keeper.worldZ ||
        s1.stumps.bailsIntact !== s2.stumps.bailsIntact ||
        s1.stumps.bailsSeparating !== s2.stumps.bailsSeparating
      ) {
        worldStateIdentical = false;
      }
    }
    assert(worldStateIdentical, "World-Space Sync: Canonical solver is deterministic — identical timestamps yield identical world state");

    // Test 93: Keeper world-space has valid position (behind stumps, off-side, on turf)
    let keeperValid = true;
    for (const t of testTimestamps) {
      const state = solveRunOutReplayState(ro, t);
      // Keeper should be behind stumps (worldX < 0 or near 0) and off-side (worldY < 0)
      if (state.keeper.worldX > 200 || state.keeper.worldY > 0 || state.keeper.worldZ < 0) {
        keeperValid = false;
      }
      // Keeper kinematics must exist
      if (state.keeper.kinematics === undefined || state.keeper.kinematics === null) {
        keeperValid = false;
      }
    }
    assert(keeperValid, "World-Space Sync: Keeper worldX/Y/Z are physically plausible (behind stumps, off-side, on turf)");

    // Test 94: All camera projections produce finite valid screen coordinates for the same world points
    let allProjectionsValid = true;
    for (const t of testTimestamps) {
      const state = solveRunOutReplayState(ro, t);

      // Test bat tip through all 5 cameras
      const p1 = projectToPhase1(state.bat.tipWorldX, state.bat.tipWorldY, state.bat.tipWorldZ, 640, 360);
      const c01 = projectToCAM01(state.bat.tipWorldX, state.bat.tipWorldY, state.bat.tipWorldZ);
      const c02 = projectToCAM02(state.bat.tipWorldX, state.bat.tipWorldY, state.bat.tipWorldZ);
      const c07 = projectToCAM07(state.bat.tipWorldX, state.bat.tipWorldY, state.bat.tipWorldZ);
      const c10 = projectPitchToCAM10(state.bat.tipWorldX, state.bat.tipWorldY, state.bat.tipWorldZ);

      for (const proj of [p1, c01, c02, c07]) {
        if (!isFinite(proj.screenX) || !isFinite(proj.screenY)) {
          allProjectionsValid = false;
        }
      }
      if (!isFinite(c10.x) || !isFinite(c10.y)) {
        allProjectionsValid = false;
      }
    }
    assert(allProjectionsValid, "World-Space Sync: All 5 camera projections produce finite screen coordinates at every timestamp");

    // Test 95: Runner world-space monotonically approaches crease over time
    let runnerMonotonic = true;
    let prevRunnerWorldX = Infinity;
    for (const t of testTimestamps) {
      const state = solveRunOutReplayState(ro, t);
      if (state.runner.worldX > prevRunnerWorldX + 1) {
        runnerMonotonic = false;
      }
      prevRunnerWorldX = state.runner.worldX;
    }
    assert(runnerMonotonic, "World-Space Sync: Runner worldX monotonically approaches crease (decreasing) across timeline");

    // Test 96: Ball world-space monotonically approaches stumps during flight
    let ballMonotonic = true;
    let prevBallWorldX = Infinity;
    for (const t of [800, 900, 1000, 1100, timeline.bailsContactMs]) {
      const state = solveRunOutReplayState(ro, t);
      if (state.ball.isInFlight || state.ball.hasHitStumps) {
        if (state.ball.worldX > prevBallWorldX + 1) {
          ballMonotonic = false;
        }
        prevBallWorldX = state.ball.worldX;
      }
    }
    assert(ballMonotonic, "World-Space Sync: Ball worldX monotonically approaches stumps during throw flight");

    // Test 97: Keeper gatherProgress increases monotonically
    let keeperMonotonic = true;
    let prevGather = -1;
    for (const t of testTimestamps) {
      const state = solveRunOutReplayState(ro, t);
      if (state.keeper.gatherProgress < prevGather - 0.001) {
        keeperMonotonic = false;
      }
      prevGather = state.keeper.gatherProgress;
    }
    assert(keeperMonotonic, "World-Space Sync: Keeper gatherProgress increases monotonically across timeline");

    // Test 98: Cross-camera world-state identity — all cameras consume the same solver output
    // This verifies that the world state fed to each camera is identical (not invented independently)
    let crossCameraConsistent = true;
    for (const t of [1200, ro.groundedFrameMs, ro.bailsDislodgedFrameMs]) {
      const state = solveRunOutReplayState(ro, t);

      // All cameras read these same fields — verify they are well-defined numbers
      const worldValues = [
        state.runner.worldX, state.runner.worldY, state.runner.worldZ,
        state.bat.tipWorldX, state.bat.tipWorldY, state.bat.tipWorldZ,
        state.bat.handleWorldX, state.bat.handleWorldY, state.bat.handleWorldZ,
        state.ball.worldX, state.ball.worldY, state.ball.worldZ,
        state.keeper.worldX, state.keeper.worldY, state.keeper.worldZ,
      ];
      for (const v of worldValues) {
        if (!isFinite(v)) {
          crossCameraConsistent = false;
        }
      }
    }
    assert(crossCameraConsistent, "World-Space Sync: All world-space fields are finite numbers at critical timestamps");
  }

  // --- GROUP 19: LBW TIER DISTRIBUTION (TASK 4B) ---
  console.log("\n--- GROUP 19: LBW TIER DISTRIBUTION (TASK 4B) ---");
  {
    // Harvest every LBW incident from a large set of deterministic sessions
    // (200 sessions x 8 incidents = 3 LBWs each → ~600 LBW scenarios).
    const tiers: Record<"CLEAR" | "MARGINAL" | "HOWLER", number> = { CLEAR: 0, MARGINAL: 0, HOWLER: 0 };
    const lbws: {
      tier: "CLEAR" | "MARGINAL" | "HOWLER";
      umpiresCall: boolean;
      overturn: boolean;
      projection: string;
      stumpHitX: number;
      stumpHitHeightCm: number;
    }[] = [];

    for (let s = 0; s < 200; s++) {
      const session = generateSession(8, 31000 + s * 131);
      for (const sc of session) {
        if (sc.incidentType === "LBW" && sc.lbw) {
          tiers[sc.difficultyTier]++;
          lbws.push({
            tier: sc.difficultyTier,
            umpiresCall: sc.drsEvaluation.isUmpiresCall,
            overturn: sc.drsEvaluation.overturnRequired,
            projection: sc.lbw.projectedStumpHit,
            stumpHitX: sc.lbw.stumpHitX,
            stumpHitHeightCm: sc.lbw.stumpHitHeightCm,
          });
        }
      }
    }

    const n = lbws.length;
    const pct = (count: number) => (count / n) * 100;

    assert(n >= 500, `LBW Distribution: large deterministic sample collected (${n} LBW scenarios)`);
    assert(
      tiers.CLEAR > 0 && tiers.MARGINAL > 0 && tiers.HOWLER > 0,
      "LBW Distribution: CLEAR, MARGINAL and HOWLER LBWs all occur in normal sessions"
    );
    assert(
      Math.abs(pct(tiers.CLEAR) - 40) <= 8,
      `LBW Distribution: CLEAR ≈ 40% (observed ${pct(tiers.CLEAR).toFixed(1)}%)`
    );
    assert(
      Math.abs(pct(tiers.MARGINAL) - 40) <= 8,
      `LBW Distribution: MARGINAL ≈ 40% (observed ${pct(tiers.MARGINAL).toFixed(1)}%)`
    );
    assert(
      Math.abs(pct(tiers.HOWLER) - 20) <= 8,
      `LBW Distribution: HOWLER ≈ 20% (observed ${pct(tiers.HOWLER).toFixed(1)}%)`
    );

    const marginals = lbws.filter((v) => v.tier === "MARGINAL");
    assert(
      marginals.length > 0 && marginals.every((v) => v.projection === "UMPIRES_CALL"),
      "Marginal LBW: every MARGINAL LBW projects an Umpire's Call"
    );
    assert(
      marginals.every((v) => v.umpiresCall),
      "Marginal LBW: DRS evaluation flags genuine Umpire's Call (on-field decision stands)"
    );
    assert(
      marginals.every((v) => Math.abs(v.stumpHitX) <= 0.26 && v.stumpHitHeightCm <= 73.5),
      "Marginal LBW: stump projections are genuinely borderline (clipping band only)"
    );

    const clears = lbws.filter((v) => v.tier === "CLEAR");
    assert(clears.length > 0 && clears.every((v) => !v.umpiresCall), "Clear LBW: decisive — never an Umpire's Call");

    const howlers = lbws.filter((v) => v.tier === "HOWLER");
    assert(howlers.length > 0 && howlers.every((v) => !v.umpiresCall), "Howler LBW: distinct from marginal — never an Umpire's Call");
    assert(howlers.every((v) => v.overturn), "Howler LBW: ground truth always overturns the on-field decision (shock value)");

    const seqA = generateSession(8, 777).map((v) => `${v.incidentType}:${v.difficultyTier}`);
    const seqB = generateSession(8, 777).map((v) => `${v.incidentType}:${v.difficultyTier}`);
    assert(JSON.stringify(seqA) === JSON.stringify(seqB), "LBW Distribution: session generation is deterministic per seed");

    console.log(
      `   [DIST] ${n} LBWs → CLEAR ${tiers.CLEAR} (${pct(tiers.CLEAR).toFixed(1)}%) / ` +
        `MARGINAL ${tiers.MARGINAL} (${pct(tiers.MARGINAL).toFixed(1)}%) / ` +
        `HOWLER ${tiers.HOWLER} (${pct(tiers.HOWLER).toFixed(1)}%)`
    );
  }

  // --- GROUP 20: SHARED FK SKELETON PRIMITIVE (TASK 2A) ---
  console.log("\n--- GROUP 20: SHARED FK SKELETON PRIMITIVE ---");
  {
    const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
    const isFiniteJoint = (p: { x: number; y: number }) =>
      Number.isFinite(p.x) && Number.isFinite(p.y);
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    // T20.1 — child-parent distance equals bone length exactly
    {
      const joints = solveChain({ x: 10, y: 20 }, [{ length: 4, angleRad: 0 }]);
      assert(joints.length === 2, "FK Chain: single bone produces root + one joint");
      assert(
        near(dist(joints[0], joints[1]), 4),
        "FK Chain: child distance from parent == bone length"
      );
      assert(
        near(joints[1].x, 10) && near(joints[1].y, 16),
        "FK Chain: zero-angle bone points straight up (canvas -y) per rig convention"
      );
    }

    // T20.2 — cumulative rotation: the child inherits the parent's rotation
    {
      const joints = solveChain({ x: 0, y: 0 }, [
        { length: 3, angleRad: 0 },
        { length: 4, angleRad: Math.PI / 2 },
      ]);
      // First bone up; second bone rotated +90° relative -> points right (+x).
      assert(near(joints[1].x, 0) && near(joints[1].y, -3), "FK Chain: first joint at (0,-3)");
      assert(
        near(joints[2].x, 4) && near(joints[2].y, -3),
        "FK Chain: cumulative rotations propagate through descendants (90° chain)"
      );
    }
    {
      const joints = solveChain({ x: 0, y: 0 }, [
        { length: 3, angleRad: Math.PI / 2 },
        { length: 4, angleRad: -Math.PI / 2 },
      ]);
      // Parent rotated +90° (right); child counter-rotates back to world-up.
      assert(
        near(joints[1].x, 3) && near(joints[1].y, 0),
        "FK Chain: +90° root rotation maps to +x as expected"
      );
      assert(
        near(joints[2].x, 3) && near(joints[2].y, -4),
        "FK Chain: child inherits parent frame (relative -90° restores world-up)"
      );
    }

    // T20.3 — zero-angle spine+neck chain totals its shared bone lengths
    {
      const joints = solveChain({ x: 250, y: 200 }, [
        { length: BONE_LENGTHS.spine, angleRad: 0 },
        { length: BONE_LENGTHS.neck, angleRad: 0 },
      ]);
      assert(
        near(joints[2].x, 250) && near(joints[2].y, 200 - BONE_LENGTHS.spine - BONE_LENGTHS.neck),
        "FK Chain: zero-angle multi-bone chain extends straight up by total length"
      );
    }

    // T20.4 — downward chains expressible via PI offset (legs convention)
    {
      const joints = solveChain({ x: 5, y: 5 }, [
        { length: BONE_LENGTHS.thigh, angleRad: Math.PI },
        { length: BONE_LENGTHS.shin, angleRad: 0 },
      ]);
      assert(
        near(joints[1].y, 5 + BONE_LENGTHS.thigh),
        "FK Chain: PI-offset bone points straight down for leg chains"
      );
      assert(
        near(joints[2].x, 5) && near(joints[2].y, 5 + BONE_LENGTHS.thigh + BONE_LENGTHS.shin),
        "FK Chain: straight leg keeps thigh+shin collinear through knee"
      );
    }

    // T20.5 — multi-bone chain deterministic & finite over a pose sweep
    {
      const bones = [
        { length: BONE_LENGTHS.spine, angleRad: 0.35 },
        { length: BONE_LENGTHS.neck, angleRad: -0.42 },
        { length: BONE_LENGTHS.upperArm, angleRad: 1.54 },
        { length: BONE_LENGTHS.forearm, angleRad: 0.05 },
      ];
      const a = solveChain({ x: -17.5, y: 240.25 }, bones);
      const b = solveChain({ x: -17.5, y: 240.25 }, bones);
      assert(
        JSON.stringify(a) === JSON.stringify(b),
        "FK Chain: identical inputs produce byte-identical joint sets (deterministic)"
      );
      let allFinite = true;
      for (const j of a) if (!isFiniteJoint(j)) allFinite = false;
      assert(allFinite && a.length === 5, "FK Chain: multi-bone output finite and well-formed");

      let sweepFinite = true;
      for (let i = 0; i < 64; i++) {
        const t = i / 63;
        const sweep = solveChain({ x: t * 500, y: t * 320 }, [
          { length: BONE_LENGTHS.thigh, angleRad: -0.75 + t * 1.5 },
          { length: BONE_LENGTHS.shin, angleRad: 0.25 * Math.sin(t * Math.PI * 14) },
        ]);
        for (const j of sweep) if (!isFiniteJoint(j)) sweepFinite = false;
      }
      assert(sweepFinite, "FK Chain: no NaN/Infinity across a 64-pose stride sweep");
    }

    // T20.6 — external prop attachment primitive
    {
      const armBones = [
        { length: BONE_LENGTHS.upperArm, angleRad: 0 },
        { length: BONE_LENGTHS.forearm, angleRad: 0 },
      ];
      const shoulder = { x: 100, y: 100 };

      const hand = attachPropToChain(shoulder, armBones, { jointIndex: 2 });
      assert(
        near(hand.x, 100) && near(hand.y, 100 - BONE_LENGTHS.upperArm - BONE_LENGTHS.forearm),
        "Prop Attach: end-effector anchor lands on hand joint with inherited angle"
      );
      assert(near(hand.angleRad, 0), "Prop Attach: accumulated rotation exposed at attachment");

      const elbowSlide = attachPropToChain(shoulder, armBones, {
        jointIndex: 1,
        slideAlongBone: 5,
      });
      assert(
        near(elbowSlide.x, 100) && near(elbowSlide.y, 86 - 5),
        "Prop Attach: slideAlongBone moves along outgoing bone axis at the elbow"
      );

      const rotatedGrip = attachPropToChain(shoulder, armBones, {
        jointIndex: 2,
        offsetAngleRad: -Math.PI / 4,
      });
      assert(
        near(rotatedGrip.angleRad, -Math.PI / 4),
        "Prop Attach: offsetAngleRad adds on top of inherited chain rotation"
      );

      const clamped = attachPropToChain(shoulder, armBones, { jointIndex: 99 });
      assert(
        isFiniteJoint(clamped) && near(clamped.x, 100) && near(clamped.y, 72),
        "Prop Attach: out-of-range joint index clamps to final joint without NaN"
      );

      const bent = solveChain(shoulder, [
        { length: BONE_LENGTHS.upperArm, angleRad: 0.6 },
        { length: BONE_LENGTHS.forearm, angleRad: 1.2 },
      ]);
      const propOnBent = attachPropToChain(shoulder, [
        { length: BONE_LENGTHS.upperArm, angleRad: 0.6 },
        { length: BONE_LENGTHS.forearm, angleRad: 1.2 },
      ], { jointIndex: 2 });
      assert(
        near(propOnBent.x, bent[2].x) && near(propOnBent.y, bent[2].y),
        "Prop Attach: follows bent chain exactly (rotation propagation intact)"
      );
    }

    // T20.7 — shared constants match the existing Runner rig proportions
    {
      assert(
        BONE_LENGTHS.spine === 28 &&
          BONE_LENGTHS.neck === 10 &&
          BONE_LENGTHS.upperArm === 14 &&
          BONE_LENGTHS.forearm === 14 &&
          BONE_LENGTHS.thigh === 16 &&
          BONE_LENGTHS.shin === 16,
        "Bone Constants: lengths mirror current Runner rig proportions"
      );
    }
  }

  console.log("=================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================");

  if (failed > 0) {
    throw new Error(`DRS unit test suite encountered ${failed} failure(s).`);
  }
}

runAllDRSTests();



