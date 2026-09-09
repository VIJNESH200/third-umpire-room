/**
 * randomIncidentEngine.test.ts
 *
 * Test suite for the Shared Random Incident Engine:
 * 1. Same session seed produces identical sequence.
 * 2. Same incident index + same session seed produces identical selection.
 * 3. Same selection produces identical scenario.
 * 4. Different incident indices derive different scenario seeds.
 * 5. Different session seeds can produce different sequences.
 * 6. All five incident types can be selected over a sufficiently large deterministic sample.
 * 7. Weighted distribution approximately follows configured weights.
 * 8. Zero-weight incidents never appear.
 * 9. All-zero weights have deterministic safe behavior.
 * 10. Every selected incident generates a valid Scenario.
 * 11. Custom forcedTier overrides randomized difficulty.
 */

import {
  deriveIncidentSeed,
  deriveScenarioSeed,
  selectIncident,
  generateSessionIncidents,
  ALL_INCIDENT_TYPES,
  DEFAULT_INCIDENT_WEIGHTS,
} from "../engine/randomIncidentEngine";
import { generateScenario } from "../engine/scenarioGenerator";
import type { IncidentType, DifficultyTier } from "../types/scenario";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    failedCount++;
    process.exit(1);
  } else {
    console.log(`[PASS] ${msg}`);
    passedCount++;
  }
}

console.log("\n=======================================================");
console.log("   SHARED RANDOM INCIDENT ENGINE TEST SUITE");
console.log("=======================================================\n");

// 0. Seed Derivations & Default Configuration
{
  const incSeed1 = deriveIncidentSeed(12345, 0);
  const incSeed2 = deriveIncidentSeed(12345, 0);
  assert(incSeed1 === incSeed2, "T0.1: deriveIncidentSeed is deterministic for identical inputs");

  const scenSeed1 = deriveScenarioSeed(incSeed1);
  const scenSeed2 = deriveScenarioSeed(incSeed1);
  assert(scenSeed1 === scenSeed2, "T0.2: deriveScenarioSeed is deterministic for identical inputs");
  assert(scenSeed1 !== incSeed1, "T0.3: deriveScenarioSeed is isolated from incidentSeed");

  assert(
    DEFAULT_INCIDENT_WEIGHTS.LBW === 30 &&
      DEFAULT_INCIDENT_WEIGHTS.RUN_OUT === 20 &&
      DEFAULT_INCIDENT_WEIGHTS.CAUGHT_BEHIND === 20 &&
      DEFAULT_INCIDENT_WEIGHTS.STUMPING === 15 &&
      DEFAULT_INCIDENT_WEIGHTS.BOUNDARY === 15,
    "T0.4: DEFAULT_INCIDENT_WEIGHTS matches initial specification"
  );
}

// 1. Same session seed produces identical sequence
{
  const sessionSeed = 48192;
  const seq1 = generateSessionIncidents(sessionSeed, 8);
  const seq2 = generateSessionIncidents(sessionSeed, 8);

  assert(seq1.length === 8 && seq2.length === 8, "T1.1: Generates requested 8 incidents");
  const types1 = seq1.map((s) => s.incidentType);
  const types2 = seq2.map((s) => s.incidentType);
  assert(
    JSON.stringify(types1) === JSON.stringify(types2),
    `T1.2: Identical incident types for seed ${sessionSeed} (${types1.join(", ")})`
  );

  const ids1 = seq1.map((s) => s.id);
  const ids2 = seq2.map((s) => s.id);
  assert(
    JSON.stringify(ids1) === JSON.stringify(ids2),
    `T1.3: Identical scenario IDs for seed ${sessionSeed} (${ids1.join(", ")})`
  );
}

// 2. Same incident index + same session seed produces identical selection
{
  const sessionSeed = 998877;
  const selA = selectIncident(sessionSeed, 3);
  const selB = selectIncident(sessionSeed, 3);

  assert(
    selA.incidentType === selB.incidentType &&
      selA.difficultyTier === selB.difficultyTier &&
      selA.scenarioSeed === selB.scenarioSeed,
    `T2: Exact repeatable selection at index 3 (type=${selA.incidentType}, tier=${selA.difficultyTier}, seed=${selA.scenarioSeed})`
  );
}

// 3. Same selection produces identical scenario
{
  const sessionSeed = 54321;
  const sel = selectIncident(sessionSeed, 2);
  const scn1 = generateScenario(sel.scenarioSeed, sel.incidentType, sel.difficultyTier);
  const scn2 = generateScenario(sel.scenarioSeed, sel.incidentType, sel.difficultyTier);

  assert(
    JSON.stringify(scn1) === JSON.stringify(scn2),
    "T3: Same selection produces byte-for-byte identical Scenario object"
  );
}

// 4. Different incident indices derive different scenario seeds
{
  const sessionSeed = 77777;
  const seeds = new Set<number>();
  for (let i = 0; i < 20; i++) {
    const sel = selectIncident(sessionSeed, i);
    seeds.add(sel.scenarioSeed);
  }
  assert(seeds.size === 20, "T4: 20 sequential incident indices produce 20 unique scenario seeds");
}

// 5. Different session seeds can produce different sequences
{
  const seqA = generateSessionIncidents(11111, 8).map((s) => `${s.incidentType}:${s.id}`);
  const seqB = generateSessionIncidents(99999, 8).map((s) => `${s.incidentType}:${s.id}`);

  assert(
    JSON.stringify(seqA) !== JSON.stringify(seqB),
    "T5: Different session seeds produce distinct incident sequences"
  );
}

