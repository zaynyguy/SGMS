// src/components/NotificationPreview.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, CheckCircle, Info, AlertTriangle } from "lucide-react";
import BottomSheet from "../BottomSheet";
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
} from "../../api/notifications";
import {
  initNotificationsSocket,
  disconnectNotificationsSocket,
} from "../../services/notificationsSocket";
export default function NotificationPreview({
  item = { to: "/notification", label: "Notifications" },
  showExpanded = false,
  position = "bottom-left",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const bellRef = useRef(null);
  const hideTimer = useRef(null);
  const toastTimer = useRef(null);

  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, transform: "translate(0,0)" });

  const [latestNew, setLatestNew] = useState(null);
  const [showToast, setShowToast] = useState(false);

  const lastKnownIdRef = useRef(null);
  const shownToastIdsRef = useRef(new Set());

  const [canHover, setCanHover] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.matchMedia && window.matchMedia("(hover: hover)").matches;
    } catch {
      return true;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover)");
    const handler = (e) => setCanHover(!!e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  const TOAST_MS = 4200;
  const POPOVER_WIDTH = 320;
  const POPOVER_HEIGHT = 420;

  const iconFor = (level) => {
    switch (level) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
    }
  };

  const computeCoords = (rect, scrollY, pos) => {
    let top = rect.top + scrollY;
    let left = rect.left;
    const offset = 8;

    switch (pos) {
      case "right":
        top = rect.top + scrollY + rect.height / 2;
        left = rect.right + offset;
        break;
      case "left":
        top = rect.top + scrollY + rect.height / 2;
        left = rect.left - POPOVER_WIDTH - offset;
        break;
      case "top-left":
        top = rect.top + scrollY - POPOVER_HEIGHT - offset;
        left = rect.left;
        break;
      case "top-right":
        top = rect.top + scrollY - POPOVER_HEIGHT - offset;
        left = rect.right - POPOVER_WIDTH;
        break;
      case "bottom-right":
        top = rect.bottom + scrollY + offset;
        left = rect.right - POPOVER_WIDTH;
        break;
      case "bottom-left":
      default:
        top = rect.bottom + scrollY + offset;
        left = rect.left;
        break;
    }

    const minLeft = 8;
    const maxLeft = Math.max(8, window.innerWidth - POPOVER_WIDTH - 60);
    const clampedLeft = Math.min(Math.max(left, minLeft), maxLeft);

    const minTop = (window.scrollY || 0) + 8;
    const maxTop = (window.scrollY || 0) + Math.max(8, window.innerHeight - POPOVER_HEIGHT - 8);
    const clampedTop = Math.min(Math.max(top, minTop), maxTop);

    let transform = "translate(0,0)";
    if (pos === "right" || pos === "left") transform = "translate(0,-50%)";
    return { top: clampedTop, left: clampedLeft, transform };
  };

  const buildDisplayList = (candidates) => {
    const unreadList = (candidates || []).filter((n) => !n.isRead).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const readList = (candidates || []).filter((n) => n.isRead).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const combined = [...unreadList, ...readList];
    return combined.slice(0, 5);
  };

  const loadPreview = async () => {
    try {
      const res = await fetchNotifications(1, 10);
      const rows = res?.rows ?? [];
      setNotifications(rows);
      const u = await fetchUnreadCount();
      setUnread(u?.unread ?? 0);
      lastKnownIdRef.current = rows?.[0]?.id ?? lastKnownIdRef.current;
    } catch (err) {
      console.error("loadPreview failed", err);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      await markNotificationRead(id);
    } catch (err) {
      console.error("mark read failed", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [res, u] = await Promise.all([fetchNotifications(1, 10), fetchUnreadCount()]);
        if (!mounted) return;
        const rows = res?.rows ?? [];
        setNotifications(rows);
        setUnread(u?.unread ?? 0);
        lastKnownIdRef.current = rows?.[0]?.id ?? lastKnownIdRef.current;
      } catch (err) {
        console.error("init notifications failed", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let storedUser = null;
    try {
      storedUser = localStorage.getItem("user");
    } catch {
      storedUser = null;
    }
    const parsedUser = storedUser ? JSON.parse(storedUser) : null;
    const userId = parsedUser?.id || window.__USER_ID || null;

    if (!userId) return;

    let mounted = true;

    const onNewNotification = (payload) => {
      if (!mounted) return;
      const latest = payload?.notification ? payload.notification : payload;
      if (!latest || !latest.id) return;

      if (typeof payload?.unread === "number") setUnread(payload.unread);
      else setUnread((u) => u + 1);

      const knownId = lastKnownIdRef.current;
      const previewTopId = notifications?.[0]?.id;

      if (
        latest.id &&
        latest.id !== knownId &&
        latest.id !== previewTopId &&
        !open &&
        location.pathname !== (item?.to || "/notification") &&
        !shownToastIdsRef.current.has(latest.id)
      ) {
        shownToastIdsRef.current.add(latest.id);
        setLatestNew(latest);
        setShowToast(true);

        setNotifications((prev) => {
          if (!prev) return [latest];
          if (prev[0]?.id === latest.id) return prev;
          return [latest, ...prev].slice(0, 20);
        });

        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => {
          setShowToast(false);
          toastTimer.current = null;
        }, TOAST_MS);

        lastKnownIdRef.current = latest.id;
      } else {
        setNotifications((prev) => {
          if (!prev) return [latest];
          if (prev[0]?.id === latest.id) return prev;
          return [latest, ...prev].slice(0, 20);
        });
        lastKnownIdRef.current = latest.id ?? lastKnownIdRef.current;
      }
    };

    try {
      initNotificationsSocket(userId, onNewNotification);
    } catch (err) {
      console.error("initNotificationsSocket failed:", err);
    }

    return () => {
      mounted = false;
      try {
        disconnectNotificationsSocket();
      } catch {}
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
        toastTimer.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location.pathname]);

  const openPreviewAtBell = () => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const c = computeCoords(rect, scrollY, position);
    setCoords(c);
    setOpen(true);
    loadPreview();
  };

  const closePreview = () => setOpen(false);

  const handleMouseEnter = () => {
    if (!canHover) return;
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    openPreviewAtBell();
  };

  const handleMouseLeave = () => {
    if (!canHover) return;
    hideTimer.current = setTimeout(() => {
      closePreview();
      hideTimer.current = null;
    }, 150);
  };

  const handleBellClick = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (!canHover) {
      setSheetOpen(true);
      loadPreview();
    } else {
      navigate(item?.to || "/notification");
    }
  };

  const handleBellKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleBellClick();
    }
  };

  const navigateAndClearToast = () => {
    setShowToast(false);
    setLatestNew(null);
    lastKnownIdRef.current = notifications?.[0]?.id ?? lastKnownIdRef.current;
    navigate(item?.to || "/notification");
  };

  const popover =
    open && bellRef.current
      ? createPortal(
          <div
            role="dialog"
            aria-label="Recent notifications"
            tabIndex={-1}
            onMouseEnter={() => {
              if (hideTimer.current) {
                clearTimeout(hideTimer.current);
                hideTimer.current = null;
              }
            }}
            onMouseLeave={handleMouseLeave}
            style={{
              position: "absolute",
              top: coords.top,
              left: coords.left,
              transform: coords.transform,
              zIndex: 9999,
              transition: "opacity 160ms ease, transform 160ms ease",
            }}
          >
            <div className="w-80 max-h-[420px] bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="text-sm font-medium text-gray-900 dark:text-white">Notifications</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{unread} unread</div>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700 overflow-y-auto max-h-[340px]">
                {buildDisplayList(notifications).length === 0 && (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400">No notifications</div>
                )}
                {buildDisplayList(notifications).map((n) => (
                  <div key={n.id} className={`flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 ${
                    n.isRead ? "bg-white dark:bg-gray-900" : "bg-blue-50 dark:bg-blue-900/20"
                  }`}>
                    <div className="flex-shrink-0 mt-0.5">{iconFor(n.level)}</div>

                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${
                        n.isRead 
                          ? "text-gray-600 dark:text-gray-300" 
                          : "font-medium text-gray-900 dark:text-white"
                      }`}>
                        {n.message}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {new Date(n.createdAt).toLocaleString()}
                      </div>
                    </div>

                    <div className="ml-2 flex-shrink-0 flex flex-col gap-2">
                      {!n.isRead && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          Mark
                        </button>
                      )}
                      <button
                        onClick={() => {
                          navigate(item?.to || "/notification");
                          closePreview();
                        }}
                        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                      >
                        Open
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <button 
                  onClick={() => navigate(item?.to || "/notification")} 
                  className="text-sm px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  View all
                </button>
                <button 
                  onClick={loadPreview} 
                  className="text-sm px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const toastPortal =
    showToast && latestNew && bellRef.current
      ? createPortal(
          <div
            role="status"
            aria-live="polite"
            onClick={navigateAndClearToast}
            style={{
              position: "absolute",
              zIndex: 9999,
              top: (() => {
                const rect = bellRef.current.getBoundingClientRect();
                const scrollY = window.scrollY || window.pageYOffset;
                return rect.bottom + scrollY + 8;
              })(),
              left: (() => {
                const rect = bellRef.current.getBoundingClientRect();
                const rawLeft = rect.left;
                const minLeft = 8;
                const maxLeft = Math.max(8, window.innerWidth - POPOVER_WIDTH - 8);
                return Math.min(Math.max(rawLeft, minLeft), maxLeft);
              })(),
              transform: "translate(0,0)",
              transition: "opacity 240ms ease, transform 240ms ease",
            }}
          >
            <div className="w-80 bg-white dark:bg-gray-900 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-xl transition-shadow">
              <div className="p-3 flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">{iconFor(latestNew.level)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-gray-900 dark:text-white">
                    {latestNew.message}
                  </div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(latestNew.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <>
      <div ref={bellRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div
          role="button"
          tabIndex={0}
          onClick={handleBellClick}
          onKeyDown={handleBellKeyDown}
          aria-label={item?.label || "Notifications"}
          className={`flex items-center p-2 rounded-full transition-colors duration-200 ${
            showExpanded ? "justify-normal" : "justify-center"
          } cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800`}
        >
          <div className="relative flex items-center justify-center w-6 text-gray-700 dark:text-gray-300">
            <Bell size={24} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full min-w-[1.25rem]">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          {showExpanded && <span className="ml-3 truncate text-gray-700 dark:text-gray-300">{item?.label || "Notifications"}</span>}
        </div>
      </div>

      {popover}
      {toastPortal}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="p-4 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-2">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{unread} unread</div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {buildDisplayList(notifications).length === 0 && (
              <div className="p-3 text-sm text-gray-600 dark:text-gray-400">No notifications</div>
            )}
            {buildDisplayList(notifications).map((n) => (
              <div key={n.id} className={`p-3 flex items-start gap-3 ${
                n.isRead 
                  ? "text-gray-600 dark:text-gray-300" 
                  : "text-gray-900 dark:text-white font-medium"
              }`}>
                <div className="flex-shrink-0 mt-0.5">{iconFor(n.level)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{n.message}</div>
                  <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="ml-2 flex flex-col gap-2">
                  {!n.isRead && (
                    <button 
                      onClick={() => handleMarkRead(n.id)} 
                      className="text-xs px-2 py-1 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      Mark
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => {
                setSheetOpen(false);
                navigate(item?.to || "/notification");
              }}
              className="text-sm px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              View all
            </button>
            <button 
              onClick={loadPreview} 
              className="text-sm px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            >
              Refresh
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
