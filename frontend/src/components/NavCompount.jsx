import React, { useEffect, useState } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import NotificationPreview from "../NotificationPreview"; // <- adjust path if needed
import { useTranslation } from "react-i18next";

/**
 * NavCompound
 * - onToggleMenu, isMenuOpen => control sidebar (optional)
 * - darkMode, onToggleDarkMode => control theme (optional)
 * - compact => hides text labels for small UI
 */
const NavCompound = ({ onToggleMenu, isMenuOpen, darkMode, onToggleDarkMode, compact = false, className = "" }) => {
  const { t } = useTranslation();

  // hamburger: controlled or local
  const [localMenuOpen, setLocalMenuOpen] = useState(false);
  const menuOpen = typeof isMenuOpen === "boolean" ? isMenuOpen : localMenuOpen;

  // theme: controlled or local (reads localStorage on mount)
  const readInitialTheme = () => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return document.documentElement.classList.contains("dark");
  };
  const [localDark, setLocalDark] = useState(readInitialTheme());
  const dark = typeof darkMode === "boolean" ? darkMode : localDark;

  useEffect(() => {
    // keep html class + storage in sync on first mount for uncontrolled mode
    if (typeof darkMode !== "boolean") {
      if (dark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleMenu = () => {
    if (typeof isMenuOpen === "boolean") {
      onToggleMenu?.();
    } else {
      setLocalMenuOpen((v) => !v);
      onToggleMenu?.();
    }
  };

  const handleToggleDark = () => {
    const next = !dark;
    if (typeof onToggleDarkMode === "function") onToggleDarkMode(next);
    if (typeof darkMode !== "boolean") {
      setLocalDark(next);
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Hamburger */}
      <button
        onClick={handleToggleMenu}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? t("nav.closeMenu") || "Close menu" : t("nav.openMenu") || "Open menu"}
        className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Notifications (uses your NotificationPreview component) */}
      <div className="relative">
        <NotificationPreview item={{ to: "/notification", label: t("nav.notifications") || "Notifications" }} showExpanded={!compact} />
      </div>

      {/* Theme toggle */}
      <button
        onClick={handleToggleDark}
        aria-pressed={dark}
        aria-label={dark ? t("nav.switchToLight") || "Switch to light" : t("nav.switchToDark") || "Switch to dark"}
        className="flex items-center gap-2 p-1 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
      >
        <span className="sr-only">{t("nav.toggleTheme") || "Toggle theme"}</span>
        <Sun className={`h-4 w-4 ${dark ? "text-gray-400" : "text-yellow-500"}`} />

        <div className={`mx-2 w-10 h-5 rounded-full transition-colors ${dark ? "bg-sky-600" : "bg-gray-300"}`} aria-hidden>
          <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${dark ? "translate-x-5" : "translate-x-0"}`} />
        </div>

        <Moon className={`h-4 w-4 ${dark ? "text-white" : "text-gray-400"}`} />

        {!compact && <span className="hidden md:inline-block text-sm ml-1">{dark ? t("nav.dark") || "Dark" : t("nav.light") || "Light"}</span>}
      </button>
    </div>
  );
};

export default NavCompound;
