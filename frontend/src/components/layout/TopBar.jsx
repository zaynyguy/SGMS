// // TopBar.jsx
// import React from "react";
// import { Menu, X, Sun, Moon } from "lucide-react";
// import NotificationPreview from "../layout/NotificationsPreview";
// import { useSidebar } from "../../context/SidebarContext";
// import { useTheme } from "../../context/ThemeContext";
// import LanguageCycler from "../../components/common/LanguageCycler"; // <-- adjust path as needed

// const TopBar = () => {
//   const { sidebarOpen, toggleSidebar } = useSidebar();
//   const { dark, toggleTheme } = useTheme();

//   const handleLangChange = (lang) => {
//     // optional: do something when language changes (analytics, save to profile, etc.)
//     console.log("Language changed to:", lang);
//   };

//   return (
//     <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 backdrop-blur-sm rounded-full">
//       <div className="max-w-8xl mx-auto px-4 py-2 flex items-center">
//         <div className="flex-1" />

//         <div className="flex items-center gap-2">
//           {/* Language cycler button */}
//           <div className="">
//             <LanguageCycler onChange={handleLangChange} className="text-sm" />
//           </div>

//           <button
//             onClick={toggleTheme}
//             aria-pressed={dark}
//             title={dark ? "Switch to light" : "Switch to dark"}
//             className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
//           >
//             {dark ? (
//               <Sun className="h-5 w-5 text-yellow-400" />
//             ) : (
//               <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
//             )}
//           </button>

//           <NotificationPreview item={{ to: "/notification", label: "Notifications" }} showExpanded={false} />

//           <button
//             onClick={toggleSidebar}
//             className="md:hidden p-2 rounded-md text-gray-900 dark:text-white transition-colors"
//             aria-label={sidebarOpen ? "Close menu" : "Open menu"}
//           >
//             {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
//           </button>
//         </div>
//       </div>
//     </header>
//   );
// };

// export default TopBar;

// TopBar.jsx
import React, { useState, useEffect } from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import NotificationPreview from "../layout/NotificationsPreview";
import { useSidebar } from "../../context/SidebarContext";
import { useTheme } from "../../context/ThemeContext";
import LanguageCycler from "../common/LanguageCycler"; // adjust path if necessary

