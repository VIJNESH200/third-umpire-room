/**
 * caughtBehindPhysics.ts
 *
 * Canonical Caught Behind ball corridor and forensic evidence model.
 *
 * The module has two responsibilities:
 *
 * 1.  Ball corridor. `solveCaughtBehindBallState` produces one continuous
 *     trajectory for the Phase 1 broadcast replay. A clean miss is a single
 *     smooth arc: position and direction stay continuous where the ball
 *     crosses the bat plane, so the replay never fakes a collision. A genuine
 *     edge deflects once, at the moment of contact, and loses speed.
 *
 * 2.  Neutral evidence presentation. `solveEdgeOpticalEvidence` and
 *     `solveUltraEdgeSignal` convert canonical ground truth into what the
 *     forensic cameras are allowed to show. Neither result encodes
 *     `hasEdge` directly: on marginal incidents an edge and a fine miss
 *     produce the same optical classification and the same class of acoustic
 *     transient, so the third umpire has to interpret the evidence.
 *
 * Every function is pure and deterministic. Ground truth stays in
 * `CaughtBehindData` and is never modified here.
 */

import type { CaughtBehindData } from "../types/scenario";

// ================================================================
// 1. BALL CORRIDOR
// ================================================================

/** Replay progress at which the ball reaches the bat plane. */
export const CB_BAT_CROSS_P = 0.5;

/** Peak vertical sag of the delivery arc, in rig pixels. */
const CB_SAG_PX = 10;

/**
 * Screen-space anchors for the slip-camera corridor. The caller supplies
 * these from its own perspective projection; this module only solves the
 * motion between them.
 */
export interface CaughtBehindCorridor {
  /** Release point near the camera, at the bottom of the frame. */
  entryX: number;
  entryY: number;
  /** Outside edge of the bat, on the bat plane. */
  batEdgeX: number;
  batEdgeY: number;
  /** Keeper's glove target behind the wicket. */
  gloveX: number;
  gloveY: number;
  /** Apparent daylight between the ball and the edge, in screen pixels. */
  gapPx: number;
  /** Canonical ground truth. Controls whether a deflection occurs. */
  hasEdge: boolean;
  /** Apparent deflection from Phase 1 evidence, in degrees. */
  deflectionAngleDeg: number;
}

export interface CaughtBehindBallState {
  x: number;
  y: number;
  /** Instantaneous velocity, in pixels per unit of replay progress. */
  vx: number;
  vy: number;
  /** Ball radius for the current camera distance. */
  radius: number;
  /** Trailing sample used to draw the motion blur in the travel direction. */
  prevX: number;
  prevY: number;
  hasCrossedBatPlane: boolean;
  /** True only after a genuine edge has deflected the ball. */
  isDeflected: boolean;
}

/**
 * Target the ball reaches when it misses the bat.
 *
 * The ball keeps its line and is taken wide of the gloves, on the side away
 * from the bat, by an amount that scales with the apparent gap. Because the
 * whole flight is one segment towards this point, the lateral direction can
 * never reverse.
 */
function cleanMissTarget(c: CaughtBehindCorridor) {
  // The keeper stands down-corridor from the bat edge. A ball that beats the
  // outside edge passes on the far side of the edge, so it arrives wide of
  // the gloves in the same lateral direction it was already travelling.
  const side = Math.sign(c.gloveX - c.batEdgeX) || 1;
  return {
    x: c.gloveX + side * Math.max(6, c.gapPx) * 0.9,
    y: c.gloveY + 10,
  };
}

/**
 * Target the ball reaches after an edge.
 *
 * A thicker edge, reported by a larger apparent deflection angle, fans the
 * carry slightly wider of the gloves.
 */
function edgeCarryTarget(c: CaughtBehindCorridor) {
  const fan = c.deflectionAngleDeg * 1.6;
  return { x: c.gloveX + fan, y: c.gloveY + 6 };
}

/**
 * Solves the ball position and velocity at replay progress `p`, in `[0, 1]`.
 *
 * Clean miss: one straight line from the release point to a point wide of
 * the gloves, plus a shared parabolic sag. Lateral travel is linear in `p`,
 * so the ball cannot change lateral direction anywhere, including at the bat
 * plane.
 *
 * Edge: a straight approach to the bat edge, then a single deflection into
 * the gloves at reduced speed. Position stays continuous through contact and
 * the ball keeps travelling down the corridor.
 */
