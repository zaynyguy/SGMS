// src/ui/LanguageCycler.jsx
import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";

const LANG_ORDER = ["en", "am", "or", "hr"];
// Full labels for Desktop
const LABELS = { en: "English", am: "አማርኛ", or: "Afaan Oromoo", hr: "Harari" };
// Short abbreviations for Mobile (matching your sketch)
const ABBR = { en: "EN", am: "አም", or: "OR", hr: "ሃረ" };
const STORAGE_KEY = "i18nextLng";

// --- Icons ---
const GlobeIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
);
const ChevronDown = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="6 9 12 15 18 9"/></svg>
);
const XIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);

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
  const containerRef = useRef(null);

  useEffect(() => {
    const startup = saved || controlledValue;
    if (startup && startup !== i18n.language) {
      i18n.changeLanguage(startup);
      setLang(startup);
    } else if (!startup && i18n.language && i18n.language !== lang) {
      setLang(i18n.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle outside click to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (nextLang) => {
    setLang(nextLang);
    i18n.changeLanguage(nextLang);
    safeWriteStorage(nextLang);
    if (onChange) onChange(nextLang);
    setIsOpen(false); 
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      
      {/* ======================================= */}
      {/* MOBILE VERSION              */}
      {/* ======================================= */}
      <div className="md:hidden">
        {isOpen ? (
          /* EXPANDED "PILL" STATE (Matches your Drawing) */
          <div className="absolute right-0 top-0 flex items-center bg-white dark:bg-gray-900 border-2 border-green-400 dark:border-indigo-600 rounded-full shadow-lg p-1 pr-2 animate-in slide-in-from-right-10 fade-in duration-200 z-50 whitespace-nowrap">
            
            {/* Language Options List */}
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
                >
                  {ABBR[code]}
                </button>
              ))}
            </div>

            {/* The Circle Button on the Right (Close Action) */}
            <button
              onClick={() => setIsOpen(false)}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-green-200 dark:bg-indigo-400 text-green-800 dark:text-indigo-800 hover:bg-red-100 hover:text-red-500 transition-colors"
            >
              <XIcon />
            </button>
          </div>
        ) : (
          /* CLOSED STATE (Simple FAB/Icon) */
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-green-200 dark:bg-indigo-400 text-green-800 dark:text-indigo-800 shadow-sm"
          >
            <span className="font-bold text-xs">{ABBR[lang]}</span>
          </button>
        )}
      </div>


      {/* ======================================= */}
      {/* DESKTOP VERSION             */}
      {/* ======================================= */}
      <div className="hidden md:block">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-transparent hover:border-gray-200"
        >
          <GlobeIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
            {LABELS[lang]}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Desktop Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-100 dark:border-gray-800 z-50 overflow-hidden">
            <div className="py-1">
              {LANG_ORDER.map((code) => (
                <button
                  key={code}
                  onClick={() => handleSelect(code)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-between
                    ${lang === code ? "text-blue-600 font-bold bg-blue-50 dark:bg-gray-800/50" : "text-gray-700 dark:text-gray-300"}`}
                >
                  {LABELS[code]}
                  {lang === code && <span className="text-blue-600 text-xs">●</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default LanguageCycler;