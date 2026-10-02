"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tokenStore } from "@/lib/client";
import { useTheme } from "@/hooks/useTheme";
import { useSettings } from "@/hooks/useSettings";
import { Icon } from "@/components/Icon";
import { useEffect, useRef, useState } from "react";

/** 顶部导航栏 */
export default function Header() {
  const pathname = usePathname();
  const hasAddress = typeof window !== "undefined" && !!tokenStore.getAddress();
  const { colorScheme, toggleTheme } = useTheme();
  const { settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [unread, setUnread] = useState(0);

  // 滚动时加深毛玻璃
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 未读徽标：监听本地存储变化（跨页面同步）
  useEffect(() => {
    const sync = () => {
      try {
        setUnread(parseInt(localStorage.getItem("tm_unread_count") || "0", 10) || 0);
      } catch {
        setUnread(0);
      }
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("tm-unread-updated", sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("tm-unread-updated", sync as EventListener);
    };
  }, []);

  const handleLogout = () => {
    tokenStore.clearAddress();
    window.location.href = "/mail";
  };

  const isActive = (p: string) => pathname?.startsWith(p);

  // 桌面「更多」下拉：点击外部或路由变化时关闭
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [moreOpen]);
  useEffect(() => {
    setMoreOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  // 主导航：只放普通用户日常功能
  const navItems = [
    { href: "/mail", label: "收件箱", icon: "inbox" as const, badge: unread },
    { href: "/send", label: "发件", icon: "send" as const, badge: 0 },
    ...(settings?.enableRedeemCode
      ? [{ href: "/redeem", label: "兑换", icon: "ticket" as const, badge: 0 }]
      : []),
    { href: "/account", label: "账号", icon: "settings" as const, badge: 0 },
  ];

  // 次级入口：移动端抽屉 / 桌面端「更多」弹出
  const moreItems = [
    { href: "/user", label: "用户中心", icon: "users" as const },
    { href: "/admin", label: "管理后台", icon: "shield" as const },
  ];

  return (
    <header className={`glass-bar sticky top-0 z-30 ${scrolled ? "scrolled" : ""}`}>
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-192.png"
              alt="须弥邮箱"
              className="h-7 w-7 rounded-[9px] object-cover"
              width={28}
              height={28}
            />
            <span className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
              须弥邮箱
            </span>
          </Link>
        </div>

        {/* 桌面端导航 */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-pill ${isActive(item.href) ? "active" : ""}`}
              style={isActive(item.href) ? { color: "var(--accent)" } : undefined}
            >
              <Icon name={item.icon} size={16} />
              {item.label}
              {item.badge > 0 && (
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ background: "var(--red)" }}
                >
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          ))}
          {/* 更多 */}
          <div className="relative ml-0.5" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`pressable flex h-8 w-8 items-center justify-center rounded-full ${moreOpen ? "opacity-100" : "opacity-60 hover:opacity-100"}`}
              style={{ color: "var(--fg)", background: moreOpen ? "var(--fill)" : undefined }}
              title="更多"
              aria-label="更多"
            >
              <Icon name="more" size={18} />
            </button>
            {moreOpen && (
              <div
                className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-2xl p-1 shadow-md"
                style={{ background: "var(--bg-secondary)", border: "1px solid var(--separator)" }}
              >
                {moreItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px]"
                    style={
                      isActive(item.href)
                        ? { color: "var(--accent)", background: "var(--fill)" }
                        : { color: "var(--fg)" }
                    }
                  >
                    <Icon name={item.icon} size={16} />
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          {/* 主题切换 */}
          <button
            onClick={toggleTheme}
            className="pressable flex h-8 w-8 items-center justify-center rounded-full"
            style={{ background: "var(--fill)", color: "var(--fg)" }}
            title="切换深浅色"
          >
            <Icon name={colorScheme === "dark" ? "sun" : "moon"} size={17} />
          </button>

          {hasAddress ? (
            <button
              onClick={handleLogout}
              className="pressable hidden items-center gap-1 rounded-full px-3 py-1.5 text-[14px] font-medium text-[#ff3b30] sm:flex"
              style={{ background: "var(--fill)" }}
            >
              <Icon name="logout" size={15} />
              退出
            </button>
          ) : (
            <Link
              href="/mail"
              className="pressable hidden rounded-full px-4 py-1.5 text-[14px] font-semibold text-white sm:block"
              style={{
                background:
                  "linear-gradient(135deg, var(--accent-bright) 0%, var(--accent) 60%, var(--accent-deep) 100%)",
                boxShadow: "0 2px 8px rgba(0,168,118,0.35)",
              }}
            >
              开始使用
            </Link>
          )}

          {/* 移动端菜单 */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full md:hidden"
            style={{ background: "var(--fill)", color: "var(--fg)" }}
            aria-label="菜单"
          >
            <Icon name="menu" size={18} />
          </button>
        </div>
      </div>

      {/* 移动端展开菜单 */}
      {menuOpen && (
        <div className="border-t md:hidden" style={{ borderColor: "var(--separator)" }}>
          <div className="mx-auto max-w-5xl px-4 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[16px]"
                style={
                  isActive(item.href)
                    ? { color: "var(--accent)", background: "var(--fill)" }
                    : { color: "var(--fg)" }
                }
              >
                <Icon name={item.icon} size={18} />
                {item.label}
                {item.badge > 0 && (
                  <span
                    className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
                    style={{ background: "var(--red)" }}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            ))}
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-[16px]"
                style={
                  isActive(item.href)
                    ? { color: "var(--accent)", background: "var(--fill)" }
                    : { color: "var(--fg)" }
                }
              >
                <Icon name={item.icon} size={18} />
                {item.label}
              </Link>
            ))}
            {hasAddress ? (
              <button
                onClick={handleLogout}
                className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[16px] text-[#ff3b30]"
                style={{ background: "var(--fill)" }}
              >
                <Icon name="logout" size={18} />
                退出登录
              </button>
            ) : (
              <Link
                href="/mail"
                onClick={() => setMenuOpen(false)}
                className="mt-1 block rounded-xl px-3 py-3 text-[16px] font-semibold text-white"
                style={{ background: "var(--accent)" }}
              >
                开始使用
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}