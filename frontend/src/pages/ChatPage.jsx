import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { fetchConversations, fetchMessages, sendMessage, createConversation, fetchChatUsers } from "../api/chat";
import TopBar from "../components/layout/TopBar";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { Send, Plus, MessageSquare, ArrowLeft, UserPlus } from "lucide-react"; // Added UserPlus
import { getSocket } from "../services/socketService";

const ChatPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loadingConv, setLoadingConv] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false); // Added loading state for users
  const messagesEndRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const styles = {
    card: "bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden",
    input: "w-full rounded-xl px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 dark:focus:ring-indigo-500 dark:text-white",
    activeItem: "bg-green-50 dark:bg-blue-900 border-l-4 border-green-500 dark:border-blue-500",
    item: "hover:bg-gray-50 dark:hover:bg-gray-700 border-l-4 border-transparent cursor-pointer transition-all",
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 1. Initial Data Load
  const loadConversations = async () => {
    setLoadingConv(true);
    try {
      const data = await fetchConversations();
      // Ensure data is an array
      setConversations(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load conversations", e);
      setConversations([]);
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    loadConversations();
    
    const socket = getSocket();
    if (socket) {
      socket.on("chat_message", (msg) => {
        if (activeConvId && msg.conversationId === activeConvId) {
          setMessages((prev) => [...prev, msg]);
          scrollToBottom();
        }
        loadConversations(); 
      });
    }
    return () => {
      if (socket) socket.off("chat_message");
    };
  }, [activeConvId]);

  // 2. Load Messages when Active Chat changes
  useEffect(() => {
    if (!activeConvId) return;
    const loadMsgs = async () => {
      try {
        const data = await fetchMessages(activeConvId);
        setMessages(Array.isArray(data) ? data : []);
        scrollToBottom();
      } catch (e) { 
        console.error(e);
        setMessages([]);
      }
    };
    loadMsgs();
  }, [activeConvId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConvId) return;
    const tempText = inputText;
    setInputText(""); 
    try {
      await sendMessage(activeConvId, tempText);
    } catch (e) {
      console.error("Send failed", e);
      setInputText(tempText);
    }
  };

  const handleNewChatClick = async () => {
    setShowNewChatModal(true);
    setLoadingUsers(true);
    try {
      const users = await fetchChatUsers();
      setAvailableUsers(Array.isArray(users) ? users : []);
    } catch (error) {
      console.error("Failed to fetch users", error);
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  };

  const startChat = async (targetUserId) => {
    try {
      // Check if conversation already exists in state
      const existing = conversations.find(c => 
        c.type === 'dm' && c.participants.some(p => p.id === targetUserId)
      );

      if (existing) {
        setActiveConvId(existing.id);
        setShowNewChatModal(false);
        return;
      }

      const res = await createConversation({ type: 'dm', participantIds: [targetUserId] });
      await loadConversations();
      setActiveConvId(res.id);
      setShowNewChatModal(false);
    } catch (e) { console.error(e); }
  };

  const getConvMeta = (c) => {
    if (!c) return { name: "Unknown", img: null };
    if (c.type === 'dm') {
      const other = c.participants?.find(p => p.id !== user?.id) || c.participants?.[0] || {};
      return { name: other.name || "User", img: other.profilePicture };
    }
    return { name: c.name || "Group Chat", img: null };
  };

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 transition-colors duration-300">
      <div className="min-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
        {/* Header (top-bar card applied below) */}
          {/* Header */}
          <div className="mb-4">
            <div className="rounded-2xl bg-white dark:bg-gray-800 surface-elevation-3 px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 rounded-xl bg-green-300 dark:bg-indigo-900 surface-elevation-2">
                  <MessageSquare className="h-6 w-6 text-green-800 dark:text-indigo-200" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white truncate transition-colors duration-300">{t("chat.title", "Messages")}</h1>
                  <p className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 max-w-2xl">{t("chat.subtitle", "Chat with colleagues")}</p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <TopBar />
              </div>
            </div>
          </div>

        <div className={`${styles.card} flex-1 flex`}>
          {/* Sidebar List */}
          <div className={`${isMobile && activeConvId ? 'hidden' : 'flex'} w-full md:w-80 border-r border-gray-100 dark:border-gray-700 flex-col bg-white dark:bg-gray-800`}>
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <span className="font-semibold text-gray-700 dark:text-gray-200">{t("chat.recent", "Chats")}</span>
              <button 
                onClick={handleNewChatClick} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition text-green-600 dark:text-indigo-400"
                title="New Chat"
              >
                <Plus size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingConv ? (
                <div className="p-4 text-center text-gray-400">{t("chat.loading", "Loading...")}</div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full mb-3">
                    <MessageSquare className="text-gray-400" size={24} />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">{t("chat.noConversations", "No conversations yet.")}</p>
                  <button 
                    onClick={handleNewChatClick}
                    className="px-4 py-2 bg-green-600 dark:bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 dark:hover:bg-blue-700 transition"
                  >
                    {t("chat.startNewChat", "Start New Chat")}
                  </button>
                </div>
              ) : (
                conversations.map(c => {
                  const meta = getConvMeta(c);
                  return (
                    <div 
                      key={c.id} 
                      onClick={() => setActiveConvId(c.id)}
                      className={`p-4 flex items-center gap-3 ${c.id === activeConvId ? styles.activeItem : styles.item}`}
                    >
                      <AuthenticatedImage src={meta.img} fallbackName={meta.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <h4 className="font-medium text-gray-900 dark:text-white truncate">{meta.name}</h4>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : ''}</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                          {c.lastMessage || <span className="italic text-xs opacity-60">{t("chat.noMessagesYet", "No messages yet")}</span>}
                        </p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="w-5 h-5 bg-green-500 dark:bg-indigo-500 text-white text-xs flex items-center justify-center rounded-full flex-shrink-0">
                          {c.unreadCount}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${isMobile && !activeConvId ? 'hidden' : 'flex'} flex-1 flex-col bg-gray-100 dark:bg-gray-900/50`}>
            {activeConvId ? (
              <>
                {/* Chat Header */}
                <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                  <button onClick={() => setActiveConvId(null)} className="md:hidden mr-1 p-1 -ml-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                    <ArrowLeft className="text-gray-600 dark:text-gray-300" size={20} />
                  </button>
                  {(() => {
                    const activeMeta = getConvMeta(conversations.find(c => c.id === activeConvId));
                    return (
                      <>
                        <AuthenticatedImage src={activeMeta.img} fallbackName={activeMeta.name} className="w-10 h-10 rounded-full flex-shrink-0" />
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-white">{activeMeta.name}</h3>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{t("chat.active", "Active")}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-900 dark:text-white">
                      <p className="text-2xl text-gray-900 dark:text-white">{t("chat.sayHello", "Say hello! 👋")}</p>
                    </div>
                  ) : (
                    messages.map((m, i) => {
                      const isMe = m.senderId === user?.id;
                      return (
                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] md:max-w-[70%] p-3 rounded-2xl shadow-sm ${
                            isMe 
                              ? 'bg-green-600 dark:bg-indigo-600 text-white rounded-br-none' 
                              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-700'
                          }`}>
                            <p className="text-xl whitespace-pre-wrap break-words text-black dark:text-white">{m.content}</p>
                            <span className={`text-[10px] block text-right mt-1 opacity-70`}>
                              {new Date(m.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                  <form onSubmit={handleSend} className="flex gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={t("chat.placeholder", "Type a message...")}
                      className={styles.input}
                    />
                    <button 
                      type="submit" 
                      disabled={!inputText.trim()}
                      className="p-3 bg-green-600 dark:bg-indigo-600 hover:bg-green-700 dark:hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex-shrink-0"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare size={32} className="opacity-40" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{t("chat.selectConversation", "Select a Conversation")}</h3>
                <p className="max-w-xs mx-auto mb-6 text-gray-500 dark:text-gray-400">{t("chat.chooseConversation", "Choose an existing chat from the left or start a new one.")}</p>
                <button 
                  onClick={handleNewChatClick}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 dark:bg-indigo-600 text-white rounded-xl hover:bg-green-700 dark:hover:bg-indigo-700 transition font-medium shadow-md"
                >
                  <UserPlus size={18} />
                  <span>{t("chat.startNewChat", "Start New Chat")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Chat Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in border border-gray-100 dark:border-gray-700" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-xl font-bold dark:text-white">{t("chat.newMessage", "New Message")}</h3>
              <button onClick={() => setShowNewChatModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition">
                <Plus className="rotate-45 dark:text-white" size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              {loadingUsers ? (
                <div className="py-8 text-center text-gray-500">{t("chat.loadingUsers", "Loading users...")}</div>
              ) : availableUsers.length === 0 ? (
                <div className="py-8 text-center text-gray-500">{t("chat.noUsersFound", "No other users found.")}</div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => startChat(u.id)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl cursor-pointer transition border border-transparent hover:border-gray-200 dark:hover:border-gray-600"
                    >
                      <AuthenticatedImage src={u.profilePicture} fallbackName={u.name} className="w-10 h-10 rounded-full flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="dark:text-white font-medium truncate">{u.name}</div>
                        <div className="text-xs text-gray-500 truncate">@{u.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;