/**
 * src/engine/realMatchGameSession.ts
 *
 * Lightweight, zero-copy gameplay controller for Playable Real Match DRS Mode.
 *
 * Coordinates:
 * 1. Ball-by-ball canonical match playback progression (using RealMatchPlaybackSession).
 * 2. Deterministic DRS incident injection (using RealMatchIncidentSelector).
 * 3. Review pausing: playback pauses when a DRS incident occurs; user decision required before continuing.
 * 4. Consequence bridging: translates user verdicts into sparse DrsOutcomeOverrides.
 * 5. Effective scoreboard projections: tracks live runs, wickets, overs, and DRS review quotas.
 * 6. Innings transitions & match completion summary.
 *
 * Immutability Guarantee:
 * The underlying `RealMatch` is never cloned or mutated. Overlays are stored sparsely.
 */

import type {
  RealMatch,
  EffectiveBall,
  MatchPlaybackState,
  DrsOutcomeOverride,
  DrsOverlayMap,
  RealMatchDrsIncident,
} from "../types/realMatch";
import type { DecisionVerdict } from "../types/scenario";
import { RealMatchPlaybackSession, createDrsConsequence, type DrsConsequenceParams } from "./realMatchPlayback";
import {
  createRealMatchIncidentSchedule,
  type RealMatchIncidentConfig,
} from "./realMatchIncidentSelector";

export type RealMatchGameStatus =
  | "NORMAL_PLAYBACK"
  | "REVIEW_REQUIRED"
  | "INNINGS_BREAK"
  | "MATCH_COMPLETE";

export interface DecisionRecord {
  readonly deliveryId: string;
  readonly incident: RealMatchDrsIncident;
  readonly verdict: DecisionVerdict;
  readonly override: DrsOutcomeOverride;
  readonly timestampMs: number;
}

export interface RealMatchGameResult {
  readonly completed: boolean;
  readonly innings1Score: number;
  readonly innings1Wickets: number;
  readonly innings2Score: number;
  readonly innings2Wickets: number;
  readonly winnerTeamId: string | null;
  readonly marginDescription: string;
  readonly totalReviewsConducted: number;
  readonly reviewsOverturned: number;
  readonly reviewsUpheld: number;
}

export interface RealMatchGameSessionOptions {
  readonly incidentCount?: number;
  readonly selectorConfig?: Omit<RealMatchIncidentConfig, "excludedDeliveryIds">;
  readonly customIncidents?: readonly RealMatchDrsIncident[];
}

export class RealMatchGameSession {
  public readonly match: RealMatch;
  public readonly sessionSeed: number;
  public readonly incidentCount: number;

  private readonly _playbackSession: RealMatchPlaybackSession;
  private readonly _scheduledIncidents: Map<string, RealMatchDrsIncident>;
  private readonly _decisions: Map<string, DecisionRecord>;
  private _status: RealMatchGameStatus;

  constructor(
    match: RealMatch,
    sessionSeed: number = Date.now(),
    options?: RealMatchGameSessionOptions
  ) {
    this.match = match;
    this.sessionSeed = sessionSeed;
    this.incidentCount = options?.incidentCount ?? 8;
    this._playbackSession = new RealMatchPlaybackSession(match);
    this._decisions = new Map<string, DecisionRecord>();
    this._scheduledIncidents = new Map<string, RealMatchDrsIncident>();

    // 1. Register incidents (either custom or deterministically scheduled)
    if (options?.customIncidents) {
      for (const inc of options.customIncidents) {
        this._scheduledIncidents.set(inc.deliveryId, inc);
      }
    } else {
      const schedule = createRealMatchIncidentSchedule(
        match,
        sessionSeed,
        this.incidentCount,
        options?.selectorConfig
      );
      for (const inc of schedule) {
        this._scheduledIncidents.set(inc.deliveryId, inc);
      }
    }

    // 2. Set initial status
    this._status = "NORMAL_PLAYBACK";
    this._syncStatus();
  }

  /**
   * Internal helper: Synchronizes current game status based on cursor position and review requirements.
   */
  private _syncStatus(): void {
    const currentBall = this._playbackSession.getCurrentDelivery();
    if (!currentBall) {
      this._status = "NORMAL_PLAYBACK";
      return;
    }

    const scheduled = this._scheduledIncidents.get(currentBall.delivery.id);
    if (scheduled && !this._decisions.has(scheduled.deliveryId)) {
      this._status = "REVIEW_REQUIRED";
      return;
    }

    if (this._status === "REVIEW_REQUIRED") {
      this._status = "NORMAL_PLAYBACK";
    } else {
      const state = this._playbackSession.getCurrentState();
      if (!state.isComplete) {
        this._status = "NORMAL_PLAYBACK";
      }
    }
  }

  /**
   * Returns current operational status of the real-match session.
   */
  public getStatus(): RealMatchGameStatus {
    return this._status;
  }

  /**
   * Returns true if playback is currently paused waiting for a third-umpire DRS review decision.
   */
  public isPausedForReview(): boolean {
    return this._status === "REVIEW_REQUIRED";
  }

