/**
 * src/engine/thirdUmpireGameSession.ts
 *
 * Authoritative gameplay workflow and session controller for the Third Umpire Room.
 * Coordinates the full playable Third Umpire DRS loop:
 *
 * MATCH CONTEXT
 *       ↓
 * INCIDENT
 *       ↓
 * ON-FIELD DECISION
 *       ↓
 * REVIEW REQUEST
 *       ↓
 * DRS WORKSTATION
 *       ↓
 * EVIDENCE INSPECTION
 *       ↓
 * PLAYER VERDICT
 *       ↓
 * OFFICIAL RESULT
 *       ↓
 * CONSEQUENCE
 *       ↓
 * NEXT INCIDENT
 *
 * Principles:
 * 1. DRS physics & scenario generator remain the source of physical truth.
 * 2. Session controller manages gameplay stages, quotas, immutability, and consequences.
 * 3. Once-only submission: completed decisions cannot be mutated or overwritten.
 * 4. Deterministic scenario progression: same seed produces identical incidents.
 */

import type {
  Scenario,
  DecisionVerdict,
  PlayerVerdictChoice,
  IncidentResult,
  SessionStats,
  IncidentType,
} from "../types/scenario";
import type { RemainingReviews, ReviewingSide } from "../types/matchContext";
import { generateSessionIncidents } from "./randomIncidentEngine";
import { checkDRSCompliance } from "./drsRules";
import { calculateReviewRetention } from "./realMatchPlayback";
import { computeSessionStats } from "./scoring";

export type GameplayStage =
  | "INCIDENT_INTRO"
  | "ON_FIELD_DECISION"
  | "REVIEW_ENTRY"
  | "REVIEW_ACTIVE"
  | "VERDICT_SUBMITTED"
  | "RESULT_REVEAL"
  | "CONSEQUENCE"
  | "SESSION_COMPLETE";

export interface ThirdUmpireDecisionRecord {
  readonly scenarioId: string;
  readonly scenario: Scenario;
  readonly playerVerdict: PlayerVerdictChoice;
  readonly effectiveVerdict: DecisionVerdict;
  readonly isVerdictCorrect: boolean;
  readonly isOverturn: boolean;
  readonly reviewRetained: boolean;
  readonly reviewingSide?: ReviewingSide;
  readonly timestampMs: number;
  readonly result: IncidentResult;
}

export interface ThirdUmpireSessionOptions {
  readonly startingReviews?: RemainingReviews;
  readonly forcedType?: IncidentType;
  readonly initialStage?: GameplayStage;
}

export class ThirdUmpireGameSession {
  public readonly sessionSeed: number;
  public readonly totalIncidents: number;
  private readonly _scenarios: Scenario[];
  private _currentIndex: number = 0;
  private _stage: GameplayStage = "INCIDENT_INTRO";
  private _remainingReviews: RemainingReviews = { batting: 2, bowling: 2 };
  private _decisions: Map<string, ThirdUmpireDecisionRecord> = new Map();
  private _decidedIds: Set<string> = new Set();
  private _history: IncidentResult[] = [];
  private _currentResult: IncidentResult | null = null;
  private _reviewStartTimeMs: number = 0;

  constructor(
    scenariosOrCount: Scenario[] | number,
    sessionSeed: number = Date.now(),
    options?: ThirdUmpireSessionOptions
  ) {
    this.sessionSeed = sessionSeed;

    if (Array.isArray(scenariosOrCount)) {
      this._scenarios = [...scenariosOrCount];
      this.totalIncidents = this._scenarios.length;
    } else {
      const count = scenariosOrCount;
      this.totalIncidents = count;
      if (options?.forcedType) {
        const forced = options.forcedType;
        this._scenarios = generateSessionIncidents(sessionSeed, count, {
          weights: {
            LBW: forced === "LBW" ? 1 : 0,
            RUN_OUT: forced === "RUN_OUT" ? 1 : 0,
            CAUGHT_BEHIND: forced === "CAUGHT_BEHIND" ? 1 : 0,
            STUMPING: forced === "STUMPING" ? 1 : 0,
            BOUNDARY: forced === "BOUNDARY" ? 1 : 0,
          },
        });
      } else {
        this._scenarios = generateSessionIncidents(sessionSeed, count);
      }
    }

    if (options?.startingReviews) {
      this._remainingReviews = { ...options.startingReviews };
    }

    if (options?.initialStage) {
      this._stage = options.initialStage;
    } else {
      this._stage = "INCIDENT_INTRO";
    }
  }

  // --- Read-only State Accessors ---

