"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tokenStore } from "@/lib/client";
import { useTheme } from "@/hooks/useTheme";
import { useState } from "react";

/** iOS 风格毛玻璃导航栏 */
export default function Header() {
  const pathname = usePathname();
  const hasAddress = typeof window !== "undefined" && !!tokenStore.getAddress();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    tokenStore.clearAddress();
    window.location.href = "/mail";
  };

  const isActive = (p: string) => pathname?.startsWith(p);

  const navItems = [
    { href: "/mail", label: "收件箱", icon: "📥" },
    { href: "/send", label: "发件", icon: "📤" },
    { href: "/account", label: "账号", icon: "⚙️" },
    { href: "/admin", label: "管理", icon: "🛡️" },
  ];

  return (
    <header className="glass-bar sticky top-0 z-30">
      <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#0a84ff] to-[#5e5ce6] text-[15px] text-white shadow-sm">
              ✉️
            </span>
            <span className="text-[17px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
              Xumi Mail
            </span>
          </Link>
        </div>

        {/* 桌面端导航 */}
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-1.5 text-[15px] transition-all ${
                isActive(item.href)
                  ? "font-semibold"
                  : "opacity-60 hover:opacity-90"
              }`}
              style={isActive(item.href) ? { color: "var(--accent)" } : { color: "var(--fg)" }}
            >
              <span className="mr-1">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {/* 主题切换 */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="pressable flex h-8 w-8 items-center justify-center rounded-full text-[16px]"
            style={{ background: "var(--fill)" }}
            title="切换深浅色"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>

          {hasAddress ? (
            <button
              onClick={handleLogout}
              className="pressable hidden rounded-full px-3 py-1.5 text-[14px] font-medium text-[#ff3b30] sm:block"
              style={{ background: "var(--fill)" }}
            >
              退出
            </button>
          ) : (
            <Link
              href="/mail"
              className="pressable hidden rounded-full px-4 py-1.5 text-[14px] font-semibold text-white sm:block"
              style={{ background: "var(--accent)" }}
            >
              开始使用
            </Link>
          )}

          {/* 移动端菜单 */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[17px] md:hidden"
            style={{ background: "var(--fill)" }}
          >
            ☰
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
                <span>{item.icon}</span>
                {item.label}
              </Link>
            ))}
            {hasAddress ? (
              <button
                onClick={handleLogout}
                className="mt-1 w-full rounded-xl px-3 py-3 text-left text-[16px] text-[#ff3b30]"
                style={{ background: "var(--fill)" }}
              >
                🚪 退出登录
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