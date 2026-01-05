import { io } from "socket.io-client";

let socket = null;

export const initSocket = (userId) => {
  if (socket) return socket;

  // Use your environment variable or fallback to localhost
  const ENDPOINT = import.meta.env.VITE_API_URL || "http://localhost:5000";

  socket = io(ENDPOINT, {
    withCredentials: true,
    transports: ["websocket"], 
    autoConnect: true,
  });

  socket.on("connect", () => {
    console.log("Connected to Real-time Server");
    // This tells the backend to put this connection in a "room" 
    // specifically for this user so they get their own messages.
    if (userId) {
      socket.emit("join", userId);
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from Real-time Server");
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};