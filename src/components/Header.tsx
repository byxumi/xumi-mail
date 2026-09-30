"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tokenStore } from "@/lib/client";

export default function Header() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");
  const hasAddress = typeof window !== "undefined" && !!tokenStore.getAddress();

  const handleLogout = () => {
    tokenStore.clearAddress();
    window.location.href = "/mail";
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-blue-600">
            ✉️ 临时邮箱
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-slate-600 sm:flex">
            <Link href="/mail" className={pathname?.startsWith("/mail") ? "font-medium text-blue-600" : "hover:text-slate-900"}>
              收件箱
            </Link>
            <Link href="/send" className={pathname?.startsWith("/send") ? "font-medium text-blue-600" : "hover:text-slate-900"}>
              发件
            </Link>
            <Link href="/account" className={pathname?.startsWith("/account") ? "font-medium text-blue-600" : "hover:text-slate-900"}>
              账号
            </Link>
            <Link href="/admin" className={pathname?.startsWith("/admin") ? "font-medium text-blue-600" : "hover:text-slate-900"}>
              管理
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {hasAddress ? (
            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              退出登录
            </button>
          ) : (
            <Link
              href="/mail"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            >
              开始使用
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}