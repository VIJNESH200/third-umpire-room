/**
 * src/types/realMatch.ts
 *
 * Minimal, normalized type contracts for real ball-by-ball match data
 * and zero-copy DRS outcome overlays.
 *
 * Boundary rules:
 * - Canonical baseline: match data is strictly immutable.
 * - Zero copy: DRS overrides are stored in an overlay map, not by cloning the match.
 * - Free of bloated commentary, tracking coordinates, and provider-specific payload junk.
 */

/**
 * Cricket dismissal categories recognized by the real match data foundation.
 */
export type DismissalKind =
  | "BOWLED"
  | "CAUGHT"
  | "LBW"
  | "RUN_OUT"
  | "STUMPED"
  | "HIT_WICKET"
  | "RETIRED";

/**
 * Wicket / dismissal details for a delivery where a wicket fell.
 */
export interface WicketEvent {
  readonly kind: DismissalKind;
  /** Player ID or name of the dismissed batter */
  readonly playerOut: string;
  /** Optional fielders involved in the dismissal (e.g. catcher, thrower/wicketkeeper) */
  readonly fielders?: readonly string[];
}

/**
 * Extras categories in cricket.
 */
export type ExtrasType = "WIDES" | "NO_BALLS" | "BYES" | "LEGBYES" | "PENALTY";

/**
 * Detail of extras conceded on a delivery.
 */
export interface ExtrasInfo {
  readonly type: ExtrasType;
  readonly runs: number;
}

/**
 * Pure outcome of a single delivery.
 */
export interface BallOutcome {
  /** Runs scored off the bat */
  readonly runsBatter: number;
  /** Runs conceded as extras (wides, no-balls, legbyes, byes, etc.) */
  readonly runsExtras?: number;
  /** Categorized breakdown of extras if non-zero */
  readonly extras?: ExtrasInfo;
  /** Wicket event if a dismissal occurred on this ball */
  readonly wicket?: WicketEvent;
}

/**
 * Single delivery in a match.
 */
export interface RealDelivery {
  /**
   * Canonical unique delivery identifier.
   * Format: `${innings}_${over}_${ball}` (e.g. "1_0_1" for 1st innings, 0th over, 1st ball).
   */
  readonly id: string;
  /** Innings number (1 or 2 for T20 / limited overs) */
  readonly innings: number;
  /** Over index (0 to 19 for standard T20, 0-indexed) */
  readonly over: number;
  /** Ball position within the over (1 to 6 for standard legal balls) */
  readonly ball: number;
  /** 0-based sequential delivery index within the innings */
  readonly deliveryIndex: number;
  /** Striker facing the ball */
  readonly striker: string;
  /** Non-striker at the bowler's end */
  readonly nonStriker: string;
  /** Bowler delivering the ball */
  readonly bowler: string;
  /** Canonical baseline outcome of this delivery */
  readonly outcome: BallOutcome;
}

/**
 * Sequence of deliveries comprising an innings.
 */
export interface RealInnings {
  readonly inningsNumber: number;
  readonly battingTeamId: string;
  readonly bowlingTeamId: string;
  readonly deliveries: readonly RealDelivery[];
}

/**
 * Root match representation.
 */
export interface RealMatch {
  readonly id: string;
  readonly format: "T20";
  readonly homeTeamId: string;
  readonly awayTeamId: string;
  readonly venue: string;
  readonly innings: readonly RealInnings[];
}

/**
 * DRS Outcome Override descriptor.
 * Represents a decision where third-umpire review overrides a delivery's outcome.
 *
 * Scope note: This is an adjudication overlay over historical real deliveries,
 * tracking the forensic and scoreboard consequences of third-umpire verdicts.
 */
export interface DrsOutcomeOverride {
  /** Target delivery ID to override (e.g. "1_2_4") */
  readonly ballId: string;
  /** Original baseline outcome before DRS intervention */
  readonly originalOutcome: BallOutcome;
  /** Effective outcome determined by the DRS decision */
  readonly drsOutcome: BallOutcome;
  /** Whether the override is currently active */
  readonly applied: boolean;
  /** Which team initiated the review, when applicable */
  readonly reviewingSide?: "BATTING" | "BOWLING";
  /** Whether the reviewing team retains their review under ICC DRS rules */
  readonly reviewRetained?: boolean;
  /** Optional forensic rationale (e.g. "LBW: Pitching in line, impact in line, wickets hitting") */
  readonly reason?: string;
}

/**
 * Zero-copy map of delivery overrides.
 * Key: ballId (e.g. "1_0_3").
 */
export type DrsOverlayMap = ReadonlyMap<string, DrsOutcomeOverride>;

/**
 * A delivery evaluated against the overlay map to yield its effective outcome.
 */
export interface EffectiveBall {
  /** Reference to the immutable source delivery (never cloned) */
  readonly delivery: RealDelivery;
  /** Effective outcome (either drsOutcome if override applied, or delivery.outcome) */
  readonly effectiveOutcome: BallOutcome;
  /** Whether this delivery's outcome differs from the baseline real match data */
  readonly isOverridden: boolean;
}

/**
 * Lightweight snapshot of match state at the current playback position.
 */
export interface MatchPlaybackState {
  readonly inningsIndex: number;
  readonly deliveryIndex: number;
  readonly currentBall: EffectiveBall | null;
  /** Total runs scored up to and including the current ball in this innings */
  readonly score: number;
  /** Total wickets lost up to and including the current ball in this innings */
  readonly wickets: number;
  /** 0-indexed over number of the current delivery (e.g. 0 for 1st over, 1 for 2nd over) */
  readonly overs: number;
  /** Balls bowled in the current over (1 to 6, or higher when extras occur) */
  readonly ballInOver: number;
  /** Active striker at this point */
  readonly striker: string;
  /** Active non-striker at this point */
  readonly nonStriker: string;
  /** Active bowler at this point */
  readonly bowler: string;
  /** Remaining DRS reviews for each team in the current innings */
  readonly remainingReviews?: {
    readonly batting: number;
    readonly bowling: number;
  };
  /** Whether the innings or match playback has reached the end */
  readonly isComplete: boolean;
}
