/**
 * src/tests/realMatchIncidentSelector.test.ts
 *
 * Comprehensive test suite for Task 1:
 * Real Match DRS Incident Injection & Selection.
 */

import { T20_WC_2024_FINAL } from "../data/realMatches/t20Wc2024Final";
import {
  isDeliveryEligibleForIncident,
  selectRealMatchIncident,
  createRealMatchIncidentSchedule,
  createRealMatchIncidentMap,
} from "../engine/realMatchIncidentSelector";
import { ALL_INCIDENT_TYPES } from "../engine/randomIncidentEngine";
import type { RealDelivery } from "../types/realMatch";
import type { DifficultyTier } from "../types/scenario";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${message}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log("=======================================================");
console.log("   RUNNING TASK 1: REAL MATCH INCIDENT SELECTOR TESTS  ");
console.log("=======================================================\n");

// Build a fast delivery lookup for T20_WC_2024_FINAL
const deliveryMap = new Map<string, RealDelivery>();
for (const inn of T20_WC_2024_FINAL.innings) {
  for (const d of inn.deliveries) {
    deliveryMap.set(d.id, d);
  }
}

// ---------------------------------------------------------------------------
// 1. Delivery Eligibility Rules
// ---------------------------------------------------------------------------
console.log("--- Group 1: Delivery Eligibility Edge Cases ---");

const dotBall: RealDelivery = {
  id: "test_dot",
  innings: 1,
  over: 0,
  ball: 1,
  deliveryIndex: 0,
  striker: "Batter A",
  nonStriker: "Batter B",
  bowler: "Bowler C",
  outcome: { runsBatter: 0 },
};

const wideDelivery: RealDelivery = {
  id: "test_wide",
  innings: 1,
  over: 0,
  ball: 2,
  deliveryIndex: 1,
  striker: "Batter A",
  nonStriker: "Batter B",
  bowler: "Bowler C",
  outcome: { runsBatter: 0, runsExtras: 1, extras: { type: "WIDES", runs: 1 } },
};

const noBallDelivery: RealDelivery = {
  id: "test_noball",
  innings: 1,
  over: 0,
  ball: 3,
  deliveryIndex: 2,
  striker: "Batter A",
  nonStriker: "Batter B",
  bowler: "Bowler C",
  outcome: { runsBatter: 1, runsExtras: 1, extras: { type: "NO_BALLS", runs: 1 } },
};

const boundaryFour: RealDelivery = {
  id: "test_four",
  innings: 1,
  over: 0,
  ball: 4,
  deliveryIndex: 3,
  striker: "Batter A",
  nonStriker: "Batter B",
  bowler: "Bowler C",
  outcome: { runsBatter: 4 },
};

const caughtDismissal: RealDelivery = {
  id: "test_caught",
  innings: 1,
  over: 0,
  ball: 5,
  deliveryIndex: 4,
  striker: "Batter A",
  nonStriker: "Batter B",
  bowler: "Bowler C",
  outcome: { runsBatter: 0, wicket: { kind: "CAUGHT", playerOut: "Batter A" } },
};

const bowledDismissal: RealDelivery = {
  id: "test_bowled",
  innings: 1,
  over: 0,
  ball: 6,
  deliveryIndex: 5,
  striker: "Batter A",
  nonStriker: "Batter B",
  bowler: "Bowler C",
  outcome: { runsBatter: 0, wicket: { kind: "BOWLED", playerOut: "Batter A" } },
};

// LBW
assert(isDeliveryEligibleForIncident(dotBall, "LBW"), "LBW: Dot ball is eligible");
assert(!isDeliveryEligibleForIncident(wideDelivery, "LBW"), "LBW: Wide is ineligible (Law 36 / 22)");
assert(!isDeliveryEligibleForIncident(noBallDelivery, "LBW"), "LBW: No ball is ineligible (Law 36.1)");
assert(!isDeliveryEligibleForIncident(boundaryFour, "LBW"), "LBW: Boundary 4 is ineligible");
assert(!isDeliveryEligibleForIncident(bowledDismissal, "LBW"), "LBW: Conflicting bowled dismissal is ineligible");