  public getCurrentScenario(): Scenario | null {
    if (this._currentIndex >= this._scenarios.length) return null;
    return this._scenarios[this._currentIndex] ?? null;
  }

  public getCurrentIndex(): number {
    return this._currentIndex;
  }

  public getStage(): GameplayStage {
    return this._stage;
  }

  public getRemainingReviews(): RemainingReviews {
    return { ...this._remainingReviews };
  }

  public getCurrentResult(): IncidentResult | null {
    return this._currentResult;
  }

  public getDecisionsHistory(): readonly ThirdUmpireDecisionRecord[] {
    return Array.from(this._decisions.values());
  }

  public getIncidentHistory(): readonly IncidentResult[] {
    return [...this._history];
  }

  public isDecided(): boolean {
    const scenario = this.getCurrentScenario();
    if (!scenario) return false;
    return this._decidedIds.has(scenario.id);
  }

  // --- Quota & Review Eligibility Rules ---

  /**
   * Determines which party would initiate the review and whether that party
   * has sufficient DRS review quota to proceed.
   * Direct on-field umpire referrals (Run Out, Stumping, Boundary) never consume quota.
   */
  public getReviewEligibility(): {
    readonly isTeamReview: boolean;
    readonly reviewingSide?: ReviewingSide;
    readonly quotaAvailable: number;
    readonly canReview: boolean;
    readonly reason?: string;
  } {
    const scenario = this.getCurrentScenario();
    if (!scenario) {
      return { isTeamReview: false, quotaAvailable: 0, canReview: false, reason: "No active incident" };
    }

    const isTeamReview = scenario.incidentType === "LBW" || scenario.incidentType === "CAUGHT_BEHIND";
    if (!isTeamReview || scenario.onFieldSignal === "REFERRED") {
      return {
        isTeamReview: false,
        reviewingSide: "UMPIRE",
        quotaAvailable: 99,
        canReview: true,
      };
    }

    const reviewingSide: ReviewingSide = scenario.onFieldSignal === "OUT" ? "BATTING" : "BOWLING";
    const quotaAvailable = reviewingSide === "BATTING" ? this._remainingReviews.batting : this._remainingReviews.bowling;

    if (quotaAvailable <= 0) {
      return {
        isTeamReview: true,
        reviewingSide,
        quotaAvailable: 0,
        canReview: false,
        reason: `Review unavailable: ${reviewingSide} side has 0 reviews remaining. On-field decision stands.`,
      };
    }

    return {
      isTeamReview: true,
      reviewingSide,
      quotaAvailable,
      canReview: true,
    };
  }

  // --- Workflow Transitions ---

  /**
   * Transition 1: Moves from INCIDENT_INTRO to ON_FIELD_DECISION.
   */
  public advanceToOnFieldDecision(): boolean {
    if (this._stage !== "INCIDENT_INTRO") return false;
    this._stage = "ON_FIELD_DECISION";
    return true;
  }

  /**
   * Transition 2: Initiates DRS review from ON_FIELD_DECISION.
   * Gated by quota check: returns false if reviewing team has 0 quota.
   */
  public initiateReview(): boolean {
    const eligibility = this.getReviewEligibility();
    if (!eligibility.canReview) {
      return false;
    }
    this._stage = "REVIEW_ENTRY";
    return true;
  }

  /**
   * Transition 3: Opens the active DRS Workstation from REVIEW_ENTRY.
   */
  public enterWorkstation(): boolean {
    if (this._stage !== "REVIEW_ENTRY" && this._stage !== "ON_FIELD_DECISION" && this._stage !== "INCIDENT_INTRO") {
      return false;
    }
    this._reviewStartTimeMs = Date.now();
    this._stage = "REVIEW_ACTIVE";
    return true;
  }

