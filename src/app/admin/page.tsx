"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import { EmptyState, GroupLabel, FormRow, LoadingButton, Segmented, Switch, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api, formatTime, tokenStore, extractSender } from "@/lib/client";

type Tab = "stats" | "mails" | "addresses" | "users" | "settings";

export default function AdminPage() {
  const { push } = useToast();
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<any>(null);
  const [mails, setMails] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [cleanup, setCleanup] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

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
        <main className="mx-auto max-w-sm px-4 pb-16 pt-16 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#5856d6] to-[#af52de] text-4xl shadow-lg shadow-purple-500/30">
            🛡️
          </div>
          <h1 className="large-title mt-6">管理员</h1>
          <p className="mt-2 text-[14px]" style={{ color: "var(--fg-secondary)" }}>
            输入站点配置的 ADMIN_PASSWORDS 密码
          </p>
          <div className="mt-6 space-y-3">
            <input
              type="password"
              value={adminPwd}
              onChange={(e) => setAdminPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="管理密码"
              className="ios-input"
            />
            <button onClick={login} className="btn-primary w-full">
              登录
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-3 py-4 md:px-4 md:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <h1 className="large-title">管理后台</h1>
            <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
              系统状态与运维
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Segmented
              value={tab}
              onChange={(v) => setTab(v)}
              options={[
                { value: "stats", label: "统计" },
                { value: "mails", label: "邮件" },
                { value: "addresses", label: "地址" },
                { value: "users", label: "用户" },
                { value: "settings", label: "清理" },
              ]}
            />
            <button
              onClick={() => {
                tokenStore.clearAdmin();
                setAdminAuthed(false);
              }}
              className="pressable rounded-full px-3 py-1.5 text-[13px] font-medium"
              style={{ background: "var(--fill)", color: "var(--red)" }}
            >
              退出
            </button>
          </div>
        </div>

        {loading && (
          <div className="mt-6 flex justify-center">
            <Spinner size={28} />
          </div>
        )}

        {tab === "stats" && stats && <StatsView stats={stats} />}
        {tab === "mails" && (
          <MailsView
            mails={mails}
            query={query}
            setQuery={setQuery}
            onSearch={async () => {
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
            onDelete={async (id) => {
              try {
                await api.adminDeleteMail(id);
                setMails((prev) => prev.filter((m) => m.id !== id));
                push("success", "已删除");
              } catch (e) {
                push("error", (e as Error).message);
              }
            }}
          />
        )}
        {tab === "addresses" && (
          <AddressesAdmin
            addresses={addresses}
            onRefresh={async () => {
              const a = await api.adminAddresses({ limit: 50, offset: 0 });
              setAddresses(a.results || []);
            }}
          />
        )}
        {tab === "users" && (
          <UsersView
            users={users}
            onDelete={async (id) => {
              if (!window.confirm("确认删除该用户？")) return;
              try {
                await api.adminDeleteUser(id);
                setUsers((prev) => prev.filter((u) => u.id !== id));
                push("success", "已删除");
              } catch (e) {
                push("error", (e as Error).message);
              }
            }}
          />
        )}
        {tab === "settings" && cleanup && (
          <CleanupView
            cleanup={cleanup}
            onSave={async (body) => {
              try {
                await api.saveAdminAutoCleanup(body);
                push("success", "已保存");
                setCleanup(await api.adminAutoCleanup());
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

/* ---------- 统计 ---------- */
function StatsView({ stats }: { stats: any }) {
  const items = [
    { label: "地址数", value: stats.address, icon: "📧", color: "#007aff" },
    { label: "邮件总数", value: stats.mail, icon: "📨", color: "#34c759" },
    { label: "今日邮件", value: stats.todayMail, icon: "🔥", color: "#ff9500" },
    { label: "用户数", value: stats.user, icon: "👤", color: "#af52de" },
    { label: "已发送", value: stats.sent, icon: "📤", color: "#5ac8fa" },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="card-group p-4">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[18px] text-white"
            style={{ background: item.color }}
          >
            {item.icon}
          </span>
          <p className="mt-3 text-[28px] font-bold tabular-nums" style={{ color: "var(--fg)" }}>
            {item.value}
          </p>
          <p className="text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ---------- 邮件管理 ---------- */
function MailsView({
  mails,
  query,
  setQuery,
  onSearch,
  onDelete,
}: {
  mails: any[];
  query: string;
  setQuery: (v: string) => void;
  onSearch: () => void;
  onDelete: (id: number) => void;
}) {
  return (
    <>
      <div className="card-group mt-5 flex items-center gap-2 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          placeholder="按收件地址筛选"
          className="ios-input"
        />
        <button onClick={onSearch} className="pressable shrink-0 rounded-xl px-4 py-2.5 text-[15px] font-medium text-white" style={{ background: "var(--accent)" }}>
          筛选
        </button>
      </div>
      <div className="card-group mt-3">
        {mails.length === 0 ? (
          <EmptyState icon="📭" title="暂无邮件" />
        ) : (
          <ul>
            {mails.map((mail) => {
              const sender = extractSender(mail.source || "");
              return (
                <li key={mail.id} className="card-row">
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                    style={{ background: "#5856d6" }}
                  >
                    {(sender.name || sender.email || "?").charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                      {(sender.name || sender.email) + " → " + mail.address}
                    </p>
                    <p className="truncate text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                      {formatTime(mail.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(mail.id)}
                    className="pressable flex h-8 w-8 items-center justify-center rounded-full text-[14px]"
                    style={{ background: "var(--fill)" }}
                  >
                    🗑️
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/* ---------- 地址管理 ---------- */
function AddressesAdmin({ addresses, onRefresh }: { addresses: any[]; onRefresh: () => void }) {
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
    <>
      <div className="card-group mt-5 flex items-center gap-2 p-3">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新地址前缀（如 abc）"
          className="ios-input"
        />
        <LoadingButton loading={creating} onClick={create} className="pressable shrink-0 rounded-xl px-4 py-2.5 text-[15px] font-medium text-white" style={{ background: "var(--accent)" }}>
          创建
        </LoadingButton>
      </div>
      <div className="card-group mt-3">
        {addresses.length === 0 ? (
          <EmptyState icon="📧" title="暂无地址" />
        ) : (
          <ul>
            {addresses.map((addr) => (
              <li key={addr.id} className="card-row">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                  style={{ background: "#007aff" }}
                >
                  {addr.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                    {addr.name}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                    {formatTime(addr.created_at)} · {addr.mail_count || 0} 封
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
                  className="pressable flex h-8 w-8 items-center justify-center rounded-full text-[14px]"
                  style={{ background: "var(--fill)" }}
                >
                  🗑️
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/* ---------- 用户管理 ---------- */
function UsersView({ users, onDelete }: { users: any[]; onDelete: (id: number) => void }) {
  return (
    <div className="card-group mt-5">
      {users.length === 0 ? (
        <EmptyState icon="👤" title="暂无用户" />
      ) : (
        <ul>
          {users.map((user) => (
            <li key={user.id} className="card-row">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
                style={{ background: "linear-gradient(135deg,#af52de,#5856d6)" }}
              >
                {user.user_email?.charAt(0)?.toUpperCase() || "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                  {user.user_email}
                </p>
                <p className="text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                  {formatTime(user.created_at)} · 绑定 {user.address_count || 0} 个地址
                  {user.role ? ` · ${user.role}` : ""}
                </p>
              </div>
              <button
                onClick={() => onDelete(user.id)}
                className="pressable flex h-8 w-8 items-center justify-center rounded-full text-[14px]"
                style={{ background: "var(--fill)" }}
              >
                🗑️
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- 清理设置 ---------- */
function CleanupView({
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

  const rows = [
    { key: "enableMailsAutoCleanup", label: "自动清理邮件", daysKey: "cleanMailsDays" },
    { key: "enableUnknowMailsAutoCleanup", label: "清理未知地址邮件", daysKey: "cleanUnknowMailsDays" },
    { key: "enableSendBoxAutoCleanup", label: "清理发件箱", daysKey: "cleanSendBoxDays" },
    { key: "enableAddressAutoCleanup", label: "清理超期地址", daysKey: "cleanAddressDays" },
    { key: "enableInactiveAddressAutoCleanup", label: "清理不活跃地址", daysKey: "cleanInactiveAddressDays" },
    { key: "enableUnboundAddressAutoCleanup", label: "清理未绑定地址", daysKey: "cleanUnboundAddressDays" },
    { key: "enableEmptyAddressAutoCleanup", label: "清理空地址", daysKey: "cleanEmptyAddressDays" },
  ];

  return (
    <>
      <GroupLabel>自动清理（每小时 cron 检查）</GroupLabel>
      <div className="card-group">
        {rows.map((row) => (
          <div key={row.key} className="card-row justify-between">
            <span className="flex-1 text-[15px]" style={{ color: "var(--fg)" }}>
              {row.label}
            </span>
            <input
              type="number"
              min={1}
              max={1000}
              value={form?.[row.daysKey] ?? 7}
              onChange={(e) => set(row.daysKey, parseInt(e.target.value) || 7)}
              disabled={!form?.[row.key]}
              className="w-16 rounded-lg px-2 py-1 text-center text-[14px] outline-none disabled:opacity-40"
              style={{ background: "var(--bg-tertiary)", color: "var(--fg)" }}
            />
            <span className="w-7 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              天
            </span>
            <Switch checked={!!form?.[row.key]} onChange={(v) => set(row.key, v)} />
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <button onClick={() => onSave(form)} className="btn-primary flex-1">
          保存设置
        </button>
        <button onClick={() => onClean("mails", 1)} className="btn-secondary flex-1">
          手动清理 1 天前邮件
        </button>
      </div>
    </>
  );
}