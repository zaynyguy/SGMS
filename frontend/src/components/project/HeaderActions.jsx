// src/components/project/HeaderActions.jsx
import React from "react";
import { Search, RefreshCw, Plus } from "lucide-react";

export default function HeaderActions({ searchTerm, setSearchTerm, isLoadingGoals, loadGoals, canManageGTA, onAddGoal }) {
  return (
    <div className="mt-4">
      <div className="hidden md:flex items-center gap-3">
        <div className="relative flex-1 min-w-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." aria-label="Search" className="pl-10 pr-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm w-full" />
        </div>

        <button onClick={() => loadGoals({ page: 1 })} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 text-sm">
          <RefreshCw className={`h-4 w-4 ${isLoadingGoals ? "animate-spin" : ""}`} />
          <span className="hidden lg:inline">Refresh</span>
        </button>

        {canManageGTA && (
          <button onClick={onAddGoal} className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden lg:inline">Add goal</span>
          </button>
        )}
      </div>

      <div className="md:hidden space-y-2">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </div>
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search..." aria-label="Search" className="pl-10 pr-3 py-2 rounded-md border bg-white dark:bg-gray-700 text-sm w-full" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadGoals({ page: 1 })} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-gray-100 dark:bg-gray-700 text-sm">
            <RefreshCw className={`h-4 w-4 ${isLoadingGoals ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          {canManageGTA && (
            <button onClick={onAddGoal} className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm">
              <Plus className="h-4 w-4" />
              <span>Add goal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
