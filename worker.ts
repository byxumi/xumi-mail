// 自定义 Worker 入口：复用 OpenNext 生成的 fetch handler，
// 并额外导出 email / scheduled 处理器（单一 Worker 部署前后端 + 收信）
import { processEmail } from "./src/lib/email";
import { Env } from "./src/types";
import { cleanup } from "./src/lib/address";
import { getJsonSetting } from "./src/lib/db";
import { CONSTANTS } from "./src/lib/constants";
import { CleanupSettings } from "./src/types";

// @ts-ignore `.open-next/worker.js` 由 opennextjs-cloudflare 构建时生成
import { default as handler } from "./.open-next/worker.js";

export default {
  // 分流：上游前端 API 前缀（/api /open_api /user_api /admin /redeem_api /telegram）
  // 重写映射到本后端路由体系，其余路径交给 ASSETS（web/dist，Vue3 前端 SPA）
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // —— API 前缀重写（上游 Vue 前端 -> 本 Next.js 后端路由）——
    let targetPath: string | null = null;
    if (path.startsWith("/open_api/")) {
      // /open_api/settings -> /api/open_api/settings
      targetPath = "/api" + path;
    } else if (path.startsWith("/user_api/")) {
      // /user_api/login -> /api/user/login
      targetPath = "/api/user" + path.slice("/user_api".length);
    } else if (path.startsWith("/admin/")) {
      // /admin/statistics -> /api/admin/statistics
      targetPath = "/api/admin" + path.slice("/admin".length);
    } else if (path.startsWith("/redeem_api/")) {
      // /redeem_api/redeem -> /api/redeem (我们的兑换端点不含 /redeem 子路径)
      const sub = path.slice("/redeem_api".length); // /redeem | /query | /result
      targetPath = sub === "/redeem" ? "/api/redeem" : "/api/redeem" + sub;
    } else if (path.startsWith("/telegram/")) {
      // Telegram 绑定功能未移植：直接走 Next（将返回 404/未实现）
      targetPath = "/api" + path;
    } else if (path.startsWith("/api/")) {
      targetPath = path;
    }

    if (targetPath) {
      const rewritten = new URL(targetPath + url.search, url.origin);
      return handler.fetch(new Request(rewritten, request), env, ctx);
    }

    // —— 非 API：Vue3 前端静态资源（SPA history 路由 fallback 由 wrangler assets 处理）——
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }
    return handler.fetch(request, env, ctx);
  },

  async email(message: any, env: Env, _ctx: ExecutionContext) {
    try {
      const emailMessage = {
        from: message.from,
        to: message.to,
        headers: message.headers as Headers,
        raw: message.raw as ReadableStream,
        rawSize: message.rawSize,
        setReject: (reason: string) => message.setReject(reason),
        forward: (addr: string) => message.forward(addr),
        reply: (replyMessage: unknown) => message.reply(replyMessage),
      };
      await processEmail(emailMessage, env);
    } catch (e) {
      console.error("email handler error:", e);
    }
  },

  async scheduled(controller: ScheduledController, env: Env, _ctx: ExecutionContext) {
    console.log("Scheduled event: ", controller);
    try {
      const autoCleanupSetting = await getJsonSetting<CleanupSettings>(env, CONSTANTS.AUTO_CLEANUP_KEY);
      if (!autoCleanupSetting) {
        console.log("No auto cleanup settings found, skipping cleanup.");
        return;
      }
      console.log("autoCleanupSetting:", JSON.stringify(autoCleanupSetting));
      if (autoCleanupSetting.enableMailsAutoCleanup) {
        await cleanup(env, "mails", autoCleanupSetting.cleanMailsDays);
      }
      if (autoCleanupSetting.enableUnknowMailsAutoCleanup) {
        await cleanup(env, "mails_unknow", autoCleanupSetting.cleanUnknowMailsDays);
      }
      if (autoCleanupSetting.enableSendBoxAutoCleanup) {
        await cleanup(env, "sendbox", autoCleanupSetting.cleanSendBoxDays);
      }
      if (autoCleanupSetting.enableInactiveAddressAutoCleanup) {
        await cleanup(env, "inactiveAddress", autoCleanupSetting.cleanInactiveAddressDays);
      }
      if (autoCleanupSetting.enableAddressAutoCleanup) {
        await cleanup(env, "addressCreated", autoCleanupSetting.cleanAddressDays);
      }
      if (autoCleanupSetting.enableUnboundAddressAutoCleanup) {
        await cleanup(env, "unboundAddress", autoCleanupSetting.cleanUnboundAddressDays);
      }
      if (autoCleanupSetting.enableEmptyAddressAutoCleanup) {
        await cleanup(env, "emptyAddress", autoCleanupSetting.cleanEmptyAddressDays);
      }
      if (autoCleanupSetting.customSqlCleanupList && autoCleanupSetting.customSqlCleanupList.length > 0) {
        for (const customSql of autoCleanupSetting.customSqlCleanupList) {
          if (customSql.enabled && customSql.sql) {
            try {
              const result = await env.DB.prepare(customSql.sql).run();
              console.log(`Custom SQL cleanup [${customSql.name}] ok:`, JSON.stringify(result));
            } catch (e) {
              console.error(`Custom SQL cleanup [${customSql.name}] failed: ${(e as Error).message}`);
            }
          }
        }
      }
    } catch (e) {
      console.error("scheduled handler error:", e);
    }
  },
} satisfies ExportedHandler<Env>;