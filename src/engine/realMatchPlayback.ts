/**
 * src/engine/realMatchPlayback.ts
 *
 * Lightweight, deterministic real match playback and zero-copy DRS overlay engine.
 *
 * Core Principles:
 * - Immutable baseline: source `RealMatch` is never cloned or mutated.
 * - Zero-copy derivation: `EffectiveBallOutcome = Overlay[ballId]?.applied ? drsOutcome : baselineOutcome`.
 * - Pure functions & state projection: tracks consequences without full cricket simulation overhead.
 */

import type {
  RealMatch,
  RealDelivery,
  BallOutcome,
  DrsOutcomeOverride,
  DrsOverlayMap,
  EffectiveBall,
  MatchPlaybackState,
} from "../types/realMatch";

/**
 * Pure function: Resolves the effective outcome of a delivery against the DRS overlay map.
 * Returns drsOutcome if an active override exists for this delivery, otherwise the original baseline outcome.
 */
export function deriveEffectiveOutcome(
  delivery: RealDelivery,
  overlayMap?: DrsOverlayMap
): BallOutcome {
  const override = overlayMap?.get(delivery.id);
  if (override && override.applied) {
    return override.drsOutcome;
  }
  return delivery.outcome;
}

/**
 * Pure function: Packages a RealDelivery into an EffectiveBall with its resolved outcome and override status.
 * Preserves reference equality to the immutable source delivery.
 */
export function getEffectiveBall(
  delivery: RealDelivery,
  overlayMap?: DrsOverlayMap
): EffectiveBall {
  const effectiveOutcome = deriveEffectiveOutcome(delivery, overlayMap);
  const override = overlayMap?.get(delivery.id);
  const isOverridden = override !== undefined && override.applied;
  return {
    delivery,
    effectiveOutcome,
    isOverridden,
  };
}

/**
 * Pure function: Computes the macro match playback state at a given cursor position.
 * Aggregates runs and wickets in a single fast pass up to `deliveryIndex` without mutating anything.
 */
export function computePlaybackState(
  match: RealMatch,
  inningsIndex: number,
  deliveryIndex: number,
  overlayMap?: DrsOverlayMap
): MatchPlaybackState {
  if (
    inningsIndex < 0 ||
    inningsIndex >= match.innings.length ||
    match.innings.length === 0
  ) {
    return {
      inningsIndex: 0,
      deliveryIndex: -1,
      currentBall: null,
      score: 0,
      wickets: 0,
      overs: 0,
      ballInOver: 0,
      striker: "",
      nonStriker: "",
      bowler: "",
      remainingReviews: {
        batting: 2,
        bowling: 2,
      },
      isComplete: false,
    };
  }

  const innings = match.innings[inningsIndex];
  const deliveries = innings.deliveries;

  // Before first ball of innings
  if (deliveryIndex < 0 || deliveries.length === 0) {
    const firstBall = deliveries[0];
    return {
      inningsIndex,
      deliveryIndex: -1,
      currentBall: null,
      score: 0,
      wickets: 0,
      overs: 0,
      ballInOver: 0,
      striker: firstBall ? firstBall.striker : "",
      nonStriker: firstBall ? firstBall.nonStriker : "",
      bowler: firstBall ? firstBall.bowler : "",
      remainingReviews: {
        batting: 2,
        bowling: 2,
      },
      isComplete: false,
    };
  }

  const clampedDeliveryIndex = Math.min(deliveryIndex, deliveries.length - 1);
  let totalScore = 0;
  let totalWickets = 0;
  let battingReviews = 2;
  let bowlingReviews = 2;

  // Single-pass linear scan up to current delivery index
  for (let i = 0; i <= clampedDeliveryIndex; i++) {
    const d = deliveries[i];
    const outcome = deriveEffectiveOutcome(d, overlayMap);
    totalScore += outcome.runsBatter + (outcome.runsExtras ?? 0);
    if (outcome.wicket) {
      totalWickets += 1;
    }

    // Account for review deductions under DRS rules
    const override = overlayMap?.get(d.id);
    if (override && override.applied && override.reviewingSide) {
      if (override.reviewRetained === false) {
        if (override.reviewingSide === "BATTING") {
          battingReviews = Math.max(0, battingReviews - 1);
        } else if (override.reviewingSide === "BOWLING") {
          bowlingReviews = Math.max(0, bowlingReviews - 1);
        }
      }
    }
  }

  const currentDelivery = deliveries[clampedDeliveryIndex];
  const currentEffectiveBall = getEffectiveBall(currentDelivery, overlayMap);

  const isLastBallOfInnings = clampedDeliveryIndex === deliveries.length - 1;
  const isFinalInnings = inningsIndex === match.innings.length - 1;
  const isComplete = isLastBallOfInnings && isFinalInnings;

  return {
    inningsIndex,
    deliveryIndex: clampedDeliveryIndex,
    currentBall: currentEffectiveBall,
    score: totalScore,
    wickets: totalWickets,
    overs: currentDelivery.over,
    ballInOver: currentDelivery.ball,
    striker: currentDelivery.striker,
    nonStriker: currentDelivery.nonStriker,
    bowler: currentDelivery.bowler,
    remainingReviews: {
      batting: battingReviews,
      bowling: bowlingReviews,
    },
    isComplete,
  };
}

