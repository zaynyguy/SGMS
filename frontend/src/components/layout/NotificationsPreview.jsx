// src/components/NotificationPreview.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, CheckCircle, Info, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import BottomSheet from "../BottomSheet";
import { fetchNotifications, fetchUnreadCount } from "../../api/notifications";

export default function NotificationPreview({
  item = { to: "/notification", label: "Notifications" },
  showExpanded = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  // refs / timers
  const bellRef = useRef(null);
  const hideTimer = useRef(null);

  // state
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, transform: "translate(0,0)" });
  const [loading, setLoading] = useState(false);

  // feature detection: does this device support hover?
  const [canHover, setCanHover] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.matchMedia && window.matchMedia("(hover: hover)").matches;
    } catch {
      return false;
    }
  });

  // recompute canHover when media query changes
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

  // initial unread count
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const u = await fetchUnreadCount();
        if (!mounted) return;
        setUnread(u?.unread ?? 0);
      } catch (e) {
        /* ignore */
      }
    })();
    return () => (mounted = false);
  }, []);

  // load preview items
  const loadPreview = async () => {
    setLoading(true);
    try {
      const res = await fetchNotifications(1, 5);
      setNotifications(res?.rows || []);
      const u = await fetchUnreadCount();
      setUnread(u?.unread ?? 0);
    } catch (e) {
      console.error("Failed to load notifications", e);
    } finally {
      setLoading(false);
    }
  };

  // compute bottom-left coords for desktop popover
  const computeBottomLeftCoords = (rect, scrollY) => {
    const POPOVER_WIDTH = 320;
    const POPOVER_HEIGHT = 420;
    const rawTop = rect.bottom + scrollY + 8;
    const rawLeft = rect.left;
    const minLeft = 8;
    const maxLeft = Math.max(8, window.innerWidth - POPOVER_WIDTH - 25);
    const left = Math.min(Math.max(rawLeft, minLeft), maxLeft);
    const minTop = 8 + (window.scrollY || 0);
    const maxTop = (window.scrollY || 0) + Math.max(8, window.innerHeight - POPOVER_HEIGHT - 25);
    const top = Math.min(Math.max(rawTop, minTop), maxTop);
    return { top, left, transform: "translate(0,0)" };
  };

  // open popover (desktop)
  const openPreviewAtBell = () => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const { top, left, transform } = computeBottomLeftCoords(rect, scrollY);
    setCoords({ top, left, transform });
    setOpen(true);
    loadPreview();
  };

  const closePreview = () => setOpen(false);

  // mouse handlers — only used when hover is available
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

  // click bell handler
  const handleBellClick = (e) => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (!canHover) {
      // touch-first device: open bottom sheet
      setSheetOpen(true);
      loadPreview();
    } else {
      // desktop: go to notifications page
      navigate(item?.to || "/notification");
    }
  };

  // keyboard accessibility
  const handleBellKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleBellClick();
    }
  };

  // notification icon based on level
  const getNotificationIcon = (level) => {
    const iconProps = { size: 16, className: "flex-shrink-0" };
    
    switch (level) {
      case "success":
        return <CheckCircle {...iconProps} className="text-green-500" />;
      case "warning":
        return <AlertTriangle {...iconProps} className="text-yellow-500" />;
      case "error":
        return <AlertTriangle {...iconProps} className="text-red-500" />;
      default:
        return <Info {...iconProps} className="text-blue-500" />;
    }
  };

  // preview portal (desktop popover)
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
              transition: "opacity 200ms ease, transform 200ms ease",
            }}
          >
            <div className="w-80 max-h-[420px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-colors duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <div className="text-sm font-medium text-gray-800 dark:text-white">Notifications</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{unread} unread</div>
              </div>

              <div className="divide-y divide-gray-100 dark:divide-gray-700 overflow-y-auto max-h-[340px]">
                {loading ? (
                  <div className="flex justify-center items-center py-8">
                    <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">No notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 p-3 transition-colors duration-200 cursor-pointer ${
                        n.isRead 
                          ? "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700" 
                          : "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                      }`}
                      onClick={() => navigate(item?.to || "/notification")}
                      role="button"
                      tabIndex={0}
                    >
                      {getNotificationIcon(n.level)}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm truncate ${n.isRead ? "text-gray-600 dark:text-gray-300" : "font-medium text-gray-900 dark:text-white"}`}>
                          {n.message}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <button 
                  onClick={() => navigate(item?.to || "/notification")} 
                  className="text-sm px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 flex items-center gap-1"
                >
                  <Eye size={14} />
                  View all
                </button>
                <button 
                  onClick={loadPreview} 
                  className="text-sm px-2 py-1 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 flex items-center gap-1"
                  disabled={loading}
                >
                  <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

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
            showExpanded 
              ? "justify-normal text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" 
              : "justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          } cursor-pointer`}
        >
          <div className="relative flex items-center justify-center">
            <Bell size={20} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-xs font-semibold leading-none text-white bg-red-500 rounded-full">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          {showExpanded && <span className="ml-2 truncate text-sm">{item?.label || "Notifications"}</span>}
        </div>
      </div>

      {popover}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="p-4 bg-white dark:bg-gray-800 rounded-t-lg transition-colors duration-200">
          <div className="flex items-center justify-between mb-4">
            <div className="text-lg font-semibold text-gray-800 dark:text-white">Notifications</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{unread} unread</div>
          </div>

          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {loading ? (
              <div className="flex justify-center items-center py-6">
                <RefreshCw className="h-5 w-5 text-gray-400 dark:text-gray-500 animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 dark:text-gray-400 text-center">No notifications</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 flex items-start gap-3 transition-colors duration-200 ${
                    n.isRead 
                      ? "text-gray-600 dark:text-gray-300" 
                      : "text-gray-900 dark:text-white font-medium"
                  }`}
                  onClick={() => {
                    setSheetOpen(false);
                    navigate(item?.to || "/notification");
                  }}
                >
                  {getNotificationIcon(n.level)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{n.message}</div>
                    <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={() => {
                setSheetOpen(false);
                navigate(item?.to || "/notification");
              }}
              className="text-sm px-3 py-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-200 flex items-center gap-1"
            >
              <Eye size={14} />
              View all
            </button>
            <button
              onClick={loadPreview}
              disabled={loading}
              className="text-sm px-3 py-2 rounded text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center gap-1"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}