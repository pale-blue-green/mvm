import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "mvm.theme";
const ORDER: ThemeMode[] = ["system", "light", "dark"];

const readStored = (): ThemeMode => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
};

const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

export const useTheme = () => {
  const [mode, setMode] = useState<ThemeMode>(readStored);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = mode === "dark" || (mode === "system" && prefersDark());
      document.documentElement.classList.toggle("dark", dark);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [mode]);

  const cycle = useCallback(() => {
    setMode((current) => {
      const next = ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // 保存できなくても表示には影響しない
      }
      return next;
    });
  }, []);

  return { mode, cycle };
};
