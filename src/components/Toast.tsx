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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const color =
    (type: ToastType) =>
    type === "success"
      ? "border-green-500 bg-green-50 text-green-800"
      : type === "error"
        ? "border-red-500 bg-red-50 text-red-800"
        : "border-blue-500 bg-blue-50 text-blue-800";

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-md rounded-lg border px-4 py-2.5 text-sm shadow-sm ${color(t.type)}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}