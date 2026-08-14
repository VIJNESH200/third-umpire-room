export type IncidentType = "LBW" | "RUN_OUT" | "STUMPING" | "CAUGHT_BEHIND" | "BOUNDARY";
export type DecisionVerdict = "OUT" | "NOT_OUT";
export type OnFieldSignal = "OUT" | "NOT_OUT" | "REFERRED";
export type DifficultyTier = "CLEAR" | "MARGINAL" | "HOWLER";

export type PitchingZone = "OUTSIDE_LEG" | "IN_LINE" | "OUTSIDE_OFF";
export type ImpactZone = "OUTSIDE_LINE_PLAYING_SHOT" | "IN_LINE" | "OUTSIDE_LINE_NO_SHOT";
export type ProjectedStumpHit = "MISSING" | "UMPIRES_CALL" | "CLEARLY_HITTING";
export type FirstContactType = "PAD_FIRST" | "BAT_FIRST" | "BAT_PAD_SIMULTANEOUS" | "PAD_ONLY";

export interface MatchContext {
  over: number;
  ballInOver: number;
  battingTeamScore: string;
  battingTeam: string;
  bowlingTeam: string;
  batter: string;
  batterScore: string;
  bowler: string;
  bowlerFigures: string;
  appealType: string;
  onFieldSignal: OnFieldSignal;
  matchFormat: "TEST" | "ODI" | "T20";
  tournament: string;
  matchSituation: string;
  requiredRuns?: number;
  ballsRemaining?: number;
}

export interface LBWData {
  // Gate 0A: Fair Delivery Check
  isNoBall: boolean;
  frontFootOverstepMm: number; // 0 for legal, >0 for overstep

  // Gate 0B: Prior Bat Contact Check
  batContactBeforePad: boolean;
  firstContactType: FirstContactType;
  ultraEdgeSpikeAtBatFrame: boolean;

  // Gate 1: Pitching Zone
  pitchingZone: PitchingZone;

  // Gate 2: Impact Zone
  impactZone: ImpactZone;
  impactHeight: number; // cm
  impactDistance: number; // meters from stumps
  batterHand: "RIGHT" | "LEFT";
  shotOffered: boolean;

  // Gate 3: Wickets Projection & Trajectory
  projectedStumpHit: ProjectedStumpHit;
  spinOrPace: "SPIN" | "PACE";
  ballSpeedKph: number;
  pitchX: number; // -1 to 1 (-0.28 to +0.28 is in line)
  impactX: number;
  stumpHitX: number;
  stumpHitHeightCm: number; // stump height 71.1cm
  hawkeyeTrajectory: { x: number; y: number; z: number }[]; // 3D coordinates
}

export interface RunOutData {
  bailsDislodgedFrameMs: number; // ms from start
  groundedFrameMs: number; // ms when bat/foot crosses crease line and touches ground
  marginMs: number; // groundedFrameMs - bailsDislodgedFrameMs (negative = safe, positive = out)
  batGrounded: boolean;
  batBounced: boolean;
  diveType: "SLIDE" | "DIVE" | "STANDING";
  creaseMarginMm: number; // distance from crease at time of dislodgement (+ inside, - short)
  fielderThrow: string;
  keeperOrBowler: string;
}

export interface CaughtBehindData {
  hasEdge: boolean;
  waveformSpikeTimeMs: number | null;
  distractorNoise: boolean;
  distractorTimeMs: number | null;
  distractorType: "PAD" | "BAT_PAD" | "GROUND_SCRAPE" | "SHIRT_BRUSH" | null;
  proximityFrameMs: number;
  spikeIntensity: number; // 0.1 to 1.0
  ballPassesBatFrameMs: number;
  gapMm: number;
  soundType: "WOODY_SNICK" | "DULL_THUD" | "CLATTER" | "SILENCE";
}

export interface BoundaryData {
  ropeContactFrameMs: number;
  releaseFrameMs: number;
  isBoundary: boolean;
  fielderTouchingRopeWhileInContact: boolean;
  marginMm: number;
  catchOrSave: "BOUNDARY_TOUCH" | "RELAY_CATCH" | "OVER_THE_ROPE";
}

export interface DRSRuleEvaluation {
  gate0FairDelivery: boolean;
  gate0NoPriorBat: boolean;
  pitchingValid: boolean;
  impactValid: boolean;
  wicketsHitting: boolean;
  isUmpiresCall: boolean;
  overturnRequired: boolean;
  correctFinalVerdict: DecisionVerdict;
  failedGate: "NONE" | "GATE_0A_NO_BALL" | "GATE_0B_BAT_FIRST" | "GATE_1_PITCHING_LEG" | "GATE_2_IMPACT_OFF" | "GATE_3_MISSING_WICKETS";
  explanation: string;
  ruleCitation: string;
}

export interface CommsMessage {
  speaker: "TV_UMPIRE" | "ON_FIELD_UMPIRE" | "DIRECTOR" | "OPERATOR";
  text: string;
  timestampMs?: number;
}

// ================================================================
// PHASE 1: INITIAL BROADCAST EVIDENCE INTERFACES
// ================================================================

