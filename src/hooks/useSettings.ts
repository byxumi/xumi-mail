"use client";

import { useCallback, useEffect, useState } from "react";
import { api, OpenSettingsDTO, tokenStore } from "@/lib/client";

/** 全局设置（客户端一次拉取） */
export function useSettings() {
  const [settings, setSettings] = useState<OpenSettingsDTO | null>(null);
  const [error, setError] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.settings();
      setSettings(s);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, error, loaded, refresh };
}

/** 当前地址 token 反应式状态 */
export function useAddressToken() {
  const [token, setToken] = useState<string>(() => tokenStore.getAddress());
  const set = useCallback((t: string) => {
    tokenStore.setAddress(t);
    setToken(t);
  }, []);
  const clear = useCallback(() => {
    tokenStore.clearAddress();
    setToken("");
  }, []);
  return { token, set, clear };
}

/** 定时轮询收件箱（可选） */
export function useInterval(callback: () => void, ms: number | null) {
  useEffect(() => {
    if (ms === null) return;
    const id = setInterval(callback, ms);
    return () => clearInterval(id);
  }, [callback, ms]);
}