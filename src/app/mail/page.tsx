"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import { EmptyState, LoadingButton, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings } from "@/hooks/useSettings";
import { api, formatTime, tokenStore, ParsedMailDTO, extractSender } from "@/lib/client";

export default function MailPage() {
  const { push } = useToast();
  const { settings, loaded: settingsLoaded } = useSettings();
  const { token, set: setToken, clear: clearToken } = useAddressToken();

  const [inbox, setInbox] = useState<ParsedMailDTO[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ParsedMailDTO | null>(null);
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState("");
  const [nameMode, setNameMode] = useState<"auto" | "custom">("auto");
  const [domain, setDomain] = useState("");
  const [randomSub, setRandomSub] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 拉取邮件列表
  const loadMails = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.parsedMails({ limit: 50, offset: 0 });
      setInbox(res.results);
      setCount(res.count);
    } catch (e) {
      push("error", (e as Error).message);
      // token 失效则清除
      if ((e as any)?.status === 401) clearToken();
    } finally {
      setLoading(false);
    }
  }, [token, push, clearToken]);

  // token 就绪后加载 + 自动刷新
  useEffect(() => {
    if (token) void loadMails();
    else {
      setInbox([]);
      setSelected(null);
    }
  }, [token, loadMails]);

  // 每 15 秒自动刷新
  useEffect(() => {
    if (!token) return;
    timerRef.current = setInterval(() => {
      void loadMails();
    }, 15000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [token, loadMails]);

  // 默认域名
  useEffect(() => {
    if (settings && settings.domains.length > 0 && !domain) {
      setDomain(settings.domains[0].value);
    }
  }, [settings, domain]);

  // 创建地址
  const createAddress = async () => {
    setCreating(true);
    try {
      const res = await api.newAddress({
        name: nameMode === "custom" ? customName : undefined,
        domain: domain || undefined,
        enableRandomSubdomain: randomSub,
      });
      setToken(res.jwt);
      push("success", `创建成功: ${res.address}`);
      await loadMails();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // 选择邮件：未读标记为已读
  const openMail = async (mail: ParsedMailDTO) => {
    setSelected(mail);
    if (mail.is_unread === 1 && settings?.enableMailReadStatus) {
      try {
        await api.markRead(mail.id, false);
        setInbox((prev) => prev.map((m) => (m.id === mail.id ? { ...m, is_unread: 0 } : m)));
      } catch {
        // ignore
      }
    }
  };

  const deleteMail = async (id: number) => {
    if (!window.confirm("确认删除这封邮件？")) return;
    try {
      await api.deleteMail(id);
      setInbox((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) setSelected(null);
      push("success", "已删除");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  const clearInbox = async () => {
    if (!window.confirm("确认清空收件箱？所有邮件将被删除。")) return;
    try {
      await api.clearInbox();
      setInbox([]);
      setSelected(null);
      push("success", "收件箱已清空");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  if (!settingsLoaded) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex justify-center py-24"><Spinner /></div>
      </div>
    );
  }

  // 需要站点密码认证（未实现时提示）
  if (settings?.needAuth && !token) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">此站点需要访问密码</h1>
          <p className="mt-2 text-sm text-slate-500">
            该站点配置了 PASSWORDS 访问控制，请通过站点提供的密码访问（x-custom-auth）。
          </p>
        </div>
      </div>
    );
  }

  // 未创建地址 → 创建引导
  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="text-center">
            <div className="text-5xl">📬</div>
            <h1 className="mt-4 text-3xl font-bold text-slate-900">创建你的临时邮箱</h1>
            <p className="mt-2 text-slate-500">
              无需注册，即开即用。收件仅保存在 Cloudflare 免费数据库，安全可靠。
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-end gap-2">
              {nameMode === "custom" ? (
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={settings?.disableCustomAddressName ? "自动生成" : "自定义前缀"}
                  disabled={settings?.disableCustomAddressName}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ) : (
                <div className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-400">
                  随机字符（更隐私）
                </div>
              )}
              <span className="text-lg text-slate-400">@</span>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {settings?.domains.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-600">
              {!settings?.disableCustomAddressName && (
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={nameMode === "custom"}
                    onChange={(e) => setNameMode(e.target.checked ? "custom" : "auto")}
                  />
                  自定义前缀
                </label>
              )}
              {(settings?.randomSubdomainDomains?.length ?? 0) > 0 && (
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={randomSub}
                    onChange={(e) => setRandomSub(e.target.checked)}
                  />
                  随机子域名
                </label>
              )}
            </div>

            <LoadingButton
              loading={creating}
              onClick={createAddress}
              className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-medium text-white hover:bg-blue-700"
            >
              创建邮箱地址
            </LoadingButton>
          </div>
        </main>
      </div>
    );
  }

  // 主界面：收件箱 + 邮件详情
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">收件箱</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              共 {count} 封 · 每 15 秒自动刷新
            </p>
          </div>
          <button
            onClick={clearInbox}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
          >
            清空
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          {/* 邮件列表 */}
          <div className="max-h-[calc(100vh-180px)] overflow-y-auto rounded-xl border border-slate-200 bg-white">
            {loading && inbox.length === 0 ? (
              <div className="flex justify-center py-16"><Spinner /></div>
            ) : inbox.length === 0 ? (
              <EmptyState title="暂无邮件" description={`向 ${tokenStore.getAddress()} 发送一封测试邮件吧`} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {inbox.map((mail) => {
                  const sender = extractSender(mail.sender);
                  return (
                    <li key={mail.id}>
                      <button
                        onClick={() => openMail(mail)}
                        className={`flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-slate-50 ${
                          selected?.id === mail.id ? "bg-blue-50" : ""
                        }`}
                      >
                        <span
                          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                            mail.is_unread === 1 ? "bg-blue-500" : "bg-transparent"
                          }`}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-slate-800">
                            {sender.name || sender.email || mail.source}
                          </span>
                          <span className="block truncate text-sm text-slate-500">
                            {mail.subject || "(无主题)"}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-slate-400">
                          {formatTime(mail.created_at)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* 邮件详情 */}
          <div className="min-h-[300px] rounded-xl border border-slate-200 bg-white">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center py-24 text-slate-400">
                <div className="text-4xl">✉️</div>
                <p className="mt-3 text-sm">选择一封邮件查看详情</p>
              </div>
            ) : (
              <MailDetail mail={selected} onDelete={() => deleteMail(selected.id)} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function MailDetail({ mail, onDelete }: { mail: ParsedMailDTO; onDelete: () => void }) {
  const sender = extractSender(mail.sender);
  const meta = useExtractMeta(mail.metadata);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{mail.subject || "(无主题)"}</h2>
          <button
            onClick={onDelete}
            className="shrink-0 rounded-lg px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            删除
          </button>
        </div>
        <div className="mt-2 text-sm text-slate-600">
          <p>
            <span className="text-slate-400">发件人：</span>
            {sender.name ? `${sender.name} <${sender.email}>` : sender.email}
          </p>
          <p>
            <span className="text-slate-400">收件人：</span>
            {mail.address}
          </p>
          <p>
            <span className="text-slate-400">时间：</span>
            {formatTime(mail.created_at)}
          </p>
        </div>
        {meta && (
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              {metaLabel(meta.type)}：{meta.result}
            </span>
          </div>
        )}
      </div>

      {mail.attachments.length > 0 && (
        <div className="border-b border-slate-100 px-5 py-3">
          <p className="mb-1.5 text-xs text-slate-400">附件（{mail.attachments.length}）</p>
          <div className="flex flex-wrap gap-2">
            {mail.attachments.map((att, i) => (
              <span
                key={i}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
              >
                📎 {att.filename} ({att.size} B)
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mail-content flex-1 overflow-y-auto px-5 py-4 text-sm leading-relaxed text-slate-800">
        {mail.html ? (
          <div
            dangerouslySetInnerHTML={{
              __html: sanitizeHtmlContent(mail.html),
            }}
          />
        ) : (
          <pre className="whitespace-pre-wrap font-sans">{mail.text || "(无内容)"}</pre>
        )}
      </div>
    </div>
  );
}

function useExtractMeta(metadata: string | null): { type: string; result: string } | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    const extract = parsed?.ai_extract;
    if (extract && extract.type !== "none" && extract.result) {
      return { type: extract.type, result: extract.result };
    }
  } catch {
    // ignore
  }
  return null;
}

function metaLabel(type: string): string {
  const map: Record<string, string> = {
    auth_code: "验证码",
    auth_link: "验证链接",
    service_link: "服务链接",
    subscription_link: "退订链接",
    other_link: "链接",
  };
  return map[type] || "提取信息";
}

/** 简单净化 HTML（外链保留，脚本/style 移除） */
function sanitizeHtmlContent(html: string): string {
  // 移除 script/style/iframe/object/embed
  const cleaned = html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
  return cleaned;
}