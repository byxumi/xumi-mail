import { NextRequest } from "next/server";
import { getEnv, json, text, ApiError, requireAdmin } from "@/lib/server";
import { getSetting } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/admin/config/:key —— 读取指定 key 的配置（DatabaseManager 用 /admin/config/D1_STORAGE_PLAN_CONFIG_KEY） */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const env = await getEnv();
    requireAdmin(env, req);
    const { key } = await params;
    if (!key || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(key)) {
      return text("无效的 key", 400);
    }
    const value = await getSetting(env, key);
    return json({ key, value });
  } catch (e) {
    return text(e instanceof ApiError ? e.message : "服务器错误", e instanceof ApiError ? e.status : 500);
  }
}