export interface LBWInitialEvidence {
  deliveryLine: "WIDE_OF_CREASE" | "OVER_WICKET" | "ROUND_WICKET";
  apparentPitchLine: "OUTSIDE_LEG" | "IN_LINE" | "OUTSIDE_OFF";
  apparentImpactLine: "OUTSIDE_LEG" | "IN_LINE" | "OUTSIDE_OFF";
  apparentHeight: "LOW_SHIN" | "KNEE_ROLL" | "HIGH_THIGH";
  apparentStumpThreat: "HEADING_STUMPS" | "TRIMMING_BAILS" | "SLIDING_DOWN_LEG" | "MISSING_OFF";
  shotOfferedType: "DEFENSIVE_FORWARD" | "PADDED_AWAY_NO_SHOT" | "LEAVE_WITHDRAWN" | "DRIVE_ATTEMPT";
  batPadSeparationMm: number; // visual separation between bat face and front pad
  batterStanceShiftX: number; // batter trigger movement (-30 to +30)
  visualAmbiguityScore: number; // 0.1 (very clear) to 0.9 (maximum ambiguity)
}

export interface CaughtBehindInitialEvidence {
  batAngleDeg: number; // angle of bat blade during shot (-25 to +25)
  shotType: "FORWARD_DEFENCE" | "COVER_DRIVE" | "LATE_CUT" | "INSIDE_PUSH";
  apparentDeflectionAngleDeg: number; // 0 for straight, >0 for visible nick deviation
  apparentGapPixels: number; // perceived distance between ball arc and outside edge (0 for contact, >0 for gap)
  keeperGloveReactionY: number; // keeper reaction timing/height offset
  apparentSoundCue: "CRISP_CLICK" | "MUFFLED_THUD" | "WOOD_CLATTER" | "CLEAN_WHISPER";
  visualAmbiguityScore: number;
}

export interface RunOutInitialEvidence {
  runnerSpeedKph: number;
  runnerDiveTechnique: "FULL_DIVE" | "FEET_FIRST_SLIDE" | "DESPERATE_STRETCH" | "UPRIGHT_RUN";
  batExtensionDistance: number; // visual stretch towards crease
  cameraOcclusionLevel: "CLEAR_VIEW" | "BATTER_BODY_OCCLUDING" | "KEEPER_GLOVES_OCCLUDING";
  apparentBailIgnitionTiming: "EARLY_BEFORE_REACH" | "SIMULTANEOUS_CRITICAL" | "LATE_AFTER_REACH";
  visualMarginPixels: number; // perceived distance from crease when bails move (+ inside, - short)
  visualAmbiguityScore: number;
}

export interface BoundaryInitialEvidence {
  fielderApproachSpeed: number;
  diveAngleDeg: number;
  bodyOrientation: "PARALLEL_TO_ROPE" | "SLIDING_INTO_CUSHION" | "AIRBORNE_OVER_ROPE";
  ballTossHeightPixels: number; // visual height ball was flicked back into play
  apparentCushionInteraction: "CLEAR_DAYLIGHT_ROPE" | "GRAZING_CUSHION_EDGE" | "DEEP_CUSHION_COMPRESSION";
  apparentReleaseTiming: "EARLY_LOB" | "SPLIT_SECOND_TOUCH" | "HELD_OVER_ROPE";
  visualAmbiguityScore: number;
}

export interface ScenarioInitialEvidence {
  lbw?: LBWInitialEvidence;
  caughtBehind?: CaughtBehindInitialEvidence;
  runOut?: RunOutInitialEvidence;
  boundary?: BoundaryInitialEvidence;
  broadcastCameraDescription: string;
  onFieldUmpireViewpoint: string;
}

export interface Scenario {
  id: string;
  incidentType: IncidentType;
  matchContext: MatchContext;
  lbw?: LBWData;
  runOut?: RunOutData;
  caughtBehind?: CaughtBehindData;
  boundary?: BoundaryData;
  initialEvidence?: ScenarioInitialEvidence;
  correctFinalVerdict: DecisionVerdict;
  difficultyTier: DifficultyTier;
  incidentTitle: string;
  description: string;
  onFieldSignal: OnFieldSignal;
  drsEvaluation: DRSRuleEvaluation;
  commsDialogue: CommsMessage[];
  crowdReaction: {
    battingFanReaction: string;
    bowlingFanReaction: string;
    commentary: string;
  };
}

export interface IncidentResult {
  scenarioId: string;
  incidentType: IncidentType;
  difficultyTier: DifficultyTier;
  softSignal: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS" | null;
  softSignalTimeMs: number;
  softSignalCorrect: boolean;
  finalVerdict: DecisionVerdict;
  finalVerdictCorrect: boolean;
  isUmpiresCallScenario: boolean; // Whether this scenario involved an Umpire's Call projection
  umpiresCallComplied: boolean; // Did player respect the Umpire's Call rule properly?
  timeSpentReviewingMs: number;
  toolsUsed: string[];
}

export interface SessionStats {
  totalIncidents: number;
  softSignalInstinct: number; // % (0-100)
  reviewPrecision: number; // % (0-100)
  umpiresCallIQ: number; // % (0-100)
  reactionTimeSeconds: number; // avg reaction time for soft signals
  reactionTimeScore: number; // % (0-100)
  consistency: number; // % (0-100)
  howlerDetection: number; // % (0-100)
  overallRating: number; // OVR (0-100)
  rankTier: RankTier;
  longestStreak: number;
  qualifyingUCIIncidents: number;
  history: IncidentResult[];
}

export type RankTier = 
  | "Third Umpire Trainee"
  | "Club Level Official"
  | "TV Umpire"
  | "ICC Panel Umpire"
  | "ICC Elite Panel";

export interface RankInfo {
  tier: RankTier;
  minScore: number;
  maxScore: number;
  badgeColor: string;
  cardTheme: "bronze" | "silver" | "gold" | "elite" | "diamond";
  description: string;
}