/**
 * Lightweight, stateful session controller for stepping through real match deliveries
 * with dynamic zero-copy DRS overlays.
 */
export class RealMatchPlaybackSession {
  public readonly match: RealMatch;
  private _inningsIndex: number = 0;
  private _deliveryIndex: number = 0;
  private readonly _overlays: Map<string, DrsOutcomeOverride>;

  constructor(
    match: RealMatch,
    initialOverlays?:
      | ReadonlyMap<string, DrsOutcomeOverride>
      | readonly DrsOutcomeOverride[]
  ) {
    this.match = match;
    this._overlays = new Map<string, DrsOutcomeOverride>();
    if (initialOverlays) {
      if ("get" in initialOverlays && typeof initialOverlays.get === "function") {
        (initialOverlays as ReadonlyMap<string, DrsOutcomeOverride>).forEach((ov, key) => {
          this._overlays.set(String(key), ov);
        });
      } else {
        for (const ov of initialOverlays as readonly DrsOutcomeOverride[]) {
          this._overlays.set(ov.ballId, ov);
        }
      }
    }
  }

  /**
   * Returns the current (inningsIndex, deliveryIndex) cursor.
   */
  public getCursor(): { inningsIndex: number; deliveryIndex: number } {
    return {
      inningsIndex: this._inningsIndex,
      deliveryIndex: this._deliveryIndex,
    };
  }

  /**
   * Returns the effective delivery at the current playback position, or null if empty.
   */
  public getCurrentDelivery(): EffectiveBall | null {
    const currentInnings = this.match.innings[this._inningsIndex];
    if (!currentInnings || currentInnings.deliveries.length === 0) {
      return null;
    }
    const delivery = currentInnings.deliveries[this._deliveryIndex];
    if (!delivery) {
      return null;
    }
    return getEffectiveBall(delivery, this._overlays);
  }

  /**
   * Computes and returns the full playback state at the current position.
   */
  public getCurrentState(): MatchPlaybackState {
    return computePlaybackState(
      this.match,
      this._inningsIndex,
      this._deliveryIndex,
      this._overlays
    );
  }

  /**
   * Advances cursor to the next delivery.
   * Seamlessly transitions across innings if available.
   * Returns true if advanced, or false if already at the end of the match.
   */
  public stepForward(): boolean {
    const currentInnings = this.match.innings[this._inningsIndex];
    if (!currentInnings) {
      return false;
    }

    if (this._deliveryIndex < currentInnings.deliveries.length - 1) {
      this._deliveryIndex += 1;
      return true;
    }

    // End of current innings reached; check for next innings
    if (this._inningsIndex < this.match.innings.length - 1) {
      this._inningsIndex += 1;
      this._deliveryIndex = 0;
      return true;
    }

    return false;
  }

  /**
   * Steps cursor backward to the previous delivery.
   * Seamlessly transitions backward across innings if available.
   * Returns true if stepped back, or false if already at the first delivery.
   */
  public stepBackward(): boolean {
    if (this._deliveryIndex > 0) {
      this._deliveryIndex -= 1;
      return true;
    }

    // At start of current innings; check if we can step back into previous innings
    if (this._inningsIndex > 0) {
      this._inningsIndex -= 1;
      const prevInnings = this.match.innings[this._inningsIndex];
      this._deliveryIndex = Math.max(0, prevInnings.deliveries.length - 1);
      return true;
    }

    return false;
  }

  /**
   * Jumps the playback cursor directly to a specific innings and delivery index.
   */
  public seekTo(inningsIndex: number, deliveryIndex: number): boolean {
    if (inningsIndex < 0 || inningsIndex >= this.match.innings.length) {
      return false;
    }
    const innings = this.match.innings[inningsIndex];
    if (deliveryIndex < 0 || deliveryIndex >= innings.deliveries.length) {
      return false;
    }
    this._inningsIndex = inningsIndex;
    this._deliveryIndex = deliveryIndex;
    return true;
  }

  /**
   * Resets playback cursor to the very first delivery of the first innings.
   */
  public reset(): void {
    this._inningsIndex = 0;
    this._deliveryIndex = 0;
  }

  /**
   * Applies or updates a DRS outcome override for a specific delivery.
   * Does NOT mutate or clone the underlying match.
   */
  public applyOverlay(override: DrsOutcomeOverride): void {
    this._overlays.set(override.ballId, override);
  }

  /**
   * Removes a DRS outcome override by ball ID, reverting it to canonical real baseline.
   * Returns true if an override existed and was removed.
   */
  public removeOverlay(ballId: string): boolean {
    return this._overlays.delete(ballId);
  }

  /**
   * Retrieves an existing override for a ball ID, if one is registered.
   */
  public getOverlay(ballId: string): DrsOutcomeOverride | undefined {
    return this._overlays.get(ballId);
  }

  /**
   * Exposes a read-only snapshot of all active DRS overrides in this session.
   * Returns a defensive copy to protect internal state encapsulation.
   */
  public getOverlays(): ReadonlyMap<string, DrsOutcomeOverride> {
    return new Map(this._overlays);
  }

