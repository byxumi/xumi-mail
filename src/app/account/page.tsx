"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { GroupLabel, FormRow, LoadingButton, Switch, useCopy, ConfirmDialog } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { MotionPage, FadeUp } from "@/components/motion";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings } from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { api, sha256Hex, tokenStore } from "@/lib/client";

export default function AccountPage() {
  const { push } = useToast();
  const copy = useCopy();
  const { theme, pureDark, setTheme, setPureDark } = useTheme();
  const { settings } = useSettings();
  const { token, clear } = useAddressToken();

  const [address, setAddress] = useState("");
  const [sendBalance, setSendBalance] = useState(0);

  // 自动回复
  const [autoReply, setAutoReply] = useState<any | null>(null);
  const [autoSubject, setAutoSubject] = useState("");
  const [autoMessage, setAutoMessage] = useState("");
  const [autoSourcePrefix, setAutoSourcePrefix] = useState("");
  const [autoEnabled, setAutoEnabled] = useState(false);

  // webhook
  const [webhook, setWebhook] = useState<any | null>(null);
  const [whUrl, setWhUrl] = useState("");
  const [whEnabled, setWhEnabled] = useState(false);

  // 地址密码
  const [newPwd, setNewPwd] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  // 用户
  const [userEmail, setUserEmail] = useState("");
  const [userPwd, setUserPwd] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [userBusy, setUserBusy] = useState(false);
  const [userLoggedIn, setUserLoggedIn] = useState(false);

  // 面板展开
  const [showAutoReply, setShowAutoReply] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .addressSettings()
      .then((s) => {
        setAddress(s.address);
        setSendBalance(s.send_balance);
      })
      .catch(() => {});
    if (settings?.enableAutoReply) {
      api
        .autoReply()
        .then((r) => {
          if (r) {
            setAutoReply(r);
            setAutoSubject(r.subject || "");
            setAutoMessage(r.message || "");
            setAutoSourcePrefix(r.source_prefix || "");
            setAutoEnabled(r.enabled !== 0);
          }
        })
        .catch(() => {});
    }
    if (settings?.enableWebhook) {
      api
        .webhookSettings()
        .then((r) => {
          setWebhook(r);
          setWhUrl(r?.url || "");
          setWhEnabled(r?.enabled === true);
        })
        .catch(() => {});
    }
    setUserLoggedIn(!!tokenStore.getUser());
  }, [token, settings]);

  const saveAutoReply = async () => {
    try {
      await api.saveAutoReply({
        source_prefix: autoSourcePrefix,
        subject: autoSubject,
        message: autoMessage,
        enabled: autoEnabled,
      });
      push("success", "自动回复已保存");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  const saveWebhook = async () => {
    try {
      await api.saveWebhookSettings({
        ...(webhook || {}),
        url: whUrl,
        enabled: whEnabled,
        method: webhook?.method || "POST",
        headers: webhook?.headers || "{}",
        body: webhook?.body || "mail received: ${subject}",
      });
      push("success", "Webhook 已保存");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  const changePassword = async () => {
    if (!newPwd) {
      push("error", "请填写新密码");
      return;
    }
    setChangingPwd(true);
    try {
      const hashed = await sha256Hex(newPwd);
      await api.changePassword({ new_password: hashed });
      push("success", "密码已更新");
      setNewPwd("");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setChangingPwd(false);
    }
  };

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
      push("success", loginMode === "login" ? `欢迎回来，${res.user_email}` : `注册成功，${res.user_email}`);
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setUserBusy(false);
    }
  };

  const deleteAddress = async () => {
    try {
      await api.deleteAddress();
      clear();
      push("success", "地址已删除");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  return (
    <MotionPage className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <FadeUp>
          <h1 className="large-title">账号</h1>
          <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
            须弥邮箱设置
          </p>
        </FadeUp>

        {token ? (
          <>
            {/* 当前地址 */}
            <GroupLabel>当前地址</GroupLabel>
            <div className="card-group">
              <div className="card-row justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold" style={{ color: "var(--accent)" }}>
                    {address}
                  </p>
                  <p className="mt-0.5 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                    发信余额 {sendBalance}
                  </p>
                </div>
                <button
                  onClick={() => copy(address, "地址已复制")}
                  className="pressable rounded-full px-4 py-1.5 text-[13px] font-semibold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--accent-bright) 0%, var(--accent) 60%, var(--accent-deep) 100%)",
                    boxShadow: "0 2px 8px rgba(0,168,118,0.35)",
                  }}
                >
                  复制
                </button>
              </div>
            </div>

            {/* 进阶功能 */}
            <GroupLabel>邮箱功能</GroupLabel>
            <div className="card-group">
              {settings?.enableAddressPassword && (
                <FormRow iconName="key" label="地址密码" onClick={() => setShowPwd((v) => !v)} />
              )}
              {settings?.enableAutoReply && (
                <FormRow iconName="bot" label="自动回复" onClick={() => setShowAutoReply((v) => !v)} />
              )}
              {settings?.enableWebhook && (
                <FormRow iconName="webhook" label="Webhook 通知" onClick={() => setShowWebhook((v) => !v)} />
              )}
              <FormRow iconName="user" label="用户账号" onClick={() => setShowUser((v) => !v)} />
            </div>

            {/* 外观设置 */}
            <GroupLabel>外观</GroupLabel>
            <div className="card-group">
              <div className="card-row justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--fill)", color: "var(--accent)" }}>
                    <Icon name="palette" size={15} />
                  </span>
                  <span className="text-[16px]" style={{ color: "var(--fg)" }}>
                    主题
                  </span>
                </div>
                <div className="segmented">
                  {(
                    [
                      { v: "system", label: "跟随系统" },
                      { v: "light", label: "浅色" },
                      { v: "dark", label: "深色" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      className={theme === o.v ? "active" : ""}
                      onClick={() => setTheme(o.v)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="card-row justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--fill)", color: "var(--accent)" }}>
                    <Icon name="moon" size={15} />
                  </span>
                  <span className="flex-1 text-[16px]" style={{ color: "var(--fg)" }}>
                    纯黑 OLED 模式
                  </span>
                </div>
                <Switch checked={pureDark} onChange={setPureDark} />
              </div>
            </div>

            {/* 地址密码面板 */}
            {settings?.enableAddressPassword && showPwd && (
              <div className="card-group mt-2 fade-in">
                <div className="p-5">
                  <p className="mb-3 text-[13px]" style={{ color: "var(--fg-secondary)" }}>
                    设置密码后，可用「邮箱地址 + 密码」在任意设备登录查看收件。
                  </p>
                  <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="新密码"
                    className="ios-input"
                  />
                  <LoadingButton loading={changingPwd} onClick={changePassword} className="btn-primary mt-3 w-full">
                    更新密码
                  </LoadingButton>
                </div>
              </div>
            )}

            {/* 自动回复面板 */}
            {settings?.enableAutoReply && showAutoReply && (
              <div className="card-group mt-2 fade-in">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-medium" style={{ color: "var(--fg)" }}>
                      启用自动回复
                    </span>
                    <Switch checked={autoEnabled} onChange={setAutoEnabled} />
                  </div>
                  <input
                    value={autoSourcePrefix}
                    onChange={(e) => setAutoSourcePrefix(e.target.value)}
                    placeholder="来源过滤（如 /@example\\.com$/ 或留空全部）"
                    className="ios-input mt-3"
                  />
                  <input
                    value={autoSubject}
                    onChange={(e) => setAutoSubject(e.target.value)}
                    placeholder="回复主题（默认 Auto-reply）"
                    className="ios-input mt-2"
                  />
                  <textarea
                    value={autoMessage}
                    onChange={(e) => setAutoMessage(e.target.value)}
                    rows={3}
                    placeholder="回复内容"
                    className="ios-input mt-2 resize-none"
                  />
                  <button onClick={saveAutoReply} className="btn-primary mt-3 w-full">
                    保存自动回复
                  </button>
                </div>
              </div>
            )}

            {/* Webhook 面板 */}
            {settings?.enableWebhook && showWebhook && (
              <div className="card-group mt-2 fade-in">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-[16px] font-medium" style={{ color: "var(--fg)" }}>
                      启用 Webhook
                    </span>
                    <Switch checked={whEnabled} onChange={setWhEnabled} />
                  </div>
                  <input
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    placeholder="https://example.com/hook"
                    className="ios-input mt-3"
                  />
                  <button onClick={saveWebhook} className="btn-primary mt-3 w-full">
                    保存 Webhook
                  </button>
                </div>
              </div>
            )}

            {/* 用户账号面板 */}
            {showUser && (
              <div className="card-group mt-2 fade-in">
                <div className="p-5">
                  {userLoggedIn ? (
                    <div className="text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--fill)", color: "var(--accent)" }}>
                        <Icon name="user" size={28} />
                      </div>
                      <p className="mt-2 text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
                        {tokenStore.getUser() ? "已登录" : "未登录"}
                      </p>
                      <button
                        onClick={() => {
                          tokenStore.clearUser();
                          setUserLoggedIn(false);
                          push("success", "已退出用户账号");
                        }}
                        className="btn-secondary mt-4 w-full"
                      >
                        退出用户账号
                      </button>
                      <Link href="/user" className="btn-secondary mt-2 w-full">
                        进入用户中心
                      </Link>
                    </div>
                  ) : (
                    <>
                      <p className="mb-3 text-[13px]" style={{ color: "var(--fg-secondary)" }}>
                        注册后可将邮箱地址绑定到账号统一管理（临时邮箱本身无需登录）。
                      </p>
                      <div className="segmented w-full">
                        <button
                          className={loginMode === "login" ? "active flex-1" : "flex-1"}
                          onClick={() => setLoginMode("login")}
                        >
                          登录
                        </button>
                        <button
                          className={loginMode === "register" ? "active flex-1" : "flex-1"}
                          onClick={() => setLoginMode("register")}
                        >
                          注册
                        </button>
                      </div>
                      <input
                        value={userEmail}
                        onChange={(e) => setUserEmail(e.target.value)}
                        placeholder="用户名"
                        className="ios-input mt-3"
                      />
                      <input
                        type="password"
                        value={userPwd}
                        onChange={(e) => setUserPwd(e.target.value)}
                        placeholder="密码"
                        className="ios-input mt-2"
                      />
                      <LoadingButton loading={userBusy} onClick={submitUser} className="btn-primary mt-3 w-full">
                        {loginMode === "login" ? "登录" : "注册"}
                      </LoadingButton>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* 危险区 */}
            <GroupLabel>账户操作</GroupLabel>
            <div className="card-group">
              <FormRow
                danger
                iconName="trash"
                label="删除当前地址"
                onClick={() => setConfirmDelete(true)}
              />
            </div>
            {/* 删除确认弹窗 */}
            <ConfirmDialog
              open={confirmDelete}
              title="删除当前地址？"
              message={`地址 ${address} 及其所有邮件将被永久删除，不可恢复。`}
              confirmText="删除"
              danger
              onConfirm={() => {
                setConfirmDelete(false);
                void deleteAddress();
              }}
              onCancel={() => setConfirmDelete(false)}
            />
            <p className="mt-4 px-4 text-center text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              须弥邮箱 v1.0 · 数据存储在 Cloudflare
            </p>
          </>
        ) : (
          <div className="card-group mt-6">
            <div className="empty-state">
              <div className="icon">
                <Icon name="mail" size={56} strokeWidth={1.5} />
              </div>
              <p className="text-[17px] font-semibold" style={{ color: "var(--fg-secondary)" }}>
                尚未创建邮箱地址
              </p>
              <p className="mt-1 text-[14px]">请先到收件箱创建一个临时邮箱</p>
            </div>
          </div>
        )}
      </main>
    </MotionPage>
  );
}