// RUN_OUT
assert(isDeliveryEligibleForIncident(dotBall, "RUN_OUT"), "RUN_OUT: Dot ball is eligible");
assert(isDeliveryEligibleForIncident(wideDelivery, "RUN_OUT"), "RUN_OUT: Wide is eligible (Law 38 allows run out on wide)");
assert(isDeliveryEligibleForIncident(noBallDelivery, "RUN_OUT"), "RUN_OUT: No ball is eligible (Law 38 allows run out on no ball)");
assert(!isDeliveryEligibleForIncident(boundaryFour, "RUN_OUT"), "RUN_OUT: Boundary 4 is ineligible");
assert(!isDeliveryEligibleForIncident(bowledDismissal, "RUN_OUT"), "RUN_OUT: Conflicting bowled dismissal is ineligible");

// STUMPING
assert(isDeliveryEligibleForIncident(dotBall, "STUMPING"), "STUMPING: Dot ball is eligible");
assert(isDeliveryEligibleForIncident(wideDelivery, "STUMPING"), "STUMPING: Wide is eligible (Law 39.1 allows stumping on wide)");
assert(!isDeliveryEligibleForIncident(noBallDelivery, "STUMPING"), "STUMPING: No ball is ineligible (Law 39.1 forbids stumping on no ball)");
assert(!isDeliveryEligibleForIncident(boundaryFour, "STUMPING"), "STUMPING: Boundary four is ineligible");
assert(!isDeliveryEligibleForIncident(bowledDismissal, "STUMPING"), "STUMPING: Conflicting bowled dismissal is ineligible");

// CAUGHT_BEHIND
assert(isDeliveryEligibleForIncident(dotBall, "CAUGHT_BEHIND"), "CAUGHT_BEHIND: Dot ball is eligible");
assert(!isDeliveryEligibleForIncident(wideDelivery, "CAUGHT_BEHIND"), "CAUGHT_BEHIND: Wide is ineligible (Law 33)");
assert(!isDeliveryEligibleForIncident(noBallDelivery, "CAUGHT_BEHIND"), "CAUGHT_BEHIND: No ball is ineligible (Law 33.1)");
assert(!isDeliveryEligibleForIncident(boundaryFour, "CAUGHT_BEHIND"), "CAUGHT_BEHIND: Boundary four is ineligible");
assert(isDeliveryEligibleForIncident(caughtDismissal, "CAUGHT_BEHIND"), "CAUGHT_BEHIND: Real caught dismissal is eligible");
assert(!isDeliveryEligibleForIncident(bowledDismissal, "CAUGHT_BEHIND"), "CAUGHT_BEHIND: Conflicting bowled dismissal is ineligible");

// BOUNDARY
assert(isDeliveryEligibleForIncident(dotBall, "BOUNDARY"), "BOUNDARY: Dot ball is eligible");
assert(!isDeliveryEligibleForIncident(wideDelivery, "BOUNDARY"), "BOUNDARY: Wide is ineligible");
assert(!isDeliveryEligibleForIncident(noBallDelivery, "BOUNDARY"), "BOUNDARY: No ball is ineligible");
assert(isDeliveryEligibleForIncident(caughtDismissal, "BOUNDARY"), "BOUNDARY: Real caught dismissal is eligible for rope review");
assert(!isDeliveryEligibleForIncident(bowledDismissal, "BOUNDARY"), "BOUNDARY: Conflicting bowled dismissal is ineligible");

// ---------------------------------------------------------------------------
// 2. Determinism & Seed Isolation Requirements
// ---------------------------------------------------------------------------
console.log("\n--- Group 2: Determinism & Seed Isolation ---");

const sessionSeed = 1726248900000;

// Requirement 1: Same seed produces identical incident sequence
const incA_0 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 0);
const incA_1 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 1);
const incA_2 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 2);

const incB_0 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 0);
const incB_1 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 1);
const incB_2 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 2);

assert(incA_0.deliveryId === incB_0.deliveryId, "Req 1: Same seed produces identical deliveryId (index 0)");
assert(incA_0.incidentType === incB_0.incidentType, "Req 1: Same seed produces identical incidentType (index 0)");
assert(incA_0.difficulty === incB_0.difficulty, "Req 1: Same seed produces identical difficulty (index 0)");
assert(incA_0.scenario.id === incB_0.scenario.id, "Req 1: Same seed produces identical scenario.id (index 0)");
assert(incA_0.scenario.correctFinalVerdict === incB_0.scenario.correctFinalVerdict, "Req 1: Same scenario verdict");

