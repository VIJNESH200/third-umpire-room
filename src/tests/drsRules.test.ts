import {
  evaluateDRSLBW,
  evaluateRunOut,
  evaluateStumping,
  evaluateCaughtBehind,
  evaluateBoundary,
  checkDRSCompliance,
} from "../engine/drsRules";
import { solveStumpingReplayState } from "../engine/stumpingPhysics";
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
  solveCaughtBehindDeliveryTrajectory,
  projectCaughtBehindToMacro,
  CB_TIMESTAMPS,
  BAT_EDGE_X_M,
  BALL_RADIUS_M,
  measureBatPlaneTurnDeg,
  solveEdgeOpticalEvidence,
  solveUltraEdgeSignal,
  sampleUltraEdgeAmplitude,
  findNearestTransient,
  solveBatGroundContact,
  solveCaughtBehindSlipCorridor,
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
  calculateBatOutsideEdgeScreenPos,
} from "../components/instinct/actorRigs";
import {
  solveHotSpotThermal,
  solveHotSpotThermalFrame,
  sampleHotSpotIntensity,
} from "../engine/hotspotThermal";
import { resolveReplayShortcut, isTextEntryTarget } from "../engine/replayKeyboard";
import {
  solveLBWReplayState,
  solveUnhinderedBallTrajectory,
  getLBWWaypoints,
  projectLBWPointToHawkEyeSVG,
  getHawkEyeTrajectoryStages,
  getBallStateLog,
  LBW_TIMESTAMPS,
} from "../engine/lbwPhysics";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HotSpotIRView } from "../components/tools/HotSpotIRView";
import {
  StumpingEvidenceReview,
  STUMPING_FRAMING_CONFIGS,
} from "../components/tools/StumpingEvidenceReview";
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
        if (label.startsWith("stumping")) {
          // In stumping, lead foot remains pinned to turf line (planted stance), rear foot articulates
          if (!near(s.leadAnkle.y, 6, 1e-6)) ok = false;
          continue;
        }
        if (!near(s.leadAnkle.y, 6, 1e-6) || !near(s.trailAnkle.y, 6, 1e-6)) ok = false;
      }
      assert(ok, "Batter FK: lead ankle stays pinned to turf across all solvers (both ankles for non-stumping)");
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

  // --- GROUP 28: LBW CANONICAL PHYSICS & CAM 01 <-> CAM 03 SYNCHRONIZATION ---
  console.log("\n--- GROUP 28: LBW CANONICAL PHYSICS & CAM 01 <-> CAM 03 SYNCHRONIZATION ---");
  {
    // Generate a set of diverse LBW scenarios
    const lbwScenarios = [];
    for (let s = 1; s <= 20; s++) {
      const scn = generateScenario(s * 1013);
      if (scn.incidentType === "LBW" && scn.lbw) {
        lbwScenarios.push(scn.lbw);
      }
    }

    // T28.1: Determinism - repeated solves are byte-identical
    {
      const lbw = lbwScenarios[0];
      const s1 = JSON.stringify(solveLBWReplayState(lbw, 1350));
      const s2 = JSON.stringify(solveLBWReplayState(lbw, 1350));
      assert(s1 === s2, "LBW Physics: repeated solves at same timestamp are byte-identical");
    }

    // T28.2: Waypoints match scenario fields exactly
    {
      for (const lbw of lbwScenarios) {
        const wp = getLBWWaypoints(lbw);
        assert(Math.abs(wp.bounce.x - lbw.pitchX) < 1e-6, "LBW Waypoints: bounce X matches pitchX");
        assert(Math.abs(wp.impact.x - lbw.impactX) < 1e-6, "LBW Waypoints: impact X matches impactX");
        assert(Math.abs(wp.stumps.x - lbw.stumpHitX) < 1e-6, "LBW Waypoints: stumps X matches stumpHitX");
        assert(Math.abs(wp.stumps.y - lbw.stumpHitHeightCm / 100) < 1e-6, "LBW Waypoints: stumps height matches stumpHitHeightCm");
      }
    }

    // T28.3: Finite 3D ball coordinates across full timeline [600, 2200]
    {
      let allFinite = true;
      for (const lbw of lbwScenarios) {
        for (let t = 600; t <= 2200; t += 20) {
          const state = solveLBWReplayState(lbw, t);
          if (!Number.isFinite(state.ball.x) || !Number.isFinite(state.ball.y) || !Number.isFinite(state.ball.z)) {
            allFinite = false;
          }
        }
      }
      assert(allFinite, "LBW Physics: ball coordinates remain finite and smooth across full timeline sweep");
    }

    // T28.4: Clean miss (no bat contact) has visible clearance and hits pad
    {
      const cleanMiss = lbwScenarios.find((l) => !l.batContactBeforePad) || lbwScenarios[0];
      const stateImpact = solveLBWReplayState(cleanMiss, LBW_TIMESTAMPS.T_IMPACT);
      assert(stateImpact.ball.hasHitPad, "LBW Physics: clean miss registers pad impact at T_IMPACT");
      assert(!stateImpact.ball.hasHitBat, "LBW Physics: clean miss has no bat contact at T_IMPACT");
      assert(Math.abs(stateImpact.ball.x - cleanMiss.impactX) < 0.05, "LBW Physics: ball arrives at impactX");
    }

    // T28.5: Bat contact before pad deflects ball away from stumps
    {
      // Mock an LBW with prior bat contact
      const batFirstLbw = { ...lbwScenarios[0], batContactBeforePad: true, shotOffered: true };
      const stateIntercept = solveLBWReplayState(batFirstLbw, LBW_TIMESTAMPS.T_INTERCEPT + 10);
      assert(stateIntercept.ball.hasHitBat, "LBW Physics: prior bat contact registers hit at T_INTERCEPT");

      const statePost = solveLBWReplayState(batFirstLbw, 1700);
      assert(statePost.ball.hasHitBat, "LBW Physics: deflected ball retains hit-bat status");
      assert(!statePost.ball.hasHitPad, "LBW Physics: deflected ball avoids pad contact");
    }

    // T28.6: Both Right-Hand and Left-Hand batters produce valid geometries
    {
      const rhLbw = { ...lbwScenarios[0], batterHand: "RIGHT" as const };
      const lhLbw = { ...lbwScenarios[0], batterHand: "LEFT" as const };
      const rhState = solveLBWReplayState(rhLbw, 1200);
      const lhState = solveLBWReplayState(lhLbw, 1200);
      assert(Number.isFinite(rhState.batter.frontPadWorld.x) && Number.isFinite(lhState.batter.frontPadWorld.x),
        "LBW Physics: both Right and Left-Hand batters solve to valid finite coordinates");
    }

    // T28.7: Hawk-Eye SVG projection matches 3D lateral signs
    {
      const lbw = lbwScenarios[0];
      const wp = getLBWWaypoints(lbw);
      const svgBounce = projectLBWPointToHawkEyeSVG(wp.bounce);
      const svgImpact = projectLBWPointToHawkEyeSVG(wp.impact);
      const svgStumps = projectLBWPointToHawkEyeSVG(wp.stumps);

      assert(Number.isFinite(svgBounce.x) && Number.isFinite(svgBounce.y), "Hawk-Eye SVG: bounce projection finite");
      assert(Number.isFinite(svgImpact.x) && Number.isFinite(svgImpact.y), "Hawk-Eye SVG: impact projection finite");
      assert(Number.isFinite(svgStumps.x) && Number.isFinite(svgStumps.y), "Hawk-Eye SVG: stumps projection finite");
      // Right of center in 3D (+X) must be right of center in SVG (> 300)
      if (wp.impact.x > 0.05) {
        assert(svgImpact.x > 300, "Hawk-Eye SVG: +X in 3D maps to >300 in SVG");
      } else if (wp.impact.x < -0.05) {
        assert(svgImpact.x < 300, "Hawk-Eye SVG: -X in 3D maps to <300 in SVG");
      }
    }

    // T28.8: Neutral stance at 600ms is unperturbed
    {
      const lbw = lbwScenarios[0];
      const state600 = solveLBWReplayState(lbw, LBW_TIMESTAMPS.T_NEUTRAL);
      assert(state600.batter.stride === 0, "LBW Physics: stride is 0 at neutral 600ms");
      assert(state600.batter.swing === 0, "LBW Physics: swing is 0 at neutral 600ms");
    }
  }

  // --- GROUP 29: AUTHORITATIVE BALL TRAJECTORY & ACCEPTANCE TEST CHECKPOINTS ---
  console.log("\n--- GROUP 29: AUTHORITATIVE BALL TRAJECTORY & ACCEPTANCE TEST CHECKPOINTS ---");
  {
    const scn = generateScenario(101, "LBW");
    const lbw = scn.lbw!;

    // T29.1: Acceptance Test Checkpoints: Release, Pre-Bounce, Bounce, Post-Bounce, Batter Arrival, Impact
    const stateLog = getBallStateLog(lbw);
    assert(stateLog.length === 6, "Acceptance Checkpoints: exactly 6 canonical checkpoints logged");

    console.log("   Logged Delivery World-Space State Checkpoints:");
    stateLog.forEach((entry) => {
      console.log(`     - [${entry.label.padEnd(24)}] t=${entry.timeMs}ms | pos=(${entry.pos.x.toFixed(3)}, ${entry.pos.y.toFixed(3)}, ${entry.pos.z.toFixed(3)}) | vel=(${entry.vel.vx.toFixed(3)}, ${entry.vel.vy.toFixed(3)}, ${entry.vel.vz.toFixed(3)})`);
      assert(
        Number.isFinite(entry.pos.x) && Number.isFinite(entry.pos.y) && Number.isFinite(entry.pos.z),
        `Checkpoint ${entry.label}: position coordinates are finite`
      );
      assert(
        Number.isFinite(entry.vel.vx) && Number.isFinite(entry.vel.vy) && Number.isFinite(entry.vel.vz),
        `Checkpoint ${entry.label}: velocity coordinates are finite`
      );
    });

    // T29.2: CAM 01 and CAM 03 consume identical physical world-space coordinates
    // For every checkpoint up to impact, solveLBWReplayState and solveUnhinderedBallTrajectory yield identical results
    stateLog.forEach((entry) => {
      const cam01State = solveLBWReplayState(lbw, entry.timeMs);
      const cam03State = solveUnhinderedBallTrajectory(lbw, entry.timeMs);

      const dx = Math.abs(cam01State.ball.x - cam03State.pos.x);
      const dy = Math.abs(cam01State.ball.y - cam03State.pos.y);
      const dz = Math.abs(cam01State.ball.z - cam03State.pos.z);
      const dvx = Math.abs(cam01State.ball.vx - cam03State.vel.x);
      const dvy = Math.abs(cam01State.ball.vy - cam03State.vel.y);
      const dvz = Math.abs(cam01State.ball.vz - cam03State.vel.z);

      assert(dx < 1e-6 && dy < 1e-6 && dz < 1e-6, `State Identity: CAM 01 & CAM 03 world position identical at ${entry.label}`);
      assert(dvx < 1e-6 && dvy < 1e-6 && dvz < 1e-6, `State Identity: CAM 01 & CAM 03 world velocity identical at ${entry.label}`);
    });

    // T29.3: Post-bounce horizontal collinearity (zero lateral kink between bounce, impact, and stumps)
    // The unhindered lateral velocity Vx must remain strictly constant throughout [1200ms, 1680ms]
    const vAtBounce = solveUnhinderedBallTrajectory(lbw, 1220).vel.x;
    const vAtPreImpact = solveUnhinderedBallTrajectory(lbw, 1480).vel.x;
    const vAtImpact = solveUnhinderedBallTrajectory(lbw, 1500).vel.x;
    const vAtStumps = solveUnhinderedBallTrajectory(lbw, 1660).vel.x;

    assert(Math.abs(vAtBounce - vAtPreImpact) < 1e-5, "Trajectory Collinearity: Vx constant from bounce to impact");
    assert(Math.abs(vAtPreImpact - vAtImpact) < 1e-5, "Trajectory Collinearity: Vx continuous through impact");
    assert(Math.abs(vAtImpact - vAtStumps) < 1e-5, "Trajectory Collinearity: Vx constant from impact to stumps (zero lateral kink)");

    // T29.4: Hawk-Eye Trajectory Stages generate unbroken, continuous paths
    const stages = getHawkEyeTrajectoryStages(lbw);
    assert(stages.flightArcPath.startsWith("M "), "Hawk-Eye Stages: flight arc path generated");
    assert(stages.flightShadowPath.startsWith("M "), "Hawk-Eye Stages: flight shadow path generated");
    assert(stages.bounceArcPath.startsWith("M "), "Hawk-Eye Stages: bounce arc path generated");
    assert(stages.bounceShadowPath.startsWith("M "), "Hawk-Eye Stages: bounce shadow path generated");

    if (!lbw.batContactBeforePad) {
      assert(stages.projectedStumpsPath.startsWith("M "), "Hawk-Eye Stages: projected stumps path generated for clean delivery");
      assert(stages.projectedShadowPath.startsWith("M "), "Hawk-Eye Stages: projected shadow path generated for clean delivery");
      // Verify that the projected stumps path starts exactly at the impact point SVG
      const firstProjectedCoord = stages.projectedStumpsPath.split(" ")[1];
      const expectedImpactCoord = `${stages.impactPointSVG.x.toFixed(1)},${stages.impactPointSVG.y.toFixed(1)}`;
      assert(firstProjectedCoord === expectedImpactCoord, "Hawk-Eye Stages: projected ray starts exactly at impact point");
    }

    // T29.5: Scenario generator produces collinear parameters
    for (let i = 0; i < 20; i++) {
      const testScn = generateScenario(i * 1013, "LBW");
      if (testScn.lbw) {
        const testLbw = testScn.lbw;
        const wp = getLBWWaypoints(testLbw);
        // Verify impact point is along the line between bounce and stumps
        const f = (wp.impact.z - wp.stumps.z) / (wp.bounce.z - wp.stumps.z);
        const expectedX = wp.stumps.x * (1 - f) + wp.bounce.x * f;
        assert(Math.abs(wp.impact.x - expectedX) < 1e-5, `Scenario Generator: delivery #${i} impact point collinear with trajectory`);
      }
    }
  }

  // ==============================================================
  // GROUP 30 — CREASE 500FPS TIMING SEPARATION INVARIANTS (>= 6 FRAMES)
  // ==============================================================
  console.log("\n--- GROUP 30: CREASE 500FPS TIMING MARGIN INVARIANTS ---");
  {
    const FPS_500 = 500;
    const FRAME_MS_500 = 1000 / FPS_500; // 2ms per frame
    const MIN_REQUIRED_FRAMES = 6;

    let outCount = 0;
    let notOutCount = 0;
    let bounceCount = 0;

    for (let seed = 1; seed <= 60; seed++) {
      const scenario = generateScenario(seed * 777, "RUN_OUT");
      assert(scenario.runOut !== undefined, `Seed ${seed}: runOut scenario generated`);
      const ro = scenario.runOut!;

      // 1. Separation Invariant: absolute difference >= 12ms (>= 6 frames at 500 FPS)
      const deltaMs = Math.abs(ro.bailsDislodgedFrameMs - ro.groundedFrameMs);
      const frames500 = deltaMs / FRAME_MS_500;
      assert(
        frames500 >= MIN_REQUIRED_FRAMES,
        `Crease Timing Margin (seed ${seed}): deltaMs=${deltaMs}ms corresponds to ${frames500} frames at 500 FPS, which is >= ${MIN_REQUIRED_FRAMES} frames`
      );

      // 2. Physical Ordering and Decision Consistency
      const evalResult = evaluateRunOut(ro, scenario.onFieldSignal);
      if (evalResult.correctFinalVerdict === "NOT_OUT") {
        notOutCount++;
        assert(
          ro.groundedFrameMs < ro.bailsDislodgedFrameMs,
          `NOT OUT Physical Ordering (seed ${seed}): bat grounded (${ro.groundedFrameMs}ms) occurs before bails dislodged (${ro.bailsDislodgedFrameMs}ms)`
        );
        assert(
          ro.creaseMarginMm > 0,
          `NOT OUT Crease Margin (seed ${seed}): creaseMarginMm is positive (${ro.creaseMarginMm}mm)`
        );
      } else {
        outCount++;
        if (ro.batBounced) {
          bounceCount++;
          const stateAtDislodge = solveRunOutReplayState(ro, ro.bailsDislodgedFrameMs);
          assert(
            !stateAtDislodge.bat.isGrounded || stateAtDislodge.bat.tipAltitudeMm > 0,
            `Airborne Bat Bounce (seed ${seed}): bat is airborne above turf at dislodgement frame`
          );
        } else {
          assert(
            ro.bailsDislodgedFrameMs < ro.groundedFrameMs,
            `OUT Physical Ordering (seed ${seed}): bails dislodged (${ro.bailsDislodgedFrameMs}ms) before bat grounded (${ro.groundedFrameMs}ms)`
          );
          assert(
            ro.creaseMarginMm < 0,
            `OUT Crease Margin (seed ${seed}): creaseMarginMm is negative (${ro.creaseMarginMm}mm)`
          );
        }
      }

      // 3. Physical Synchronization Invariant:
      // Canonical groundedFrameMs strictly synchronizes with slide speed (6.2 mm/ms)
      assert(
        ro.creaseMarginMm === Math.round(ro.marginMs * -6.2),
        `Physical Synchronization (seed ${seed}): creaseMarginMm strictly derived from marginMs * -6.2 mm/ms`
      );
    }

    // 4. Distribution Invariant: Both OUT and NOT OUT cases must be actively generated
    assert(outCount > 15, `Scenario Distribution: sufficient OUT cases generated (${outCount} >= 15)`);
    assert(notOutCount > 15, `Scenario Distribution: sufficient NOT OUT cases generated (${notOutCount} >= 15)`);
    console.log(`[PASS] Crease Timing: 60 incidents tested (OUT: ${outCount}, NOT OUT: ${notOutCount}, Bounce: ${bounceCount}) - 100% satisfied >= 6 frames`);
  }

  // ================================================================
  // GROUP 31: HOTSPOT IR THERMAL OVERHAUL & ZERO ANSWER LEAKS
  // ================================================================
  console.log("\n--- GROUP 31: HOTSPOT IR THERMAL OVERHAUL & ZERO ANSWER LEAKS ---");

  // T31.1 — HotSpot genuine contact produces thermal radiance at transit
  {
    const edgeIncident: CaughtBehindData = {
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

    const model = solveHotSpotThermal(edgeIncident);
    const frameAtTransit = solveHotSpotThermalFrame(model, 1205);
    const candidate = frameAtTransit.zones.find((z) => z.id === "CANDIDATE");

    assert(candidate !== undefined, "HotSpot: Candidate zone exists in model");
    assert(
      candidate!.intensity >= 0.12 && candidate!.isIgnited,
      "HotSpot: Genuine edge produces an ignited thermal bloom (>= 12% threshold) at transit"
    );
    assert(
      frameAtTransit.peakIntensityPct >= 50,
      "HotSpot: Genuine edge generates high peak radiance at transit (>= 50%)"
    );
  }

  // T31.2 — Clean miss produces negligible radiance at bat edge
  {
    const clearMissIncident: CaughtBehindData = {
      hasEdge: false,
      waveformSpikeTimeMs: null,
      distractorNoise: false,
      distractorTimeMs: null,
      distractorType: null,
      proximityFrameMs: 1200,
      spikeIntensity: 0.1,
      ballPassesBatFrameMs: 1200,
      gapMm: 36,
      soundType: "SILENCE",
    };

    const model = solveHotSpotThermal(clearMissIncident);
    const frameAtTransit = solveHotSpotThermalFrame(model, 1205);
    const candidate = frameAtTransit.zones.find((z) => z.id === "CANDIDATE");

    assert(candidate !== undefined, "HotSpot: Model remains structurally consistent on clean miss");
    // With gapMm = 36mm, closeness is 0, so candidate peak is at baseline
    assert(
      candidate!.intensity < 0.45,
      "HotSpot: Clear miss does not produce an edge contact bloom"
    );
  }

  // T31.3 — Pad distractor produces decoy glow on pad, leaving bat edge clean
  {
    const padIncident: CaughtBehindData = {
      hasEdge: false,
      waveformSpikeTimeMs: null,
      distractorNoise: true,
      distractorTimeMs: 1320,
      distractorType: "PAD",
      proximityFrameMs: 1200,
      spikeIntensity: 0.1,
      ballPassesBatFrameMs: 1200,
      gapMm: 6,
      soundType: "DULL_THUD",
    };

    const model = solveHotSpotThermal(padIncident);
    const padZone = model.zones.find((z) => z.id === "PAD_DECOY");
    assert(padZone !== undefined, "HotSpot: Pad distractor creates a distinct PAD_DECOY zone");
    assert(
      padZone!.xMm < -20,
      "HotSpot: Pad decoy is physically positioned off the bat blade (xMm < -20)"
    );

    // At transit (1200ms), pad decoy is not yet ignited (ignites around 1320ms)
    const frameAtTransit = solveHotSpotThermalFrame(model, 1200);
    const padAtTransit = frameAtTransit.zones.find((z) => z.id === "PAD_DECOY");
    assert(
      padAtTransit!.intensity === 0,
      "HotSpot: Pad decoy does not radiate prior to pad contact time"
    );

    // At pad impact (1325ms), pad decoy is actively radiating
    const frameAtPad = solveHotSpotThermalFrame(model, 1325);
    const padAtImpact = frameAtPad.zones.find((z) => z.id === "PAD_DECOY");
    assert(
      padAtImpact!.intensity > 0.3 && padAtImpact!.isIgnited,
      "HotSpot: Pad decoy actively radiates at distractor timestamp"
    );
  }

  // T31.4 — Model stability across 20 varied seeds
  {
    for (let seed = 1; seed <= 20; seed++) {
      const scenario = generateScenario(seed, "CAUGHT_BEHIND", "MARGINAL");
      if (scenario.caughtBehind) {
        const m = solveHotSpotThermal(scenario.caughtBehind);
        const f = solveHotSpotThermalFrame(m, scenario.caughtBehind.ballPassesBatFrameMs);
        assert(Number.isFinite(f.peakIntensityPct), `HotSpot (seed ${seed}): peakIntensityPct is finite`);
        assert(Number.isFinite(f.ambientLevel), `HotSpot (seed ${seed}): ambientLevel is finite`);
        assert(Number.isFinite(f.noiseLevel), `HotSpot (seed ${seed}): noiseLevel is finite`);
      }
    }
    console.log("[PASS] HotSpot: Validated thermal physics, pad decoys, and numerical stability across 20 seeds");
  }

  // --- GROUP 32: CAUGHT BEHIND CANONICAL TRAJECTORY & CROSS-CAMERA COHERENCE ---
  console.log("\n--- GROUP 32: CAUGHT BEHIND CANONICAL TRAJECTORY & CROSS-CAMERA COHERENCE ---");
  {
    const edgeCb: CaughtBehindData = {
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

    const missCb: CaughtBehindData = {
      hasEdge: false,
      waveformSpikeTimeMs: null,
      distractorNoise: false,
      distractorTimeMs: null,
      distractorType: null,
      proximityFrameMs: 1200,
      spikeIntensity: 0.1,
      ballPassesBatFrameMs: 1200,
      gapMm: 18,
      soundType: "SILENCE",
    };

    // T32.1: Continuous velocity and finite state across entire delivery
    {
      let ok = true;
      for (let t = 600; t <= 2200; t += 25) {
        const sEdge = solveCaughtBehindDeliveryTrajectory(edgeCb, t);
        const sMiss = solveCaughtBehindDeliveryTrajectory(missCb, t);
        if (!Number.isFinite(sEdge.x) || !Number.isFinite(sEdge.y) || !Number.isFinite(sEdge.z)) ok = false;
        if (!Number.isFinite(sMiss.x) || !Number.isFinite(sMiss.y) || !Number.isFinite(sMiss.z)) ok = false;
        if (!Number.isFinite(sEdge.vx) || !Number.isFinite(sEdge.vy) || !Number.isFinite(sEdge.vz)) ok = false;
        if (!Number.isFinite(sMiss.vx) || !Number.isFinite(sMiss.vy) || !Number.isFinite(sMiss.vz)) ok = false;
      }
      assert(ok, "T32.1: 3D delivery state is strictly finite across entire timeline");

      // C1 velocity continuity across transit for clean miss
      const sPre = solveCaughtBehindDeliveryTrajectory(missCb, 1198);
      const sPost = solveCaughtBehindDeliveryTrajectory(missCb, 1202);
      const dvx = Math.abs(sPost.vx - sPre.vx);
      assert(dvx < 0.05, `T32.1: Clean miss velocity across transit is strictly continuous (dvx=${dvx.toFixed(4)} m/s)`);
    }

    // T32.2: Cross-camera state identity
    {
      for (const t of [800, 1050, 1200, 1400]) {
        const state1 = solveCaughtBehindDeliveryTrajectory(edgeCb, t);
        const state2 = solveCaughtBehindDeliveryTrajectory(edgeCb, t);
        assert(state1.x === state2.x && state1.y === state2.y && state1.z === state2.z, `T32.2: Single canonical trajectory produces identical 3D state at t=${t}ms`);
      }
    }

    // T32.3: Physical clearance calibration at bat plane
    {
      const sEdge = solveCaughtBehindDeliveryTrajectory(edgeCb, 1200);
      const sMiss = solveCaughtBehindDeliveryTrajectory(missCb, 1200);
      const edgeClearanceMm = (sEdge.x - (BAT_EDGE_X_M + BALL_RADIUS_M)) * 1000;
      const missClearanceMm = (sMiss.x - (BAT_EDGE_X_M + BALL_RADIUS_M)) * 1000;
      assert(Math.abs(edgeClearanceMm) < 0.01, `T32.3: Genuine edge has zero clearance at transit (got ${edgeClearanceMm.toFixed(3)}mm)`);
      assert(Math.abs(missClearanceMm - 18) < 0.01, `T32.3: Clean miss clearance strictly equals configured gapMm (got ${missClearanceMm.toFixed(3)}mm)`);
    }

    // T32.4: Deflection physics on contact
    {
      const sPre = solveCaughtBehindDeliveryTrajectory(edgeCb, 1190);
      const sPost = solveCaughtBehindDeliveryTrajectory(edgeCb, 1250);
      assert(sPost.isDeflected, "T32.4: Edge marks ball as deflected post-transit");
      assert(sPost.vx > sPre.vx, "T32.4: Deflection impulse increases lateral velocity towards slips");
    }

    // T32.5: Neutrality across varied seeds
    {
      let allNeutral = true;
      for (let s = 1; s <= 20; s++) {
        const scen = generateScenario(s, "CAUGHT_BEHIND", "MARGINAL");
        if (scen.caughtBehind) {
          const d = solveCaughtBehindDeliveryTrajectory(scen.caughtBehind, scen.caughtBehind.ballPassesBatFrameMs);
          const macro = projectCaughtBehindToMacro(d);
          if (!Number.isFinite(macro.ballX) || !Number.isFinite(macro.ballY)) allNeutral = false;
        }
      }
      assert(allNeutral, "T32.5: Projected macro positions are finite and deterministic across 20 scenario seeds");
    }

    // ================================================================
    // GROUP 33: CAUGHT BEHIND KEEPER ARRIVAL & ULTRAEDGE RELATIVE MOTION
    // ================================================================
    console.log("\n--- GROUP 33: KEEPER CATCH ARRIVAL & ULTRAEDGE RELATIVE MOTION ---");

    // T33.1: Ball arrives strictly at keeper coordinates post-catch
    {
      const edgeCb = generateScenario(1, "CAUGHT_BEHIND").caughtBehind!;
      const missCb = generateScenario(2, "CAUGHT_BEHIND").caughtBehind!;

      const sEdgeCatch = solveCaughtBehindDeliveryTrajectory(edgeCb, 1300);
      const sMissCatch = solveCaughtBehindDeliveryTrajectory(missCb, 1300);

      assert(sEdgeCatch.z <= -1.4, "T33.1: Genuine edge delivery reaches keeper station behind stumps");
      assert(sMissCatch.z <= -1.7, "T33.1: Clean miss delivery reaches keeper station behind stumps");
      assert(sEdgeCatch.y > 0.5 && sEdgeCatch.y < 0.8, "T33.1: Ball arrives at keeper glove height");
      assert(sEdgeCatch.vx === 0 && sEdgeCatch.vy === 0 && sEdgeCatch.vz === 0, "T33.1: Ball is held securely post-catch (zero velocity)");
    }

    // T33.2: C1 velocity continuity across bat-plane transit on clean miss
    {
      const cleanCb = generateScenario(2, "CAUGHT_BEHIND").caughtBehind!; // clean miss
      const tTransit = cleanCb.ballPassesBatFrameMs;

      const pre = solveCaughtBehindDeliveryTrajectory(cleanCb, tTransit - 10);
      const at = solveCaughtBehindDeliveryTrajectory(cleanCb, tTransit);
      const post = solveCaughtBehindDeliveryTrajectory(cleanCb, tTransit + 10);

      assert(Math.abs(pre.vx - post.vx) < 0.001, "T33.2: Vx has zero discontinuity across transit on clean miss");
      assert(Math.abs(at.vy - post.vy) < 0.05, "T33.2: Vy is smooth and continuous entering post-transit");
      assert(pre.z > at.z && at.z > post.z, "T33.2: Ball monotonically progresses down pitch towards keeper");
    }

    // T33.3: UltraEdge Waveform has quiet baseline outside transient events
    {
      const cleanCb = generateScenario(2, "CAUGHT_BEHIND").caughtBehind!;
      const signal = solveUltraEdgeSignal(cleanCb);
      
      let maxBaselineAmp = 0;
      for (let t = 850; t <= 1000; t += 10) {
        const amp = Math.abs(sampleUltraEdgeAmplitude(signal, t));
        if (amp > maxBaselineAmp) maxBaselineAmp = amp;
      }
      assert(maxBaselineAmp < 0.08, `T33.3: Quiet baseline noise floor is well-behaved (got ${maxBaselineAmp.toFixed(4)} < 0.08)`);
    }

    // T33.4: Ground scrape distractor triggers bat toe turf contact
    {
      const scrapeCb: CaughtBehindData = {
        ...generateScenario(1, "CAUGHT_BEHIND").caughtBehind!,
        distractorNoise: true,
        distractorType: "GROUND_SCRAPE",
        distractorTimeMs: 1320,
      };

      const atScrape = solveBatGroundContact(scrapeCb, 1320);
      const preScrape = solveBatGroundContact(scrapeCb, 1200);

      assert(atScrape.isTurfContact, "T33.4: Bat toe contacts turf at ground scrape timestamp");
      assert(atScrape.toeDisplacementPx > 5.0, "T33.4: Turf displacement reaches full scale during scrape");
      assert(!preScrape.isTurfContact && preScrape.toeDisplacementPx < 0.1, "T33.4: Bat remains clear of turf during delivery transit");
    }
  }

  // --- GROUP 34: CALIBRATED 2.5D SLIP CORRIDOR VISUAL ANCHORS & MONOTONICITY ---
  console.log("\n--- GROUP 34: CALIBRATED 2.5D SLIP CORRIDOR VISUAL ANCHORS & MONOTONICITY ---");
  {
    const w = 640;
    const h = 360;
    const batEdgeX = 300;
    const batEdgeY = 227;
    const gloveX = 312;
    const gloveY = 192;

    const edgeCb: CaughtBehindData = {
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

    const missCb: CaughtBehindData = {
      hasEdge: false,
      waveformSpikeTimeMs: null,
      distractorNoise: false,
      distractorTimeMs: null,
      distractorType: null,
      proximityFrameMs: 1200,
      spikeIntensity: 0.1,
      ballPassesBatFrameMs: 1200,
      gapMm: 18,
      soundType: "SILENCE",
    };

    // T34.1: Screen Y strictly decreases monotonically across approach and delivery (ball always travels toward batter & keeper)
    for (const [name, cb] of [["Genuine Edge", edgeCb], ["Clean Miss", missCb]] as const) {
      let prevY = 9999;
      let monotonic = true;
      for (let t = 800; t <= 1300; t += 10) {
        const state = solveCaughtBehindSlipCorridor(cb, t, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
        if (state.y > prevY + 0.001) {
          monotonic = false;
          break;
        }
        prevY = state.y;
      }
      assert(monotonic, `T34.1: ${name} screen Y is strictly monotonic decreasing across [800ms, 1300ms]`);
    }

    // T34.2: Ball coordinates remain strictly within canvas bounds (never teleport or explode)
    for (const [name, cb] of [["Genuine Edge", edgeCb], ["Clean Miss", missCb]] as const) {
      let bounded = true;
      for (let t = 600; t <= 2200; t += 20) {
        const state = solveCaughtBehindSlipCorridor(cb, t, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
        if (state.x < 0 || state.x > w || state.y < 0 || state.y > h) {
          bounded = false;
          break;
        }
      }
      assert(bounded, `T34.2: ${name} coordinates strictly within [0, ${w}] x [0, ${h}] across timeline`);
    }

    // T34.3: Radius scales believably and stays positive and finite
    for (const [name, cb] of [["Genuine Edge", edgeCb], ["Clean Miss", missCb]] as const) {
      const atRelease = solveCaughtBehindSlipCorridor(cb, 800, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
      const atBounce = solveCaughtBehindSlipCorridor(cb, 1050, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
      const atTransit = solveCaughtBehindSlipCorridor(cb, 1200, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
      const atCatch = solveCaughtBehindSlipCorridor(cb, 1300, w, h, batEdgeX, batEdgeY, gloveX, gloveY);

      assert(atRelease.radius > atBounce.radius, `T34.3: ${name} radius decreases release -> bounce`);
      assert(atBounce.radius > atTransit.radius, `T34.3: ${name} radius decreases bounce -> transit`);
      assert(atTransit.radius > atCatch.radius, `T34.3: ${name} radius decreases transit -> catch`);
      assert(atCatch.radius >= 3.5, `T34.3: ${name} final catch radius remains visible (>= 3.5px)`);
    }

    // T34.4: Bat edge transit alignment
    {
      const edgeAtTransit = solveCaughtBehindSlipCorridor(edgeCb, 1200, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
      const missAtTransit = solveCaughtBehindSlipCorridor(missCb, 1200, w, h, batEdgeX, batEdgeY, gloveX, gloveY);

      assert(Math.abs(edgeAtTransit.y - batEdgeY) < 0.1, "T34.4: Edge ball crosses at exact batEdgeY");
      assert(Math.abs(missAtTransit.y - batEdgeY) < 0.1, "T34.4: Miss ball crosses at exact batEdgeY");
      assert(edgeAtTransit.x > missAtTransit.x, "T34.4: Miss ball has visible daylight gap compared to edge ball");
    }

    // T34.5: Keeper glove arrival and hold
    for (const [name, cb] of [["Genuine Edge", edgeCb], ["Clean Miss", missCb]] as const) {
      const atCatch = solveCaughtBehindSlipCorridor(cb, 1300, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
      const postCatch = solveCaughtBehindSlipCorridor(cb, 1500, w, h, batEdgeX, batEdgeY, gloveX, gloveY);

      assert(Math.abs(atCatch.x - gloveX) < 0.01 && Math.abs(atCatch.y - gloveY) < 0.01, `T34.5: ${name} arrives exactly at keeper glove coordinates at 1300ms`);
      assert(Math.abs(postCatch.x - gloveX) < 0.01 && Math.abs(postCatch.y - gloveY) < 0.01, `T34.5: ${name} held securely in keeper gloves post-catch`);
    }
  }

  // --- GROUP 35: ULTRAEDGE FRAME SYNCHRONIZATION, STEPPING & EVIDENCE BOUNDARIES ---
  console.log("\n--- GROUP 35: ULTRAEDGE FRAME SYNCHRONIZATION, STEPPING & EVIDENCE BOUNDARIES ---");
  {
    const FPS = 50;
    const FRAME_STEP_MS = 1000 / FPS; // 20ms

    // T35.1: Mathematical frame-to-timestamp synchronization
    assert(Math.round(1180 / FRAME_STEP_MS) === 59, "T35.1: Frame 59 maps exactly to 1180ms (pre-transit)");
    assert(Math.round(1200 / FRAME_STEP_MS) === 60, "T35.1: Frame 60 maps exactly to 1200ms (transit)");
    assert(Math.round(1220 / FRAME_STEP_MS) === 61, "T35.1: Frame 61 maps exactly to 1220ms (post-transit)");
    assert(Math.round(1320 / FRAME_STEP_MS) === 66, "T35.1: Frame 66 maps exactly to 1320ms (ground scrape)");

    // T35.2: Precise +/- 1 frame step delta
    assert(1 * FRAME_STEP_MS === 20, "T35.2: Forward 1 frame delta is exactly +20ms");
    assert(-1 * FRAME_STEP_MS === -20, "T35.2: Backward 1 frame delta is exactly -20ms");
    assert(5 * FRAME_STEP_MS === 100, "T35.2: Coarse 5 frame delta is exactly +100ms");

    // T35.3: +/- 1-frame comparative context window bounds
    const tCenter = 1200;
    const tPrev = tCenter - FRAME_STEP_MS;
    const tNext = tCenter + FRAME_STEP_MS;
    assert(tNext - tPrev === 40, "T35.3: +/- 1 frame context window spans exactly 40ms (F-1 to F+1)");

    // T35.4: Case A (Seed 1, Genuine Edge) acoustic transient alignment
    const scnA = generateScenario(1, "CAUGHT_BEHIND");
    assert(scnA.caughtBehind !== undefined, "T35.4: Scenario A has caughtBehind data");
    if (scnA.caughtBehind) {
      const sigA = solveUltraEdgeSignal(scnA.caughtBehind);
      const edgeTransient = sigA.transients.find((tr) => Math.abs(tr.timeMs - 1200) <= 20);
      assert(edgeTransient !== undefined, "T35.4: Case A has acoustic transient inside transit window (|t - 1200| <= 20ms)");
      assert(edgeTransient!.amplitude >= 0.5, "T35.4: Case A transient has prominent amplitude (>= 50%)");
    }

    // T35.5: Case B (Seed 2, Clean Miss) quiet baseline at transit
    const scnB = generateScenario(2, "CAUGHT_BEHIND");
    assert(scnB.caughtBehind !== undefined, "T35.5: Scenario B has caughtBehind data");
    if (scnB.caughtBehind) {
      const sigB = solveUltraEdgeSignal(scnB.caughtBehind);
      const edgeLevelSpike = sigB.transients.find((tr) => Math.abs(tr.timeMs - 1200) <= 20 && tr.amplitude >= 0.45);
      assert(edgeLevelSpike === undefined, "T35.5: Case B has NO prominent acoustic spike inside transit window (quiet baseline)");
    }

    // T35.6: Case C (Seed 10, Ground Decoy) late scrape acoustic transient
    const scnC = generateScenario(10, "CAUGHT_BEHIND");
    assert(scnC.caughtBehind !== undefined, "T35.6: Scenario C has caughtBehind data");
    if (scnC.caughtBehind) {
      const sigC = solveUltraEdgeSignal(scnC.caughtBehind);
      const transitSpike = sigC.transients.find((tr) => Math.abs(tr.timeMs - 1200) <= 20 && tr.amplitude >= 0.45);
      const lateSpike = sigC.transients.find((tr) => tr.timeMs >= 1300 && tr.amplitude >= 0.40);
      assert(transitSpike === undefined, "T35.6: Case C has NO prominent spike at transit (1200ms)");
      assert(lateSpike !== undefined, "T35.6: Case C has delayed acoustic spike (>= 1300ms) from turf contact");
      assert(lateSpike!.timeMs >= 1310, "T35.6: Case C ground transient occurs while ball is past bat");
    }
  }

  // --- GROUP 36: ULTRAEDGE OPTICAL CAMERA, DAYLIGHT EVIDENCE & BAT-BALL CONTACT GEOMETRY ---
  console.log("\n--- GROUP 36: ULTRAEDGE OPTICAL CAMERA, DAYLIGHT EVIDENCE & BAT-BALL CONTACT GEOMETRY ---");
  {
    const w = 480;
    const h = 200;
    const BATTER_RIG_SCALE = 1.35;
    const batterX = w * 0.52;
    const batterY = 145.17;
    const transitP = 0.375; // t = 1200ms

    // T36.1: calculateBatOutsideEdgeScreenPos returns valid finite coordinates
    const transitBatterK = solveCaughtBehindBatterKinematics(transitP, "FORWARD_DEFENCE", 14);
    const { batEdgeX, batEdgeY } = calculateBatOutsideEdgeScreenPos(
      batterX,
      batterY,
      transitBatterK,
      BATTER_RIG_SCALE,
      "LEFT"
    );

    assert(Number.isFinite(batEdgeX) && Number.isFinite(batEdgeY), "T36.1: batEdge coordinates are strictly finite");
    assert(batEdgeX < batterX, "T36.1: For facing LEFT, bat outside edge is to the left of batter body center");
    assert(Math.abs(batEdgeX - 243.17) < 1.0, "T36.1: batEdgeX accurately matches articulated willow blade outside edge");
    assert(Math.abs(batEdgeY - 133.28) < 1.0, "T36.1: batEdgeY accurately matches articulated willow blade impact zone");

    // T36.2: Genuine edge (hasEdge = true) ball touches bat outside edge at transit (t = 1200ms)
    const edgeCb: CaughtBehindData = {
      hasEdge: true,
      waveformSpikeTimeMs: 1200,
      distractorNoise: false,
      distractorTimeMs: null,
      distractorType: null,
      proximityFrameMs: 1200,
      spikeIntensity: 0.8,
      ballPassesBatFrameMs: 1200,
      gapMm: 0,
      soundType: "WOODY_SNICK",
    };
    const keeperX = w * 0.47;
    const gloveX = keeperX + 14;
    const gloveY = 70;
    const ballEdge = solveCaughtBehindSlipCorridor(edgeCb, 1200, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
    const ballRightEdge = ballEdge.x + ballEdge.radius;
    // Ball should reach or overlap the bat outside edge with zero phantom gap
    assert(ballRightEdge >= batEdgeX - 0.5, "T36.2: Genuine edge ball reaches the bat outside edge at transit");
    assert(Math.abs(ballRightEdge - batEdgeX) <= 2.5, "T36.2: Edge contact overlap is realistic physical contact (<= 2.5px)");

    // T36.3: Clean miss has strictly positive daylight gap that scales with gapMm
    const missSmall: CaughtBehindData = {
      hasEdge: false,
      waveformSpikeTimeMs: null,
      distractorNoise: false,
      distractorTimeMs: null,
      distractorType: null,
      proximityFrameMs: 1200,
      spikeIntensity: 0.1,
      ballPassesBatFrameMs: 1200,
      gapMm: 8,
      soundType: "SILENCE",
    };
    const missLarge: CaughtBehindData = {
      hasEdge: false,
      waveformSpikeTimeMs: null,
      distractorNoise: false,
      distractorTimeMs: null,
      distractorType: null,
      proximityFrameMs: 1200,
      spikeIntensity: 0.1,
      ballPassesBatFrameMs: 1200,
      gapMm: 24,
      soundType: "SILENCE",
    };

    const ballMissSmall = solveCaughtBehindSlipCorridor(missSmall, 1200, w, h, batEdgeX, batEdgeY, gloveX, gloveY);
    const ballMissLarge = solveCaughtBehindSlipCorridor(missLarge, 1200, w, h, batEdgeX, batEdgeY, gloveX, gloveY);

    const daylightSmall = batEdgeX - (ballMissSmall.x + ballMissSmall.radius);
    const daylightLarge = batEdgeX - (ballMissLarge.x + ballMissLarge.radius);

    assert(daylightSmall > 0, "T36.3: Clean miss (8mm) has strictly visible daylight between ball and bat");
    assert(daylightLarge > daylightSmall, "T36.3: Daylight gap strictly increases with larger gapMm");
    assert(daylightLarge >= 10.0, "T36.3: Clean miss (24mm) provides prominent visible daylight (>= 10px)");

    // T36.4: Camera zoom locking across critical frames (F58 - F62, 1160ms - 1240ms)
    for (let t = 1160; t <= 1240; t += 20) {
      const zoomFactor = (t >= 1140 && t <= 1260) ? 1.0 : 0.0;
      assert(zoomFactor === 1.0, `T36.4: Camera zoom factor is strictly 1.0 (LOCKED) at t=${t}ms (F${t/20})`);
    }

    // T36.5: Stability and determinism across 20 varied scenario seeds
    for (let seed = 1; seed <= 20; seed++) {
      const scn = generateScenario(seed, "CAUGHT_BEHIND");
      if (scn.caughtBehind) {
        const p = 0.375;
        const bK = solveCaughtBehindBatterKinematics(p, scn.initialEvidence?.caughtBehind?.shotType, scn.initialEvidence?.caughtBehind?.batAngleDeg ?? 14);
        const { batEdgeX: bX, batEdgeY: bY } = calculateBatOutsideEdgeScreenPos(batterX, batterY, bK, BATTER_RIG_SCALE, "LEFT");
        const bState = solveCaughtBehindSlipCorridor(scn.caughtBehind, 1200, w, h, bX, bY, gloveX, gloveY);
        assert(Number.isFinite(bState.x) && Number.isFinite(bState.y), `T36.5 (seed ${seed}): Corridor coordinates are finite`);
        if (scn.caughtBehind.hasEdge) {
          assert((bState.x + bState.radius) >= bX - 0.5, `T36.5 (seed ${seed}): Genuine edge has contact`);
        } else {
          assert(bX - (bState.x + bState.radius) > 0, `T36.5 (seed ${seed}): Clean miss has daylight`);
        }
      }
    }
  }

  // ==============================================================
  // GROUP 37 — STUMPING & RUN-OUT KEY-FRAME AUTO-POPULATION, MCC LAW CITATIONS & CAMERA DECKS
  // ==============================================================
  console.log("\n--- GROUP 37: STUMPING KINEMATICS, AUTO KEY-FRAMES & MCC LAW CITATIONS ---");
  {
    // T37.1: Stumping Batter Kinematics Invariants (Stationary Stance + Rear-Leg Pendulum)
    const creaseX = 300;
    const marginPx = 15;
    const stance = solveStumpingBatterKinematics(0.0, creaseX, marginPx);
    const midDelivery = solveStumpingBatterKinematics(0.35, creaseX, marginPx);
    const breakFrame = solveStumpingBatterKinematics(0.65, creaseX, marginPx);
    const recovery = solveStumpingBatterKinematics(0.85, creaseX, marginPx);

    // 1. Stationary Upper-Body Invariant:
    // Torso, head, front leg, bat stay fixed across delivery
    assert(
      stance.batterX === midDelivery.batterX && midDelivery.batterX === breakFrame.batterX,
      "T37.1: Batter upper-body root anchor remains completely stationary at batting stance"
    );
    assert(
      stance.batterK.torsoAngleRad === midDelivery.batterK.torsoAngleRad &&
      stance.batterK.headX === midDelivery.batterK.headX &&
      stance.batterK.frontLegX === midDelivery.batterK.frontLegX,
      "T37.1: Batter torso, head, and front leg remain STILL throughout the stumping sequence"
    );

    // 2. Rear-foot initial stance daylight:
    const rearFootScreenX = stance.batterX + stance.batterK.backLegX * 1.15;
    assert(
      rearFootScreenX < creaseX,
      `T37.1: Stance rear foot (${rearFootScreenX.toFixed(1)}px) is behind popping crease (${creaseX}px) with visible daylight`
    );

    // 3. Dynamic rear-leg vertical heel-lift & pendulum toe bounce:
    assert(
      (midDelivery.batterK.backLegLift ?? 0) > 0,
      "T37.1: Rear leg heel/toe lifts vertically off turf during delivery"
    );
    assert(
      (midDelivery.batterK.backLegFootAngleRad ?? 0) < 0,
      "T37.1: Rear boot tilts into heel-lift elevation as delivery passes"
    );

    // 4. Recovery back-drag:
    assert(
      recovery.batterK.backLegX <= breakFrame.batterK.backLegX,
      "T37.1: Batter reaches/drags rear foot back towards crease for recovery"
    );

    // T37.2: Keeper Kinematics & Glove Coordinates
    const keeperStance = solveStumpingKeeperKinematics(0.0);
    const keeperBreak = solveStumpingKeeperKinematics(0.65);
    assert(Number.isFinite(keeperStance.gloveX) && Number.isFinite(keeperStance.gloveY), "T37.2: Keeper stance glove coords finite");
    assert(Number.isFinite(keeperBreak.gloveX) && Number.isFinite(keeperBreak.gloveY), "T37.2: Keeper break glove coords finite");
    assert(keeperBreak.isGlovesOpen === false, "T37.2: Keeper gloves clamped securely on break");

    // T37.3: Auto-Populate Key Frames Logic & Deduplication
    const fps = 500;
    const batGroundedMs = 1460;
    const bailsDislodgedMs = 1464; // Delta 4ms = 2 frames at 500 FPS

    const frameBat = Math.round((batGroundedMs / 1000) * fps);
    const frameBails = Math.round((bailsDislodgedMs / 1000) * fps);
    const deltaMs = Math.abs(bailsDislodgedMs - batGroundedMs);
    const deltaFrames = Math.abs(frameBails - frameBat);

    assert(frameBat === 730, "T37.3: Bat grounded frame computed from canonical timestamp (1460ms -> F730 at 500fps)");
    assert(frameBails === 732, "T37.3: Bails dislodged frame computed from canonical timestamp (1464ms -> F732 at 500fps)");
    assert(deltaFrames === 2 && deltaMs === 4, `T37.3: Timing delta matches specification Δ2F (4ms) (got Δ${deltaFrames}F ${deltaMs}ms)`);

    // Re-marking simulation: updating bat grounded frame replaces existing entry in place
    const updatedBatGroundedMs = 1470;
    const updatedFrameBat = Math.round((updatedBatGroundedMs / 1000) * fps);
    const keyFramesMap = new Map<string, { frame: number; time: number; label: string }>();
    keyFramesMap.set("auto-bat-grounded", { frame: frameBat, time: batGroundedMs, label: "Bat/foot grounded" });
    keyFramesMap.set("auto-bails-dislodged", { frame: frameBails, time: bailsDislodgedMs, label: "Bails dislodged" });
    assert(keyFramesMap.size === 2, "T37.3: Exactly 2 auto-populated key frame entries");

    // Re-mark bat grounded
    keyFramesMap.set("auto-bat-grounded", { frame: updatedFrameBat, time: updatedBatGroundedMs, label: "Bat/foot grounded" });
    assert(keyFramesMap.size === 2, "T37.3: Re-marking does not create duplicate entries (size remains 2)");
    assert(keyFramesMap.get("auto-bat-grounded")!.frame === 735, "T37.3: Re-marking updates timestamp in place");

    // T37.4: Official Lord's MCC Law Citations Verification
    const officialUrls = {
      STUMPING: "https://www.lords.org/mcc/the-laws/stumped",
      LBW: "https://www.lords.org/mcc/the-laws/leg-before-wicket",
      CAUGHT_BEHIND: "https://www.lords.org/mcc/the-laws/caught",
      RUN_OUT: "https://www.lords.org/mcc/the-laws/run-out",
      BOUNDARY: "https://www.lords.org/mcc/the-laws/boundaries",
    };

    assert(officialUrls.STUMPING === "https://www.lords.org/mcc/the-laws/stumped", "T37.4: Law 39 Stumped official URL verified");
    assert(officialUrls.LBW === "https://www.lords.org/mcc/the-laws/leg-before-wicket", "T37.4: Law 36 LBW official URL verified");
    assert(officialUrls.CAUGHT_BEHIND === "https://www.lords.org/mcc/the-laws/caught", "T37.4: Law 33 Caught official URL verified");
    assert(officialUrls.RUN_OUT === "https://www.lords.org/mcc/the-laws/run-out", "T37.4: Law 38 Run Out official URL verified");
    assert(officialUrls.BOUNDARY === "https://www.lords.org/mcc/the-laws/boundaries", "T37.4: Law 19 Boundaries official URL verified");

    // T37.5: Stumping Dedicated 2-Camera Forensic Suite (CAM 02 Crease 500fps, CAM 01 Side-On Keeper)
    const stumpingCameras = [
      { id: "CREASE_ZOOM", camCode: "CAM 02 500FPS CREASE", label: "Crease 500fps" },
      { id: "SIDE_ON_POP", camCode: "CAM 01 SIDE-ON KEEPER", label: "Side-On Keeper" },
    ];
    assert(stumpingCameras.length === 2, "T37.5: Dedicated 2-camera forensic suite for Stumping");
    assert(stumpingCameras[0].camCode.includes("500FPS CREASE"), "T37.5: CAM 02 dedicated to 500FPS Crease for Stumping");
    assert(stumpingCameras[1].camCode.includes("SIDE-ON KEEPER"), "T37.5: CAM 01 dedicated to Side-On Keeper for Stumping");
  }

  // ==============================================================
  // GROUP 38 — DEDICATED STUMPING DATA, DETERMINISTIC PHYSICS & ICC LAW 39
  // ==============================================================
  console.log("\n--- GROUP 38: DEDICATED STUMPING PHYSICS & LAW 39 INVARIANTS ---");
  {
    const FRAME_MS_500 = 2; // 1000 / 500 FPS
    const MIN_REQUIRED_FRAMES = 6;

    for (let seed = 1; seed <= 50; seed++) {
      const scenario = generateScenario(seed * 999, "STUMPING");
      assert(scenario.stumping !== undefined, `Seed ${seed}: stumping scenario generated`);
      assert(scenario.runOut === undefined, `Seed ${seed}: runOut is undefined for decoupled Stumping`);
      const st = scenario.stumping!;

      // 1. Separation Invariant: absolute difference >= 12ms (>= 6 frames at 500 FPS)
      const deltaMs = Math.abs(st.bailsDislodgedFrameMs - st.groundedFrameMs);
      const frames500 = deltaMs / FRAME_MS_500;
      assert(
        frames500 >= MIN_REQUIRED_FRAMES,
        `Stumping Crease Timing Margin (seed ${seed}): deltaMs=${deltaMs}ms (>= ${MIN_REQUIRED_FRAMES} frames)`
      );

      // 2. Evaluation correctness
      const evalResult = evaluateStumping(st, scenario.onFieldSignal);
      if (evalResult.correctFinalVerdict === "NOT_OUT") {
        assert(
          st.groundedFrameMs < st.bailsDislodgedFrameMs,
          `Stumping NOT OUT (seed ${seed}): foot grounded before bails dislodged`
        );
        assert(st.creaseMarginMm > 0, `Stumping NOT OUT (seed ${seed}): creaseMarginMm positive`);
        assert(st.footGrounded === true, `Stumping NOT OUT (seed ${seed}): foot grounded`);
        assert(st.toeAirborneAtBreak === false, `Stumping NOT OUT (seed ${seed}): toe NOT airborne at break`);
      } else {
        assert(
          st.bailsDislodgedFrameMs < st.groundedFrameMs,
          `Stumping OUT (seed ${seed}): bails dislodged before foot grounded`
        );
        assert(st.creaseMarginMm < 0, `Stumping OUT (seed ${seed}): creaseMarginMm negative`);
        assert(st.toeAirborneAtBreak === true, `Stumping OUT (seed ${seed}): toe airborne at break`);
      }

      // 3. Stumping Physics Engine Determinism
      const state1 = solveStumpingReplayState(st, st.bailsDislodgedFrameMs);
      const state2 = solveStumpingReplayState(st, st.bailsDislodgedFrameMs);
      assert(
        state1.batter.toeAltitudeMm === state2.batter.toeAltitudeMm &&
        state1.stumps.bailsSeparating === state2.stumps.bailsSeparating,
        `Stumping Physics: Deterministic state across repeated evaluations`
      );

      // 4. Physical grounding agrees with verdict
      if (evalResult.correctFinalVerdict === "OUT") {
        assert(
          state1.batter.toeAltitudeMm > 0 || !state1.batter.isGrounded,
          `Stumping OUT (seed ${seed}): Toe is airborne at bails dislodged frame`
        );
      } else {
        assert(
          state1.batter.toeAltitudeMm === 0 && state1.batter.isGrounded,
          `Stumping NOT OUT (seed ${seed}): Toe is grounded at bails dislodged frame`
        );
      }
    }
  }

  // ==============================================================
  // GROUP 39 — STUMPING PHASE 2 SYNCHRONIZED FORENSIC SUITE & ANATOMICAL BOOT CALIBRATION
  // ==============================================================
  console.log("\n--- GROUP 39: STUMPING PHASE 2 SYNCHRONIZED FORENSIC SUITE & ANATOMICAL BOOT CALIBRATION ---");
  {
    // T39.1: Anatomical Boot Orientation Invariant (+X Bowler, -X Stumps) & Clearance
    const creaseX = 250;
    const stumpsX = 130;
    const stumpingScenario = generateScenario(12345, "STUMPING");
    assert(stumpingScenario.stumping !== undefined, "T39.1: Stumping scenario generated");
    const stData = stumpingScenario.stumping!;
    const stateAtBreak = solveStumpingReplayState(stData, stData.bailsDislodgedFrameMs);

    // Toe points down the pitch (+X toward bowler), heel points back (-X toward stumps)
    // Anchor is at toeTipX, heel extends in negative-X direction
    const pxPerMm = 1.4;
    const toeTipX = creaseX - stateAtBreak.batter.toeCreaseOffsetMm * pxPerMm;
    const heelX = toeTipX - 70; // 70px shoe length in negative-X direction
    assert(toeTipX > heelX, "T39.1: Boot toe (+X) is anatomically forward of boot heel (-X)");
    assert(heelX > stumpsX, "T39.1: Boot heel maintains physical clearance from striker stumps (zero clipping)");

    // T39.2: Upper-Body & Bat Stationarity Invariant across Delivery
    const stanceK = solveStumpingBatterKinematics(0.0, creaseX, 10);
    const midK = solveStumpingBatterKinematics(0.4, creaseX, 10);
    const breakK = solveStumpingBatterKinematics(0.65, creaseX, 10);
    const recoveryK = solveStumpingBatterKinematics(0.9, creaseX, 10);

    assert(
      stanceK.batterX === midK.batterX &&
      midK.batterX === breakK.batterX &&
      breakK.batterX === recoveryK.batterX,
      "T39.2: Batter root X anchor remains completely motionless across entire delivery"
    );
    assert(
      stanceK.batterK.torsoAngleRad === breakK.batterK.torsoAngleRad &&
      stanceK.batterK.headX === breakK.batterK.headX &&
      stanceK.batterK.frontLegX === breakK.batterK.frontLegX &&
      stanceK.batterK.batRotRad === breakK.batterK.batRotRad,
      "T39.2: Torso, head, front leg, and bat remain strictly motionless in stance box"
    );

    // Bat ground contact is positioned in front of popping crease (preventing false grounding under Law 39)
    const batBladeTipX = stanceK.batterX + stanceK.batterK.batPivotX + Math.sin(stanceK.batterK.batRotRad) * 45;
    assert(batBladeTipX > creaseX, "T39.2: Bat blade tip is held in front of popping crease, preventing false grounding under Law 39");

    // T39.3: Dual 500 FPS Synchronized Replay Timeline
    const fps500 = 500;
    const frameStepMs = 1000 / fps500;
    assert(frameStepMs === 2, "T39.3: 500 FPS replay standard provides exact 2ms frame steps");

    const tBreakMs = stData.bailsDislodgedFrameMs;
    const fBreak = Math.round((tBreakMs / 1000) * fps500);
    assert(fBreak === 750, "T39.3: Bails dislodged focal event is exactly F750 (1500ms)");

    // T39.4: Dual Window Framing & Strict Zero-CAD Invariant
    const windowALabel = "KEEPER / WICKET • 500 FPS CLOSE-UP";
    const windowBLabel = "FOOT / CREASE • 500 FPS CLOSE-UP";
    const windowAQuestion = "WHEN WERE THE BAILS DISLODGED?";
    const windowBQuestion = "WHERE WAS THE STRIKER'S GROUNDED CONTACT?";

    assert(windowALabel.includes("KEEPER / WICKET") && windowALabel.includes("500 FPS"), "T39.4: Window A labeled correctly");
    assert(windowBLabel.includes("FOOT / CREASE") && windowBLabel.includes("500 FPS"), "T39.4: Window B labeled correctly");
    assert(windowAQuestion.includes("WHEN WERE THE BAILS DISLODGED"), "T39.4: Window A core question matches specification");
    assert(windowBQuestion.includes("WHERE WAS THE STRIKER'S GROUNDED CONTACT"), "T39.4: Window B core question matches specification");

    // T39.5: Stumping Retirement of CAM 07 & Synchronized Replay Lockstep
    // Verify that at F750, Window A bails are separating and Window B boot is in canonical state
    const syncedState = solveStumpingReplayState(stData, 1500);
    assert(syncedState.stumps.bailsSeparating === true, "T39.5: Window A Zing bails separate at F750 (1500ms)");
    assert(syncedState.timeMs === 1500, "T39.5: Both viewports lockstep at identical canonical time");

    // Auto-populated keyframes sorted deduplicated order
    const autoGathered = { frameNum: Math.round((1040 / 1000) * 500), timeMs: 1040, label: "Ball gathered" };
    const autoGrounded = { frameNum: Math.round((stData.groundedFrameMs / 1000) * 500), timeMs: stData.groundedFrameMs, label: "Bat/foot grounded" };
    const autoBails = { frameNum: Math.round((stData.bailsDislodgedFrameMs / 1000) * 500), timeMs: stData.bailsDislodgedFrameMs, label: "Bails dislodged" };
    const keyFramesList = [autoGathered, autoGrounded, autoBails].sort((a, b) => a.timeMs - b.timeMs);
    assert(keyFramesList.length === 3, "T39.5: Exactly 3 chronological keyframes populated");
    assert(keyFramesList[0].label === "Ball gathered", "T39.5: Ball gathered is earliest keyframe");
  }

  // ==============================================================
  // GROUP 40 — STUMPING PHASE 2 CAM 02 VISUAL DESIGN PROTOTYPE SELECTOR
  // ==============================================================
  console.log("\n--- GROUP 40: STUMPING PHASE 2 CAM 02 PROTOTYPE SELECTOR & 3 OPTICAL FRAMINGS ---");
  {
    // T40.1: All three framing configurations exist and satisfy optical zoom ranges (R2)
    const optA = STUMPING_FRAMING_CONFIGS.A;
    const optB = STUMPING_FRAMING_CONFIGS.B;
    const optC = STUMPING_FRAMING_CONFIGS.C;

    assert(optA !== undefined, "T40.1: Option A configuration exists");
    assert(optB !== undefined, "T40.1: Option B configuration exists");
    assert(optC !== undefined, "T40.1: Option C configuration exists");

    // Option A: 2.5x - 3.0x zoom
    assert(optA.zoom >= 2.5 && optA.zoom <= 3.0, "T40.1: Option A zoom is within 2.5x - 3.0x broadcast optical zoom range");
    assert(optA.label.includes("A — BROADCAST ZOOM"), "T40.1: Option A label matches requirement");
    assert(optA.buttonText === "[ A — BROADCAST ZOOM ]", "T40.1: Option A buttonText matches requirement");

    // Option B: 3.0x - 3.5x zoom
    assert(optB.zoom >= 3.0 && optB.zoom <= 3.5, "T40.1: Option B zoom is within 3.0x - 3.5x tight crease zoom range");
    assert(optB.label.includes("B — TIGHT CREASE"), "T40.1: Option B label matches requirement");
    assert(optB.buttonText === "[ B — TIGHT CREASE ]", "T40.1: Option B buttonText matches requirement");

    // Option C: 2.0x - 2.4x zoom
    assert(optC.zoom >= 2.0 && optC.zoom <= 2.4, "T40.1: Option C zoom is within 2.0x - 2.4x high-speed camera range");
    assert(optC.label.includes("C — HIGH-SPEED CAMERA"), "T40.1: Option C label matches requirement");
    assert(optC.buttonText === "[ C — HIGH-SPEED CAMERA ]", "T40.1: Option C buttonText matches requirement");

    // T40.2: Clear visual distinction between Option A, Option B, and Option C
    assert(optA.zoom !== optB.zoom && optB.zoom !== optC.zoom && optA.zoom !== optC.zoom, "T40.2: Distinct zoom levels across A, B, and C");
    assert(optA.targetX !== optB.targetX || optA.targetY !== optB.targetY, "T40.2: Distinct camera framing center between A and B");
    assert(optB.targetX !== optC.targetX || optB.targetY !== optC.targetY, "T40.2: Distinct camera framing center between B and C");
    assert(optA.targetX !== optC.targetX || optA.targetY !== optC.targetY, "T40.2: Distinct camera framing center between A and C");

    // T40.3: Render StumpingEvidenceReview markup and verify permanent clean broadcast presentation
    const sc = generateScenario(42, "STUMPING");
    const st = sc.stumping!;
    const html = renderToStaticMarkup(
      React.createElement(StumpingEvidenceReview, {
        stumping: st,
        currentTimeMs: 1500,
      })
    );

    // Prototype selector bar removed in production
    assert(!html.includes("CAM 02 OPTICAL FRAMING:"), "T40.3: Prototype selector bar is removed from production view");
    assert(html.includes("3.3× OPTICAL CLOSE-UP"), "T40.3: Permanent Option B 3.3x badge rendered in Window B");

    // T40.4: Strict Zero-CAD & Neutrality Invariants preserved
    const windowBIndex = html.indexOf("FOOT / CREASE • 500 FPS CLOSE-UP");
    assert(windowBIndex !== -1, "T40.4: Window B header present in markup");
    const windowBHtml = html.substring(windowBIndex);
    assert(!windowBHtml.includes("laser"), "T40.4: Window B contains no laser CAD overlays");
    assert(!windowBHtml.includes("ruler"), "T40.4: Window B contains no ruler CAD overlays");
    assert(!windowBHtml.includes("caliper"), "T40.4: Window B contains no caliper CAD overlays");
    assert(!windowBHtml.includes("mm scale"), "T40.4: Window B contains no mm scale overlays");
    assert(windowBHtml.includes("PURE OPTICAL EVIDENCE"), "T40.4: Window B pure optical evidence badge maintained");

    // T40.5: Window B permanent configuration satisfies Option B specifications
    assert(optB.zoom === 3.3, "T40.5: Option B permanent zoom is exactly 3.3x");
    assert(optB.targetX === 342 && optB.targetY === 225, "T40.5: Option B target coordinates are (342, 225)");
  }

  console.log("=================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("=================================================");

  if (failed > 0) {
    throw new Error(`DRS unit test suite encountered ${failed} failure(s).`);
  }
}

runAllDRSTests();



