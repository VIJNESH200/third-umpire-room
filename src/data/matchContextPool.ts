export interface TeamMatchTemplate {
  tournament: string;
  matchFormat: "TEST" | "ODI" | "T20";
  battingTeam: string;
  bowlingTeam: string;
  batters: { name: string; score: string; hand: "RIGHT" | "LEFT" }[];
  bowlers: { name: string; figures: string; type: "PACE" | "SPIN" }[];
  situations: string[];
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
    situations: [
      "Target 242 • 15 needed off 4 balls • Extreme tension at Lord's",
      "Over 48.3 • Batters pushing for desperate second run to retain strike",
      "Over 49.1 • Huge LBW appeal from round the wicket",
      "Over 49.4 • Dramatic diving throw toward bowler's end",
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
    situations: [
      "Day 5 Final Session • 48 runs required • 2 wickets in hand",
      "Broad running in from the Pavilion End with the new ball swinging late",
      "Massive caught behind appeal after ball jags off the seam",
      "Stumping referral against the spinner with batter's foot on the crease line",
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
    situations: [
      "Day 4 Evening • India lead by 180 runs with 4 wickets remaining",
      "Nathan Lyon ripping off-breaks into the rough outside right-hander's off stump",
      "Pad-bat bat-pad appeal with multiple fielders crowding the batter",
      "Sliding boundary rope save reviewed by the third umpire",
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
    situations: [
      "19th Over • 18 needed off 8 balls • 90,000 roaring in the stands",
      "Bumrah pinpoint toe-crusher yorker — umpire gives Not Out on field",
      "Desperate direct hit run-out at the non-striker's end",
      "Boundary catch juggle at deep mid-wicket near the cushion",
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
    situations: [
      "Last ball of the IPL Final • 4 needed to win • Floodlights blazing",
      "Lightning quick stumping appeal by keeper in 0.12 seconds",
      "Leg-before appeal on a wrong'un pitching on off and turning sharply",
      "Boundary relay catch at long-off reviewed for boundary cushion touch",
    ],
  },
];
