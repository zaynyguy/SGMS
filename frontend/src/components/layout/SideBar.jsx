import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import {
  Home,
  Settings,
  LogOut,
  UserPen,
  Settings2Icon,
  ClipboardCheck,
  Paperclip,
  FileText,
  Target,
  User, // Import User for fallback
} from "lucide-react";
import companyLogo from "../../assets/logo.png";
import { useSidebar } from "../../context/SidebarContext"; // <<-- ensure this path matches your project
import AuthenticatedImage from "../common/AuthenticatedImage"; // <-- IMPORT THE NEW COMPONENT

const Sidebar = ({ children, isOpen: mobileIsOpen, onToggle, onRequestClose }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  // Context (will exist if you wrapped app with SidebarProvider)
  const { sidebarOpen: ctxOpen, toggleSidebar: ctxToggle, closeSidebar: ctxClose } = useSidebar();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  // REMOVED: profilePictureError state is no longer needed, AuthenticatedImage handles its own errors.

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsExpanded(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // REMOVED: useEffect for profilePictureError reset

  const hasPermission = (permission) => user?.permissions?.includes(permission);

  const mainMenuItems = [
    {
      to: "/dashboard",
      icon: <Home size={20} />,
      label: t("sidebar.menu.dashboard"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    hasPermission("manage_access") && {
      to: "/accessmanagement",
      icon: <UserPen size={20} />,
      label: t("sidebar.menu.accessManagement"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    (hasPermission("manage_gta") || hasPermission("view_gta")) && {
      to: "/project",
      icon: <Target size={20} />,
      label: t("sidebar.menu.projectManagement"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    (hasPermission("manage_reports") || hasPermission("view_reports")) && {
      to: "/report",
      icon: <FileText size={20} />,
      label: t("sidebar.menu.reports"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    hasPermission("manage_attachments") && {
      to: "/attachment",
      icon: <Paperclip size={20} />,
      label: t("sidebar.menu.attachments"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    hasPermission("view_audit_logs") && {
      to: "/auditLog",
      icon: <ClipboardCheck size={20} />,
      label: t("sidebar.menu.audit"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    hasPermission("manage_settings") && {
      to: "/systemsettings",
      icon: <Settings2Icon size={20} />,
      label: t("sidebar.menu.systemSettings"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    {
      to: "/settings",
      icon: <Settings size={20} />,
      label: t("sidebar.menu.settings"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
  ].filter(Boolean);

  /* -----------------------------
  Effective mobile state & handlers
  ----------------------------- */
  const effectiveMobileOpen = typeof mobileIsOpen === "boolean" ? mobileIsOpen : ctxOpen;
  const handleMobileToggle = () => {
    if (typeof onToggle === "function") return onToggle();
    if (typeof ctxToggle === "function") return ctxToggle();
    setIsExpanded((v) => !v);
  };
  const handleRequestClose = () => {
    if (typeof onRequestClose === "function") return onRequestClose();
    if (typeof ctxClose === "function") return ctxClose();
    setIsExpanded(false);
  };

  const toggleSidebar = () => setIsExpanded(!isExpanded);
  const handleMouseEnter = () => !isMobile && setIsHovered(true);
  const handleMouseLeave = () => !isMobile && setIsHovered(false);

  const showExpanded = isMobile ? effectiveMobileOpen : isHovered;
  const sidebarWidth = showExpanded ? "w-64" : "w-16";
  const contentMargin = !isMobile ? (showExpanded ? "ml-64" : "ml-16") : "ml-0"; // Only push on desktop

  const formatName = (name) => {
    if (!name) return "";
    return name.length > 15 && !showExpanded ? `${name.substring(0, 12)}...` : name;
  };

  // UPDATED: This is now handled by AuthenticatedImage, but we keep the logic
  // for the fallback props.
  const getAvatarFallback = () => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.username) return user.username.charAt(0).toUpperCase();
    return "U";
  };

  /* -----------------------------
  MenuItem component (unchanged)
  ----------------------------- */
  const MenuItem = ({ item, showExpanded }) => {
    const [isFilling, setIsFilling] = useState(false);

    const handleMouseDown = (e) => {
      setIsFilling(true);
      setTimeout(() => setIsFilling(false), 450);
    };

    return (
      <NavLink
        to={item.to}
        end
        children={({ isActive }) => {
          const showFill = isActive || isFilling;

          return (
            <div
              onMouseDown={handleMouseDown}
              onTouchStart={handleMouseDown}
              className={`relative overflow-hidden flex items-center p-2 rounded-md transition-colors duration-300
      ${
        isActive
          ? "bg-transparent text-gray-900 dark:text-white"
          : "hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
      }
      ${showExpanded ? "justify-normal" : "justify-center"}`}
              aria-label={item.label}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: "100%",
                  transformOrigin: "left",
                  transform: showFill ? "scaleX(1)" : "scaleX(0)",
                  transition: "transform 420ms cubic-bezier(.22,.9,.31,.99)",
                  background:
                    document.documentElement.classList.contains("dark")
                      ? item.colorDark || item.colorLight
                      : item.colorLight,
                  pointerEvents: "none",
                  zIndex: 0,
                }}
              />

              <div style={{ zIndex: 1 }} className="flex items-center">
                <div
                  className={`flex-shrink-0 flex items-center justify-center w-5 transition-transform duration-150`}
                  style={{ transform: isFilling ? "scale(0.92)" : "scale(1)" }}
                >
                  {item.icon}
                </div>

                {showExpanded && (
                  <span className="ml-2 truncate transition-colors duration-200 text-sm" style={{ zIndex: 1 }}>
                    {item.label}
                  </span>
                )}
              </div>
            </div>
          );
        }}
      />
    );
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && effectiveMobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30" onClick={handleRequestClose} aria-hidden />
      )}

      {/* Sidebar */}
      <div
        className={`fixed h-full bg-gray-200 dark:bg-gray-900 transition-all duration-300 z-50 ${sidebarWidth} ${
          isMobile && !effectiveMobileOpen ? "hidden" : "block"
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="flex items-center justify-center p-3 h-14">
            <div className="flex items-center min-w-0">
              <img src={companyLogo} alt={t("sidebar.logoAlt")} className="h-8 w-8 min-w-[2rem]" />
              {showExpanded && (
                <span className="ml-2 text-base font-bold text-gray-900 dark:text-white truncate">{t("sidebar.appName")}</span>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 p-1 overflow-y-auto">
            {mainMenuItems.map((item, idx) => {
              if (item.to === "/notification") {
                return (
                  <div key={`main-${idx}`} className={`${showExpanded ? "" : "flex justify-center"}`}>
                    {/* keep your NotificationPage/Preview integration if you have it */}
                    {/* <NotificationPage item={item} showExpanded={showExpanded} position="right" /> */}
                    {/* Placeholder since NotificationPage wasn't provided */}
                    <MenuItem item={item} showExpanded={showExpanded} />
                  </div>
                );
              }
              return <MenuItem key={`main-${idx}`} item={item} showExpanded={showExpanded} />;
            })}
          </nav>

          {/* User Info */}
          <div className="mt-auto p-2">
            <div className={`flex items-center ${showExpanded ? "justify-start" : "justify-center"}`}>
              {showExpanded ? (
                <div className="flex items-center min-w-0">
                  <div className="relative flex-shrink-0 w-8 h-8 mr-2">
                    {/* --- UPDATED --- */}
                    <AuthenticatedImage
                      src={user?.profilePicture}
                      alt={t("sidebar.profileAlt")}
                      fallbackName={user?.name}
                      fallbackUsername={user?.username}
                      fallbackSeed={user?.name || user?.username}
                      className="w-8 h-8 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                      fallbackClassName="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold bg-gray-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 text-xs"
                    />
                    {/* --- END UPDATE --- */}
                  </div>

                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate text-sm">{formatName(user?.name)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.role || ""}</div>
                  </div>
                </div>
              ) : (
                <div className="relative w-8 h-8">
                  {/* --- UPDATED --- */}
                  <AuthenticatedImage
                    src={user?.profilePicture}
                    alt={t("sidebar.profileAlt")}
                    fallbackName={user?.name}
                    fallbackUsername={user?.username}
                    fallbackSeed={user?.name || user?.username}
                    className="w-8 h-8 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                    fallbackClassName="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold bg-gray-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 text-xs"
                  />
                  {/* --- END UPDATE --- */}
                </div>
              )}
            </div>

            {/* Logout Button */}
            <div>
              <button
                onClick={logout}
                className={`flex items-center w-full mt-2 p-1.5 rounded-md transition-colors duration-200 ${
                  showExpanded ? "justify-start" : "justify-center"
                } bg-red-500 hover:bg-red-600 text-white ${
                  showExpanded ? "min-w-[140px]" : "min-w-[40px]"
                } text-sm`}
                aria-label={t("sidebar.logout")}
              >
                <LogOut size={18} />
                {showExpanded && <span className="ml-2 truncate">{t("sidebar.logout")}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${contentMargin}`}>
        {children}
      </div>
    </>
  );
};

export default Sidebar;