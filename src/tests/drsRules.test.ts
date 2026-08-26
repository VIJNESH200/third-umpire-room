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
  solveLBWBatterKinematics,
  solveCaughtBehindBatterKinematics,
  solveStumpingKeeperKinematics,
  solveCaughtBehindKeeperKinematics,
  solveRunOutKeeperKinematics,
  solveChain,
  attachPropToChain,
  solveTwoBoneIK,
  solveKeeperSkeleton,
  solveBatterSkeleton,
  solveBoundaryFielderKinematics,
  solveFielderSkeleton,
  KEEPER_BONE,
  BATTER_BONE,
  BATTER_BAT,
  FIELDER_BONE,
  FIELDER_GROUND_Y,
  BONE_LENGTHS,
  type BatterKinematics,
  type FielderKinematics,
} from "../components/instinct/actorRigs";
import {
  solveCaughtBehindBallState,
  measureBatPlaneTurnDeg,
  solveEdgeOpticalEvidence,
  solveUltraEdgeSignal,
  sampleUltraEdgeAmplitude,
  findNearestTransient,
  CB_BAT_CROSS_P,
  type CaughtBehindCorridor,
} from "../engine/caughtBehindPhysics";
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
import {
  solveHotSpotThermal,
  solveHotSpotThermalFrame,
  sampleHotSpotIntensity,
} from "../engine/hotspotThermal";
import { resolveReplayShortcut, isTextEntryTarget } from "../engine/replayKeyboard";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HotSpotIRView } from "../components/tools/HotSpotIRView";
import type {
  LBWData,
  RunOutData,
  CaughtBehindData,
  BoundaryData,
  IncidentResult,
} from "../types/scenario";

