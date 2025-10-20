// src/ui/LanguageCycler.jsx
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const LANG_ORDER = ["en", "am", "or", "hr"];
const LABELS = { en: "EN", am: "AM", or: "OR", hr: "HR" };
const ABBR = { en: "EN", am: "አም", or: "OR", hr: "HR" };
const STORAGE_KEY = "i18nextLng";

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
    // ignore (private mode / quota)
  }
};

const LanguageCycler = ({ value: controlledValue, onChange, className = "", variant = "default", ariaLabelPrefix = "Change language" }) => {
  const { i18n } = useTranslation();
  const saved = safeReadStorage();
  const initial = controlledValue || saved || i18n.language || "en";
  const [lang, setLang] = useState(LANG_ORDER.includes(initial) ? initial : "en");

  // On mount: make sure i18n uses saved/control value
  useEffect(() => {
    const startup = saved || controlledValue;
    if (startup && startup !== i18n.language) {
      i18n.changeLanguage(startup);
      setLang(startup);
    } else if (!startup && i18n.language && i18n.language !== lang) {
      // ensure state matches i18n if it's already set
      setLang(i18n.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAndPersist = (next) => {
    setLang(next);
    i18n.changeLanguage(next);
    safeWriteStorage(next);
    if (onChange) onChange(next);
  };

  const handleChangeToNext = () => {
    const idx = LANG_ORDER.indexOf(lang);
    const next = LANG_ORDER[(idx + 1) % LANG_ORDER.length];
    setAndPersist(next);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleChangeToNext();
    }
  };

  // Square (mobile) variant
  if (variant === "square") {
    return (
      <button
        type="button"
        onClick={handleChangeToNext}
        onKeyDown={handleKeyDown}
        aria-label={`${ariaLabelPrefix} (current: ${LABELS[lang]})`}
        title={LABELS[lang]}
        className={`w-12 h-12 flex items-center justify-center rounded-md transition-colors ${className}`}
      >
        <span className="text-sm font-semibold leading-none select-none">{ABBR[lang]}</span>
      </button>
    );
  }

  // Default (desktop) variant - labeled
  return (
    <button
      type="button"
      onClick={handleChangeToNext}
      onKeyDown={handleKeyDown}
      aria-label={`${ariaLabelPrefix} (current: ${LABELS[lang]})`}
      title={`Language: ${LABELS[lang]} — click to change`}
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-md  ${className}`}
    >
      <span className="font-medium">{LABELS[lang]}</span>
    </button>
  );
};

export default LanguageCycler;
