import React, { useEffect, useRef } from "react";
import type { LBWData } from "../../types/scenario";
import { drawCricketBall } from "../instinct/actorRigs";

interface FrontOnPitchViewProps { lbw: LBWData; currentTimeMs: number; }

/* CAM 01 has one physical coordinate system: X spans the pitch, Y is height,
 * Z runs from striker (0) towards bowler. Ground, stumps, actor and ball all
 * use the project() function below. */
const T_RELEASE = 800;
const T_BOUNCE = 1200;
const T_IMPACT = 1500;
const T_INTERCEPT = 1410;
const W = 600;
const H = 380;
type Vec3 = { x: number; y: number; z: number };
type Camera = { position: Vec3; right: Vec3; up: Vec3; forward: Vec3; focal: number };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const unit = (a: Vec3): Vec3 => mul(a, 1 / (Math.hypot(a.x, a.y, a.z) || 1));
const bezier = (a: Vec3, b: Vec3, c: Vec3, t: number): Vec3 => add(add(mul(a, (1 - t) ** 2), mul(b, 2 * (1 - t) * t)), mul(c, t ** 2));

function makeCamera(timeMs: number): Camera {
  // A real dolly toward the striker is the sole framing change around impact.
  const d = clamp01((timeMs - 1000) / 430);
  const position = { x: lerp(-6.1, -5.25, d), y: lerp(3.35, 3.0, d), z: lerp(-3.0, -2.45, d) };
  // The TV head pans from the delivery corridor back to the striker as the
  // ball arrives; it never changes the pitch or ball coordinates.
  const forward = unit(sub({ x: 0, y: 1.02, z: lerp(5.0, 0.05, d) }, position));
  const right = unit(cross(forward, { x: 0, y: 1, z: 0 }));
  return { position, forward, right, up: unit(cross(right, forward)), focal: 650 };
}

function project(camera: Camera, point: Vec3) {
  const relative = sub(point, camera.position);
  const depth = Math.max(0.15, dot(relative, camera.forward));
  return { x: W / 2 + (dot(relative, camera.right) * camera.focal) / depth, y: H / 2 - (dot(relative, camera.up) * camera.focal) / depth, depth };
}

function worldPath(ctx: CanvasRenderingContext2D, camera: Camera, points: Vec3[], close = false) {
  const first = project(camera, points[0]);
  ctx.beginPath(); ctx.moveTo(first.x, first.y);
  points.slice(1).forEach((point) => { const p = project(camera, point); ctx.lineTo(p.x, p.y); });
  if (close) ctx.closePath();
}

function groundLine(ctx: CanvasRenderingContext2D, camera: Camera, a: Vec3, b: Vec3, width: number, alpha: number) {
  const pa = project(camera, a); const pb = project(camera, b);
  ctx.save(); ctx.strokeStyle = `rgba(255,255,255,${alpha})`; ctx.lineWidth = width;
  ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke(); ctx.restore();
}

function drawStumps(ctx: CanvasRenderingContext2D, camera: Camera) {
  const wicketZ = -0.26;
  const shadowA = project(camera, { x: -0.28, y: 0, z: wicketZ - 0.05 });
  const shadowB = project(camera, { x: 0.28, y: 0, z: wicketZ - 0.05 });
  ctx.save(); ctx.strokeStyle = "rgba(0,0,0,0.34)"; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(shadowA.x, shadowA.y); ctx.lineTo(shadowB.x, shadowB.y); ctx.stroke();
  [-0.115, 0, 0.115].forEach((x, index) => {
    const bottom = project(camera, { x, y: 0, z: wicketZ });
    const top = project(camera, { x, y: 0.711, z: wicketZ });
    const side = project(camera, { x: x + 0.022, y: 0, z: wicketZ });
    const width = Math.max(3.4, Math.abs(side.x - bottom.x) * 1.7);
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = width + 1.5; ctx.beginPath(); ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(top.x, top.y); ctx.stroke();
    ctx.strokeStyle = index === 1 ? "#f59e0b" : "#d97706"; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(bottom.x, bottom.y); ctx.lineTo(top.x, top.y); ctx.stroke();
  });
  [[-0.115, 0], [0, 0.115]].forEach(([left, right]) => {
    const a = project(camera, { x: left, y: 0.735, z: wicketZ }); const b = project(camera, { x: right, y: 0.735, z: wicketZ });
    ctx.strokeStyle = "#78350f"; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  });
  ctx.restore();
}

