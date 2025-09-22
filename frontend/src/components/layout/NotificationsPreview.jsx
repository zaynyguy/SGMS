// src/components/NotificationPreview.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, CheckCircle, Info, AlertTriangle } from "lucide-react";
import BottomSheet from "../BottomSheet"; // adjust path if needed
import {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
} from "../../api/notifications";

/**
 * NotificationPreview
 *
 * - Desktop (hover-capable): popover positioned by `position` prop
 * - Touch devices: BottomSheet
 * - Preview always shows unread first, then recent read to fill up to 5 items
 * - WebSocket for real-time new notifications (default endpoint: /ws/notifications)
 * - Single toast shown once for a truly new notification when preview is closed
 *
 * Props:
 *  - item: { to, label } (default { to: "/notification", label: "Notifications" })
 *  - showExpanded: boolean
 *  - position: "bottom-left" | "bottom-right" | "top-left" | "top-right" | "left" | "right"
 *  - wsUrl?: string (optional websocket URL)
 */

export default function NotificationPreview({
  item = { to: "/notification", label: "Notifications" },
  showExpanded = false,
  position = "bottom-left",
  wsUrl = "",
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // refs & timers
  const bellRef = useRef(null);
  const hideTimer = useRef(null);
  const toastTimer = useRef(null);
  const wsRef = useRef(null);
  const reconnectRef = useRef({ attempt: 0, timer: null });

  // state
  const [open, setOpen] = useState(false); // desktop popover open
  const [sheetOpen, setSheetOpen] = useState(false); // bottom sheet open on touch
  const [notifications, setNotifications] = useState([]); // candidate list (we fetch >5 to fill)
  const [unread, setUnread] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, transform: "translate(0,0)" });

  // toast for single new item
  const [latestNew, setLatestNew] = useState(null);
  const [showToast, setShowToast] = useState(false);

  // tracking refs to avoid duplicate toasts / re-toast on hover fetch
  const lastKnownIdRef = useRef(null);
  const shownToastIdsRef = useRef(new Set());

  // detection: hover-capable device?
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

  // constants
  const TOAST_MS = 4200;
  const POPOVER_WIDTH = 320;
  const POPOVER_HEIGHT = 420;

  // ---------- helpers ----------
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

  // compute coords and clamp for various positions
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
    if (pos === "right" || pos === "left") transform = "translate(0,-50%)"; // vertically center
    return { top: clampedTop, left: clampedLeft, transform };
  };

  // Build display list: unread first, then recent read to fill up to 5
  const buildDisplayList = (candidates) => {
    const unreadList = (candidates || []).filter((n) => !n.isRead).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const readList = (candidates || []).filter((n) => n.isRead).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const combined = [...unreadList, ...readList];
    return combined.slice(0, 5);
  };

  // ---------- API / load preview ----------
  // load a generous candidate set (10) so we can fill to 5 after excluding some items
  const loadPreview = async () => {
    try {
      const res = await fetchNotifications(1, 10);
      const rows = res?.rows ?? [];
      setNotifications(rows);
      const u = await fetchUnreadCount();
      setUnread(u?.unread ?? 0);
      // treat the top fetched item as known so we don't toast on initial load
      lastKnownIdRef.current = rows?.[0]?.id ?? lastKnownIdRef.current;
    } catch (err) {
      console.error("loadPreview failed", err);
    }
  };

  // mark single notification read (optimistic update)
  const handleMarkRead = async (id) => {
    try {
      // optimistic update
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      await markNotificationRead(id);
      // server-confirmation could trigger a refresh if needed
    } catch (err) {
      console.error("mark read failed", err);
      // optional: revert optimistic update on failure (not implemented)
    }
  };

  // initial load (first mount)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- WebSocket (real-time) with reconnection ----------
  useEffect(() => {
    if (typeof window === "undefined") return;

    const defaultWsUrl = (() => {
      try {
        if (wsUrl) return wsUrl;
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        return `${proto}//${window.location.host}/ws/notifications`;
      } catch {
        return wsUrl || "";
      }
    })();

    if (!defaultWsUrl) {
      console.warn("NotificationPreview: no WebSocket URL available — provide wsUrl prop or server endpoint at /ws/notifications");
      return;
    }

    let closedByUser = false;

    function connect() {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }

      const ws = new WebSocket(defaultWsUrl);
      wsRef.current = ws;

      ws.addEventListener("open", () => {
        reconnectRef.current.attempt = 0;
      });

      ws.addEventListener("message", (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          const type = payload?.type || payload?.event;

          if (type === "notification:new" && payload.notification) {
            const latest = payload.notification;
            // update unread if provided
            if (typeof payload.unread === "number") setUnread(payload.unread);

            const knownId = lastKnownIdRef.current;
            const previewTopId = notifications?.[0]?.id;

            // if it's really new and preview closed and not on notifications page -> show toast once
            if (
              latest?.id &&
              latest.id !== knownId &&
              latest.id !== previewTopId &&
              !open &&
              location.pathname !== (item?.to || "/notification") &&
              !shownToastIdsRef.current.has(latest.id)
            ) {
              shownToastIdsRef.current.add(latest.id);
              setLatestNew(latest);
              setShowToast(true);

              // prepend to candidate list
              setNotifications((prev) => {
                const dedup = prev?.[0]?.id === latest.id ? prev : [latest, ...(prev || [])];
                return dedup?.slice(0, 20); // keep capped
              });

              if (toastTimer.current) clearTimeout(toastTimer.current);
              toastTimer.current = setTimeout(() => {
                setShowToast(false);
                toastTimer.current = null;
              }, TOAST_MS);

              lastKnownIdRef.current = latest.id;
              if (typeof payload.unread === "number") setUnread(payload.unread);
            } else {
              // silent prepend and update unread
              setNotifications((prev) => {
                if (latest?.id && prev?.[0]?.id === latest.id) return prev;
                return [latest, ...(prev || [])].slice(0, 20);
              });
              lastKnownIdRef.current = latest.id ?? lastKnownIdRef.current;
              if (typeof payload.unread === "number") setUnread(payload.unread);
            }
            return;
          }

          if (type === "notification:bulk" && Array.isArray(payload.notifications)) {
            const rows = payload.notifications.slice(0, 20);
            setNotifications(rows);
            if (typeof payload.unread === "number") setUnread(payload.unread);
            lastKnownIdRef.current = rows?.[0]?.id ?? lastKnownIdRef.current;
            return;
          }

          if (type === "unread_count" && typeof payload.unread === "number") {
            setUnread(payload.unread);
            return;
          }

          // fallback raw notification object
          if (payload && payload.id && payload.message) {
            const latest = payload;
            setNotifications((prev) => [latest, ...(prev || [])].slice(0, 20));
            lastKnownIdRef.current = latest.id ?? lastKnownIdRef.current;
            return;
          }
        } catch (err) {
          console.error("WebSocket message parse error", err, ev.data);
        }
      });

      ws.addEventListener("close", () => {
        wsRef.current = null;
        if (closedByUser) return;
        reconnectRef.current.attempt = (reconnectRef.current.attempt || 0) + 1;
        const attempt = reconnectRef.current.attempt;
        const backoff = Math.min(30000, 1000 * Math.pow(1.6, attempt));
        reconnectRef.current.timer = setTimeout(() => connect(), backoff);
      });

      ws.addEventListener("error", () => {
        try { ws.close(); } catch {}
      });
    }

    connect();

    return () => {
      closedByUser = true;
      if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsUrl, open, location.pathname, notifications, item?.to]);

  // ---------- popover open/close (desktop) ----------
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

  // ---------- click/tap handling ----------
  const handleBellClick = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (!canHover) {
      // open bottom sheet on touch devices
      setSheetOpen(true);
      loadPreview();
    } else {
      // navigate to notifications on desktop click
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

  // ---------- portals ----------
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

  // cleanup timers and ws on unmount
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (reconnectRef.current.timer) clearTimeout(reconnectRef.current.timer);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
    };
  }, []);

  // ---------- render ----------
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