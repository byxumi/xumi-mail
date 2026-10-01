"use client";

import { useCallback, useEffect, useState } from "react";

/** 深色模式切换（跟随系统 + 手动覆盖，存 localStorage） */
export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");

  const apply = useCallback((mode: "light" | "dark" | "system") => {
    const dark =
      mode === "dark" ||
      (mode === "system" &&
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    const saved = (localStorage.getItem("theme") as "light" | "dark" | "system") || "system";
    setTheme(saved);
    apply(saved);
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const handler = () => {
      const cur = (localStorage.getItem("theme") as "light" | "dark" | "system") || "system";
      apply(cur);
    };
    mq?.addEventListener?.("change", handler);
    return () => mq?.removeEventListener?.("change", handler);
  }, [apply]);

  const set = useCallback(
    (mode: "light" | "dark" | "system") => {
      setTheme(mode);
      localStorage.setItem("theme", mode);
      apply(mode);
    },
    [apply]
  );

  return { theme, setTheme: set };
}