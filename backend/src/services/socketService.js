const { Server } = require("socket.io");

let io = null;
let pendingQueue = [];

function initSocket(httpServer) {
  if (io) return io;

  // Normalize FRONTEND_ORIGIN into an array (socket.io expects string/array/regex)
  const raw = process.env.FRONTEND_ORIGIN || "";
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: origins.length ? origins : true,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // minimal listeners: join/leave and error handling
    socket.on("join", (userId) => {
      if (!userId) return;
      try {
        socket.join(`user_${userId}`);
      } catch (e) {}
    });

    socket.on("leave", (userId) => {
      if (!userId) return;
      try {
        socket.leave(`user_${userId}`);
      } catch (e) {}
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err);
    });
  });

  // flush any queued emits (if any)
  if (pendingQueue.length > 0) {
    for (const { userId, event, payload } of pendingQueue) {
      try {
        io.to(`user_${userId}`).emit(event, payload);
      } catch (e) {
        /* ignore */
      }
    }
    pendingQueue = [];
  }

  return io;
}

function emitToUser(userId, event, payload) {
  if (!userId || !event) return;
  if (!io) {
    pendingQueue.push({ userId, event, payload });
    if (pendingQueue.length > 1000) pendingQueue.shift();
    return;
  }
  try {
    io.to(`user_${userId}`).emit(event, payload);
  } catch (err) {
    console.error("emitToUser failed:", err);
  }
}

module.exports = {
  initSocket,
  emitToUser,
  getIo: () => io,
};