  /**
   * Clears all registered DRS overrides, immediately restoring pure canonical match state.
   */
  public clearOverlays(): void {
    this._overlays.clear();
  }
}

/**
 * Shared pure utility: Determines whether a team's DRS review is retained under ICC rules.
 *
 * Rules:
 * - If referral was initiated by on-field umpires ("REFERRED") or no team review occurred, neither team loses a review.
 * - Bowling review:
 *   - Overturned (verdict === "OUT") -> Retained
 *   - Upheld (verdict === "NOT_OUT") -> Lost, unless Umpire's Call
 * - Batting review:
 *   - Overturned (verdict === "NOT_OUT") -> Retained
 *   - Upheld (verdict === "OUT") -> Lost, unless Umpire's Call
 */
export function calculateReviewRetention(params: {
  readonly verdict: "OUT" | "NOT_OUT";
  readonly onFieldSignal?: "OUT" | "NOT_OUT" | "REFERRED";
  readonly reviewingSide?: "BATTING" | "BOWLING";
  readonly isUmpiresCall?: boolean;
}): { readonly reviewingSide?: "BATTING" | "BOWLING"; readonly reviewRetained: boolean } {
  const { verdict, onFieldSignal, reviewingSide: explicitSide, isUmpiresCall = false } = params;

  // If on-field signal was REFERRED and no explicit reviewing side was specified,
  // this is an umpire referral (e.g. run out / stumping / boundary check).
  // Under ICC rules, umpire referrals do not consume team reviews.
  if (onFieldSignal === "REFERRED" && !explicitSide) {
    return { reviewingSide: undefined, reviewRetained: true };
  }

  // Infer reviewing side if not explicitly provided
  const reviewingSide: "BATTING" | "BOWLING" | undefined =
    explicitSide ??
    (onFieldSignal === "OUT"
      ? "BATTING"
      : onFieldSignal === "NOT_OUT"
      ? "BOWLING"
      : undefined);

  if (!reviewingSide) {
    return { reviewingSide: undefined, reviewRetained: true };
  }

  let reviewRetained = true;
  if (reviewingSide === "BOWLING") {
    if (verdict === "OUT") {
      reviewRetained = true;
    } else {
      reviewRetained = isUmpiresCall;
    }
  } else {
    if (verdict === "NOT_OUT") {
      reviewRetained = true;
    } else {
      reviewRetained = isUmpiresCall;
    }
  }

  return { reviewingSide, reviewRetained };
}

/**
 * Parameters required to translate an evaluated LBW DRS incident into a sparse DRS outcome override.
 * Fully decoupled from LBW physics: only takes the evaluated DRS verdict and the immutable target delivery.
 */
export interface LbwDrsConsequenceParams {
  /** Target delivery on which the LBW appeal and DRS review took place */
  readonly delivery: RealDelivery;
  /** Evaluated final verdict produced by the DRS LBW rule engine */
  readonly verdict: "OUT" | "NOT_OUT";
  /** Original on-field signal by the standing umpire ("OUT", "NOT_OUT", or "REFERRED") */
  readonly onFieldSignal?: "OUT" | "NOT_OUT" | "REFERRED";
  /** Which team initiated the review (defaults to BOWLING if on-field was NOT_OUT, BATTING if OUT) */
  readonly reviewingSide?: "BATTING" | "BOWLING";
  /** Whether the delivery was a No Ball (Law 36.1 forbids LBW on No Ball) */
  readonly isNoBall?: boolean;
  /** Optional rule explanation or citation from the DRS engine */
  readonly reason?: string;
  /** Whether the review was deemed Umpire's Call by the DRS engine */
  readonly isUmpiresCall?: boolean;
}

/**
 * Pure function: Translates an evaluated LBW DRS decision into a sparse DrsOutcomeOverride.
 *
 * Consequence Semantics:
 * 1. LBW OUT:
 *    - Effective delivery becomes a wicket (kind: "LBW", playerOut: delivery.striker).
 *    - Batter runs remain 0 (under Law 36 / 18, runs off the bat cannot occur on LBW dismissal).
 *    - If review was initiated by Bowling side and overturned NOT_OUT -> OUT, review is retained.
 *    - If review was initiated by Batting side and upheld OUT, review is lost unless Umpire's Call.
 *
 * 2. LBW NOT OUT:
 *    - Effective delivery retains the baseline non-wicket outcome (no wicket added).
 *    - Original runs/extras from delivery are preserved intact.
 *    - If review was initiated by Bowling side and NOT_OUT stands, review is lost unless Umpire's Call.
 *    - If review was initiated by Batting side and overturned OUT -> NOT_OUT, review is retained.
 *    - If delivery was a No Ball, Law 36.1 prevents dismissal and preserves/awards the No Ball extra.
 *
 * Zero-copy: Never mutates or clones the delivery; only references delivery.id and baseline outcome.
 */
