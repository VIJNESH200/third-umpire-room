/**
 * debugWorldSync.ts
 * Development-only debug helper for verifying Run-Out world-state synchronization.
 *
 * Usage from browser console:
 *   import { logWorldStateAtTime } from './engine/debugWorldSync';
 *   logWorldStateAtTime(runOutData, 1200);
 *
 * The logged world state must be IDENTICAL regardless of which camera is currently selected.
 */

import type { RunOutData } from "../types/scenario";
import { solveRunOutReplayState } from "./runOutPhysics";

export function logWorldStateAtTime(runOut: RunOutData, timeMs: number): void {
  const state = solveRunOutReplayState(runOut, timeMs);
  console.log(`[WORLD-SYNC @ ${timeMs}ms]`, {
    runner: {
      worldX: state.runner.worldX,
      worldY: state.runner.worldY,
      worldZ: state.runner.worldZ,
    },
    bat: {
      tipWorldX: state.bat.tipWorldX,
      tipWorldY: state.bat.tipWorldY,
      tipWorldZ: state.bat.tipWorldZ,
      handleWorldX: state.bat.handleWorldX,
      handleWorldY: state.bat.handleWorldY,
      handleWorldZ: state.bat.handleWorldZ,
      marginFromCreaseMm: state.bat.marginFromCreaseMm,
      isGrounded: state.bat.isGrounded,
    },
    ball: {
      worldX: state.ball.worldX,
      worldY: state.ball.worldY,
      worldZ: state.ball.worldZ,
      isInFlight: state.ball.isInFlight,
      hasHitStumps: state.ball.hasHitStumps,
    },
    keeper: {
      worldX: state.keeper.worldX,
      worldY: state.keeper.worldY,
      worldZ: state.keeper.worldZ,
      gatherProgress: state.keeper.gatherProgress,
    },
    bails: {
      intact: state.stumps.bailsIntact,
      separating: state.stumps.bailsSeparating,
      dislodged: state.stumps.bailsDislodged,
      zingLedLit: state.stumps.zingLedLit,
    },
    phase: state.phase,
    currentTimeMs: state.currentTimeMs,
  });
}

/**
 * Snapshot of canonical world state for programmatic comparison.
 */
export function getWorldStateSnapshot(runOut: RunOutData, timeMs: number) {
  const state = solveRunOutReplayState(runOut, timeMs);
  return {
    runner: { worldX: state.runner.worldX, worldY: state.runner.worldY, worldZ: state.runner.worldZ },
    bat: {
      tipWorldX: state.bat.tipWorldX, tipWorldY: state.bat.tipWorldY, tipWorldZ: state.bat.tipWorldZ,
      handleWorldX: state.bat.handleWorldX, handleWorldY: state.bat.handleWorldY, handleWorldZ: state.bat.handleWorldZ,
    },
    ball: { worldX: state.ball.worldX, worldY: state.ball.worldY, worldZ: state.ball.worldZ },
    keeper: { worldX: state.keeper.worldX, worldY: state.keeper.worldY, worldZ: state.keeper.worldZ },
    bails: { intact: state.stumps.bailsIntact, separating: state.stumps.bailsSeparating },
  };
}
