"use client";

import { useState } from "react";

interface Props {
  connected: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  error: string | null;
}

export default function MatchLobby({ connected, onCreate, onJoin, error }: Props) {
  const [view, setView]     = useState<"home" | "join">("home");
  const [code, setCode]     = useState("");
  const [joining, setJoining] = useState(false);

  function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 4) return;
    setJoining(true);
    onJoin(trimmed);
  }

  return (
    <div className="min-h-screen bg-[#080808] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="text-[#00ff88] text-xs tracking-widest uppercase font-bold">Private Match</div>
          <h1 className="text-3xl font-black tracking-tight">Challenge a friend</h1>
          <p className="text-zinc-500 text-sm">
            Create a room and share the code, or enter a code to join someone else&apos;s match.
          </p>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center justify-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-[#00ff88]" : "bg-zinc-600 animate-pulse"}`} />
          <span className="text-xs text-zinc-600">{connected ? "Connected to match server" : "Connecting…"}</span>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        {view === "home" && (
          <div className="space-y-3">
            {/* Create */}
            <button
              onClick={onCreate}
              disabled={!connected}
              className="w-full py-4 bg-[#00ff88] text-black font-black tracking-widest uppercase rounded-lg
                hover:bg-[#00e87a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors
                shadow-[0_0_30px_rgba(0,255,136,0.2)]"
            >
              Create private match
            </button>

            {/* Join */}
            <button
              onClick={() => setView("join")}
              disabled={!connected}
              className="w-full py-4 border border-zinc-700 text-white font-bold tracking-widest uppercase rounded-lg
                hover:border-zinc-500 hover:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Join with code
            </button>
          </div>
        )}

        {view === "join" && (
          <div className="space-y-4">
            <button onClick={() => { setView("home"); setCode(""); setJoining(false); }} className="text-zinc-500 text-sm hover:text-white transition-colors flex items-center gap-1">
              ← Back
            </button>

            <div className="space-y-3">
              <input
                autoFocus
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                maxLength={6}
                placeholder="ENTER CODE"
                className="w-full px-5 py-4 bg-zinc-900 border border-zinc-700 rounded-lg text-white
                  font-black text-2xl tracking-[0.3em] text-center placeholder:text-zinc-700
                  focus:outline-none focus:border-[#00ff88] transition-colors uppercase"
              />
              <button
                onClick={handleJoin}
                disabled={code.trim().length < 4 || joining}
                className="w-full py-4 bg-[#00ff88] text-black font-black tracking-widest uppercase rounded-lg
                  hover:bg-[#00e87a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {joining ? "Joining…" : "Join match"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
