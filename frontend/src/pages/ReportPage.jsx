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
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M12 5v14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      id: "master",
      labelKey: "reports.tabs.master",
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
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
                className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold transition ${
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
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg p-2 flex justify-between items-center">
          {options.map((opt) => {
            const active = value === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                aria-pressed={active}
                aria-current={active ? "true" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-1 px-2 py-2 rounded-lg transition ${
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
    <div className="min-h-screen bg-gray-200 dark:bg-gray-900 p-4 md:p-6 lg:p-8 max-w-8xl mx-auto transition-colors duration-200">
      <header className="mb-6 md:mb-8">
        <div className="flex items-start md:items-center justify-between gap-4">
          <div className="flex items-center min-w-0 gap-4">
            <div className="p-3 rounded-lg bg-white dark:bg-gray-800">
              <FileText className="h-6 w-6 text-sky-600 dark:text-sky-300" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-extrabold text-gray-900 dark:text-gray-100 truncate">{t("reports.header.title")}</h1>
              <p className="text-base text-gray-600 dark:text-gray-300 mt-2">{t("reports.header.subtitle")}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4">
            {isAdmin && (
              <div className="mt-4 hidden md:block">
                <TabsPills value={page} onChange={setPage} />
              </div>
            )}
            <div className="flex-shrink-0 ml-4">
              <TopBar />
            </div>
          </div>
        </div>
        {isAdmin && (
          <div className="md:hidden">
            <TabsPills value={page} onChange={setPage} />
          </div>
        )}
      </header>

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

      <footer className="flex justify-center mt-10 md:mt-14 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>© {new Date().getFullYear()} {t("reports.footer.systemName")} | v2.0</p>
      </footer>
    </div>
  );
}
