"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { scoreBody, ScoreResult } from "@/lib/scoring";
import { getBodyReadiness, BodyReadiness } from "@/lib/bodyCheck";
import {
  computeIdealSkeleton,
  drawIdealSkeleton,
  drawDetectedSkeleton,
} from "@/lib/poseUtils";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task";

const SMOOTH_FRAMES = 20;

interface Props {
  /** If true: starts scanning automatically, no manual button shown. Use in match context. */
  controlled?: boolean;
  /** If true: fills parent container height completely (no aspect-video constraint). Use in battle layout. */
  fill?: boolean;
  onScore?: (result: ScoreResult) => void;
  onReadinessChange?: (ready: boolean) => void;
  /** Called once the camera stream is live — used by WebRTC to transmit video+audio to opponent. */
  onStream?: (stream: MediaStream) => void;
}

function scoreColor(v: number): string {
  if (v >= 8) return "#00ff88";
  if (v >= 6) return "#a3e635";
  if (v >= 4) return "#facc15";
  return "#f87171";
}

export default function BodyScanner({ controlled = false, fill = false, onScore, onReadinessChange, onStream }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const animRef       = useRef<number | null>(null);
  const landmarkerRef = useRef<import("@mediapipe/tasks-vision").PoseLandmarker | null>(null);
  const scoreHistRef  = useRef<number[]>([]);

  const [status, setStatus]           = useState<"loading" | "ready" | "scanning" | "error">("loading");
  const [result, setResult]           = useState<ScoreResult | null>(null);
  const [smoothScore, setSmoothScore] = useState<number | null>(null);
  const [showIdeal, setShowIdeal]     = useState(true);
  const [readiness, setReadiness]     = useState<BodyReadiness | null>(null);

  // Initialise MediaPipe + webcam
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { FilesetResolver, PoseLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.55,
          minPosePresenceConfidence:  0.55,
          minTrackingConfidence:      0.55,
        });

        if (cancelled) { landmarker.close(); return; }
        landmarkerRef.current = landmarker;

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" },
          // Request mic when in match mode (WebRTC will transmit it to opponent)
          audio: !!onStream,
        });

        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        // Hand stream to parent (WebRTC) before starting playback
        onStream?.(stream);

        const video = videoRef.current!;
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video.play();
          setStatus("ready");
        };
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  // Auto-start in controlled mode once camera is ready
  useEffect(() => {
    if (controlled && status === "ready") startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlled, status]);

  const startScan = useCallback(() => {
    const video     = videoRef.current;
    const canvas    = canvasRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker) return;

    setStatus("scanning");
    scoreHistRef.current = [];

    const ctx = canvas.getContext("2d")!;
    let lastTime = -1;

    function loop(now: number) {
      if (video!.readyState < 2) { animRef.current = requestAnimationFrame(loop); return; }

      canvas!.width  = video!.videoWidth;
      canvas!.height = video!.videoHeight;

      // Draw mirrored video frame
      ctx.save();
      ctx.translate(canvas!.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video!, 0, 0);
      ctx.restore();

      if (now !== lastTime) {
        const detection = landmarker!.detectForVideo(video!, now);
        lastTime = now;

        if (detection.landmarks && detection.landmarks.length > 0) {
          const lm = detection.landmarks[0];
          const vw = video!.videoWidth  || canvas!.width;
          const vh = video!.videoHeight || canvas!.height;

          // ── Body readiness gate ──────────────────────────────────────────
          const ready = getBodyReadiness(lm);
          setReadiness(ready);
          onReadinessChange?.(ready.ready);

          if (!ready.ready) {
            // Don't score — just draw the skeleton so user can see which dots are missing
            drawDetectedSkeleton(ctx, lm, canvas!.width, canvas!.height);
          } else {
            // Full pipeline only when all 8 landmarks are confirmed
            if (showIdeal) {
              const ideal = computeIdealSkeleton(lm, canvas!.width, canvas!.height);
              if (ideal) drawIdealSkeleton(ctx, ideal);
            }
            drawDetectedSkeleton(ctx, lm, canvas!.width, canvas!.height);

            const scored = scoreBody(lm, vw, vh);
            scoreHistRef.current.push(scored.overall);
            if (scoreHistRef.current.length > SMOOTH_FRAMES) scoreHistRef.current.shift();
            const avg = scoreHistRef.current.reduce((a, b) => a + b, 0) / scoreHistRef.current.length;
            setSmoothScore(Math.round(avg * 10) / 10);
            setResult(scored);
            onScore?.(scored);
          }
        } else {
          // No person detected at all
          const emptyReadiness: BodyReadiness = {
            ready: false, detected: 0, total: 8,
            statuses: Array(8).fill({ label: "", visible: false }),
            reason: "No body detected — step into frame",
          };
          setReadiness(emptyReadiness);
          onReadinessChange?.(false);
        }
      }

      animRef.current = requestAnimationFrame(loop);
    }

    animRef.current = requestAnimationFrame(loop);
  }, [onScore, onReadinessChange, showIdeal]);

  const stopScan = useCallback(() => {
    if (animRef.current !== null) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    setStatus("ready");
    setResult(null);
    setSmoothScore(null);
    setReadiness(null);
    scoreHistRef.current = [];
  }, []);

  useEffect(() => () => { if (animRef.current !== null) cancelAnimationFrame(animRef.current); }, []);

  const isScanning   = status === "scanning";
  const bodyReady    = readiness?.ready ?? false;
  const hipsOut      = isScanning && result && !result.quality.hipsDetected;

  return (
    <div className={`relative w-full flex flex-col items-center ${fill ? "h-full" : ""}`}>
      <div className={`relative w-full bg-black overflow-hidden border border-zinc-800 ${fill ? "h-full rounded-none border-0" : "aspect-video rounded-xl"}`}>
        <video ref={videoRef} className="absolute inset-0 opacity-0 pointer-events-none w-full h-full" playsInline muted />
        <canvas ref={canvasRef} className="w-full h-full object-cover" />

        {/* Idle / loading overlay */}
        {status !== "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center">
            {status === "loading" && (
              <div className="text-center space-y-3">
                <div className="w-10 h-10 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-zinc-400 text-sm tracking-widest uppercase">Initializing scanner…</p>
              </div>
            )}
            {status === "ready" && !controlled && (
              <div className="text-center space-y-2">
                <p className="text-zinc-400 text-sm tracking-widest uppercase">Camera ready</p>
                <p className="text-zinc-600 text-xs">Stand back · Keep arms visible · Fitted clothing works best</p>
              </div>
            )}
            {status === "error" && (
              <p className="text-red-400 text-sm tracking-widest uppercase">Camera access denied</p>
            )}
          </div>
        )}

        {/* ── UNABLE TO SCAN overlay ──────────────────────────────────────── */}
        {isScanning && !bodyReady && readiness && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-8 pointer-events-none">
            {/* Readiness dot grid — top left */}
            <div className="absolute top-3 left-3 bg-black/80 backdrop-blur border border-zinc-800 rounded-lg p-3">
              <div className="text-[9px] text-zinc-500 tracking-widest uppercase mb-2">
                Landmarks {readiness.detected}/8
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {readiness.statuses.map((s, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <div
                      className="w-3 h-3 rounded-full border"
                      style={{
                        background:   s.visible ? "#00ff88" : "transparent",
                        borderColor:  s.visible ? "#00ff88" : "#ef4444",
                        boxShadow:    s.visible ? "0 0 6px #00ff8866" : "none",
                      }}
                    />
                    <span className="text-[7px] text-zinc-600 text-center leading-tight whitespace-nowrap">
                      {s.label.replace("L. ", "L\n").replace("R. ", "R\n")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* UNABLE TO SCAN banner */}
            <div className="flex flex-col items-center gap-2">
              <div className="px-5 py-2 bg-red-500/15 border border-red-500/40 rounded-lg backdrop-blur-sm text-center">
                <div className="text-red-400 font-black tracking-widest uppercase text-sm">
                  UNABLE TO SCAN
                </div>
                <div className="text-red-400/70 text-xs mt-0.5">{readiness.reason}</div>
              </div>
            </div>
          </div>
        )}

        {/* YOUR SCAN badge — only when body is detected */}
        {isScanning && bodyReady && (
          <div className="absolute top-3 right-3 px-3 py-1 bg-black/70 border border-zinc-700 rounded text-xs tracking-widest text-zinc-300 uppercase">
            YOUR SCAN
          </div>
        )}

        {/* Score panel — only when body is fully detected */}
        {isScanning && bodyReady && result && (
          <div className="absolute top-3 left-3 w-40 bg-black/80 backdrop-blur border border-zinc-800 rounded-lg p-3 space-y-2">
            <div>
              <div className="text-[10px] text-zinc-500 tracking-widest uppercase">Overall Score</div>
              {result.excluded.length > 0 && (
                <div className="text-[8px] text-yellow-500/70 mt-0.5">Partial — show hips</div>
              )}
              <div className="text-4xl font-black leading-none mt-0.5" style={{ color: scoreColor(smoothScore ?? 0) }}>
                {smoothScore ?? "—"}
              </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-zinc-800">
              <div>
                <div className="text-[9px] text-zinc-500 tracking-widest uppercase">DOM</div>
                <div className="text-[12px] text-[#00ff88] font-bold truncate mt-0.5">{result.dominant}</div>
              </div>
              <div>
                <div className="text-[9px] text-zinc-500 tracking-widest uppercase">FLAW</div>
                <div className="text-[12px] text-red-400 font-bold truncate mt-0.5">{result.flaw}</div>
              </div>
            </div>
          </div>
        )}

        {/* Hip warning (only when body IS detected but hips excluded) */}
        {isScanning && bodyReady && hipsOut && (
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-yellow-500/15 border border-yellow-500/40 rounded-lg backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
            <span className="text-yellow-300 text-xs tracking-wide font-medium whitespace-nowrap">
              STEP BACK — show waist &amp; hips for full scan
            </span>
          </div>
        )}

        {/* Ideal overlay toggle */}
        {isScanning && bodyReady && (
          <div className="absolute bottom-3 left-3">
            <button
              onClick={() => setShowIdeal((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] tracking-widest uppercase border transition-colors"
              style={{
                borderColor: showIdeal ? "#f5c842" : "#3f3f46",
                color:       showIdeal ? "#f5c842" : "#71717a",
                background:  "rgba(0,0,0,0.7)",
              }}
            >
              <span className="w-2 h-2 rounded-full border border-current" style={{ background: showIdeal ? "#f5c842" : "transparent" }} />
              Ideal overlay
            </button>
          </div>
        )}
      </div>

      {/* Manual controls — hidden in controlled mode */}
      {!controlled && (
        <div className="mt-4 flex gap-3">
          {!isScanning ? (
            <button
              onClick={startScan}
              disabled={status !== "ready"}
              className="px-8 py-2.5 rounded-lg font-bold tracking-widest uppercase text-sm
                bg-[#00ff88] text-black hover:bg-[#00e87a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {status === "loading" ? "Loading…" : "Start Scan"}
            </button>
          ) : (
            <button
              onClick={stopScan}
              className="px-8 py-2.5 rounded-lg font-bold tracking-widest uppercase text-sm
                border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-colors"
            >
              Stop Scan
            </button>
          )}
        </div>
      )}

      {!controlled && !isScanning && status === "ready" && (
        <p className="mt-3 text-zinc-600 text-xs tracking-wide text-center max-w-sm">
          Stand 4–6 ft from camera · Fitted or minimal clothing · Keep arms slightly away from body
        </p>
      )}
    </div>
  );
}