  /**
   * Transition 4 & 5: Submits the player's final verdict.
   * Enforces Once-Only Decision Invariant: duplicate submissions return existing record idempotently.
   */
  public submitVerdict(
    verdictChoice: PlayerVerdictChoice,
    options?: {
      readonly dismissalReason?: string;
      readonly playerBatGroundedMs?: number | null;
      readonly playerBailsDislodgedMs?: number | null;
      readonly softSignalChoice?: "OUT" | "NOT_OUT" | "SEND_UPSTAIRS" | null;
      readonly softSignalElapsedMs?: number;
    }
  ): IncidentResult | null {
    const scenario = this.getCurrentScenario();
    if (!scenario) return null;

    // 1. Once-Only Invariant: duplicate submission returns existing result without modifying quota or history
    if (this._decidedIds.has(scenario.id)) {
      console.warn(`Decision already submitted for scenario ${scenario.id}: DRS verdicts are immutable`);
      return this._currentResult;
    }

    const onFieldSignal = scenario.onFieldSignal;
    const physicalTruth = scenario.correctFinalVerdict;

    // Resolve effective decision verdict
    // If player chose SEND_UPSTAIRS (inconclusive / uphold on-field), the on-field call stands
    const effectiveVerdict: DecisionVerdict =
      verdictChoice === "SEND_UPSTAIRS"
        ? (onFieldSignal === "OUT" ? "OUT" : "NOT_OUT")
        : verdictChoice;

    const isVerdictCorrect = verdictChoice !== "SEND_UPSTAIRS" && effectiveVerdict === physicalTruth;
    const isOverturn = onFieldSignal !== "REFERRED" && onFieldSignal !== physicalTruth;

    // Evaluate compliance with ICC DRS rules (including Umpire's Call adherence)
    const compliance = checkDRSCompliance(
      scenario.incidentType,
      effectiveVerdict,
      onFieldSignal,
      scenario.drsEvaluation
    );

    // Calculate review retention under ICC rules
    const retentionInfo = calculateReviewRetention({
      verdict: effectiveVerdict,
      onFieldSignal,
      isUmpiresCall: scenario.drsEvaluation.isUmpiresCall,
    });

    // Quota deduction: if review was lost, decrement from reviewing team
    if (retentionInfo.reviewingSide && !retentionInfo.reviewRetained) {
      if (retentionInfo.reviewingSide === "BATTING") {
        this._remainingReviews.batting = Math.max(0, this._remainingReviews.batting - 1);
      } else if (retentionInfo.reviewingSide === "BOWLING") {
        this._remainingReviews.bowling = Math.max(0, this._remainingReviews.bowling - 1);
      }
    }

    const softSignal = options?.softSignalChoice ?? null;
    const isSoftCorrect =
      softSignal !== null &&
      softSignal !== "SEND_UPSTAIRS" &&
      softSignal === physicalTruth;

    const timeSpent = this._reviewStartTimeMs > 0 ? Date.now() - this._reviewStartTimeMs : 4000;

    const result: IncidentResult = {
      scenarioId: scenario.id,
      incidentType: scenario.incidentType,
      difficultyTier: scenario.difficultyTier,
      softSignal,
      softSignalTimeMs: options?.softSignalElapsedMs ?? 0,
      softSignalCorrect: isSoftCorrect,
      finalVerdict: effectiveVerdict,
      finalVerdictCorrect: isVerdictCorrect,
      isUmpiresCallScenario: scenario.drsEvaluation.isUmpiresCall,
      umpiresCallComplied: compliance.complied,
      timeSpentReviewingMs: timeSpent,
      toolsUsed: [scenario.incidentType],
      playerBatGroundedMs: options?.playerBatGroundedMs ?? null,
      playerBailsDislodgedMs: options?.playerBailsDislodgedMs ?? null,
    };

    const record: ThirdUmpireDecisionRecord = {
      scenarioId: scenario.id,
      scenario,
      playerVerdict: verdictChoice,
      effectiveVerdict,
      isVerdictCorrect,
      isOverturn,
      reviewRetained: retentionInfo.reviewRetained,
      reviewingSide: retentionInfo.reviewingSide,
      timestampMs: Date.now(),
      result,
    };

    this._decisions.set(scenario.id, record);
    this._decidedIds.add(scenario.id);
    this._currentResult = result;
    this._history.push(result);
    this._stage = "RESULT_REVEAL";

    return result;
  }

  /**
   * Transition 6: Moves to next incident or marks session complete.
   * Completely resets per-incident transient state (verdict, timings, startTime)
   * while carrying forward remaining reviews and match record.
   */
  public nextIncident(): boolean {
    const nextIndex = this._currentIndex + 1;
    if (nextIndex < this._scenarios.length) {
      this._currentIndex = nextIndex;
      this._currentResult = null;
      this._reviewStartTimeMs = 0;
      this._stage = "INCIDENT_INTRO";
      return true;
    }

    this._stage = "SESSION_COMPLETE";
    return false;
  }

  /**
   * Computes aggregate session statistics across all adjudicated incidents.
   */
  public computeStats(): SessionStats {
    return computeSessionStats(this._history);
  }

  /**
   * Explicitly jumps stage for testing / dev overrides.
   */
  public setStage(stage: GameplayStage): void {
    this._stage = stage;
  }
}