export function createLbwDrsConsequence(
  params: LbwDrsConsequenceParams
): DrsOutcomeOverride {
  const {
    delivery,
    verdict,
    onFieldSignal = delivery.outcome.wicket ? "OUT" : "NOT_OUT",
    reviewingSide: explicitSide,
    isNoBall: explicitNoBall,
    reason,
    isUmpiresCall = false,
  } = params;

  // Under Law 36.1, a batter cannot be out LBW off a No Ball
  const isNoBallDelivery =
    explicitNoBall === true ||
    delivery.outcome.extras?.type === "NO_BALLS";

  const effectiveVerdict: "OUT" | "NOT_OUT" = isNoBallDelivery
    ? "NOT_OUT"
    : verdict;

  const { reviewingSide, reviewRetained } = calculateReviewRetention({
    verdict: effectiveVerdict,
    onFieldSignal,
    reviewingSide: explicitSide,
    isUmpiresCall,
  });

  if (effectiveVerdict === "OUT") {
    // Effective delivery becomes an LBW wicket for the striker facing the ball.
    // Under MCC Laws (Law 20.1.1.3, Law 26, Law 36), the ball becomes dead at dismissal;
    // extras (leg byes, byes, wides) and batter runs are not scored on an LBW dismissal.
    const drsOutcome: BallOutcome = {
      runsBatter: 0,
      runsExtras: undefined,
      extras: undefined,
      wicket: {
        kind: "LBW",
        playerOut: delivery.striker,
      },
    };

    return {
      ballId: delivery.id,
      incidentType: "LBW",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? `LBW: Evaluated as OUT (${delivery.striker} dismissed)`,
    };
  } else {
    // If No Ball was explicitly flagged and baseline lacked No Ball extra, award 1-run penalty
    const awardedExtras =
      isNoBallDelivery && explicitNoBall === true && delivery.outcome.extras?.type !== "NO_BALLS"
        ? {
            runsExtras: (delivery.outcome.runsExtras ?? 0) + 1,
            extras: { type: "NO_BALLS" as const, runs: 1 },
          }
        : {
            runsExtras: delivery.outcome.runsExtras,
            extras: delivery.outcome.extras,
          };

    // Effective delivery retains baseline non-wicket outcome
    // If baseline had a wicket (e.g. on-field out overturned), strip the wicket; otherwise keep outcome
    const drsOutcome: BallOutcome =
      delivery.outcome.wicket || (isNoBallDelivery && explicitNoBall === true)
        ? {
            runsBatter: delivery.outcome.runsBatter,
            ...awardedExtras,
          }
        : delivery.outcome;

    const defaultReason = isNoBallDelivery
      ? `LBW: Evaluated as NOT OUT (delivery is a No Ball; Law 36.1 dictates batter cannot be LBW)`
      : `LBW: Evaluated as NOT OUT`;

    return {
      ballId: delivery.id,
      incidentType: "LBW",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? defaultReason,
    };
  }
}

/**
 * Parameters required to translate an evaluated Run Out incident into a sparse DRS outcome override.
 */
export interface RunOutDrsConsequenceParams {
  /** Target delivery on which the run-out appeal took place */
  readonly delivery: RealDelivery;
  /** Evaluated final verdict produced by the DRS run-out rule engine */
  readonly verdict: "OUT" | "NOT_OUT";
  /** Original on-field signal ("OUT", "NOT_OUT", or "REFERRED", defaults to "REFERRED") */
  readonly onFieldSignal?: "OUT" | "NOT_OUT" | "REFERRED";
  /** Which team initiated the review (if team review; undefined for umpire referral) */
  readonly reviewingSide?: "BATTING" | "BOWLING";
  /**
   * Batter who was run out (striker or non-striker).
   * Defaults to delivery.striker if dismissedEnd is "STRIKER", or delivery.nonStriker if "NON_STRIKER".
   */
  readonly dismissedBatter?: string;
  /** Which end the run out occurred at ("STRIKER" or "NON_STRIKER", defaults to "STRIKER") */
  readonly dismissedEnd?: "STRIKER" | "NON_STRIKER";
  /**
   * Completed runs prior to run out.
   * Under Law 38, runs completed before the dismissal stand.
   * If omitted, preserves baseline delivery.outcome.runsBatter.
   */
  readonly runsCompleted?: number;
  /** Fielders involved in the run out dismissal (e.g. thrower, stump breaker) */
  readonly fielders?: readonly string[];
  /** Optional rule explanation or citation from the DRS engine */
  readonly reason?: string;
}

/**
 * Pure function: Translates an evaluated Run Out decision into a sparse DrsOutcomeOverride.
 *
 * Consequence Semantics:
 * 1. RUN OUT OUT:
 *    - Preserves legitimate completed runs (under Law 38, runs completed before run-out stand).
 *    - Adds exactly one wicket of kind "RUN_OUT".
 *    - Accurately assigns dismissed player to either striker or non-striker.
 *    - Preserves delivery extras (wides/no-balls/byes) intact.
 *
 * 2. RUN OUT NOT OUT:
 *    - Baseline delivery outcome is preserved intact (runs and extras retained).
 *    - If baseline had a wicket (e.g. on-field out overturned), the wicket is removed.
 *
 * Zero-copy: Never mutates or clones the delivery; only references delivery.id and baseline outcome.
 */
