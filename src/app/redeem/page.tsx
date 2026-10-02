"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { EmptyState, LoadingButton, Segmented, useCopy } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useToast } from "@/components/Toast";
import { useAddressToken, useSettings } from "@/hooks/useSettings";
import { api } from "@/lib/client";

type RedeemResult = {
  success: boolean;
  type?: string;
  role?: string;
  user_email?: string;
  address?: string;
  amount?: number;
  balance?: number;
  address_id?: number;
  jwt?: string;
  password?: string | null;
};

export default function RedeemPage() {
  const { push } = useToast();
  const copy = useCopy();
  const { settings } = useSettings();
  const { token, set: setToken } = useAddressToken();

  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState("");
  const [targetUser, setTargetUser] = useState("");
  const [targetAddress, setTargetAddress] = useState("");
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [randomSub, setRandomSub] = useState(false);

  // 预填地址
  useEffect(() => {
    if (!token) return;
    api
      .addressSettings()
      .then((s) => setTargetAddress(s.address))
      .catch(() => {});
  }, [token]);

  // 默认域名
  useEffect(() => {
    if (settings && settings.domains.length > 0 && !domain) {
      setDomain(settings.domains[0].value);
    }
  }, [settings, domain]);

  // 兑换
  const redeem = async () => {
    if (!code.trim()) {
      push("error", "请输入兑换码");
      return;
    }
    setRedeeming(true);
    setError("");
    setResult(null);
    try {
      const res = await api.redeem({
        code: code.trim(),
        user_email: targetUser.trim() || undefined,
        address: targetAddress.trim() || undefined,
        name: name.trim() || undefined,
        domain: domain || undefined,
        enableRandomSubdomain: randomSub,
      });
      setResult(res);
      // 地址前缀兑换会返回新的 jwt，直接登录
      if (res.jwt) {
        setToken(res.jwt);
        push("success", "兑换成功，已切换邮箱");
      } else {
        push("success", "兑换成功");
      }
    } catch (e) {
      setError((e as Error).message);
      push("error", (e as Error).message);
    } finally {
      setRedeeming(false);
    }
  };

  const enabled = !!settings?.enableRedeemCode;

  if (!enabled) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="mx-auto max-w-md px-4 py-20 text-center" style={{ color: "var(--fg-secondary)" }}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: "var(--fill)" }}>
            <Icon name="ticket" size={28} />
          </div>
          <p className="mt-4 text-[16px]">兑换码功能未开启</p>
        </div>
      </div>
    );
  }

  const resultMeta =
    result?.type === "role" && result.role
      ? { icon: "shield-check" as const, label: "角色", text: result.role }
      : result?.type === "send_balance" && result.amount
        ? { icon: "send" as const, label: "发信余额", text: `+${result.amount}（当前 ${result.balance ?? "?"}）` }
        : result?.address
          ? { icon: "at-sign" as const, label: "邮箱地址", text: result.address }
          : null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-6">
        <h1 className="large-title">兑换码</h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--fg-tertiary)" }}>
          输入兑换码，领取发信余额、角色或专属邮箱地址
        </p>

        <div className="card-group mt-5 p-5">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--fg-tertiary)" }}>
            兑换码
          </p>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setResult(null);
              setError("");
            }}
            placeholder="输入兑换码"
            className="ios-input"
          />

          {/* 按类型填写附加信息 */}
          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                用户账号（角色兑换）
              </p>
              <input
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                placeholder="要授予角色的用户名（可留空使用已登录账号）"
                className="ios-input"
              />
            </div>
            <div>
              <p className="mb-1 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                目标地址（余额兑换）
              </p>
              <input
                value={targetAddress}
                onChange={(e) => setTargetAddress(e.target.value)}
                placeholder="要充值的邮箱地址"
                className="ios-input"
              />
            </div>

            {/* 地址前缀兑换：自定义名 + 域名 + 随机子域 */}
            <div>
              <p className="mb-1 text-[12px]" style={{ color: "var(--fg-tertiary)" }}>
                邮箱前缀（地址前缀兑换，可留空随机）
              </p>
              <div className="flex items-center gap-2 rounded-xl p-2" style={{ background: "var(--bg-tertiary)" }}>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="自定义后缀（可留空）"
                  className="flex-1 bg-transparent px-2 py-2 text-[15px] outline-none"
                  style={{ color: "var(--fg)" }}
                />
                <span className="text-[15px]" style={{ color: "var(--fg-tertiary)" }}>@</span>
                <select
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="bg-transparent px-2 py-2 text-[14px] outline-none"
                  style={{ color: "var(--fg)" }}
                >
                  {settings?.domains.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              {(settings?.randomSubdomainDomains?.length ?? 0) > 0 && (
                <label className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: "var(--fg-secondary)" }}>
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
          </div>

          <LoadingButton loading={redeeming} onClick={redeem} className="btn-primary mt-5 w-full">
            兑换
          </LoadingButton>

          {/* 结果 */}
          {result && resultMeta && (
            <div className="mt-4 rounded-2xl p-4 fade-in" style={{ background: "rgba(0,168,118,0.1)", border: "0.5px solid rgba(0,168,118,0.3)" }}>
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: "var(--green)" }}>
                  <Icon name={resultMeta.icon} size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium uppercase tracking-wide" style={{ color: "var(--green)" }}>
                    {resultMeta.label}
                  </p>
                  <p className="truncate text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
                    {resultMeta.text}
                  </p>
                </div>
                {result.address && (
                  <button
                    onClick={() => copy(result.address!, "已复制")}
                    className="pressable flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium text-white"
                    style={{ background: "var(--green)" }}
                  >
                    <Icon name="copy" size={12} />
                    复制
                  </button>
                )}
              </div>
              {result.jwt && (
                <p className="mt-2 text-[12px]" style={{ color: "var(--green)" }}>
                  ✓ 已自动切换到此邮箱，可在收件箱查看
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-3 text-center text-[13px]" style={{ color: "var(--red)" }}>
              {error}
            </p>
          )}
        </div>
      </main>
      <div style={{ height: 40 }} />
    </div>
  );
}
