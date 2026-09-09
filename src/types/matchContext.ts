import type { IncidentType, OnFieldSignal, Scenario } from "./scenario";

/**
 * Standard cricket match formats supported by the Third Umpire Room.
 */
export type MatchFormat = "TEST" | "ODI" | "T20";

/**
 * Side initiating the review or adjudication:
 * - BATTING: Batting team reviews an on-field OUT decision (e.g. LBW, Caught Behind).
 * - BOWLING: Bowling team reviews an on-field NOT OUT decision.
 * - UMPIRE: On-field umpires refer line or boundary decisions (Run Out, Stumping, Boundary).
 */
export type ReviewingSide = "BATTING" | "BOWLING" | "UMPIRE";

/**
 * Remaining DRS reviews for each team in the match / innings.
 */
export interface RemainingReviews {
  batting: number;
  bowling: number;
}

/**
 * Macro match context representing the high-level state of a cricket match for League Mode.
 * Decoupled from single-delivery forensic evidence and player career records.
 */
export interface MatchContext {
  /** Unique match identifier (e.g. "MTCH-2026-T20-001") */
  matchId: string;
  /** Competition or tournament name (e.g. "T20 World Championship Final") */
  tournament: string;
  /** Cricket match format */
  format: MatchFormat;
  /** Name or identifier of the batting team */
  battingTeam: string;
  /** Name or identifier of the bowling / fielding team */
  bowlingTeam: string;
  /** Active innings number (1 or 2 for limited overs; 1 to 4 for Test matches) */
  innings: number;
  /** Total runs scored by the batting team in the current innings */
  runs: number;
  /** Total wickets lost by the batting team in the current innings */
  wickets: number;
  /** Completed overs bowled in the current innings */
  overs: number;
  /** Current ball position within the active over (0 to 6) */
  ballInOver: number;
  /** Target score to win, applicable when batting in 2nd/4th innings */
  target?: number;
  /** Remaining DRS reviews available to each team, when applicable */
  remainingReviews?: RemainingReviews;
}

/**
 * Delivery-level incident context representing the specific delivery
 * that triggered the DRS review or third umpire referral.
 * Acts as the bridge between macro MatchContext and DRS forensic telemetry.
 */
export interface IncidentContext {
  /** 0-based sequential index of this incident within the match or session */
  incidentIndex: number;
  /** Over in which the delivery occurred (completed overs) */
  over: number;
  /** Ball within the over (1 to 6) */
  ballInOver: number;
  /** The specific cricket dismissal or event being evaluated */
  incidentType: IncidentType;
  /** Batter facing the delivery (striker) */
  striker: string;
  /** Non-striking batter at the opposite end, if applicable */
  nonStriker?: string;
  /** Bowler delivering the ball */
  bowler: string;
  /** The party initiating the review / referral (BATTING, BOWLING, or UMPIRE) */
  reviewingSide?: ReviewingSide;
  /** Initial on-field decision or referral signal */
  onFieldSignal: OnFieldSignal;
  /** Deterministic random seed used to generate the scenario's physics and forensic data */
  scenarioSeed: number;
}

/**
 * Utility bridge function to derive an IncidentContext from an existing Scenario.
 * Enables backwards-compatible integration of legacy scenarios into the new incident model.
 */
export function createIncidentContextFromScenario(
  scenario: Scenario,
  incidentIndex: number = 0,
  scenarioSeed?: number
): IncidentContext {
  // If the scenario already has an incidentContext, preserve it while allowing
  // incidentIndex or scenarioSeed override when explicitly provided.
  if (scenario.incidentContext) {
    return {
      ...scenario.incidentContext,
      incidentIndex: incidentIndex !== 0 ? incidentIndex : scenario.incidentContext.incidentIndex,
      scenarioSeed: scenarioSeed !== undefined ? scenarioSeed : scenario.incidentContext.scenarioSeed,
    };
  }

  const reviewingSide: ReviewingSide =
    scenario.onFieldSignal === "REFERRED"
      ? "UMPIRE"
      : scenario.onFieldSignal === "OUT"
      ? "BATTING"
      : "BOWLING";

  let seed = 0;
  if (scenarioSeed !== undefined) {
    seed = scenarioSeed;
  } else if (typeof scenario.id === "string") {
    const hexMatch = scenario.id.match(/^SCN-([0-9a-fA-F]+)$/);
    if (hexMatch) {
      const parsed = parseInt(hexMatch[1], 16);
      if (!Number.isNaN(parsed)) {
        seed = parsed;
      }
    }
  }

  return {
    incidentIndex,
    over: scenario.matchContext?.over ?? 0,
    ballInOver: scenario.matchContext?.ballInOver ?? 1,
    incidentType: scenario.incidentType,
    striker: scenario.matchContext?.batter ?? "",
    bowler: scenario.matchContext?.bowler ?? "",
    reviewingSide,
    onFieldSignal: scenario.onFieldSignal,
    scenarioSeed: seed,
  };
}
