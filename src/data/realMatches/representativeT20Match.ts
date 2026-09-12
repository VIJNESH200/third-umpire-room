/**
 * src/data/realMatches/representativeT20Match.ts
 *
 * Compact, authoritative real match fixture for the Real Match Data & DRS Overlay prototype.
 * Features a representative multi-over T20 contest between Mumbai and Bengaluru
 * using fictional, surname-only rosters.
 *
 * Designed to provide realistic testing targets for DRS overrides:
 * - Delivery 1_0_1: Normal dot ball -> can be overridden to an LBW wicket.
 * - Delivery 1_1_2: Real caught-behind wicket -> can be overturned to Not Out (0 runs).
 */

import type { RealMatch } from "../../types/realMatch";

/**
 * Deep freezes an object and its descendants for runtime immutability.
 */
function deepFreeze<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    const val = (obj as Record<string, unknown>)[key];
    if (val !== null && typeof val === "object" && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  }
  return obj;
}

export const REPRESENTATIVE_T20_MATCH: RealMatch = deepFreeze({
  id: "MATCH_MUM_BLR_2026_01",
  format: "T20",
  homeTeamId: "FRAN_MUM",
  awayTeamId: "FRAN_BLR",
  venue: "Marine Drive Stadium",
  innings: [
    // ------------------------------------------------------------------------
    // INNINGS 1: MUMBAI BATTING
    // ------------------------------------------------------------------------
    {
      inningsNumber: 1,
      battingTeamId: "FRAN_MUM",
      bowlingTeamId: "FRAN_BLR",
      deliveries: [
        // Over 0: Bowled by D'Souza (FRAN_BLR_P10)
        {
          id: "1_0_1",
          innings: 1,
          over: 0,
          ball: 1,
          deliveryIndex: 0,
          striker: "Nadkarni",
          nonStriker: "Kulkarni",
          bowler: "D'Souza",
          outcome: { runsBatter: 0 },
        },
        {
          id: "1_0_2",
          innings: 1,
          over: 0,
          ball: 2,
          deliveryIndex: 1,
          striker: "Nadkarni",
          nonStriker: "Kulkarni",
          bowler: "D'Souza",
          outcome: { runsBatter: 4 },
        },
        {
          id: "1_0_3",
          innings: 1,
          over: 0,
          ball: 3,
          deliveryIndex: 2,
          striker: "Nadkarni",
          nonStriker: "Kulkarni",
          bowler: "D'Souza",
          outcome: { runsBatter: 1 },
        },
        {
          id: "1_0_4",
          innings: 1,
          over: 0,
          ball: 4,
          deliveryIndex: 3,
          striker: "Kulkarni",
          nonStriker: "Nadkarni",
          bowler: "D'Souza",
          outcome: { runsBatter: 0 },
        },
        {
          id: "1_0_5",
          innings: 1,
          over: 0,
          ball: 5,
          deliveryIndex: 4,
          striker: "Kulkarni",
          nonStriker: "Nadkarni",
          bowler: "D'Souza",
          outcome: { runsBatter: 2 },
        },
        {
          id: "1_0_6",
          innings: 1,
          over: 0,
          ball: 6,
          deliveryIndex: 5,
          striker: "Kulkarni",
          nonStriker: "Nadkarni",
          bowler: "D'Souza",
          outcome: { runsBatter: 1 },
        },

        // Over 1: Bowled by Iyengar (FRAN_BLR_P11)
        {
          id: "1_1_1",
          innings: 1,
          over: 1,
          ball: 1,
          deliveryIndex: 6,
          striker: "Nadkarni",
          nonStriker: "Kulkarni",
          bowler: "Iyengar",
          outcome: { runsBatter: 0 },
        },
        {
          id: "1_1_2",
          innings: 1,
          over: 1,
          ball: 2,
          deliveryIndex: 7,
          striker: "Nadkarni",
          nonStriker: "Kulkarni",
          bowler: "Iyengar",
          outcome: {
            runsBatter: 0,
            wicket: {
              kind: "CAUGHT",
              playerOut: "Nadkarni",
              fielders: ["Udupa"],
            },
          },
        },
        {
          id: "1_1_3",
          innings: 1,
          over: 1,
          ball: 3,
          deliveryIndex: 8,
          striker: "Deshmukh",
          nonStriker: "Kulkarni",
          bowler: "Iyengar",
          outcome: { runsBatter: 1 },
        },
        {
          id: "1_1_4",
          innings: 1,
          over: 1,
          ball: 4,
          deliveryIndex: 9,
          striker: "Kulkarni",
          nonStriker: "Deshmukh",
          bowler: "Iyengar",
          outcome: { runsBatter: 6 },
        },
        {
          id: "1_1_5",
          innings: 1,
          over: 1,
          ball: 5,
          deliveryIndex: 10,
          striker: "Kulkarni",
          nonStriker: "Deshmukh",
          bowler: "Iyengar",
          outcome: { runsBatter: 0 },
        },
        {
          id: "1_1_6",
          innings: 1,
          over: 1,
          ball: 6,
          deliveryIndex: 11,
          striker: "Kulkarni",
          nonStriker: "Deshmukh",
          bowler: "Iyengar",
          outcome: { runsBatter: 1 },
        },
      ],
    },

    // ------------------------------------------------------------------------
    // INNINGS 2: BENGALURU BATTING
    // ------------------------------------------------------------------------
    {
      inningsNumber: 2,
      battingTeamId: "FRAN_BLR",
      bowlingTeamId: "FRAN_MUM",
      deliveries: [
        // Over 0: Bowled by Khan (FRAN_MUM_P10)
        {
          id: "2_0_1",
          innings: 2,
          over: 0,
          ball: 1,
          deliveryIndex: 0,
          striker: "Nambiar",
          nonStriker: "Hegde",
          bowler: "Khan",
          outcome: { runsBatter: 1 },
        },
        {
          id: "2_0_2",
          innings: 2,
          over: 0,
          ball: 2,
          deliveryIndex: 1,
          striker: "Hegde",
          nonStriker: "Nambiar",
          bowler: "Khan",
          outcome: { runsBatter: 4 },
        },
        {
          id: "2_0_3",
          innings: 2,
          over: 0,
          ball: 3,
          deliveryIndex: 2,
          striker: "Hegde",
          nonStriker: "Nambiar",
          bowler: "Khan",
          outcome: { runsBatter: 0 },
        },
        {
          id: "2_0_4",
          innings: 2,
          over: 0,
          ball: 4,
          deliveryIndex: 3,
          striker: "Hegde",
          nonStriker: "Nambiar",
          bowler: "Khan",
          outcome: { runsBatter: 0 },
        },
        {
          id: "2_0_5",
          innings: 2,
          over: 0,
          ball: 5,
          deliveryIndex: 4,
          striker: "Hegde",
          nonStriker: "Nambiar",
          bowler: "Khan",
          outcome: { runsBatter: 2 },
        },
        {
          id: "2_0_6",
          innings: 2,
          over: 0,
          ball: 6,
          deliveryIndex: 5,
          striker: "Hegde",
          nonStriker: "Nambiar",
          bowler: "Khan",
          outcome: { runsBatter: 1 },
        },
      ],
    },
  ],
});
