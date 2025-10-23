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
import React from "react";
import { Menu, X, Sun, Moon } from "lucide-react";
import NotificationPreview from "../layout/NotificationsPreview";
import { useSidebar } from "../../context/SidebarContext";
import { useTheme } from "../../context/ThemeContext";
import LanguageCycler from "../common/LanguageCycler"; // adjust path if necessary

const TopBar = () => {
  const { sidebarOpen, toggleSidebar } = useSidebar();
  const { dark, toggleTheme } = useTheme();

  const handleLangChange = (lang) => {
    console.log("Language changed to:", lang);
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-300 backdrop-blur-sm sm:rounded-full rounded-lg">
      <div className="max-w-8xl mx-auto px-2 py-2 text-gray-900 dark:text-gray-300">
        {/* Mobile: 2x2 grid. sm+: horizontal flex row */}
        <div className="grid grid-cols-2 grid-rows-2 items-center justify-center sm:flex sm:items-center sm:gap-2">

          {/* 3) LanguageCycler */}
          <div className="flex items-center justify-center">
            {/* mobile square */}
            <div className="sm:hidden hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
              <LanguageCycler onChange={handleLangChange} variant="square" />
            </div>

            {/* desktop labeled */}
            <div className="hidden sm:block">
              <LanguageCycler onChange={handleLangChange} variant="default" className="text-sm hover:bg-gray-100 dark:hover:bg-gray-700 hover:rounded-full" />
            </div>
          </div>

          {/* 4) Theme toggle (dark/light) */}
          <div className="flex items-center justify-center">
            {/* mobile square */}
            <button
              onClick={toggleTheme}
              aria-pressed={dark}
              title={dark ? "Switch to light" : "Switch to dark"}
              className="w-12 h-12 rounded-md flex items-center justify-center sm:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {dark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />}
            </button>

            {/* desktop/horizontal */}
            <button
              onClick={toggleTheme}
              aria-pressed={dark}
              title={dark ? "Switch to light" : "Switch to dark"}
              className="hidden sm:inline-flex p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 items-center transition-colors"
            >
              {dark ? <Sun className="h-5 w-5 text-yellow-400" /> : <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300" />}
            </button>
          </div>

          {/* 2) NotificationPreview */}
          <div className="flex items-center justify-center">
            {/* mobile square wrapper */}
            <div className="w-12 h-12 rounded-md flex items-center justify-center sm:hidden">
              {/* keep NotificationPreview small — wrap in a button-like div so it fits the square */}
              <NotificationPreview
                item={{ to: "/notification", label: "Notifications" }}
                showExpanded={false}
              />
            </div>

            {/* desktop/horizontal */}
            <div className="hidden rounded-md sm:flex">
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
              onClick={toggleSidebar}
              className="w-12 h-12 rounded-md flex items-center justify-center sm:hidden p-2 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>

            {/* desktop/horizontal (hidden on mobile) */}
            <button
              onClick={toggleSidebar}
              className="hidden sm:inline-flex p-2 rounded-md text-gray-900 dark:text-white transition-colors"
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
