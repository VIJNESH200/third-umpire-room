import type {
  IncidentType,
  DifficultyTier,
  OnFieldSignal,
  Scenario,
  LBWData,
  RunOutData,
  CaughtBehindData,
  BoundaryData,
  BoundaryArchetype,
  PitchingZone,
  ImpactZone,
  ProjectedStumpHit,
  FirstContactType,
  MatchContext,
  ScenarioInitialEvidence,
  LBWInitialEvidence,
  CaughtBehindInitialEvidence,
  RunOutInitialEvidence,
  BoundaryInitialEvidence,
} from "../types/scenario";
import {
  evaluateDRSLBW,
  evaluateRunOut,
  evaluateCaughtBehind,
  evaluateBoundary,
} from "./drsRules";
import { MATCH_POOLS, generateDynamicMatchSituation } from "../data/matchContextPool";

// Deterministic pseudo-random generator with seed support
export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  rangeInt(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(items: T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  boolean(trueProbability: number = 0.5): boolean {
    return this.next() < trueProbability;
  }
}

/**
 * Generates a complete, verified Scenario object with both ground-truth telemetry and Phase 1 initial evidence.
 */
export function generateScenario(
  seed: number = Math.floor(Math.random() * 1000000),
  forcedType?: IncidentType,
  forcedTier?: DifficultyTier
): Scenario {
  const rng = new SeededRandom(seed);

  // 1. Determine Difficulty Tier
  let difficultyTier: DifficultyTier = forcedTier || "MARGINAL";
  if (!forcedTier) {
    const roll = rng.next();
    if (roll < 0.35) {
      difficultyTier = "CLEAR";
    } else if (roll < 0.85) {
      difficultyTier = "MARGINAL";
    } else {
      difficultyTier = "HOWLER";
    }
  }

  // 2. Determine Incident Type
  const types: IncidentType[] = ["LBW", "RUN_OUT", "STUMPING", "CAUGHT_BEHIND", "BOUNDARY"];
  const incidentType: IncidentType = forcedType || rng.pick(types);

  // 3. Match Context with Strict Format Rules
  const pool = rng.pick(MATCH_POOLS);
  const batterObj = rng.pick(pool.batters);
  const bowlerObj = rng.pick(pool.bowlers);

  let over: number;
  let bowlerMaxOvers: number;
  let rpo: number;

  if (pool.matchFormat === "T20") {
    // T20: Maximum 20 overs (active over is 0 to 19). Typically 5 to 19.
    over = rng.rangeInt(5, 19);
    bowlerMaxOvers = 4;
    rpo = rng.range(7.2, 10.2);
  } else if (pool.matchFormat === "ODI") {
    // ODI: Maximum 50 overs (active over is 0 to 49). Typically 14 to 49.
    over = rng.rangeInt(14, 49);
    bowlerMaxOvers = 10;
    rpo = rng.range(4.8, 6.6);
  } else {
    // TEST: Multi-day match, overs can exceed 50 (e.g. 24 to 88).
    over = rng.rangeInt(24, 88);
    bowlerMaxOvers = 28;
    rpo = rng.range(2.8, 3.8);
  }

  const ballInOver = rng.rangeInt(1, 6);

  // Plausible format-aware team score
  const totalRuns = Math.max(over * 3, Math.round(over * rpo) + rng.rangeInt(-8, 14));
  const maxWicketsForOver = pool.matchFormat === "T20" 
    ? Math.min(8, Math.max(2, Math.floor(over / 2.5)))
    : pool.matchFormat === "ODI"
    ? Math.min(8, Math.max(2, Math.floor(over / 6.0)))
    : Math.min(8, Math.max(2, Math.floor(over / 11.0)));
  const totalWickets = rng.rangeInt(1, maxWicketsForOver);

  // Plausible format-aware bowler figures
  const bowlerWickets = rng.rangeInt(0, Math.min(3, totalWickets));
  const maxPossibleBowlerOvers = Math.min(bowlerMaxOvers, Math.max(1, Math.floor(over / 4.0)));
  const bowlerCompletedOvers = rng.rangeInt(Math.max(1, maxPossibleBowlerOvers - 2), maxPossibleBowlerOvers);
  const bowlerRuns = Math.max(4, Math.round(bowlerCompletedOvers * (rpo + rng.range(-0.8, 1.2))));
  const bowlerOverStr = bowlerCompletedOvers >= bowlerMaxOvers 
    ? `${bowlerMaxOvers}.0` 
    : `${Math.max(0, bowlerCompletedOvers - 1)}.${ballInOver}`;
  const bowlerFigures = `${bowlerWickets}/${bowlerRuns} (${bowlerOverStr})`;

  const matchSituation = generateDynamicMatchSituation(
    incidentType,
    batterObj.name,
    bowlerObj.name,
    pool.battingTeam,
    pool.bowlingTeam,
    over,
    ballInOver,
    bowlerObj.type === "SPIN"
  );

  const matchContext: MatchContext = {
    over,
    ballInOver,
    battingTeamScore: `${totalRuns}/${totalWickets}`,
    battingTeam: pool.battingTeam,
    bowlingTeam: pool.bowlingTeam,
    batter: batterObj.name,
    batterScore: batterObj.score,
    bowler: bowlerObj.name,
    bowlerFigures,
    appealType: incidentType === "LBW" ? "LBW (DRS Review)" :
                incidentType === "CAUGHT_BEHIND" ? "Caught Behind (DRS Review)" :
                incidentType === "RUN_OUT" ? "Run Out (Direct Referral)" :
                incidentType === "STUMPING" ? "Stumping (Direct Referral)" : "Boundary Cushion Touch Check",
    onFieldSignal: "REFERRED",
    matchFormat: pool.matchFormat,
    tournament: pool.tournament,
    matchSituation,
  };

  let lbwData: LBWData | undefined;
  let runOutData: RunOutData | undefined;
  let caughtBehindData: CaughtBehindData | undefined;
  let boundaryData: BoundaryData | undefined;

  let lbwEvidence: LBWInitialEvidence | undefined;
  let runOutEvidence: RunOutInitialEvidence | undefined;
  let caughtBehindEvidence: CaughtBehindInitialEvidence | undefined;
  let boundaryEvidence: BoundaryInitialEvidence | undefined;

  let onFieldSignal: OnFieldSignal = "NOT_OUT";
  let incidentTitle = "";
  let description = "";

  // 4. Generate Specific Telemetry per Incident Type
  if (incidentType === "LBW") {
    let isNoBall = false;
    let frontFootOverstepMm = 0;
    let batContactBeforePad = false;
    let firstContactType: FirstContactType = "PAD_FIRST";
    let ultraEdgeSpikeAtBatFrame = false;

    let pitchingZone: PitchingZone = "IN_LINE";
    let impactZone: ImpactZone = "IN_LINE";
    let projectedStumpHit: ProjectedStumpHit = "CLEARLY_HITTING";
    let shotOffered = true;

    if (difficultyTier === "CLEAR") {
      const outcome = rng.pick(["DEAD_PLUM", "PITCH_OUTSIDE_LEG", "IMPACT_OUTSIDE_SHOT", "MASSIVE_MISS", "NO_BALL", "BAT_FIRST"]);
      if (outcome === "DEAD_PLUM") {
        pitchingZone = "IN_LINE";
        impactZone = "IN_LINE";
        projectedStumpHit = "CLEARLY_HITTING";
        onFieldSignal = "OUT";
      } else if (outcome === "NO_BALL") {
        isNoBall = true;
        frontFootOverstepMm = rng.rangeInt(15, 38);
        onFieldSignal = "OUT";
      } else if (outcome === "BAT_FIRST") {
        batContactBeforePad = true;
        firstContactType = "BAT_FIRST";
        ultraEdgeSpikeAtBatFrame = true;
        onFieldSignal = "OUT";
      } else if (outcome === "PITCH_OUTSIDE_LEG") {
        pitchingZone = "OUTSIDE_LEG";
        impactZone = "IN_LINE";
        projectedStumpHit = "CLEARLY_HITTING";
        onFieldSignal = "OUT";
      } else if (outcome === "IMPACT_OUTSIDE_SHOT") {
        pitchingZone = "IN_LINE";
        impactZone = "OUTSIDE_LINE_PLAYING_SHOT";
        shotOffered = true;
        projectedStumpHit = "CLEARLY_HITTING";
        onFieldSignal = "NOT_OUT";
      } else {
        pitchingZone = "IN_LINE";
        impactZone = "IN_LINE";
        projectedStumpHit = "MISSING";
        onFieldSignal = "NOT_OUT";
      }
    } else if (difficultyTier === "MARGINAL") {
      pitchingZone = rng.pick(["IN_LINE", "OUTSIDE_OFF"]);
      const isOutsideNoShot = rng.boolean(0.2);
      if (isOutsideNoShot) {
        impactZone = "OUTSIDE_LINE_NO_SHOT";
        shotOffered = false;
      } else {
        impactZone = "IN_LINE";
        shotOffered = true;
      }
      projectedStumpHit = "UMPIRES_CALL";
      onFieldSignal = rng.boolean(0.5) ? "OUT" : "NOT_OUT";
    } else {
      // HOWLER
      const isHowlerOut = rng.boolean(0.5);
      if (isHowlerOut) {
        onFieldSignal = "OUT";
        if (rng.boolean(0.4)) {
          isNoBall = true;
          frontFootOverstepMm = 28;
        } else {
          pitchingZone = rng.pick(["IN_LINE", "OUTSIDE_OFF"]);
          impactZone = "IN_LINE";
          projectedStumpHit = "MISSING";
        }
      } else {
        onFieldSignal = "NOT_OUT";
        pitchingZone = "IN_LINE";
        impactZone = "IN_LINE";
        projectedStumpHit = "CLEARLY_HITTING";
      }
    }

    const ballSpeedKph = rng.rangeInt(128, 148);
    const spinOrPace = bowlerObj.type;

    const isRightHand = batterObj.hand === "RIGHT";
    const offSign = isRightHand ? 1 : -1;
    const legSign = -offSign;

    let stumpHitX = 0;
    let stumpHitHeightCm = 45;

    if (projectedStumpHit === "CLEARLY_HITTING") {
      stumpHitX = rng.range(-0.08, 0.08);
      stumpHitHeightCm = rng.range(28, 62);
    } else if (projectedStumpHit === "UMPIRES_CALL") {
      const isHeightClipping = rng.boolean(0.4);
      if (isHeightClipping) {
        stumpHitX = rng.range(-0.07, 0.07);
        stumpHitHeightCm = rng.range(70.5, 72.8);
      } else {
        const side = rng.boolean(0.5) ? offSign : legSign;
        stumpHitX = side * rng.range(0.095, 0.13);
        stumpHitHeightCm = rng.range(35, 60);
      }
    } else {
      // MISSING
      const isGoingOver = rng.boolean(0.6);
      if (isGoingOver) {
        stumpHitX = rng.range(-0.07, 0.07);
        stumpHitHeightCm = rng.range(77, 92);
      } else {
        const side = rng.boolean(0.5) ? offSign : legSign;
        stumpHitX = side * rng.range(0.22, 0.42);
        stumpHitHeightCm = rng.range(30, 60);
      }
    }

    // Generate pitching point consistent with pitchingZone
    let pitchX = 0;
    if (pitchingZone === "IN_LINE") {
      pitchX = rng.range(-0.08, 0.08);
    } else if (pitchingZone === "OUTSIDE_OFF") {
      pitchX = offSign * rng.range(0.18, 0.35);
    } else {
      // OUTSIDE_LEG
      pitchX = legSign * rng.range(0.18, 0.35);
    }

    // Canonical LBW timetable: Release 800ms -> Bounce 1200ms -> Impact 1500ms -> Stumps 1680ms
    const uImpact = (1500 - 1200) / (1680 - 1200); // 0.625
    const impactDistance = 2.44;

    // If impactZone is outside line: ensure impactX lands outside off stump
    if (impactZone !== "IN_LINE") {
      const targetImpactX = offSign * rng.range(0.18, 0.32);
      pitchX = (targetImpactX - stumpHitX * uImpact) / (1 - uImpact);
      pitchX = Math.max(-0.6, Math.min(0.6, pitchX));
    }

    // Authoritative collinear post-bounce trajectory:
    // From bounce (Z = 6.5m) to striker stumps (Z = 0.0m)
    const impactX = (1 - uImpact) * pitchX + uImpact * stumpHitX;

    // Continuous parabolic height along post-bounce flight at impact distance
    const yStumpM = Math.max(0.15, Math.min(0.95, stumpHitHeightCm / 100));
    const yApex = Math.max(0.68, yStumpM + 0.18);
    const u1 = 1 - uImpact;
    const impactHeightM = u1 * u1 * 0.036 + 2 * u1 * uImpact * yApex + uImpact * uImpact * yStumpM;
    const impactHeight = Math.round(impactHeightM * 100);

    const trajectory = [
      { x: pitchX * 0.4, y: 0, z: 1.8 },
      { x: pitchX * 0.7, y: 10, z: 0.6 },
      { x: pitchX, y: 15.5, z: 0.05 },
      { x: impactX, y: 18.2, z: impactHeightM },
      { x: stumpHitX, y: 20.12, z: stumpHitHeightCm / 100 },
    ];

    lbwData = {
      isNoBall,
      frontFootOverstepMm,
      batContactBeforePad,
      firstContactType,
      ultraEdgeSpikeAtBatFrame,
      pitchingZone,
      impactZone,
      impactHeight,
      projectedStumpHit,
      impactDistance,
      batterHand: batterObj.hand,
      shotOffered,
      spinOrPace,
      ballSpeedKph,
      pitchX,
      impactX,
      stumpHitX,
      stumpHitHeightCm,
      hawkeyeTrajectory: trajectory,
    };

    // Phase 1 Initial Evidence Synthesis
    lbwEvidence = {
      deliveryLine: rng.pick(["OVER_WICKET", "ROUND_WICKET", "WIDE_OF_CREASE"]),
      apparentPitchLine: pitchingZone,
      apparentImpactLine: impactZone === "IN_LINE" ? "IN_LINE" : "OUTSIDE_OFF",
      apparentHeight: stumpHitHeightCm < 40 ? "LOW_SHIN" : stumpHitHeightCm <= 66 ? "KNEE_ROLL" : "HIGH_THIGH",
      apparentStumpThreat: projectedStumpHit === "CLEARLY_HITTING" ? "HEADING_STUMPS" :
                           projectedStumpHit === "UMPIRES_CALL" ? "TRIMMING_BAILS" :
                           stumpHitX > 0.3 ? "SLIDING_DOWN_LEG" : "MISSING_OFF",
      shotOfferedType: !shotOffered ? "PADDED_AWAY_NO_SHOT" :
                       impactZone === "OUTSIDE_LINE_PLAYING_SHOT" ? "DRIVE_ATTEMPT" : "DEFENSIVE_FORWARD",
      batPadSeparationMm: batContactBeforePad ? rng.rangeInt(0, 10) : rng.rangeInt(50, 110),
      batterStanceShiftX: Math.round(impactX * 40),
      visualAmbiguityScore: difficultyTier === "CLEAR" ? 0.15 : difficultyTier === "MARGINAL" ? 0.82 : 0.45,
    };

    incidentTitle = `LBW Review — ${bowlerObj.name} to ${batterObj.name}`;
    description = `Appeal for LBW against ${batterObj.name} off the bowling of ${bowlerObj.name} (${ballSpeedKph} km/h). Review initiated.`;
  } else if (incidentType === "RUN_OUT" || incidentType === "STUMPING") {
    let marginMs = 0;
    let batBounced = false;
    let batGrounded = true;

    if (difficultyTier === "CLEAR") {
      const isOut = rng.boolean(0.5);
      marginMs = isOut ? rng.rangeInt(60, 110) : rng.rangeInt(-110, -60);
      onFieldSignal = "REFERRED";
    } else if (difficultyTier === "MARGINAL") {
      const hasBounce = rng.boolean(0.3);
      if (hasBounce) {
        batBounced = true;
        batGrounded = false;
        // Airborne bat bounce: bail dislodgement occurs while bat is airborne above turf
        marginMs = rng.rangeInt(18, 45);
      } else {
        // Enforce minimum 6 frames (>= 12ms at 500 FPS, using [18, 45]ms = 9 to 22.5 frames)
        marginMs = rng.boolean(0.5) ? rng.rangeInt(18, 45) : rng.rangeInt(-45, -18);
      }
      onFieldSignal = "REFERRED";
    } else {
      marginMs = rng.boolean(0.5) ? rng.rangeInt(50, 90) : rng.rangeInt(-90, -50);
      onFieldSignal = marginMs > 0 ? "NOT_OUT" : "OUT";
    }

    const bailsDislodgedFrameMs = 1500;
    const groundedFrameMs = bailsDislodgedFrameMs + marginMs;
    // Synchronize crease margin strictly with continuous slide speed (6.2 mm/ms)
    // so physical crossing time and canonical groundedFrameMs match identically
    const creaseMarginMm = Math.round(marginMs * -6.2);
    const diveType = rng.pick<"SLIDE" | "DIVE" | "STANDING">(["SLIDE", "DIVE", "STANDING"]);

    runOutData = {
      bailsDislodgedFrameMs,
      groundedFrameMs,
      marginMs,
      batGrounded,
      batBounced,
      diveType,
      creaseMarginMm,
      fielderThrow: `${bowlerObj.name} direct hit from mid-on`,
      keeperOrBowler: incidentType === "STUMPING" ? "Wicketkeeper" : "Bowler's End",
    };

    // Phase 1 Initial Evidence Synthesis
    runOutEvidence = {
      runnerSpeedKph: rng.rangeInt(25, 32),
      runnerDiveTechnique: diveType === "DIVE" ? "FULL_DIVE" : diveType === "SLIDE" ? "FEET_FIRST_SLIDE" : "UPRIGHT_RUN",
      batExtensionDistance: rng.rangeInt(65, 95),
      cameraOcclusionLevel: difficultyTier === "MARGINAL" ? rng.pick(["BATTER_BODY_OCCLUDING", "KEEPER_GLOVES_OCCLUDING"]) : "CLEAR_VIEW",
      apparentBailIgnitionTiming: marginMs > 70 ? "EARLY_BEFORE_REACH" : marginMs < -70 ? "LATE_AFTER_REACH" : "SIMULTANEOUS_CRITICAL",
      visualMarginPixels: Math.round(creaseMarginMm * 0.45),
      visualAmbiguityScore: difficultyTier === "CLEAR" ? 0.15 : difficultyTier === "MARGINAL" ? 0.88 : 0.40,
    };

    incidentTitle = `${incidentType === "STUMPING" ? "Stumping" : "Run-Out"} Referral — ${batterObj.name}`;
    description = `${incidentType === "STUMPING" ? "Stumping appeal against" : "Close run-out appeal involving"} ${batterObj.name} at the striker's end. Referred to TV umpire.`;
  } else if (incidentType === "CAUGHT_BEHIND") {
    let hasEdge = false;
    let distractorNoise = false;
    let distractorType: "PAD" | "BAT_PAD" | "GROUND_SCRAPE" | "SHIRT_BRUSH" | null = null;
    let distractorTimeMs: number | null = null;
    let waveformSpikeTimeMs: number | null = null;
    const proximityFrameMs = 1200;

    if (difficultyTier === "CLEAR") {
      hasEdge = rng.boolean(0.5);
      onFieldSignal = hasEdge ? "OUT" : "NOT_OUT";
      if (hasEdge) {
        waveformSpikeTimeMs = proximityFrameMs;
      }
    } else if (difficultyTier === "MARGINAL") {
      const hasDecoy = rng.boolean(0.65);
      if (hasDecoy) {
        distractorNoise = true;
        distractorType = rng.pick(["PAD", "GROUND_SCRAPE", "SHIRT_BRUSH"]);
        distractorTimeMs = proximityFrameMs + rng.rangeInt(70, 160);
        hasEdge = false;
        onFieldSignal = "OUT";
      } else {
        hasEdge = true;
        waveformSpikeTimeMs = proximityFrameMs;
        onFieldSignal = rng.boolean(0.5) ? "OUT" : "NOT_OUT";
      }
    } else {
      const isOut = rng.boolean(0.5);
      hasEdge = isOut;
      onFieldSignal = isOut ? "NOT_OUT" : "OUT";
      if (hasEdge) {
        waveformSpikeTimeMs = proximityFrameMs;
      }
    }

    const gapMm = hasEdge ? 0 : difficultyTier === "CLEAR" ? rng.rangeInt(20, 42) : difficultyTier === "MARGINAL" ? rng.rangeInt(3, 8) : rng.rangeInt(25, 48);

    caughtBehindData = {
      hasEdge,
      waveformSpikeTimeMs,
      distractorNoise,
      distractorTimeMs,
      distractorType,
      proximityFrameMs,
      spikeIntensity: hasEdge ? rng.range(0.6, 0.95) : 0.1,
      ballPassesBatFrameMs: proximityFrameMs,
      gapMm,
      soundType: hasEdge ? "WOODY_SNICK" : distractorNoise ? "DULL_THUD" : "SILENCE",
    };

    // Phase 1 Initial Evidence Synthesis
    caughtBehindEvidence = {
      batAngleDeg: rng.rangeInt(10, 24),
      shotType: rng.pick(["FORWARD_DEFENCE", "COVER_DRIVE", "LATE_CUT", "INSIDE_PUSH"]),
      apparentDeflectionAngleDeg: hasEdge ? (difficultyTier === "MARGINAL" ? rng.range(0.5, 0.9) : rng.range(2.4, 3.6)) : 0,
      apparentGapPixels: hasEdge ? 0 : Math.round(gapMm * 0.5),
      keeperGloveReactionY: rng.rangeInt(-8, 12),
      apparentSoundCue: hasEdge ? "CRISP_CLICK" : distractorNoise ? "MUFFLED_THUD" : "CLEAN_WHISPER",
      visualAmbiguityScore: difficultyTier === "CLEAR" ? 0.15 : difficultyTier === "MARGINAL" ? 0.85 : 0.40,
    };

    incidentTitle = `Caught Behind (UltraEdge) — ${batterObj.name}`;
    description = `Caught behind appeal against ${batterObj.name} off the bowling of ${bowlerObj.name}. Review initiated.`;
  } else {
    // BOUNDARY
    let isBoundary = false;
    let marginMm = 0;
    const ropeContactFrameMs = 1400;

    if (difficultyTier === "CLEAR") {
      isBoundary = rng.boolean(0.5);
      marginMm = isBoundary ? rng.rangeInt(40, 120) : rng.rangeInt(-120, -40);
    } else if (difficultyTier === "MARGINAL") {
      isBoundary = rng.boolean(0.5);
      marginMm = isBoundary ? rng.rangeInt(2, 18) : rng.rangeInt(-18, -2);
    } else {
      isBoundary = rng.boolean(0.5);
      marginMm = isBoundary ? 60 : -60;
    }
    onFieldSignal = "REFERRED";

    boundaryData = {
      ropeContactFrameMs,
      releaseFrameMs: isBoundary ? ropeContactFrameMs + 80 : ropeContactFrameMs - 80,
      isBoundary,
      fielderTouchingRopeWhileInContact: isBoundary,
      marginMm,
      catchOrSave: isBoundary ? "BOUNDARY_TOUCH" : "RELAY_CATCH",
      // R1 Canonical Event-Anchor Engine: archetype selection
      archetype: isBoundary
        ? rng.pick(["SLIDING_CATCH", "RUNNING_ROPE_CATCH"] as const)
        : rng.pick(["SLIDING_CATCH", "AIRBORNE_RELAY", "RUNNING_ROPE_CATCH"] as const),
    };

    // Phase 1 Initial Evidence Synthesis
    boundaryEvidence = {
      fielderApproachSpeed: rng.rangeInt(22, 29),
      diveAngleDeg: rng.rangeInt(18, 34),
      bodyOrientation: boundaryData.catchOrSave === "RELAY_CATCH" ? "PARALLEL_TO_ROPE" : "SLIDING_INTO_CUSHION",
      ballTossHeightPixels: isBoundary ? 0 : rng.rangeInt(55, 85),
      apparentCushionInteraction: isBoundary ? (difficultyTier === "MARGINAL" ? "GRAZING_CUSHION_EDGE" : "DEEP_CUSHION_COMPRESSION") : (difficultyTier === "MARGINAL" ? "GRAZING_CUSHION_EDGE" : "CLEAR_DAYLIGHT_ROPE"),
      apparentReleaseTiming: isBoundary ? "HELD_OVER_ROPE" : (difficultyTier === "MARGINAL" ? "SPLIT_SECOND_TOUCH" : "EARLY_LOB"),
      visualAmbiguityScore: difficultyTier === "CLEAR" ? 0.15 : difficultyTier === "MARGINAL" ? 0.80 : 0.45,
    };

    incidentTitle = `Boundary Line Review — Deep Boundary Catch/Save`;
    description = `Boundary check following an athletic dive near the boundary cushion.`;
  }

  matchContext.onFieldSignal = onFieldSignal;

  let drsEvaluation = evaluateDRSLBW(
    lbwData || {
      isNoBall: false,
      frontFootOverstepMm: 0,
      batContactBeforePad: false,
      firstContactType: "PAD_FIRST",
      ultraEdgeSpikeAtBatFrame: false,
      pitchingZone: "IN_LINE",
      impactZone: "IN_LINE",
      impactHeight: 40,
      projectedStumpHit: "CLEARLY_HITTING",
      impactDistance: 2.0,
      batterHand: "RIGHT",
      shotOffered: true,
      spinOrPace: "PACE",
      ballSpeedKph: 135,
      pitchX: 0,
      impactX: 0,
      stumpHitX: 0,
      stumpHitHeightCm: 45,
      hawkeyeTrajectory: [],
    },
    onFieldSignal
  );

  if (incidentType === "RUN_OUT" || incidentType === "STUMPING") {
    drsEvaluation = evaluateRunOut(runOutData!, onFieldSignal);
  } else if (incidentType === "CAUGHT_BEHIND") {
    drsEvaluation = evaluateCaughtBehind(caughtBehindData!, onFieldSignal);
  } else if (incidentType === "BOUNDARY") {
    drsEvaluation = evaluateBoundary(boundaryData!, onFieldSignal);
  }

  // Phase 1 neutral comms dialogue: NO leaks of on-field decision or forensic findings
  const commsDialogue = [
    { speaker: "ON_FIELD_UMPIRE" as const, text: `Review requested for ${incidentType}. Referral initiated.` },
    { speaker: "TV_UMPIRE" as const, text: "Understood. Rolling the vision through now. Rock and roll that frame for me please." },
    { speaker: "OPERATOR" as const, text: "Broadcast replay feed is live on your main monitor." },
  ];

  if (incidentType === "LBW") {
    commsDialogue.push({ speaker: "TV_UMPIRE" as const, text: "Checking front-on broadcast view. Looking at the delivery stride and line of the ball." });
  } else if (incidentType === "CAUGHT_BEHIND") {
    commsDialogue.push({ speaker: "TV_UMPIRE" as const, text: "Rolling the slip camera replay through the corridor of uncertainty." });
  } else if (incidentType === "RUN_OUT" || incidentType === "STUMPING") {
    commsDialogue.push({ speaker: "TV_UMPIRE" as const, text: "Bring up the side-on broadcast angle looking across the popping crease." });
  } else if (incidentType === "BOUNDARY") {
    commsDialogue.push({ speaker: "TV_UMPIRE" as const, text: "Let's see the tracking camera around the boundary cushion area." });
  }

  const initialEvidence: ScenarioInitialEvidence = {
    lbw: lbwEvidence,
    caughtBehind: caughtBehindEvidence,
    runOut: runOutEvidence,
    boundary: boundaryEvidence,
    broadcastCameraDescription: `Live broadcast tracking feed from primary review angle`,
    onFieldUmpireViewpoint: `On-field umpire standing in position at ${incidentType === "LBW" ? "bowler's end" : "square leg"}`,
  };

  return {
    id: `SCN-${seed.toString(16).toUpperCase().padStart(6, "0")}`,
    incidentType,
    matchContext,
    lbw: lbwData,
    runOut: runOutData,
    caughtBehind: caughtBehindData,
    boundary: boundaryData,
    initialEvidence,
    correctFinalVerdict: drsEvaluation.correctFinalVerdict,
    difficultyTier,
    incidentTitle,
    description,
    onFieldSignal,
    drsEvaluation,
    commsDialogue,
    crowdReaction: {
      battingFanReaction: drsEvaluation.correctFinalVerdict === "OUT" ? "Dismay in the batting dugout as the key batter walks off!" : "Cheers erupt from the pavilion as the review is survived!",
      bowlingFanReaction: drsEvaluation.correctFinalVerdict === "OUT" ? "Jubilant celebrations as the bowler gets the breakthrough!" : "Frustrated sighs as the captain shakes his head at the replay screen.",
      commentary: drsEvaluation.overturnRequired
        ? `“A monumental call overturned by the Third Umpire! High-precision DRS technology in full spotlight here at ${pool.tournament}.”`
        : `“The Third Umpire confirms the on-field decision. Clear protocol followed under ICC DRS guidelines.”`,
    },
  };
}

export function generateSession(count: number = 8, startingSeed?: number): Scenario[] {
  const baseSeed = startingSeed ?? Date.now();
  const scenarios: Scenario[] = [];
  const requiredTypes: IncidentType[] = ["LBW", "RUN_OUT", "CAUGHT_BEHIND", "LBW", "STUMPING", "CAUGHT_BEHIND", "BOUNDARY", "LBW"];

  for (let i = 0; i < count; i++) {
    const forcedType = requiredTypes[i % requiredTypes.length];
    let forcedTier: DifficultyTier = "MARGINAL";
    if (i === 0) forcedTier = "CLEAR";
    else if (i === 3 || i === 7) forcedTier = "HOWLER";
    else if (i % 2 === 1) forcedTier = "MARGINAL";

    // Task 4B — LBW tier mix: LBW incidents draw their own difficulty tier,
    // deterministically from the per-incident seed (target ≈ 40% CLEAR /
    // 40% MARGINAL / 20% HOWLER), so genuine Umpire's-Call LBWs occur in
    // normal sessions. All other incident types keep the composition above.
    if (forcedType === "LBW") {
      const tierRoll = new SeededRandom(baseSeed + i * 7919).next();
      forcedTier = tierRoll < 0.4 ? "CLEAR" : tierRoll < 0.8 ? "MARGINAL" : "HOWLER";
    }

    scenarios.push(generateScenario(baseSeed + i * 7919, forcedType, forcedTier));
  }

  return scenarios;
}
