// src/components/common/Toast.jsx
import React, { useEffect } from "react";
import { CheckCircle, XCircle, Info } from "lucide-react";

const Toast = ({ message, type = "success", onClose }) => {
  // Auto-close after 3s
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!message) return null;

  const baseStyles =
    "fixed bottom-4 right-4 p-4 rounded-md shadow-lg flex items-center space-x-2 z-50 transition-all";
  const typeStyles =
    type === "success"
      ? "bg-green-500 text-white"
      : type === "error"
      ? "bg-red-500 text-white"
      : "bg-blue-500 text-white";

  const Icon =
    type === "success" ? CheckCircle : type === "error" ? XCircle : Info;

  return (
    <div
      className={`${baseStyles} ${typeStyles}`}
      role="alert"
      aria-live="assertive"
    >
      <Icon size={20} aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

export default Toast;
