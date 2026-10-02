"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, GroupLabel, Switch, Spinner, Avatar } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { api, formatTime, extractSender } from "@/lib/client";

/* ---------- 通用小件 ---------- */

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex-1 text-[15px]" style={{ color: "var(--fg)" }}>
      {children}
    </span>
  );
}

function RowInput({
  value,
  onChange,
  placeholder,
  type = "text",
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mono?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-40 rounded-lg px-2.5 py-1.5 text-right text-[13px] outline-none focus:ring-2 focus:ring-[#00a876]/30"
      style={{
        background: "var(--bg-tertiary)",
        color: "var(--fg)",
        fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
      }}
    />
  );
}

function TextAreaRows({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={4}
      className="mt-1 w-full resize-y rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#00a876]/30"
      style={{ background: "var(--bg-tertiary)", color: "var(--fg)" }}
    />
  );
}

/** 文本行列表编辑器（textarea，每行一项） */
function LinesEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  return (
    <TextAreaRows
      value={value.join("\n")}
      onChange={(v) =>
        onChange(
          v
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        )
      }
      placeholder={placeholder}
    />
  );
}

function SaveBar({ onSave, saving, label = "保存设置" }: { onSave: () => void; saving?: boolean; label?: string }) {
  return (
    <div className="mt-4 flex justify-end">
      <button onClick={onSave} disabled={saving} className="btn-primary px-6">
        {saving ? "保存中…" : label}
      </button>
    </div>
  );
}

/* ---------- 用户设置 ---------- */

export function UserSettingsView() {
  const { push } = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      setForm(await api.adminUserSettings());
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAdminUserSettings(form);
      push("success", "用户设置已保存");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner />;

  return (
    <>
      <GroupLabel>用户设置</GroupLabel>
      <div className="card-group">
        <div className="card-row justify-between">
          <CardLabel>每个用户最大地址数</CardLabel>
          <RowInput
            type="number"
            value={String(form.maxAddressCount ?? 0)}
            onChange={(v) => set("maxAddressCount", parseInt(v) || 0)}
          />
        </div>
        <div className="card-row justify-between">
          <CardLabel>启用地址正则校验</CardLabel>
          <Switch checked={!!form.enableEmailCheckRegex} onChange={(v) => set("enableEmailCheckRegex", v)} />
        </div>
        {form.enableEmailCheckRegex && (
          <div className="card-row flex-col items-start">
            <CardLabel>{"地址正则（如 ^[a-z0-9_]{3,20}$）"}</CardLabel>
            <TextAreaRows
              value={form.emailCheckRegex || ""}
              onChange={(v) => set("emailCheckRegex", v)}
              placeholder="^[a-z0-9_]{3,20}$"
            />
          </div>
        )}
        <div className="card-row justify-between">
          <CardLabel>启用邮箱验证</CardLabel>
          <Switch checked={!!form.enableMailVerify} onChange={(v) => set("enableMailVerify", v)} />
        </div>
        {form.enableMailVerify && (
          <div className="card-row justify-between">
            <CardLabel>验证发件地址</CardLabel>
            <RowInput
              value={form.verifyMailSender || ""}
              onChange={(v) => set("verifyMailSender", v)}
              placeholder="verify@example.com"
            />
          </div>
        )}
        <div className="card-row justify-between">
          <CardLabel>允许用户创建地址</CardLabel>
          <Switch checked={form.enableAddressCreation !== false} onChange={(v) => set("enableAddressCreation", v)} />
        </div>
        <div className="card-row justify-between">
          <CardLabel>默认地址前缀</CardLabel>
          <RowInput value={form.defaultAddressPrefix || ""} onChange={(v) => set("defaultAddressPrefix", v)} placeholder="tmp" />
        </div>
      </div>
      <SaveBar onSave={save} saving={saving} />
    </>
  );
}

/* ---------- 账户/邮箱设置 ---------- */

