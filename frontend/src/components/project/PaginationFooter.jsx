// src/components/project/PaginationFooter.jsx
import React from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";

export default function PaginationFooter({ currentPage, pageSize, setPageSize, setCurrentPage, total = 0 }) {
  const { t } = useTranslation();

  const from = Math.min((currentPage - 1) * pageSize + 1, total || 0);
  const to = Math.min(currentPage * pageSize, total || 0);

  return (
    <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        {t("project.pagination.showing", { from, to, total })}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          className="px-2 py-1 rounded-md bg-white dark:bg-gray-700 border text-sm text-gray-700 dark:text-gray-300"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {t("project.pagination.perPage", { n })}
            </option>
          ))}
        </select>

        <button
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          {t("project.pagination.prev")}
        </button>

        <button
          onClick={() => setCurrentPage((p) => p + 1)}
          className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          {t("project.pagination.next")}
        </button>
      </div>
    </div>
  );
}

PaginationFooter.propTypes = {
  currentPage: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  setPageSize: PropTypes.func.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  total: PropTypes.number,
};
