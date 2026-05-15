"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

// BodyScanner uses browser APIs — load only client-side
const BodyScanner = dynamic(() => import("@/components/BodyScanner"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video bg-zinc-950 rounded-xl border border-zinc-800 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

export default function ScanPage() {
  return (
    <main className="min-h-screen bg-[#080808] text-white flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors text-sm flex items-center gap-1">← Home</Link>
          <Link href="/" className="text-base font-black tracking-widest text-[#00ff88]">
            OMUSCLE
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/how-it-works" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors tracking-wide">
            How it works
          </Link>
          <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-400 tracking-widest uppercase">
            SOLO SCAN
          </div>
        </div>
      </nav>

      {/* Main scan area */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 py-8 max-w-4xl mx-auto w-full">
        {/* Instruction banner */}
        <div className="w-full mb-5 flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse flex-shrink-0" />
          <p className="text-zinc-400 text-xs tracking-wide">
            <span className="text-white font-semibold">For best results:</span> Fitted or no shirt · Stand 4–6 ft back · Arms slightly away from body · Good lighting
          </p>
        </div>

        {/* The scanner */}
        <div className="w-full">
          <BodyScanner />
        </div>

        {/* Legend */}
        <div className="mt-5 flex items-center gap-6 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#00ff88] rounded" />
            <span>Detected skeleton</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 border-t border-dashed border-[#f5c842]" />
            <span>Ideal proportions</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#f5c842]" />
            <span>Target landmarks</span>
          </div>
        </div>

        {/* Score scale reference */}
        <div className="mt-6 w-full max-w-sm">
          <div className="text-[10px] text-zinc-700 tracking-widest uppercase mb-2">Score guide</div>
          <div className="flex gap-1">
            {[
              { range: "0–4",  label: "Novice",   color: "#f87171" },
              { range: "4–6",  label: "Average",  color: "#facc15" },
              { range: "6–8",  label: "Athletic", color: "#a3e635" },
              { range: "8–10", label: "Elite",    color: "#00ff88" },
            ].map(({ range, label, color }) => (
              <div key={range} className="flex-1 text-center">
                <div className="h-1 rounded-full mb-1" style={{ backgroundColor: color }} />
                <div className="text-[9px]" style={{ color }}>{label}</div>
                <div className="text-[8px] text-zinc-700">{range}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
