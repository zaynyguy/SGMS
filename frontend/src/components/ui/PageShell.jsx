import React from "react";

export default function PageShell({
  title,
  subtitle,
  actions,
  children,
  className = "",
}) {
  return (
    <div
      className={`min-h-screen bg-[var(--background)] text-[var(--on-background)] ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            {title && (
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--on-background)]">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-2 text-sm text-[var(--on-background)]/70 max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          )}
        </div>
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
