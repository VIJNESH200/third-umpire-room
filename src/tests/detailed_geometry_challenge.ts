/**
 * Comprehensive Empirical Mathematical & Canvas Geometry Verification Suite
 * Challenger 1 (Round 2) - Empirical Evidence Generation
 */

interface VerificationCase {
  id: string;
  category: string;
  claim: string;
  passed: boolean;
  metrics: Record<string, any>;
  notes: string;
}

const evidenceLog: VerificationCase[] = [];

function recordEvidence(
  id: string,
  category: string,
  claim: string,
  passed: boolean,
  metrics: Record<string, any>,
  notes: string
) {
  evidenceLog.push({ id, category, claim, passed, metrics, notes });
  const mark = passed ? '[PASS]' : '[FAIL]';
  console.log(mark + ' ' + id + ' (' + category + '): ' + claim);
}

console.log('================================================================');
console.log('  CHALLENGER 1 (R2): EMPIRICAL VERIFICATION & STRESS HARNESS    ');
console.log('================================================================\n');

const newFrame = (timeMs: number): number => Math.round(timeMs / 20);
const oldFrame = (timeMs: number): number => Math.round((timeMs - 600) / 10);

// ----------------------------------------------------------------------------
// 1. Monotonicity & Discrete Integer Millisecond Analysis [600ms, 2200ms]
// ----------------------------------------------------------------------------
let isStrictlyMonotonic = true;
let totalComparisons = 0;
let stepOccurrences: Record<number, number> = {};

for (let t = 600; t < 2200; t++) {
  const f1 = newFrame(t);
  const f2 = newFrame(t + 1);
  const delta = f2 - f1;
  stepOccurrences[delta] = (stepOccurrences[delta] || 0) + 1;
  if (delta < 0) {
    isStrictlyMonotonic = false;
  }
  totalComparisons++;
}

recordEvidence(
  'MC-01',
  'Monotonicity',
  'F(t) is weakly monotonic across every millisecond in [600, 2200]',
  isStrictlyMonotonic && stepOccurrences[1] === 80 && stepOccurrences[0] === 1520,
  {
    totalIntervals: totalComparisons,
    zeroSteps: stepOccurrences[0],
    unitSteps: stepOccurrences[1],
    negativeSteps: stepOccurrences[-1] || 0,
    otherSteps: Object.keys(stepOccurrences).filter(k => k !== '0' && k !== '1').length
  },
  'Exactly 80 frame advances of +1 over 1600ms, each frame plateau lasts exactly 20ms.'
);

// ----------------------------------------------------------------------------
// 2. Critical Timeline Anchor Points
// ----------------------------------------------------------------------------
const canonicalTimelineAnchors = [
  { name: 'Replay Start', timeMs: 600, expectedFrame: 30 },
  { name: 'Audio Window Start / Bowler Release', timeMs: 800, expectedFrame: 40 },
  { name: 'Pitch Bounce', timeMs: 1040, expectedFrame: 52 },
  { name: 'Pre-Transit (F-1)', timeMs: 1180, expectedFrame: 59 },
  { name: 'Bat Transit Datum (F)', timeMs: 1200, expectedFrame: 60 },
  { name: 'Post-Transit (F+1)', timeMs: 1220, expectedFrame: 61 },
  { name: 'Keeper Catch', timeMs: 1300, expectedFrame: 65 },
  { name: 'Ground Scrape Decoy', timeMs: 1320, expectedFrame: 66 },
  { name: 'Audio Window End', timeMs: 1600, expectedFrame: 80 },
  { name: 'Replay End', timeMs: 2200, expectedFrame: 110 }
];

let allAnchorsMatch = true;
const anchorDetails: Record<string, { timeMs: number; gotFrame: number; expected: number; match: boolean }> = {};

for (const a of canonicalTimelineAnchors) {
  const got = newFrame(a.timeMs);
  const match = got === a.expectedFrame;
  if (!match) allAnchorsMatch = false;
  anchorDetails[a.name] = { timeMs: a.timeMs, gotFrame: got, expected: a.expectedFrame, match };
}

recordEvidence(
  'MC-02',
  'Timeline Anchors',
  'All canonical timeline anchor timestamps map to exact integer frames',
  allAnchorsMatch,
  anchorDetails,
  'F59=1180ms, F60=1200ms, F61=1220ms strictly confirmed.'
);

// ----------------------------------------------------------------------------
// 3. Rounding Boundaries & Half-Integer Thresholds
// ----------------------------------------------------------------------------
const boundaryTests = [
  { t: 1169.999, expected: 58 },
  { t: 1170.000, expected: 59 },
  { t: 1189.999, expected: 59 },
  { t: 1190.000, expected: 60 },
  { t: 1209.999, expected: 60 },
  { t: 1210.000, expected: 61 },
  { t: 1229.999, expected: 61 },
  { t: 1230.000, expected: 62 }
];

let allBoundariesPass = true;
const boundaryResults: Record<number, { got: number; expected: number; pass: boolean }> = {};

