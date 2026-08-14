import type {
  IncidentResult,
  SessionStats,
  RankTier,
  RankInfo,
} from "../types/scenario";

export const RANK_LADDER: RankInfo[] = [
  {
    tier: "Third Umpire Trainee",
    minScore: 0,
    maxScore: 40,
    badgeColor: "#94A3B8",
    cardTheme: "bronze",
    description: "Learning the review console controls. Needs deeper calibration on Umpire's Call margins and audio spike filtering.",
  },
  {
    tier: "Club Level Official",
    minScore: 41,
    maxScore: 60,
    badgeColor: "#38BDF8",
    cardTheme: "silver",
    description: "Reliable on obvious dismissals. Occasionally swayed by crowd appeals on marginal line decisions.",
  },
  {
    tier: "TV Umpire",
    minScore: 61,
    maxScore: 75,
    badgeColor: "#F59E0B",
    cardTheme: "gold",
    description: "Solid broadcast reviewer. Understands DRS gate sequences and frame-step synchronization.",
  },
  {
    tier: "ICC Panel Umpire",
    minScore: 76,
    maxScore: 88,
    badgeColor: "#A855F7",
    cardTheme: "elite",
    description: "World-class decision maker. Decisive under time pressure with excellent instinct and hawk-like precision.",
  },
  {
    tier: "ICC Elite Panel",
    minScore: 89,
    maxScore: 100,
    badgeColor: "#00E5FF",
    cardTheme: "diamond",
    description: "Master of the Review Room. Flawless interpretation of DRS laws, lightning reaction times, and zero howlers conceded.",
  },
];

export function getRankInfo(rating: number): RankInfo {
  const rounded = Math.round(Math.max(0, Math.min(100, rating)));
  for (const rank of RANK_LADDER) {
    if (rounded >= rank.minScore && rounded <= rank.maxScore) {
      return rank;
    }
  }
  return RANK_LADDER[0];
}

/**
 * Computes aggregate session statistics from all completed incident results.
 */
export function computeSessionStats(history: IncidentResult[]): SessionStats {
  if (history.length === 0) {
    return {
      totalIncidents: 0,
      softSignalInstinct: 0,
      reviewPrecision: 0,
      umpiresCallIQ: 0,
      reactionTimeSeconds: 0,
      reactionTimeScore: 0,
      consistency: 0,
      howlerDetection: 0,
      overallRating: 0,
      rankTier: "Third Umpire Trainee",
      longestStreak: 0,
      qualifyingUCIIncidents: 0,
      history: [],
    };
  }

  const total = history.length;

  // 1. Soft Signal Instinct: % matching correct verdict
  const softSignalEvaluated = history.filter(
    (h) => h.softSignal !== null && h.softSignal !== "SEND_UPSTAIRS"
  );
  const softCorrect = softSignalEvaluated.filter((h) => h.softSignalCorrect).length;
  const softSignalInstinct =
    softSignalEvaluated.length > 0
      ? Math.round((softCorrect / softSignalEvaluated.length) * 100)
      : 50;

  // 2. Review Precision: % final verdicts correct
  const correctVerdicts = history.filter((h) => h.finalVerdictCorrect).length;
  const reviewPrecision = Math.round((correctVerdicts / total) * 100);

  // 3. Umpire's Call IQ (UCI): strictly evaluated on qualifying LBW Umpire's Call & HOWLER scenarios
  const qualifyingUCI = history.filter(
    (h) => (h.incidentType === "LBW" && h.isUmpiresCallScenario) || h.difficultyTier === "HOWLER"
  );
  const ucComplied = qualifyingUCI.filter((h) => h.umpiresCallComplied).length;
  const umpiresCallIQ =
    qualifyingUCI.length > 0
      ? Math.round((ucComplied / qualifyingUCI.length) * 100)
      : 100; // If no qualifying incidents occurred, default to 100%

  // 4. Reaction Time & Score
  const validReactionTimes = history.map((h) => h.softSignalTimeMs / 1000);
  const avgReactionTimeSeconds =
    validReactionTimes.reduce((a, b) => a + b, 0) / total;

  const instinctFactor = softSignalInstinct / 100;
  const rawSpeedScore = Math.max(0, Math.min(100, 100 - (avgReactionTimeSeconds / 10) * 50));
  const reactionTimeScore = Math.round(rawSpeedScore * (0.5 + 0.5 * instinctFactor));

  // 5. Longest correct streak & Consistency
  let longestStreak = 0;
  let currentStreak = 0;
  for (const h of history) {
    if (h.finalVerdictCorrect) {
      currentStreak++;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }
  }
  const consistency = Math.round(
    Math.min(100, (longestStreak / total) * 70 + (correctVerdicts / total) * 30)
  );

  // 6. Howler Detection: % of howlers correctly caught & overturned
  const howlers = history.filter((h) => h.difficultyTier === "HOWLER");
  const howlersCaught = howlers.filter((h) => h.finalVerdictCorrect).length;
  const howlerDetection =
    howlers.length > 0 ? Math.round((howlersCaught / howlers.length) * 100) : 100;

  // 7. Overall Weighted Rating (OVR)
  // 30% Review Precision, 25% Umpire's Call IQ, 20% Soft Signal Instinct, 15% Reaction Time, 10% Consistency
  const rawOVR =
    reviewPrecision * 0.30 +
    umpiresCallIQ * 0.25 +
    softSignalInstinct * 0.20 +
    reactionTimeScore * 0.15 +
    consistency * 0.10;

  const overallRating = Math.round(Math.max(10, Math.min(99, rawOVR)));
  const rankInfo = getRankInfo(overallRating);

  return {
    totalIncidents: total,
    softSignalInstinct,
    reviewPrecision,
    umpiresCallIQ,
    reactionTimeSeconds: parseFloat(avgReactionTimeSeconds.toFixed(2)),
    reactionTimeScore,
    consistency,
    howlerDetection,
    overallRating,
    rankTier: rankInfo.tier,
    longestStreak,
    qualifyingUCIIncidents: qualifyingUCI.length,
    history,
  };
}
