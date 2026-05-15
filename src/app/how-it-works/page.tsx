import Link from "next/link";

export default function HowItWorks() {
  return (
    <main className="min-h-screen bg-[#080808] text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors text-sm flex items-center gap-1">← Home</Link>
          <Link href="/" className="text-lg font-black tracking-widest text-[#00ff88]">OMUSCLE</Link>
        </div>
        <div className="flex items-center gap-6 text-sm text-zinc-500">
          <Link href="/scan" className="hover:text-white transition-colors">Play</Link>
          <span className="text-white">How it works</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-20">

        {/* Header */}
        <div className="space-y-3">
          <div className="text-[#00ff88] text-xs tracking-widest uppercase font-bold">The system</div>
          <h1 className="text-4xl font-black tracking-tight">How Omuscle rates you</h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Everything runs locally in your browser. No video is ever sent anywhere.
            The AI is a pose estimation model — it sees your skeleton, not a photo.
          </p>
        </div>

        {/* Step by step */}
        <section className="space-y-10">
          <div className="text-xs tracking-widest text-zinc-600 uppercase">The process</div>

          {[
            {
              n: "01",
              title: "Your webcam feeds into MediaPipe Pose",
              body: "MediaPipe Pose is a Google model that runs entirely as WebAssembly in your browser — it never touches a server. Every frame of your webcam feed is analyzed to extract 33 body landmarks: your shoulders, elbows, wrists, hips, and a few head anchors for posture.",
            },
            {
              n: "02",
              title: "33 landmarks. 8 that matter for scoring.",
              body: "We only score based on upper body landmarks: both shoulders (11, 12), both elbows (13, 14), both wrists (15, 16), and both hips (23, 24). The small faint dots near your head — nose and ears — are used purely as a posture anchor to check shoulder level and spine alignment. They have zero effect on your physique score.",
            },
            {
              n: "03",
              title: "Your hips must be in frame for a full scan",
              body: "Three of the seven scoring factors — V-Taper, Shoulder Width, and Chest — require both hip landmarks to be detected at high confidence (≥65%). If your hips aren't visible, those factors are excluded from your score entirely and a yellow banner prompts you to step back. A scan without hips is marked as partial.",
            },
            {
              n: "04",
              title: "The golden ideal is overlaid on your body",
              body: "Based on your detected torso centre and height, we compute where the ideal 10/10 physique's landmarks would sit — using the golden ratio (1.618) for shoulder-to-hip, and classical bodybuilding proportions for arm development. These appear as gold dashed dots and lines on screen. The gap between your green detected dots and the gold ideal dots is what drives your score.",
            },
            {
              n: "05",
              title: "7 factors are scored with anti-gaming limits",
              body: "Each factor compares your detected ratio against a research-calibrated ideal. Some factors have hard ceilings: Arm Development is capped at 7.5/10 because elbow-spread alone can be gamed by arm position or lighting — the remaining headroom is reserved for vision-model muscle definition scoring. V-Taper is capped at 9.5/10, and frames where the shoulder:hip ratio exceeds 2.0 (physically impossible) are rejected entirely.",
            },
            {
              n: "06",
              title: "Score is smoothed over 20 frames, then you see the result",
              body: "Raw per-frame scores fluctuate as the model tracks you. We average over a 20-frame rolling window so your displayed score is stable. You see three things: your overall 0–10 score, your DOM (the factor you score highest on), and your FLAW (the factor dragging you down most). Individual sub-scores are intentionally hidden.",
            },
          ].map(({ n, title, body }) => (
            <div key={n} className="flex gap-6">
              <div className="text-[#00ff88] font-black text-sm w-8 flex-shrink-0 pt-0.5">{n}</div>
              <div className="space-y-2">
                <h3 className="text-white font-bold text-lg leading-snug">{title}</h3>
                <p className="text-zinc-400 leading-relaxed text-sm">{body}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Scoring factors */}
        <section className="space-y-6">
          <div className="text-xs tracking-widest text-zinc-600 uppercase">The 7 factors</div>
          <p className="text-zinc-600 text-xs -mt-3">Weights are hidden in the UI. Shown here for transparency.</p>
          <div className="space-y-3">
            {[
              {
                name: "V-Taper",
                weight: "24%",
                ideal: "Shoulder : hip = 1.618× (golden ratio)",
                cap: "Max 9.5 — hip confidence gate at 65%",
                how: "Shoulder width divided by hip width in pixel space. Linear scale: even (1.0) → 0, golden ratio (1.618) → 9.5. Frames where the ratio exceeds 2.0 are rejected as detection noise. Hip landmarks must hit 65% visibility confidence — lower than that and V-Taper is excluded for that frame.",
              },
              {
                name: "Shoulder Width",
                weight: "20%",
                ideal: "Shoulder span = 1.45× torso height",
                cap: "Requires hip detection",
                how: "Your shoulder span in pixels divided by your torso height (shoulder midpoint to hip midpoint). Scale: 0.85× → 0, 1.45× → 10. Research baseline (Hughes & Gallup 2003): average male = ~1.00–1.10×, elite aesthetic = 1.35–1.45×.",
              },
              {
                name: "Chest",
                weight: "20%",
                ideal: "Shoulder span = 1.40× torso height",
                cap: "Requires hip detection",
                how: "Similar geometry to Shoulder Width but scored on a slightly more lenient scale (0.80× → 0, 1.40× → 10). Captures how imposing your upper body looks relative to your overall frame.",
              },
              {
                name: "Arm Development",
                weight: "15%",
                ideal: "Elbow spread ≥ 1.15× shoulder width",
                cap: "Hard cap at 7.5 — ratio > 1.25 = suspicious",
                how: "Elbow-to-elbow width relative to shoulder width. Bigger arms push elbows further out. Scale: 0.72× → 0, 1.15× → 7.5 max. If elbow spread exceeds 1.25× shoulder width, it's flagged as likely gaming (arms held wide) or lighting artifact and capped at 6.5. The remaining 2.5 points are reserved for when vision-model muscle definition is added.",
              },
              {
                name: "Symmetry",
                weight: "13%",
                ideal: "< 2% left/right deviation",
                cap: "None",
                how: "Compares total arm length (shoulder→elbow + elbow→wrist) left vs right, plus shoulder height difference. Both contribute to a combined deviation score. Based on bilateral proportion research. Falls back to shoulder-level only when elbows or wrists aren't detected.",
              },
              {
                name: "Arm Proportion",
                weight: "5%",
                ideal: "Upper arm : forearm = 1.18",
                cap: "None",
                how: "Ratio of upper arm length (shoulder→elbow) to forearm length (elbow→wrist). Bell-curve scored around 1.18 — the McCallum / Steve Reeves classical ideal. Sensitivity: 30 points per unit of deviation. Excluded when elbows or wrists aren't visible.",
              },
              {
                name: "Posture",
                weight: "3%",
                ideal: "Shoulders level, head centred",
                cap: "None",
                how: "Shoulder tilt angle (height difference left vs right, relative to shoulder width) plus how well your nose aligns over the centre of your shoulders. Tilting, leaning, or standing off-axis all reduce this score.",
              },
            ].map(({ name, weight, ideal, cap, how }) => (
              <div key={name} className="bg-zinc-900 rounded-xl p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-bold">{name}</span>
                  <span className="text-zinc-500 text-sm font-black">{weight}</span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div className="text-[11px] text-zinc-500 tracking-wide uppercase">Ideal: {ideal}</div>
                  <div className="text-[11px] text-yellow-600/80 tracking-wide uppercase">{cap}</div>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{how}</p>
              </div>
            ))}
          </div>
        </section>

        {/* What you see */}
        <section className="space-y-6">
          <div className="text-xs tracking-widest text-zinc-600 uppercase">What you see on screen</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                label: "Overall score",
                color: "#00ff88",
                desc: "A 0–10 composite from all available factors. Partial if hips aren't detected.",
              },
              {
                label: "DOM",
                color: "#00ff88",
                desc: "Your highest-scoring factor — your physical standout. Green.",
              },
              {
                label: "FLAW",
                color: "#f87171",
                desc: "Your lowest-scoring factor — what's pulling your score down. Red.",
              },
            ].map(({ label, color, desc }) => (
              <div key={label} className="bg-zinc-900 rounded-xl p-4 space-y-2">
                <div className="font-bold text-sm" style={{ color }}>{label}</div>
                <p className="text-zinc-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Overlay legend */}
        <section className="space-y-6">
          <div className="text-xs tracking-widest text-zinc-600 uppercase">Reading the overlay</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                label: "Large green dot + glow",
                color: "#00ff88",
                solid: true,
                desc: "A primary measurement point — shoulder, elbow, wrist, or hip. These directly feed into your score.",
              },
              {
                label: "Small faint green dot",
                color: "rgba(0,255,136,0.35)",
                solid: true,
                desc: "Secondary posture anchor (nose, ears). Used only for head/spine alignment check. No physique score impact.",
              },
              {
                label: "Gold dashed dot",
                color: "#f5c842",
                solid: false,
                desc: "The ideal target landmark position — where your skeleton should be for a perfect-proportion physique anchored to your torso.",
              },
              {
                label: "Gold dashed line",
                color: "#f5c842",
                solid: false,
                desc: "The ideal skeleton outline connecting those target points. The gap between gold and green is your score gap.",
              },
            ].map(({ label, color, solid, desc }) => (
              <div key={label} className="bg-zinc-900 rounded-xl p-4 flex gap-4 items-start">
                <div className="flex-shrink-0 mt-1">
                  <div
                    className="w-4 h-4 rounded-full border-2"
                    style={{
                      backgroundColor: solid ? color : "transparent",
                      borderColor: color,
                      borderStyle: solid ? "solid" : "dashed",
                    }}
                  />
                </div>
                <div>
                  <div className="text-white text-sm font-semibold mb-1">{label}</div>
                  <div className="text-zinc-500 text-xs leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Accuracy tips */}
        <section className="border border-zinc-800 rounded-xl p-6 space-y-3">
          <div className="text-xs tracking-widest text-zinc-600 uppercase">Tips for an accurate scan</div>
          <ul className="space-y-2 text-sm text-zinc-400">
            {[
              "Show your full upper body — waist to neck — so hip landmarks are detected and V-Taper can be scored",
              "Wear fitted or no shirt — loose fabric hides shoulder width and obscures elbow position",
              "Stand 4–6 ft from the camera — too close cuts off your hips, too far reduces landmark precision",
              "Keep arms slightly away from your body — arms pinned to your sides compress the elbow spread reading",
              "Use front lighting — shadows shift where the model detects your elbows and can inflate or deflate Arm Dev",
              "Stand square to the camera — side angles distort every width measurement simultaneously",
            ].map((tip) => (
              <li key={tip} className="flex gap-3">
                <span className="text-[#00ff88] flex-shrink-0">→</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="flex justify-center pb-8">
          <Link
            href="/scan"
            className="px-10 py-3 bg-[#00ff88] text-black font-black tracking-widest uppercase text-sm rounded-lg
              hover:bg-[#00e87a] transition-colors shadow-[0_0_30px_rgba(0,255,136,0.25)]"
          >
            Start scanning →
          </Link>
        </div>
      </div>
    </main>
  );
}
