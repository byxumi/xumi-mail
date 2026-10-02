"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useToast } from "./Toast";
import { Icon } from "./Icon";

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
  icon,
  iconName = "inbox",
}: {
  title: string;
  description?: string;
  icon?: string;
  iconName?: string;
}) {
  return (
    <div className="empty-state">
      <div className="icon">
        {iconName ? <Icon name={iconName as any} size={56} strokeWidth={1.5} /> : icon}
      </div>
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
  iconName,
  label,
  value,
  href,
  onClick,
  danger,
  children,
}: {
  icon?: string;
  iconName?: string;
  label: string;
  value?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  const inner = (
    <>
      {(icon || iconName) && (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--fill)", color: "var(--accent)" }}
        >
          {iconName ? <Icon name={iconName as any} size={15} /> : icon}
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
        <span style={{ color: "var(--fg-tertiary)" }}>
          <Icon name="chevron-right" size={16} />
        </span>
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

/** 徽章 */
export function Badge({
  children,
  color = "var(--accent)",
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span className="badge text-white" style={{ background: color }}>
      {children}
    </span>
  );
}

/** 骨架屏占位 */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/** 头像（首字母 + 稳定配色） */
const AVATAR_COLORS = ["#00a876", "#34c759", "#ff9500", "#af52de", "#ff2d55", "#00c2a8", "#5e5ce6", "#f5d90a"];
export function avatarColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function Avatar({
  text,
  size = 40,
  ring = false,
}: {
  text: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${ring ? "avatar-ring" : ""}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: avatarColor(text),
      }}
    >
      {(text || "?").charAt(0).toUpperCase()}
    </span>
  );
}

/** iOS Sheet 底部抽屉（受控） */
export function Sheet({
  open,
  onClose,
  title,
  children,
  centered = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  centered?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={`sheet-mask ${centered ? "align-center" : ""}`} onClick={onClose}>
      <div
        className={`sheet-panel ${centered ? "centered" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {!centered && <div className="sheet-grabber" />}
        {title && (
          <div className="border-b px-5 pb-3 pt-4 text-center" style={{ borderColor: "var(--separator)" }}>
            <p className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
              {title}
            </p>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** iOS 确认弹窗（居中，替代 window.confirm） */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  danger = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="sheet-mask align-center" onClick={onCancel}>
      <div
        className="sheet-panel centered w-[300px] overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pb-4 pt-8">
          <p className="text-[17px] font-semibold" style={{ color: "var(--fg)" }}>
            {title}
          </p>
          {message && (
            <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
              {message}
            </p>
          )}
        </div>
        <div className="border-t" style={{ borderColor: "var(--separator)" }}>
          <button
            onClick={onConfirm}
            className="w-full py-3.5 text-[17px] font-semibold"
            style={{ color: danger ? "var(--red)" : "var(--accent)" }}
          >
            {confirmText}
          </button>
          <div className="border-t" style={{ borderColor: "var(--separator)" }} />
          <button onClick={onCancel} className="w-full py-3.5 text-[17px] font-medium" style={{ color: "var(--fg-secondary)" }}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** iOS 搜索框 */
export function SearchInput({
  value,
  onChange,
  placeholder = "搜索",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-box">
      <span style={{ color: "var(--fg-tertiary)" }}>
        <Icon name="search" size={15} />
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ color: "var(--fg)" }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="pressable flex h-5 w-5 items-center justify-center rounded-full text-white"
          style={{ background: "var(--fg-tertiary)" }}
          aria-label="清除"
        >
          <Icon name="x" size={11} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}