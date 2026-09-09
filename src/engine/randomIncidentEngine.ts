/**
 * randomIncidentEngine.ts
 *
 * Shared Random Incident Engine for Third Umpire Room.
 *
 * Orchestration layer responsible for:
 * 1. Deterministically selecting an incident type using configurable weights.
 * 2. Deterministically selecting a difficulty tier.
 * 3. Deriving isolated, deterministic scenario seeds via a 32-bit integer mixer.
 * 4. Invoking existing scenario generator functions without mutating physics/rules.
 * 5. Producing reproducible incident sequences for REVIEW SHIFT (8), RAPID (5),
 *    and future LEAGUE mode matches.
 */

import type { IncidentType, DifficultyTier, Scenario } from "../types/scenario";
import { SeededRandom, generateScenario } from "./scenarioGenerator";

/**
 * Authoritative list of all supported incident types.
 * Retains exact identifier "BOUNDARY" from types/scenario.ts.
 */
export const ALL_INCIDENT_TYPES: readonly IncidentType[] = [
  "LBW",
  "RUN_OUT",
  "STUMPING",
  "CAUGHT_BEHIND",
  "BOUNDARY",
] as const;

/**
 * Default initial incident weights.
 * Configurable, not physics rules.
 */
export const DEFAULT_INCIDENT_WEIGHTS: Readonly<Record<IncidentType, number>> = {
  LBW: 30,
  RUN_OUT: 20,
  CAUGHT_BEHIND: 20,
  STUMPING: 15,
  BOUNDARY: 15,
} as const;

export interface IncidentSelection {
  incidentType: IncidentType;
  scenarioSeed: number;
  difficultyTier: DifficultyTier;
}

export interface IncidentEngineConfig {
  weights?: Partial<Record<IncidentType, number>>;
  forcedTier?: DifficultyTier;
}

/**
 * Derives an isolated deterministic 32-bit seed for a specific incident index
 * from the master session seed using a high-avalanche SplitMix32/Murmur3 step.
 */
export function deriveIncidentSeed(sessionSeed: number, incidentIndex: number): number {
  let h = (sessionSeed ^ Math.imul(incidentIndex + 1, 0x9e3779b9)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Derives an isolated scenario seed from an incident seed.
 * Ensures the selection RNG stream and scenario generation RNG stream
 * remain completely independent and decoupled.
 */
export function deriveScenarioSeed(incidentSeed: number): number {
  let h = (incidentSeed ^ 0x6a09e667) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Deterministically picks an incident type based on configured weights.
 * Excludes weight 0 and negative weights.
 * Falls back to uniform random selection if all weights are zero.
 */
export function pickWeightedIncidentType(
  rng: SeededRandom,
  customWeights?: Partial<Record<IncidentType, number>>
): IncidentType {
  const mergedWeights: Record<IncidentType, number> = {
    ...DEFAULT_INCIDENT_WEIGHTS,
    ...customWeights,
  };

  const eligible: { type: IncidentType; weight: number }[] = [];
  let totalWeight = 0;

  for (const type of ALL_INCIDENT_TYPES) {
    const rawWeight = mergedWeights[type];
    const weight = typeof rawWeight === "number" && Number.isFinite(rawWeight) && rawWeight > 0
      ? rawWeight
      : 0;

    if (weight > 0) {
      eligible.push({ type, weight });
      totalWeight += weight;
    }
  }

  // Safe deterministic uniform fallback if all weights are zero or invalid
  if (eligible.length === 0 || totalWeight <= 0) {
    return ALL_INCIDENT_TYPES[Math.floor(rng.next() * ALL_INCIDENT_TYPES.length)];
  }

  const roll = rng.next() * totalWeight;
  let running = 0;

  for (const item of eligible) {
    running += item.weight;
    if (roll < running) {
      return item.type;
    }
  }

  return eligible[eligible.length - 1].type;
}

/**
 * Deterministically picks a difficulty tier from the three existing tiers.
 */
export function pickDifficultyTier(rng: SeededRandom): DifficultyTier {
  const roll = rng.next();
  if (roll < 0.35) {
    return "CLEAR";
  }
  if (roll < 0.85) {
    return "MARGINAL";
  }
  return "HOWLER";
}

/**
 * Selects an incident's parameters deterministically for a given session seed and index.
 */
export function selectIncident(
  sessionSeed: number,
  incidentIndex: number,
  config?: IncidentEngineConfig
): IncidentSelection {
  const incidentSeed = deriveIncidentSeed(sessionSeed, incidentIndex);
  const selectionRng = new SeededRandom(incidentSeed);

  const incidentType = pickWeightedIncidentType(selectionRng, config?.weights);
  const difficultyTier = config?.forcedTier ?? pickDifficultyTier(selectionRng);
  const scenarioSeed = deriveScenarioSeed(incidentSeed);

  return {
    incidentType,
    scenarioSeed,
    difficultyTier,
  };
}

/**
 * Generates an array of deterministic scenarios for a session.
 * Replaces hardcoded arrays in RAPID (5) and REVIEW SHIFT (8).
 */
export function generateSessionIncidents(
  sessionSeed: number,
  count: number,
  config?: IncidentEngineConfig
): Scenario[] {
  const scenarios: Scenario[] = [];
  for (let i = 0; i < count; i++) {
    const selection = selectIncident(sessionSeed, i, config);
    scenarios.push(
      generateScenario(selection.scenarioSeed, selection.incidentType, selection.difficultyTier)
    );
  }
  return scenarios;
}