  /**
   * Returns the effective ball at the current cursor position, or null if uninitialized.
   */
  public getCurrentDelivery(): EffectiveBall | null {
    return this._playbackSession.getCurrentDelivery();
  }

  /**
   * Computes and returns the complete real-match playback state at the current position.
   */
  public getPlaybackState(): MatchPlaybackState {
    return this._playbackSession.getCurrentState();
  }

  /**
   * Returns the DRS incident attached to the current delivery, if any.
   */
  public getCurrentIncident(): RealMatchDrsIncident | null {
    const currentBall = this._playbackSession.getCurrentDelivery();
    if (!currentBall) return null;
    return this._scheduledIncidents.get(currentBall.delivery.id) ?? null;
  }

  /**
   * Returns all scheduled DRS incidents for this match session as a read-only list.
   */
  public getScheduledIncidents(): readonly RealMatchDrsIncident[] {
    return Array.from(this._scheduledIncidents.values());
  }

  /**
   * Returns all DRS decisions rendered so far in this session.
   */
  public getDecisionsHistory(): readonly DecisionRecord[] {
    return Array.from(this._decisions.values());
  }

  /**
   * Advances playback to the next delivery.
   *
   * GATING RULE:
   * Playback CANNOT advance past a delivery with an unresolved DRS incident.
   * If `isPausedForReview()` is true, this method returns false without moving.
   */
  public stepForward(): boolean {
    if (this.isPausedForReview()) {
      return false;
    }

    const advanced = this._playbackSession.stepForward();
    if (!advanced) {
      this._status = "MATCH_COMPLETE";
      return false;
    }

    this._syncStatus();
    return true;
  }

  /**
   * Steps playback back to the previous delivery.
   */
  public stepBackward(): boolean {
    const stepped = this._playbackSession.stepBackward();
    if (stepped) {
      this._syncStatus();
    }
    return stepped;
  }

  /**
   * Jumps the playback cursor directly to a specific delivery.
   */
  public seekTo(inningsIndex: number, deliveryIndex: number): boolean {
    const jumped = this._playbackSession.seekTo(inningsIndex, deliveryIndex);
    if (jumped) {
      this._syncStatus();
    }
    return jumped;
  }

  /**
   * Fast-forwards delivery-by-delivery until the next unresolved DRS incident is reached,
   * or until the match finishes.
   * Returns true if paused at an unresolved incident, or false if match completed.
   */
  public jumpToNextIncident(): boolean {
    if (this.isPausedForReview()) {
      return true;
    }

    while (!this._playbackSession.getCurrentState().isComplete) {
      const advanced = this._playbackSession.stepForward();
      if (!advanced) break;

      this._syncStatus();
      if (this.isPausedForReview()) {
        return true;
      }
    }

    // Check if the final delivery has an unresolved incident
    this._syncStatus();
    if (this.isPausedForReview()) {
      return true;
    }

    this._status = "MATCH_COMPLETE";
    return false;
  }

  /**
   * Submits a user decision for the active DRS incident on the current delivery.
   * Translates the verdict into a DRS consequence overlay, applies it to the playback engine,
   * unpauses the session, and returns the applied overlay.
   */
  public submitDecision(
    verdict: DecisionVerdict,
    options?: {
      readonly dismissedBatter?: string;
      readonly boundaryRuns?: number;
      readonly reason?: string;
    }
  ): DrsOutcomeOverride {
    const currentBall = this._playbackSession.getCurrentDelivery();
    if (!currentBall) {
      throw new Error("Cannot submit decision: no active delivery");
    }

    const incident = this._scheduledIncidents.get(currentBall.delivery.id);
    if (!incident) {
      throw new Error(`Cannot submit decision: delivery ${currentBall.delivery.id} has no DRS incident`);
    }

    const delivery = currentBall.delivery;
    const scenario = incident.scenario;
    const onFieldSignal = scenario.onFieldSignal;
    const reason =
      options?.reason &&
      options.reason.trim() !== "" &&
      options.reason.trim().toUpperCase() !== "STANDARD"
        ? options.reason.trim()
        : scenario.drsEvaluation.explanation;

    let params: DrsConsequenceParams;

    switch (incident.incidentType) {
      case "LBW":
        params = {
          incidentType: "LBW",
          delivery,
          verdict,
          onFieldSignal,
          isNoBall: scenario.lbw?.isNoBall,
          isUmpiresCall: scenario.drsEvaluation.isUmpiresCall,
          reason,
        };
        break;

      case "RUN_OUT":
        params = {
          incidentType: "RUN_OUT",
          delivery,
          verdict,
          onFieldSignal,
          dismissedBatter: options?.dismissedBatter ?? delivery.striker,
          reason,
        };
        break;

      case "STUMPING":
        params = {
          incidentType: "STUMPING",
          delivery,
          verdict,
          onFieldSignal,
          dismissedBatter: options?.dismissedBatter ?? delivery.striker,
          reason,
        };
        break;

      case "CAUGHT_BEHIND":
        params = {
          incidentType: "CAUGHT_BEHIND",
          delivery,
          verdict,
          onFieldSignal,
          dismissedBatter: options?.dismissedBatter ?? delivery.striker,
          reason,
        };
        break;

      case "BOUNDARY":
        params = {
          incidentType: "BOUNDARY",
          delivery,
          verdict,
          onFieldSignal,
          dismissedBatter: options?.dismissedBatter ?? delivery.striker,
          boundaryRuns: options?.boundaryRuns ?? (delivery.outcome.runsBatter === 6 || scenario.boundary?.catchOrSave === "OVER_THE_ROPE" ? 6 : 4),
          reason,
        };
        break;
    }

    const override = createDrsConsequence(params);

    // Apply overlay to the playback engine
    this._playbackSession.applyOverlay(override);

    // Record the rendered decision
    const record: DecisionRecord = {
      deliveryId: delivery.id,
      incident,
      verdict,
      override,
      timestampMs: Date.now(),
    };
    this._decisions.set(delivery.id, record);

    // Synchronize status (unpauses review)
    this._syncStatus();

    return override;
  }

