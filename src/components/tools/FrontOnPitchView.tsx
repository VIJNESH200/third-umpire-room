import React, { useEffect, useRef } from "react";
import type { LBWData } from "../../types/scenario";
import { drawStumpsAndBails, drawCricketBall } from "../instinct/actorRigs";

interface FrontOnPitchViewProps {
  lbw: LBWData;
  currentTimeMs: number;
}

/* ================================================================
   CAM 01 • KEEPER-END REVERSE BROADCAST REPLAY (LBW)
   Answers: "What actually happened at the batter?"

   The camera sits behind the striker's wicket (slip level) looking
   back up the pitch at the bowler, so the play reads top-to-bottom:
     BOWLER (far)  ↓  BALL FLIGHT  ↓  BATTER (hero)  ↓  STUMPS (near)

   Timeline is the shared canonical LBW transport:
     600ms = release • 1200ms = pitch bounce • 1500ms = pad impact
     (dead ball) • 1800ms+ = aftermath / appeal.
   Every value drawn is raw scenario physics (pitchX, impactX,
   impactHeight, shotOffered, batterHand) — never the DRS outcome.
   ================================================================ */

// Canonical replay anchors (ms) — identical to the shared transport markers.
const T_RELEASE = 800;
const T_BOUNCE = 1200;
const T_IMPACT = 1500;
const T_SETTLED = 1800;

// Keeper-end station geometry (canvas 500x340).
const W = 500;
const H = 340;
const STUMPS_BASE_Y = 328; // nearest station: striker wicket in foreground
const STUMPS_SCALE = 1.5;
const CREASE_Y = 308; // striker popping crease (batter guards just behind it)
const BATTER_FEET_Y = 312;
const PITCH_TOP_Y = 72; // far bowling crease
const CORRIDOR_CX = 250;

// Pitch strip edges (half-width in px at a given y, linear perspective).
const pitchHalfWidthAt = (y: number) =>
  16 + ((y - PITCH_TOP_Y) / (H - PITCH_TOP_Y)) * (215 - 16);

interface BackViewPose {
  stride: number; // 0 set → 1 planted forward in the crease
  recoil: number; // pad-impact jolt (0..1)
  shotPhase: number; // bat swing progress through contact (0..1)
}

/** Stylized back-view batter (custom to this reverse angle — side rigs
 *  stay untouched in the shared asset system). */
