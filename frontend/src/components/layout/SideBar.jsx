// src/components/layout/Sidebar.jsx
import React, { useState, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  User,
  ChevronDown,
  Shield,
  Layers,
  Table2
} from "lucide-react";
import companyLogo from "../../assets/logo.png";
import { useSidebar } from "../../context/SidebarContext";
import AuthenticatedImage from "../common/AuthenticatedImage";

const Sidebar = ({ children, isOpen: mobileIsOpen, onToggle, onRequestClose }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(false);
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const lightColors = {
    primary: "#10B981",
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBF7D0",
    onPrimaryContainer: "#047857",
    secondary: "#4F7AE6",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DBE6FD",
    onSecondaryContainer: "#0B2962",
    tertiary: "#9333EA",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E9D7FD",
    onTertiaryContainer: "#381E72",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
    background: "#FFFFFF",
    onBackground: "#111827",
    surface: "#FFFFFF",
    onSurface: "#111827",
    surfaceVariant: "#EEF2F7",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
    outlineVariant: "#C2C9C2",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#99F6E4",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F8FAFB",
    surfaceContainer: "#F4F6F8",
    surfaceContainerHigh: "#EEF2F7",
    surfaceContainerHighest: "#EEF2F7",
  };

  const darkColors = {
    primary: "#4ADE80",
    onPrimary: "#002115",
    primaryContainer: "#003925",
    onPrimaryContainer: "#BBF7D0",
    secondary: "#B6C9FF",
    onSecondary: "#1E307D",
    secondaryContainer: "#354796",
    onSecondaryContainer: "#DBE6FD",
    tertiary: "#D0BCFF",
    onTertiary: "#4F308B",
    tertiaryContainer: "#6745A3",
    onTertiaryContainer: "#E9D7FD",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    background: "#1A1C19",
    onBackground: "#E1E3DD",
    surface: "#1A1C19",
    onSurface: "#E1E3DD",
    surfaceVariant: "#444C45",
    onSurfaceVariant: "#C2C9C2",
    outline: "#8C948D",
    outlineVariant: "#444C45",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#E1E3DD",
    inverseOnSurface: "#1A1C19",
    inversePrimary: "#006D5B",
    surfaceContainerLowest: "#222421",
    surfaceContainerLow: "#2D2F2C",
    surfaceContainer: "#313330",
    surfaceContainerHigh: "#3B3D3A",
    surfaceContainerHighest: "#454744",
    horizantalactivebar: "#1E3A8A"
  };

  const m3Colors = darkMode ? darkColors : lightColors;

  const { sidebarOpen: ctxOpen, toggleSidebar: ctxToggle, closeSidebar: ctxClose } = useSidebar();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [openMenu, setOpenMenu] = useState(null);

  const location = useLocation();

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

  const hasPermission = (permission) => user?.permissions?.includes(permission);

  const mainMenuItems = [
    {
      key: "dashboard",
      to: "/dashboard",
      icon: <Home size={20} />,
      label: t("sidebar.menu.dashboard"),
    },
    hasPermission("manage_access") && {
      key: "access",
      icon: <UserPen size={20} />,
      label: t("sidebar.menu.accessManagement"),
      children: [
        { to: "/accessmanagement/usermanagement", label: t("sidebar.menu.userManagement") || "User Management", icon: <User size={16} /> },
        { to: "/accessmanagement/rolemanagement", label: t("sidebar.menu.roleManagement") || "Role Management", icon: <Shield size={16} /> },
        { to: "/accessmanagement/groupmanagement", label: t("sidebar.menu.groupManagement") || "Group Management", icon: <Layers size={16} /> },
      ],
    },
    (hasPermission("manage_gta") || hasPermission("view_gta")) && {
      key: "projects",
      to: "/project",
      icon: <Target size={20} />,
      label: t("sidebar.menu.projectManagement"),
    },
    (hasPermission("manage_reports")) && {
      key: "reports",
      icon: <FileText size={20} />,
      label: t("sidebar.menu.reports"),
      children: [
        { to: "/report/review", label: t("sidebar.menu.reportReview") || "Report Review", icon: <ClipboardCheck size={16} /> },
        { to: "/report/master", label: t("sidebar.menu.masterReport") || "Master Report", icon: <Table2 size={16} /> },
      ],
    },
    hasPermission("manage_attachments") && {
      key: "attachments",
      to: "/attachment",
      icon: <Paperclip size={20} />,
      label: t("sidebar.menu.attachments"),
    },
    hasPermission("view_audit_logs") && {
      key: "audit",
      to: "/auditlog",
      icon: <ClipboardCheck size={20} />,
      label: t("sidebar.menu.audit"),
    },
    hasPermission("manage_settings") && {
      key: "system",
      to: "/systemsettings",
      icon: <Settings2Icon size={20} />,
      label: t("sidebar.menu.systemSettings"),
    },
    {
      key: "settings",
      to: "/settings",
      icon: <Settings size={20} />,
      label: t("sidebar.menu.settings"),
    },
  ]
    .filter(Boolean)
    .map((it) => {
      if (!it.children) return it;
      return {
        ...it,
        children: it.children.filter((c) => (c.permission ? hasPermission(c.permission) : true)),
      };
    });

  useEffect(() => {
    const found = mainMenuItems.find((it) => it.children && it.children.some((ch) => location.pathname.startsWith(ch.to)));
    if (found) setOpenMenu(found.key);
  }, [location.pathname]);

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
  const contentMargin = !isMobile ? (showExpanded ? "ml-64" : "ml-16") : "ml-0";

  const formatName = (name) => {
    if (!name) return "";
    return name.length > 15 && !showExpanded ? `${name.substring(0, 12)}...` : name;
  };

  const getAvatarFallback = () => {
    if (user?.name) return user.name.charAt(0).toUpperCase();
    if (user?.username) return user.username.charAt(0).toUpperCase();
    return "U";
  };

  const MenuItem = ({ item, showExpanded }) => {
    const [isFilling, setIsFilling] = useState(false);
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const isOpen = openMenu === item.key;

    const handleMouseDown = () => {
      setIsFilling(true);
      setTimeout(() => setIsFilling(false), 350);
    };

    const toggleMenu = (e) => {
      e?.preventDefault();
      if (!hasChildren) {
        if (item.to) navigate(item.to);
        return;
      }
      setOpenMenu((cur) => {
        const opening = cur !== item.key;
        if (opening && item.children && item.children[0] && item.children[0].to) {
          try {
            navigate(item.children[0].to);
          } catch (err) {}
        }
        return opening ? item.key : null;
      });
    };

    return hasChildren ? (
      <div>
        <button
          onClick={toggleMenu}
          onMouseDown={handleMouseDown}
          className={`relative overflow-hidden flex items-center p-2.5 rounded-xl transition-all duration-300 w-full ${
            isOpen 
              ? "bg-[var(--primary-container)] text-[var(--on-primary-container)] dark:text-indigo-200 dark:bg-indigo-900" 
              : "text-[var(--on-surface-variant)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700"
          } ${showExpanded ? "justify-between" : "justify-center"}`}
          aria-expanded={isOpen}
          aria-controls={`${item.key}-submenu`}
        >
          <div className="flex items-center gap-3" style={{ zIndex: 1 }}>
            <div className={`flex items-center justify-center w-5 h-5 rounded-lg`}>
              {React.cloneElement(item.icon, { size: 20 })}
            </div>

            {showExpanded && <span className="truncate text-sm font-medium">{item.label}</span>}
          </div>

          {showExpanded && (
            <span className={`transition-transform duration-200 ${isOpen ? "rotate-180" : "rotate-0"}`}>
              <ChevronDown size={16} />
            </span>
          )}
        </button>

        <div
          id={`${item.key}-submenu`}
          className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 origin-top ${
            isOpen ? "max-h-96 opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-1"
          }`}
          aria-hidden={!isOpen}
        >
          <div className={`mt-1 flex flex-col gap-1 px-1 ${showExpanded ? "ml-6" : "ml-0"}`}>
            {item.children.map((child, i) => (
              <NavLink
                key={`${item.key}-child-${i}`}
                to={child.to}
                end
                className={({ isActive }) =>
                  `flex items-center p-2 rounded-lg text-sm transition-colors duration-150 ${
                    isActive
                      ? "bg-[var(--primary-container)] text-[var(--on-primary-container)] dark:text-indigo-200 dark:bg-indigo-900"
                      : "text-[var(--on-surface-variant)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700"
                  } ${showExpanded ? "" : "justify-center"}`
                }
                onMouseDown={handleMouseDown}
              >
                {child.icon && <div className="flex-shrink-0 w-4 h-4 mr-2 flex items-center justify-center">{child.icon}</div>}
                {showExpanded ? <span className="truncate">{child.label}</span> : <span className="sr-only">{child.label}</span>}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    ) : (
      <NavLink
        to={item.to}
        end
        children={({ isActive }) => {
          return (
            <div
              onMouseDown={handleMouseDown}
              className={`relative overflow-hidden flex items-center p-2.5 rounded-xl transition-all duration-300 ${
                isActive
                  ? "bg-[var(--primary-container)] text-[var(--on-primary-container)] dark:text-indigo-200 dark:bg-indigo-900"
                  : "text-[var(--on-surface-variant)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700"
              } ${showExpanded ? "justify-start" : "justify-center"}`}
              aria-label={item.label}
            >
              <div style={{ zIndex: 1 }} className="flex items-center">
                <div className={`flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-lg transition-all duration-200`}>
                  {React.cloneElement(item.icon, { size: 20 })}
                </div>

                {showExpanded && (
                  <span className={`ml-3 truncate text-sm font-medium`} style={{ zIndex: 1 }}>
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
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--on-background)] dark:bg-gray-900 dark:text-gray-100" style={{
      "--primary": m3Colors.primary,
      "--on-primary": m3Colors.onPrimary,
      "--primary-container": m3Colors.primaryContainer,
      "--on-primary-container": m3Colors.onPrimaryContainer,
      "--secondary": m3Colors.secondary,
      "--on-secondary": m3Colors.onSecondary,
      "--secondary-container": m3Colors.secondaryContainer,
      "--on-secondary-container": m3Colors.onSecondaryContainer,
      "--tertiary": m3Colors.tertiary,
      "--on-tertiary": m3Colors.onTertiary,
      "--tertiary-container": m3Colors.tertiaryContainer,
      "--on-tertiary-container": m3Colors.onTertiaryContainer,
      "--error": m3Colors.error,
      "--on-error": m3Colors.onError,
      "--error-container": m3Colors.errorContainer,
      "--on-error-container": m3Colors.onErrorContainer,
      "--background": m3Colors.background,
      "--on-background": m3Colors.onBackground,
      "--surface": m3Colors.surface,
      "--on-surface": m3Colors.onSurface,
      "--surface-variant": m3Colors.surfaceVariant,
      "--on-surface-variant": m3Colors.onSurfaceVariant,
      "--outline": m3Colors.outline,
      "--outline-variant": m3Colors.outlineVariant,
      "--shadow": m3Colors.shadow,
      "--scrim": m3Colors.scrim,
      "--inverse-surface": m3Colors.inverseSurface,
      "--inverse-on-surface": m3Colors.inverseOnSurface,
      "--inverse-primary": m3Colors.inversePrimary,
      "--surface-container-lowest": m3Colors.surfaceContainerLowest,
      "--surface-container-low": m3Colors.surfaceContainerLow,
      "--surface-container": m3Colors.surfaceContainer,
      "--surface-container-high": m3Colors.surfaceContainerHigh,
      "--surface-container-highest": m3Colors.surfaceContainerHighest,
    }}>
      {isMobile && effectiveMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 transition-opacity duration-300" 
          onClick={handleRequestClose} 
          aria-hidden
        />
      )}

      <div
        className={`fixed h-full bg-[var(--surface-container-low)] dark:bg-gray-800 border-r border-[var(--outline)]/[0.12] dark:border-gray-700 transition-all duration-300 z-50 ${sidebarWidth} ${
          isMobile && !effectiveMobileOpen ? "translate-x-[-100%]" : "translate-x-0"
        }`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-center p-3 h-16 border-b border-[var(--outline)]/[0.12] dark:border-gray-700 bg-[var(--background)] dark:bg-gray-800">
              <div className="flex items-center min-w-0 transition-all duration-300">
                <div className={`${showExpanded ? 'mr-2' : 'mx-auto'} flex-shrink-0`}> 
                  <img
                    src={companyLogo}
                    alt={t("sidebar.logoAlt")}
                    className="h-8 w-8 min-w-[2rem] transition-all duration-300"
                    width="32"
                    height="32"
                    decoding="async"
                    loading="eager"
                  />
                </div>
                {showExpanded && (
                  <span className="text-lg font-bold text-[var(--on-surface)] dark:text-white truncate transition-opacity duration-300">
                    {t("sidebar.appName")}
                  </span>
                )}
              </div>
          </div>

          <nav className="flex-1 py-2 bg-[var(--background)] dark:bg-gray-800 space-y-1 overflow-y-auto px-2">
            {mainMenuItems.map((item, idx) => {
              return <MenuItem key={`main-${item.key || idx}`} item={item} showExpanded={showExpanded} />;
            })}
          </nav>

          <div className="mt-auto p-3 bg-[var(--background)] dark:bg-gray-800 border-t border-[var(--outline)]/[0.12] dark:border-gray-700">
            <div className={`flex items-center gap-3 ${showExpanded ? "justify-start" : "justify-center"}`}>
              <div className={`flex items-center ${showExpanded ? "min-w-0" : "justify-center"}`}>
                <div className="relative flex-shrink-0 w-8 h-8">
                  <AuthenticatedImage
                    src={user?.profilePicture}
                    alt={t("sidebar.profileAlt")}
                    fallbackName={user?.name}
                    fallbackUsername={user?.username}
                    fallbackSeed={user?.name || user?.username}
                    className="w-8 h-8 rounded-full object-cover border-2 border-[var(--outline)]/[0.12] dark:border-gray-600"
                    fallbackClassName="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium bg-[var(--primary)] text-xs dark:bg-green-600"
                  />
                </div>

                {showExpanded && (
                  <div className="min-w-0 ms-2">
                    <div className="font-medium text-[var(--on-surface)] dark:text-white truncate text-sm leading-tight">{formatName(user?.name)}</div>
                    <div className="text-xs text-[var(--on-surface-variant)] dark:text-gray-400 truncate">{user?.role || ""}</div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={logout}
                className={`flex items-center w-full p-2.5 rounded-xl transition-all duration-200 ${
                  showExpanded ? "justify-start" : "justify-center"
                } bg-[var(--error)] hover:bg-[var(--error-container)] text-[var(--on-error)] dark:bg-red-700 dark:hover:bg-red-600 ${
                  showExpanded ? "min-w-[140px] gap-3" : "min-w-[40px]"
                }`}
                aria-label={t("sidebar.logout")}
              >
                <LogOut size={20} />
                {showExpanded && <span className="truncate font-medium">{t("sidebar.logout")}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={`transition-all duration-300 ${contentMargin} min-h-screen bg-white dark:bg-gray-900`}>
        {children}
      </div>
    </div>
  );
};

export default Sidebar;
