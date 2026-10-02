import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: {
    default: "深夜信号站 · Xumi Mail",
    template: "%s · 深夜信号站",
  },
  description:
    "Xumi Mail 深夜信号站 - 免费临时邮箱服务，基于 Cloudflare Workers 部署，收信即焚，隐私安全",
  keywords: ["临时邮箱", "一次性邮箱", "Xumi Mail", "深夜信号站", "隐私邮箱"],
  icons: {
    icon: "/favicon.ico",
    apple: "/logo-192.png",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f0d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 自托管字体预加载，避免 FOIT */}
        <link rel="preload" href="/fonts/SpaceGrotesk-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/SpaceGrotesk-600.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/JetBrainsMono-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}