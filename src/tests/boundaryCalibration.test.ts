import { generateScenario } from "../engine/scenarioGenerator";
import {
  solveBoundaryReplayState,
  resolveBoundaryArchetype,
  getBoundaryEventTimeline,
  projectMacroBoundaryCoords,
} from "../engine/boundaryPhysics";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${message}`);
  } else {
    failed++;
    console.error(`[FAIL] ${message}`);
  }
}

export function runBoundaryCalibrationTests() {
  console.log("\n=================================================");
  console.log("   BOUNDARY CATCH TARGETED GEOMETRIC CALIBRATION  ");
  console.log("=================================================");

  // -------------------------------------------------------------
  // P1: FIELDER ROOT vs LEAD-BOOT GEOMETRY CONTRACT
  // -------------------------------------------------------------
  console.log("\n--- P1: FIELDER ROOT vs LEAD-BOOT GEOMETRY ---");

  // T1.1: SLIDING_CATCH clean catch (marginMm = -10, Seed 11)
  {
    const scn = generateScenario(11, "BOUNDARY");
    const bd = scn.boundary!;
    assert(resolveBoundaryArchetype(bd) === "SLIDING_CATCH", "T1.1: Seed 11 resolves to SLIDING_CATCH");
    assert(bd.marginMm === -10, "T1.1: Seed 11 marginMm is strictly -10mm");
    assert(!bd.isBoundary, "T1.1: Seed 11 is clean catch (isBoundary = false)");

    const state1400 = solveBoundaryReplayState(bd, 1400);
    const bootX = state1400.primaryFielder.bootPoint.x;
    const fielderX = state1400.primaryFielder.x;
    const clrMm = state1400.primaryFielder.cushionClearanceMm;

    assert(Math.abs(bootX - (-0.010)) < 0.001, `T1.1: Canonical lead-boot X is ≈ -0.010m (got ${bootX.toFixed(4)}m)`);
    assert(Math.abs(clrMm - (-10.0)) < 0.1, `T1.1: Cushion clearance is strictly -10mm (got ${clrMm.toFixed(1)}mm)`);
    assert(Math.abs((bootX - fielderX) - 0.45) < 0.001, `T1.1: Pelvis root derives from boot with 0.45m slide offset (got ${(bootX - fielderX).toFixed(4)}m)`);
    assert(!state1400.cushion.isContacted, "T1.1: Cushion is NOT contacted for -10mm daylight catch");
  }

  // T1.2: SLIDING_CATCH boundary contact (marginMm = +73, Seed 1)
  {
    const scn = generateScenario(1, "BOUNDARY");
    const bd = scn.boundary!;
    assert(resolveBoundaryArchetype(bd) === "SLIDING_CATCH", "T1.2: Seed 1 resolves to SLIDING_CATCH");
    assert(bd.marginMm === 73, "T1.2: Seed 1 marginMm is strictly +73mm");
    assert(bd.isBoundary, "T1.2: Seed 1 is boundary contact (isBoundary = true)");

    const state1400 = solveBoundaryReplayState(bd, 1400);
    const bootX = state1400.primaryFielder.bootPoint.x;
    const fielderX = state1400.primaryFielder.x;
    const clrMm = state1400.primaryFielder.cushionClearanceMm;

    assert(Math.abs(bootX - 0.073) < 0.001, `T1.2: Canonical lead-boot X is ≈ +0.073m (got ${bootX.toFixed(4)}m)`);
    assert(Math.abs(clrMm - 73.0) < 0.1, `T1.2: Cushion clearance is strictly +73mm (got ${clrMm.toFixed(1)}mm)`);
    assert(Math.abs((bootX - fielderX) - 0.45) < 0.001, `T1.2: Pelvis root derives with 0.45m slide offset (got ${(bootX - fielderX).toFixed(4)}m)`);
    assert(state1400.cushion.isContacted, "T1.2: Cushion is contacted for +73mm penetration");
  }

  // T1.3: RUNNING_ROPE_CATCH (marginMm = -78, Seed 2)
  {
    const scn = generateScenario(2, "BOUNDARY");
    const bd = scn.boundary!;
    assert(resolveBoundaryArchetype(bd) === "RUNNING_ROPE_CATCH", "T1.3: Seed 2 resolves to RUNNING_ROPE_CATCH");
    assert(bd.marginMm === -78, "T1.3: Seed 2 marginMm is strictly -78mm");

    const state1400 = solveBoundaryReplayState(bd, 1400);
    const bootX = state1400.primaryFielder.bootPoint.x;
    const fielderX = state1400.primaryFielder.x;
    const clrMm = state1400.primaryFielder.cushionClearanceMm;

    assert(Math.abs(bootX - (-0.078)) < 0.001, `T1.3: Canonical lead-boot X is ≈ -0.078m (got ${bootX.toFixed(4)}m)`);
    assert(Math.abs(clrMm - (-78.0)) < 0.1, `T1.3: Cushion clearance is strictly -78mm (got ${clrMm.toFixed(1)}mm)`);
    assert(Math.abs((bootX - fielderX) - 0.20) < 0.001, `T1.3: Pelvis root derives with 0.20m run offset (got ${(bootX - fielderX).toFixed(4)}m)`);
    assert(!state1400.cushion.isContacted, "T1.3: Cushion is NOT contacted for -78mm running gather");
  }

  // T1.4: AIRBORNE_RELAY & PARTNER_GATHER (Seed 4)
  {
    const scn = generateScenario(4, "BOUNDARY");
    const bd = scn.boundary!;
    assert(resolveBoundaryArchetype(bd) === "AIRBORNE_RELAY", "T1.4: Seed 4 resolves to AIRBORNE_RELAY");

    // Interception at 1260ms: primary fielder airborne
    const state1260 = solveBoundaryReplayState(bd, 1260);
    assert(state1260.primaryFielder.isAirborne, "T1.4: Primary fielder is airborne at interception (1260ms)");
    assert(state1260.primaryFielder.z > 0.05, `T1.4: Elevation > 0.05m at 1260ms (got ${state1260.primaryFielder.z.toFixed(3)}m)`);

    // Ball toss to partner
    const state1400 = solveBoundaryReplayState(bd, 1400);
    assert(state1400.ball.isRelayed, "T1.4: Ball is marked relayed post-release");
    assert(state1400.partnerFielder !== undefined, "T1.4: Partner fielder exists for AIRBORNE_RELAY");
    assert(state1400.partnerFielder?.isGrounded === true, "T1.4: Relay partner is grounded inside boundary");
    assert(state1400.partnerFielder?.x === -3.5, "T1.4: Relay partner is stationed inside field of play (x = -3.5m)");

    // Completion at 1800ms
    const state1800 = solveBoundaryReplayState(bd, 1800);
    assert(state1800.partnerFielder?.hasCaughtBall === true, "T1.4: Relay partner has caught ball at completion");
    assert(state1800.ball.carrier === "PARTNER", "T1.4: Ball carrier is PARTNER at completion");
  }

  // -------------------------------------------------------------
  // P2: CAM05 BALL FRAMING & VERTICAL CALIBRATION
  // -------------------------------------------------------------
  // T1.5: Clean catch halt invariance (no post-contact drift into cushion)
  {
    for (const seed of [2, 11]) {
      const scn = generateScenario(seed, "BOUNDARY");
      const bd = scn.boundary!;
      const maxAppX = bd.marginMm / 1000;
      for (let t = 1400; t <= 2200; t += 50) {
        const s = solveBoundaryReplayState(bd, t);
        const bootX = s.primaryFielder.bootPoint.x;
        assert(bootX <= maxAppX + 0.0001,
          `T1.5 (seed ${seed}, t=${t}ms): Clean catch boot X does not drift into cushion (got ${bootX.toFixed(4)}m <= ${maxAppX.toFixed(4)}m)`);
      }
    }
  }

  // -------------------------------------------------------------
  // P2: CAM05 BALL FRAMING & VERTICAL CALIBRATION
  // -------------------------------------------------------------
  console.log("\n--- P2: CAM05 BALL FRAMING & CALIBRATION ---");

  // T2.1: Macro coordinate projection scaling
  {
    const VIEW_W = 500;
    const VIEW_H = 280;
    const origin = projectMacroBoundaryCoords(0.0, 0.0, VIEW_W, VIEW_H);
    assert(origin.screenX === 250, "T2.1: Cushion front edge X = 0.0m maps to screenX = 250");
    assert(origin.screenY >= 195 && origin.screenY <= 210, `T2.1: Ground line Y is at calibrated level ~201px (got ${origin.screenY}px)`);

    // Cushion top height (0.20m)
    const cushionTop = projectMacroBoundaryCoords(0.0, 0.20, VIEW_W, VIEW_H);
    const cushionHeightPx = origin.screenY - cushionTop.screenY;
    assert(cushionHeightPx >= 12 && cushionHeightPx <= 25, `T2.1: 0.20m cushion height projects to realistic ~15px (got ${cushionHeightPx.toFixed(1)}px)`);
  }

  // T2.2: Ball inside viewport throughout interception window across seeds
  {
    const VIEW_W = 500;
    const VIEW_H = 280;
    for (const seed of [1, 2, 4, 11, 25]) {
      const scn = generateScenario(seed, "BOUNDARY");
      const bd = scn.boundary!;
      const timeline = getBoundaryEventTimeline(bd);
      const arch = resolveBoundaryArchetype(bd);
      const startMs = timeline.firstBallContactMs;
      // In AIRBORNE_RELAY, CAM05 tracks interception to release before CAM09 tracks the high backward toss
      const endMs = arch === "AIRBORNE_RELAY" ? timeline.boundaryReleaseMs : timeline.boundaryContactMs;

      for (let t = startMs; t <= endMs; t += 20) {
        const s = solveBoundaryReplayState(bd, t);
        const ballScreen = projectMacroBoundaryCoords(s.ball.x, s.ball.z, VIEW_W, VIEW_H);
        // During macro interception window, ball altitude must never push screenY off-screen
        assert(ballScreen.screenY >= 20 && ballScreen.screenY <= VIEW_H,
          `T2.2 (seed ${seed}, t=${t}ms): Ball screenY strictly within viewport [20, 280] (got ${ballScreen.screenY.toFixed(1)}px)`);
      }
    }
  }

  // T2.3: Hand and ball altitude coherence in SLIDING_CATCH
  {
    const scn = generateScenario(11, "BOUNDARY");
    // At first contact (1280ms) and through catch control (1330ms)
    for (const t of [1280, 1330, 1400]) {
      const s = solveBoundaryReplayState(scn.boundary!, t);
      const ballScreen = projectMacroBoundaryCoords(s.ball.x, s.ball.z);
      const ground = projectMacroBoundaryCoords(0, 0).screenY;
      const ballElevationPx = ground - ballScreen.screenY;
      assert(ballElevationPx >= 25 && ballElevationPx <= 40,
        `T2.3 (t=${t}ms): Ball altitude above ground in slide is ~31px matching rig hands (got ${ballElevationPx.toFixed(1)}px)`);
    }
  }

  // T2.4: Spatial connection between hands and ball while controlled
  {
    for (const seed of [1, 2, 4, 11]) {
      const scn = generateScenario(seed, "BOUNDARY");
      const bd = scn.boundary!;
      const timeline = getBoundaryEventTimeline(bd);
      const s = solveBoundaryReplayState(bd, timeline.catchControlMs);
      assert(s.ball.isControlled, `T2.4 (seed ${seed}): Ball is controlled in hands at catchControlMs (${timeline.catchControlMs}ms)`);
      // Hands and ball coordinate agreement
      const dx = Math.abs(s.ball.x - s.primaryFielder.handsPoint.x);
      const dz = Math.abs(s.ball.z - s.primaryFielder.handsPoint.z);
      assert(dx < 0.001 && dz < 0.001,
        `T2.4 (seed ${seed}): Ball strictly adheres to handsPoint (dx=${dx.toFixed(4)}m, dz=${dz.toFixed(4)}m)`);
    }
  }

  // -------------------------------------------------------------
  // P3: TELEMETRY NEUTRALITY & ZERO COLOR SIGNALING
  // -------------------------------------------------------------
  console.log("\n--- P3: TELEMETRY NEUTRALITY ---");

  // T3.1: Guide line clearance contracts
  {
    for (const seed of [1, 11]) {
      const scn = generateScenario(seed, "BOUNDARY");
      const s = solveBoundaryReplayState(scn.boundary!, 1400);
      const isContacted = s.cushion.isContacted;
      // In both contacted (seed 1) and safe (seed 11) scenarios, clearance mm is strictly numeric
      assert(Number.isFinite(s.primaryFielder.cushionClearanceMm), `T3.1 (seed ${seed}): Clearance is finite numeric mm`);
      if (isContacted) {
        assert(s.primaryFielder.cushionClearanceMm > 0, `T3.1: Contacted scenario has positive clearance mm (got ${s.primaryFielder.cushionClearanceMm}mm)`);
      } else {
        assert(s.primaryFielder.cushionClearanceMm < 0, `T3.1: Daylight scenario has negative clearance mm (got ${s.primaryFielder.cushionClearanceMm}mm)`);
      }
    }
  }

  console.log("=================================================");
  console.log(`   BOUNDARY CALIBRATION: ${passed + failed} TESTS | ${passed} PASSED | ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    throw new Error(`Boundary calibration tests failed: ${failed} failure(s).`);
  }
}

runBoundaryCalibrationTests();
