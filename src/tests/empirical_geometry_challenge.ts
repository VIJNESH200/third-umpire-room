/**
 * Empirical Mathematical & Canvas Geometry Verification Harness
 * Challenger 1 (Round 2)
 */

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function record(suite: string, name: string, passed: boolean, details: string) {
  results.push({ suite, name, passed, details });
  const status = passed ? '[PASS]' : '[FAIL]';
  console.log(status + ' [' + suite + '] ' + name + ': ' + details);
}

console.log('===============================================================');
console.log('  EMPIRICAL CHALLENGE: MATHEMATICAL FRAME INDEXING & GEOMETRY  ');
console.log('===============================================================\n');

// ============================================================================
// SUITE 1: FRAME INDEXING MONOTONICITY & STEPPING (600ms - 2200ms)
// ============================================================================
const newFrame = (timeMs: number): number => Math.round(timeMs / 20);
const oldFrame = (timeMs: number): number => Math.round((timeMs - 600) / 10);

// 1.1 Monotonicity check across all 1601 integer milliseconds
let isMonotonic = true;
let nonMonotonicCount = 0;
for (let t = 600; t < 2200; t++) {
  const fCurrent = newFrame(t);
  const fNext = newFrame(t + 1);
  if (fNext < fCurrent) {
    isMonotonic = false;
    nonMonotonicCount++;
  }
}
record(
  'SUITE 1 - Monotonicity',
  'Integer ms Monotonicity 600ms..2200ms',
  isMonotonic && nonMonotonicCount === 0,
  'Tested 1600 consecutive pairs; non-monotonic transitions = ' + nonMonotonicCount
);

// 1.2 Exact values at critical bat transit boundaries: 1180ms, 1200ms, 1220ms
const f1180 = newFrame(1180);
const f1200 = newFrame(1200);
const f1220 = newFrame(1220);
record(
  'SUITE 1 - Critical Boundary',
  'Bat Transit Exact Values (1180ms, 1200ms, 1220ms)',
  f1180 === 59 && f1200 === 60 && f1220 === 61,
  'F(1180ms)=' + f1180 + ' (expected 59), F(1200ms)=' + f1200 + ' (expected 60), F(1220ms)=' + f1220 + ' (expected 61)'
);

// 1.3 Sub-millisecond transition points around F59 -> F60 and F60 -> F61
const trans59to60_pre = newFrame(1189.999);
const trans59to60_at = newFrame(1190.0);
const trans60to61_pre = newFrame(1209.999);
const trans60to61_at = newFrame(1210.0);
record(
  'SUITE 1 - Threshold Boundaries',
  'Sub-millisecond rounding transition points',
  trans59to60_pre === 59 && trans59to60_at === 60 && trans60to61_pre === 60 && trans60to61_at === 61,
  '1189.999ms->F' + trans59to60_pre + ', 1190.0ms->F' + trans59to60_at + ', 1209.999ms->F' + trans60to61_pre + ', 1210.0ms->F' + trans60to61_at
);

// 1.4 Stepping by +-20ms starting from every grid point in [600, 2200]
let steppingFwdOk = true;
let steppingBackOk = true;
let droppedFrames = 0;
let skippedFrames = 0;

for (let t = 600; t <= 2200; t += 20) {
  const f0 = newFrame(t);
  if (t + 20 <= 2200) {
    const fNext = newFrame(t + 20);
    if (fNext !== f0 + 1) {
      steppingFwdOk = false;
      if (fNext === f0) droppedFrames++;
      if (fNext > f0 + 1) skippedFrames++;
    }
  }
  if (t - 20 >= 600) {
    const fPrev = newFrame(t - 20);
    if (fPrev !== f0 - 1) {
      steppingBackOk = false;
    }
  }
}
record(
  'SUITE 1 - Grid Stepping',
  '+-20ms step invariant on 50 FPS grid',
  steppingFwdOk && steppingBackOk && droppedFrames === 0 && skippedFrames === 0,
  '81 grid points tested: Fwd step +1F: ' + steppingFwdOk + ', Back step -1F: ' + steppingBackOk + ', Dropped: ' + droppedFrames + ', Skipped: ' + skippedFrames
);

