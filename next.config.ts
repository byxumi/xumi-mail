import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // CI 未安装 eslint，跳过构建时 lint（类型检查由 tsc 保证）
  eslint: {
    ignoreDuringBuilds: true,
  },
  // worker-mailer 依赖 cloudflare:sockets（Workers 运行时模块），
  // 不能被打进 Next bundle，需标记为 external 由 workerd 运行时解析
  serverExternalPackages: ["worker-mailer"],
  webpack: (config, { isServer }) => {
    // cloudflare:email 是 Cloudflare Workers 运行时模块，仅在部署后的 Worker 中可用，
    // webpack 构建时标记为 external，由运行时解析（OpenNext 部署的 Worker 支持）
    if (isServer) {
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];
      config.externals = [
        ...existingExternals,
        // 正则匹配 cloudflare: 前缀的模块，返回 commonjs 引用
        /^cloudflare:/,
      ];
    }
    return config;
  },
};

export default nextConfig;

// Integrates the local `next dev` server with Cloudflare bindings (D1, KV, ...)
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();