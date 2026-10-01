import Link from "next/link";

export default function HomePage() {
  return (
    <main
      className="overflow-hidden"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg,#f2f2f7 0%,#ffffff 100%)",
      }}
    >
      {/* Hero */}
      <section className="relative px-6 pb-16 pt-16 text-center sm:pt-24">
        {/* 背景光斑 */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[480px] w-[720px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(10,132,255,0.25), rgba(94,92,230,0.18), transparent)",
          }}
        />

        <div className="relative">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] text-5xl shadow-2xl shadow-blue-500/40">
            📬
          </div>
          <h1 className="large-title mt-8" style={{ color: "var(--fg)" }}>
            Xumi Mail
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[17px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
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

          {/* 特性 */}
          <div className="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: "⚡", title: "秒级收信", desc: "邮件到达即刻解析，验证码自动提取" },
              { icon: "🛡️", title: "隐私安全", desc: "收件自动清理，不追踪不记录" },
              { icon: "🎯", title: "随机隔离", desc: "每个账号独立地址，防追踪防垃圾" },
            ].map((f) => (
              <div
                key={f.title}
                className="rounded-3xl bg-white/80 p-5 text-center shadow-sm backdrop-blur"
                style={{ border: "0.5px solid var(--separator)" }}
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-2 text-[15px] font-semibold" style={{ color: "var(--fg)" }}>
                  {f.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
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