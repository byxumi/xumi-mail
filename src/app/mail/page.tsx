"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import { EmptyState, LoadingButton, Spinner, Segmented, useCopy, SearchInput, ConfirmDialog } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { MotionPage, FadeUp } from "@/components/motion";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings, useInterval } from "@/hooks/useSettings";
import { api, formatTime, ParsedMailDTO, extractSender, sha256Hex } from "@/lib/client";

export default function MailPage() {
  const { push } = useToast();
  const copy = useCopy();
  const { settings, loaded: settingsLoaded } = useSettings();
  const { token, set: setToken, clear: clearToken } = useAddressToken();

  const [inbox, setInbox] = useState<ParsedMailDTO[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [customName, setCustomName] = useState("");
  const [nameMode, setNameMode] = useState<"auto" | "custom">("auto");
  const [domain, setDomain] = useState("");
  const [randomSub, setRandomSub] = useState(false);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [sent, setSent] = useState<any[]>([]);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | { type: "delete-mail" | "clear-inbox" | "delete-sent"; id?: number }>(null);

  const unreadCount = useMemo(() => inbox.filter((m) => m.is_unread === 1).length, [inbox]);

  // 同步未读数到 Header 徽标（跨页面）
  useEffect(() => {
    try {
      localStorage.setItem("tm_unread_count", String(unreadCount));
      window.dispatchEvent(new Event("tm-unread-updated"));
    } catch {
      // ignore
    }
  }, [unreadCount]);

  // 本地搜索过滤
  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inbox;
    return inbox.filter((m) => {
      const sender = extractSender(m.sender);
      return (
        (sender.name || "").toLowerCase().includes(q) ||
        (sender.email || "").toLowerCase().includes(q) ||
        (m.subject || "").toLowerCase().includes(q) ||
        (m.text || "").toLowerCase().includes(q) ||
        (m.address || "").toLowerCase().includes(q)
      );
    });
  }, [inbox, search]);

  // 拉取邮件列表
  const loadMails = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await api.parsedMails({ limit: 100, offset: 0 });
      setInbox(res.results);
      setCount(res.count);
    } catch (e) {
      push("error", (e as Error).message);
      if ((e as any)?.status === 401) clearToken();
    } finally {
      setLoading(false);
    }
  }, [token, push, clearToken]);

  const loadSent = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.sendbox({ limit: 50, offset: 0 });
      setSent(res.results);
    } catch {
      // ignore
    }
  }, [token]);

  // token 就绪后加载
  useEffect(() => {
    if (token) {
      void loadMails();
      void loadSent();
    } else {
      setInbox([]);
      setSelectedId(null);
    }
  }, [token, loadMails, loadSent]);

  // 每 15 秒自动刷新
  useInterval(() => {
    if (tab === "inbox") void loadMails();
    else void loadSent();
  }, 15000);

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
      push("success", `创建成功`);
      await loadMails();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const deleteMail = async (id: number) => {
    try {
      await api.deleteMail(id);
      setInbox((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) setSelectedId(null);
      push("success", "已删除");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  const clearInbox = async () => {
    try {
      await api.clearInbox();
      setInbox([]);
      setSelectedId(null);
      push("success", "收件箱已清空");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  /** 标记已读 / 未读（乐观更新） */
  const setMailRead = async (id: number, isUnread: boolean) => {
    setInbox((prev) => prev.map((m) => (m.id === id ? { ...m, is_unread: isUnread ? 1 : 0 } : m)));
    try {
      await api.markRead(id, isUnread);
    } catch (e) {
      push("error", (e as Error).message);
      await loadMails();
    }
  };

  /** 全部标为已读 */
  const markAllRead = async () => {
    const unread = inbox.filter((m) => m.is_unread === 1);
    if (unread.length === 0) {
      push("info", "没有未读邮件");
      return;
    }
    setInbox((prev) => prev.map((m) => ({ ...m, is_unread: 0 })));
    try {
      await Promise.all(unread.map((m) => api.markRead(m.id, false)));
      push("success", `已将 ${unread.length} 封邮件标为已读`);
    } catch (e) {
      push("error", (e as Error).message);
      await loadMails();
    }
  };

  const selectedMail = inbox.find((m) => m.id === selectedId) || null;

  if (!settingsLoaded) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex justify-center py-32">
          <Spinner size={32} />
        </div>
      </div>
    );
  }

  // 需要站点密码认证
  if (settings?.needAuth && !token) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-md px-4 py-20 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}>
            <Icon name="lock" size={30} />
          </div>
          <h1 className="large-title mt-4">此站点需要访问密码</h1>
          <p className="mt-2 text-[15px]" style={{ color: "var(--fg-secondary)" }}>
            该站点配置了访问控制（PASSWORDS），请联系站长获取访问密码。
          </p>
        </main>
      </div>
    );
  }

  // 未创建地址 → 创建引导
  if (!token) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-md px-4 pb-16 pt-12">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] text-white shadow-lg shadow-blue-500/30">
              <Icon name="mailbox" size={36} strokeWidth={1.7} />
            </div>
            <h1 className="large-title mt-6">创建临时邮箱</h1>
            <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
              无需注册，即开即用。收件安全存储在 Cloudflare，用完即弃。
            </p>
          </div>

          <div className="card-group mt-8 p-5">
            <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-tertiary)" }}>
              邮箱地址
            </p>
            <div className="flex items-center gap-1 rounded-xl p-2" style={{ background: "var(--bg-tertiary)" }}>
              {nameMode === "custom" ? (
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="自定义前缀"
                  disabled={settings?.disableCustomAddressName}
                  className="flex-1 bg-transparent px-2 py-2 text-[17px] outline-none"
                  style={{ color: "var(--fg)" }}
                />
              ) : (
                <span className="flex-1 px-2 py-2 text-[17px]" style={{ color: "var(--fg-tertiary)" }}>
                  随机前缀（推荐）
                </span>
              )}
              <span className="text-[17px]" style={{ color: "var(--fg-tertiary)" }}>
                @
              </span>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="bg-transparent px-2 py-2 text-[15px] outline-none"
                style={{ color: "var(--fg)" }}
              >
                {settings?.domains.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
              {!settings?.disableCustomAddressName && (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={nameMode === "auto"}
                    onChange={() => setNameMode("auto")}
                    className="accent-[#007aff]"
                  />
                  随机前缀
                </label>
              )}
              {!settings?.disableCustomAddressName && (
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={nameMode === "custom"}
                    onChange={() => setNameMode("custom")}
                    className="accent-[#007aff]"
                  />
                  自定义
                </label>
              )}
              {(settings?.randomSubdomainDomains?.length ?? 0) > 0 && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={randomSub}
                    onChange={(e) => setRandomSub(e.target.checked)}
                    className="accent-[#007aff]"
                  />
                  随机子域名
                </label>
              )}
            </div>

            <LoadingButton
              loading={creating}
              onClick={createAddress}
              className="btn-primary mt-6 w-full"
            >
              创建邮箱地址
            </LoadingButton>

            {settings?.enableAddressPassword && (
              <LoginExisting
                onLogin={(jwt) => {
                  setToken(jwt);
                  push("success", "登录成功");
                }}
              />
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-6 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
            <span className="flex items-center gap-1.5"><Icon name="lock" size={14} /> 邮件仅保存 7 天</span>
            <span className="flex items-center gap-1.5"><Icon name="gift" size={14} /> 完全免费</span>
            <span className="flex items-center gap-1.5"><Icon name="zap" size={14} /> 即时收信</span>
          </div>
        </main>
      </div>
    );
  }

  // 主界面：iOS Mail 风格（左列表 + 右详情）
  return (
    <MotionPage className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-3 py-4 md:px-4 md:py-6">
        {/* 大标题 + 操作 */}
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <FadeUp>
              <h1 className="large-title">{tab === "inbox" ? "收件箱" : "已发送"}</h1>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                {tab === "inbox"
                  ? `共 ${count} 封 · 每 15 秒自动刷新`
                  : `${sent.length} 封已发送`}
              </p>
            </FadeUp>
          </div>
          <div className="flex items-center gap-3">
            {tab === "inbox" && unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="pressable flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium"
                style={{ background: "var(--fill)", color: "var(--accent)" }}
                title="全部标为已读"
              >
                <Icon name="check-check" size={15} />
                全部已读
              </button>
            )}
            <Segmented
              value={tab}
              onChange={(v) => {
                setTab(v);
                if (v === "sent" && !sent.length) void loadSent();
              }}
              options={[
                { value: "inbox", label: "收件" },
                { value: "sent", label: "已发" },
              ]}
            />
          </div>
        </div>

        {/* 地址胶囊 */}
        <div className="mt-4">
          <AddressChip address={token ? (inbox[0]?.address || "") : ""} onCopy={copy} />
        </div>

        {tab === "inbox" && (
          <div className="mt-3">
            <SearchInput value={search} onChange={setSearch} placeholder="搜索发件人、主题、内容…" />
          </div>
        )}

        {tab === "inbox" ? (
          <InboxView
            inbox={searchFiltered}
            loading={loading}
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setMobileDetailOpen(true);
              void setMailRead(id, false);
            }}
            onDelete={(id) => setConfirmAction({ type: "delete-mail", id })}
            onClear={() => setConfirmAction({ type: "clear-inbox" })}
            selectedMail={selectedMail}
            settings={settings}
            mobileDetailOpen={mobileDetailOpen}
            onCloseMobile={() => setMobileDetailOpen(false)}
            onToggleRead={async (id, isUnread) => {
              await setMailRead(id, isUnread);
              if (isUnread) setSelectedId(null);
            }}
          />
        ) : (
          <SentView sent={sent} onDelete={(id) => setConfirmAction({ type: "delete-sent", id })} />
        )}
      </main>

      {/* 已读/未读确认弹窗 */}
      <ConfirmDialog
        open={confirmAction?.type === "delete-mail"}
        title="删除这封邮件？"
        message="删除后不可恢复。"
        confirmText="删除"
        danger
        onConfirm={() => {
          if (confirmAction?.id != null) void deleteMail(confirmAction.id);
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction?.type === "clear-inbox"}
        title="确认清空收件箱？"
        message="所有邮件将被删除，不可恢复。"
        confirmText="清空"
        danger
        onConfirm={() => {
          void clearInbox();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction?.type === "delete-sent"}
        title="删除这封已发送邮件？"
        confirmText="删除"
        danger
        onConfirm={() => {
          if (confirmAction?.id != null) {
            void (async () => {
              try {
                await api.deleteSent(confirmAction.id!);
                await loadSent();
                push("success", "已删除");
              } catch (e) {
                push("error", (e as Error).message);
              }
            })();
          }
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </MotionPage>
  );
}

function AddressChip({ address, onCopy }: { address: string; onCopy: (t: string, label?: string) => void }) {
  const { push } = useToast();
  if (!address) return null;
  return (
    <button
      onClick={() => onCopy(address, "地址已复制")}
      className="pressable flex w-full items-center justify-between rounded-2xl px-4 py-3 md:w-auto md:min-w-[380px]"
      style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--separator)" }}
      title="点击复制"
    >
      <span className="flex items-center gap-2 truncate text-[15px] font-medium" style={{ color: "var(--fg)" }}>
        <span style={{ color: "var(--accent)" }}>
          <Icon name="at-sign" size={17} />
        </span>
        <span className="truncate">{address}</span>
      </span>
      <span className="ml-2 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium text-white" style={{ background: "var(--accent)" }}>
        <Icon name="copy" size={12} strokeWidth={2.2} />
        复制
      </span>
    </button>
  );
}

function InboxView({
  inbox,
  loading,
  selectedId,
  onSelect,
  onDelete,
  onClear,
  selectedMail,
  settings,
  mobileDetailOpen,
  onCloseMobile,
  onToggleRead,
}: {
  inbox: ParsedMailDTO[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onClear: () => void;
  selectedMail: ParsedMailDTO | null;
  settings: any;
  mobileDetailOpen: boolean;
  onCloseMobile: () => void;
  onToggleRead: (id: number, isUnread: boolean) => void;
}) {
  const copy = useCopy();

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* 邮件列表 */}
      <div className="card-group max-h-[calc(100vh-190px)] lg:h-[calc(100vh-200px)]">
        {loading && inbox.length === 0 ? (
          <div className="flex justify-center py-20">
            <Spinner size={28} />
          </div>
        ) : inbox.length === 0 ? (
          <EmptyState
            iconName="inbox"
            title="暂无邮件"
            description="地址已就绪，去注册网站收一封测试邮件吧"
          />
        ) : (
          <ul className="h-full overflow-y-auto">
            <AnimatePresence initial={false}>
              {inbox.map((mail, i) => {
                const sender = extractSender(mail.sender);
                return (
                  <MailListItem
                    key={mail.id}
                    mail={mail}
                    sender={sender}
                    active={selectedId === mail.id}
                    onClick={() => onSelect(mail.id)}
                    index={i}
                  />
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* 邮件详情（桌面常驻） */}
      <div className="card-group hidden min-h-[320px] overflow-hidden lg:block lg:h-[calc(100vh-200px)]">
        <AnimatePresence mode="wait" initial={false}>
          {!selectedMail ? (
            <motion.div
              key="empty"
              className="flex h-full flex-col items-center justify-center py-24"
              style={{ color: "var(--fg-tertiary)" }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="opacity-60">
                <Icon name="mail-open" size={52} strokeWidth={1.5} />
              </div>
              <p className="mt-3 text-[14px]">选择一封邮件查看详情</p>
            </motion.div>
          ) : (
            <motion.div
              key={selectedMail.id}
              className="h-full"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
            >
              <MailDetail
                mail={selectedMail}
                onDelete={() => onDelete(selectedMail.id)}
                onCopy={copy}
                settings={settings}
                onToggleRead={onToggleRead}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 移动端全屏详情 */}
      <AnimatePresence>
        {mobileDetailOpen && selectedMail && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col lg:hidden"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            <div
              className="flex h-12 shrink-0 items-center justify-between px-3"
              style={{ background: "var(--glass)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "0.5px solid var(--separator)" }}
            >
              <button
                onClick={onCloseMobile}
                className="pressable flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: "var(--fill)", color: "var(--fg)" }}
                aria-label="返回"
              >
                <Icon name="arrow-left" size={17} />
              </button>
              <span className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>邮件详情</span>
              <span className="w-8" />
            </div>
            <div className="min-h-0 flex-1">
              <MailDetail
                mail={selectedMail}
                onDelete={() => {
                  onCloseMobile();
                  onDelete(selectedMail.id);
                }}
                onCopy={copy}
                settings={settings}
                onToggleRead={onToggleRead}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MailListItem({
  mail,
  sender,
  active,
  onClick,
  index = 0,
}: {
  mail: ParsedMailDTO;
  sender: { name: string; email: string };
  active: boolean;
  onClick: () => void;
  index?: number;
}) {
  const isUnread = mail.is_unread === 1;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40, height: 0, marginBottom: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 32, delay: Math.min(index * 0.03, 0.3) }}
    >
      <motion.button
        onClick={onClick}
        className={`card-row w-full text-left ${active ? "active" : ""}`}
        whileHover={{ backgroundColor: "var(--bg-tertiary)" }}
        transition={{ duration: 0.12 }}
      >
        {/* 头像 */}
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold text-white"
          style={{ background: avatarColor(sender.email || sender.name) }}
        >
          {(sender.name || sender.email || "?").charAt(0).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
              {sender.name || sender.email || mail.source}
            </span>
            <span className="shrink-0 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              {formatTime(mail.created_at)}
            </span>
          </span>
          <span className="mt-0.5 flex items-center gap-1.5">
            {isUnread && (
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
            )}
            <span className={`truncate text-[14px] ${isUnread ? "font-medium" : ""}`} style={{ color: isUnread ? "var(--fg)" : "var(--fg-secondary)" }}>
              {mail.subject || "(无主题)"}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
            {extractTextPreview(mail.text || mail.html) || mail.source}
          </span>
        </span>
      </motion.button>
    </motion.li>
  );
}

function MailDetail({
  mail,
  onDelete,
  onCopy,
  settings,
  onToggleRead,
}: {
  mail: ParsedMailDTO;
  onDelete: () => void;
  onCopy: (text: string, label?: string) => void;
  settings: any;
  onToggleRead?: (id: number, isUnread: boolean) => void;
}) {
  const sender = extractSender(mail.sender);
  const meta = useExtractMeta(mail.metadata);

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="border-b px-5 pb-4 pt-5" style={{ borderColor: "var(--separator)" }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[18px] font-bold leading-snug" style={{ color: "var(--fg)" }}>
            {mail.subject || "(无主题)"}
          </h2>
          <div className="flex shrink-0 items-center gap-2">
            {onToggleRead && (
              <button
                onClick={() => onToggleRead(mail.id, mail.is_unread !== 1)}
                className="pressable flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: mail.is_unread === 1 ? "rgba(0,122,255,0.15)" : "var(--fill)",
                  color: mail.is_unread === 1 ? "var(--accent)" : "var(--fg-tertiary)",
                }}
                title={mail.is_unread === 1 ? "标为已读" : "标为未读"}
              >
                <Icon name={mail.is_unread === 1 ? "circle-dot" : "circle-check"} size={17} />
              </button>
            )}
            <button
              onClick={onDelete}
              className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
              title="删除"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-full text-[17px] font-semibold text-white"
            style={{ background: avatarColor(sender.email || sender.name) }}
          >
            {(sender.name || sender.email || "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
              {sender.name || "未知发件人"}
            </p>
            <p className="truncate text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
              {sender.email || mail.source}
            </p>
          </div>
          <span className="shrink-0 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
            {formatTime(mail.created_at)}
          </span>
        </div>

        {/* 验证码提取 */}
        {meta && (
          <div className="mt-3">
            <CodeHero meta={meta} onCopy={onCopy} />
          </div>
        )}

        {/* 邮件元信息 */}
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
          <span>收件人：{mail.address}</span>
          <span>来源：{mail.source}</span>
        </div>
      </div>

      {/* 附件 */}
      {mail.attachments.length > 0 && (
        <div className="border-b px-5 py-3" style={{ borderColor: "var(--separator)" }}>
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--fg-tertiary)" }}>
            附件（{mail.attachments.length}）
          </p>
          <div className="flex flex-wrap gap-2">
            {mail.attachments.map((att, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px]"
                style={{ borderColor: "var(--separator)", color: "var(--fg-secondary)" }}
              >
                <Icon name="paperclip" size={14} />
                {att.filename}
                <span className="text-[11px]" style={{ color: "var(--fg-tertiary)" }}>
                  {fmtSize(att.size)}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 正文 */}
      <div className="mail-content flex-1 overflow-y-auto px-5 py-4 text-[15px] leading-relaxed" style={{ color: "var(--fg)" }}>
        {mail.html ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(mail.html) }} />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-[15px]" style={{ color: "var(--fg)" }}>
            {mail.text || "(无内容)"}
          </pre>
        )}
      </div>
    </div>
  );
}

function SentView({ sent, onDelete }: { sent: any[]; onDelete: (id: number) => void }) {
  if (sent.length === 0) {
    return (
      <div className="card-group mt-4">
        <EmptyState iconName="send" title="暂无已发送邮件" description="发邮件后会显示在这里" />
      </div>
    );
  }
  return (
    <div className="card-group mt-4">
      <ul className="divide-y" style={{ borderColor: "var(--separator)" }}>
        {sent.map((item) => {
          let body: any = {};
          try {
            body = typeof item.raw === "string" ? JSON.parse(item.raw) : item.raw || {};
          } catch {
            body = {};
          }
          return (
            <li key={item.id} className="card-row">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: "linear-gradient(135deg,#34c759,#0a84ff)" }}
              >
                <Icon name="send" size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
                  {body.subject || "(无主题)"}
                </p>
                <p className="truncate text-[13px]" style={{ color: "var(--fg-secondary)" }}>
                  发给 {body.to_mail || item.address}
                </p>
              </div>
              <span className="shrink-0 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                {formatTime(item.created_at)}
              </span>
              <button
                onClick={() => onDelete(item.id)}
                className="pressable flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                title="删除"
              >
                <Icon name="trash" size={15} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- 辅助函数 ---------- */

function CodeHero({
  meta,
  onCopy,
}: {
  meta: { type: string; result: string };
  onCopy: (t: string, label?: string) => void;
}) {
  const isCode = meta.type === "auth_code";
  const labelMap: Record<string, string> = {
    auth_code: "验证码",
    auth_link: "验证链接",
    service_link: "服务链接",
    subscription_link: "退订链接",
    other_link: "链接",
  };
  return (
    <button onClick={() => onCopy(meta.result, "已复制")} className="code-hero pressable w-full">
      <span className="block text-[13px] font-medium uppercase tracking-widest opacity-80">
        {labelMap[meta.type] || "提取"}
      </span>
      <span className="mt-1 block break-all text-[24px]">{meta.result}</span>
      <span className="mt-1 block text-[12px] opacity-70">点击复制</span>
    </button>
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

function extractTextPreview(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function avatarColor(key: string): string {
  const colors = ["#007aff", "#34c759", "#ff9500", "#af52de", "#ff2d55", "#5ac8fa", "#5856d6", "#ffcc00"];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function fmtSize(bytes: number): string {
  if (!bytes) return "0B";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

/** 简单净化 HTML */
function sanitizeHtmlContent(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}
/** 已有地址密码登录 */
function LoginExisting({ onLogin }: { onLogin: (jwt: string) => void }) {
  const { push } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      push("error", "请输入邮箱与密码");
      return;
    }
    setBusy(true);
    try {
      // 与上游一致：前端先 SHA-256 再比对
      const hashed = await sha256Hex(password);
      const res = await api.addressLogin({ email: email.trim(), password: hashed });
      onLogin(res.jwt);
      setOpen(false);
      setPassword("");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-3 w-full text-center text-[14px] font-medium"
        style={{ color: "var(--accent)" }}
      >
        已有地址？密码登录
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="card-group w-full max-w-sm fade-in"
            onClick={(e) => e.stopPropagation()}
            style={{ borderRadius: "24px 24px 0 0", padding: 24 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: "var(--fill)" }} />
            <h3 className="text-[19px] font-bold" style={{ color: "var(--fg)" }}>
              登录已有地址
            </h3>
            <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
              使用邮箱地址 + 密码登录查看收件
            </p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="ios-input mt-4"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="密码"
              className="ios-input mt-2"
            />
            <LoadingButton loading={busy} onClick={submit} className="btn-primary mt-4 w-full">
              登录
            </LoadingButton>
            <button
              onClick={() => setOpen(false)}
              className="mt-2 w-full py-2 text-[15px]"
              style={{ color: "var(--fg-secondary)" }}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </>
  );
}
