// src/components/NotificationPreview.jsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Bell, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { fetchNotifications, fetchUnreadCount } from "../../api/notifications";

/**
 * NotificationPreview
 * - Preview + toast are bottom-left near the bell by default
 * - Toast appears for truly new notifications (not when user just hovered)
 * - Hover opens preview bottom-left; click bell/toast navigates to /notification
 */
export default function NotificationPreview({
  item = { to: "/notification", label: "Notifications" },
  showExpanded = false,
  // we default to bottom-left behavior
  position = "bottom-left",
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const bellRef = useRef(null);
  const hideTimer = useRef(null);
  const pollRef = useRef(null);
  const toastTimer = useRef(null);

  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, transform: "" });

  const [latestNew, setLatestNew] = useState(null);
  const [showToast, setShowToast] = useState(false);

  // track last known latest id to avoid re-toasting items we've already seen
  const lastKnownIdRef = useRef(null);

  const POLL_INTERVAL_MS = 8000;
  const TOAST_MS = 4500;
  const POPOVER_WIDTH = 320; // corresponding to w-80 (80 * 4 = 320px)
  const POPOVER_HEIGHT = 420; // max-h used in the popover

  // utility: icon
  const iconFor = (level) => {
    switch (level) {
      case "success":
        return <CheckCircle className="w-4 h-4" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4" />;
      case "error":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  // compute coordinates for bottom-left (and clamp to viewport)
  function computeBottomLeftCoords(rect, scrollY) {
    // bottom-left: align popover left with bell left, placed below the bell
    const rawTop = rect.bottom + scrollY + 8;
    const rawLeft = rect.left;

    // clamp left so the popover stays inside viewport
    const minLeft = 8;
    const maxLeft = Math.max(8, window.innerWidth - POPOVER_WIDTH - 25);
    const left = Math.min(Math.max(rawLeft, minLeft), maxLeft);

    // clamp top so popover doesn't go off bottom viewport
    const minTop = 8 + (window.scrollY || 0);
    const maxTop = (window.scrollY || 0) + Math.max(8, window.innerHeight - POPOVER_HEIGHT - 25);
    const top = Math.min(Math.max(rawTop, minTop), maxTop);

    return {
      top,
      left,
      transform: "translate(0,0)",
    };
  }

  // initial load: recent 5 + unread; set lastKnownIdRef so init doesn't toast
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [res, unreadRes] = await Promise.all([fetchNotifications(1, 5), fetchUnreadCount()]);
        if (!mounted) return;
        const rows = res?.rows ?? [];
        setNotifications(rows);
        setUnread(unreadRes?.unread ?? 0);
        lastKnownIdRef.current = rows?.[0]?.id ?? lastKnownIdRef.current;
      } catch (e) {
        console.error("init notifications failed", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // polling to detect new notifications (replace with socket if available)
  useEffect(() => {
    let mounted = true;

    const checkNew = async () => {
      try {
        const uRes = await fetchUnreadCount();
        const currentUnread = uRes?.unread ?? 0;

        if (currentUnread > unread) {
          const latestRes = await fetchNotifications(1, 1);
          const latest = latestRes?.rows?.[0] ?? null;

          if (latest) {
            const knownId = lastKnownIdRef.current;
            const previewTopId = notifications?.[0]?.id;

            // only toast for truly new items we don't already know and when preview not open
            if (latest.id !== knownId && latest.id !== previewTopId) {
              if (!open && location.pathname !== (item?.to || "/notification")) {
                setLatestNew(latest);
                setShowToast(true);
                // prepend to preview list (keep max 5)
                setNotifications((prev) => [latest, ...(prev || []).slice(0, 4)]);
                if (toastTimer.current) clearTimeout(toastTimer.current);
                toastTimer.current = setTimeout(() => {
                  setShowToast(false);
                  toastTimer.current = null;
                }, TOAST_MS);
              } else {
                // preview open or already on notifications page -> just prepend silently
                setNotifications((prev) => [latest, ...(prev || []).slice(0, 4)]);
              }

              lastKnownIdRef.current = latest.id;
              setUnread(currentUnread);
            } else {
              // not a new id; just update unread
              setUnread(currentUnread);
            }
          } else {
            setUnread(currentUnread);
          }
        } else {
          // unread not increased — just update unread in case it changed
          setUnread(currentUnread);
        }
      } catch (e) {
        if (mounted) console.error("polling notifications failed", e);
      }
    };

    // run once immediately then interval
    checkNew();
    pollRef.current = setInterval(checkNew, POLL_INTERVAL_MS);

    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location.pathname]);

  // user-triggered preview load (hover): load 5 and update lastKnownId so it doesn't cause toast
  const loadPreview = async () => {
    try {
      const res = await fetchNotifications(1, 5);
      const rows = res?.rows ?? [];
      setNotifications(rows);
      const u = await fetchUnreadCount();
      setUnread(u?.unread ?? 0);
      // important: mark as known so polling won't re-toast what we just fetched
      lastKnownIdRef.current = rows?.[0]?.id ?? lastKnownIdRef.current;
    } catch (e) {
      console.error("loadPreview failed", e);
    }
  };

  // open preview bottom-left near bell (clamped)
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

  const handleMouseEnter = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    openPreviewAtBell();
  };

  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => {
      closePreview();
      hideTimer.current = null;
    }, 150);
  };

  // click bell or toast -> navigate and clear toast
  const navigateAndClear = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setShowToast(false);
    setLatestNew(null);
    lastKnownIdRef.current = notifications?.[0]?.id ?? lastKnownIdRef.current;
    navigate(item?.to || "/notification");
  };

  // preview portal (bottom-left)
  const previewPortal = open
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
                  <div className="flex-shrink-0 mt-0.5">{iconFor(n.level)}</div>
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

  // toast portal (single message bottom-left)
  const toastPortal = showToast && latestNew
    ? createPortal(
        <div
          role="status"
          aria-live="polite"
          onClick={navigateAndClear}
          style={{
            position: "absolute",
            zIndex: 9999,
            top: (() => {
              if (!bellRef.current) return 0;
              const rect = bellRef.current.getBoundingClientRect();
              const scrollY = window.scrollY || window.pageYOffset;
              return rect.bottom + scrollY + 8;
            })(),
            left: (() => {
              if (!bellRef.current) return 0;
              const rect = bellRef.current.getBoundingClientRect();
              // clamp left same as computeBottomLeftCoords
              const rawLeft = rect.left;
              const minLeft = 8;
              const maxLeft = Math.max(8, window.innerWidth - POPOVER_WIDTH - 8);
              return Math.min(Math.max(rawLeft, minLeft), maxLeft);
            })(),
            transform: "translate(0,0)",
          }}
        >
          <div className="w-80 bg-white dark:bg-gray-900 rounded-md shadow-lg border dark:border-gray-700 overflow-hidden cursor-pointer transition transform duration-200 ease-out hover:scale-[1.01]">
            <div className="p-3 flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">{iconFor(latestNew.level)}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{latestNew.message}</div>
                <div className="text-xs text-gray-400 mt-1">{new Date(latestNew.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  // cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
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
          onClick={navigateAndClear}
          aria-label={item?.label || "Notifications"}
          className={`flex items-center p-3 rounded-md transition-colors duration-200 ${showExpanded ? "justify-normal" : "justify-center"} cursor-pointer`}
        >
          <div className="relative flex items-center justify-center w-6">
            <Bell size={24} />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          {showExpanded && <span className="ml-3 truncate">{item?.label || "Notifications"}</span>}
        </div>
      </div>

      {previewPortal}
      {toastPortal}
    </>
  );
}