// 1.5 Contrast with Old Formula (timeMs - 600) / 10
const errorPoints: { t: number; newF: number; oldF: number; diff: number }[] = [];
let maxPositiveDiff = -Infinity;
let maxNegativeDiff = Infinity;
let zeroDiffPoints: number[] = [];
let oldStepSkips = 0;

for (let t = 600; t <= 2200; t += 20) {
  const nF = newFrame(t);
  const oF = oldFrame(t);
  const diff = oF - nF;
  if (diff > maxPositiveDiff) maxPositiveDiff = diff;
  if (diff < maxNegativeDiff) maxNegativeDiff = diff;
  if (diff === 0) zeroDiffPoints.push(t);
  errorPoints.push({ t, newF: nF, oldF: oF, diff });

  if (t + 20 <= 2200) {
    const oNext = oldFrame(t + 20);
    if (oNext - oF !== 1) {
      oldStepSkips++;
    }
  }
}

record(
  'SUITE 1 - Old Formula Contrast',
  'Old formula (timeMs - 600)/10 failure profile',
  zeroDiffPoints.length === 1 && zeroDiffPoints[0] === 1200 && oldStepSkips === 80,
  'Only intersects at t=' + zeroDiffPoints.join(',') + 'ms! Error range: [' + maxNegativeDiff + ', +' + maxPositiveDiff + '] frames. Old formula skipped 1 frame on every step: ' + oldStepSkips + '/80 steps!'
);

// ============================================================================
// SUITE 2: CANVAS GEOMETRY & COORDINATE TRANSFORMATIONS ACROSS DYNAMIC WIDTHS
// ============================================================================
const MIN_TIME = 800;
const MAX_TIME = 1600;
const SPAN_TIME = MAX_TIME - MIN_TIME; // 800ms
const TRANSIT_TIME = 1200;

const testWidths = [320, 480, 600, 720, 960, 1280, 1920];

// 2.1 Is transit at exactly 50% width across all widths?
let transitCenteredAllWidths = true;
const transitPositions: string[] = [];

for (const W of testWidths) {
  const xTransit = ((TRANSIT_TIME - MIN_TIME) / SPAN_TIME) * W;
  const ratio = xTransit / W;
  transitPositions.push('W=' + W + 'px -> X=' + xTransit + 'px (' + (ratio * 100).toFixed(1) + '%)');
  if (ratio !== 0.5 || xTransit !== W * 0.5) {
    transitCenteredAllWidths = false;
  }
}

record(
  'SUITE 2 - Transit Centering',
  'Bat Transit exact 50.0% horizontal center across all canvas widths',
  transitCenteredAllWidths,
  transitPositions.join('; ')
);

// 2.2 Does 20ms equal exactly 12px at W=480? What about dynamic widths?
const dxAt480 = (20 / SPAN_TIME) * 480;
const dxTable: string[] = [];
for (const W of testWidths) {
  const dx = (20 / SPAN_TIME) * W;
  dxTable.push('W=' + W + 'px: dx_frame=' + dx.toFixed(2) + 'px');
}

record(
  'SUITE 2 - Frame Pixel Width',
  'Single frame pixel width delta (20ms) across widths',
  dxAt480 === 12.0,
  'W=480px -> ' + dxAt480.toFixed(2) + 'px (exact 12px). Dynamic widths: ' + dxTable.join(', ')
);

// 2.3 Bracket alignment [X_needle - dx, X_needle + dx] vs F-1 and F+1
let bracketAlignmentPass = true;
for (const W of testWidths) {
  for (let t = 800; t <= 1600; t += 20) {
    const xNeedle = ((t - MIN_TIME) / SPAN_TIME) * W;
    const prevFrameX = ((t - 20 - MIN_TIME) / SPAN_TIME) * W;
    const nextFrameX = ((t + 20 - MIN_TIME) / SPAN_TIME) * W;
    const dx = (20 / SPAN_TIME) * W;

    const leftDelta = xNeedle - prevFrameX;
    const rightDelta = nextFrameX - xNeedle;

    if (Math.abs(leftDelta - dx) > 1e-12 || Math.abs(rightDelta - dx) > 1e-12) {
      bracketAlignmentPass = false;
    }
  }
}

