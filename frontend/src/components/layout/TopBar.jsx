// src/layouts/TopBar.jsx
import React from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import NotificationPreview from "../layout/NotificationsPreview"; // adjust path if needed
import { useSidebar } from "../../context/SidebarContext"; // adjust relative path if needed

const TopBar = () => {
  const { sidebarOpen, toggleSidebar } = useSidebar();

  const [dark, setDark] = React.useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return document.documentElement.classList.contains("dark");
  });

  React.useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 backdrop-blur-sm rounded-full">
      <div className="max-w-8xl mx-auto px-4 py-2 flex items-center">
        <div className="flex-1" /> {/* spacer -> keeps controls on the right */}

        <div className="flex items-center gap-2">
          {/* Icon-as-button theme toggle */}
          <button
            onClick={() => setDark((s) => !s)}
            aria-pressed={dark}
            title={dark ? "Switch to light" : "Switch to dark"}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {dark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />}
          </button>

          {/* Notification bell (compact) */}
          <NotificationPreview item={{ to: "/notification", label: "Notifications" }} showExpanded={false} />

          {/* Hamburger (mobile only) */}
          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={sidebarOpen ? "Close menu" : "Open menu"}
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;