import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import TopBar from "../components/layout/TopBar";
import {
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  FileText,
} from "lucide-react";
import Toast from "../components/common/Toast";
import {
  bulkImportActivitiesExcel,
  downloadMasterReportExcel,
} from "../api/reports";

export default function BulkImportPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [isImporting, setIsImporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [importMessage, setImportMessage] = useState(null);
  const [importError, setImportError] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      const data = await downloadMasterReportExcel();
      const url = window.URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `bulk-import-template-${new Date().toISOString().split("T")[0]}.xlsx`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setImportMessage(
        t("common.downloaded_successfully") ||
          "Template downloaded successfully",
      );
    } catch (err) {
      console.error("Download template error:", err);
      setImportError(err.message || "Failed to download template");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      performImport(file);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      performImport(file);
    }
  };

  const performImport = async (file) => {
    if (!file) return;

    setIsImporting(true);
    setImportMessage(null);
    setImportError(null);
    setImportSummary(null);

    try {
      const result = await bulkImportActivitiesExcel(file);

      setImportMessage(t("common.import_successful") || "✓ Import successful!");
      setImportSummary(result.summary);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Bulk import error:", err);
      setImportError(
        err.message ||
          "Failed to import Excel file. Please check the format and try again.",
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface)] dark:bg-gray-900">
      <TopBar />

      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-[var(--on-surface)] dark:text-white mb-2">
            {t("bulk_import.title") || "Bulk Import"}
          </h1>
          <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
            {t("bulk_import.description") ||
              "Import Goals, Tasks, and Activities in bulk from an Excel file"}
          </p>
        </div>

        {/* Alert Box */}
        <div className="bg-[var(--surface-container-low)] dark:bg-gray-800 border border-[var(--outline-variant)] dark:border-gray-700 rounded-lg p-4 mb-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--primary)] dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-[var(--on-surface)] dark:text-white mb-1">
                {t("bulk_import.how_to_use") || "How to use"}
              </h3>
              <ol className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 space-y-1">
                <li>1. Download the template below</li>
                <li>2. Edit Goals, Tasks, and Activities in Excel</li>
                <li>3. Set isDone=true to mark activities complete</li>
                <li>4. Upload the updated file</li>
                <li>5. Progress will automatically update</li>
              </ol>
            </div>
          </div>
        </div>

        {/* Download Template Button */}
        <div className="mb-8">
          <button
            onClick={handleDownloadTemplate}
            disabled={isDownloading}
            className="flex items-center gap-2 px-4 py-3 bg-[var(--primary)] dark:bg-blue-600 text-[var(--on-primary)] dark:text-white rounded-lg hover:bg-[color-mix(in_srgb,var(--primary),black_10%)] dark:hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            <Download className="h-5 w-5" />
            {isDownloading
              ? t("common.downloading") || "Downloading..."
              : t("bulk_import.download_template") || "Download Template"}
          </button>
        </div>

        {/* File Upload Area */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            dragActive
              ? "border-[var(--primary)] bg-[var(--primary)]/5 dark:border-blue-400 dark:bg-blue-500/10"
              : "border-[var(--outline-variant)] dark:border-gray-700"
          } ${!isImporting ? "cursor-pointer" : ""}`}
          role="button"
          tabIndex={0}
          onClick={() => !isImporting && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (!isImporting && (e.key === "Enter" || e.key === " ")) {
              fileInputRef.current?.click();
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={isImporting}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-[var(--surface-container)] dark:bg-gray-800 rounded-full flex items-center justify-center">
              <Upload className="h-6 w-6 text-[var(--primary)] dark:text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-[var(--on-surface)] dark:text-white">
                {isImporting
                  ? t("bulk_import.importing") || "Importing..."
                  : t("bulk_import.drop_or_click") ||
                    "Drop file here or click to browse"}
              </p>
              <p className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400">
                {t("bulk_import.accept_formats") ||
                  "Excel files (.xlsx, .xls) up to 50MB"}
              </p>
            </div>
          </div>

          {isImporting && (
            <div className="mt-4 flex justify-center">
              <div className="w-6 h-6 border-3 border-[var(--primary)] border-t-transparent dark:border-blue-400 dark:border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
        </div>

        {/* Messages */}
        {importError && (
          <div className="mt-6 p-4 bg-[var(--error-container)] dark:bg-red-900/30 border border-[var(--error)] dark:border-red-700 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--on-error-container)] dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-[var(--on-error-container)] dark:text-red-300 mb-1">
                {t("common.error") || "Error"}
              </p>
              <p className="text-sm text-[var(--on-error-container)] dark:text-red-200">
                {importError}
              </p>
            </div>
          </div>
        )}

        {importMessage && (
          <div className="mt-6 p-4 bg-[var(--success-container)] dark:bg-green-900/30 border border-[var(--success)] dark:border-green-700 rounded-lg">
            <div className="flex gap-3">
              <CheckCircle className="h-5 w-5 text-[var(--on-success-container)] dark:text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-[var(--on-success-container)] dark:text-green-300 mb-2">
                  {importMessage}
                </p>

                {importSummary && (
                  <div className="text-sm text-[var(--on-success-container)] dark:text-green-200 space-y-1">
                    {importSummary.goals_created > 0 && (
                      <p>✓ Created {importSummary.goals_created} goal(s)</p>
                    )}
                    {importSummary.goals_updated > 0 && (
                      <p>✓ Updated {importSummary.goals_updated} goal(s)</p>
                    )}
                    {importSummary.tasks_created > 0 && (
                      <p>✓ Created {importSummary.tasks_created} task(s)</p>
                    )}
                    {importSummary.tasks_updated > 0 && (
                      <p>✓ Updated {importSummary.tasks_updated} task(s)</p>
                    )}
                    {importSummary.activities_created > 0 && (
                      <p>
                        ✓ Created {importSummary.activities_created}{" "}
                        activity/activities
                      </p>
                    )}
                    {importSummary.activities_updated > 0 && (
                      <p>
                        ✓ Updated {importSummary.activities_updated}{" "}
                        activity/activities
                      </p>
                    )}
                    {importSummary.metrics_updated > 0 && (
                      <p>
                        ✓ Recalculated progress for{" "}
                        {importSummary.metrics_updated} record(s)
                      </p>
                    )}
                    {importSummary.errors?.length > 0 && (
                      <p className="text-[var(--error)] dark:text-red-400 mt-2">
                        ⚠ {importSummary.errors.length} error(s) occurred during
                        import
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-[var(--surface-container-low)] dark:bg-gray-800 border border-[var(--outline-variant)] dark:border-gray-700 rounded-lg p-6">
          <div className="flex gap-3 mb-4">
            <FileText className="h-6 w-6 text-[var(--primary)] dark:text-blue-400 flex-shrink-0" />
            <h3 className="font-semibold text-[var(--on-surface)] dark:text-white">
              {t("bulk_import.template_structure") ||
                "Excel Template Structure"}
            </h3>
          </div>
          <p className="text-sm text-[var(--on-surface-variant)] dark:text-gray-400 mb-4">
            The Excel file should contain a "Master Report" sheet with these
            columns:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-mono text-[var(--primary)] dark:text-blue-400">
                Goal Title
              </p>
              <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                Name of the goal
              </p>
            </div>
            <div>
              <p className="font-mono text-[var(--primary)] dark:text-blue-400">
                Task Title
              </p>
              <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                Name of the task
              </p>
            </div>
            <div>
              <p className="font-mono text-[var(--primary)] dark:text-blue-400">
                Activity Title
              </p>
              <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                Name of the activity
              </p>
            </div>
            <div>
              <p className="font-mono text-[var(--primary)] dark:text-blue-400">
                metricType
              </p>
              <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                Plus, Minus, Increase, Decrease, Maintain
              </p>
            </div>
            <div>
              <p className="font-mono text-[var(--primary)] dark:text-blue-400">
                isDone
              </p>
              <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                true or false
              </p>
            </div>
            <div>
              <p className="font-mono text-[var(--primary)] dark:text-blue-400">
                status
              </p>
              <p className="text-[var(--on-surface-variant)] dark:text-gray-400">
                To Do, In Progress, Complete
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast notifications */}
      {importMessage && (
        <Toast
          type="success"
          message={importMessage}
          onClose={() => setImportMessage(null)}
          duration={5000}
        />
      )}
      {importError && (
        <Toast
          type="error"
          message={importError}
          onClose={() => setImportError(null)}
          duration={7000}
        />
      )}
    </div>
  );
}
