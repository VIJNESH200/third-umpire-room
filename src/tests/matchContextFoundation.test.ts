/**
 * src/tests/matchContextFoundation.test.ts
 *
 * Verification suite for MatchContext & IncidentContext foundation:
 * 1. Existing Rapid generation (5 incidents) remains functional and valid.
 * 2. Existing Review Shift generation (8 incidents) remains functional and valid.
 * 3. Existing scenarios still contain valid legacy matchContext.
 * 4. New MatchContext can represent a future T20 match (and ODI / Test matches).
 * 5. New IncidentContext can represent a DRS delivery across all incident types.
 * 6. Bridge helper createIncidentContextFromScenario correctly derives incident state.
 * 7. Existing randomIncidentEngine behavior & scenario isolation remain intact.
 */

import { generateSessionIncidents } from "../engine/randomIncidentEngine";
import { generateScenario } from "../engine/scenarioGenerator";
import type { Scenario, LegacyMatchContext } from "../types/scenario";
import type {
  MatchContext,
  IncidentContext,
} from "../types/matchContext";
import { createIncidentContextFromScenario } from "../types/matchContext";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

console.log("=======================================================");
console.log("   MATCH CONTEXT FOUNDATION VERIFICATION SUITE");
console.log("=======================================================\n");

// -------------------------------------------------------------
// 1. Existing Rapid generation (5 incidents) still works
// -------------------------------------------------------------
{
  const seed = 1001;
  const rapidScenarios = generateSessionIncidents(seed, 5);
  assert(rapidScenarios.length === 5, "V1.1: Rapid mode generates exactly 5 scenarios");
  
  for (let i = 0; i < rapidScenarios.length; i++) {
    const s = rapidScenarios[i];
    assert(typeof s.id === "string" && s.id.startsWith("SCN-"), `V1.2: Rapid incident [${i}] has valid ID ${s.id}`);
    assert(["LBW", "RUN_OUT", "STUMPING", "CAUGHT_BEHIND", "BOUNDARY"].includes(s.incidentType), `V1.3: Rapid incident [${i}] has valid incidentType ${s.incidentType}`);
    assert(["OUT", "NOT_OUT"].includes(s.correctFinalVerdict), `V1.4: Rapid incident [${i}] has valid correctFinalVerdict`);
  }
}

// -------------------------------------------------------------
// 2. Existing Review Shift generation (8 incidents) still works
// -------------------------------------------------------------
{
  const seed = 2002;
  const reviewShiftScenarios = generateSessionIncidents(seed, 8);
  assert(reviewShiftScenarios.length === 8, "V2.1: Review Shift mode generates exactly 8 scenarios");
  
  for (let i = 0; i < reviewShiftScenarios.length; i++) {
    const s = reviewShiftScenarios[i];
    assert(typeof s.id === "string" && s.id.startsWith("SCN-"), `V2.2: Review Shift incident [${i}] has valid ID ${s.id}`);
    assert(s.drsEvaluation !== undefined, `V2.3: Review Shift incident [${i}] has complete drsEvaluation`);
    assert(Array.isArray(s.commsDialogue), `V2.4: Review Shift incident [${i}] has valid commsDialogue array`);
  }
}

// -------------------------------------------------------------
// 3. Existing scenarios still contain valid legacy matchContext
// -------------------------------------------------------------
{
  const scn = generateScenario(3003, "LBW", "MARGINAL");
  const mc: LegacyMatchContext = scn.matchContext;

  assert(typeof mc.battingTeam === "string" && mc.battingTeam.length > 0, "V3.1: Legacy matchContext contains battingTeam string");
  assert(typeof mc.bowlingTeam === "string" && mc.bowlingTeam.length > 0, "V3.2: Legacy matchContext contains bowlingTeam string");
  assert(typeof mc.battingTeamScore === "string" && mc.battingTeamScore.includes("/"), "V3.3: Legacy matchContext contains battingTeamScore string formatted as runs/wickets");
  assert(typeof mc.batter === "string" && mc.batter.length > 0, "V3.4: Legacy matchContext contains batter name");
  assert(typeof mc.batterScore === "string", "V3.5: Legacy matchContext contains batterScore");
  assert(typeof mc.bowler === "string" && mc.bowler.length > 0, "V3.6: Legacy matchContext contains bowler name");
  assert(typeof mc.bowlerFigures === "string" && mc.bowlerFigures.includes("/"), "V3.7: Legacy matchContext contains bowlerFigures");
  assert(typeof mc.over === "number" && mc.over >= 0, "V3.8: Legacy matchContext contains non-negative over number");
  assert(typeof mc.ballInOver === "number" && mc.ballInOver >= 1 && mc.ballInOver <= 6, "V3.9: Legacy matchContext contains ballInOver between 1 and 6");
  assert(["TEST", "ODI", "T20"].includes(mc.matchFormat), "V3.10: Legacy matchContext contains valid matchFormat");
  assert(typeof mc.tournament === "string" && mc.tournament.length > 0, "V3.11: Legacy matchContext contains tournament name");
  assert(typeof mc.matchSituation === "string" && mc.matchSituation.length > 0, "V3.12: Legacy matchContext contains matchSituation string");
  assert(["OUT", "NOT_OUT", "REFERRED"].includes(mc.onFieldSignal), "V3.13: Legacy matchContext contains valid onFieldSignal");
}

