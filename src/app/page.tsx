"use client";

import Link from "next/link";
import { Zap, ShieldCheck, Target, KeyRound, Gift, Send, Hash, Inbox, Trash2, Mail, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { spring, springSoft, LogoPop, FadeUp, MotionList, MotionItem, HoverCard } from "@/components/motion";
import { useState } from "react";

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
        {/* 背景光斑（缓慢浮动） */}
        <motion.div
          className="pointer-events-none absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          animate={{ y: [0, -16, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(0,224,138,0.26), rgba(0,168,118,0.16), transparent)",
          }}
        />

        <div className="relative mx-auto max-w-3xl">
          <LogoPop>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-512.png"
              alt="深夜信号站"
              width={96}
              height={96}
              className="mx-auto h-24 w-24 rounded-[28px] object-cover shadow-[0_20px_60px_rgba(0,168,118,0.30)]"
            />
          </LogoPop>

          <motion.p
            className="mono mt-8 text-[12px] font-semibold tracking-[0.18em]"
            style={{ color: "var(--accent)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.08 }}
          >
            XUMI MAIL · NIGHT SIGNAL STATION
          </motion.p>

          <motion.h1
            className="large-title mt-2"
            style={{ color: "var(--fg)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.12 }}
          >
            深夜信号站
          </motion.h1>

          <motion.p
            className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed"
            style={{ color: "var(--fg-secondary)" }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.22 }}
          >
            免费、安全、即开即用的临时邮箱。
            <br />
            收验证码、防骚扰、保护隐私，用完即弃。
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSoft, delay: 0.32 }}
          >
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={spring}>
              <Link
                href="/mail"
                className="btn-primary w-64 text-center text-[17px]"
                style={{ boxShadow: "0 10px 30px rgba(0,168,118,0.35)" }}
              >
                立即创建邮箱
              </Link>
            </motion.div>
          </motion.div>

          {/* 域名标签 */}
          <motion.div
            className="mt-6 flex flex-wrap items-center justify-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.5 }}
          >
            {DOMAINS.map((d) => (
              <motion.span
                key={d}
                className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium"
                style={{ background: "var(--fill)", color: "var(--fg-secondary)" }}
                whileHover={{ scale: 1.06, y: -1 }}
                transition={spring}
              >
                <Mail size={13} />
                {d}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* 特性 */}
      <section className="mx-auto max-w-4xl px-6">
        <MotionList className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" gap={0}>
          {FEATURES.map((f) => (
            <MotionItem key={f.title}>
              <HoverCard
                className="rounded-3xl p-5 text-left shadow-sm backdrop-blur"
                style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--separator)" }}
              >
                <motion.div
                  className="flex h-11 w-11 items-center justify-center rounded-[14px]"
                  style={{ background: "var(--fill)", color: "var(--accent)" }}
                  whileHover={{ rotate: -6, scale: 1.08 }}
                  transition={spring}
                >
                  <f.icon size={22} strokeWidth={1.8} />
                </motion.div>
                <h3 className="mt-3 text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
                  {f.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                  {f.desc}
                </p>
              </HoverCard>
            </MotionItem>
          ))}
        </MotionList>
      </section>

      {/* 使用步骤 */}
      <section className="mx-auto mt-16 max-w-4xl px-6">
        <FadeUp>
          <h2 className="text-center text-[26px] font-bold tracking-tight" style={{ color: "var(--fg)" }}>
            三步开始使用
          </h2>
        </FadeUp>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <FadeUp key={s.no} delay={i * 0.1}>
              <HoverCard
                className="relative rounded-3xl p-5"
                style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--separator)" }}
                whileHover={{ y: -4 }}
              >
                <span className="text-[12px] font-bold tracking-widest" style={{ color: "var(--accent)" }}>
                  {s.no}
                </span>
                <motion.div
                  className="mt-2"
                  style={{ color: "var(--accent)" }}
                  whileHover={{ rotate: 8, scale: 1.06 }}
                  transition={spring}
                >
                  <s.icon size={30} strokeWidth={1.8} />
                </motion.div>
                <h3 className="mt-2 text-[16px] font-semibold" style={{ color: "var(--fg)" }}>
                  {s.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
                  {s.desc}
                </p>
              </HoverCard>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* FAQ（AnimatePresence 展开动画） */}
      <section className="mx-auto mt-16 max-w-2xl px-6">
        <FadeUp>
          <h2 className="text-center text-[26px] font-bold tracking-tight" style={{ color: "var(--fg)" }}>
            常见问题
          </h2>
        </FadeUp>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => (
            <FaqItem key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="mx-auto mt-16 max-w-2xl px-6 pb-8 text-center">
        <FadeUp>
          <motion.div
            className="rounded-[28px] p-8 sm:p-10"
            whileHover={{ scale: 1.01 }}
            transition={springSoft}
            style={{
              background: "linear-gradient(135deg, rgba(0,224,138,0.10), rgba(0,168,118,0.14))",
              border: "0.5px solid var(--separator)",
            }}
          >
            <h2 className="text-[24px] font-bold tracking-tight" style={{ color: "var(--fg)" }}>
              深夜信号已就绪
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
              无需注册，10 秒内创建你的第一个临时邮箱地址
            </p>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} transition={spring}>
              <Link
                href="/mail"
                className="btn-primary mt-6 inline-block min-w-[220px] text-center"
                style={{ boxShadow: "0 10px 30px rgba(0,168,118,0.35)" }}
              >
                免费创建临时邮箱
              </Link>
            </motion.div>
          </motion.div>
        </FadeUp>
      </section>

      {/* 底部 */}
      <footer
        className="border-t pb-8 pt-6 text-center text-[13px]"
        style={{ borderColor: "var(--separator)", color: "var(--fg-tertiary)" }}
      >
        <span className="mono tracking-[0.08em]">XUMI MAIL</span> · 深夜信号站 · 基于 Cloudflare Workers 构建
      </footer>
    </main>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--bg-secondary)", border: "0.5px solid var(--separator)" }}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={springSoft}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full cursor-pointer list-none items-center justify-between px-5 py-4 text-[15px] font-semibold"
        style={{ color: "var(--fg)" }}
      >
        {q}
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={spring}
          className="shrink-0"
          style={{ color: "var(--fg-tertiary)" }}
        >
          <Plus size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springSoft}
            style={{ overflow: "hidden" }}
          >
            <p className="px-5 pb-4 text-[14px] leading-relaxed" style={{ color: "var(--fg-secondary)" }}>
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}