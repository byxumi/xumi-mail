"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const THEME_KEY = "theme";
const PURE_DARK_KEY = "pure-dark";

function readStored<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return (localStorage.getItem(key) as T) || fallback;
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** 深色模式：system 跟随 / light / dark 手动 + OLED 纯黑模式 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [pureDark, setPureDarkState] = useState(false);
  const [colorScheme, setColorScheme] = useState<"light" | "dark">("light");

  const apply = useCallback((mode: ThemeMode, pure: boolean) => {
    const dark = mode === "dark" || (mode === "system" && systemPrefersDark());
    const el = document.documentElement;
    el.setAttribute("data-theme", dark ? "dark" : "light");
    el.setAttribute("data-pure-dark", pure && dark ? "true" : "false");
    setColorScheme(dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    const saved = readStored<ThemeMode>(THEME_KEY, "system");
    const savedPure = readStored<"true" | "false">(PURE_DARK_KEY, "false") === "true";
    setThemeState(saved);
    setPureDarkState(savedPure);

    // 首次渲染后再启用过渡动画，避免页面加载时闪烁
    requestAnimationFrame(() => document.documentElement.classList.add("theme-anim"));

    apply(saved, savedPure);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handler = () => {
      const cur = readStored<ThemeMode>(THEME_KEY, "system");
      apply(cur, readStored<"true" | "false">(PURE_DARK_KEY, "false") === "true");
    };
    mq?.addEventListener?.("change", handler);
    return () => mq?.removeEventListener?.("change", handler);
  }, [apply]);

  const setTheme = useCallback(
    (mode: ThemeMode) => {
      setThemeState(mode);
      localStorage.setItem(THEME_KEY, mode);
      apply(mode, readStored<"true" | "false">(PURE_DARK_KEY, "false") === "true");
    },
    [apply]
  );

  const toggleTheme = useCallback(() => {
    setTheme(colorScheme === "dark" ? "light" : "dark");
  }, [colorScheme, setTheme]);

  const setPureDark = useCallback(
    (v: boolean) => {
      setPureDarkState(v);
      localStorage.setItem(PURE_DARK_KEY, String(v));
      apply(readStored<ThemeMode>(THEME_KEY, "system"), v);
    },
    [apply]
  );

  return { theme, colorScheme, pureDark, setTheme, toggleTheme, setPureDark };
}