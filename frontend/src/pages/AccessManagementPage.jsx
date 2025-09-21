import React, { useState, memo } from "react";
import UsersManagementPage from "./UsersManagementPage";
import RolesManagementPage from "./RolesManagementPage";
import GroupsManagementPage from "./GroupsManagementPage";
import { Users, Key, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import TopBar from "../components/layout/TopBar";

// Centralized navigation data (labels come from i18n)
const navItems = [
  { key: "users", Icon: Users },
  { key: "roles", Icon: Key },
  { key: "groups", Icon: Layers },
];

const NavButton = memo(function NavButton({ label, isActive, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`inline-flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-full text-sm sm:text-base font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-400 ${
        isActive
          ? "border-2 border-blue-500 text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30"
          : "border-2 border-transparent text-gray-600 dark:text-gray-300 hover:border-gray-200 dark:hover:border-gray-600 hover:text-gray-800 dark:hover:text-gray-200 bg-white/0"
      }`}
    >
      {children}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
});

export default function AccessManagement() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Navigation Bar */}
      <nav className="bg-gray-200 dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16 md:h-20">
            {/* Left: Title (single-line, truncates) */}
            <div className="flex-1 min-w-0">
              <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-extrabold leading-tight truncate">
                {t("access.title")}
              </h1>
            </div>

            {/* Middle: Desktop nav (visible md+) */}
            <div className="hidden md:flex items-center space-x-2 rounded-full bg-white dark:bg-gray-800/40 p-1">
              {navItems.map((item) => {
                const label = t(`access.nav.${item.key}`);
                const isActive = activeTab === item.key;
                return (
                  <NavButton
                    key={item.key}
                    label={label}
                    isActive={isActive}
                    onClick={() => setActiveTab(item.key)}
                  >
                    <item.Icon size={16} aria-hidden />
                  </NavButton>
                );
              })}
            </div>

            {/* Right: TopBar - always visible, doesn't push title */}
            <div className="flex-shrink-0 ml-2">
              <TopBar />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area (padding-bottom so mobile bottom nav doesn't overlap) */}
      <main className="max-w-8xl mx-auto py-6 px-4 sm:px-6 lg:px-8 pb-28 md:pb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-4 sm:p-6">
            {activeTab === "users" && <UsersManagementPage />}
            {activeTab === "roles" && <RolesManagementPage />}
            {activeTab === "groups" && <GroupsManagementPage />}
          </div>
        </div>
      </main>

      {/* Bottom navigation for mobile (visible below md) */}
      <nav className="fixed bottom-4 left-4 right-4 md:hidden z-30">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-2 flex justify-between items-center">
          {navItems.map(({ key, Icon }) => {
            const label = t(`access.nav.${key}`);
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex-1 flex flex-col items-center justify-center py-2 px-2 rounded-lg transition-colors text-xs sm:text-sm ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <Icon size={20} aria-hidden />
                <span className="mt-1 leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