export function solveCaughtBehindBallState(
  c: CaughtBehindCorridor,
  p: number
): CaughtBehindBallState {
  const t = Math.max(0, Math.min(1, p));
  const sagAt = (q: number) => CB_SAG_PX * 4 * q * (1 - q);
  const radiusAt = (q: number) => 5.4 - q * 1.9;
  const TRAIL_DP = 0.05;

  if (!c.hasEdge) {
    // --- Clean miss: a single continuous arc past the bat ---
    const target = cleanMissTarget(c);
    const posAt = (q: number) => ({
      x: c.entryX + (target.x - c.entryX) * q,
      y: c.entryY + (target.y - c.entryY) * q + sagAt(q),
    });
    const here = posAt(t);
    // Sample the derivative forwards, or backwards at the end of the flight,
    // so the reported direction is never a degenerate zero vector.
    const dp = 1e-4;
    const forward = t + dp <= 1;
    const other = forward ? posAt(t + dp) : posAt(t - dp);
    const sign = forward ? 1 : -1;
    const behind = posAt(Math.max(0, t - TRAIL_DP));
    return {
      x: here.x,
      y: here.y,
      vx: (sign * (other.x - here.x)) / dp,
      vy: (sign * (other.y - here.y)) / dp,
      radius: radiusAt(t),
      prevX: behind.x,
      prevY: behind.y,
      hasCrossedBatPlane: t >= CB_BAT_CROSS_P,
      isDeflected: false,
    };
  }

  // --- Edge: approach, contact at the bat edge, deflected carry ---
  const contactX = c.batEdgeX;
  const contactY = c.batEdgeY;
  const carry = edgeCarryTarget(c);

  // Both segments carry the same gravity sag, so position stays continuous
  // where the deflection happens: only the direction changes.
  const approachAt = (q: number) => {
    const s = q / CB_BAT_CROSS_P;
    return {
      x: c.entryX + (contactX - c.entryX) * s,
      y: c.entryY + (contactY - c.entryY) * s + sagAt(q),
    };
  };
  // The edge deadens the ball, so the carry decelerates into the gloves.
  const carryAt = (q: number) => {
    const s = (q - CB_BAT_CROSS_P) / (1 - CB_BAT_CROSS_P);
    const eased = s * (2 - s);
    return {
      x: contactX + (carry.x - contactX) * eased,
      y: contactY + (carry.y - contactY) * eased + sagAt(q),
    };
  };
  const posAt = (q: number) => (q <= CB_BAT_CROSS_P ? approachAt(q) : carryAt(q));

  const here = posAt(t);
  // Sample the derivative on the same side of contact, and never past the end
  // of the flight, so the reported direction is the true instantaneous one
  // rather than an average across the deflection.
  const dp = 1e-4;
  const forward = (t + dp <= CB_BAT_CROSS_P || t > CB_BAT_CROSS_P) && t + dp <= 1;
  const other = forward ? posAt(t + dp) : posAt(Math.max(0, t - dp));
  const sign = forward ? 1 : -1;
  const behind = posAt(Math.max(0, t - TRAIL_DP));

  return {
    x: here.x,
    y: here.y,
    vx: (sign * (other.x - here.x)) / dp,
    vy: (sign * (other.y - here.y)) / dp,
    radius: radiusAt(t),
    prevX: behind.x,
    prevY: behind.y,
    hasCrossedBatPlane: t >= CB_BAT_CROSS_P,
    isDeflected: t > CB_BAT_CROSS_P,
  };
}

/**
 * Measures the direction change across the bat plane, in degrees.
 *
 * A clean miss returns `0`: the ball holds its line. An edge returns the
 * plausible turn the deflection produced.
 */
export function measureBatPlaneTurnDeg(c: CaughtBehindCorridor): number {
  const before = solveCaughtBehindBallState(c, CB_BAT_CROSS_P - 1e-3);
  const after = solveCaughtBehindBallState(c, CB_BAT_CROSS_P + 1e-3);
  const a1 = Math.atan2(before.vy, before.vx);
  const a2 = Math.atan2(after.vy, after.vx);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return (d * 180) / Math.PI;
}

// ================================================================
// 2. SUPER SLOW-MO OPTICAL EVIDENCE
// ================================================================

