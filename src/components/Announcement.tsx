"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { OpenSettingsDTO } from "@/lib/client";

const DISMISS_KEY = "tm_announcement_dismissed";

/** 站点公告横幅（可关闭，关闭后记住该公告内容哈希） */
export function Announcement({ settings }: { settings: OpenSettingsDTO | null }) {
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return typeof window !== "undefined" ? localStorage.getItem(DISMISS_KEY) : null;
    } catch {
      return null;
    }
  });

  const text = settings?.announcement?.trim();
  if (!text || dismissed === text) return null;

  return (
    <div
      className="relative flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
      style={{
        background: "rgba(0,168,118,0.08)",
        border: "1px solid rgba(0,168,118,0.22)",
        color: "var(--fg)",
      }}
    >
      <span className="shrink-0" style={{ color: "var(--accent)" }}>
        <Icon name="bell-ring" size={16} />
      </span>
      <span className="min-w-0 flex-1 whitespace-pre-wrap">{text}</span>
      <button
        onClick={() => {
          try {
            localStorage.setItem(DISMISS_KEY, text);
          } catch {
            // ignore
          }
          setDismissed(text);
        }}
        className="pressable -m-1 shrink-0 rounded-full p-1"
        style={{ color: "var(--fg-tertiary)" }}
        aria-label="关闭公告"
        title="不再显示"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}