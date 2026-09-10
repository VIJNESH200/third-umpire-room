/**
 * src/types/league.ts
 *
 * Minimal type contracts for the future fictional League mode.
 * Defines immutable team and player profiles alongside ephemeral match innings states.
 *
 * Boundary rules:
 * - Pure type definitions only (no runtime code, classes, or state).
 * - Independent of DRS rules, physics engines, and random incident selection.
 * - Free of career, salary, bribery, corruption, and standings attributes.
 */

/**
 * Primary squad role of a cricket player.
 */
export type PlayerRole = "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER";

/**
 * Physical batting hand orientation.
 * Aligns with LBW Hawkeye and 3D batter rig conventions ("RIGHT" | "LEFT").
 */
export type BattingHand = "RIGHT" | "LEFT";

/**
 * Broad bowling classification category.
 * Aligns with DRS physics spin/pace telemetry ("PACE" | "SPIN").
 */
export type BowlingCategory = "PACE" | "SPIN";

/**
 * Numerical player ratings on a standard 0–100 scale.
 * Excludes derived overall ratings (OVR) and progression modifiers.
 */
export interface PlayerRatings {
  /** Batting competency: suppresses dot-ball odds, elevates boundary rates (0–100) */
  readonly battingSkill: number;
  /** Bowling competency: elevates dismissal odds, suppresses run leakages (0–100) */
  readonly bowlingSkill: number;
  /** Risk/intent profile: elevates scoring velocity and edge/dismissal susceptibility (0–100) */
  readonly aggression: number;
  /** Outfield athleticism: throwing accuracy, relay agility, catch reliability (0–100) */
  readonly fieldingSkill: number;
}

/**
 * Immutable static player profile.
 * Represents persistent athlete identity and skills across matches.
 * Does NOT contain mutable match statistics or career financial records.
 */
export interface PlayerProfile {
  /** Unique player identifier (e.g. "PL_MUM_01") */
  readonly id: string;
  /** Full player display name (e.g. "Arjun Sharma") */
  readonly name: string;
  /** Broadcast short name for TV scorebug display (e.g. "A. Sharma") */
  readonly shortName: string;
  /** Identifier of the associated team franchise (e.g. "FRAN_MUM") */
  readonly teamId: string;
  /** Primary tactical role within the squad */
  readonly role: PlayerRole;
  /** Stance hand used when facing deliveries */
  readonly battingHand: BattingHand;
  /** High-level bowling style category, if player bowls */
  readonly bowlingCategory?: BowlingCategory;
  /** Detailed presentation description (e.g. "Right-arm fast", "Left-arm orthodox") */
  readonly bowlingStyle?: string;
  /** Core skill ratings */
  readonly ratings: PlayerRatings;
}

/**
 * Immutable team franchise definition.
 * Represents persistent franchise identity and squad membership.
 * Does NOT contain financial budgets, owners, standings, or fan sentiment.
 */
export interface Team {
  /** Unique franchise identifier (e.g. "FRAN_MUM") */
  readonly id: string;
  /** Full franchise team name (e.g. "Mumbai Hawks") */
  readonly name: string;
  /** 3-character broadcast short code (e.g. "MHK") */
  readonly shortCode: string;
  /** Home municipality or city */
  readonly city: string;
  /** Home venue for presentation and commentary */
  readonly homeVenue: string;
  /** Primary hex color for TV scorebug and UI accents (e.g. "#1E3A8A") */
  readonly primaryColor: string;
  /** Secondary hex accent color (e.g. "#E2E8F0") */
  readonly secondaryColor: string;
  /** Complete 15-player squad roster of player IDs */
  readonly squadPlayerIds: readonly string[];
}

/**
 * Single-match runtime innings state for a batter.
 * Mutable record tracking delivery outcomes and dismissals during a live match.
 */
export interface BatterInningsState {
  /** Identifier of the batter */
  readonly playerId: string;
  /** Total runs scored by the batter */
  runs: number;
  /** Total legal deliveries faced */
  balls: number;
  /** Count of 4-run boundaries struck */
  fours: number;
  /** Count of 6-run boundaries struck */
  sixes: number;
  /** Whether the batter has been dismissed */
  isOut: boolean;
  /** Type of dismissal if out (e.g. "LBW", "CAUGHT_BEHIND", "BOWLED", "RUN_OUT") */
  dismissalType?: string;
  /** Identifier of the bowler credited with the wicket, if applicable */
  dismissedByBowlerId?: string;
  /** Identifier of the assisting fielder (catcher, stumper, run-out thrower), if applicable */
  assistedByFielderId?: string;
}

/**
 * Single-match runtime innings state for a bowler.
 * Mutable record tracking over allocation and bowling figures during a live match.
 */
export interface BowlerInningsState {
  /** Identifier of the bowler */
  readonly playerId: string;
  /** Completed overs bowled in the current innings */
  overs: number;
  /** Balls bowled in the active incomplete over (0 to 5) */
  ballsInOver: number;
  /** Count of maiden overs bowled (overs conceding 0 runs) */
  maidens: number;
  /** Total runs conceded off the bat and from bowler extras */
  runsConceded: number;
  /** Total wickets credited to the bowler */
  wickets: number;
  /** Count of dot balls bowled */
  dots: number;
}

/**
 * Active Playing XI selected for a match.
 * Ordered list of exactly 11 player IDs participating in the match.
 */
export type PlayingXI = readonly string[];
