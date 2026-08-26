/**
 * hotspotThermal.ts
 *
 * CAM 08 — HotSpot infrared thermal evidence model.
 *
 * Companion to the neutral evidence layer in caughtBehindPhysics.ts
 * (`solveEdgeOpticalEvidence` / `solveUltraEdgeSignal`). Where those modules
 * govern the optical macro camera and the stump microphone, this module
 * governs what the infrared camera is allowed to display. It intentionally
 * lives beside them rather than inside them, so the committed acoustic and
 * optical evidence contracts stay untouched.
 *
 * Design contract, mirroring the rest of the evidence layer:
 *
 *  - Returned frames NEVER encode `hasEdge` or `soundType`. Ground truth may
 *    only shape plausible physics priors (friction heat scales with how
 *    tightly the ball passed the edge), never a classified verdict.
 *  - Every incident produces a live sensor picture: an ambient blade level,
 *    deterministic sensor noise and at least one measurable radiance zone.
 *    "Nothing on screen" therefore can never be inverted into a verdict.
 *  - The radiance bands of a genuine edge and a fine miss OVERLAP. Brightness
 *    alone is a hint, not an answer; the operator has to weigh intensity,
 *    position against the outside-edge line, decay behaviour and alignment
 *    with the transit frame, together with the acoustic evidence.
 *  - Every function is pure and deterministic: repeated solves for the same
 *    incident produce byte-identical output. Presentation jitter is derived
 *    from a per-incident seed so it is stable without touching the scenario
 *    generator's RNG.
 */

import type { CaughtBehindData } from "../types/scenario";

// ================================================================
// REVIEW WINDOW & SENSOR CONSTANTS
// ================================================================

export const HOTSPOT_WINDOW_START_MS = 800;
export const HOTSPOT_WINDOW_END_MS = 1600;

/** Thermal decay time constant of friction heat on willow, in milliseconds. */
export const HOTSPOT_DECAY_MS = 260;

/** Radiance above which the sensor flags a zone as a marked signature. */
export const HOTSPOT_DETECTION_THRESHOLD = 0.12;

/** Blade geometry in millimetres; the view projects these onto screen. */
export const BLADE_WIDTH_MM = 42;
export const BAT_BLADE_TOP_Y_MM = 40;
export const BAT_BLADE_BOTTOM_Y_MM = 360;

/** Lateral position of the outside edge, in bat-local millimetres. */
export const OUTSIDE_EDGE_X_MM = BLADE_WIDTH_MM / 2;

/** Nominal height of the bat-plane transit on the blade. */
const TRANSIT_Y_MM = 170;

/** Peak sensor ripple amplitude, in display units. */
const SENSOR_NOISE_AMPLITUDE = 0.05;

// ================================================================
// MODEL
// ================================================================

/**
 * One resolved heat zone on the blade or pad.
 *
 * A zone says "radiance rose here, peaking at this level, decaying from this
 * moment". It never says what caused it: a friction scuff, a near pass, a pad
 * compression and a genuine edge all appear as zones of overlapping
 * intensity.
 */
export interface HotSpotThermalZone {
  id: string;
  /** Neutral presentation label ("ZONE A"), assigned in chronological order. */
  label: string;
  /** Centre in bat-local millimetres (x across the blade, y down it). */
  xMm: number;
  yMm: number;
  /** Gaussian radiance footprint, in millimetres. */
  sigmaXMm: number;
  sigmaYMm: number;
  /** Intensity at ignition, 0 to 1. */
  peakIntensity: number;
  /** Moment the zone begins to radiate, in canonical replay ms. */
  igniteTimeMs: number;
}

/**
 * Per-incident thermal scene solved from canonical ground truth.
 *
 * Solved once per incident (memoize in the view); frames are sampled from it.
 */
export interface HotSpotThermalModel {
  /** Transit frame the timing context is measured against. */
  transitTimeMs: number;
  /** Phase used to derive deterministic ambient drift and sensor noise. */
  phaseRad: number;
  /** Base blade temperature in display units. Never zero. */
  ambientBaseLevel: number;
  /** Every radiance zone in the scene, sorted by ignition time. */
  zones: HotSpotThermalZone[];
}

/** One frame of the thermal feed at a canonical replay timestamp. */
export interface HotSpotThermalFrame {
  timeMs: number;
  /** Signed distance from the bat-plane transit, in milliseconds. */
  msSinceTransit: number;
  /** Ambient blade temperature including slow drift, 0 to 1. */
  ambientLevel: number;
  /** Instantaneous sensor ripple, roughly +/- SENSOR_NOISE_AMPLITUDE. */
  noiseLevel: number;
  /** Live zone readings, chronological by ignition. */
  zones: HotSpotThermalFrameZone[];
  /**
   * Operator-facing status caption. Reports sensor state only — it never
   * names an edge, a nick, contact or a clean pass.
   */
  statusLine: string;
  /** Brightest current zone intensity, 0 to 100. */
  peakIntensityPct: number;
  /** Zones currently above the detection threshold. */
  ignitedCount: number;
}

