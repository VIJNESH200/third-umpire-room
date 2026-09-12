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
  overlayMap: DrsOverlayMap
): BallOutcome {
  const override = overlayMap.get(delivery.id);
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
  overlayMap: DrsOverlayMap
): EffectiveBall {
  const effectiveOutcome = deriveEffectiveOutcome(delivery, overlayMap);
  const isOverridden = effectiveOutcome !== delivery.outcome;
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
  overlayMap: DrsOverlayMap
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
    const override = overlayMap.get(d.id);
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
    initialOverlays?: ReadonlyMap<string, DrsOutcomeOverride>
  ) {
    this.match = match;
    this._overlays = new Map<string, DrsOutcomeOverride>(initialOverlays ?? []);
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
 * Parameters required to translate an evaluated LBW DRS incident into a sparse DRS outcome override.
 * Fully decoupled from LBW physics: only takes the evaluated DRS verdict and the immutable target delivery.
 */
export interface LbwDrsConsequenceParams {
  /** Target delivery on which the LBW appeal and DRS review took place */
  readonly delivery: RealDelivery;
  /** Evaluated final verdict produced by the DRS LBW rule engine */
  readonly verdict: "OUT" | "NOT_OUT";
  /** Original on-field signal by the standing umpire ("OUT" or "NOT_OUT") */
  readonly onFieldSignal: "OUT" | "NOT_OUT" | "REFERRED";
  /** Which team initiated the review (defaults to BOWLING if on-field was NOT_OUT, BATTING if OUT) */
  readonly reviewingSide?: "BATTING" | "BOWLING";
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
 *
 * Zero-copy: Never mutates or clones the delivery; only references delivery.id and baseline outcome.
 */
export function createLbwDrsConsequence(
  params: LbwDrsConsequenceParams
): DrsOutcomeOverride {
  const {
    delivery,
    verdict,
    onFieldSignal,
    reviewingSide: explicitSide,
    reason,
    isUmpiresCall = false,
  } = params;

  // Infer reviewing side if not explicitly provided
  const reviewingSide: "BATTING" | "BOWLING" =
    explicitSide ?? (onFieldSignal === "OUT" ? "BATTING" : "BOWLING");

  // Review retention logic under ICC DRS rules:
  // - Review is retained if the decision was overturned (successful review).
  // - Review is retained if Umpire's Call was upheld (margin of error protection).
  // - Review is lost ONLY if the on-field decision stood and was NOT Umpire's Call (unsuccessful review).
  let reviewRetained = true;
  if (reviewingSide === "BOWLING") {
    if (verdict === "OUT") {
      // Overturned from NOT_OUT to OUT (or confirmed OUT) -> review successful, retained
      reviewRetained = true;
    } else {
      // NOT_OUT outcome: if umpire's call, review retained; if clean miss/not out, review lost
      reviewRetained = isUmpiresCall;
    }
  } else {
    // BATTING side review
    if (verdict === "NOT_OUT") {
      // Overturned from OUT to NOT_OUT -> review successful, retained
      reviewRetained = true;
    } else {
      // OUT confirmed: if umpire's call, review retained; if clearly hitting, review lost
      reviewRetained = isUmpiresCall;
    }
  }

  if (verdict === "OUT") {
    // Effective delivery becomes an LBW wicket for the striker facing the ball
    const drsOutcome: BallOutcome = {
      runsBatter: 0,
      runsExtras: delivery.outcome.runsExtras,
      extras: delivery.outcome.extras,
      wicket: {
        kind: "LBW",
        playerOut: delivery.striker,
      },
    };

    return {
      ballId: delivery.id,
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? `LBW: Evaluated as OUT (${delivery.striker} dismissed)`,
    };
  } else {
    // Effective delivery retains baseline non-wicket outcome
    // If baseline had a wicket (e.g. on-field out overturned), strip the wicket; otherwise keep outcome
    const drsOutcome: BallOutcome = delivery.outcome.wicket
      ? {
          runsBatter: delivery.outcome.runsBatter,
          runsExtras: delivery.outcome.runsExtras,
          extras: delivery.outcome.extras,
        }
      : delivery.outcome;

    return {
      ballId: delivery.id,
      originalOutcome: delivery.outcome,
      drsOutcome,
      applied: true,
      reviewingSide,
      reviewRetained,
      reason: reason ?? `LBW: Evaluated as NOT OUT`,
    };
  }
}

