// src/components/layout/TopBar.jsx
import React, { useState, useEffect, useRef } from "react";
import { Menu, X, Sun, Moon, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import NotificationPreview from "../layout/NotificationsPreview";
import { useSidebar } from "../../context/SidebarContext";
import { useTheme } from "../../context/ThemeContext";
import LanguageCycler from "../common/LanguageCycler";

const TopBar = () => {
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { dark, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [themeAnimating, setThemeAnimating] = useState(false);
  const [sidebarAnimating, setSidebarAnimating] = useState(false);
  const [isFABExpanded, setIsFABExpanded] = useState(false);
  const fabRef = useRef(null);

  // track whether viewport is "mobile" (< md)
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => setIsMobile(!mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    // initial
    handler();
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  // Close FAB menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fabRef.current && !fabRef.current.contains(event.target)) {
        setIsFABExpanded(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [fabRef]);

  // Add scroll effect for subtle background change
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLangChange = (lang) => {
    console.log("Language changed to:", lang);
    setIsFABExpanded(false);
  };

  const handleThemeToggle = () => {
    setThemeAnimating(true);
    toggleTheme();
    setTimeout(() => setThemeAnimating(false), 600);
    setIsFABExpanded(false);
  };

  const handleSidebarToggle = () => {
    setSidebarAnimating(true);
    toggleSidebar();
    setTimeout(() => setSidebarAnimating(false), 300);
    setIsFABExpanded(false);
  };

  const closeFABMenu = () => {
    setIsFABExpanded(false);
  };

  /* ---------- FAB markup (used both inline and portaled) ---------- */
  const FabMarkup = (
    <div className="relative" ref={fabRef}>
      {/* Main FAB Button */}
      <button
        onClick={() => setIsFABExpanded((s) => !s)}
        className={`w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg transform transition-all duration-300 ${
          isFABExpanded ? "rotate-65" : ""
        }`}
        aria-label={isFABExpanded ? "Close menu" : "Open menu"}
      >
        {isFABExpanded ? (
          <X size={24} className="transition-transform duration-300" />
        ) : (
          <Plus size={24} className="transition-transform duration-300" />
        )}
      </button>

      {/* Expanded Menu Items */}
      {isFABExpanded && (
        <div className="absolute bottom-16 right-0 flex flex-col items-end space-y-4">
          {/* Language Switcher */}
          <div
            className="w-12 h-12 rounded-full bg-green-200 dark:bg-indigo-400 text-green-800 dark:text-indigo-900 flex items-center justify-center shadow-md cursor-pointer transform hover:scale-110 transition-transform"
            onClick={() => {
              // LanguageCycler opens its own UI — we just close FAB when changed via callback
            }}
          >
            <LanguageCycler
              onChange={(lang) => {
                handleLangChange(lang);
                closeFABMenu();
              }}
              variant="square"
              className="w-full h-full flex items-center justify-center"
            />
          </div>

          {/* Theme Toggle */}
          <button
            onClick={handleThemeToggle}
            className="w-12 h-12 rounded-full bg-green-200 dark:bg-indigo-400 text-green-800 dark:text-indigo-900 flex items-center justify-center shadow-md transform hover:scale-110 transition-transform"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? (
              <Sun size={24} className="transition-transform hover:rotate-180" />
            ) : (
              <Moon size={24} className="transition-transform hover:rotate-180" />
            )}
          </button>

          {/* Notifications (uses your NotificationPreview) */}
          <div
            className="w-12 h-12 rounded-full bg-green-200 dark:bg-indigo-400 text-green-800 dark:text-indigo-900 flex items-center justify-center shadow-md transform hover:scale-110 transition-transform"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <NotificationPreview
              item={{ to: "/notification", label: "Notifications" }}
              showExpanded={false}
              className="w-full h-full flex items-center justify-center"
              onOpenSheet={() => setIsFABExpanded(false)}
            />
          </div>

          {/* Burger Menu */}
          <button
            onClick={handleSidebarToggle}
            className="w-12 h-12 rounded-full bg-green-200 dark:bg-indigo-400 text-green-800 dark:text-indigo-900 flex items-center justify-center shadow-md transform hover:scale-110 transition-transform"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            {sidebarOpen ? (
              <X size={24} className="transition-transform rotate-90 hover:rotate-180" />
            ) : (
              <Menu size={24} className="transition-transform hover:rotate-90" />
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Top Bar (hidden on mobile) */}
      <header
        className={`sticky top-0 z-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 backdrop-blur-sm sm:rounded-full rounded-lg transition-all duration-500 ease-out hidden md:block ${
          isScrolled
            ? "shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg transform -translate-y-1"
            : "shadow-sm"
        }`}
      >
        <div className="max-w-8xl mx-auto px-2 py-2 text-gray-900 dark:text-gray-300 transform transition-all duration-300">
          <div className="flex items-center justify-end gap-2 transition-all duration-300">
            {/* Language cycler button */}
            <div className="transform transition-all duration-300 hover:scale-105">
              <LanguageCycler
                onChange={handleLangChange}
                className="text-sm hover:bg-gray-100 dark:hover:bg-gray-700 hover:rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95"
              />
            </div>

            <button
              onClick={handleThemeToggle}
              aria-pressed={dark}
              title={dark ? "Switch to light" : "Switch to dark"}
              className={`p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 items-center transition-all duration-500 transform hover:scale-110 active:scale-95 ${
                themeAnimating ? "animate-pulse scale-125" : ""
              }`}
            >
              {dark ? (
                <Sun className="h-5 w-5 text-yellow-400 transition-all duration-700 transform hover:rotate-180" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300 transition-all duration-700 transform hover:rotate-180" />
              )}
            </button>

            <div className="transform transition-all duration-300 hover:scale-105 active:scale-95">
              <NotificationPreview item={{ to: "/notification", label: "Notifications" }} showExpanded={false} />
            </div>
              
          </div>
        </div>
      </header>

      {/* Mobile FAB */}
      {isMobile ? (
        // render portaled into document.body so it floats above layout and won't be clipped
        typeof document !== "undefined" ? createPortal(
          <div style={{ position: "fixed", right: 24, bottom: 24, zIndex: 60 }}>
            {FabMarkup}
          </div>,
          document.body
        ) : (
          // fallback for SSR / tests
          <div style={{ position: "fixed", right: 24, bottom: 24, zIndex: 60 }}>{FabMarkup}</div>
        )
      ) : (
        // keep the inline FAB hidden on desktop (md:hidden in original), but we return nothing for non-mobile
        <div className="hidden md:hidden" />
      )}

      {/* Custom animation styles */}
      <style>{`
        @keyframes gentleBounce {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .animate-gentle-bounce {
          animation: gentleBounce 0.6s ease-in-out;
        }

        /* Smooth backdrop filter transition */
        header {
          transition: backdrop-filter 0.5s ease-out, background-color 0.5s ease-out, box-shadow 0.5s ease-out, transform 0.5s ease-out;
        }

        /* Enhanced hover states */
        button:hover {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </>
  );
};

export default TopBar;