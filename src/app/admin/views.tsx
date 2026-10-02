"use client";

import { useCallback, useEffect, useState } from "react";
import { EmptyState, GroupLabel, Switch, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/client";

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