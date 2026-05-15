import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

// Upper-body landmark indices we actually use
export const UPPER_BODY_INDICES = [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24];

// Connections to draw for the upper body skeleton
export const UPPER_BODY_CONNECTIONS: [number, number][] = [
  [11, 12], // across shoulders
  [11, 13], // left upper arm
  [13, 15], // left forearm
  [12, 14], // right upper arm
  [14, 16], // right forearm
  [11, 23], // left torso
  [12, 24], // right torso
  [23, 24], // hips
  [7, 11],  // left neck
  [8, 12],  // right neck
];

// Ideal proportions for a 10/10 physique, all relative to torsoHeight
export const IDEAL = {
  shoulderToTorso: 1.25,       // shoulder width = 1.25× torso height
  hipToShoulder:   1 / 1.618,  // hip width = shoulder / golden ratio ≈ 0.618
  elbowSpread:     0.82,       // elbow width = 0.82× shoulder width
  upperArmRatio:   0.56,       // upper arm length = 0.56× torso height
  forearmRatio:    0.49,       // forearm length = 0.49× torso height
  neckHalfWidth:   0.13,       // half neck width = 0.13× shoulder width
};

export interface IdealSkeleton {
  lShoulder: { x: number; y: number };
  rShoulder: { x: number; y: number };
  lElbow:    { x: number; y: number };
  rElbow:    { x: number; y: number };
  lWrist:    { x: number; y: number };
  rWrist:    { x: number; y: number };
  lHip:      { x: number; y: number };
  rHip:      { x: number; y: number };
  lNeck:     { x: number; y: number };
  rNeck:     { x: number; y: number };
}

/**
 * Compute where the ideal skeleton landmarks would be in pixel space,
 * anchored to the detected torso centre and scale.
 */
export function computeIdealSkeleton(
  lm: NormalizedLandmark[],
  canvasW: number,
  canvasH: number
): IdealSkeleton | null {
  const lShoulder = lm[11];
  const rShoulder = lm[12];
  const lHip      = lm[23];
  const rHip      = lm[24];

  if (!lShoulder || !rShoulder || !lHip || !rHip) return null;

  // Torso anchor in pixel space (mirror x because we render selfie-flipped)
  const toPixX = (nx: number) => (1 - nx) * canvasW;
  const toPixY = (ny: number) => ny * canvasH;

  const sMidX = (toPixX(lShoulder.x) + toPixX(rShoulder.x)) / 2;
  const sMidY = (toPixY(lShoulder.y) + toPixY(rShoulder.y)) / 2;
  const hMidX = (toPixX(lHip.x)     + toPixX(rHip.x))     / 2;
  const hMidY = (toPixY(lHip.y)     + toPixY(rHip.y))     / 2;

  const torsoH = Math.sqrt((sMidX - hMidX) ** 2 + (sMidY - hMidY) ** 2);
  if (torsoH < 5) return null;

  const sw  = torsoH * IDEAL.shoulderToTorso;  // ideal shoulder width in px
  const hw  = sw * IDEAL.hipToShoulder;         // ideal hip width in px
  const ew  = sw * IDEAL.elbowSpread;           // ideal elbow width in px
  const ual = torsoH * IDEAL.upperArmRatio;     // ideal upper-arm length in px
  const fal = torsoH * IDEAL.forearmRatio;      // ideal forearm length in px

  return {
    lShoulder: { x: sMidX - sw / 2, y: sMidY },
    rShoulder: { x: sMidX + sw / 2, y: sMidY },
    lElbow:    { x: sMidX - ew / 2, y: sMidY + ual },
    rElbow:    { x: sMidX + ew / 2, y: sMidY + ual },
    lWrist:    { x: sMidX - ew / 2, y: sMidY + ual + fal },
    rWrist:    { x: sMidX + ew / 2, y: sMidY + ual + fal },
    lHip:      { x: hMidX - hw / 2, y: hMidY },
    rHip:      { x: hMidX + hw / 2, y: hMidY },
    lNeck:     { x: sMidX - sw * IDEAL.neckHalfWidth, y: sMidY - torsoH * 0.06 },
    rNeck:     { x: sMidX + sw * IDEAL.neckHalfWidth, y: sMidY - torsoH * 0.06 },
  };
}

export function drawIdealSkeleton(
  ctx: CanvasRenderingContext2D,
  ideal: IdealSkeleton,
  alpha = 0.45
): void {
  const pts = ideal;
  const connections: [keyof IdealSkeleton, keyof IdealSkeleton][] = [
    ["lShoulder", "rShoulder"],
    ["lShoulder", "lElbow"],
    ["lElbow",    "lWrist"],
    ["rShoulder", "rElbow"],
    ["rElbow",    "rWrist"],
    ["lShoulder", "lHip"],
    ["rShoulder", "rHip"],
    ["lHip",      "rHip"],
    ["lNeck",     "rNeck"],
    ["lNeck",     "lShoulder"],
    ["rNeck",     "rShoulder"],
  ];

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = "#f5c842";
  ctx.lineWidth   = 2.5;
  ctx.setLineDash([6, 4]);

  for (const [a, b] of connections) {
    ctx.beginPath();
    ctx.moveTo(pts[a].x, pts[a].y);
    ctx.lineTo(pts[b].x, pts[b].y);
    ctx.stroke();
  }

  // Ideal landmark dots
  ctx.setLineDash([]);
  ctx.fillStyle = "#f5c842";
  for (const pt of Object.values(pts)) {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// Primary measurement points — large bright dot with a glow ring
const PRIMARY_INDICES = [11, 12, 13, 14, 15, 16, 23, 24];
// Secondary tracking points — small dim dot (head anchor for posture)
const SECONDARY_INDICES = [0, 7, 8];

export function drawDetectedSkeleton(
  ctx: CanvasRenderingContext2D,
  lm: NormalizedLandmark[],
  canvasW: number,
  canvasH: number
): void {
  const toPixX = (nx: number) => (1 - nx) * canvasW;
  const toPixY = (ny: number) => ny * canvasH;

  ctx.save();

  // Primary dots — shoulders, elbows, wrists, hips
  for (const idx of PRIMARY_INDICES) {
    if (!lm[idx]) continue;
    if (lm[idx].visibility !== undefined && lm[idx].visibility! < 0.5) continue;
    const x = toPixX(lm[idx].x);
    const y = toPixY(lm[idx].y);

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 255, 136, 0.12)";
    ctx.fill();

    // Solid dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#00ff88";
    ctx.fill();
  }

  // Secondary dots — nose + ears (posture anchor only, visually subdued)
  for (const idx of SECONDARY_INDICES) {
    if (!lm[idx]) continue;
    if (lm[idx].visibility !== undefined && lm[idx].visibility! < 0.4) continue;
    const x = toPixX(lm[idx].x);
    const y = toPixY(lm[idx].y);

    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 255, 136, 0.35)";
    ctx.fill();
  }

  ctx.restore();
}
