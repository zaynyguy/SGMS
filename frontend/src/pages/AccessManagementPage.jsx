import React, { useState, memo } from "react";
import UsersManagementPage from "./UsersManagementPage";
import RolesManagementPage from "./RolesManagementPage";
import GroupsManagementPage from "./GroupsManagementPage";
import { Users, Key, Layers, UserPen } from "lucide-react";
import { useTranslation } from "react-i18next";
import TopBar from "../components/layout/TopBar";

// Centralized navigation data (labels come from i18n)
const navItems = [
  { key: "users", Icon: Users },
  { key: "roles", Icon: Key },
  { key: "groups", Icon: Layers },
];

function NavButton({ label, subtitle, isActive, onClick, children }) {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm transition
        ${
          isActive
            ? "bg-white dark:bg-gray-700 shadow text-sky-700 dark:text-sky-300"
            : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
        }
      `}
    >
      {/* Icon slot */}
      <div className={`flex-shrink-0 ${isActive ? "text-sky-700" : "dark:text-sky-300"}`}>
        {children}
      </div>

      {/* Text: label + subtitle stacked */}
      <div className="min-w-0 text-left">
        <div className="text-sm font-semibold truncate">{label}</div>
        {/* subtitle hidden on md and below to avoid layout breaking; visible on lg+ */}
        {subtitle ? (
          <div className="hidden lg:block text-xs text-gray-500 dark:text-gray-400 truncate">
            {subtitle}
          </div>
        ) : null}
      </div>
    </button>
  );
}

export default function AccessManagement() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Top Navigation Bar */}
      <nav className="bg-gray-200 dark:bg-gray-900">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16 md:h-20">
            {/* Left: Title (single-line, truncates) */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
                  <UserPen className="h-6 w-6 text-sky-600 dark:text-sky-300" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl font-extrabold leading-tight truncate">
                    {t("access.title")}
                  </h1>
                  {/* subtitle hidden on md and below to avoid layout issues */}
                  <p className="hidden lg:block mt-1 text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl">
                    {t("access.subtitle")}
                  </p>
                </div>
              </div>
            </div>

            {/* Middle: Desktop nav (visible md+) */}
            <div className="hidden md:flex items-center space-x-2 rounded-full bg-gray-100 dark:bg-gray-800/40 p-1">
              {navItems.map((item) => {
                const label = t(`access.nav.${item.key}`);
                const subtitle = item.subtitleKey ? t(`access.nav.${item.subtitleKey}`) : null;
                const isActive = activeTab === item.key;
                return (
                  <NavButton
                    key={item.key}
                    label={label}
                    subtitle={subtitle}
                    isActive={isActive}
                    onClick={() => setActiveTab(item.key)}
                  >
                    <item.Icon size={16} aria-hidden />
                  </NavButton>
                );
              })}
            </div>

            {/* Right: TopBar - always visible */}
            <div className="flex-shrink-0">
              <TopBar />
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
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
                    ? "bg-white dark:bg-gray-700 shadow text-sky-700 dark:text-sky-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
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
