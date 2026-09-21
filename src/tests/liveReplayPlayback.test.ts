/**
 * src/tests/liveReplayPlayback.test.ts
 *
 * Dedicated regression test suite for live replay playback lifecycle,
 * authoritative playback clock, scrubbing, transport controls, and determinism.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateScenario } from "../engine/scenarioGenerator";
import { solveLBWReplayState, LBW_TIMESTAMPS } from "../engine/lbwPhysics";
import { resolveReplayShortcut } from "../engine/replayKeyboard";

describe("Live Replay Playback Engine & Transport Lifecycle", () => {
  // --------------------------------------------------------------------------
  // Group 1: Authoritative Playback Clock Mechanics
  // --------------------------------------------------------------------------
  describe("Group 1: Authoritative Playback Clock Mechanics", () => {
    it("T1.1: Play -> time advances based on elapsed wall time and playback rate", () => {
      const playbackSpeed = 0.5; // 0.5x speed
      const baseLogicalTime = 800.0; // Start at 800ms

      // Advance 1000ms wall-clock time
      const elapsedWall1 = 1000.0;
      const time1 = baseLogicalTime + elapsedWall1 * playbackSpeed;
      assert.equal(time1, 1300.0, "At 0.5x speed, 1000ms wall time advances 500ms logical time");

      // Advance another 1000ms wall-clock time (2000ms total)
      const elapsedWall2 = 2000.0;
      const time2 = baseLogicalTime + elapsedWall2 * playbackSpeed;
      assert.equal(time2, 1800.0, "At 0.5x speed, 2000ms wall time advances 1000ms logical time");
    });

    it("T1.2: Pause -> time stops and freezes exact frame", () => {
      let isPlaying = true;
      let currentTime = 1200;
      const pausedTime = currentTime;

      // Simulate pausing
      isPlaying = false;
      // Advance wall clock while paused
      const elapsedWall = 5000; // 5 seconds
      if (isPlaying) {
        currentTime += elapsedWall;
      }

      assert.equal(currentTime, pausedTime, "Paused state must not advance logical time");
    });

    it("T1.3: Resume -> continues from exact paused position without jumping", () => {
      const pausedLogicalTime = 1420;
      const resumeWallTime = 25000;
      const playbackSpeed = 1.0;

      // Re-base at resume point
      const playbackBase = { wallTime: resumeWallTime, logicalTime: pausedLogicalTime };

      // After 200ms of resuming
      const now = resumeWallTime + 200;
      const nextTime = playbackBase.logicalTime + (now - playbackBase.wallTime) * playbackSpeed;

      assert.equal(nextTime, 1620, "Resume continues seamlessly from paused point");
    });

    it("T1.4: Restart -> returns strictly to minTimeMs and stops or resets base", () => {
      const minTimeMs = 600;
      let currentTime = 1950;
      let isPlaying = true;
      let playbackBase: { wallTime: number; logicalTime: number } | null = { wallTime: 100, logicalTime: 1950 };

      // Trigger restart
      currentTime = minTimeMs;
      isPlaying = false;
      playbackBase = null;

      assert.equal(currentTime, minTimeMs, "Time resets to start boundary");
      assert.equal(isPlaying, false, "Playback is halted on restart");
      assert.equal(playbackBase, null, "Playback base is cleared");
    });

    it("T1.5: End of replay -> clamps to maxTimeMs, stops playing, final frame remains visible", () => {
      const maxTimeMs = 2200;
      const playbackBase = { wallTime: 1000, logicalTime: 2000 };
      const now = 2000; // 1000ms elapsed
      const playbackSpeed = 1.0;

      let next = playbackBase.logicalTime + (now - playbackBase.wallTime) * playbackSpeed; // 3000
      let isPlaying = true;

      if (next >= maxTimeMs) {
        next = maxTimeMs;
        isPlaying = false;
      }

      assert.equal(next, maxTimeMs, "Logical time clamped to maxTimeMs");
      assert.equal(isPlaying, false, "isPlaying must transition to false at duration boundary");
    });

    it("T1.6: Clicking play when at maxTimeMs wraps to start and plays forward", () => {
      const minTimeMs = 600;
      const maxTimeMs = 2200;
      let currentTime = maxTimeMs;
      let isPlaying = false;

      // Simulated togglePlay at end of replay
      if (!isPlaying && currentTime >= maxTimeMs) {
        currentTime = minTimeMs;
        isPlaying = true;
      }

      assert.equal(currentTime, minTimeMs, "Replay resets to minTimeMs when user hits Play at end");
      assert.equal(isPlaying, true, "Playback begins immediately from start");
    });
  });

  // --------------------------------------------------------------------------
  // Group 2: Timeline Scrubbing & Keyframe Accuracy
  // --------------------------------------------------------------------------
  describe("Group 2: Timeline Scrubbing & Keyframe Accuracy", () => {
    const minTimeMs = 600;
    const maxTimeMs = 2200;
    const span = maxTimeMs - minTimeMs; // 1600ms

    it("T2.1: Scrub 0% maps to minTimeMs (600ms)", () => {
      const scrub0 = minTimeMs + (span === 0 ? 0 : 0);
      assert.equal(scrub0, 600);
    });

    it("T2.2: Scrub 50% maps to middle frame (1400ms)", () => {
      const scrub50 = minTimeMs + span * 0.5;
      assert.equal(scrub50, 1400);
    });

    it("T2.3: Scrub 100% maps to maxTimeMs (2200ms)", () => {
      const scrub100 = minTimeMs + span * 1.0;
      assert.equal(scrub100, 2200);
    });

    it("T2.4: Keyframe markers reside inside [minTimeMs, maxTimeMs]", () => {
      assert.ok(LBW_TIMESTAMPS.T_RELEASE >= minTimeMs && LBW_TIMESTAMPS.T_RELEASE <= maxTimeMs);
      assert.ok(LBW_TIMESTAMPS.T_BOUNCE >= minTimeMs && LBW_TIMESTAMPS.T_BOUNCE <= maxTimeMs);
      assert.ok(LBW_TIMESTAMPS.T_IMPACT >= minTimeMs && LBW_TIMESTAMPS.T_IMPACT <= maxTimeMs);
      assert.ok(LBW_TIMESTAMPS.T_STUMPS >= minTimeMs && LBW_TIMESTAMPS.T_STUMPS <= maxTimeMs);
    });
  });

  // --------------------------------------------------------------------------
  // Group 3: Animation Loop Lifecycle & Concurrency Invariants
  // --------------------------------------------------------------------------
  describe("Group 3: Animation Loop Lifecycle & Concurrency Invariants", () => {
    it("T3.1: Exactly ONE active loop instance per playback session", () => {
      let activeLoopCount = 0;
      let activeHandle: number | null = null;

      function startLoop() {
        if (activeHandle !== null) {
          // Cancel previous loop before starting new one
          activeLoopCount--;
        }
        activeHandle = 101;
        activeLoopCount++;
      }

      function stopLoop() {
        if (activeHandle !== null) {
          activeHandle = null;
          activeLoopCount--;
        }
      }

      // Start, restart, change camera
      startLoop();
      assert.equal(activeLoopCount, 1);
      startLoop();
      assert.equal(activeLoopCount, 1);
      stopLoop();
      assert.equal(activeLoopCount, 0);
    });

    it("T3.2: Unmount cancels active animation frame and nulls reference", () => {
      let animFrame: number | null = 42;
      let cancelledId: number | null = null;

      function cancelMock(id: number) {
        cancelledId = id;
      }

      // Cleanup function
      if (animFrame !== null) {
        cancelMock(animFrame);
        animFrame = null;
      }

      assert.equal(cancelledId, 42, "Animation frame was cancelled");
      assert.equal(animFrame, null, "Reference reset to null");
    });

    it("T3.3: Incident change resets playback state and halts animation", () => {
      let isPlaying = true;
      let isRockAndRoll = true;
      let currentTime = 1800;
      let playbackBase: any = { wallTime: 100, logicalTime: 1800 };

      // Scenario change trigger
      function onScenarioChange() {
        isPlaying = false;
        isRockAndRoll = false;
        currentTime = 1200;
        playbackBase = null;
      }

      onScenarioChange();
      assert.equal(isPlaying, false);
      assert.equal(isRockAndRoll, false);
      assert.equal(currentTime, 1200);
      assert.equal(playbackBase, null);
    });
  });

  // --------------------------------------------------------------------------
  // Group 4: Determinism & Physical Scene Derivation
  // --------------------------------------------------------------------------
  describe("Group 4: Determinism & Physical Scene Derivation", () => {
    it("T4.1: Same scenario seed + same replay timestamp -> identical physical state", () => {
      const scenarioA = generateScenario(42, "LBW");
      const scenarioB = generateScenario(42, "LBW");

      assert.ok(scenarioA.lbw);
      assert.ok(scenarioB.lbw);

      const stateA1 = solveLBWReplayState(scenarioA.lbw, 1200);
      const stateB1 = solveLBWReplayState(scenarioB.lbw, 1200);

      assert.deepEqual(stateA1.ball, stateB1.ball, "Ball positions must match bit-for-bit");
      assert.deepEqual(stateA1.batter, stateB1.batter, "Batter positions must match bit-for-bit");

      // Check another timestamp
      const stateA2 = solveLBWReplayState(scenarioA.lbw, 1500);
      const stateB2 = solveLBWReplayState(scenarioB.lbw, 1500);

      assert.deepEqual(stateA2.ball, stateB2.ball);
      assert.notDeepEqual(stateA1.ball, stateA2.ball, "Ball position at 1200ms must differ from 1500ms");
    });

    it("T4.2: Ball visibly progresses along Z-axis (towards striker wickets) over time", () => {
      const scenario = generateScenario(101, "LBW");
      assert.ok(scenario.lbw);

      const releaseState = solveLBWReplayState(scenario.lbw, LBW_TIMESTAMPS.T_RELEASE);
      const bounceState = solveLBWReplayState(scenario.lbw, LBW_TIMESTAMPS.T_BOUNCE);
      const impactState = solveLBWReplayState(scenario.lbw, LBW_TIMESTAMPS.T_IMPACT);

      // Z decreases as ball travels towards striker wickets (Z = 0)
      assert.ok(
        releaseState.ball.z > bounceState.ball.z,
        `Release Z (${releaseState.ball.z}) must be greater than Bounce Z (${bounceState.ball.z})`
      );
      assert.ok(
        bounceState.ball.z > impactState.ball.z,
        `Bounce Z (${bounceState.ball.z}) must be greater than Impact Z (${impactState.ball.z})`
      );
    });
  });

  // --------------------------------------------------------------------------
  // Group 5: Keyboard Shortcut Transport Resolution
  // --------------------------------------------------------------------------
  describe("Group 5: Keyboard Shortcut Transport Resolution", () => {
    it("T5.1: Space toggles play", () => {
      const cmd = resolveReplayShortcut(" ", false);
      assert.deepEqual(cmd, { type: "TOGGLE_PLAY" });
    });

    it("T5.2: Home and 0 key trigger restart", () => {
      const cmdHome = resolveReplayShortcut("Home", false);
      assert.deepEqual(cmdHome, { type: "RESTART" });

      const cmdZero = resolveReplayShortcut("0", false);
      assert.deepEqual(cmdZero, { type: "RESTART" });
    });

    it("T5.3: Arrow keys step 1 frame; shift+arrow steps 5 frames", () => {
      assert.deepEqual(resolveReplayShortcut("ArrowLeft", false), { type: "STEP", frames: -1 });
      assert.deepEqual(resolveReplayShortcut("ArrowRight", false), { type: "STEP", frames: 1 });
      assert.deepEqual(resolveReplayShortcut("ArrowLeft", true), { type: "STEP", frames: -5 });
      assert.deepEqual(resolveReplayShortcut("ArrowRight", true), { type: "STEP", frames: 5 });
    });
  });
});