// -------------------------------------------------------------
// 4. New MatchContext can represent a future T20 match
// -------------------------------------------------------------
{
  // 4A: 1st Innings T20 match state (setting a target, no target chasing)
  const t20FirstInnings: MatchContext = {
    matchId: "IPL-2026-FINAL-01",
    tournament: "Indian Premier League Final",
    format: "T20",
    battingTeam: "CHENNAI SUPER KINGS",
    bowlingTeam: "GUJARAT TITANS",
    innings: 1,
    runs: 168,
    wickets: 4,
    overs: 17,
    ballInOver: 3,
    remainingReviews: {
      batting: 2,
      bowling: 1,
    },
  };

  assert(t20FirstInnings.matchId === "IPL-2026-FINAL-01", "V4.1: T20 MatchContext has matchId");
  assert(t20FirstInnings.format === "T20", "V4.2: T20 MatchContext has format T20");
  assert(t20FirstInnings.innings === 1, "V4.3: T20 MatchContext supports 1st innings");
  assert(t20FirstInnings.target === undefined, "V4.4: 1st innings has target undefined");
  assert(t20FirstInnings.remainingReviews?.batting === 2, "V4.5: Batting remaining reviews represented");
  assert(t20FirstInnings.remainingReviews?.bowling === 1, "V4.6: Bowling remaining reviews represented");

  // 4B: 2nd Innings T20 match state (chasing target)
  const t20Chasing: MatchContext = {
    matchId: "T20-WC-2026-M45",
    tournament: "ICC Men's T20 World Cup Final",
    format: "T20",
    battingTeam: "INDIA",
    bowlingTeam: "PAKISTAN",
    innings: 2,
    runs: 145,
    wickets: 3,
    overs: 16,
    ballInOver: 2,
    target: 172,
    remainingReviews: {
      batting: 1,
      bowling: 0,
    },
  };

  assert(t20Chasing.target === 172, "V4.7: 2nd innings chasing match state contains numeric target");
  assert(t20Chasing.runs === 145 && t20Chasing.wickets === 3, "V4.8: Clean numeric score & wickets without string concatenation");
  assert(t20Chasing.overs === 16 && t20Chasing.ballInOver === 2, "V4.9: Clean numeric over & ballInOver tracking");

  // 4C: Test match format compatibility
  const testMatchContext: MatchContext = {
    matchId: "ASHES-2026-TEST5",
    tournament: "The Ashes — 5th Test",
    format: "TEST",
    battingTeam: "AUSTRALIA",
    bowlingTeam: "ENGLAND",
    innings: 4,
    runs: 284,
    wickets: 7,
    overs: 84,
    ballInOver: 5,
    target: 320,
    remainingReviews: {
      batting: 2,
      bowling: 3,
    },
  };
  assert(testMatchContext.format === "TEST", "V4.10: MatchContext supports Test format");
  assert(testMatchContext.innings === 4, "V4.11: MatchContext supports 4th innings in Test");
}

