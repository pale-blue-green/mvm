import { useCallback, useState } from "react";

export const FONT_SIZES = ["prose-sm", "prose-base", "prose-lg", "prose-xl"] as const;
export const RAW_FONT_SIZES = ["text-xs", "text-sm", "text-base", "text-lg"] as const;
export const FONT_SIZE_LABELS = ["小", "中", "大", "特大"] as const;
export type FontSizeIndex = 0 | 1 | 2 | 3;
export type ContentWidth = "narrow" | "wide";

export type Settings = { fontSize: FontSizeIndex; width: ContentWidth; sidebarOpen: boolean };

export const DEFAULT_SETTINGS: Settings = { fontSize: 1, width: "narrow", sidebarOpen: true };
export const WIDTH_CLASS: Record<ContentWidth, string> = { narrow: "max-w-3xl", wide: "max-w-6xl" };

const STORAGE_KEY = "mvm.settings";

/** 保存値を検証して設定に変換する。不正な値は既定値に置き換える。 */
export const parseSettings = (raw: string | null): Settings => {
  if (raw === null) return DEFAULT_SETTINGS;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
    const fontSize = value.fontSize === 0 || value.fontSize === 1 || value.fontSize === 2 || value.fontSize === 3 ? value.fontSize : DEFAULT_SETTINGS.fontSize;
    const width = value.width === "narrow" || value.width === "wide" ? value.width : DEFAULT_SETTINGS.width;
    const sidebarOpen = typeof value.sidebarOpen === "boolean" ? value.sidebarOpen : DEFAULT_SETTINGS.sidebarOpen;
    return { fontSize, width, sidebarOpen };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const readStored = (): Settings => {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(readStored);

  const update = useCallback((change: (current: Settings) => Settings) => {
    setSettings((current) => {
      const next = change(current);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // 保存できなくても表示には影響しない
      }
      return next;
    });
  }, []);

  return { settings, update };
};
