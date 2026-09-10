/**
 * src/tests/fictionalLeagueData.test.ts
 *
 * Comprehensive verification suite for the static fictional league dataset:
 * 1. Exactly 8 franchises with correct IDs, short codes, cities, and unique venues/colors.
 * 2. Exactly 120 unique fictional players (15 per franchise).
 * 3. Bidirectional referential integrity between teams and players.
 * 4. Squad balance and cricket realism (keepers, bowling depth, pace & spin coverage).
 * 5. Player ratings validity (integer scale 0–100, role-appropriate distributions).
 * 6. Strict quarantine against real IPL franchise branding and real cricketer names.
 * 7. Fast lookup dictionaries correctness (O(1) access maps).
 * 8. Runtime immutability (frozen arrays and dictionaries).
 */

import {
  FICTIONAL_TEAMS,
  FICTIONAL_PLAYERS,
  FICTIONAL_TEAMS_BY_ID,
  FICTIONAL_PLAYERS_BY_ID,
  FICTIONAL_PLAYERS_BY_TEAM,
} from "../data/fictionalLeagueData";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`[FAIL] ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`[PASS] ${message}`);
}

console.log("=======================================================");
console.log("   FICTIONAL LEAGUE DATASET VERIFICATION SUITE");
console.log("=======================================================\n");

// ============================================================================
// SUITE 1: FRANCHISE COUNT, IDENTITIES, AND UNIQUENESS
// ============================================================================
console.log("--- Suite 1: Franchise Count & Identity ---");
{
  assert(FICTIONAL_TEAMS.length === 8, "S1.1: Exactly 8 franchises defined in FICTIONAL_TEAMS");

  const expectedTeamIds = [
    "FRAN_MUM",
    "FRAN_BLR",
    "FRAN_DEL",
    "FRAN_CHE",
    "FRAN_KOL",
    "FRAN_HYD",
    "FRAN_AHM",
    "FRAN_PUN",
  ];

  const expectedShortCodes = [
    "MHK",
    "BLZ",
    "DYN",
    "CMT",
    "STK",
    "PHX",
    "AVT",
    "PTH",
  ];

  const teamIds = FICTIONAL_TEAMS.map((t) => t.id);
  const shortCodes = FICTIONAL_TEAMS.map((t) => t.shortCode);
  const teamNames = FICTIONAL_TEAMS.map((t) => t.name);
  const venues = FICTIONAL_TEAMS.map((t) => t.homeVenue);

  const expectedDisplayNames = [
    "Mumbai",
    "Bengaluru",
    "Delhi",
    "Chennai",
    "Kolkata",
    "Hyderabad",
    "Ahmedabad",
    "Punjab",
  ];

  for (const expectedId of expectedTeamIds) {
    assert(teamIds.includes(expectedId), `S1.2: Contains expected franchise ID ${expectedId}`);
  }

  for (const expectedCode of expectedShortCodes) {
    assert(shortCodes.includes(expectedCode), `S1.3: Contains expected short code ${expectedCode}`);
  }

  for (const expectedName of expectedDisplayNames) {
    assert(teamNames.includes(expectedName), `S1.3b: Contains expected city-only display name ${expectedName}`);
  }

  assert(new Set(teamIds).size === 8, "S1.4: All franchise IDs are unique");
  assert(new Set(shortCodes).size === 8, "S1.5: All franchise short codes are unique");
  assert(new Set(teamNames).size === 8, "S1.6: All franchise names are unique");
  assert(new Set(venues).size === 8, "S1.7: All home venues are unique");

  const hexRegex = /^#[0-9A-Fa-f]{6}$/;
  for (const team of FICTIONAL_TEAMS) {
    assert(hexRegex.test(team.primaryColor), `S1.8: Team ${team.id} primaryColor is valid hex (${team.primaryColor})`);
    assert(hexRegex.test(team.secondaryColor), `S1.9: Team ${team.id} secondaryColor is valid hex (${team.secondaryColor})`);
    assert(team.primaryColor.toUpperCase() !== team.secondaryColor.toUpperCase(), `S1.10: Team ${team.id} primary and secondary colors contrast`);
  }
}

// ============================================================================
// SUITE 2: PLAYER COUNT, SQUAD SIZE, AND ID UNIQUENESS
// ============================================================================
console.log("\n--- Suite 2: Player Count & ID Uniqueness ---");
{
  assert(FICTIONAL_PLAYERS.length === 120, "S2.1: Exactly 120 players defined in FICTIONAL_PLAYERS");

  const playerIds = FICTIONAL_PLAYERS.map((p) => p.id);
  assert(new Set(playerIds).size === 120, "S2.2: All 120 player IDs are strictly unique");

  const playerNames = FICTIONAL_PLAYERS.map((p) => p.name);
  assert(new Set(playerNames).size === 120, "S2.3: All 120 player full names are strictly unique");

  const idFormatRegex = /^FRAN_[A-Z]{3}_P(0[1-9]|1[0-5])$/;
  for (const player of FICTIONAL_PLAYERS) {
    assert(idFormatRegex.test(player.id), `S2.4: Player ID ${player.id} conforms to standard pattern`);
  }

  // Surname-only format: names must contain no whitespace (single-word surnames)
  for (const player of FICTIONAL_PLAYERS) {
    assert(
      !/\s/.test(player.name),
      `S2.5: Player ${player.id} name "${player.name}" is a single-word surname (no whitespace)`
    );
  }

  // name and shortName must be identical (both are the surname)
  for (const player of FICTIONAL_PLAYERS) {
    assert(
      player.name === player.shortName,
      `S2.6: Player ${player.id} name "${player.name}" matches shortName "${player.shortName}"`
    );
  }
}

// ============================================================================
// SUITE 3: BIDIRECTIONAL REFERENTIAL INTEGRITY
// ============================================================================
console.log("\n--- Suite 3: Bidirectional Referential Integrity ---");
{
  for (const team of FICTIONAL_TEAMS) {
    assert(team.squadPlayerIds.length === 15, `S3.1: Team ${team.id} has exactly 15 squadPlayerIds`);
    assert(new Set(team.squadPlayerIds).size === 15, `S3.2: Team ${team.id} has 15 distinct squadPlayerIds`);

    for (const pId of team.squadPlayerIds) {
      const player = FICTIONAL_PLAYERS_BY_ID[pId];
      assert(player !== undefined, `S3.3: Player ID ${pId} in squad ${team.id} exists in player registry`);
      assert(player.teamId === team.id, `S3.4: Player ${pId} teamId (${player.teamId}) matches squad teamId (${team.id})`);
    }
  }

  // Ensure no orphaned players
  const knownTeamIds = new Set(FICTIONAL_TEAMS.map((t) => t.id));
  for (const player of FICTIONAL_PLAYERS) {
    assert(knownTeamIds.has(player.teamId), `S3.5: Player ${player.id} belongs to a recognized team (${player.teamId})`);
    const team = FICTIONAL_TEAMS_BY_ID[player.teamId];
    assert(team.squadPlayerIds.includes(player.id), `S3.6: Player ${player.id} is present in squadPlayerIds of ${player.teamId}`);
  }
}

// ============================================================================
// SUITE 4: SQUAD BALANCE & CRICKET REALISM
// ============================================================================
console.log("\n--- Suite 4: Squad Balance & Cricket Realism ---");
{
  for (const team of FICTIONAL_TEAMS) {
    const squad = FICTIONAL_PLAYERS_BY_TEAM[team.id];
    assert(squad.length === 15, `S4.1: Team ${team.id} pre-grouped squad has 15 players`);

    const keepers = squad.filter((p) => p.role === "WICKETKEEPER");
    const batters = squad.filter((p) => p.role === "BATTER");
    const allRounders = squad.filter((p) => p.role === "ALL_ROUNDER");
    const bowlers = squad.filter((p) => p.role === "BOWLER");

    assert(keepers.length >= 1, `S4.2: Team ${team.id} has at least 1 wicketkeeper (found ${keepers.length})`);
    assert(batters.length >= 3, `S4.3: Team ${team.id} has at least 3 specialist batters (found ${batters.length})`);
    assert(allRounders.length >= 1, `S4.4: Team ${team.id} has at least 1 all-rounder (found ${allRounders.length})`);
    assert(bowlers.length >= 4, `S4.5: Team ${team.id} has at least 4 specialist bowlers (found ${bowlers.length})`);

    // Bowling depth: All-rounders + Bowlers must provide >= 6 bowling options
    const bowlingOptions = squad.filter((p) => p.bowlingCategory !== undefined);
    assert(
      bowlingOptions.length >= 6,
      `S4.6: Team ${team.id} has >= 6 bowling options to support a 5-bowler Playing XI (found ${bowlingOptions.length})`
    );

    // Pace & Spin balance
    const paceBowlers = squad.filter((p) => p.bowlingCategory === "PACE");
    const spinBowlers = squad.filter((p) => p.bowlingCategory === "SPIN");
    assert(paceBowlers.length >= 2, `S4.7: Team ${team.id} has at least 2 pace options (found ${paceBowlers.length})`);
    assert(spinBowlers.length >= 2, `S4.8: Team ${team.id} has at least 2 spin options (found ${spinBowlers.length})`);

    // Batting hand diversity
    const rightHanders = squad.filter((p) => p.battingHand === "RIGHT");
    const leftHanders = squad.filter((p) => p.battingHand === "LEFT");
    assert(rightHanders.length >= 5, `S4.9: Team ${team.id} has right-hand batting representation (found ${rightHanders.length})`);
    assert(leftHanders.length >= 2, `S4.10: Team ${team.id} has left-hand batting representation (found ${leftHanders.length})`);
  }

  // Check bowling attributes for all players
  for (const player of FICTIONAL_PLAYERS) {
    if (player.role === "BOWLER" || player.role === "ALL_ROUNDER") {
      assert(
        player.bowlingCategory === "PACE" || player.bowlingCategory === "SPIN",
        `S4.11: Bowler/All-rounder ${player.id} has bowlingCategory defined (PACE or SPIN)`
      );
      assert(
        typeof player.bowlingStyle === "string" && player.bowlingStyle.length > 0,
        `S4.12: Bowler/All-rounder ${player.id} has bowlingStyle string defined`
      );
    }
  }
}

// ============================================================================
// SUITE 5: RATINGS VALIDITY & DISTRIBUTION
// ============================================================================
console.log("\n--- Suite 5: Ratings Validity & Realistic Distributions ---");
{
  for (const player of FICTIONAL_PLAYERS) {
    const { battingSkill, bowlingSkill, fieldingSkill } = player.ratings;

    // All ratings must be integers in [0, 100]
    for (const [key, val] of Object.entries(player.ratings)) {
      assert(
        Number.isInteger(val) && val >= 0 && val <= 100,
        `S5.1: Player ${player.id} rating ${key}=${val} is integer in [0, 100]`
      );
    }

    // Role-specific rating boundaries for realism
    if (player.role === "BATTER") {
      assert(battingSkill >= 65, `S5.2: Specialist batter ${player.id} battingSkill (${battingSkill}) >= 65`);
      assert(bowlingSkill <= 35, `S5.3: Specialist batter ${player.id} bowlingSkill (${bowlingSkill}) <= 35`);
    } else if (player.role === "BOWLER") {
      assert(bowlingSkill >= 60, `S5.4: Specialist bowler ${player.id} bowlingSkill (${bowlingSkill}) >= 60`);
      assert(battingSkill <= 45, `S5.5: Specialist bowler ${player.id} battingSkill (${battingSkill}) <= 45`);
    } else if (player.role === "ALL_ROUNDER") {
      assert(battingSkill >= 50, `S5.6: All-rounder ${player.id} battingSkill (${battingSkill}) >= 50`);
      assert(bowlingSkill >= 50, `S5.7: All-rounder ${player.id} bowlingSkill (${bowlingSkill}) >= 50`);
    } else if (player.role === "WICKETKEEPER") {
      assert(battingSkill >= 55, `S5.8: Wicketkeeper ${player.id} battingSkill (${battingSkill}) >= 55`);
      assert(fieldingSkill >= 70, `S5.9: Wicketkeeper ${player.id} fieldingSkill (${fieldingSkill}) >= 70`);
    }
  }
}

// ============================================================================
// SUITE 6: REAL-WORLD IPL & CRICKETER NAME QUARANTINE
// ============================================================================
console.log("\n--- Suite 6: Real-World Branding & Name Quarantine ---");
{
  // Blacklist of real-world IPL franchise nicknames
  const forbiddenFranchiseKeywords = [
    "indians",
    "super kings",
    "royal challengers",
    "knight riders",
    "capitals",
    "sunrisers",
    "titans",
    "kings xi",
    "super giants",
  ];

  for (const team of FICTIONAL_TEAMS) {
    const lowerName = team.name.toLowerCase();
    for (const forbidden of forbiddenFranchiseKeywords) {
      assert(
        !lowerName.includes(forbidden),
        `S6.1: Team name "${team.name}" does not contain forbidden keyword "${forbidden}"`
      );
    }
  }

  // Blacklist of famous international & IPL cricketer surnames/monikers (word-boundary enforced)
  const forbiddenNameTokens = [
    "dhoni", "kohli", "rohit", "tendulkar", "bumrah", "pandya",
    "rahul", "jadeja", "ashwin", "shami", "gill", "pant", "samson",
    "gambhir", "dravid", "ganguly", "sehwag", "yuvraj", "raina",
    "harbhajan", "zaheer", "kumble", "gavaskar",
    "warner", "cummins", "starc", "maxwell", "root",
    "stokes", "buttler", "babar", "afridi", "williamson",
    "boult", "malinga", "muralitharan", "pollard", "russell",
    "bravo", "gayle", "narine", "steyn", "rabada", "klaasen",
    "pooran", "chahal", "kuldeep", "siraj", "arshdeep",
    "suryakumar", "jaiswal", "gaikwad", "ruturaj", "tewatia",
    "sharma", "singh",
  ];

  for (const player of FICTIONAL_PLAYERS) {
    const lowerName = player.name.toLowerCase();
    for (const token of forbiddenNameTokens) {
      const regex = new RegExp(`\\b${token}\\b`, "i");
      assert(
        !regex.test(lowerName),
        `S6.2: Player "${player.name}" does not contain forbidden cricketer name token "${token}"`
      );
    }
  }

  // Specific check: ensure no player name has exact full name collision with top stars
  const iconicFullStars = [
    "virat kohli", "ms dhoni", "mahendra singh dhoni", "rohit sharma", "sachin tendulkar",
    "jasprit bumrah", "hardik pandya", "kl rahul", "ravindra jadeja", "ravichandran ashwin",
    "mohammed shami", "shubman gill", "rishabh pant", "sanju samson", "gautam gambhir",
    "rahul dravid", "sourav ganguly", "virender sehwag", "yuvraj singh", "suresh raina",
    "anil kumble", "sunil gavaskar", "kapil dev", "david warner", "steve smith",
    "pat cummins", "mitchell starc", "glenn maxwell", "travis head", "joe root",
    "ben stokes", "james anderson", "stuart broad", "jos buttler", "rashid khan",
    "babar azam", "shaheen afridi", "kane williamson", "trent boult", "lasith malinga",
    "kieron pollard", "andre russell", "dwayne bravo", "chris gayle", "sunil narine",
    "ab de villiers", "faf du plessis", "dale steyn", "kagiso rabada",
  ];

  for (const player of FICTIONAL_PLAYERS) {
    const lowerName = player.name.toLowerCase();
    for (const star of iconicFullStars) {
      assert(
        lowerName !== star,
        `S6.3: Player name "${player.name}" is not identical to famous star "${star}"`
      );
    }
  }

  // Ensure no import or usage of legacy MATCH_POOLS
  const fictionalSource = await import("../data/fictionalLeagueData");
  assert(!("MATCH_POOLS" in fictionalSource), "S6.4: fictionalLeagueData does NOT export or leak MATCH_POOLS");
}

// ============================================================================
// SUITE 7: FAST LOOKUP DICTIONARIES
// ============================================================================
console.log("\n--- Suite 7: Fast Lookup Dictionaries ---");
{
  assert(
    Object.keys(FICTIONAL_TEAMS_BY_ID).length === 8,
    "S7.1: FICTIONAL_TEAMS_BY_ID contains exactly 8 entries"
  );

  for (const team of FICTIONAL_TEAMS) {
    assert(
      FICTIONAL_TEAMS_BY_ID[team.id] === team,
      `S7.2: FICTIONAL_TEAMS_BY_ID maps ${team.id} to identical object reference`
    );
  }

  assert(
    Object.keys(FICTIONAL_PLAYERS_BY_ID).length === 120,
    "S7.3: FICTIONAL_PLAYERS_BY_ID contains exactly 120 entries"
  );

  for (const player of FICTIONAL_PLAYERS) {
    assert(
      FICTIONAL_PLAYERS_BY_ID[player.id] === player,
      `S7.4: FICTIONAL_PLAYERS_BY_ID maps ${player.id} to identical object reference`
    );
  }

  assert(
    Object.keys(FICTIONAL_PLAYERS_BY_TEAM).length === 8,
    "S7.5: FICTIONAL_PLAYERS_BY_TEAM contains exactly 8 team groups"
  );

  for (const team of FICTIONAL_TEAMS) {
    const teamSquad = FICTIONAL_PLAYERS_BY_TEAM[team.id];
    assert(teamSquad !== undefined, `S7.6: FICTIONAL_PLAYERS_BY_TEAM has group for ${team.id}`);
    assert(teamSquad.length === 15, `S7.7: Group for ${team.id} has exactly 15 players`);
    assert(
      teamSquad.every((p) => p.teamId === team.id),
      `S7.8: All players in group for ${team.id} belong to ${team.id}`
    );
  }
}

// ============================================================================
// SUITE 8: RUNTIME IMMUTABILITY (FROZEN DATA STRUCTURES)
// ============================================================================
console.log("\n--- Suite 8: Runtime Immutability ---");
{
  assert(Object.isFrozen(FICTIONAL_TEAMS), "S8.1: FICTIONAL_TEAMS array is frozen");
  assert(Object.isFrozen(FICTIONAL_PLAYERS), "S8.2: FICTIONAL_PLAYERS array is frozen");
  assert(Object.isFrozen(FICTIONAL_TEAMS_BY_ID), "S8.3: FICTIONAL_TEAMS_BY_ID dictionary is frozen");
  assert(Object.isFrozen(FICTIONAL_PLAYERS_BY_ID), "S8.4: FICTIONAL_PLAYERS_BY_ID dictionary is frozen");
  assert(Object.isFrozen(FICTIONAL_PLAYERS_BY_TEAM), "S8.5: FICTIONAL_PLAYERS_BY_TEAM dictionary is frozen");

  for (const team of FICTIONAL_TEAMS) {
    assert(Object.isFrozen(team.squadPlayerIds), `S8.6: Team ${team.id} squadPlayerIds is frozen`);
  }

  for (const team of FICTIONAL_TEAMS) {
    assert(Object.isFrozen(FICTIONAL_PLAYERS_BY_TEAM[team.id]), `S8.7: Group array for ${team.id} is frozen`);
  }

  // Deep immutability verification
  for (const player of FICTIONAL_PLAYERS) {
    assert(Object.isFrozen(player), `S8.8: Player ${player.id} profile object is deeply frozen`);
    assert(Object.isFrozen(player.ratings), `S8.9: Player ${player.id} ratings object is deeply frozen`);
  }

  for (const team of FICTIONAL_TEAMS) {
    assert(Object.isFrozen(team), `S8.10: Team ${team.id} object is deeply frozen`);
  }
}

console.log("\n=======================================================");
console.log(`   ALL FICTIONAL LEAGUE DATASET TESTS PASSED!`);
console.log(`   Passed: ${passedCount}, Failed: ${failedCount}`);
console.log("=======================================================");