// -------------------------------------------------------------
// 5. New IncidentContext can represent a DRS delivery
// -------------------------------------------------------------
{
  // 5A: LBW DRS Review by Batting Team
  const lbwIncident: IncidentContext = {
    incidentIndex: 2,
    over: 14,
    ballInOver: 4,
    incidentType: "LBW",
    striker: "Virat Kohli",
    nonStriker: "Rishabh Pant",
    bowler: "Pat Cummins",
    reviewingSide: "BATTING",
    onFieldSignal: "OUT",
    scenarioSeed: 492019,
  };

  assert(lbwIncident.incidentIndex === 2, "V5.1: IncidentContext contains incidentIndex");
  assert(lbwIncident.over === 14 && lbwIncident.ballInOver === 4, "V5.2: IncidentContext contains over and ballInOver");
  assert(lbwIncident.incidentType === "LBW", "V5.3: IncidentContext contains valid incidentType");
  assert(lbwIncident.striker === "Virat Kohli", "V5.4: IncidentContext contains striker name");
  assert(lbwIncident.nonStriker === "Rishabh Pant", "V5.5: IncidentContext contains optional nonStriker");
  assert(lbwIncident.bowler === "Pat Cummins", "V5.6: IncidentContext contains bowler name");
  assert(lbwIncident.reviewingSide === "BATTING", "V5.7: IncidentContext contains reviewingSide");
  assert(lbwIncident.onFieldSignal === "OUT", "V5.8: IncidentContext contains onFieldSignal");
  assert(lbwIncident.scenarioSeed === 492019, "V5.9: IncidentContext contains scenarioSeed");

  // 5B: Caught Behind review by Bowling Team
  const cbIncident: IncidentContext = {
    incidentIndex: 0,
    over: 4,
    ballInOver: 2,
    incidentType: "CAUGHT_BEHIND",
    striker: "Ben Stokes",
    bowler: "Mitchell Starc",
    reviewingSide: "BOWLING",
    onFieldSignal: "NOT_OUT",
    scenarioSeed: 881273,
  };
  assert(cbIncident.reviewingSide === "BOWLING", "V5.10: Caught Behind review correctly represents BOWLING reviewing side");

  // 5C: Run Out direct umpire referral
  const runOutIncident: IncidentContext = {
    incidentIndex: 4,
    over: 19,
    ballInOver: 6,
    incidentType: "RUN_OUT",
    striker: "MS Dhoni",
    nonStriker: "Ravindra Jadeja",
    bowler: "Mohit Sharma",
    reviewingSide: "UMPIRE",
    onFieldSignal: "REFERRED",
    scenarioSeed: 331122,
  };
  assert(runOutIncident.reviewingSide === "UMPIRE", "V5.11: Run Out direct referral correctly represents UMPIRE reviewing side");
}

// -------------------------------------------------------------
// 6. Bridge helper createIncidentContextFromScenario & Edge Cases
// -------------------------------------------------------------
{
  // 6A: Test bridge with LBW scenario given OUT
  const scnLbw = generateScenario(7771, "LBW", "CLEAR");
  const incFromLbw = createIncidentContextFromScenario(scnLbw, 0);

  assert(incFromLbw.incidentIndex === 0, "V6.1: Bridge populates incidentIndex");
  assert(incFromLbw.over === scnLbw.matchContext.over, "V6.2: Bridge maps over");
  assert(incFromLbw.ballInOver === scnLbw.matchContext.ballInOver, "V6.3: Bridge maps ballInOver");
  assert(incFromLbw.striker === scnLbw.matchContext.batter, "V6.4: Bridge maps striker from legacy batter");
  assert(incFromLbw.bowler === scnLbw.matchContext.bowler, "V6.5: Bridge maps bowler from legacy bowler");
  assert(incFromLbw.incidentType === "LBW", "V6.6: Bridge maps incidentType");
  assert(typeof incFromLbw.scenarioSeed === "number", "V6.7: Bridge parses or provides numeric scenarioSeed");

  // 6B: Test scenario with optional incidentContext and leagueMatchContext attached
  const t20LeagueState: MatchContext = {
    matchId: "MTCH-2026-T20-001",
    tournament: "Premier League",
    format: "T20",
    battingTeam: "MUMBAI",
    bowlingTeam: "DELHI",
    innings: 2,
    runs: 95,
    wickets: 2,
    overs: 11,
    ballInOver: 4,
    target: 160,
    remainingReviews: { batting: 2, bowling: 1 },
  };

  const scenarioWithContexts: Scenario = {
    ...scnLbw,
    incidentContext: incFromLbw,
    leagueMatchContext: t20LeagueState,
  };
  assert(scenarioWithContexts.incidentContext?.striker === scnLbw.matchContext.batter, "V6.8: Scenario type supports optional incidentContext seamlessly");
  assert(scenarioWithContexts.leagueMatchContext?.matchId === "MTCH-2026-T20-001", "V6.9: Scenario type supports optional leagueMatchContext seamlessly");

  // 6C: Preservation of existing incidentContext (e.g. nonStriker) when re-bridged
  const enrichedIncident: IncidentContext = {
    ...incFromLbw,
    nonStriker: "Shubman Gill",
    reviewingSide: "BATTING",
  };
  const scnWithEnriched = { ...scnLbw, incidentContext: enrichedIncident };
  const rebridged = createIncidentContextFromScenario(scnWithEnriched, 3);
  assert(rebridged.nonStriker === "Shubman Gill", "V6.10: Bridge preserves existing nonStriker when incidentContext already exists");
  assert(rebridged.incidentIndex === 3, "V6.11: Bridge allows updating incidentIndex on existing incidentContext");

  // 6D: Explicit seed 0 edge case
  const bridgeZeroSeed = createIncidentContextFromScenario(scnLbw, 0, 0);
  assert(bridgeZeroSeed.scenarioSeed === 0, "V6.12: Bridge preserves explicitly passed scenarioSeed 0");

  // 6E: Non-hex or custom scenario ID edge case (prevents partial hex parsing bug)
  const scnCustomId: Scenario = {
    ...scnLbw,
    id: "SCN-DECISION-01",
    incidentContext: undefined,
  };
  const incCustom = createIncidentContextFromScenario(scnCustomId, 1);
  assert(incCustom.scenarioSeed === 0, "V6.13: Non-hex scenario ID safely falls back to seed 0 without partial hex parse");

  // 6F: Safe handling of minimal / missing matchContext
  const scnMinimal = {
    ...scnLbw,
    matchContext: {} as any,
    incidentContext: undefined,
  };
  const incMinimal = createIncidentContextFromScenario(scnMinimal, 0);
  assert(incMinimal.over === 0 && incMinimal.ballInOver === 1, "V6.14: Safe fallback defaults for missing matchContext properties");
}

