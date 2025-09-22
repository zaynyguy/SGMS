// src/components/layout/SideBar.jsx
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
} from "lucide-react";
import companyLogo from "../../assets/logo.png";
import { useSidebar } from "../../context/SidebarContext"; // <<-- ensure this path matches your project

const Sidebar = ({ children, isOpen: mobileIsOpen, onToggle, onRequestClose }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  // Context (will exist if you wrapped app with SidebarProvider)
  const { sidebarOpen: ctxOpen, toggleSidebar: ctxToggle, closeSidebar: ctxClose } = useSidebar();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [profilePictureError, setProfilePictureError] = useState(false);

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

  // Reset profile picture error when user changes
  useEffect(() => {
    setProfilePictureError(false);
  }, [user]);

  const hasPermission = (permission) => user?.permissions?.includes(permission);

  const mainMenuItems = [
    {
      to: "/dashboard",
      icon: <Home size={24} />,
      label: t("sidebar.menu.dashboard"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    hasPermission("manage_access") && {
      to: "/accessmanagement",
      icon: <UserPen size={24} />,
      label: t("sidebar.menu.accessManagement"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    (hasPermission("manage_gta") || hasPermission("view_gta")) && {
      to: "/project",
      icon: <Target size={24} />,
      label: t("sidebar.menu.projectManagement"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    (hasPermission("manage_reports") && hasPermission("view_reports")) && {
      to: "/report",
      icon: <FileText size={24} />,
      label: t("sidebar.menu.reports"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    hasPermission("manage_attachments") && {
      to: "/attachment",
      icon: <Paperclip size={24} />,
      label: t("sidebar.menu.attachments"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    hasPermission("view_audit_logs") && {
      to: "/auditLog",
      icon: <ClipboardCheck size={24} />,
      label: t("sidebar.menu.audit"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    hasPermission("manage_settings") && {
      to: "/systemsettings",
      icon: <Settings2Icon size={24} />,
      label: t("sidebar.menu.systemSettings"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
    {
      to: "/settings",
      icon: <Settings size={24} />,
      label: t("sidebar.menu.settings"),
      colorLight: "rgba(16,185,129)",
      colorDark: "rgba(37,99,200)",
      accentLight: "#10B981",
      accentDark: "#60A5FA",
    },
  ].filter(Boolean);

  /* -----------------------------
     Effective mobile state & handlers
     Prefer props when provided (backwards compat), otherwise use context
     ----------------------------- */
  const effectiveMobileOpen = typeof mobileIsOpen === "boolean" ? mobileIsOpen : ctxOpen;
  const handleMobileToggle = () => {
    if (typeof onToggle === "function") return onToggle();
    if (typeof ctxToggle === "function") return ctxToggle();
    // fallback: local toggle (keeps behavior if neither provided)
    setIsExpanded((v) => !v);
  };
  const handleRequestClose = () => {
    if (typeof onRequestClose === "function") return onRequestClose();
    if (typeof ctxClose === "function") return ctxClose();
    // fallback:
    setIsExpanded(false);
  };

  const toggleSidebar = () => setIsExpanded(!isExpanded);
  const handleMouseEnter = () => !isMobile && setIsHovered(true);
  const handleMouseLeave = () => !isMobile && setIsHovered(false);

  // desktop: hover controls expansion; mobile: effectiveMobileOpen controls visibility
  const showExpanded = isMobile ? effectiveMobileOpen : isHovered;
  const sidebarWidth = showExpanded ? "w-64" : "w-20";
  const contentMargin = !isMobile ? (showExpanded ? "ml-64" : "ml-20") : "ml-0"; // Only push on desktop

  const formatName = (name) => {
    if (!name) return "";
    return name.length > 15 && !showExpanded ? `${name.substring(0, 12)}...` : name;
  };

  // Get the first letter of the username for the avatar fallback
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
              className={`relative overflow-hidden flex items-center p-3 rounded-md transition-colors duration-300
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
                  className={`flex-shrink-0 flex items-center justify-center w-6 transition-transform duration-150`}
                  style={{ transform: isFilling ? "scale(0.92)" : "scale(1)" }}
                >
                  {item.icon}
                </div>

                {showExpanded && (
                  <span className="ml-3 truncate transition-colors duration-200" style={{ zIndex: 1 }}>
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

      {/* Mobile Toggle Button (keeps a page-level button available) */}
      {/* {isMobile && (
        <button
          onClick={handleMobileToggle}
          className="md:hidden top-5 right-3 absolute z-50 p-2 rounded-md bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 shadow-md"
          aria-label={effectiveMobileOpen ? t("sidebar.closeMenu") : t("sidebar.openMenu")}
        >
          {effectiveMobileOpen ? <X size={25} /> : <Menu size={25} />}
        </button>
      )} */}

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
          <div className="flex items-center justify-center p-4 h-16">
            <div className="flex items-center min-w-0">
              <img src={companyLogo} alt={t("sidebar.logoAlt")} className="h-10 w-10 min-w-[2.5rem]" />
              {showExpanded && (
                <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white truncate">{t("sidebar.appName")}</span>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 p-2 overflow-y-auto ">
            {mainMenuItems.map((item, idx) => {
              if (item.to === "/notification") {
                return (
                  <div key={`main-${idx}`} className={`${showExpanded ? "" : "flex justify-center"}`}>
                    {/* keep your NotificationPage/Preview integration if you have it */}
                    <NotificationPage item={item} showExpanded={showExpanded} position="right" />
                  </div>
                );
              }
              return <MenuItem key={`main-${idx}`} item={item} showExpanded={showExpanded} />;
            })}
          </nav>

          {/* User Info */}
          <div className="mt-auto p-3 ">
            <div className={`flex items-center ${showExpanded ? "justify-start" : "justify-center"}`}>
              {showExpanded ? (
                <div className="flex items-center min-w-0">
                  <div className="relative flex-shrink-0 w-10 h-10 mr-3">
                    {user?.profilePicture && !profilePictureError ? (
                      <img src={user.profilePicture} alt={t("sidebar.profileAlt")} className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-600" onError={() => setProfilePictureError(true)} />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 flex items-center justify-center">
                        <span className="font-bold">{getAvatarFallback()}</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{formatName(user?.name)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.role || ""}</div>
                  </div>
                </div>
              ) : (
                <div className="relative w-10 h-10">
                  {user?.profilePicture && !profilePictureError ? (
                    <img src={user.profilePicture} alt={t("sidebar.profileAlt")} className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-600" onError={() => setProfilePictureError(true)} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 flex items-center justify-center">
                      <span className="font-bold">{getAvatarFallback()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logout Button */}
            <div>
              <button onClick={logout} className={`flex items-center w-full mt-3 p-2 rounded-md transition-colors duration-200 ${showExpanded ? "justify-start" : "justify-center"} bg-red-500 hover:bg-red-600 text-white ${showExpanded ? "min-w-[150px]" : "min-w-[48px]"}`} aria-label={t("sidebar.logout")}>
                <LogOut size={24} />
                {showExpanded && <span className="ml-3 truncate">{t("sidebar.logout")}</span>}
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
