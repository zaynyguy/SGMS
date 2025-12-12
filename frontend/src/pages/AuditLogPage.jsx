import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Download,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
} from "lucide-react";
import { fetchAuditLogs } from "../api/audit";
import TopBar from "../components/layout/TopBar";
import Toast from "../components/common/Toast";

const SKELETON_ROWS = 8;
const DEFAULT_PAGE_SIZE = 100;
const ROW_HEIGHT_PX = 56;

const SkeletonRowDesktop = () => (
  <tr className="transition-all duration-500 ease-in-out">
    <td className="px-3 py-2 align-top transition-all duration-300">
      <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-40 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 align-top transition-all duration-300">
      <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-32 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 hidden lg:table-cell align-top transition-all duration-300">
      <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-24 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 align-top transition-all duration-300">
      <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-16 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 hidden lg:table-cell align-top transition-all duration-300">
      <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-60 animate-pulse transition-colors duration-300" />
    </td>
    <td className="px-3 py-2 align-top transition-all duration-300">
      <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-4 animate-pulse transition-colors duration-300" />
    </td>
  </tr>
);

const SkeletonCardMobile = () => (
  <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-xl p-3 shadow-sm border border-[var(--outline-variant)] dark:border-gray-700 w-full transition-all duration-500 ease-in-out transform hover:scale-[1.02] surface-elevation-1">
    <div className="h-3 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-1/2 mb-2 animate-pulse transition-colors duration-300" />
    <div className="h-2.5 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-3/4 mb-1.5 animate-pulse transition-colors duration-300" />
    <div className="h-2.5 bg-[var(--surface-container)] dark:bg-gray-700 rounded w-1/3 animate-pulse transition-colors duration-300" />
  </div>
);