export function createRunOutDrsConsequence(
  params: RunOutDrsConsequenceParams
): DrsOutcomeOverride {
  const {
    delivery,
    verdict,
    onFieldSignal = "REFERRED",
    reviewingSide: explicitSide,
    dismissedBatter: explicitBatter,
    dismissedEnd = "STRIKER",
    runsCompleted,
    fielders,
    reason,
  } = params;

  const { reviewingSide, reviewRetained } = calculateReviewRetention({
    verdict,
    onFieldSignal,
    reviewingSide: explicitSide,
    isUmpiresCall: false,
  });

  const playerOut =
    explicitBatter ??
    (params.dismissedEnd !== undefined
      ? params.dismissedEnd === "NON_STRIKER"
        ? delivery.nonStriker
        : delivery.striker
      : delivery.outcome.wicket?.kind === "RUN_OUT" && delivery.outcome.wicket.playerOut
      ? delivery.outcome.wicket.playerOut
      : dismissedEnd === "NON_STRIKER"
      ? delivery.nonStriker
      : delivery.striker);

  const runsBatter =
    runsCompleted !== undefined
      ? runsCompleted
      : delivery.outcome.runsBatter;

  const effectiveFielders =
    fielders && fielders.length > 0
      ? fielders
      : delivery.outcome.wicket?.kind === "RUN_OUT"
      ? delivery.outcome.wicket.fielders
      : undefined;

  if (verdict === "OUT") {
    const drsOutcome: BallOutcome = {
      runsBatter,
      runsExtras: delivery.outcome.runsExtras,
      extras: delivery.outcome.extras,
      wicket: {
        kind: "RUN_OUT",
        playerOut,
        fielders: effectiveFielders,
      },
    };

    return {
      ballId: delivery.id,
      incidentType: "RUN_OUT",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? `Run Out: Evaluated as OUT (${playerOut} short of crease)`,
    };
  } else {
    const drsOutcome: BallOutcome =
      delivery.outcome.wicket || runsCompleted !== undefined
        ? {
            runsBatter,
            runsExtras: delivery.outcome.runsExtras,
            extras: delivery.outcome.extras,
          }
        : delivery.outcome;

    return {
      ballId: delivery.id,
      incidentType: "RUN_OUT",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? `Run Out: Evaluated as NOT OUT (${playerOut} grounded behind crease)`,
    };
  }
}

/**
 * Parameters required to translate an evaluated Stumping incident into a sparse DRS outcome override.
 */
export interface StumpingDrsConsequenceParams {
  /** Target delivery on which the stumping appeal took place */
  readonly delivery: RealDelivery;
  /** Evaluated final verdict produced by the DRS stumping rule engine */
  readonly verdict: "OUT" | "NOT_OUT";
  /** Original on-field signal ("OUT", "NOT_OUT", or "REFERRED", defaults to "REFERRED") */
  readonly onFieldSignal?: "OUT" | "NOT_OUT" | "REFERRED";
  /** Which team initiated the review (if team review; undefined for umpire referral) */
  readonly reviewingSide?: "BATTING" | "BOWLING";
  /** Dismissed batter name (defaults to delivery.striker per Law 39) */
  readonly dismissedBatter?: string;
  /** Wicketkeeper who executed the stumping */
  readonly wicketkeeper?: string;
  /**
   * Whether the delivery was a No Ball.
   * Under Law 39.1, a batter cannot be out Stumped off a No Ball.
   * If true or if baseline delivery was a No Ball, verdict is constrained to NOT_OUT.
   */
  readonly isNoBall?: boolean;
  /** Optional rule explanation or citation from the DRS engine */
  readonly reason?: string;
}

/**
 * Pure function: Translates an evaluated Stumping decision into a sparse DrsOutcomeOverride.
 *
 * Consequence Semantics:
 * 1. STUMPING OUT:
 *    - Striker is out (kind: "STUMPED", playerOut: delivery.striker).
 *    - Runs off bat remain 0 (batter missed stroke and stepped out).
 *    - Delivery extras (e.g. Wides) are preserved intact (under Law 39.1, stumping can occur off a Wide).
 *
 * 2. STUMPING NOT OUT:
 *    - Batter is safe (grounded behind popping crease).
 *    - Baseline delivery outcome is preserved.
 *    - If delivery was a No Ball (either via isNoBall flag or delivery.outcome.extras.type === "NO_BALLS"),
 *      stumping cannot be given under Law 39.1, and the No Ball extra is preserved.
 *
 * Zero-copy: Never mutates or clones the delivery; only references delivery.id and baseline outcome.
 */
