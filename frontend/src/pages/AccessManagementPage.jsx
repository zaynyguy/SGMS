import React, { useState, memo } from "react";
import UsersManagementPage from "./UsersManagementPage";
import RolesManagementPage from "./RolesManagementPage";
import GroupsManagementPage from "./GroupsManagementPage";
import { Users, Key, Layers, Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import TopBar from "../components/layout/TopBar";
// Centralized navigation data (labels come from i18n)
const navItems = [
  { key: "users", Icon: Users },
  { key: "roles", Icon: Key },
  { key: "groups", Icon: Layers },
];

const NavButton = memo(function NavButton({
  label,
  isActive,
  onClick,
  className = "",
  children,
}) {
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={`inline-flex items-center px-5 py-3 border-2 rounded-full text-sm font-medium transition-all ${
        isActive
          ? "border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400"
          : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300"
      } ${className}`}
    >
      {children}
      <span className="ml-2">{label}</span>
    </button>
  );
});

export default function AccessManagement() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("users");

  return (
    <div className="bg-gray-200 dark:bg-gray-900 min-h-screen">
      {/* Top Navigation Bar */}
      <nav className="bg-gray-200 dark:bg-gray-900">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 md:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20 relative">
            <h1 className="text-3xl sm:flex font-extrabold text-gray-900 dark:text-gray-50">
              {t("access.title")}
            </h1>

            <div className="flex justify-center items-center">
              {/* Desktop Navigation */}
              <div className="hidden sm:hidden md:flex space-x-2 rounded-full bg-white dark:bg-gray-700 p-1">
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
                      {/* Icon for desktop */}
                      <item.Icon size={18} />
                    </NavButton>
                  );
                })}
              </div>

              {/* Notification (top-right) */}
              <div className="absolute right-1 md:right-7 top-4 bg md:static md:ml-4 border-blue-500 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-gray-700 rounded-full">
                <TopBar />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area (add bottom padding so mobile bottom nav doesn't overlap) */}
      <main className="max-w-8xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-24 md:pb-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-4 sm:p-6">
            {activeTab === "users" && <UsersManagementPage />}
            {activeTab === "roles" && <RolesManagementPage />}
            {activeTab === "groups" && <GroupsManagementPage />}
          </div>
        </div>
      </main>

      {/* Bottom navigation for mobile */}
      <nav className="fixed bottom-4 left-4 right-4 z-30 md:hidden">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-2 flex justify-between items-center">
          {navItems.map(({ key, Icon }) => {
            const label = t(`access.nav.${key}`);
            const isActive = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex-1 flex flex-col items-center justify-center py-2 px-3 rounded-lg transition-all ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <Icon size={20} />
                <span className="text-xs mt-1">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
