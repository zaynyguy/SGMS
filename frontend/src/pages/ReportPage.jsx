import React, { useState, useEffect, useMemo } from "react";
import { Loader, FileText, ChevronRight, User } from "lucide-react";
import { fetchReports, reviewReport, fetchMasterReport } from "../api/reports";
import { useTranslation } from "react-i18next";
import TopBar from "../components/layout/TopBar";
import { useAuth } from "../context/AuthContext";
import ReviewReportsPage from "./ReportReviewPage"
import MasterReportPageWrapper from "./MasterReportPage"

/* -------------------------
Pills (desktop center) + Mobile bottom nav
------------------------- */
function TabsPills({ value, onChange }) {
  const { t } = useTranslation();
  const options = [
    {
      id: "review",
      labelKey: "reports.tabs.review",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "master",
      labelKey: "reports.tabs.master",
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 11h7v6H3z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <>
      <div className="hidden md:flex items-center justify-end flex-1">
        <div role="tablist" aria-label="reports mode" className="inline-flex bg-gray-100 dark:bg-gray-800 rounded-full p-1 gap-1">
          {options.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                role="tab"
                aria-selected={active}
                aria-pressed={active}
                onClick={() => onChange(opt.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition ${
                  active
                    ? "bg-white dark:bg-gray-700 shadow text-sky-700 dark:text-sky-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <span className="opacity-90">{opt.icon}</span>
                <span className="hidden sm:inline">{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <nav aria-label="reports tabs" className="md:hidden fixed left-4 right-4 bottom-4 z-40">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow p-1.5 flex justify-between items-center">
          {options.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                aria-pressed={active}
                aria-current={active ? "true" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 rounded transition ${
                  active
                    ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className="flex items-center justify-center">{opt.icon}</div>
                <span className="text-xs mt-0.5">{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

/* -------------------------
Main wrapper - switch between review & master
------------------------- */
export default function ReportsUI() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [page, setPage] = useState("review");

  const isAdmin = Array.isArray(user?.permissions) && user.permissions.includes("manage_reports");

  return (
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-3 md:p-4 lg:p-5 max-w-8xl mx-auto transition-colors duration-200">
      {/* Card-style Header */}
      <div className="mb-4 md:mb-5">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 py-3 px-3 transition-all duration-200">
          <div className="flex flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="p-2.5 rounded-lg bg-gray-200 dark:bg-gray-900 border border-sky-100 dark:border-sky-800/30">
                <FileText className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                  <h1 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
                    {t("reports.header.title")}
                  </h1>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 leading-relaxed">
                  {t("reports.header.subtitle")}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3">
              {isAdmin && (
                <div className="hidden md:block">
                  <TabsPills value={page} onChange={setPage} />
                </div>
              )}
              <div className="flex-shrink-0">
                <TopBar />
              </div>
            </div>
          </div>
          
          {isAdmin && (
            <div className="md:hidden">
              <TabsPills value={page} onChange={setPage} />
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="transition-all duration-300">
        {isAdmin ? (
          page === "review" ? (
            <ReviewReportsPage permissions={user.permissions} readonly={false} />
          ) : (
            <MasterReportPageWrapper />
          )
        ) : (
          // Non-admin users see read-only "My Reports" page
          <ReviewReportsPage permissions={user?.permissions} readonly={true} />
        )}
      </div>

      {/* Footer */}
      <footer className="flex justify-center mt-6 md:mt-8 text-center text-gray-500 dark:text-gray-400 text-xs">
        <p>© {new Date().getFullYear()} {t("reports.footer.systemName")} | v2.0</p>
      </footer>
    </div>
  );
}