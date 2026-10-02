"use client";

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { Check, X, Info } from "lucide-react";

type ToastType = "info" | "success" | "error";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  leaving?: boolean;
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

const iconCmp: Record<ToastType, any> = {
  success: Check,
  error: X,
  info: Info,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    timers.current.get(id) && clearTimeout(timers.current.get(id));
    timers.current.set(
      id,
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timers.current.delete(id);
      }, 250)
    );
  }, []);

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, type, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 3000)
      );
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`toast-item pointer-events-auto ${t.leaving ? "leave" : ""}`}
            style={{ background: "var(--glass)", color: colors[t.type], border: "1px solid var(--separator)" }}
          >
            <span className="mr-1 flex items-center">
              {(() => {
                const Cmp = iconCmp[t.type];
                return <Cmp size={13} strokeWidth={2.5} />;
              })()}
            </span>
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}