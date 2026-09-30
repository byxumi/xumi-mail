"use client";

import { useToast } from "./Toast";

/** 复制到剪贴板 */
export function useCopy() {
  const { push } = useToast();
  return async (text: string, label = "已复制") => {
    try {
      await navigator.clipboard.writeText(text);
      push("success", label);
    } catch {
      push("error", "复制失败，请手动选择复制");
    }
  };
}

/** 通用加载按钮 */
export function LoadingButton({
  loading,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button disabled={loading || props.disabled} className={`${className} disabled:opacity-60`} {...props}>
      {loading ? <span className="inline-block animate-spin">⟳</span> : children}
    </button>
  );
}

/** 空状态占位 */
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-16 text-center">
      <div className="text-4xl">📭</div>
      <p className="mt-3 font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />;
}