assert(incA_1.deliveryId === incB_1.deliveryId, "Req 1: Same seed produces identical deliveryId (index 1)");
assert(incA_2.deliveryId === incB_2.deliveryId, "Req 1: Same seed produces identical deliveryId (index 2)");

// Requirement 2: Different seed produces a different sequence
const differentSeed = 998877665544;
const incDiff_0 = selectRealMatchIncident(T20_WC_2024_FINAL, differentSeed, 0);
const incDiff_1 = selectRealMatchIncident(T20_WC_2024_FINAL, differentSeed, 1);
const isDifferent =
  incA_0.deliveryId !== incDiff_0.deliveryId ||
  incA_0.incidentType !== incDiff_0.incidentType ||
  incA_1.deliveryId !== incDiff_1.deliveryId;
assert(isDifferent, "Req 2: Different seed produces a different incident sequence");

// Requirement 3: Existing incident difficulty tiers are preserved
const tiersFound = new Set<DifficultyTier>();
for (let i = 0; i < 50; i++) {
  const inc = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed + i * 1000, i);
  tiersFound.add(inc.difficulty);
}
assert(tiersFound.has("CLEAR"), "Req 3: CLEAR difficulty tier produced");
assert(tiersFound.has("MARGINAL"), "Req 3: MARGINAL difficulty tier produced");
assert(tiersFound.has("HOWLER"), "Req 3: HOWLER difficulty tier produced");
for (const t of tiersFound) {
  assert(t === "CLEAR" || t === "MARGINAL" || t === "HOWLER", `Req 3: Valid tier ${t}`);
}

// Requirement 4: All five incident types can be selected when eligible
for (const forcedType of ALL_INCIDENT_TYPES) {
  const inc = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 0, { forcedType });
  assert(inc.incidentType === forcedType, `Req 4: Incident type ${forcedType} selected successfully`);
  const targetDel = deliveryMap.get(inc.deliveryId)!;
  assert(targetDel !== undefined, `Req 4: Delivery ${inc.deliveryId} exists for ${forcedType}`);
  assert(
    isDeliveryEligibleForIncident(targetDel, forcedType),
    `Req 4: Delivery ${inc.deliveryId} is genuinely eligible for ${forcedType}`
  );
}

// Requirement 5: Selected delivery IDs actually exist in the real match
for (let i = 0; i < 20; i++) {
  const inc = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, i);
  assert(deliveryMap.has(inc.deliveryId), `Req 5: Selected delivery ${inc.deliveryId} exists in real match`);
  const del = deliveryMap.get(inc.deliveryId)!;
  assert(del.innings === inc.innings, `Req 5: Innings matches delivery metadata (${del.innings})`);
  assert(inc.matchId === T20_WC_2024_FINAL.id, `Req 5: MatchId matches ${T20_WC_2024_FINAL.id}`);
}

// Requirement 6: No canonical delivery is mutated
assert(Object.isFrozen(T20_WC_2024_FINAL), "Req 6: T20_WC_2024_FINAL is deeply frozen");
for (const inn of T20_WC_2024_FINAL.innings) {
  assert(Object.isFrozen(inn), "Req 6: Innings object is frozen");
  for (const d of inn.deliveries) {
    assert(Object.isFrozen(d), `Req 6: Delivery ${d.id} is frozen`);
  }
}

// Requirement 7: Incident records do not clone the match
const sampleIncident = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 0);
assert(
  !("deliveries" in sampleIncident) && !("innings" in sampleIncident && Array.isArray((sampleIncident as any).innings)),
  "Req 7: Incident record stores lightweight references/IDs, does not clone match"
);
assert(typeof sampleIncident.deliveryId === "string", "Req 7: deliveryId is a string reference");
assert(typeof sampleIncident.matchId === "string", "Req 7: matchId is a string reference");

