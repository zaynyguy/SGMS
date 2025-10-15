import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

let socket = null;
let currentUserId = null;

export function initNotificationsSocket(userId, onNewNotification) {
  if (!userId) return;

  // reuse existing socket for same user
  if (socket && currentUserId === userId) {
    socket.off("notification:new");
    if (onNewNotification) socket.on("notification:new", onNewNotification);
    return;
  }

  // replace socket if different user or not created
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
    currentUserId = null;
  }

  const token = window.__ACCESS_TOKEN || localStorage.getItem("authToken");

  socket = io(SOCKET_URL, {
    withCredentials: true,
    auth: token ? { token } : undefined,
    transports: ["websocket", "polling"],
  });

  currentUserId = userId;

  // join room on connect (silent)
  socket.on("connect", () => {
    try { socket.emit("join", userId); } catch {}
  });

  // only log real connection errors
  socket.on("connect_error", (err) => {
    console.error("Socket connect_error", err);
  });

  socket.on("reconnect_error", (err) => {
    console.error("Socket reconnect_error", err);
  });

  // forward incoming notifications to provided callback; no console.log here
  socket.on("notification:new", (notification) => {
    if (onNewNotification) onNewNotification(notification);
  });

  // only log unexpected disconnect reasons (keep console quiet for expected client disconnect)
  socket.on("disconnect", (reason) => {
    if (reason && reason !== "io client disconnect") {
      console.error("Socket disconnected:", reason);
    }
  });
}

export function disconnectNotificationsSocket() {
  if (socket) {
    try { socket.disconnect(); } catch {}
    socket = null;
    currentUserId = null;
  }
}
