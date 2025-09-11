const { Server } = require("socket.io");
let io;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: "*" }
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("join", (userId) => {
      if (!userId) return;
      socket.join(`user_${userId}`);
      console.log(`Socket ${socket.id} joined room user_${userId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
}

function emitToUser(userId, event, payload) {
  if (!io) return;
  console.log(`Emitting ${event} to user_${userId}`, payload);
  io.to(`user_${userId}`).emit(event, payload);
}

module.exports = { initSocket, emitToUser };