const TopBar = () => {
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { dark, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [themeAnimating, setThemeAnimating] = useState(false);
  const [sidebarAnimating, setSidebarAnimating] = useState(false);

  // Add scroll effect for subtle background change
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLangChange = (lang) => {
    console.log("Language changed to:", lang);
  };

  const handleThemeToggle = () => {
    setThemeAnimating(true);
    toggleTheme();
    setTimeout(() => setThemeAnimating(false), 600);
  };

  const handleSidebarToggle = () => {
    setSidebarAnimating(true);
    toggleSidebar();
    setTimeout(() => setSidebarAnimating(false), 300);
  };

  return (
    <header 
      className={`sticky top-0 z-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 backdrop-blur-sm sm:rounded-full rounded-lg transition-all duration-500 ease-out ${
        isScrolled 
          ? "shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg transform -translate-y-1" 
          : "shadow-sm"
      }`}
    >
      <div className="max-w-8xl mx-auto px-2 py-2 text-gray-900 dark:text-gray-300 transform transition-all duration-300">
        {/* Mobile: 2x2 grid. sm+: horizontal flex row */}
        <div className="grid grid-cols-2 grid-rows-2 items-center justify-center sm:flex sm:items-center sm:gap-2 transition-all duration-300">

          {/* 3) LanguageCycler */}
          <div className="flex items-center justify-center transform transition-all duration-300 hover:scale-105">
            {/* mobile square */}
            <div className="sm:hidden hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-all duration-300 transform hover:scale-110 active:scale-95">
              <LanguageCycler onChange={handleLangChange} variant="square" />
            </div>

            {/* desktop labeled */}
            <div className="hidden sm:block transform transition-all duration-300 hover:scale-105">
              <LanguageCycler 
                onChange={handleLangChange} 
                variant="default" 
                className="text-sm hover:bg-gray-100 dark:hover:bg-gray-700 hover:rounded-full transition-all duration-300 transform hover:scale-105 active:scale-95" 
              />
            </div>
          </div>

          {/* 4) Theme toggle (dark/light) */}
          <div className="flex items-center justify-center">
            {/* mobile square */}
            <button
              onClick={handleThemeToggle}
              aria-pressed={dark}
              title={dark ? "Switch to light" : "Switch to dark"}
              className={`w-12 h-12 rounded-md flex items-center justify-center sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-500 transform hover:scale-110 active:scale-95 ${
                themeAnimating ? "animate-pulse scale-125" : ""
              }`}
            >
              {dark ? (
                <Sun className="h-5 w-5 text-yellow-400 transition-all duration-700 transform hover:rotate-180" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300 transition-all duration-700 transform hover:rotate-180" />
              )}
            </button>

            {/* desktop/horizontal */}
            <button
              onClick={handleThemeToggle}
              aria-pressed={dark}
              title={dark ? "Switch to light" : "Switch to dark"}
              className={`hidden sm:inline-flex p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 items-center transition-all duration-500 transform hover:scale-110 active:scale-95 ${
                themeAnimating ? "animate-pulse scale-125" : ""
              }`}
            >
              {dark ? (
                <Sun className="h-5 w-5 text-yellow-400 transition-all duration-700 transform hover:rotate-180" />
              ) : (
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300 transition-all duration-700 transform hover:rotate-180" />
              )}
            </button>
          </div>

          {/* 2) NotificationPreview */}
          <div className="flex items-center justify-center transform transition-all duration-300 hover:scale-105">
            {/* mobile square wrapper */}
            <div className="w-12 h-12 rounded-md flex items-center justify-center sm:hidden transition-all duration-300 transform hover:scale-110 active:scale-95">
              {/* keep NotificationPreview small — wrap in a button-like div so it fits the square */}
              <NotificationPreview
                item={{ to: "/notification", label: "Notifications" }}
                showExpanded={false}
              />
            </div>

            {/* desktop/horizontal */}
            <div className="hidden rounded-md sm:flex transition-all duration-300 transform hover:scale-105 active:scale-95">
              <NotificationPreview
                item={{ to: "/notification", label: "Notifications" }}
                showExpanded={false}
              />
            </div>
          </div>

          {/* 1) Sidebar / Hamburger (mobile square + desktop hidden on sm) */}
          <div className="flex md:hidden items-center justify-center">
            {/* mobile square */}
            <button
              onClick={handleSidebarToggle}
              className={`w-12 h-12 rounded-md flex items-center justify-center sm:hidden p-2 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                sidebarAnimating ? "bg-gray-200 dark:bg-gray-600" : ""
              }`}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              {sidebarOpen ? (
                <X 
                  size={20} 
                  className="transition-all duration-500 transform rotate-90 hover:rotate-180" 
                />
              ) : (
                <Menu 
                  size={20} 
                  className="transition-all duration-500 transform hover:rotate-90" 
                />
              )}
            </button>

            {/* desktop/horizontal (hidden on mobile) */}
            <button
              onClick={handleSidebarToggle}
              className={`hidden sm:inline-flex p-2 rounded-md text-gray-900 dark:text-white transition-all duration-300 transform hover:scale-110 active:scale-95 ${
                sidebarAnimating ? "bg-gray-200 dark:bg-gray-600" : ""
              }`}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              {sidebarOpen ? (
                <X 
                  size={20} 
                  className="transition-all duration-500 transform rotate-90 hover:rotate-180" 
                />
              ) : (
                <Menu 
                  size={20} 
                  className="transition-all duration-500 transform hover:rotate-90" 
                />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Custom animation styles */}
      <style jsx>{`
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
    </header>
  );
};

export default TopBar;