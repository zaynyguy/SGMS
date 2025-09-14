import React, { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import {
  Home,
  Settings,
  LogOut,
  Menu,
  X,
  UserPen,
  Settings2Icon,
  ClipboardCheck,
  Paperclip,
  FileBarChartIcon,
  FileText,
  Bell,
} from "lucide-react";
import companyLogo from "../../assets/logo.png";

const Sidebar = ({ children }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
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
    },
    {
      to: "/settings",
      icon: <Settings size={24} />,
      label: t("sidebar.menu.settings"),
    },
    hasPermission("manage_settings") && {
      to: "/systemsettings",
      icon: <Settings2Icon size={24} />,
      label: "System Settings",
    },
    hasPermission("view_audit_logs") && {
      to: "/auditLog",
      icon: <ClipboardCheck size={24} />,
      label: "Audit",
    },
    hasPermission("manage_access") && {
      to: "/accessmanagement",
      icon: <UserPen size={24} />,
      label: "Access Management",
    },
    hasPermission("manage_reports") && {
      to: "/report",
      icon: <FileText size={24} />,
      label: "Reports",
    },
    (hasPermission("manage_gta") || hasPermission("view_gta")) && {
      to: "/project",
      icon: <FileBarChartIcon size={24} />,
      label: "Project Management",
    },
    hasPermission("manage_attachments") && {
      to: "/attachment",
      icon: <Paperclip size={24} />,
      label: "Attachments",
    },
    hasPermission("manage_notifications") && {
      to: "/notification",
      icon: <Bell size={24} />,
      label: "notification",
    },
  ].filter(Boolean);

  const toggleSidebar = () => setIsExpanded(!isExpanded);
  const handleMouseEnter = () => !isMobile && setIsHovered(true);
  const handleMouseLeave = () => !isMobile && setIsHovered(false);

  const showExpanded = isMobile ? isExpanded : isHovered;
  const sidebarWidth = showExpanded ? "w-64" : "w-20";
  const contentMargin = !isMobile ? (showExpanded ? "ml-64" : "ml-20") : "ml-0"; // Only push on desktop

  const formatName = (name) => {
    if (!name) return "";
    return name.length > 15 && !showExpanded
      ? `${name.substring(0, 12)}...`
      : name;
  };

  // Get the first letter of the username for the avatar fallback
  const getAvatarFallback = () => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.username) return user.username.charAt(0).toUpperCase();
    return "U";
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="md:hidden top-4 right-3 fixed z-50 p-2 rounded-md bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 shadow-md"
          aria-label={
            isExpanded ? t("sidebar.closeMenu") : t("sidebar.openMenu")
          }
        >
          {isExpanded ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed h-full bg-gray-200 dark:bg-gray-900  transition-all duration-300 z-40 ${sidebarWidth}
          ${isMobile && !isExpanded ? "hidden" : "block"}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="flex items-center justify-center p-4 h-16">
            <div className="flex items-center min-w-0">
              <img
                src={companyLogo}
                alt={t("sidebar.logoAlt")}
                className="h-10 w-10 min-w-[2.5rem]"
              />
              {showExpanded && (
                <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white truncate">
                  {t("sidebar.appName")}
                </span>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
            {mainMenuItems.map((item, idx) => (
              <NavLink
                key={`main-${idx}`}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center p-3 rounded-md transition-colors duration-500  ${
                    isActive
                      ? "bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                  } ${showExpanded ? "justify-normal" : "justify-center"}`
                }
                aria-label={item.label}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-6">
                  {item.icon}
                </div>
                {showExpanded && (
                  <span className="ml-3 truncate">{item.label}</span>
                )}
              </NavLink>
            ))}
          </nav>

          {/* User Info */}
          <div className="mt-auto p-3 ">
            <div
              className={`flex items-center ${
                showExpanded ? "justify-start" : "justify-center"
              }`}
            >
              {showExpanded ? (
                <div className="flex items-center min-w-0">
                  <div className="relative flex-shrink-0 w-10 h-10 mr-3">
                    {user?.profilePicture && !profilePictureError ? (
                      <img
                        src={user.profilePicture}
                        alt="Profile"
                        className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                        onError={() => setProfilePictureError(true)}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 flex items-center justify-center">
                        <span className="font-bold">{getAvatarFallback()}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">
                      {formatName(user?.name)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {user?.role || ""}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative w-10 h-10">
                  {user?.profilePicture && !profilePictureError ? (
                    <img
                      src={user.profilePicture}
                      alt="Profile"
                      className="w-10 h-10 rounded-full object-cover border border-gray-300 dark:border-gray-600"
                      onError={() => setProfilePictureError(true)}
                    />
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
              <button
                onClick={logout}
                className={`flex items-center w-full mt-3 p-2 rounded-md transition-colors duration-200
                  ${showExpanded ? "justify-start" : "justify-center"}
                  bg-red-500 hover:bg-red-600 text-white
                  ${showExpanded ? "min-w-[150px]" : "min-w-[48px]"}`}
                aria-label={t("sidebar.logout")}
              >
                <LogOut size={24} />
                {showExpanded && (
                  <span className="ml-3 truncate">{t("sidebar.logout")}</span>
                )}
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
