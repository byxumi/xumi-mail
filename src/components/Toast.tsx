"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";

type ToastType = "info" | "success" | "error";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const ToastContext = createContext<{
  push: (type: ToastType, message: string) => void;
}>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

const colors: Record<ToastType, string> = {
  success: "var(--green)",
  error: "var(--red)",
  info: "var(--accent)",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="toast-item pointer-events-auto"
            style={{ background: "var(--glass)", color: colors[t.type], border: "0.5px solid var(--separator)" }}
          >
            {t.type === "success" ? "✓ " : t.type === "error" ? "✕ " : "ℹ️ "}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}