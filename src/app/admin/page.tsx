"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import { EmptyState, LoadingButton, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, formatTime, tokenStore, extractSender, MailRowDTO } from "@/lib/client";

export default function AdminPage() {
  const { push } = useToast();
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");
  const [tab, setTab] = useState<"stats" | "mails" | "addresses" | "users" | "settings">("stats");
  const [stats, setStats] = useState<any>(null);
  const [mails, setMails] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [cleanup, setCleanup] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  // 检查是否已保存管理密码
  useEffect(() => {
    if (tokenStore.getAdmin()) {
      setAdminAuthed(true);
      void loadAll();
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, a, u, c] = await Promise.all([
        api.adminStatistics(),
        api.adminMails({ limit: 50, offset: 0 }),
        api.adminAddresses({ limit: 50, offset: 0 }),
        api.adminUsers({ limit: 50, offset: 0 }),
        api.adminAutoCleanup(),
      ]);
      setStats(s);
      setMails(m.results || []);
      setAddresses(a.results || []);
      setUsers(u.results || []);
      setCleanup(c);
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [push]);

  const login = async () => {
    if (!adminPwd) {
      push("error", "请输入管理密码");
      return;
    }
    // 直接尝试拉取统计数据验证密码
    tokenStore.setAdmin(adminPwd);
    try {
      await api.adminStatistics();
      setAdminAuthed(true);
      push("success", "管理员验证通过");
      await loadAll();
    } catch (e) {
      tokenStore.clearAdmin();
      push("error", (e as Error).message);
    }
  };

  if (!adminAuthed) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-sm px-4 py-24">
          <h1 className="text-center text-xl font-bold text-slate-900">管理员登录</h1>
          <p className="mt-2 text-center text-sm text-slate-500">
            输入站点配置的 ADMIN_PASSWORDS 中的任意一个密码
          </p>
          <div className="mt-6 space-y-3">
            <input
              type="password"
              value={adminPwd}
              onChange={(e) => setAdminPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="管理密码"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              onClick={login}
              className="w-full rounded-lg bg-slate-800 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "stats", label: "统计" },
    { id: "mails", label: "邮件" },
    { id: "addresses", label: "地址" },
    { id: "users", label: "用户" },
    { id: "settings", label: "清理设置" },
  ] as const;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900">管理后台</h1>
          <button
            onClick={() => {
              tokenStore.clearAdmin();
              setAdminAuthed(false);
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            退出
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                tab === t.id ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && <Spinner />}

        {tab === "stats" && stats && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "地址数", value: stats.address },
              { label: "邮件总数", value: stats.mail },
              { label: "今日邮件", value: stats.todayMail },
              { label: "用户数", value: stats.user },
              { label: "已发送", value: stats.sent },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                <p className="mt-1 text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "mails" && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-3">
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="按地址筛选（回车确认）"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      const res = await api.adminMails({ limit: 50, offset: 0, address: query || undefined });
                      setMails(res.results || []);
                    } catch (e) {
                      push("error", (e as Error).message);
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="rounded-lg bg-slate-800 px-4 py-1.5 text-sm text-white"
                >
                  筛选
                </button>
              </div>
            </div>
            <ul className="divide-y divide-slate-100">
              {mails.length === 0 ? (
                <div className="p-6"><EmptyState title="暂无邮件" /></div>
              ) : (
                mails.map((mail) => {
                  const sender = extractSender(mail.source || "");
                  return (
                    <li key={mail.id} className="flex items-center justify-between px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {sender.name || sender.email || mail.source} → {mail.address}
                        </p>
                        <p className="truncate text-xs text-slate-500">{formatTime(mail.created_at)}</p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await api.adminDeleteMail(mail.id);
                            setMails((prev) => prev.filter((m) => m.id !== mail.id));
                            push("success", "已删除");
                          } catch (e) {
                            push("error", (e as Error).message);
                          }
                        }}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        删除
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}

        {tab === "addresses" && (
          <AddressesTab
            addresses={addresses}
            onRefresh={async () => {
              setLoading(true);
              try {
                const a = await api.adminAddresses({ limit: 50, offset: 0 });
                setAddresses(a.results || []);
              } finally {
                setLoading(false);
              }
            }}
          />
        )}

        {tab === "users" && (
          <div className="rounded-xl border border-slate-200 bg-white">
            <ul className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <div className="p-6"><EmptyState title="暂无用户" /></div>
              ) : (
                users.map((user) => (
                  <li key={user.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{user.user_email}</p>
                      <p className="text-xs text-slate-500">
                        {formatTime(user.created_at)} · 绑定 {user.address_count} 个地址
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`确认删除用户 ${user.user_email}？`)) return;
                        try {
                          await api.adminDeleteUser(user.id);
                          setUsers((prev) => prev.filter((u) => u.id !== user.id));
                          push("success", "已删除");
                        } catch (e) {
                          push("error", (e as Error).message);
                        }
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      删除
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

        {tab === "settings" && cleanup && (
          <CleanupTab
            cleanup={cleanup}
            onSave={async (body) => {
              try {
                await api.saveAdminAutoCleanup(body);
                push("success", "已保存");
                const c = await api.adminAutoCleanup();
                setCleanup(c);
              } catch (e) {
                push("error", (e as Error).message);
              }
            }}
            onClean={async (cleanType, cleanDays) => {
              try {
                await api.adminCleanup({ cleanType, cleanDays });
                push("success", "清理完成");
                await loadAll();
              } catch (e) {
                push("error", (e as Error).message);
              }
            }}
          />
        )}
      </main>
    </div>
  );
}

function AddressesTab({ addresses, onRefresh }: { addresses: any[]; onRefresh: () => void }) {
  const { push } = useToast();
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!newName.trim()) {
      push("error", "请输入地址前缀");
      return;
    }
    setCreating(true);
    try {
      const res = await api.adminCreateAddress({ name: newName.trim() });
      push("success", `已创建 ${res.address}`);
      setNewName("");
      await onRefresh();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新地址前缀（如 abc）"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
        <LoadingButton
          loading={creating}
          onClick={create}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          创建
        </LoadingButton>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {addresses.length === 0 ? (
            <div className="p-6"><EmptyState title="暂无地址" /></div>
          ) : (
            addresses.map((addr) => (
              <li key={addr.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{addr.name}</p>
                  <p className="text-xs text-slate-500">
                    {formatTime(addr.created_at)} · 邮件 {addr.mail_count} 封
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!window.confirm(`确认删除地址 ${addr.name}？`)) return;
                    try {
                      await api.adminDeleteAddress(addr.id);
                      push("success", "已删除");
                      await onRefresh();
                    } catch (e) {
                      push("error", (e as Error).message);
                    }
                  }}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  删除
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

function CleanupTab({
  cleanup,
  onSave,
  onClean,
}: {
  cleanup: any;
  onSave: (body: any) => void;
  onClean: (type: string, days: number) => void;
}) {
  const [form, setForm] = useState<any>(cleanup);
  useEffect(() => setForm(cleanup), [cleanup]);

  const set = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      {[
        { key: "enableMailsAutoCleanup", label: "自动清理邮件", daysKey: "cleanMailsDays" },
        { key: "enableUnknowMailsAutoCleanup", label: "自动清理未知地址邮件", daysKey: "cleanUnknowMailsDays" },
        { key: "enableSendBoxAutoCleanup", label: "自动清理发件箱", daysKey: "cleanSendBoxDays" },
        { key: "enableAddressAutoCleanup", label: "自动清理超期地址", daysKey: "cleanAddressDays" },
        { key: "enableInactiveAddressAutoCleanup", label: "清理不活跃地址", daysKey: "cleanInactiveAddressDays" },
        { key: "enableUnboundAddressAutoCleanup", label: "清理未绑定地址", daysKey: "cleanUnboundAddressDays" },
        { key: "enableEmptyAddressAutoCleanup", label: "清理空地址", daysKey: "cleanEmptyAddressDays" },
      ].map(({ key, label, daysKey }) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={!!form?.[key]}
              onChange={(e) => set(key, e.target.checked)}
            />
            {label}
          </label>
          <input
            type="number"
            min={1}
            max={1000}
            value={form?.[daysKey] ?? 7}
            onChange={(e) => set(daysKey, parseInt(e.target.value) || 7)}
            disabled={!form?.[key]}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
          />
          <span className="w-8 text-xs text-slate-400">天</span>
        </div>
      ))}

      <div className="flex gap-2 border-t border-slate-100 pt-4">
        <button
          onClick={() => onSave(form)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          保存设置
        </button>
        <button
          onClick={() => onClean("mails", 1)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          手动清理 1 天前邮件
        </button>
      </div>
    </div>
  );
}