/**
 * Optical separation the 1000 fps macro camera can actually resolve.
 *
 * At this shutter speed the ball smears across a few millimetres, so any true
 * gap smaller than the blur envelope reads as no visible daylight. A genuine
 * edge and a fine miss therefore look the same, which is why the camera
 * cannot decide a marginal incident on its own.
 *
 * The value is tuned against the generator's gap ranges: marginal misses span
 * 3 mm to 8 mm, so the wider end of that range still resolves a sliver of
 * daylight while the finer end collapses into the blur. Clear and howler
 * misses span 20 mm and above and always resolve. Genuine edges have no gap
 * at all, so they can never resolve daylight. Resolved daylight is real
 * evidence rather than a leak: the camera reports what the optics measure and
 * never inspects the ground truth flag.
 */
export const CB_MOTION_BLUR_TOLERANCE_MM = 6;

export type EdgeOpticalReading = "VISIBLE_DAYLIGHT" | "INCONCLUSIVE";

export interface EdgeOpticalEvidence {
  /** Separation the camera resolves, in millimetres. Never negative. */
  apparentSeparationMm: number;
  /** Width of the motion-blur envelope, in millimetres. */
  blurToleranceMm: number;
  /** Classification the operator sees. Never encodes `hasEdge`. */
  reading: EdgeOpticalReading;
  /** Ball travel smear used to draw the blur envelope, in millimetres. */
  smearMm: number;
}

/**
 * Converts canonical ground truth into what the macro camera may display.
 *
 * The returned separation is the true gap reduced by the blur envelope, so
 * marginal misses collapse to the same `INCONCLUSIVE` reading as an edge.
 * Wide misses still resolve as visible daylight, which is what makes clear
 * incidents decidable.
 */
export function solveEdgeOpticalEvidence(cb: CaughtBehindData): EdgeOpticalEvidence {
  const trueGapMm = cb.hasEdge ? 0 : cb.gapMm;
  const apparentSeparationMm = Math.max(0, trueGapMm - CB_MOTION_BLUR_TOLERANCE_MM);
  return {
    apparentSeparationMm,
    blurToleranceMm: CB_MOTION_BLUR_TOLERANCE_MM,
    reading: apparentSeparationMm > 0 ? "VISIBLE_DAYLIGHT" : "INCONCLUSIVE",
    smearMm: CB_MOTION_BLUR_TOLERANCE_MM,
  };
}

// ================================================================
// 3. ULTRAEDGE ACOUSTIC EVIDENCE
// ================================================================

/**
 * One transient on the stump microphone.
 *
 * The operator sees a time, an amplitude and a frequency character. None of
 * these fields state what the transient came from: a bat edge, a pad and a
 * boot scrape all appear as transients, and the player has to judge whether
 * one aligns with the frame in which the ball passed the bat.
 */
export interface UltraEdgeTransient {
  timeMs: number;
  /** Peak amplitude, 0 to 1. Ranges overlap across sources. */
  amplitude: number;
  /** Dominant frequency, in hertz. Ranges overlap across sources. */
  centreFreqHz: number;
  /** Decay time constant, in milliseconds. */
  decayMs: number;
}

export interface UltraEdgeSignal {
  /** Ambient crowd and equipment noise, 0 to 1. Never zero. */
  noiseFloor: number;
  /** Every transient in the review window, sorted by time. */
  transients: UltraEdgeTransient[];
  /** Frame in which the ball passed the bat, for alignment checks. */
  batPlaneTimeMs: number;
  /** Review window bounds, in milliseconds. */
  windowStartMs: number;
  windowEndMs: number;
}

const CB_WINDOW_START_MS = 800;
const CB_WINDOW_END_MS = 1600;

/**
 * Deterministic value in `[0, 1)` derived from a seed.
 *
 * Keeps presentation jitter stable for a given incident without pulling in
 * the scenario generator's RNG.
 */
function hashUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Builds the acoustic evidence for the UltraEdge scope and speaker.
 *
 * Every incident produces a noise floor and at least one candidate
 * transient, so the scope never flatlines and the absence of a spike can no
 * longer be read as "no edge". Amplitude and frequency bands overlap between
 * bat contact and decoy contact, so loudness and tone prove nothing on their
 * own.
 *
 * Alignment with the transit frame is the intended skill, exactly as in a
 * real review. To keep it a judgement rather than a lookup, edge transients
 * carry a spread of several frames and ambient noise can also land close to
 * the transit frame, so a tight offset is strong evidence but not proof.
 */
