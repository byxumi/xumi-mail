"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { GroupLabel, FormRow, LoadingButton, Segmented, useCopy } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { MotionPage, FadeUp, MotionList } from "@/components/motion";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings } from "@/hooks/useSettings";
import { api, tokenStore } from "@/lib/client";

interface BoundAddress {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  mail_count: number;
}

interface UserInfo {
  user_email: string;
  user_id: number;
  is_admin: boolean;
  user_role: { domains: string[]; role: string; prefix: string } | null;
}

const formatTime = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (d.toDateString() === now.toDateString()) {
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "昨天";
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
};

export default function UserPage() {
  const { push } = useToast();
  const copy = useCopy();
  const { settings } = useSettings();
  const { token } = useAddressToken();

  const [userLoggedIn, setUserLoggedIn] = useState(false);
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [userEmail, setUserEmail] = useState("");
  const [userPwd, setUserPwd] = useState("");
  const [userBusy, setUserBusy] = useState(false);

  // 用户信息
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [addresses, setAddresses] = useState<BoundAddress[]>([]);
  const [mailCount, setMailCount] = useState(0);

  // 我的邮件
  const [mailTab, setMailTab] = useState("inbox");
  const [activeAddr, setActiveAddr] = useState("");
  const [mails, setMails] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [mailLoading, setMailLoading] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  // 操作中标记
  const [busyId, setBusyId] = useState<number | null>(null);
  const [transferTo, setTransferTo] = useState("");
  const [transferId, setTransferId] = useState<number | null>(null);
  // 当前临时邮箱名（address JWT 已生效时）
  const [currentAddr, setCurrentAddr] = useState("");

  const refresh = useCallback(async () => {
    if (!tokenStore.getUser()) return;
    try {
      const [infoRes, addrRes] = await Promise.all([api.userSettings(), api.userAddresses()]);
      setInfo(infoRes);
      setAddresses(addrRes.results || []);
      setMailCount((addrRes.results || []).reduce((sum, a) => sum + (a.mail_count || 0), 0));
      if (!activeAddr && addrRes.results?.length) setActiveAddr(addrRes.results[0].name);
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push, activeAddr]);

  const loadMails = useCallback(async () => {
    if (!activeAddr) return;
    setMailLoading(true);
    try {
      if (mailTab === "inbox") {
        const r = await api.userMails({ address: activeAddr, limit: 30 });
        setMails(r.results || []);
      } else {
        const r = await api.userSendbox({ address: activeAddr, limit: 30 });
        setSent(r.results || []);
      }
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setMailLoading(false);
    }
  }, [activeAddr, mailTab, push]);

  useEffect(() => {
    setUserLoggedIn(!!tokenStore.getUser());
    if (tokenStore.getUser()) void refresh();
  }, [refresh]);

  // 有地址 token 时同步当前地址名
  useEffect(() => {
    if (!token) {
      setCurrentAddr("");
      return;
    }
    api
      .addressSettings()
      .then((r) => setCurrentAddr(r.address))
      .catch(() => setCurrentAddr(""));
  }, [token]);

  useEffect(() => {
    void loadMails();
  }, [loadMails]);

  const submitUser = async () => {
    if (!userEmail.trim() || !userPwd) {
      push("error", "用户名和密码不能为空");
      return;
    }
    setUserBusy(true);
    try {
      const res =
        loginMode === "login"
          ? await api.login({ user_email: userEmail.trim(), password: userPwd })
          : await api.register({ user_email: userEmail.trim(), password: userPwd });
      tokenStore.setUser(res.jwt);
      setUserLoggedIn(true);
      setUserEmail("");
      setUserPwd("");
      push("success", loginMode === "login" ? `欢迎回来，${res.user_email}` : `注册成功，${res.user_email}`);
      void refresh();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setUserBusy(false);
    }
  };

  const logout = () => {
    tokenStore.clearUser();
    setUserLoggedIn(false);
    setInfo(null);
    setAddresses([]);
    setMails([]);
    setSent([]);
    setActiveAddr("");
    push("success", "已退出用户账号");
  };

  // 绑定当前临时邮箱（用地址名解析 id）
  const bindCurrent = async () => {
    if (!currentAddr) {
      push("error", "请先在收件箱创建临时邮箱地址");
      return;
    }
    setBusyId(-1);
    try {
      await api.bindAddress({ address: currentAddr });
      push("success", `已绑定 ${currentAddr}`);
      void refresh();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const grabCredential = async (a: BoundAddress) => {
    setBusyId(a.id);
    try {
      const r = await api.bindAddressJwt(a.id);
      tokenStore.setAddress(r.jwt);
      push("success", `已切换到 ${r.address}，凭据已生效`);
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const unbindOne = async (a: BoundAddress) => {
    if (!window.confirm(`确认解绑 ${a.name}？解绑后该地址不再属于你的账号，但地址本身不会删除。`)) return;
    setBusyId(a.id);
    try {
      await api.unbindAddressOne({ address_id: a.id });
      push("success", `已解绑 ${a.name}`);
      if (activeAddr === a.name) setActiveAddr("");
      void refresh();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const doTransfer = async (a: BoundAddress) => {
    if (!transferTo.trim()) {
      push("error", "请填写目标用户名");
      return;
    }
    setBusyId(a.id);
    try {
      await api.transferAddress({ address_id: a.id, target_user_email: transferTo.trim() });
      push("success", `已将 ${a.name} 转移给 ${transferTo.trim()}`);
      setTransferTo("");
      setTransferId(null);
      void refresh();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const deleteMail = async (id: number) => {
    if (!window.confirm("确认删除这封邮件？")) return;
    try {
      await api.deleteUserMail(id);
      setMails((prev) => prev.filter((m) => m.id !== id));
      push("success", "邮件已删除");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  const deleteSent = async (id: number) => {
    if (!window.confirm("确认删除这条发送记录？")) return;
    try {
      await api.deleteUserSent(id);
      setSent((prev) => prev.filter((m) => m.id !== id));
      push("success", "记录已删除");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  const bindable = useMemo(
    () =>
      currentAddr
        ? [
            {
              id: -1,
              name: currentAddr,
              created_at: "",
              updated_at: "",
              mail_count: 0,
            },
          ]
        : [],
    [currentAddr]
  );

  const mailsBody = (m: any) => {
    const raw = m.raw_blob ?? m.raw;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    }
    return raw || {};
  };

  // 从原始 RFC822 报文提取头部（用户中心直接展示报文原文）
  const decodeMimeWord = (s: string) =>
    s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, cs: string, enc: string, txt: string) => {
      try {
        if (enc.toLowerCase() === "b") {
          const bin = atob(txt);
          return new TextDecoder(cs).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
        }
        return decodeURIComponent(txt.replace(/=([0-9A-Fa-f]{2})/g, "%$1"));
      } catch {
        return txt;
      }
    });

  const extractMetaInline = (metadata: string | null) => {
    if (!metadata) return null;
    try {
      const parsed = JSON.parse(metadata);
      const extract = parsed?.ai_extract;
      if (extract && extract.type !== "none" && extract.result) {
        return { type: extract.type as string, result: extract.result as string };
      }
    } catch {
      // ignore
    }
    return null;
  };

  const mailHead = (m: any) => {
    const raw = typeof m.raw === "string" ? m.raw : "";
    const subj = raw.match(/^Subject:\s*(.+)$/im)?.[1] || "";
    const from = raw.match(/^From:\s*(.+)$/im)?.[1] || "";
    const ext = extractMetaInline(m.metadata);
    return { subject: decodeMimeWord(subj.trim()), from: decodeMimeWord(from.trim()), ext };
  };

  const activeName = activeAddr || "";

  return (
    <MotionPage className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <FadeUp>
          <div className="flex items-center gap-3">
            <span className="mono rounded-md px-2 py-1 text-[11px] tracking-[0.18em]" style={{ background: "var(--fill)", color: "var(--accent)" }}>
              USER CONSOLE
            </span>
            {userLoggedIn && (
              <span className="mono rounded-md px-2 py-1 text-[11px] tracking-[0.18em]" style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}>
                UID {info?.user_id ?? "-"}
              </span>
            )}
          </div>
          <h1 className="large-title mt-3">用户中心</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
            把临时邮箱绑定到账号，一处管理全部收信与发送记录
          </p>
        </FadeUp>

        {!userLoggedIn ? (
          <div className="card-group mt-6">
            <div className="p-5">
              <p className="mb-3 text-[13px]" style={{ color: "var(--fg-secondary)" }}>
                注册一个账号，然后把你的临时邮箱地址绑定进来——收件、发件记录都在这。
              </p>
              <div className="segmented w-full">
                <button className={loginMode === "login" ? "active flex-1" : "flex-1"} onClick={() => setLoginMode("login")}>
                  登录
                </button>
                <button className={loginMode === "register" ? "active flex-1" : "flex-1"} onClick={() => setLoginMode("register")}>
                  {settings?.enableUserRegister ? "注册" : "注册（未开启）"}
                </button>
              </div>
              <input
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="用户名（邮箱格式）"
                className="ios-input mt-3"
              />
              <input
                type="password"
                value={userPwd}
                onChange={(e) => setUserPwd(e.target.value)}
                placeholder="密码（至少 6 位）"
                className="ios-input mt-2"
              />
              <LoadingButton loading={userBusy} onClick={submitUser} className="btn-primary mt-3 w-full">
                {loginMode === "login" ? "登录" : settings?.enableUserRegister ? "注册" : "注册"}
              </LoadingButton>
              {loginMode === "register" && !settings?.enableUserRegister && (
                <p className="mt-3 text-center text-[12px]" style={{ color: "var(--red)" }}>
                  注册功能未开启，请联系管理员
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 用户信息 */}
            <GroupLabel>身份</GroupLabel>
            <div className="card-group">
              <div className="card-row justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--fill)", color: "var(--accent)" }}>
                    <Icon name="user" size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
                      {info?.user_email ?? tokenStore.getUser() ? "已登录" : "已登录"}
                    </p>
                    <p className="mono mt-0.5 text-[11px] tracking-[0.1em]" style={{ color: "var(--fg-tertiary)" }}>
                      UID {info?.user_id ?? "-"} {info?.is_admin ? "· ADMIN" : ""}
                      {info?.user_role?.role ? ` · ROLE ${info.user_role.role}` : ""}
                    </p>
                  </div>
                </div>
                <button onClick={logout} className="btn-secondary shrink-0 px-3 py-1.5 text-[13px]">
                  退出
                </button>
              </div>
            </div>

            {/* 绑定入口 */}
            <GroupLabel>绑定地址</GroupLabel>
            <div className="card-group">
              {bindable.length > 0 && bindable[0].name && (
                <button
                  onClick={bindCurrent}
                  disabled={busyId === -1}
                  className="card-row w-full justify-between text-left disabled:opacity-60"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "rgba(0,168,118,.12)", color: "var(--accent)" }}>
                      <Icon name="link" size={14} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px]" style={{ color: "var(--fg)" }}>
                        绑定当前临时邮箱
                      </p>
                      <p className="mono truncate text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                        {bindable[0].name}
                      </p>
                    </div>
                  </div>
                  <span className="mono text-[12px]" style={{ color: "var(--accent)" }}>
                    {busyId === -1 ? "绑定中…" : "绑定"}
                  </span>
                </button>
              )}
              {bindable.length === 0 || !bindable[0].name ? (
                <div className="card-row justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--fill)", color: "var(--accent)" }}>
                      <Icon name="link" size={14} />
                    </span>
                    <p className="text-[15px]" style={{ color: "var(--fg)" }}>
                      绑定当前临时邮箱
                    </p>
                  </div>
                  <Link href="/mail" className="mono text-[12px]" style={{ color: "var(--accent)" }}>
                    先去创建地址
                  </Link>
                </div>
              ) : null}
              <p className="px-5 pb-4 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                一个账号可绑定多个地址；地址本身仍可匿名使用，绑定只用于统一管理。
              </p>
            </div>

            {/* 地址列表 */}
            <GroupLabel>我的地址（{addresses.length}）</GroupLabel>
            {addresses.length === 0 ? (
              <div className="card-group">
                <div className="empty-state py-8">
                  <div className="icon">
                    <Icon name="at-sign" size={44} strokeWidth={1.5} />
                  </div>
                  <p className="text-[16px] font-semibold" style={{ color: "var(--fg-secondary)" }}>
                    还没有绑定任何地址
                  </p>
                  <p className="mt-1 text-[13px]">去收件箱创建临时邮箱后一键绑定</p>
                </div>
              </div>
            ) : (
              <MotionList className="space-y-2">
                {addresses.map((a) => (
                  <div key={a.id} className="card-group">
                    <div className="card-row justify-between">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => {
                            setActiveAddr(a.name);
                            setMailTab("inbox");
                          }}
                          className="block max-w-full truncate text-left text-[16px] font-semibold"
                          style={{ color: a.name === activeName ? "var(--accent)" : "var(--fg)" }}
                        >
                          {a.name}
                        </button>
                        <p className="mono mt-0.5 text-[11px] tracking-[0.06em]" style={{ color: "var(--fg-tertiary)" }}>
                          {a.mail_count} 封收信 · 绑定于 {formatTime(a.created_at)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() => copy(a.name, "地址已复制")}
                          className="pressable rounded-full px-3 py-1 text-[12px]"
                          style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                        >
                          复制
                        </button>
                        <button
                          onClick={() => grabCredential(a)}
                          disabled={busyId === a.id}
                          className="pressable rounded-full px-3 py-1 text-[12px]"
                          style={{ background: "rgba(0,168,118,.12)", color: "var(--accent)" }}
                        >
                          {busyId === a.id ? "提取中…" : "取凭据"}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 border-t px-5 py-3" style={{ borderColor: "var(--separator)" }}>
                      <button
                        onClick={() => setTransferId(transferId === a.id ? null : a.id)}
                        className="pressable rounded-full px-3 py-1 text-[12px]"
                        style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                      >
                        转移
                      </button>
                      <button
                        onClick={() => unbindOne(a)}
                        disabled={busyId === a.id}
                        className="pressable rounded-full px-3 py-1 text-[12px]"
                        style={{ background: "rgba(229,72,77,.1)", color: "var(--red)" }}
                      >
                        解绑
                      </button>
                    </div>
                    {transferId === a.id && (
                      <div className="flex gap-2 border-t px-5 py-3" style={{ borderColor: "var(--separator)" }}>
                        <input
                          value={transferTo}
                          onChange={(e) => setTransferTo(e.target.value)}
                          placeholder="目标用户名"
                          className="ios-input flex-1"
                        />
                        <button onClick={() => doTransfer(a)} disabled={busyId === a.id} className="btn-secondary px-3 text-[13px]">
                          确认转移
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </MotionList>
            )}

            {/* 我的邮件 / 发送记录 */}
            {activeName && (
              <>
                <GroupLabel>绑定邮箱内容</GroupLabel>
                <div className="card-group">
                  <div className="card-row justify-between">
                    <div className="segmented">
                      <button className={mailTab === "inbox" ? "active" : ""} onClick={() => setMailTab("inbox")}>
                        收件（{mails.length}）
                      </button>
                      <button className={mailTab === "sent" ? "active" : ""} onClick={() => setMailTab("sent")}>
                        已发（{sent.length}）
                      </button>
                    </div>
                    <span className="mono hidden text-[11px] tracking-[0.08em] sm:inline" style={{ color: "var(--fg-tertiary)" }}>
                      {activeName}
                    </span>
                  </div>
                </div>

                {mailLoading ? (
                  <div className="card-group mt-2 py-10 text-center text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                    载入中…
                  </div>
                ) : mailTab === "inbox" && mails.length === 0 ? (
                  <div className="card-group mt-2">
                    <div className="empty-state py-8">
                      <div className="icon">
                        <Icon name="inbox" size={44} strokeWidth={1.5} />
                      </div>
                      <p className="text-[16px] font-semibold" style={{ color: "var(--fg-secondary)" }}>
                        暂无邮件
                      </p>
                      <p className="mt-1 text-[13px]">去注册网站收一封测试邮件吧</p>
                    </div>
                  </div>
                ) : mailTab === "sent" && sent.length === 0 ? (
                  <div className="card-group mt-2">
                    <div className="empty-state py-8">
                      <div className="icon">
                        <Icon name="send" size={44} strokeWidth={1.5} />
                      </div>
                      <p className="text-[16px] font-semibold" style={{ color: "var(--fg-secondary)" }}>
                        暂无发送记录
                      </p>
                      <p className="mt-1 text-[13px]">该地址还没有发过信</p>
                    </div>
                  </div>
                ) : (
                  <MotionList className="mt-2 space-y-2">
                    {mailTab === "inbox"
                      ? mails.map((m) => {
                          const head = mailHead(m);
                          return (
                          <div key={m.id} className="card-group">
                            <button className="card-row w-full justify-between text-left" onClick={() => setDetail(detail?.id === m.id ? null : m)}>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
                                  {head.subject || "（无主题）"}
                                </p>
                                <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                                  {head.from || "未知发件人"} · {formatTime(m.created_at)}
                                </p>
                              </div>
                              <span className="ml-2 shrink-0 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                                {detail?.id === m.id ? "收起" : "展开"}
                              </span>
                            </button>
                            {detail?.id === m.id && (
                              <div className="border-t px-5 py-4" style={{ borderColor: "var(--separator)" }}>
                                {head.ext && (
                                  <div className="mb-3">
                                    <p className="mono mb-1 text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--accent)" }}>
                                      {head.ext.type === "auth_code" ? "验证码" : head.ext.type}
                                    </p>
                                    <p className="mono break-all text-[22px]" style={{ color: "var(--accent)" }}>
                                      {head.ext.result}
                                    </p>
                                  </div>
                                )}
                                <pre className="xumi-mono max-h-64 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                                  {m.raw || "（无正文）"}
                                </pre>
                                <div className="mt-3 flex items-center gap-2">
                                  <button onClick={() => copy(m.raw || "", "报文已复制")} className="pressable rounded-full px-3 py-1 text-[12px]" style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}>
                                    复制报文
                                  </button>
                                  <button onClick={() => deleteMail(m.id)} className="pressable rounded-full px-3 py-1 text-[12px]" style={{ background: "rgba(229,72,77,.1)", color: "var(--red)" }}>
                                    删除
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })
                      : sent.map((s) => {
                          const body = mailsBody(s);
                          return (
                            <div key={s.id} className="card-group">
                              <div className="card-row justify-between">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
                                    {body?.subject || "（无主题）"}
                                  </p>
                                  <p className="mt-0.5 truncate text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                                    → {body?.to_mail || "未知"} · {formatTime(s.created_at)}
                                  </p>
                                </div>
                                <button onClick={() => deleteSent(s.id)} className="pressable shrink-0 rounded-full px-3 py-1 text-[12px]" style={{ background: "rgba(229,72,77,.1)", color: "var(--red)" }}>
                                  删除
                                </button>
                              </div>
                            </div>
                          );
                        })}
                  </MotionList>
                )}
              </>
            )}
          </>
        )}
        <p className="mt-4 px-4 text-center text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
          深夜信号站 v1.0 · 用户中心
        </p>
      </main>
    </MotionPage>
  );
}