export function AccountSettingsView() {
  const { push } = useToast();
  const [form, setForm] = useState<any>(null);
  const [rule, setRule] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.adminAccountSettings(), api.adminEmailRule()]);
      setForm(s);
      setRule(r);
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAdminAccountSettings(form);
      await api.saveAdminEmailRule(rule);
      push("success", "邮箱设置已保存");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!form || !rule) return <Spinner />;

  const listKeys: Array<{ key: string; label: string; ph: string }> = [
    { key: "blockList", label: "禁止收信地址", ph: "spam@example.com（每行一个）" },
    { key: "sendBlockList", label: "禁止发信地址", ph: "spam@example.com（每行一个）" },
    { key: "verifiedAddressList", label: "可信地址白名单", ph: "trusted@example.com" },
    { key: "noLimitSendAddressList", label: "免发信限制地址", ph: "vip@example.com" },
    { key: "fromBlockList", label: "发件人黑名单", ph: "blacklist@example.com" },
  ];

  return (
    <>
      <GroupLabel>邮箱设置</GroupLabel>
      <div className="card-group">
        <div className="card-row justify-between">
          <CardLabel>拒收未知地址邮件</CardLabel>
          <Switch
            checked={!!rule.blockReceiveUnknowAddressEmail}
            onChange={(v) => setRule({ ...rule, blockReceiveUnknowAddressEmail: v })}
          />
        </div>
        {listKeys.map((lk) => (
          <div key={lk.key} className="card-row flex-col items-start">
            <CardLabel>{lk.label}</CardLabel>
            <LinesEditor
              value={Array.isArray((form as any)[lk.key]) ? (form as any)[lk.key] : []}
              onChange={(v) => set(lk.key, v)}
              placeholder={lk.ph}
            />
          </div>
        ))}
      </div>
      <SaveBar onSave={save} saving={saving} />
    </>
  );
}

/* ---------- AI 提取设置 ---------- */

export function AiExtractView() {
  const { push } = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      setForm(await api.adminAiExtract());
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAdminAiExtract(form);
      push("success", "AI 提取设置已保存");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner />;

  return (
    <>
      <GroupLabel>AI 提取设置</GroupLabel>
      <div className="card-group">
        <div className="card-row justify-between">
          <CardLabel>启用白名单模式</CardLabel>
          <Switch checked={!!form.enableAllowList} onChange={(v) => set("enableAllowList", v)} />
        </div>
        {form.enableAllowList && (
          <div className="card-row flex-col items-start">
            <CardLabel>允许列表（AI 提取仅对以下发件人生效）</CardLabel>
            <LinesEditor
              value={Array.isArray(form.allowList) ? form.allowList : []}
              onChange={(v) => set("allowList", v)}
              placeholder="example@example.com（每行一个）"
            />
          </div>
        )}
      </div>
      <SaveBar onSave={save} saving={saving} />
    </>
  );
}

/* ---------- IP 黑名单设置 ---------- */

export function IpBlacklistView() {
  const { push } = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      setForm(await api.adminIpBlacklist());
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAdminIpBlacklist(form);
      push("success", "IP 黑名单已保存");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner />;

  const listKeys: Array<{ key: string; label: string; ph: string }> = [
    { key: "blacklist", label: "IP 黑名单", ph: "1.2.3.4 或 1.2.3.0/24（每行一个）" },
    { key: "asnBlacklist", label: "ASN 黑名单", ph: "AS13335（每行一个）" },
    { key: "fingerprintBlacklist", label: "设备指纹黑名单", ph: "fp_xxxx（每行一个）" },
    { key: "whitelist", label: "白名单", ph: "1.2.3.4（启用白名单时生效）" },
  ];

  return (
    <>
      <GroupLabel>IP 黑名单</GroupLabel>
      <div className="card-group">
        <div className="card-row justify-between">
          <CardLabel>启用 IP 黑名单</CardLabel>
          <Switch checked={!!form.enabled} onChange={(v) => set("enabled", v)} />
        </div>
        <div className="card-row justify-between">
          <CardLabel>启用白名单模式</CardLabel>
          <Switch checked={!!form.enableWhitelist} onChange={(v) => set("enableWhitelist", v)} />
        </div>
        <div className="card-row justify-between">
          <CardLabel>启用每日请求限制</CardLabel>
          <Switch checked={!!form.enableDailyLimit} onChange={(v) => set("enableDailyLimit", v)} />
        </div>
        {form.enableDailyLimit && (
          <div className="card-row justify-between">
            <CardLabel>每日请求上限</CardLabel>
            <RowInput
              type="number"
              value={String(form.dailyRequestLimit ?? 1000)}
              onChange={(v) => set("dailyRequestLimit", parseInt(v) || 1000)}
            />
          </div>
        )}
        {listKeys.map((lk) => (
          <div key={lk.key} className="card-row flex-col items-start">
            <CardLabel>{lk.label}</CardLabel>
            <LinesEditor
              value={Array.isArray(form[lk.key]) ? form[lk.key] : []}
              onChange={(v) => set(lk.key, v)}
              placeholder={lk.ph}
            />
          </div>
        ))}
      </div>
      <SaveBar onSave={save} saving={saving} />
    </>
  );
}

