import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { fetchNotifications, fetchUnreadCount } from "../api/notifications";

/**
 * Portal-based NotificationPreview
 * - Renders the preview into document.body so it appears outside the sidebar
 * - Positions relative to the bell using getBoundingClientRect
 * - Hover shows preview on desktop; click still navigates to item.to
 */
export default function NotificationPreview({ item = { to: "/notification", label: "Notifications" }, showExpanded = false, position = "right" }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const bellRef = useRef(null);
  const hideTimer = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    fetchUnreadCount().then((r) => mounted && setUnread(r?.unread ?? 0)).catch(() => {});
    return () => (mounted = false);
  }, []);

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

  const openAtBell = () => {
    if (!bellRef.current) return;
    const rect = bellRef.current.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    // compute default coords (right, vertically centered)
    let top = rect.top + scrollY + rect.height / 2;
    let left = rect.right + 8;
    if (position === "left") left = rect.left - 8;
    if (position === "top") {
      top = rect.top + scrollY - 8;
      left = rect.left + rect.width / 2;
    }
    if (position === "bottom") {
      top = rect.bottom + scrollY + 8;
      left = rect.left + rect.width / 2;
    }
    setCoords({ top, left });
    setOpen(true);
    loadPreview();
  };

  const close = () => setOpen(false);

  const handleMouseEnter = () => {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    openAtBell();
  };
  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setOpen(false), 150);
  };

  const getIcon = (level) => {
    switch (level) {
      case "success": return <CheckCircle className="w-4 h-4" />;
      case "warning": return <AlertTriangle className="w-4 h-4" />;
      case "error": return <AlertTriangle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  // portal popover element
  const popover = open ? createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Recent notifications"
      tabIndex={-1}
      onMouseEnter={() => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } }}
      onMouseLeave={handleMouseLeave}
      style={{
        position: "absolute",
        top: coords.top,
        left: coords.left,
        // transform depends on position to align nicely
        transform:
          position === "right"
            ? "translate(8px, -50%)"
            : position === "left"
            ? "translate(-100%, -50%)"
            : position === "top"
            ? "translate(-500%, -100%)"
            : "translate(-500%, 8px)",
        zIndex: 9999,
      }}
    >
      <div className="w-80 max-h-[420px] bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b dark:border-gray-700">
          <div className="text-sm font-medium text-text-gray-800 dark:text-white">Notifications</div>
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
              <div className="flex-shrink-0 mt-0.5">{getIcon(n.level)}</div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm truncate ${n.isRead ? "text-gray-600" : "font-medium text-gray-900"}`}>{n.message}</div>
                <div className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={bellRef}
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <NavLink
          to={item?.to || "/notification"}
          className={`flex items-center p-3 rounded-md transition-colors duration-200 ${showExpanded ? "justify-normal" : "justify-center"}`}
          aria-label={item?.label || "Notifications"}
        >
          <div className="relative flex items-center justify-center w-6">
            <Bell size={24} className="text-gray-600 dark:text-gray-200"/>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          {showExpanded && <span className="ml-3 truncate">{item?.label || "Notifications"}</span>}
        </NavLink>
      </div>

      {popover}
    </>
  );
}
