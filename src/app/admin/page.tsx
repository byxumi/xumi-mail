"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/Header";
import { EmptyState, GroupLabel, FormRow, LoadingButton, Segmented, Switch, Spinner, Avatar, ConfirmDialog } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { MotionPage, FadeUp } from "@/components/motion";
import { useToast } from "@/components/Toast";
import { api, formatTime, tokenStore, extractSender } from "@/lib/client";

type Tab = "stats" | "mails" | "addresses" | "users" | "redeem" | "sender" | "settings" | "db";

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
  const [confirmAction, setConfirmAction] = useState<null | { type: "delete-user" | "delete-address"; id?: number; name?: string }>(null);

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
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#00c08c] to-[#007a58] text-white shadow-lg shadow-emerald-500/30">
            <Icon name="shield" size={38} strokeWidth={1.7} />
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
    <MotionPage className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-5xl px-3 py-4 md:px-4 md:py-6">
        <div className="flex flex-wrap items-end justify-between gap-3 px-1">
          <div>
            <FadeUp>
              <h1 className="large-title">管理后台</h1>
              <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
                系统状态与运维
              </p>
            </FadeUp>
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
                { value: "redeem", label: "兑换码" },
                { value: "sender", label: "发信额度" },
                { value: "db", label: "数据库" },
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
            onDelete={(addr) => setConfirmAction({ type: "delete-address", id: addr.id, name: addr.name })}
          />
        )}
        {tab === "users" && (
          <UsersView
            users={users}
            onDelete={(u) => setConfirmAction({ type: "delete-user", id: u.id, name: u.user_email })}
          />
        )}
        {tab === "redeem" && <RedeemAdminView />}
        {tab === "sender" && <SenderAccessView />}
        {tab === "db" && <DatabaseView />}
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

      {/* 删除确认 */}
      <ConfirmDialog
        open={confirmAction?.type === "delete-user"}
        title="确认删除该用户？"
        message={confirmAction?.name ? `用户：${confirmAction.name}` : undefined}
        confirmText="删除"
        danger
        onConfirm={() => {
          if (confirmAction?.id != null) {
            void (async () => {
              try {
                await api.adminDeleteUser(confirmAction.id!);
                setUsers((prev) => prev.filter((u) => u.id !== confirmAction.id));
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
        open={confirmAction?.type === "delete-address"}
        title="确认删除该地址？"
        message={confirmAction?.name ? `地址：${confirmAction.name}` : undefined}
        confirmText="删除"
        danger
        onConfirm={() => {
          if (confirmAction?.id != null) {
            void (async () => {
              try {
                await api.adminDeleteAddress(confirmAction.id!);
                push("success", "已删除");
                const a = await api.adminAddresses({ limit: 50, offset: 0 });
                setAddresses(a.results || []);
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

/* ---------- 统计 ---------- */
function StatsView({ stats }: { stats: any }) {
  const items = [
    { label: "地址数", value: stats.addressCount, icon: "at-sign" as const, color: "#00a876" },
    { label: "邮件总数", value: stats.mailCount, icon: "inbox" as const, color: "#34c759" },
    { label: "7 日活跃地址", value: stats.activeAddressCount7days, icon: "flame" as const, color: "#ff9500" },
    { label: "30 日活跃地址", value: stats.activeAddressCount30days, icon: "users" as const, color: "#af52de" },
    { label: "已发送", value: stats.sendMailCount, icon: "send" as const, color: "#00c2a8" },
  ];
  return (
    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="card-group stat-card p-4">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
            style={{ background: item.color, boxShadow: `0 6px 16px ${item.color}44` }}
          >
            <Icon name={item.icon} size={19} strokeWidth={2} />
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
          <EmptyState iconName="inbox" title="暂无邮件" />
        ) : (
          <ul>
            {mails.map((mail) => {
              const sender = extractSender(mail.source || "");
              return (
                <li key={mail.id} className="card-row">
                  <Avatar text={sender.email || sender.name || "?"} size={36} />
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
                    <Icon name="trash" size={15} />
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
function AddressesAdmin({ addresses, onRefresh, onDelete }: { addresses: any[]; onRefresh: () => void; onDelete: (a: any) => void }) {
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
          <EmptyState iconName="at-sign" title="暂无地址" />
        ) : (
          <ul>
            {addresses.map((addr) => (
              <li key={addr.id} className="card-row">
                <Avatar text={addr.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                    {addr.name}
                  </p>
                  <p className="text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                    {formatTime(addr.created_at)} · {addr.mail_count || 0} 封
                  </p>
                </div>
                <button
                  onClick={() => onDelete(addr)}
                  className="pressable flex h-8 w-8 items-center justify-center rounded-full text-[14px]"
                  style={{ background: "var(--fill)" }}
                >
                  <Icon name="trash" size={15} />
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
function UsersView({ users, onDelete }: { users: any[]; onDelete: (u: any) => void }) {
  return (
    <div className="card-group mt-5">
      {users.length === 0 ? (
        <EmptyState iconName="users" title="暂无用户" />
      ) : (
        <ul>
          {users.map((user) => (
            <li key={user.id} className="card-row">
              <Avatar text={user.user_email || "?"} size={36} />
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
                onClick={() => onDelete(user)}
                className="pressable flex h-8 w-8 items-center justify-center rounded-full text-[14px]"
                style={{ background: "var(--fill)" }}
              >
                <Icon name="trash" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- 兑换码管理 ---------- */
type RedeemTypeKey = "role" | "send_balance" | "address_prefix_once";

const REDEEM_TYPE_LABELS: Record<RedeemTypeKey, string> = {
  role: "角色",
  send_balance: "发信余额",
  address_prefix_once: "地址前缀",
};

const REDEEM_TYPE_HINTS: Record<RedeemTypeKey, string> = {
  role: "输入角色名（需在 USER_ROLES 中配置）",
  send_balance: "输入发信余额数量（如 100）",
  address_prefix_once: "输入地址前缀（如 vip）",
};

function RedeemAdminView() {
  const { push } = useToast();
  const [type, setType] = useState<RedeemTypeKey>("send_balance");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [count, setCount] = useState(1);
  const [value, setValue] = useState("");
  const [expiresHours, setExpiresHours] = useState(168); // 7 天
  const [enabled, setEnabled] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (t: RedeemTypeKey = type) => {
      setLoading(true);
      try {
        const res = await api.adminRedeemCodes({ redeem_type: t, limit: 50, offset: 0, query: query || undefined });
        setList(res.results || []);
      } catch (e) {
        push("error", (e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, query, push]
  );

  useEffect(() => {
    void load(type);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const create = async () => {
    if (!value.trim()) {
      push("error", "请填写兑换值");
      return;
    }
    setCreating(true);
    try {
      const expiresAt = new Date(Date.now() + expiresHours * 3600_000).toISOString();
      const res = await api.adminCreateRedeemCodes({
        count,
        redeem_type: type,
        value: value.trim(),
        enabled,
        expires_at: expiresAt,
      });
      push("success", `已创建 ${res.created} 个兑换码`);
      setValue("");
      await load(type);
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.adminDeleteRedeemCode(id);
      push("success", "已删除");
      await load(type);
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  return (
    <>
      {/* 创建表单 */}
      <div className="card-group mt-5 p-5">
        <div className="segmented w-full">
          {(Object.keys(REDEEM_TYPE_LABELS) as RedeemTypeKey[]).map((t) => (
            <button
              key={t}
              className={type === t ? "active flex-1" : "flex-1"}
              onClick={() => setType(t)}
            >
              {REDEEM_TYPE_LABELS[t]}
            </button>
          ))}
        </div>

        <p className="mb-1 mt-4 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
          {REDEEM_TYPE_HINTS[type]}
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="兑换值"
          className="ios-input"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              生成数量
            </p>
            <input
              type="number"
              min={1}
              max={500}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(500, parseInt(e.target.value) || 1)))}
              className="ios-input"
            />
          </div>
          <div>
            <p className="mb-1 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              有效期（小时）
            </p>
            <input
              type="number"
              min={1}
              value={expiresHours}
              onChange={(e) => setExpiresHours(parseInt(e.target.value) || 168)}
              className="ios-input"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[14px]" style={{ color: "var(--fg-secondary)" }}>
            启用
          </span>
          <Switch checked={enabled} onChange={setEnabled} />
        </div>

        <LoadingButton loading={creating} onClick={create} className="btn-primary mt-4 w-full">
          生成兑换码
        </LoadingButton>
      </div>

      {/* 列表 */}
      <GroupLabel>兑换码列表（{REDEEM_TYPE_LABELS[type]}）</GroupLabel>
      <div className="card-group mt-1">
        <div className="p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void load(type)}
            placeholder="搜索兑换码…"
            className="ios-input"
          />
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner size={26} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState iconName="ticket" title="暂无兑换码" />
        ) : (
          <ul>
            {list.map((row) => {
              const result = typeof row.result === "string" ? safeParseJson(row.result) : row.result;
              return (
                <li key={row.id} className="card-row">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ background: row.redeemed ? "var(--fg-tertiary)" : "var(--green)" }}>
                    <Icon name={row.redeemed ? "check-circle" : "ticket"} size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold" style={{ color: "var(--fg)" }}>
                      {row.code}
                    </p>
                    <p className="truncate text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                      {row.redeemed ? `已兑换 ${formatTime(row.redeemed_at || row.created_at)}` : `未兑换 · 过期 ${formatTime(row.expires_at)}`}
                      {result?.address ? ` · ${result.address}` : result?.user_email ? ` · ${result.user_email}` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      background: row.redeemed ? "var(--fill)" : row.enabled ? "rgba(52,199,89,0.15)" : "var(--fill)",
                      color: row.redeemed ? "var(--fg-secondary)" : row.enabled ? "var(--green)" : "var(--fg-tertiary)",
                    }}
                  >
                    {row.redeemed ? "已用" : row.enabled ? "可用" : "禁用"}
                  </span>
                  <button
                    onClick={() => void remove(row.id)}
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
        )}
      </div>
    </>
  );
}

function safeParseJson(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* ---------- 清理设置 ---------- */
/* ---------- 发信额度管理 ---------- */
function SenderAccessView() {
  const { push } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<null | { id: number; address: string; balance: string; enabled: boolean }>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminSenderAccess({ limit: 50, offset: 0, address: query || undefined });
      setList(res.results || []);
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, push]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!editing) return;
    const balance = parseInt(editing.balance) || 0;
    try {
      await api.adminUpdateSenderAccess({
        address_id: editing.id,
        balance,
        enabled: editing.enabled ? 1 : 0,
      });
      push("success", "已更新");
      setEditing(null);
      await load();
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  return (
    <>
      <div className="card-group mt-5 flex items-center gap-2 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void load()}
          placeholder="按地址筛选"
          className="ios-input"
        />
        <button onClick={() => void load()} className="pressable shrink-0 rounded-xl px-4 py-2.5 text-[15px] font-medium text-white" style={{ background: "var(--accent)" }}>
          筛选
        </button>
      </div>

      <div className="card-group mt-3">
        {loading && list.length === 0 ? (
          <div className="flex justify-center p-6">
            <Spinner size={24} />
          </div>
        ) : list.length === 0 ? (
          <EmptyState iconName="zap" title="暂无发信额度记录" description="用户申请发信权限后会出现在这里" />
        ) : (
          <ul>
            {list.map((row) => (
              <li key={row.id} className="card-row">
                {editing && editing.id === row.id ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                        {row.address}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={editing.balance}
                          onChange={(e) => setEditing({ ...editing, balance: e.target.value })}
                          className="w-20 rounded-lg px-2 py-1 text-[13px] outline-none"
                          style={{ background: "var(--bg-tertiary)", color: "var(--fg)" }}
                        />
                        <Switch checked={editing.enabled} onChange={(v) => setEditing({ ...editing, enabled: v })} />
                      </div>
                    </div>
                    <button onClick={() => void save()} className="pressable rounded-full px-3 py-1 text-[13px] font-medium text-white" style={{ background: "var(--accent)" }}>
                      保存
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="pressable rounded-full px-3 py-1 text-[13px]"
                      style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                        {row.address}
                      </p>
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                        余额 {row.balance ?? 0} · {row.enabled ? "已启用" : "未启用"} · {formatTime(row.created_at)}
                      </p>
                    </div>
                    <span
                      className="mr-2 shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium"
                      style={{
                        background: row.enabled && (row.balance ?? 0) > 0 ? "rgba(0,168,118,0.12)" : "var(--fill)",
                        color: row.enabled && (row.balance ?? 0) > 0 ? "var(--accent)" : "var(--fg-secondary)",
                      }}
                    >
                      {row.enabled && (row.balance ?? 0) > 0 ? "可发信" : "不可发信"}
                    </span>
                    <button
                      onClick={() => setEditing({ id: row.id, address: row.address, balance: String(row.balance ?? 0), enabled: !!row.enabled })}
                      className="pressable flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ background: "var(--fill)" }}
                      title="编辑"
                    >
                      <Icon name="sliders" size={15} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function DatabaseView() {
  const { push } = useToast();
  const [info, setInfo] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<string>("free");
  const [savingPlan, setSavingPlan] = useState(false);

  const PLANS = [
    { value: "free", label: "免费计划", limit: 500 * 1024 ** 2 },
    { value: "paid", label: "付费计划", limit: 10 * 1024 ** 3 },
  ];

  const load = useCallback(async () => {
    try {
      const [versionRes, configRes] = await Promise.all([
        api.adminDbVersion(),
        api.adminConfigGet("d1_storage_plan"),
      ]);
      setInfo(versionRes);
      if (configRes?.value === "free" || configRes?.value === "paid") {
        setPlan(configRes.value);
      }
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (action: "init" | "migrate") => {
    setBusy(true);
    try {
      if (action === "init") await api.adminDbInitialize();
      else await api.adminDbMigration();
      push("success", action === "init" ? "数据库初始化完成" : "数据库迁移完成");
      await load();
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const savePlan = async (value: string) => {
    setSavingPlan(true);
    try {
      await api.adminConfigSave("d1_storage_plan", value);
      setPlan(value);
      push("success", "存储计划已保存");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSavingPlan(false);
    }
  };

  const planDetail = PLANS.find((p) => p.value === plan);
  const size = info?.database_size ?? null;
  const usagePct = size != null && planDetail ? Math.min((size / planDetail.limit) * 100, 100) : 0;

  return (
    <>
      <div className="card-group mt-5">
        {info?.need_initialization && (
          <div className="card-row justify-between border-b" style={{ borderColor: "var(--separator)" }}>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold" style={{ color: "var(--red)" }}>
                数据库尚未初始化
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                首次部署需要执行初始化以创建数据表
              </p>
            </div>
            <button
              onClick={() => void run("init")}
              disabled={busy}
              className="pressable shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white"
              style={{ background: "var(--accent)" }}
            >
              {busy ? "执行中…" : "初始化"}
            </button>
          </div>
        )}
        {info?.need_migration && (
          <div className="card-row justify-between border-b" style={{ borderColor: "var(--separator)" }}>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold" style={{ color: "var(--amber, #f5a623)" }}>
                数据库需要迁移
              </p>
              <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                当前版本 {info?.current_db_version || "未知"} → 代码版本 {info?.code_db_version}
              </p>
            </div>
            <button
              onClick={() => void run("migrate")}
              disabled={busy}
              className="pressable shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold text-white"
              style={{ background: "var(--amber, #f5a623)" }}
            >
              {busy ? "执行中…" : "迁移"}
            </button>
          </div>
        )}
        <div className="card-row justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
              数据库版本
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              当前 {info?.current_db_version || "未知"} · 代码 {info?.code_db_version || "未知"}
            </p>
          </div>
          <span
            className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium"
            style={{
              background: !info?.need_migration ? "rgba(0,168,118,0.12)" : "rgba(229,72,77,.1)",
              color: !info?.need_migration ? "var(--accent)" : "var(--red)",
            }}
          >
            {!info?.need_migration ? "已就绪" : "需迁移"}
          </span>
        </div>
      </div>

      {/* 存储计划 */}
      <GroupLabel>存储计划</GroupLabel>
      <div className="card-group">
        <div className="card-row justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
              当前计划
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              {planDetail ? planDetail.label : "未设置"} · 单库上限{" "}
              {planDetail ? formatBytesStatic(planDetail.limit) : "—"}
            </p>
          </div>
          <div className="segmented">
            {PLANS.map((p) => (
              <button
                key={p.value}
                className={plan === p.value ? "active" : ""}
                disabled={savingPlan}
                onClick={() => void savePlan(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        {size != null && planDetail && (
          <div className="px-5 pb-4">
            <div className="mb-1.5 flex items-center justify-between text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
              <span>当前数据库大小</span>
              <span>{formatBytesStatic(size)} · {usagePct.toFixed(2)}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--fill)" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${usagePct}%`,
                  background:
                    usagePct >= 90 ? "var(--red)" : usagePct >= 75 ? "var(--amber, #f5a623)" : "var(--accent)",
                }}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function formatBytesStatic(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const v = bytes / 1024 ** i;
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

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