  /**
   * Removes a DRS consequence overlay for a delivery, reverting it to canonical real baseline.
   */
  public removeOverlay(deliveryId: string): boolean {
    const removed = this._playbackSession.removeOverlay(deliveryId);
    this._decisions.delete(deliveryId);
    this._syncStatus();
    return removed;
  }

  /**
   * Returns a snapshot of all active DRS outcome overrides.
   */
  public getOverlays(): DrsOverlayMap {
    return this._playbackSession.getOverlays();
  }

  /**
   * Computes the total effective runs and wickets for an innings considering active DRS consequence overlays.
   */
  public getInningsEffectiveScore(inningsIndex: number): { readonly score: number; readonly wickets: number } {
    const innings = this.match.innings[inningsIndex];
    if (!innings) return { score: 0, wickets: 0 };

    const overlays = this._playbackSession.getOverlays();
    let score = 0;
    let wickets = 0;
    for (const d of innings.deliveries) {
      const ov = overlays.get(d.id);
      const outcome = ov && ov.applied ? ov.drsOutcome : d.outcome;
      score += outcome.runsBatter + (outcome.runsExtras ?? 0);
      if (outcome.wicket) wickets++;
    }
    return { score, wickets };
  }

  /**
   * Computes the final effective match outcome and review stats.
   */
  public getMatchResult(): RealMatchGameResult {
    const inn1 = this.match.innings[0];
    const inn2 = this.match.innings[1];
    const state1 = this._playbackSession.getCurrentState();

    const inn1Stats = this.getInningsEffectiveScore(0);
    const inn2Stats = this.getInningsEffectiveScore(1);

    const inn1Score = inn1Stats.score;
    const inn1Wickets = inn1Stats.wickets;
    const inn2Score = inn2Stats.score;
    const inn2Wickets = inn2Stats.wickets;

    let winnerTeamId: string | null = null;
    let marginDescription = "";

    const target = inn1Score + 1;
    if (inn2Score >= target) {
      winnerTeamId = inn2?.battingTeamId ?? "AWAY";
      const wktsLeft = Math.max(0, 10 - inn2Wickets);
      marginDescription = `${winnerTeamId} won by ${wktsLeft} wicket${wktsLeft === 1 ? "" : "s"}`;
    } else if (inn2Score === target - 1) {
      winnerTeamId = null;
      marginDescription = "Match Tied (Scores Level)";
    } else {
      winnerTeamId = inn1?.battingTeamId ?? "HOME";
      const runMargin = inn1Score - inn2Score;
      marginDescription = `${winnerTeamId} won by ${runMargin} run${runMargin === 1 ? "" : "s"}`;
    }

    // Review counts: check if final DRS outcome altered the on-field decision or baseline wicket outcome
    let reviewsOverturned = 0;
    let reviewsUpheld = 0;
    for (const d of this._decisions.values()) {
      const onField = d.incident.scenario.onFieldSignal;
      let overturned = false;
      if (onField === "OUT") {
        overturned = d.verdict === "NOT_OUT";
      } else if (onField === "NOT_OUT") {
        overturned = d.verdict === "OUT";
      } else {
        // REFERRED (umpire referral): overturned if DRS changed the baseline wicket outcome
        const originalHadWicket = Boolean(d.override.originalOutcome.wicket);
        const drsHasWicket = Boolean(d.override.drsOutcome.wicket);
        overturned = originalHadWicket !== drsHasWicket;
      }

      if (overturned) {
        reviewsOverturned++;
      } else {
        reviewsUpheld++;
      }
    }

    return {
      completed: state1.isComplete,
      innings1Score: inn1Score,
      innings1Wickets: inn1Wickets,
      innings2Score: inn2Score,
      innings2Wickets: inn2Wickets,
      winnerTeamId,
      marginDescription,
      totalReviewsConducted: this._decisions.size,
      reviewsOverturned,
      reviewsUpheld,
    };
  }
}
