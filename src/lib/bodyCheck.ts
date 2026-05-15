import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

const DETECTION_THRESHOLD = 0.50;

export const PRIMARY_LANDMARKS: { idx: number; label: string }[] = [
  { idx: 11, label: "L. Shoulder" },
  { idx: 12, label: "R. Shoulder" },
  { idx: 13, label: "L. Elbow" },
  { idx: 14, label: "R. Elbow" },
  { idx: 15, label: "L. Wrist" },
  { idx: 16, label: "R. Wrist" },
  { idx: 23, label: "L. Hip" },
  { idx: 24, label: "R. Hip" },
];

export interface BodyReadiness {
  ready: boolean;
  detected: number;          // 0–8
  total: 8;
  statuses: { label: string; visible: boolean }[];
  reason: string;            // human-readable when not ready
}

export function getBodyReadiness(lm: NormalizedLandmark[]): BodyReadiness {
  const statuses = PRIMARY_LANDMARKS.map(({ idx, label }) => ({
    label,
    visible: !!(lm[idx] && (lm[idx].visibility ?? 1) >= DETECTION_THRESHOLD),
  }));

  const detected = statuses.filter((s) => s.visible).length;
  const ready = detected === 8;

  let reason = "";
  if (!ready) {
    const missing = statuses.filter((s) => !s.visible).map((s) => s.label);
    if (detected === 0) {
      reason = "No body detected — step into frame";
    } else if (missing.some((m) => m.includes("Hip"))) {
      reason = "Step back — show your full torso to the hips";
    } else if (missing.some((m) => m.includes("Wrist"))) {
      reason = "Extend arms — wrists not visible";
    } else if (missing.some((m) => m.includes("Elbow"))) {
      reason = "Move arms away from body — elbows not visible";
    } else {
      reason = `${8 - detected} reference point${8 - detected > 1 ? "s" : ""} not detected`;
    }
  }

  return { ready, detected, total: 8, statuses, reason };
}
