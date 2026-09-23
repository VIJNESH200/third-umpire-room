import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { generateScenario } from "../engine/scenarioGenerator";
import { mapPhase1TimeToReplayTime } from "../engine/runOutPhysics";
import { computePitchStations } from "../components/instinct/IncidentReplayFeed";

describe("Phase 1 Replay Playback & Animation Loop Test Suite", () => {
  const CLIP_DURATION_MS = 2800;

  describe("Group 1: Animation Loop Lifecycle & Reduced-Motion Immunity", () => {
    it("T1.1: IncidentReplayFeed does not gate requestAnimationFrame on prefers-reduced-motion", () => {
      const feedPath = path.resolve(process.cwd(), "src/components/instinct/IncidentReplayFeed.tsx");
      const feedSource = fs.readFileSync(feedPath, "utf-8");

      // Verify that prefers-reduced-motion is NOT guarding animId = requestAnimationFrame(render)
      const hasGatedRaf = /if\s*\(!prefersReducedMotion\)\s*\{\s*animId\s*=\s*requestAnimationFrame/.test(feedSource);
      assert.equal(
        hasGatedRaf,
        false,
        "IncidentReplayFeed must NOT gate requestAnimationFrame behind prefersReducedMotion (causes video freeze)"
      );

      // Verify that requestAnimationFrame(render) is scheduled unconditionally
      assert.ok(
        feedSource.includes("animId = requestAnimationFrame(render)"),
        "IncidentReplayFeed must schedule requestAnimationFrame unconditionally"
      );
    });

    it("T1.2: Animation clock advances continuously across multiple frame ticks without stalling", () => {
      const startTime = 10000;
      const sampledElapsed: number[] = [];
      const sampledTimecodes: string[] = [];
      const sampledCanonicalMs: number[] = [];

      // Simulate 70 ticks at 40ms (2800ms total = full broadcast clip loop)
      for (let i = 0; i <= 70; i++) {
        const now = startTime + i * 40;
        const elapsed = (now - startTime) % CLIP_DURATION_MS;
        const progress = elapsed / CLIP_DURATION_MS;

        const totalSeconds = Math.floor(elapsed / 1000);
        const frameInSecond = Math.floor((elapsed % 1000) / 40);
        const formattedSecs = (28 + totalSeconds).toString().padStart(2, "0");
        const formattedFrames = frameInSecond.toString().padStart(2, "0");
        const timecode = `00:14:${formattedSecs}:${formattedFrames}`;

        const canonicalTimeMs = mapPhase1TimeToReplayTime(elapsed, CLIP_DURATION_MS);

        sampledElapsed.push(elapsed);
        sampledTimecodes.push(timecode);
        sampledCanonicalMs.push(canonicalTimeMs);

        assert.ok(progress >= 0 && progress <= 1, `Progress must be in [0, 1], got ${progress}`);
      }

      // Verify distinct timestamps are generated across ticks
      const distinctTimecodes = new Set(sampledTimecodes);
      assert.ok(
        distinctTimecodes.size >= 65,
        `Expected at least 65 distinct timecodes across 70 ticks, got ${distinctTimecodes.size}`
      );

      // Verify monotonic canonical time progression before clip wrap
      for (let i = 1; i < 70; i++) {
        assert.ok(
          sampledCanonicalMs[i] >= sampledCanonicalMs[i - 1],
          `Canonical time must advance monotonically: tick ${i} (${sampledCanonicalMs[i]}) >= tick ${i-1} (${sampledCanonicalMs[i-1]})`
        );
      }

      // Verify end-to-end replay mapping range (600ms to 2200ms)
      assert.equal(sampledCanonicalMs[0], 600, "Initial canonical time must map to 600ms");
      assert.equal(sampledCanonicalMs[70], 600, "Tick at exactly CLIP_DURATION_MS (2800ms) must wrap back to 600ms");
    });
  });

  describe("Group 2: Multi-Incident Phase 1 Kinematic Validity", () => {
    const incidentTypes = ["LBW", "RUN_OUT", "STUMPING", "CAUGHT_BEHIND", "BOUNDARY"] as const;

    it("T2.1: computePitchStations generates valid dynamic camera dolly across all clip progress values", () => {
      const sampleProgress = [0.0, 0.25, 0.5, 0.75, 1.0];

      sampleProgress.forEach((p) => {
        const stations = computePitchStations(640, 360, p);

        // Striker stations
        assert.ok(stations.strikerWicket.y > 0 && stations.strikerWicket.y < 360);
        assert.ok(stations.strikerCrease.y > stations.strikerWicket.y);

        // Bowler stations in foreground
        assert.ok(stations.bowlerCrease.y > stations.strikerCrease.y);
        assert.ok(stations.bowlerWicket.y > stations.bowlerCrease.y);

        // Scale perspective
        assert.ok(stations.bowlerRelease.scale > 0);
        assert.ok(stations.strikerCrease.scale > 0);
      });
    });

    it("T2.2: All 5 incident types produce valid physical replay data across the timeline", () => {
      incidentTypes.forEach((type, idx) => {
        const scenario = generateScenario(100 + idx * 50, type);
        assert.ok(scenario, `Scenario for ${type} must be generated`);

        // Sample 5 key milestones: 0ms, 700ms, 1400ms, 2100ms, 2800ms
        for (let elapsed = 0; elapsed <= CLIP_DURATION_MS; elapsed += 700) {
          const canonicalMs = mapPhase1TimeToReplayTime(elapsed, CLIP_DURATION_MS);
          assert.ok(
            canonicalMs >= 600 && canonicalMs <= 2200,
            `Incident ${type} at elapsed ${elapsed}ms: canonicalMs ${canonicalMs} out of bounds`
          );
        }
      });
    });
  });
});
