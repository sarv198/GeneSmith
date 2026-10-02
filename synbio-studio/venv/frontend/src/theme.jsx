import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "genesmith-theme";

const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {} });

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* private mode or blocked storage — fall through to the default */
  }
  return "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* preference simply will not persist */
    }
  }, [theme]);

  const toggleTheme = useCallback(
    () => setTheme((current) => (current === "dark" ? "light" : "dark")),
    [],
  );

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

/** Background for WebGL stages, which cannot read CSS variables. */
export function stageBackground(theme) {
  return theme === "light" ? "#e7ecf2" : "#070a0f";
}

/** Background for in-scene labels drawn by the molecular viewers. */
export function labelBackground(theme) {
  return theme === "light" ? "#ffffff" : "#0b0e13";
}
