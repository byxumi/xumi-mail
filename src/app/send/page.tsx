"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import { EmptyState, LoadingButton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings } from "@/hooks/useSettings";
import { api, formatTime } from "@/lib/client";

const RECENT_KEY = "tm_recent_recipients";

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export default function SendPage() {
  const { push } = useToast();
  const { settings } = useSettings();
  const { token } = useAddressToken();

  const [fromName, setFromName] = useState("");
  const [toMail, setToMail] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [isHtml, setIsHtml] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentList, setSentList] = useState<any[]>([]);
  const [address, setAddress] = useState("");
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    if (!token) return;
    api
      .addressSettings()
      .then((s) => setAddress(s.address))
      .catch(() => {});
    void loadSent();
  }, [token]);

  const loadSent = useCallback(async () => {
    try {
      const res = await api.sendbox({ limit: 20, offset: 0 });
      setSentList(res.results);
    } catch {
      // ignore
    }
  }, []);

  const rememberRecipient = (mail: string) => {
    const list = [mail, ...loadRecent().filter((r) => r.toLowerCase() !== mail.toLowerCase())].slice(0, 5);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
      // ignore
    }
    setRecent(list);
  };

  const send = async () => {
    if (!toMail.trim() || !subject.trim() || !content.trim()) {
      push("error", "收件人、主题、内容均不能为空");
      return;
    }
    setSending(true);
    try {
      await api.sendMail({
        from_name: fromName || undefined,
        to_mail: toMail.trim(),
        subject: subject.trim(),
        content,
        is_html: isHtml,
      });
      push("success", "发送成功");
      rememberRecipient(toMail.trim());
      setToMail("");
      setSubject("");
      setContent("");
      await loadSent();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-md px-4 py-20 text-center" style={{ color: "var(--fg-secondary)" }}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: "var(--fill)" }}>
            <Icon name="send" size={28} />
          </div>
          <p className="mt-4 text-[16px]">请先创建邮箱地址后再发件</p>
        </div>
      </div>
    );
  }

  if (settings && !settings.enableSendMail) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-md px-4 py-20 text-center" style={{ color: "var(--fg-secondary)" }}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: "var(--fill)" }}>
            <Icon name="ban" size={28} />
          </div>
          <p className="mt-4 text-[16px]">管理员未启用发件功能（需配置 Resend / SMTP / SEND_MAIL）</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="large-title">发送邮件</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
          发件地址：<span className="font-medium" style={{ color: "var(--accent)" }}>{address}</span>
        </p>

        {/* 表单 */}
        <div className="card-group mt-5 p-5">
          <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: "var(--bg-tertiary)" }}>
            <span className="text-[14px] font-medium" style={{ color: "var(--fg-secondary)" }}>
              发件人
            </span>
            <input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="可选名称"
              className="flex-1 bg-transparent px-2 py-1 text-[16px] outline-none"
              style={{ color: "var(--fg)" }}
            />
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl p-3" style={{ background: "var(--bg-tertiary)" }}>
            <span className="text-[14px] font-medium" style={{ color: "var(--fg-secondary)" }}>
              收件人
            </span>
            <input
              value={toMail}
              onChange={(e) => setToMail(e.target.value)}
              placeholder="someone@example.com"
              className="flex-1 bg-transparent px-2 py-1 text-[16px] outline-none"
              style={{ color: "var(--fg)" }}
            />
          </div>

          {/* 最近收件人 */}
          {recent.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                最近：
              </span>
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => setToMail(r)}
                  className="pressable rounded-full px-2.5 py-0.5 text-[12px] font-medium"
                  style={{ background: "var(--fill)", color: "var(--accent)" }}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2 rounded-xl p-3" style={{ background: "var(--bg-tertiary)" }}>
            <span className="text-[14px] font-medium" style={{ color: "var(--fg-secondary)" }}>
              主题
            </span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="邮件主题"
              className="flex-1 bg-transparent px-2 py-1 text-[16px] outline-none"
              style={{ color: "var(--fg)" }}
            />
          </div>

          <div className="mt-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={8}
              placeholder="邮件内容…"
              className="w-full resize-none rounded-xl p-3 text-[16px] leading-relaxed outline-none focus:ring-2 focus:ring-[#007aff]/30"
              style={{ background: "var(--bg-tertiary)", color: "var(--fg)" }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
              <input
                type="checkbox"
                checked={isHtml}
                onChange={(e) => setIsHtml(e.target.checked)}
                className="accent-[#007aff]"
              />
              HTML 内容
            </label>
            <span className="text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              {content.length} 字
            </span>
          </div>

          <LoadingButton loading={sending} onClick={send} className="btn-primary mt-5 flex w-full items-center justify-center gap-2">
            <Icon name="send" size={18} strokeWidth={2.2} />
            发送
          </LoadingButton>
        </div>

        {/* 已发送 */}
        <h2 className="mb-2 mt-8 px-1 text-[20px] font-bold" style={{ color: "var(--fg)" }}>
          已发送
        </h2>
        {sentList.length === 0 ? (
          <div className="card-group">
            <EmptyState iconName="send" title="暂无已发送邮件" />
          </div>
        ) : (
          <div className="card-group">
            <ul className="divide-y" style={{ borderColor: "var(--separator)" }}>
              {sentList.map((item) => {
                let body: any = {};
                try {
                  body = typeof item.raw === "string" ? JSON.parse(item.raw) : item.raw || {};
                } catch {
                  body = {};
                }
                return (
                  <li key={item.id} className="card-row">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
                        {body.subject || "(无主题)"}
                      </span>
                      <span className="block truncate text-[13px]" style={{ color: "var(--fg-secondary)" }}>
                        发给 {body.to_mail || item.address}
                      </span>
                    </span>
                    <span className="shrink-0 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                      {formatTime(item.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </main>
      <div style={{ height: 40 }} />
    </div>
  );
}