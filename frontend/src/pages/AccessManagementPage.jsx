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
      className={`relative flex items-center gap-2 px-3 py-1 rounded-full transition-all duration-250 ease-out text-xs sm:text-xs md:text-xs
        ${isActive
          ? "bg-white dark:bg-gray-700 shadow-md text-sky-700 dark:text-sky-300 ring-1 ring-sky-200 dark:ring-sky-900/30"
          : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700/60"}
      `}
      style={{
        transform: isActive ? "translateY(-2px)" : undefined,
      }}
    >
      {/* Icon slot */}
      <div className={`flex-shrink-0 ${isActive ? "text-sky-700" : "text-gray-500 dark:text-sky-300"}`}>
        {children}
      </div>

      {/* Text: label + subtitle stacked */}
      <div className="min-w-0 text-left leading-tight">
        <div className="text-[13px] font-semibold truncate">{label}</div>
        {subtitle ? (
          <div className="hidden lg:block text-[11px] text-gray-500 dark:text-gray-400 truncate">
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
      {/* Top Navigation Card */}
      <nav className="bg-transparent">
        <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-4">
          {/* Card wrapper */}
          <div className="rounded-2xl bg-white dark:bg-gray-800 backdrop-blur-sm border border-gray-200/60 dark:border-gray-700/40 shadow-sm transition-all duration-300">
            <div className="px-4 sm:px-6 lg:px-8 py-7 sm:py-3">
              <div className="flex items-center gap-4 h-14 md:h-16">
                {/* Left: Title */}
                <div className="flex-1 min-w-0 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-gray-200 dark:bg-gray-900 flex items-center justify-center shadow-sm">
                    <UserPen className="h-5 w-5 text-sky-600 dark:text-sky-300" />
                  </div>

                  <div className="min-w-0">
                    <h1 className="text-sm sm:text-sm md:text-base lg:text-lg font-extrabold leading-tight truncate">
                      {t("access.title")}
                    </h1>
                    <p className="mt-0.5 text-xs sm:text-xs text-gray-600 dark:text-gray-300 max-w-2xl truncate">
                      {t("access.subtitle")}
                    </p>
                  </div>
                </div>

                {/* Middle: Desktop nav (visible md+) - compact and animated */}
                <div className="hidden md:flex items-center justify-center px-2">
                  <div
                    className="relative flex items-center gap-1 rounded-full bg-white dark:bg-gray-800/40 px-2 py-2 transition-all duration-300"
                    style={{ minWidth: 220 }}
                    aria-label={t("access.navGroupAria") || "Access navigation"}
                  >
                    {navItems.map((item) => {
                      const label = t(`access.nav.${item.key}`);
                      const subtitle = item.subtitleKey ? t(`access.nav.${item.subtitleKey}`) : null;
                      const isActive = activeTab === item.key;
                      return (
                        <div key={item.key} className="relative">
                          <NavButton
                            label={label}
                            subtitle={subtitle}
                            isActive={isActive}
                            onClick={() => setActiveTab(item.key)}
                          >
                            <item.Icon size={16} aria-hidden />
                          </NavButton>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: TopBar - match height visually */}
                <div className="flex-shrink-0 flex items-center h-10 md:h-10">
                  <TopBar />
                </div>
              </div>
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

      {/* small helper styles for subtle animations */}
      <style jsx>{`
        .nav-float {
          transition: transform 200ms cubic-bezier(.2,.9,.2,1), box-shadow 200ms;
        }
        .nav-float:hover {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