const App = ({ showToast: propShowToast }) => {
  const { t } = useTranslation();

  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);

  // Material Design 3 color system - light theme
  const lightColors = {
    primary: "#10B981", // Green 40
    onPrimary: "#FFFFFF",
    primaryContainer: "#BBF7D0", // Light green container
    onPrimaryContainer: "#047857", // Dark green text on container
    secondary: "#4F7AE6",
    onSecondary: "#FFFFFF",
    secondaryContainer: "#DBE6FD",
    onSecondaryContainer: "#0B2962",
    tertiary: "#9333EA",
    onTertiary: "#FFFFFF",
    tertiaryContainer: "#E9D7FD",
    onTertiaryContainer: "#381E72",
    error: "#B3261E",
    onError: "#FFFFFF",
    errorContainer: "#F9DEDC",
    onErrorContainer: "#410E0B",
    background: "#F8FAF5",
    onBackground: "#1C1B1F",
    surface: "#F8FAF5",
    onSurface: "#1C1B1F",
    surfaceVariant: "#D8E8D9",
    onSurfaceVariant: "#444C45",
    outline: "#737B73",
    outlineVariant: "#C2C9C2",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#313033",
    inverseOnSurface: "#F4EFF4",
    inversePrimary: "#99F6E4",
    surfaceContainerLowest: "#FFFFFF",
    surfaceContainerLow: "#F5F9F2",
    surfaceContainer: "#F0F5ED",
    surfaceContainerHigh: "#EBF1E9",
    surfaceContainerHighest: "#E5ECE3",
  };

  // Material Design 3 color system - dark theme
  const darkColors = {
    primary: "#4ADE80", // Lighter green for dark mode
    onPrimary: "#002115",
    primaryContainer: "#003925",
    onPrimaryContainer: "#BBF7D0",
    secondary: "#B6C9FF",
    onSecondary: "#1E307D",
    secondaryContainer: "#354796",
    onSecondaryContainer: "#DBE6FD",
    tertiary: "#D0BCFF",
    onTertiary: "#4F308B",
    tertiaryContainer: "#6745A3",
    onTertiaryContainer: "#E9D7FD",
    error: "#FFB4AB",
    onError: "#690005",
    errorContainer: "#93000A",
    onErrorContainer: "#FFDAD6",
    background: "#1A1C19",
    onBackground: "#E1E3DD",
    surface: "#1A1C19",
    onSurface: "#E1E3DD",
    surfaceVariant: "#444C45",
    onSurfaceVariant: "#C2C9C2",
    outline: "#8C948D",
    outlineVariant: "#444C45",
    shadow: "#000000",
    scrim: "#000000",
    inverseSurface: "#E1E3DD",
    inverseOnSurface: "#1A1C19",
    inversePrimary: "#006D5B",
    surfaceContainerLowest: "#222421",
    surfaceContainerLow: "#2D2F2C",
    surfaceContainer: "#313330",
    surfaceContainerHigh: "#3B3D3A",
    surfaceContainerHighest: "#454744",
  };

  // Select colors based on dark mode
  const m3Colors = darkMode ? darkColors : lightColors;

  const [logs, setLogs] = useState([]);
  const [filteredLogs, setFilteredLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);

  // local single-toast state (simple fallback / local toast system)
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    return () => setMounted(false);
  }, []);

  // toggle row expand with smooth animation
  const toggleRow = (id) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const safeString = (field) => {
    if (!field) return "";
    if (typeof field === "string") return field;
    if (typeof field === "object") {
      try {
        return JSON.stringify(field);
      } catch {
        return String(field);
      }
    }
    return String(field);
  };

  // normalize toast types to match your Toast component
  const normalizeToastType = (type) => {
    if (!type) return "create"; // default
    const tLower = String(type).toLowerCase();
    if (tLower === "success") return "create";
    if (tLower === "info") return "read";
    if (tLower === "warning") return "update";
    if (["create", "read", "update", "delete", "error"].includes(tLower)) return tLower;
    return "create";
  };

  const showToastLocal = (message, type = "create") => {
    const normalized = normalizeToastType(type);
    setToast({ id: Date.now(), message, type: normalized });
  };

  // final showToast used inside this component: prefer propShowToast if provided
  const showToast = (message, type = "create") => {
    if (typeof propShowToast === "function") {
      try {
        propShowToast(message, type);
      } catch (e) {
        // fallback to local toast if prop throws
        showToastLocal(message, type);
      }
    } else {
      showToastLocal(message, type);
    }
  };

  // fetch logs for current page, from/to and page/offset
  const loadLogs = async (opts = {}) => {
    const usePage = opts.page ?? page;
    const usePageSize = opts.pageSize ?? pageSize;
    setLoading(true);
    try {
      const offset = (usePage - 1) * usePageSize;
      const resp = await fetchAuditLogs({
        from: fromDate ? new Date(fromDate).toISOString() : undefined,
        to: toDate ? new Date(toDate).toISOString() : undefined,
        limit: usePageSize,
        offset,
      });
      // backend returns { rows, total }
      const dataRows = (resp && resp.rows) || [];
      const dataTotal = (resp && typeof resp.total === "number") ? resp.total : dataRows.length;
      setLogs(dataRows);
      setFilteredLogs(dataRows);
      setTotal(dataTotal);
    } catch (err) {
      console.error("Failed to load audit logs", err);
      showToast && showToast(t("audit.loadFailed"), "error");
      setLogs([]);
      setFilteredLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  // reload when from/to/page change
  useEffect(() => {
    loadLogs({ page });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, page]);

  // client-side search filters only current page (keeps UI snappy)
  useEffect(() => {
    const q = String(searchQuery || "").toLowerCase();
    const temp = logs.filter((log) => {
      return (
        safeString(log.username).toLowerCase().includes(q) ||
        safeString(log.name).toLowerCase().includes(q) ||
        safeString(log.entity).toLowerCase().includes(q) ||
        safeString(log.action).toLowerCase().includes(q) ||
        safeString(log.details).toLowerCase().includes(q)
      );
    });
    setFilteredLogs(temp);
  }, [searchQuery, logs]);

  const handleApplyFilters = () => {
    setPage(1);
    loadLogs({ page: 1 });
    setShowFilters(false);
    showToast && showToast(t("audit.filters.applied"), "info");
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setPage(1);
    loadLogs({ page: 1 });
    showToast && showToast(t("audit.filters.cleared"), "info");
  };

  const handleExportCSV = () => {
    const headers = [
      t("audit.table.timestamp"),
      t("audit.table.user"),
      t("audit.table.entity"),
      t("audit.table.action"),
      t("audit.table.details"),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      filteredLogs
        .map((log) =>
          [
            `"${new Date(log.createdAt || "").toLocaleString()}"`,
            `"${(safeString(log.username) || safeString(log.name)).replace(/"/g, '""')}"`,
            `"${safeString(log.entity).replace(/"/g, '""')}"`,
            `"${safeString(log.action).replace(/"/g, '""')}"`,
            `"${safeString(log.details).replace(/"/g, '""')}"`,
          ].join(",")
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", t("audit.csv.filename"));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast && showToast(t("audit.export.success"), "success");
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize + (logs.length > 0 ? 1 : 0);
  const endIndex = startIndex + logs.length - 1;

  // Enhanced Button style helpers with smooth animations (kept compact)
  const primaryBtn = "px-4 py-2.5 text-sm rounded-full bg-[var(--primary)] hover:bg-[var(--primary-container)] text-[var(--on-primary)] transition-all duration-300 ease-in-out shadow-sm hover:shadow-md";
  const ghostBtn = "px-4 py-2.5 text-sm rounded-full border border-[var(--outline-variant)] dark:border-gray-600 bg-[var(--surface-container-low)] dark:bg-gray-800 text-[var(--on-surface)] dark:text-white hover:bg-[var(--surface-container)] dark:hover:bg-gray-700 transition-all duration-300 ease-in-out";
  const outlineBtn = "px-4 py-2.5 text-sm rounded-full border border-[var(--outline-variant)] dark:border-gray-600 text-[var(--on-surface-variant)] dark:text-gray-400 hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 transition-all duration-300 ease-in-out";

  return (
    <div className={`min-h-screen bg-[var(--background)] dark:bg-gray-900 font-sans transition-colors duration-300 ${mounted ? 'animate-fade-in' : ''}`} 
      style={{
        "--primary": m3Colors.primary,
        "--on-primary": m3Colors.onPrimary,
        "--primary-container": m3Colors.primaryContainer,
        "--on-primary-container": m3Colors.onPrimaryContainer,
        "--secondary": m3Colors.secondary,
        "--on-secondary": m3Colors.onSecondary,
        "--secondary-container": m3Colors.secondaryContainer,
        "--on-secondary-container": m3Colors.onSecondaryContainer,
        "--tertiary": m3Colors.tertiary,
        "--on-tertiary": m3Colors.onTertiary,
        "--tertiary-container": m3Colors.tertiaryContainer,
        "--on-tertiary-container": m3Colors.onTertiaryContainer,
        "--error": m3Colors.error,
        "--on-error": m3Colors.onError,
        "--error-container": m3Colors.errorContainer,
        "--on-error-container": m3Colors.onErrorContainer,
        "--background": m3Colors.background,
        "--on-background": m3Colors.onBackground,
        "--surface": m3Colors.surface,
        "--on-surface": m3Colors.onSurface,
        "--surface-variant": m3Colors.surfaceVariant,
        "--on-surface-variant": m3Colors.onSurfaceVariant,
        "--outline": m3Colors.outline,
        "--outline-variant": m3Colors.outlineVariant,
        "--shadow": m3Colors.shadow,
        "--scrim": m3Colors.scrim,
        "--inverse-surface": m3Colors.inverseSurface,
        "--inverse-on-surface": m3Colors.inverseOnSurface,
        "--inverse-primary": m3Colors.inversePrimary,
        "--surface-container-lowest": m3Colors.surfaceContainerLowest,
        "--surface-container-low": m3Colors.surfaceContainerLow,
        "--surface-container": m3Colors.surfaceContainer,
        "--surface-container-high": m3Colors.surfaceContainerHigh,
        "--surface-container-highest": m3Colors.surfaceContainerHighest,
      }}
    >
      <style>{`
        :root {
          --primary: ${m3Colors.primary};
          --on-primary: ${m3Colors.onPrimary};
          --primary-container: ${m3Colors.primaryContainer};
          --on-primary-container: ${m3Colors.onPrimaryContainer};
          --secondary: ${m3Colors.secondary};
          --on-secondary: ${m3Colors.onSecondary};
          --secondary-container: ${m3Colors.secondaryContainer};
          --on-secondary-container: ${m3Colors.onSecondaryContainer};
          --tertiary: ${m3Colors.tertiary};
          --on-tertiary: ${m3Colors.onTertiary};
          --tertiary-container: ${m3Colors.tertiaryContainer};
          --on-tertiary-container: ${m3Colors.onTertiaryContainer};
          --error: ${m3Colors.error};
          --on-error: ${m3Colors.onError};
          --error-container: ${m3Colors.errorContainer};
          --on-error-container: ${m3Colors.onErrorContainer};
          --background: ${m3Colors.background};
          --on-background: ${m3Colors.onBackground};
          --surface: ${m3Colors.surface};
          --on-surface: ${m3Colors.onSurface};
          --surface-variant: ${m3Colors.surfaceVariant};
          --on-surface-variant: ${m3Colors.onSurfaceVariant};
          --outline: ${m3Colors.outline};
          --outline-variant: ${m3Colors.outlineVariant};
          --shadow: ${m3Colors.shadow};
          --scrim: ${m3Colors.scrim};
          --inverse-surface: ${m3Colors.inverseSurface};
          --inverse-on-surface: ${m3Colors.inverseOnSurface};
          --inverse-primary: ${m3Colors.inversePrimary};
          --surface-container-lowest: ${m3Colors.surfaceContainerLowest};
          "--surface-container-low": ${m3Colors.surfaceContainerLow};
          "--surface-container": ${m3Colors.surfaceContainer};
          "--surface-container-high": ${m3Colors.surfaceContainerHigh};
          "--surface-container-highest": ${m3Colors.surfaceContainerHighest};
        }
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes material-in {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .surface-elevation-1 { 
          box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04); 
          border: 1px solid var(--outline-variant);
        }
        .surface-elevation-2 { 
          box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06); 
          border: 1px solid var(--outline-variant);
        }
        .surface-elevation-3 { 
          box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08); 
          border: 1px solid var(--outline-variant);
        }
      `}</style>
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header card */}
        <div className="mb-6">
          <div className="rounded-2xl bg-[var(--surface-container-low)] dark:bg-gray-800 dark:border-gray-800 surface-elevation-3 px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 gap-4 items-center">
                <div className="p-3 rounded-xl bg-[var(--primary-container)] dark:bg-indigo-900">
                  <ClipboardCheck className="h-6 w-6 text-[var(--on-primary-container)] dark:text-indigo-200 transition-all duration-300 ease-in-out transform hover:rotate-12" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold text-[var(--on-surface)] dark:text-white truncate transition-colors duration-300">
                    {t("audit.title")}
                  </h2>
                  <p className="mt-0.5 text-base text-[var(--on-surface-variant)] dark:text-gray-400 max-w-2xl transition-colors duration-300">
                    {t("audit.subtitle")}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <TopBar />
              </div>
            </div>
          </div>
        </div>
        {/* Card container */}
        <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-2xl dark:border-gray-800 surface-elevation-3 p-4 sm:p-6">
          {/* Actions + Search */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              <button
                onClick={() => setShowFilters(!showFilters)}
                aria-pressed={showFilters}
                className={`${outlineBtn} flex items-center gap-2 justify-center w-full md:w-auto`}
              >
                <Filter size={18} />
                <span className="select-none text-sm">
                  {showFilters ? t("audit.filters.hide") : t("audit.filters.show")}
                </span>
              </button>
              <button
                onClick={handleExportCSV}
                className={`${outlineBtn} flex items-center gap-2 justify-center w-full md:w-auto`}
              >
                <Download size={18} />
                <span className="select-none text-sm">{t("audit.exportCsv")}</span>
              </button>
            </div>
            <div className="relative w-full md:w-[790px]">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-[var(--on-surface-variant)] dark:text-gray-400" />
              </div>
              <input
                type="text"
                placeholder={t("audit.searchPlaceholder")}
                className="block w-full pl-10 pr-3.5 py-2.5 text-sm border border-[var(--outline-variant)] dark:border-gray-600 rounded-xl leading-5 bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white placeholder-[var(--on-surface-variant)] dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)] transition-all duration-300"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label={t("audit.searchAria")}
              />
            </div>
          </div>
          {/* Filters panel */}
          {showFilters && (
            <div className="mb-6 p-4 bg-[var(--surface-container)] dark:bg-gray-700 rounded-xl surface-elevation-1 animate-fade-in">
              <h3 className="text-base font-medium text-[var(--on-surface)] dark:text-white mb-3">
                {t("audit.filters.title")}
              </h3>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/2">
                  <label className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-2">
                    {t("audit.filters.fromDate")}
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full text-base border border-[var(--outline-variant)] dark:border-gray-600 rounded-xl p-2.5 bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  />
                </div>
                <div className="w-full sm:w-1/2">
                  <label className="block text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 mb-2">
                    {t("audit.filters.toDate")}
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full text-base border border-[var(--outline-variant)] dark:border-gray-600 rounded-xl p-2.5 bg-[var(--surface-container-lowest)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-[var(--primary)]"
                  />
                </div>
                <div className="flex items-end gap-3 mt-4 sm:mt-0 sm:w-auto">
                  <button
                    onClick={handleApplyFilters}
                    className={`${primaryBtn} w-full sm:w-auto dark:bg-indigo-800 hover:dark:bg-indigo-700`}
                  >
                    <span className="text-base">{t("audit.filters.apply")}</span>
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className={`${ghostBtn} w-full sm:w-auto`}
                  >
                    <span className="text-base">{t("audit.filters.clear")}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* Mobile stacked list */}
          <div className="md:hidden space-y-4">
            {loading ? (
              Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <div key={i} className="w-full" style={{ animationDelay: `${i * 100}ms` }}>
                  <SkeletonCardMobile />
                </div>
              ))
            ) : filteredLogs.length > 0 ? (
              filteredLogs.map((log, index) => {
                const expanded = expandedRows.has(log.id);
                const actionColor = {
                  create: "bg-[var(--primary-container)] dark:bg-green-900 text-[var(--on-primary-container)] dark:text-green-200",
                  update: "bg-[var(--secondary-container)] dark:bg-blue-900 text-[var(--on-secondary-container)] dark:text-blue-200",
                  delete: "bg-[var(--error-container)] dark:bg-red-900 text-[var(--on-error-container)] dark:text-red-200",
                }[log.action] || "bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white";
                return (
                  <div
                    key={log.id}
                    className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 rounded-xl p-4 surface-elevation-1 transition-all duration-300 hover:surface-elevation-2"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">
                        {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${actionColor}`}
                      >
                        {safeString(log.action)}
                      </span>
                    </div>
                    <p className="text-base font-medium text-[var(--on-surface)] dark:text-white">
                      {safeString(log.username) || safeString(log.name)}
                    </p>
                    <p className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">
                      {safeString(log.entity)}
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRow(log.id); }}
                      className="mt-3 text-base text-[var(--primary)] dark:text-green-400 flex items-center gap-1.5 font-medium"
                      aria-expanded={expanded}
                    >
                      {expanded ? (
                        <>
                          {t("audit.expanded.hide")}
                          <ChevronUp size={16} className="transition-transform duration-300" />
                        </>
                      ) : (
                        <>
                          {t("audit.expanded.show")}
                          <ChevronDown size={16} className="transition-transform duration-300" />
                        </>
                      )}
                    </button>
                    <div className={`
                      transition-all duration-300 ease-in-out overflow-hidden
                      ${expanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}
                    `}>
                      <div className="text-sm text-[var(--on-surface)] dark:text-white space-y-2">
                        <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                          <span className="font-medium text-[var(--on-surface)] dark:text-white">
                            {t("audit.expanded.fullDetails")}:
                          </span>{" "}
                          {safeString(log.details)}
                        </p>
                        <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                          <span className="font-medium text-[var(--on-surface)] dark:text-white">
                            {t('audit.expanded.idLabel')}
                          </span>{" "}
                          {log.id}
                        </p>
                        <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                          <span className="font-medium text-[var(--on-surface)] dark:text-white">
                            {t('audit.expanded.ipLabel')}
                          </span>{" "}
                          {log.ipAddress || t("audit.na")}
                        </p>
                        <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                          <span className="font-medium text-[var(--on-surface)] dark:text-white">
                            {t('audit.expanded.userAgentLabel')}
                          </span>{" "}
                          {log.userAgent || t("audit.na")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 animate-fade-in">
                <Search className="h-12 w-12 text-[var(--on-surface-variant)] dark:text-gray-400 mx-auto" />
                <h3 className="text-xl font-medium text-[var(--on-surface)] dark:text-white mt-2 mb-1">
                  {t("audit.noLogs.title")}
                </h3>
                <p className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 px-2 mx-auto max-w-md">
                  {searchQuery || fromDate || toDate ? t("audit.noLogs.tryAdjust") : t("audit.noLogs.none")}
                </p>
              </div>
            )}
          </div>
          {/* Desktop/table view */}
          <div className="hidden md:block">
            <div className="border border-[var(--outline-variant)] dark:border-gray-700 rounded-xl surface-elevation-1 overflow-hidden">
              {loading ? (
                <div className="" style={{ minHeight: `${SKELETON_ROWS * ROW_HEIGHT_PX}px` }}>
                  <table className="min-w-full divide-y divide-[var(--outline-variant)] dark:divide-gray-700">
                    <thead className="bg-[var(--surface-container)] dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider w-60">
                          {t("audit.table.timestamp")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                          {t("audit.table.user")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                          {t("audit.table.entity")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider w-32">
                          {t("audit.table.action")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                          {t("audit.table.details")}
                        </th>
                        <th className="px-4 py-3 w-12" />
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 divide-y divide-[var(--outline-variant)] dark:divide-gray-700">
                      {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                        <SkeletonRowDesktop key={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="">
                  <table className="min-w-full divide-y divide-[var(--outline-variant)] dark:divide-gray-700">
                    <thead className="bg-[var(--surface-container)] dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider w-60">
                          {t("audit.table.timestamp")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider">
                          {t("audit.table.user")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                          {t("audit.table.entity")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider w-32">
                          {t("audit.table.action")}
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-[var(--on-surface-variant)] dark:text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                          {t("audit.table.details")}
                        </th>
                        <th className="px-4 py-3 w-12" />
                      </tr>
                    </thead>
                    <tbody className="bg-[var(--surface-container-lowest)] dark:bg-gray-800 divide-y divide-[var(--outline-variant)] dark:divide-gray-700">
                      {filteredLogs.map((log, index) => {
                        const actionColor = {
                          create: "bg-[var(--primary-container)] dark:bg-green-900 text-[var(--on-primary-container)] dark:text-green-200",
                          update: "bg-[var(--secondary-container)] dark:bg-blue-900 text-[var(--on-secondary-container)] dark:text-blue-200",
                          delete: "bg-[var(--error-container)] dark:bg-red-900 text-[var(--on-error-container)] dark:text-red-200",
                        }[log.action] || "bg-[var(--surface-container)] dark:bg-gray-700 text-[var(--on-surface)] dark:text-white";
                        return (
                          <React.Fragment key={log.id}>
                            <tr
                              className="hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 cursor-pointer transition-all duration-300"
                              onClick={() => toggleRow(log.id)}
                              style={{ animationDelay: `${index * 30}ms` }}
                            >
                              <td className="px-4 py-4 text-sm text-[var(--on-surface)] dark:text-white align-top truncate">
                                {log.createdAt ? new Date(log.createdAt).toLocaleString() : ""}
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--on-surface)] dark:text-white align-top truncate">
                                {safeString(log.username) || safeString(log.name)}
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--on-surface)] dark:text-white hidden lg:table-cell align-top truncate max-w-[12rem]">
                                {safeString(log.entity) || t("audit.na")}
                              </td>
                              <td className="px-4 py-4 align-top">
                                <span
                                  className={`px-3 py-1 rounded-full text-sm font-medium ${actionColor}`}
                                >
                                  {safeString(log.action)}
                                </span>
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--on-surface)] dark:text-white hidden lg:table-cell align-top truncate max-w-[16rem]">
                                {safeString(log.details) || ""}
                              </td>
                              <td className="px-4 text-[var(--on-surface-variant)] dark:text-gray-400 align-top">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); toggleRow(log.id); }}
                                  aria-expanded={expandedRows.has(log.id)}
                                  className="p-2 rounded-full hover:bg-[var(--surface-container-low)] dark:hover:bg-gray-700 text-[var(--on-surface-variant)] dark:text-gray-400 transition-all duration-200"
                                  title={expandedRows.has(log.id) ? t("audit.expanded.hide") : t("audit.expanded.show")}
                                >
                                  {expandedRows.has(log.id) ? (
                                    <ChevronUp size={18} />
                                  ) : (
                                    <ChevronDown size={18} />
                                  )}
                                </button>
                              </td>
                            </tr>
                            <tr className={`
                              bg-[var(--surface-container-low)] dark:bg-gray-700 transition-all duration-300 overflow-hidden
                              ${expandedRows.has(log.id) ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
                            `}>
                              <td colSpan="6" className="px-4 py-0">
                                <div className={`
                                  transition-all duration-300 overflow-hidden
                                  ${expandedRows.has(log.id) ? 'max-h-96 opacity-100 py-4' : 'max-h-0 opacity-0 py-0'}
                                `}>
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div>
                                      <h4 className="font-medium mb-2 text-sm text-[var(--on-surface)] dark:text-white">
                                        {t("audit.expanded.fullDetails")}
                                      </h4>
                                      <pre className="whitespace-pre-wrap break-words bg-[var(--surface-container)] dark:bg-gray-800 p-3 rounded text-sm text-[var(--on-surface)] dark:text-white border border-[var(--outline-variant)] dark:border-gray-600">
                                        {safeString(log.details)}
                                      </pre>
                                    </div>
                                    <div className="mt-3 lg:mt-0">
                                      <h4 className="font-medium mb-2 text-sm text-[var(--on-surface)] dark:text-white">
                                        {t("audit.expanded.additionalInfo")}
                                      </h4>
                                      <div className="text-sm space-y-2 text-[var(--on-surface)] dark:text-white">
                                        <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                                          <span className="font-medium text-[var(--on-surface)] dark:text-white">
                                            {t("audit.expanded.idLabel")}
                                          </span>{" "}
                                          {log.id}
                                        </p>
                                        <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                                          <span className="font-medium text-[var(--on-surface)] dark:text-white">
                                            {t("audit.expanded.entityLabel")}
                                          </span>{" "}
                                          {safeString(log.entity) || t("audit.na")}
                                        </p>
                                        <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                                          <span className="font-medium text-[var(--on-surface)] dark:text-white">
                                            {t("audit.expanded.ipLabel")}
                                          </span>{" "}
                                          {log.ipAddress || t("audit.na")}
                                        </p>
                                        <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                                          <span className="font-medium text-[var(--on-surface)] dark:text-white">
                                            {t("audit.expanded.userAgentLabel")}
                                          </span>{" "}
                                          {log.userAgent || t("audit.na")}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-16 bg-[var(--surface-container-lowest)] dark:bg-gray-800 animate-fade-in">
                  <div className="flex justify-center mb-4">
                    <Search className="h-12 w-12 text-[var(--on-surface-variant)] dark:text-gray-400" />
                  </div>
                  <h3 className="text-xl font-medium text-[var(--on-surface)] dark:text-white mb-1">
                    {t("audit.noLogs.title")}
                  </h3>
                  <p className="text-base text-[var(--on-surface-variant)] dark:text-gray-400 px-4 mx-auto max-w-md">
                    {searchQuery || fromDate || toDate ? t("audit.noLogs.tryAdjust") : t("audit.noLogs.none")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Bottom pagination (desktop & mobile) */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-base text-[var(--on-surface-variant)] dark:text-gray-400">
            {t("audit.pageFooter", {
              showing: logs.length,
              page,
              totalPages,
              total,
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPage(1)}
              disabled={page <= 1 || loading}
              className={`${outlineBtn} disabled:opacity-50`}
              aria-label={t("audit.first")}
            >
              {t("audit.first")}
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className={`${outlineBtn} disabled:opacity-50`}
              aria-label={t("audit.prev")}
            >
              {t("audit.prev")}
            </button>
            <div className="px-3 py-1.5 text-base text-[var(--on-surface)] dark:text-white">
              {t("audit.gotoPage")} <strong className="mx-1">{page}</strong> / <strong>{totalPages}</strong>
            </div>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className={`${outlineBtn} disabled:opacity-50`}
              aria-label={t("audit.next")}
            >
              {t("audit.next")}
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages || loading}
              className={`${outlineBtn} disabled:opacity-50`}
              aria-label={t("audit.last")}
            >
              {t("audit.last")}
            </button>
          </div>
        </div>
      </div>
      {/* Render the toast (single at a time). If a parent passed showToast, it will be used instead. */}
      {toast && (
        <div className="fixed z-50 right-4 bottom-4 transition-all duration-300 ease-in-out animate-bounce">
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        </div>
      )}
    </div>
  );
};

export default App;