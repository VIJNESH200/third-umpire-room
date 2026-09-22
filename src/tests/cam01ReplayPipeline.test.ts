import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateScenario } from "../engine/scenarioGenerator";
import {
  getReplayFrameAtTime,
  CAM01_CANVAS_WIDTH,
  CAM01_CANVAS_HEIGHT,
} from "../engine/cam01Pipeline";

describe("CAM 01 2D Broadcast Replay Pipeline Unit Test Suite", () => {
  const sampleSeeds = [101, 202, 303, 404, 505];

  describe("Group 1: Ball In-Bounds and Visibility Invariant", () => {
    it("T1.1: Ball screen coordinates strictly stay within canvas bounds [0, 1200] x [0, 500] across full replay", () => {
      sampleSeeds.forEach((seed) => {
        const scenario = generateScenario(seed, "LBW");
        const lbw = scenario.lbw!;

        // Sample every 20ms from 600ms to 2200ms (81 frames)
        for (let t = 600; t <= 2200; t += 20) {
          const frame = getReplayFrameAtTime(lbw, t);
          const { x, y } = frame.ball;

          assert.ok(
            x >= 0 && x <= CAM01_CANVAS_WIDTH,
            `Seed ${seed} t=${t}ms: Ball screen X (${x.toFixed(1)}) outside canvas [0, ${CAM01_CANVAS_WIDTH}]`
          );
          assert.ok(
            y >= 0 && y <= CAM01_CANVAS_HEIGHT,
            `Seed ${seed} t=${t}ms: Ball screen Y (${y.toFixed(1)}) outside canvas [0, ${CAM01_CANVAS_HEIGHT}]`
          );
          assert.ok(
            frame.ball.radius >= 4.0,
            `Seed ${seed} t=${t}ms: Ball radius (${frame.ball.radius.toFixed(1)}) too small to be visible`
          );
        }
      });
    });

    it("T1.2: Bowler delivery gather and release (600ms - 800ms) are fully visible on screen", () => {
      const scenario = generateScenario(101, "LBW");
      const lbw = scenario.lbw!;

      const frame600 = getReplayFrameAtTime(lbw, 600);
      const frame700 = getReplayFrameAtTime(lbw, 700);
      const frame800 = getReplayFrameAtTime(lbw, 800);

      // Verify that at 600ms-800ms, the ball is well inside the canvas, NOT clipped below 500
      assert.ok(
        frame600.ball.y < CAM01_CANVAS_HEIGHT - 20,
        `Ball at 600ms Y (${frame600.ball.y.toFixed(1)}) must be safely above bottom boundary`
      );
      assert.ok(
        frame700.ball.y < CAM01_CANVAS_HEIGHT - 20,
        `Ball at 700ms Y (${frame700.ball.y.toFixed(1)}) must be safely above bottom boundary`
      );
      assert.ok(
        frame800.ball.y < CAM01_CANVAS_HEIGHT - 20,
        `Ball at 800ms Y (${frame800.ball.y.toFixed(1)}) must be safely above bottom boundary`
      );
    });
  });

  describe("Group 2: Continuous & Substantial Visual Ball Displacement", () => {
    it("T2.1: Ball moves substantially on screen between all major delivery milestones", () => {
      sampleSeeds.forEach((seed) => {
        const scenario = generateScenario(seed, "LBW");
        const lbw = scenario.lbw!;

        const milestones = [
          { from: 600, to: 800, minDisplacementPx: 15, label: "Gather to Release" },
          { from: 800, to: 1000, minDisplacementPx: 25, label: "Release to Mid-Flight" },
          { from: 1000, to: 1200, minDisplacementPx: 18, label: "Mid-Flight to Pitch Bounce" },
          { from: 1200, to: 1350, minDisplacementPx: 20, label: "Pitch Bounce to Post-Bounce Flight" },
          { from: 1350, to: 1500, minDisplacementPx: 18, label: "Post-Bounce Flight to Impact" },
          { from: 1500, to: 1800, minDisplacementPx: 15, label: "Impact to Aftermath" },
        ];

        milestones.forEach((m) => {
          const f1 = getReplayFrameAtTime(lbw, m.from);
          const f2 = getReplayFrameAtTime(lbw, m.to);

          const dx = f2.ball.x - f1.ball.x;
          const dy = f2.ball.y - f1.ball.y;
          const dist = Math.hypot(dx, dy);

          assert.ok(
            dist >= m.minDisplacementPx,
            `Seed ${seed} [${m.label}] ${m.from}ms -> ${m.to}ms: displacement was ${dist.toFixed(1)}px, expected >= ${m.minDisplacementPx}px`
          );
        });
      });
    });

    it("T2.2: Continuous movement between consecutive 50ms frames without static stalling", () => {
      const scenario = generateScenario(101, "LBW");
      const lbw = scenario.lbw!;

      // During active delivery flight (600ms to 1700ms), every 50ms interval must show displacement
      for (let t = 600; t < 1700; t += 50) {
        const f1 = getReplayFrameAtTime(lbw, t);
        const f2 = getReplayFrameAtTime(lbw, t + 50);

        const dx = f2.ball.x - f1.ball.x;
        const dy = f2.ball.y - f1.ball.y;
        const dist = Math.hypot(dx, dy);

        assert.ok(
          dist > 1.0,
          `At t=${t}ms to ${t + 50}ms: displacement (${dist.toFixed(2)}px) too small (static image stall)`
        );
      }
    });
  });

  describe("Group 3: Continuous Batter Kinematics & Articulation", () => {
    it("T3.1: Batter exhibits perceptible stance trigger movement, forward stride, and swing", () => {
      const scenario = generateScenario(101, "LBW");
      const lbw = scenario.lbw!;

      const f600 = getReplayFrameAtTime(lbw, 600);
      const f800 = getReplayFrameAtTime(lbw, 800);
      const f1100 = getReplayFrameAtTime(lbw, 1100);
      const f1350 = getReplayFrameAtTime(lbw, 1350);
      const f1500 = getReplayFrameAtTime(lbw, 1500);

      // Trigger movement between 600ms and 800ms
      assert.notEqual(
        f600.batter.triggerOffset,
        f800.batter.triggerOffset,
        "Trigger offset should shift during bowler run-in / delivery gather"
      );

      // Forward stride between 800ms and 1350ms
      assert.ok(
        f1100.batter.stride >= f800.batter.stride,
        "Stride progress at 1100ms must be >= 800ms"
      );
      assert.ok(
        f1350.batter.stride >= f1100.batter.stride,
        "Stride progress at 1350ms must be >= 1100ms"
      );

      // Front pad position differs between neutral and impact
      const padDist = Math.hypot(
        f1500.batter.frontPad.x - f600.batter.frontPad.x,
        f1500.batter.frontPad.y - f600.batter.frontPad.y
      );
      assert.ok(
        padDist > 15,
        `Front pad screen position must move significantly into shot (${padDist.toFixed(1)}px)`
      );
    });

    it("T3.2: Batter experiences impact shock recoil at impact", () => {
      const scenario = generateScenario(101, "LBW");
      const lbw = scenario.lbw!;

      const fPreImpact = getReplayFrameAtTime(lbw, 1490);
      const fPostImpact = getReplayFrameAtTime(lbw, 1530);

      assert.equal(fPreImpact.batter.recoilX, 0, "No X recoil before impact");
      assert.equal(fPreImpact.batter.recoilY, 0, "No Y recoil before impact");
      assert.ok(
        fPostImpact.batter.recoilX !== 0 || fPostImpact.batter.recoilY !== 0,
        "Recoil active immediately after impact"
      );
    });
  });

  describe("Group 4: Broadcast Optical Progression", () => {
    it("T4.1: Camera smoothly zooms and pans down-pitch without discontinuities or jumps", () => {
      let prevZoom = getReplayFrameAtTime(generateScenario(101, "LBW").lbw!, 800).cameraZoom;
      let prevPanY = getReplayFrameAtTime(generateScenario(101, "LBW").lbw!, 800).cameraPanY;

      for (let t = 820; t <= 1500; t += 20) {
        const frame = getReplayFrameAtTime(generateScenario(101, "LBW").lbw!, t);
        const dz = frame.cameraZoom - prevZoom;
        const dp = frame.cameraPanY - prevPanY;

        // Monotonic smooth forward tracking and zoom
        assert.ok(dz >= -1e-6, `At t=${t}ms: zoom should increase smoothly (dz=${dz})`);
        assert.ok(dp >= -1e-6, `At t=${t}ms: pan should track smoothly (dp=${dp})`);

        prevZoom = frame.cameraZoom;
        prevPanY = frame.cameraPanY;
      }
    });

    it("T4.2: Striker stumps remain stably framed and prominent throughout delivery", () => {
      const fStart = getReplayFrameAtTime(generateScenario(101, "LBW").lbw!, 600);
      const fEnd = getReplayFrameAtTime(generateScenario(101, "LBW").lbw!, 1800);

      // Stumps remain near center
      assert.ok(Math.abs(fStart.stumps.baseX - CAM01_CANVAS_WIDTH * 0.5) < 50);
      assert.ok(Math.abs(fEnd.stumps.baseX - CAM01_CANVAS_WIDTH * 0.5) < 50);
      assert.ok(fStart.stumps.height >= 50, "Stump height must be >= 50px for television readability");
    });
  });

  describe("Group 5: Determinism and Scrubbing", () => {
    it("T5.1: Scrubbing to any millisecond produces strictly deterministic frame data", () => {
      const scenario = generateScenario(777, "LBW");
      const lbw = scenario.lbw!;

      const testTimes = [600, 800, 1000, 1200, 1400, 1500, 1800];
      testTimes.forEach((t) => {
        const frameA = getReplayFrameAtTime(lbw, t);
        const frameB = getReplayFrameAtTime(lbw, t);

        assert.equal(frameA.ball.x, frameB.ball.x);
        assert.equal(frameA.ball.y, frameB.ball.y);
        assert.equal(frameA.batter.frontPad.x, frameB.batter.frontPad.x);
        assert.equal(frameA.batter.frontPad.y, frameB.batter.frontPad.y);
        assert.equal(frameA.phase, frameB.phase);
      });
    });
  });
});
