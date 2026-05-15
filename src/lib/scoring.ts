import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface BodyMetrics {
  vTaper: number;         // 25% — shoulder:hip (Hughes & Gallup 2003, golden ratio)
  shoulderWidth: number;  // 20% — shoulder span vs torso height (px)
  armDevelopment: number; // 18% — elbow spread signals arm mass
  symmetry: number;       // 15% — L/R balance
  chestProportion: number;// 12% — shoulder dominance vs overall frame
  armProportion: number;  // 6%  — upper:forearm ratio (McCallum ideal 1.18)
  posture: number;        // 4%  — shoulder level + head centering
}

export interface ScanQuality {
  hipsDetected: boolean;
  elbowsDetected: boolean;
  wristsDetected: boolean;
}

export interface ScoreResult {
  overall: number;
  metrics: BodyMetrics;
  dominant: string;
  flaw: string;
  quality: ScanQuality;
  /** Metrics excluded from overall because landmarks weren't detected */
  excluded: (keyof BodyMetrics)[];
}

interface Pt { x: number; y: number; v: number }

function toPx(lm: NormalizedLandmark, w: number, h: number): Pt {
  return { x: lm.x * w, y: lm.y * h, v: lm.visibility ?? 1 };
}

function dist(a: Pt, b: Pt): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Map a value onto a 0-10 scale linearly between lo (→0) and hi (→10)
// Values below lo give 0; values above hi give 10.
function linearScore(value: number, lo: number, hi: number): number {
  return clamp(((value - lo) / (hi - lo)) * 10, 0, 10);
}

const VIS = 0.45; // minimum visibility to trust a landmark