export function createStumpingDrsConsequence(
  params: StumpingDrsConsequenceParams
): DrsOutcomeOverride {
  const {
    delivery,
    verdict: requestedVerdict,
    onFieldSignal = "REFERRED",
    reviewingSide: explicitSide,
    dismissedBatter,
    wicketkeeper,
    isNoBall: explicitNoBall,
    reason,
  } = params;

  const playerOut = dismissedBatter ?? delivery.striker;

  // Under Law 39.1, a batter cannot be out stumped off a No Ball.
  // Check both explicit parameter and baseline delivery extras.
  const isNoBallDelivery =
    explicitNoBall === true ||
    delivery.outcome.extras?.type === "NO_BALLS";

  const effectiveVerdict: "OUT" | "NOT_OUT" = isNoBallDelivery
    ? "NOT_OUT"
    : requestedVerdict;

  const { reviewingSide, reviewRetained } = calculateReviewRetention({
    verdict: effectiveVerdict,
    onFieldSignal,
    reviewingSide: explicitSide,
    isUmpiresCall: false,
  });

  const effectiveFielders =
    wicketkeeper
      ? [wicketkeeper]
      : delivery.outcome.wicket?.kind === "STUMPED"
      ? delivery.outcome.wicket.fielders
      : undefined;

  if (effectiveVerdict === "OUT") {
    // Under MCC Laws (Law 20.1.1.3, Law 26, Law 39.1, Law 22.15), the ball becomes dead at dismissal;
    // byes and leg byes cannot be scored on a stumping. Wides (and Penalty) are preserved intact.
    const isRetainedExtra =
      delivery.outcome.extras?.type === "WIDES" ||
      delivery.outcome.extras?.type === "PENALTY";

    const drsOutcome: BallOutcome = {
      runsBatter: 0,
      runsExtras: isRetainedExtra ? delivery.outcome.runsExtras : undefined,
      extras: isRetainedExtra ? delivery.outcome.extras : undefined,
      wicket: {
        kind: "STUMPED",
        playerOut,
        fielders: effectiveFielders,
      },
    };

    return {
      ballId: delivery.id,
      incidentType: "STUMPING",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason:
        reason ??
        `Stumping: Evaluated as OUT (${playerOut} stumped by ${wicketkeeper ?? effectiveFielders?.[0] ?? "wicketkeeper"})`,
    };
  } else {
    // If No Ball was explicitly flagged and baseline lacked No Ball extra, award 1-run penalty
    const awardedExtras =
      isNoBallDelivery && explicitNoBall === true && delivery.outcome.extras?.type !== "NO_BALLS"
        ? {
            runsExtras: (delivery.outcome.runsExtras ?? 0) + 1,
            extras: { type: "NO_BALLS" as const, runs: 1 },
          }
        : {
            runsExtras: delivery.outcome.runsExtras,
            extras: delivery.outcome.extras,
          };

    const drsOutcome: BallOutcome =
      delivery.outcome.wicket || (isNoBallDelivery && explicitNoBall === true)
        ? {
            runsBatter: delivery.outcome.runsBatter,
            ...awardedExtras,
          }
        : delivery.outcome;

    const defaultReason = isNoBallDelivery
      ? `Stumping: Evaluated as NOT OUT (delivery is a No Ball; Law 39.1 dictates batter cannot be stumped)`
      : `Stumping: Evaluated as NOT OUT (${playerOut} grounded behind crease)`;

    return {
      ballId: delivery.id,
      incidentType: "STUMPING",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? defaultReason,
    };
  }
}

/**
 * Parameters required to translate an evaluated Caught Behind incident into a sparse DRS outcome override.
 */
export interface CaughtBehindDrsConsequenceParams {
  /** Target delivery on which the caught behind appeal took place */
  readonly delivery: RealDelivery;
  /** Evaluated final verdict produced by the DRS caught behind rule engine */
  readonly verdict: "OUT" | "NOT_OUT";
  /** Original on-field signal ("OUT", "NOT_OUT", or "REFERRED", defaults to OUT if baseline had wicket, else NOT_OUT) */
  readonly onFieldSignal?: "OUT" | "NOT_OUT" | "REFERRED";
  /** Which team initiated the review */
  readonly reviewingSide?: "BATTING" | "BOWLING";
  /** Dismissed batter name (defaults to delivery.striker) */
  readonly dismissedBatter?: string;
  /** Fielder who took the catch (wicketkeeper or slip) */
  readonly catcher?: string;
  /** Whether the delivery was a No Ball (Law 33.1 forbids Caught dismissal on No Ball) */
  readonly isNoBall?: boolean;
  /** Optional rule explanation or citation from the DRS engine */
  readonly reason?: string;
}

/**
 * Pure function: Translates an evaluated Caught Behind decision into a sparse DrsOutcomeOverride.
 *
 * Consequence Semantics:
 * 1. CAUGHT BEHIND OUT:
 *    - Striker is out (kind: "CAUGHT", playerOut: delivery.striker, fielders: [catcher]).
 *    - Runs off bat remain 0 (cannot score off bat when caught behind).
 *    - Extras preserved.
 *    - Review retention: retained if bowling overturned NOT_OUT -> OUT; lost if batting upheld OUT.
 *
 * 2. CAUGHT BEHIND NOT OUT:
 *    - If baseline had a caught dismissal (overturned by review), strip the wicket and preserve runs.
 *    - If baseline had no wicket, preserve baseline outcome intact.
 *    - Review retention: retained if batting overturned OUT -> NOT_OUT; lost if bowling upheld NOT_OUT.
 *    - If delivery was a No Ball, Law 33.1 prevents dismissal and preserves/awards the No Ball extra.
 *
 * Zero-copy: Never mutates or clones the delivery; only references delivery.id and baseline outcome.
 */