/** Live reading for one zone at a frame. */
export interface HotSpotThermalFrameZone {
  id: string;
  label: string;
  xMm: number;
  yMm: number;
  sigmaXMm: number;
  sigmaYMm: number;
  /** Current intensity after exponential decay, 0 to 1. */
  intensity: number;
  /** True once the sensor resolves the zone above its threshold. */
  isIgnited: boolean;
}

/**
 * Deterministic value in `[0, 1)` derived from a seed.
 *
 * Same construction as the acoustic evidence module: keeps presentation
 * jitter stable for a given incident without pulling in the generator's RNG.
 */
function hashUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

/**
 * Solves the per-incident thermal scene.
 *
 * The seed spans every incident-varying field, including the ones that move
 * on both outcomes, so two incidents with different truths rarely collapse to
 * identical presentation while identical incidents stay byte-stable.
 */
export function solveHotSpotThermal(cb: CaughtBehindData): HotSpotThermalModel {
  const seed =
    cb.proximityFrameMs * 0.29 +
    cb.gapMm * 5.17 +
    (cb.distractorTimeMs ?? 0) * 1.9 +
    Math.round(cb.spikeIntensity * 1000) * 3.1 +
    (cb.waveformSpikeTimeMs ?? 0) * 0.13;
  const jitter = (n: number, spread: number) => (hashUnit(seed + n) - 0.5) * 2 * spread;

  const transitTimeMs = cb.ballPassesBatFrameMs;

  // ------------------------------------------------------------------
  // Primary radiance zone: the strongest measured heating near the
  // recorded transit point. Present on EVERY incident, because the IR
  // element reports the largest radiance change it measured, whatever the
  // outcome — a faint near-pass scuff and a firm squeeze land in the same
  // band and the operator has to judge which they are looking at.
  //
  // Friction prior: peak heat scales with how tightly the ball passed the
  // edge (`gapMm`), not with the outcome. A genuine edge (gap 0) and a
  // marginal miss (generator range 3-8 mm) therefore share one intensity
  // band; only wide daylight cools off noticeably, which is ordinary
  // physics and mirrors the blur-limited optical evidence.
  // ------------------------------------------------------------------
  const closeness = Math.max(0, 1 - cb.gapMm / 30);
  const candidatePeak = clamp(
    0.34 + closeness * 0.36 + jitter(21, 0.07),
    0.2,
    0.92
  );
  const candidateX = clamp(
    OUTSIDE_EDGE_X_MM + jitter(22, 2.6),
    OUTSIDE_EDGE_X_MM - 5,
    OUTSIDE_EDGE_X_MM + 4
  );
  const candidateY = clamp(
    TRANSIT_Y_MM + jitter(23, 30),
    BAT_BLADE_TOP_Y_MM + 40,
    BAT_BLADE_BOTTOM_Y_MM - 40
  );
  const candidateSigmaX = 2.4 + hashUnit(seed + 24) * 1.8;
  const candidateSigmaY = candidateSigmaX * (1.2 + hashUnit(seed + 25) * 0.5);
  const candidateIgnite = Math.max(
    HOTSPOT_WINDOW_START_MS + 40,
    transitTimeMs + jitter(26, 12)
  );

  const zones: HotSpotThermalZone[] = [
    {
      id: "CANDIDATE",
      label: "ZONE A",
      xMm: candidateX,
      yMm: candidateY,
      sigmaXMm: candidateSigmaX,
      sigmaYMm: candidateSigmaY,
      peakIntensity: candidatePeak,
      igniteTimeMs: candidateIgnite,
    },
  ];

  // Ambient friction scuffs elsewhere on the blade. Their presence, place
  // and strength are pure per-incident texture: on some incidents one sits
  // close to the transit frame too, which is why "a zone lit up near the
  // transit" can never be proof of contact on its own.
  const ambientCount = Math.floor(hashUnit(seed + 31) * 2); // 0 or 1
  for (let i = 0; i < ambientCount; i++) {
    const nearTransit = hashUnit(seed + 40 + i) < 0.4;
    zones.push({
      id: `AMBIENT_${i}`,
      label: "ZONE B",
      xMm: jitter(42 + i * 7, 16),
      yMm: clamp(
        BAT_BLADE_TOP_Y_MM + 50 + hashUnit(seed + 43 + i) * 220,
        BAT_BLADE_TOP_Y_MM + 30,
        BAT_BLADE_BOTTOM_Y_MM - 30
      ),
      sigmaXMm: 2.0 + hashUnit(seed + 44 + i) * 2.2,
      sigmaYMm: 2.6 + hashUnit(seed + 45 + i) * 2.6,
      peakIntensity: 0.18 + hashUnit(seed + 46 + i) * 0.24,
      igniteTimeMs: nearTransit
        ? transitTimeMs + jitter(47 + i, 45)
        : HOTSPOT_WINDOW_START_MS + 60 + hashUnit(seed + 48 + i) * 620,
    });
  }

  // Pad decoy: a compression glow on the pad, in the same intensity band as
  // a soft edge signature, offset from the bat plane like any other decoy.
  if (cb.distractorNoise && cb.distractorTimeMs !== null) {
    zones.push({
      id: "PAD_DECOY",
      label: "ZONE C",
      xMm: -34 + jitter(51, 3),
      yMm: clamp(TRANSIT_Y_MM + jitter(52, 40), 110, 220),
      sigmaXMm: 3.2 + hashUnit(seed + 53) * 1.6,
      sigmaYMm: 3.6 + hashUnit(seed + 54) * 1.8,
      peakIntensity: 0.4 + hashUnit(seed + 55) * 0.34,
      igniteTimeMs: Math.max(
        HOTSPOT_WINDOW_START_MS + 40,
        cb.distractorTimeMs + jitter(56, 8)
      ),
    });
  }

  // Chronological labelling keeps the presentation stable and neutral: the
  // labels carry no information about what caused a zone.
  zones.sort((a, b) => a.igniteTimeMs - b.igniteTimeMs);
  zones.forEach((z, i) => {
    z.label = `ZONE ${String.fromCharCode(65 + i)}`;
  });

  return {
    transitTimeMs,
    phaseRad: hashUnit(seed + 61) * Math.PI * 2,
    ambientBaseLevel: 0.15 + hashUnit(seed + 62) * 0.04,
    zones,
  };
}

