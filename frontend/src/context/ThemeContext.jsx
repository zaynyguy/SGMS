import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") return true;
      if (saved === "light") return false;
    } catch (e) {
      // ignore storage errors
    }
    return document.documentElement.classList.contains("dark");
  });

  useEffect(() => {
    if (dark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    try {
      localStorage.setItem("theme", dark ? "dark" : "light");
    } catch (e) {
      // ignore
    }
  }, [dark]);

  const toggleTheme = () => setDark((d) => !d);
  const setTheme = (value) => setDark(Boolean(value));

  const value = useMemo(() => ({ dark, toggleTheme, setTheme }), [dark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};