// Requirement 8: Scenario generation remains deterministic
const incA_retry = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 0);
assert(incA_0.scenario.id === incA_retry.scenario.id, "Req 8: Scenario id matches on retry");
assert(
  JSON.stringify(incA_0.scenario.drsEvaluation) === JSON.stringify(incA_retry.scenario.drsEvaluation),
  "Req 8: Scenario drsEvaluation matches exactly"
);

// Requirement 11: Retry reproduces the same incident
for (let i = 0; i < 5; i++) {
  const first = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, i);
  const retry = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, i);
  assert(first.deliveryId === retry.deliveryId, `Req 11: Retry reproduces deliveryId at index ${i}`);
  assert(first.incidentType === retry.incidentType, `Req 11: Retry reproduces incidentType at index ${i}`);
  assert(first.difficulty === retry.difficulty, `Req 11: Retry reproduces difficulty at index ${i}`);
}

// Requirement 12: Next incident advances deterministically
const seq0 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 0);
const seq1 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 1);
const seq2 = selectRealMatchIncident(T20_WC_2024_FINAL, sessionSeed, 2);
assert(seq0.scenario.id !== seq1.scenario.id, "Req 12: Next incident advances to unique scenario");
assert(seq1.scenario.id !== seq2.scenario.id, "Req 12: Index 2 advances to unique scenario");

// ---------------------------------------------------------------------------
// 3. Incident Schedule & Duplicate Prevention
// ---------------------------------------------------------------------------
console.log("\n--- Group 3: Schedule Generation & Duplicate Prevention ---");

const schedule8 = createRealMatchIncidentSchedule(T20_WC_2024_FINAL, sessionSeed, 8);
assert(schedule8.length === 8, "Schedule generates exactly 8 incidents");

const seenDeliveryIds = new Set<string>();
for (const inc of schedule8) {
  assert(!seenDeliveryIds.has(inc.deliveryId), `No duplicate delivery: ${inc.deliveryId} is unique in session`);
  seenDeliveryIds.add(inc.deliveryId);
}

// First delivery "1_0_1" is preserved for clean normal playback start
assert(!seenDeliveryIds.has("1_0_1"), "First delivery '1_0_1' is excluded from incident schedule for clean kickoff");

// Incident Map Lookup
const map8 = createRealMatchIncidentMap(T20_WC_2024_FINAL, sessionSeed, 8);
assert(map8.size === 8, "Incident map has 8 entries");
for (const inc of schedule8) {
  assert(map8.has(inc.deliveryId), `Map contains scheduled delivery ${inc.deliveryId}`);
  assert(map8.get(inc.deliveryId)!.scenario.id === inc.scenario.id, `Map lookup matches scheduled scenario`);
}

// Innings distribution: both innings are represented in a full session
let inn1Count = 0;
let inn2Count = 0;
for (const inc of schedule8) {
  if (inc.innings === 1) inn1Count++;
  if (inc.innings === 2) inn2Count++;
}
assert(inn1Count > 0, `Schedule has Innings 1 incidents (count: ${inn1Count})`);
assert(inn2Count > 0, `Schedule has Innings 2 incidents (count: ${inn2Count})`);

// ---------------------------------------------------------------------------
// 4. Defensive Guard on Empty Eligibility Pool
// ---------------------------------------------------------------------------
console.log("\n--- Group 4: Defensive Guard on Empty Eligibility Pool ---");

const dummyEmptyMatch = {
  ...T20_WC_2024_FINAL,
  id: "test_empty_match",
  innings: [
    {
      ...T20_WC_2024_FINAL.innings[0],
      inningsNumber: 1,
      deliveries: [
        wideDelivery, // Wide is ineligible for LBW
      ],
    },
  ],
};

let errorCaught = false;
try {
  selectRealMatchIncident(dummyEmptyMatch, 12345, 0, {
    forcedType: "LBW",
    inningsIndex: 0,
  });
} catch (err: any) {
  errorCaught = true;
  assert(
    err.message.includes("No eligible deliveries found in innings 1 for incident type LBW"),
    `Error message correctly identifies innings and incident type: "${err.message}"`
  );
}
assert(errorCaught, "Defensive guard throws Error when no eligible deliveries exist");

console.log("\n=======================================================");
console.log(`   ALL TASK 1 TESTS PASSED! (${passedCount} assertions, ${failedCount} failures)`);
console.log("=======================================================\n");