export function createCaughtBehindDrsConsequence(
  params: CaughtBehindDrsConsequenceParams
): DrsOutcomeOverride {
  const {
    delivery,
    verdict,
    onFieldSignal = delivery.outcome.wicket ? "OUT" : "NOT_OUT",
    reviewingSide: explicitSide,
    dismissedBatter,
    catcher,
    isNoBall: explicitNoBall,
    reason,
  } = params;

  const playerOut = dismissedBatter ?? delivery.striker;

  // Under Law 33.1, a batter cannot be out caught off a No Ball.
  const isNoBallDelivery =
    explicitNoBall === true ||
    delivery.outcome.extras?.type === "NO_BALLS";

  const effectiveVerdict: "OUT" | "NOT_OUT" = isNoBallDelivery
    ? "NOT_OUT"
    : verdict;

  const { reviewingSide, reviewRetained } = calculateReviewRetention({
    verdict: effectiveVerdict,
    onFieldSignal,
    reviewingSide: explicitSide,
    isUmpiresCall: false,
  });

  const effectiveFielders =
    catcher
      ? [catcher]
      : delivery.outcome.wicket?.kind === "CAUGHT"
      ? delivery.outcome.wicket.fielders
      : undefined;

  if (effectiveVerdict === "OUT") {
    // Under MCC Laws (Law 20.1.1.3, Law 33), the ball becomes dead at dismissal;
    // extras (byes, leg byes, wides) and batter runs are not scored on a catch.
    const drsOutcome: BallOutcome = {
      runsBatter: 0,
      runsExtras: undefined,
      extras: undefined,
      wicket: {
        kind: "CAUGHT",
        playerOut,
        fielders: effectiveFielders,
      },
    };

    return {
      ballId: delivery.id,
      incidentType: "CAUGHT_BEHIND",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason:
        reason ??
        `Caught Behind: Evaluated as OUT (${playerOut} caught by ${catcher ?? effectiveFielders?.[0] ?? "wicketkeeper"})`,
    };
  } else {
    // If No Ball was explicitly flagged and baseline lacked No Ball extra, award 1-run penalty
    const awardedExtras =
      isNoBallDelivery && explicitNoBall === true && delivery.outcome.extras?.type !== "NO_BALLS"
        ? {
            runsExtras: (delivery.outcome.runsExtras ?? 0) + 1,
            extras: { type: "NO_BALLS" as const, runs: 1 },
          }
        : {
            runsExtras: delivery.outcome.runsExtras,
            extras: delivery.outcome.extras,
          };

    const drsOutcome: BallOutcome =
      delivery.outcome.wicket || (isNoBallDelivery && explicitNoBall === true)
        ? {
            runsBatter: delivery.outcome.runsBatter,
            ...awardedExtras,
          }
        : delivery.outcome;

    const defaultReason = isNoBallDelivery
      ? `Caught Behind: Evaluated as NOT OUT (delivery is a No Ball; Law 33.1 dictates batter cannot be caught)`
      : `Caught Behind: Evaluated as NOT OUT (conclusive daylight / no bat edge)`;

    return {
      ballId: delivery.id,
      incidentType: "CAUGHT_BEHIND",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? defaultReason,
    };
  }
}

/**
 * Parameters required to translate an evaluated Boundary Catch review into a sparse DRS outcome override.
 */
export interface BoundaryDrsConsequenceParams {
  /** Target delivery on which the boundary catch review took place */
  readonly delivery: RealDelivery;
  /** Evaluated final verdict produced by the DRS boundary rule engine */
  readonly verdict: "OUT" | "NOT_OUT";
  /** Original on-field signal ("OUT", "NOT_OUT", or "REFERRED", defaults to "REFERRED") */
  readonly onFieldSignal?: "OUT" | "NOT_OUT" | "REFERRED";
  /** Which team initiated the review (if team review; undefined for umpire referral) */
  readonly reviewingSide?: "BATTING" | "BOWLING";
  /** Batter who struck the ball (defaults to delivery.striker) */
  readonly dismissedBatter?: string;
  /** Fielders involved in the boundary catch/relay */
  readonly fielders?: readonly string[];
  /**
   * Boundary runs to award if NOT OUT (boundary contact occurred).
   * Typically 4 or 6 (defaults to 4 if baseline had a wicket, or delivery.outcome.runsBatter if baseline had no wicket).
   */
  readonly boundaryRuns?: number;
  /** Whether the delivery was a No Ball (Law 33.1 forbids catch off No Ball) */
  readonly isNoBall?: boolean;
  /** Optional rule explanation or citation from the DRS engine */
  readonly reason?: string;
}

/**
 * Pure function: Translates an evaluated Boundary Catch decision into a sparse DrsOutcomeOverride.
 *
 * Consequence Semantics:
 * 1. BOUNDARY CATCH OUT:
 *    - Fielder legally completed catch inside rope without cushion contact.
 *    - Striker is out (kind: "CAUGHT", playerOut: delivery.striker, fielders: fielders).
 *    - Batter runs become 0.
 *
 * 2. BOUNDARY CATCH NOT OUT:
 *    - Fielder contacted boundary cushion while touching ball, or ball crossed boundary.
 *    - If baseline had a wicket (on-field catch overturned), strips the wicket and awards boundary runs (4 or explicit).
 *    - If baseline had no wicket, preserves baseline runs intact (or awards explicit boundaryRuns).
 *    - If delivery was a No Ball, Law 33.1 prevents dismissal and preserves/awards the No Ball extra.
 *
 * Zero-copy: Never mutates or clones the delivery; only references delivery.id and baseline outcome.
 */
