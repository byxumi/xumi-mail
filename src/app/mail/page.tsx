"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import { EmptyState, LoadingButton, Spinner, Segmented, useCopy, SearchInput, ConfirmDialog } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { MotionPage, FadeUp } from "@/components/motion";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings, useInterval } from "@/hooks/useSettings";
import { Announcement } from "@/components/Announcement";
import { api, formatTime, ParsedMailDTO, extractSender, sha256Hex, tokenStore } from "@/lib/client";

export default function MailPage() {
  const { push } = useToast();
  const copy = useCopy();
  const { settings, loaded: settingsLoaded } = useSettings();
  const { token, set: setToken, clear: clearToken } = useAddressToken();

  const [inbox, setInbox] = useState<ParsedMailDTO[]>([]);
  const [count, setCount] = useState(0);
  const [myAddress, setMyAddress] = useState("");
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
  const [confirmAction, setConfirmAction] = useState<null | { type: "delete-mail" | "clear-inbox" | "delete-sent" | "multi-delete"; id?: number }>(null);
  // 多选模式
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showAddressManage, setShowAddressManage] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<Array<{ jwt: string; address: string }>>([]);
  const router = useRouter();

  // 上一次邮件总数（用于自动刷新时发现新邮件）
  const prevCountRef = useRef(0);

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
      if (res.results[0]?.address) setMyAddress(res.results[0].address);
      // 自动刷新时发现新邮件 → 提示（首次加载不提示）
      if (prevCountRef.current > 0 && res.count > prevCountRef.current) {
        push("success", `收到 ${res.count - prevCountRef.current} 封新邮件`);
      }
      prevCountRef.current = res.count;
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

  // URL ?jwt= 参数自动登录（外部链接 / 邮件内直链跳转场景）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const jwtParam = params.get("jwt");
    if (jwtParam && !token) {
      setToken(jwtParam);
      push("success", "已通过链接自动登录");
      // 清理 URL，避免刷新时重复触发 / 凭据留在地址栏
      const url = new URL(window.location.href);
      url.searchParams.delete("jwt");
      window.history.replaceState({}, "", url.toString());
    }
  }, [token, setToken, push]);

  const setMailRead = async (id: number, isUnread: boolean) => {
    setInbox((prev) => prev.map((m) => (m.id === id ? { ...m, is_unread: isUnread ? 1 : 0 } : m)));
    try {
      await api.markRead(id, isUnread);
    } catch (e) {
      push("error", (e as Error).message);
      await loadMails();
    }
  };
  // URL ?mailId= 直达指定邮件（外部直链 / 邮件内跳转）
  const mailIdRef = useRef<number | null>(null);
  const [mailIdInput, setMailIdInput] = useState("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("mailId");
    if (raw && !Number.isNaN(Number(raw))) {
      mailIdRef.current = Number(raw);
      // 先清理 URL 参数（待选中后再清，避免刷新重触发）
      const url = new URL(window.location.href);
      url.searchParams.delete("mailId");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  // 列表加载后选中直达邮件
  useEffect(() => {
    if (mailIdRef.current && inbox.length > 0) {
      const target = inbox.find((m) => m.id === mailIdRef.current);
      if (target) {
        setSelectedId(target.id);
        setMobileDetailOpen(true);
        void setMailRead(target.id, false);
        mailIdRef.current = null;
      } else if (!loading) {
        // 列表里没有（可能已删除/不在前 100），尝试直接拉取
        api
          .parsedMail(mailIdRef.current)
          .then((row) => {
            if (row) {
              setInbox((prev) =>
                prev.some((m) => m.id === row.id) ? prev : [row, ...prev]
              );
              setSelectedId(row.id);
              setMobileDetailOpen(true);
              void setMailRead(row.id, false);
            }
            mailIdRef.current = null;
          })
          .catch(() => {
            mailIdRef.current = null;
          });
      }
    }
  }, [inbox, loading, setMailRead]);

  // token 就绪后加载
  useEffect(() => {
    if (token) {
      void loadMails();
      void loadSent();
      // 当前地址（收件箱为空时也能显示）
      api
        .addressSettings()
        .then((s) => {
          setMyAddress(s.address);
          bindCurrentAddress();
        })
        .catch(() => {});
    } else {
      setInbox([]);
      setSelectedId(null);
      setMyAddress("");
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
      setMyAddress(res.address);
      push("success", `地址已创建：${res.address}`);
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

  /** ---------- 多选模式 ---------- */
  const toggleMultiSelect = () => {
    setMultiSelect((v) => {
      if (v) {
        setSelectedIds([]);
        return false;
      }
      return true;
    });
  };

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    // 基于当前可见（过滤后）邮件判断是否全选
    const allVisibleIds = searchFiltered.map((m) => m.id);
    const allSelected = allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? selectedIds.filter((id) => !allVisibleIds.includes(id)) : [...new Set([...selectedIds, ...allVisibleIds])]);
  };

  const multiDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      push("info", "请先勾选邮件");
      return;
    }
    try {
      await Promise.all(ids.map((id) => api.deleteMail(id)));
      setInbox((prev) => prev.filter((m) => !ids.includes(m.id)));
      if (selectedId != null && ids.includes(selectedId)) setSelectedId(null);
      setSelectedIds([]);
      push("success", `已删除 ${ids.length} 封邮件`);
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  const multiDownload = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      push("info", "请先勾选邮件");
      return;
    }
    try {
      // 一次性拉取选中邮件的原始内容（含 raw）
      const mails = await Promise.all(ids.map((id) => api.mail(id)));
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      mails.forEach((m) => {
        if (!m) return;
        const raw = m.raw ?? "";
        zip.file(`${m.id}.eml`, raw);
      });
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mails-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setSelectedIds([]);
      push("success", `已打包 ${mails.filter(Boolean).length} 封邮件`);
    } catch (e) {
      push("error", `打包下载失败：${(e as Error).message}`);
    }
  };

  // 从 JWT 解析地址（对齐上游 parseJwtAddress）
  const parseJwtAddress = (curJwt: string): string => {
    try {
      const payload = JSON.parse(
        decodeURIComponent(
          atob(curJwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        )
      );
      return typeof payload.address === "string" ? payload.address : "";
    } catch {
      return "";
    }
  };

  // 读取本地保存的多个地址（对齐上游 LocalAddressCache）
  const loadSavedAddresses = useCallback(() => {
    try {
      const raw = localStorage.getItem("LocalAddressCache") || "[]";
      const list: string[] = JSON.parse(raw);
      if (!Array.isArray(list)) return;
      const seen = new Set<string>();
      const out: Array<{ jwt: string; address: string }> = [];
      for (const curJwt of list) {
        const addr = parseJwtAddress(curJwt);
        if (!addr || seen.has(curJwt)) continue;
        seen.add(curJwt);
        out.push({ jwt: curJwt, address: addr });
      }
      setSavedAddresses(out);
    } catch {
      setSavedAddresses([]);
    }
  }, []);

  // 绑定当前地址到本地缓存
  const bindCurrentAddress = useCallback(() => {
    if (!token) return;
    try {
      const raw = localStorage.getItem("LocalAddressCache") || "[]";
      const parsed: unknown = JSON.parse(raw);
      const list: string[] = Array.isArray(parsed) ? (parsed as string[]) : [];
      if (!list.includes(token)) list.push(token);
      localStorage.setItem("LocalAddressCache", JSON.stringify(list));
      loadSavedAddresses();
    } catch {
      // ignore
    }
  }, [token, loadSavedAddresses]);

  // 切换地址（对齐上游 changeMailAddress）
  const switchAddress = useCallback(
    (curJwt: string) => {
      setToken(curJwt);
      setSelectedId(null);
      setMultiSelect(false);
      setSelectedIds([]);
      setShowAddressManage(false);
      push("success", "已切换邮箱地址");
    },
    [setToken, push]
  );

  // 解绑地址（不能解绑当前使用的）
  const unbindAddress = useCallback(
    (curJwt: string) => {
      if (curJwt === token) return;
      try {
        const raw = localStorage.getItem("LocalAddressCache") || "[]";
        const list: string[] = JSON.parse(raw);
        if (!Array.isArray(list)) return;
        localStorage.setItem(
          "LocalAddressCache",
          JSON.stringify(list.filter((j) => j !== curJwt))
        );
        loadSavedAddresses();
      } catch {
        // ignore
      }
    },
    [token, loadSavedAddresses]
  );

  /** ---------- 回复 / 转发（跳转发件页并预填草稿） ---------- */
  const openDraft = (mode: "reply" | "forward", mail: ParsedMailDTO) => {
    const sender = extractSender(mail.sender);
    const target = mode === "reply" ? (sender.email || mail.source) : "";
    const params = new URLSearchParams({
      mode,
      to: target,
      toName: mode === "reply" ? sender.name || "" : "",
      subject:
        mode === "reply"
          ? `Re: ${mail.subject || ""}`
          : `Fwd: ${mail.subject || ""}`,
      body: `${mode === "reply" ? "在 " : "转发自 "}${formatTime(mail.created_at)}，${sender.name || sender.email || "发件人"} 写道：\n\n${(mail.text || extractTextPreview(mail.html || "")).slice(0, 4000)}`,
    });
    router.push(`/send?${params.toString()}`);
  };

  /** 按邮件 ID 直达（输入框查询） */
  const queryMailById = () => {
    const id = Number(mailIdInput.trim());
    if (!mailIdInput.trim() || Number.isNaN(id) || id <= 0) {
      push("info", "请输入有效的邮件 ID");
      return;
    }
    setMailIdInput("");
    const target = inbox.find((m) => m.id === id);
    if (target) {
      setSelectedId(target.id);
      setMobileDetailOpen(true);
      void setMailRead(id, false);
      return;
    }
    // 列表里没有 → 尝试直接拉取
    api
      .parsedMail(id)
      .then((row) => {
        if (row) {
          setInbox((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
          setSelectedId(row.id);
          setMobileDetailOpen(true);
          void setMailRead(row.id, false);
        } else {
          push("info", "未找到该邮件");
        }
      })
      .catch(() => push("error", "查询失败"));
  };

  /** ---------- 上 / 下一封 ---------- */
  const visibleMails = tab === "inbox" ? searchFiltered : [];
  const currentIndex = visibleMails.findIndex((m) => m.id === selectedId);
  const canPrevMail = currentIndex > 0;
  const canNextMail = currentIndex >= 0 && currentIndex < visibleMails.length - 1;
  const goPrevMail = () => {
    if (canPrevMail) setSelectedId(visibleMails[currentIndex - 1].id);
  };
  const goNextMail = () => {
    if (canNextMail) setSelectedId(visibleMails[currentIndex + 1].id);
  };

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
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#00c08c] to-[#007a58] text-white shadow-lg shadow-emerald-500/30">
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
                    className="accent-[#00a876]"
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
                    className="accent-[#00a876]"
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
                    className="accent-[#00a876]"
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
        {/* 站点公告 */}
        {tab === "inbox" && settings?.announcement?.trim() && (
          <div className="mb-4">
            <Announcement settings={settings} />
          </div>
        )}
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
            {tab === "inbox" && unreadCount > 0 && !multiSelect && (
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
            {tab === "inbox" && (
              <button
                onClick={toggleMultiSelect}
                className="pressable flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium"
                style={{ background: "var(--fill)", color: multiSelect ? "var(--accent)" : "var(--fg-secondary)" }}
                title={multiSelect ? "退出多选" : "多选模式"}
              >
                <Icon name={multiSelect ? "square-check" : "square"} size={15} />
                {multiSelect ? "完成" : "多选"}
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

        {/* 多选操作栏 */}
        {multiSelect && tab === "inbox" && (
          <div
            className="mt-3 flex items-center gap-3 rounded-2xl px-4 py-2.5"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--separator)" }}
          >
            <button
              onClick={toggleSelectAll}
              className="pressable flex items-center gap-1.5 text-[14px] font-medium"
              style={{ color: "var(--accent)" }}
            >
              <Icon name={searchFiltered.length > 0 && searchFiltered.every((m) => selectedIds.includes(m.id)) ? "square-check" : "square"} size={16} />
              {searchFiltered.length > 0 && searchFiltered.every((m) => selectedIds.includes(m.id)) ? "取消全选" : "全选"}
            </button>
            <span className="text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
              已选 {selectedIds.length} 封
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => void multiDownload()}
                disabled={selectedIds.length === 0}
                className="pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium disabled:opacity-40"
                style={{ background: "var(--fill)", color: "var(--accent)" }}
                title="打包下载 EML"
              >
                <Icon name="file-down" size={15} />
                打包下载
              </button>
              <button
                onClick={() => {
                  if (selectedIds.length === 0) {
                    push("info", "请先勾选邮件");
                    return;
                  }
                  setConfirmAction({ type: "multi-delete" });
                }}
                disabled={selectedIds.length === 0}
                className="pressable flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium disabled:opacity-40"
                style={{ background: "rgba(255,59,48,0.12)", color: "#ff3b30" }}
                title="批量删除选中邮件"
              >
                <Icon name="trash" size={14} />
                删除
              </button>
            </div>
          </div>
        )}

        {/* 地址胶囊 */}
        <div className="mt-4">
          <AddressChip address={myAddress} onCopy={copy} onManage={() => { loadSavedAddresses(); setShowAddressManage(true); }} />
        </div>

        {tab === "inbox" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="搜索发件人、主题、内容…" />
            <div className="flex items-center gap-1.5">
              <input
                value={mailIdInput}
                onChange={(e) => setMailIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && queryMailById()}
                placeholder="邮件 ID"
                inputMode="numeric"
                className="w-28 rounded-lg border px-2.5 py-2 text-[13px] outline-none focus:ring-2"
                style={{
                  borderColor: "var(--separator)",
                  background: "var(--bg-tertiary)",
                  color: "var(--fg)",
                  ["--tw-ring-color" as string]: "rgba(0,168,118,0.3)",
                }}
              />
              <button
                onClick={queryMailById}
                className="pressable rounded-lg px-2.5 py-2 text-[13px] font-medium"
                style={{ background: "var(--fill)", color: "var(--accent)" }}
                title="按邮件 ID 直达"
              >
                直达
              </button>
            </div>
          </div>
        )}

        {tab === "inbox" ? (
          <InboxView
            inbox={searchFiltered}
            loading={loading}
            searchActive={search.trim().length > 0}
            selectedId={selectedId}
            onSelect={(id) => {
              if (multiSelect) {
                toggleSelectOne(id);
                return;
              }
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
            multiSelect={multiSelect}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelectOne}
            onPrevMail={goPrevMail}
            onNextMail={goNextMail}
            canPrevMail={canPrevMail}
            canNextMail={canNextMail}
            onReply={(mail) => openDraft("reply", mail)}
            onForward={(mail) => openDraft("forward", mail)}
          />
        ) : (
          <SentView sent={sent} onDelete={(id) => setConfirmAction({ type: "delete-sent", id })} />
        )}
      </main>

      {/* 已读/未读确认弹窗 */}
      {/* 地址管理弹窗（对齐上游 LocalAddress / AddressBar addressManage） */}
      <AnimatePresence>
        {showAddressManage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 lg:items-center"
            onClick={() => setShowAddressManage(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="w-full max-w-md overflow-hidden rounded-3xl"
              style={{ background: "var(--bg)", border: "1px solid var(--separator)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--separator)" }}>
                <span className="text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
                  地址管理
                </span>
                <button
                  onClick={() => setShowAddressManage(false)}
                  className="pressable rounded-full p-2"
                  style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-3">
                {savedAddresses.length === 0 && (
                  <p className="px-2 py-6 text-center text-[13px]" style={{ color: "var(--fg-secondary)" }}>
                    暂无已保存的地址。创建新地址后会自动保存，便于快速切换。
                  </p>
                )}
                {savedAddresses.map((item) => (
                  <div
                    key={item.jwt}
                    className="flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5"
                    style={{ background: "var(--bg-secondary)", border: "1px solid var(--separator)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium" style={{ color: "var(--fg)" }}>
                        {item.address}
                      </p>
                      {item.jwt === token && (
                        <span
                          className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                          style={{ background: "var(--accent)" }}
                        >
                          当前使用
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {item.jwt !== token && (
                        <button
                          onClick={() => switchAddress(item.jwt)}
                          className="pressable rounded-full px-3 py-1.5 text-[12px] font-medium text-white"
                          style={{ background: "var(--accent)" }}
                        >
                          切换
                        </button>
                      )}
                      {item.jwt !== token && (
                        <button
                          onClick={() => unbindAddress(item.jwt)}
                          className="pressable rounded-full px-3 py-1.5 text-[12px] font-medium"
                          style={{ background: "rgba(255,59,48,0.12)", color: "#ff3b30" }}
                        >
                          解绑
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="border-t px-5 py-3" style={{ borderColor: "var(--separator)" }}>
                <p className="text-center text-[12px]" style={{ color: "var(--fg-secondary)" }}>
                  点击「复制」可复制地址，切换后收件箱自动刷新
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
      <ConfirmDialog
        open={confirmAction?.type === "multi-delete"}
        title={selectedIds.length > 0 ? `删除选中的 ${selectedIds.length} 封邮件？` : "删除选中的邮件？"}
        message="删除后不可恢复。"
        confirmText="删除"
        danger
        onConfirm={() => {
          void multiDelete();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </MotionPage>
  );
}

function AddressChip({ address, onCopy, onManage }: { address: string; onCopy: (t: string, label?: string) => void; onManage?: () => void }) {
  const { push } = useToast();
  if (!address) return null;
  return (
    <button
      onClick={() => onCopy(address, "地址已复制")}
      className="pressable flex w-full items-center justify-between rounded-2xl px-4 py-3 md:w-auto md:min-w-[380px]"
      style={{ background: "var(--bg-secondary)", border: "1px solid var(--separator)" }}
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
      {onManage && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onManage();
          }}
          className="ml-2 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium"
          style={{ background: "var(--fill)", color: "var(--accent)" }}
        >
          <Icon name="more" size={12} strokeWidth={2.2} />
          管理
        </span>
      )}
    </button>
  );
}

function InboxView({
  inbox,
  loading,
  searchActive,
  selectedId,
  onSelect,
  onDelete,
  onClear,
  selectedMail,
  settings,
  mobileDetailOpen,
  onCloseMobile,
  onToggleRead,
  multiSelect,
  selectedIds,
  onToggleSelect,
  onPrevMail,
  onNextMail,
  canPrevMail,
  canNextMail,
  onReply,
  onForward,
}: {
  inbox: ParsedMailDTO[];
  loading: boolean;
  searchActive: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onClear: () => void;
  selectedMail: ParsedMailDTO | null;
  settings: any;
  mobileDetailOpen: boolean;
  onCloseMobile: () => void;
  onToggleRead: (id: number, isUnread: boolean) => void;
  multiSelect: boolean;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onPrevMail: () => void;
  onNextMail: () => void;
  canPrevMail: boolean;
  canNextMail: boolean;
  onReply: (mail: ParsedMailDTO) => void;
  onForward: (mail: ParsedMailDTO) => void;
}) {
  const copy = useCopy();

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      {/* 邮件列表 */}
      <div className="card-group mail-panel max-h-[calc(100vh-190px)] overflow-hidden lg:h-[calc(100vh-200px)]">
        {loading && inbox.length === 0 ? (
          <div className="flex justify-center py-20">
            <Spinner size={28} />
          </div>
        ) : inbox.length === 0 ? (
          <EmptyState
            iconName={searchActive ? "search" : "inbox"}
            title={searchActive ? "没有匹配的邮件" : "暂无邮件"}
            description={
              searchActive
                ? "换个关键词试试，或清除搜索条件"
                : "地址已就绪，去注册网站收一封测试邮件吧"
            }
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
                    multiSelect={multiSelect}
                    selected={selectedIds.includes(mail.id)}
                    onToggleSelect={() => onToggleSelect(mail.id)}
                  />
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* 邮件详情（桌面常驻） */}
      <div className="card-group mail-panel hidden min-h-[320px] overflow-hidden lg:block lg:h-[calc(100vh-200px)]">
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
                onReply={() => onReply(selectedMail)}
                onForward={() => onForward(selectedMail)}
                onPrevMail={onPrevMail}
                onNextMail={onNextMail}
                canPrevMail={canPrevMail}
                canNextMail={canNextMail}
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
                onReply={() => onReply(selectedMail)}
                onForward={() => onForward(selectedMail)}
                onPrevMail={onPrevMail}
                onNextMail={onNextMail}
                canPrevMail={canPrevMail}
                canNextMail={canNextMail}
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
  multiSelect = false,
  selected = false,
  onToggleSelect,
}: {
  mail: ParsedMailDTO;
  sender: { name: string; email: string };
  active: boolean;
  onClick: () => void;
  index?: number;
  multiSelect?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
        className={`card-row relative w-full overflow-hidden text-left ${active ? "active" : ""}`}
        whileHover={{ backgroundColor: "var(--bg-tertiary)" }}
        transition={{ duration: 0.12 }}
      >
        {/* 多选勾选框 */}
        {multiSelect && (
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors"
            style={{
              borderColor: selected ? "var(--accent)" : "var(--separator)",
              background: selected ? "var(--accent)" : "transparent",
              color: "#fff",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
          >
            {selected && <Icon name="check" size={13} strokeWidth={3} />}
          </span>
        )}
        {/* 未读左侧强调条 */}
        {isUnread && (
          <span
            className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full"
            style={{ background: "var(--accent)", boxShadow: "0 0 8px rgba(0,168,118,0.6)" }}
          />
        )}
        {/* 头像 */}
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[16px] font-semibold text-white"
          style={{
            background: avatarColor(sender.email || sender.name),
            boxShadow: isUnread ? "0 0 0 2px var(--bg-secondary), 0 0 0 3.5px rgba(0,168,118,0.45)" : undefined,
          }}
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
  onReply,
  onForward,
  onPrevMail,
  onNextMail,
  canPrevMail,
  canNextMail,
}: {
  mail: ParsedMailDTO;
  onDelete: () => void;
  onCopy: (text: string, label?: string) => void;
  settings: any;
  onToggleRead?: (id: number, isUnread: boolean) => void;
  onReply?: (mail: ParsedMailDTO) => void;
  onForward?: (mail: ParsedMailDTO) => void;
  onPrevMail?: () => void;
  onNextMail?: () => void;
  canPrevMail?: boolean;
  canNextMail?: boolean;
}) {
  const { push } = useToast();
  const sender = extractSender(mail.sender);
  const meta = useExtractMeta(mail.metadata);
  const [showText, setShowText] = useState(false);
  const [showRemote, setShowRemote] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // 远程图片拦截：检测 html 中非 cid/data 的 http(s) img src
  const remoteCount = useMemo(() => {
    if (!mail.html) return 0;
    const matches = mail.html.match(/<img[^>]+src\s*=\s*["'](https?:\/\/[^"']+)["']/gi);
    return matches ? matches.length : 0;
  }, [mail.html]);

  const sanitizedHtml = useMemo(() => {
    let html = rewriteInlineImages(mail.html || "", mail.id, mail.attachments);
    html = sanitizeHtmlContent(html);
    if (!showRemote && remoteCount > 0) {
      // 远程图替换为 1x1 占位
      html = html.replace(
        /(<img[^>]*?\ssrc\s*=\s*["'])https?:\/\/[^"']+(["'])/gi,
        `$1data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7$2`
      );
    }
    return html;
  }, [mail.html, mail.id, mail.attachments, showRemote, remoteCount]);

  const downloadEml = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const rawMail = await api.mail(mail.id);
      const content = rawMail?.raw ?? "";
      if (!content) {
        push("error", "无法获取邮件原文");
        return;
      }
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${mail.id}.eml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      push("error", (e as Error).message || "下载失败");
    } finally {
      setDownloading(false);
    }
  };

  const content = (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="border-b px-5 pb-4 pt-5" style={{ borderColor: "var(--separator)" }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[18px] font-bold leading-snug" style={{ color: "var(--fg)" }}>
            {mail.subject || "(无主题)"}
          </h2>
          <div className="flex shrink-0 items-center gap-1.5">
            {onPrevMail && (
              <button
                onClick={onPrevMail}
                disabled={!canPrevMail}
                className="pressable flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
                style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                title="上一封"
              >
                <Icon name="chevron-up" size={16} />
              </button>
            )}
            {onNextMail && (
              <button
                onClick={onNextMail}
                disabled={!canNextMail}
                className="pressable flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-30"
                style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                title="下一封"
              >
                <Icon name="chevron-down" size={16} />
              </button>
            )}
            {onToggleRead && (
              <button
                onClick={() => onToggleRead(mail.id, mail.is_unread !== 1)}
                className="pressable flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: mail.is_unread === 1 ? "rgba(0,168,118,0.16)" : "var(--fill)",
                  color: mail.is_unread === 1 ? "var(--accent)" : "var(--fg-tertiary)",
                }}
                title={mail.is_unread === 1 ? "标为已读" : "标为未读"}
              >
                <Icon name={mail.is_unread === 1 ? "circle-dot" : "circle-check"} size={17} />
              </button>
            )}
            <button
              onClick={() => setFullscreen(true)}
              className="pressable flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
              title="全屏查看"
            >
              <Icon name="maximize" size={15} />
            </button>
            <button
              onClick={() => void downloadEml()}
              disabled={downloading}
              className="pressable flex h-8 w-8 items-center justify-center rounded-full disabled:opacity-40"
              style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
              title="下载 .eml"
            >
              <Icon name="file-down" size={15} />
            </button>
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
          <span className="flex items-center gap-1">
            收件人：
            <button
              onClick={() => onCopy(mail.address, "收件地址已复制")}
              className="pressable font-medium"
              style={{ color: "var(--accent)" }}
              title="复制收件地址"
            >
              {mail.address}
            </button>
          </span>
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
            {mail.attachments.map((att, i) => {
              const isImage = att.mimeType?.startsWith("image/");
              // 图片附件 → 新标签页内联预览；其他 → 直接下载
              const href = isImage ? attachmentUrl(mail.id, i, { inline: true }) : attachmentUrl(mail.id, i);
              return (
                <a
                  key={i}
                  href={href}
                  {...(isImage ? { target: "_blank", rel: "noopener noreferrer" } : { download: att.filename || true })}
                  className="pressable flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px]"
                  style={{ borderColor: "var(--separator)", color: "var(--fg-secondary)", cursor: "pointer" }}
                  title={isImage ? `预览 ${att.filename}` : `下载 ${att.filename}`}
                >
                  <Icon name={isImage ? "image" : "paperclip"} size={14} />
                  {att.filename}
                  <span className="text-[11px]" style={{ color: "var(--fg-tertiary)" }}>
                    {fmtSize(att.size)}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* 远程图片拦截提示 */}
      {remoteCount > 0 && !showRemote && (
        <div
          className="mx-5 mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px]"
          style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
        >
          <Icon name="shield" size={14} style={{ color: "var(--accent)" }} />
          <span className="flex-1">远程图片已拦截（{remoteCount} 张），未加载以保护隐私</span>
          <button
            onClick={() => setShowRemote(true)}
            className="pressable font-semibold"
            style={{ color: "var(--accent)" }}
          >
            加载远程图片
          </button>
        </div>
      )}

      {/* 正文 */}
      <div className="mail-content flex-1 overflow-y-auto px-5 py-4 text-[15px] leading-relaxed" style={{ color: "var(--fg)" }}>
        {mail.html && !showText ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-[15px]" style={{ color: "var(--fg)" }}>
            {mail.text || "(无内容)"}
          </pre>
        )}
      </div>

      {/* 底部操作栏：纯文本切换 + 回复/转发 */}
      {(onReply || onForward || mail.html) && (
        <div
          className="flex items-center gap-2 border-t px-5 py-2.5"
          style={{ borderColor: "var(--separator)" }}
        >
          {mail.html && (
            <button
              onClick={() => setShowText((v) => !v)}
              className="pressable flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium"
              style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
              title={showText ? "查看 HTML 内容" : "查看纯文本内容"}
            >
              <Icon name={showText ? "eye" : "file"} size={14} />
              {showText ? "HTML" : "纯文本"}
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {onReply && (
              <button
                onClick={() => onReply(mail)}
                className="pressable flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold"
                style={{ background: "rgba(0,168,118,0.12)", color: "var(--accent)" }}
                title="回复发件人"
              >
                <Icon name="reply" size={14} />
                回复
              </button>
            )}
            {onForward && (
              <button
                onClick={() => onForward(mail)}
                className="pressable flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-semibold"
                style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                title="转发邮件"
              >
                <Icon name="forward" size={14} />
                转发
              </button>
            )}
          </div>
        </div>
      )}

      {/* 全屏查看 */}
      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ background: "var(--bg-secondary)" }}
        >
          <div
            className="flex h-12 shrink-0 items-center justify-between px-4"
            style={{ background: "var(--glass)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderBottom: "1px solid var(--separator)" }}
          >
            <span className="truncate text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
              {mail.subject || "(无主题)"}
            </span>
            <button
              onClick={() => setFullscreen(false)}
              className="pressable flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "var(--fill)", color: "var(--fg)" }}
              aria-label="退出全屏"
            >
              <Icon name="minimize" size={17} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {mail.html && !showText ? (
              <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
            ) : (
              <pre className="whitespace-pre-wrap font-sans text-[15px]" style={{ color: "var(--fg)" }}>
                {mail.text || "(无内容)"}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return content;
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
                style={{ background: "linear-gradient(135deg,#00c08c,#007a58)" }}
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
  meta: { type: string; result: string; resultText?: string };
  onCopy: (t: string, label?: string) => void;
}) {
  const isCode = meta.type === "auth_code";
  const isLink = !isCode && (meta.type.endsWith("_link") || meta.type === "link");
  const labelMap: Record<string, string> = {
    auth_code: "验证码",
    auth_link: "验证链接",
    service_link: "服务链接",
    subscription_link: "退订链接",
    other_link: "链接",
  };
  const display = meta.resultText && meta.resultText !== meta.result ? meta.resultText : meta.result;
  return (
    <div className="code-hero pressable w-full">
      <span className="flex items-center justify-between">
        <span className="block text-[13px] font-medium uppercase tracking-widest opacity-80">
          {labelMap[meta.type] || "提取"}
        </span>
        {isLink && (
          <a
            href={meta.result}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="pressable rounded-full px-3 py-1 text-[12px] font-semibold text-white"
            style={{ background: "var(--accent)" }}
          >
            打开链接
          </a>
        )}
      </span>
      <button
        onClick={() => onCopy(meta.result, "已复制")}
        className="mt-1 block w-full break-all text-left text-[20px]"
      >
        {display}
      </button>
      <span className="mt-1 block text-[12px] opacity-70">点击复制</span>
    </div>
  );
}

function useExtractMeta(metadata: string | null): { type: string; result: string; resultText?: string } | null {
  if (!metadata) return null;
  try {
    const parsed = JSON.parse(metadata);
    const extract = parsed?.ai_extract;
    if (extract && extract.type !== "none" && extract.result) {
      return {
        type: extract.type,
        result: extract.result,
        resultText: typeof extract.result_text === "string" ? extract.result_text : undefined,
      };
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
  const colors = ["#00a876", "#34c759", "#ff9500", "#af52de", "#ff2d55", "#00c2a8", "#5e5ce6", "#f5d90a"];
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

/** 附件直链（带 JWT，供 img/a 直链下载或内联显示） */
function attachmentUrl(id: number, index: number, opts: { inline?: boolean } = {}): string {
  const url = new URL(`/api/mail/${id}/attachment/${index}`, window.location.origin);
  if (opts.inline) url.searchParams.set("inline", "1");
  const token = tokenStore.getAddress();
  if (token) url.searchParams.set("jwt", token);
  return url.toString();
}

/** 将 HTML 内 cid:xxx 图片引用替换为附件直链（内联渲染） */
function rewriteInlineImages(
  html: string,
  mailId: number,
  attachments: ParsedMailDTO["attachments"]
): string {
  if (!html || !html.includes("cid:")) return html;
  const cidIndex = new Map<string, number>();
  attachments.forEach((a, i) => {
    if (a.contentId) cidIndex.set(a.contentId.replace(/[<>]/g, "").trim().toLowerCase(), i);
  });
  return html.replace(/src\s*=\s*["']cid:([^"']+)["']/gi, (_m, cid: string) => {
    const index = cidIndex.get(cid.trim().toLowerCase());
    return `src="${index !== undefined ? attachmentUrl(mailId, index, { inline: true }) : ""}"`;
  });
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
