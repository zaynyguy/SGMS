import React, { useState, useEffect } from "react";
import { CheckCircle, XCircle, Info, Pencil, Trash2 } from "lucide-react";

// Types: success (create), info (read), update, delete, error
const icons = {
  create: <CheckCircle className="text-white w-5 h-5" />,
  read: <Info className="text-white w-5 h-5" />,
  update: <Pencil className="text-white w-5 h-5" />,
  delete: <Trash2 className="text-white w-5 h-5" />,
  error: <XCircle className="text-white w-5 h-5" />,
};

const Toast = ({ message, type = "create", onClose }) => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      if (onClose) onClose();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!show) return null;

  return (
    <div
      className={`fixed z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 text-white 
        transition-all duration-300
        ${type === "create" ? "bg-green-600" : ""}
        ${type === "read" ? "bg-blue-600" : ""}
        ${type === "update" ? "bg-yellow-600" : ""}
        ${type === "delete" ? "bg-red-600" : ""}
        ${type === "error" ? "bg-red-700" : ""}

        // 📱 Mobile bottom full width
        md:bottom-5 md:right-5 md:rounded-lg md:w-auto
        bottom-0 left-0 w-full md:top-auto md:left-auto
      `}
    >
      {icons[type]}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
};

export default Toast;
