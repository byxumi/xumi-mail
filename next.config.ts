import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // 限制构建 worker 数量，避免 proot 环境下多 worker 内存映射失败
    cpus: 1,
  },
};

export default nextConfig;

// Integrates the local `next dev` server with Cloudflare bindings (D1, KV, ...)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();