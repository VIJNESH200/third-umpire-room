/**
 * src/engine/career/matchGenerator.ts
 *
 * Deterministic fixture and incident generator for League Career Mode.
 * Creates fictional team assignments, venues, prize fees, and authentic
 * macro match scenarios for Third Umpire adjudication.
 */

import type { Team } from "../../types/league";
import type {
  CareerMatchAssignment,
  CareerIncident,
  CareerTierLevel,
  MatchImportance,
  MatchScoreboard,
} from "../../types/career";
import type { DifficultyTier, Scenario } from "../../types/scenario";
import { SeededRandom, generateScenario } from "../scenarioGenerator";
import { deriveIncidentSeed } from "../randomIncidentEngine";
import { getTierInfo } from "./careerConstants";
import { simulateMatchBackground, generateCriticalMoment } from "./matchSimulation";

/**
 * 10 Fictional Indian city-based franchises.
 * Strictly compliant with IP boundaries (zero real IPL team names or trademarks).
 */
export const CAREER_TEAMS: readonly Team[] = Object.freeze([
  {
    id: "FRAN_MUM",
    name: "Mumbai Mariners",
    shortCode: "MMR",
    city: "Mumbai",
    homeVenue: "Marine Drive Arena",
    primaryColor: "#0284C7",
    secondaryColor: "#F8FAFC",
    squadPlayerIds: Object.freeze(["PL_MUM_1", "PL_MUM_2", "PL_MUM_3"]),
  },
  {
    id: "FRAN_DEL",
    name: "Delhi Strikers",
    shortCode: "DST",
    city: "Delhi",
    homeVenue: "Yamuna Sports Complex",
    primaryColor: "#DC2626",
    secondaryColor: "#1E293B",
    squadPlayerIds: Object.freeze(["PL_DEL_1", "PL_DEL_2", "PL_DEL_3"]),
  },
  {
    id: "FRAN_CHE",
    name: "Chennai Kingsmen",
    shortCode: "CKM",
    city: "Chennai",
    homeVenue: "Coromandel Ground",
    primaryColor: "#EAB308",
    secondaryColor: "#065F46",
    squadPlayerIds: Object.freeze(["PL_CHE_1", "PL_CHE_2", "PL_CHE_3"]),
  },
  {
    id: "FRAN_KOL",
    name: "Kolkata Crusaders",
    shortCode: "KKC",
    city: "Kolkata",
    homeVenue: "Hooghly Park Oval",
    primaryColor: "#7C3AED",
    secondaryColor: "#FBBF24",
    squadPlayerIds: Object.freeze(["PL_KOL_1", "PL_KOL_2", "PL_KOL_3"]),
  },
  {
    id: "FRAN_BLR",
    name: "Bengaluru Blasters",
    shortCode: "BBL",
    city: "Bengaluru",
    homeVenue: "Cubbon Park Pavilion",
    primaryColor: "#E11D48",
    secondaryColor: "#000000",
    squadPlayerIds: Object.freeze(["PL_BLR_1", "PL_BLR_2", "PL_BLR_3"]),
  },
  {
    id: "FRAN_HYD",
    name: "Hyderabad Phoenix",
    shortCode: "HYP",
    city: "Hyderabad",
    homeVenue: "Deccan Bowl",
    primaryColor: "#EA580C",
    secondaryColor: "#0F172A",
    squadPlayerIds: Object.freeze(["PL_HYD_1", "PL_HYD_2", "PL_HYD_3"]),
  },
  {
    id: "FRAN_AHM",
    name: "Ahmedabad Titans",
    shortCode: "AHT",
    city: "Ahmedabad",
    homeVenue: "Sabarmati Colosseum",
    primaryColor: "#0D9488",
    secondaryColor: "#CBD5E1",
    squadPlayerIds: Object.freeze(["PL_AHM_1", "PL_AHM_2", "PL_AHM_3"]),
  },
  {
    id: "FRAN_PUN",
    name: "Pune Pioneers",
    shortCode: "PNP",
    city: "Pune",
    homeVenue: "Sahyadri Arena",
    primaryColor: "#BE185D",
    secondaryColor: "#334155",
    squadPlayerIds: Object.freeze(["PL_PUN_1", "PL_PUN_2", "PL_PUN_3"]),
  },
  {
    id: "FRAN_JAI",
    name: "Jaipur Challengers",
    shortCode: "JPC",
    city: "Jaipur",
    homeVenue: "Pink City Stadium",
    primaryColor: "#DB2777",
    secondaryColor: "#1E3A8A",
    squadPlayerIds: Object.freeze(["PL_JAI_1", "PL_JAI_2", "PL_JAI_3"]),
  },
  {
    id: "FRAN_LUC",
    name: "Lucknow Navigators",
    shortCode: "LKN",
    city: "Lucknow",
    homeVenue: "Gomti Riverside Oval",
    primaryColor: "#059669",
    secondaryColor: "#F97316",
    squadPlayerIds: Object.freeze(["PL_LUC_1", "PL_LUC_2", "PL_LUC_3"]),
  },
]);

