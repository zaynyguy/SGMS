const { Server } = require("socket.io");

let io = null;
let pendingQueue = [];

function initSocket(httpServer) {
  if (io) return io;

  // Normalize FRONTEND_ORIGIN
  const raw = process.env.FRONTEND_ORIGIN || "";
  const origins = raw.split(",").map((s) => s.trim()).filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: origins.length ? origins : true,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    // Standard join room for specific user (e.g., user_1)
    socket.on("join", (userId) => {
      if (!userId) return;
      try {
        socket.join(`user_${userId}`);
      } catch (e) {
        console.error("Socket join error:", e);
      }
    });

    socket.on("leave", (userId) => {
      if (!userId) return;
      try {
        socket.leave(`user_${userId}`);
      } catch (e) {}
    });

    // Optional: Chat specific "typing" event relay
    socket.on("typing", ({ conversationId, userId, userName }) => {
      // Broadcast to specific conversation room if we used rooms, 
      // but here we can just relay to specific users if needed.
      // For simplicity, we rely on backend API triggers for messages.
    });
  });

  return io;
}

// Send to a specific user (Existing function)
function emitToUser(userId, event, payload) {
  if (!userId || !event) return;
  if (!io) {
    // Queue if IO not ready
    if (pendingQueue.length > 1000) pendingQueue.shift();
    pendingQueue.push({ userId, event, payload });
    return;
  }
  try {
    io.to(`user_${userId}`).emit(event, payload);
  } catch (err) {
    console.error("emitToUser failed:", err);
  }
}

// NEW: Send to a list of user IDs (Helper for Chat)
function emitToList(userIds, event, payload) {
  if (!io || !Array.isArray(userIds)) return;
  userIds.forEach((uid) => {
    try {
      io.to(`user_${uid}`).emit(event, payload);
    } catch (e) {
      console.error(`Failed to emit to user ${uid}`, e);
    }
  });
}

module.exports = {
  initSocket,
  emitToUser,
  emitToList, // Export the new helper
  getIo: () => io,
};