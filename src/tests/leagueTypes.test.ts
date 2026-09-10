/**
 * src/tests/leagueTypes.test.ts
 *
 * Verification suite for the League Team, Player, and Innings State type contracts:
 * 1. PlayerRole union values ("BATTER", "BOWLER", "ALL_ROUNDER", "WICKETKEEPER").
 * 2. BattingHand union values ("RIGHT", "LEFT").
 * 3. BowlingCategory union values ("PACE", "SPIN").
 * 4. Team interface represents a complete franchise with identity and squad.
 * 5. PlayerProfile interface represents specialized athlete roles:
 *    - Specialist Batter
 *    - Specialist Bowler (Pace & Spin)
 *    - All-Rounder
 *    - Wicketkeeper-Batter
 * 6. PlayerRatings enforces 0–100 scale dimensions.
 * 7. BatterInningsState tracks mutable match scoring independently from PlayerProfile.
 * 8. BowlerInningsState tracks mutable over figures independently from PlayerProfile.
 * 9. PlayingXI represents an active 11-player lineup.
 */

import type {
  PlayerRole,
  BattingHand,
  BowlingCategory,
  PlayerRatings,
  PlayerProfile,
  Team,
  BatterInningsState,
  BowlerInningsState,
  PlayingXI,
} from "../types/league";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`[PASS] ${message}`);
}

console.log("=======================================================");
console.log("   LEAGUE TEAM / PLAYER TYPE CONTRACTS TEST SUITE");
console.log("=======================================================\n");

// -------------------------------------------------------------
// 1. PlayerRole compile & runtime check
// -------------------------------------------------------------
{
  const roles: PlayerRole[] = ["BATTER", "BOWLER", "ALL_ROUNDER", "WICKETKEEPER"];
  assert(roles.length === 4, "T1.1: Exactly 4 distinct PlayerRole types supported");
  assert(roles.includes("BATTER"), "T1.2: BATTER role supported");
  assert(roles.includes("BOWLER"), "T1.3: BOWLER role supported");
  assert(roles.includes("ALL_ROUNDER"), "T1.4: ALL_ROUNDER role supported");
  assert(roles.includes("WICKETKEEPER"), "T1.5: WICKETKEEPER role supported");
}

// -------------------------------------------------------------
// 2. BattingHand & BowlingCategory orientation
// -------------------------------------------------------------
{
  const rightHand: BattingHand = "RIGHT";
  const leftHand: BattingHand = "LEFT";
  assert(rightHand === "RIGHT" && leftHand === "LEFT", "T2.1: BattingHand supports RIGHT and LEFT");

  const pace: BowlingCategory = "PACE";
  const spin: BowlingCategory = "SPIN";
  assert(pace === "PACE" && spin === "SPIN", "T2.2: BowlingCategory supports PACE and SPIN");
}

// -------------------------------------------------------------
// 3. Team franchise representation
// -------------------------------------------------------------
{
  const sampleSquad: readonly string[] = [
    "PL_MUM_01", "PL_MUM_02", "PL_MUM_03", "PL_MUM_04", "PL_MUM_05",
    "PL_MUM_06", "PL_MUM_07", "PL_MUM_08", "PL_MUM_09", "PL_MUM_10",
    "PL_MUM_11", "PL_MUM_12", "PL_MUM_13", "PL_MUM_14", "PL_MUM_15",
  ];

  const team: Team = {
    id: "FRAN_MUM",
    name: "Mumbai Hawks",
    shortCode: "MHK",
    city: "Mumbai",
    homeVenue: "Marine Drive Stadium",
    primaryColor: "#1E3A8A",
    secondaryColor: "#E2E8F0",
    squadPlayerIds: sampleSquad,
  };

  assert(team.id === "FRAN_MUM", "T3.1: Team contains valid franchise ID");
  assert(team.name === "Mumbai Hawks", "T3.2: Team contains valid full name");
  assert(team.shortCode === "MHK", "T3.3: Team contains valid 3-letter short code");
  assert(team.city === "Mumbai", "T3.4: Team contains valid municipality/city");
  assert(team.homeVenue === "Marine Drive Stadium", "T3.5: Team contains valid home venue");
  assert(team.primaryColor.startsWith("#"), "T3.6: Team contains valid primary hex color");
  assert(team.secondaryColor.startsWith("#"), "T3.7: Team contains valid secondary hex color");
  assert(team.squadPlayerIds.length === 15, "T3.8: Team represents complete 15-player squad roster");
}

