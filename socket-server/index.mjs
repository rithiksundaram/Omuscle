import { createServer } from "http";
import { Server } from "socket.io";

const PORT = process.env.PORT ?? process.env.SOCKET_PORT ?? 3003;

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// roomCode → RoomState
const rooms = new Map();

function generateCode() {
  // No confusable chars (0/O, 1/I/L)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function startCountdown(roomCode) {
  let count = 3;
  io.to(roomCode).emit("phase", { phase: "countdown", count });

  const tick = setInterval(() => {
    count--;
    if (count > 0) {
      io.to(roomCode).emit("phase", { phase: "countdown", count });
    } else {
      clearInterval(tick);
      const room = rooms.get(roomCode);
      if (!room) return;

      room.status = "scanning";
      io.to(roomCode).emit("phase", { phase: "scanning", duration: 15 });

      // Auto-end after 15s
      setTimeout(() => {
        const r = rooms.get(roomCode);
        if (!r || r.status !== "scanning") return;

        r.status = "finished";
        const hs = r.scores.host?.score ?? 0;
        const gs = r.scores.guest?.score ?? 0;
        io.to(roomCode).emit("phase", {
          phase:      "finished",
          hostScore:  hs,
          guestScore: gs,
          hostDom:    r.scores.host?.dominant ?? "—",
          guestDom:   r.scores.guest?.dominant ?? "—",
          winner:     hs > gs ? "host" : gs > hs ? "guest" : "draw",
        });

        // Clean up room after 2 min
        setTimeout(() => rooms.delete(roomCode), 120_000);
        console.log(`Room ${roomCode} finished — host ${hs} vs guest ${gs}`);
      }, 15_000);
    }
  }, 1000);
}

io.on("connection", (socket) => {
  let currentRoom = null;
  let role        = null; // "host" | "guest"

  console.log("+ connect", socket.id);

  // ── Create room ──────────────────────────────────────────────────────────
  socket.on("create-room", () => {
    let code;
    do { code = generateCode(); } while (rooms.has(code));

    rooms.set(code, {
      code,
      host:   socket.id,
      guest:  null,
      status: "waiting",                         // waiting → camera-check → countdown → scanning → finished
      ready:  { host: false, guest: false },
      scores: { host: null, guest: null },
    });

    socket.join(code);
    currentRoom = code;
    role        = "host";

    socket.emit("room-created", { code });
    console.log(`Room ${code} created`);
  });

  // ── Join room ─────────────────────────────────────────────────────────────
  socket.on("join-room", ({ code }) => {
    const upper = (code ?? "").toUpperCase().trim();
    const room  = rooms.get(upper);

    if (!room)                   return socket.emit("join-error", "Room not found — check the code");
    if (room.guest)              return socket.emit("join-error", "Room is full");
    if (room.status !== "waiting") return socket.emit("join-error", "Match already started");

    room.guest  = socket.id;
    room.status = "camera-check";
    socket.join(upper);
    currentRoom = upper;
    role        = "guest";

    // Tell both players to move to camera-check phase
    io.to(upper).emit("phase", { phase: "camera-check" });
    console.log(`Room ${upper}: guest joined`);
  });

  // ── Camera check — player signals body is in frame ────────────────────────
  socket.on("player-ready", () => {
    if (!currentRoom || !role) return;
    const room = rooms.get(currentRoom);
    if (!room || room.status !== "camera-check") return;

    room.ready[role] = true;
    io.to(currentRoom).emit("ready-update", { host: room.ready.host, guest: room.ready.guest });

    if (room.ready.host && room.ready.guest) {
      room.status = "countdown";
      startCountdown(currentRoom);
    }
    console.log(`Room ${currentRoom}: ${role} ready (host=${room.ready.host} guest=${room.ready.guest})`);
  });

  // ── Score update during scan ───────────────────────────────────────────────
  socket.on("score-update", ({ score, dominant, flaw }) => {
    if (!currentRoom || !role) return;
    const room = rooms.get(currentRoom);
    if (!room || room.status !== "scanning") return;

    room.scores[role] = { score, dominant, flaw };
    socket.to(currentRoom).emit("opponent-score", { score, dominant, flaw });
  });

  // ── WebRTC signaling relay (peer-to-peer video/audio) ─────────────────────
  socket.on("webrtc-signal", ({ type, payload }) => {
    if (!currentRoom || !role) return;
    const room = rooms.get(currentRoom);
    if (!room) return;
    const targetId = role === "host" ? room.guest : room.host;
    if (targetId) io.to(targetId).emit("webrtc-signal", { type, payload });
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    if (currentRoom) {
      io.to(currentRoom).emit("phase", { phase: "error", reason: "Opponent disconnected" });
      rooms.delete(currentRoom);
      console.log(`Room ${currentRoom} deleted — ${socket.id} left`);
    }
    console.log("- disconnect", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`🔌  Omuscle socket server  →  http://localhost:${PORT}`);
});
