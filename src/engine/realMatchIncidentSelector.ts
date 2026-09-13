/**
 * src/engine/realMatchIncidentSelector.ts
 *
 * Lightweight real-match delivery selection and DRS incident injection engine.
 *
 * Architectural Boundary:
 * - Real Match Data: canonical historical baseline (deeply immutable).
 * - Incident Selector: chooses when and where a fictional DRS incident occurs.
 * - DRS Physics + Rules: determine what actually happened (reused directly).
 * - DRS Consequence Bridge: translates verdict into a match consequence.
 *
 * Determinism Guarantee:
 * Given: same match + same session seed + same incident index,
 * the selected delivery, incident type, difficulty tier, and generated scenario
 * are 100% deterministic and reproducible.
 */

import type { RealMatch, RealDelivery, RealMatchDrsIncident } from "../types/realMatch";
import type { IncidentType, DifficultyTier } from "../types/scenario";
import {
  deriveIncidentSeed,
  deriveScenarioSeed,
  pickWeightedIncidentType,
  pickDifficultyTier,
} from "./randomIncidentEngine";
import { SeededRandom, generateScenario } from "./scenarioGenerator";

export type { RealMatchDrsIncident };

/**
 * Pure function: Evaluates whether a canonical real-match delivery is eligible
 * for a fictional DRS incident of the requested type.
 *
 * Rules:
 * - LBW:
 *   - Cannot occur on a No Ball (Law 36.1 forbids LBW on No Ball).
 *   - Cannot occur on a Wide (Law 36 / 22: ball passes wide of batter).
 *   - Batter runs must be < 4 (delivery did not travel to boundary off the bat).
 *   - No conflicting non-LBW dismissal (if baseline had wicket, must be LBW).
 *
 * - RUN_OUT:
 *   - Under Law 38, run-out can occur off any ball (fair, wide, no-ball).
 *   - No conflicting non-Run-Out dismissal (if baseline had wicket, must be RUN_OUT).
 *
 * - STUMPING:
 *   - Cannot occur on a No Ball (Law 39.1 forbids Stumping on No Ball).
 *   - Can occur on a Wide (Law 39.1 permits Stumping off Wide).
 *   - Batter runs must be 0 (batter missed stroke / stepped out).
 *   - No conflicting non-Stumping dismissal (if baseline had wicket, must be STUMPED).
 *
 * - CAUGHT_BEHIND:
 *   - Cannot occur on a No Ball (Law 33.1 forbids Caught on No Ball).
 *   - Cannot occur on a Wide (by definition, wides do not touch the bat).
 *   - Batter runs must be < 4.
 *   - No conflicting non-Caught dismissal (if baseline had wicket, must be CAUGHT).
 *
 * - BOUNDARY:
 *   - Cannot occur on a Wide.
 *   - Cannot occur on a No Ball for boundary catches.
 *   - No conflicting non-Caught dismissal (if baseline had wicket, must be CAUGHT).
 */
export function isDeliveryEligibleForIncident(
  delivery: RealDelivery,
  incidentType: IncidentType
): boolean {
  const extrasType = delivery.outcome.extras?.type;
  const isNoBall = extrasType === "NO_BALLS";
  const isWide = extrasType === "WIDES";
  const wicket = delivery.outcome.wicket;
  const runsBatter = delivery.outcome.runsBatter ?? 0;

  switch (incidentType) {
    case "LBW":
      if (isNoBall || isWide) return false;
      if (runsBatter >= 4) return false;
      if (wicket && wicket.kind !== "LBW") return false;
      return true;

    case "RUN_OUT":
      if (runsBatter >= 4) return false;
      if (wicket && wicket.kind !== "RUN_OUT") return false;
      return true;

    case "STUMPING":
      if (isNoBall) return false;
      if (runsBatter > 0) return false;
      if (wicket && wicket.kind !== "STUMPED") return false;
      return true;

    case "CAUGHT_BEHIND":
      if (isNoBall || isWide) return false;
      if (runsBatter >= 4) return false;
      if (wicket && wicket.kind !== "CAUGHT") return false;
      return true;

    case "BOUNDARY":
      if (isWide || isNoBall) return false;
      if (wicket && wicket.kind !== "CAUGHT") return false;
      return true;

    default:
      return false;
  }
}

export interface RealMatchIncidentConfig {
  readonly weights?: Partial<Record<IncidentType, number>>;
  readonly forcedType?: IncidentType;
  readonly forcedTier?: DifficultyTier;
  readonly excludedDeliveryIds?: ReadonlySet<string>;
  readonly inningsIndex?: number;
}

/**
 * Deterministically selects a real delivery and attaches a generated DRS incident scenario.
 *
 * Seed isolation:
 * - sessionSeed + incidentIndex -> incidentSeed
 * - incidentSeed -> selectionRng (picks incidentType, difficultyTier, eligible delivery)
 * - incidentSeed -> scenarioSeed (scenario generation RNG stream is completely decoupled)
 */