// -------------------------------------------------------------
// 4. PlayerProfile representation across all 4 tactical roles
// -------------------------------------------------------------
{
  // 4A. Specialist Batter
  const batterRatings: PlayerRatings = {
    battingSkill: 88,
    bowlingSkill: 15,
    aggression: 75,
    fieldingSkill: 80,
  };
  const batter: PlayerProfile = {
    id: "PL_MUM_01",
    name: "Aarav Sharma",
    shortName: "A. Sharma",
    teamId: "FRAN_MUM",
    role: "BATTER",
    battingHand: "RIGHT",
    ratings: batterRatings,
  };
  assert(batter.role === "BATTER", "T4.1: PlayerProfile represents BATTER role");
  assert(batter.battingHand === "RIGHT", "T4.2: Batter specifies battingHand");
  assert(batter.bowlingCategory === undefined, "T4.3: Non-bowler omits bowlingCategory");

  // 4B. Specialist Bowler (Pace & Spin)
  const pacerRatings: PlayerRatings = {
    battingSkill: 20,
    bowlingSkill: 92,
    aggression: 45,
    fieldingSkill: 72,
  };
  const pacer: PlayerProfile = {
    id: "PL_MUM_02",
    name: "Kabir Khan",
    shortName: "K. Khan",
    teamId: "FRAN_MUM",
    role: "BOWLER",
    battingHand: "RIGHT",
    bowlingCategory: "PACE",
    bowlingStyle: "Right-arm fast",
    ratings: pacerRatings,
  };
  assert(pacer.role === "BOWLER", "T4.4: PlayerProfile represents BOWLER role (PACE)");
  assert(pacer.bowlingCategory === "PACE", "T4.5: Bowler specifies PACE category");

  const spinner: PlayerProfile = {
    id: "PL_MUM_03",
    name: "Vikram Sen",
    shortName: "V. Sen",
    teamId: "FRAN_MUM",
    role: "BOWLER",
    battingHand: "LEFT",
    bowlingCategory: "SPIN",
    bowlingStyle: "Left-arm orthodox",
    ratings: { battingSkill: 35, bowlingSkill: 89, aggression: 50, fieldingSkill: 78 },
  };
  assert(spinner.bowlingCategory === "SPIN", "T4.6: Bowler specifies SPIN category");

  // 4C. All-Rounder
  const allRounder: PlayerProfile = {
    id: "PL_MUM_04",
    name: "Rohan Varma",
    shortName: "R. Varma",
    teamId: "FRAN_MUM",
    role: "ALL_ROUNDER",
    battingHand: "RIGHT",
    bowlingCategory: "PACE",
    bowlingStyle: "Right-arm medium-fast",
    ratings: { battingSkill: 82, bowlingSkill: 79, aggression: 84, fieldingSkill: 85 },
  };
  assert(allRounder.role === "ALL_ROUNDER", "T4.7: PlayerProfile represents ALL_ROUNDER role");
  assert(allRounder.ratings.battingSkill > 70 && allRounder.ratings.bowlingSkill > 70, "T4.8: All-rounder has dual skills");

  // 4D. Wicketkeeper-Batter
  const keeper: PlayerProfile = {
    id: "PL_MUM_05",
    name: "Devendra Patel",
    shortName: "D. Patel",
    teamId: "FRAN_MUM",
    role: "WICKETKEEPER",
    battingHand: "RIGHT",
    ratings: { battingSkill: 84, bowlingSkill: 10, aggression: 70, fieldingSkill: 90 },
  };
  assert(keeper.role === "WICKETKEEPER", "T4.9: PlayerProfile represents WICKETKEEPER role");
  assert(keeper.ratings.fieldingSkill >= 90, "T4.10: Keeper exhibits high glovework/fielding rating");
}

