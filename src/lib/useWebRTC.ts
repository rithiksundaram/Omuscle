"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const STUN = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useWebRTC(socketRef: React.RefObject<any>, role: "host" | "guest" | null, active: boolean) {
  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const localStreamRef   = useRef<MediaStream | null>(null);
  const pendingOfferRef  = useRef<RTCSessionDescriptionInit | null>(null); // offer arrived before our stream
  const iceCandidates    = useRef<RTCIceCandidateInit[]>([]);              // ICE before remoteDesc is set
  const offerSentRef     = useRef(false);                                  // host: only send offer once

  // Stored so setLocalStream can call processOffer after stream arrives
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processOfferRef  = useRef<((offer: any) => Promise<void>) | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!active) return;
    const socket = socketRef.current;
    if (!socket) return;

    // Fresh stream accumulator for this session
    const remoteMS = new MediaStream();

    const pc = new RTCPeerConnection({ iceServers: STUN });
    pcRef.current  = pc;
    offerSentRef.current = false;

    // ── ICE candidates ────────────────────────────────────────────────────────
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        socket.emit("webrtc-signal", { type: "ice", payload: candidate.toJSON() });
      }
    };

    // ── Incoming remote tracks → update display stream ─────────────────────
    pc.ontrack = ({ track, streams }) => {
      const src = streams?.[0];
      if (src) {
        src.getTracks().forEach(t => {
          if (!remoteMS.getTrackById(t.id)) remoteMS.addTrack(t);
        });
      } else {
        if (!remoteMS.getTrackById(track.id)) remoteMS.addTrack(track);
      }
      setRemoteStream(new MediaStream(remoteMS.getTracks()));
    };

    // ── Flush queued ICE candidates once remote description is set ───────────
    const flushIce = async () => {
      for (const c of iceCandidates.current) {
        try { await pc.addIceCandidate(c); } catch { /* ignore stale */ }
      }
      iceCandidates.current = [];
    };

    // ── Process an incoming offer: set remote desc, add our tracks, answer ──
    const processOffer = async (offer: RTCSessionDescriptionInit) => {
      await pc.setRemoteDescription(offer);

      // Add our local tracks so the answer carries our video+audio
      const stream = localStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          if (!pc.getSenders().find(s => s.track?.kind === track.kind)) {
            pc.addTrack(track, stream);
          }
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("webrtc-signal", { type: "answer", payload: pc.localDescription });
      await flushIce();
    };

    // Expose for setLocalStream to call if offer arrived early
    processOfferRef.current = processOffer;

    // ── Incoming WebRTC signals ───────────────────────────────────────────────
    const onSignal = async ({ type, payload }: { type: string; payload: RTCSessionDescriptionInit & RTCIceCandidateInit }) => {
      try {
        if (type === "offer") {
          // If our camera isn't ready yet, queue the offer and process it in setLocalStream
          if (!localStreamRef.current) {
            pendingOfferRef.current = payload;
            return;
          }
          await processOffer(payload);

        } else if (type === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(payload);
            await flushIce();
          }

        } else if (type === "ice") {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(payload);
          } else {
            // Queue until we have a remote description
            iceCandidates.current.push(payload);
          }
        }
      } catch (err) {
        console.warn("[WebRTC]", type, err);
      }
    };

    socket.on("webrtc-signal", onSignal);

    return () => {
      socket.off("webrtc-signal", onSignal);
      processOfferRef.current = null;
      pc.close();
      pcRef.current = null;
    };
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Call this when BodyScanner's local camera stream is ready.
   *
   * - Adds/replaces tracks in the RTCPeerConnection.
   * - Host: sends the initial offer (once).
   * - Guest: if an offer was queued (arrived before stream), processes it now.
   */
  const setLocalStream = useCallback(async (stream: MediaStream) => {
    localStreamRef.current = stream;
    const pc = pcRef.current;
    if (!pc) return;

    // Add or hot-swap tracks (replaceTrack avoids renegotiation when possible)
    for (const track of stream.getTracks()) {
      const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
      if (sender) {
        await sender.replaceTrack(track);
      } else {
        pc.addTrack(track, stream);
      }
    }

    // Host sends the initial offer exactly once
    if (role === "host" && !offerSentRef.current) {
      offerSentRef.current = true;
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit("webrtc-signal", { type: "offer", payload: pc.localDescription });
      } catch (err) {
        console.warn("[WebRTC] offer error:", err);
      }
      return;
    }

    // Guest: if an offer arrived before our stream was ready, process it now
    if (role === "guest" && pendingOfferRef.current && processOfferRef.current) {
      const offer = pendingOfferRef.current;
      pendingOfferRef.current = null;
      await processOfferRef.current(offer);
    }
  }, [role]); // eslint-disable-line react-hooks/exhaustive-deps

  return { remoteStream, setLocalStream };
}