/**
 * Samples the thermal frame at canonical replay time `timeMs`.
 *
 * Time is clamped into the review window; intensity decays exponentially
 * from each zone's ignition, so scrubbing backwards and forwards reproduces
 * exactly the same heat history on every pass.
 */
export function solveHotSpotThermalFrame(
  model: HotSpotThermalModel,
  timeMs: number
): HotSpotThermalFrame {
  const time = clamp(
    timeMs,
    HOTSPOT_WINDOW_START_MS,
    HOTSPOT_WINDOW_END_MS
  );

  const zones: HotSpotThermalFrameZone[] = model.zones.map((z) => {
    const elapsed = time - z.igniteTimeMs;
    const intensity =
      elapsed <= 0 ? 0 : z.peakIntensity * Math.exp(-elapsed / HOTSPOT_DECAY_MS);
    return {
      id: z.id,
      label: z.label,
      xMm: z.xMm,
      yMm: z.yMm,
      sigmaXMm: z.sigmaXMm,
      sigmaYMm: z.sigmaYMm,
      intensity,
      isIgnited: intensity >= HOTSPOT_DETECTION_THRESHOLD,
    };
  });

  const peakIntensity = zones.reduce((max, z) => Math.max(max, z.intensity), 0);
  const ignitedCount = zones.filter((z) => z.isIgnited).length;

  // Status captions report instrument state only. Wording avoids every
  // outcome term (edge, nick, contact, clean, out) so the caption cannot be
  // read as a verdict under any circumstances.
  let statusLine: string;
  if (time < model.transitTimeMs - 40) {
    statusLine = "BALL APPROACHING BAT PLANE — IR ELEMENTS NOMINAL";
  } else if (ignitedCount === 0) {
    statusLine = "NO ZONE EXCEEDS DETECTION THRESHOLD";
  } else {
    statusLine = `RADIANCE ZONE${ignitedCount > 1 ? "S" : ""} PRESENT — INTERPRET BEFORE CALLING`;
  }

  return {
    timeMs: time,
    msSinceTransit: Math.round(time - model.transitTimeMs),
    ambientLevel: clamp(
      model.ambientBaseLevel +
        0.02 * Math.sin(time * 0.006 + model.phaseRad),
      0,
      1
    ),
    noiseLevel: SENSOR_NOISE_AMPLITUDE * Math.sin(time * 0.37 + model.phaseRad * 1.7),
    zones,
    statusLine,
    peakIntensityPct: Math.round(peakIntensity * 100),
    ignitedCount,
  };
}

/**
 * Total displayed radiance at a bat-local point, in `[0, 1]`.
 *
 * Sum of the ambient level, sensor ripple and every zone's Gaussian
 * footprint — the value the view rasterises, so what the operator sees is
 * exactly this model.
 */
export function sampleHotSpotIntensity(
  frame: HotSpotThermalFrame,
  xMm: number,
  yMm: number
): number {
  let level = frame.ambientLevel + frame.noiseLevel;
  for (const z of frame.zones) {
    if (z.intensity <= 0) continue;
    const dx = (xMm - z.xMm) / z.sigmaXMm;
    const dy = (yMm - z.yMm) / z.sigmaYMm;
    level += z.intensity * Math.exp(-0.5 * (dx * dx + dy * dy));
  }
  return clamp(level, 0, 1);
}