// -------------------------------------------------------------
// 5. BatterInningsState mutable match-state tracking
// -------------------------------------------------------------
{
  const batterState: BatterInningsState = {
    playerId: "PL_MUM_01",
    runs: 0,
    balls: 0,
    fours: 0,
    sixes: 0,
    isOut: false,
  };

  assert(batterState.playerId === "PL_MUM_01", "T5.1: Batter state tracks player ID");
  assert(batterState.runs === 0 && !batterState.isOut, "T5.2: Batter initial state is 0 runs not out");

  // Simulate scoring
  batterState.runs += 4;
  batterState.balls += 1;
  batterState.fours += 1;
  assert(batterState.runs === 4 && batterState.balls === 1 && batterState.fours === 1, "T5.3: Batter state records boundary 4");

  batterState.runs += 6;
  batterState.balls += 1;
  batterState.sixes += 1;
  assert(batterState.runs === 10 && batterState.balls === 2 && batterState.sixes === 1, "T5.4: Batter state records 6");

  // Simulate dismissal
  batterState.isOut = true;
  batterState.dismissalType = "LBW";
  batterState.dismissedByBowlerId = "PL_BLR_02";
  assert(batterState.isOut && batterState.dismissalType === "LBW", "T5.5: Batter state records dismissal details");
}

// -------------------------------------------------------------
// 6. BowlerInningsState mutable match-state tracking
// -------------------------------------------------------------
{
  const bowlerState: BowlerInningsState = {
    playerId: "PL_MUM_02",
    overs: 0,
    ballsInOver: 0,
    maidens: 0,
    runsConceded: 0,
    wickets: 0,
    dots: 0,
  };

  assert(bowlerState.playerId === "PL_MUM_02", "T6.1: Bowler state tracks player ID");
  assert(bowlerState.overs === 0 && bowlerState.wickets === 0, "T6.2: Bowler initial figures are 0-0");

  // Simulate deliveries
  bowlerState.ballsInOver = 1;
  bowlerState.dots += 1;
  assert(bowlerState.ballsInOver === 1 && bowlerState.dots === 1, "T6.3: Bowler state records dot ball");

  bowlerState.ballsInOver = 2;
  bowlerState.wickets += 1;
  bowlerState.dots += 1;
  assert(bowlerState.wickets === 1, "T6.4: Bowler state records wicket");

  // Complete an over
  bowlerState.overs = 1;
  bowlerState.ballsInOver = 0;
  bowlerState.runsConceded = 4;
  assert(bowlerState.overs === 1 && bowlerState.ballsInOver === 0 && bowlerState.runsConceded === 4, "T6.5: Bowler state records completed over");
}

// -------------------------------------------------------------
// 7. PlayingXI lineup representation
// -------------------------------------------------------------
{
  const xi: PlayingXI = [
    "PL_MUM_01", "PL_MUM_02", "PL_MUM_03", "PL_MUM_04", "PL_MUM_05",
    "PL_MUM_06", "PL_MUM_07", "PL_MUM_08", "PL_MUM_09", "PL_MUM_10",
    "PL_MUM_11",
  ];

  assert(xi.length === 11, "T7.1: PlayingXI contains exactly 11 players");
  assert(xi[0] === "PL_MUM_01", "T7.2: Opening striker indexed correctly");
  assert(xi[10] === "PL_MUM_11", "T7.3: Tailender indexed correctly");
}

console.log("\n=======================================================");
console.log("   ALL LEAGUE TYPE CONTRACTS TESTS PASSED!");
console.log("=======================================================\n");
