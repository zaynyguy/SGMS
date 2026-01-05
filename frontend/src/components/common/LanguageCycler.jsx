// src/ui/LanguageCycler.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

const LANG_ORDER = ["en", "am", "or"];
const LABELS = { en: "English", am: "አማርኛ", or: "Afaan Oromoo"};
const ABBR = { en: "EN", am: "አም", or: "OR" };
const STORAGE_KEY = "i18nextLng";

/* --- Icons --- */
const GlobeIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
);
const ChevronDown = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9"/></svg>
);
const XIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

/* Safe storage helpers (defensive for SSR / privacy modes) */
const safeReadStorage = () => {
  try {
    return typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  } catch (e) {
    return null;
  }
};
const safeWriteStorage = (val) => {
  try {
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, val);
  } catch (e) {
    // ignore
  }
};

const LanguageCycler = ({ value: controlledValue, onChange, className = "" }) => {
  const { i18n } = useTranslation();
  const saved = safeReadStorage();
  const initial = controlledValue || saved || i18n.language || "en";

  const [lang, setLang] = useState(LANG_ORDER.includes(initial) ? initial : "en");
  const [isOpen, setIsOpen] = useState(false);

  // refs to support both inline & portaled menu
  const containerRef = useRef(null); // trigger wrapper
  const menuRef = useRef(null); // actual dropdown (could be portaled)
  const [menuStyle, setMenuStyle] = useState(null); // for portaled positioning

  useEffect(() => {
    const startup = saved || controlledValue;
    if (startup && startup !== i18n.language) {
      i18n.changeLanguage(startup);
      setLang(startup);
    } else if (!startup && i18n.language && i18n.language !== lang) {
      setLang(i18n.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally only at mount to preserve original behavior

  // Compute portaled menu position whenever the menu opens
  useEffect(() => {
    if (!isOpen) {
      setMenuStyle(null);
      return;
    }
    if (typeof document === "undefined") return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY + 8; // small gap
    const width = Math.min(260, Math.max(160, rect.width)); // prevent extremely narrow/wide
    setMenuStyle({
      position: "absolute",
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      zIndex: 9999,
    });
  }, [isOpen]);

  // Handle outside click to close (works for both inline & portaled menus)
  const handleClickOutside = useCallback((event) => {
    const target = event?.target;
    if (!target) return;
    const containerNode = containerRef.current;
    const menuNode = menuRef.current;
    if (containerNode && containerNode.contains(target)) return;
    if (menuNode && menuNode.contains(target)) return;
    // click is outside both trigger and menu -> close
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClickOutside]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Esc") setIsOpen(false);
    };
    if (typeof document === "undefined") return;
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const handleSelect = (nextLang) => {
    setLang(nextLang);
    i18n.changeLanguage(nextLang);
    safeWriteStorage(nextLang);
    if (onChange) onChange(nextLang);
    setIsOpen(false);
  };

  /* -------------------------
     Desktop dropdown (portaled)
     ------------------------- */
  const DesktopMenu = (
    <div
      ref={menuRef}
      style={menuStyle || undefined}
      className={`absolute hidden md:block right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden`}
      role="menu"
      aria-orientation="vertical"
    >
      <div className="py-1">
        {LANG_ORDER.map((code) => (
          <button
            key={code}
            onClick={() => handleSelect(code)}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between
                    ${lang === code ? "text-blue-600 font-bold bg-blue-50 dark:bg-gray-800/50" : "text-gray-700 dark:text-gray-300"}`}
            role="menuitem"
            type="button"
          >
            {LABELS[code]}
            {lang === code && <span className="text-blue-600 text-xs">●</span>}
          </button>
        ))}
      </div>
    </div>
  );

  /* Render */
  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* ======================================= */}
      {/* MOBILE VERSION */}
      {/* ======================================= */}
      <div className="md:hidden">
        {isOpen ? (
          <div
            className="absolute right-0 top-0 flex items-center bg-white dark:bg-gray-900 border-2 border-green-400 dark:border-indigo-600 rounded-full shadow-lg p-1 pr-2 animate-in slide-in-from-right-10 fade-in duration-200 z-50 whitespace-nowrap"
            ref={menuRef}
            role="dialog"
            aria-modal="false"
          >
            <div className="flex items-center gap-1 mr-2">
              {LANG_ORDER.map((code) => (
                <button
                  key={code}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(code);
                  }}
                  className={`px-3 py-2 rounded-full text-sm font-bold transition-colors
                    ${lang === code
                      ? "bg-green-600 dark:bg-indigo-600 text-white"
                      : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"}`}
                  type="button"
                >
                  {ABBR[code]}
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-green-200 dark:bg-indigo-400 text-green-800 dark:text-indigo-800 hover:bg-red-100 hover:text-red-500 transition-colors"
              aria-label="Close language selector"
              type="button"
            >
              <XIcon />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-green-200 dark:bg-indigo-400 text-green-800 dark:text-indigo-800 shadow-sm"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-label="Open language selector"
          >
            <span className="font-bold text-xs">{ABBR[lang]}</span>
          </button>
        )}
      </div>

      {/* ======================================= */}
      {/* DESKTOP VERSION */}
      {/* ======================================= */}
      <div className="hidden md:block">
        <button
          type="button"
          onClick={() => setIsOpen((s) => !s)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-200"
          aria-haspopup="menu"
          aria-expanded={isOpen}
        >
          <GlobeIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
            {LABELS[lang]}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Portaled desktop dropdown so it won't be clipped by parent overflow */}
        {isOpen &&
          (typeof document !== "undefined"
            ? createPortal(DesktopMenu, document.body)
            : DesktopMenu)}
      </div>
    </div>
  );
};

export default LanguageCycler;