record(
  'SUITE 2 - Bracket Alignment',
  'Context bracket [F-1, F+1] exact symmetric alignment to needle',
  bracketAlignmentPass,
  'Tested across all 7 widths and 41 frames in [800ms, 1600ms]. Error < 1e-12px everywhere.'
);

// 2.4 Canvas Click Snapping: Unsnapped (Current) vs Snapped (Specification)
function testClickSnapping(W: number) {
  let unsnappedGridHits = 0;
  let unsnappedFloatingHits = 0;
  let snappedAllOnGrid = true;
  let maxSnapDistancePx = 0;

  for (let x = 0; x <= W; x++) {
    const ratio = x / W;
    const rawTime = MIN_TIME + ratio * SPAN_TIME;
    const isRawOnGrid = Number.isInteger(rawTime) && rawTime % 20 === 0;
    if (isRawOnGrid) unsnappedGridHits++;
    else unsnappedFloatingHits++;

    const snappedTime = Math.round((MIN_TIME + (x / W) * SPAN_TIME) / 20) * 20;
    if (snappedTime % 20 !== 0 || !Number.isInteger(snappedTime)) {
      snappedAllOnGrid = false;
    }

    const snappedX = ((snappedTime - MIN_TIME) / SPAN_TIME) * W;
    const distPx = Math.abs(snappedX - x);
    if (distPx > maxSnapDistancePx) maxSnapDistancePx = distPx;
  }

  const dx = (20 / SPAN_TIME) * W;
  const expectedMaxSnap = dx / 2;

  return {
    W,
    unsnappedGridHits,
    unsnappedFloatingHits,
    snappedAllOnGrid,
    maxSnapDistancePx,
    expectedMaxSnap,
  };
}

const snap480 = testClickSnapping(480);
const snap600 = testClickSnapping(600);
const snap720 = testClickSnapping(720);

record(
  'SUITE 2 - Click Snapping',
  'Click snapping to 20ms grid vs Unsnapped Floating Point',
  snap480.snappedAllOnGrid && snap600.snappedAllOnGrid && snap720.snappedAllOnGrid &&
  Math.abs(snap480.maxSnapDistancePx - snap480.expectedMaxSnap) < 1e-9,
  'W=480px: Unsnapped hits grid only ' + snap480.unsnappedGridHits + '/481 px (' + ((snap480.unsnappedGridHits/481)*100).toFixed(1) + '%). Snapped: 100% on grid, max snap = ' + snap480.maxSnapDistancePx + 'px (half-frame = ' + snap480.expectedMaxSnap + 'px).'
);

// 2.5 Stepping Drift under Unsnapped click vs Snapped click
const xClick = 245;
const rawTimeClick = MIN_TIME + (xClick / 480) * SPAN_TIME; // 1208.3333333333333 ms
const snappedTimeClick = Math.round(rawTimeClick / 20) * 20; // 1200 ms

let rawStepDrift = true;
let currentRaw = rawTimeClick;
for (let s = 1; s <= 10; s++) {
  currentRaw += 20;
  if (currentRaw % 20 === 0) {
    rawStepDrift = false;
  }
}

record(
  'SUITE 2 - Unsnapped Drift',
  'Unsnapped click induces permanent floating drift during subsequent +-1F steps',
  rawStepDrift,
  'Click at x=245px -> rawTime=' + rawTimeClick.toFixed(4) + 'ms. After 10 consecutive +1F steps: ' + currentRaw.toFixed(4) + 'ms. Remained non-integer and off-grid on 10/10 steps!'
);

console.log('\n===============================================================');
console.log('TOTAL CHECKS: ' + results.length + ' | PASSED: ' + results.filter(r => r.passed).length + ' | FAILED: ' + results.filter(r => !r.passed).length);
console.log('===============================================================');