export function scoreBody(
  lm: NormalizedLandmark[],
  videoW = 1280,
  videoH = 720,
): ScoreResult {
  const lS   = toPx(lm[11], videoW, videoH);
  const rS   = toPx(lm[12], videoW, videoH);
  const lE   = toPx(lm[13], videoW, videoH);
  const rE   = toPx(lm[14], videoW, videoH);
  const lW   = toPx(lm[15], videoW, videoH);
  const rW   = toPx(lm[16], videoW, videoH);
  const lH   = toPx(lm[23], videoW, videoH);
  const rH   = toPx(lm[24], videoW, videoH);
  const nose = toPx(lm[0],  videoW, videoH);

  const hipsDetected    = lH.v > VIS && rH.v > VIS;
  const elbowsDetected  = lE.v > VIS && rE.v > VIS;
  const wristsDetected  = lW.v > VIS && rW.v > VIS;

  const quality: ScanQuality = { hipsDetected, elbowsDetected, wristsDetected };
  const excluded: (keyof BodyMetrics)[] = [];

  const shoulderWidth = dist(lS, rS);
  const sMid = { x: (lS.x + rS.x) / 2, y: (lS.y + rS.y) / 2 };
  const shoulderLevelDiff = Math.abs(lS.y - rS.y) / Math.max(shoulderWidth, 1);

  // ─── 1. V-Taper (25%) ────────────────────────────────────────────────────
  // Research: Weak=1.10, Average=1.25, Athletic=1.50, Elite=1.618 (golden ratio)
  // Requires HIGH hip confidence (0.65) to avoid landmark drift inflating the score.
  // Sanity gate: shoulder:hip > 2.0 is physically impossible from front view — reject frame.
  // Hard cap at 9.5: true golden-ratio physiques are extremely rare.
  const HIP_VIS = 0.65;
  const hipsReliable = lH.v > HIP_VIS && rH.v > HIP_VIS;
  let vTaper = 0;
  if (hipsReliable) {
    const hipWidth    = dist(lH, rH);
    const vTaperRatio = hipWidth > 0 ? shoulderWidth / hipWidth : 0;
    if (vTaperRatio >= 1.0 && vTaperRatio <= 2.0) {
      vTaper = Math.min(linearScore(vTaperRatio, 1.0, 1.618), 9.5);
    } else {
      excluded.push("vTaper"); // out-of-range = detection noise, skip frame
    }
  } else {
    excluded.push("vTaper");
  }

  // ─── 2. Shoulder Width (20%) ──────────────────────────────────────────────
  // Research: Weak=0.90, Average=1.05, Athletic=1.25, Elite=1.45 (px ratio)
  // Linear: 0.85 → 0, 1.45 → 10
  let shoulderWidthScore = 0;
  if (hipsDetected) {
    const hMid        = { x: (lH.x + rH.x) / 2, y: (lH.y + rH.y) / 2 };
    const torsoHeight = dist({ x: sMid.x, y: sMid.y, v: 1 }, { x: hMid.x, y: hMid.y, v: 1 });
    if (torsoHeight > 20) {
      shoulderWidthScore = linearScore(shoulderWidth / torsoHeight, 0.85, 1.45);
    }
  } else {
    excluded.push("shoulderWidth");
  }

  // ─── 3. Arm Development (18%) ─────────────────────────────────────────────
  // Elbow spread is a PROXY for arm mass — it's noisy. Lighting and arm angle
  // can fake wide elbows. Hard cap at 7.5: reserve 8+ for when we add vision API.
  // Suspicious if elbowRatio > 1.25 (arms would need to be wider than shoulders,
  // almost certainly a detection artifact or deliberate gaming) — clamp to 6.5.
  // Scale: 0.72 → 0, 1.15 → 7.5
  let armDevelopment = 0;
  if (elbowsDetected) {
    const elbowRatio = dist(lE, rE) / Math.max(shoulderWidth, 1);
    if (elbowRatio > 1.25) {
      armDevelopment = 6.5; // suspicious — don't reward further
    } else {
      armDevelopment = clamp(((elbowRatio - 0.72) / (1.15 - 0.72)) * 7.5, 0, 7.5);
    }
  } else {
    excluded.push("armDevelopment");
  }

  // ─── 4. Symmetry (15%) ────────────────────────────────────────────────────
  // Shoulder level + arm length balance
  let symmetry = 0;
  if (elbowsDetected && wristsDetected) {
    const lArmLen = dist(lS, lE) + dist(lE, lW);
    const rArmLen = dist(rS, rE) + dist(rE, rW);
    const avgArm  = (lArmLen + rArmLen) / 2;
    const lenDiff = avgArm > 0 ? Math.abs(lArmLen - rArmLen) / avgArm : 0;
    const combined = lenDiff + shoulderLevelDiff;
    symmetry = clamp(10 - combined * 45, 0, 10);
  } else {
    // Fall back to just shoulder level
    symmetry = clamp(10 - shoulderLevelDiff * 35, 0, 10);
  }

  // ─── 5. Chest Proportion (12%) ────────────────────────────────────────────
  // How much of the visible frame your shoulders dominate — wider frame-fill = more imposing.
  // Uses hip-anchored torso width ratio like shoulder width, slightly different curve.
  // Research: aesthetic ideal shoulder:torso is 1.25-1.35 (wider than average 1.05-1.15)
  // Linear: 0.80 → 0, 1.40 → 10
  let chestProportion = 0;
  if (hipsDetected) {
    const hMid        = { x: (lH.x + rH.x) / 2, y: (lH.y + rH.y) / 2 };
    const torsoHeight = dist({ x: sMid.x, y: sMid.y, v: 1 }, { x: hMid.x, y: hMid.y, v: 1 });
    if (torsoHeight > 20) {
      chestProportion = linearScore(shoulderWidth / torsoHeight, 0.80, 1.40);
    }
  } else {
    excluded.push("chestProportion");
  }

  // ─── 6. Arm Proportion (6%) ───────────────────────────────────────────────
  // McCallum / Steve Reeves standard: upper:forearm length ≈ 1.18 (ideal)
  // Weak: <1.05, Average: 1.05-1.12, Athletic: 1.12-1.20, Elite: 1.20-1.30
  // Bell curve peaked at 1.18
  let armProportion = 0;
  if (elbowsDetected && wristsDetected) {
    const avgUpper = (dist(lS, lE) + dist(rS, rE)) / 2;
    const avgFore  = (dist(lE, lW) + dist(rE, rW)) / 2;
    if (avgFore > 5) {
      const ratio = avgUpper / avgFore;
      armProportion = clamp(10 - Math.abs(ratio - 1.18) * 30, 0, 10);
    }
  } else {
    excluded.push("armProportion");
  }

  // ─── 7. Posture (4%) ──────────────────────────────────────────────────────
  const noseOffset = Math.abs(nose.x - sMid.x) / Math.max(shoulderWidth, 1);
  const posture    = clamp(10 - (shoulderLevelDiff * 30 + noseOffset * 20), 0, 10);

  const metrics: BodyMetrics = {
    vTaper,
    shoulderWidth:   shoulderWidthScore,
    armDevelopment,
    symmetry,
    chestProportion,
    armProportion,
    posture,
  };

  // Weights — hip-dependent metrics get dropped from denominator if excluded
  const WEIGHTS: Record<keyof BodyMetrics, number> = {
    vTaper:          0.24,  // 24% — golden ratio gate
    shoulderWidth:   0.20,  // 20% — tied with chest
    chestProportion: 0.20,  // 20% — tied with shoulder width
    armDevelopment:  0.15,  // 15%
    symmetry:        0.13,  // 13%
    armProportion:   0.05,  //  5%
    posture:         0.03,  //  3%
  };

  let weightedSum  = 0;
  let totalWeight  = 0;
  for (const [key, score] of Object.entries(metrics) as [keyof BodyMetrics, number][]) {
    if (!excluded.includes(key)) {
      weightedSum += score * WEIGHTS[key];
      totalWeight += WEIGHTS[key];
    }
  }
  const overall = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 10) / 10
    : 0;

  const LABELS: Record<keyof BodyMetrics, string> = {
    vTaper:          "V-Taper",
    shoulderWidth:   "Shoulder Width",
    armDevelopment:  "Arm Dev",
    symmetry:        "Symmetry",
    chestProportion: "Chest",
    armProportion:   "Arm Proportion",
    posture:         "Posture",
  };

  const scorable = (Object.entries(metrics) as [keyof BodyMetrics, number][])
    .filter(([k]) => !excluded.includes(k))
    .sort((a, b) => b[1] - a[1]);

  const dominant = scorable.length > 0 ? LABELS[scorable[0][0]] : "—";
  const flaw     = scorable.length > 0 ? LABELS[scorable[scorable.length - 1][0]] : "—";

  return { overall, metrics, dominant, flaw, quality, excluded };
}