// 6. All five incident types can be selected over a sufficiently large deterministic sample
{
  const seenTypes = new Set<IncidentType>();
  for (let i = 0; i < 100; i++) {
    const sel = selectIncident(12345, i);
    seenTypes.add(sel.incidentType);
  }

  for (const expectedType of ALL_INCIDENT_TYPES) {
    assert(
      seenTypes.has(expectedType),
      `T6: Incident type '${expectedType}' appears in deterministic 100-incident sample`
    );
  }
}

// 7. Weighted distribution approximately follows configured weights
{
  // Weights: LBW 30%, RUN_OUT 20%, CAUGHT_BEHIND 20%, STUMPING 15%, BOUNDARY 15%
  const counts: Record<IncidentType, number> = {
    LBW: 0,
    RUN_OUT: 0,
    CAUGHT_BEHIND: 0,
    STUMPING: 0,
    BOUNDARY: 0,
  };

  const SAMPLE_SIZE = 5000;
  for (let i = 0; i < SAMPLE_SIZE; i++) {
    const sel = selectIncident(10000 + (i % 100), Math.floor(i / 100));
    counts[sel.incidentType]++;
  }

  const pct = (type: IncidentType) => (counts[type] / SAMPLE_SIZE) * 100;

  console.log(
    `   [DISTRIBUTION] Sample: ${SAMPLE_SIZE} incidents → ` +
      `LBW: ${pct("LBW").toFixed(1)}% (tgt 30%), ` +
      `RUN_OUT: ${pct("RUN_OUT").toFixed(1)}% (tgt 20%), ` +
      `CAUGHT_BEHIND: ${pct("CAUGHT_BEHIND").toFixed(1)}% (tgt 20%), ` +
      `STUMPING: ${pct("STUMPING").toFixed(1)}% (tgt 15%), ` +
      `BOUNDARY: ${pct("BOUNDARY").toFixed(1)}% (tgt 15%)`
  );

  assert(Math.abs(pct("LBW") - 30) < 4.0, "T7.1: LBW within tolerance (30% ± 4%)");
  assert(Math.abs(pct("RUN_OUT") - 20) < 3.5, "T7.2: RUN_OUT within tolerance (20% ± 3.5%)");
  assert(Math.abs(pct("CAUGHT_BEHIND") - 20) < 3.5, "T7.3: CAUGHT_BEHIND within tolerance (20% ± 3.5%)");
  assert(Math.abs(pct("STUMPING") - 15) < 3.0, "T7.4: STUMPING within tolerance (15% ± 3%)");
  assert(Math.abs(pct("BOUNDARY") - 15) < 3.0, "T7.5: BOUNDARY within tolerance (15% ± 3%)");
}

// 8. Zero-weight incidents never appear
{
  const customConfig = {
    weights: {
      LBW: 50,
      RUN_OUT: 50,
      CAUGHT_BEHIND: 0,
      STUMPING: 0,
      BOUNDARY: 0,
    },
  };

  let zeroWeightViolation = false;
  for (let i = 0; i < 500; i++) {
    const sel = selectIncident(8888, i, customConfig);
    if (sel.incidentType !== "LBW" && sel.incidentType !== "RUN_OUT") {
      zeroWeightViolation = true;
      break;
    }
  }
  assert(!zeroWeightViolation, "T8: Zero-weight incident types (CAUGHT_BEHIND, STUMPING, BOUNDARY) never appear");
}

// 9. All-zero weights have deterministic safe behavior
{
  const zeroConfig = {
    weights: {
      LBW: 0,
      RUN_OUT: 0,
      CAUGHT_BEHIND: 0,
      STUMPING: 0,
      BOUNDARY: 0,
    },
  };

  const sel1 = selectIncident(4567, 0, zeroConfig);
  const sel2 = selectIncident(4567, 0, zeroConfig);

  assert(
    ALL_INCIDENT_TYPES.includes(sel1.incidentType),
    `T9.1: Safe fallback produces valid IncidentType (${sel1.incidentType})`
  );
  assert(
    sel1.incidentType === sel2.incidentType,
    "T9.2: Fallback is deterministic for identical seed and index"
  );
}

// 10. Every selected incident generates a valid Scenario
{
  const sample = generateSessionIncidents(334455, 10);
  assert(sample.length === 10, "T10.1: Generated 10 valid scenarios");

  for (let i = 0; i < sample.length; i++) {
    const scn = sample[i];
    assert(typeof scn.id === "string" && scn.id.startsWith("SCN-"), `T10.2: Scenario ${i} has valid ID ${scn.id}`);
    assert(ALL_INCIDENT_TYPES.includes(scn.incidentType), `T10.3: Scenario ${i} has valid incidentType ${scn.incidentType}`);
    assert(
      scn.correctFinalVerdict === "OUT" || scn.correctFinalVerdict === "NOT_OUT",
      `T10.4: Scenario ${i} has valid correctFinalVerdict ${scn.correctFinalVerdict}`
    );
    assert(
      scn.drsEvaluation !== undefined && typeof scn.drsEvaluation.ruleCitation === "string",
      `T10.5: Scenario ${i} has complete drsEvaluation and ruleCitation`
    );
  }
}

// 11. forcedTier overrides randomized difficulty
{
  const tiers: DifficultyTier[] = ["CLEAR", "MARGINAL", "HOWLER"];
  for (const tier of tiers) {
    const sel = selectIncident(999, 1, { forcedTier: tier });
    assert(sel.difficultyTier === tier, `T11: forcedTier '${tier}' correctly overrides difficulty`);
  }
}

console.log("\n=======================================================");
console.log(`   TESTS PASSED: ${passedCount} | FAILED: ${failedCount}`);
console.log("=======================================================\n");
