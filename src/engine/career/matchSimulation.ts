/**
 * src/engine/career/matchSimulation.ts
 *
 * Lightweight background cricket match simulation for Career Mode.
 * Generates deterministic, believable match situations, scores,
 * critical moments, and outcomes without heavy ball-by-ball overhead.
 */

import type { Team } from "../../types/league";
import type {
  CriticalMomentType,
} from "../../types/career";
import { SeededRandom } from "../scenarioGenerator";

export interface SimulatedMatchState {
  readonly homeScore: { runs: number; wickets: number; overs: string };
  readonly awayScore: { runs: number; wickets: number; overs: string };
  readonly firstInningsTeam: Team;
  readonly secondInningsTeam: Team;
  readonly target: number;
  readonly winnerTeam: Team;
  readonly winMargin: string;
}

/**
 * Simulates a full 20-over T20 match deterministically.
 */
export function simulateMatchBackground(
  homeTeam: Team,
  awayTeam: Team,
  seed: number
): SimulatedMatchState {
  const rng = new SeededRandom(seed ^ 0x3c9a1);

  // Coin toss: batting first
  const homeBatsFirst = rng.boolean(0.5);
  const firstInningsTeam = homeBatsFirst ? homeTeam : awayTeam;
  const secondInningsTeam = homeBatsFirst ? awayTeam : homeTeam;

  // Innings 1: typical T20 score between 140 and 215
  const inn1Runs = rng.rangeInt(145, 210);
  const inn1Wickets = rng.rangeInt(4, 9);
  const target = inn1Runs + 1;

  // Innings 2: competitive chase
  const chaseRoll = rng.next();
  let inn2Runs: number;
  let inn2Wickets: number;
  let winnerTeam: Team;
  let winMargin: string;

  if (chaseRoll < 0.52) {
    // 2nd innings team wins
    inn2Runs = target + rng.rangeInt(0, 4);
    inn2Wickets = rng.rangeInt(4, 8);
    winnerTeam = secondInningsTeam;
    const wicketsRemaining = 10 - inn2Wickets;
    winMargin = `by ${wicketsRemaining} wicket${wicketsRemaining === 1 ? "" : "s"}`;
  } else {
    // 1st innings team defends
    inn2Runs = Math.max(120, target - rng.rangeInt(1, 24));
    inn2Wickets = rng.rangeInt(6, 10);
    winnerTeam = firstInningsTeam;
    const runsMargin = target - 1 - inn2Runs;
    winMargin = runsMargin === 0 ? "by Super Over" : `by ${runsMargin} run${runsMargin === 1 ? "" : "s"}`;
  }

  const homeScore = homeBatsFirst
    ? { runs: inn1Runs, wickets: inn1Wickets, overs: "20.0" }
    : { runs: inn2Runs, wickets: inn2Wickets, overs: inn2Wickets === 10 ? `${rng.rangeInt(17, 19)}.${rng.rangeInt(1, 5)}` : "20.0" };

  const awayScore = homeBatsFirst
    ? { runs: inn2Runs, wickets: inn2Wickets, overs: inn2Wickets === 10 ? `${rng.rangeInt(17, 19)}.${rng.rangeInt(1, 5)}` : "20.0" }
    : { runs: inn1Runs, wickets: inn1Wickets, overs: "20.0" };

  return {
    homeScore,
    awayScore,
    firstInningsTeam,
    secondInningsTeam,
    target,
    winnerTeam,
    winMargin,
  };
}

/**
 * Generates an interesting critical moment type for a given incident index
 * within a match.
 */
export function generateCriticalMoment(
  incidentIndex: number,
  totalIncidents: number,
  seed: number
): { moment: CriticalMomentType; description: string } {
  const rng = new SeededRandom(seed + incidentIndex * 1337);

  // Last incident is often match-deciding or final over
  if (incidentIndex === totalIncidents - 1) {
    const isFinalOver = rng.boolean(0.6);
    if (isFinalOver) {
      return {
        moment: "FINAL_OVER",
        description: "20th over nail-biter. Required runs within touching distance of balls remaining.",
      };
    }
    return {
      moment: "MATCH_DECIDING",
      description: "Match on a knife edge. Wicket or boundary decides the fixture.",
    };
  }

  // Second to last incident
  if (incidentIndex === totalIncidents - 2) {
    const roll = rng.next();
    if (roll < 0.45) {
      return {
        moment: "HIGH_PRESSURE",
        description: "Death overs pressure cooker. Batting side accelerating rapidly.",
      };
    }
    if (roll < 0.8) {
      return {
        moment: "MATCH_DECIDING",
        description: "Chasing team needs a boundary. Batting collapse threatens.",
      };
    }
  }

  // Earlier incidents
  const roll = rng.next();
  if (roll < 0.25) {
    return {
      moment: "MILESTONE",
      description: "Batter approaching major milestone (49* / 99*). High tension in stadium.",
    };
  }
  if (roll < 0.45) {
    return {
      moment: "HAT_TRICK",
      description: "Bowler on a hat-trick ball! Pitch electric with anticipation.",
    };
  }
  if (roll < 0.70) {
    return {
      moment: "HIGH_PRESSURE",
      description: "Crucial partnership break opportunity during middle consolidation.",
    };
  }

  return {
    moment: "NORMAL",
    description: "Standard match situation in the middle overs.",
  };
}
