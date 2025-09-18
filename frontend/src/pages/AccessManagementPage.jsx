import React, { useState } from "react";
import UsersManagementPage from "./UsersManagementPage";
import RolesManagementPage from "./RolesManagementPage";
import GroupsManagementPage from "./GroupsManagementPage";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

// Centralized navigation data (labels come from i18n)
const navItems = [
  { key: "users" },
  { key: "roles" },
  { key: "groups" },
];

export default function AccessManagement() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("users");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="bg-gray-200 dark:bg-gray-900 min-h-screen">
      {/* Top Navigation Bar */}
      <nav className="bg-gray-200 dark:bg-gray-900">
        <div className="max-w-8xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-50">
              {t("access.title")}
            </h1>

            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-3 rounded-full bg-white dark:bg-gray-700">
              {navItems.map((item) => {
                const label = t(`access.nav.${item.key}`);
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveTab(item.key)}
                    className={`
                      inline-flex items-center px-5 py-3 border-2 rounded-full text-sm font-medium
                      ${
                        isActive
                          ? "border-blue-500 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                          : "border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300"
                      }
                    `}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Mobile Dropdown */}
            <div className="md:hidden pr-10 relative">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-expanded={mobileMenuOpen}
                aria-label={mobileMenuOpen ? t("access.closeMenu") : t("access.openMenu")}
                className="inline-flex items-center justify-between w-40 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none"
              >
                {t(`access.nav.${activeTab}`)}
                <ChevronDown size={16} className={`transition-transform ${mobileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {mobileMenuOpen && (
                <div className="absolute right-10 w-40 mt-2 origin-top-right bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-10">
                  <div className="py-1">
                    {navItems.map((item) => {
                      const label = t(`access.nav.${item.key}`);
                      const isActive = activeTab === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => {
                            setActiveTab(item.key);
                            setMobileMenuOpen(false);
                          }}
                          className={`block w-full text-left px-4 py-2 text-sm ${
                            isActive
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-8xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="px-4 py-4 sm:p-6">
            {activeTab === "users" && <UsersManagementPage />}
            {activeTab === "roles" && <RolesManagementPage />}
            {activeTab === "groups" && <GroupsManagementPage />}
          </div>
        </div>
      </main>
    </div>
  );
}
