# 🏏 Third Umpire Room — Official DRS Review Console

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-6.0-646CFF?logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css)
![Test Suite](https://img.shields.io/badge/Tests-45%2F45%20Passed-brightgreen)
![DRS Protocol](https://img.shields.io/badge/ICC%20DRS-Official%20Gate%20Rulebook-amber)

**A desk-based cricket review simulator inspired by real ICC Decision Review System (DRS) protocols and *Eye of the Match: The VAR Game*.**

*Step into the Third Umpire's broadcast booth. Receive high-stakes appeals, give instinctive soft signals under time pressure, operate 11 synchronized slow-motion telemetry feeds, uphold the Umpire's Call rulebook, and earn your ICC Elite Panel rating.*

[Key Features](#-key-features) • [How to Play](#-game-loop) • [Camera Matrix](#-camera-matrix-11-unique-feeds) • [DRS Protocol Engine](#-icc-drs-protocol-engine) • [Quick Start](#-quick-start) • [Test Suite](#-test-suite)

</div>

---

## 📸 Overview

In modern professional cricket, the **TV / Third Umpire** holds ultimate authority over marginal dismissals. Every millimeter and millisecond matters. 

**Third Umpire Room** recreates the authentic two-phase review workflow:
1. **Phase 1 (Instinct / Incident Alert)**: Watch the initial broadcast replay feed and make a gut-instinct soft signal within 10 seconds.
2. **Phase 2 (Forensic Review Console)**: Scrub through multi-angle high-speed cameras, inspect Hawk-Eye ball tracking, analyze UltraEdge audio waveforms, check HotSpot thermal friction marks, step frame-by-frame with Zing bail ignition, and transmit your binding verdict to the giant stadium screen.

At the end of your umpiring shift, receive a **FUT-style shareable Umpire Stat Card** detailing your Overall Rating (OVR), Review Precision, Umpire's Call IQ, and Rank Tier.

---

## ✨ Key Features

### ⏱️ Phase 1 — Broadcast Incident Alert & Instinct Call
- **True Perceptual Evidence**: Broadcast angles show realistic delivery drift, batter stances, apparent impact height, daylight gaps, and runner dive trajectories without leaking hidden forensic data.
- **Dynamic Difficulty Tiers**:
  - `CLEAR`: High visual certainty for decisive calls.
  - `MARGINAL`: Razor-thin margins testing umpire intuition and rulebook calibration.
  - `HOWLER`: Deceptive on-field errors designed to test whether you get swayed by player appeals.
- **10-Second Shot Clock**: Make your call (`OUT`, `NOT OUT`, or `UNSURE`) before the broadcast window expires.

---

### 🎛️ Phase 2 — Forensic Review Console
- **Centralized Synchronized Transport**: Single shared clock (`600ms – 2200ms` at 50fps) drives all viewports simultaneously.
- **Precision Shuttle & Frame Steppers**:
  - `PLAY / PAUSE` with real-time delta-time animation.
  - `+1F / -1F` (20ms single-frame step) & `+5F / -5F` (100ms multi-frame jog).
  - Variable Speeds: `0.1x`, `0.25x`, `0.5x`, `1.0x`.
  - **Rock & Roll**: Dedicated shuttle loop oscillating around critical contact frames.
- **Clickable Keyframe Timeline Markers**: Jump straight to pivotal moments (*Bails Dislodged, Bat Grounded, UltraEdge Spike, Pad Contact, Cushion Touch*).
- **Acoustic Snicko Sound**: Synthesized Web Audio API snick/thud playback for UltraEdge checks.
- **Official Radio Comms Log**: Live dialogue between TV Umpire, On-field Umpire, and Broadcast Director.

---

## 🎥 Camera Matrix (11 Unique Feeds)

Every incident type provides genuine, perspective-accurate camera angles:

| Incident Type | Camera Code | Feed Name | Description |
|---|---|---|---|
| **LBW** | `CAM 03` | **Hawk-Eye 3D** | Full 3D pitch perspective with 5-gate sequential telemetry HUD and stump collision. |
| **LBW** | `CAM 01` | **Front-On Cam** | Down-the-wicket broadcast angle with bowler release, pitch bounce scuff, and pad profile. |
| **LBW** | `CAM 06` | **Stump Face** | 2D eye-level elevation looking at 3 stumps with 50% Umpire's Call outer margin. |
| **RUN OUT / STUMPING** | `CAM 02` | **Crease 500fps** | Tight slow-mo on popping crease with Zing bail LED ignition & sliding bat blade. |
| **RUN OUT / STUMPING** | `CAM 01` | **Side-On Wide** | Wide angle showing runner dive, incoming fielder throw, and keeper stumps collection. |
| **RUN OUT / STUMPING** | `CAM 07` | **Overhead Crease** | Top-down bird's-eye view of popping crease line with live +/- mm margin readout. |
| **CAUGHT BEHIND** | `CAM 04` | **UltraEdge Wave** | Split-screen: bat-ball slow-mo proximity + synchronized decibel oscilloscope canvas. |
| **CAUGHT BEHIND** | `CAM 08` | **HotSpot IR** | Negative thermal infrared showing friction heat glow on bat edge / pad with polarity toggle. |
| **CAUGHT BEHIND** | `CAM 02` | **Super Slow-Mo** | 1000 FPS optical macro zoom on bat willow grain, ball seam rotation & gap laser ruler. |
| **BOUNDARY** | `CAM 05` | **Rope Cushion** | 4K ultra-close cushion view with sliding boot, foam compression, & ball release arc. |
| **BOUNDARY** | `CAM 09` | **Catch Relay Cam** | Wide tracking angle showing athletic boundary dive, relay flick, and cushion touch. |

---

## ⚖️ ICC DRS Protocol Engine

Built directly against the official ICC Decision Review System rulebook:

```
                      [ LBW APPEAL ]
                            │
              ┌─────────────┴─────────────┐
        [ Fair Delivery? ]          [ No-Ball: OVERTURN to NOT OUT ]
              │ (Yes)
        [ Prior Bat Contact? ]      [ Bat First: OVERTURN to NOT OUT ]
              │ (No)
        [ Pitching Line ]           [ Outside Leg: NOT OUT ]
              │ (In-Line / Outside Off)
        [ Impact Line ]             [ Outside Off + Shot Offered: NOT OUT ]
              │ (In-Line / No Shot)
        [ Wickets Hitting ]
              ├── Missing ───────────────> OVERTURN to NOT OUT
              ├── Clearly Hitting ───────> OVERTURN / CONFIRM OUT
              └── Umpire's Call ─────────> ON-FIELD DECISION STANDS
```

### Supported Incident Types:
1. **LBW (Leg Before Wicket)**: Gate 0A fair delivery, Gate 0B prior bat, Gate 1 pitching, Gate 2 impact & shot offered, Gate 3 wickets projection & Umpire's Call.
2. **Run-Out & Stumping**: Zing bail LED separation frame vs bat/foot grounding; airborne bounced bat detection.
3. **Caught Behind**: Synchronized acoustic spike filtering against decoy sounds (pad noise, ground scrape, bat-pad).
4. **Boundary Checks**: Relay catch legality, cushion compression, and ball release timing.

---

## 🏆 Scoring Engine & FUT Stat Card

After completing a shift (8 standard incidents or 5 rapid incidents), the scoring engine calculates your performance across 6 core umpiring metrics:

```
 ┌────────────────────────────────────────────────────────┐
 │                      OVR RATING                        │
 │  30% Review Precision  +  25% Umpire's Call IQ (UCI)   │
 │  20% Soft Signal       +  15% Reaction Speed           │
 │  10% Consistency                                       │
 └────────────────────────────────────────────────────────┘
```

- **Umpire Rank Ladder**:
  - `35 – 40 OVR`: **Third Umpire Trainee** (Bronze)
  - `41 – 60 OVR`: **Club Level Official** (Silver)
  - `61 – 75 OVR`: **TV Umpire** (Gold)
  - `76 – 88 OVR`: **ICC Panel Umpire** (Elite)
  - `89 – 100 OVR`: **ICC Elite Panel** (Diamond)
- **Export & Share**: Download your high-resolution PNG Umpire Card directly from the browser.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18.0 or higher
- **npm** or **pnpm** / **yarn**

### Installation

```bash
# Clone the repository
git clone https://github.com/VIJNESH200/third-umpire-room.git

# Navigate to project directory
cd third-umpire-room

# Install dependencies
npm install

# Start local development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Test Suite

The project includes an automated test suite verifying DRS rule logic, scenario generation determinism, and Phase 1 perceptual evidence integrity.

```bash
npm test
```

### Test Coverage (45/45 Passing):
- **Group 1: Gate 0 Eligibility** (Fair delivery / No-ball overstep, Prior bat contact) — *4 tests*
- **Group 2: Gate 1 & Gate 2** (Pitching line, Impact line, Shot offered vs Padded away) — *4 tests*
- **Group 3: Gate 3 Wickets & Umpire's Call** (Missing, Clearly Hitting, Umpire's Call branches) — *6 tests*
- **Group 4: Run-Out, Stumping, UltraEdge & Boundary** (Bail dislodgement, bounced bat, snicko, cushion touch) — *7 tests*
- **Group 5: Scenario Generator Invariants** (Seed determinism, tier overrides, session generator) — *3 tests*
- **Group 6: Scoring Engine & UCI** (Umpire's Call IQ, streak tracking, rank thresholds, howler detection) — *12 tests*
- **Group 7: Phase 1 Initial Evidence System** (Perceptual parameters, forensic data separation, difficulty tiers) — *9 tests*

---

## 🛠️ Tech Stack

- **Framework**: [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Bundler**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with bespoke broadcast CRT & HUD design system
- **Icons**: [Lucide React](https://lucide.dev/)
- **Card Export**: [html2canvas](https://html2canvas.hertzen.com/)
- **Audio Engine**: Custom Web Audio API synthesizer for acoustic snicko, clicks, and alarms

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