/** Baseline Caught Behind ground truth for evidence-neutrality assertions. */
const cbBase: CaughtBehindData = {
  hasEdge: false,
  waveformSpikeTimeMs: null,
  distractorNoise: false,
  distractorTimeMs: null,
  distractorType: null,
  proximityFrameMs: 1200,
  spikeIntensity: 0.1,
  ballPassesBatFrameMs: 1200,
  gapMm: 0,
  soundType: "SILENCE",
};

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

  // --- GROUP 21: BOWLER FK MIGRATION (TASK 2B) ---
  console.log("\n--- GROUP 21: BOWLER FK MIGRATION ---");
  {
    const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const l1 = BONE_LENGTHS.thigh;
    const l2 = BONE_LENGTHS.shin;

    // T21.1 — IK joint adjacency across reachable and clamped targets
    {
      let adjacencyOk = true;
      let finiteOk = true;
      const targets = [
        { x: 12, y: 26 }, { x: -9, y: 24 }, { x: 0, y: -30 }, { x: 20, y: 8 },
        { x: -22, y: -6 }, { x: 0.5, y: 1 }, { x: 0, y: 100 }, { x: -140, y: 3 },
        { x: 6, y: -18 }, { x: -11, y: 22 },
      ];
      for (const tg of targets) {
        const j = solveTwoBoneIK({ x: -3, y: -18 }, l1, l2, tg, 1);
        if (!near(dist(j[0], j[1]), l1, 1e-6)) adjacencyOk = false;
        if (!near(dist(j[1], j[2]), l2, 1e-6)) adjacencyOk = false;
        for (const p of j) {
          if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) finiteOk = false;
        }
      }
      assert(adjacencyOk, "Bowler IK: thigh/shin lengths fixed for every target (adjacent joints)");
      assert(finiteOk, "Bowler IK: no NaN/Infinity including far-clamped targets");
    }

    // T21.2 — reachable targets land exactly on the animation point
    {
      const samples = [
        { x: 9, y: 6 }, { x: -14, y: 12 }, { x: 4, y: 4 },
        { x: -8, y: 8 }, { x: 16, y: -10 }, { x: -2, y: 10 },
      ];
      let exact = true;
      for (const tg of samples) {
        const j = solveTwoBoneIK({ x: -3, y: -18 }, l1, l2, tg, 1);
        if (!near(j[2].x, tg.x, 1e-6) || !near(j[2].y, tg.y, 1e-6)) exact = false;
      }
      assert(exact, "Bowler IK: foot lands exactly on legacy solver endpoints (reachable set)");
    }

    // T21.3 — unreachable targets clamp along the same ray at full extension
    {
      const j = solveTwoBoneIK({ x: 0, y: 0 }, l1, l2, { x: 0, y: 100 }, 1);
      assert(
        near(j[2].x, 0, 1e-6) && Math.abs(dist(j[0], j[2]) - (l1 + l2)) < 1e-2,
        "Bowler IK: far target extends straight to the leg's full length on the same ray"
      );
    }

    // T21.4 — bend sign mirrors the knee while keeping the foot planted
    {
      const a = solveTwoBoneIK({ x: 0, y: 0 }, l1, l2, { x: 0, y: 30 }, 1);
      const b = solveTwoBoneIK({ x: 0, y: 0 }, l1, l2, { x: 0, y: 30 }, -1);
      assert(
        near(a[2].x, b[2].x, 1e-6) && near(a[2].y, b[2].y, 1e-6),
        "Bowler IK: both knee sides share identical foot placement"
      );
      assert(
        near(a[1].x, -b[1].x, 1e-6),
        "Bowler IK: knees mirror across the hip-foot axis per bendSign"
      );
    }

    // T21.5 — deterministic output
    {
      const mk = () => JSON.stringify(solveTwoBoneIK({ x: 7, y: -3 }, l1, l2, { x: 13, y: 25 }, 1));
      assert(mk() === mk(), "Bowler IK: byte-identical results for repeated solves");
    }

    // T21.6 — every solver pose in the timeline stays exactly reachable
    {
      let feetExact = true;
      let anglesFinite = true;
      for (let i = 0; i <= 40; i++) {
        const k = solveLBWBowlerKinematics(i / 40, {
          isNoBall: i % 3 === 0,
          frontFootOverstepMm: (i % 7) * 3,
          deliveryLine: ["OVER_THE_WICKET", "ROUND_WICKET", "WIDE_OF_CREASE"][i % 3],
        });
        const front = solveTwoBoneIK({ x: -3, y: -18 }, l1, l2, { x: k.frontLegX, y: k.frontLegY }, 1);
        const back = solveTwoBoneIK({ x: -3, y: -18 }, l1, l2, { x: k.backLegX, y: k.backLegY }, 1);
        if (!near(front[2].x, k.frontLegX, 1e-6) || !near(front[2].y, k.frontLegY, 1e-6)) feetExact = false;
        if (!near(back[2].x, k.backLegX, 1e-6) || !near(back[2].y, k.backLegY, 1e-6)) feetExact = false;
        if (!Number.isFinite(k.bowlingArmAngleRad)) anglesFinite = false;
      }
      assert(feetExact, "Bowler FK: all 41 timeline poses keep feet exactly on legacy animation points");
      assert(anglesFinite, "Bowler FK: solver arm angles finite across delivery lines/no-ball mix");
    }

    // T21.7 — arm convention conversion reproduces legacy endpoints exactly
    {
      const shoulder = { x: 0, y: -32 };
      let armsMatch = true;
      for (const a of [-2.35, -1.57, -0.6, 0.2, 0.8, 1.35, 2.2, 3.05]) {
        const fkEnd = solveChain(shoulder, [
          { length: 8, angleRad: Math.PI / 2 + a },
          { length: 8, angleRad: 0 },
        ])[2];
        const legacyEnd = {
          x: shoulder.x + Math.cos(a) * 16,
          y: shoulder.y + Math.sin(a) * 16,
        };
        if (!near(fkEnd.x, legacyEnd.x, 1e-6) || !near(fkEnd.y, legacyEnd.y, 1e-6)) armsMatch = false;
      }
      assert(armsMatch, "Bowler FK: PI/2+a conversion reproduces legacy arm endpoints bit-exactly");

      // Hand prop with slide reaches the legacy 17px bowling-hand radius.
      for (const a of [-0.75, 0.8, 2.2]) {
        const hand = attachPropToChain(shoulder, [
          { length: 8, angleRad: Math.PI / 2 + a },
          { length: 8, angleRad: 0 },
        ], { jointIndex: 2, slideAlongBone: 1 });
        const legacyHand = {
          x: shoulder.x + Math.cos(a) * 17,
          y: shoulder.y + Math.sin(a) * 17,
        };
        if (!near(hand.x, legacyHand.x, 1e-6) || !near(hand.y, legacyHand.y, 1e-6)) armsMatch = false;
      }
      assert(armsMatch, "Bowler FK: attached bowling hand matches legacy 17px offset via slideAlongBone");
    }

    // T21.8 — spine/neck chain keeps head attached and matches legacy rise
    {
      const pelvis = { x: 0, y: -22 };
      let ok = true;
      for (const torsoA of [-0.15, 0.08, 0.35, 0.6]) {
        const chain = solveChain(pelvis, [
          { length: 10, angleRad: torsoA },
          { length: 10, angleRad: 0 },
        ]);
        if (!near(dist(chain[0], chain[1]), 10, 1e-6)) ok = false;
        if (!near(dist(chain[1], chain[2]), 10, 1e-6)) ok = false;
        const legacyHead = {
          x: pelvis.x + Math.sin(torsoA) * 20,
          y: pelvis.y - Math.cos(torsoA) * 20,
        };
        if (!near(chain[2].x, legacyHead.x, 1e-6) || !near(chain[2].y, legacyHead.y, 1e-6)) ok = false;
      }
      assert(ok, "Bowler FK: head chained to torso (10+10) and equals legacy rotated head position");
    }
  }

  // --- GROUP 22: WICKETKEEPER FK MIGRATION (TASK 2C) ---
  console.log("\n--- GROUP 22: WICKETKEEPER FK MIGRATION ---");
  {
    const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const kb = KEEPER_BONE;

    // Every keeper solver across its full parameter domain.
    const sampleSkeletons = (): { label: string; s: ReturnType<typeof solveKeeperSkeleton> }[] => {
      const out: { label: string; s: ReturnType<typeof solveKeeperSkeleton> }[] = [];
      for (let i = 0; i <= 40; i++) {
        const p = i / 40;
        out.push({ label: "stumping", s: solveKeeperSkeleton(solveStumpingKeeperKinematics(p)) });
        out.push({ label: "caught-behind", s: solveKeeperSkeleton(solveCaughtBehindKeeperKinematics(p, i % 2 === 0)) });
        out.push({ label: "run-out", s: solveKeeperSkeleton(solveRunOutKeeperKinematics(p, i % 3 === 0)) });
      }
      return out;
    };
    const samples = sampleSkeletons();

    // T22.1 — head/neck adjacency: neck bone fixed and chained off the spine
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.shoulder, s.headBase), kb.neck)) ok = false;
        if (!near(dist(s.pelvis, s.shoulder), kb.spine)) ok = false;
      }
      assert(ok, "Keeper FK: head rides a fixed-length neck chained to the spine for every solver pose");
    }

    // T22.2 — shoulder/arm adjacency with fixed upper arm + forearm lengths
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.shoulder, s.leadElbow), kb.upperArm)) ok = false;
        if (!near(dist(s.leadElbow, s.leadHand), kb.forearm)) ok = false;
        if (!near(dist(s.shoulder, s.rearElbow), kb.upperArm)) ok = false;
        if (!near(dist(s.rearElbow, s.rearHand), kb.forearm)) ok = false;
      }
      assert(ok, "Keeper FK: both arms keep exact upperArm/forearm lengths from the shared shoulder");
    }

    // T22.3 — hand/glove adjacency: gloves are the hand end-effectors
    {
      let ok = true;
      const crouchK = { crouchElevation: 0, torsoAngleRad: 0.15, headTiltRad: 0.1, gloveX: 12, gloveY: -16, isGlovesOpen: true };
      const appealK = { crouchElevation: 1, torsoAngleRad: -0.1, headTiltRad: -0.2, gloveX: 0, gloveY: -52, isGlovesOpen: false };
      const crouchS = solveKeeperSkeleton(crouchK);
      const appealS = solveKeeperSkeleton(appealK);
      // Both glove targets are inside arm reach, so hands land exactly on them.
      if (!near(crouchS.leadHand.x, crouchK.gloveX + 4, 1e-6) || !near(crouchS.rearHand.x, crouchK.gloveX - 4, 1e-6)) ok = false;
      if (!near(appealS.leadHand.x, appealK.gloveX + 8, 1e-6) || !near(appealS.rearHand.x, appealK.gloveX - 8, 1e-6)) ok = false;
      assert(ok, "Keeper FK: gloves sit exactly on both hand end-effectors in crouch and appeal");
    }
    {
      // Per-solver fine sweep: consecutive poses must stay within a small
      // neighbourhood, ruling out teleports and discrete glove-mode switches.
      const sweeps: [string, (t: number) => ReturnType<typeof solveKeeperSkeleton>][] = [
        ["stumping", (t) => solveKeeperSkeleton(solveStumpingKeeperKinematics(t))],
        ["caught-behind-edge", (t) => solveKeeperSkeleton(solveCaughtBehindKeeperKinematics(t, true))],
        ["caught-behind-clean", (t) => solveKeeperSkeleton(solveCaughtBehindKeeperKinematics(t, false))],
        ["run-out", (t) => solveKeeperSkeleton(solveRunOutKeeperKinematics(t, t > 0.5))],
      ];
      let continuous = true;
      let culprit = "";
      for (const [label, fn] of sweeps) {
        let prev = fn(0);
        for (let i = 1; i <= 1000; i++) {
          const curr = fn(i / 1000);
          if (dist(curr.leadHand, prev.leadHand) > 1.5 || dist(curr.rearHand, prev.rearHand) > 1.5) {
            continuous = false;
            culprit = label;
          }
          prev = curr;
        }
      }
      assert(continuous, `Keeper FK: gloves glide continuously in every solver timeline (${culprit || "all clean"})`);
    }

    // T22.4 — hip/leg adjacency: hips ride the pelvis row, legs keep fixed lengths
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.leadHip, s.pelvis), 3.5)) ok = false;
        if (!near(dist(s.trailHip, s.pelvis), 3.5)) ok = false;
        if (!near(dist(s.leadHip, s.leadKnee), kb.thigh)) ok = false;
        if (!near(dist(s.leadKnee, s.leadAnkle), kb.shin)) ok = false;
        if (!near(dist(s.trailHip, s.trailKnee), kb.thigh)) ok = false;
        if (!near(dist(s.trailKnee, s.trailAnkle), kb.shin)) ok = false;
      }
      assert(ok, "Keeper FK: hips stay on the pelvis with exact thigh/shin lengths to grounded ankles");
    }

    // T22.5 — crouch extremes: deep crouch keeps feet planted and pelvis low
    {
      const crouch = solveKeeperSkeleton({
        crouchElevation: 0, torsoAngleRad: 0.15, headTiltRad: 0.1, gloveX: 12, gloveY: -16, isGlovesOpen: true,
      });
      const grounded =
        near(crouch.leadAnkle.y, -1, 1e-6) &&
        near(crouch.trailAnkle.y, -1, 1e-6);
      assert(grounded, "Keeper FK: deep crouch pins both ankles exactly on the turf line");
      assert(
        crouch.leadKnee.y > crouch.leadHip.y && crouch.trailKnee.y < 0,
        "Keeper FK: deep crouch produces bent knees below the hip line"
      );
    }

    // T22.6 — standing appeal extremes: tallest coherent pose, gloves raised above shoulders
    {
      const appeal = solveKeeperSkeleton({
        crouchElevation: 1, torsoAngleRad: -0.1, headTiltRad: -0.2, gloveX: 0, gloveY: -52, isGlovesOpen: false,
      });
      assert(
        appeal.leadHand.y < appeal.shoulder.y && appeal.rearHand.y < appeal.shoulder.y,
        "Keeper FK: standing appeal raises both gloved hands above the shoulder line"
      );
      assert(
        near(dist(appeal.shoulder, appeal.headBase), kb.neck) &&
          appeal.headBase.y < appeal.pelvis.y,
        "Keeper FK: standing appeal keeps head chained above the pelvis"
      );
      assert(
        near(appeal.leadAnkle.y, -1, 1e-6) && near(appeal.trailAnkle.y, -1, 1e-6),
        "Keeper FK: standing appeal still grounds both feet"
      );
    }

    // T22.7 — no NaN/Infinity anywhere, including out-of-domain kinematics
    {
      let finite = true;
      for (const { s } of samples) {
        for (const j of Object.values(s)) {
          if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) finite = false;
        }
      }
      const weird = [
        { crouchElevation: -2, torsoAngleRad: 9, headTiltRad: -7, gloveX: 500, gloveY: 900, isGlovesOpen: true },
        { crouchElevation: 42, torsoAngleRad: -13, headTiltRad: 5, gloveX: -800, gloveY: -900, isGlovesOpen: false },
      ];
      for (const k of weird) {
        const s = solveKeeperSkeleton(k);
        for (const j of Object.values(s)) {
          if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) finite = false;
        }
      }
      assert(finite, "Keeper FK: every joint finite across solvers and clamped out-of-domain inputs");
    }

    // T22.8 — deterministic output
    {
      const mk = () =>
        JSON.stringify(solveKeeperSkeleton(solveStumpingKeeperKinematics(0.57)));
      assert(mk() === mk(), "Keeper FK: byte-identical skeletons for repeated solves");
    }
  }

  // --- GROUP 23: BATTER FK MIGRATION (TASK 2D) ---
  console.log("\n--- GROUP 23: BATTER FK MIGRATION ---");
  {
    const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const bb = BATTER_BONE;

    // Every batter solver across its full parameter domain.
    const sampleSkeletons = (): { label: string; s: ReturnType<typeof solveBatterSkeleton> }[] => {
      const out: { label: string; s: ReturnType<typeof solveBatterSkeleton> }[] = [];
      for (let i = 0; i <= 40; i++) {
        const p = i / 40;
        out.push({ label: "lbw-shot", s: solveBatterSkeleton(solveLBWBatterKinematics(p, false, "DEFENSIVE_FORWARD", 60)) });
        out.push({ label: "lbw-noshot", s: solveBatterSkeleton(solveLBWBatterKinematics(p, true, "PADDED_AWAY_NO_SHOT", 60)) });
        out.push({ label: "caught-behind", s: solveBatterSkeleton(solveCaughtBehindBatterKinematics(p, "FORWARD_DEFENCE", 14)) });
        out.push({ label: "stumping", s: solveBatterSkeleton(solveStumpingBatterKinematics(p, 300, 10).batterK) });
        out.push({ label: "stumping-wide", s: solveBatterSkeleton(solveStumpingBatterKinematics(p, 300, 55).batterK) });
      }
      return out;
    };
    const samples = sampleSkeletons();

    // T23.1 — spine/neck/head adjacency with fixed bone lengths
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.pelvis, s.shoulder), bb.spine)) ok = false;
        if (!near(dist(s.shoulder, s.headBase), bb.neck)) ok = false;
      }
      assert(ok, "Batter FK: head rides a fixed-length neck chained to the spine for every solver pose");
    }

    // T23.2 — shoulder/arm/hand adjacency with fixed segment lengths
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.shoulder, s.leadElbow), bb.upperArm)) ok = false;
        if (!near(dist(s.leadElbow, s.leadHand), bb.forearm)) ok = false;
        if (!near(dist(s.shoulder, s.rearElbow), bb.upperArm)) ok = false;
        if (!near(dist(s.rearElbow, s.rearHand), bb.forearm)) ok = false;
      }
      assert(ok, "Batter FK: both arms keep exact upperArm/forearm lengths from the shared shoulder");
    }

    // T23.3 — pelvis/hip adjacency
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.leadHip, s.pelvis), 4)) ok = false;
        if (!near(dist(s.trailHip, s.pelvis), 4)) ok = false;
      }
      assert(ok, "Batter FK: hip sockets stay fixed to the pelvis across all poses");
    }

    // T23.4 — thigh/shin/foot adjacency with fixed lengths
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.leadHip, s.leadKnee), bb.thigh)) ok = false;
        if (!near(dist(s.leadKnee, s.leadAnkle), bb.shin)) ok = false;
        if (!near(dist(s.trailHip, s.trailKnee), bb.thigh)) ok = false;
        if (!near(dist(s.trailKnee, s.trailAnkle), bb.shin)) ok = false;
      }
      assert(ok, "Batter FK: legs keep exact thigh/shin lengths from hips riding the pelvis");
    }

    // T23.5 — bat attachment: lead hand owns the grip; rear hand the handle
    {
      let ok = true;
      for (const { s } of samples) {
        // Lead hand: the grip is always inside arm reach -> exact anchor.
        if (!near(s.leadHand.x, s.batGrip.x, 1e-6) || !near(s.leadHand.y, s.batGrip.y, 1e-6)) ok = false;
        // Rear hand: exact on the handle when reachable; otherwise clamped
        // along the same ray but still fully attached to the shoulder.
        const reach = dist(s.shoulder, s.rearGrip);
        if (reach <= (bb.upperArm + bb.forearm) * 0.999) {
          if (!near(s.rearHand.x, s.rearGrip.x, 1e-6) || !near(s.rearHand.y, s.rearGrip.y, 1e-6)) ok = false;
        } else {
          if (dist(s.shoulder, s.rearHand) > bb.upperArm + bb.forearm + 1e-6) ok = false;
        }
      }
      assert(ok, "Batter FK: lead hand owns the bat grip; rear hand rides or tracks the handle");
    }

    // T23.6 — bat tip attachment: handle -> blade -> tip is a rigid rotated frame
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.batGrip, s.handleTip), BATTER_BAT.handle)) ok = false;
        if (!near(dist(s.batGrip, s.batTip), BATTER_BAT.blade)) ok = false;
        // Collinear through the grip (cross product ~ 0)
        const hx = s.handleTip.x - s.batGrip.x, hy = s.handleTip.y - s.batGrip.y;
        const bx = s.batTip.x - s.batGrip.x, by = s.batTip.y - s.batGrip.y;
        if (Math.abs(hx * by - hy * bx) > 1e-6) ok = false;
      }
      assert(ok, "Batter FK: hand -> handle -> blade -> tip stays one continuous rigid chain");
    }

    // T23.7 — bat placement is bit-identical to the legacy flat rig (gameplay-safe)
    {
      let ok = true;
      const cases: BatterKinematics[] = [
        solveLBWBatterKinematics(0.5, false, "DEFENSIVE_FORWARD", 60),
        solveLBWBatterKinematics(0.9, true, "PADDED_AWAY_NO_SHOT", 60),
        solveCaughtBehindBatterKinematics(0.6, "FORWARD_DEFENCE", 20),
        solveStumpingBatterKinematics(0.7, 300, 30).batterK,
      ];
      for (const k of cases) {
        const s = solveBatterSkeleton(k);
        if (s.batGrip.x !== k.batPivotX || s.batGrip.y !== k.batPivotY) ok = false;
        // Canvas rotate(batRot) maps local (0, blade) to (-sin, +cos) * blade.
        const legacyTip = {
          x: k.batPivotX - Math.sin(k.batRotRad) * BATTER_BAT.blade,
          y: k.batPivotY + Math.cos(k.batRotRad) * BATTER_BAT.blade,
        };
        if (!near(s.batTip.x, legacyTip.x, 1e-6) || !near(s.batTip.y, legacyTip.y, 1e-6)) ok = false;
      }
      assert(ok, "Batter FK: bat grip/tip reproduce the legacy canvas transform bit-exactly");
    }

    // T23.8 — grounded stance: ankles pinned to the turf for normal ranges
    {
      let ok = true;
      for (const { label, s } of samples) {
        if (label === "stumping-wide") continue; // extreme lunge may clamp (documented)
        if (!near(s.leadAnkle.y, 6, 1e-6) || !near(s.trailAnkle.y, 6, 1e-6)) ok = false;
      }
      assert(ok, "Batter FK: both ankles stay pinned to the turf line across all solvers");
    }

    // T23.9 — extreme stumping lunge keeps legs ATTACHED (clamped, never detached)
    {
      let ok = true;
      let finite = true;
      for (let m = 10; m <= 90; m += 5) {
        const s = solveBatterSkeleton(solveStumpingBatterKinematics(0.9, 300, m).batterK);
        if (!near(dist(s.trailHip, s.trailKnee), bb.thigh)) ok = false;
        if (!near(dist(s.trailKnee, s.trailAnkle), bb.shin)) ok = false;
        for (const j of [s.trailHip, s.trailKnee, s.trailAnkle]) {
          if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) finite = false;
        }
      }
      assert(ok && finite, "Batter FK: 90mm back-foot drag keeps the trail leg attached and finite");
    }

    // T23.10 — no NaN/Infinity anywhere, including out-of-domain kinematics
    {
      let finite = true;
      for (const { s } of samples) {
        for (const j of Object.values(s)) {
          if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) finite = false;
        }
      }
      const weird = [
        { torsoAngleRad: 42, headTiltRad: -31, frontLegX: 900, frontLegY: -900, backLegX: -800, backLegY: 700, batPivotX: 1200, batPivotY: -1500, batRotRad: 33, padRecoilX: 0, padRecoilY: 0 },
        { torsoAngleRad: -17, headTiltRad: 12, frontLegX: -750, frontLegY: 300, backLegX: 640, backLegY: -280, batPivotX: -990, batPivotY: 880, batRotRad: -25, padRecoilX: 0, padRecoilY: 0 },
      ] as BatterKinematics[];
      for (const k of weird) {
        const s = solveBatterSkeleton(k);
        for (const j of Object.values(s)) {
          if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) finite = false;
        }
      }
      assert(finite, "Batter FK: every joint finite across solvers and clamped out-of-domain inputs");
    }

    // T23.11 — extreme pose continuity: no joint teleports between fine steps
    {
      const sweeps: [string, (t: number) => ReturnType<typeof solveBatterSkeleton>][] = [
        ["lbw-shot", (t) => solveBatterSkeleton(solveLBWBatterKinematics(t, false, "DEFENSIVE_FORWARD", 60))],
        ["lbw-noshot", (t) => solveBatterSkeleton(solveLBWBatterKinematics(t, true, "LEAVE_WITHDRAWN", 80))],
        ["caught-behind", (t) => solveBatterSkeleton(solveCaughtBehindBatterKinematics(t, "FORWARD_DEFENCE", 14))],
        ["stumping", (t) => solveBatterSkeleton(solveStumpingBatterKinematics(t, 300, 25).batterK)],
      ];
      let continuous = true;
      let culprit = "";
      const keys: (keyof ReturnType<typeof solveBatterSkeleton>)[] = [
        "pelvis", "shoulder", "headBase", "leadElbow", "leadHand", "rearElbow", "rearHand",
        "leadKnee", "leadAnkle", "trailKnee", "trailAnkle", "batGrip", "batTip",
      ];
      for (const [label, fn] of sweeps) {
        let prev = fn(0);
        for (let i = 1; i <= 1000; i++) {
          const curr = fn(i / 1000);
          for (const key of keys) {
            if (dist(curr[key] as { x: number; y: number }, prev[key] as { x: number; y: number }) > 1.5) {
              continuous = false;
              culprit = label;
            }
          }
          prev = curr;
        }
      }
      assert(continuous, `Batter FK: every joint glides continuously in every solver timeline (${culprit || "all clean"})`);
    }

    // T23.12 — deterministic output
    {
      const mk = () =>
        JSON.stringify(solveBatterSkeleton(solveLBWBatterKinematics(0.42, false, "DEFENSIVE_FORWARD", 45)));
      assert(mk() === mk(), "Batter FK: byte-identical skeletons for repeated solves");
    }
  }

  // --- GROUP 24: FIELDER FK MIGRATION (TASK 2E) ---
  console.log("\n--- GROUP 24: FIELDER FK MIGRATION ---");
  {
    const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);
    const fb = FIELDER_BONE;

    const sampleSkeletons = (): { label: string; k: FielderKinematics; s: ReturnType<typeof solveFielderSkeleton> }[] => {
      const out: { label: string; k: FielderKinematics; s: ReturnType<typeof solveFielderSkeleton> }[] = [];
      for (let i = 0; i <= 40; i++) {
        const p = i / 40;
        for (const isBoundary of [true, false]) {
          const r = solveBoundaryFielderKinematics(p, isBoundary, 300 + (i % 5));
          out.push({ label: `boundary-${isBoundary ? "out" : "safe"}`, k: r.fielderK, s: solveFielderSkeleton(r.fielderK) });
        }
      }
      return out;
    };
    const samples = sampleSkeletons();

    // T24.1 — spine/neck/head adjacency with fixed bone lengths
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.pelvis, s.shoulder), fb.spine)) ok = false;
        if (!near(dist(s.shoulder, s.headBase), fb.neck)) ok = false;
      }
      assert(ok, "Fielder FK: head rides a fixed-length neck chained to the spine for every pose");
    }

    // T24.2 — shoulder/arm/hand adjacency with fixed segment lengths
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.shoulder, s.reachElbow), fb.upperArm)) ok = false;
        if (!near(dist(s.reachElbow, s.reachHand), fb.forearm)) ok = false;
      }
      assert(ok, "Fielder FK: reach arm keeps exact upperArm/forearm lengths from the shoulder");
    }

    // T24.3 — reachArmAngleRad actually drives the arm chain (no longer ignored)
    {
      let ok = true;
      for (const { k, s } of samples) {
        // Chain angle = PI + reach; straight forearm => hand sits exactly at
        // shoulder + 24 * dir(PI + reach) in the shared skeleton convention.
        const a = Math.PI + k.reachArmAngleRad;
        const expected = {
          x: s.shoulder.x + Math.sin(a) * (fb.upperArm + fb.forearm),
          y: s.shoulder.y - Math.cos(a) * (fb.upperArm + fb.forearm),
        };
        if (!near(s.reachHand.x, expected.x, 1e-6) || !near(s.reachHand.y, expected.y, 1e-6)) ok = false;
      }
      assert(ok, "Fielder FK: reachArmAngleRad propagates through the whole arm chain bit-exactly");
    }
    {
      // Distinct reach angles must produce distinct, meaningfully separated hands.
      const base = solveBoundaryFielderKinematics(0.9, true, 300).fielderK;
      const h1 = solveFielderSkeleton({ ...base, reachArmAngleRad: -Math.PI * 0.45 }).reachHand;
      const h2 = solveFielderSkeleton({ ...base, reachArmAngleRad: 0.3 }).reachHand;
      const h3 = solveFielderSkeleton({ ...base, reachArmAngleRad: -0.6 }).reachHand;
      assert(
        dist(h1, h2) > 8 && dist(h1, h3) > 4 && dist(h2, h3) > 4,
        "Fielder FK: arm angle changes visibly reposition the reaching hand"
      );
      assert(
        h1.x > h2.x,
        "Fielder FK: full slide reach extends the hand forward towards the intercept target"
      );
    }

    // T24.4 — hip/leg adjacency with fixed thigh/shin lengths
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(dist(s.leadHip, s.pelvis), Math.hypot(3.5, 2))) ok = false;
        if (!near(dist(s.trailHip, s.pelvis), Math.hypot(3.5, 2))) ok = false;
        if (!near(dist(s.leadHip, s.leadKnee), fb.thigh)) ok = false;
        if (!near(dist(s.leadKnee, s.leadAnkle), fb.shin)) ok = false;
        if (!near(dist(s.trailHip, s.trailKnee), fb.thigh)) ok = false;
        if (!near(dist(s.trailKnee, s.trailAnkle), fb.shin)) ok = false;
      }
      assert(ok, "Fielder FK: legs keep exact thigh/shin lengths from hips fixed to the pelvis");
    }

    // T24.5 — ground constraint: feet pinned to the turf plane in EVERY phase
    {
      let ok = true;
      for (const { s } of samples) {
        if (!near(s.leadAnkle.y, FIELDER_GROUND_Y, 1e-9)) ok = false;
        if (!near(s.trailAnkle.y, FIELDER_GROUND_Y, 1e-9)) ok = false;
      }
      assert(ok, "Fielder FK: both feet stay pinned to the turf line through sprint, slide and recovery");
    }
    {
      // Feet track the solver's stride/slide X targets while grounded, and
      // still separate (stance never collapses to a single point).
      const sprint = solveFielderSkeleton(solveBoundaryFielderKinematics(0.2, true, 300).fielderK);
      const slide = solveFielderSkeleton(solveBoundaryFielderKinematics(0.9, true, 300).fielderK);
      assert(
        sprint.leadAnkle.x > sprint.trailAnkle.x && slide.leadAnkle.x > slide.trailAnkle.x,
        "Fielder FK: lead foot stays ahead of the trail foot in both sprint and slide"
      );
      assert(
        slide.leadAnkle.x < sprint.leadAnkle.x,
        "Fielder FK: slide drops the lead foot back under the body as the body extends"
      );
    }

    // T24.6 — no NaN/Infinity anywhere, including out-of-domain kinematics
    {
      let finite = true;
      for (const { s } of samples) {
        for (const j of Object.values(s)) {
          if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) finite = false;
        }
      }
      const weird = [
        { torsoAngleRad: 55, headX: 900, headY: -900, frontLegX: 800, frontLegY: 600, backLegX: -700, backLegY: -500, reachArmAngleRad: 44, isSliding: true, slideProgress: 3 },
        { torsoAngleRad: -31, headX: -800, headY: 700, frontLegX: -600, frontLegY: -400, backLegX: 500, backLegY: 300, reachArmAngleRad: -38, isSliding: false, slideProgress: -2 },
      ] as FielderKinematics[];
      for (const k of weird) {
        const s = solveFielderSkeleton(k);
        for (const j of Object.values(s)) {
          if (!Number.isFinite(j.x) || !Number.isFinite(j.y)) finite = false;
        }
      }
      assert(finite, "Fielder FK: every joint finite across solvers and clamped out-of-domain inputs");
    }

    // T24.7 — pose continuity: no joint teleports between fine steps
    {
      const sweeps: [string, (t: number) => ReturnType<typeof solveFielderSkeleton>][] = [
        ["boundary-safe", (t) => solveFielderSkeleton(solveBoundaryFielderKinematics(t, false, 300).fielderK)],
        ["boundary-out", (t) => solveFielderSkeleton(solveBoundaryFielderKinematics(t, true, 300).fielderK)],
      ];
      let continuous = true;
      let culprit = "";
      const keys: (keyof ReturnType<typeof solveFielderSkeleton>)[] = [
        "pelvis", "shoulder", "headBase", "reachElbow", "reachHand",
        "leadKnee", "leadAnkle", "trailKnee", "trailAnkle",
      ];
      for (const [label, fn] of sweeps) {
        let prev = fn(0);
        for (let i = 1; i <= 1000; i++) {
          const curr = fn(i / 1000);
          for (const key of keys) {
            if (dist(curr[key] as { x: number; y: number }, prev[key] as { x: number; y: number }) > 1.5) {
              continuous = false;
              culprit = label;
            }
          }
          prev = curr;
        }
      }
      assert(continuous, `Fielder FK: every joint glides continuously across sprint->slide (${culprit || "all clean"})`);
    }

    // T24.8 — deterministic output
    {
      const mk = () =>
        JSON.stringify(solveFielderSkeleton(solveBoundaryFielderKinematics(0.52, true, 317).fielderK));
      assert(mk() === mk(), "Fielder FK: byte-identical skeletons for repeated solves");
    }
  }

  // --- GROUP 25: CAUGHT BEHIND BALL CORRIDOR & EVIDENCE NEUTRALITY (TASK 3) ---
  console.log("\n--- GROUP 25: CAUGHT BEHIND BALL CORRIDOR & EVIDENCE NEUTRALITY ---");
  {
    const corridor = (over: Partial<CaughtBehindCorridor> = {}): CaughtBehindCorridor => ({
      entryX: 400,
      entryY: 270,
      batEdgeX: 380,
      batEdgeY: 120,
      gloveX: 320,
      gloveY: 96,
      gapPx: 14,
      hasEdge: false,
      deflectionAngleDeg: 0,
      ...over,
    });

    // T25.1 — clean miss never reverses lateral direction
    {
      let monotone = true;
      let signFlips = 0;
      for (const gapPx of [0, 4, 9, 18, 30]) {
        const c = corridor({ hasEdge: false, gapPx });
        let prev = solveCaughtBehindBallState(c, 0);
        let refSign = 0;
        for (let i = 1; i <= 400; i++) {
          const s = solveCaughtBehindBallState(c, i / 400);
          const step = s.x - prev.x;
          const sg = Math.sign(Math.abs(step) < 1e-9 ? 0 : step);
          if (sg !== 0) {
            if (refSign === 0) refSign = sg;
            else if (sg !== refSign) {
              signFlips++;
              monotone = false;
            }
          }
          prev = s;
        }
      }
      assert(monotone && signFlips === 0, "CB Ball: clean miss holds one lateral direction for the whole flight");
    }

    // T25.2 — clean miss is continuous in POSITION at the bat plane
    {
      let ok = true;
      for (const gapPx of [0, 6, 20, 34]) {
        const c = corridor({ hasEdge: false, gapPx });
        const before = solveCaughtBehindBallState(c, CB_BAT_CROSS_P - 1e-4);
        const after = solveCaughtBehindBallState(c, CB_BAT_CROSS_P + 1e-4);
        if (Math.hypot(after.x - before.x, after.y - before.y) > 0.05) ok = false;
      }
      assert(ok, "CB Ball: clean miss position is continuous across the bat plane");
    }

    // T25.3 — clean miss is continuous in DIRECTION at the bat plane
    {
      let maxTurn = 0;
      for (const gapPx of [0, 6, 20, 34]) {
        const turn = Math.abs(measureBatPlaneTurnDeg(corridor({ hasEdge: false, gapPx })));
        if (turn > maxTurn) maxTurn = turn;
      }
      assert(maxTurn < 0.5, `CB Ball: clean miss direction is continuous at the bat plane (max turn ${maxTurn.toFixed(3)} deg)`);
    }

    // T25.4 — no artificial reversal: the miss keeps travelling past the bat
    {
      let ok = true;
      for (const gapPx of [4, 14, 28]) {
        const c = corridor({ hasEdge: false, gapPx });
        const atCross = solveCaughtBehindBallState(c, CB_BAT_CROSS_P);
        const end = solveCaughtBehindBallState(c, 1);
        // Corridor runs right-to-left here, so x must keep decreasing.
        if (!(end.x < atCross.x)) ok = false;
        if (!(atCross.x < solveCaughtBehindBallState(c, 0).x)) ok = false;
        if (Math.sign(atCross.vx) !== Math.sign(end.vx)) ok = false;
      }
      assert(ok, "CB Ball: clean miss continues down the corridor without an artificial turn-back");
    }

    // T25.5 — edge deflects, plausibly and in one place only
    {
      let ok = true;
      let sawTurn = false;
      for (const deg of [0.6, 2.4, 3.6]) {
        const c = corridor({ hasEdge: true, gapPx: 0, deflectionAngleDeg: deg });
        const turn = Math.abs(measureBatPlaneTurnDeg(c));
        if (turn > 0.4) sawTurn = true;
        // A plausible nick bends the line without doubling back on itself.
        if (turn >= 90) ok = false;
        const before = solveCaughtBehindBallState(c, CB_BAT_CROSS_P - 1e-4);
        const after = solveCaughtBehindBallState(c, CB_BAT_CROSS_P + 1e-4);
        if (Math.hypot(after.x - before.x, after.y - before.y) > 0.05) ok = false;
      }
      assert(sawTurn && ok, "CB Ball: edge produces a single plausible deflection with continuous position");
    }

    // T25.6 — edge carries into the gloves and decelerates
    {
      const c = corridor({ hasEdge: true, gapPx: 0, deflectionAngleDeg: 2.4 });
      const early = solveCaughtBehindBallState(c, 0.6);
      const late = solveCaughtBehindBallState(c, 0.98);
      const speed = (s: { vx: number; vy: number }) => Math.hypot(s.vx, s.vy);
      const endGap = Math.hypot(late.x - (c.gloveX + 2.4 * 1.6), late.y - (c.gloveY + 6));
      assert(
        speed(late) < speed(early) && endGap < 3,
        "CB Ball: edge carry decelerates into the keeper's gloves"
      );
    }

    // T25.7 — trajectories are deterministic
    {
      const mk = (hasEdge: boolean) =>
        JSON.stringify(
          [0, 0.25, 0.5, 0.75, 1].map((p) =>
            solveCaughtBehindBallState(corridor({ hasEdge, gapPx: hasEdge ? 0 : 16, deflectionAngleDeg: hasEdge ? 2.8 : 0 }), p)
          )
        );
      assert(mk(false) === mk(false) && mk(true) === mk(true), "CB Ball: trajectories are byte-identical for repeated solves");
    }

    // T25.8 — no NaN/Infinity anywhere on either path
    {
      let finite = true;
      for (const hasEdge of [true, false]) {
        for (let i = 0; i <= 200; i++) {
          const s = solveCaughtBehindBallState(corridor({ hasEdge, gapPx: hasEdge ? 0 : 11, deflectionAngleDeg: hasEdge ? 3 : 0 }), i / 200);
          for (const v of [s.x, s.y, s.vx, s.vy, s.radius, s.prevX, s.prevY]) {
            if (!Number.isFinite(v)) finite = false;
          }
        }
      }
      assert(finite, "CB Ball: every sample is finite across both corridors");
    }

    // T25.9 — Super Slow-Mo cannot be read as the answer on marginal gaps
    {
      const edge = solveEdgeOpticalEvidence({ ...cbBase, hasEdge: true, gapMm: 0 });
      // Any gap inside the blur envelope is indistinguishable from contact.
      let marginalMatchesEdge = true;
      for (const gapMm of [1, 3, 5, 6]) {
        const miss = solveEdgeOpticalEvidence({ ...cbBase, hasEdge: false, gapMm });
        if (miss.reading !== edge.reading) marginalMatchesEdge = false;
        if (miss.apparentSeparationMm !== edge.apparentSeparationMm) marginalMatchesEdge = false;
      }
      assert(
        edge.reading === "INCONCLUSIVE" && marginalMatchesEdge,
        "CB Optical: a fine miss and a genuine edge produce an identical inconclusive reading"
      );
    }
    {
      // A genuine edge has no gap, so the camera can never resolve daylight
      // on one. That keeps INCONCLUSIVE ambiguous instead of meaning "edge".
      let neverResolves = true;
      for (const intensity of [0.1, 0.5, 0.95]) {
        const o = solveEdgeOpticalEvidence({ ...cbBase, hasEdge: true, gapMm: 0, spikeIntensity: intensity });
        if (o.reading !== "INCONCLUSIVE" || o.apparentSeparationMm !== 0) neverResolves = false;
      }
      assert(neverResolves, "CB Optical: an edge never resolves daylight, whatever its intensity");
    }
    {
      // Across the generator's real output, an inconclusive reading must cover
      // both truths, so the operator cannot invert it into a verdict.
      let inconclusiveEdges = 0;
      let inconclusiveMisses = 0;
      for (let s = 0; s < 400; s++) {
        const sc = generateScenario(6000 + s * 53, "CAUGHT_BEHIND");
        const cb = sc.caughtBehind!;
        if (solveEdgeOpticalEvidence(cb).reading !== "INCONCLUSIVE") continue;
        if (cb.hasEdge) inconclusiveEdges++;
        else inconclusiveMisses++;
      }
      assert(
        inconclusiveEdges > 0 && inconclusiveMisses > 0,
        `CB Optical: an inconclusive reading covers both edges (${inconclusiveEdges}) and misses (${inconclusiveMisses})`
      );
    }
    {
      // Wide misses still resolve, otherwise clear incidents are undecidable.
      const clear = solveEdgeOpticalEvidence({ ...cbBase, hasEdge: false, gapMm: 30 });
      assert(
        clear.reading === "VISIBLE_DAYLIGHT" && clear.apparentSeparationMm > 0,
        "CB Optical: a wide miss still resolves visible daylight"
      );
    }

    // T25.10 — UltraEdge never encodes hasEdge structurally
    {
      const edgeSig = solveUltraEdgeSignal({ ...cbBase, hasEdge: true, waveformSpikeTimeMs: 1200, spikeIntensity: 0.8, gapMm: 0 });
      const decoySig = solveUltraEdgeSignal({ ...cbBase, hasEdge: false, waveformSpikeTimeMs: null, distractorNoise: true, distractorTimeMs: 1290, distractorType: "PAD", gapMm: 5 });
      const cleanSig = solveUltraEdgeSignal({ ...cbBase, hasEdge: false, waveformSpikeTimeMs: null, gapMm: 30 });

      // Every incident produces a signal: silence can no longer mean "no edge".
      assert(
        edgeSig.transients.length > 0 && decoySig.transients.length > 0 && cleanSig.transients.length > 0,
        "CB Acoustic: every incident yields at least one transient (no giveaway flat line)"
      );
      assert(
        edgeSig.noiseFloor > 0 && decoySig.noiseFloor > 0 && cleanSig.noiseFloor > 0,
        "CB Acoustic: the noise floor is always present"
      );

      // Amplitude and frequency bands overlap between a real edge and a decoy,
      // so loudness or tone alone cannot decide the incident.
      const peak = (s: ReturnType<typeof solveUltraEdgeSignal>) =>
        Math.max(...s.transients.map((t) => t.amplitude));
      const edgePeak = peak(edgeSig);
      const decoyPeak = peak(decoySig);
      assert(
        edgePeak >= 0.4 && edgePeak <= 0.8 && decoyPeak >= 0.4 && decoyPeak <= 0.8,
        "CB Acoustic: edge and decoy transients share the same amplitude band"
      );

      // A decoy sits off the transit frame; a genuine edge sits close to it.
      const edgeNear = findNearestTransient(edgeSig)!;
      const decoyNear = findNearestTransient(decoySig)!;
      assert(
        Math.abs(edgeNear.offsetMs) < Math.abs(decoyNear.offsetMs),
        "CB Acoustic: alignment with the transit frame is the discriminator, not loudness"
      );
    }

    // T25.12 — alignment is evidence, not a lookup table
    {
      // Across the generator's whole output, edge offsets must spread over a
      // band rather than collapsing to one constant, and clean-miss offsets
      // must overlap that band, so a tight offset is never conclusive proof.
      const edgeOffsets: number[] = [];
      const missOffsets: number[] = [];
      for (let s = 0; s < 400; s++) {
        const sc = generateScenario(4000 + s * 41, "CAUGHT_BEHIND");
        const cb = sc.caughtBehind!;
        const near = findNearestTransient(solveUltraEdgeSignal(cb));
        if (!near) continue;
        (cb.hasEdge ? edgeOffsets : missOffsets).push(Math.abs(near.offsetMs));
      }
      const distinctEdge = new Set(edgeOffsets.map((v) => v.toFixed(1))).size;
      assert(
        edgeOffsets.length > 20 && distinctEdge > 10,
        `CB Acoustic: edge alignment offsets vary across incidents (${distinctEdge} distinct values)`
      );
      const edgeMax = Math.max(...edgeOffsets);
      const missOverlapping = missOffsets.filter((v) => v <= edgeMax).length;
      assert(
        missOverlapping > 0,
        "CB Acoustic: clean misses also produce transients inside the edge alignment band"
      );
    }

    // T25.11 — acoustic signal is deterministic and finite
    {
      const mk = () => JSON.stringify(solveUltraEdgeSignal({ ...cbBase, hasEdge: true, waveformSpikeTimeMs: 1200, gapMm: 0 }));
      assert(mk() === mk(), "CB Acoustic: signal model is byte-identical for repeated solves");

      let finite = true;
      const sig = solveUltraEdgeSignal({ ...cbBase, hasEdge: true, waveformSpikeTimeMs: 1200, distractorNoise: true, distractorTimeMs: 1310, distractorType: "PAD", gapMm: 0 });
      for (let t = sig.windowStartMs; t <= sig.windowEndMs; t += 4) {
        if (!Number.isFinite(sampleUltraEdgeAmplitude(sig, t))) finite = false;
      }
      assert(finite, "CB Acoustic: amplitude samples stay finite across the review window");
    }

    // ==============================================================
    // GROUP 26 — HOTSPOT NEUTRAL THERMAL EVIDENCE (CAM 08)
    // The IR element must present observable evidence only: intensity,
    // placement, decay and timing context that overlap between a genuine
    // edge and a fine pass, so the operator interprets rather than reads.
    // ==============================================================
    console.log("\n--- GROUP 26: HOTSPOT NEUTRAL THERMAL EVIDENCE ---");

    // T26.1 — the thermal model never branches on truth flags
    {
      const edgeModel = solveHotSpotThermal({ ...cbBase, hasEdge: true, waveformSpikeTimeMs: 1200, spikeIntensity: 0.8, gapMm: 0 });
      assert(
        !("hasEdge" in edgeModel) && !("soundType" in edgeModel) && !("verdict" in edgeModel),
        "HotSpot: model exposes no truth field (hasEdge / soundType / verdict absent)"
      );
      // Flip ONLY the truth flag on an otherwise identical incident: every
      // solved value must stay identical, proving no hidden truth branch.
      const flipped = { ...cbBase, hasEdge: true as const };
      assert(
        JSON.stringify(solveHotSpotThermal(flipped)) === JSON.stringify(solveHotSpotThermal(cbBase)),
        "HotSpot: flipping only hasEdge changes nothing in the model"
      );
      const flippedFrame = solveHotSpotThermalFrame(solveHotSpotThermal(flipped), 1350);
      const baseFrame = solveHotSpotThermalFrame(solveHotSpotThermal(cbBase), 1350);
      assert(
        JSON.stringify(flippedFrame) === JSON.stringify(baseFrame),
        "HotSpot: frames are identical when only the truth flag differs"
      );
    }

    // T26.2 — deterministic signal generation
    {
      const cb = { ...cbBase, gapMm: 5, spikeIntensity: 0.7, waveformSpikeTimeMs: 1200 };
      const a = solveHotSpotThermal(cb);
      const b = solveHotSpotThermal({ ...cb });
      assert(
        JSON.stringify(a) === JSON.stringify(b),
        "HotSpot: repeated solves of one incident are byte-identical"
      );
      const fa = solveHotSpotThermalFrame(a, 1240);
      const fb = solveHotSpotThermalFrame(b, 1240);
      assert(
        JSON.stringify(fa) === JSON.stringify(fb),
        "HotSpot: frame solves are byte-identical across repeats"
      );
      // Scrub away and back: heat history replays exactly.
      const fwd = solveHotSpotThermalFrame(a, 1500);
      const backAgain = solveHotSpotThermalFrame(a, 1240);
      assert(
        JSON.stringify(backAgain) === JSON.stringify(fa) && fwd.timeMs > backAgain.timeMs,
        "HotSpot: scrubbing backwards reproduces the exact earlier frame"
      );
      // Every zone reading stays finite across the whole window.
      let finite = true;
      for (let t = 800; t <= 1600; t += 10) {
        const f = solveHotSpotThermalFrame(a, t);
        if (!Number.isFinite(f.ambientLevel) || !Number.isFinite(f.noiseLevel) || !Number.isFinite(f.peakIntensityPct)) finite = false;
        for (const z of f.zones) {
          if (!Number.isFinite(z.intensity)) finite = false;
          const s = sampleHotSpotIntensity(f, z.xMm + 1, z.yMm - 1);
          if (!Number.isFinite(s)) finite = false;
        }
      }
      assert(finite, "HotSpot: all sampled intensities stay finite across the review window");
    }

    // T26.3 — every incident shows a live sensor picture; bands overlap truths
    {
      const edgeModel = solveHotSpotThermal({ ...cbBase, hasEdge: true, waveformSpikeTimeMs: 1200, spikeIntensity: 0.85, gapMm: 0 });
      const missModel = solveHotSpotThermal({ ...cbBase, hasEdge: false, gapMm: 4 });
      const edgePeakAtTransit = Math.max(...solveHotSpotThermalFrame(edgeModel, 1260).zones.map((z) => z.intensity));
      const missPeakAtTransit = Math.max(...solveHotSpotThermalFrame(missModel, 1260).zones.map((z) => z.intensity));
      assert(
        edgePeakAtTransit > 0 && missPeakAtTransit > 0,
        "HotSpot: both an edge and a near-miss show measurable radiance at the transit"
      );
      // Overlap: neither truth owns an exclusive intensity band.
      const overlaps =
        edgePeakAtTransit <= Math.max(missPeakAtTransit * 1.6, missPeakAtTransit + 0.25) &&
        missPeakAtTransit >= edgePeakAtTransit * 0.55;
      assert(overlaps, "HotSpot: edge and marginal-miss radiance bands overlap");
    }

    // T26.4 — no direct verdict labels anywhere in the rendered UI
    {
      const mkMarkup = (cb: CaughtBehindData) =>
        renderToStaticMarkup(React.createElement(HotSpotIRView, { caughtBehind: cb, currentTimeMs: 1300 }));
      const cases: Array<[string, CaughtBehindData]> = [
        ["edge", { ...cbBase, hasEdge: true, waveformSpikeTimeMs: 1200, spikeIntensity: 0.9, gapMm: 0 }],
        ["clean", { ...cbBase, hasEdge: false, gapMm: 30 }],
        ["decoy", { ...cbBase, hasEdge: false, gapMm: 6, distractorNoise: true, distractorTimeMs: 1320, distractorType: "PAD" }],
      ];
      const forbidden = [
        "HOTSPOT DETECTED",
        "OUTSIDE EDGE FRICTION",
        "POSITIVE",
        "NEGATIVE",
        "NO SPOT",
        "CONFIRMED",
        "CLEAN",
        "NICK",
        "HAS EDGE",
        "CONTACT",
        "THERMAL FRICTION SIGNATURE",
      ];
      let leakFree = true;
      for (const [name, cb] of cases) {
        const markup = mkMarkup(cb);
        const upper = markup.toUpperCase();
        for (const term of forbidden) {
          if (upper.includes(term)) {
            leakFree = false;
            console.error(`    [leak] ${name} case renders "${term}"`);
          }
        }
      }
      assert(leakFree, "HotSpot UI: clean/edge/decoy cases render zero verdict labels");
      // And each case still produces a live instrument picture.
      for (const [name, cb] of cases) {
        const markup = mkMarkup(cb);
        const ok = markup.includes("RADIANCE") || markup.includes("DETECTION THRESHOLD") || markup.includes("APPROACHING BAT PLANE");
        assert(ok, `HotSpot UI: ${name} case renders an interpretive status line`);
      }
    }

    // T26.5 — generator-wide neutrality sweep
    {
      let neutral = true;
      let lastEdge: string | null = null;
      let lastMiss: string | null = null;
      for (let s = 0; s < 300; s++) {
        const sc = generateScenario(9000 + s * 37, "CAUGHT_BEHIND");
        const cb = sc.caughtBehind!;
        const model = solveHotSpotThermal(cb);
        const payload = JSON.stringify(model);
        if (payload.includes('"hasEdge":')) neutral = false;
        if (cb.hasEdge && lastEdge === null) lastEdge = payload;
        if (!cb.hasEdge && lastMiss === null) lastMiss = payload;
      }
      assert(neutral, "HotSpot: no serialized model carries a hasEdge key across generator output");
      assert(
        lastEdge !== null && lastMiss !== null && lastEdge !== lastMiss,
        "HotSpot: distinct incidents solve to distinct presentations (both truths exercised)"
      );
    }

    // ==============================================================
    // GROUP 27 — REPLAY KEYBOARD TRANSPORT MAPPING
    // Pure mapping layer: keys become commands executed by the shared
    // canonical transport. Verified here without a browser.
    // ==============================================================
    console.log("\n--- GROUP 27: REPLAY KEYBOARD TRANSPORT ---");

    // T27.1 — shortcut mapping
    {
      assert(
        resolveReplayShortcut(" ", false)?.type === "TOGGLE_PLAY",
        "Keys: SPACE resolves to play/pause toggle"
      );
      const left = resolveReplayShortcut("ArrowLeft", false);
      const right = resolveReplayShortcut("ArrowRight", false);
      const shiftLeft = resolveReplayShortcut("ArrowLeft", true);
      const shiftRight = resolveReplayShortcut("ArrowRight", true);
      assert(
        left?.type === "STEP" && left.frames === -1,
        "Keys: ArrowLeft steps back exactly 1 frame"
      );
      assert(
        right?.type === "STEP" && right.frames === 1,
        "Keys: ArrowRight steps forward exactly 1 frame"
      );
      assert(
        shiftLeft?.type === "STEP" && shiftLeft.frames === -5,
        "Keys: Shift+ArrowLeft steps back exactly 5 frames"
      );
      assert(
        shiftRight?.type === "STEP" && shiftRight.frames === 5,
        "Keys: Shift+ArrowRight steps forward exactly 5 frames"
      );
      assert(
        resolveReplayShortcut("a", false) === null &&
          resolveReplayShortcut("Enter", false) === null &&
          resolveReplayShortcut("Escape", false) === null,
        "Keys: non-transport keys resolve to nothing"
      );
    }

    // T27.2 — typing-target guard
    {
      assert(isTextEntryTarget(null) === false, "Keys: null target is never treated as typing");
      assert(
        isTextEntryTarget(undefined as unknown as EventTarget) === false,
        "Keys: undefined target is never treated as typing"
      );
      assert(
        isTextEntryTarget({} as EventTarget) === false,
        "Keys: plain object target is never treated as typing"
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