export function selectRealMatchIncident(
  match: RealMatch,
  sessionSeed: number,
  incidentIndex: number,
  config?: RealMatchIncidentConfig
): RealMatchDrsIncident {
  const incidentSeed = deriveIncidentSeed(sessionSeed, incidentIndex);
  const selectionRng = new SeededRandom(incidentSeed);

  // 1. Pick incident type deterministically
  const incidentType =
    config?.forcedType ?? pickWeightedIncidentType(selectionRng, config?.weights);

  // 2. Pick difficulty tier deterministically
  const difficulty = config?.forcedTier ?? pickDifficultyTier(selectionRng);

  // 3. Gather deliveries within the specified scope
  let pool: readonly RealDelivery[];
  if (
    config?.inningsIndex !== undefined &&
    config.inningsIndex >= 0 &&
    config.inningsIndex < match.innings.length
  ) {
    pool = match.innings[config.inningsIndex].deliveries;
  } else {
    pool = match.innings.flatMap((inn) => inn.deliveries);
  }

  // 4. Filter by eligibility for this incident type
  const eligible = pool.filter((d) => isDeliveryEligibleForIncident(d, incidentType));

  if (eligible.length === 0) {
    const inningsNum =
      config?.inningsIndex !== undefined && match.innings[config.inningsIndex]
        ? match.innings[config.inningsIndex].inningsNumber
        : match.innings.length === 1
        ? match.innings[0].inningsNumber
        : undefined;
    const scopeDesc =
      inningsNum !== undefined ? `innings ${inningsNum}` : `match ${match.id}`;
    throw new Error(
      `No eligible deliveries found in ${scopeDesc} for incident type ${incidentType}`
    );
  }

  // 5. Apply exclusion set to avoid duplicate selections within the session
  const nonExcluded =
    config?.excludedDeliveryIds && config.excludedDeliveryIds.size > 0
      ? eligible.filter((d) => !config.excludedDeliveryIds!.has(d.id))
      : eligible;

  // Fallback if all eligible deliveries were excluded: reuse eligible pool
  const candidates = nonExcluded.length > 0 ? nonExcluded : eligible;

  // 6. Deterministically select delivery from candidate pool using selectionRng
  const pickedIdx = Math.floor(selectionRng.next() * candidates.length);
  const selectedDelivery = candidates[pickedIdx];

  // 7. Derive isolated scenario seed and invoke scenario generator
  const scenarioSeed = deriveScenarioSeed(incidentSeed);
  const scenario = generateScenario(scenarioSeed, incidentType, difficulty);

  return {
    matchId: match.id,
    innings: selectedDelivery.innings,
    deliveryId: selectedDelivery.id,
    incidentType,
    difficulty,
    scenario,
  };
}

/**
 * Generates an ordered schedule of non-duplicate DRS incidents across a match.
 * By default, evenly distributes incidents across available innings and excludes
 * the very first ball ("1_0_1") so the session always starts with clean normal playback.
 */
export function createRealMatchIncidentSchedule(
  match: RealMatch,
  sessionSeed: number,
  count: number = 8,
  config?: Omit<RealMatchIncidentConfig, "excludedDeliveryIds">
): RealMatchDrsIncident[] {
  const incidents: RealMatchDrsIncident[] = [];
  const excluded = new Set<string>();

  // Exclude first delivery by default to guarantee clean match kickoff
  const firstDeliveryId = match.innings[0]?.deliveries[0]?.id;
  if (firstDeliveryId) {
    excluded.add(firstDeliveryId);
  }

  const numInnings = Math.max(1, match.innings.length);

  for (let i = 0; i < count; i++) {
    // Distribute incidents across innings if not explicitly locked to one innings
    const inningsIndex =
      config?.inningsIndex !== undefined
        ? config.inningsIndex
        : numInnings > 1
        ? Math.floor((i * numInnings) / count)
        : undefined;

    const incident = selectRealMatchIncident(match, sessionSeed, i, {
      ...config,
      inningsIndex,
      excludedDeliveryIds: excluded,
    });

    excluded.add(incident.deliveryId);
    incidents.push(incident);
  }

  return incidents;
}

/**
 * Generates a lookup map of DRS incidents keyed by deliveryId.
 */
export function createRealMatchIncidentMap(
  match: RealMatch,
  sessionSeed: number,
  count: number = 8,
  config?: Omit<RealMatchIncidentConfig, "excludedDeliveryIds">
): Map<string, RealMatchDrsIncident> {
  const schedule = createRealMatchIncidentSchedule(match, sessionSeed, count, config);
  const map = new Map<string, RealMatchDrsIncident>();
  for (const inc of schedule) {
    map.set(inc.deliveryId, inc);
  }
  return map;
}
