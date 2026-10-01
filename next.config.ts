import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // cloudflare:email 是 Cloudflare Workers 运行时模块，仅在部署后的 Worker 中可用，
    // webpack 构建时标记为 external，由运行时解析（OpenNext 部署的 Worker 支持）
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : config.externals ? [config.externals] : []),
        (ctx: any) => {
          if (typeof ctx.request === "string" && ctx.request.startsWith("cloudflare:")) {
            return `commonjs ${ctx.request}`;
          }
          return undefined;
        },
      ];
    }
    return config;
  },
};

export default nextConfig;

// Integrates the local `next dev` server with Cloudflare bindings (D1, KV, ...)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();