"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { LoadingButton } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings } from "@/hooks/useSettings";
import { api, sha256Hex, tokenStore } from "@/lib/client";

export default function AccountPage() {
  const { push } = useToast();
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
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  // 用户
  const [userEmail, setUserEmail] = useState("");
  const [userPwd, setUserPwd] = useState("");
  const [loginMode, setLoginMode] = useState<"login" | "register">("login");
  const [userBusy, setUserBusy] = useState(false);

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
      setOldPwd("");
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
      if (loginMode === "login") {
        const res = await api.login({ user_email: userEmail.trim(), password: userPwd });
        tokenStore.setUser(res.jwt);
        push("success", `欢迎回来，${res.user_email}`);
      } else {
        const res = await api.register({ user_email: userEmail.trim(), password: userPwd });
        tokenStore.setUser(res.jwt);
        push("success", `注册成功，${res.user_email}`);
      }
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setUserBusy(false);
    }
  };

  const deleteAddress = async () => {
    if (!window.confirm(`确认删除地址 ${address}？其所有邮件将一并删除，不可恢复。`)) return;
    try {
      await api.deleteAddress();
      clear();
      push("success", "地址已删除");
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <h1 className="text-xl font-bold text-slate-900">账号设置</h1>

        {token ? (
          <div className="mt-5 space-y-6">
            {/* 当前地址 */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-800">当前地址</h2>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-medium text-blue-600">{address}</p>
                  <p className="mt-0.5 text-sm text-slate-500">发信余额：{sendBalance}</p>
                </div>
                <button
                  onClick={deleteAddress}
                  className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
                >
                  删除地址
                </button>
              </div>
            </section>

            {/* 地址密码 */}
            {settings?.enableAddressPassword && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-base font-semibold text-slate-800">地址密码</h2>
                <p className="mt-1 text-xs text-slate-500">
                  设置密码后，可通过邮箱地址 + 密码在任意设备登录查看收件。
                </p>
                <div className="mt-3 space-y-2">
                  <input
                    type="password"
                    value={oldPwd}
                    onChange={(e) => setOldPwd(e.target.value)}
                    placeholder="原密码（留空则直接设置）"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="新密码"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <LoadingButton
                    loading={changingPwd}
                    onClick={changePassword}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    更新密码
                  </LoadingButton>
                </div>
              </section>
            )}

            {/* 自动回复 */}
            {settings?.enableAutoReply && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">自动回复</h2>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={autoEnabled}
                      onChange={(e) => setAutoEnabled(e.target.checked)}
                    />
                    启用
                  </label>
                </div>
                <div className="mt-3 space-y-2">
                  <input
                    value={autoSourcePrefix}
                    onChange={(e) => setAutoSourcePrefix(e.target.value)}
                    placeholder="来源前缀过滤（如 /@example\\.com$/ 或留空回复所有）"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={autoSubject}
                    onChange={(e) => setAutoSubject(e.target.value)}
                    placeholder="回复主题（默认 Auto-reply）"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <textarea
                    value={autoMessage}
                    onChange={(e) => setAutoMessage(e.target.value)}
                    rows={3}
                    placeholder="回复内容"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={saveAutoReply}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    保存
                  </button>
                </div>
              </section>
            )}

            {/* Webhook */}
            {settings?.enableWebhook && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">Webhook 通知</h2>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={whEnabled}
                      onChange={(e) => setWhEnabled(e.target.checked)}
                    />
                    启用
                  </label>
                </div>
                <div className="mt-3 space-y-2">
                  <input
                    value={whUrl}
                    onChange={(e) => setWhUrl(e.target.value)}
                    placeholder="https://example.com/hook"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={saveWebhook}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                  >
                    保存
                  </button>
                </div>
              </section>
            )}
          </div>
        ) : (
          <p className="mt-5 text-slate-500">请先创建邮箱地址。</p>
        )}

        {/* 用户账号（可选） */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-800">用户账号（可选）</h2>
          <p className="mt-1 text-xs text-slate-500">
            注册后可将邮箱地址绑定到账号统一管理（临时邮箱本身无需登录）。
          </p>
          <div className="mt-3 flex gap-2 text-sm">
            <button
              onClick={() => setLoginMode("login")}
              className={`rounded-lg px-3 py-1.5 ${loginMode === "login" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              登录
            </button>
            <button
              onClick={() => setLoginMode("register")}
              className={`rounded-lg px-3 py-1.5 ${loginMode === "register" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              注册
            </button>
          </div>
          <div className="mt-3 space-y-2">
            <input
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="用户名"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="password"
              value={userPwd}
              onChange={(e) => setUserPwd(e.target.value)}
              placeholder="密码"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <LoadingButton
              loading={userBusy}
              onClick={submitUser}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white hover:bg-slate-700"
            >
              {loginMode === "login" ? "登录" : "注册"}
            </LoadingButton>
          </div>
        </section>
      </main>
    </div>
  );
}