"use client";

import dynamic from "next/dynamic";

// MatchRoom uses socket.io + webcam — must be client-only
const MatchRoom = dynamic(() => import("@/components/MatchRoom"), { ssr: false });

export default function MatchPage() {
  return <MatchRoom />;
}
