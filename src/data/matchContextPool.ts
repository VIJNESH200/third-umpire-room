import type { IncidentType } from "../types/scenario";

export interface TeamMatchTemplate {
  tournament: string;
  matchFormat: "TEST" | "ODI" | "T20";
  battingTeam: string;
  bowlingTeam: string;
  batters: { name: string; score: string; hand: "RIGHT" | "LEFT" }[];
  bowlers: { name: string; figures: string; type: "PACE" | "SPIN" }[];
}

export const MATCH_POOLS: TeamMatchTemplate[] = [
  {
    tournament: "ICC Men's World Cup Final — Lord's",
    matchFormat: "ODI",
    battingTeam: "ENGLAND",
    bowlingTeam: "NEW ZEALAND",
    batters: [
      { name: "Ben Stokes", score: "84* (98)", hand: "LEFT" },
      { name: "Jos Buttler", score: "59 (60)", hand: "RIGHT" },
      { name: "Joe Root", score: "7 (30)", hand: "RIGHT" },
      { name: "Chris Woakes", score: "12 (14)", hand: "RIGHT" },
    ],
    bowlers: [
      { name: "Trent Boult", figures: "2/44 (9.4)", type: "PACE" },
      { name: "Matt Henry", figures: "1/40 (10.0)", type: "PACE" },
      { name: "Lockie Ferguson", figures: "3/50 (10.0)", type: "PACE" },
      { name: "Mitchell Santner", figures: "0/32 (8.0)", type: "SPIN" },
    ],
  },
  {
    tournament: "The Ashes — 5th Test, The Oval (Day 5)",
    matchFormat: "TEST",
    battingTeam: "AUSTRALIA",
    bowlingTeam: "ENGLAND",
    batters: [
      { name: "Steve Smith", score: "144 (219)", hand: "RIGHT" },
      { name: "Marnus Labuschagne", score: "48 (112)", hand: "RIGHT" },
      { name: "Travis Head", score: "39 (41)", hand: "LEFT" },
      { name: "Alex Carey", score: "28* (55)", hand: "LEFT" },
    ],
    bowlers: [
      { name: "Stuart Broad", figures: "4/62 (20.4)", type: "PACE" },
      { name: "James Anderson", figures: "2/39 (18.0)", type: "PACE" },
      { name: "Mark Wood", figures: "3/45 (14.2)", type: "PACE" },
      { name: "Moeen Ali", figures: "1/55 (15.0)", type: "SPIN" },
    ],
  },
  {
    tournament: "Border-Gavaskar Trophy — Melbourne Cricket Ground",
    matchFormat: "TEST",
    battingTeam: "INDIA",
    bowlingTeam: "AUSTRALIA",
    batters: [
      { name: "Virat Kohli", score: "82 (120)", hand: "RIGHT" },
      { name: "Rohit Sharma", score: "63 (94)", hand: "RIGHT" },
      { name: "Rishabh Pant", score: "45* (38)", hand: "LEFT" },
      { name: "Ravindra Jadeja", score: "34* (60)", hand: "LEFT" },
    ],
    bowlers: [
      { name: "Pat Cummins", figures: "3/51 (18.3)", type: "PACE" },
      { name: "Mitchell Starc", figures: "2/68 (16.0)", type: "PACE" },
      { name: "Nathan Lyon", figures: "3/74 (24.0)", type: "SPIN" },
      { name: "Josh Hazlewood", figures: "1/42 (17.0)", type: "PACE" },
    ],
  },
  {
    tournament: "T20 World Cup Final — MCG (Under Floodlights)",
    matchFormat: "T20",
    battingTeam: "PAKISTAN",
    bowlingTeam: "INDIA",
    batters: [
      { name: "Babar Azam", score: "32 (28)", hand: "RIGHT" },
      { name: "Mohammad Rizwan", score: "49 (39)", hand: "RIGHT" },
      { name: "Shan Masood", score: "38* (25)", hand: "LEFT" },
      { name: "Shadab Khan", score: "20 (12)", hand: "RIGHT" },
    ],
    bowlers: [
      { name: "Jasprit Bumrah", figures: "2/16 (3.4)", type: "PACE" },
      { name: "Arshdeep Singh", figures: "2/28 (4.0)", type: "PACE" },
      { name: "Kuldeep Yadav", figures: "1/22 (4.0)", type: "SPIN" },
      { name: "Mohammed Shami", figures: "1/30 (3.2)", type: "PACE" },
    ],
  },
  {
    tournament: "Indian Premier League Final — Ahmedabad",
    matchFormat: "T20",
    battingTeam: "CHENNAI SUPER KINGS",
    bowlingTeam: "GUJARAT TITANS",
    batters: [
      { name: "MS Dhoni", score: "18* (8)", hand: "RIGHT" },
      { name: "Ruturaj Gaikwad", score: "26 (16)", hand: "RIGHT" },
      { name: "Shivam Dube", score: "32 (21)", hand: "LEFT" },
      { name: "Ravindra Jadeja", score: "15* (6)", hand: "LEFT" },
    ],
    bowlers: [
      { name: "Rashid Khan", figures: "2/24 (4.0)", type: "SPIN" },
      { name: "Mohit Sharma", figures: "3/36 (3.5)", type: "PACE" },
      { name: "Mohammed Shami", figures: "1/29 (4.0)", type: "PACE" },
      { name: "Noor Ahmad", figures: "2/17 (4.0)", type: "SPIN" },
    ],
  },
];

/**
 * Generates an incident-matched, perfectly consistent match situation.
 */
export function generateDynamicMatchSituation(
  incidentType: IncidentType,
  batter: string,
  bowler: string,
  battingTeam: string,
  bowlingTeam: string,
  over: number,
  ball: number,
  isSpin: boolean
): string {
  const batterLast = batter.split(" ").slice(-1)[0] || batter;
  const bowlerLast = bowler.split(" ").slice(-1)[0] || bowler;

  switch (incidentType) {
    case "LBW":
      return isSpin
        ? `Over ${over}.${ball} • ${bowlerLast} ripping turn into the pads of ${batterLast} — ${bowlingTeam} appeal loudly for LBW`
        : `Over ${over}.${ball} • ${bowlerLast} angling a sharp delivery into ${batterLast}'s front pad — massive LBW appeal`;

    case "CAUGHT_BEHIND":
      return `Over ${over}.${ball} • ${bowlerLast} tests ${batterLast}'s outside edge in the corridor of uncertainty — caught behind appeal`;

    case "RUN_OUT":
      return `Over ${over}.${ball} • ${batter} dashes for a tight single — ${bowlingTeam} fielder unleashes a direct hit attempt`;

    case "STUMPING":
      return `Over ${over}.${ball} • ${batterLast} advances down the pitch against ${bowlerLast} — wicketkeeper whips bails off in a flash`;

    case "BOUNDARY":
      return `Over ${over}.${ball} • Deep boundary pursuit by ${bowlingTeam} — athletic slide near the cushion reviewed by TV umpire`;
  }
}