export function createBoundaryDrsConsequence(
  params: BoundaryDrsConsequenceParams
): DrsOutcomeOverride {
  const {
    delivery,
    verdict,
    onFieldSignal = "REFERRED",
    reviewingSide: explicitSide,
    dismissedBatter,
    fielders,
    boundaryRuns: explicitBoundaryRuns,
    isNoBall: explicitNoBall,
    reason,
  } = params;

  const playerOut = dismissedBatter ?? delivery.striker;

  // Under Law 33.1, a batter cannot be caught off a No Ball.
  const isNoBallDelivery =
    explicitNoBall === true ||
    delivery.outcome.extras?.type === "NO_BALLS";

  const effectiveVerdict: "OUT" | "NOT_OUT" = isNoBallDelivery
    ? "NOT_OUT"
    : verdict;

  const { reviewingSide, reviewRetained } = calculateReviewRetention({
    verdict: effectiveVerdict,
    onFieldSignal,
    reviewingSide: explicitSide,
    isUmpiresCall: false,
  });

  const effectiveFielders =
    fielders && fielders.length > 0
      ? fielders
      : delivery.outcome.wicket?.kind === "CAUGHT"
      ? delivery.outcome.wicket.fielders
      : undefined;

  if (effectiveVerdict === "OUT") {
    // Under MCC Laws (Law 20.1.1.3, Law 33), the ball becomes dead when catch is completed inside boundary;
    // extras (byes, leg byes, wides) and batter runs are not scored on a boundary catch.
    const drsOutcome: BallOutcome = {
      runsBatter: 0,
      runsExtras: undefined,
      extras: undefined,
      wicket: {
        kind: "CAUGHT",
        playerOut,
        fielders: effectiveFielders,
      },
    };

    return {
      ballId: delivery.id,
      incidentType: "BOUNDARY",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason:
        reason ??
        `Boundary Catch: Evaluated as OUT (${playerOut} cleanly caught inside rope)`,
    };
  } else {
    // If baseline had a wicket (on-field catch overturned), default to 4 boundary runs.
    // If baseline had NO wicket, preserve baseline runs unless explicitBoundaryRuns is specified.
    const awardedRuns =
      explicitBoundaryRuns !== undefined
        ? explicitBoundaryRuns
        : delivery.outcome.wicket
        ? (delivery.outcome.runsBatter >= 4 ? delivery.outcome.runsBatter : 4)
        : delivery.outcome.runsBatter;

    // If No Ball was explicitly flagged and baseline lacked No Ball extra, award 1-run penalty
    const awardedExtras =
      isNoBallDelivery && explicitNoBall === true && delivery.outcome.extras?.type !== "NO_BALLS"
        ? {
            runsExtras: (delivery.outcome.runsExtras ?? 0) + 1,
            extras: { type: "NO_BALLS" as const, runs: 1 },
          }
        : {
            runsExtras: delivery.outcome.runsExtras,
            extras: delivery.outcome.extras,
          };

    const drsOutcome: BallOutcome =
      delivery.outcome.wicket || explicitBoundaryRuns !== undefined || (isNoBallDelivery && explicitNoBall === true)
        ? {
            runsBatter: awardedRuns,
            ...awardedExtras,
          }
        : delivery.outcome;

    const defaultReason = isNoBallDelivery
      ? `Boundary Catch: Evaluated as NOT OUT (delivery is a No Ball; Law 33.1 dictates batter cannot be caught)`
      : `Boundary Catch: Evaluated as NOT OUT (boundary cushion contact; ${awardedRuns} runs awarded)`;

    return {
      ballId: delivery.id,
      incidentType: "BOUNDARY",
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? defaultReason,
    };
  }
}

/**
 * Discriminated union of parameters for all 5 DRS consequence incident types.
 */
export type DrsConsequenceParams =
  | ({ readonly incidentType: "LBW" } & LbwDrsConsequenceParams)
  | ({ readonly incidentType: "RUN_OUT" } & RunOutDrsConsequenceParams)
  | ({ readonly incidentType: "STUMPING" } & StumpingDrsConsequenceParams)
  | ({ readonly incidentType: "CAUGHT_BEHIND" } & CaughtBehindDrsConsequenceParams)
  | ({ readonly incidentType: "BOUNDARY" } & BoundaryDrsConsequenceParams);

/**
 * Unified pure dispatcher: Translates any evaluated DRS incident into a sparse DrsOutcomeOverride.
 * Delegates to the incident-specific consequence generator based on `incidentType`.
 */
export function createDrsConsequence(
  params: DrsConsequenceParams
): DrsOutcomeOverride {
  switch (params.incidentType) {
    case "LBW":
      return createLbwDrsConsequence(params);
    case "RUN_OUT":
      return createRunOutDrsConsequence(params);
    case "STUMPING":
      return createStumpingDrsConsequence(params);
    case "CAUGHT_BEHIND":
      return createCaughtBehindDrsConsequence(params);
    case "BOUNDARY":
      return createBoundaryDrsConsequence(params);
    default: {
      const type = (params as { readonly incidentType?: string })?.incidentType;
      throw new Error(`Unsupported DRS incident type: ${type}`);
    }
  }
}


