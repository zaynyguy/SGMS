// src/components/NotificationPreview.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, CheckCircle, Info, AlertTriangle } from "lucide-react";
import BottomSheet from "../BottomSheet"; // adjust path if needed
import { fetchNotifications, fetchUnreadCount } from "../../api/notifications";

/**
 * NotificationPreview (hover vs touch-aware)
 *
 * - If the device supports hover (matchMedia '(hover: hover)') => desktop popover + navigate on click
 * - If device does NOT support hover => mobile/tablet BottomSheet on tap (no navigate)
 * - Listens for changes in hover capability (e.g., attach/detach mouse)
 */

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
  const [open, setOpen] = useState(false); // desktop popover open
  const [sheetOpen, setSheetOpen] = useState(false); // touch sheet open
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, transform: "translate(0,0)" });

  // feature detection: does this device support hover? (true for mouse/trackpad)
  const [canHover, setCanHover] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      return window.matchMedia && window.matchMedia("(hover: hover)").matches;
    } catch {
      return false;
    }
  });

  // recompute canHover when media query changes (attaching/detaching mouse)
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(hover: hover)");
    const handler = (e) => setCanHover(!!e.matches);
    // Modern browsers use addEventListener on MediaQueryList; fallback to deprecated addListener
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else if (mq.addListener) mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else if (mq.removeListener) mq.removeListener(handler);
    };
  }, []);

  // initial unread (and don't poll here — reuse your polling if you have it)
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

  // load preview items (5)
  const loadPreview = async () => {
    try {
      const res = await fetchNotifications(1, 5);
      setNotifications(res?.rows || []);
      const u = await fetchUnreadCount();
      setUnread(u?.unread ?? 0);
    } catch (e) {
      console.error("Failed to load notifications", e);
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

  // click bell:
  // - if device supports hover -> treat as desktop: navigate
  // - if device does NOT support hover -> open bottom sheet (touch devices & touch-first tablets)
  const handleBellClick = (e) => {
    // cancel hide timer (if any)
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }

    if (!canHover) {
      // touch-first device (mobile/tablet): open bottom sheet instead of navigating
      setSheetOpen(true);
      loadPreview();
    } else {
      // desktop: go to notifications page
      navigate(item?.to || "/notification");
    }
  };

  // keyboard accessibility: Enter/Space behave same as click
  const handleBellKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleBellClick();
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
            <div className="w-80 max-h-[420px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b dark:border-gray-700">
                <div className="text-sm font-medium">Notifications</div>
                <div className="text-xs text-gray-500">{unread} unread</div>
              </div>

              <div className="divide-y overflow-y-auto max-h-[340px]">
                {notifications.length === 0 && <div className="p-4 text-sm text-gray-500">No notifications</div>}
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${n.isRead ? "bg-white" : "bg-blue-50"}`}
                    onClick={() => navigate(item?.to || "/notification")}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {n.level === "success" ? <CheckCircle className="w-4 h-4" /> : n.level === "warning" ? <AlertTriangle className="w-4 h-4" /> : n.level === "error" ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm truncate ${n.isRead ? "text-gray-600" : "font-medium text-gray-900"}`}>{n.message}</div>
                      <div className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between px-3 py-2 border-t dark:border-gray-700">
                <button onClick={() => navigate(item?.to || "/notification")} className="text-sm px-2 py-1 rounded hover:bg-gray-100">
                  View all
                </button>
                <button onClick={loadPreview} className="text-sm px-2 py-1 rounded hover:bg-gray-100">
                  Refresh
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  // bottom sheet (mobile/tablet)
  return (
    <>
      <div ref={bellRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        <div
          role="button"
          tabIndex={0}
          onClick={handleBellClick}
          onKeyDown={handleBellKeyDown}
          aria-label={item?.label || "Notifications"}
          className={`flex items-center p-2 rounded-full transition-colors duration-200 ${showExpanded ? "justify-normal" : "justify-center"} cursor-pointer`}
        >
          <div className="relative flex items-center justify-center w-6">
            <Bell size={24}/>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          {showExpanded && <span className="ml-3 truncate">{item?.label || "Notifications"}</span>}
        </div>
      </div>

      {popover}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-lg font-semibold">Notifications</div>
            <div className="text-xs text-gray-500">{unread} unread</div>
          </div>

          <div className="divide-y">
            {notifications.length === 0 && <div className="p-3 text-sm text-gray-500">No notifications</div>}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 ${n.isRead ? "text-gray-600" : "text-gray-900 font-medium"} flex items-start gap-3`}
                onClick={() => {
                  setSheetOpen(false);
                  navigate(item?.to || "/notification");
                }}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {n.level === "success" ? <CheckCircle className="w-4 h-4" /> : n.level === "warning" ? <AlertTriangle className="w-4 h-4" /> : n.level === "error" ? <AlertTriangle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{n.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
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
              className="text-sm px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
            >
              View all
            </button>
            <button
              onClick={() => {
                loadPreview();
              }}
              className="text-sm px-3 py-2 rounded hover:bg-gray-100"
            >
              Refresh
            </button>
          </div>
        </div>
      </BottomSheet>
    </>
  );
}