/**
 * Deterministically generates a career match fixture given the umpire's current tier
 * and career match counter.
 */
export function generateMatchAssignment(
  tierLevel: CareerTierLevel,
  matchNumber: number,
  careerSeed: number = 42
): CareerMatchAssignment {
  const matchSeed = careerSeed + matchNumber * 99991;
  const rng = new SeededRandom(matchSeed);

  // Pick two distinct teams
  const homeIdx = rng.rangeInt(0, CAREER_TEAMS.length - 1);
  let awayIdx = rng.rangeInt(0, CAREER_TEAMS.length - 1);
  if (awayIdx === homeIdx) {
    awayIdx = (homeIdx + 1) % CAREER_TEAMS.length;
  }

  const homeTeam = CAREER_TEAMS[homeIdx];
  const awayTeam = CAREER_TEAMS[awayIdx];
  const venue = homeTeam.homeVenue;

  const tierInfo = getTierInfo(tierLevel);
  const leagueName = tierInfo.name;

  // Match importance
  const importanceRoll = rng.next();
  let matchImportance: MatchImportance;
  if (tierLevel === 1) {
    matchImportance = importanceRoll < 0.6 ? "LOW" : "NORMAL";
  } else if (tierLevel <= 3) {
    matchImportance = importanceRoll < 0.4 ? "NORMAL" : importanceRoll < 0.85 ? "HIGH" : "CRITICAL";
  } else {
    matchImportance = importanceRoll < 0.3 ? "NORMAL" : importanceRoll < 0.7 ? "HIGH" : "CRITICAL";
  }

  // Fee calculation with ±8% variation
  const feeVariation = 1 + rng.range(-0.08, 0.08);
  const matchFee = Math.round(tierInfo.baseMatchFee * feeVariation);

  const incidentCount = tierInfo.incidentCount;

  // Simulate background scores
  const sim = simulateMatchBackground(homeTeam, awayTeam, matchSeed);

  const scoreboard: MatchScoreboard = {
    homeTeamScore: `${sim.homeScore.runs}/${sim.homeScore.wickets} (${sim.homeScore.overs})`,
    awayTeamScore: `${sim.awayScore.runs}/${sim.awayScore.wickets} (${sim.awayScore.overs})`,
    currentInnings: 2,
    currentOver: 19,
    currentBall: 4,
    targetRuns: sim.target,
    runsRequired: Math.max(1, sim.target - sim.secondInningsRuns),
    ballsRemaining: 8,
    projectedWinnerId: sim.winnerTeam.id,
  };

  // Generate Incidents
  const incidents: CareerIncident[] = [];
  const overDistribution = incidentCount === 6
    ? [3, 7, 11, 14, 17, 19]
    : [2, 5, 8, 11, 14, 16, 18, 19];

  for (let i = 0; i < incidentCount; i++) {
    const incSeed = deriveIncidentSeed(matchSeed, i);
    const incRng = new SeededRandom(incSeed);

    // Tier mix: higher tiers introduce more MARGINAL and HOWLER reviews
    let difficulty: DifficultyTier;
    const diffRoll = incRng.next();
    if (tierLevel === 1) {
      difficulty = diffRoll < 0.55 ? "CLEAR" : diffRoll < 0.85 ? "MARGINAL" : "HOWLER";
    } else if (tierLevel <= 3) {
      difficulty = diffRoll < 0.35 ? "CLEAR" : diffRoll < 0.75 ? "MARGINAL" : "HOWLER";
    } else {
      difficulty = diffRoll < 0.20 ? "CLEAR" : diffRoll < 0.70 ? "MARGINAL" : "HOWLER";
    }

    // Critical moment
    const { moment, description: momentDesc } = generateCriticalMoment(i, incidentCount, matchSeed);

    // Over and ball
    const overNumber = overDistribution[i] ?? 10;
    const ballInOver = incRng.rangeInt(1, 6);

    // Innings split: earlier incidents in 1st innings, later in 2nd innings
    const isFirstInnings = i < Math.floor(incidentCount / 2);
    const battingTeam = isFirstInnings ? sim.firstInningsTeam : sim.secondInningsTeam;
    const bowlingTeam = isFirstInnings ? sim.secondInningsTeam : sim.firstInningsTeam;

    const currentInningsRuns = isFirstInnings ? sim.firstInningsRuns : sim.secondInningsRuns;
    const currentInningsWickets = isFirstInnings ? sim.firstInningsWickets : sim.secondInningsWickets;
    const scoreRuns = Math.round((currentInningsRuns / 20) * overNumber);
    const scoreWickets = Math.min(currentInningsWickets, Math.floor(overNumber / 3));

    // A match is effectively decided if chasing team has already surpassed target or equation is settled
    const isMatchDecided = !isFirstInnings && (overNumber >= 19 && (scoreRuns >= sim.target || sim.target - scoreRuns > 40));

    // Generate authoritative LBW scenario
    const baseScenario = generateScenario(incSeed, "LBW", difficulty);

    // Bind career league and team identities seamlessly into scenario's match context
    const enrichedScenario: Scenario = {
      ...baseScenario,
      matchContext: {
        ...baseScenario.matchContext,
        tournament: leagueName,
        battingTeam: battingTeam.name,
        bowlingTeam: bowlingTeam.name,
        over: overNumber,
        ballInOver,
        battingTeamScore: `${scoreRuns}/${scoreWickets}`,
        matchSituation: `${momentDesc} (${leagueName} — Match #${matchNumber})`,
      },
    };

    const pressure: "LOW" | "MODERATE" | "INTENSE" =
      moment === "FINAL_OVER" || moment === "MATCH_DECIDING"
        ? "INTENSE"
        : moment === "HIGH_PRESSURE" || moment === "HAT_TRICK"
        ? "MODERATE"
        : "LOW";

    incidents.push({
      id: `CINC-${matchNumber}-${i + 1}`,
      incidentIndex: i,
      scenario: enrichedScenario,
      criticalMoment: moment,
      momentDescription: momentDesc,
      battingTeamId: battingTeam.id,
      bowlingTeamId: bowlingTeam.id,
      batterName: enrichedScenario.matchContext.batter,
      bowlerName: enrichedScenario.matchContext.bowler,
      overNumber,
      ballInOver,
      matchPressure: pressure,
      isMatchDecided,
    });
  }

  return {
    matchId: `MATCH-S1-${matchNumber.toString().padStart(3, "0")}`,
    matchNumber,
    homeTeam,
    awayTeam,
    venue,
    leagueName,
    tierLevel,
    matchImportance,
    matchFee,
    incidentCount,
    incidents,
    scoreboard,
  };
}