function drawBatter(ctx: CanvasRenderingContext2D, camera: Camera, lbw: LBWData, timeMs: number) {
  const hand = lbw.batterHand === "RIGHT" ? -1 : 1;
  const stride = clamp01((timeMs - 820) / 480);
  const recoil = timeMs >= T_IMPACT && timeMs < 1650 ? Math.sin(((timeMs - T_IMPACT) / 150) * Math.PI) : 0;
  const anchor: Vec3 = { x: hand * 0.12, y: 0, z: 0.22 };
  const origin = project(camera, anchor);
  const px = project(camera, add(anchor, { x: 1, y: 0, z: 0 }));
  const py = project(camera, add(anchor, { x: 0, y: 1, z: 0 }));
  const ex = { x: px.x - origin.x, y: px.y - origin.y };
  const ey = { x: py.x - origin.x, y: py.y - origin.y };
  const frontPadX = hand * (0.30 + stride * 0.12);
  const impactHeight = Math.max(0.18, Math.min(0.92, lbw.impactHeight / 100));
  const padImpact = add(anchor, { x: frontPadX, y: impactHeight, z: 0.02 });
  let swing = 0;
  if (lbw.shotOffered) swing = clamp01((timeMs - (lbw.batContactBeforePad ? 1100 : 1150)) / (lbw.batContactBeforePad ? 310 : 330));
  const glove = { x: hand * lerp(0.18, 0.33, swing), y: lerp(1.18, 0.82, swing) };
  const batAngle = lbw.shotOffered ? lerp(-0.55 * hand, 0.26 * hand, swing) : -0.08 * hand;
  const bladeDirection = { x: Math.sin(batAngle), y: -Math.cos(batAngle) };
  const batTip = add(anchor, { x: glove.x + bladeDirection.x * 0.82, y: glove.y + bladeDirection.y * 0.82, z: 0.02 });
  const footA = project(camera, add(anchor, { x: hand * -0.16, y: 0, z: 0.07 }));
  const footB = project(camera, add(anchor, { x: hand * 0.37, y: 0, z: 0.33 }));
  ctx.save(); ctx.strokeStyle = "rgba(0,0,0,0.38)"; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(footA.x, footA.y); ctx.lineTo(footB.x, footB.y); ctx.stroke();
  // This local artwork is transformed by the same projected X/Y basis as the guard.
  ctx.setTransform(ex.x, ex.y, ey.x, ey.y, origin.x, origin.y); ctx.lineCap = "round";
  const rearX = hand * -0.14;
  ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.moveTo(rearX, 1.02); ctx.lineTo(rearX - hand * 0.03, 0.48); ctx.stroke();
  ctx.save(); ctx.translate(rearX - hand * 0.03, 0.02); ctx.fillStyle = "#f8fafc"; ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 0.014; ctx.beginPath(); ctx.roundRect(-0.09, 0, 0.18, 0.55, 0.035); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 0.018; [0.14, 0.25, 0.36, 0.46].forEach((y) => { ctx.beginPath(); ctx.moveTo(-0.07, y); ctx.lineTo(0.07, y); ctx.stroke(); }); ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.ellipse(0, -0.02, 0.12, 0.045, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 0.16; ctx.beginPath(); ctx.moveTo(hand * 0.06, 1.02); ctx.lineTo(frontPadX, 0.53 + recoil * 0.025); ctx.stroke();
  ctx.save(); ctx.translate(frontPadX, 0.02); ctx.rotate(hand * (0.06 + stride * 0.04)); ctx.fillStyle = "#f8fafc"; ctx.strokeStyle = "#64748b"; ctx.lineWidth = 0.016; ctx.beginPath(); ctx.roundRect(-0.105, 0, 0.21, 0.59, 0.045); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.roundRect(-0.09, 0.39, 0.18, 0.12, 0.02); ctx.fill(); ctx.strokeStyle = "#cbd5e1"; ctx.lineWidth = 0.018; [-0.05, 0, 0.05].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 0.05); ctx.lineTo(x, 0.36); ctx.stroke(); }); ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.ellipse(-hand * 0.025, -0.02, 0.13, 0.05, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(0, 1.0); ctx.rotate(hand * (-0.06 - stride * 0.06)); ctx.fillStyle = "#273549"; ctx.strokeStyle = "#0f172a"; ctx.lineWidth = 0.02; ctx.beginPath(); ctx.roundRect(-0.25, 0, 0.50, 0.68, 0.09); ctx.fill(); ctx.stroke(); ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(hand * -0.19, 0.08); ctx.lineTo(hand * -0.19, 0.61); ctx.stroke(); ctx.fillStyle = "#f8fafc"; ctx.font = "bold 0.15px monospace"; ctx.textAlign = "center"; ctx.fillText("07", 0, 0.34); ctx.restore();
  const headX = hand * -0.07;
  ctx.save(); ctx.translate(headX, 1.86); ctx.rotate(hand * -0.08); ctx.fillStyle = "#0c1524"; ctx.strokeStyle = "#334155"; ctx.lineWidth = 0.018; ctx.beginPath(); ctx.arc(0, 0, 0.15, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#d4a373"; ctx.beginPath(); ctx.ellipse(hand * 0.09, -0.015, 0.06, 0.07, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#050b14"; ctx.beginPath(); ctx.moveTo(hand * 0.12, -0.02); ctx.lineTo(hand * 0.25, 0.02); ctx.lineTo(hand * 0.12, 0.06); ctx.closePath(); ctx.fill(); ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.moveTo(hand * 0.15, 0.02); ctx.lineTo(hand * 0.04, 0.07); ctx.stroke(); ctx.restore();
  const shoulderY = 1.53;
  ctx.strokeStyle = "#334155"; ctx.lineWidth = 0.105; ctx.beginPath(); ctx.moveTo(hand * 0.20, shoulderY); ctx.lineTo(glove.x + hand * 0.03, glove.y); ctx.stroke(); ctx.strokeStyle = "#475569"; ctx.lineWidth = 0.11; ctx.beginPath(); ctx.moveTo(hand * -0.18, shoulderY); ctx.lineTo(glove.x - hand * 0.03, glove.y); ctx.stroke();
  ctx.save(); ctx.translate(glove.x, glove.y); ctx.rotate(batAngle); ctx.fillStyle = "#0284c7"; ctx.strokeStyle = "#0369a1"; ctx.lineWidth = 0.015; ctx.beginPath(); ctx.roundRect(-0.03, 0, 0.06, 0.29, 0.02); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#d97706"; ctx.strokeStyle = "#78350f"; ctx.lineWidth = 0.018; ctx.beginPath(); ctx.roundRect(-0.06, -0.82, 0.12, 0.82, 0.025); ctx.fill(); ctx.stroke(); ctx.fillStyle = "#f8fafc"; ctx.fillRect(-0.06, -0.82, 0.12, 0.07); ctx.restore();
  ctx.fillStyle = "#f8fafc"; ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 0.014; [-0.035, 0.04].forEach((dx) => { ctx.beginPath(); ctx.arc(glove.x + dx * hand, glove.y, 0.06, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  ctx.restore();
  return { padImpact, batTip };
}

export const FrontOnPitchView: React.FC<FrontOnPitchViewProps> = ({ lbw, currentTimeMs }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext("2d"); if (!canvas || !ctx) return;
    const timeMs = Math.max(600, Math.min(2200, currentTimeMs)); const camera = makeCamera(timeMs);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#08131d"); sky.addColorStop(0.46, "#0f2318"); sky.addColorStop(1, "#07170e"); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * 0.49, H * 0.52, 30, W * 0.49, H * 0.52, 330); glow.addColorStop(0, "rgba(254,240,138,0.10)"); glow.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    const pitch = [{ x: -1.524, y: 0, z: -2.1 }, { x: 1.524, y: 0, z: -2.1 }, { x: 1.524, y: 0, z: 18.2 }, { x: -1.524, y: 0, z: 18.2 }];
    worldPath(ctx, camera, pitch, true); const turf = ctx.createLinearGradient(0, 125, 0, 365); turf.addColorStop(0, "#80684c"); turf.addColorStop(0.55, "#b0936b"); turf.addColorStop(1, "#927654"); ctx.fillStyle = turf; ctx.fill(); ctx.strokeStyle = "rgba(91,66,42,0.8)"; ctx.lineWidth = 1.5; ctx.stroke();
    groundLine(ctx, camera, { x: -1.524, y: 0.006, z: -0.26 }, { x: 1.524, y: 0.006, z: -0.26 }, 1.4, 0.48);
    groundLine(ctx, camera, { x: -1.524, y: 0.008, z: 1.22 }, { x: 1.524, y: 0.008, z: 1.22 }, 2.6, 0.92);
    groundLine(ctx, camera, { x: -1.524, y: 0.008, z: -0.26 }, { x: -1.524, y: 0.008, z: 1.22 }, 1.1, 0.58);
    groundLine(ctx, camera, { x: 1.524, y: 0.008, z: -0.26 }, { x: 1.524, y: 0.008, z: 1.22 }, 1.1, 0.58);
    const hand = lbw.batterHand === "RIGHT" ? -1 : 1;
    const release: Vec3 = { x: hand * -0.42, y: 2.05, z: 17.2 }; const bounce: Vec3 = { x: lbw.pitchX * 2.55, y: 0.055, z: 6.1 };
    if (timeMs >= T_BOUNCE) { const mark = project(camera, bounce); ctx.fillStyle = "rgba(65,44,25,0.68)"; ctx.beginPath(); ctx.ellipse(mark.x, mark.y, 10, 3.5, -0.2, 0, Math.PI * 2); ctx.fill(); }
    drawStumps(ctx, camera); const { padImpact, batTip } = drawBatter(ctx, camera, lbw, timeMs);
    let ball = release; let previous = release; let ballDead = false;
    if (timeMs < T_RELEASE) { ball = release; }
    else if (timeMs < T_BOUNCE) { const f = clamp01((timeMs - T_RELEASE) / (T_BOUNCE - T_RELEASE)); const control = { x: lerp(release.x, bounce.x, 0.5), y: 3.35, z: lerp(release.z, bounce.z, 0.5) }; ball = bezier(release, control, bounce, f); previous = bezier(release, control, bounce, Math.max(0, f - 0.075)); }
    else if (timeMs < T_IMPACT) { const f = clamp01((timeMs - T_BOUNCE) / (T_IMPACT - T_BOUNCE)); const control = { x: lerp(bounce.x, padImpact.x, 0.48), y: 1.06, z: lerp(bounce.z, padImpact.z, 0.48) }; if (lbw.batContactBeforePad && timeMs >= T_INTERCEPT) { const at = clamp01((T_INTERCEPT - T_BOUNCE) / (T_IMPACT - T_BOUNCE)); const interception = bezier(bounce, control, batTip, at); const d = clamp01((timeMs - T_INTERCEPT) / (T_IMPACT - T_INTERCEPT)); ball = add(mul(interception, 1 - d), mul(padImpact, d)); previous = add(mul(interception, 1 - Math.max(0, d - 0.1)), mul(padImpact, Math.max(0, d - 0.1))); } else { ball = bezier(bounce, control, padImpact, f); previous = bezier(bounce, control, padImpact, Math.max(0, f - 0.075)); } }
    else { ballDead = true; const d = clamp01((timeMs - T_IMPACT) / 280); ball = { x: padImpact.x + hand * 0.16 * d, y: padImpact.y * (1 - d), z: padImpact.z + 0.20 * d }; previous = ball; }
    const pBall = project(camera, ball); const pPrev = project(camera, previous); const pRadius = Math.max(4.5, Math.abs(project(camera, add(ball, { x: 0.072, y: 0, z: 0 })).x - pBall.x));
    if (timeMs >= T_IMPACT && timeMs < 1680) { const k = 1 - (timeMs - T_IMPACT) / 180; ctx.strokeStyle = `rgba(250,204,21,${0.72 * k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(pBall.x, pBall.y, pRadius + (1 - k) * 12, 0, Math.PI * 2); ctx.stroke(); }
    drawCricketBall(ctx, pBall.x, pBall.y, { radius: pRadius, seamAngleRad: (timeMs / 1000) * Math.PI * 7, motionTrail: !ballDead && timeMs > T_RELEASE + 30, prevX: pPrev.x, prevY: pPrev.y });
  }, [lbw, currentTimeMs]);
  const statusTime = Math.max(600, Math.min(2200, currentTimeMs));
  const statusText = statusTime < T_RELEASE ? "GATHER & RELEASE" : statusTime < T_BOUNCE ? "DELIVERY IN FLIGHT" : statusTime < T_IMPACT ? "OFF THE PITCH" : "PAD CONTACT • DEAD BALL";
  const currentFrame = Math.round((currentTimeMs / 1000) * 50);
  return <div className="flex flex-col h-full monitor-frame rounded-xl border border-slate-700/80 p-3 select-none font-mono text-slate-200">
    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800"><div className="flex items-center space-x-2.5"><div className="w-2.5 h-2.5 rounded-full bg-cyan-400" /><span className="text-xs font-bold tracking-wider text-slate-100 font-display">CAM 01 • BROADCAST IMPACT REPLAY</span><span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-300 font-semibold">FRAME {currentFrame} • 50 FPS</span></div><div className="flex items-center space-x-2 text-[11px] text-slate-400"><span>SPEED: <b className="text-cyan-300">{lbw.ballSpeedKph} KM/H</b></span><span>•</span><span>TYPE: <b className="text-slate-200">{lbw.spinOrPace}</b></span></div></div>
    <div className="relative flex-1 min-h-[230px] my-2 bg-gradient-to-b from-[#0c1624] via-[#08101a] to-[#040810] rounded-lg border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner"><div className="pointer-events-none absolute inset-0 scanlines-overlay opacity-20" /><canvas ref={canvasRef} width={W} height={H} className="w-full h-full object-contain z-10" /><div className="absolute top-2.5 left-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1.5 rounded text-[11px] font-mono backdrop-blur-sm z-20"><span className="text-slate-400 font-bold">STATUS: </span><span className="text-cyan-300 font-black">{statusText}</span></div><div className="absolute bottom-2.5 right-2.5 bg-slate-950/90 border border-slate-700 px-3 py-1 rounded text-[10px] text-slate-300 backdrop-blur-sm z-20">STRIKER SLOW-MO REPLAY • <b className="text-cyan-300">CAM 03</b> HAWK-EYE</div></div>
    <div className="grid grid-cols-2 gap-2 font-mono text-xs pt-1"><div className="hardware-panel p-2 rounded-lg"><div className="text-[9px] text-slate-400 font-bold">PERSPECTIVE</div><div className="text-[11px] font-black text-slate-200">ELEVATED 3/4 SLOW-MO</div></div><div className="hardware-panel p-2 rounded-lg"><div className="text-[9px] text-slate-400 font-bold">REPLAY FEED</div><div className="text-[11px] font-black text-cyan-300">50 FPS • FRAME-ACCURATE</div></div></div>
  </div>;
};
