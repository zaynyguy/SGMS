import { api } from "./auth";

export const fetchConversations = () => api("/api/chat/conversations", "GET");
export const createConversation = (payload) =>
  api("/api/chat/conversations", "POST", payload);
export const fetchMessages = (convId, offset = 0) =>
  api(`/api/chat/conversations/${convId}/messages?offset=${offset}`, "GET");
export const sendMessage = (convId, content) =>
  api(`/api/chat/conversations/${convId}/messages`, "POST", { content });
export const fetchChatUsers = () => api("/api/chat/users", "GET");
