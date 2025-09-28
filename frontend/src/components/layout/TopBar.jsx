import React from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import NotificationPreview from "../layout/NotificationsPreview";
import { useSidebar } from "../../context/SidebarContext";
import { useTheme } from "../../context/ThemeContext";

const TopBar = () => {
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { dark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 backdrop-blur-sm rounded-full">
      <div className="max-w-8xl mx-auto px-4 py-2 flex items-center">
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-pressed={dark}
            title={dark ? "Switch to light" : "Switch to dark"}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            {dark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />}
          </button>

          <NotificationPreview item={{ to: "/notification", label: "Notifications" }} showExpanded={false} />

          <button
            onClick={toggleSidebar}
            className="md:hidden p-2 rounded-md text-gray-900 dark:text-white transition-colors"
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
