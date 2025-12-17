// src/ui/LanguageCycler.jsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const LANG_ORDER = ["en", "am", "or", "hr"];
const LABELS = { en: "English", am: "አማርኛ", or: "Afaan Oromo", hr: "ሃረሪ" };
const ABBR = { en: "EN", am: "አም", or: "OR", hr: "ሃረ" };
const STORAGE_KEY = "i18nextLng";

const isMobileScreen = () =>
  typeof window !== "undefined" && window.innerWidth < 768;

const safeReadStorage = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const safeWriteStorage = (val) => {
  try {
    localStorage.setItem(STORAGE_KEY, val);
  } catch {}
};

const LanguageCycler = ({
  value: controlledValue,
  onChange,
  className = "",
  ariaLabelPrefix = "Change language",
}) => {
  const { i18n } = useTranslation();
  const saved = safeReadStorage();
  const initial = controlledValue || saved || i18n.language || "en";

  const [lang, setLang] = useState(initial);
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(isMobileScreen());

  useEffect(() => {
    const onResize = () => setIsMobile(isMobileScreen());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (lang !== i18n.language) {
      i18n.changeLanguage(lang);
      safeWriteStorage(lang);
      onChange?.(lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const selectLang = (lng) => {
    setLang(lng);
    setOpen(false);
  };

  /* -----------------------------
     Trigger button
  ----------------------------- */
  const Trigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={`${ariaLabelPrefix} (current: ${ABBR[lang]})`}
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-md ${className}`}
    >
      <span className="font-medium">{ABBR[lang]}</span>
    </button>
  );

  /* -----------------------------
     Language list
  ----------------------------- */
  const LanguageList = (
    <ul className="space-y-1">
      {LANG_ORDER.map((l) => (
        <li key={l}>
          <button
            onClick={() => selectLang(l)}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
              l === lang
                ? "bg-[var(--primary-container)] text-[var(--on-primary-container)]"
                : "hover:bg-[var(--surface-container)]"
            }`}
          >
            {LABELS[l]}
          </button>
        </li>
      ))}
    </ul>
  );

  /* -----------------------------
     MOBILE: left drawer
  ----------------------------- */
  if (isMobile) {
    return (
      <>
        {Trigger}

        {open && (
          <>
            {/* overlay */}
            <div
              className="fixed inset-0 bg-black/40 z-40"
              onClick={() => setOpen(false)}
            />

            {/* left drawer */}
            <div className="fixed top-0 left-0 h-full w-64 bg-[var(--surface)] z-50 p-4 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Choose language</h3>
              {LanguageList}
            </div>
          </>
        )}
      </>
    );
  }

  /* -----------------------------
     DESKTOP: dropdown
  ----------------------------- */
  return (
    <div className="relative inline-block">
      {Trigger}

      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl bg-[var(--surface)] shadow-lg border border-[var(--outline)]/[0.12] z-50 p-2">
          {LanguageList}
        </div>
      )}
    </div>
  );
};

export default LanguageCycler;
