import React, { useState, useEffect, useRef } from "react"; 
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { fetchConversations, fetchMessages, sendMessage, createConversation, fetchChatUsers } from "../api/chat";
import TopBar from "../components/layout/TopBar";
import AuthenticatedImage from "../components/common/AuthenticatedImage";
import { Send, Plus, MessageSquare, ArrowLeft, UserPlus } from "lucide-react";
import Toast from "../components/common/Toast";
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
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [toast, setToast] = useState(null);
  const showToast = (text, type = "info") => setToast({ text, type });
  const handleToastClose = () => setToast(null);

  const messagesEndRef = useRef(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const lightColors = {
    primary: "#10B981",
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBF7D0",
    onPrimaryContainer: "#047857",
    surfaceContainerLow: "#F8FAFB",
    surfaceContainer: "#F4F6F8",
    surfaceContainerHigh: "#EEF2F7",
    surfaceContainerHighest: "#EEF2F7",
    onSurface: "#111827",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
  };

  const darkColors = {
    primary: "#4ADE80",
    onPrimary: "#002115",
    primaryContainer: "#003925",
    onPrimaryContainer: "#BBF7D0",
    surfaceContainerLow: "#2D2F2C",
    surfaceContainer: "#313330",
    surfaceContainerHigh: "#3B3D3A",
    surfaceContainerHighest: "#454744",
    onSurface: "#E1E3DD",
    onSurfaceVariant: "#C2C9C2",
    outline: "#8C948D",
  };

  const m3Colors = darkMode ? darkColors : lightColors;

  const styles = {
    card: `bg-[var(--surface-container)] dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden`,
    input: `w-full rounded-xl px-4 py-3 bg-gray-200 dark:bg-gray-900 border border-gray-400 dark:border-gray-700 focus:outline-none dark:text-white`,
    activeItem: `bg-[var(--primary-container)] dark:bg-indigo-900 border-l-4 border-[var(--primary)] dark:border-indigo-400`,
    item: `hover:bg-gray-200 dark:hover:bg-gray-700 border-l-4 border-transparent cursor-pointer transition-all`,
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadConversations = async () => {
    setLoadingConv(true);
    try {
      const data = await fetchConversations();
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
    <div 
      className="min-h-screen font-sans bg-[var(--surface-container-low)] dark:bg-gray-900 p-4 transition-colors duration-300"
      style={{
        "--primary": m3Colors.primary,
        "--on-primary": m3Colors.onPrimary,
        "--primary-container": m3Colors.primaryContainer,
        "--on-primary-container": m3Colors.onPrimaryContainer,
        "--surface-container-low": m3Colors.surfaceContainerLow,
        "--surface-container": m3Colors.surfaceContainer,
        "--surface-container-high": m3Colors.surfaceContainerHigh,
        "--surface-container-highest": m3Colors.surfaceContainerHighest,
        "--on-surface": m3Colors.onSurface,
        "--on-surface-variant": m3Colors.onSurfaceVariant,
        "--outline": m3Colors.outline,
      }}
    >
      <div className="min-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 shadow-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[var(--primary-container)] dark:bg-indigo-900 rounded-xl">
                <MessageSquare className="h-6 w-6 text-[var(--on-primary-container)] dark:text-indigo-200" />
              </div>
              <h1 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white">{t("chat.title", "Messages")}</h1>
            </div>
            <div>
              <TopBar />
            </div>
          </div>
        </div>

        <div className={`${styles.card} flex-1 flex overflow-hidden`}>
          {/* Sidebar */}
          <div className={`${isMobile && activeConvId ? 'hidden' : 'flex'} w-full md:w-80 flex-col border-r-2 border-[var(--outline)]`}>
            <div className="p-4 border-b-2 border-[var(--outline)] flex justify-between items-center">
              <span className="font-semibold text-black dark:text-white">{t("chat.recent", "Chats")}</span>
              <button 
                onClick={handleNewChatClick} 
                className="p-2 text-green-400 dark:text-indigo-800 hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 rounded-full transition text-[var(--primary)]"
                title="New Chat"
              >
                <Plus size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingConv ? (
                <div className="p-4 text-center text-[var(--on-surface-variant)]">{t("chat.loading", "Loading...")}</div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <div className="p-3 bg-[var(--primary-container)] dark:bg-indigo-900 rounded-full mb-3">
                    <MessageSquare className="text-[var(--on-primary-container)] dark:text-indigo-200" size={24} />
                  </div>
                  <p className="text-black dark:text-white text-sm mb-4">{t("chat.noConversations", "No conversations yet.")}</p>
                  <button 
                    onClick={handleNewChatClick}
                    className="px-4 py-2 bg-[var(--primary-container)] dark:bg-indigo-900 text-[var(--on-primary-container)] dark:text-indigo-200 rounded-lg text-sm font-medium hover:bg-[var(--primary-container)] transition"
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
                          <h4 className="font-medium text-black dark:text-white truncate">{meta.name}</h4>
                          <span className="text-xs text-black dark:text-white flex-shrink-0 ml-2">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : ''}</span>
                        </div>
                        <p className="text-sm text-black dark:text-white truncate">
                          {c.lastMessage || <span className="italic text-xs opacity-60">{t("chat.noMessagesYet", "No messages yet")}</span>}
                        </p>
                      </div>
                      {c.unreadCount > 0 && (
                        <span className="w-5 h-5 bg-[var(--primary)] dark:bg-indigo-800 text-[var(--on-primary)] text-xs flex items-center justify-center rounded-full flex-shrink-0">
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
          <div className={`${isMobile && !activeConvId ? 'hidden' : 'flex'} flex-1 flex-col bg-[var(--surface-container-low)] dark:bg-gray-900`}>
            {activeConvId ? (
              <>
                {/* Chat Header */}
                <div className="p-4 bg-[var(--surface-container)] dark:bg-gray-800 border-b border-[var(--outline)] flex items-center gap-3">
                  <button onClick={() => setActiveConvId(null)} className="md:hidden mr-1 p-1 -ml-1 rounded-full hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700">
                    <ArrowLeft className="text-[var(--on-surface-variant)]" size={20} />
                  </button>
                  {(() => {
                    const activeMeta = getConvMeta(conversations.find(c => c.id === activeConvId));
                    return (
                      <>
                        <AuthenticatedImage src={activeMeta.img} fallbackName={activeMeta.name} className="w-10 h-10 rounded-full flex-shrink-0" />
                        <div>
                          <h3 className="font-bold text-[var(--on-surface)] dark:text-white">{activeMeta.name}</h3>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-[var(--primary)] rounded-full"></span>
                            <span className="text-xs text-black dark:text-white">{t("chat.active", "Active")}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <p className="text-black dark:text-white">{t("chat.sayHello", "Say hello!")} 👋</p>
                    </div>
                  ) : (
                    messages.map((m, i) => {
                      const isMe = m.senderId === user?.id;
                      return (
                        <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] md:max-w-[70%] p-3 rounded-2xl shadow-sm ${
                            isMe 
                              ? 'bg-[var(--primary-container)] dark:bg-indigo-900 text-black dark:text-white rounded-br-none' 
                              : 'bg-[var(--surface-container)] dark:bg-gray-800 text-[var(--on-surface)] dark:text-white rounded-bl-none border border-[var(--outline)]'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap break-words text-black dark:text-white">{m.content}</p>
                            <span className={`text-[10px] block text-right mt-1 opacity-70 text-black dark:text-white`}>
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
                <div className="p-4 bg-[var(--surface-container)] dark:bg-gray-800 border-t border-[var(--outline)]">
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
                      className="p-3 bg-[var(--primary-container)] dark:bg-indigo-900 text-[var(--on-primary-container)] dark:text-indigo-200 hover:bg-[var(--primary-container)] rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex-shrink-0"
                    >
                      <Send size={20} />
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--on-surface-variant)] p-8 text-center">
                <div className="w-16 h-16 bg-[var(--primary-container)] dark:bg-indigo-900 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare size={32} className="text-[var(--on-primary-container)] dark:text-indigo-200" />
                </div>
                <h3 className="text-lg font-semibold text-black dark:text-white mb-2">{t("chat.selectConversation", "Select a Conversation")}</h3>
                <p className="max-w-xs mx-auto mb-6 text-black dark:text-white">{t("chat.chooseConversation", "Choose an existing chat from the left or start a new one.")}</p>
                <button 
                  onClick={handleNewChatClick}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary-container)] dark:bg-indigo-900 text-[var(--on-primary-container)] dark:text-indigo-200 rounded-xl hover:bg-[var(--primary-container)] transition font-medium shadow-md"
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
          <div className="bg-[var(--surface-container)] dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-fade-in border border-[var(--outline)]" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h3 className="text-xl font-bold dark:text-white">{t("chat.newMessage", "New Message")}</h3>
              <button onClick={() => setShowNewChatModal(false)} className="p-1 hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 rounded-full transition">
                <Plus className="rotate-45 dark:text-white" size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              {loadingUsers ? (
                <div className="py-8 text-center text-[var(--on-surface-variant)]">{t("chat.loadingUsers", "Loading users...")}</div>
              ) : availableUsers.length === 0 ? (
                <div className="py-8 text-center text-[var(--on-surface-variant)]">{t("chat.noUsersFound", "No other users found.")}</div>
              ) : (
                <div className="space-y-2">
                  {availableUsers.map(u => (
                    <div 
                      key={u.id} 
                      onClick={() => startChat(u.id)}
                      className="flex items-center gap-3 p-3 hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 rounded-xl cursor-pointer transition border border-transparent hover:border-[var(--outline)]"
                    >
                      <AuthenticatedImage src={u.profilePicture} fallbackName={u.name} className="w-10 h-10 rounded-full flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="dark:text-white font-medium truncate">{u.name}</div>
                        <div className="text-xs text-black dark:text-white opacity-60 truncate">@{u.username}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <Toast text={toast.text} type={toast.type} onClose={handleToastClose} />}
    </div>
  );
};

export default ChatPage;