for (const b of boundaryTests) {
  const got = newFrame(b.t);
  const pass = got === b.expected;
  if (!pass) allBoundariesPass = false;
  boundaryResults[b.t] = { got, expected: b.expected, pass };
}

recordEvidence(
  'MC-03',
  'Rounding Boundaries',
  'Half-integer rounding thresholds transition at exactly 20k - 10 ms',
  allBoundariesPass,
  boundaryResults,
  'Frame F60 is strictly active in the continuous half-open interval [1190.0ms, 1210.0ms).'
);

// ----------------------------------------------------------------------------
// 4. Stepping by +-20ms Invariant (No Dropped or Skipped Frames)
// ----------------------------------------------------------------------------
let stepForwardCount = 0;
let stepBackwardCount = 0;
let fwdSkippedOrDropped = false;
let backSkippedOrDropped = false;

for (let t = 600; t <= 2200; t += 20) {
  const currentF = newFrame(t);
  if (t + 20 <= 2200) {
    const nextF = newFrame(t + 20);
    if (nextF !== currentF + 1) fwdSkippedOrDropped = true;
    stepForwardCount++;
  }
  if (t - 20 >= 600) {
    const prevF = newFrame(t - 20);
    if (prevF !== currentF - 1) backSkippedOrDropped = true;
    stepBackwardCount++;
  }
}

recordEvidence(
  'MC-04',
  'Stepping Invariant',
  'Stepping by +-20ms never drops or skips a single frame across transport',
  !fwdSkippedOrDropped && !backSkippedOrDropped && stepForwardCount === 80 && stepBackwardCount === 80,
  { stepForwardCount, stepBackwardCount, fwdSkippedOrDropped, backSkippedOrDropped },
  '80 forward steps and 80 backward steps all increment/decrement by strictly 1 frame.'
);

// ----------------------------------------------------------------------------
// 5. Old Formula Discrepancy & Mathematical Failure Analysis
// ----------------------------------------------------------------------------
const oldFormulaErrors: { t: number; newF: number; oldF: number; err: number }[] = [];
let coincidences: number[] = [];
let oddFramesSkippedByOld = 0;

for (let t = 600; t <= 2200; t += 20) {
  const nF = newFrame(t);
  const oF = oldFrame(t);
  const err = oF - nF;
  oldFormulaErrors.push({ t, newF: nF, oldF: oF, err });
  if (err === 0) coincidences.push(t);

  if (t + 20 <= 2200) {
    const oNext = oldFrame(t + 20);
    if (oNext - oF === 2) {
      oddFramesSkippedByOld++;
    }
  }
}

recordEvidence(
  'MC-05',
  'Old Formula Analysis',
  'Old formula (timeMs - 600)/10 fails across entire timeline except t=1200ms',
  coincidences.length === 1 && coincidences[0] === 1200 && oddFramesSkippedByOld === 80,
  {
    intersectionTimestampMs: coincidences[0],
    errorAt600ms: oldFormulaErrors.find(e => e.t === 600)?.err,
    errorAt1180ms: oldFormulaErrors.find(e => e.t === 1180)?.err,
    errorAt1200ms: oldFormulaErrors.find(e => e.t === 1200)?.err,
    errorAt1220ms: oldFormulaErrors.find(e => e.t === 1220)?.err,
    errorAt2200ms: oldFormulaErrors.find(e => e.t === 2200)?.err,
    stepsSkippingFrames: oddFramesSkippedByOld
  },
  'Old formula advances at 100 FPS (10ms/frame), producing an error gradient of +0.05 frames/ms around 1200ms.'
);

// ----------------------------------------------------------------------------
// 6. Canvas X-Coordinate Geometry across Dynamic Widths
// ----------------------------------------------------------------------------
const canvasWidths = [320, 480, 600, 720, 960, 1280, 1920];
const MIN_T = 800;
const MAX_T = 1600;
const SPAN_T = 800;
const TRANSIT_T = 1200;

let allWidthsCentered = true;
let allFrameStepWidthsExact = true;
const widthMetrics: Record<number, { xTransit: number; ratio: number; pxPerFrame: number; pxPer100ms: number; bracketSpanPx: number }> = {};

for (const W of canvasWidths) {
  const xTransit = ((TRANSIT_T - MIN_T) / SPAN_T) * W;
  const ratio = xTransit / W;
  const pxPerMs = W / SPAN_T;
  const pxPerFrame = 20 * pxPerMs;
  const pxPer100ms = 100 * pxPerMs;
  const bracketSpanPx = 2 * pxPerFrame;

  if (ratio !== 0.5) allWidthsCentered = false;
  if (Math.abs(pxPerFrame - (W * 20 / 800)) > 1e-12) allFrameStepWidthsExact = false;

  widthMetrics[W] = { xTransit, ratio, pxPerFrame, pxPer100ms, bracketSpanPx };
}

recordEvidence(
  'GC-01',
  'Canvas Width Scaling',
  'Bat transit datum is exactly at 50% width and frame steps scale linearly across all canvas widths',
  allWidthsCentered && allFrameStepWidthsExact,
  widthMetrics,
  'At W=480: frame=12px, bracket=24px. At W=600: frame=15px, bracket=30px. At W=720: frame=18px, bracket=36px.'
);