/* ---------- Webhook 设置 ---------- */

export function WebhookView() {
  const { push } = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      setForm(await api.adminWebhook());
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAdminWebhook(form);
      push("success", "Webhook 设置已保存");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) return <Spinner />;

  return (
    <>
      <GroupLabel>Webhook 全局设置</GroupLabel>
      <div className="card-group">
        <div className="card-row justify-between">
          <CardLabel>启用白名单模式</CardLabel>
          <Switch checked={!!form.enableAllowList} onChange={(v) => set("enableAllowList", v)} />
        </div>
        {form.enableAllowList && (
          <div className="card-row flex-col items-start">
            <CardLabel>允许列表（仅以下地址可注册 Webhook）</CardLabel>
            <LinesEditor
              value={Array.isArray(form.allowList) ? form.allowList : []}
              onChange={(v) => set("allowList", v)}
              placeholder="temp@example.com（每行一个）"
            />
          </div>
        )}
      </div>
      <SaveBar onSave={save} saving={saving} />
    </>
  );
}

/* ---------- 邮件 Webhook 设置 ---------- */

export function MailWebhookView() {
  const { push } = useToast();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const load = useCallback(async () => {
    try {
      setForm(await api.adminMailWebhook());
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAdminMailWebhook(form);
      push("success", "邮件 Webhook 已保存");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!form?.url) {
      push("info", "请先填写 Webhook URL");
      return;
    }
    setTesting(true);
    try {
      await api.adminMailWebhookTest(form);
      push("success", "测试消息已发送");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  if (!form) return <Spinner />;

  return (
    <>
      <GroupLabel>邮件 Webhook</GroupLabel>
      <div className="card-group">
        <div className="card-row justify-between">
          <CardLabel>启用邮件 Webhook</CardLabel>
          <Switch checked={!!form.enabled} onChange={(v) => set("enabled", v)} />
        </div>
        <div className="card-row justify-between">
          <CardLabel>请求方式</CardLabel>
          <div className="segmented">
            {["POST", "PUT", "PATCH"].map((m) => (
              <button key={m} className={(form.method || "POST") === m ? "active" : ""} onClick={() => set("method", m)}>
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="card-row flex-col items-start">
          <CardLabel>回调 URL</CardLabel>
          <TextAreaRows value={form.url || ""} onChange={(v) => set("url", v)} placeholder="https://example.com/hook" />
        </div>
        <div className="card-row flex-col items-start">
          <CardLabel>请求头（JSON）</CardLabel>
          <TextAreaRows
            value={form.headers || ""}
            onChange={(v) => set("headers", v)}
            placeholder='{"Authorization": "Bearer xxx"}'
          />
        </div>
        <div className="card-row flex-col items-start">
          <CardLabel>请求体（JSON）</CardLabel>
          <TextAreaRows value={form.body || ""} onChange={(v) => set("body", v)} placeholder='{"key": "value"}' />
        </div>
      </div>
      <div className="mt-4 flex gap-3">
        <button onClick={save} disabled={saving} className="btn-primary flex-1">
          {saving ? "保存中…" : "保存设置"}
        </button>
        <button onClick={test} disabled={testing} className="btn-secondary flex-1">
          {testing ? "发送中…" : "发送测试"}
        </button>
      </div>
    </>
  );
}

/* ---------- 角色地址配额 ---------- */

export function RoleAddressConfigView() {
  const { push } = useToast();
  const [configs, setConfigs] = useState<Record<string, { maxAddressCount?: number }> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.adminRoleAddressConfig();
      setConfigs(res?.configs || {});
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAdminRoleAddressConfig({ configs });
      push("success", "角色地址配额已保存");
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!configs) return <Spinner />;

  const roles = Object.keys(configs);

  return (
    <>
      <GroupLabel>角色地址配额（每角色可创建的地址数）</GroupLabel>
      <div className="card-group">
        {roles.length === 0 ? (
          <EmptyState iconName="users" title="暂未配置角色配额" description="保存角色配置后会显示在这里" />
        ) : (
          roles.map((role) => (
            <div key={role} className="card-row justify-between">
              <CardLabel>{role}</CardLabel>
              <div className="flex items-center gap-2">
                <RowInput
                  type="number"
                  value={String(configs[role]?.maxAddressCount ?? 0)}
                  onChange={(v) =>
                    setConfigs({ ...configs, [role]: { ...configs[role], maxAddressCount: parseInt(v) || 0 } })
                  }
                />
                <button
                  className="pressable rounded-full px-2.5 py-1 text-[12px] font-medium"
                  style={{ background: "var(--fill)", color: "var(--red)" }}
                  onClick={() => {
                    const next = { ...configs };
                    delete next[role];
                    setConfigs(next);
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <SaveBar onSave={save} saving={saving} />
    </>
  );
}
/** 未知地址邮件（未绑定地址收到的邮件）管理 */
export function UnknowMailsView() {
  const { push } = useToast();
  const [mails, setMails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.adminUnknowMails({ limit: 50, offset: 0 });
      setMails(res.results || []);
      setCount(res.count || 0);
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: number) => {
    try {
      await api.adminDeleteMail(id);
      push("success", "已删除");
      await load();
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  if (loading) return <Spinner />;
  return (
    <>
      <div className="mb-3 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
        共 {count} 封 · 未绑定地址收到的邮件，可手动删除
      </div>
      <div className="card-group">
        {mails.length === 0 ? (
          <EmptyState iconName="inbox" title="暂无未知邮件" description="没有收到未绑定地址的邮件" />
        ) : (
          <ul>
            {mails.map((mail: any) => {
              const sender = extractSender(mail.source || "");
              return (
                <li key={mail.id} className="card-row">
                  <Avatar text={sender.email || sender.name || "?"} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                      {(sender.name || sender.email || mail.from) + " → " + mail.address}
                    </p>
                    <p className="truncate text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                      {formatTime(mail.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(mail.id)}
                    className="pressable flex h-8 w-8 items-center justify-center rounded-full text-[14px]"
                    style={{ background: "var(--fill)", color: "var(--red)" }}
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

/** 已发送邮件管理（SendBox） */
export function SendBoxAdminView() {
  const { push } = useToast();
  const [sent, setSent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState("");

  const load = useCallback(
    async (q?: string) => {
      setLoading(true);
      try {
        const res = await api.adminSendbox({ limit: 50, offset: 0, address: q || undefined });
        setSent(res.results || []);
        setCount(res.count || 0);
      } catch (e) {
        push("error", (e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [push]
  );

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: number) => {
    try {
      await api.adminDeleteSendbox(id);
      push("success", "已删除");
      await load();
    } catch (e) {
      push("error", (e as Error).message);
    }
  };

  if (loading) return <Spinner />;
  return (
    <>
      <div className="card-group mt-5 flex items-center gap-2 p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(query)}
          placeholder="按发件地址筛选"
          className="ios-input"
        />
        <button
          onClick={() => load(query)}
          className="pressable shrink-0 rounded-xl px-4 py-2.5 text-[15px] font-medium text-white"
          style={{ background: "var(--accent)" }}
        >
          筛选
        </button>
      </div>
      <div className="mt-3 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
        共 {count} 封
      </div>
      <div className="card-group mt-3">
        {sent.length === 0 ? (
          <EmptyState iconName="send" title="暂无已发送邮件" />
        ) : (
          <ul>
            {sent.map((item) => (
              <li key={item.id} className="card-row">
                <Avatar text={item.address || "?"} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                    {item.subject || "(无主题)"} → {item.to_mail || ""}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                    {item.address} · {formatTime(item.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => remove(item.id)}
                  className="pressable flex h-8 w-8 items-center justify-center rounded-full text-[14px]"
                  style={{ background: "var(--fill)", color: "var(--red)" }}
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

/** 手动发信（SendMail）——对齐上游 SendMail.vue 精简版 */
export function SendMailAdminView() {
  const { push } = useToast();
  const [form, setForm] = useState({
    fromName: "",
    fromMail: "",
    toName: "",
    toMail: "",
    subject: "",
    contentType: "text",
    content: "",
  });
  const [sending, setSending] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const send = async () => {
    const fromMail = form.fromMail.trim();
    const toMail = form.toMail.trim();
    const subject = form.subject.trim();
    const content = form.content;
    if (!fromMail) return push("error", "请填写发件地址");
    if (!subject) return push("error", "请填写主题");
    if (!toMail) return push("error", "请填写收件地址");
    if (!content.trim()) return push("error", "请填写内容");
    setSending(true);
    try {
      await api.adminSendMail({
        from_name: form.fromName,
        from_mail: fromMail,
        to_name: form.toName,
        to_mail: toMail,
        subject,
        is_html: form.contentType !== "text",
        content,
      });
      push("success", "发送成功");
      setForm({ ...form, fromName: "", fromMail: "", toName: "", toMail: "", subject: "", contentType: "text", content: "" });
      setIsPreview(false);
    } catch (e) {
      push("error", (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>手动发信</h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
          以指定地址发送一封邮件（无需登录该地址）
        </p>
      </div>
      <div className="card-group space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <CardLabel>发件地址</CardLabel>
            <RowInput
              type="text"
              value={form.fromMail}
              onChange={(v) => setForm({ ...form, fromMail: v })}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <CardLabel>发件人名称</CardLabel>
            <RowInput
              type="text"
              value={form.fromName}
              onChange={(v) => setForm({ ...form, fromName: v })}
              placeholder="可选"
            />
          </div>
          <div>
            <CardLabel>收件地址</CardLabel>
            <RowInput
              type="text"
              value={form.toMail}
              onChange={(v) => setForm({ ...form, toMail: v })}
              placeholder="target@example.com"
            />
          </div>
          <div>
            <CardLabel>收件人名称</CardLabel>
            <RowInput
              type="text"
              value={form.toName}
              onChange={(v) => setForm({ ...form, toName: v })}
              placeholder="可选"
            />
          </div>
        </div>
        <div>
          <CardLabel>主题</CardLabel>
          <RowInput
            type="text"
            value={form.subject}
            onChange={(v) => setForm({ ...form, subject: v })}
            placeholder="邮件主题"
          />
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <CardLabel>内容</CardLabel>
            <div className="flex items-center gap-2">
              <div className="segmented">
                {(["text", "html", "rich"] as const).map((ct) => (
                  <button
                    key={ct}
                    className={form.contentType === ct ? "active" : ""}
                    onClick={() => {
                      setForm({ ...form, contentType: ct });
                      setIsPreview(false);
                    }}
                  >
                    {ct === "text" ? "文本" : ct === "html" ? "HTML" : "富文本"}
                  </button>
                ))}
              </div>
              {form.contentType !== "text" && (
                <button
                  className="pressable rounded-full px-3 py-1 text-[12px] font-medium"
                  style={{ background: "var(--fill)" }}
                  onClick={() => setIsPreview(!isPreview)}
                >
                  {isPreview ? "编辑" : "预览"}
                </button>
              )}
            </div>
          </div>
          {isPreview && form.contentType !== "text" ? (
            <div
              className="mail-content rounded-xl border p-4"
              style={{ borderColor: "rgba(128,128,128,0.2)", minHeight: 220 }}
              dangerouslySetInnerHTML={{ __html: form.content }}
            />
          ) : (
            <textarea
              rows={10}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder={form.contentType === "rich" ? "富文本模式（HTML 标签）" : "邮件内容"}
              className="w-full rounded-xl p-3 text-[14px] leading-relaxed"
              style={{ background: "var(--bg-tertiary)", color: "var(--fg)", minHeight: 220 }}
            />
          )}
        </div>
        <div className="flex justify-end">
          <button
            onClick={send}
            disabled={sending}
            className="pressable rounded-xl px-6 py-2.5 text-[15px] font-medium text-white"
            style={{ background: "var(--accent)", opacity: sending ? 0.6 : 1 }}
          >
            {sending ? "发送中…" : "发送"}
          </button>
        </div>
      </div>
    </>
  );
}

/** Worker 配置一览（只读展示） */
export function WorkerConfigView() {
  const { push } = useToast();
  const [cfg, setCfg] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setCfg(await api.adminWorkerConfigs());
    } catch (e) {
      push("error", (e as Error).message);
    }
  }, [push]);

  useEffect(() => {
    load();
  }, [load]);

  if (!cfg) return <Spinner />;

  const rows: Array<{ label: string; value: any; mono?: boolean }> = [
    { label: "站点标题", value: cfg.TITLE },
    { label: "默认语言", value: cfg.DEFAULT_LANG },
    { label: "公告", value: cfg.ANNOUNCEMENT },
    { label: "始终显示公告", value: cfg.ALWAYS_SHOW_ANNOUNCEMENT ? "是" : "否" },
    { label: "地址前缀", value: cfg.PREFIX },
    { label: "地址校验正则", value: cfg.ADDRESS_CHECK_REGEX, mono: true },
    { label: "地址正则", value: cfg.ADDRESS_REGEX, mono: true },
    { label: "地址最小长度", value: cfg.MIN_ADDRESS_LEN },
    { label: "地址最大长度", value: cfg.MAX_ADDRESS_LEN },
    { label: "默认域名", value: cfg.DEFAULT_DOMAINS?.join(", ") },
    { label: "全部域名", value: cfg.DOMAINS?.join(", ") },
    { label: "转发地址列表", value: cfg.FORWARD_ADDRESS_LIST?.join(", ") },
    { label: "子域名转发列表", value: cfg.SUBDOMAIN_FORWARD_ADDRESS_LIST?.join(", ") },
    { label: "开启子域名匹配", value: cfg.ENABLE_CREATE_ADDRESS_SUBDOMAIN_MATCH ? "是" : "否" },
    { label: "站点密码", value: cfg.HAS_PASSWORD ? "已设置" : "未设置" },
    { label: "管理密码", value: cfg.HAS_ADMIN_PASSWORDS ? "已设置" : "未设置" },
  ];

  return (
    <>
      <div className="mb-4">
        <h2 className="text-[18px] font-bold" style={{ color: "var(--fg)" }}>Worker 配置</h2>
        <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
          当前 Worker 环境变量一览（只读）
        </p>
      </div>
      <div className="card-group">
        {rows.map((r) => (
          <div key={r.label} className="card-row justify-between">
            <span className="text-[14px]" style={{ color: "var(--fg-tertiary)" }}>{r.label}</span>
            <span
              className="max-w-[60%] truncate text-right text-[13px]"
              style={{ color: "var(--fg)", fontFamily: r.mono ? "var(--font-mono)" : undefined }}
            >
              {r.value === "" || r.value == null ? "—" : String(r.value)}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