function drawBatterBackView(
  ctx: CanvasRenderingContext2D,
  x: number,
  feetY: number,
  scale: number,
  pose: BackViewPose,
  isRightHand: boolean,
  shotOffered: boolean
) {
  const s = scale;
  const lean = pose.stride * 0.05 + pose.recoil * 0.03;

  ctx.save();
  ctx.translate(x, feetY);

  // Ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.ellipse(0, 2, 26 * s, 6 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.rotate(lean);

  // Bat — held on the batter's handed side (RH = viewer's right from behind).
  const batSide = isRightHand ? 1 : -1;
  const gloveY = -46 * s;
  const gloveX = batSide * 17 * s;
  {
    // Pivot at the gloved hands; angle follows shot / no-shot.
    let batAngle: number;
    if (shotOffered) {
      // Swing through the contact window: lifted back → swept down across.
      const swing = pose.shotPhase;
      batAngle =
        batSide * (0.95 - swing * 2.0) - (batSide * 0.25 * (1 - swing));
    } else {
      // No shot: blade tucked low behind the lead pad.
      batAngle = batSide * 0.38;
    }
    ctx.save();
    ctx.translate(gloveX, gloveY);
    ctx.rotate(batAngle);
    ctx.fillStyle = "#0284c7";
    ctx.strokeStyle = "#075985";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(-1.6 * s, -12 * s, 3.2 * s, 12 * s, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d97706";
    ctx.strokeStyle = "#78350f";
    ctx.beginPath();
    ctx.roundRect(-2.6 * s, 0, 5.2 * s, 30 * s, [1.5, 1.5, 3, 3]);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Legs with rear-facing front pads (cream, knee rolls)
  const padW = 13 * s;
  const padH = 46 * s;
  for (const side of [-1, 1]) {
    const px = side * 9 * s;
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.roundRect(px - padW / 2, -padH - 8 * s, padW, padH, 3);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(px - padW / 2 + 1, -padH * 0.55 - 8 * s);
    ctx.lineTo(px + padW / 2 - 1, -padH * 0.55 - 8 * s);
    ctx.moveTo(px - padW / 2 + 1, -padH * 0.28 - 8 * s);
    ctx.lineTo(px + padW / 2 - 1, -padH * 0.28 - 8 * s);
    ctx.stroke();
    // Shoe
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.ellipse(px, -4 * s, 8 * s, 3.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Torso (back of the shirt) with squad number
  const torsoW = 34 * s;
  const torsoH = 46 * s;
  ctx.fillStyle = "#334155";
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.roundRect(-torsoW / 2, -padH - 6 * s - torsoH, torsoW, torsoH, 6);
  ctx.fill();
  ctx.stroke();
  // Shoulder line
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-torsoW / 2 + 5 * s, -padH - 2 * s - torsoH);
  ctx.lineTo(torsoW / 2 - 5 * s, -padH - 2 * s - torsoH);
  ctx.stroke();
  ctx.fillStyle = "#e2e8f0";
  ctx.font = `bold ${Math.round(11 * s)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText("07", 0, -padH - 16 * s - torsoH + 8 * s);

  // Gloves at the hips (batting gloves, white)
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 0.8;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 17 * s, gloveY, 4.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Helmet (rear shell + neck guard + ear flap on the handed side)
  const headY = -padH - 8 * s - torsoH - 6 * s;
  ctx.fillStyle = "#0f172a";
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.arc(0, headY, 9 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(-7 * s, headY + 5 * s, 14 * s, 6 * s, 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(batSide * 6 * s - 1.5 * s, headY - 2 * s, 3 * s, 8 * s, 1);
  ctx.fill();

  ctx.restore(); // lean
  ctx.restore(); // station
}

/** Distant bowler in follow-through at the far end (silhouette scale). */
function drawDistantBowler(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1e293b";

  // Striding legs (front leg planted over the crease)
  ctx.beginPath();
  ctx.roundRect(-6, -10, 4.5, 10, 2);
  ctx.roundRect(1.5, -9, 4.5, 9, 2);
  ctx.fill();

  // Torso leaning forward through the crease
  ctx.save();
  ctx.rotate(0.22);
  ctx.beginPath();
  ctx.roundRect(-5, -24, 10, 15, 3);
  ctx.fill();
  // Bowling arm swept over after release
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3.4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(-7, -30);
  ctx.stroke();
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(6, -26);
  ctx.stroke();
  ctx.restore();

  // Head
  ctx.beginPath();
  ctx.arc(0, -27.5, 3.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export const FrontOnPitchView: React.FC<FrontOnPitchViewProps> = ({
  lbw,
  currentTimeMs,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const t = Math.max(T_RELEASE, Math.min(2200, currentTimeMs));
    const isRightHand = lbw.batterHand === "RIGHT";

    // --- Batter pose from the canonical timeline ---
    const stride = Math.min(1, Math.max(0, (t - 900) / 550));
    const recoil =
      t >= T_IMPACT && t < 1650
        ? Math.sin(((t - T_IMPACT) / 150) * Math.PI)
        : 0;
    const shotPhase = Math.min(1, Math.max(0, (t - 1380) / 320));
    const pose: BackViewPose = { stride, recoil, shotPhase };

    // --- Ball corridor (raw physical data only) ---
    const releaseX = 238; // over-the-wicket release line (stylized)
    const releaseY = 78;
    const bounceX = CORRIDOR_CX + lbw.pitchX * 130;
    const bounceY = 175;
    const impactX = CORRIDOR_CX + lbw.impactX * 120;
    const impactY = BATTER_FEET_Y - (lbw.impactHeight / 71.1) * 95;

    let ballX = releaseX;
    let ballY = releaseY;
    let ballR = 2.5;
    let prevX = releaseX;
    let prevY = releaseY;

    if (t < T_BOUNCE) {
      const f = (t - T_RELEASE) / (T_BOUNCE - T_RELEASE);
      ballX = releaseX + (bounceX - releaseX) * f;
      ballY = releaseY + (bounceY - releaseY) * f;
      ballR = 2.5 + f * 2.0;
      prevX = releaseX + (bounceX - releaseX) * Math.max(0, f - 0.08);
      prevY = releaseY + (bounceY - releaseY) * Math.max(0, f - 0.08);
    } else if (t < T_IMPACT) {
      const f = (t - T_BOUNCE) / (T_IMPACT - T_BOUNCE);
      ballX = bounceX + (impactX - bounceX) * f;
      // Bounce lifts it slightly off the surface as it approaches the pad
      ballY = bounceY + (impactY - bounceY) * f - Math.sin(f * Math.PI) * 10;
      ballR = 4.5 + f * 2.5;
      prevX = bounceX + (impactX - bounceX) * Math.max(0, f - 0.06);
      prevY = bounceY + (impactY - bounceY) * Math.max(0, f - 0.06);
    } else {
      // Dead ball: drops from the pad and settles beside the crease.
      ballX = impactX;
      ballY = impactY;
      ballR = 7;
      const f = Math.min(1, (t - T_IMPACT) / 280);
      const groundY = 318;
      const drop = groundY - impactY;
      ballY = impactY + drop * (f * f);
      // Two damped bounces as it dies
      if (f >= 1) {
        const b = Math.min(1, (t - T_IMPACT - 280) / 240);
        ballY = groundY - Math.abs(Math.sin(b * Math.PI * 2)) * 6 * (1 - b);
        ballX = impactX + 8 * b;
      }
      prevX = ballX - 3;
      prevY = ballY - 4;
    }

    // =================  RENDER  =================
    ctx.clearRect(0, 0, W, H);

    // --- Turf + stadium ambience ---
    const gradGrass = ctx.createLinearGradient(0, 0, 0, H);
    gradGrass.addColorStop(0, "#102315");
    gradGrass.addColorStop(0.55, "#16321f");
    gradGrass.addColorStop(1, "#0e2416");
    ctx.fillStyle = gradGrass;
    ctx.fillRect(0, 0, W, H);
    const gradLight = ctx.createRadialGradient(
      W * 0.5,
      H * 0.38,
      20,
      W * 0.5,
      H * 0.38,
      W * 0.7
    );
    gradLight.addColorStop(0, "rgba(255, 255, 220, 0.07)");
    gradLight.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradLight;
    ctx.fillRect(0, 0, W, H);

    // --- 22-yard clay strip (far bowler end → near striker end) ---
    const gradPitch = ctx.createLinearGradient(0, PITCH_TOP_Y, 0, H);
    gradPitch.addColorStop(0, "#9a8161");
    gradPitch.addColorStop(0.5, "#b49b78");
    gradPitch.addColorStop(1, "#ad9275");
    ctx.fillStyle = gradPitch;
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - pitchHalfWidthAt(PITCH_TOP_Y), PITCH_TOP_Y);
    ctx.lineTo(CORRIDOR_CX + pitchHalfWidthAt(PITCH_TOP_Y), PITCH_TOP_Y);
    ctx.lineTo(CORRIDOR_CX + pitchHalfWidthAt(H), H);
    ctx.lineTo(CORRIDOR_CX - pitchHalfWidthAt(H), H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4d3d29";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Worn corridor
    ctx.fillStyle = "rgba(140, 110, 75, 0.22)";
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - pitchHalfWidthAt(PITCH_TOP_Y) * 0.45, PITCH_TOP_Y);
    ctx.lineTo(CORRIDOR_CX + pitchHalfWidthAt(PITCH_TOP_Y) * 0.45, PITCH_TOP_Y);
    ctx.lineTo(CORRIDOR_CX + pitchHalfWidthAt(H) * 0.45, H);
    ctx.lineTo(CORRIDOR_CX - pitchHalfWidthAt(H) * 0.45, H);
    ctx.closePath();
    ctx.fill();

    // --- Far end: non-striker stumps, creases, bowler ---
    drawStumpsAndBails(ctx, CORRIDOR_CX, PITCH_TOP_Y + 4, { scale: 0.42 });
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    ctx.moveTo(
      CORRIDOR_CX - pitchHalfWidthAt(PITCH_TOP_Y) * 0.8,
      PITCH_TOP_Y + 4
    );
    ctx.lineTo(
      CORRIDOR_CX + pitchHalfWidthAt(PITCH_TOP_Y) * 0.8,
      PITCH_TOP_Y + 4
    );
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.30)";
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - pitchHalfWidthAt(96) * 0.8, 96);
    ctx.lineTo(CORRIDOR_CX + pitchHalfWidthAt(96) * 0.8, 96);
    ctx.stroke();
    drawDistantBowler(ctx, 238, 86);

    // --- Striker popping crease (the batter guards just behind it) ---
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - pitchHalfWidthAt(CREASE_Y) * 0.92, CREASE_Y);
    ctx.lineTo(CORRIDOR_CX + pitchHalfWidthAt(CREASE_Y) * 0.92, CREASE_Y);
    ctx.stroke();

    // --- Pitch bounce scuff ---
    if (t >= T_BOUNCE) {
      ctx.fillStyle = "rgba(80,58,40,0.55)";
      ctx.beginPath();
      ctx.ellipse(bounceX, bounceY + 4, 7, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Batter (hero station, drawn before the near stumps) ---
    drawBatterBackView(
      ctx,
      CORRIDOR_CX + lbw.impactX * 40,
      BATTER_FEET_Y,
      1.6,
      pose,
      isRightHand,
      lbw.shotOffered
    );

    // --- Striker stumps in the foreground (nearest the camera) ---
    drawStumpsAndBails(ctx, CORRIDOR_CX, STUMPS_BASE_Y, {
      scale: STUMPS_SCALE,
    });
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(CORRIDOR_CX - pitchHalfWidthAt(STUMPS_BASE_Y) * 0.7, STUMPS_BASE_Y);
    ctx.lineTo(CORRIDOR_CX + pitchHalfWidthAt(STUMPS_BASE_Y) * 0.7, STUMPS_BASE_Y);
    ctx.stroke();

    // --- Pad impact flash (factual contact cue, fades fast) ---
    if (t >= T_IMPACT && t < 1680) {
      const flash = 1 - (t - T_IMPACT) / 180;
      ctx.strokeStyle = `rgba(250, 204, 21, ${0.75 * flash})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(impactX, impactY, 8 + (1 - flash) * 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // --- Ball with motion trail ---
    drawCricketBall(ctx, ballX, ballY, {
      radius: ballR,
      seamAngleRad: (t / 1000) * Math.PI * 6,
      motionTrail: t > T_RELEASE + 60 && t < T_SETTLED,
      prevX,
      prevY,
    });
  }, [lbw, currentTimeMs]);

  const statusTime = Math.max(600, Math.min(2200, currentTimeMs));
  const statusText =
    statusTime < T_RELEASE
      ? "BOWLER RUN-UP"
      : statusTime < T_BOUNCE
      ? "DELIVERY IN FLIGHT"
      : statusTime < T_IMPACT
      ? "OFF THE SURFACE"
      : "PAD CONTACT • DEAD BALL";
  const currentFrame = Math.round((currentTimeMs / 1000) * 50);

  return (
    <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold tracking-wider text-slate-100 font-display">
            CAM 01 • KEEPER-END REVERSE REPLAY
          </span>
          <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">
            FRAME {currentFrame} • 50FPS
          </span>
        </div>

        <div className="flex items-center space-x-2 text-[11px] text-slate-400">
          <span>
            SPEED: <b className="text-cyan-300">{lbw.ballSpeedKph} KM/H</b>
          </span>
          <span>•</span>
          <span>
            TYPE: <b className="text-slate-200">{lbw.spinOrPace}</b>
          </span>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#0c1624] via-[#08101a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
        <div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" />
        <canvas ref={canvasRef} width={W} height={H} className="w-full h-full object-contain z-10" />

        {/* Replay phase chip — factual transport state only */}
        <div className="absolute top-2.5 left-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono backdrop-blur-sm z-20">
          <span className="text-slate-400 font-bold">STATUS: </span>
          <span className="text-cyan-300 font-black">{statusText}</span>
        </div>

        {/* Camera purpose hint */}
        <div className="absolute bottom-2.5 right-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1 rounded text-[10px] text-slate-300 backdrop-blur-sm z-20">
          SWITCH TO <b className="text-cyan-300">CAM 03</b> FOR TRACKING /{" "}
          <b className="text-cyan-300">CAM 06</b> FOR STUMP OVERLAP
        </div>
      </div>

      {/* Footer Info */}
      <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1">
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">PERSPECTIVE</div>
          <div className="text-[11px] font-black text-slate-200">
            KEEPER-END REVERSE
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">BATTER</div>
          <div className="text-[11px] font-black text-cyan-300">
            {lbw.batterHand === "RIGHT" ? "RIGHT-HAND" : "LEFT-HAND"}
          </div>
        </div>
        <div className="hardware-panel p-2 rounded-lg">
          <div className="text-[9px] text-slate-400 font-bold">SHOT OFFERED</div>
          <div className="text-[11px] font-black text-slate-200">
            {lbw.shotOffered ? "BAT IN PLAY" : "NO SHOT"}
          </div>
        </div>
      </div>
    </div>
  );
};
