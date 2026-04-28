import React from "react";

const variantStyles = {
  primary:
    "bg-[var(--primary)] text-[var(--on-primary)] hover:bg-[var(--primary-container)]",
  secondary:
    "bg-[var(--surface-container)] text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]",
  subtle:
    "bg-[var(--surface)] text-[var(--on-surface)] border border-[var(--outline)] hover:bg-[var(--surface-container)]",
  danger:
    "bg-[var(--error)] text-[var(--on-error)] hover:bg-[var(--error-container)]",
};

const sizeStyles = {
  sm: "px-3 py-2 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-5 py-3 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 ${variantStyles[variant] ?? variantStyles.primary} ${sizeStyles[size] ?? sizeStyles.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