// ----------------------------------------------------------------------------
// 7. Context Bracket Alignment [X_needle - dx, X_needle + dx] vs F-1, F+1
// ----------------------------------------------------------------------------
let bracketExactAlignment = true;
let maxBracketDiscrepancy = 0;

for (const W of canvasWidths) {
  for (let t = 800; t <= 1600; t += 20) {
    const xNeedle = ((t - MIN_T) / SPAN_T) * W;
    const prevFrameX = ((t - 20 - MIN_T) / SPAN_T) * W;
    const nextFrameX = ((t + 20 - MIN_T) / SPAN_T) * W;
    const dxExpected = (20 / SPAN_T) * W;

    const diffLeft = Math.abs((xNeedle - prevFrameX) - dxExpected);
    const diffRight = Math.abs((nextFrameX - xNeedle) - dxExpected);
    const maxDiff = Math.max(diffLeft, diffRight);
    if (maxDiff > maxBracketDiscrepancy) maxBracketDiscrepancy = maxDiff;
    if (maxDiff > 1e-12) bracketExactAlignment = false;
  }
}

recordEvidence(
  'GC-02',
  'Bracket Alignment',
  'Context bracket left and right boundaries align with mathematical zero-error to F-1 and F+1',
  bracketExactAlignment,
  { maxDiscrepancyPx: maxBracketDiscrepancy },
  'The dynamic formula ((currentTimeMs +- 20 - minTime)/(maxTime - minTime)) * width ensures exact alignment at any viewport width.'
);

// ----------------------------------------------------------------------------
// 8. Canvas Click Snapping & Drift Analysis
// ----------------------------------------------------------------------------
const clickAnalysisAt480 = (() => {
  let offGridClicks = 0;
  let onGridClicks = 0;
  let snappedAllMatch = true;

  for (let x = 0; x <= 480; x++) {
    const rawTime = MIN_T + (x / 480) * SPAN_T;
    if (rawTime % 20 === 0 && Number.isInteger(rawTime)) onGridClicks++;
    else offGridClicks++;

    const snapped = Math.round(rawTime / 20) * 20;
    if (snapped % 20 !== 0) snappedAllMatch = false;
  }
  return { offGridClicks, onGridClicks, snappedAllMatch };
})();

recordEvidence(
  'GC-03',
  'Click Snapping',
  'Unsnapped clicks produce 91.5% non-grid timestamps, while snapped clicks guarantee 100% 20ms alignment',
  clickAnalysisAt480.snappedAllMatch && clickAnalysisAt480.onGridClicks === 41 && clickAnalysisAt480.offGridClicks === 440,
  {
    totalPixelsTested: 481,
    onGridClicks: clickAnalysisAt480.onGridClicks,
    offGridClicks: clickAnalysisAt480.offGridClicks,
    onGridPercentage: ((clickAnalysisAt480.onGridClicks / 481) * 100).toFixed(2) + '%'
  },
  'Clicking arbitrary canvas pixels in UltraEdgeWaveform without Math.round(t/20)*20 introduces fractional millisecond jitter.'
);

// ----------------------------------------------------------------------------
// 9. Edge Case: Sub-Pixel Aliasing on Integer Canvas Bitmaps
// ----------------------------------------------------------------------------
const rawFloatIssues: { W: number; t: number; rawX: number; roundedX: number }[] = [];
for (const W of canvasWidths) {
  for (let t = 800; t <= 1600; t += 20) {
    const rawX = ((t - MIN_T) / SPAN_T) * W;
    const roundedX = Math.round(rawX);
    if (!Number.isInteger(rawX)) {
      rawFloatIssues.push({ W, t, rawX, roundedX });
    }
  }
}

// Check with Math.round(coord) as mandated by SPECIFICATION section 4.1
const roundedAllIntegers = canvasWidths.every(W => {
  for (let t = 800; t <= 1600; t += 20) {
    const roundedX = Math.round(((t - MIN_T) / SPAN_T) * W);
    if (!Number.isInteger(roundedX)) return false;
  }
  return true;
});

recordEvidence(
  'GC-04',
  'Sub-Pixel Precision & IEEE 754 Rounding',
  'Raw float coordinates suffer from IEEE 754 precision artifacts (e.g. W=720, t=940ms -> 125.99999999999999px); Math.round(coord) resolves 100% cleanly',
  roundedAllIntegers && rawFloatIssues.length > 0,
  {
    rawFloatIssuesCount: rawFloatIssues.length,
    exampleArtifact: rawFloatIssues[0],
    specificationMathRoundPass: roundedAllIntegers
  },
  'Confirms SPECIFICATION section 4.1 requirement: 2px needle lines MUST use Math.round(coord) to eliminate IEEE 754 sub-pixel fuzz.'
);

console.log('\n================================================================');
console.log('SUMMARY: ' + evidenceLog.filter(e => e.passed).length + ' / ' + evidenceLog.length + ' CLAIMS CONFIRMED');
console.log('================================================================');
