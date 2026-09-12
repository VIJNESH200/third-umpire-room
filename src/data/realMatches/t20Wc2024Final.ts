/**
 * src/data/realMatches/t20Wc2024Final.ts
 *
 * Official ball-by-ball delivery record for the 2024 ICC Men's T20 World Cup Final:
 * - Date: June 29, 2024
 * - Venue: Kensington Oval, Bridgetown, Barbados
 * - Teams: India (IND) vs South Africa (SA)
 * - Result: India won by 7 runs
 * - Innings 1 (India): 176/7 in 20.0 overs (127 deliveries)
 * - Innings 2 (South Africa): 169/8 in 20.0 overs (124 deliveries)
 *
 * Canonical baseline dataset: deeply frozen at runtime.
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

export const T20_WC_2024_FINAL: RealMatch = deepFreeze({
  id: "MATCH_T20_WC_2024_FINAL",
  format: "T20",
  homeTeamId: "IND",
  awayTeamId: "SA",
  venue: "Kensington Oval, Bridgetown, Barbados",
  innings: [
  {
    "inningsNumber": 1,
    "battingTeamId": "IND",
    "bowlingTeamId": "SA",
    "deliveries": [
      {
        "id": "1_0_1",
        "innings": 1,
        "over": 0,
        "ball": 1,
        "deliveryIndex": 0,
        "striker": "RG Sharma",
        "nonStriker": "V Kohli",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_0_2",
        "innings": 1,
        "over": 0,
        "ball": 2,
        "deliveryIndex": 1,
        "striker": "V Kohli",
        "nonStriker": "RG Sharma",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_0_3",
        "innings": 1,
        "over": 0,
        "ball": 3,
        "deliveryIndex": 2,
        "striker": "V Kohli",
        "nonStriker": "RG Sharma",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_0_4",
        "innings": 1,
        "over": 0,
        "ball": 4,
        "deliveryIndex": 3,
        "striker": "V Kohli",
        "nonStriker": "RG Sharma",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_0_5",
        "innings": 1,
        "over": 0,
        "ball": 5,
        "deliveryIndex": 4,
        "striker": "V Kohli",
        "nonStriker": "RG Sharma",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_0_6",
        "innings": 1,
        "over": 0,
        "ball": 6,
        "deliveryIndex": 5,
        "striker": "V Kohli",
        "nonStriker": "RG Sharma",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_1_1",
        "innings": 1,
        "over": 1,
        "ball": 1,
        "deliveryIndex": 6,
        "striker": "RG Sharma",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_1_2",
        "innings": 1,
        "over": 1,
        "ball": 2,
        "deliveryIndex": 7,
        "striker": "RG Sharma",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_1_3",
        "innings": 1,
        "over": 1,
        "ball": 3,
        "deliveryIndex": 8,
        "striker": "RG Sharma",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_1_4",
        "innings": 1,
        "over": 1,
        "ball": 4,
        "deliveryIndex": 9,
        "striker": "RG Sharma",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "RG Sharma",
            "fielders": [
              "H Klaasen"
            ]
          }
        }
      },
      {
        "id": "1_1_5",
        "innings": 1,
        "over": 1,
        "ball": 5,
        "deliveryIndex": 10,
        "striker": "RR Pant",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_1_6",
        "innings": 1,
        "over": 1,
        "ball": 6,
        "deliveryIndex": 11,
        "striker": "RR Pant",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "RR Pant",
            "fielders": [
              "Q de Kock"
            ]
          }
        }
      },
      {
        "id": "1_2_1",
        "innings": 1,
        "over": 2,
        "ball": 1,
        "deliveryIndex": 12,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_2_2",
        "innings": 1,
        "over": 2,
        "ball": 2,
        "deliveryIndex": 13,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_2_3",
        "innings": 1,
        "over": 2,
        "ball": 3,
        "deliveryIndex": 14,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_2_4",
        "innings": 1,
        "over": 2,
        "ball": 4,
        "deliveryIndex": 15,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_2_5",
        "innings": 1,
        "over": 2,
        "ball": 5,
        "deliveryIndex": 16,
        "striker": "SA Yadav",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_2_6",
        "innings": 1,
        "over": 2,
        "ball": 6,
        "deliveryIndex": 17,
        "striker": "SA Yadav",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_3_1",
        "innings": 1,
        "over": 3,
        "ball": 1,
        "deliveryIndex": 18,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_3_2",
        "innings": 1,
        "over": 3,
        "ball": 2,
        "deliveryIndex": 19,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_3_3",
        "innings": 1,
        "over": 3,
        "ball": 3,
        "deliveryIndex": 20,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_3_4",
        "innings": 1,
        "over": 3,
        "ball": 4,
        "deliveryIndex": 21,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_3_5",
        "innings": 1,
        "over": 3,
        "ball": 5,
        "deliveryIndex": 22,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_3_6",
        "innings": 1,
        "over": 3,
        "ball": 6,
        "deliveryIndex": 23,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_4_1",
        "innings": 1,
        "over": 4,
        "ball": 1,
        "deliveryIndex": 24,
        "striker": "SA Yadav",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_4_2",
        "innings": 1,
        "over": 4,
        "ball": 2,
        "deliveryIndex": 25,
        "striker": "V Kohli",
        "nonStriker": "SA Yadav",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_4_3",
        "innings": 1,
        "over": 4,
        "ball": 3,
        "deliveryIndex": 26,
        "striker": "SA Yadav",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "SA Yadav",
            "fielders": [
              "H Klaasen"
            ]
          }
        }
      },
      {
        "id": "1_4_4",
        "innings": 1,
        "over": 4,
        "ball": 4,
        "deliveryIndex": 27,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_4_5",
        "innings": 1,
        "over": 4,
        "ball": 5,
        "deliveryIndex": 28,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_4_6",
        "innings": 1,
        "over": 4,
        "ball": 6,
        "deliveryIndex": 29,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_5_1",
        "innings": 1,
        "over": 5,
        "ball": 1,
        "deliveryIndex": 30,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_5_2",
        "innings": 1,
        "over": 5,
        "ball": 2,
        "deliveryIndex": 31,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_5_3",
        "innings": 1,
        "over": 5,
        "ball": 3,
        "deliveryIndex": 32,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_5_4",
        "innings": 1,
        "over": 5,
        "ball": 4,
        "deliveryIndex": 33,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_5_5",
        "innings": 1,
        "over": 5,
        "ball": 5,
        "deliveryIndex": 34,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_5_6",
        "innings": 1,
        "over": 5,
        "ball": 6,
        "deliveryIndex": 35,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_6_1",
        "innings": 1,
        "over": 6,
        "ball": 1,
        "deliveryIndex": 36,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_6_2",
        "innings": 1,
        "over": 6,
        "ball": 2,
        "deliveryIndex": 37,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_6_3",
        "innings": 1,
        "over": 6,
        "ball": 3,
        "deliveryIndex": 38,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_6_4",
        "innings": 1,
        "over": 6,
        "ball": 4,
        "deliveryIndex": 39,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_6_5",
        "innings": 1,
        "over": 6,
        "ball": 5,
        "deliveryIndex": 40,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_6_6",
        "innings": 1,
        "over": 6,
        "ball": 6,
        "deliveryIndex": 41,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_7_1",
        "innings": 1,
        "over": 7,
        "ball": 1,
        "deliveryIndex": 42,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_7_2",
        "innings": 1,
        "over": 7,
        "ball": 2,
        "deliveryIndex": 43,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_7_3",
        "innings": 1,
        "over": 7,
        "ball": 3,
        "deliveryIndex": 44,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "1_7_4",
        "innings": 1,
        "over": 7,
        "ball": 4,
        "deliveryIndex": 45,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_7_5",
        "innings": 1,
        "over": 7,
        "ball": 5,
        "deliveryIndex": 46,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_7_6",
        "innings": 1,
        "over": 7,
        "ball": 6,
        "deliveryIndex": 47,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "AK Markram",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_8_1",
        "innings": 1,
        "over": 8,
        "ball": 1,
        "deliveryIndex": 48,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_8_2",
        "innings": 1,
        "over": 8,
        "ball": 2,
        "deliveryIndex": 49,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_8_3",
        "innings": 1,
        "over": 8,
        "ball": 3,
        "deliveryIndex": 50,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_8_4",
        "innings": 1,
        "over": 8,
        "ball": 4,
        "deliveryIndex": 51,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "1_8_5",
        "innings": 1,
        "over": 8,
        "ball": 5,
        "deliveryIndex": 52,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_8_6",
        "innings": 1,
        "over": 8,
        "ball": 6,
        "deliveryIndex": 53,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "KA Maharaj",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_9_1",
        "innings": 1,
        "over": 9,
        "ball": 1,
        "deliveryIndex": 54,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "1_9_2",
        "innings": 1,
        "over": 9,
        "ball": 2,
        "deliveryIndex": 55,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_9_3",
        "innings": 1,
        "over": 9,
        "ball": 3,
        "deliveryIndex": 56,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_9_4",
        "innings": 1,
        "over": 9,
        "ball": 4,
        "deliveryIndex": 57,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_9_5",
        "innings": 1,
        "over": 9,
        "ball": 5,
        "deliveryIndex": 58,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_9_6",
        "innings": 1,
        "over": 9,
        "ball": 6,
        "deliveryIndex": 59,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_9_7",
        "innings": 1,
        "over": 9,
        "ball": 7,
        "deliveryIndex": 60,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_10_1",
        "innings": 1,
        "over": 10,
        "ball": 1,
        "deliveryIndex": 61,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_10_2",
        "innings": 1,
        "over": 10,
        "ball": 2,
        "deliveryIndex": 62,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_10_3",
        "innings": 1,
        "over": 10,
        "ball": 3,
        "deliveryIndex": 63,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_10_4",
        "innings": 1,
        "over": 10,
        "ball": 4,
        "deliveryIndex": 64,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_10_5",
        "innings": 1,
        "over": 10,
        "ball": 5,
        "deliveryIndex": 65,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_10_6",
        "innings": 1,
        "over": 10,
        "ball": 6,
        "deliveryIndex": 66,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "1_10_7",
        "innings": 1,
        "over": 10,
        "ball": 7,
        "deliveryIndex": 67,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_11_1",
        "innings": 1,
        "over": 11,
        "ball": 1,
        "deliveryIndex": 68,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_11_2",
        "innings": 1,
        "over": 11,
        "ball": 2,
        "deliveryIndex": 69,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_11_3",
        "innings": 1,
        "over": 11,
        "ball": 3,
        "deliveryIndex": 70,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_11_4",
        "innings": 1,
        "over": 11,
        "ball": 4,
        "deliveryIndex": 71,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_11_5",
        "innings": 1,
        "over": 11,
        "ball": 5,
        "deliveryIndex": 72,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "1_11_6",
        "innings": 1,
        "over": 11,
        "ball": 6,
        "deliveryIndex": 73,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_12_1",
        "innings": 1,
        "over": 12,
        "ball": 1,
        "deliveryIndex": 74,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_12_2",
        "innings": 1,
        "over": 12,
        "ball": 2,
        "deliveryIndex": 75,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_12_3",
        "innings": 1,
        "over": 12,
        "ball": 3,
        "deliveryIndex": 76,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_12_4",
        "innings": 1,
        "over": 12,
        "ball": 4,
        "deliveryIndex": 77,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_12_5",
        "innings": 1,
        "over": 12,
        "ball": 5,
        "deliveryIndex": 78,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "1_12_6",
        "innings": 1,
        "over": 12,
        "ball": 6,
        "deliveryIndex": 79,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_12_7",
        "innings": 1,
        "over": 12,
        "ball": 7,
        "deliveryIndex": 80,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_13_1",
        "innings": 1,
        "over": 13,
        "ball": 1,
        "deliveryIndex": 81,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "1_13_2",
        "innings": 1,
        "over": 13,
        "ball": 2,
        "deliveryIndex": 82,
        "striker": "AR Patel",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_13_3",
        "innings": 1,
        "over": 13,
        "ball": 3,
        "deliveryIndex": 83,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "1_13_4",
        "innings": 1,
        "over": 13,
        "ball": 4,
        "deliveryIndex": 84,
        "striker": "V Kohli",
        "nonStriker": "AR Patel",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "RUN_OUT",
            "playerOut": "AR Patel",
            "fielders": [
              "Q de Kock"
            ]
          }
        }
      },
      {
        "id": "1_13_5",
        "innings": 1,
        "over": 13,
        "ball": 5,
        "deliveryIndex": 85,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_13_6",
        "innings": 1,
        "over": 13,
        "ball": 6,
        "deliveryIndex": 86,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_13_7",
        "innings": 1,
        "over": 13,
        "ball": 7,
        "deliveryIndex": 87,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_14_1",
        "innings": 1,
        "over": 14,
        "ball": 1,
        "deliveryIndex": 88,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "1_14_2",
        "innings": 1,
        "over": 14,
        "ball": 2,
        "deliveryIndex": 89,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_14_3",
        "innings": 1,
        "over": 14,
        "ball": 3,
        "deliveryIndex": 90,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_14_4",
        "innings": 1,
        "over": 14,
        "ball": 4,
        "deliveryIndex": 91,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_14_5",
        "innings": 1,
        "over": 14,
        "ball": 5,
        "deliveryIndex": 92,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_14_6",
        "innings": 1,
        "over": 14,
        "ball": 6,
        "deliveryIndex": 93,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_15_1",
        "innings": 1,
        "over": 15,
        "ball": 1,
        "deliveryIndex": 94,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_15_2",
        "innings": 1,
        "over": 15,
        "ball": 2,
        "deliveryIndex": 95,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_15_3",
        "innings": 1,
        "over": 15,
        "ball": 3,
        "deliveryIndex": 96,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_15_4",
        "innings": 1,
        "over": 15,
        "ball": 4,
        "deliveryIndex": 97,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_15_5",
        "innings": 1,
        "over": 15,
        "ball": 5,
        "deliveryIndex": 98,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_15_6",
        "innings": 1,
        "over": 15,
        "ball": 6,
        "deliveryIndex": 99,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "T Shamsi",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_16_1",
        "innings": 1,
        "over": 16,
        "ball": 1,
        "deliveryIndex": 100,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_16_2",
        "innings": 1,
        "over": 16,
        "ball": 2,
        "deliveryIndex": 101,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_16_3",
        "innings": 1,
        "over": 16,
        "ball": 3,
        "deliveryIndex": 102,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_16_4",
        "innings": 1,
        "over": 16,
        "ball": 4,
        "deliveryIndex": 103,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_16_5",
        "innings": 1,
        "over": 16,
        "ball": 5,
        "deliveryIndex": 104,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_16_6",
        "innings": 1,
        "over": 16,
        "ball": 6,
        "deliveryIndex": 105,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_17_1",
        "innings": 1,
        "over": 17,
        "ball": 1,
        "deliveryIndex": 106,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "1_17_2",
        "innings": 1,
        "over": 17,
        "ball": 2,
        "deliveryIndex": 107,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_17_3",
        "innings": 1,
        "over": 17,
        "ball": 3,
        "deliveryIndex": 108,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_17_4",
        "innings": 1,
        "over": 17,
        "ball": 4,
        "deliveryIndex": 109,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_17_5",
        "innings": 1,
        "over": 17,
        "ball": 5,
        "deliveryIndex": 110,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "1_17_6",
        "innings": 1,
        "over": 17,
        "ball": 6,
        "deliveryIndex": 111,
        "striker": "S Dube",
        "nonStriker": "V Kohli",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_17_7",
        "innings": 1,
        "over": 17,
        "ball": 7,
        "deliveryIndex": 112,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "K Rabada",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_18_1",
        "innings": 1,
        "over": 18,
        "ball": 1,
        "deliveryIndex": 113,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "NO_BALLS",
            "runs": 1
          }
        }
      },
      {
        "id": "1_18_2",
        "innings": 1,
        "over": 18,
        "ball": 2,
        "deliveryIndex": 114,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "1_18_3",
        "innings": 1,
        "over": 18,
        "ball": 3,
        "deliveryIndex": 115,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_18_4",
        "innings": 1,
        "over": 18,
        "ball": 4,
        "deliveryIndex": 116,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_18_5",
        "innings": 1,
        "over": 18,
        "ball": 5,
        "deliveryIndex": 117,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "1_18_6",
        "innings": 1,
        "over": 18,
        "ball": 6,
        "deliveryIndex": 118,
        "striker": "V Kohli",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "V Kohli",
            "fielders": [
              "K Rabada"
            ]
          }
        }
      },
      {
        "id": "1_18_7",
        "innings": 1,
        "over": 18,
        "ball": 7,
        "deliveryIndex": 119,
        "striker": "HH Pandya",
        "nonStriker": "S Dube",
        "bowler": "M Jansen",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_19_1",
        "innings": 1,
        "over": 19,
        "ball": 1,
        "deliveryIndex": 120,
        "striker": "S Dube",
        "nonStriker": "HH Pandya",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "1_19_2",
        "innings": 1,
        "over": 19,
        "ball": 2,
        "deliveryIndex": 121,
        "striker": "S Dube",
        "nonStriker": "HH Pandya",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_19_3",
        "innings": 1,
        "over": 19,
        "ball": 3,
        "deliveryIndex": 122,
        "striker": "HH Pandya",
        "nonStriker": "S Dube",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "1_19_4",
        "innings": 1,
        "over": 19,
        "ball": 4,
        "deliveryIndex": 123,
        "striker": "S Dube",
        "nonStriker": "HH Pandya",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "1_19_5",
        "innings": 1,
        "over": 19,
        "ball": 5,
        "deliveryIndex": 124,
        "striker": "S Dube",
        "nonStriker": "HH Pandya",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "S Dube",
            "fielders": [
              "DA Miller"
            ]
          }
        }
      },
      {
        "id": "1_19_6",
        "innings": 1,
        "over": 19,
        "ball": 6,
        "deliveryIndex": 125,
        "striker": "RA Jadeja",
        "nonStriker": "HH Pandya",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "1_19_7",
        "innings": 1,
        "over": 19,
        "ball": 7,
        "deliveryIndex": 126,
        "striker": "RA Jadeja",
        "nonStriker": "HH Pandya",
        "bowler": "A Nortje",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "RA Jadeja",
            "fielders": [
              "KA Maharaj"
            ]
          }
        }
      }
    ]
  },
  {
    "inningsNumber": 2,
    "battingTeamId": "SA",
    "bowlingTeamId": "IND",
    "deliveries": [
      {
        "id": "2_0_1",
        "innings": 2,
        "over": 0,
        "ball": 1,
        "deliveryIndex": 0,
        "striker": "RR Hendricks",
        "nonStriker": "Q de Kock",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_0_2",
        "innings": 2,
        "over": 0,
        "ball": 2,
        "deliveryIndex": 1,
        "striker": "RR Hendricks",
        "nonStriker": "Q de Kock",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_0_3",
        "innings": 2,
        "over": 0,
        "ball": 3,
        "deliveryIndex": 2,
        "striker": "RR Hendricks",
        "nonStriker": "Q de Kock",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "LEGBYES",
            "runs": 1
          }
        }
      },
      {
        "id": "2_0_4",
        "innings": 2,
        "over": 0,
        "ball": 4,
        "deliveryIndex": 3,
        "striker": "Q de Kock",
        "nonStriker": "RR Hendricks",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_0_5",
        "innings": 2,
        "over": 0,
        "ball": 5,
        "deliveryIndex": 4,
        "striker": "Q de Kock",
        "nonStriker": "RR Hendricks",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_0_6",
        "innings": 2,
        "over": 0,
        "ball": 6,
        "deliveryIndex": 5,
        "striker": "RR Hendricks",
        "nonStriker": "Q de Kock",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_1_1",
        "innings": 2,
        "over": 1,
        "ball": 1,
        "deliveryIndex": 6,
        "striker": "Q de Kock",
        "nonStriker": "RR Hendricks",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_1_2",
        "innings": 2,
        "over": 1,
        "ball": 2,
        "deliveryIndex": 7,
        "striker": "Q de Kock",
        "nonStriker": "RR Hendricks",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "LEGBYES",
            "runs": 1
          }
        }
      },
      {
        "id": "2_1_3",
        "innings": 2,
        "over": 1,
        "ball": 3,
        "deliveryIndex": 8,
        "striker": "RR Hendricks",
        "nonStriker": "Q de Kock",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "BOWLED",
            "playerOut": "RR Hendricks"
          }
        }
      },
      {
        "id": "2_1_4",
        "innings": 2,
        "over": 1,
        "ball": 4,
        "deliveryIndex": 9,
        "striker": "AK Markram",
        "nonStriker": "Q de Kock",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_1_5",
        "innings": 2,
        "over": 1,
        "ball": 5,
        "deliveryIndex": 10,
        "striker": "AK Markram",
        "nonStriker": "Q de Kock",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_1_6",
        "innings": 2,
        "over": 1,
        "ball": 6,
        "deliveryIndex": 11,
        "striker": "AK Markram",
        "nonStriker": "Q de Kock",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_2_1",
        "innings": 2,
        "over": 2,
        "ball": 1,
        "deliveryIndex": 12,
        "striker": "Q de Kock",
        "nonStriker": "AK Markram",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_2_2",
        "innings": 2,
        "over": 2,
        "ball": 2,
        "deliveryIndex": 13,
        "striker": "AK Markram",
        "nonStriker": "Q de Kock",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_2_3",
        "innings": 2,
        "over": 2,
        "ball": 3,
        "deliveryIndex": 14,
        "striker": "AK Markram",
        "nonStriker": "Q de Kock",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "AK Markram",
            "fielders": [
              "RR Pant"
            ]
          }
        }
      },
      {
        "id": "2_2_4",
        "innings": 2,
        "over": 2,
        "ball": 4,
        "deliveryIndex": 15,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_2_5",
        "innings": 2,
        "over": 2,
        "ball": 5,
        "deliveryIndex": 16,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_2_6",
        "innings": 2,
        "over": 2,
        "ball": 6,
        "deliveryIndex": 17,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_3_1",
        "innings": 2,
        "over": 3,
        "ball": 1,
        "deliveryIndex": 18,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_3_2",
        "innings": 2,
        "over": 3,
        "ball": 2,
        "deliveryIndex": 19,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_3_3",
        "innings": 2,
        "over": 3,
        "ball": 3,
        "deliveryIndex": 20,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_3_4",
        "innings": 2,
        "over": 3,
        "ball": 4,
        "deliveryIndex": 21,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_3_5",
        "innings": 2,
        "over": 3,
        "ball": 5,
        "deliveryIndex": 22,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_3_6",
        "innings": 2,
        "over": 3,
        "ball": 6,
        "deliveryIndex": 23,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_4_1",
        "innings": 2,
        "over": 4,
        "ball": 1,
        "deliveryIndex": 24,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_4_2",
        "innings": 2,
        "over": 4,
        "ball": 2,
        "deliveryIndex": 25,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_4_3",
        "innings": 2,
        "over": 4,
        "ball": 3,
        "deliveryIndex": 26,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_4_4",
        "innings": 2,
        "over": 4,
        "ball": 4,
        "deliveryIndex": 27,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_4_5",
        "innings": 2,
        "over": 4,
        "ball": 5,
        "deliveryIndex": 28,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_4_6",
        "innings": 2,
        "over": 4,
        "ball": 6,
        "deliveryIndex": 29,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_5_1",
        "innings": 2,
        "over": 5,
        "ball": 1,
        "deliveryIndex": 30,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_5_2",
        "innings": 2,
        "over": 5,
        "ball": 2,
        "deliveryIndex": 31,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_5_3",
        "innings": 2,
        "over": 5,
        "ball": 3,
        "deliveryIndex": 32,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_5_4",
        "innings": 2,
        "over": 5,
        "ball": 4,
        "deliveryIndex": 33,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_5_5",
        "innings": 2,
        "over": 5,
        "ball": 5,
        "deliveryIndex": 34,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_5_6",
        "innings": 2,
        "over": 5,
        "ball": 6,
        "deliveryIndex": 35,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_6_1",
        "innings": 2,
        "over": 6,
        "ball": 1,
        "deliveryIndex": 36,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_6_2",
        "innings": 2,
        "over": 6,
        "ball": 2,
        "deliveryIndex": 37,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_6_3",
        "innings": 2,
        "over": 6,
        "ball": 3,
        "deliveryIndex": 38,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_6_4",
        "innings": 2,
        "over": 6,
        "ball": 4,
        "deliveryIndex": 39,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_6_5",
        "innings": 2,
        "over": 6,
        "ball": 5,
        "deliveryIndex": 40,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_6_6",
        "innings": 2,
        "over": 6,
        "ball": 6,
        "deliveryIndex": 41,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_7_1",
        "innings": 2,
        "over": 7,
        "ball": 1,
        "deliveryIndex": 42,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_7_2",
        "innings": 2,
        "over": 7,
        "ball": 2,
        "deliveryIndex": 43,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_7_3",
        "innings": 2,
        "over": 7,
        "ball": 3,
        "deliveryIndex": 44,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_7_4",
        "innings": 2,
        "over": 7,
        "ball": 4,
        "deliveryIndex": 45,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_7_5",
        "innings": 2,
        "over": 7,
        "ball": 5,
        "deliveryIndex": 46,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_7_6",
        "innings": 2,
        "over": 7,
        "ball": 6,
        "deliveryIndex": 47,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "2_8_1",
        "innings": 2,
        "over": 8,
        "ball": 1,
        "deliveryIndex": 48,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "2_8_2",
        "innings": 2,
        "over": 8,
        "ball": 2,
        "deliveryIndex": 49,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_8_3",
        "innings": 2,
        "over": 8,
        "ball": 3,
        "deliveryIndex": 50,
        "striker": "Q de Kock",
        "nonStriker": "T Stubbs",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_8_4",
        "innings": 2,
        "over": 8,
        "ball": 4,
        "deliveryIndex": 51,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_8_5",
        "innings": 2,
        "over": 8,
        "ball": 5,
        "deliveryIndex": 52,
        "striker": "T Stubbs",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "BOWLED",
            "playerOut": "T Stubbs"
          }
        }
      },
      {
        "id": "2_8_6",
        "innings": 2,
        "over": 8,
        "ball": 6,
        "deliveryIndex": 53,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "LEGBYES",
            "runs": 1
          }
        }
      },
      {
        "id": "2_9_1",
        "innings": 2,
        "over": 9,
        "ball": 1,
        "deliveryIndex": 54,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_9_2",
        "innings": 2,
        "over": 9,
        "ball": 2,
        "deliveryIndex": 55,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_9_3",
        "innings": 2,
        "over": 9,
        "ball": 3,
        "deliveryIndex": 56,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_9_4",
        "innings": 2,
        "over": 9,
        "ball": 4,
        "deliveryIndex": 57,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "2_9_5",
        "innings": 2,
        "over": 9,
        "ball": 5,
        "deliveryIndex": 58,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 1,
          "runsExtras": 1,
          "extras": {
            "type": "NO_BALLS",
            "runs": 1
          }
        }
      },
      {
        "id": "2_9_6",
        "innings": 2,
        "over": 9,
        "ball": 6,
        "deliveryIndex": 59,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_9_7",
        "innings": 2,
        "over": 9,
        "ball": 7,
        "deliveryIndex": 60,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_10_1",
        "innings": 2,
        "over": 10,
        "ball": 1,
        "deliveryIndex": 61,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "RA Jadeja",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_10_2",
        "innings": 2,
        "over": 10,
        "ball": 2,
        "deliveryIndex": 62,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "RA Jadeja",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_10_3",
        "innings": 2,
        "over": 10,
        "ball": 3,
        "deliveryIndex": 63,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "RA Jadeja",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "2_10_4",
        "innings": 2,
        "over": 10,
        "ball": 4,
        "deliveryIndex": 64,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "RA Jadeja",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_10_5",
        "innings": 2,
        "over": 10,
        "ball": 5,
        "deliveryIndex": 65,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "RA Jadeja",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_10_6",
        "innings": 2,
        "over": 10,
        "ball": 6,
        "deliveryIndex": 66,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "RA Jadeja",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_11_1",
        "innings": 2,
        "over": 11,
        "ball": 1,
        "deliveryIndex": 67,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_11_2",
        "innings": 2,
        "over": 11,
        "ball": 2,
        "deliveryIndex": 68,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_11_3",
        "innings": 2,
        "over": 11,
        "ball": 3,
        "deliveryIndex": 69,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "2_11_4",
        "innings": 2,
        "over": 11,
        "ball": 4,
        "deliveryIndex": 70,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_11_5",
        "innings": 2,
        "over": 11,
        "ball": 5,
        "deliveryIndex": 71,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_11_6",
        "innings": 2,
        "over": 11,
        "ball": 6,
        "deliveryIndex": 72,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_12_1",
        "innings": 2,
        "over": 12,
        "ball": 1,
        "deliveryIndex": 73,
        "striker": "H Klaasen",
        "nonStriker": "Q de Kock",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_12_2",
        "innings": 2,
        "over": 12,
        "ball": 2,
        "deliveryIndex": 74,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_12_3",
        "innings": 2,
        "over": 12,
        "ball": 3,
        "deliveryIndex": 75,
        "striker": "Q de Kock",
        "nonStriker": "H Klaasen",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "Q de Kock",
            "fielders": [
              "Kuldeep Yadav"
            ]
          }
        }
      },
      {
        "id": "2_12_4",
        "innings": 2,
        "over": 12,
        "ball": 4,
        "deliveryIndex": 76,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_12_5",
        "innings": 2,
        "over": 12,
        "ball": 5,
        "deliveryIndex": 77,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_12_6",
        "innings": 2,
        "over": 12,
        "ball": 6,
        "deliveryIndex": 78,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_13_1",
        "innings": 2,
        "over": 13,
        "ball": 1,
        "deliveryIndex": 79,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_13_2",
        "innings": 2,
        "over": 13,
        "ball": 2,
        "deliveryIndex": 80,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_13_3",
        "innings": 2,
        "over": 13,
        "ball": 3,
        "deliveryIndex": 81,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_13_4",
        "innings": 2,
        "over": 13,
        "ball": 4,
        "deliveryIndex": 82,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_13_5",
        "innings": 2,
        "over": 13,
        "ball": 5,
        "deliveryIndex": 83,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_13_6",
        "innings": 2,
        "over": 13,
        "ball": 6,
        "deliveryIndex": 84,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "Kuldeep Yadav",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "2_14_1",
        "innings": 2,
        "over": 14,
        "ball": 1,
        "deliveryIndex": 85,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_14_2",
        "innings": 2,
        "over": 14,
        "ball": 2,
        "deliveryIndex": 86,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "2_14_3",
        "innings": 2,
        "over": 14,
        "ball": 3,
        "deliveryIndex": 87,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "2_14_4",
        "innings": 2,
        "over": 14,
        "ball": 4,
        "deliveryIndex": 88,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_14_5",
        "innings": 2,
        "over": 14,
        "ball": 5,
        "deliveryIndex": 89,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "2_14_6",
        "innings": 2,
        "over": 14,
        "ball": 6,
        "deliveryIndex": 90,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 6
        }
      },
      {
        "id": "2_14_7",
        "innings": 2,
        "over": 14,
        "ball": 7,
        "deliveryIndex": 91,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_14_8",
        "innings": 2,
        "over": 14,
        "ball": 8,
        "deliveryIndex": 92,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "AR Patel",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_15_1",
        "innings": 2,
        "over": 15,
        "ball": 1,
        "deliveryIndex": 93,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_15_2",
        "innings": 2,
        "over": 15,
        "ball": 2,
        "deliveryIndex": 94,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_15_3",
        "innings": 2,
        "over": 15,
        "ball": 3,
        "deliveryIndex": 95,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_15_4",
        "innings": 2,
        "over": 15,
        "ball": 4,
        "deliveryIndex": 96,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_15_5",
        "innings": 2,
        "over": 15,
        "ball": 5,
        "deliveryIndex": 97,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_15_6",
        "innings": 2,
        "over": 15,
        "ball": 6,
        "deliveryIndex": 98,
        "striker": "DA Miller",
        "nonStriker": "H Klaasen",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_16_1",
        "innings": 2,
        "over": 16,
        "ball": 1,
        "deliveryIndex": 99,
        "striker": "H Klaasen",
        "nonStriker": "DA Miller",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "H Klaasen",
            "fielders": [
              "RR Pant"
            ]
          }
        }
      },
      {
        "id": "2_16_2",
        "innings": 2,
        "over": 16,
        "ball": 2,
        "deliveryIndex": 100,
        "striker": "M Jansen",
        "nonStriker": "DA Miller",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_16_3",
        "innings": 2,
        "over": 16,
        "ball": 3,
        "deliveryIndex": 101,
        "striker": "M Jansen",
        "nonStriker": "DA Miller",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_16_4",
        "innings": 2,
        "over": 16,
        "ball": 4,
        "deliveryIndex": 102,
        "striker": "DA Miller",
        "nonStriker": "M Jansen",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_16_5",
        "innings": 2,
        "over": 16,
        "ball": 5,
        "deliveryIndex": 103,
        "striker": "M Jansen",
        "nonStriker": "DA Miller",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_16_6",
        "innings": 2,
        "over": 16,
        "ball": 6,
        "deliveryIndex": 104,
        "striker": "DA Miller",
        "nonStriker": "M Jansen",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_17_1",
        "innings": 2,
        "over": 17,
        "ball": 1,
        "deliveryIndex": 105,
        "striker": "DA Miller",
        "nonStriker": "M Jansen",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_17_2",
        "innings": 2,
        "over": 17,
        "ball": 2,
        "deliveryIndex": 106,
        "striker": "DA Miller",
        "nonStriker": "M Jansen",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_17_3",
        "innings": 2,
        "over": 17,
        "ball": 3,
        "deliveryIndex": 107,
        "striker": "DA Miller",
        "nonStriker": "M Jansen",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_17_4",
        "innings": 2,
        "over": 17,
        "ball": 4,
        "deliveryIndex": 108,
        "striker": "M Jansen",
        "nonStriker": "DA Miller",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "BOWLED",
            "playerOut": "M Jansen"
          }
        }
      },
      {
        "id": "2_17_5",
        "innings": 2,
        "over": 17,
        "ball": 5,
        "deliveryIndex": 109,
        "striker": "KA Maharaj",
        "nonStriker": "DA Miller",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_17_6",
        "innings": 2,
        "over": 17,
        "ball": 6,
        "deliveryIndex": 110,
        "striker": "KA Maharaj",
        "nonStriker": "DA Miller",
        "bowler": "JJ Bumrah",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_18_1",
        "innings": 2,
        "over": 18,
        "ball": 1,
        "deliveryIndex": 111,
        "striker": "KA Maharaj",
        "nonStriker": "DA Miller",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_18_2",
        "innings": 2,
        "over": 18,
        "ball": 2,
        "deliveryIndex": 112,
        "striker": "KA Maharaj",
        "nonStriker": "DA Miller",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_18_3",
        "innings": 2,
        "over": 18,
        "ball": 3,
        "deliveryIndex": 113,
        "striker": "KA Maharaj",
        "nonStriker": "DA Miller",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_18_4",
        "innings": 2,
        "over": 18,
        "ball": 4,
        "deliveryIndex": 114,
        "striker": "DA Miller",
        "nonStriker": "KA Maharaj",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 2
        }
      },
      {
        "id": "2_18_5",
        "innings": 2,
        "over": 18,
        "ball": 5,
        "deliveryIndex": 115,
        "striker": "DA Miller",
        "nonStriker": "KA Maharaj",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 1
        }
      },
      {
        "id": "2_18_6",
        "innings": 2,
        "over": 18,
        "ball": 6,
        "deliveryIndex": 116,
        "striker": "KA Maharaj",
        "nonStriker": "DA Miller",
        "bowler": "Arshdeep Singh",
        "outcome": {
          "runsBatter": 0
        }
      },
      {
        "id": "2_19_1",
        "innings": 2,
        "over": 19,
        "ball": 1,
        "deliveryIndex": 117,
        "striker": "DA Miller",
        "nonStriker": "KA Maharaj",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "DA Miller",
            "fielders": [
              "SA Yadav"
            ]
          }
        }
      },
      {
        "id": "2_19_2",
        "innings": 2,
        "over": 19,
        "ball": 2,
        "deliveryIndex": 118,
        "striker": "K Rabada",
        "nonStriker": "KA Maharaj",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 4
        }
      },
      {
        "id": "2_19_3",
        "innings": 2,
        "over": 19,
        "ball": 3,
        "deliveryIndex": 119,
        "striker": "K Rabada",
        "nonStriker": "KA Maharaj",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "BYES",
            "runs": 1
          }
        }
      },
      {
        "id": "2_19_4",
        "innings": 2,
        "over": 19,
        "ball": 4,
        "deliveryIndex": 120,
        "striker": "KA Maharaj",
        "nonStriker": "K Rabada",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "LEGBYES",
            "runs": 1
          }
        }
      },
      {
        "id": "2_19_5",
        "innings": 2,
        "over": 19,
        "ball": 5,
        "deliveryIndex": 121,
        "striker": "K Rabada",
        "nonStriker": "KA Maharaj",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0,
          "runsExtras": 1,
          "extras": {
            "type": "WIDES",
            "runs": 1
          }
        }
      },
      {
        "id": "2_19_6",
        "innings": 2,
        "over": 19,
        "ball": 6,
        "deliveryIndex": 122,
        "striker": "K Rabada",
        "nonStriker": "KA Maharaj",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 0,
          "wicket": {
            "kind": "CAUGHT",
            "playerOut": "K Rabada",
            "fielders": [
              "SA Yadav"
            ]
          }
        }
      },
      {
        "id": "2_19_7",
        "innings": 2,
        "over": 19,
        "ball": 7,
        "deliveryIndex": 123,
        "striker": "A Nortje",
        "nonStriker": "KA Maharaj",
        "bowler": "HH Pandya",
        "outcome": {
          "runsBatter": 1
        }
      }
    ]
  }
],
});