// -------------------------------------------------------------
// 7. Determinism and Frozen Random Incident Engine checks
// -------------------------------------------------------------
{
  // Generating identical seed twice produces byte-for-byte identical output
  const seed = 987654;
  const run1 = generateSessionIncidents(seed, 5);
  const run2 = generateSessionIncidents(seed, 5);
  assert(JSON.stringify(run1) === JSON.stringify(run2), "V7.1: Deterministic random incident engine produces byte-for-byte identical output across sessions");

  // Verify all 5 incident types can produce valid LegacyMatchContext
  const types = ["LBW", "RUN_OUT", "STUMPING", "CAUGHT_BEHIND", "BOUNDARY"] as const;
  for (const t of types) {
    const scn = generateScenario(5555, t, "MARGINAL");
    assert(scn.matchContext.battingTeam.length > 0, `V7.2: Incident ${t} has valid legacy battingTeam`);
    assert(scn.matchContext.bowler.length > 0, `V7.3: Incident ${t} has valid legacy bowler`);
    assert(scn.matchContext.over >= 0, `V7.4: Incident ${t} has valid legacy over`);
  }
}

// -------------------------------------------------------------
// 8. MatchContext boundary edge cases (start of match, exhausted reviews)
// -------------------------------------------------------------
{
  // Match start (0/0 in 0.0 overs)
  const startMatch: MatchContext = {
    matchId: "NEW-001",
    tournament: "T20 Cup",
    format: "T20",
    battingTeam: "TEAM_A",
    bowlingTeam: "TEAM_B",
    innings: 1,
    runs: 0,
    wickets: 0,
    overs: 0,
    ballInOver: 0,
    remainingReviews: {
      batting: 2,
      bowling: 2,
    },
  };
  assert(startMatch.runs === 0 && startMatch.wickets === 0, "V8.1: MatchContext supports 0/0 start score");
  assert(startMatch.overs === 0 && startMatch.ballInOver === 0, "V8.2: MatchContext supports 0.0 overs at match start");

  // Exhausted reviews
  const exhaustedReviews: MatchContext = {
    ...startMatch,
    remainingReviews: {
      batting: 0,
      bowling: 0,
    },
  };
  assert(exhaustedReviews.remainingReviews?.batting === 0, "V8.3: MatchContext supports 0 remaining reviews for batting team");
  assert(exhaustedReviews.remainingReviews?.bowling === 0, "V8.4: MatchContext supports 0 remaining reviews for bowling team");
}

console.log("\n=======================================================");
console.log("   ALL MATCH CONTEXT FOUNDATION TESTS PASSED!");
console.log("=======================================================");
