import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, CheckCircle, Info, AlertTriangle } from "lucide-react";
import { fetchNotifications, fetchUnreadCount } from "../api/notifications";

/**
 * NotificationPreview
 * - Shows unread count badge on bell
 * - On hover (desktop) fetches and shows latest 5 notifications
 * - Clicking the bell routes to /notification (NavLink)
 */
export default function NotificationPage({ item, showExpanded }) {
  const [showPreview, setShowPreview] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const hideTimer = useRef(null);
  const wrapperRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    // initial unread count fetch
    let mounted = true;
    fetchUnreadCount().then((res) => {
      if (mounted) setUnread(res?.unread ?? 0);
    }).catch(() => {});
    return () => (mounted = false);
  }, []);

  // helper to fetch top 5
  const loadPreview = async () => {
    try {
      const res = await fetchNotifications(1, 5);
      setNotifications(res.rows || []);
      const unreadCountRes = await fetchUnreadCount();
      setUnread(unreadCountRes?.unread ?? 0);
    } catch (err) {
      // swallow -- optional: set an error state
      console.error("Failed loading notification preview", err);
    }
  };

  const handleMouseEnter = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setShowPreview(true);
    // fetch fresh preview each hover
    loadPreview();
  };

  const handleMouseLeave = () => {
    // small delay so the user can move mouse into the popover
    hideTimer.current = setTimeout(() => setShowPreview(false), 150);
  };

  // keyboard accessibility: show preview on focus, hide on blur
  const handleFocus = () => {
    setShowPreview(true);
    loadPreview();
  };
  const handleBlur = (e) => {
    // if focusing inside the wrapper, don't hide
    if (wrapperRef.current && wrapperRef.current.contains(e.relatedTarget)) return;
    setShowPreview(false);
  };

  const getIcon = (level) => {
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

  // render little message line
  const renderItem = (n) => (
    <div
      key={n.id}
      className={`flex items-start gap-3 p-2 rounded-md cursor-pointer ${
        n.isRead ? "bg-white" : "bg-blue-50"
      } hover:bg-gray-100`}
      onClick={() => {
        // when a preview item clicked, navigate to notification page (or ideally deep link)
        navigate("/notification");
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate("/notification")}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon(n.level)}</div>
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${n.isRead ? "text-gray-600" : "font-medium text-gray-900"}`}>
          {n.message}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {new Date(n.createdAt).toLocaleString()}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      ref={wrapperRef}
    >
      {/* The clickable bell (routes on click) */}
      <NavLink
        to={item.to}
        className={`flex items-center p-3 rounded-md transition-colors duration-200 ${
          showExpanded ? "justify-normal" : "justify-center"
        }`}
        aria-label={item.label}
      >
        <div className="relative flex items-center justify-center w-6">
          {/* actual Bell icon */}
          <Bell size={24} />
          {/* unread badge */}
          {unread > 0 && (
            <span
              className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-semibold leading-none text-white bg-red-600 rounded-full"
              aria-label={`${unread} unread notifications`}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </div>
        {showExpanded && <span className="ml-3 truncate">{item.label}</span>}
      </NavLink>

      {/* Preview popover (desktop) */}
      {showPreview && (
        <div
          className="absolute left-full top-0 ml-3 w-80 max-h-96 overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-50"
          role="dialog"
          aria-label="Recent notifications preview"
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Recent notifications</div>
              <div className="text-xs text-gray-500">{unread} unread</div>
            </div>

            <div className="divide-y overflow-y-auto max-h-72">
              {notifications.length === 0 && (
                <div className="p-4 text-sm text-gray-500">No notifications</div>
              )}
              {notifications.map(renderItem)}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                className="text-sm px-3 py-1 rounded-md bg-gray-100 hover:bg-gray-200"
                onClick={() => navigate("/notification")}
              >
                View all
              </button>
              <button
                className="text-sm px-3 py-1 rounded-md text-gray-600 hover:text-gray-900"
                onClick={() => {
                  // refresh preview
                  loadPreview();
                }}
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
