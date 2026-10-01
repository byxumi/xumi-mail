"use client";

import Link from "next/link";
import { useToast } from "./Toast";

/** 复制到剪贴板 */
export function useCopy() {
  const { push } = useToast();
  return async (text: string, label = "已复制到剪贴板") => {
    try {
      await navigator.clipboard.writeText(text);
      push("success", label);
    } catch {
      push("error", "复制失败，请手动复制");
    }
  };
}

/** 加载态按钮（iOS 风格） */
export function LoadingButton({
  loading,
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button disabled={loading || props.disabled} className={`${className} disabled:opacity-50`} {...props}>
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-middle" />
      ) : (
        children
      )}
    </button>
  );
}

/** 空状态占位（iOS 风） */
export function EmptyState({
  title,
  description,
  icon = "📭",
}: {
  title: string;
  description?: string;
  icon?: string;
}) {
  return (
    <div className="empty-state">
      <div className="icon">{icon}</div>
      <p className="text-[17px] font-semibold" style={{ color: "var(--fg-secondary)" }}>
        {title}
      </p>
      {description && <p className="mt-1 max-w-xs text-[14px] leading-relaxed">{description}</p>}
    </div>
  );
}

export function Spinner({ size = 22 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full"
      style={{
        width: size,
        height: size,
        border: `2.5px solid var(--fill)`,
        borderTopColor: "var(--accent)",
      }}
    />
  );
}

/** iOS 分段控件 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} className={value === o.value ? "active" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** iOS 开关 */
export function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`ios-switch ${checked ? "on" : ""}`}
      onClick={() => onChange(!checked)}
    />
  );
}

/** iOS 分组标题 */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="mb-1.5 mt-6 px-4 text-[13px] font-medium uppercase tracking-wide first:mt-0"
      style={{ color: "var(--fg-tertiary)" }}
    >
      {children}
    </p>
  );
}

/** iOS 表单行（图标 + 标题 + 值 + 箭头） */
export function FormRow({
  icon,
  label,
  value,
  href,
  onClick,
  danger,
  children,
}: {
  icon?: string;
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      {icon && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[14px]"
          style={{ background: "var(--fill)" }}
        >
          {icon}
        </span>
      )}
      <span className="flex-1 text-[16px]" style={{ color: danger ? "var(--red)" : "var(--fg)" }}>
        {label}
      </span>
      {value && (
        <span className="text-[15px]" style={{ color: "var(--fg-tertiary)" }}>
          {value}
        </span>
      )}
      {children}
      {(href || onClick) && (
        <span style={{ color: "var(--fg-tertiary)" }}>›</span>
      )}
    </>
  );
  if (href)
    return (
      <Link href={href} className="card-row pressable">
        {inner}
      </Link>
    );
  return (
    <button className="card-row pressable w-full text-left" onClick={onClick}>
      {inner}
    </button>
  );
}