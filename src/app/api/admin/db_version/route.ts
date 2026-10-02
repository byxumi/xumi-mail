import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getSetting } from "@/lib/db";
import { CONSTANTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/db_version —— 数据库版本/初始化状态（DatabaseManager.vue） */
export async function GET(req: NextRequest) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const version = (await getSetting(env, CONSTANTS.DB_VERSION_KEY)) ?? null;
    let database_size: number | null = null;
    try {
      const result = await env.DB.prepare(`SELECT 1`).run();
      // D1 run() 返回 meta.size_after（数据库文件字节数）
      database_size = (result?.meta as any)?.size_after ?? null;
    } catch {
      database_size = null;
    }
    return json({
      need_initialization: !version,
      need_migration: version !== CONSTANTS.DB_VERSION,
      current_db_version: version,
      code_db_version: CONSTANTS.DB_VERSION,
      database_size,
    });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}