export function solveUltraEdgeSignal(cb: CaughtBehindData): UltraEdgeSignal {
  // Seed from fields that vary on every incident, including the ones that are
  // non-zero when a genuine edge occurs. A seed built only from `gapMm` and
  // the decoy time collapses to a constant for edges, which would make the
  // reported offset identical every time and give the answer away.
  const seed =
    cb.proximityFrameMs * 0.37 +
    cb.gapMm * 7.13 +
    (cb.distractorTimeMs ?? 0) * 1.7 +
    Math.round(cb.spikeIntensity * 1000) * 2.9 +
    (cb.waveformSpikeTimeMs ?? 0) * 0.11;
  const jitter = (n: number, spread: number) => (hashUnit(seed + n) - 0.5) * 2 * spread;

  const transients: UltraEdgeTransient[] = [];

  // A genuine edge registers near the bat plane, but the microphone and the
  // frame clock disagree by a few frames, so the offset spans a band that
  // ambient noise can also occupy.
  if (cb.hasEdge && cb.waveformSpikeTimeMs !== null) {
    transients.push({
      timeMs: cb.waveformSpikeTimeMs + jitter(1, 26),
      amplitude: 0.42 + hashUnit(seed + 2) * 0.36,
      centreFreqHz: 1500 + hashUnit(seed + 3) * 2600,
      decayMs: 14 + hashUnit(seed + 4) * 10,
    });
  }

  // A decoy contact registers off the bat plane, in the same amplitude and
  // frequency bands as a real edge.
  if (cb.distractorNoise && cb.distractorTimeMs !== null) {
    transients.push({
      timeMs: cb.distractorTimeMs + jitter(5, 8),
      amplitude: 0.40 + hashUnit(seed + 6) * 0.38,
      centreFreqHz: 1400 + hashUnit(seed + 7) * 2700,
      decayMs: 16 + hashUnit(seed + 8) * 12,
    });
  }

  // Ambient kit and crowd noise always leaves transients in the window, so a
  // clean miss still produces a signal to interpret. One of them is placed
  // near the transit frame on some incidents, which is why a tight offset
  // alone cannot be treated as proof of contact.
  const ambientCount = 2 + Math.floor(hashUnit(seed + 9) * 2);
  const span = CB_WINDOW_END_MS - CB_WINDOW_START_MS;
  for (let i = 0; i < ambientCount; i++) {
    const nearTransit = hashUnit(seed + 60 + i) < 0.35;
    const timeMs = nearTransit
      ? cb.ballPassesBatFrameMs + jitter(70 + i, 30)
      : CB_WINDOW_START_MS + 60 + hashUnit(seed + 20 + i) * (span - 120);
    transients.push({
      timeMs,
      amplitude: 0.14 + hashUnit(seed + 30 + i) * 0.22,
      centreFreqHz: 900 + hashUnit(seed + 40 + i) * 3000,
      decayMs: 18 + hashUnit(seed + 50 + i) * 14,
    });
  }

  transients.sort((a, b) => a.timeMs - b.timeMs);

  return {
    noiseFloor: 0.08 + hashUnit(seed + 11) * 0.05,
    transients,
    batPlaneTimeMs: cb.ballPassesBatFrameMs,
    windowStartMs: CB_WINDOW_START_MS,
    windowEndMs: CB_WINDOW_END_MS,
  };
}

/**
 * Amplitude of the signal at a point in time, including the noise floor.
 *
 * Used to draw the scope and to render the audio buffer from the same model,
 * so what the operator sees always matches what they hear.
 */
export function sampleUltraEdgeAmplitude(signal: UltraEdgeSignal, timeMs: number): number {
  let amp = signal.noiseFloor * Math.sin(timeMs * 0.7);
  for (const tr of signal.transients) {
    const delta = timeMs - tr.timeMs;
    if (Math.abs(delta) > tr.decayMs * 6) continue;
    const envelope = Math.exp(-Math.abs(delta) / tr.decayMs);
    amp += Math.sin((delta * tr.centreFreqHz) / 12000) * tr.amplitude * envelope;
  }
  return amp;
}

/**
 * Transient closest to the bat plane, with its offset in milliseconds.
 *
 * The console shows this offset so the operator can judge alignment. It does
 * not label the source of the transient.
 */
export function findNearestTransient(
  signal: UltraEdgeSignal
): { transient: UltraEdgeTransient; offsetMs: number } | null {
  let best: UltraEdgeTransient | null = null;
  let bestOffset = Number.POSITIVE_INFINITY;
  for (const tr of signal.transients) {
    const offset = tr.timeMs - signal.batPlaneTimeMs;
    if (Math.abs(offset) < Math.abs(bestOffset)) {
      best = tr;
      bestOffset = offset;
    }
  }
  return best ? { transient: best, offsetMs: bestOffset } : null;
}
