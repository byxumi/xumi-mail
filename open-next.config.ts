import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // 静态资源直接由 Workers Assets 托管（单一 Worker 部署）
  enableCacheInterception: false,
});