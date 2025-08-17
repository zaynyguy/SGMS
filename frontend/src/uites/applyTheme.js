// src/uites/applyTheme.js
export const applyTheme = (darkMode) => {
  // darkMode can be true, false, or "system"
  const root = document.documentElement;

  if (darkMode === "system") {
    // Remove explicit class and follow system preference
    root.classList.remove("dark");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) root.classList.add("dark");
  } else if (darkMode === true) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
};
