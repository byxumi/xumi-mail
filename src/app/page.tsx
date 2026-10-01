import Link from "next/link";
import { Zap, ShieldCheck, Target, KeyRound, Gift, Send, Hash, Inbox, Trash2, Mail, Plus } from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "秒级收信", desc: "邮件到达即刻解析，验证码自动提取" },
  { icon: ShieldCheck, title: "隐私安全", desc: "收件自动清理，不追踪不记录" },
  { icon: Target, title: "随机隔离", desc: "每个账号独立地址，防追踪防垃圾" },
  { icon: KeyRound, title: "密码登录", desc: "邮箱地址绑定密码，多设备随时查看" },
  { icon: Gift, title: "完全免费", desc: "基于 Cloudflare 零成本运行，无广告" },
  { icon: Send, title: "临时发件", desc: "一键发送测试邮件，发件箱自动留存" },
];

const STEPS = [
  { no: "01", icon: Hash, title: "创建地址", desc: "随机前缀或自定义，一键生成专属临时邮箱" },
  { no: "02", icon: Inbox, title: "收取邮件", desc: "验证码、链接自动提取高亮，15 秒自动刷新" },
  { no: "03", icon: Trash2, title: "用完即弃", desc: "无需注册，随时清空或删除，隐私不留痕" },
];

const DOMAINS = ["xumimail.click", "xumimail.help"];

const FAQS = [
  {
    q: "收不到邮件怎么办？",
    a: "请确认发送方已投递到您创建的完整地址（@ 后为 xumimail.click 或 xumimail.help），并等待 15 秒自动刷新；部分网站会拦截临时邮箱，可换一个地址重试。",
  },
  {
    q: "邮件会被保存多久？",
    a: "邮件默认保留 7 天，随后由定时任务自动清理；您也可以随时手动清空收件箱或删除地址。",
  },
  {
    q: "需要注册吗？",
    a: "完全不需要。创建地址即得即用，token 保存在本地浏览器；如需跨设备查看，可为地址设置密码后登录。",
  },
  {
    q: "可以收发邮件吗？",
    a: "收信开箱即用；发信功能由管理员按需开启（Resend / SMTP 通道），开启后可在「发件」页使用。",
  },
];

export default function HomePage() {
  return (
    <main className="overflow-hidden" style={{ minHeight: "100vh" }}>
      {/* Hero */}
      <section className="relative px-6 pb-14 pt-16 text-center sm:pt-24">
        {/* 背景光斑 */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(10,132,255,0.28), rgba(94,92,230,0.2), transparent)",
          }}
        />

        <div className="relative mx-auto max-w-3xl">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] text-white shadow-2xl shadow-blue-500/40">
            <Mail size={48} strokeWidth={1.6} />
          </div>

          <h1 className="large-title mt-8" style={{ color: "var(--fg)" }}>
            Xumi Mail
          </h1>

          <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
            免费、安全、即开即用的临时邮箱。
            <br />
            收验证码、防骚扰、保护隐私，用完即弃。
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/mail"
              className="btn-primary w-64 text-center text-[17px]"
              style={{ boxShadow: "0 10px 30px rgba(0,122,255,0.35)" }}
            >
              立即创建邮箱
            </Link>
          </div>

          {/* 域名标签 */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {DOMAINS.map((d) => (
              <span
                key={d}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium"
                style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
              >
                <Mail size={13} />
                {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* 特性 */}
      <section className="mx-auto max-w-4xl px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-3xl p-5 text-left shadow-sm backdrop-blur"
              style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--separator)" }}
            >
              <div
                className="flex h-11 w-11 items-center justify-center rounded-[14px]"
                style={{ background: "var(--fill)", color: "var(--accent)" }}
              >
                <f.icon size={22} strokeWidth={1.8} />
              </div>
              <h3 className="mt-3 text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
                {f.title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 使用步骤 */}
      <section className="mx-auto mt-16 max-w-4xl px-6">
        <h2 className="text-center text-[26px] font-bold tracking-tight" style={{ color: "var(--fg)" }}>
          三步开始使用
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.no}
              className="relative rounded-3xl p-5"
              style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--separator)" }}
            >
              <span className="text-[12px] font-bold tracking-widest" style={{ color: "var(--accent)" }}>
                {s.no}
              </span>
              <div className="mt-2" style={{ color: "var(--accent)" }}>
                <s.icon size={30} strokeWidth={1.8} />
              </div>
              <h3 className="mt-2 text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
                {s.title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-16 max-w-2xl px-6">
        <h2 className="text-center text-[26px] font-bold tracking-tight" style={{ color: "var(--fg)" }}>
          常见问题
        </h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl p-5"
              style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--separator)" }}
            >
              <summary
                className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold"
                style={{ color: "var(--fg)" }}
              >
                {f.q}
                <Plus
                  className="shrink-0 transition-transform duration-200 group-open:rotate-45"
                  size={16}
                  style={{ color: "var(--fg-tertiary)" }}
                />
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="mx-auto mt-16 max-w-2xl px-6 pb-8 text-center">
        <div
          className="rounded-[28px] p-8 sm:p-10"
          style={{
            background: "linear-gradient(135deg, rgba(10,132,255,0.12), rgba(94,92,230,0.14))",
            border: "0.5px solid var(--separator)",
          }}
        >
          <h2 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--fg)" }}>
            现在就开始保护你的隐私
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
            无需注册，10 秒内创建你的第一个临时邮箱地址
          </p>
          <Link
            href="/mail"
            className="btn-primary mt-6 inline-block min-w-[220px] text-center"
            style={{ boxShadow: "0 10px 30px rgba(0,122,255,0.35)" }}
          >
            免费创建临时邮箱
          </Link>
        </div>
      </section>

      {/* 底部 */}
      <footer
        className="border-t pb-8 pt-6 text-center text-[13px]"
        style={{ borderColor: "var(--separator)", color: "var(--fg-tertiary)" }}
      >
        Xumi Mail · 基于 Cloudflare Workers 构建 · 免费使用
      </footer>
    </main>
  );
}